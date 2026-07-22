-- Plantilla de histopatología estilo "formulario HGM" como predeterminada de bacteriología.
--
-- Por qué: el bacteriólogo pidió una plantilla con la estructura de su sistema actual (HGM):
-- rótulo + identificación del paciente + macroscópico/microscópico/diagnóstico, todo como
-- casillas del propio informe (no como datos aparte). Encaja con el flujo de foto: la hoja de
-- trabajo trae justo esos campos, así que la IA los rellena en una sola pasada.
--
-- Se marca is_default=true y se apagan los demás defaults de bacteriología para que quede
-- como la principal (el workspace la preselecciona y la muestra de primera). Idempotente:
-- id fijo + ON CONFLICT DO UPDATE (re-ejecutar actualiza el contenido).

-- Solo puede haber una predeterminada por especialidad: apaga las demás de bacteriología.
update public.clinical_templates
set is_default = false
where specialty_code = 'bacteriologia' and is_default = true;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  (
    'b1000000-0000-4000-8000-000000000010', null,
    'Histopatología · Macro / Micro / Diagnóstico',
    'Formato de informe histopatológico: rótulo, datos del paciente, macroscópico, microscópico y diagnóstico.',
    'bacteriologia', 'Bacteriología', 'institutional', true, 'active',
    '[
      {"key":"rotulo","label":"Rótulo","order":1,"required":false,"instruction":"Transcribe el rótulo o número de caso tal como aparece en la hoja. Formato: año de 2 dígitos, un guion y el número de caso, sin espacios ni puntos (ejemplo: 26-3456). Si no aparece, déjalo vacío."},
      {"key":"nombre_paciente","label":"Nombre del paciente","order":2,"required":false,"instruction":"Copia el nombre del paciente tal como aparece en la hoja. No lo inventes; si no está, déjalo vacío."},
      {"key":"episodio","label":"Episodio","order":3,"required":false,"instruction":"Transcribe el número de episodio, orden o ingreso tal como aparece, pero escríbelo como un número normal: solo dígitos consecutivos, sin puntos, comas, espacios ni dos puntos (:). NUNCA lo escribas ni lo interpretes como una hora o fecha (ejemplo correcto: 3258162; incorrecto: 3:25:81 o 32:58:16)."},
      {"key":"cedula","label":"Cédula","order":4,"required":false,"instruction":"Transcribe el número de documento o cédula del paciente si aparece."},
      {"key":"fecha_de_lectura","label":"Fecha de lectura","order":5,"required":false,"instruction":"Transcribe la fecha de lectura del caso tal como aparece en la hoja (día/mes/año). No la reinterpretes ni la conviertas a otro formato."},
      {"key":"procedimiento","label":"Procedimiento","order":6,"required":false,"instruction":"Transcribe el procedimiento o tipo de muestra (biopsia, resección, etc.)."},
      {"key":"descripcion_macroscopica","label":"Descripción macroscópica","order":7,"required":true,"instruction":"Transcribe la descripción macroscópica: tamaño, peso, color, consistencia, cortes y lesiones descritas."},
      {"key":"descripcion_microscopica","label":"Descripción microscópica","order":8,"required":true,"instruction":"Transcribe los hallazgos microscópicos: arquitectura, tipo celular, atipia, invasión y estado de los márgenes."},
      {"key":"diagnostico","label":"Diagnóstico","order":9,"required":true,"instruction":"Transcribe el diagnóstico tal como está escrito. No lo reinterpretes ni lo resumas."}
    ]'::jsonb
  )
on conflict (id) do update
  set name = excluded.name,
      description = excluded.description,
      specialty_code = excluded.specialty_code,
      specialty_name = excluded.specialty_name,
      scope = excluded.scope,
      is_default = excluded.is_default,
      status = excluded.status,
      sections = excluded.sections,
      updated_at = now();
