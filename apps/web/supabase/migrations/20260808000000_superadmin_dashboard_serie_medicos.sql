-- ============================================================================
-- Resumen de la consola: serie diaria de médicos, nombres honestos y una sola
-- pasada por organización.
--
-- TRES COSAS, TODAS SOBRE LA MISMA FUNCIÓN.
--
-- 1) `serie_diaria` gana `medicos` (médicos distintos con consulta ese día).
--    La tarjeta "Médicos trabajando" dibujaba su microtendencia con la serie de
--    `encounters` —el asistente clínico—, que es OTRA métrica: el titular
--    contaba médicos y la línea de debajo contaba encuentros. Con una serie
--    propia la tarjeta deja de mentir. No cuesta un barrido extra: sale del
--    mismo grupo que ya calculaba `consultations`.
--
-- 2) `members_active_rango` junto a `members_active_30d`. El valor SIEMPRE se
--    calculó dentro del rango pedido (v_ini/v_fin), así que con el selector en
--    "7 días" la clave decía 30 y el dato era de 7. Se añade el nombre correcto
--    y se deja el viejo con el mismo valor: /organizaciones y el detalle de
--    organización llaman sin argumentos (rango = 30 días por defecto), donde el
--    nombre antiguo sí es exacto, y así no se rompen mientras migran.
--
-- 3) Un `lateral` por organización en vez de catorce subconsultas correlacionadas.
--    El bloque por organización hacía seis escaneos de `consultations` (total,
--    rango, médicos del rango, 30d, 7d, última actividad) más ocho para la
--    sparkline semanal — por CADA organización, y en una pantalla que se puede
--    dejar auto-refrescando cada minuto. Ahora son dos: uno agregado con
--    `filter` y otro agrupado por semana. Mismos números, mismo orden.
-- ============================================================================

create or replace function public.superadmin_dashboard(
  p_from date default null,
  p_to   date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  hoy    date := (now() at time zone 'America/Bogota')::date;
  v_to   date;
  v_from date;
  v_dias int;
  -- Límites medio-abiertos en timestamptz: `fecha >= v_ini and fecha < v_fin`
  -- usa el índice consultations_fecha_idx, cosa que
  -- `(fecha at time zone 'America/Bogota')::date = x` no puede hacer.
  v_ini  timestamptz;
  v_fin  timestamptz;
  -- Ventana inmediatamente anterior, del mismo largo, para el delta.
  v_pini timestamptz;
  -- Inicio de la semana en curso: ancla de las 8 semanas de la sparkline.
  v_sem  timestamptz;
begin
  if not (select private.is_superadmin()) then
    raise exception 'No autorizado';
  end if;

  -- Saneado en la base además de en la app: la RPC es alcanzable directamente.
  v_to   := least(coalesce(p_to, hoy), hoy);
  v_from := coalesce(p_from, v_to - 29);
  if v_from > v_to then v_from := v_to; end if;
  if (v_to - v_from) > 365 then v_from := v_to - 365; end if;

  v_dias := (v_to - v_from) + 1;
  v_ini  := (v_from::timestamp at time zone 'America/Bogota');
  v_fin  := ((v_to + 1)::timestamp at time zone 'America/Bogota');
  v_pini := ((v_from - v_dias)::timestamp at time zone 'America/Bogota');
  v_sem  := date_trunc('week', now());

  with
  ventanas as (
    select
      (select count(*) from public.consultations
        where deleted_at is null and fecha >= v_ini and fecha < v_fin) as consultas_rango,
      (select count(*) from public.consultations
        where deleted_at is null and fecha >= v_pini and fecha < v_ini) as consultas_prev,
      (select count(distinct medico_id) from public.consultations
        where deleted_at is null and fecha >= v_ini and fecha < v_fin) as medicos_rango,
      (select count(distinct medico_id) from public.consultations
        where deleted_at is null and fecha >= v_pini and fecha < v_ini) as medicos_prev,
      (select count(distinct organization_id) from public.consultations
        where deleted_at is null and fecha >= v_ini and fecha < v_fin) as orgs_activas,
      (select count(*) from public.organizations) as orgs_total,
      (select count(*) from public.clinical_encounters
        where created_at >= v_ini and created_at < v_fin) as encounters_rango,
      (select count(*) from public.clinical_encounters
        where status = 'failed' and created_at >= v_ini and created_at < v_fin) as encounters_fallidos
  )
  select jsonb_build_object(
    'generated_at', now(),

    -- 0) El rango que de verdad se aplicó, para que la UI no lo adivine -------
    'rango', jsonb_build_object(
      'desde', v_from,
      'hasta', v_to,
      'dias', v_dias,
      'desde_previo', v_from - v_dias,
      'hasta_previo', v_from - 1
    ),

    -- 1) KPIs con tendencia contra el periodo anterior ------------------------
    'kpis', (
      select jsonb_build_object(
        'consultas', jsonb_build_object(
          'value', consultas_rango,
          'previous', consultas_prev,
          'delta_pct', case when consultas_prev = 0 then null
            else round(((consultas_rango - consultas_prev)::numeric / consultas_prev) * 100) end
        ),
        'medicos', jsonb_build_object(
          'value', medicos_rango,
          'previous', medicos_prev,
          'delta_pct', case when medicos_prev = 0 then null
            else round(((medicos_rango - medicos_prev)::numeric / medicos_prev) * 100) end
        ),
        'organizaciones', jsonb_build_object(
          'value', orgs_activas,
          'total', orgs_total
        ),
        'exito_notas', jsonb_build_object(
          'value', case when encounters_rango = 0 then null
            else round(((encounters_rango - encounters_fallidos)::numeric / encounters_rango) * 100) end,
          'fallidos', encounters_fallidos,
          'total', encounters_rango
        )
      )
      from ventanas
    ),

    -- 2) Serie diaria del rango ------------------------------------------------
    -- Dos agregados y un left join contra el calendario, en vez de subconsultas
    -- correlacionadas por día: `(fecha at time zone …)::date = dia` no puede
    -- usar el índice y hacía N escaneos. `medicos` viaja en el mismo grupo que
    -- `consultations` —misma tabla, mismo filtro— así que sale gratis.
    'serie_diaria', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', to_char(d.dia, 'YYYY-MM-DD'),
          'consultations', coalesce(c.n, 0),
          'medicos', coalesce(c.medicos, 0),
          'encounters', coalesce(e.n, 0)
        )
        order by d.dia
      )
      from generate_series(v_from::timestamp, v_to::timestamp, interval '1 day') as d(dia)
      left join (
        select (fecha at time zone 'America/Bogota')::date as dia,
          count(*) as n,
          count(distinct medico_id) as medicos
        from public.consultations
        where deleted_at is null and fecha >= v_ini and fecha < v_fin
        group by 1
      ) c on c.dia = d.dia::date
      left join (
        select (created_at at time zone 'America/Bogota')::date as dia, count(*) as n
        from public.clinical_encounters
        where created_at >= v_ini and created_at < v_fin
        group by 1
      ) e on e.dia = d.dia::date
    ), '[]'::jsonb),

    -- 3) Métricas por organización --------------------------------------------
    -- Un `lateral` agregado por organización: una pasada por sus consultas con
    -- `filter` para cada ventana, en vez de una subconsulta por métrica.
    'organizaciones', coalesce((
      select jsonb_agg(o order by (o->>'consultas_rango')::int desc, o->>'name')
      from (
        select jsonb_build_object(
          'id', org.id,
          'name', org.name,
          'kind', org.kind,
          'nit', org.nit,
          'members', (select count(*) from public.profiles p where p.organization_id = org.id),
          -- Médicos con actividad DENTRO DEL RANGO pedido. `members_active_30d`
          -- se mantiene con el mismo valor solo por compatibilidad: es el nombre
          -- que todavía leen /organizaciones y el detalle, que llaman sin rango.
          'members_active_rango', m.medicos_rango,
          'members_active_30d', m.medicos_rango,
          'consultas_total', m.total,
          -- consultas_rango es el dato que manda el selector de periodo.
          -- consultas_30d/7d conservan su significado literal para no cambiar en
          -- silencio lo que dicen las tarjetas de organización.
          'consultas_rango', m.rango,
          'consultas_30d', m.d30,
          'consultas_7d', m.d7,
          'last_activity_at', m.ultima,
          -- 8 semanas: FORMA para la sparkline, nunca una ventana de consulta.
          -- Un solo grupo por semana + left join contra la serie de semanas, para
          -- que las semanas sin consultas salgan en 0 en vez de desaparecer.
          'weekly', coalesce((
            select jsonb_agg(coalesce(w.n, 0) order by s.wk)
            from (
              select v_sem - (i || ' weeks')::interval as wk
              from generate_series(7, 0, -1) as i
            ) s
            left join (
              select date_trunc('week', c.fecha) as wk, count(*) as n
              from public.consultations c
              where c.organization_id = org.id and c.deleted_at is null
                and c.fecha >= v_sem - interval '7 weeks'
                and c.fecha < v_sem + interval '1 week'
              group by 1
            ) w on w.wk = s.wk
          ), '[]'::jsonb)
        ) as o
        from public.organizations org
        cross join lateral (
          select
            count(*) as total,
            max(c.fecha) as ultima,
            count(*) filter (where c.fecha >= v_ini and c.fecha < v_fin) as rango,
            count(distinct c.medico_id) filter (where c.fecha >= v_ini and c.fecha < v_fin) as medicos_rango,
            count(*) filter (where c.fecha > now() - interval '30 days') as d30,
            count(*) filter (where c.fecha > now() - interval '7 days') as d7
          from public.consultations c
          where c.organization_id = org.id and c.deleted_at is null
        ) m
      ) orgs
    ), '[]'::jsonb),

    -- 4) Distribución por especialidad, dentro del rango -----------------------
    'especialidades', coalesce((
      select jsonb_agg(
        jsonb_build_object('name', especialidad, 'count', n)
        order by n desc
      )
      from (
        select coalesce(nullif(trim(especialidad), ''), 'Sin especialidad') as especialidad,
          count(*) as n
        from public.consultations
        where deleted_at is null and fecha >= v_ini and fecha < v_fin
        group by 1
        order by count(*) desc
        limit 8
      ) esp
    ), '[]'::jsonb),

    -- 5) Actividad reciente (auditoría) ---------------------------------------
    -- Sin rango a propósito: es "lo último que pasó", y el explorador completo
    -- vive en /superadmin/actividad con sus propios filtros.
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

    -- 6) Salud operativa: ESTADO ACTUAL, deliberadamente sin rango -------------
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
    -- `*_versiones` es el conjunto de versiones de TODA la tabla, no solo de las
    -- filas que se muestran: si la máquina con el build más nuevo no abrió la
    -- app hace poco se caía del top, "la última versión" retrocedía en silencio
    -- y el resto dejaba de marcarse como vieja.
    --
    -- Se devuelve el conjunto y NO un max(): `max` sobre texto compara
    -- alfabéticamente, y ahí "0.9" sale mayor que "0.40" cuando la versión
    -- nueva es la 0.40. La comparación con semántica de versión vive en
    -- lib/superadmin/versiones.ts, que sabe además tratar los sufijos
    -- ("1.0.0-beta") como anteriores a su release.
    'dispositivos', jsonb_build_object(
      'windows_total', (select count(*) from public.graph_windows_users),
      'moviles_total', (select count(*) from public.graph_app_users),
      'windows_versiones', coalesce((
        select jsonb_agg(distinct app_version)
        from public.graph_windows_users where app_version is not null
      ), '[]'::jsonb),
      'moviles_versiones', coalesce((
        select jsonb_agg(distinct app_version)
        from public.graph_app_users where app_version is not null
      ), '[]'::jsonb),
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
        from (select * from public.graph_windows_users order by last_seen_at desc nulls last limit 200) w
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
        from (select * from public.graph_app_users order by last_seen_at desc nulls last limit 200) m
      ), '[]'::jsonb)
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.superadmin_dashboard(date, date) from public, anon;
grant execute on function public.superadmin_dashboard(date, date) to authenticated;
