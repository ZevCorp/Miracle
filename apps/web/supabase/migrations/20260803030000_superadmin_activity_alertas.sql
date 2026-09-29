-- ============================================================================
-- Señales nuevas para el panel "Atención" de /superadmin/salud.
--
-- El panel funcionaba pero era una lista de cinco números sin severidad, sin
-- enlaces y sin estado vacío — y dos de los cinco ni siquiera eran alertas
-- ("Eventos de auditoría (7d)" y "Consultas del asistente (7d)" son volumen, no
-- problemas: diluían la señal y se mueven a los KPI).
--
-- Lo que se añade responde a "¿a quién tengo que llamar?", no solo a "¿cuántos?".
-- En particular `doctores_con_fallos`: tres fallos repartidos entre tres médicos
-- es ruido del sistema; tres fallos del MISMO médico es un problema concreto con
-- nombre y apellido.
--
-- `create or replace` sin cambio de firma, así que no hay sobrecarga que
-- desambiguar.
-- ============================================================================

create or replace function public.superadmin_activity()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not (select private.is_superadmin()) then
    raise exception 'No autorizado';
  end if;

  with usuarios as (
    select
      p.id,
      p.email,
      p.full_name,
      p.role::text as role,
      p.organization_id,
      p.created_at,
      p.onboarding_completed_at,
      p.disabled_at,
      p.disabled_reason,
      u.last_sign_in_at,
      (select max(c.fecha) from public.consultations c
        where c.medico_id = p.id and c.deleted_at is null) as last_consultation_at,
      (select count(*) from public.consultations c
        where c.medico_id = p.id and c.deleted_at is null) as consultations_total,
      (select count(*) from public.consultations c
        where c.medico_id = p.id and c.deleted_at is null
          and c.fecha > now() - interval '7 days') as consultations_7d,
      (select count(*) from public.consultations c
        where c.medico_id = p.id and c.deleted_at is null
          and c.fecha > now() - interval '30 days') as consultations_30d,
      (select max(e.created_at) from public.clinical_encounters e
        where e.doctor_id = p.id) as last_encounter_at,
      (select count(*) from public.clinical_encounters e
        where e.doctor_id = p.id) as encounters_total,
      (select count(*) from public.clinical_encounters e
        where e.doctor_id = p.id and e.created_at > now() - interval '7 days') as encounters_7d,
      (select count(*) from public.clinical_encounters e
        where e.doctor_id = p.id and e.created_at > now() - interval '30 days') as encounters_30d
    from public.profiles p
    left join auth.users u on u.id = p.id
  ),
  usuarios_calc as (
    select
      usuarios.*,
      greatest(
        coalesce(last_consultation_at, 'epoch'::timestamptz),
        coalesce(last_encounter_at, 'epoch'::timestamptz)
      ) as last_activity_raw
    from usuarios
  ),
  usuarios_final as (
    select
      usuarios_calc.*,
      nullif(last_activity_raw, 'epoch'::timestamptz) as last_activity_at,
      (consultations_7d + encounters_7d) as work_7d,
      (consultations_30d + encounters_30d) as work_30d
    from usuarios_calc
  )
  select jsonb_build_object(
    'generated_at', now(),

    -- 1) Actividad -----------------------------------------------------------
    -- Las cuentas dadas de baja se excluyen de los denominadores: una cuenta
    -- cerrada a propósito no es un caso de abandono, y contarla haría que la
    -- adopción cayera cada vez que se hace limpieza.
    'active', jsonb_build_object(
      'total_users',        (select count(*) from usuarios_final where disabled_at is null),
      'total_doctors',      (select count(*) from usuarios_final where role = 'medico' and disabled_at is null),
      'signed_in_today',    (select count(*) from usuarios_final where disabled_at is null and last_sign_in_at > now() - interval '1 day'),
      'signed_in_7d',       (select count(*) from usuarios_final where disabled_at is null and last_sign_in_at > now() - interval '7 days'),
      'signed_in_30d',      (select count(*) from usuarios_final where disabled_at is null and last_sign_in_at > now() - interval '30 days'),
      'working_7d',         (select count(*) from usuarios_final where role = 'medico' and disabled_at is null and work_7d > 0),
      'working_30d',        (select count(*) from usuarios_final where role = 'medico' and disabled_at is null and work_30d > 0),
      'never_signed_in',    (select count(*) from usuarios_final where disabled_at is null and last_sign_in_at is null),
      'never_worked',       (select count(*) from usuarios_final
                              where role = 'medico' and disabled_at is null and last_activity_at is null),
      'onboarding_pending', (select count(*) from usuarios_final
                              where onboarding_completed_at is null and role = 'medico' and disabled_at is null),
      'disabled',           (select count(*) from usuarios_final where disabled_at is not null)
    ),

    'users', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'email', email,
          'full_name', full_name,
          'role', role,
          'organization_id', organization_id,
          'created_at', created_at,
          'onboarding_completed_at', onboarding_completed_at,
          'disabled_at', disabled_at,
          'disabled_reason', disabled_reason,
          'last_sign_in_at', last_sign_in_at,
          'last_activity_at', last_activity_at,
          'consultations_total', consultations_total,
          'consultations_7d', consultations_7d,
          'consultations_30d', consultations_30d,
          'encounters_total', encounters_total,
          'encounters_7d', encounters_7d,
          'encounters_30d', encounters_30d
        )
        order by last_activity_at desc nulls last, last_sign_in_at desc nulls last
      )
      from usuarios_final
    ), '[]'::jsonb),

    -- 2) Adopción ------------------------------------------------------------
    'adoption', jsonb_build_object(
      'templates_total', (select count(*) from public.clinical_templates),
      'templates_used', (
        select count(distinct nombre) from (
          select coalesce(e.template_snapshot->>'name', '') as nombre
            from public.clinical_encounters e
          union all
          select coalesce(c.plantilla, '') from public.consultations c
            where c.deleted_at is null
        ) usadas
        where nombre <> ''
      ),
      'top_templates', coalesce((
        select jsonb_agg(
          jsonb_build_object('name', nombre, 'specialty', especialidad, 'uses', usos)
          order by usos desc
        )
        from (
          select
            nombre,
            min(especialidad) as especialidad,
            count(*) as usos
          from (
            select
              coalesce(nullif(e.template_snapshot->>'name', ''), 'Sin plantilla') as nombre,
              lower(translate(
                coalesce(e.template_snapshot->>'specialty', ''),
                'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'
              )) as especialidad
            from public.clinical_encounters e
            union all
            select
              coalesce(nullif(c.plantilla, ''), 'Sin plantilla'),
              lower(translate(
                coalesce(c.especialidad, ''),
                'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'
              ))
            from public.consultations c where c.deleted_at is null
          ) usos_raw
          group by nombre
          order by count(*) desc
          limit 12
        ) top
      ), '[]'::jsonb),
      'weekly', coalesce((
        select jsonb_agg(w order by w->>'week')
        from (
          select jsonb_build_object(
            'week', to_char(semana, 'YYYY-MM-DD'),
            'consultations', (
              select count(*) from public.consultations c
              where c.deleted_at is null
                and c.fecha >= semana and c.fecha < semana + interval '7 days'
            ),
            'encounters', (
              select count(*) from public.clinical_encounters e
              where e.created_at >= semana and e.created_at < semana + interval '7 days'
            ),
            'doctors', (
              select count(distinct actor) from (
                select c.medico_id as actor from public.consultations c
                where c.deleted_at is null
                  and c.fecha >= semana and c.fecha < semana + interval '7 days'
                union
                select e.doctor_id from public.clinical_encounters e
                where e.created_at >= semana and e.created_at < semana + interval '7 days'
              ) activos
            )
          ) as w
          from generate_series(
            date_trunc('week', now()) - interval '7 weeks',
            date_trunc('week', now()),
            interval '1 week'
          ) as semana
        ) semanas
      ), '[]'::jsonb)
    ),

    -- 3) Salud ---------------------------------------------------------------
    'health', jsonb_build_object(
      'funnel', coalesce((
        select jsonb_agg(jsonb_build_object('status', status, 'count', n) order by n desc)
        from (
          select e.status, count(*) as n
          from public.clinical_encounters e
          group by e.status
        ) f
      ), '[]'::jsonb),
      'failed_total', (select count(*) from public.clinical_encounters where status = 'failed'),
      'failed_7d', (select count(*) from public.clinical_encounters
                     where status = 'failed' and updated_at > now() - interval '7 days'),
      'stuck_7d', (select count(*) from public.clinical_encounters
                    where status in ('created', 'transcript_ready', 'note_generating')
                      and created_at < now() - interval '1 day'
                      and created_at > now() - interval '7 days'),
      'consultations_7d', (select count(*) from public.consultations
                            where deleted_at is null and fecha > now() - interval '7 days'),
      'encounters_7d', (select count(*) from public.clinical_encounters
                         where created_at > now() - interval '7 days'),
      'audit_events_7d', (select count(*) from public.audit_events
                           where fecha > now() - interval '7 days'),

      -- NUEVAS SEÑALES ------------------------------------------------------

      -- Una nota sin firmar de hace más de una semana no es un pendiente: es un
      -- problema de cumplimiento. Usa el índice parcial consultations_fecha_idx.
      'borradores_estancados', (
        select count(*) from public.consultations
        where deleted_at is null and estado = 'borrador'
          and fecha < now() - interval '7 days'
      ),

      -- Contratos en riesgo: organizaciones vivas que llevan un mes sin usarse.
      'orgs_sin_actividad_30d', (
        select count(*) from public.organizations o
        where o.archived_at is null
          and not exists (
            select 1 from public.consultations c
            where c.organization_id = o.id and c.deleted_at is null
              and c.fecha > now() - interval '30 days'
          )
      ),

      -- A quién llamar. Tres fallos del mismo médico es un caso concreto;
      -- tres fallos repartidos son ruido del sistema.
      'doctores_con_fallos', coalesce((
        select jsonb_agg(jsonb_build_object(
          'doctor_id', d.doctor_id,
          'nombre', d.nombre,
          'fallos', d.fallos,
          'ultimo_error', d.ultimo_error
        ) order by d.fallos desc)
        from (
          select
            e.doctor_id,
            coalesce(p.full_name, p.email, 'Desconocido') as nombre,
            count(*) as fallos,
            max(e.last_generation_error) as ultimo_error
          from public.clinical_encounters e
          left join public.profiles p on p.id = e.doctor_id
          where e.status = 'failed' and e.updated_at > now() - interval '7 days'
          group by e.doctor_id, p.full_name, p.email
          having count(*) >= 3
        ) d
      ), '[]'::jsonb),

      -- Un lease vencido significa que el worker murió a mitad y la nota nunca
      -- llegó al HIS. La página mostraba conteos por estado, pero no distinguía
      -- "en cola" de "abandonada".
      'exportaciones_abandonadas', (
        select count(*) from public.graph_note_exports
        where status in ('pending', 'claimed')
          and lease_expires_at is not null
          and lease_expires_at < now()
      ),

      'cuentas_de_baja', (select count(*) from public.profiles where disabled_at is not null),
      'orgs_archivadas', (select count(*) from public.organizations where archived_at is not null)
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.superadmin_activity() from public, anon;
grant execute on function public.superadmin_activity() to authenticated;
