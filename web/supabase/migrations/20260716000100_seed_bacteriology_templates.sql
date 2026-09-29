-- Plantillas institucionales de bacteriología (informes de laboratorio).
--
-- Por qué: el catálogo tenía 49 especialidades pero ninguna de bacteriología. Estas
-- plantillas son las "casillas" que la IA rellena desde la foto de la hoja manuscrita y que
-- luego se descargan como informe de laboratorio (histopatología, microbiología y
-- laboratorio clínico general).
--
-- Se siembran como scope='institutional' + specialty_code='bacteriologia', igual que las
-- demás institucionales, para que las lea cualquier bacteriólogo (RLS institucional) tanto
-- en el flujo de foto como en el de audio. Idempotente: id fijo + ON CONFLICT DO NOTHING.
--
-- El campo `instruction` de cada sección guía a la IA de visión: transcribir lo escrito sin
-- inventar. La estructura de sección es {key,label,order,required,instruction}.

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  (
    'b1000000-0000-4000-8000-000000000001', null,
    'Informe de histopatología / biopsia',
    'Estudio anatomopatológico de muestras quirúrgicas o biopsias: macroscópico, microscópico y diagnóstico.',
    'bacteriologia', 'Bacteriología', 'institutional', false, 'active',
    '[
      {"key":"datos_muestra","label":"Datos de la muestra","order":1,"required":true,"instruction":"Transcribe tipo de espécimen, sitio anatómico, lateralidad, procedimiento de obtención y fecha si aparecen en la hoja."},
      {"key":"descripcion_macroscopica","label":"Descripción macroscópica","order":2,"required":false,"instruction":"Transcribe la descripción macroscópica: tamaño, peso, color, consistencia, cortes y lesiones descritas."},
      {"key":"descripcion_microscopica","label":"Descripción microscópica","order":3,"required":false,"instruction":"Transcribe los hallazgos microscópicos: arquitectura, tipo celular, atipia, invasión y estado de los márgenes."},
      {"key":"diagnostico_histopatologico","label":"Diagnóstico histopatológico","order":4,"required":true,"instruction":"Transcribe el diagnóstico anatomopatológico tal como está escrito. No lo reinterpretes."},
      {"key":"estudios_complementarios","label":"Estudios complementarios / IHQ","order":5,"required":false,"instruction":"Transcribe inmunohistoquímica, tinciones especiales u otros estudios y sus resultados si aparecen."},
      {"key":"comentarios","label":"Comentarios y correlación clínica","order":6,"required":false,"instruction":"Transcribe comentarios, notas o recomendaciones de correlación clínica."}
    ]'::jsonb
  ),
  (
    'b1000000-0000-4000-8000-000000000002', null,
    'Microbiología: directo, cultivo y antibiograma',
    'Examen directo, cultivo, identificación del microorganismo y antibiograma de la muestra.',
    'bacteriologia', 'Bacteriología', 'institutional', false, 'active',
    '[
      {"key":"datos_muestra","label":"Datos de la muestra","order":1,"required":true,"instruction":"Transcribe tipo de muestra, sitio, método y fecha/hora de recolección."},
      {"key":"examen_directo","label":"Examen directo","order":2,"required":false,"instruction":"Transcribe hallazgos del examen directo: Gram, KOH, tinciones, células, leucocitos y microorganismos observados."},
      {"key":"cultivo","label":"Cultivo","order":3,"required":false,"instruction":"Transcribe medios, condiciones y tiempo de incubación, y el crecimiento observado (colonias, recuento en UFC)."},
      {"key":"identificacion","label":"Identificación del microorganismo","order":4,"required":true,"instruction":"Transcribe el o los microorganismos identificados tal como aparecen."},
      {"key":"antibiograma","label":"Antibiograma","order":5,"required":false,"instruction":"Transcribe cada antimicrobiano con su resultado (sensible, intermedio o resistente) y la CMI si aparece. Conserva cada antimicrobiano en su propia línea."},
      {"key":"observaciones","label":"Observaciones e interpretación","order":6,"required":false,"instruction":"Transcribe observaciones, alertas de resistencia (BLEE, MRSA, etc.) u otras notas."}
    ]'::jsonb
  ),
  (
    'b1000000-0000-4000-8000-000000000003', null,
    'Baciloscopia seriada (BK)',
    'Búsqueda de bacilos ácido-alcohol resistentes en muestras seriadas.',
    'bacteriologia', 'Bacteriología', 'institutional', false, 'active',
    '[
      {"key":"datos_muestra","label":"Datos de la muestra","order":1,"required":true,"instruction":"Transcribe el tipo de muestra (esputo, etc.), el número de muestras seriadas y las fechas."},
      {"key":"resultado_por_muestra","label":"Resultado por muestra","order":2,"required":true,"instruction":"Transcribe el resultado de cada muestra con su escala de cruces (negativo, +, ++, +++) tal como está en la hoja. Una línea por muestra."},
      {"key":"interpretacion","label":"Interpretación","order":3,"required":false,"instruction":"Transcribe la interpretación o conclusión (positivo/negativo) y las observaciones."}
    ]'::jsonb
  ),
  (
    'b1000000-0000-4000-8000-000000000004', null,
    'Uroanálisis con sedimento',
    'Examen físico-químico y microscópico del sedimento urinario.',
    'bacteriologia', 'Bacteriología', 'institutional', false, 'active',
    '[
      {"key":"datos_muestra","label":"Datos de la muestra","order":1,"required":true,"instruction":"Transcribe el tipo de muestra de orina (parcial, primera micción, etc.) y la hora si aparece."},
      {"key":"examen_fisico_quimico","label":"Examen físico-químico","order":2,"required":false,"instruction":"Transcribe aspecto, color, densidad, pH y los resultados de la tira reactiva (glucosa, proteínas, cetonas, sangre, nitritos, leucocito-esterasa, etc.)."},
      {"key":"sedimento","label":"Sedimento urinario","order":3,"required":true,"instruction":"Transcribe el recuento del sedimento por campo: leucocitos, eritrocitos, células epiteliales, cilindros, cristales, bacterias, levaduras y moco."},
      {"key":"observaciones","label":"Observaciones","order":4,"required":false,"instruction":"Transcribe observaciones o notas del examinador."}
    ]'::jsonb
  ),
  (
    'b1000000-0000-4000-8000-000000000005', null,
    'Coprológico / parasitológico',
    'Examen macroscópico y microscópico de materia fecal.',
    'bacteriologia', 'Bacteriología', 'institutional', false, 'active',
    '[
      {"key":"datos_muestra","label":"Datos de la muestra","order":1,"required":true,"instruction":"Transcribe el tipo de muestra y el método (directo, concentración) si aparece."},
      {"key":"examen_macroscopico","label":"Examen macroscópico","order":2,"required":false,"instruction":"Transcribe consistencia, color y presencia de moco, sangre o restos."},
      {"key":"examen_microscopico","label":"Examen microscópico","order":3,"required":true,"instruction":"Transcribe los hallazgos: parásitos, quistes, trofozoítos, huevos, leucocitos, eritrocitos, flora y levaduras."},
      {"key":"observaciones","label":"Observaciones","order":4,"required":false,"instruction":"Transcribe observaciones o recomendaciones."}
    ]'::jsonb
  )
on conflict (id) do nothing;
