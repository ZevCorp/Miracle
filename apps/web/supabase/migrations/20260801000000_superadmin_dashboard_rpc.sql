-- ============================================================================
-- RPC del dashboard de la consola de super-admin.
--
-- superadmin_overview() da conteos y superadmin_activity() da uso por persona.
-- Esta añade lo que falta para que la consola cuente una historia: TENDENCIA
-- (comparación contra el período anterior), SERIES para graficar, métricas por
-- organización y el estado operativo de la plataforma.
--
-- SECURITY DEFINER para leer auth.users.last_sign_in_at, igual que
-- superadmin_activity. El guard is_superadmin() es la barrera.
--
-- PHI: solo metadatos — conteos, fechas, nombres de organización/plantilla y
-- acciones de auditoría. Nunca transcripciones, contenido de notas ni nombres
-- de pacientes.
--
-- Como en superadmin_activity, consultations (web) y clinical_encounters
-- (asistente) NO se suman: una misma atención puede quedar en ambas.
-- ============================================================================

create or replace function public.superadmin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  hoy date := (now() at time zone 'America/Bogota')::date;
begin
  if not (select private.is_superadmin()) then
    raise exception 'No autorizado';
  end if;

  with
  -- Ventanas de comparación: los últimos 7 días contra los 7 anteriores.
  ventanas as (
    select
      (select count(*) from public.consultations
        where deleted_at is null and fecha > now() - interval '7 days') as consultas_7d,
      (select count(*) from public.consultations
        where deleted_at is null
          and fecha > now() - interval '14 days'
          and fecha <= now() - interval '7 days') as consultas_7d_prev,
      (select count(distinct medico_id) from public.consultations
        where deleted_at is null and fecha > now() - interval '7 days') as medicos_7d,
      (select count(distinct medico_id) from public.consultations
        where deleted_at is null
          and fecha > now() - interval '14 days'
          and fecha <= now() - interval '7 days') as medicos_7d_prev,
      (select count(distinct organization_id) from public.consultations
        where deleted_at is null and fecha > now() - interval '30 days') as orgs_activas,
      (select count(*) from public.organizations) as orgs_total,
      (select count(*) from public.clinical_encounters
        where created_at > now() - interval '30 days') as encounters_30d,
      (select count(*) from public.clinical_encounters
        where status = 'failed' and created_at > now() - interval '30 days') as encounters_fallidos_30d
  )
  select jsonb_build_object(
    'generated_at', now(),

    -- 1) KPIs con tendencia ---------------------------------------------------
    'kpis', (
      select jsonb_build_object(
        'consultas', jsonb_build_object(
          'value', consultas_7d,
          'previous', consultas_7d_prev,
          'delta_pct', case when consultas_7d_prev = 0 then null
            else round(((consultas_7d - consultas_7d_prev)::numeric / consultas_7d_prev) * 100) end
        ),
        'medicos', jsonb_build_object(
          'value', medicos_7d,
          'previous', medicos_7d_prev,
          'delta_pct', case when medicos_7d_prev = 0 then null
            else round(((medicos_7d - medicos_7d_prev)::numeric / medicos_7d_prev) * 100) end
        ),
        'organizaciones', jsonb_build_object(
          'value', orgs_activas,
          'total', orgs_total
        ),
        -- Tasa de éxito del asistente: encuentros que llegaron a nota o
        -- completado, sobre el total con desenlace (excluye los aún en curso).
        'exito_notas', jsonb_build_object(
          'value', case when encounters_30d = 0 then null
            else round(((encounters_30d - encounters_fallidos_30d)::numeric / encounters_30d) * 100) end,
          'fallidos', encounters_fallidos_30d,
          'total', encounters_30d
        )
      )
      from ventanas
    ),

    -- 2) Serie diaria de los últimos 30 días ----------------------------------
    'serie_diaria', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', to_char(dia, 'YYYY-MM-DD'),
          'consultations', (
            select count(*) from public.consultations c
            where c.deleted_at is null
              and (c.fecha at time zone 'America/Bogota')::date = dia
          ),
          'encounters', (
            select count(*) from public.clinical_encounters e
            where (e.created_at at time zone 'America/Bogota')::date = dia
          )
        )
        order by dia
      )
      from generate_series(hoy - 29, hoy, interval '1 day') as dia
    ), '[]'::jsonb),

    -- 3) Métricas por organización --------------------------------------------
    'organizaciones', coalesce((
      select jsonb_agg(o order by (o->>'consultas_30d')::int desc, o->>'name')
      from (
        select jsonb_build_object(
          'id', org.id,
          'name', org.name,
          'kind', org.kind,
          'nit', org.nit,
          'members', (select count(*) from public.profiles p where p.organization_id = org.id),
          'members_active_30d', (
            select count(distinct c.medico_id) from public.consultations c
            where c.organization_id = org.id and c.deleted_at is null
              and c.fecha > now() - interval '30 days'
          ),
          'consultas_total', (
            select count(*) from public.consultations c
            where c.organization_id = org.id and c.deleted_at is null
          ),
          'consultas_30d', (
            select count(*) from public.consultations c
            where c.organization_id = org.id and c.deleted_at is null
              and c.fecha > now() - interval '30 days'
          ),
          'consultas_7d', (
            select count(*) from public.consultations c
            where c.organization_id = org.id and c.deleted_at is null
              and c.fecha > now() - interval '7 days'
          ),
          'last_activity_at', (
            select max(c.fecha) from public.consultations c
            where c.organization_id = org.id and c.deleted_at is null
          ),
          -- Mini-serie de 8 semanas para la tendencia de cada organización.
          'weekly', coalesce((
            select jsonb_agg(n order by wk)
            from (
              select date_trunc('week', now()) - (i || ' weeks')::interval as wk,
                (select count(*) from public.consultations c
                  where c.organization_id = org.id and c.deleted_at is null
                    and c.fecha >= date_trunc('week', now()) - (i || ' weeks')::interval
                    and c.fecha < date_trunc('week', now()) - ((i - 1) || ' weeks')::interval
                ) as n
              from generate_series(7, 0, -1) as i
            ) semanas
          ), '[]'::jsonb)
        ) as o
        from public.organizations org
      ) orgs
    ), '[]'::jsonb),

    -- 4) Distribución por especialidad ----------------------------------------
    'especialidades', coalesce((
      select jsonb_agg(
        jsonb_build_object('name', especialidad, 'count', n)
        order by n desc
      )
      from (
        select coalesce(nullif(trim(especialidad), ''), 'Sin especialidad') as especialidad,
          count(*) as n
        from public.consultations
        where deleted_at is null and fecha > now() - interval '90 days'
        group by 1
        order by count(*) desc
        limit 8
      ) esp
    ), '[]'::jsonb),

    -- 5) Actividad reciente (auditoría) ---------------------------------------
    'actividad_reciente', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'accion', a.accion,
          'actor', a.actor_name,
          'organizacion', o.name,
          'fecha', a.fecha
        )
        order by a.fecha desc
      )
      from (
        select id, accion, actor_name, organization_id, fecha
        from public.audit_events
        order by fecha desc
        limit 12
      ) a
      left join public.organizations o on o.id = a.organization_id
    ), '[]'::jsonb),

    -- 6) Salud operativa -------------------------------------------------------
    'salud', jsonb_build_object(
      'encounters_funnel', coalesce((
        select jsonb_agg(jsonb_build_object('status', status, 'count', n) order by n desc)
        from (select status, count(*) as n from public.clinical_encounters group by status) f
      ), '[]'::jsonb),
      'consultas_por_estado', coalesce((
        select jsonb_agg(jsonb_build_object('estado', estado, 'count', n) order by n desc)
        from (
          select estado, count(*) as n from public.consultations
          where deleted_at is null group by estado
        ) e
      ), '[]'::jsonb),
      'exports', coalesce((
        select jsonb_agg(jsonb_build_object('status', status, 'count', n) order by n desc)
        from (select status, count(*) as n from public.graph_note_exports group by status) x
      ), '[]'::jsonb),
      'encounters_stuck', (
        select count(*) from public.clinical_encounters
        where status in ('created', 'recording', 'transcript_ready', 'note_generating')
          and created_at < now() - interval '1 day'
      ),
      'encounters_failed', (select count(*) from public.clinical_encounters where status = 'failed')
    ),

    -- 7) Apps conectadas -------------------------------------------------------
    'dispositivos', jsonb_build_object(
      'windows', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'email', w.email,
            'display_name', w.display_name,
            'app_version', w.app_version,
            'machine_name', w.machine_name,
            'os_version', w.os_version,
            'last_seen_at', w.last_seen_at
          )
          order by w.last_seen_at desc nulls last
        )
        from (select * from public.graph_windows_users order by last_seen_at desc nulls last limit 20) w
      ), '[]'::jsonb),
      'moviles', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'display_name', m.display_name,
            'device_model', m.device_model,
            'app_version', m.app_version,
            'last_seen_at', m.last_seen_at
          )
          order by m.last_seen_at desc nulls last
        )
        from (select * from public.graph_app_users order by last_seen_at desc nulls last limit 20) m
      ), '[]'::jsonb)
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.superadmin_dashboard() from public, anon;
grant execute on function public.superadmin_dashboard() to authenticated;
