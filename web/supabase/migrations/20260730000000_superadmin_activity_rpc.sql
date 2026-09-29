-- ============================================================================
-- RPC de actividad para la consola de super-admin.
--
-- Responde tres preguntas que el "Resumen" actual no puede responder:
--   1. ¿Quién está usando Miracle de verdad? (último acceso vs. último dictado)
--   2. ¿Qué se adopta? (ranking de médicos, plantillas realmente usadas)
--   3. ¿Qué se está rompiendo? (embudo de la consulta y consultas fallidas)
--
-- SECURITY DEFINER porque necesita leer auth.users.last_sign_in_at, que no está
-- expuesto al rol `authenticated` (superadmin_overview es INVOKER porque solo
-- lee tablas public con RLS aditiva). El guard is_superadmin() es la barrera.
--
-- PHI: devuelve SOLO metadatos — conteos, fechas y nombres de plantilla. Nunca
-- transcripciones, contenido de notas ni datos de pacientes.
--
-- Dos fuentes de trabajo clínico conviven y NO se suman (una misma atención
-- puede quedar en ambas): public.consultations es la web, y
-- public.clinical_encounters es el asistente del backend Graph. Se reportan por
-- separado; "última actividad" es la más reciente de las dos.
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
    -- El acceso se mide sobre TODOS los usuarios; el trabajo clínico solo sobre
    -- médicos: un administrador que nunca dicta no es un caso de abandono.
    'active', jsonb_build_object(
      'total_users',        (select count(*) from usuarios_final),
      'total_doctors',      (select count(*) from usuarios_final where role = 'medico'),
      'signed_in_today',    (select count(*) from usuarios_final where last_sign_in_at > now() - interval '1 day'),
      'signed_in_7d',       (select count(*) from usuarios_final where last_sign_in_at > now() - interval '7 days'),
      'signed_in_30d',      (select count(*) from usuarios_final where last_sign_in_at > now() - interval '30 days'),
      'working_7d',         (select count(*) from usuarios_final where role = 'medico' and work_7d > 0),
      'working_30d',        (select count(*) from usuarios_final where role = 'medico' and work_30d > 0),
      'never_signed_in',    (select count(*) from usuarios_final where last_sign_in_at is null),
      'never_worked',       (select count(*) from usuarios_final
                              where role = 'medico' and last_activity_at is null),
      'onboarding_pending', (select count(*) from usuarios_final
                              where onboarding_completed_at is null and role = 'medico')
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
      -- Se agrupa por NOMBRE de plantilla: la especialidad llega escrita de dos
      -- formas ("patologia" desde el snapshot, "Patología" desde la web) y
      -- agrupar por ambas partiría la misma plantilla en dos filas.
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
        -- El orden se hace sobre el entero, NO sobre el jsonb: comparar
        -- t->>'uses' es comparación de texto y pondría "62" por encima de "192".
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
                           where fecha > now() - interval '7 days')
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.superadmin_activity() from public, anon;
grant execute on function public.superadmin_activity() to authenticated;
