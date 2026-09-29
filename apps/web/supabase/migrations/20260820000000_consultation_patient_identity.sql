-- Nombre y documento del paciente, promovidos de la nota a columnas.
--
-- POR QUÉ: asociar un paciente registrado es opcional al crear una consulta
-- ("El paciente es opcional" dice el formulario), así que `patient_id` viene
-- nulo en la enorme mayoría de las filas y las listas mostraban "Paciente sin
-- identificar" aunque el nombre estuviera escrito dentro de la propia nota.
--
-- POR QUÉ EN LA BASE Y NO EN EL CLIENTE: las filas de `consultations` las
-- publica el backend clínico, que vive fuera de este repo, así que un enganche
-- en TypeScript no vería todas las escrituras. Es el mismo motivo por el que
-- `rotulo` ya se sincroniza aquí (ver 20260723030000).
--
-- ESTAS COLUMNAS NO SON LA HISTORIA CLÍNICA. Son una copia para poder listar y
-- buscar sin abrir cada nota. La fuente de verdad sigue siendo `note`, y quien
-- manda sobre la identidad real del paciente sigue siendo `patient_id` cuando
-- el médico lo asocia a mano.

alter table public.consultations
  add column if not exists paciente_nombre text,
  add column if not exists paciente_documento text;

comment on column public.consultations.paciente_nombre is
  'Copia del nombre del paciente extraído de la nota. Ver private.sync_consultation_patient_identity().';
comment on column public.consultations.paciente_documento is
  'Copia del documento del paciente (solo dígitos) extraído de la nota.';

create or replace function private.sync_consultation_patient_identity()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_note jsonb := coalesce(new.note, '[]'::jsonb);
  v_nombre text;
  v_documento text;
  v_prosa text;
  v_correccion text;
begin
  -- 1) Campos estructurados: los trae la plantilla de patología y son un campo,
  --    no prosa. Lo que hay es el dato.
  select elem ->> 'texto' into v_nombre
  from jsonb_array_elements(v_note) elem
  where elem ->> 'id' = 'nombre_paciente'
     or elem ->> 'titulo' = 'Nombre del paciente'
  limit 1;

  select elem ->> 'texto' into v_documento
  from jsonb_array_elements(v_note) elem
  where elem ->> 'id' = 'cedula'
     or elem ->> 'titulo' = 'Cédula'
  limit 1;

  -- 2) Prosa dictada. "Identificación" es un nombre traicionero: en
  --    bacteriología es la del MICROORGANISMO y en laboratorio la
  --    VERIFICACIÓN del rótulo contra la orden. Ninguna habla del paciente.
  select elem ->> 'texto' into v_prosa
  from jsonb_array_elements(v_note) elem
  where (elem ->> 'id' ilike '%identificacion%' or elem ->> 'titulo' ilike '%Identificaci_n%')
    and coalesce(elem ->> 'id', '') !~* '(microorganismo|germen|verificaci)'
    and coalesce(elem ->> 'titulo', '') !~* '(microorganismo|germen|verificaci)'
  limit 1;

  -- El nombre se ancla a la etiqueta que lo anuncia y solo sigue con mayúsculas
  -- o partículas, para cortarse solo en la puntuación: en "Nombre: Andrés
  -- Montero. Edad: 22 años" no debe tragarse el "Edad". Las partículas van de
  -- la más larga a la más corta ("del" antes que "de") o "Nancy del Carmen"
  -- se quedaría en "Nancy de".
  if coalesce(trim(v_nombre), '') = '' and v_prosa is not null then
    v_nombre := substring(v_prosa from
      '(?:[Nn]ombre(?:\s+de(?:l)?\s+paciente)?|[Ii]dentificad[oa]\s+como|[Ss]e\s+llama|[Ll]lamarse|[Ll]lamad[oa])\s*[:.]?\s+([A-ZÁÉÍÓÚÑ][[:alpha:]]+(?:\s+(?:(?:del|de|las|los|la|y)\y|[A-ZÁÉÍÓÚÑ][[:alpha:]]+))*)');
  end if;

  v_nombre := trim(regexp_replace(regexp_replace(coalesce(v_nombre, ''), '[\s.,;:]+$', ''), '\s+', ' ', 'g'));

  -- Rellenos que ocupan el lugar del nombre sin serlo: sin esta lista,
  -- "Nombre: No referido" creaba un paciente llamado "No".
  if v_nombre = ''
     or length(v_nombre) > 80
     or v_nombre ~ '[0-9]'
     or lower(v_nombre) in (
          'no', 'no referido', 'no mencionado', 'no registra', 'sin', 'sin dato',
          'sin datos', 'ninguno', 'ninguna', 'anonimo', 'anónimo', 'desconocido',
          'paciente', 'el paciente', 'la paciente', 'nn', 'na')
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

drop trigger if exists consultations_sync_patient_identity on public.consultations;
create trigger consultations_sync_patient_identity
before insert or update of note on public.consultations
for each row execute function private.sync_consultation_patient_identity();

-- Relleno de lo ya guardado. `note = note` no cambia el valor, así que el
-- guardián de inmutabilidad de las notas firmadas lo deja pasar (compara
-- `is distinct from`), y de paso dispara este trigger.
update public.consultations set note = note where note is not null;

-- Buscar por paciente en la lista de consultas.
create index if not exists idx_consultations_paciente_nombre
  on public.consultations (paciente_nombre);
create index if not exists idx_consultations_paciente_documento
  on public.consultations (paciente_documento);
