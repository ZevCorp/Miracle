-- El número de documento, en una sola forma canónica.
--
-- QUÉ PASABA
-- Al dictar la cédula, el número llegaba partido: "23-45-67-75-43" en vez de
-- "2345677543". No lo parte el modelo ni la app: lo parte el PROVEEDOR DE
-- TRANSCRIPCIÓN. Deepgram (`smart_format`) y Soniox aplican normalización
-- inversa de texto y, ante una corrida larga de cifras dictadas de a pocas, la
-- escriben como si fuera un teléfono. El cliente de dictado solo concatena los
-- tokens del proveedor y el generador copia el texto tal cual, obedeciendo su
-- propia regla de fidelidad ("no reformatees rótulos tipo 26-3456").
--
-- Se comprobó sobre los datos: las 3 notas con guiones los traen IDÉNTICOS en
-- su transcripción, y otras 21 transcripciones los traen también. El interruptor
-- que los produce vive en el runtime de voz, fuera de este repo y del backend
-- clínico, así que la corrección se hace donde sí se controla: en el CAMPO, que
-- tiene un formato declarado y una forma canónica.
--
-- QUÉ SE HACE
--   1. La instrucción de la casilla pide el documento como una cifra corrida,
--      "aunque la transcripción lo traiga separado en grupos".
--   2. La extracción a columna deja de arrasar con todo lo que no sea dígito:
--      ahora distingue el documento NUMÉRICO (cédula, TI, RC, CE, NUIP → solo
--      cifras) del ALFANUMÉRICO (pasaporte, PPT → letras y cifras). Quitarle
--      las letras a un pasaporte convertía "AY123456" en "123456", que no es
--      el documento de nadie.
--
-- QUÉ NO SE TOCA
-- EL RÓTULO. El número de caso de patología ("26-2931": año y consecutivo) vive
-- en su propia sección, tiene su propia columna y su propio trigger
-- (`consultations_sync_rotulo`), y sus guiones SÍ significan algo. Nada de esto
-- lo mira siquiera: la canonización solo alcanza la línea etiquetada como
-- documento dentro de la casilla de identificación del paciente. Y las
-- plantillas de patología —las únicas que llevan rótulo— ni siquiera tienen esa
-- casilla, porque ya piden el nombre y la cédula como campos propios.
--
-- LA TRANSCRIPCIÓN TAMPOCO SE TOCA: es la evidencia de lo que se dijo.
--
-- ESPEJO EN TYPESCRIPT: `canonicalizeDocumento` en lib/clinical/patient-identity.ts,
-- que además entiende las cifras dictadas en palabras ("uno cero tres seis…").
-- Eso no se replica aquí a propósito: en el peor caso la columna queda vacía
-- —nunca equivocada— hasta que el médico guarda la nota, momento en el que el
-- texto ya viene canonizado desde la app y este trigger lo lee sin problema.

/* ------------------------------------------------------------------ */
/* 1. La instrucción pide la cifra corrida                             */
/* ------------------------------------------------------------------ */

create or replace function private.ensure_template_patient_identity_section()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  c_seccion constant jsonb := jsonb_build_object(
    'key', 'identificacion_del_paciente',
    'label', 'Identificación del paciente',
    'order', 1,
    'required', false,
    'instruction',
      'Identifica al PACIENTE, nunca al médico ni al acompañante. Escribe dos '
      || 'líneas: «Nombre: …» y «Documento: …». El documento va como una sola '
      || 'cifra corrida, sin puntos, espacios ni guiones, aunque la '
      || 'transcripción lo traiga separado en grupos. Si un dato no se dijo o no '
      || 'se entendió con certeza, escribe «No referido en la consulta.» en esa '
      || 'línea. Nunca lo deduzcas ni lo tomes de otra persona.'
  );
  c_max_secciones constant int := 30;
  v_sections jsonb := coalesce(new.sections, '[]'::jsonb);
  v_tiene_canonica boolean;
  v_tiene_campo_propio boolean;
  v_renumeradas jsonb;
begin
  if jsonb_typeof(v_sections) <> 'array' then
    return new;
  end if;
  if jsonb_array_length(v_sections) >= c_max_secciones then
    return new;
  end if;

  select
    bool_or(s.value ->> 'key' = 'identificacion_del_paciente'),
    bool_or(s.value ->> 'key' = 'nombre_paciente')
  into v_tiene_canonica, v_tiene_campo_propio
  from jsonb_array_elements(v_sections) s;

  if coalesce(v_tiene_canonica, false) or coalesce(v_tiene_campo_propio, false) then
    return new;
  end if;

  select jsonb_agg(jsonb_set(t.value, '{order}', to_jsonb(t.pos + 1)) order by t.pos)
  into v_renumeradas
  from (
    select
      e.value,
      row_number() over (
        order by
          case when e.value ->> 'order' ~ '^[0-9]+$'
               then (e.value ->> 'order')::int
               else e.idx::int
          end,
          e.idx
      ) as pos
    from jsonb_array_elements(v_sections) with ordinality as e(value, idx)
  ) t;

  new.sections := jsonb_build_array(c_seccion) || coalesce(v_renumeradas, '[]'::jsonb);
  return new;

exception when others then
  return new;
end;
$$;

-- Refresco de la instrucción en el catálogo ya sembrado. Solo donde sigue
-- siendo la que puso la migración anterior: si una institución la ajustó a su
-- manera, esa versión manda y no se pisa.
update public.clinical_templates t
set sections = (
  select jsonb_agg(
    case
      when s.value ->> 'key' = 'identificacion_del_paciente'
      then jsonb_set(
        s.value,
        '{instruction}',
        to_jsonb(
          'Identifica al PACIENTE, nunca al médico ni al acompañante. Escribe dos '
          || 'líneas: «Nombre: …» y «Documento: …». El documento va como una sola '
          || 'cifra corrida, sin puntos, espacios ni guiones, aunque la '
          || 'transcripción lo traiga separado en grupos. Si un dato no se dijo o no '
          || 'se entendió con certeza, escribe «No referido en la consulta.» en esa '
          || 'línea. Nunca lo deduzcas ni lo tomes de otra persona.'
        )
      )
      else s.value
    end
    order by s.ord
  )
  from jsonb_array_elements(t.sections) with ordinality as s(value, ord)
)
where exists (
  select 1 from jsonb_array_elements(t.sections) s
  where s.value ->> 'key' = 'identificacion_del_paciente'
    and s.value ->> 'instruction' =
      'Identifica al PACIENTE, nunca al médico ni al acompañante: usa solo el '
      || 'nombre y el documento que el paciente da de sí mismo o que el médico '
      || 'dice del paciente. Escribe exactamente dos líneas: «Nombre: …» y '
      || '«Documento: …». Si un dato no se dijo o no se entendió con certeza, '
      || 'escribe «No referido en la consulta.» en esa línea. Nunca lo deduzcas '
      || 'ni lo tomes de otra persona.'
);

/* ------------------------------------------------------------------ */
/* 2. La columna distingue documento numérico de alfanumérico          */
/* ------------------------------------------------------------------ */

create or replace function private.sync_consultation_patient_identity()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_note jsonb := coalesce(new.note, '[]'::jsonb);
  v_nombre text;
  v_documento text;
  v_canonica text;
  v_prosa text;
  v_linea text;
  v_sin_tipo text;
  v_token text;
  v_correccion text;
begin
  select elem ->> 'texto' into v_canonica
  from jsonb_array_elements(v_note) elem
  where elem ->> 'id' = 'identificacion_del_paciente'
     or elem ->> 'key' = 'identificacion_del_paciente'
  limit 1;

  if coalesce(trim(v_canonica), '') <> '' then
    v_nombre := substring(v_canonica from '(?in)^[ \t]*nombre\y[^:\n]*:[ \t]*(.+)$');
    v_linea := substring(v_canonica from
      '(?in)^[ \t]*(?:documento|c[ée]dula|identificaci[óo]n|cc|ti|nuip)\y[^:\n]*:[ \t]*(.+)$');

    if v_linea is not null then
      -- La sigla del tipo va aparte para que sus letras no se confundan con las
      -- de un pasaporte: en "PA AY123456" el documento es "AY123456", no "PA".
      v_sin_tipo := regexp_replace(v_linea,
        '^\s*(CC|TI|RC|CE|PA|PP|PPT|PEP|NUIP|NIT|MS|AS|CN|SC)[\s.:-]+', '', 'i');

      -- Token alfanumérico: letras y cifras pegadas, con separadores INTERNOS
      -- pero sin espacios. Es el pasaporte o el PPT.
      v_token := upper(regexp_replace(
        coalesce((regexp_match(v_sin_tipo, '^\s*([0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)'))[1], ''),
        '[.-]', '', 'g'));

      if v_token ~ '[A-Z]' and v_token ~ '[0-9]' then
        if length(v_token) between 5 and 20 then
          v_documento := v_token;
        end if;
      else
        -- Numérico: la corrida de cifras SÍ admite separadores, porque así es
        -- como llega del dictado ("1 036 457 892", "23-45-67-75-43").
        select regexp_replace(m[1], '[^0-9]', '', 'g') into v_documento
        from regexp_matches(v_sin_tipo, '([0-9][0-9 .-]*)', 'g') m
        where length(regexp_replace(m[1], '[^0-9]', '', 'g')) between 5 and 12
        limit 1;
      end if;
    end if;
  end if;

  if coalesce(trim(v_nombre), '') = '' then
    select elem ->> 'texto' into v_nombre
    from jsonb_array_elements(v_note) elem
    where elem ->> 'id' = 'nombre_paciente'
       or elem ->> 'titulo' = 'Nombre del paciente'
    limit 1;
  end if;

  if coalesce(trim(v_documento), '') = '' then
    select elem ->> 'texto' into v_documento
    from jsonb_array_elements(v_note) elem
    where elem ->> 'id' = 'cedula'
       or elem ->> 'titulo' = 'Cédula'
    limit 1;
  end if;

  select elem ->> 'texto' into v_prosa
  from jsonb_array_elements(v_note) elem
  where (elem ->> 'id' ilike '%identificacion%' or elem ->> 'titulo' ilike '%Identificaci_n%')
    and coalesce(elem ->> 'id', '') <> 'identificacion_del_paciente'
    and coalesce(elem ->> 'id', '') !~* '(microorganismo|germen|verificaci)'
    and coalesce(elem ->> 'titulo', '') !~* '(microorganismo|germen|verificaci)'
  limit 1;

  if coalesce(trim(v_prosa), '') = '' then
    v_prosa := v_canonica;
  end if;

  if coalesce(trim(v_nombre), '') = '' and v_prosa is not null then
    v_nombre := substring(v_prosa from
      '(?:[Nn]ombre(?:\s+de(?:l)?\s+paciente)?|[Ii]dentificad[oa]\s+como|[Ss]e\s+llama|[Ll]lamarse|[Ll]lamad[oa])\s*[:.]?\s+([A-ZÁÉÍÓÚÑ][[:alpha:]]+(?:\s+(?:(?:del|de|las|los|la|y)\y|[A-ZÁÉÍÓÚÑ][[:alpha:]]+))*)');
  end if;

  v_nombre := split_part(coalesce(v_nombre, ''), '(', 1);
  v_nombre := split_part(v_nombre, ';', 1);
  if v_nombre ~ '[0-9]' then
    v_nombre := split_part(v_nombre, ',', 1);
  end if;
  v_nombre := trim(regexp_replace(regexp_replace(v_nombre, '[\s.,;:]+$', ''), '\s+', ' ', 'g'));

  if v_nombre = ''
     or length(v_nombre) > 80
     or v_nombre ~ '[0-9]'
     or v_nombre ~* '^(no|sin|ningun[oa]?|pendientes?|desconocid[oa]|an[óo]nim[oa]|paciente|nn|na|n/a|por (establecer|definir|confirmar))\y'
  then
    v_nombre := null;
  end if;

  if coalesce(trim(v_documento), '') = '' and v_prosa is not null then
    v_correccion := substring(v_prosa from
      '(?i)(?:repito|corrijo|perd[óo]n|mejor dicho|es decir)\s*[:,]?\s*([0-9][0-9 .-]{4,20})');
    if v_correccion is not null then
      v_documento := v_correccion;
    else
      select (array_agg(m[1]))[count(*)] into v_documento
      from regexp_matches(v_prosa,
        '(?:c[ée]dula|documento|identificaci[óo]n)\s*(?:n[úu]mero\s*)?[:\s]*([0-9][0-9 .-]{4,20})',
        'gi') m;
    end if;
  end if;

  -- Ya canónico (pasaporte) se deja como está; el resto se queda en cifras.
  if v_documento is null or v_documento !~ '^[A-Z0-9]+$' or v_documento !~ '[A-Z]' then
    v_documento := regexp_replace(coalesce(v_documento, ''), '[^0-9]', '', 'g');
    if length(v_documento) < 5 or length(v_documento) > 12 then
      v_documento := null;
    end if;
  end if;

  new.paciente_nombre := v_nombre;
  new.paciente_documento := v_documento;
  return new;

exception when others then
  new.paciente_nombre := null;
  new.paciente_documento := null;
  return new;
end;
$$;

-- Reproceso con las reglas nuevas. `note = note` no cambia el valor, así que el
-- guardián de inmutabilidad de las notas firmadas lo deja pasar.
update public.consultations set note = note where note is not null;
