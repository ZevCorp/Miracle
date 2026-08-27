-- ============================================================================
-- Segunda capa de métricas: medir si el producto sirve, no solo cuánto se usa.
--
-- LO QUE FALTABA. `encounter_metrics` mide tiempo, audio y tokens. Con eso se
-- responde "cuánto se usa Miracle", pero no "¿la nota que escribe sirve?" —
-- que es lo único que dice si el producto mejora entre versiones.
--
-- Y LA RESPUESTA YA ESTABA GUARDADA. `clinical_encounters` conserva DOS notas:
-- `note_json_ai` (lo que produjo la IA, congelado) y `note_json` (lo que el
-- médico firmó). Comparar sección a sección da, sin instrumentar nada nuevo y
-- hacia atrás, cuánto trabajo le queda al médico DESPUÉS de la IA. Al escribir
-- esto: 480 consultas medibles, 9,1 secciones por nota, el médico corrige 4,25
-- de ellas (47 %) y solo el 10 % de las notas salen sin tocar.
--
-- PHI: la comparación ocurre DENTRO de Postgres y sale como números — conteos,
-- porcentajes y longitudes. Las claves y etiquetas de sección sí viajan, pero
-- son metadatos de la plantilla ("Motivo de consulta"), no contenido clínico.
-- Ni un carácter de la nota cruza esta frontera.
--
-- POR QUÉ DOS FUNCIONES Y NO UNA. `superadmin_encounter_metrics` parte de las
-- filas de telemetría; la calidad de la nota parte de `clinical_encounters` y
-- tiene que funcionar sobre las 480 consultas que NO tienen fila de telemetría
-- porque son anteriores. Meterla en la primera la habría dejado midiendo solo
-- el futuro, que es justo lo contrario de lo que la hace útil hoy.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Columnas nuevas
-- ---------------------------------------------------------------------------

alter table public.encounter_metrics
  -- "Comparar versiones del producto" era una petición explícita y no se podía
  -- responder: sin esto, un cambio que mejore la nota es indistinguible del
  -- ruido entre semanas.
  add column if not exists app_version text,
  -- Micrófono del computador u Omi. 'mixto' cuando una misma consulta usó las
  -- dos: es un dato real, no un empate que haya que romper a favor de una.
  add column if not exists audio_source text,
  -- Reparto del tiempo ACTIVO por fase: {"captura":…, "generacion":…,
  -- "revision":…, "otro":…}. La suma es `active_ms` por construcción (cada
  -- flush aporta su delta a UNA fase), así que las dos cifras nunca se
  -- contradicen. Es lo que permite preguntar cuánto trabajo queda DESPUÉS de
  -- que la IA escribió, que es la métrica de eficiencia que debería bajar.
  add column if not exists active_ms_by_phase jsonb not null default '{}'::jsonb;

comment on column public.encounter_metrics.active_ms_by_phase is
  'Tiempo activo por fase. La suma equivale a active_ms; cada flush aporta a una sola fase.';

-- ---------------------------------------------------------------------------
-- 2) Captura: la misma función, con tres datos más
--
-- Se DROPEA y recrea en vez de `create or replace` porque cambia la firma:
-- añadir parámetros con default crearía una segunda sobrecarga y PostgREST
-- elegiría cualquiera de las dos.
-- ---------------------------------------------------------------------------

drop function if exists public.record_encounter_usage(uuid, uuid, integer, integer, jsonb, boolean, boolean);

create or replace function public.record_encounter_usage(
  p_encounter_id uuid,
  p_session_id   uuid,
  p_active_ms    integer default 0,
  p_recording_ms integer default 0,
  p_timeline     jsonb   default null,
  p_diarization  boolean default null,
  p_finalize     boolean default false,
  p_phase        text    default null,
  p_app_version  text    default null,
  p_audio_source text    default null
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
  v_phase    text;
  v_version  text;
  v_source   text;
begin
  select doctor_id into v_doctor
  from public.clinical_encounters where id = p_encounter_id;
  if v_doctor is null or v_doctor <> (select auth.uid()) then
    raise exception 'No autorizado';
  end if;

  select organization_id into v_org
  from public.profiles where id = v_doctor;

  -- Lista cerrada. Una fase desconocida NO se descarta: va a 'otro', para que
  -- la suma de las fases siga siendo `active_ms` y un fallo de cableado se vea
  -- como una porción rara en la pantalla en vez de desaparecer.
  v_phase := case
    when p_phase in ('captura', 'generacion', 'revision') then p_phase
    else 'otro' end;
  -- Etiquetas del cliente: se acotan y se saca cualquier cosa que no sea
  -- versión/fuente. Nunca se confía en su largo.
  v_version := nullif(btrim(coalesce(p_app_version, '')), '');
  v_version := left(v_version, 32);
  v_source  := case
    when p_audio_source in ('browser_microphone', 'omi') then p_audio_source
    else null end;

  insert into public.encounter_metrics as em (
    encounter_id, doctor_id, organization_id, last_session_id,
    app_version, audio_source
  )
  values (p_encounter_id, v_doctor, v_org, p_session_id, v_version, v_source)
  on conflict (encounter_id) do nothing;

  select * into v_row from public.encounter_metrics where encounter_id = p_encounter_id;

  -- Techo de realidad: nadie puede acumular más tiempo del que ha pasado desde
  -- que la consulta se abrió. Es lo que impide que un cliente manipulado (o un
  -- bug de reloj) infle su propio uso.
  v_wall_ms := greatest(
    0,
    (extract(epoch from (now() - v_row.first_used_at)) * 1000)::bigint
  ) + 120000;
  v_active := least(greatest(coalesce(p_active_ms, 0), 0), v_wall_ms);
  v_rec    := least(greatest(coalesce(p_recording_ms, 0), 0), v_wall_ms);

  if p_timeline is not null and jsonb_typeof(p_timeline) = 'array' then
    v_nuevos := jsonb_array_length(p_timeline);
  end if;
  v_total := coalesce(jsonb_array_length(v_row.speaker_timeline), 0);

  update public.encounter_metrics em set
    last_used_at  = now(),
    last_session_id = coalesce(p_session_id, em.last_session_id),
    active_ms     = em.active_ms + v_active,
    recording_ms  = em.recording_ms + v_rec,
    flush_count   = em.flush_count + 1,
    session_count = em.session_count
      + case when p_session_id is distinct from em.last_session_id then 1 else 0 end,
    updated_at    = now(),
    diarization   = em.diarization or coalesce(p_diarization, false),
    -- La versión que MANDA es la última: si el médico recargó a mitad de
    -- consulta, la que la terminó es la que vale para comparar versiones.
    app_version   = coalesce(v_version, em.app_version),
    -- La fuente es la de la consulta, no la del último tramo. Dos fuentes
    -- distintas en la misma consulta son 'mixto', no un empate arbitrario.
    audio_source  = case
      when v_source is null then em.audio_source
      when em.audio_source is null then v_source
      when em.audio_source = v_source then em.audio_source
      else 'mixto' end,
    active_ms_by_phase = coalesce(em.active_ms_by_phase, '{}'::jsonb)
      || jsonb_build_object(
           v_phase,
           coalesce((em.active_ms_by_phase->>v_phase)::bigint, 0) + v_active),
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
    'accepted_recording_ms', v_rec,
    'phase', v_phase
  );
end;
$$;

revoke all on function public.record_encounter_usage(uuid, uuid, integer, integer, jsonb, boolean, boolean, text, text, text) from public, anon;
grant execute on function public.record_encounter_usage(uuid, uuid, integer, integer, jsonb, boolean, boolean, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Calidad de la nota + embudo + tiempo hasta la nota
--
-- Parte de `clinical_encounters`, NO de la telemetría: así mide también las
-- consultas anteriores a que existiera `encounter_metrics`, que son la mayoría
-- de las que hay hoy.
--
-- QUÉ CUENTA COMO "CORREGIDA". Una sección cuyo texto final difiere del que
-- generó la IA, comparando exacto. No se intenta medir "cuánto" cambió con
-- similitud difusa: no hay pg_trgm en esta base, y un porcentaje de parecido
-- derivado de longitudes sería precisión falsa. Se dicen dos cosas que sí son
-- ciertas — cuántas secciones tocó y cuántos caracteres netos añadió — y se
-- dejan hablar juntas.
-- ---------------------------------------------------------------------------

create or replace function public.superadmin_note_quality(
  p_from date default null,
  p_to   date default null,
  p_org  uuid default null,
  p_user uuid default null,
  p_incluir_prueba boolean default false
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
  v_ini  timestamptz;
  v_fin  timestamptz;
begin
  if not (select private.is_superadmin()) then
    raise exception 'No autorizado';
  end if;

  v_to   := least(coalesce(p_to, hoy), hoy);
  v_from := coalesce(p_from, v_to - 29);
  if v_from > v_to then v_from := v_to; end if;
  if (v_to - v_from) > 365 then v_from := v_to - 365; end if;
  v_ini  := (v_from::timestamp at time zone 'America/Bogota');
  v_fin  := ((v_to + 1)::timestamp at time zone 'America/Bogota');

  with
  -- Universo: encuentros de la ventana, con el filtro de cuentas de prueba
  -- que usa el resto de la consola.
  enc as (
    select ce.*,
      coalesce(nullif(ce.template_snapshot->>'specialty', ''), 'sin_plantilla') as especialidad,
      -- El nombre vivo del catálogo manda sobre el del snapshot: si a una
      -- plantilla la renombraron, sus consultas viejas y nuevas tienen que
      -- salir en la MISMA fila o el reparto se parte en dos.
      coalesce(nullif(btrim(t.name), ''), nullif(ce.template_snapshot->>'name', ''),
               'Sin plantilla') as plantilla,
      coalesce(t.scope, 'desconocido') as alcance,
      coalesce(nullif(btrim(p.full_name), ''), p.email, 'Sin nombre') as medico,
      p.organization_id as org_id
    from public.clinical_encounters ce
    left join public.clinical_templates t on t.id = ce.template_id
    left join public.profiles p on p.id = ce.doctor_id
    where ce.created_at >= v_ini and ce.created_at < v_fin
      and (p_org  is null or p.organization_id = p_org)
      and (p_user is null or ce.doctor_id = p_user)
      and (p_incluir_prueba
           or not (coalesce(p.is_demo, false) or coalesce(p.email, '') like '%@miracle.app'))
  ),
  -- Solo las que tienen AMBAS notas. Las demás no son "0 % corregido": son
  -- "no medible", y se cuentan aparte en `cobertura`.
  comparables as (
    select * from enc
    where note_json_ai is not null and note_json is not null
      and jsonb_typeof(note_json_ai->'sections') = 'array'
      and jsonb_typeof(note_json->'sections') = 'array'
  ),
  -- Una fila por sección: lo que escribió la IA contra lo que quedó firmado.
  -- El emparejamiento va por `key`, que es lo que congela el snapshot de
  -- plantilla; el orden no se usa porque el médico puede reordenar.
  secciones as (
    select c.id, c.doctor_id, c.especialidad, c.medico, c.plantilla, c.created_at,
      coalesce(nullif(ia.value->>'label', ''), ia.value->>'key') as etiqueta,
      coalesce(ia.value->>'content', '') as texto_ia,
      coalesce((
        select f.value->>'content'
        from jsonb_array_elements(c.note_json->'sections') f
        where f.value->>'key' = ia.value->>'key'
        limit 1), '') as texto_final
    from comparables c,
      lateral jsonb_array_elements(c.note_json_ai->'sections') as ia(value)
  ),
  marcadas as (
    select s.*,
      (s.texto_ia is distinct from s.texto_final) as editada,
      -- La IA se quedó corta y el médico tuvo que escribirlo él.
      (s.texto_ia = '' and s.texto_final <> '')   as rellenada,
      -- La IA escribió algo que el médico borró entero.
      (s.texto_ia <> '' and s.texto_final = '')   as vaciada,
      (length(s.texto_final) - length(s.texto_ia)) as delta
    from secciones s
  ),
  por_consulta as (
    select id, doctor_id, medico, especialidad, plantilla, created_at,
      count(*) as secciones,
      count(*) filter (where editada)   as editadas,
      count(*) filter (where rellenada) as rellenadas,
      count(*) filter (where vaciada)   as vaciadas,
      sum(delta) as delta_chars
    from marcadas
    group by 1, 2, 3, 4, 5, 6
  ),
  -- Tiempo hasta la nota: lo que el médico pasa esperando frente a la
  -- pantalla. Se excluyen las no positivas (relojes cruzados) para no
  -- ensuciar los percentiles.
  espera as (
    select extract(epoch from (note_generated_at - created_at)) as s
    from enc
    where note_generated_at is not null and note_generated_at > created_at
  ),
  tot as (
    select
      (select count(*) from enc) as encuentros,
      (select count(*) from comparables) as medibles,
      (select count(*) from por_consulta) as consultas,
      (select coalesce(avg(secciones), 0) from por_consulta) as sec_prom,
      (select coalesce(avg(editadas), 0) from por_consulta) as edit_prom,
      (select coalesce(avg(editadas::numeric / nullif(secciones, 0)), 0) from por_consulta) as pct_edit,
      (select count(*) filter (where editadas = 0) from por_consulta) as sin_tocar,
      (select coalesce(avg(delta_chars), 0) from por_consulta) as delta_prom,
      (select coalesce(sum(rellenadas), 0) from por_consulta) as rellenadas,
      (select coalesce(sum(vaciadas), 0) from por_consulta) as vaciadas
  )
  select jsonb_build_object(
    'generated_at', now(),
    'rango', jsonb_build_object('desde', v_from, 'hasta', v_to),

    -- Qué porción del universo se puede medir. Una consulta sin `note_json_ai`
    -- (las anteriores a que Graph congelara la versión de la IA) NO es una
    -- consulta perfecta: es una que no se puede juzgar.
    'cobertura', (select jsonb_build_object(
      'encuentros', encuentros,
      'medibles', medibles,
      'pct_medible', case when encuentros = 0 then 0
        else round(100.0 * medibles / encuentros) end
    ) from tot),

    'kpis', (select jsonb_build_object(
      'consultas', consultas,
      'secciones_prom', round(sec_prom, 1),
      'editadas_prom', round(edit_prom, 2),
      'pct_secciones_editadas', round(pct_edit * 100, 1),
      'sin_tocar', sin_tocar,
      'pct_sin_tocar', case when consultas = 0 then 0
        else round(100.0 * sin_tocar / consultas) end,
      'delta_chars_prom', round(delta_prom),
      'secciones_rellenadas', rellenadas,
      'secciones_vaciadas', vaciadas
    ) from tot),

    -- Cuánto espera el médico. El promedio se muestra JUNTO a la mediana a
    -- propósito: con un outlier de 9 h el promedio dobla a la mediana, y ver
    -- las dos cifras al lado es lo que delata que la media no sirve sola.
    'espera_nota', (
      select jsonb_build_object(
        'consultas', count(*),
        'p50_s', round(percentile_cont(0.5) within group (order by s))::int,
        'p90_s', round(percentile_cont(0.9) within group (order by s))::int,
        'prom_s', round(avg(s))::int,
        'max_s', round(max(s))::int
      ) from espera),

    -- Embudo: dónde se cae una consulta. `abandonadas` son las que se abrieron
    -- y nunca llegaron a nota; `fallidas`, las que lo intentaron y no pudieron.
    'embudo', (
      select jsonb_build_object(
        'creadas', count(*),
        'con_transcripcion', count(*) filter (where coalesce(transcript, '') <> ''),
        'con_nota', count(*) filter (where note_json is not null),
        'completadas', count(*) filter (where status = 'completed'),
        'fallidas', count(*) filter (where status = 'failed'),
        'abandonadas', count(*) filter (where status in ('created', 'transcript_ready')),
        'con_reintento', count(*) filter (where coalesce(generation_attempts, 0) > 1)
      ) from enc),

    -- Dónde falla el prompt. Es la lista que se mira para decidir qué sección
    -- de qué plantilla hay que reescribir. Mínimo 5 apariciones: con menos, un
    -- 100 % de corrección es una anécdota, no una señal.
    'por_seccion', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seccion', etiqueta, 'especialidad', especialidad,
        'total', n, 'editadas', edit,
        'pct', case when n = 0 then 0 else round(100.0 * edit / n) end,
        'rellenadas', rell, 'delta_chars_prom', round(delta_prom)
      ) order by edit::numeric / nullif(n, 0) desc nulls last, n desc)
      from (
        select etiqueta, especialidad, count(*) as n,
          count(*) filter (where editada) as edit,
          count(*) filter (where rellenada) as rell,
          avg(delta) as delta_prom
        from marcadas
        group by 1, 2
        having count(*) >= 5
        order by count(*) filter (where editada)::numeric / nullif(count(*), 0) desc nulls last
        limit 15
      ) x), '[]'::jsonb),

    -- USO Y CALIDAD EN LA MISMA FILA, que es lo que las hace accionables.
    -- Una plantilla muy usada cuya nota se reescribe siempre es un prompt que
    -- hay que arreglar; una poco usada que sale limpia no urge. Separadas en
    -- dos tablas, esa lectura hay que hacerla a ojo cruzando pantallas.
    --
    -- `usos` sale de TODAS las consultas y `pct_corregida` solo de las
    -- comparables: por eso van con su propio `comparables` al lado, para que
    -- no parezca que el porcentaje se calculó sobre los 437 usos cuando se
    -- calculó sobre menos.
    'por_plantilla', coalesce((
      select jsonb_agg(jsonb_build_object(
        'plantilla', u.plantilla,
        'especialidad', u.especialidad,
        'alcance', u.alcance,
        'usos', u.usos,
        'medicos', u.medicos,
        'comparables', coalesce(q.n, 0),
        'secciones', q.secciones,
        'pct_corregida', q.pct,
        'sin_tocar', coalesce(q.sin_tocar, 0)
      ) order by u.usos desc)
      from (
        select plantilla, especialidad, alcance,
          count(*) as usos, count(distinct doctor_id) as medicos
        from enc group by 1, 2, 3
        order by count(*) desc limit 20
      ) u
      left join (
        select plantilla, count(*) as n,
          round(avg(secciones), 1) as secciones,
          round(avg(editadas::numeric / nullif(secciones, 0)) * 100, 1) as pct,
          count(*) filter (where editadas = 0) as sin_tocar
        from por_consulta group by 1
      ) q on q.plantilla = u.plantilla), '[]'::jsonb),

    -- Salud del catálogo. Una plantilla que nadie usa no es neutra: alarga la
    -- lista que el médico recorre antes de cada consulta. Al escribir esto,
    -- 208 en el catálogo y 3 con algún uso.
    'catalogo', (
      select jsonb_build_object(
        'activas', count(*) filter (where coalesce(status, 'active') <> 'archived'),
        'archivadas', count(*) filter (where status = 'archived'),
        'institucionales', count(*) filter (where scope = 'institutional'),
        'personales', count(*) filter (where scope = 'personal'),
        'usadas_alguna_vez', (
          select count(distinct ce.template_id)
          from public.clinical_encounters ce where ce.template_id is not null),
        'usadas_en_periodo', (
          select count(distinct template_id) from enc where template_id is not null)
      ) from public.clinical_templates),

    'por_especialidad', coalesce((
      select jsonb_agg(jsonb_build_object(
        'especialidad', especialidad, 'consultas', n,
        'pct_editadas', round(pct * 100, 1),
        'sin_tocar', sin_tocar,
        'delta_chars_prom', round(delta_prom)
      ) order by n desc)
      from (
        select especialidad, count(*) as n,
          avg(editadas::numeric / nullif(secciones, 0)) as pct,
          count(*) filter (where editadas = 0) as sin_tocar,
          avg(delta_chars) as delta_prom
        from por_consulta group by 1
      ) e), '[]'::jsonb),

    'por_medico', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', doctor_id, 'nombre', medico, 'consultas', n,
        'pct_editadas', round(pct * 100, 1),
        'delta_chars_prom', round(delta_prom)
      ) order by n desc)
      from (
        select doctor_id, medico, count(*) as n,
          avg(editadas::numeric / nullif(secciones, 0)) as pct,
          avg(delta_chars) as delta_prom
        from por_consulta group by 1, 2
        order by count(*) desc limit 10
      ) m), '[]'::jsonb),

    -- Evolución: es la curva que debería bajar si los prompts mejoran.
    'serie_diaria', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', to_char(d.dia, 'YYYY-MM-DD'),
        'consultas', coalesce(a.n, 0),
        'pct_editadas', case when a.n is null then null
          else round(a.pct * 100, 1) end
      ) order by d.dia)
      from generate_series(v_from::timestamp, v_to::timestamp, interval '1 day') as d(dia)
      left join (
        select (created_at at time zone 'America/Bogota')::date as dia,
          count(*) as n,
          avg(editadas::numeric / nullif(secciones, 0)) as pct
        from por_consulta group by 1
      ) a on a.dia = d.dia::date), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.superadmin_note_quality(date, date, uuid, uuid, boolean) from public, anon;
grant execute on function public.superadmin_note_quality(date, date, uuid, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Métricas agregadas: percentiles, dinero, fases, versión y fuente
--
-- Se reescribe entera (mismo nombre y firma) porque las cifras nuevas nacen
-- dentro de sus CTE. No se toca la migración anterior: ya corrió en la base y
-- editarla dejaría el archivo mintiendo sobre lo que hay aplicado.
--
-- LO QUE CAMBIA DE FONDO: hasta aquí la pantalla mostraba promedios. Un
-- promedio con una consulta abandonada de nueve horas dentro no describe a
-- nadie — el tiempo hasta la nota promedia 200 s cuando la mediana real es 95.
-- Por eso cada duración sale ahora con su p50 y su p90 al lado.
-- ---------------------------------------------------------------------------

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
      -- El p90 no es un adorno: con un solo outlier el promedio se va al doble
      -- de la mediana, y sin la cola no se sabe si la media miente o no.
      coalesce(percentile_cont(0.9) within group (order by active_ms)
        filter (where active_ms > 0), 0)::bigint as active_p90,
      coalesce(sum(recording_ms), 0) as rec_total,
      coalesce(avg(recording_ms) filter (where recording_ms > 0), 0)::bigint as rec_prom,
      coalesce(percentile_cont(0.5) within group (order by recording_ms)
        filter (where recording_ms > 0), 0)::bigint as rec_p50,
      coalesce(percentile_cont(0.9) within group (order by recording_ms)
        filter (where recording_ms > 0), 0)::bigint as rec_p90,
      -- Dinero. Va con el conteo de consultas que llevan alguna llamada sin
      -- tarifar: mientras eso sea > 0, el total es un SUELO y hay que decirlo.
      coalesce(sum(costo), 0) as costo_total,
      count(*) filter (where sin_tarifa > 0) as con_sin_tarifa,
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
      'active_ms_p90', active_p90,
      'recording_ms_total', rec_total,
      'recording_ms_prom', rec_prom,
      'recording_ms_p50', rec_p50,
      'recording_ms_p90', rec_p90,
      'costo_usd_total', round(costo_total, 4),
      'costo_usd_prom', case when consultas = 0 then null
        else round(costo_total / consultas, 4) end,
      'costo_usd_por_minuto', case when denom_total = 0 then null
        else round(costo_total * 60000.0 / denom_total, 4) end,
      'consultas_sin_tarifa', con_sin_tarifa,
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

    -- En qué se va el tiempo DENTRO de la consulta. Es la métrica de
    -- eficiencia que debería bajar entre versiones: si la IA mejora, la
    -- revisión se encoge aunque la captura siga durando lo mismo.
    'fases', coalesce((
      select jsonb_object_agg(k, v)
      from (
        select f.k, sum(f.v::bigint) as v
        from enriquecida e,
          lateral jsonb_each_text(coalesce(e.active_ms_by_phase, '{}'::jsonb)) as f(k, v)
        group by f.k
      ) x), '{}'::jsonb),

    -- Comparar versiones del producto. Una versión con menos revisión es una
    -- versión mejor, y esto es lo único que lo enseña.
    'por_version', coalesce((
      select jsonb_agg(jsonb_build_object(
        'version', coalesce(app_version, 'sin declarar'),
        'consultas', n, 'active_ms_prom', act_prom,
        'recording_ms_prom', rec_prom, 'revision_ms_prom', rev_prom)
        order by n desc)
      from (
        select app_version, count(*) as n,
          coalesce(avg(active_ms) filter (where active_ms > 0), 0)::bigint as act_prom,
          coalesce(avg(recording_ms) filter (where recording_ms > 0), 0)::bigint as rec_prom,
          coalesce(avg((active_ms_by_phase->>'revision')::bigint)
            filter (where active_ms_by_phase->>'revision' is not null), 0)::bigint as rev_prom
        from enriquecida group by 1
      ) v), '[]'::jsonb),

    'por_fuente', coalesce((
      select jsonb_agg(jsonb_build_object(
        'fuente', coalesce(audio_source, 'sin declarar'),
        'consultas', n, 'recording_ms_prom', rec_prom,
        'silence_pct', pct_sil) order by n desc)
      from (
        select audio_source, count(*) as n,
          coalesce(avg(recording_ms) filter (where recording_ms > 0), 0)::bigint as rec_prom,
          round(coalesce(avg(silence_ms::numeric / nullif(recording_ms, 0))
            filter (where silence_ms is not null and recording_ms > 0), 0) * 100) as pct_sil
        from enriquecida group by 1
      ) s), '[]'::jsonb),

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
            else round(tokens_total * 60000.0 / denom_ms) end,
          'costo_usd', case when costo is null then null else round(costo, 4) end,
          'sin_tarifa', sin_tarifa,
          'app_version', app_version,
          'audio_source', audio_source
        ) order by fecha desc)
        from (
          select encounter_id, first_used_at as fecha, finished_at, full_name, email,
            org_name, active_ms, recording_ms, interrogation_ms, silence_ms,
            tokens_total, denom_ms, costo, sin_tarifa, app_version, audio_source
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
