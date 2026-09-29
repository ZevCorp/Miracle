-- ============================================================================
-- Medición de impacto — RPCs de LECTURA para la consola /superadmin/medicion.
--
-- Mismo patrón que superadmin_encounter_metrics: jsonb de una pieza, barrera
-- private.is_superadmin(), zona horaria America/Bogota, y un bloque `cobertura`
-- OBLIGATORIO — la honestidad del panel: cuántos turnos se midieron vs cuántos se
-- excluyeron por mala calidad. calidad_ok filtra por defecto (una sesión con <85%
-- de cobertura, saltos de reloj o descartes NO entra a las comparaciones, para no
-- contaminar el baseline con datos parciales).
--
-- Lee de metrics_shift_summary (el rollup por turno que escribe el cron de Graph)
-- y, para el detalle de un turno, del crudo (metrics_samples/events/sap_visits)
-- mientras exista.
-- ============================================================================

-- Resumen institucional: KPIs, serie diaria, por médico, por app, cobertura, y la
-- tabla paginada de turnos. El corazón de la vista de institución.
create or replace function public.superadmin_medicion_resumen(
  p_from date default null,
  p_to   date default null,
  p_org  uuid default null,
  p_phase text default null,
  p_doctor uuid default null,
  p_device uuid default null,
  p_incluir_mala_calidad boolean default false,
  p_page int default 1,
  p_page_size int default 25
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  hoy date := (now() at time zone 'America/Bogota')::date;
  v_to date := least(coalesce(p_to, hoy), hoy);
  v_from date := coalesce(p_from, v_to - 29);
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_size int := least(greatest(coalesce(p_page_size, 25), 1), 100);
  result jsonb;
begin
  if not (select private.is_superadmin()) then raise exception 'No autorizado'; end if;
  if v_from > v_to then v_from := v_to; end if;

  with base as (
    select s.*
    from public.metrics_shift_summary s
    where s.fecha_operativa between v_from and v_to
      and (p_org is null or s.organization_id = p_org)
      and (p_phase is null or s.phase = p_phase)
      and (p_doctor is null or s.doctor_id = p_doctor)
      and (p_device is null or s.device_id = p_device)
  ),
  buenos as (
    select * from base where p_incluir_mala_calidad or calidad_ok
  ),
  kpis as (
    select
      count(*) as turnos,
      coalesce(round(avg(active_ms_total)/60000.0, 1), 0) as activo_min_prom,
      coalesce(round(avg(his_ms)/60000.0, 1), 0) as his_min_prom,
      coalesce(round(avg(typing_ms)/60000.0, 1), 0) as escritura_min_prom,
      coalesce(round(avg(clicks), 0), 0) as clics_prom,
      coalesce(round(avg(context_switches), 0), 0) as context_switches_prom,
      coalesce(round(avg(post_atencion_ms)/60000.0, 1), 0) as post_atencion_min_prom,
      coalesce(round(avg(cola_post_turno_ms)/60000.0, 1), 0) as cola_post_turno_min_prom,
      coalesce(round(avg(sap_wait_ms_total)/1000.0, 1), 0) as sap_espera_seg_prom,
      coalesce(percentile_cont(0.95) within group (order by ready_ms_p95), 0) as ready_ms_p95,
      coalesce(round(avg(encounters), 1), 0) as encounters_prom
    from buenos
  ),
  serie as (
    select jsonb_agg(jsonb_build_object(
      'fecha', d.fecha, 'turnos', d.turnos,
      'activo_min', round(d.activo/60000.0, 1), 'his_min', round(d.his/60000.0, 1)
    ) order by d.fecha) as j
    from (
      select fecha_operativa as fecha, count(*) as turnos,
             sum(active_ms_total) as activo, sum(his_ms) as his
      from buenos group by fecha_operativa
    ) d
  ),
  por_medico as (
    select jsonb_agg(jsonb_build_object(
      'doctor_id', m.doctor_id, 'nombre', coalesce(r.display_name, 'sin médico'),
      'turnos', m.turnos, 'activo_min', round(m.activo/60000.0, 1),
      'his_min', round(m.his/60000.0, 1), 'post_min', round(m.post/60000.0, 1)
    ) order by m.activo desc) as j
    from (
      select doctor_id, count(*) as turnos, sum(active_ms_total) as activo,
             sum(his_ms) as his, sum(post_atencion_ms) as post
      from buenos group by doctor_id
    ) m
    left join public.metrics_roster r on r.id = m.doctor_id
  ),
  por_app as (
    select jsonb_object_agg(app, ms) as j
    from (
      select key as app, sum((value)::bigint) as ms
      from buenos, lateral jsonb_each_text(active_ms_por_app)
      group by key order by sum((value)::bigint) desc limit 12
    ) a
  ),
  cobertura as (
    select jsonb_build_object(
      'turnos_totales', (select count(*) from base),
      'turnos_medidos', (select count(*) from base where calidad_ok),
      'turnos_excluidos', (select count(*) from base where not calidad_ok),
      'cobertura_media_pct', (select coalesce(round(avg(cobertura_pct), 1), 0) from base)
    ) as j
  ),
  turnos_pag as (
    select jsonb_agg(t) as j from (
      select jsonb_build_object(
        'shift_id', shift_id, 'fecha', fecha_operativa, 'phase', phase,
        'doctor_id', doctor_id, 'activo_min', round(active_ms_total/60000.0, 1),
        'his_min', round(his_ms/60000.0, 1), 'clics', clicks, 'encounters', encounters,
        'post_min', round(post_atencion_ms/60000.0, 1),
        'calidad_ok', calidad_ok, 'cobertura_pct', cobertura_pct
      ) as t
      from base order by fecha_operativa desc, shift_id
      limit v_size offset (v_page - 1) * v_size
    ) x
  )
  select jsonb_build_object(
    'rango', jsonb_build_object('from', v_from, 'to', v_to, 'phase', p_phase),
    'kpis', (select to_jsonb(kpis) from kpis),
    'serie', coalesce((select j from serie), '[]'::jsonb),
    'por_medico', coalesce((select j from por_medico), '[]'::jsonb),
    'por_app', coalesce((select j from por_app), '{}'::jsonb),
    'cobertura', (select j from cobertura),
    'turnos', coalesce((select j from turnos_pag), '[]'::jsonb),
    'page', v_page, 'page_size', v_size
  ) into result;

  return result;
end;
$$;

-- Timeline de UN turno: la serie por bucket (submuestreada a 1 min), las visitas
-- SAP en orden, los eventos, y los encounters con sus ventanas. Lee del crudo.
create or replace function public.superadmin_medicion_turno(p_shift uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb;
begin
  if not (select private.is_superadmin()) then raise exception 'No autorizado'; end if;

  with turno as (
    select * from public.metrics_shift_summary where shift_id = p_shift
  ),
  serie as (
    select jsonb_agg(jsonb_build_object(
      'minuto', m.minuto, 'app', m.app, 'active_ms', m.active_ms,
      'typing_ms', m.typing_ms, 'clicks', m.clicks, 'encounter_key', m.encounter_key
    ) order by m.minuto) as j
    from (
      select date_trunc('minute', bucket_start) as minuto, app,
             sum(active_ms) as active_ms, sum(typing_ms) as typing_ms,
             sum(clicks) as clicks, max(encounter_key) as encounter_key
      from public.metrics_samples where shift_id = p_shift
      group by 1, 2
    ) m
  ),
  visitas as (
    select jsonb_agg(jsonb_build_object(
      'tcode', tcode, 'surface', surface, 'entered_at', entered_at, 'dwell_ms', dwell_ms,
      'ready_ms', ready_ms, 'sap_wait_ms', sap_wait_ms, 'exit_to', exit_to, 'encounter_key', encounter_key
    ) order by entered_at) as j
    from public.metrics_sap_visits where shift_id = p_shift
  ),
  eventos as (
    select jsonb_agg(jsonb_build_object(
      'kind', kind, 'occurred_at', occurred_at, 'encounter_key', encounter_key, 'detail', detail
    ) order by occurred_at) as j
    from public.metrics_events where shift_id = p_shift
  )
  select jsonb_build_object(
    'turno', (select to_jsonb(t) from turno t),
    'serie', coalesce((select j from serie), '[]'::jsonb),
    'visitas', coalesce((select j from visitas), '[]'::jsonb),
    'eventos', coalesce((select j from eventos), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- Comparación de fases: medianas por turno, pareadas por médico. El "antes vs
-- después" que el estudio existe para responder. Solo turnos de buena calidad.
create or replace function public.superadmin_medicion_fases(p_org uuid, p_from date default null, p_to date default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  hoy date := (now() at time zone 'America/Bogota')::date;
  v_to date := least(coalesce(p_to, hoy), hoy);
  v_from date := coalesce(p_from, v_to - 120);
  result jsonb;
begin
  if not (select private.is_superadmin()) then raise exception 'No autorizado'; end if;

  with buenos as (
    select * from public.metrics_shift_summary
    where organization_id = p_org and calidad_ok
      and fecha_operativa between v_from and v_to
  ),
  por_fase as (
    select jsonb_object_agg(phase, m) as j from (
      select phase, jsonb_build_object(
        'n', count(*),
        'activo_min_mediana', round((percentile_cont(0.5) within group (order by active_ms_total)/60000.0)::numeric, 1),
        'his_min_mediana', round((percentile_cont(0.5) within group (order by his_ms)/60000.0)::numeric, 1),
        'escritura_min_mediana', round((percentile_cont(0.5) within group (order by typing_ms)/60000.0)::numeric, 1),
        'clics_mediana', percentile_cont(0.5) within group (order by clicks),
        'context_switches_mediana', percentile_cont(0.5) within group (order by context_switches),
        'post_min_mediana', round((percentile_cont(0.5) within group (order by post_atencion_ms)/60000.0)::numeric, 1),
        'sap_espera_seg_mediana', round((percentile_cont(0.5) within group (order by sap_wait_ms_total)/1000.0)::numeric, 1)
      ) as m
      from buenos group by phase
    ) f
  ),
  por_medico_fase as (
    select jsonb_agg(jsonb_build_object(
      'doctor_id', doctor_id, 'nombre', nombre, 'phase', phase,
      'activo_min_mediana', activo, 'his_min_mediana', his, 'n', n
    )) as j
    from (
      select b.doctor_id, coalesce(r.display_name,'sin médico') as nombre, b.phase,
        round((percentile_cont(0.5) within group (order by b.active_ms_total)/60000.0)::numeric, 1) as activo,
        round((percentile_cont(0.5) within group (order by b.his_ms)/60000.0)::numeric, 1) as his,
        count(*) as n
      from buenos b left join public.metrics_roster r on r.id = b.doctor_id
      group by b.doctor_id, r.display_name, b.phase
    ) x
  )
  select jsonb_build_object(
    'rango', jsonb_build_object('from', v_from, 'to', v_to),
    'por_fase', coalesce((select j from por_fase), '{}'::jsonb),
    'por_medico', coalesce((select j from por_medico_fase), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- Journeys SAP: las rutas más frecuentes surface→exit_to, con dwell y ready
-- medianos por pantalla. Dónde se concentra la fricción del HIS.
create or replace function public.superadmin_medicion_journeys(p_org uuid, p_from date default null, p_to date default null, p_tcode text default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  hoy date := (now() at time zone 'America/Bogota')::date;
  v_to date := least(coalesce(p_to, hoy), hoy);
  v_from date := coalesce(p_from, v_to - 29);
  result jsonb;
begin
  if not (select private.is_superadmin()) then raise exception 'No autorizado'; end if;

  with visitas as (
    select v.* from public.metrics_sap_visits v
    where v.organization_id = p_org
      and v.entered_at >= (v_from::timestamp at time zone 'America/Bogota')
      and v.entered_at < ((v_to + 1)::timestamp at time zone 'America/Bogota')
      and (p_tcode is null or v.tcode = p_tcode)
  ),
  rutas as (
    select jsonb_agg(jsonb_build_object('de', de, 'a', a, 'veces', veces) order by veces desc) as j
    from (
      select tcode as de, exit_to as a, count(*) as veces
      from visitas where exit_to is not null
      group by tcode, exit_to order by count(*) desc limit 20
    ) x
  ),
  pantallas as (
    select jsonb_agg(jsonb_build_object(
      'tcode', tcode, 'visitas', visitas, 'dwell_seg_mediana', dwell, 'ready_seg_mediana', ready
    ) order by visitas desc) as j
    from (
      select tcode, count(*) as visitas,
        round((percentile_cont(0.5) within group (order by dwell_ms)/1000.0)::numeric, 1) as dwell,
        round((percentile_cont(0.5) within group (order by ready_ms) filter (where ready_ms is not null)/1000.0)::numeric, 1) as ready
      from visitas group by tcode order by count(*) desc limit 20
    ) y
  )
  select jsonb_build_object(
    'rutas', coalesce((select j from rutas), '[]'::jsonb),
    'pantallas', coalesce((select j from pantallas), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.superadmin_medicion_resumen(date, date, uuid, text, uuid, uuid, boolean, int, int) to authenticated;
grant execute on function public.superadmin_medicion_turno(uuid) to authenticated;
grant execute on function public.superadmin_medicion_fases(uuid, date, date) to authenticated;
grant execute on function public.superadmin_medicion_journeys(uuid, date, date, text) to authenticated;

-- ============================================================================
-- El ROLLUP: computa metrics_shift_summary de UN turno desde el crudo. Es
-- recomputable (algo_version) — cambiar la definición de post-atención y volver a
-- correr no pierde nada. Lo llama el cron diario de Graph sobre los turnos
-- cerrados sin resumir; también se puede correr a mano para ver el baseline hoy.
--
-- Vive aquí (última migración) porque necesita metrics_phase_at (portal) y las
-- tablas crudas (Graph): el mismo Postgres las tiene todas.
--
-- calidad_ok = cobertura >= 85% Y sin saltos de reloj Y sin descartes. Es el
-- filtro que separa un turno que se puede comparar de uno que contaminaría.
-- ============================================================================
create or replace function public.metrics_recompute_shift_summary(p_shift uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  sh record;
  v_dur bigint;
  v_active bigint;
  v_cobertura numeric;
  v_ok boolean;
  v_fecha date;
begin
  select * into sh from public.metrics_shifts where shift_id = p_shift;
  if not found then return; end if;

  -- La fecha operativa: la del turno si viene, o la de su apertura en Bogotá.
  v_fecha := coalesce(sh.dia_operativo, (sh.started_at at time zone 'America/Bogota')::date);
  v_dur := greatest(0, extract(epoch from (coalesce(sh.ended_at, now()) - sh.started_at))::bigint * 1000);
  select coalesce(sum(active_ms), 0) into v_active from public.metrics_samples where shift_id = p_shift;
  v_cobertura := case when v_dur > 0
    then round(least(100.0, (select coalesce(sum(foreground_ms),0) from public.metrics_samples where shift_id = p_shift) * 100.0 / v_dur), 1)
    else 0 end;
  -- Un turno de mala calidad NO entra a las comparaciones: cobertura baja, el
  -- reloj saltó, o se descartaron muestras por spool lleno.
  v_ok := v_cobertura >= 85 and sh.clock_jumps = 0 and sh.spool_dropped = 0;

  insert into public.metrics_shift_summary as m (
    shift_id, organization_id, doctor_id, device_id, phase, fecha_operativa,
    duracion_ms, active_ms_total, active_ms_por_app, his_ms, typing_ms, keystrokes,
    clicks, scroll_ticks, context_switches, encounters, encounters_sin_id,
    post_atencion_ms, cola_post_turno_ms, sap_wait_ms_total, ready_ms_p50, ready_ms_p95,
    pantallas_distintas, visitas, cobertura_pct, calidad, calidad_ok, algo_version, computed_at)
  select
    p_shift, sh.organization_id, sh.doctor_id, sh.device_id,
    public.metrics_phase_at(sh.organization_id, v_fecha), v_fecha,
    v_dur, v_active,
    coalesce((select jsonb_object_agg(app, ms) from (
      select app, sum(active_ms) as ms from public.metrics_samples where shift_id = p_shift group by app) a), '{}'::jsonb),
    coalesce((select sum(active_ms) from public.metrics_samples where shift_id = p_shift and app = 'sap'), 0),
    coalesce((select sum(typing_ms) from public.metrics_samples where shift_id = p_shift), 0),
    coalesce((select sum(keystrokes) from public.metrics_samples where shift_id = p_shift), 0),
    coalesce((select sum(clicks) from public.metrics_samples where shift_id = p_shift), 0),
    coalesce((select sum(scroll_ticks) from public.metrics_samples where shift_id = p_shift), 0),
    coalesce((select sum(context_switches) from public.metrics_samples where shift_id = p_shift), 0),
    (select count(distinct encounter_key) from public.metrics_samples where shift_id = p_shift and encounter_key is not null),
    (select count(*) from public.metrics_events where shift_id = p_shift and kind = 'encounter_unknown'),
    -- post-atención (algo_version=1): activo atribuido a un encounter DESPUÉS de que
    -- empezó el siguiente encounter distinto. Aproximación por muestras con encounter
    -- cuya marca es posterior al último encounter_enter del turno.
    coalesce((select sum(s.active_ms) from public.metrics_samples s
              where s.shift_id = p_shift and s.encounter_key is not null
                and s.bucket_start > coalesce((select max(occurred_at) from public.metrics_events e
                   where e.shift_id = p_shift and e.kind = 'encounter_enter'), sh.started_at)), 0),
    coalesce((select sum(s.active_ms) from public.metrics_samples s
              where s.shift_id = p_shift and s.app = 'sap'
                and s.bucket_start > coalesce((select max(occurred_at) from public.metrics_events e
                   where e.shift_id = p_shift and e.kind = 'encounter_enter'), sh.started_at)), 0),
    coalesce((select sum(sap_wait_ms) from public.metrics_sap_visits where shift_id = p_shift), 0),
    (select round(percentile_cont(0.5) within group (order by ready_ms))::bigint from public.metrics_sap_visits where shift_id = p_shift and ready_ms is not null),
    (select round(percentile_cont(0.95) within group (order by ready_ms))::bigint from public.metrics_sap_visits where shift_id = p_shift and ready_ms is not null),
    (select count(distinct surface) from public.metrics_sap_visits where shift_id = p_shift),
    (select count(*) from public.metrics_sap_visits where shift_id = p_shift),
    v_cobertura,
    jsonb_build_object('cobertura_pct', v_cobertura, 'clock_jumps', sh.clock_jumps,
      'spool_dropped', sh.spool_dropped, 'hooks_degradados', sh.hooks_degradados,
      'ticks_sap_saltados_busy', sh.ticks_sap_saltados_busy),
    v_ok, 1, now()
  on conflict (shift_id) do update set
    organization_id = excluded.organization_id, doctor_id = excluded.doctor_id,
    device_id = excluded.device_id, phase = excluded.phase, fecha_operativa = excluded.fecha_operativa,
    duracion_ms = excluded.duracion_ms, active_ms_total = excluded.active_ms_total,
    active_ms_por_app = excluded.active_ms_por_app, his_ms = excluded.his_ms,
    typing_ms = excluded.typing_ms, keystrokes = excluded.keystrokes, clicks = excluded.clicks,
    scroll_ticks = excluded.scroll_ticks, context_switches = excluded.context_switches,
    encounters = excluded.encounters, encounters_sin_id = excluded.encounters_sin_id,
    post_atencion_ms = excluded.post_atencion_ms, cola_post_turno_ms = excluded.cola_post_turno_ms,
    sap_wait_ms_total = excluded.sap_wait_ms_total, ready_ms_p50 = excluded.ready_ms_p50,
    ready_ms_p95 = excluded.ready_ms_p95, pantallas_distintas = excluded.pantallas_distintas,
    visitas = excluded.visitas, cobertura_pct = excluded.cobertura_pct,
    calidad = excluded.calidad, calidad_ok = excluded.calidad_ok, computed_at = now();
end;
$$;

-- El entrypoint del cron: resume los turnos cerrados que aún no tienen summary (o
-- cuyo summary quedó viejo), y de paso los turnos abiertos hace rato (para ver el
-- baseline del día en curso). Devuelve cuántos resumió.
create or replace function public.metrics_recompute_pending(p_max int default 500)
returns int
language plpgsql security definer set search_path = public as $$
declare v_n int := 0; r record;
begin
  for r in
    select s.shift_id from public.metrics_shifts s
    left join public.metrics_shift_summary ss on ss.shift_id = s.shift_id
    where ss.shift_id is null                                   -- nunca resumido
       or s.updated_at > ss.computed_at                          -- el turno cambió después
       or (s.ended_at is null and ss.computed_at < now() - interval '30 minutes')  -- abierto: refrescar
    order by s.started_at
    limit greatest(1, coalesce(p_max, 500))
  loop
    perform public.metrics_recompute_shift_summary(r.shift_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
