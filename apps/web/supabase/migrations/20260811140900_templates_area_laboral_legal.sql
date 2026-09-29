-- Por qué: renovación del catálogo de plantillas — lote del área 9 (medicina laboral y
-- medicina legal). Las 6 plantillas de fábrica de estas dos especialidades salían del
-- generador genérico y no pedían lo que define la nota ocupacional (cargo, exposición, EPP,
-- concepto de aptitud transcrito literal) ni la pericial (relato textual del examinado,
-- medidas de lesiones literales, incapacidad médico-legal solo como la dictó el perito).
-- Se reescriben las 3 de fábrica por especialidad y se agrega una 4ª nueva por cada una.
--
-- medicina_laboral: "Consulta inicial · historia ocupacional y relación salud-trabajo",
--   "Control y seguimiento · evolución laboral y capacidad funcional", "Valoración
--   ocupacional · reintegro laboral y recomendaciones", 4ª: "Examen médico ocupacional ·
--   ingreso, periódico o egreso con concepto de aptitud" — es la cita más frecuente de la
--   especialidad y el concepto de aptitud es donde una alucinación hace más daño.
-- medicina_legal: "Valoración inicial · solicitud de autoridad, relato y examen médico-legal",
--   "Control y seguimiento · segundo reconocimiento y evolución de lesiones", "Valoración
--   médico-legal · procedimiento con fijación de evidencias", 4ª: "Valoración de lesiones
--   personales · hallazgos e incapacidad médico-legal" — es la pericia más frecuente y la de
--   mayor riesgo documental: la nota puede terminar en un proceso judicial.

update public.clinical_templates set
  name = 'Consulta inicial · historia ocupacional y relación salud-trabajo',
  description = 'Primera consulta de medicina laboral: historia ocupacional completa, cargo y exposiciones con EPP, y síntomas con la relación con el trabajo tal como la refirió el trabajador. Úsala cuando el paciente llega remitido por su empresa, EPS o ARL para estudio de una posible enfermedad laboral o de síntomas asociados al oficio.',
  sections = '[
    {"key":"motivo_y_remitente","label":"Motivo de consulta y remitente","order":1,"required":true,
     "instruction":"Documenta el motivo en las palabras del trabajador y quién lo remite (empresa, EPS, ARL o consulta espontánea) tal como se dijo. Registra el propósito de la valoración solo si se enunció; no lo deduzcas del contexto."},
    {"key":"historia_ocupacional","label":"Historia ocupacional","order":2,"required":false,
     "instruction":"Cargo actual, empresa, antigüedad, jornada y tareas descritas; cargos y oficios previos con su duración y exposiciones, tal como los relató el trabajador. Si algún dato (fechas, años de exposición) no se mencionó, indícalo en vez de estimarlo."},
    {"key":"exposicion_y_epp","label":"Exposición ocupacional y EPP","order":3,"required":false,
     "instruction":"Riesgos del puesto que se mencionaron (ruido, químicos, biomecánico, biológico, psicosocial, alturas) y el uso de elementos de protección personal tal como lo describió el trabajador: cuáles usa, con qué frecuencia y si la empresa los suministra. Solo lo dicho en consulta; no completes los riesgos típicos del cargo."},
    {"key":"enfermedad_actual","label":"Enfermedad actual y relación con el trabajo","order":4,"required":true,
     "instruction":"Cronología de los síntomas: inicio, evolución, relación con la jornada o con tareas específicas y mejoría en descansos o vacaciones, todo tal como lo refirió el trabajador. La relación con el trabajo es un relato, no una conclusión: no afirmes causalidad que el médico no haya enunciado."},
    {"key":"antecedentes","label":"Antecedentes personales y extralaborales","order":5,"required":false,
     "instruction":"Antecedentes patológicos, quirúrgicos y farmacológicos, accidentes de trabajo y enfermedades laborales previas (con su estado de calificación solo si se mencionó), hábitos y actividades extralaborales o deportivas relevantes. Si un antecedente no se exploró, indícalo."},
    {"key":"examen_fisico_ocupacional","label":"Examen físico dirigido al riesgo","order":6,"required":true,
     "instruction":"Examen físico orientado a la exposición del cargo: osteomuscular con arcos de movimiento y maniobras si se describieron, piel, audición, visión, cardiopulmonar y neurológico según aplique. Transcribe los signos vitales y hallazgos con los valores dichos; no completes sistemas no examinados."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":7,"required":true,
     "instruction":"Razonamiento y diagnósticos con la precisión con que el médico los formuló. El origen (común o laboral) y la sospecha de enfermedad laboral se consignan SOLO si el médico los enunció; nunca califiques el origen tú. Deja explícitos los diferenciales que consideró."},
    {"key":"plan_y_remisiones","label":"Plan, remisiones y recomendaciones laborales","order":8,"required":true,
     "instruction":"Paraclínicos solicitados, remisiones (EPS, ARL, especialista, seguridad y salud en el trabajo) y recomendaciones o restricciones laborales tal como las dictó el médico: transcríbelas literal, sin agregar restricciones estándar. Incluye incapacidad solo si se otorgó, con los días exactos dichos."},
    {"key":"proximo_control","label":"Próximo control y seguimiento","order":9,"required":false,
     "instruction":"Cuándo vuelve a control, con qué resultados o documentos debe regresar (exámenes, reporte de la empresa, calificación de origen) y los signos por los que debe consultar antes, según lo explicado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = '11c95e6f-69c8-5cf5-bbc8-003933b9e41d' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · evolución laboral y capacidad funcional',
  description = 'Seguimiento del trabajador ya valorado: evolución de los síntomas frente al trabajo, cumplimiento de recomendaciones y restricciones por parte de la empresa, resultados nuevos y ajuste del plan. Úsala para controles de enfermedad laboral en estudio o calificada y para el seguimiento de recomendaciones vigentes.',
  sections = '[
    {"key":"diagnosticos_y_contexto_laboral","label":"Diagnósticos activos y contexto laboral","order":1,"required":true,
     "instruction":"Diagnósticos activos con su tiempo de evolución y estado de calificación de origen solo si el médico lo mencionó (en estudio, calificado común o laboral). Registra el cargo actual y si hubo cambios de puesto o de tareas desde el último control."},
    {"key":"intervalo_y_adherencia","label":"Intervalo, adherencia e incapacidades","order":2,"required":false,
     "instruction":"Tiempo desde el último control, adherencia al tratamiento y a las recomendaciones laborales, e incapacidades en el intervalo con los días y fechas tal como se dijeron: transcríbelos literal, no los sumes ni los estimes. Si la adherencia no se exploró, indícalo."},
    {"key":"evolucion_de_sintomas","label":"Evolución de los síntomas frente al trabajo","order":3,"required":false,
     "instruction":"Evolución de los síntomas en relación con la jornada y las tareas: mejoría, empeoramiento o estabilidad tal como la refirió el trabajador, tolerancia a la carga laboral y efecto de los descansos. Solo lo mencionado en la consulta."},
    {"key":"cumplimiento_de_recomendaciones","label":"Cumplimiento de recomendaciones por la empresa","order":4,"required":false,
     "instruction":"Cumplimiento de las restricciones y recomendaciones por parte de la empresa según el relato del trabajador (reubicación, ajustes del puesto, pausas, EPP suministrado). Consigna gestiones con la ARL o la EPS solo si se mencionaron."},
    {"key":"resultados_nuevos","label":"Resultados nuevos y conceptos aportados","order":5,"required":false,
     "instruction":"Paraclínicos, imágenes o conceptos de otros especialistas aportados desde el último control: transcribe los valores y conclusiones literal, tal como el médico los leyó en consulta. No interpretes ni completes resultados que no se leyeron."},
    {"key":"examen_fisico_de_control","label":"Examen físico de control","order":6,"required":true,
     "instruction":"Examen dirigido a la condición en seguimiento: compara con hallazgos previos solo si el médico hizo la comparación. Registra arcos de movimiento, fuerza, maniobras y signos con los valores dichos; no completes lo no examinado."},
    {"key":"analisis_y_capacidad_funcional","label":"Análisis y capacidad funcional","order":7,"required":true,
     "instruction":"Evaluación de la evolución y de la capacidad funcional para el cargo tal como la enunció el médico. El concepto funcional (puede continuar, requiere restricciones, requiere reubicación) se transcribe literal; nunca lo determines tú ni lo infieras de los hallazgos."},
    {"key":"ajuste_del_plan_y_proximo_control","label":"Ajuste del plan y próximo control","order":8,"required":true,
     "instruction":"Cambios de tratamiento, nuevas remisiones (EPS, ARL, mesa laboral, especialista), recomendaciones actualizadas transcritas literal e incapacidad con los días exactos solo si se otorgó. Cierra con la fecha o plazo del próximo control y qué debe traer el trabajador."}
  ]'::jsonb,
  updated_at = now()
where id = '1d4d90ff-021d-5e40-ab8f-f63f28783c2b' and owner_id is null;

update public.clinical_templates set
  name = 'Valoración ocupacional · reintegro laboral y recomendaciones',
  description = 'Valoración solicitada por la empresa, la EPS o la ARL para definir el reintegro tras una incapacidad, un accidente de trabajo o una enfermedad laboral: documentación revisada, examen dirigido y concepto de reintegro con recomendaciones transcritos tal como los declaró el médico.',
  sections = '[
    {"key":"indicacion_y_solicitante","label":"Indicación y solicitante de la valoración","order":1,"required":true,
     "instruction":"Quién solicita la valoración (empresa, EPS, ARL, IPS de seguridad y salud en el trabajo) y su propósito: reintegro pos-incapacidad, seguimiento de accidente de trabajo o de enfermedad laboral. Registra solo el motivo enunciado; no lo supongas."},
    {"key":"consentimiento_e_identificacion","label":"Identificación y consentimiento informado","order":2,"required":false,
     "instruction":"Verificación de identidad del trabajador y consentimiento informado para la valoración, tal como se registró en la consulta. Si el consentimiento no se mencionó, indícalo; no des por hecho que se obtuvo."},
    {"key":"contexto_laboral_y_cargo","label":"Cargo y contexto laboral del reintegro","order":3,"required":false,
     "instruction":"Cargo al que se reintegra, tareas, jornada y exposiciones descritas, y si la empresa planteó reubicación o ajustes del puesto. Solo lo dicho por el trabajador o consignado por el médico en la consulta."},
    {"key":"documentacion_revisada","label":"Documentación revisada","order":4,"required":false,
     "instruction":"Documentos revisados en la valoración: incapacidades con sus días y fechas, epicrisis, conceptos de especialistas, calificación de origen o de pérdida de capacidad laboral. Transcribe cifras, porcentajes y conclusiones literal; si un documento no se aportó, indícalo."},
    {"key":"estado_actual_y_examen","label":"Estado actual y examen físico dirigido","order":5,"required":true,
     "instruction":"Estado actual referido por el trabajador y examen físico dirigido a la condición que originó la incapacidad: funcionalidad, dolor, arcos de movimiento, fuerza y hallazgos con los valores dichos. No completes sistemas no examinados."},
    {"key":"concepto_de_reintegro","label":"Concepto de reintegro","order":6,"required":true,
     "instruction":"Concepto emitido (reintegro sin restricciones, con restricciones, aplazado u otra modalidad) EXCLUSIVAMENTE tal como lo declaró el médico: transcríbelo literal, nunca lo determines ni lo deduzcas tú de los hallazgos. Si en la consulta no se emitió concepto, indícalo."},
    {"key":"recomendaciones_y_restricciones","label":"Recomendaciones y restricciones laborales","order":7,"required":true,
     "instruction":"Restricciones y recomendaciones laborales dictadas: tareas a evitar, cargas máximas, pausas, ajustes del puesto y su vigencia, transcritas literal y completas. No agregues restricciones estándar ni plazos que el médico no haya dicho."},
    {"key":"seguimiento_y_comunicaciones","label":"Seguimiento y comunicación del concepto","order":8,"required":false,
     "instruction":"Próxima valoración o control, remisiones pendientes y a quién se comunica el concepto (empresa, ARL, EPS) solo si el médico lo mencionó. Registra los documentos entregados al trabajador."}
  ]'::jsonb,
  updated_at = now()
where id = '1c86dfab-968e-54bb-bf60-9bee994def0d' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c9000000-0000-4000-8000-000000000001', null,
   'Examen médico ocupacional · ingreso, periódico o egreso con concepto de aptitud',
   'Examen médico ocupacional de ingreso, periódico o de egreso: historia y exposiciones por cargo, EPP, pruebas complementarias y concepto de aptitud transcrito tal como lo declaró el médico. Úsala para las evaluaciones solicitadas por la empresa dentro de su sistema de gestión de seguridad y salud en el trabajo.',
   'medicina_laboral', 'Medicina laboral', 'institutional', false, 'active',
   '[
    {"key":"tipo_de_examen_y_solicitante","label":"Tipo de examen y solicitante","order":1,"required":true,
     "instruction":"Tipo de examen tal como se enunció (ingreso, periódico, egreso, posincapacidad u otro), empresa solicitante y cargo al que aspira o que desempeña el trabajador. No deduzcas el tipo de examen del contexto: consigna solo el declarado."},
    {"key":"consentimiento_informado","label":"Consentimiento informado","order":2,"required":false,
     "instruction":"Consentimiento informado del trabajador para el examen y para el manejo de sus datos de salud, tal como se registró en la consulta. Si no se mencionó, indícalo; no des por hecho que se obtuvo."},
    {"key":"historia_ocupacional","label":"Historia ocupacional","order":3,"required":false,
     "instruction":"Cargos y empleos previos con duración, exposiciones y uso de EPP en cada uno; accidentes de trabajo y enfermedades laborales previas con su estado de calificación solo si se mencionó. Todo tal como lo relató el trabajador; si algo no se exploró, indícalo."},
    {"key":"perfil_del_cargo_y_exposiciones","label":"Perfil del cargo y exposiciones","order":4,"required":false,
     "instruction":"Tareas y riesgos del cargo evaluado (ruido, químicos, biomecánico, alturas, biológico, psicosocial) y EPP requerido o suministrado, según lo descrito en la consulta o en el profesiograma solo si el médico lo citó. No completes riesgos típicos del oficio que nadie mencionó."},
    {"key":"antecedentes_personales","label":"Antecedentes personales y hábitos","order":5,"required":false,
     "instruction":"Antecedentes patológicos, quirúrgicos, farmacológicos y alérgicos, hábitos (tabaco, alcohol, actividad física) y antecedentes familiares relevantes mencionados. Registra vacunas relacionadas con el riesgo del cargo solo si se hablaron en la consulta."},
    {"key":"revision_por_sistemas","label":"Revisión por sistemas dirigida al riesgo","order":6,"required":false,
     "instruction":"Revisión dirigida a los sistemas expuestos por el cargo: osteomuscular, respiratorio, auditivo, visual, dermatológico, neurológico o mental según los riesgos descritos. Solo los síntomas explorados en la consulta; no listes negativos que no se preguntaron."},
    {"key":"examen_fisico_completo","label":"Examen físico por sistemas","order":7,"required":true,
     "instruction":"Examen físico por sistemas con énfasis en los órganos blanco de la exposición: signos vitales y antropometría con los valores dichos, osteomuscular con arcos y maniobras si se describieron, piel, agudeza visual y auditiva referidas. No completes lo no examinado."},
    {"key":"pruebas_complementarias","label":"Pruebas complementarias","order":8,"required":false,
     "instruction":"Audiometría, visiometría, espirometría, laboratorios y demás pruebas del examen: transcribe resultados y clasificaciones literal, tal como el médico los leyó. Si una prueba está pendiente o no se realizó, escríbelo así; nunca inventes ni normalices resultados."},
    {"key":"concepto_de_aptitud","label":"Concepto de aptitud laboral","order":9,"required":true,
     "instruction":"Concepto de aptitud (apto, apto con restricciones o recomendaciones, aplazado, no apto u otra fórmula usada) EXCLUSIVAMENTE tal como lo declaró el médico: transcríbelo literal y completo, nunca lo determines, ajustes ni deduzcas tú. Si no se emitió concepto en la consulta, indícalo."},
    {"key":"recomendaciones_y_remisiones","label":"Recomendaciones, vigilancia y remisiones","order":10,"required":true,
     "instruction":"Recomendaciones al trabajador y a la empresa, inclusión en sistemas de vigilancia epidemiológica, remisiones a la EPS o al especialista y controles, transcritas tal como se dictaron. Registra qué documentos se entregan y a quién, solo si se mencionó."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

update public.clinical_templates set
  name = 'Valoración inicial · solicitud de autoridad, relato y examen médico-legal',
  description = 'Primera valoración médico-legal de cualquier tipo de caso: solicitud de la autoridad, consentimiento, relato textual de los hechos y examen con hallazgos descritos de forma objetiva. Úsala cuando el caso no corresponde a la plantilla específica de lesiones personales o como abordaje inicial general.',
  sections = '[
    {"key":"solicitud_y_autoridad","label":"Solicitud y autoridad","order":1,"required":true,
     "instruction":"Autoridad o entidad que solicita la valoración (Fiscalía, juzgado, comisaría, inspección) y datos del oficio o caso EXCLUSIVAMENTE como se dictaron: número, fecha y asunto literales. Si algún dato del oficio no se leyó en voz alta, indícalo; nunca lo completes."},
    {"key":"identificacion_y_acompanante","label":"Identificación del examinado y acompañante","order":2,"required":false,
     "instruction":"Identificación del examinado tal como se enunció, quién lo acompaña y en calidad de qué (familiar, servidor de policía, defensor de familia). Solo los datos dichos en la diligencia."},
    {"key":"consentimiento_informado","label":"Consentimiento informado","order":3,"required":false,
     "instruction":"Consentimiento informado del examinado (o de su representante) para la valoración, el registro fotográfico y la toma de muestras, tal como quedó en la diligencia. Si no se mencionó, indícalo de forma explícita; no des por hecho que se obtuvo."},
    {"key":"relato_de_los_hechos","label":"Relato de los hechos","order":4,"required":true,
     "instruction":"Relato de los hechos EN PALABRAS DEL EXAMINADO, entre comillas y sin corregir su lenguaje: fecha, hora, lugar y mecanismo tal como los refirió. No lo resumas con términos técnicos, no agregues detalles, no atribuyas responsabilidades: es un relato, no una conclusión del perito."},
    {"key":"antecedentes_de_interes","label":"Antecedentes de interés","order":5,"required":false,
     "instruction":"Antecedentes médicos, quirúrgicos, traumáticos o de valoraciones médico-legales previas que se mencionaron, y atenciones en salud recibidas por estos hechos con la institución referida. Si no se exploraron, indícalo."},
    {"key":"examen_medico_legal","label":"Examen médico-legal","order":6,"required":true,
     "instruction":"Examen con descripción OBJETIVA de los hallazgos: tipo de hallazgo, localización anatómica con lateralidad y toda medida o dimensión transcrita literal como la dictó el perito; nunca midas, estimes ni conviertas tú. Describe sin calificar: los términos de conclusión pertenecen al análisis, no al examen."},
    {"key":"registro_fotografico_y_muestras","label":"Registro fotográfico, muestras y cadena de custodia","order":7,"required":false,
     "instruction":"Registro fotográfico, toma de muestras o fijación de evidencias y su cadena de custodia SOLO si el perito los mencionó en la diligencia, con los rótulos o consecutivos dictados literal. Si no se habló de cadena de custodia, no la menciones ni la des por realizada."},
    {"key":"analisis_medico_legal","label":"Análisis médico-legal","order":8,"required":true,
     "instruction":"Análisis y conclusiones EXCLUSIVAMENTE las que el perito enunció: compatibilidad de los hallazgos con el relato, mecanismo probable o limitaciones del examen, con sus propias palabras. No agregues conclusiones, probabilidades ni hipótesis que no se dictaron: este documento puede llegar a un proceso judicial."},
    {"key":"conclusiones_y_requerimientos","label":"Conclusiones y requerimientos","order":9,"required":true,
     "instruction":"Respuesta a lo solicitado por la autoridad tal como la dictó el perito, remisiones, valoraciones complementarias y documentos anexados. Si quedó pendiente un segundo reconocimiento o un requerimiento, consígnalo con el plazo dicho, sin inventar términos."}
  ]'::jsonb,
  updated_at = now()
where id = 'a53b2002-8afe-58bc-ab1c-9eacb672ed87' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · segundo reconocimiento y evolución de lesiones',
  description = 'Reconocimientos posteriores de un caso ya valorado: evolución de las lesiones, documentos nuevos aportados y definición de incapacidad o secuelas tal como las dictó el perito. Úsala para segundos y posteriores reconocimientos médico-legales solicitados por la autoridad.',
  sections = '[
    {"key":"contexto_del_reconocimiento","label":"Contexto del reconocimiento","order":1,"required":true,
     "instruction":"Número de reconocimiento (segundo, tercero) y autoridad solicitante tal como se dictaron, con la referencia del oficio o caso literal. Registra la fecha de la valoración anterior solo si el perito la citó."},
    {"key":"hallazgos_previos_citados","label":"Hallazgos previos citados","order":2,"required":false,
     "instruction":"Hallazgos e incapacidad provisional consignados en el reconocimiento anterior SOLO si el perito los citó en esta diligencia, transcritos literal. No los reconstruyas de memoria ni los deduzcas del estado actual."},
    {"key":"evolucion_referida","label":"Evolución referida por el examinado","order":3,"required":false,
     "instruction":"Evolución desde la última valoración en palabras del examinado, entre comillas cuando sea textual: tratamientos, cirugías, hospitalizaciones y síntomas actuales referidos. Solo lo dicho en la diligencia."},
    {"key":"documentos_aportados","label":"Documentos y ayudas diagnósticas aportados","order":4,"required":false,
     "instruction":"Historia clínica, epicrisis, imágenes o conceptos aportados para este reconocimiento: transcribe diagnósticos, fechas y conclusiones literal, tal como el perito los leyó. Si un documento solicitado no fue aportado, indícalo."},
    {"key":"examen_actual","label":"Examen actual de las lesiones","order":5,"required":true,
     "instruction":"Estado actual de las lesiones descrito de forma objetiva: cicatrices y hallazgos con localización, lateralidad y TODA medida transcrita literal como la dictó el perito; nunca la estimes tú. Describe alteraciones funcionales solo como se exploraron en el examen."},
    {"key":"analisis_comparativo","label":"Análisis comparativo de la evolución","order":6,"required":true,
     "instruction":"Análisis de la evolución respecto a valoraciones previas EXCLUSIVAMENTE con las comparaciones y conclusiones que el perito enunció. No afirmes consolidación, mejoría ni empeoramiento que no se hayan dictado."},
    {"key":"incapacidad_y_secuelas","label":"Incapacidad médico-legal y secuelas","order":7,"required":true,
     "instruction":"Incapacidad médico-legal (provisional o definitiva, con los días exactos) y secuelas (deformidad física, perturbación funcional o psíquica, pérdida anatómica) EXCLUSIVAMENTE tal como las dictó el perito: transcríbelas literal, nunca las determines, gradúes ni calcules tú. Si no se definieron, indícalo."},
    {"key":"requerimientos_y_proxima_valoracion","label":"Requerimientos y próxima valoración","order":8,"required":true,
     "instruction":"Nuevos reconocimientos programados con el plazo dicho, valoraciones por especialista solicitadas y documentos requeridos al examinado o a la autoridad. Solo lo consignado en la diligencia."}
  ]'::jsonb,
  updated_at = now()
where id = '35ccdbae-e394-5229-814a-d6ac7fccfe06' and owner_id is null;

update public.clinical_templates set
  name = 'Valoración médico-legal · procedimiento con fijación de evidencias',
  description = 'Procedimientos periciales con toma o fijación de evidencias: registro del acto realizado, hallazgos con medidas literales, muestras y cadena de custodia solo si el perito la mencionó. Úsala cuando la diligencia incluye toma de muestras, embalaje o registro formal de evidencia física.',
  sections = '[
    {"key":"indicacion_y_autoridad","label":"Indicación y autoridad que ordena el acto","order":1,"required":true,
     "instruction":"Procedimiento solicitado y autoridad que lo ordena, con número y fecha de oficio transcritos literal tal como se dictaron. Consigna el propósito del acto solo como fue enunciado; no lo amplíes."},
    {"key":"consentimiento_y_participantes","label":"Consentimiento y participantes","order":2,"required":false,
     "instruction":"Consentimiento informado del examinado para el procedimiento y personas presentes en la diligencia (acompañante, servidor, otro perito) tal como se mencionaron. Si el consentimiento no se registró verbalmente, indícalo."},
    {"key":"condiciones_previas","label":"Condiciones previas y elementos recibidos","order":3,"required":false,
     "instruction":"Estado del examinado antes del procedimiento y elementos recibidos (prendas, objetos) descritos tal cual: material, color y estado literales. No infieras la procedencia ni la pertenencia de los elementos."},
    {"key":"tecnica_y_hallazgos","label":"Técnica y hallazgos","order":4,"required":true,
     "instruction":"Descripción del procedimiento realizado y de los hallazgos, en el orden en que el perito los dictó: localización anatómica, lateralidad y TODA medida o cantidad transcrita literal; nunca midas ni estimes tú. Describe de forma objetiva, sin términos de conclusión."},
    {"key":"muestras_y_evidencias","label":"Muestras y evidencias","order":5,"required":false,
     "instruction":"Muestras tomadas y evidencias fijadas o embaladas, con el tipo, número y rótulo EXCLUSIVAMENTE como los dictó el perito. Si una muestra se mencionó como no tomada o no viable, consígnalo así."},
    {"key":"cadena_de_custodia","label":"Cadena de custodia","order":6,"required":false,
     "instruction":"Registro de cadena de custodia SOLO si el perito la mencionó en la diligencia: formatos, consecutivos y a quién se entrega cada elemento, literal. Si no se habló de cadena de custodia, indícalo de forma explícita; nunca la des por hecha."},
    {"key":"conclusion_del_acto","label":"Conclusión del acto pericial","order":7,"required":true,
     "instruction":"Conclusión o resultado del procedimiento EXCLUSIVAMENTE con las palabras del perito. No agregues interpretaciones, compatibilidades ni resultados pendientes de laboratorio que no se hayan dictado: el acta puede incorporarse a un proceso judicial."},
    {"key":"remisiones_y_seguimiento","label":"Remisiones, destino de muestras y seguimiento","order":8,"required":true,
     "instruction":"Destino de las muestras (laboratorio, autoridad) tal como se mencionó, valoraciones complementarias solicitadas, documentos anexados y próxima diligencia con el plazo dicho. Solo lo consignado."}
  ]'::jsonb,
  updated_at = now()
where id = '6584d60b-2ad6-5c8c-9c48-3ac10ed138fa' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c9000000-0000-4000-8000-000000000002', null,
   'Valoración de lesiones personales · hallazgos e incapacidad médico-legal',
   'Pericia de lesiones personales: relato textual del examinado, descripción objetiva de cada lesión con medidas literales, mecanismo y elemento causal solo como los enunció el perito, e incapacidad médico-legal transcrita tal como se dictó. Úsala en toda valoración por presuntas lesiones solicitada por la autoridad.',
   'medicina_legal', 'Medicina legal', 'institutional', false, 'active',
   '[
    {"key":"autoridad_y_motivo","label":"Autoridad solicitante y motivo de la pericia","order":1,"required":true,
     "instruction":"Autoridad solicitante y motivo de la pericia con los datos del oficio transcritos literal tal como se dictaron (número, fecha, asunto). Registra el hecho investigado solo con las palabras de la solicitud o del perito; no lo tipifiques tú."},
    {"key":"consentimiento_informado","label":"Consentimiento informado","order":2,"required":false,
     "instruction":"Consentimiento informado del examinado o de su representante para el examen y el registro fotográfico, tal como quedó en la diligencia. Si no se mencionó, indícalo de forma explícita; no des por hecho que se obtuvo."},
    {"key":"relato_de_los_hechos","label":"Relato de los hechos","order":3,"required":true,
     "instruction":"Relato EN PALABRAS DEL EXAMINADO y entre comillas: fecha, hora, lugar, mecanismo (golpe, elemento, caída) y presunto agresor SOLO como él los refirió, sin corregir su lenguaje ni añadir detalles. Es el relato de la persona, no una afirmación del perito ni una conclusión."},
    {"key":"estado_actual_y_atenciones","label":"Estado actual y atenciones recibidas","order":4,"required":false,
     "instruction":"Síntomas actuales referidos por el examinado y atenciones en salud recibidas por estos hechos (urgencias, cirugías, incapacidades de la EPS) con la institución y las fechas mencionadas. Solo lo dicho en la diligencia."},
    {"key":"antecedentes_de_interes","label":"Antecedentes de interés","order":5,"required":false,
     "instruction":"Antecedentes médicos, traumáticos o de valoraciones médico-legales previas relevantes para el caso, solo los mencionados. Si no se exploraron, indícalo; no listes negativos que no se preguntaron."},
    {"key":"descripcion_de_lesiones","label":"Descripción de las lesiones","order":6,"required":true,
     "instruction":"Describe CADA lesión de forma objetiva: tipo (equimosis, escoriación, herida, edema), forma, color, localización anatómica con lateralidad y TODAS las medidas transcritas literal como las dictó el perito; nunca las midas, estimes ni redondees tú. Sin términos de conclusión ni de antigüedad que no se hayan dictado."},
    {"key":"mecanismo_y_elemento_causal","label":"Mecanismo y elemento causal","order":7,"required":false,
     "instruction":"Naturaleza del elemento causal (contundente, cortante, cortocontundente u otro) y compatibilidad con el relato EXCLUSIVAMENTE como las enunció el perito. Si no se pronunció sobre el mecanismo, indícalo; nunca lo concluyas tú."},
    {"key":"documentos_y_ayudas","label":"Documentos y ayudas diagnósticas aportados","order":8,"required":false,
     "instruction":"Historia clínica, epicrisis, radiografías o conceptos aportados: transcribe diagnósticos y conclusiones literal, tal como el perito los leyó en la diligencia. Si no se aportaron documentos, consígnalo."},
    {"key":"incapacidad_medico_legal","label":"Incapacidad médico-legal y secuelas","order":9,"required":true,
     "instruction":"Incapacidad médico-legal (provisional o definitiva) con los DÍAS EXACTOS y las secuelas EXCLUSIVAMENTE tal como los dictó el perito: transcríbelos literal, nunca los determines, calcules ni sugieras tú; una cifra inventada puede alterar un proceso judicial. Si no se dictaron, escribe que quedaron pendientes."},
    {"key":"observaciones_y_requerimientos","label":"Observaciones y requerimientos","order":10,"required":true,
     "instruction":"Segundo reconocimiento programado con el plazo dicho, remisiones y valoraciones complementarias, registro fotográfico y cadena de custodia SOLO si el perito los mencionó, y documentos entregados a la autoridad."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();
