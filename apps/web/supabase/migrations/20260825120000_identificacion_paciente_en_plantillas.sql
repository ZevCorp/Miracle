-- La identificación del paciente pasa a ser parte del molde, no un rescate a
-- posteriori del texto de la nota.
--
-- QUÉ ESTABA PASANDO
-- El 2026-08-20 se promovieron `paciente_nombre` y `paciente_documento` a
-- columnas, extrayéndolas de la nota ya escrita. Eso arregló las listas para las
-- consultas que tenían el nombre EN ALGUNA PARTE de la nota, pero no la causa:
-- la renovación del catálogo (2026-08-11) dejó 195 de 204 plantillas activas SIN
-- ninguna sección donde escribir la identificación. Si la plantilla no tiene la
-- casilla, el generador no tiene dónde poner el nombre —llena exactamente las
-- secciones del snapshot y ni una más—, así que no había nada que extraer.
-- Se ve en los datos: "Histopatología" (que sí tiene `nombre_paciente` y
-- `cedula` como campos) iba 599 de 601 con nombre; la plantilla renovada de
-- medicina general, 0 de 18.
--
-- QUÉ SE HACE
--   1. Una sección canónica, `identificacion_del_paciente`, garantizada en toda
--      plantilla —presente, futura, institucional o personal— por un trigger.
--      La plantilla es el único contrato entre la app y el motor de notas: su
--      `instruction` es el canal por el que se le pide un dato al modelo.
--   2. La instrucción pide un formato fijo de dos líneas ("Nombre: …" /
--      "Documento: …"), distinguir al paciente del médico, y una frase prudente
--      explícita cuando el dato no se dijo.
--   3. La extracción a columnas pasa a leer ese campo primero. Los caminos
--      viejos (campos de patología, prosa dictada) se conservan intactos para
--      las notas ya guardadas.
--
-- QUÉ NO SE TOCA
-- Las notas ya escritas: `template_snapshot` se congela al crear el encounter,
-- así que cambiar la plantilla NO altera ninguna consulta existente ni el
-- versionado. Las plantillas de patología, que ya tienen el nombre como campo
-- propio, se dejan como están: pedir dos veces el mismo dato es peor que no
-- pedirlo.
--
-- ESPEJO EN TYPESCRIPT: lib/clinical/patient-identity.ts. Las filas de
-- `consultations` las escriben DOS procesos —el backend clínico
-- (ConsultationMirrorService, fuera de este repo) y la app— así que la
-- extracción vive en la base, el único punto por el que pasan ambos. Si cambias
-- las reglas de un lado, cambia el otro o divergen.

/* ------------------------------------------------------------------ */
/* 1. La sección canónica en toda plantilla                            */
/* ------------------------------------------------------------------ */

create or replace function private.ensure_template_patient_identity_section()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Deliberadamente NO se llama `identificacion` a secas: esa key ya está
  -- ocupada y significa otra cosa en dos especialidades (en bacteriología es la
  -- del MICROORGANISMO; en laboratorio, la VERIFICACIÓN del rótulo contra la
  -- orden). Un nombre propio evita desambiguar por contexto para siempre.
  c_seccion constant jsonb := jsonb_build_object(
    'key', 'identificacion_del_paciente',
    'label', 'Identificación del paciente',
    'order', 1,
    'required', false,
    'instruction',
      'Identifica al PACIENTE, nunca al médico ni al acompañante: usa solo el '
      || 'nombre y el documento que el paciente da de sí mismo o que el médico '
      || 'dice del paciente. Escribe exactamente dos líneas: «Nombre: …» y '
      || '«Documento: …». Si un dato no se dijo o no se entendió con certeza, '
      || 'escribe «No referido en la consulta.» en esa línea. Nunca lo deduzcas '
      || 'ni lo tomes de otra persona.'
  );
  -- Tope del backend (ClinicalTemplateService.MAX_SECTIONS). Pasarse dejaría la
  -- plantilla imposible de volver a guardar desde el editor.
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
    -- Patología ya pide el nombre como campo propio y lleva más de 600
    -- consultas funcionando así; añadirle otra casilla sería duplicar el dato.
    bool_or(s.value ->> 'key' = 'nombre_paciente')
  into v_tiene_canonica, v_tiene_campo_propio
  from jsonb_array_elements(v_sections) s;

  if coalesce(v_tiene_canonica, false) or coalesce(v_tiene_campo_propio, false) then
    return new;
  end if;

  -- La identificación abre la historia clínica: va de primera y el resto corre
  -- un puesto, conservando su orden relativo.
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
  -- Garantizar la casilla es una mejora; guardar la plantilla del médico es el
  -- trabajo. Ante cualquier sorpresa en el JSON se deja la plantilla tal cual,
  -- pero JAMÁS se impide guardarla.
  return new;
end;
$$;

drop trigger if exists clinical_templates_ensure_patient_identity on public.clinical_templates;
create trigger clinical_templates_ensure_patient_identity
  before insert or update of sections on public.clinical_templates
  for each row
  execute function private.ensure_template_patient_identity_section();

-- Catálogo existente. `sections = sections` no cambia el valor por sí mismo:
-- lo que hace es disparar el trigger de arriba, que decide si la añade.
update public.clinical_templates set sections = sections;

/* ------------------------------------------------------------------ */
/* 2. La extracción a columnas lee primero el campo canónico           */
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
  v_correccion text;
begin
  -- 1) SECCIÓN CANÓNICA. Es un campo con formato pedido ("Nombre: …" /
  --    "Documento: …"), no prosa: se leen las líneas etiquetadas.
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
      -- Corrida a corrida, no arrasando con los no-dígitos: en "1023456789,
      -- expedida en 2015" lo segundo no es parte del documento, y pegarlos
      -- daría un número de catorce cifras que no es de nadie.
      select regexp_replace(m[1], '[^0-9]', '', 'g') into v_documento
      from regexp_matches(v_linea, '([0-9][0-9 .-]*)', 'g') m
      where length(regexp_replace(m[1], '[^0-9]', '', 'g')) between 5 and 12
      limit 1;
    end if;
  end if;

  -- 2) CAMPOS ESTRUCTURADOS de patología: los trae la plantilla y son un campo,
  --    no prosa. Lo que hay es el dato.
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

  -- 3) PROSA DICTADA de las plantillas anteriores a la sección canónica.
  --    "Identificación" es un nombre traicionero: en bacteriología es la del
  --    MICROORGANISMO y en laboratorio la VERIFICACIÓN del rótulo contra la
  --    orden. Ninguna habla del paciente.
  select elem ->> 'texto' into v_prosa
  from jsonb_array_elements(v_note) elem
  where (elem ->> 'id' ilike '%identificacion%' or elem ->> 'titulo' ilike '%Identificaci_n%')
    and coalesce(elem ->> 'id', '') <> 'identificacion_del_paciente'
    and coalesce(elem ->> 'id', '') !~* '(microorganismo|germen|verificaci)'
    and coalesce(elem ->> 'titulo', '') !~* '(microorganismo|germen|verificaci)'
  limit 1;

  -- Si el modelo se salió del formato de dos líneas, el campo canónico igual es
  -- texto SOBRE EL PACIENTE: se le aplican los mismos patrones anclados. No es
  -- un permiso para adivinar —siguen exigiendo la etiqueta que anuncia el dato—,
  -- solo evita perderlo por una coma de más.
  if coalesce(trim(v_prosa), '') = '' then
    v_prosa := v_canonica;
  end if;

  -- El nombre se ancla a la etiqueta que lo anuncia y solo sigue con mayúsculas
  -- o partículas, para cortarse solo en la puntuación: en "Nombre: Andrés
  -- Montero. Edad: 22 años" no debe tragarse el "Edad". Las partículas van de
  -- la más larga a la más corta ("del" antes que "de") o "Nancy del Carmen"
  -- se quedaría en "Nancy de".
  if coalesce(trim(v_nombre), '') = '' and v_prosa is not null then
    v_nombre := substring(v_prosa from
      '(?:[Nn]ombre(?:\s+de(?:l)?\s+paciente)?|[Ii]dentificad[oa]\s+como|[Ss]e\s+llama|[Ll]lamarse|[Ll]lamad[oa])\s*[:.]?\s+([A-ZÁÉÍÓÚÑ][[:alpha:]]+(?:\s+(?:(?:del|de|las|los|la|y)\y|[A-ZÁÉÍÓÚÑ][[:alpha:]]+))*)');
  end if;

  -- Un campo etiquetado suele traer el nombre y, detrás, otro dato: "María
  -- Fernanda López (28 años)". Se corta por paréntesis o punto y coma siempre;
  -- por la coma SOLO si hay cifras, para no partir "López, María Fernanda".
  v_nombre := split_part(coalesce(v_nombre, ''), '(', 1);
  v_nombre := split_part(v_nombre, ';', 1);
  if v_nombre ~ '[0-9]' then
    v_nombre := split_part(v_nombre, ',', 1);
  end if;
  v_nombre := trim(regexp_replace(regexp_replace(v_nombre, '[\s.,;:]+$', ''), '\s+', ' ', 'g'));

  -- Rellenos que ocupan el lugar del nombre sin serlo. Se comparan como PREFIJO
  -- de palabra completa, no como frase exacta: la instrucción pide "No referido
  -- en la consulta." y una lista cerrada nunca acierta con todo lo que escribe
  -- un modelo. El límite de palabra (\y) evita el falso positivo obvio: "Nora",
  -- "Noelia" y "Nadia" son nombres de verdad.
  if v_nombre = ''
     or length(v_nombre) > 80
     or v_nombre ~ '[0-9]'
     or v_nombre ~* '^(no|sin|ningun[oa]?|pendientes?|desconocid[oa]|an[óo]nim[oa]|paciente|nn|na|n/a|por (establecer|definir|confirmar))\y'
  then
    v_nombre := null;
  end if;

  if coalesce(trim(v_documento), '') = '' and v_prosa is not null then
    -- Al dictar es normal rectificar ("...23-47-48. Repito: 47-48-53-92"):
    -- cuando hay marca de corrección, gana lo dicho después.
    v_correccion := substring(v_prosa from
      '(?i)(?:repito|corrijo|perd[óo]n|mejor dicho|es decir)\s*[:,]?\s*([0-9][0-9 .-]{4,20})');
    if v_correccion is not null then
      v_documento := v_correccion;
    else
      -- Sin corrección explícita vale la última cifra anclada a su etiqueta.
      select (array_agg(m[1]))[count(*)] into v_documento
      from regexp_matches(v_prosa,
        '(?:c[ée]dula|documento|identificaci[óo]n)\s*(?:n[úu]mero\s*)?[:\s]*([0-9][0-9 .-]{4,20})',
        'gi') m;
    end if;
  end if;

  -- Solo las cifras: al dictar se agrupan de mil maneras ("23-47-48",
  -- "1.089.934.418") y todas significan lo mismo. Entre 5 y 12 dígitos cubre
  -- cédula, tarjeta de identidad y NUIP; fuera de ahí no es un documento.
  v_documento := regexp_replace(coalesce(v_documento, ''), '[^0-9]', '', 'g');
  if length(v_documento) < 5 or length(v_documento) > 12 then
    v_documento := null;
  end if;

  new.paciente_nombre := v_nombre;
  new.paciente_documento := v_documento;
  return new;

exception when others then
  -- Extraer la identidad es una comodidad para las listas; guardar la nota es
  -- el trabajo del médico. Ante cualquier sorpresa en el texto se dejan las
  -- copias vacías, pero JAMÁS se impide grabar una nota clínica.
  new.paciente_nombre := null;
  new.paciente_documento := null;
  return new;
end;
$$;

-- Reproceso de lo ya guardado con las reglas nuevas. `note = note` no cambia el
-- valor, así que el guardián de inmutabilidad de las notas firmadas lo deja
-- pasar (compara `is distinct from`), y de paso dispara este trigger.
update public.consultations set note = note where note is not null;
