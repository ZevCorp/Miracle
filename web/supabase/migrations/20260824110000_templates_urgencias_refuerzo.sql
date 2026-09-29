-- Refuerzo del catalogo de urgencias para el piloto del Hospital General de Medellin.
--
-- POR QUE: entran cinco medicos de urgencias a produccion esta semana. El
-- catalogo de la especialidad tenia cuatro plantillas correctas, pero con dos
-- huecos que en un servicio de urgencias se pagan caro:
--
--   1. La HORA. Es el dato que mas se audita en urgencias (oportunidad de
--      atencion, electrocardiograma seriado, hora de administracion, hora de la
--      decision) y quedaba al azar de lo que el medico dictara. Ahora las
--      instrucciones la piden en todas partes, siempre transcrita y nunca
--      inferida.
--   2. Las ALERGIAS. Omitirlas y no haberlas interrogado se veian igual en la
--      nota. Ahora, si no se interrogaron, la nota lo dice.
--
-- Ademas, una seccion nueva en tres de las cuatro, donde faltaba algo con peso
-- medico-legal: la reevaluacion antes de egresar, la entrega de turno y los
-- aspectos medico-legales del trauma.
--
-- Y dos plantillas nuevas, elegidas por frecuencia real de entrada y por riesgo:
--   - Dolor toracico: la consulta de mayor riesgo medico-legal del servicio, y
--     ninguna de las cuatro pedia lo que la defiende (hora de inicio, hora de
--     cada electrocardiograma, marcadores seriados con su hora, la escala
--     transcrita y no calculada, y el porque explicito del egreso).
--   - Remision y traslado: papeleo diario de un hospital general que vivia
--     apretado dentro de una seccion de "disposicion".
--
-- LA SUGERIDA CAMBIA al final del archivo: pasa de la consulta inicial (historia
-- completa, 9 secciones) a la atencion general, que es la nota del episodio
-- corto y lo que de verdad se dicta en un turno.
--
-- NO TOCA NINGUNA NOTA YA ESCRITA: cada encuentro congela su template_snapshot
-- al crearse, asi que reescribir la plantilla no altera lo firmado.

update public.clinical_templates set
  name = 'Consulta inicial · historia clínica de urgencias',
  description = 'Historia clínica completa del primer contacto en urgencias para cuadros que requieren estudio: triage, cronología, antecedentes, examen por sistemas y plan diagnóstico. Para episodios cortos resueltos en una sola atención use la atención general; para el traumatizado, la de trauma; para el dolor torácico, la suya; para remitir, la de remisión y traslado.',
  sections = '[
    {"key":"triage_y_llegada","label":"Triage y condición de llegada","order":1,"required":false,"instruction":"Transcribe el nivel de triage, la hora de llegada y la hora de atención tal como el médico las enunció; nunca asignes el triage ni deduzcas una hora. Registra el medio de llegada (ambulancia, medios propios), quién acompaña y quién informa. Lo que no se mencionó, déjalo escrito como no referido."},
    {"key":"motivo_de_consulta","label":"Motivo de consulta","order":2,"required":true,"instruction":"Documenta el motivo de consulta en las palabras del paciente o de quien informa, sin traducirlo a un diagnóstico. Si el paciente no puede comunicarse, registra quién relata los hechos, en qué calidad (familiar, testigo, personal de ambulancia) y por qué no puede hacerlo él."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":3,"required":true,"instruction":"Cronología del cuadro con los tiempos tal como se dictaron (hora de inicio, evolución en horas o días), síntomas asociados, intensidad del dolor solo con la escala y el valor que el médico enunció, factores agravantes o atenuantes, manejos previos y su respuesta. Solo lo mencionado; no completes con la evolución típica del cuadro."},
    {"key":"antecedentes_relevantes","label":"Antecedentes relevantes","order":4,"required":false,"instruction":"Empieza por las alergias: transcríbelas literal y, si no se interrogaron o el paciente no pudo responder, déjalo escrito con esas palabras en vez de omitirlas. Sigue con antecedentes patológicos, quirúrgicos y farmacológicos con nombres y dosis literales, consumo de alcohol o sustancias, episodios similares y hospitalizaciones."},
    {"key":"signos_vitales_al_ingreso","label":"Signos vitales al ingreso","order":5,"required":false,"instruction":"Transcribe los signos vitales y la hora de la toma tal como se dictaron: tensión arterial, frecuencia cardiaca, frecuencia respiratoria, temperatura, saturación de oxígeno y glucometría si se dijo. Nunca calcules, redondees ni estimes cifras; si un valor no se mencionó, regístralo como no tomado."},
    {"key":"examen_fisico_dirigido","label":"Examen físico dirigido","order":6,"required":true,"instruction":"Examen físico por sistemas según lo descrito: estado general y de conciencia, hallazgos cardiopulmonares, abdomen, neurológico, piel y extremidades. Incluye signos de alarma o de inestabilidad solo si el médico los describió. No completes sistemas no examinados; regístralos como no explorados."},
    {"key":"paraclinicos_e_imagenes","label":"Paraclínicos e imágenes","order":7,"required":false,"instruction":"Estudios solicitados y resultados disponibles transcritos literal (laboratorios, gases, electrocardiograma, imágenes), con su hora si se dictó y con la interpretación que el médico enunció. Nunca inventes valores ni conclusiones de estudios pendientes; lo que no ha llegado, regístralo como pendiente."},
    {"key":"analisis_e_impresion_diagnostica","label":"Análisis e impresión diagnóstica","order":8,"required":true,"instruction":"Razonamiento clínico y diagnósticos con la precisión con que el médico los formuló, incluidos los diferenciales que descartó o dejó abiertos y la justificación de observar o estudiar al paciente. No agregues diagnósticos ni severidades que no se enunciaron."},
    {"key":"plan_inicial_y_conducta","label":"Plan inicial y conducta","order":9,"required":true,"instruction":"Plan diagnóstico y terapéutico: medicamentos con dosis, vía, frecuencia y hora transcritos literal (nunca los calcules ni los completes), líquidos, oxígeno, monitorización, interconsultas y remisiones, y lo explicado al paciente o a la familia. Incluye incapacidad o trámites con la EPS solo si se mencionaron."}
  ]'::jsonb,
  updated_at = now()
where id = '09f54dd3-eaf6-50c2-af9e-e8473f45cc3a' and owner_id is null;

update public.clinical_templates set
  name = 'Atención general de urgencias · triage, evaluación y conducta',
  description = 'Nota completa de un episodio de urgencias no traumático resuelto en una sola atención: triage, evaluación dirigida, intervenciones, reevaluación y disposición. Para cuadros que ameritan historia amplia use la consulta inicial; para el traumatizado, la de trauma; para el dolor torácico, la suya; para remitir a otra institución, la de remisión y traslado.',
  sections = '[
    {"key":"triage_y_motivo","label":"Triage y motivo de consulta","order":1,"required":true,"instruction":"Transcribe literal el nivel de triage, la hora de llegada y la hora de atención solo si el médico las enunció; nunca asignes el triage ni deduzcas una hora. Registra el motivo de consulta en las palabras del paciente o del acompañante, y quién informa si el paciente no puede hacerlo. Lo no mencionado, indícalo."},
    {"key":"cuadro_clinico_actual","label":"Cuadro clínico actual","order":2,"required":true,"instruction":"Cronología breve del cuadro con los tiempos dictados (inicio, evolución) y síntomas asociados. Registra las alergias tal como se enunciaron y, si no se interrogaron, déjalo escrito. Incluye antecedentes relevantes y manejos previos que el médico mencionó. Solo lo dicho en la atención; no completes con un curso típico de la enfermedad."},
    {"key":"signos_vitales_y_examen","label":"Signos vitales y examen físico","order":3,"required":true,"instruction":"Signos vitales transcritos tal como se dictaron, con su hora si se dijo (nunca los estimes ni los completes), y examen físico dirigido con los hallazgos positivos y negativos que el médico describió. No completes sistemas no examinados; regístralos como no explorados."},
    {"key":"ayudas_diagnosticas","label":"Ayudas diagnósticas","order":4,"required":false,"instruction":"Paraclínicos, electrocardiograma o imágenes realizados en la atención, con resultados transcritos literal, su hora si se dictó y la interpretación que el médico enunció. Si no se solicitaron estudios, indícalo; nunca inventes valores ni hallazgos."},
    {"key":"intervenciones_realizadas","label":"Intervenciones realizadas","order":5,"required":false,"instruction":"Medicamentos administrados en urgencias con dosis, vía y hora transcritas literal (nunca las calcules), líquidos, oxígeno u otras medidas, y la respuesta observada tal como se comentó. No supongas respuestas que no se dijeron."},
    {"key":"analisis_y_diagnostico","label":"Análisis y diagnóstico","order":6,"required":true,"instruction":"Impresión diagnóstica con la precisión con que el médico la formuló y el razonamiento de por qué el cuadro se maneja de forma ambulatoria o en observación. No agregues diagnósticos ni clasificaciones de severidad que no se enunciaron."},
    {"key":"reevaluacion_antes_del_egreso","label":"Reevaluación antes del egreso","order":7,"required":false,"instruction":"Estado del paciente en el momento de decidir la salida: signos vitales de control con su hora, tolerancia a la vía oral, control del dolor y capacidad de deambular, tal como el médico los enunció. Si no se reevaluó antes de definir la conducta, déjalo escrito; nunca repitas los datos del ingreso como si fueran de ahora."},
    {"key":"conducta_y_disposicion","label":"Conducta y disposición","order":8,"required":true,"instruction":"Conducta final tal como se decidió, con su hora si se dijo: alta, observación, hospitalización o remisión, y su justificación. Fórmula de salida con dosis, frecuencia y duración transcritas literal; incapacidad y trámites con la EPS solo si se mencionaron."},
    {"key":"recomendaciones_y_signos_de_alarma","label":"Recomendaciones y signos de alarma","order":9,"required":false,"instruction":"Indicaciones de cuidado en casa y signos de alarma explicados al paciente para volver a urgencias, tal como el médico los enumeró. Registra cuándo y dónde debe hacerse el control ambulatorio solo si se indicó; no agregues advertencias que no se dieron."}
  ]'::jsonb,
  updated_at = now()
where id = '872fbc85-6a96-5ae0-8804-32efc99d1ad7' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · reevaluación en urgencias y disposición',
  description = 'Reevaluación del paciente que ya está en urgencias u observación: respuesta a las intervenciones, resultados nuevos, examen de control, decisión de disposición y entrega de turno. Úsela para las notas de evolución dentro del mismo episodio; si el desenlace es remitirlo a otra institución, use además la de remisión y traslado.',
  sections = '[
    {"key":"contexto_y_tiempo_en_urgencias","label":"Contexto y tiempo en urgencias","order":1,"required":false,"instruction":"Registra el diagnóstico de trabajo con el que viene el paciente, el tiempo transcurrido en urgencias u observación y las intervenciones ya realizadas, tal como el médico lo resumió. No reconstruyas el episodio previo con datos que no se dictaron."},
    {"key":"evolucion_de_sintomas","label":"Evolución de los síntomas","order":2,"required":true,"instruction":"Cambio de los síntomas desde la última valoración: mejoría, persistencia o empeoramiento en palabras del médico o del paciente. Intensidad del dolor solo con la escala y el valor que se enunciaron; nunca la asignes tú. Si un síntoma no se reevaluó, indícalo."},
    {"key":"respuesta_a_intervenciones","label":"Respuesta a las intervenciones","order":3,"required":false,"instruction":"Respuesta a lo administrado: analgesia, líquidos, oxígeno, antibióticos u otras medidas, con los medicamentos, dosis y horas transcritos literal. Registra efectos adversos o falta de respuesta solo si se mencionaron; no supongas tolerancia."},
    {"key":"signos_vitales_de_control","label":"Signos vitales de control","order":4,"required":false,"instruction":"Signos vitales de control transcritos tal como se dictaron, con su hora, y su tendencia frente a los previos solo si el médico la comentó. Nunca calcules diferencias ni inventes valores; si no se tomaron nuevos signos, escríbelo."},
    {"key":"resultados_nuevos","label":"Resultados nuevos","order":5,"required":false,"instruction":"Paraclínicos, imágenes e interconsultas que llegaron desde la última nota, transcritos literal con la lectura que el médico hizo de ellos. Marca lo que sigue pendiente; nunca anticipes ni inventes resultados."},
    {"key":"examen_fisico_de_control","label":"Examen físico de control","order":6,"required":true,"instruction":"Examen físico dirigido de control con los hallazgos descritos y su comparación con la valoración previa solo si el médico la enunció. No repitas hallazgos anteriores como si fueran actuales ni completes sistemas no reexaminados."},
    {"key":"analisis_y_reevaluacion","label":"Análisis y reevaluación","order":7,"required":true,"instruction":"Análisis de la evolución: si el diagnóstico de trabajo se confirma, cambia o se descarta, con el razonamiento que el médico expresó. Deja explícito lo que aún falta por definir. No agregues conclusiones que no se dijeron."},
    {"key":"disposicion_y_plan","label":"Disposición y plan","order":8,"required":true,"instruction":"Disposición decidida tal como se enunció, con su hora si se dijo: alta con indicaciones y signos de alarma, observación, hospitalización, cirugía o remisión, con su justificación. Incluye medicamentos de salida con dosis transcritas literal, incapacidad y trámites con la EPS solo si se mencionaron."},
    {"key":"entrega_de_turno_y_pendientes","label":"Entrega de turno y pendientes","order":9,"required":false,"instruction":"Si el paciente queda en el servicio al cambio de turno, registra a quién se entrega y qué queda pendiente: estudios por resultar, interconsultas por responder, medicamentos por administrar y qué vigilar, tal como el médico lo enunció. Si no hubo entrega de turno, no inventes una."}
  ]'::jsonb,
  updated_at = now()
where id = '3789cbf5-771f-512c-a60c-725d6acc72aa' and owner_id is null;

update public.clinical_templates set
  name = 'Atención de trauma · revisión primaria y secundaria',
  description = 'Atención del paciente traumatizado: mecanismo, revisión primaria ABCDE con las intervenciones realizadas, revisión secundaria por regiones, estudios, disposición y aspectos médico-legales. Úsela en todo trauma que amerite evaluación sistemática; para urgencias no traumáticas use la atención general o la consulta inicial.',
  sections = '[
    {"key":"mecanismo_del_trauma","label":"Mecanismo del trauma","order":1,"required":true,"instruction":"Mecanismo y cinemática del trauma tal como se relataron: tipo de evento (colisión, caída, herida por arma), altura, velocidad o elemento involucrado solo si se dijeron, hora del evento y quién relata los hechos (paciente, testigo, personal de ambulancia). No deduzcas la cinemática; registra solo lo narrado."},
    {"key":"atencion_prehospitalaria","label":"Atención prehospitalaria","order":2,"required":false,"instruction":"Atención previa a la llegada solo si se mencionó: maniobras, inmovilización, medicamentos o líquidos administrados por el equipo prehospitalario, con sus horas, transcritos literal. Si no hubo información prehospitalaria o no se comentó, indícalo."},
    {"key":"revision_primaria_abcde","label":"Revisión primaria ABCDE","order":3,"required":true,"instruction":"Revisión primaria ABCDE tal como el médico la enunció: vía aérea con control cervical, ventilación, circulación y control de hemorragias, déficit neurológico y exposición. Transcribe la escala de coma de Glasgow literal solo si se dictó; nunca la calcules ni asignes puntajes tú. Si un componente no se enunció, indícalo."},
    {"key":"intervenciones_y_respuesta","label":"Intervenciones realizadas y respuesta","order":4,"required":false,"instruction":"Intervenciones de la revisión primaria y la respuesta a cada una, con su hora: manejo de vía aérea, oxígeno, accesos vasculares, líquidos o hemoderivados con volúmenes y dosis transcritos literal, inmovilizaciones u otras maniobras. Registra solo lo realizado y dictado; no supongas resultados."},
    {"key":"signos_vitales_seriados","label":"Signos vitales seriados","order":5,"required":false,"instruction":"Signos vitales al ingreso y sus controles transcritos tal como se dictaron, con la hora si se mencionó. Nunca calcules tendencias, índices ni cifras faltantes; si un registro no se enunció, escríbelo como no disponible."},
    {"key":"revision_secundaria_por_regiones","label":"Revisión secundaria por regiones","order":6,"required":false,"instruction":"Revisión secundaria de cabeza a pies por regiones según lo descrito: cabeza y cara, cuello, tórax, abdomen y pelvis, extremidades, dorso y examen neurológico. Registra hallazgos positivos y negativos solo si el médico los exploró y enunció; no completes regiones no examinadas."},
    {"key":"imagenes_y_paraclinicos","label":"Imágenes y paraclínicos","order":7,"required":false,"instruction":"Estudios realizados o solicitados (radiografías, FAST, tomografía, laboratorios) con resultados transcritos literal y la lectura que el médico enunció. Marca los pendientes como pendientes; nunca inventes hallazgos ni valores."},
    {"key":"analisis_y_diagnosticos","label":"Análisis y diagnósticos","order":8,"required":true,"instruction":"Diagnósticos traumáticos con la precisión con que se formularon y el análisis de la gravedad o estabilidad del paciente en palabras del médico, incluidas las lesiones sospechadas en estudio. No agregues clasificaciones ni severidades que no se enunciaron."},
    {"key":"disposicion","label":"Disposición","order":9,"required":true,"instruction":"Disposición final tal como se decidió, con su hora si se dijo: alta, observación, hospitalización, cirugía urgente o remisión a mayor nivel de complejidad, con la justificación dada y las interconsultas activadas. Registra el traslado y la institución receptora solo si se mencionaron."},
    {"key":"indicaciones_y_pendientes","label":"Indicaciones y pendientes","order":10,"required":false,"instruction":"Indicaciones al equipo o al paciente: analgesia y otras órdenes con dosis transcritas literal, controles y estudios pendientes, signos de alarma explicados si hubo alta, e incapacidad o reporte del evento a la EPS o a la aseguradora solo si se mencionaron."},
    {"key":"aspectos_medicolegales","label":"Aspectos médico-legales","order":11,"required":false,"instruction":"Solo lo que el médico haya enunciado: reporte a la autoridad o a Medicina Legal, custodia de prendas y elementos, toma de muestras y su entrega, presencia de acompañante o de la policía, y consentimiento o negativa del paciente ante un procedimiento. Si no se mencionó nada de esto, déjalo escrito como no referido; nunca lo supongas."}
  ]'::jsonb,
  updated_at = now()
where id = 'c3000000-0000-4000-8000-000000000001' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c3000000-0000-4000-8000-000000000003', null,
  'Dolor torácico · evaluación y descarte de síndrome coronario agudo',
  'Dolor torácico en urgencias: características y hora de inicio, factores de riesgo, electrocardiogramas seriados con su hora, marcadores, escala de riesgo y el razonamiento explícito de por qué el paciente se egresa, se observa o se remite. Para un dolor torácico de origen traumático use la plantilla de trauma.',
  'urgencias', 'Medicina de urgencias', 'institutional', false, 'active',
  '[
    {"key":"inicio_y_caracteristicas_del_dolor","label":"Inicio y características del dolor","order":1,"required":true,"instruction":"Hora exacta de inicio del dolor tal como se dictó (nunca la deduzcas), duración, si es continuo o intermitente, localización, irradiación, tipo, qué lo desencadena y qué lo alivia, y síntomas asociados. Intensidad solo con la escala y el valor que el médico enunció. Lo que no se interrogó, déjalo escrito."},
    {"key":"factores_de_riesgo_y_antecedentes","label":"Factores de riesgo y antecedentes","order":2,"required":false,"instruction":"Factores de riesgo cardiovascular y antecedentes tal como se enunciaron: eventos coronarios previos, revascularización, diabetes, hipertensión, dislipidemia, tabaquismo, consumo de cocaína, medicación habitual y alergias. Si un factor no se interrogó o el paciente no supo responder, déjalo explícito; no lo completes."},
    {"key":"signos_vitales_y_examen","label":"Signos vitales y examen físico","order":3,"required":true,"instruction":"Signos vitales con su hora, transcritos tal como se dictaron, incluida la tensión arterial en ambos brazos si se tomó. Examen cardiopulmonar y de extremidades con los hallazgos positivos y negativos que el médico describió, y signos de inestabilidad si los enunció. Nunca estimes cifras ni completes lo no examinado."},
    {"key":"electrocardiograma_y_controles","label":"Electrocardiograma y controles","order":4,"required":true,"instruction":"Cada electrocardiograma con la hora en que se tomó y la lectura que el médico dictó, incluidos los controles seriados y los cambios entre uno y otro si los comentó. Transcribe la interpretación literal; nunca leas tú el trazado ni describas hallazgos que no se enunciaron. Si no se ha tomado, regístralo como pendiente."},
    {"key":"marcadores_y_paraclinicos","label":"Marcadores y paraclínicos","order":5,"required":false,"instruction":"Troponinas y demás paraclínicos con su valor y la hora de la toma, transcritos literal, incluidas las muestras seriadas y su comparación solo si el médico la enunció. Nunca calcules diferencias entre muestras ni interpretes una cifra por tu cuenta; lo que no ha resultado, márcalo como pendiente."},
    {"key":"escala_de_riesgo_y_diferenciales","label":"Escala de riesgo y diagnósticos diferenciales","order":6,"required":false,"instruction":"Transcribe la escala de riesgo y su puntaje solo si el médico los enunció; nunca la calcules ni asignes puntos. Registra los diferenciales que consideró y cómo los abordó, incluidas las causas de riesgo vital que descartó o dejó abiertas, con las palabras que usó."},
    {"key":"manejo_administrado","label":"Intervenciones y manejo administrado","order":7,"required":false,"instruction":"Medicamentos administrados con dosis, vía y hora transcritos literal (nunca los calcules ni los completes), oxígeno, monitorización, y la respuesta del dolor a cada medida tal como el médico la comentó. Si se activó un código o una interconsulta de cardiología, registra la hora y quién respondió, solo si se dijo."},
    {"key":"analisis_y_decision","label":"Análisis y decisión","order":8,"required":true,"instruction":"Razonamiento con el que el médico decide: por qué considera o descarta un origen coronario, qué peso le da a los electrocardiogramas y marcadores seriados, y qué justifica observar, hospitalizar o egresar al paciente. No agregues diagnósticos, severidades ni conclusiones que no se enunciaron."},
    {"key":"disposicion_y_signos_de_alarma","label":"Disposición y signos de alarma","order":9,"required":true,"instruction":"Disposición decidida con su hora: alta, observación, hospitalización, remisión o valoración por cardiología, con la justificación dada. Medicamentos de salida con dosis y duración transcritos literal. Signos de alarma para volver de inmediato y el control ambulatorio, tal como el médico los explicó al paciente."}
  ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  scope = excluded.scope,
  status = excluded.status,
  sections = excluded.sections,
  updated_at = now();

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c3000000-0000-4000-8000-000000000004', null,
  'Remisión y traslado · justificación, condiciones y receptor',
  'Nota de remisión a otra institución: resumen del caso, por qué el paciente no puede atenderse aquí, gestión con la EPS o el centro regulador, quién acepta, estado en el momento del traslado y condiciones en que sale. Úsela junto con la nota de atención del episodio, no en su lugar.',
  'urgencias', 'Medicina de urgencias', 'institutional', false, 'active',
  '[
    {"key":"resumen_del_caso","label":"Resumen del caso","order":1,"required":true,"instruction":"Resumen de la atención tal como el médico lo dictó: motivo de consulta, hora de ingreso, evolución en el servicio, diagnósticos de trabajo y lo relevante de los antecedentes y las alergias. No reconstruyas el episodio con datos que no se enunciaron en esta nota o en la atención."},
    {"key":"motivo_de_la_remision","label":"Motivo de la remisión","order":2,"required":true,"instruction":"Por qué el paciente necesita otra institución, con las palabras del médico: qué servicio, especialidad, procedimiento o nivel de complejidad se requiere y de qué no dispone esta institución. Registra el carácter urgente o prioritario solo si se enunció; no lo clasifiques tú."},
    {"key":"estudios_y_manejo_previo","label":"Estudios realizados y manejo previo","order":3,"required":false,"instruction":"Estudios ya realizados con sus resultados transcritos literal y los que quedan pendientes, y el manejo administrado antes de remitir, con dosis, vía y hora tal como se dictaron. Nunca inventes valores ni des por hecho un resultado que no llegó."},
    {"key":"gestion_de_la_remision","label":"Gestión de la remisión","order":4,"required":true,"instruction":"Gestiones tal como se relataron: con quién se habló en la EPS, la aseguradora o el centro regulador, la hora de cada contacto y la respuesta obtenida, incluidas las negativas o demoras. Transcribe literal lo que se respondió; no supongas autorizaciones ni tiempos que no se enunciaron."},
    {"key":"institucion_y_profesional_receptor","label":"Institución y profesional receptor","order":5,"required":false,"instruction":"Institución que acepta al paciente, servicio y nombre del profesional que recibe, con la hora de la aceptación, solo si el médico los enunció. Si todavía no hay institución receptora, déjalo escrito así; nunca completes un nombre, un servicio ni una hora."},
    {"key":"estado_al_momento_del_traslado","label":"Estado al momento del traslado","order":6,"required":true,"instruction":"Estado del paciente justo antes de salir: signos vitales con su hora, estado de conciencia, vía aérea, accesos vasculares, oxígeno y soportes que lleva puestos, tal como el médico los enunció. Nunca repitas los signos del ingreso como si fueran de ahora ni estimes cifras."},
    {"key":"condiciones_del_traslado","label":"Condiciones del traslado","order":7,"required":false,"instruction":"Cómo sale el paciente: medio de transporte y tipo de ambulancia, personal que lo acompaña, monitorización y medicamentos previstos durante el trayecto, e inmovilizaciones si las lleva. Registra solo lo que se dictó; no supongas el tipo de ambulancia ni quién acompaña."},
    {"key":"pendientes_e_informacion_a_la_familia","label":"Pendientes e información a la familia","order":8,"required":false,"instruction":"Qué queda pendiente y qué se entrega con el paciente: resultados por llegar, copias de estudios, orden de remisión y documentos. Registra lo explicado al paciente o a la familia sobre el traslado, y su aceptación o negativa, solo si el médico lo enunció."}
  ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  scope = excluded.scope,
  status = excluded.status,
  sections = excluded.sections,
  updated_at = now();

-- La Sugerida de urgencias: de la historia clinica completa a la atencion
-- general del episodio corto. Apagar y encender van en el mismo statement
-- porque la invariante del catalogo es exactamente un is_default por
-- especialidad, y dejarla rota a mitad de camino no es una opcion.
update public.clinical_templates
set is_default = (id = '872fbc85-6a96-5ae0-8804-32efc99d1ad7'),
    updated_at = now()
where specialty_code = 'urgencias'
  and owner_id is null
  and is_default is distinct from (id = '872fbc85-6a96-5ae0-8804-32efc99d1ad7');
