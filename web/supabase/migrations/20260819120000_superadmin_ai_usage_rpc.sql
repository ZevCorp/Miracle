-- ============================================================================
-- Métricas de consumo de IA para la consola de plataforma.
--
-- POR QUÉ UNA RPC Y NO CONSULTAS SUELTAS
-- Las dos pantallas de consumo necesitan una docena de agregados sobre la misma
-- ventana de `ai_usage_events`. Pedirlos por separado desde PostgREST serían
-- doce viajes y doce criterios de "qué cuenta como evento del periodo" que se
-- irían separando con el tiempo. Mismo patrón que superadmin_dashboard.
--
-- SECURITY INVOKER, A PROPÓSITO
-- `ai_usage_events` ya tiene la política "ai usage lectura por alcance", que se
-- apoya en private.ai_usage_scope(): superadmin ve todo, un admin ve su
-- organización y el resto solo lo suyo. Con `invoker` esa regla se aplica sola,
-- así que esta misma función sirve mañana para el panel de un hospital sin
-- tocar una línea. Con `definer` habría que reimplementar el alcance a mano, y
-- equivocarse ahí es filtrar el consumo de un cliente a otro.
--
-- LO QUE NO SE ESCONDE
-- El bloque `cobertura` existe porque los totales de dinero de esta tabla están
-- incompletos por construcción: un modelo sin fila en ai_model_prices produce
-- eventos con cost_usd nulo (cost_status = 'unpriced_no_rate'). Al escribir
-- esto, eso era el 73 % de los tokens. Un panel que sume cost_usd y lo presente
-- como "el gasto" se equivoca por defecto, así que la RPC devuelve siempre qué
-- porción del volumen quedó sin tarifar para que la UI lo pueda decir.
-- ============================================================================

create or replace function public.superadmin_ai_usage(
  p_from date default null,
  p_to   date default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
  hoy    date := (now() at time zone 'America/Bogota')::date;
  v_to   date;
  v_from date;
  v_dias int;
  v_ini  timestamptz;
  v_fin  timestamptz;
  v_pini timestamptz;
begin
  v_to   := least(coalesce(p_to, hoy), hoy);
  v_from := coalesce(p_from, v_to - 29);
  if v_from > v_to then v_from := v_to; end if;
  if (v_to - v_from) > 365 then v_from := v_to - 365; end if;

  v_dias := (v_to - v_from) + 1;
  v_ini  := (v_from::timestamp at time zone 'America/Bogota');
  v_fin  := ((v_to + 1)::timestamp at time zone 'America/Bogota');
  v_pini := ((v_from - v_dias)::timestamp at time zone 'America/Bogota');

  with
  actual as (
    select * from public.ai_usage_events
    where occurred_at >= v_ini and occurred_at < v_fin
  ),
  previo as (
    select * from public.ai_usage_events
    where occurred_at >= v_pini and occurred_at < v_ini
  ),
  tot as (
    select
      (select coalesce(sum(total_tokens), 0) from actual)          as tokens,
      (select coalesce(sum(total_tokens), 0) from previo)          as tokens_prev,
      (select coalesce(sum(cost_usd), 0) from actual)              as costo,
      (select coalesce(sum(cost_usd), 0) from previo)              as costo_prev,
      (select count(*) from actual)                                as eventos,
      (select count(*) from previo)                                as eventos_prev,
      (select count(*) filter (where status <> 'ok') from actual)  as errores,
      (select coalesce(sum(total_tokens), 0) from actual
        where cost_usd is null)                                    as tokens_sin_tarifa,
      (select count(*) from actual where organization_id is null)  as sin_atribucion
  )
  select jsonb_build_object(
    'generated_at', now(),
    'rango', jsonb_build_object('desde', v_from, 'hasta', v_to, 'dias', v_dias),

    'kpis', (
      select jsonb_build_object(
        'tokens', jsonb_build_object(
          'value', tokens, 'previous', tokens_prev,
          'delta_pct', case when tokens_prev = 0 then null
            else round(((tokens - tokens_prev)::numeric / tokens_prev) * 100) end),
        'costo_usd', jsonb_build_object(
          'value', round(costo, 4), 'previous', round(costo_prev, 4),
          'delta_pct', case when costo_prev = 0 then null
            else round(((costo - costo_prev) / costo_prev) * 100) end),
        'eventos', jsonb_build_object(
          'value', eventos, 'previous', eventos_prev,
          'delta_pct', case when eventos_prev = 0 then null
            else round(((eventos - eventos_prev)::numeric / eventos_prev) * 100) end),
        'errores', jsonb_build_object('value', errores, 'total', eventos)
      ) from tot
    ),

    -- Honestidad del dinero: qué porción del volumen no está tarifada, y qué
    -- porción del consumo no tiene dueño conocido.
    'cobertura', (
      select jsonb_build_object(
        'tokens', tokens,
        'tokens_sin_tarifa', tokens_sin_tarifa,
        'pct_sin_tarifa', case when tokens = 0 then 0
          else round(100.0 * tokens_sin_tarifa / tokens) end,
        'eventos', eventos,
        'eventos_sin_atribucion', sin_atribucion,
        'pct_sin_atribucion', case when eventos = 0 then 0
          else round(100.0 * sin_atribucion / eventos) end
      ) from tot
    ),

    'serie_diaria', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', to_char(d.dia, 'YYYY-MM-DD'),
        'tokens', coalesce(a.tokens, 0),
        'costo_usd', round(coalesce(a.costo, 0), 4),
        'eventos', coalesce(a.n, 0)
      ) order by d.dia)
      from generate_series(v_from::timestamp, v_to::timestamp, interval '1 day') as d(dia)
      left join (
        select (occurred_at at time zone 'America/Bogota')::date as dia,
          sum(total_tokens) as tokens, sum(cost_usd) as costo, count(*) as n
        from actual group by 1
      ) a on a.dia = d.dia::date
    ), '[]'::jsonb),

    -- Dónde se va el consumo. `sin_tarifa` marca las filas cuyo costo no se
    -- puede calcular, para que la UI no las presente como gasto cero.
    'por_feature', coalesce((
      select jsonb_agg(jsonb_build_object(
        'app', app, 'feature', feature, 'provider', provider,
        'model', requested_model,
        'eventos', n, 'tokens', tokens,
        'costo_usd', round(coalesce(costo, 0), 4),
        'sin_tarifa', sin_tarifa
      ) order by tokens desc)
      from (
        select app, feature, provider, requested_model,
          count(*) as n, sum(total_tokens) as tokens, sum(cost_usd) as costo,
          count(*) filter (where cost_usd is null) as sin_tarifa
        from actual group by 1, 2, 3, 4
        order by sum(total_tokens) desc limit 12
      ) f
    ), '[]'::jsonb),

    'modelos_sin_tarifa', coalesce((
      select jsonb_agg(jsonb_build_object(
        'provider', provider, 'model', requested_model,
        'eventos', n, 'tokens', tokens) order by tokens desc)
      from (
        select provider, requested_model, count(*) as n, sum(total_tokens) as tokens
        from actual where cost_status = 'unpriced_no_rate'
        group by 1, 2
      ) m
    ), '[]'::jsonb),

    -- Quién consume. Los eventos sin atribuir se agrupan como una fila más en
    -- vez de desaparecer del reparto: si no, los porcentajes por organización
    -- sumarían 100 % sobre una base que no es el consumo real.
    'por_organizacion', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', org_id, 'nombre', nombre,
        'eventos', n, 'tokens', tokens,
        'costo_usd', round(coalesce(costo, 0), 4),
        'sin_tarifa', sin_tarifa,
        'usuarios', usuarios) order by tokens desc)
      from (
        select a.organization_id as org_id,
          coalesce(o.name, 'Sin atribuir') as nombre,
          count(*) as n, sum(a.total_tokens) as tokens, sum(a.cost_usd) as costo,
          count(*) filter (where a.cost_usd is null) as sin_tarifa,
          count(distinct a.user_id) as usuarios
        from actual a
        left join public.organizations o on o.id = a.organization_id
        group by 1, 2
      ) g
    ), '[]'::jsonb),

    'por_usuario', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', uid, 'nombre', nombre, 'organizacion', org,
        'eventos', n, 'tokens', tokens,
        'costo_usd', round(coalesce(costo, 0), 4),
        'sin_tarifa', sin_tarifa
      ) order by tokens desc)
      from (
        select a.user_id as uid,
          coalesce(nullif(btrim(p.full_name), ''), p.email, 'Sin nombre') as nombre,
          o.name as org,
          count(*) as n, sum(a.total_tokens) as tokens, sum(a.cost_usd) as costo,
          count(*) filter (where a.cost_usd is null) as sin_tarifa
        from actual a
        left join public.profiles p on p.id = a.user_id
        left join public.organizations o on o.id = a.organization_id
        where a.user_id is not null
        group by 1, 2, 3
        order by sum(a.total_tokens) desc limit 10
      ) u
    ), '[]'::jsonb),

    -- Fiabilidad: un fallo del proveedor puede haber consumido el prompt igual,
    -- así que el gasto y los errores se leen juntos y no en pantallas distintas.
    'fiabilidad', coalesce((
      select jsonb_agg(jsonb_build_object(
        'feature', feature, 'eventos', n, 'errores', errores,
        'pct_error', case when n = 0 then 0 else round(100.0 * errores / n) end,
        'latencia_p95', p95) order by errores desc, n desc)
      from (
        select feature, count(*) as n,
          count(*) filter (where status <> 'ok') as errores,
          round(percentile_cont(0.95) within group (order by latency_ms))::int as p95
        from actual group by 1
      ) r
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.superadmin_ai_usage(date, date) from public, anon;
grant execute on function public.superadmin_ai_usage(date, date) to authenticated;
