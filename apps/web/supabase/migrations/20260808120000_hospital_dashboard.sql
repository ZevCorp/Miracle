-- Métricas del panel de administración de un hospital, calculadas en la base.
--
-- POR QUÉ EXISTE ESTO
-- El dashboard del admin y /app/reportes calculaban sus cifras en el navegador,
-- sobre el store del cliente, que carga con `.limit(300)` (providers.tsx).
-- En una institución con más de 300 consultas eso significa que "Notas
-- registradas" se congela en 300 y nadie se entera: el número se ve normal.
-- Peor: el dashboard descartaba las consultas de demostración y reportes no, así
-- que las dos pantallas mostraban cifras distintas del mismo dato.
--
-- Esta RPC es la única fuente de verdad de las dos pantallas. Cuenta sobre la
-- tabla completa, con una sola definición de "consulta real" y una sola fórmula
-- de completitud (la misma que `completitud()` en lib/mock y que
-- consultation_audit_stats, para que las tres pantallas por fin coincidan).
--
-- SEGURIDAD: `security invoker`, igual que consultation_audit_stats. No hace
-- ningún chequeo de organización a mano porque no le hace falta — la política
-- SELECT de `consultations` ya filtra por `organization_id = current_org()` y
-- por `deleted_at is null`, y la de `profiles` deja leer el equipo solo a
-- admin/supervisor. Un médico que llame a esta función recibe sus propias
-- consultas y nada más: no hay superficie de fuga entre organizaciones.

-- La fórmula de completitud vive aquí para no repetirla cuatro veces en el
-- cuerpo de la RPC. Es la traducción exacta de ripsChecklist() en lib/mock:
-- 2 ítems que siempre están (identificación y finalidad) + diagnóstico +
-- procedimiento + nota aprobada, sobre 5.
create or replace function private.completitud_rips(
  p_has_dx   boolean,
  p_has_proc boolean,
  p_firmada  boolean
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select (
    2
    + (case when p_has_dx then 1 else 0 end)
    + (case when p_has_proc then 1 else 0 end)
    + (case when p_firmada then 1 else 0 end)
  ) * 100.0 / 5;
$$;

comment on function private.completitud_rips(boolean, boolean, boolean) is
  'Completitud RIPS de una nota (0-100). Espejo de ripsChecklist() en lib/mock.';

create or replace function public.hospital_dashboard(
  p_from date default null,
  p_to   date default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  -- Ventana pedida. Sin argumentos: los últimos 30 días en zona clínica, el
  -- mismo default que resolverRango() en el cliente.
  win as (
    select
      coalesce(p_from, (now() at time zone 'America/Bogota')::date - 29) as desde,
      coalesce(p_to,   (now() at time zone 'America/Bogota')::date)      as hasta
  ),
  rango as (
    select
      desde,
      hasta,
      (hasta - desde) + 1                as dias,
      desde - ((hasta - desde) + 1)      as desde_prev,
      desde - 1                          as hasta_prev
    from win
  ),
  -- Universo de consultas REALES visibles para quien llama.
  --
  -- El filtro de demostración replica isDemoConsultation() (lib/demo.ts) por sus
  -- dos señales fiables: el marcador de auditoría y el motivo del guion. La
  -- tercera señal del cliente (buscar una frase dentro del transcript) no se
  -- replica a propósito: obligaría a escanear la columna más pesada de la tabla
  -- en cada carga del dashboard, y solo aplica a consultas anteriores al
  -- marcador, que ya quedan cubiertas por el motivo.
  base as (
    select
      c.id,
      c.medico_id,
      c.patient_id,
      c.estado,
      c.fecha,
      coalesce(nullif(btrim(c.servicio), ''), 'Sin servicio') as servicio,
      coalesce(nullif(btrim(c.tipo), ''), 'presencial') as tipo,
      (c.fecha at time zone 'America/Bogota')::date as dia,
      (
        select count(*) from jsonb_array_elements(
          case when jsonb_typeof(c.codigos) = 'array' then c.codigos else '[]'::jsonb end
        ) e
        where e->>'sistema' = 'CIE-10' and e->>'estado' = 'aceptado'
      ) > 0 as has_dx,
      (
        select count(*) from jsonb_array_elements(
          case when jsonb_typeof(c.codigos) = 'array' then c.codigos else '[]'::jsonb end
        ) e
        where e->>'sistema' = 'CUPS' and e->>'estado' = 'aceptado'
      ) > 0 as has_proc,
      c.estado in ('aprobada', 'exportada') as firmada
    from public.consultations c
    where coalesce(c.motivo, '') <> 'Cefalea de 3 días'
      and not exists (
        select 1
        from public.audit_events a
        where a.consultation_id = c.id
          and a.accion = 'Nota de demostración generada por IA'
      )
  ),
  actual as (
    select b.* from base b, rango r where b.dia between r.desde and r.hasta
  ),
  previo as (
    select b.* from base b, rango r where b.dia between r.desde_prev and r.hasta_prev
  ),
  -- Equipo que documenta. Se incluye a quien NO tuvo actividad: la pregunta de
  -- un administrador no es solo "cuánto se produjo" sino "quién no está usando
  -- la herramienta", y esa fila solo existe si el roster manda.
  roster as (
    select p.id, coalesce(nullif(btrim(p.full_name), ''), p.email) as nombre
    from public.profiles p
    where p.role in ('medico', 'supervisor')
      and p.disabled_at is null
  ),
  kpis as (
    select
      (select count(*) from actual)                                        as consultas,
      (select count(*) from previo)                                        as consultas_prev,
      (select count(distinct medico_id) from actual where medico_id is not null) as medicos,
      (select count(distinct medico_id) from previo where medico_id is not null) as medicos_prev,
      (select count(distinct patient_id) from actual where patient_id is not null) as pacientes,
      (select count(distinct patient_id) from previo where patient_id is not null) as pacientes_prev,
      (select coalesce(round(avg(private.completitud_rips(has_dx, has_proc, firmada))), 0)
         from actual)                                                      as completitud,
      (select coalesce(round(avg(private.completitud_rips(has_dx, has_proc, firmada))), 0)
         from previo)                                                      as completitud_prev,
      (select count(*) filter (where firmada) from actual)                 as firmadas,
      (select count(*) filter (where has_dx) from actual)                  as con_dx,
      -- La cola de firma se mide sobre TODO el histórico, no sobre el rango: una
      -- nota sin firmar de hace tres meses sigue siendo un pendiente hoy, y
      -- esconderla al elegir "últimos 7 días" sería justo lo contrario de lo
      -- que necesita ver un administrador.
      (select count(*) from base where estado in ('borrador', 'revisada'))  as por_firmar,
      (select count(*) from base) as total_historico
  ),
  serie as (
    select
      d::date as fecha,
      count(a.id) as consultas
    from rango r
      cross join generate_series(r.desde, r.hasta, interval '1 day') d
      left join actual a on a.dia = d::date
    group by d::date
    order by d::date
  ),
  por_estado as (
    select estado, count(*) as value
    from actual
    group by estado
  ),
  -- Por servicio va con su completitud: el volumen dice dónde se trabaja y la
  -- completitud dice dónde está el problema documental. Separarlos en dos
  -- gráficas obligaba a cruzarlas a ojo.
  por_servicio as (
    select
      servicio,
      count(*) as value,
      round(avg(private.completitud_rips(has_dx, has_proc, firmada))) as completitud
    from actual
    group by servicio
    order by count(*) desc, servicio
    limit 8
  ),
  por_tipo as (
    select tipo, count(*) as value
    from actual
    group by tipo
    order by count(*) desc
  ),
  por_medico as (
    select
      ro.id   as medico_id,
      ro.nombre,
      count(a.id)                                                   as consultas,
      count(a.id) filter (where a.estado in ('borrador', 'revisada')) as sin_firmar,
      coalesce(round(avg(private.completitud_rips(a.has_dx, a.has_proc, a.firmada))), 0) as completitud,
      -- Última actividad en TODO el histórico, no solo en el rango: es el dato
      -- que responde "¿desde cuándo no documenta?" cuando `consultas` es 0.
      (select max(b.fecha) from base b where b.medico_id = ro.id)    as ultima
    from roster ro
      left join actual a on a.medico_id = ro.id
    group by ro.id, ro.nombre
    order by count(a.id) desc, ro.nombre
  )
  select jsonb_build_object(
    'generated_at', now(),
    'rango', (
      select jsonb_build_object('desde', desde, 'hasta', hasta, 'dias', dias) from rango
    ),
    'kpis', (
      select jsonb_build_object(
        'consultas', jsonb_build_object(
          'value', consultas, 'previous', consultas_prev,
          'delta_pct', case when consultas_prev = 0 then null
                            else round((consultas - consultas_prev) * 100.0 / consultas_prev) end
        ),
        'medicos_activos', jsonb_build_object(
          'value', medicos, 'previous', medicos_prev,
          'delta_pct', case when medicos_prev = 0 then null
                            else round((medicos - medicos_prev) * 100.0 / medicos_prev) end
        ),
        'pacientes', jsonb_build_object(
          'value', pacientes, 'previous', pacientes_prev,
          'delta_pct', case when pacientes_prev = 0 then null
                            else round((pacientes - pacientes_prev) * 100.0 / pacientes_prev) end
        ),
        'completitud', jsonb_build_object(
          'value', completitud, 'previous', completitud_prev,
          'delta_pct', case when completitud_prev = 0 then null
                            else round((completitud - completitud_prev) * 100.0 / completitud_prev) end
        ),
        'firmadas', jsonb_build_object('value', firmadas),
        'con_dx', jsonb_build_object('value', con_dx),
        'por_firmar', jsonb_build_object('value', por_firmar),
        'total_historico', jsonb_build_object('value', total_historico)
      )
      from kpis
    ),
    'serie_diaria', coalesce(
      (select jsonb_agg(jsonb_build_object('fecha', fecha, 'consultas', consultas)) from serie),
      '[]'::jsonb
    ),
    'por_estado', coalesce(
      (select jsonb_agg(jsonb_build_object('estado', estado, 'value', value)) from por_estado),
      '[]'::jsonb
    ),
    'por_servicio', coalesce(
      (select jsonb_agg(jsonb_build_object(
         'servicio', servicio, 'value', value, 'completitud', completitud
       )) from por_servicio),
      '[]'::jsonb
    ),
    'por_tipo', coalesce(
      (select jsonb_agg(jsonb_build_object('tipo', tipo, 'value', value)) from por_tipo),
      '[]'::jsonb
    ),
    'por_medico', coalesce(
      (select jsonb_agg(jsonb_build_object(
         'medico_id', medico_id,
         'nombre', nombre,
         'consultas', consultas,
         'sin_firmar', sin_firmar,
         'completitud', completitud,
         'ultima', ultima
       )) from por_medico),
      '[]'::jsonb
    )
  );
$$;

comment on function public.hospital_dashboard(date, date) is
  'Métricas de la organización del llamante (RLS) para /app/dashboard y /app/reportes.';

revoke all on function public.hospital_dashboard(date, date) from public, anon;
grant execute on function public.hospital_dashboard(date, date) to authenticated;
