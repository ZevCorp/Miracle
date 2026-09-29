-- Renovación del catálogo de plantillas · área 3 (crítico): medicina de urgencias y anestesiología.
--
-- Por qué: las plantillas de fábrica de estas dos especialidades salían del generador genérico
-- del catálogo y no pedían lo que define su documentación: en urgencias, el triage, los tiempos,
-- los signos vitales seriados y la disposición; en anestesiología, la vía aérea, el ayuno, las
-- dosis intraoperatorias y la recuperación. Se reescriben las 3 de fábrica de cada especialidad
-- y se agrega una 4ª nueva por especialidad.
--
-- urgencias: "Consulta inicial · historia clínica de urgencias", "Control y seguimiento ·
--   reevaluación en urgencias y disposición", "Atención general de urgencias · triage, evaluación
--   y conducta" (la antigua "Atención inicial de urgencias", reescrita como atención no traumática
--   para no chocar con la nueva) y "Atención de trauma · revisión primaria y secundaria" — la 4ª
--   fijada por el encargo: el trauma es el escenario de mayor riesgo documental del servicio y
--   ninguna de las otras 3 lo cubría.
--
-- anestesiologia: "Consulta inicial · valoración preanestésica", "Control y seguimiento · dolor
--   agudo posoperatorio", "Acto anestésico · registro intraoperatorio" y "Control postanestésico ·
--   recuperación en URPA" — la 4ª elegida porque la nota de URPA (ingreso, evolución y egreso de
--   recuperación) es el documento posanestésico más frecuente y de mayor riesgo médico-legal, y
--   las otras 3 no la cubren.

update public.clinical_templates set
  name = 'Consulta inicial · historia clínica de urgencias',
  description = 'Historia clínica completa del primer contacto en urgencias para cuadros que requieren estudio: triage, cronología precisa del cuadro, antecedentes, examen por sistemas y plan diagnóstico inicial. Para episodios cortos resueltos en una sola nota use la atención general de urgencias; para el paciente traumatizado, la de revisión primaria y secundaria.',
  sections = '[
    {"key":"triage_y_llegada","label":"Triage y condición de llegada","order":1,"required":false,"instruction":"Registra la clasificación de triage y la hora de llegada solo si el médico las enunció, el medio de llegada (ambulancia, medios propios), quién acompaña y quién informa. Transcribe el nivel de triage literal; nunca lo asignes ni lo deduzcas tú. Si algún dato no se mencionó, indícalo."},
    {"key":"motivo_de_consulta","label":"Motivo de consulta","order":2,"required":true,"instruction":"Documenta el motivo de consulta en las palabras del paciente o de quien informa, sin traducirlo a un diagnóstico. Si el paciente no puede comunicarse, registra quién relata los hechos y por qué."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":3,"required":true,"instruction":"Cronología del cuadro con los tiempos tal como se dictaron (hora de inicio, evolución en horas o días), síntomas asociados, intensidad del dolor solo con la escala y el valor que el médico enunció, factores agravantes o atenuantes, manejos previos y su respuesta. Solo lo mencionado; no completes con la evolución típica del cuadro."},
    {"key":"antecedentes_relevantes","label":"Antecedentes relevantes","order":4,"required":false,"instruction":"Antecedentes patológicos, quirúrgicos, alérgicos y farmacológicos con nombres y dosis transcritos literal, consumo de alcohol o sustancias, episodios similares previos y hospitalizaciones. Si algún antecedente no se interrogó o el paciente no pudo responder, déjalo explícito; no lo completes."},
    {"key":"signos_vitales_al_ingreso","label":"Signos vitales al ingreso","order":5,"required":false,"instruction":"Transcribe los signos vitales tal como se dictaron: tensión arterial, frecuencia cardiaca, frecuencia respiratoria, temperatura, saturación de oxígeno y glucometría si se dijo. Nunca calcules, redondees ni estimes cifras; si un valor no se mencionó, regístralo como no tomado."},
    {"key":"examen_fisico_dirigido","label":"Examen físico dirigido","order":6,"required":true,"instruction":"Examen físico por sistemas según lo descrito: estado general y de conciencia, hallazgos cardiopulmonares, abdomen, neurológico, piel y extremidades. Incluye signos de alarma o de inestabilidad solo si el médico los describió. No completes sistemas no examinados; regístralos como no explorados."},
    {"key":"paraclinicos_e_imagenes","label":"Paraclínicos e imágenes","order":7,"required":false,"instruction":"Estudios solicitados y resultados disponibles transcritos literal (laboratorios, gases, electrocardiograma, imágenes) con la interpretación que el médico enunció. Nunca inventes valores ni conclusiones de estudios pendientes; lo que no ha llegado, regístralo como pendiente."},
    {"key":"analisis_e_impresion_diagnostica","label":"Análisis e impresión diagnóstica","order":8,"required":true,"instruction":"Razonamiento clínico y diagnósticos con la precisión con que el médico los formuló, incluidos los diferenciales que descartó o dejó abiertos y la justificación de observar o estudiar al paciente. No agregues diagnósticos ni severidades que no se enunciaron."},
    {"key":"plan_inicial_y_conducta","label":"Plan inicial y conducta","order":9,"required":true,"instruction":"Plan diagnóstico y terapéutico: medicamentos con dosis, vía y frecuencia transcritos literal (nunca los calcules ni los completes), líquidos, oxígeno, monitorización, interconsultas y remisiones, y lo explicado al paciente o a la familia. Incluye incapacidad o trámites con la EPS solo si se mencionaron."}
  ]'::jsonb,
  updated_at = now()
where id = '09f54dd3-eaf6-50c2-af9e-e8473f45cc3a' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · reevaluación en urgencias y disposición',
  description = 'Reevaluación del paciente que ya está en urgencias u observación: respuesta a las intervenciones, resultados nuevos, examen de control y decisión de disposición (alta, hospitalización, cirugía o remisión). Úsela para las notas de evolución dentro del mismo episodio de urgencias.',
  sections = '[
    {"key":"contexto_y_tiempo_en_urgencias","label":"Contexto y tiempo en urgencias","order":1,"required":false,"instruction":"Registra el diagnóstico de trabajo con el que viene el paciente, el tiempo transcurrido en urgencias u observación y las intervenciones ya realizadas, tal como el médico lo resumió. No reconstruyas el episodio previo con datos que no se dictaron."},
    {"key":"evolucion_de_sintomas","label":"Evolución de los síntomas","order":2,"required":true,"instruction":"Cambio de los síntomas desde la última valoración: mejoría, persistencia o empeoramiento en palabras del médico o del paciente. Intensidad del dolor solo con la escala y el valor que se enunciaron; nunca la asignes tú. Si un síntoma no se reevaluó, indícalo."},
    {"key":"respuesta_a_intervenciones","label":"Respuesta a las intervenciones","order":3,"required":false,"instruction":"Respuesta a lo administrado: analgesia, líquidos, oxígeno, antibióticos u otras medidas, con los medicamentos y dosis transcritos literal. Registra efectos adversos o falta de respuesta solo si se mencionaron; no supongas tolerancia."},
    {"key":"signos_vitales_de_control","label":"Signos vitales de control","order":4,"required":false,"instruction":"Signos vitales de control transcritos tal como se dictaron y su tendencia frente a los previos solo si el médico la comentó. Nunca calcules diferencias ni inventes valores; si no se tomaron nuevos signos, escríbelo."},
    {"key":"resultados_nuevos","label":"Resultados nuevos","order":5,"required":false,"instruction":"Paraclínicos, imágenes e interconsultas que llegaron desde la última nota, transcritos literal con la lectura que el médico hizo de ellos. Marca lo que sigue pendiente; nunca anticipes ni inventes resultados."},
    {"key":"examen_fisico_de_control","label":"Examen físico de control","order":6,"required":true,"instruction":"Examen físico dirigido de control con los hallazgos descritos y su comparación con la valoración previa solo si el médico la enunció. No repitas hallazgos anteriores como si fueran actuales ni completes sistemas no reexaminados."},
    {"key":"analisis_y_reevaluacion","label":"Análisis y reevaluación","order":7,"required":true,"instruction":"Análisis de la evolución: si el diagnóstico de trabajo se confirma, cambia o se descarta, con el razonamiento que el médico expresó. Deja explícito lo que aún falta por definir. No agregues conclusiones que no se dijeron."},
    {"key":"disposicion_y_plan","label":"Disposición y plan","order":8,"required":true,"instruction":"Disposición decidida tal como se enunció: alta con indicaciones y signos de alarma, observación, hospitalización, cirugía o remisión a otra institución con su justificación. Incluye medicamentos de salida con dosis transcritas literal, incapacidad y trámites con la EPS solo si se mencionaron."}
  ]'::jsonb,
  updated_at = now()
where id = '3789cbf5-771f-512c-a60c-725d6acc72aa' and owner_id is null;

update public.clinical_templates set
  name = 'Atención general de urgencias · triage, evaluación y conducta',
  description = 'Nota completa de un episodio de urgencias no traumático resuelto en una sola atención: triage, evaluación dirigida, intervenciones realizadas y disposición. Para cuadros que ameritan historia amplia y estudio prolongado use la consulta inicial; para el paciente traumatizado use la plantilla de revisión primaria y secundaria.',
  sections = '[
    {"key":"triage_y_motivo","label":"Triage y motivo de consulta","order":1,"required":true,"instruction":"Clasificación de triage transcrita literal solo si el médico la enunció (nunca la asignes tú), hora de llegada si se dijo y motivo de consulta en las palabras del paciente o del acompañante. Si el triage no se mencionó, indícalo."},
    {"key":"cuadro_clinico_actual","label":"Cuadro clínico actual","order":2,"required":true,"instruction":"Cronología breve del cuadro con los tiempos dictados (inicio, evolución), síntomas asociados, antecedentes y alergias relevantes que el médico mencionó y manejos previos. Solo lo dicho en la atención; no completes con un curso típico de la enfermedad."},
    {"key":"signos_vitales_y_examen","label":"Signos vitales y examen físico","order":3,"required":true,"instruction":"Signos vitales transcritos tal como se dictaron (nunca los estimes ni los completes) y examen físico dirigido con los hallazgos positivos y negativos que el médico describió. No completes sistemas no examinados; regístralos como no explorados."},
    {"key":"ayudas_diagnosticas","label":"Ayudas diagnósticas","order":4,"required":false,"instruction":"Paraclínicos, electrocardiograma o imágenes realizados en la atención, con resultados transcritos literal y la interpretación que el médico enunció. Si no se solicitaron estudios, indícalo; nunca inventes valores ni hallazgos."},
    {"key":"intervenciones_realizadas","label":"Intervenciones realizadas","order":5,"required":false,"instruction":"Medicamentos administrados en urgencias con dosis, vía y hora transcritas literal (nunca las calcules), líquidos, oxígeno u otras medidas, y la respuesta observada tal como se comentó. No supongas respuestas que no se dijeron."},
    {"key":"analisis_y_diagnostico","label":"Análisis y diagnóstico","order":6,"required":true,"instruction":"Impresión diagnóstica con la precisión con que el médico la formuló y el razonamiento de por qué el cuadro se maneja de forma ambulatoria o en observación. No agregues diagnósticos ni clasificaciones de severidad que no se enunciaron."},
    {"key":"conducta_y_disposicion","label":"Conducta y disposición","order":7,"required":true,"instruction":"Conducta final tal como se decidió: alta, observación, hospitalización o remisión, con su justificación. Fórmula de salida con dosis, frecuencia y duración transcritas literal; incapacidad y trámites con la EPS solo si se mencionaron."},
    {"key":"recomendaciones_y_signos_de_alarma","label":"Recomendaciones y signos de alarma","order":8,"required":false,"instruction":"Indicaciones de cuidado en casa y signos de alarma explicados al paciente para volver a urgencias, tal como el médico los enumeró. Registra cuándo y dónde debe hacerse el control ambulatorio solo si se indicó; no agregues advertencias que no se dieron."}
  ]'::jsonb,
  updated_at = now()
where id = '872fbc85-6a96-5ae0-8804-32efc99d1ad7' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c3000000-0000-4000-8000-000000000001', null,
  'Atención de trauma · revisión primaria y secundaria',
  'Atención del paciente traumatizado: mecanismo del trauma, revisión primaria ABCDE con las intervenciones realizadas, revisión secundaria por regiones, estudios y disposición final. Úsela en todo trauma que amerite evaluación sistemática; para urgencias no traumáticas use la atención general o la consulta inicial.',
  'urgencias', 'Medicina de urgencias', 'institutional', false, 'active',
  '[
    {"key":"mecanismo_del_trauma","label":"Mecanismo del trauma","order":1,"required":true,"instruction":"Mecanismo y cinemática del trauma tal como se relataron: tipo de evento (colisión, caída, herida por arma), altura, velocidad o elemento involucrado solo si se dijeron, hora del evento y quién relata los hechos (paciente, testigo, personal de ambulancia). No deduzcas la cinemática; registra solo lo narrado."},
    {"key":"atencion_prehospitalaria","label":"Atención prehospitalaria","order":2,"required":false,"instruction":"Atención previa a la llegada solo si se mencionó: maniobras, inmovilización, medicamentos o líquidos administrados por el equipo prehospitalario, transcritos literal. Si no hubo información prehospitalaria o no se comentó, indícalo."},
    {"key":"revision_primaria_abcde","label":"Revisión primaria ABCDE","order":3,"required":true,"instruction":"Revisión primaria ABCDE tal como el médico la enunció: vía aérea con control cervical, ventilación, circulación y control de hemorragias, déficit neurológico y exposición. Transcribe la escala de coma de Glasgow literal solo si se dictó; nunca la calcules ni asignes puntajes tú. Si un componente no se enunció, indícalo."},
    {"key":"intervenciones_y_respuesta","label":"Intervenciones realizadas y respuesta","order":4,"required":false,"instruction":"Intervenciones de la revisión primaria y la respuesta a cada una: manejo de vía aérea, oxígeno, accesos vasculares, líquidos o hemoderivados con volúmenes y dosis transcritos literal, inmovilizaciones u otras maniobras. Registra solo lo realizado y dictado; no supongas resultados."},
    {"key":"signos_vitales_seriados","label":"Signos vitales seriados","order":5,"required":false,"instruction":"Signos vitales al ingreso y sus controles transcritos tal como se dictaron, con la hora si se mencionó. Nunca calcules tendencias, índices ni cifras faltantes; si un registro no se enunció, escríbelo como no disponible."},
    {"key":"revision_secundaria_por_regiones","label":"Revisión secundaria por regiones","order":6,"required":false,"instruction":"Revisión secundaria de cabeza a pies por regiones según lo descrito: cabeza y cara, cuello, tórax, abdomen y pelvis, extremidades, dorso y examen neurológico. Registra hallazgos positivos y negativos solo si el médico los exploró y enunció; no completes regiones no examinadas."},
    {"key":"imagenes_y_paraclinicos","label":"Imágenes y paraclínicos","order":7,"required":false,"instruction":"Estudios realizados o solicitados (radiografías, FAST, tomografía, laboratorios) con resultados transcritos literal y la lectura que el médico enunció. Marca los pendientes como pendientes; nunca inventes hallazgos ni valores."},
    {"key":"analisis_y_diagnosticos","label":"Análisis y diagnósticos","order":8,"required":true,"instruction":"Diagnósticos traumáticos con la precisión con que se formularon y el análisis de la gravedad o estabilidad del paciente en palabras del médico, incluidas las lesiones sospechadas en estudio. No agregues clasificaciones ni severidades que no se enunciaron."},
    {"key":"disposicion","label":"Disposición","order":9,"required":true,"instruction":"Disposición final tal como se decidió: alta, observación, hospitalización, cirugía urgente o remisión a mayor nivel de complejidad, con la justificación dada y las interconsultas activadas. Registra el traslado y la institución receptora solo si se mencionaron."},
    {"key":"indicaciones_y_pendientes","label":"Indicaciones y pendientes","order":10,"required":false,"instruction":"Indicaciones al equipo o al paciente: analgesia y otras órdenes con dosis transcritas literal, controles y estudios pendientes, signos de alarma explicados si hubo alta, e incapacidad o reporte del evento a la EPS o a la aseguradora solo si se mencionaron."}
  ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

update public.clinical_templates set
  name = 'Consulta inicial · valoración preanestésica',
  description = 'Valoración preanestésica ambulatoria o prequirúrgica: antecedentes perioperatorios, vía aérea, ayuno, clasificación de riesgo y plan anestésico propuesto con constancia del consentimiento. Úsela antes del procedimiento; el acto anestésico y la recuperación en URPA tienen sus propias plantillas.',
  sections = '[
    {"key":"cirugia_programada_e_indicacion","label":"Cirugía programada e indicación","order":1,"required":true,"instruction":"Registra el procedimiento quirúrgico programado, su indicación y la fecha prevista tal como se enunciaron, junto con el cirujano o la especialidad tratante si se mencionaron. No supongas el tipo de cirugía ni su carácter electivo o urgente."},
    {"key":"antecedentes_anestesicos","label":"Antecedentes anestésicos","order":2,"required":false,"instruction":"Anestesias previas y su tipo, complicaciones anestésicas personales o familiares (vía aérea difícil, náuseas graves, hipertermia maligna) solo si se interrogaron y mencionaron. Si el paciente niega antecedentes o el tema no se preguntó, déjalo explícito."},
    {"key":"antecedentes_y_medicacion","label":"Comorbilidades y medicación actual","order":3,"required":false,"instruction":"Comorbilidades, alergias y medicación actual con nombres y dosis transcritos literal, incluidos anticoagulantes, antiagregantes e hipoglucemiantes, y la indicación de suspenderlos o continuarlos solo si el médico la dio. Nunca completes dosis ni pautas de suspensión por tu cuenta."},
    {"key":"evaluacion_de_via_aerea","label":"Evaluación de la vía aérea","order":4,"required":false,"instruction":"Predictores de vía aérea tal como el médico los dictó: Mallampati, apertura oral, distancia tiromentoniana, movilidad cervical, piezas dentales sueltas o prótesis. Transcribe las clasificaciones literal; nunca asignes un grado que el médico no enunció. Si la vía aérea no se evaluó, indícalo."},
    {"key":"ayuno_y_preparacion","label":"Ayuno y preparación","order":5,"required":false,"instruction":"Estado de ayuno referido (horas para sólidos y líquidos tal como se dijeron) y preparación indicada: premedicación, ajustes de medicación y requisitos antes de la cirugía. Transcribe tiempos y dosis literal; no apliques pautas estándar que el médico no enunció."},
    {"key":"examen_fisico_y_paraclinicos","label":"Examen físico y paraclínicos","order":6,"required":true,"instruction":"Examen físico dirigido con signos vitales, peso y hallazgos cardiopulmonares tal como se dictaron, y paraclínicos o valoraciones previas (hemograma, electrocardiograma, ecocardiograma) transcritos literal. Nunca inventes resultados; marca como pendiente lo que falte."},
    {"key":"clasificacion_de_riesgo","label":"Clasificación de riesgo","order":7,"required":false,"instruction":"Clasificación ASA y otras escalas de riesgo únicamente si el médico las enunció, transcritas literal; nunca las calcules ni las asignes tú. Registra los factores de riesgo perioperatorio que el médico destacó, con sus palabras. Si no se habló de riesgo, indícalo."},
    {"key":"analisis_y_aptitud","label":"Análisis y aptitud para el procedimiento","order":8,"required":true,"instruction":"Concepto del anestesiólogo tal como lo formuló: si el paciente está apto, requiere optimización o necesita estudios adicionales antes del procedimiento, con el razonamiento expresado. No emitas aptitud ni condiciones que el médico no enunció."},
    {"key":"plan_anestesico_y_consentimiento","label":"Plan anestésico y consentimiento","order":9,"required":true,"instruction":"Técnica anestésica propuesta (general, regional, sedación) con las alternativas y riesgos explicados al paciente, y la constancia del consentimiento informado solo si se mencionó. Incluye recomendaciones finales e indicaciones de ayuno confirmadas, transcritas tal como se dieron."}
  ]'::jsonb,
  updated_at = now()
where id = '6fcc37b6-feab-5b49-95e8-1214cb8810eb' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · dolor agudo posoperatorio',
  description = 'Seguimiento posanestésico en hospitalización: ronda de dolor agudo, funcionamiento de catéteres o bloqueos, efectos adversos de la analgesia y ajuste del plan. Úsela cuando el paciente ya salió de recuperación; la estancia en URPA tiene su propia plantilla.',
  sections = '[
    {"key":"contexto_posoperatorio","label":"Contexto posoperatorio","order":1,"required":true,"instruction":"Registra la cirugía realizada, la técnica anestésica empleada y el día posoperatorio tal como el médico los enunció, junto con el esquema analgésico en curso. No reconstruyas el acto anestésico con datos que no se dictaron."},
    {"key":"evaluacion_del_dolor","label":"Evaluación del dolor","order":2,"required":false,"instruction":"Dolor en reposo y en movimiento con la escala y el valor únicamente si el médico los enunció (transcríbelos literal; nunca asignes un puntaje tú), su localización y cómo ha variado desde la última valoración según lo dicho. Si el dolor no se reevaluó, indícalo."},
    {"key":"efectos_adversos","label":"Efectos adversos de la analgesia","order":3,"required":false,"instruction":"Efectos adversos interrogados o encontrados: náuseas, vómito, prurito, sedación, retención urinaria, depresión respiratoria u otros, solo si se mencionaron. Si el médico refirió que no hay efectos adversos, regístralo así; no supongas tolerancia."},
    {"key":"dispositivos_analgesicos","label":"Catéteres, bloqueos y dispositivos","order":4,"required":false,"instruction":"Estado de catéter epidural, bloqueo regional, bomba PCA u otros dispositivos solo si existen y se comentaron: sitio de inserción, funcionamiento, dosis programadas transcritas literal y signos de complicación descritos. Si no hay dispositivos, indícalo."},
    {"key":"examen_dirigido","label":"Examen dirigido","order":5,"required":true,"instruction":"Examen dirigido con signos vitales tal como se dictaron, estado de conciencia y hallazgos relevantes al seguimiento (nivel sensitivo o motor del bloqueo, sitio del catéter) solo si el médico los exploró y describió. No completes lo no examinado."},
    {"key":"analisis_de_la_evolucion","label":"Análisis de la evolución","order":6,"required":true,"instruction":"Análisis del control del dolor y de la recuperación tal como el médico lo formuló: adecuado, insuficiente o con complicación en estudio, con su razonamiento. No agregues conclusiones ni diagnósticos que no se enunciaron."},
    {"key":"ajuste_del_plan","label":"Ajuste del plan analgésico","order":7,"required":true,"instruction":"Cambios en la analgesia con medicamentos, dosis, vía y frecuencia transcritos literal (nunca los calcules ni los completes), retiro o continuación de dispositivos e interconsultas solicitadas. Incluye lo explicado al paciente sobre el plan solo si se mencionó."},
    {"key":"proxima_valoracion","label":"Próxima valoración","order":8,"required":false,"instruction":"Cuándo será la próxima ronda o valoración y las condiciones para el alta del servicio de dolor agudo, tal como se enunciaron. Registra las instrucciones dejadas a enfermería o al servicio tratante solo si se dictaron; no agregues indicaciones estándar."}
  ]'::jsonb,
  updated_at = now()
where id = 'b2bf40da-9021-59ae-9257-1c3a42736c93' and owner_id is null;

update public.clinical_templates set
  name = 'Acto anestésico · registro intraoperatorio',
  description = 'Registro del acto anestésico en sala: verificación de seguridad, inducción y manejo de la vía aérea, mantenimiento y monitoría, eventos intraoperatorios, líquidos y educción. Úsela para documentar el procedimiento anestésico; la valoración previa y la recuperación en URPA tienen plantillas propias.',
  sections = '[
    {"key":"procedimiento_e_indicacion","label":"Procedimiento e indicación","order":1,"required":true,"instruction":"Cirugía realizada, indicación y carácter (electiva o urgente) tal como se enunciaron, con la técnica anestésica empleada (general, regional, combinada, sedación). No deduzcas el tipo de procedimiento ni la técnica a partir del contexto."},
    {"key":"verificacion_y_seguridad","label":"Verificación y seguridad","order":2,"required":false,"instruction":"Verificación previa tal como se comentó: lista de chequeo de cirugía segura, identidad y sitio quirúrgico, ayuno confirmado, consentimiento anestésico y disponibilidad de equipos. Registra solo los pasos que el médico mencionó haber verificado; no des por hecha la verificación."},
    {"key":"induccion_y_farmacos","label":"Inducción y fármacos administrados","order":3,"required":false,"instruction":"Fármacos de inducción y mantenimiento con dosis, vía y momento transcritos literal: hipnóticos, opioides, relajantes, vasoactivos y antibiótico profiláctico. Nunca calcules dosis por peso ni completes esquemas; si una dosis no se dictó, regístrala como no especificada."},
    {"key":"manejo_de_via_aerea","label":"Manejo de la vía aérea","order":4,"required":false,"instruction":"Manejo de la vía aérea tal como se describió: dispositivo (tubo, máscara laríngea) con calibre si se dijo, número de intentos, grado de laringoscopia transcrito literal solo si se enunció (nunca lo asignes tú) y dificultades encontradas. Si no se comentó, indícalo."},
    {"key":"monitoria_y_curso_transanestesico","label":"Monitoría y curso transanestésico","order":5,"required":true,"instruction":"Monitoría empleada y curso transanestésico según lo dictado: estabilidad hemodinámica, ventilación, profundidad anestésica y valores relevantes transcritos literal. Registra eventos intraoperatorios (hipotensión, arritmias, desaturación, sangrado) y su manejo solo si se mencionaron; nunca inventes cifras."},
    {"key":"liquidos_y_perdidas","label":"Líquidos, sangrado y diuresis","order":6,"required":false,"instruction":"Líquidos administrados, hemoderivados, sangrado estimado y diuresis con los volúmenes transcritos tal como se dictaron. Nunca calcules balances ni estimes pérdidas; si un dato no se enunció, indícalo como no registrado."},
    {"key":"educcion_y_traslado","label":"Educción y traslado","order":7,"required":false,"instruction":"Educción y despertar según lo descrito: reversión del relajante con dosis literal si se dijo, extubación y condición del paciente al trasladarlo (vía aérea propia, ventilando, estable), y a dónde se traslada (URPA, UCI). Registra solo lo enunciado por el médico."},
    {"key":"analisis_y_complicaciones","label":"Análisis y complicaciones","order":8,"required":true,"instruction":"Concepto del anestesiólogo sobre el acto: sin complicaciones o con los eventos que él mismo calificó como complicación, con su análisis textual. No clasifiques gravedad ni atribuyas causalidad que no se enunciaron."},
    {"key":"indicaciones_posanestesicas","label":"Indicaciones posanestésicas","order":9,"required":true,"instruction":"Órdenes para el posoperatorio inmediato transcritas literal: analgesia con dosis y frecuencia, antieméticos, líquidos, oxígeno, vigilancia especial y criterios para avisar al anestesiólogo. No agregues órdenes estándar que no se dictaron."}
  ]'::jsonb,
  updated_at = now()
where id = 'fcb51c7a-ecb0-5e6f-bdd7-463a6c6792f2' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c3000000-0000-4000-8000-000000000002', null,
  'Control postanestésico · recuperación en URPA',
  'Estancia en la unidad de recuperación postanestésica: condición de ingreso desde sala, vía aérea y hemodinamia, dolor y náuseas, complicaciones inmediatas y criterios de egreso con destino. Cubre desde la llegada a la URPA hasta la salida; para el seguimiento posterior en piso use la plantilla de control.',
  'anestesiologia', 'Anestesiología', 'institutional', false, 'active',
  '[
    {"key":"ingreso_a_recuperacion","label":"Ingreso a recuperación","order":1,"required":true,"instruction":"Registra la cirugía y la técnica anestésica recibida tal como se enunciaron, la hora de ingreso a la URPA si se dijo y la condición de llegada descrita por el anestesiólogo (despierto, somnoliento, con vía aérea propia o asistida). No reconstruyas el intraoperatorio con datos no dictados."},
    {"key":"via_aerea_y_ventilacion","label":"Vía aérea y ventilación","order":2,"required":false,"instruction":"Estado de la vía aérea y la ventilación en recuperación según lo descrito: respiración espontánea, necesidad de oxígeno con el dispositivo y el flujo transcritos literal, saturación dictada. Registra estridor, obstrucción o reintubación solo si se mencionaron; no supongas normalidad."},
    {"key":"estado_hemodinamico","label":"Estado hemodinámico","order":3,"required":false,"instruction":"Signos vitales seriados en la URPA transcritos tal como se dictaron, con la hora si se enunció. Registra hipotensión, hipertensión, arritmias o sangrado del sitio quirúrgico y su manejo solo si el médico los mencionó; nunca inventes cifras ni tendencias."},
    {"key":"dolor_y_nauseas","label":"Dolor, náuseas y rescates","order":4,"required":false,"instruction":"Dolor con la escala y el valor solo si el médico los enunció (transcríbelos literal; nunca los asignes tú) y presencia o ausencia de náuseas y vómito según lo dicho, con los rescates analgésicos o antieméticos administrados y sus dosis transcritas literal."},
    {"key":"recuperacion_motora_y_conciencia","label":"Recuperación motora y de la conciencia","order":5,"required":false,"instruction":"Recuperación de la conciencia y de la función motora según lo descrito, incluida la regresión del bloqueo regional con el nivel que el médico enunció. Transcribe la escala de recuperación (Aldrete u otra) literal solo si se dictó; nunca calcules el puntaje tú."},
    {"key":"complicaciones_inmediatas","label":"Complicaciones inmediatas","order":6,"required":false,"instruction":"Complicaciones en la URPA únicamente si ocurrieron y se mencionaron: hipotermia, temblor, delirio al despertar, laringoespasmo, retención urinaria u otras, con el manejo dado. Si el médico refirió que no hubo complicaciones, regístralo así; no lo asumas."},
    {"key":"examen_al_egreso","label":"Examen al egreso","order":7,"required":true,"instruction":"Condición al egreso de recuperación con los hallazgos que el médico describió: estado de conciencia, vía aérea, signos vitales finales transcritos literal, dolor controlado o no, herida y drenajes si se comentaron. No completes lo no evaluado."},
    {"key":"analisis_y_criterios_de_egreso","label":"Análisis y criterios de egreso","order":8,"required":true,"instruction":"Concepto de egreso tal como el médico lo formuló: cumple o no los criterios de salida de la URPA, con el razonamiento expresado y la escala transcrita literal solo si la enunció. No declares criterios cumplidos que no se dijeron."},
    {"key":"destino_e_indicaciones","label":"Destino e indicaciones","order":9,"required":true,"instruction":"Destino al egreso (piso, UCI, alta ambulatoria) y hora si se dijo, con las órdenes entregadas transcritas literal: analgesia con dosis y frecuencia, vigilancia, reinicio de la vía oral y signos de alarma explicados al paciente o a su acompañante. Incluye incapacidad solo si se mencionó."}
  ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();
