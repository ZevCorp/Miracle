-- ============================================================================
-- Telemetría por consulta (encounter_metrics) + RPCs de la consola.
--
-- QUÉ MIDE. Cada consulta de Miracle Notes termina produciendo UNA fila con:
-- tiempo de uso real de la pantalla (active_ms), tiempo de micrófono abierto
-- descontando pausas (recording_ms), y la estructura temporal de la
-- conversación (quién habló cuándo) como una línea de tiempo SIN TEXTO, de la
-- que se derivan interrogatorio y silencios. Los tokens NO viven aquí: siguen
-- en ai_usage_events y se atribuyen por session_id = encounter_id (contrato
-- con Graph en docs/graph-metrics-contract.md).
--
-- POR QUÉ UNA FILA Y NO UN LEDGER DE PINGS. Un evento por flush de 30 s serían
-- ~120 filas/hora/médico sin valor analítico propio: todo lo que la consola
-- necesita son sumas por consulta. La "recomputabilidad" no la da un ledger
-- sino speaker_timeline, que se guarda cruda; las derivadas llevan
-- algo_version para poder recalcularlas con mejores umbrales sin perder nada.
--
-- PRIVACIDAD. Solo números, timestamps y etiquetas técnicas. Jamás texto de
-- transcripción, nombres ni contenido clínico.
--
-- ESCRITURA. No hay política de INSERT/UPDATE a propósito: el único camino es
-- record_encounter_usage() (SECURITY DEFINER con topes). Un UPDATE directo por
-- PostgREST falla por RLS aunque el cliente esté autenticado, y el RPC clampa
-- los deltas contra el reloj de pared para que un cliente no pueda inflar.
-- ============================================================================

create table public.encounter_metrics (
  encounter_id     uuid primary key
                     references public.clinical_encounters(id) on delete cascade,
  doctor_id        uuid not null,
  -- Snapshot del perfil al crear la fila: clinical_encounters no tiene
  -- organización y la consola agrupa por org sin joins vivos.
  organization_id  uuid,

  -- Ventana de uso. Reabrir la consulta reutiliza la fila (multi-sesión).
  first_used_at    timestamptz not null default now(),
  last_used_at     timestamptz not null default now(),
  -- Se sella al guardar la nota (completed). NULL = la consulta nunca cerró.
  finished_at      timestamptz,

  -- Acumuladores. Semántica del reloj en lib/clinical/encounter-usage.ts.
  active_ms        bigint not null default 0,
  recording_ms     bigint not null default 0,
  flush_count      integer not null default 0,
  session_count    integer not null default 0,
  last_session_id  uuid,

  -- Línea de tiempo de hablantes SIN texto: [[spk,start_ms,end_ms,stream],…]
  -- * spk: etiqueta del proveedor como entero; 0 = sin diarización.
  -- * start/end_ms relativos al inicio de GRABACIÓN ACUMULADA (el cliente suma
  --   el offset de tramos previos), así las pausas manuales ya están
  --   descontadas y el silencio se mide directo sobre [0, recording_ms].
  -- * stream: ordinal del socket. Las etiquetas de hablante NO son estables
  --   entre streams (una reconexión puede renombrar a los hablantes).
  speaker_timeline           jsonb,
  speaker_timeline_truncated boolean not null default false,
  diarization      boolean not null default false,

  -- Derivadas de speaker_timeline. NULL = no medido (nunca un 0 falso).
  talk_ms_by_speaker jsonb,
  interrogation_ms   integer,
  silence_ms         integer,
  longest_silence_ms integer,

  metrics_schema   integer not null default 1,
  algo_version     integer,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.encounter_metrics is
  'Telemetría por consulta: uso, grabación y estructura temporal de la conversación. Sin PHI.';
comment on column public.encounter_metrics.speaker_timeline is
  'Segmentos [[spk,start_ms,end_ms,stream]] relativos al inicio de grabación; sin texto.';

create index encounter_metrics_doctor_idx
  on public.encounter_metrics (doctor_id, first_used_at desc);
create index encounter_metrics_org_idx
  on public.encounter_metrics (organization_id, first_used_at desc);
create index encounter_metrics_window_idx
  on public.encounter_metrics (first_used_at);

-- El join consola ↔ ledger va por session_id (texto). Parcial: la mayoría de
-- los eventos históricos lo tienen vacío y no aportan nada al índice.
create index if not exists ai_usage_events_session_idx
  on public.ai_usage_events (session_id) where session_id <> '';

alter table public.encounter_metrics enable row level security;
grant select on table public.encounter_metrics to authenticated;

-- Mismo alcance que "ai usage lectura por alcance" en ai_usage_events:
-- superadmin ve todo, un admin su organización, el médico lo suyo. Así las
-- lecturas directas (panel de hospital, mañana) no necesitan otra regla.
create policy "encounter metrics lectura por alcance"
  on public.encounter_metrics for select to authenticated
  using (exists (
    select 1 from private.ai_usage_scope() s(scope, org_id, actor_id)
    where s.scope = 'all'
       or (s.scope = 'org'  and encounter_metrics.organization_id = s.org_id)
       or (s.scope = 'self' and encounter_metrics.doctor_id = s.actor_id)
  ));

-- ============================================================================
-- Derivadas de conversación. En la base y no en el cliente para poder
-- RECOMPUTAR por backfill cuando mejoren los umbrales (subir algo_version y
-- re-ejecutar sobre speaker_timeline), sin depender de qué versión del
-- frontend escribió la fila.
--
-- Umbrales (algo_version = 1):
-- * fusión: huecos ≤ 1 s entre segmentos del mismo hablante son la misma
--   locución (respiración, puntuación del proveedor).
-- * interrogatorio: cambio de hablante con hueco ≤ 8 s = alternancia (la pausa
--   pregunta→respuesta ES parte del interrogatorio); hacen falta ≥ 2
--   alternancias encadenadas (A→B→A) para contar un bloque — una sola es un
--   saludo o una interrupción, no un interrogatorio.
-- * silencio: huecos ≥ 5 s. Por debajo están las pausas de turno y la
--   respiración (1–3 s); por encima suele ser examen físico o el médico
--   escribiendo, que es justo lo clínicamente interesante.
-- ============================================================================
create or replace function private.compute_conversation_metrics(
  p_timeline     jsonb,
  p_recording_ms bigint
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  seg          record;
  -- Locuciones fusionadas, en orden: arrays paralelos.
  n            int := 0;
  spk          int[]    := '{}';
  ini          bigint[] := '{}';
  fin          bigint[] := '{}';
  strm         int[]    := '{}';
  hay_diar     boolean := false;
  hablantes    int := 0;

  talk         jsonb := '{}'::jsonb;
  clave        text;

  -- Interrogatorio
  interr       bigint := 0;
  alternancias int := 0;
  bloque_ini   bigint := null;
  bloque_fin   bigint := null;

  -- Silencio (sobre la unión de habla de cualquier hablante)
  u_ini        bigint[] := '{}';
  u_fin        bigint[] := '{}';
  m            int := 0;
  silencio     bigint := 0;
  mayor        bigint := 0;
  hueco        bigint;
  i            int;
begin
  if p_timeline is null or jsonb_typeof(p_timeline) <> 'array'
     or jsonb_array_length(p_timeline) = 0 then
    return jsonb_build_object(
      'diarization', false,
      'talk_ms_by_speaker', null,
      'interrogation_ms', null,
      'silence_ms', null,
      'longest_silence_ms', null
    );
  end if;

  -- 1) Ordenar y fusionar (mismo stream + hablante, hueco ≤ 1000 ms).
  for seg in
    select (e->>0)::int as s, (e->>1)::bigint as a, (e->>2)::bigint as b,
           coalesce((e->>3)::int, 0) as st
    from jsonb_array_elements(p_timeline) as e
    where jsonb_typeof(e) = 'array' and jsonb_array_length(e) >= 3
      and (e->>2)::bigint > (e->>1)::bigint
    order by (e->>1)::bigint
  loop
    if n > 0 and spk[n] = seg.s and strm[n] = seg.st
       and seg.a - fin[n] <= 1000 then
      fin[n] := greatest(fin[n], seg.b);
    else
      n := n + 1;
      spk[n] := seg.s; ini[n] := seg.a; fin[n] := seg.b; strm[n] := seg.st;
    end if;
    if seg.s <> 0 then hay_diar := true; end if;
  end loop;

  if n = 0 then
    return jsonb_build_object(
      'diarization', false, 'talk_ms_by_speaker', null,
      'interrogation_ms', null, 'silence_ms', null, 'longest_silence_ms', null);
  end if;

  -- 2) Habla por hablante. La clave lleva el stream porque las etiquetas no
  --    son estables entre reconexiones: "s0:1" y "s1:1" pueden ser personas
  --    distintas y sumarlas mentiría.
  for i in 1..n loop
    clave := 's' || strm[i] || ':' || spk[i];
    talk := jsonb_set(
      talk, array[clave],
      to_jsonb(coalesce((talk->>clave)::bigint, 0) + (fin[i] - ini[i])));
  end loop;

  select count(distinct spk[g.ix]) into hablantes
  from generate_series(1, n) as g(ix);

  -- 3) Interrogatorio: cadenas de ≥ 2 alternancias dentro del mismo stream.
  if hay_diar then
    for i in 2..n loop
      if spk[i] <> spk[i-1] and strm[i] = strm[i-1]
         and ini[i] - fin[i-1] <= 8000 then
        if bloque_ini is null then bloque_ini := ini[i-1]; end if;
        alternancias := alternancias + 1;
        bloque_fin := fin[i];
      else
        if alternancias >= 2 then interr := interr + (bloque_fin - bloque_ini); end if;
        alternancias := 0; bloque_ini := null; bloque_fin := null;
      end if;
    end loop;
    if alternancias >= 2 then interr := interr + (bloque_fin - bloque_ini); end if;
    if hablantes < 2 then interr := 0; end if; -- un solo hablante = dictado
  end if;

  -- 4) Silencio: unión de habla de cualquier hablante, huecos ≥ 5000 ms sobre
  --    [0, recording_ms] incluyendo los bordes. No requiere diarización.
  for i in 1..n loop
    if m > 0 and ini[i] <= u_fin[m] then
      u_fin[m] := greatest(u_fin[m], fin[i]);
    else
      m := m + 1; u_ini[m] := ini[i]; u_fin[m] := fin[i];
    end if;
  end loop;

  hueco := u_ini[1]; -- del arranque de la grabación al primer sonido
  if hueco >= 5000 then silencio := silencio + hueco; mayor := greatest(mayor, hueco); end if;
  for i in 2..m loop
    hueco := u_ini[i] - u_fin[i-1];
    if hueco >= 5000 then silencio := silencio + hueco; mayor := greatest(mayor, hueco); end if;
  end loop;
  if p_recording_ms is not null and p_recording_ms > u_fin[m] then
    hueco := p_recording_ms - u_fin[m];
    if hueco >= 5000 then silencio := silencio + hueco; mayor := greatest(mayor, hueco); end if;
  end if;

  return jsonb_build_object(
    'diarization', hay_diar,
    'talk_ms_by_speaker', talk,
    'interrogation_ms', case when hay_diar then interr else null end,
    'silence_ms', silencio,
    'longest_silence_ms', mayor
  );
end;
$$;

-- ============================================================================
-- Única puerta de escritura de encounter_metrics.
--
-- DEFINER a propósito: la tabla no tiene políticas de escritura, y este RPC
-- valida que quien llama sea el dueño del encounter y CLAMPA los deltas: no se
-- puede acumular más "uso" que tiempo de pared transcurrido desde el último
-- flush (+60 s de holgura por el primer flush y relojes), con techo absoluto
-- de 30 minutos por llamada. Deltas, nunca totales: un flush perdido se
-- reintenta y un flush duplicado como mucho duplica 30 s, no una consulta.
-- ============================================================================
create or replace function public.record_encounter_usage(
  p_encounter_id uuid,
  p_session_id   uuid,
  p_active_ms    integer default 0,
  p_recording_ms integer default 0,
  p_timeline     jsonb   default null,
  p_diarization  boolean default null,
  p_finalize     boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doctor   uuid;
  v_org      uuid;
  v_row      public.encounter_metrics%rowtype;
  v_active   bigint;
  v_rec      bigint;
  v_wall_ms  bigint;
  v_nuevos   int := 0;
  v_total    int;
  v_derivadas jsonb;
begin
  select doctor_id into v_doctor
  from public.clinical_encounters where id = p_encounter_id;
  if v_doctor is null or v_doctor <> (select auth.uid()) then
    raise exception 'No autorizado';
  end if;

  select organization_id into v_org
  from public.profiles where id = v_doctor;

  -- on conflict do nothing: dos primeras escrituras concurrentes (doble
  -- pestaña en el arranque) no deben tumbar ninguna de las dos.
  insert into public.encounter_metrics (encounter_id, doctor_id, organization_id,
    last_session_id, session_count)
  values (p_encounter_id, v_doctor, v_org, p_session_id, 1)
  on conflict (encounter_id) do nothing;

  select * into v_row from public.encounter_metrics
  where encounter_id = p_encounter_id
  for update;

  -- Tope de pared: ms transcurridos desde el último flush de esta fila.
  v_wall_ms := greatest(0,
    (extract(epoch from (now() - v_row.updated_at)) * 1000)::bigint);
  v_active := least(greatest(coalesce(p_active_ms, 0), 0), v_wall_ms + 60000, 1800000);
  -- Grabar implica usar: el delta de grabación jamás supera al de uso aceptado.
  v_rec    := least(greatest(coalesce(p_recording_ms, 0), 0), v_active);

  if p_timeline is not null and jsonb_typeof(p_timeline) = 'array' then
    v_nuevos := jsonb_array_length(p_timeline);
  end if;
  v_total := coalesce(jsonb_array_length(v_row.speaker_timeline), 0);

  update public.encounter_metrics em set
    active_ms     = em.active_ms + v_active,
    recording_ms  = em.recording_ms + v_rec,
    flush_count   = em.flush_count + 1,
    session_count = em.session_count
      + case when p_session_id is distinct from em.last_session_id then 1 else 0 end,
    last_session_id = coalesce(p_session_id, em.last_session_id),
    last_used_at  = now(),
    updated_at    = now(),
    diarization   = em.diarization or coalesce(p_diarization, false),
    -- Tope de 20 000 segmentos: más allá se descarta y se marca truncado en
    -- vez de crecer sin límite (una consulta de 90 min ronda los 2 000).
    speaker_timeline = case
      when v_nuevos = 0 then em.speaker_timeline
      when v_total + v_nuevos <= 20000
        then coalesce(em.speaker_timeline, '[]'::jsonb) || p_timeline
      else em.speaker_timeline end,
    speaker_timeline_truncated = em.speaker_timeline_truncated
      or (v_nuevos > 0 and v_total + v_nuevos > 20000)
  where em.encounter_id = p_encounter_id
  returning * into v_row;

  if p_finalize then
    v_derivadas := private.compute_conversation_metrics(
      v_row.speaker_timeline, v_row.recording_ms);
    update public.encounter_metrics em set
      finished_at        = coalesce(em.finished_at, now()),
      talk_ms_by_speaker = v_derivadas->'talk_ms_by_speaker',
      interrogation_ms   = (v_derivadas->>'interrogation_ms')::int,
      silence_ms         = (v_derivadas->>'silence_ms')::int,
      longest_silence_ms = (v_derivadas->>'longest_silence_ms')::int,
      algo_version       = 1
    where em.encounter_id = p_encounter_id;
  end if;

  return jsonb_build_object(
    'accepted_active_ms', v_active,
    'accepted_recording_ms', v_rec
  );
end;
$$;

revoke all on function public.record_encounter_usage(uuid, uuid, integer, integer, jsonb, boolean, boolean) from public, anon;
grant execute on function public.record_encounter_usage(uuid, uuid, integer, integer, jsonb, boolean, boolean) to authenticated;

-- ============================================================================
-- RPC de agregados para la consola: /superadmin/metricas.
--
-- SECURITY DEFINER, a diferencia de superadmin_ai_usage: además de
-- encounter_metrics necesita clinical_encounters (embudo de estados y
-- cobertura "consultas sin telemetría"), cuya RLS solo deja leer al médico
-- dueño. Con invoker el superadmin vería el embudo vacío. La barrera es
-- is_superadmin(), igual que superadmin_dashboard.
--
-- HONESTIDAD. El bloque `cobertura` existe porque las métricas están
-- incompletas por construcción: las consultas anteriores a la telemetría no
-- tienen fila, y los tokens solo se atribuyen desde que Graph manda
-- session_id = encounter_id. Un panel que promedie sin decir sobre qué
-- porción calcula se equivoca por defecto.
-- ============================================================================
create or replace function public.superadmin_encounter_metrics(
  p_from date default null,
  p_to   date default null,
  p_hour_from int default null,
  p_hour_to   int default null,
  p_org  uuid default null,
  p_user uuid default null,
  p_incluir_prueba boolean default false,
  p_page int default 1,
  p_page_size int default 25
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
  v_ini  timestamptz;
  v_fin  timestamptz;
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_size int := least(greatest(coalesce(p_page_size, 25), 1), 100);
begin
  if not (select private.is_superadmin()) then
    raise exception 'No autorizado';
  end if;

  v_to   := least(coalesce(p_to, hoy), hoy);
  v_from := coalesce(p_from, v_to - 29);
  if v_from > v_to then v_from := v_to; end if;
  if (v_to - v_from) > 365 then v_from := v_to - 365; end if;
  v_dias := (v_to - v_from) + 1;
  v_ini  := (v_from::timestamp at time zone 'America/Bogota');
  v_fin  := ((v_to + 1)::timestamp at time zone 'America/Bogota');

  with
  -- Universo: filas de telemetría dentro de la ventana + filtros. La franja
  -- horaria es [from, to) sobre la hora Bogotá de first_used_at, con soporte
  -- de vuelta de medianoche (22 → 6 = h>=22 OR h<6).
  base as (
    select em.*,
      extract(hour from (em.first_used_at at time zone 'America/Bogota'))::int as hora,
      p.email, p.full_name, p.is_demo,
      o.name as org_name
    from public.encounter_metrics em
    left join public.profiles p on p.id = em.doctor_id
    left join public.organizations o on o.id = em.organization_id
    where em.first_used_at >= v_ini and em.first_used_at < v_fin
      and (p_org  is null or em.organization_id = p_org)
      and (p_user is null or em.doctor_id = p_user)
      and (p_incluir_prueba
           or not (coalesce(p.is_demo, false) or coalesce(p.email, '') like '%@miracle.app'))
  ),
  filtrada as (
    select * from base
    where p_hour_from is null or p_hour_to is null
       or (p_hour_from <= p_hour_to and hora >= p_hour_from and hora < p_hour_to)
       or (p_hour_from >  p_hour_to and (hora >= p_hour_from or hora < p_hour_to))
  ),
  -- Tokens por consulta: TODOS los eventos con ese session_id, sin recortar
  -- por fecha (pertenecen a la consulta aunque el ajuste llegara al día
  -- siguiente). El costo va con su conteo sin_tarifa, como en toda la consola.
  tokens as (
    -- El join va por TEXTO: castear session_id a uuid reventaría con los
    -- session_id ajenos (windows_app) que no son ids de encounter.
    select u.session_id as sid,
      sum(u.input_tokens)  as inp,
      sum(u.output_tokens) as outp,
      sum(u.total_tokens)  as tot,
      sum(u.cost_usd)      as costo,
      count(*) filter (where u.cost_usd is null) as sin_tarifa,
      sum(u.audio_seconds) as audio_s,
      count(*)             as eventos
    from public.ai_usage_events u
    where u.session_id <> ''
      and u.session_id in (select encounter_id::text from filtrada)
    group by 1
  ),
  enriquecida as (
    select f.*,
      coalesce(t.tot, 0)  as tokens_total,
      coalesce(t.inp, 0)  as tokens_in,
      coalesce(t.outp, 0) as tokens_out,
      t.costo, coalesce(t.sin_tarifa, 0) as sin_tarifa,
      -- Denominador de tokens/min: grabación medida; si no, audio del ledger;
      -- si no, NULL (nunca 0: cero es "habló y no gastó", NULL es "no medido").
      case
        when f.recording_ms > 0 then f.recording_ms
        when coalesce(t.audio_s, 0) > 0 then (t.audio_s * 1000)::bigint
        else null end as denom_ms
    from filtrada f
    left join tokens t on t.sid = f.encounter_id::text
  ),
  tot as (
    select
      count(*) as consultas,
      count(*) filter (where finished_at is not null) as completadas,
      coalesce(sum(active_ms), 0) as active_total,
      coalesce(avg(active_ms) filter (where active_ms > 0), 0)::bigint as active_prom,
      coalesce(percentile_cont(0.5) within group (order by active_ms)
        filter (where active_ms > 0), 0)::bigint as active_p50,
      coalesce(sum(recording_ms), 0) as rec_total,
      coalesce(avg(recording_ms) filter (where recording_ms > 0), 0)::bigint as rec_prom,
      coalesce(sum(tokens_total), 0) as tokens,
      count(*) filter (where tokens_total > 0) as con_tokens,
      -- Razón de sumas, no promedio de razones: una consulta de 30 s no puede
      -- dominar la media. Solo sobre consultas con denominador medido.
      coalesce(sum(tokens_total) filter (where denom_ms is not null), 0) as tokens_num,
      coalesce(sum(denom_ms), 0) as denom_total,
      count(*) filter (where denom_ms is null and tokens_total > 0) as sin_denominador,
      coalesce(avg(interrogation_ms) filter (where interrogation_ms is not null), 0)::bigint as interr_prom,
      count(*) filter (where interrogation_ms is not null) as con_interr,
      coalesce(avg(silence_ms) filter (where silence_ms is not null), 0)::bigint as sil_prom,
      count(*) filter (where silence_ms is not null) as con_sil,
      -- Los % se promedian por consulta (cada consulta pesa igual).
      coalesce(avg(interrogation_ms::numeric / nullif(recording_ms, 0))
        filter (where interrogation_ms is not null and recording_ms > 0), 0) as interr_pct,
      coalesce(avg(silence_ms::numeric / nullif(recording_ms, 0))
        filter (where silence_ms is not null and recording_ms > 0), 0) as sil_pct
    from enriquecida
  )
  select jsonb_build_object(
    'generated_at', now(),
    'rango', jsonb_build_object('desde', v_from, 'hasta', v_to, 'dias', v_dias),

    'kpis', (select jsonb_build_object(
      'consultas', consultas,
      'completadas', completadas,
      'active_ms_total', active_total,
      'active_ms_prom', active_prom,
      'active_ms_p50', active_p50,
      'recording_ms_total', rec_total,
      'recording_ms_prom', rec_prom,
      'tokens_total', tokens,
      'tokens_por_minuto', case when denom_total = 0 then null
        else round(tokens_num * 60000.0 / denom_total) end,
      'interrogation_ms_prom', case when con_interr = 0 then null else interr_prom end,
      'interrogation_pct_prom', case when con_interr = 0 then null
        else round(interr_pct * 100) end,
      'silence_ms_prom', case when con_sil = 0 then null else sil_prom end,
      'silence_pct_prom', case when con_sil = 0 then null
        else round(sil_pct * 100) end
    ) from tot),

    -- Qué porción del universo está de verdad medida.
    'cobertura', (select jsonb_build_object(
      'consultas_medidas', consultas,
      'encounters_periodo', (
        select count(*) from public.clinical_encounters ce
        where ce.created_at >= v_ini and ce.created_at < v_fin),
      'con_tokens', con_tokens,
      'sin_denominador', sin_denominador,
      'con_interrogatorio', con_interr,
      'con_silencios', con_sil,
      'tokens_no_atribuibles', (
        select coalesce(sum(u.total_tokens), 0) from public.ai_usage_events u
        where u.occurred_at >= v_ini and u.occurred_at < v_fin
          and (u.session_id = '' or u.session_id not in
               (select encounter_id::text from public.encounter_metrics)))
    ) from tot),

    'serie_diaria', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', to_char(d.dia, 'YYYY-MM-DD'),
        'consultas', coalesce(a.n, 0),
        'active_ms_prom', coalesce(a.act_prom, 0),
        'recording_ms_prom', coalesce(a.rec_prom, 0),
        'tokens', coalesce(a.toks, 0),
        'tokens_por_minuto', a.tpm
      ) order by d.dia)
      from generate_series(v_from::timestamp, v_to::timestamp, interval '1 day') d(dia)
      left join (
        select (first_used_at at time zone 'America/Bogota')::date as dia,
          count(*) as n,
          coalesce(avg(active_ms) filter (where active_ms > 0), 0)::bigint as act_prom,
          coalesce(avg(recording_ms) filter (where recording_ms > 0), 0)::bigint as rec_prom,
          sum(tokens_total) as toks,
          case when sum(denom_ms) is null or sum(denom_ms) = 0 then null
            else round(sum(tokens_total) filter (where denom_ms is not null)
                       * 60000.0 / sum(denom_ms)) end as tpm
        from enriquecida group by 1
      ) a on a.dia = d.dia::date
    ), '[]'::jsonb),

    'por_hora', coalesce((
      select jsonb_agg(jsonb_build_object('hora', h.h, 'consultas', coalesce(a.n, 0))
        order by h.h)
      from generate_series(0, 23) h(h)
      left join (select hora, count(*) n from enriquecida group by 1) a on a.hora = h.h
    ), '[]'::jsonb),

    'por_usuario', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', doctor_id, 'nombre', nombre, 'organizacion', org,
        'consultas', n, 'active_ms_prom', act_prom, 'recording_ms_prom', rec_prom,
        'tokens', toks, 'tokens_por_minuto', tpm) order by n desc)
      from (
        select doctor_id,
          coalesce(nullif(btrim(max(full_name)), ''), max(email), 'Sin nombre') as nombre,
          max(org_name) as org,
          count(*) as n,
          coalesce(avg(active_ms) filter (where active_ms > 0), 0)::bigint as act_prom,
          coalesce(avg(recording_ms) filter (where recording_ms > 0), 0)::bigint as rec_prom,
          sum(tokens_total) as toks,
          case when sum(denom_ms) is null or sum(denom_ms) = 0 then null
            else round(sum(tokens_total) filter (where denom_ms is not null)
                       * 60000.0 / sum(denom_ms)) end as tpm
        from enriquecida group by 1
        order by count(*) desc limit 15
      ) u
    ), '[]'::jsonb),

    'por_organizacion', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', organization_id, 'nombre', nombre,
        'consultas', n, 'active_ms_prom', act_prom,
        'tokens', toks, 'tokens_por_minuto', tpm) order by n desc)
      from (
        select organization_id, coalesce(max(org_name), 'Sin organización') as nombre,
          count(*) as n,
          coalesce(avg(active_ms) filter (where active_ms > 0), 0)::bigint as act_prom,
          sum(tokens_total) as toks,
          case when sum(denom_ms) is null or sum(denom_ms) = 0 then null
            else round(sum(tokens_total) filter (where denom_ms is not null)
                       * 60000.0 / sum(denom_ms)) end as tpm
        from enriquecida group by 1
      ) g
    ), '[]'::jsonb),

    -- Por modelo/proveedor: SOLO eventos atribuidos a consultas del filtro.
    'por_modelo', coalesce((
      select jsonb_agg(jsonb_build_object(
        'provider', provider, 'model', model, 'feature', feature,
        'eventos', n, 'tokens', toks, 'costo_usd', round(coalesce(costo, 0), 4),
        'sin_tarifa', sin_tarifa) order by toks desc)
      from (
        select u.provider, coalesce(u.served_model, u.requested_model) as model,
          u.feature, count(*) as n, sum(u.total_tokens) as toks,
          sum(u.cost_usd) as costo,
          count(*) filter (where u.cost_usd is null) as sin_tarifa
        from public.ai_usage_events u
        where u.session_id <> ''
          and u.session_id in (select encounter_id::text from filtrada)
        group by 1, 2, 3
        order by sum(u.total_tokens) desc limit 12
      ) mo
    ), '[]'::jsonb),

    'consultas', (select jsonb_build_object(
      'total', (select count(*) from enriquecida),
      'page', v_page,
      'page_size', v_size,
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
          'encounter_id', encounter_id,
          'fecha', fecha,
          'finalizada', finished_at is not null,
          'medico', coalesce(nullif(btrim(full_name), ''), email, 'Sin nombre'),
          'organizacion', org_name,
          'active_ms', active_ms,
          'recording_ms', recording_ms,
          'interrogation_ms', interrogation_ms,
          'silence_ms', silence_ms,
          'tokens', tokens_total,
          'tokens_por_minuto', case when denom_ms is null or denom_ms = 0 then null
            else round(tokens_total * 60000.0 / denom_ms) end
        ) order by fecha desc)
        from (
          select encounter_id, first_used_at as fecha, finished_at, full_name, email,
            org_name, active_ms, recording_ms, interrogation_ms, silence_ms,
            tokens_total, denom_ms
          from enriquecida
          order by first_used_at desc
          limit v_size offset (v_page - 1) * v_size
        ) pg
      ), '[]'::jsonb)
    ))
  ) into result;

  return result;
end;
$$;

revoke all on function public.superadmin_encounter_metrics(date, date, int, int, uuid, uuid, boolean, int, int) from public, anon;
grant execute on function public.superadmin_encounter_metrics(date, date, int, int, uuid, uuid, boolean, int, int) to authenticated;

-- ============================================================================
-- Detalle de UNA consulta: telemetría + campos técnicos del encounter (nunca
-- contenido clínico) + rollup del ledger por operación/modelo/proveedor.
-- DEFINER por la misma razón que arriba (clinical_encounters); barrera
-- is_superadmin().
-- ============================================================================
create or replace function public.superadmin_encounter_detail(p_encounter_id uuid)
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

  select jsonb_build_object(
    'generated_at', now(),

    'encounter', (
      select jsonb_build_object(
        'id', ce.id,
        'status', ce.status,
        'consultation_type', ce.consultation_type,
        'template_id', ce.template_id,
        'template_name', ce.template_snapshot->>'name',
        'created_at', ce.created_at,
        'updated_at', ce.updated_at,
        'note_generated_at', ce.note_generated_at,
        'generation_attempts', ce.generation_attempts,
        'transcript_chars', length(coalesce(ce.transcript, '')),
        'doctor', (
          select jsonb_build_object(
            'id', p.id,
            'nombre', coalesce(nullif(btrim(p.full_name), ''), p.email),
            'organizacion', o.name)
          from public.profiles p
          left join public.organizations o on o.id = p.organization_id
          where p.id = ce.doctor_id)
      )
      from public.clinical_encounters ce where ce.id = p_encounter_id
    ),

    'metrics', (
      select to_jsonb(em) - 'speaker_timeline'
        || jsonb_build_object(
             'timeline_segments', coalesce(jsonb_array_length(em.speaker_timeline), 0))
      from public.encounter_metrics em where em.encounter_id = p_encounter_id
    ),

    'ai_usage', (
      select jsonb_build_object(
        'totales', (
          select jsonb_build_object(
            'eventos', count(*),
            'input_tokens', coalesce(sum(input_tokens), 0),
            'output_tokens', coalesce(sum(output_tokens), 0),
            'total_tokens', coalesce(sum(total_tokens), 0),
            'audio_seconds', coalesce(sum(audio_seconds), 0),
            'costo_usd', round(coalesce(sum(cost_usd), 0), 4),
            'sin_tarifa', count(*) filter (where cost_usd is null))
          from public.ai_usage_events
          where session_id = p_encounter_id::text),
        'operaciones', coalesce((
          select jsonb_agg(jsonb_build_object(
            'feature', feature, 'provider', provider, 'model', model,
            'eventos', n, 'input_tokens', inp, 'output_tokens', outp,
            'total_tokens', tot, 'audio_seconds', audio_s,
            'costo_usd', round(coalesce(costo, 0), 4), 'sin_tarifa', sin_tarifa,
            'errores', errores, 'latencia_p95', p95) order by tot desc)
          from (
            select feature, provider,
              coalesce(served_model, requested_model) as model,
              count(*) as n, sum(input_tokens) as inp, sum(output_tokens) as outp,
              sum(total_tokens) as tot, sum(audio_seconds) as audio_s,
              sum(cost_usd) as costo,
              count(*) filter (where cost_usd is null) as sin_tarifa,
              count(*) filter (where status <> 'ok') as errores,
              round(percentile_cont(0.95) within group (order by latency_ms))::int as p95
            from public.ai_usage_events
            where session_id = p_encounter_id::text
            group by 1, 2, 3
          ) op
        ), '[]'::jsonb)
      )
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.superadmin_encounter_detail(uuid) from public, anon;
grant execute on function public.superadmin_encounter_detail(uuid) to authenticated;
