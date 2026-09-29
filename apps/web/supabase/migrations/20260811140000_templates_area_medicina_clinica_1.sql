-- Por qué: renovación del catálogo de plantillas — lote del área 1 (medicina clínica, parte 1).
-- Las 24 plantillas de fábrica de estas 8 especialidades salían del generador genérico: las
-- mismas secciones para cardiología que para dermatología, sin la semiología, las escalas ni el
-- vocabulario que definen cada consulta. Se reescriben las 3 de fábrica por especialidad
-- (inicial, control, procedimiento/valoración) y se agrega una 4ª nueva que cubre el escenario
-- real más frecuente o de mayor riesgo documental que ninguna de las otras tres documentaba.
--
-- medicina_general: "Consulta inicial · motivo, enfermedad actual y enfoque integral",
--   "Control y seguimiento · respuesta al tratamiento y factores de riesgo", "Procedimiento en
--   consulta · indicación, técnica y cuidados posteriores", 4ª: "Control de enfermedad crónica ·
--   hipertensión, diabetes y dislipidemia" — es la cita de mayor volumen del primer nivel y
--   necesita metas, adherencia y tamizaje de órgano blanco que el control genérico no pedía.
-- medicina_familiar: "Consulta inicial · enfoque biopsicosocial y curso de vida", "Control y
--   seguimiento · continuidad del cuidado y plan familiar", "Valoración familiar · visita
--   domiciliaria y coordinación de red", 4ª: "Consulta de planificación familiar · asesoría,
--   elección de método y seguimiento" — es la consulta programada más frecuente de la
--   especialidad y exige dejar registro de asesoría, elegibilidad y consentimiento del método.
-- medicina_interna: "Consulta inicial · problema clínico complejo y multimorbilidad", "Control y
--   seguimiento · multimorbilidad, metas y paraclínicos", "Valoración especializada ·
--   interconsulta por enfermedad y conducta" (las tres quedan explícitamente orientadas a cuando
--   el paciente consulta POR ENFERMEDAD), 4ª: "Chequeo de rutina del adulto · revisión por
--   sistemas, tamizajes y prevención" — la mayoría de citas de interna en Miracle son chequeos
--   programados de un paciente que se siente sano, un escenario que ninguna de las otras cubría.
-- geriatria: "Consulta inicial · funcionalidad, fragilidad y red de apoyo", "Control y
--   seguimiento · polifarmacia, caídas y capacidad funcional", "Valoración geriátrica integral ·
--   dominios, escalas y plan de cuidado", 4ª: "Valoración tras caída · mecanismo, consecuencias
--   y prevención" — la caída es el evento centinela de la especialidad y su documentación
--   (mecanismo, fármacos de riesgo, marcha) no cabía en un control genérico.
-- cardiologia: "Consulta inicial · valoración cardiovascular y riesgo", "Control y seguimiento ·
--   síntomas, presión arterial y metas", "Valoración cardiovascular especializada · estudio y
--   conducta", 4ª: "Valoración preoperatoria · riesgo cardiovascular y conducta perioperatoria"
--   — es la interconsulta más pedida al cardiólogo y la de mayor riesgo médico-legal: el
--   concepto de riesgo y el manejo de la anticoagulación deben quedar transcritos literal.
-- dermatologia: "Consulta inicial · morfología, distribución y evolución de las lesiones",
--   "Control y seguimiento · respuesta cutánea y tolerancia al tratamiento", "Procedimiento
--   dermatológico · biopsia, crioterapia y electrocirugía", 4ª: "Seguimiento de lesión
--   pigmentada · dermatoscopia y tamizaje de cáncer de piel" — es la consulta donde un dato
--   inventado cambia una conducta oncológica y exige descripción y comparación rigurosas.
-- endocrinologia: "Consulta inicial · síntomas metabólicos, hormonales y laboratorios",
--   "Control y seguimiento · metas metabólicas y ajuste terapéutico", "Valoración
--   endocrinológica · pruebas dinámicas y estudio dirigido", 4ª: "Control de diabetes con
--   insulina · automonitoreo, hipoglucemias y titulación" — es el control más frecuente y el de
--   mayor daño potencial por una dosis mal transcrita.
-- gastroenterologia: "Consulta inicial · síntomas digestivos, dieta y estudios previos",
--   "Control y seguimiento · síntomas, nutrición y resultados de estudios", "Procedimiento
--   endoscópico · endoscopia o colonoscopia con hallazgos", 4ª: "Consulta de resultados ·
--   informe de endoscopia, biopsia y conducta" — la entrega de resultados es una cita propia,
--   muy frecuente, en la que el informe de patología debe transcribirse sin interpretación.

update public.clinical_templates set
  name = 'Consulta inicial · motivo, enfermedad actual y enfoque integral',
  description = 'Primera consulta de medicina general por cualquier motivo: enfermedad actual con cronología, antecedentes, examen por sistemas, impresión diagnóstica y plan. Úsala cuando el paciente consulta por primera vez por un problema nuevo, agudo o no estudiado.',
  sections = '[
    {"key":"motivo_de_consulta","label":"Motivo de consulta","order":1,"required":true,
     "instruction":"Documenta el motivo en las palabras del paciente y el tiempo de evolución que él refirió. Si consulta por varios motivos, enumera todos los que planteó. No lo traduzcas a un diagnóstico ni lo reformules en lenguaje técnico."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":2,"required":true,
     "instruction":"Cronología del cuadro: inicio, forma de instauración, localización e irradiación, intensidad tal como la graduó el paciente, factores que lo agravan o alivian, síntomas asociados, automedicación y respuesta. Solo lo referido en la consulta; no completes características que no se preguntaron."},
    {"key":"revision_por_sistemas","label":"Revisión por sistemas","order":3,"required":false,
     "instruction":"Revisión por sistemas realmente interrogada: síntomas generales, cardiopulmonares, digestivos, urinarios, neurológicos y osteomusculares que el médico preguntó, con las respuestas del paciente. No listes negativos que nadie interrogó ni des por normales los sistemas omitidos."},
    {"key":"antecedentes_personales","label":"Antecedentes personales","order":4,"required":false,
     "instruction":"Antecedentes patológicos con su tiempo de evolución, quirúrgicos, hospitalizaciones, traumas y transfusiones mencionados; afiliación a EPS o a un programa de crónicos solo si se habló de ello. Si un antecedente no se exploró, indícalo en vez de asumir que es negativo."},
    {"key":"medicamentos_y_alergias","label":"Medicamentos y alergias","order":5,"required":false,
     "instruction":"Medicamentos que toma con dosis y frecuencia tal como se enunciaron: transcríbelos literal, nunca completes la dosis que falte ni ajustes presentaciones. Incluye productos naturales y alergias a medicamentos o alimentos con la reacción descrita. Si no se preguntó por alergias, indícalo."},
    {"key":"antecedentes_familiares_y_habitos","label":"Antecedentes familiares, hábitos y contexto","order":6,"required":false,
     "instruction":"Antecedentes familiares con el parentesco dicho y hábitos: tabaquismo, alcohol, sustancias, actividad física, alimentación y sueño, tal como los describió el paciente. Agrega ocupación y condiciones de vivienda solo si se mencionaron; no infieras el riesgo social."},
    {"key":"examen_fisico","label":"Examen físico","order":7,"required":true,
     "instruction":"Estado general, signos vitales con las cifras dichas y peso, talla e IMC solo si el médico los enunció (nunca los calcules tú). Registra el examen por sistemas realmente realizado: cabeza y cuello, cardiopulmonar, abdomen, extremidades, piel y neurológico. No completes segmentos no examinados."},
    {"key":"analisis_e_impresion_diagnostica","label":"Análisis e impresión diagnóstica","order":8,"required":true,
     "instruction":"Razonamiento clínico y diagnósticos con la precisión con que el médico los formuló, incluidos los diferenciales que consideró y el grado de certeza que expresó (sospecha, probable, confirmado). No agregues diagnósticos, códigos ni clasificaciones que no se enunciaron."},
    {"key":"plan_y_educacion","label":"Plan de manejo y educación","order":9,"required":true,
     "instruction":"Medicamentos con dosis, vía, frecuencia y duración transcritos literal, sin recalcular ni completar los que falten; paraclínicos e imágenes solicitados; medidas no farmacológicas y la educación dada al paciente con las palabras del médico. No agregues indicaciones que no se dictaron."},
    {"key":"remision_incapacidad_y_proximo_control","label":"Remisión, incapacidad y próximo control","order":10,"required":false,
     "instruction":"Remisiones a especialista o programa con la razón dicha, incapacidad con los días exactos solo si se otorgó (nunca los estimes), fecha o plazo del próximo control y signos de alarma por los que debe consultar antes, tal como se explicaron."}
  ]'::jsonb,
  updated_at = now()
where id = '1244d47f-e098-531b-8cfb-8a3b61c810bd' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · respuesta al tratamiento y factores de riesgo',
  description = 'Control de un problema ya valorado en medicina general: evolución desde la última consulta, adherencia, resultados nuevos y ajuste del plan. Úsala para el seguimiento de un cuadro agudo o subagudo en tratamiento; para hipertensión, diabetes o dislipidemia usa la plantilla de enfermedad crónica.',
  sections = '[
    {"key":"diagnosticos_activos","label":"Diagnósticos activos y motivo del control","order":1,"required":true,
     "instruction":"Diagnósticos activos por los que vuelve el paciente, con su tiempo de evolución y el tratamiento vigente tal como se enunciaron. Si el motivo del control cambió, regístralo con las palabras del paciente. No reconstruyas historia previa que no se mencionó en esta consulta."},
    {"key":"intervalo_y_adherencia","label":"Intervalo y adherencia al tratamiento","order":2,"required":false,
     "instruction":"Tiempo transcurrido desde el último control y adherencia: qué medicamentos tomó, cuáles suspendió y por qué, según lo referido. Transcribe las dosis dichas literal; no supongas cumplimiento ni completes esquemas. Si la adherencia no se exploró, indícalo."},
    {"key":"evolucion_de_sintomas","label":"Evolución de los síntomas","order":3,"required":false,
     "instruction":"Evolución desde la última consulta en palabras del paciente: mejoría, persistencia o empeoramiento, síntomas nuevos y su impacto en el trabajo, el sueño y la vida diaria. Solo lo referido; no interpretes tú la respuesta al tratamiento."},
    {"key":"efectos_adversos","label":"Efectos adversos e intolerancias","order":4,"required":false,
     "instruction":"Efectos adversos atribuidos al tratamiento con la descripción y el momento de aparición que dio el paciente, y qué hizo al respecto. Si no se preguntó por efectos adversos, indícalo en vez de escribir que no los hubo."},
    {"key":"resultados_nuevos","label":"Resultados de paraclínicos e imágenes","order":5,"required":false,
     "instruction":"Paraclínicos, imágenes o conceptos de otros profesionales traídos al control: transcribe valores, unidades, fechas y conclusiones literal, tal como el médico los leyó en voz alta. Nunca interpretes, conviertas ni completes un resultado; si están pendientes, escríbelo así."},
    {"key":"examen_fisico_de_control","label":"Examen físico de control","order":6,"required":true,
     "instruction":"Examen dirigido a la condición en seguimiento y signos vitales con las cifras dichas (peso e IMC solo si el médico los enunció; nunca los calcules). Compara con hallazgos previos únicamente si el médico hizo la comparación. No completes lo que no se examinó."},
    {"key":"analisis_de_evolucion","label":"Análisis de la evolución","order":7,"required":true,
     "instruction":"Evaluación de la respuesta al tratamiento y de los diagnósticos actualizados tal como los planteó el médico, incluidos los cambios de conducta que justificó. No declares mejoría, curación ni falla terapéutica por tu cuenta a partir de los datos."},
    {"key":"ajuste_del_plan","label":"Ajuste del plan de manejo","order":8,"required":true,
     "instruction":"Cambios del tratamiento con medicamento, dosis, vía y duración transcritos literal, incluido lo que se suspende o continúa; nuevos paraclínicos, remisiones e incapacidad con los días exactos solo si se otorgó. No recalcules dosis ni agregues indicaciones no dichas."},
    {"key":"proximo_control_y_signos_de_alarma","label":"Próximo control y signos de alarma","order":9,"required":false,
     "instruction":"Fecha o plazo del próximo control, con qué resultados debe volver el paciente y los signos de alarma por los que debe consultar antes, tal como se le explicaron. Si no se fijó control, indícalo."}
  ]'::jsonb,
  updated_at = now()
where id = '83c4ee80-e292-5a84-be52-4327b7a87b30' and owner_id is null;

update public.clinical_templates set
  name = 'Procedimiento en consulta · indicación, técnica y cuidados posteriores',
  description = 'Procedimientos menores hechos en el consultorio de medicina general: curación, sutura, drenaje, retiro de puntos, infiltración o toma de muestra. Documenta indicación, consentimiento, técnica, tolerancia y cuidados posteriores con el detalle que exige la historia clínica.',
  sections = '[
    {"key":"indicacion_del_procedimiento","label":"Procedimiento realizado e indicación","order":1,"required":true,
     "instruction":"Procedimiento realizado y su indicación tal como la enunció el médico (curación, sutura, drenaje, retiro de puntos, infiltración, toma de muestra u otro), con el motivo clínico y el sitio anatómico con lateralidad si se dijeron. No deduzcas la indicación del cuadro."},
    {"key":"consentimiento_informado","label":"Consentimiento informado","order":2,"required":false,
     "instruction":"Explicación del procedimiento, riesgos y alternativas dadas al paciente y su aceptación, tal como quedó en la consulta. Si el consentimiento no se mencionó, indícalo de forma explícita; nunca lo des por obtenido."},
    {"key":"verificacion_y_riesgos","label":"Verificación previa y antecedentes de riesgo","order":3,"required":false,
     "instruction":"Verificación previa realmente hecha: alergias, incluida la de anestésicos locales, anticoagulación, diabetes, inmunosupresión y vacunación antitetánica, solo si se preguntaron. Registra asepsia y anestesia con el fármaco y la cantidad dichos; nunca completes la dosis."},
    {"key":"tecnica_realizada","label":"Técnica realizada","order":4,"required":true,
     "instruction":"Describe la técnica paso a paso como la narró el médico: abordaje, insumos y material usados, número de puntos, tipo y calibre de sutura y demás detalles dictados. Transcribe cantidades literal; no agregues pasos estándar que no se mencionaron."},
    {"key":"hallazgos_y_muestras","label":"Hallazgos y material obtenido","order":5,"required":true,
     "instruction":"Hallazgos del sitio intervenido descritos de forma objetiva (aspecto, secreción, tejido, medidas dichas) y material obtenido o muestras enviadas a patología con su rótulo. Nunca estimes medidas ni supongas el destino de una muestra que no se mencionó."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones inmediatas","order":6,"required":false,
     "instruction":"Tolerancia del paciente durante el procedimiento, sangrado, dolor y complicaciones inmediatas tal como se describieron, y el estado en que quedó al terminar. Si no se habló de complicaciones, escribe que no se consignaron, no que no las hubo."},
    {"key":"indicaciones_posteriores","label":"Cuidados e indicaciones posteriores","order":7,"required":true,
     "instruction":"Cuidados en casa indicados (curaciones, higiene del sitio, restricciones), medicamentos con dosis y duración transcritos literal y signos de alarma explicados al paciente. No agregues cuidados habituales que el médico no dictó."},
    {"key":"remision_y_seguimiento","label":"Remisión y seguimiento","order":8,"required":false,
     "instruction":"Plazo para retiro de puntos, control del sitio o revisión de resultados, remisiones con la razón dicha e incapacidad con los días exactos solo si se otorgó. Solo lo indicado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = 'e93cf4fb-9eb6-5a6e-8938-0869cc742390' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c1000000-0000-4000-8000-000000000001', null,
   'Control de enfermedad crónica · hipertensión, diabetes y dislipidemia',
   'Control programado del paciente crónico en el primer nivel: adherencia, cifras de automonitoreo, laboratorios y metas terapéuticas tal como las enunció el médico, tamizaje de órgano blanco y ajuste del tratamiento. Úsala en los controles del programa de crónicos, en vez del control general.',
   'medicina_general', 'Medicina general', 'institutional', false, 'active',
   '[
    {"key":"diagnosticos_cronicos","label":"Enfermedades crónicas en control","order":1,"required":true,
     "instruction":"Enfermedades crónicas en control (hipertensión, diabetes tipo 2, dislipidemia u otras) con su tiempo de diagnóstico y el programa o la EPS que hace el seguimiento, tal como se dijeron. No agregues diagnósticos que el médico no haya mencionado en esta consulta."},
    {"key":"tratamiento_actual_y_adherencia","label":"Tratamiento actual y adherencia","order":2,"required":false,
     "instruction":"Esquema actual con medicamento, dosis, frecuencia y horario transcritos literal; olvidos, suspensiones y su motivo; y si la EPS le entregó los medicamentos. Nunca completes una dosis faltante ni deduzcas el esquema a partir del diagnóstico."},
    {"key":"automonitoreo_en_casa","label":"Automonitoreo en casa","order":3,"required":false,
     "instruction":"Cifras que el paciente reporta de su casa: tomas de presión arterial y glucometrías con los valores, fechas y momentos dichos. Transcríbelas literal, sin promediar, redondear ni convertir unidades. Si no lleva registro o no se revisó, escríbelo así."},
    {"key":"sintomas_y_eventos_del_intervalo","label":"Síntomas y eventos del intervalo","order":4,"required":false,
     "instruction":"Síntomas del intervalo relacionados con las enfermedades en control: hipoglucemias, mareo, cefalea, dolor torácico, disnea, edema, claudicación, poliuria, visión borrosa o lesiones en los pies, y consultas a urgencias u hospitalizaciones. Solo lo referido; no listes negativos que no se preguntaron."},
    {"key":"estilo_de_vida","label":"Alimentación, actividad física y hábitos","order":5,"required":false,
     "instruction":"Alimentación, consumo de sal y azúcar, actividad física, peso referido, tabaquismo y alcohol tal como los describió el paciente, y los cambios logrados desde el último control con sus palabras. No juzgues ni infieras el cumplimiento."},
    {"key":"paraclinicos_y_metas","label":"Paraclínicos y metas terapéuticas","order":6,"required":false,
     "instruction":"Resultados revisados (glucemia, hemoglobina glicosilada, perfil lipídico, creatinina, relación albuminuria-creatinuria, potasio) con valores, unidades y fechas transcritos literal. Las metas terapéuticas se registran SOLO como las enunció el médico; nunca las fijes ni las calcules tú."},
    {"key":"tamizaje_de_organo_blanco","label":"Tamizaje de órgano blanco","order":7,"required":false,
     "instruction":"Tamizajes de órgano blanco que el médico mencione en la consulta (fondo de ojo, examen de pies, función renal, electrocardiograma u otros): si están hechos, pendientes o se solicitan hoy, con el resultado dicho. No propongas tamizajes por tu cuenta ni asumas periodicidades."},
    {"key":"examen_fisico_dirigido","label":"Examen físico dirigido","order":8,"required":true,
     "instruction":"Signos vitales con la presión arterial tal como se tomó (cifras, brazo y posición si se dijeron), peso, talla e IMC solo si el médico los enunció, y examen dirigido: cardiopulmonar, pulsos periféricos, edemas, abdomen y pies con sensibilidad si se evaluaron. No completes lo no examinado."},
    {"key":"analisis_de_control","label":"Análisis del control y complicaciones","order":9,"required":true,
     "instruction":"Estado del control de cada enfermedad tal como lo calificó el médico (controlada, en meta, descompensada), complicaciones o comorbilidades que él enunció y la razón del ajuste. No declares el grado de control ni el riesgo cardiovascular por tu cuenta a partir de las cifras."},
    {"key":"ajuste_del_tratamiento","label":"Ajuste del tratamiento y remisiones","order":10,"required":true,
     "instruction":"Medicamentos que se inician, ajustan, continúan o suspenden con dosis, frecuencia y duración transcritos literal, y los paraclínicos o remisiones solicitados (nutrición, oftalmología, nefrología, cardiología) con la razón dicha. Nunca recalcules una dosis ni agregues fármacos no indicados."},
    {"key":"educacion_y_proximo_control","label":"Educación y próximo control","order":11,"required":false,
     "instruction":"Educación dada al paciente sobre dieta, actividad física, técnica de automonitoreo, cuidado de los pies o manejo de hipoglucemias, con las palabras del médico; próximo control con la fecha o el plazo dicho y signos de alarma para consultar antes."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

update public.clinical_templates set
  name = 'Consulta inicial · enfoque biopsicosocial y curso de vida',
  description = 'Primera consulta de medicina familiar: motivo y expectativa del paciente, problema actual, estructura y funcionalidad de la familia, determinantes sociales y plan acordado. Úsala cuando recibes por primera vez a una persona o a una familia y necesitas dejar el contexto completo.',
  sections = '[
    {"key":"motivo_y_expectativa","label":"Motivo de consulta y expectativa","order":1,"required":true,
     "instruction":"Motivo en las palabras del paciente y lo que espera de la consulta si lo expresó (preocupación, temor, necesidad de remisión o de incapacidad). Registra quién lo acompaña y quién aporta la información. No traduzcas el motivo a un diagnóstico."},
    {"key":"enfermedad_actual","label":"Problema actual","order":2,"required":true,
     "instruction":"Cronología del problema: inicio, evolución, síntomas asociados, tratamientos previos y respuesta, y cómo afecta el trabajo, el estudio y la vida familiar según lo relató el paciente. Solo lo referido en la consulta; no completes datos que no se preguntaron."},
    {"key":"estructura_familiar","label":"Estructura familiar y genograma","order":3,"required":false,
     "instruction":"Composición del hogar, parentescos, edades y roles tal como los describió el paciente, y los datos del genograma solo si el médico lo levantó en la consulta. No construyas relaciones ni antecedentes familiares que nadie mencionó."},
    {"key":"funcionalidad_familiar_y_apoyo","label":"Funcionalidad familiar y red de apoyo","order":4,"required":false,
     "instruction":"Dinámica familiar, red de apoyo, cuidadores, conflictos o duelos referidos y la etapa del ciclo vital familiar si el médico la nombró. Consigna el APGAR familiar u otra escala SOLO si se aplicó y se dijo el puntaje; nunca lo estimes ni lo interpretes tú."},
    {"key":"antecedentes_personales","label":"Antecedentes y eventos del curso de vida","order":5,"required":false,
     "instruction":"Antecedentes patológicos, quirúrgicos, alérgicos y medicación crónica con las dosis dichas, más antecedentes familiares con el parentesco mencionado y eventos del curso de vida que el paciente destacó (embarazos, migración, pérdidas). Si algo no se exploró, indícalo."},
    {"key":"determinantes_sociales","label":"Hábitos y determinantes sociales","order":6,"required":false,
     "instruction":"Hábitos (alimentación, actividad física, tabaco, alcohol, sustancias, sueño) y determinantes sociales referidos: vivienda, empleo, ingresos, afiliación a la EPS, acceso a servicios, personas a cargo, violencia o inseguridad alimentaria si se hablaron. No infieras el contexto social."},
    {"key":"examen_fisico","label":"Examen físico","order":7,"required":true,
     "instruction":"Estado general, signos vitales con las cifras dichas, antropometría solo si el médico la enunció (nunca calcules el IMC) y examen por sistemas realmente realizado, dirigido al motivo de consulta. No completes segmentos no examinados ni los des por normales."},
    {"key":"analisis_biopsicosocial","label":"Análisis biopsicosocial e impresión diagnóstica","order":8,"required":true,
     "instruction":"Razonamiento e impresión diagnóstica con la precisión con que el médico las formuló, integrando los factores familiares y sociales que él relacionó con el problema. No agregues diagnósticos, riesgos ni juicios sobre la familia que no se hayan enunciado."},
    {"key":"plan_y_acuerdos","label":"Plan y acuerdos con el paciente","order":9,"required":true,
     "instruction":"Plan acordado: medicamentos con dosis, frecuencia y duración transcritos literal, paraclínicos, medidas no farmacológicas y los compromisos pactados con las palabras del paciente. Incluye incapacidad con los días exactos solo si se otorgó."},
    {"key":"red_y_proximo_control","label":"Coordinación de red y próximo control","order":10,"required":false,
     "instruction":"Remisiones y activación de la red (trabajo social, salud mental, programa de crónicos, protección) con la razón dicha, próximo control con fecha o plazo y signos de alarma explicados. Solo lo indicado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = 'a8fe32cb-fc32-5344-bbdd-2445c5a97aeb' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · continuidad del cuidado y plan familiar',
  description = 'Control de un paciente que ya sigues en medicina familiar: problemas activos, cumplimiento de los acuerdos previos, cambios en el contexto familiar y actualización del plan. Úsala para la consulta de continuidad, no para la primera valoración ni para la visita domiciliaria.',
  sections = '[
    {"key":"problemas_activos","label":"Problemas activos y motivo del control","order":1,"required":true,
     "instruction":"Lista de problemas activos por los que se sigue al paciente y el motivo puntual de este control, tal como se enunciaron. Si aparece un problema nuevo, regístralo con las palabras del paciente. No reconstruyas la historia previa que no se mencionó hoy."},
    {"key":"intervalo_y_adherencia","label":"Intervalo, adherencia y acuerdos previos","order":2,"required":false,
     "instruction":"Tiempo desde el último control, adherencia al tratamiento con las dosis dichas transcritas literal y cumplimiento de los acuerdos pactados en la consulta anterior, según lo referido. Si la adherencia no se exploró, indícalo; no supongas cumplimiento."},
    {"key":"evolucion_del_problema","label":"Evolución de los problemas","order":3,"required":false,
     "instruction":"Evolución de cada problema en palabras del paciente: mejoría, persistencia o empeoramiento, síntomas nuevos y su impacto en el trabajo, el estudio y la vida familiar. Solo lo referido en la consulta; no interpretes la respuesta al tratamiento."},
    {"key":"cambios_en_el_contexto","label":"Cambios en el contexto familiar y social","order":4,"required":false,
     "instruction":"Cambios en el hogar desde el último control: nacimientos, pérdidas, separaciones, cambio de empleo o de vivienda, sobrecarga del cuidador o cambios en la red de apoyo, tal como los relató el paciente. No infieras efectos de esos cambios sobre su salud."},
    {"key":"resultados_nuevos","label":"Resultados y conceptos nuevos","order":5,"required":false,
     "instruction":"Paraclínicos, imágenes o conceptos de otros profesionales traídos al control: transcribe valores, unidades, fechas y conclusiones literal, tal como el médico los leyó. Nunca interpretes ni completes un resultado; si algo está pendiente, escríbelo así."},
    {"key":"examen_fisico_de_control","label":"Examen físico de control","order":6,"required":true,
     "instruction":"Examen dirigido a los problemas en seguimiento con los signos vitales y las cifras dichas, y antropometría solo si el médico la enunció. Compara con hallazgos previos únicamente si el médico hizo la comparación. No completes lo no examinado."},
    {"key":"analisis_y_continuidad","label":"Análisis y continuidad del cuidado","order":7,"required":true,
     "instruction":"Evaluación de cada problema y de la continuidad del cuidado tal como la planteó el médico, incluidos los factores familiares o sociales que él vinculó con la evolución. No declares control, mejoría ni falla terapéutica por tu cuenta."},
    {"key":"plan_actualizado","label":"Plan actualizado y acuerdos","order":8,"required":true,
     "instruction":"Cambios del tratamiento con medicamento, dosis y duración transcritos literal, paraclínicos solicitados, medidas no farmacológicas y los nuevos acuerdos con el paciente y su familia. Incluye incapacidad con los días exactos solo si se otorgó."},
    {"key":"coordinacion_y_proximo_control","label":"Coordinación de red y próximo control","order":9,"required":false,
     "instruction":"Remisiones o gestiones con la EPS y la red de apoyo con la razón dicha, próximo control con fecha o plazo, qué debe traer el paciente y los signos de alarma explicados. Solo lo indicado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = 'f45e5169-077b-5293-b104-ce5026db6d9a' and owner_id is null;

update public.clinical_templates set
  name = 'Valoración familiar · visita domiciliaria y coordinación de red',
  description = 'Valoración de la familia como unidad de cuidado, en el domicilio o en el consultorio: integrantes, condiciones del entorno, riesgos identificados y plan de cuidado familiar con la articulación de la red. Úsala para visitas domiciliarias y valoraciones familiares programadas.',
  sections = '[
    {"key":"motivo_de_la_valoracion","label":"Motivo y solicitante de la valoración","order":1,"required":true,
     "instruction":"Motivo de la valoración familiar o de la visita domiciliaria y quién la solicitó (programa, EPS, la propia familia, el equipo tratante), con el objetivo tal como se enunció. No supongas el propósito ni amplíes el alcance de lo pedido."},
    {"key":"consentimiento_de_la_familia","label":"Consentimiento de la familia","order":2,"required":false,
     "instruction":"Consentimiento de la familia para la valoración y, en domicilio, para el ingreso a la vivienda, tal como quedó registrado. Si no se mencionó el consentimiento, indícalo de forma explícita; nunca lo des por obtenido."},
    {"key":"participantes_y_estructura","label":"Participantes y estructura familiar","order":3,"required":false,
     "instruction":"Quiénes participan en la valoración con su parentesco y edad, quiénes conviven en el hogar y quién ejerce como cuidador principal, tal como se dijo. No completes integrantes ni roles que nadie mencionó."},
    {"key":"condiciones_del_entorno","label":"Condiciones de la vivienda y del entorno","order":4,"required":false,
     "instruction":"Condiciones descritas de la vivienda y del entorno: servicios públicos, hacinamiento, ventilación, cocina, escaleras, barreras arquitectónicas, mascotas, acceso a servicios de salud y seguridad del barrio. Solo lo observado y dicho en la valoración; no lo deduzcas del estrato."},
    {"key":"estado_de_los_integrantes","label":"Estado de salud de los integrantes","order":5,"required":true,
     "instruction":"Estado de salud de cada integrante valorado con sus diagnósticos, medicamentos y controles pendientes tal como se enunciaron; en cada caso indica quién dio la información. Transcribe dosis literal y no atribuyas diagnósticos a quien no fue valorado."},
    {"key":"hallazgos_y_riesgos","label":"Hallazgos y riesgos identificados","order":6,"required":true,
     "instruction":"Riesgos identificados por el equipo en la valoración: caídas, manejo de medicamentos, sobrecarga del cuidador, inseguridad alimentaria, violencia o abandono, adherencia y barreras de acceso, EXCLUSIVAMENTE los que se enunciaron. Nunca infieras riesgo ni califiques a la familia por tu cuenta."},
    {"key":"plan_de_cuidado_familiar","label":"Plan de cuidado familiar","order":7,"required":true,
     "instruction":"Intervenciones acordadas con la familia y con cada integrante: ajustes de medicación con las dosis dichas transcritas literal, educación entregada, adecuaciones del entorno recomendadas y compromisos pactados. No agregues recomendaciones que no se dieron."},
    {"key":"coordinacion_y_seguimiento","label":"Coordinación de red y seguimiento","order":8,"required":false,
     "instruction":"Remisiones y activación de rutas (EPS, trabajo social, salud mental, protección, programa domiciliario) con la razón dicha, responsables asignados y fecha o plazo de la próxima visita o control. Solo lo consignado en la valoración."}
  ]'::jsonb,
  updated_at = now()
where id = '2d36a119-b642-5b88-b299-c07b073a2bb1' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c1000000-0000-4000-8000-000000000002', null,
   'Consulta de planificación familiar · asesoría, elección de método y seguimiento',
   'Consulta de anticoncepción y salud sexual y reproductiva: antecedentes, método previo y su experiencia, asesoría dada, elección del método con su consentimiento e indicaciones de uso. Úsala para inicio, cambio o control de método anticonceptivo, en vez de la consulta inicial general.',
   'medicina_familiar', 'Medicina familiar', 'institutional', false, 'active',
   '[
    {"key":"motivo_de_consulta","label":"Motivo de consulta","order":1,"required":true,
     "instruction":"Motivo en las palabras de la persona: inicio, cambio, continuación o retiro de un método, o consulta por efectos con el método actual. Registra su deseo de embarazo a futuro y el número de hijos que refirió, solo si se habló de ello."},
    {"key":"antecedentes_gineco_obstetricos","label":"Antecedentes ginecoobstétricos","order":2,"required":false,
     "instruction":"Fecha de la última menstruación, características del ciclo, gestaciones, partos, cesáreas y abortos, lactancia actual y citología cervicouterina con su fecha y resultado, tal como se dijeron. Transcribe fechas y resultados literal; nunca los calcules ni los estimes."},
    {"key":"antecedentes_personales","label":"Antecedentes personales y medicamentos","order":3,"required":false,
     "instruction":"Antecedentes patológicos relevantes que se mencionaron (migraña, hipertensión, trombosis, tabaquismo, enfermedad hepática, cáncer de mama), medicamentos con sus dosis y alergias. Si un antecedente no se exploró, indícalo en vez de asumir que es negativo."},
    {"key":"vida_sexual_y_riesgo_de_its","label":"Vida sexual y riesgo de ITS","order":4,"required":false,
     "instruction":"Información sobre vida sexual y riesgo de infecciones de transmisión sexual que la persona haya compartido y el médico haya explorado, con sus palabras y sin juicios. Si el tema no se abordó, indícalo; nunca lo supongas ni lo detalles más allá de lo dicho."},
    {"key":"metodo_previo_y_experiencia","label":"Método previo y experiencia","order":5,"required":false,
     "instruction":"Métodos usados antes con el tiempo de uso, motivo de cambio o suspensión, efectos que refirió (sangrado, dolor, cambios de peso o de ánimo) y fallas percibidas. Solo lo relatado por la persona; no interpretes la causa de los efectos."},
    {"key":"asesoria_y_eleccion","label":"Asesoría y elección del método","order":6,"required":true,
     "instruction":"Métodos que el médico presentó y explicó, con las ventajas, riesgos y condiciones que él enunció, y el método que la persona eligió con sus palabras. Registra criterios de elegibilidad o contraindicaciones SOLO si el médico los mencionó; nunca los apliques tú."},
    {"key":"examen_y_paraclinicos","label":"Examen físico y paraclínicos","order":7,"required":true,
     "instruction":"Signos vitales con las cifras dichas, peso e IMC solo si el médico los enunció, y el examen realizado (mamario, pélvico u otro) con sus hallazgos. Añade paraclínicos revisados o solicitados con valores y fechas transcritos literal. No completes lo no examinado."},
    {"key":"verificacion_y_consentimiento","label":"Verificación de no embarazo y consentimiento","order":8,"required":false,
     "instruction":"Cómo se verificó la ausencia de embarazo (prueba con su resultado, fecha de la última menstruación u otro criterio) tal como se enunció, y el consentimiento informado para el método, en especial si es de larga duración o definitivo. Si no se mencionó, indícalo; no lo des por hecho."},
    {"key":"metodo_indicado_e_instrucciones","label":"Método indicado e instrucciones de uso","order":9,"required":true,
     "instruction":"Método suministrado o aplicado con la presentación, dosis y fecha de inicio transcritas literal; en dispositivos o implantes, el procedimiento realizado y sus hallazgos. Registra las instrucciones de uso, el respaldo por olvido y qué hacer ante efectos, tal como se explicaron."},
    {"key":"proximo_control_y_alarmas","label":"Próximo control y signos de alarma","order":10,"required":false,
     "instruction":"Fecha o plazo del próximo control y de la revisión o retiro del método, entrega de insumos por la EPS si se mencionó, y los signos de alarma para consultar antes, con las palabras del médico. Solo lo indicado en la consulta."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

update public.clinical_templates set
  name = 'Consulta inicial · problema clínico complejo y multimorbilidad',
  description = 'Úsala cuando el paciente consulta por enfermedad: primera valoración de un problema clínico no resuelto o de un adulto con varias comorbilidades, con enfermedad actual, estudios previos, lista de problemas y plan de estudio. Para el chequeo del paciente que se siente sano usa la plantilla de chequeo de rutina.',
  sections = '[
    {"key":"motivo_y_remision","label":"Motivo de consulta y remisión","order":1,"required":true,
     "instruction":"Motivo en las palabras del paciente y quién lo remite (medicina general, otra especialidad, egreso hospitalario o consulta espontánea) con la pregunta concreta que se quiere resolver, tal como se enunció. No traduzcas el motivo a un diagnóstico."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":2,"required":true,
     "instruction":"Cronología detallada: inicio, curso, síntomas cardinales con su intensidad y patrón, síntomas constitucionales (fiebre, pérdida de peso, sudoración), estudios y tratamientos ya recibidos con su respuesta, y hospitalizaciones por este cuadro. Solo lo referido; no completes la historia."},
    {"key":"comorbilidades","label":"Comorbilidades y antecedentes","order":3,"required":false,
     "instruction":"Comorbilidades con su tiempo de evolución y estado de control tal como el médico las enunció, antecedentes quirúrgicos, hospitalizaciones, transfusiones, antecedentes familiares y hábitos (tabaco, alcohol, sustancias). Si un antecedente no se exploró, indícalo."},
    {"key":"medicamentos_y_alergias","label":"Medicamentos y alergias","order":4,"required":false,
     "instruction":"Todos los medicamentos con dosis, frecuencia y tiempo de uso transcritos literal, incluidos los suspendidos recientemente, los de venta libre y los productos naturales, más las alergias con la reacción descrita. Nunca completes una dosis faltante ni deduzcas el esquema del diagnóstico."},
    {"key":"revision_por_sistemas","label":"Revisión por sistemas dirigida","order":5,"required":false,
     "instruction":"Revisión por sistemas efectivamente interrogada, orientada a las hipótesis del médico: cardiovascular, respiratorio, digestivo, urinario, neurológico, osteomuscular, endocrino y hematológico. No listes negativos que no se preguntaron ni des por normales los sistemas omitidos."},
    {"key":"estudios_previos","label":"Paraclínicos y estudios previos","order":6,"required":false,
     "instruction":"Laboratorios, imágenes, biopsias o informes que el paciente trae: transcribe valores, unidades, fechas y conclusiones literal, tal como el médico los leyó en voz alta. Nunca interpretes, conviertas ni completes un resultado; si un estudio está pendiente o no se aportó, escríbelo así."},
    {"key":"examen_fisico","label":"Examen físico por sistemas","order":7,"required":true,
     "instruction":"Signos vitales con las cifras dichas, estado general y examen por sistemas con la semiología descrita: cardiovascular (soplos, ingurgitación yugular, edemas), pulmonar, abdominal (visceromegalias, ascitis), cuello, piel y neurológico. No completes segmentos no examinados."},
    {"key":"analisis_y_lista_de_problemas","label":"Análisis y lista de problemas","order":8,"required":true,
     "instruction":"Lista de problemas activos y razonamiento con la precisión con que el médico los formuló, incluidos los diferenciales que planteó y el grado de certeza que expresó. No agregues diagnósticos, estadios ni clasificaciones de severidad que él no haya enunciado."},
    {"key":"plan_de_estudio_y_tratamiento","label":"Plan de estudio y tratamiento","order":9,"required":true,
     "instruction":"Paraclínicos e imágenes solicitados con su objetivo dicho, y cambios de tratamiento con medicamento, dosis, vía y duración transcritos literal, incluidos los fármacos que se suspenden. Nunca recalcules una dosis ni agregues estudios o tratamientos no indicados."},
    {"key":"remisiones_y_proximo_control","label":"Remisiones, incapacidad y próximo control","order":10,"required":false,
     "instruction":"Remisiones a otras especialidades o solicitud de hospitalización con la razón dicha, incapacidad con los días exactos solo si se otorgó, próximo control con la fecha o el plazo y con qué resultados debe volver, y los signos de alarma explicados."}
  ]'::jsonb,
  updated_at = now()
where id = '17f82cd8-a56f-5a07-93c6-09228083d4a2' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · multimorbilidad, metas y paraclínicos',
  description = 'Úsala cuando el paciente consulta por enfermedad ya conocida: control del adulto con multimorbilidad, con evolución, adherencia y tolerancia, lectura de paraclínicos nuevos, evaluación de metas y ajuste del tratamiento. No es la plantilla del chequeo preventivo del paciente sano.',
  sections = '[
    {"key":"problemas_activos","label":"Problemas activos y motivo del control","order":1,"required":true,
     "instruction":"Problemas activos con su tiempo de evolución y estado tal como los enunció el médico, y el motivo puntual de este control. Si aparece un problema nuevo, regístralo con las palabras del paciente. No reconstruyas historia previa que no se mencionó hoy."},
    {"key":"intervalo_y_eventos","label":"Intervalo, hospitalizaciones y eventos","order":2,"required":false,
     "instruction":"Tiempo desde el último control y eventos del intervalo: consultas a urgencias, hospitalizaciones con su motivo y fechas, procedimientos y valoraciones por otras especialidades. Transcribe fechas y diagnósticos literal; si algo no se detalló, indícalo."},
    {"key":"adherencia_y_tolerancia","label":"Adherencia y tolerancia al tratamiento","order":3,"required":false,
     "instruction":"Adherencia real referida: qué toma, qué suspendió y por qué, dificultades de acceso o entrega por la EPS, y efectos adversos con su descripción y momento de aparición. Transcribe las dosis dichas literal; no supongas cumplimiento ni completes esquemas."},
    {"key":"evolucion_clinica","label":"Evolución clínica","order":4,"required":false,
     "instruction":"Evolución de los síntomas de cada problema en palabras del paciente, con su capacidad funcional y su impacto en la vida diaria, y síntomas nuevos. Solo lo referido en la consulta; no interpretes tú la respuesta al tratamiento."},
    {"key":"paraclinicos_nuevos","label":"Paraclínicos e imágenes nuevos","order":5,"required":false,
     "instruction":"Resultados traídos al control: transcribe valores, unidades, fechas y conclusiones literal, tal como el médico los leyó en voz alta. Nunca conviertas unidades, calcules índices ni completes resultados; si hay estudios pendientes, escríbelo así."},
    {"key":"examen_fisico_de_control","label":"Examen físico de control","order":6,"required":true,
     "instruction":"Signos vitales con las cifras dichas, peso e IMC solo si el médico los enunció, y examen dirigido a los problemas en seguimiento con la semiología descrita (edemas, ruidos pulmonares, abdomen, pulsos). Compara con hallazgos previos solo si el médico hizo la comparación."},
    {"key":"analisis_y_metas","label":"Análisis del control y metas","order":7,"required":true,
     "instruction":"Estado de control de cada problema y cumplimiento de las metas EXCLUSIVAMENTE como las enunció el médico (metas de presión, glicemia, lípidos, función renal u otras). Nunca fijes una meta, ni declares control o descompensación a partir de las cifras por tu cuenta."},
    {"key":"ajuste_del_tratamiento","label":"Ajuste del tratamiento y estudios","order":8,"required":true,
     "instruction":"Medicamentos que se inician, ajustan, continúan o suspenden con dosis, vía, frecuencia y duración transcritos literal, y los paraclínicos o imágenes solicitados con su objetivo dicho. Nunca recalcules una dosis ni agregues fármacos que no se indicaron."},
    {"key":"remisiones_y_proximo_control","label":"Remisiones y próximo control","order":9,"required":false,
     "instruction":"Remisiones o interconsultas con la razón dicha, incapacidad con los días exactos solo si se otorgó, próximo control con fecha o plazo, con qué resultados debe volver el paciente y los signos de alarma explicados."}
  ]'::jsonb,
  updated_at = now()
where id = '87017098-497b-52f8-aff5-18a32650e0eb' and owner_id is null;

update public.clinical_templates set
  name = 'Valoración especializada · interconsulta por enfermedad y conducta',
  description = 'Úsala cuando el paciente consulta por enfermedad y el internista responde a una interconsulta puntual: pregunta del remitente, documentos revisados, examen dirigido, concepto y recomendaciones para el médico tratante. Es la plantilla del concepto especializado, no del control ni del chequeo.',
  sections = '[
    {"key":"indicacion_y_solicitante","label":"Motivo de la interconsulta y solicitante","order":1,"required":true,
     "instruction":"Quién solicita la valoración (servicio, especialidad, institución) y la pregunta concreta que plantea, tal como se enunció. Registra el contexto (prequirúrgico, hospitalizado, ambulatorio) solo si se dijo; no amplíes el alcance de lo pedido."},
    {"key":"resumen_del_caso","label":"Resumen del caso aportado","order":2,"required":false,
     "instruction":"Resumen del caso tal como se expuso en la consulta: diagnósticos, tiempo de evolución, tratamientos recibidos y evolución hasta hoy. Transcribe fechas y diagnósticos literal; no reconstruyas antecedentes que no se mencionaron."},
    {"key":"documentos_y_estudios_revisados","label":"Documentos y estudios revisados","order":3,"required":false,
     "instruction":"Epicrisis, laboratorios, imágenes, informes de patología o conceptos revisados en la valoración: transcribe valores, unidades, fechas y conclusiones literal, tal como el médico los leyó. Si un documento no se aportó o está pendiente, indícalo; nunca lo interpretes por tu cuenta."},
    {"key":"medicamentos_actuales","label":"Medicamentos actuales","order":4,"required":false,
     "instruction":"Esquema farmacológico completo con dosis, vía y frecuencia transcritos literal, incluidos los fármacos recién iniciados o suspendidos y las alergias referidas. Nunca completes una dosis faltante ni ajustes presentaciones."},
    {"key":"estado_actual_y_examen","label":"Estado actual y examen dirigido","order":5,"required":true,
     "instruction":"Estado actual referido por el paciente y examen dirigido a la pregunta de la interconsulta, con signos vitales y la semiología descrita. No completes sistemas no examinados ni des por normales los que no se revisaron."},
    {"key":"analisis_y_concepto","label":"Análisis y concepto especializado","order":6,"required":true,
     "instruction":"Concepto del internista EXCLUSIVAMENTE con las palabras y el grado de certeza que él usó, incluidos los diferenciales y las limitaciones que reconoció. No agregues conclusiones, clasificaciones de riesgo ni respuestas a preguntas que no se abordaron."},
    {"key":"recomendaciones","label":"Recomendaciones al médico tratante","order":7,"required":true,
     "instruction":"Recomendaciones dictadas: estudios sugeridos, cambios de tratamiento con medicamento, dosis y duración transcritos literal y medidas de monitoreo. Transcríbelas completas y sin agregar conductas estándar que el médico no haya enunciado."},
    {"key":"seguimiento_y_contrarreferencia","label":"Seguimiento y contrarreferencia","order":8,"required":false,
     "instruction":"Si el internista continúa el seguimiento o contrarremite al médico tratante, con el plazo dicho, qué resultados se esperan para la próxima valoración y los signos por los que se debe reconsultar antes. Solo lo consignado en la valoración."}
  ]'::jsonb,
  updated_at = now()
where id = '56a7b7cb-573b-50bf-9c69-e2731d57b84c' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c1000000-0000-4000-8000-000000000003', null,
   'Chequeo de rutina del adulto · revisión por sistemas, tamizajes y prevención',
   'Chequeo programado del adulto que se siente sano: revisión completa por sistemas, hábitos, antecedentes, tamizajes y vacunación que el médico mencione, examen físico completo y plan preventivo. Úsala en la cita de chequeo; si el paciente consulta por una enfermedad, usa la consulta inicial o el control.',
   'medicina_interna', 'Medicina interna', 'institutional', false, 'active',
   '[
    {"key":"motivo_del_chequeo","label":"Motivo del chequeo y preocupaciones","order":1,"required":true,
     "instruction":"Registra que se trata de un chequeo y con qué periodicidad lo hace, junto con las preocupaciones o síntomas puntuales que el paciente mencione, en sus palabras. Si trae una exigencia laboral o de su EPS, consígnala. No conviertas una preocupación en diagnóstico."},
    {"key":"revision_por_sistemas","label":"Revisión completa por sistemas","order":2,"required":true,
     "instruction":"Recorre los sistemas que el médico interrogó: general, cardiovascular, respiratorio, digestivo, urinario y genital, neurológico, osteomuscular, piel, endocrino, hematológico, órganos de los sentidos y salud mental, con las respuestas del paciente. No inventes negativos de lo que no se preguntó."},
    {"key":"habitos_y_estilo_de_vida","label":"Hábitos y estilo de vida","order":3,"required":false,
     "instruction":"Alimentación, actividad física con su frecuencia, sueño, tabaquismo con la cantidad referida, alcohol, sustancias, estrés y salud sexual, tal como los describió el paciente. Registra las cantidades solo como él las dijo; nunca calcules paquetes-año ni índices."},
    {"key":"antecedentes_personales","label":"Antecedentes personales","order":4,"required":false,
     "instruction":"Antecedentes patológicos, quirúrgicos, hospitalizaciones, traumas, transfusiones y en mujeres los ginecoobstétricos, con las fechas dichas. Si un antecedente no se exploró, indícalo en vez de asumir que es negativo."},
    {"key":"antecedentes_familiares","label":"Antecedentes familiares","order":5,"required":false,
     "instruction":"Antecedentes familiares con el parentesco y la edad de aparición que se mencionaron (cáncer, enfermedad cardiovascular temprana, diabetes, enfermedad renal, trombosis). No infieras riesgo hereditario ni completes la historia familiar que no se relató."},
    {"key":"medicamentos_y_suplementos","label":"Medicamentos, suplementos y alergias","order":6,"required":false,
     "instruction":"Medicamentos crónicos, suplementos, vitaminas y productos naturales con dosis y frecuencia transcritos literal, y alergias con la reacción descrita. Nunca completes una dosis faltante ni agregues fármacos que no se enunciaron."},
    {"key":"tamizajes","label":"Tamizajes según edad y sexo","order":7,"required":false,
     "instruction":"Tamizajes EXCLUSIVAMENTE los que el médico mencione en la consulta (citología, mamografía, colonoscopia, antígeno prostático, densitometría, tamizaje de VIH u otros): si están hechos, con su fecha y resultado dichos, pendientes o solicitados hoy. Nunca propongas tamizajes ni periodicidades por tu cuenta."},
    {"key":"vacunacion_del_adulto","label":"Vacunación del adulto","order":8,"required":false,
     "instruction":"Estado de vacunación del adulto tal como se revisó (influenza, tétanos, hepatitis B, neumococo, COVID-19 u otras del PAI), con las fechas o refuerzos dichos y las que se indican hoy. Si no se revisó el carné, escríbelo así; no supongas el esquema."},
    {"key":"examen_fisico_completo","label":"Examen físico completo por sistemas","order":9,"required":true,
     "instruction":"Signos vitales con las cifras dichas, peso, talla, IMC y perímetro abdominal solo si el médico los enunció (nunca los calcules), y examen por sistemas realmente realizado: cabeza y cuello, tiroides, cardiovascular, pulmonar, abdomen, piel, mamas o próstata, extremidades y neurológico."},
    {"key":"paraclinicos","label":"Paraclínicos revisados o solicitados","order":10,"required":false,
     "instruction":"Laboratorios traídos al chequeo con valores, unidades y fechas transcritos literal, y los estudios que el médico solicita hoy con el objetivo que dijo. Nunca interpretes un resultado que no se comentó ni agregues exámenes de rutina no solicitados."},
    {"key":"analisis_de_riesgo","label":"Análisis y riesgo del paciente","order":11,"required":true,
     "instruction":"Valoración global del estado de salud y de los riesgos EXCLUSIVAMENTE como los enunció el médico, incluidos hallazgos que requieren estudio adicional. El riesgo cardiovascular u otras escalas se consignan solo si él dio el resultado; nunca las calcules ni las estimes tú."},
    {"key":"plan_preventivo_y_educacion","label":"Plan preventivo y educación","order":12,"required":true,
     "instruction":"Recomendaciones de estilo de vida, vacunas indicadas, estudios y remisiones solicitados y medicamentos con dosis transcritos literal si se formularon, además de la educación dada con las palabras del médico y el plazo del próximo chequeo o control. Nada que no se haya indicado."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

update public.clinical_templates set
  name = 'Consulta inicial · funcionalidad, fragilidad y red de apoyo',
  description = 'Primera consulta geriátrica: motivo e informante, comorbilidades y polifarmacia, funcionalidad en las actividades diarias, cognición y ánimo, marcha y caídas, y red de apoyo. Úsala para el ingreso del adulto mayor; para la valoración multidimensional formal usa la valoración geriátrica integral.',
  sections = '[
    {"key":"motivo_e_informante","label":"Motivo de consulta e informante","order":1,"required":true,
     "instruction":"Motivo en las palabras del paciente y, si aplica, del cuidador, precisando quién aporta la información y con qué grado de confiabilidad según lo dicho. No atribuyas al paciente lo que dijo el acompañante ni al revés."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":2,"required":true,
     "instruction":"Cronología del cuadro con la presentación atípica propia del adulto mayor si se describió (delirium, caídas, astenia, pérdida de apetito o de peso, confusión), tratamientos recibidos y respuesta. Solo lo referido en la consulta; no completes la historia."},
    {"key":"antecedentes_y_medicamentos","label":"Comorbilidades, medicamentos y polifarmacia","order":3,"required":false,
     "instruction":"Comorbilidades con su tiempo de evolución y TODOS los medicamentos con dosis, frecuencia y quién los administra, transcritos literal, incluidos los de venta libre y los productos naturales. Nunca completes una dosis faltante ni juzgues la pertinencia de un fármaco si el médico no lo hizo."},
    {"key":"funcionalidad","label":"Funcionalidad en actividades diarias","order":4,"required":false,
     "instruction":"Desempeño en actividades básicas (baño, vestido, alimentación, continencia, transferencias) e instrumentales (medicamentos, dinero, transporte, cocina, teléfono) tal como se relató, y los cambios recientes. Escalas como Barthel o Lawton solo si se aplicaron y se dijo el puntaje; nunca lo calcules tú."},
    {"key":"cognicion_animo_y_sueno","label":"Cognición, ánimo y sueño","order":5,"required":false,
     "instruction":"Quejas de memoria, desorientación, cambios de conducta, ánimo, apatía, ideas de muerte y calidad del sueño, con quién los reporta. Puntajes de Minimental, Yesavage u otras escalas SOLO si se aplicaron en la consulta y se enunció el resultado; nunca los estimes ni los interpretes tú."},
    {"key":"marcha_caidas_y_sensorial","label":"Marcha, caídas y déficit sensorial","order":6,"required":false,
     "instruction":"Caídas en el último año con su número y circunstancias tal como se dijeron, miedo a caer, uso de bastón o caminador, y déficit visual o auditivo con el uso de gafas o audífonos. Transcribe el número de caídas literal; nunca lo estimes ni lo redondees."},
    {"key":"nutricion_continencia_y_apoyo","label":"Nutrición, continencia y red de apoyo","order":7,"required":false,
     "instruction":"Apetito, cambios de peso con las cifras dichas, dificultad para masticar o deglutir, continencia urinaria y fecal, y red de apoyo: con quién vive, cuidador principal, sobrecarga referida y condiciones de la vivienda. Solo lo mencionado; no infieras el soporte social."},
    {"key":"examen_fisico_geriatrico","label":"Examen físico geriátrico","order":8,"required":true,
     "instruction":"Signos vitales con las cifras dichas, incluida la presión de pie si se buscó ortostatismo, peso e IMC solo si el médico los enunció, estado de hidratación, piel y zonas de presión, cardiopulmonar, abdomen, osteomuscular y neurológico, además de la marcha y el equilibrio observados."},
    {"key":"analisis_e_impresion","label":"Análisis, síndromes geriátricos e impresión","order":9,"required":true,
     "instruction":"Lista de problemas y síndromes geriátricos EXCLUSIVAMENTE como los nombró el médico (fragilidad, sarcopenia, delirium, deterioro cognitivo, riesgo de caídas), con su grado de certeza. Nunca declares fragilidad ni un estadio de deterioro que él no haya enunciado."},
    {"key":"plan_y_proximo_control","label":"Plan, ajuste de medicación y próximo control","order":10,"required":true,
     "instruction":"Ajustes de la medicación con dosis y duración transcritos literal, incluidos los fármacos que se suspenden o desprescriben, paraclínicos, remisiones (nutrición, rehabilitación, neurología, trabajo social), medidas en casa y educación al cuidador, con el plazo del próximo control."}
  ]'::jsonb,
  updated_at = now()
where id = 'a297917d-cd61-5a47-b8b4-a1c6b39945e7' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · polifarmacia, caídas y capacidad funcional',
  description = 'Control del adulto mayor ya valorado: evolución funcional, caídas del intervalo, revisión de la medicación, cognición y ánimo, y ajuste del plan de cuidado. Úsala para los controles periódicos; si el motivo es una caída reciente, usa la plantilla de valoración tras caída.',
  sections = '[
    {"key":"problemas_activos","label":"Problemas activos y síndromes en seguimiento","order":1,"required":true,
     "instruction":"Problemas y síndromes geriátricos en seguimiento tal como los enunció el médico, el motivo puntual del control y quién aporta la información hoy. No reconstruyas antecedentes que no se mencionaron en esta consulta."},
    {"key":"intervalo_y_eventos","label":"Intervalo, hospitalizaciones y eventos","order":2,"required":false,
     "instruction":"Tiempo desde el último control y eventos del intervalo: urgencias, hospitalizaciones con su motivo y fechas, infecciones, delirium o cambios de cuidador. Transcribe fechas y diagnósticos literal; si algo no se detalló, indícalo."},
    {"key":"evolucion_funcional","label":"Evolución funcional","order":3,"required":false,
     "instruction":"Cambios en las actividades básicas e instrumentales desde el último control según el relato del paciente o del cuidador, y el uso de ayudas técnicas. Puntajes de escalas solo si se aplicaron hoy y se dijo el resultado; nunca los calcules ni los compares tú."},
    {"key":"caidas_en_el_intervalo","label":"Caídas en el intervalo","order":4,"required":false,
     "instruction":"Caídas ocurridas desde el último control con su número, circunstancias, lesiones y consultas derivadas, tal como se relataron, además del miedo a caer. Transcribe el número de caídas literal; si no se preguntó por caídas, indícalo en vez de escribir que no hubo."},
    {"key":"revision_de_medicamentos","label":"Revisión de la medicación","order":5,"required":false,
     "instruction":"Medicación vigente con dosis y frecuencia transcritas literal, adherencia real, quién administra los fármacos, efectos adversos referidos y los medicamentos suspendidos o desprescritos con la razón dicha. Nunca completes dosis ni sugieras retirar un fármaco por tu cuenta."},
    {"key":"cognicion_animo_y_conducta","label":"Cognición, ánimo y conducta","order":6,"required":false,
     "instruction":"Cambios en memoria, orientación, conducta, ánimo, apatía o sueño desde el último control, con quién los reporta, y sobrecarga del cuidador si se exploró. Puntajes de escalas solo si se aplicaron hoy y se enunció el resultado; nunca los estimes."},
    {"key":"examen_fisico_de_control","label":"Examen físico de control","order":7,"required":true,
     "instruction":"Signos vitales con las cifras dichas, incluida la toma de pie si se buscó ortostatismo, peso con la cifra referida, estado de hidratación, piel y zonas de presión, y marcha y equilibrio observados. No completes lo que no se examinó."},
    {"key":"analisis_y_metas_de_cuidado","label":"Análisis y metas de cuidado","order":8,"required":true,
     "instruction":"Evaluación de la evolución y de las metas de cuidado EXCLUSIVAMENTE como las planteó el médico, incluidas las decisiones sobre intensidad del tratamiento o cuidado paliativo si se hablaron. Nunca definas metas ni pronóstico por tu cuenta."},
    {"key":"ajuste_y_proximo_control","label":"Ajuste del plan y próximo control","order":9,"required":true,
     "instruction":"Cambios de medicación con dosis y duración transcritos literal, paraclínicos, remisiones (rehabilitación, nutrición, salud mental, domiciliario), recomendaciones al cuidador y adecuaciones del entorno, con el plazo del próximo control y los signos de alarma explicados."}
  ]'::jsonb,
  updated_at = now()
where id = 'ffac2dba-13ae-56e5-83ae-9521db8e1635' and owner_id is null;

update public.clinical_templates set
  name = 'Valoración geriátrica integral · dominios, escalas y plan de cuidado',
  description = 'Valoración multidimensional programada del adulto mayor: dominio clínico y farmacológico, funcional, mental y social, con las escalas efectivamente aplicadas y una síntesis de fragilidad con plan de cuidado. Úsala cuando la cita es la valoración integral, no un control ni una consulta por síntomas.',
  sections = '[
    {"key":"motivo_y_solicitante","label":"Motivo de la valoración y solicitante","order":1,"required":true,
     "instruction":"Motivo de la valoración integral y quién la solicita (programa, EPS, familia, otra especialidad, prequirúrgico u oncológico), con el objetivo tal como se enunció. No amplíes el alcance de lo pedido ni supongas el propósito."},
    {"key":"informante_y_consentimiento","label":"Informante y consentimiento","order":2,"required":false,
     "instruction":"Quién acompaña y aporta la información con su parentesco, la confiabilidad del relato según se comentó, y el consentimiento del paciente o de su representante para la valoración. Si el consentimiento no se mencionó, indícalo; nunca lo des por obtenido."},
    {"key":"dominio_clinico","label":"Dominio clínico y farmacológico","order":3,"required":false,
     "instruction":"Comorbilidades con su estado de control, síntomas actuales, nutrición con peso y cambios referidos, continencia, dolor y sueño, más la lista completa de medicamentos con dosis transcritas literal. Nunca completes una dosis ni agregues diagnósticos no enunciados."},
    {"key":"dominio_funcional","label":"Dominio funcional y escalas aplicadas","order":4,"required":true,
     "instruction":"Desempeño en actividades básicas e instrumentales, marcha, equilibrio y uso de ayudas técnicas, con los puntajes de las escalas EFECTIVAMENTE aplicadas (Barthel, Lawton, velocidad de la marcha, levántese y ande) tal como el médico los enunció. Nunca calcules, estimes ni interpretes un puntaje."},
    {"key":"dominio_mental","label":"Dominio mental, cognitivo y afectivo","order":5,"required":false,
     "instruction":"Estado cognitivo, orientación, memoria, lenguaje, ánimo y síntomas conductuales descritos, con los puntajes de las pruebas aplicadas hoy (Minimental, reloj, Yesavage) tal como se dijeron. Si una prueba no se aplicó, indícalo; nunca infieras deterioro a partir del relato."},
    {"key":"dominio_social","label":"Dominio social, entorno y cuidador","order":6,"required":false,
     "instruction":"Con quién vive, cuidador principal y su sobrecarga referida, apoyo familiar, ingresos, afiliación a la EPS, condiciones y barreras de la vivienda, y voluntades anticipadas si se hablaron. Solo lo relatado; no infieras vulnerabilidad social."},
    {"key":"sintesis_de_fragilidad","label":"Síntesis de fragilidad y pronóstico","order":7,"required":true,
     "instruction":"Síntesis diagnóstica por dominios y clasificación de fragilidad o pronóstico EXCLUSIVAMENTE como los enunció el médico, con los síndromes geriátricos que él identificó. Nunca clasifiques fragilidad, dependencia o pronóstico por tu cuenta a partir de los datos."},
    {"key":"plan_de_cuidado","label":"Plan de cuidado y seguimiento","order":8,"required":true,
     "instruction":"Plan por dominios: ajustes o desprescripción de medicamentos con dosis transcritas literal, rehabilitación, nutrición, adecuación del entorno, apoyo al cuidador, remisiones y metas de cuidado acordadas, con el plazo del seguimiento. Solo lo indicado en la valoración."}
  ]'::jsonb,
  updated_at = now()
where id = 'a2b47864-7887-5400-8283-25c370c69f72' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c1000000-0000-4000-8000-000000000004', null,
   'Valoración tras caída · mecanismo, consecuencias y prevención',
   'Consulta del adulto mayor que se cayó: mecanismo y circunstancias de la caída, lesiones, factores intrínsecos y ambientales, medicamentos de riesgo, examen de marcha y equilibrio, y plan de prevención. Úsala cuando la caída o el deterioro funcional reciente son el motivo de la cita.',
   'geriatria', 'Geriatría', 'institutional', false, 'active',
   '[
    {"key":"descripcion_de_la_caida","label":"Descripción de la caída","order":1,"required":true,
     "instruction":"Fecha, hora y lugar de la caída, qué estaba haciendo, cómo cayó y si hubo pérdida de conciencia, mareo, palpitaciones o debilidad previa, todo tal como lo relató el paciente o el testigo, indicando quién informa. Nunca reconstruyas el mecanismo ni supongas la causa."},
    {"key":"lesiones_y_atencion","label":"Lesiones y atención recibida","order":2,"required":true,
     "instruction":"Lesiones referidas con su localización, dolor, imposibilidad para levantarse, tiempo en el suelo y atención recibida (urgencias, imágenes, cirugía) con fechas e institución. Transcribe diagnósticos y resultados literal; si no se aportó el informe, indícalo."},
    {"key":"caidas_previas","label":"Caídas previas y miedo a caer","order":3,"required":false,
     "instruction":"Número de caídas en el último año con sus circunstancias tal como se dijeron, y si hay miedo a caer o restricción de la actividad por ese temor. Transcribe el número literal; nunca lo estimes ni lo redondees."},
    {"key":"factores_intrinsecos","label":"Factores intrínsecos","order":4,"required":false,
     "instruction":"Factores propios del paciente que se exploraron: visión y audición, neuropatía, artrosis o debilidad, enfermedad de Parkinson, deterioro cognitivo, incontinencia, ortostatismo, arritmias, alcohol y estado nutricional. Solo los explorados; no listes negativos que no se preguntaron."},
    {"key":"medicamentos_de_riesgo","label":"Medicamentos y riesgo de caídas","order":5,"required":false,
     "instruction":"Medicación completa con dosis y horarios transcritos literal, señalando los fármacos que el médico relacionó con la caída (sedantes, antihipertensivos, hipoglicemiantes, antidepresivos) y los cambios recientes de dosis. Nunca atribuyas la caída a un fármaco por tu cuenta."},
    {"key":"factores_ambientales","label":"Factores ambientales del hogar","order":6,"required":false,
     "instruction":"Condiciones del entorno descritas: iluminación, tapetes, pisos húmedos, escaleras, barras de apoyo en el baño, altura de la cama, calzado y mascotas. Solo lo que se relató en la consulta; no supongas cómo es la vivienda."},
    {"key":"impacto_funcional","label":"Impacto funcional tras la caída","order":7,"required":false,
     "instruction":"Cambios en las actividades básicas e instrumentales después de la caída, necesidad nueva de ayuda o de ayudas técnicas, y salidas del hogar, según el relato del paciente o del cuidador. Escalas solo si se aplicaron y se dijo el puntaje."},
    {"key":"examen_marcha_y_equilibrio","label":"Examen físico, marcha y equilibrio","order":8,"required":true,
     "instruction":"Signos vitales con las cifras dichas y la toma de pie si se buscó ortostatismo, examen de las lesiones, fuerza y sensibilidad, visión y audición si se evaluaron, y la marcha y el equilibrio observados con las pruebas aplicadas y su resultado dicho. No completes lo no examinado."},
    {"key":"estudios_realizados","label":"Estudios y paraclínicos","order":9,"required":false,
     "instruction":"Laboratorios, radiografías, electrocardiograma o imágenes revisados o solicitados por esta caída: transcribe valores, fechas y conclusiones literal, tal como el médico los leyó. Si algo está pendiente, escríbelo así; nunca interpretes un estudio por tu cuenta."},
    {"key":"analisis_de_causa_y_riesgo","label":"Análisis de la causa y del riesgo","order":10,"required":true,
     "instruction":"Causa o causas de la caída y nivel de riesgo de nuevas caídas EXCLUSIVAMENTE como los enunció el médico, junto con los diagnósticos derivados del evento. Nunca concluyas el mecanismo ni el riesgo por tu cuenta a partir de los hallazgos."},
    {"key":"plan_de_prevencion","label":"Plan de prevención y seguimiento","order":11,"required":true,
     "instruction":"Ajustes o retiro de medicamentos con dosis transcritas literal, rehabilitación y ejercicio indicados, ayudas técnicas, adecuaciones del hogar, remisiones (oftalmología, rehabilitación, cardiología) y educación al cuidador, con el plazo del próximo control y los signos de alarma explicados."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

update public.clinical_templates set
  name = 'Consulta inicial · valoración cardiovascular y riesgo',
  description = 'Primera valoración por cardiología: síntomas cardiovasculares con su patrón, clase funcional, factores de riesgo, estudios previos y examen cardiovascular completo. Úsala cuando el paciente llega remitido o consulta por primera vez por dolor torácico, disnea, palpitaciones, síncope o hipertensión.',
  sections = '[
    {"key":"motivo_y_remision","label":"Motivo de consulta y remisión","order":1,"required":true,
     "instruction":"Motivo en las palabras del paciente y quién lo remite con la pregunta concreta que plantea, tal como se enunció. No traduzcas el síntoma a un diagnóstico cardiológico ni asumas el motivo de la remisión."},
    {"key":"enfermedad_actual","label":"Enfermedad actual cardiovascular","order":2,"required":true,
     "instruction":"Caracteriza el síntoma como se relató: dolor torácico con localización, irradiación, carácter, duración y relación con el esfuerzo; disnea con lo que la desencadena; palpitaciones con inicio y terminación; síncope con pródromos y recuperación; edema y ortopnea. Solo lo referido."},
    {"key":"clase_funcional","label":"Clase funcional","order":3,"required":false,
     "instruction":"Limitación para la actividad física descrita por el paciente (cuántas cuadras, cuántos pisos, actividades que ya no puede hacer). La clase funcional NYHA o la clase de angina se consignan SOLO si el médico las enunció; nunca las asignes ni las deduzcas del relato."},
    {"key":"factores_de_riesgo","label":"Factores de riesgo cardiovascular","order":4,"required":false,
     "instruction":"Hipertensión, diabetes, dislipidemia, tabaquismo con la cantidad referida, obesidad, sedentarismo, enfermedad renal y apnea del sueño, con su tiempo de evolución y control tal como se dijeron. Nunca calcules paquetes-año ni un puntaje de riesgo por tu cuenta."},
    {"key":"antecedentes_cardiovasculares","label":"Antecedentes cardiovasculares y familiares","order":5,"required":false,
     "instruction":"Infarto, angioplastia con stents, cirugía de revascularización, arritmias, valvulopatías, falla cardiaca, marcapasos o desfibrilador, con las fechas dichas, más antecedentes familiares de enfermedad coronaria temprana o muerte súbita con el parentesco y la edad mencionados."},
    {"key":"medicamentos","label":"Medicamentos actuales","order":6,"required":false,
     "instruction":"Fármacos cardiovasculares y demás medicación con dosis y frecuencia transcritas literal, incluidos antiagregantes y anticoagulantes, con la adherencia y las intolerancias referidas. Nunca completes una dosis faltante ni deduzcas el esquema a partir del diagnóstico."},
    {"key":"estudios_previos","label":"Estudios cardiovasculares previos","order":7,"required":false,
     "instruction":"Electrocardiogramas, ecocardiogramas con la fracción de eyección dicha, pruebas de esfuerzo, Holter, angiografía o tomografía coronaria y laboratorios: transcribe valores, fechas y conclusiones literal como el médico los leyó. Nunca interpretes un trazado ni completes un informe."},
    {"key":"examen_cardiovascular","label":"Examen cardiovascular","order":8,"required":true,
     "instruction":"Presión arterial con las cifras dichas y el brazo y la posición si se enunciaron, frecuencia y ritmo, ingurgitación yugular, pulsos periféricos y su simetría, auscultación con ruidos, soplos con su foco e irradiación y ruidos agregados, campos pulmonares y edemas. No completes lo no examinado."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":9,"required":true,
     "instruction":"Impresión diagnóstica y razonamiento con la precisión con que el médico los formuló, incluidos los diferenciales y el grado de certeza expresado. Estratificaciones de riesgo, clasificaciones o estadios solo si él los enunció; nunca los apliques tú."},
    {"key":"plan_y_proximo_control","label":"Plan, estudios y próximo control","order":10,"required":true,
     "instruction":"Estudios solicitados con su objetivo dicho, tratamiento con medicamento, dosis, vía y duración transcritos literal, incluidos los fármacos que se suspenden, recomendaciones de estilo de vida y remisiones. Cierra con el plazo del próximo control y los signos de alarma explicados."}
  ]'::jsonb,
  updated_at = now()
where id = '47b32491-7693-5375-8cf1-11dfcc04aa7a' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · síntomas, presión arterial y metas',
  description = 'Control del paciente cardiovascular ya valorado: síntomas y clase funcional, adherencia y tolerancia, cifras de automedición, estudios nuevos y ajuste del tratamiento frente a las metas que enunció el médico. Úsala para los controles de hipertensión, falla cardiaca, cardiopatía isquémica o arritmias.',
  sections = '[
    {"key":"diagnosticos_cardiovasculares","label":"Diagnósticos cardiovasculares en seguimiento","order":1,"required":true,
     "instruction":"Diagnósticos cardiovasculares activos con su tiempo de evolución y los procedimientos previos tal como se enunciaron, y el motivo puntual del control. No reconstruyas antecedentes que no se mencionaron en esta consulta."},
    {"key":"sintomas_y_clase_funcional","label":"Síntomas y clase funcional","order":2,"required":false,
     "instruction":"Evolución de la angina, la disnea, las palpitaciones, el edema, la ortopnea o el síncope desde el último control, con lo que el paciente puede hacer hoy. La clase funcional NYHA se registra SOLO si el médico la enunció; nunca la asignes tú a partir del relato."},
    {"key":"adherencia_y_tolerancia","label":"Adherencia y tolerancia al tratamiento","order":3,"required":false,
     "instruction":"Qué medicamentos toma y cuáles suspendió con la razón dicha, entrega por la EPS y efectos adversos referidos (tos, mareo, edema, sangrado, mialgias) con su momento de aparición. Transcribe dosis literal; no supongas cumplimiento ni completes esquemas."},
    {"key":"automedicion_de_presion","label":"Automedición de presión y peso","order":4,"required":false,
     "instruction":"Cifras de presión arterial y frecuencia cardiaca tomadas en casa y el peso diario si lleva control por falla cardiaca, con los valores y fechas dichos. Transcríbelos literal, sin promediar ni redondear. Si no trae registro o no se revisó, escríbelo así."},
    {"key":"estudios_nuevos","label":"Estudios y laboratorios nuevos","order":5,"required":false,
     "instruction":"Electrocardiograma, ecocardiograma, Holter, laboratorios (creatinina, potasio, perfil lipídico, péptidos natriuréticos) o informes de procedimientos traídos al control: transcribe valores, unidades, fechas y conclusiones literal. Nunca interpretes ni completes un resultado."},
    {"key":"examen_de_control","label":"Examen cardiovascular de control","order":6,"required":true,
     "instruction":"Presión arterial con las cifras dichas y el brazo y la posición si se enunciaron, frecuencia y ritmo, peso referido, ingurgitación yugular, auscultación con soplos y ruidos agregados, campos pulmonares y edemas. Compara con hallazgos previos solo si el médico hizo la comparación."},
    {"key":"analisis_de_metas","label":"Análisis del control y metas","order":7,"required":true,
     "instruction":"Grado de control alcanzado y cumplimiento de las metas EXCLUSIVAMENTE como las enunció el médico (metas de presión, de lípidos, de frecuencia cardiaca o de anticoagulación). Nunca fijes una meta ni declares control o descompensación a partir de las cifras por tu cuenta."},
    {"key":"ajuste_del_tratamiento","label":"Ajuste del tratamiento","order":8,"required":true,
     "instruction":"Medicamentos que se inician, titulan, continúan o suspenden con dosis, frecuencia y duración transcritas literal, estudios solicitados con su objetivo dicho y remisiones o programación de procedimientos. Nunca recalcules una dosis ni agregues fármacos no indicados."},
    {"key":"proximo_control_y_alarmas","label":"Próximo control y signos de alarma","order":9,"required":false,
     "instruction":"Plazo del próximo control, con qué resultados debe volver el paciente, recomendaciones de estilo de vida y rehabilitación cardiaca si se indicaron, y los signos de alarma para consultar de urgencia, tal como se explicaron."}
  ]'::jsonb,
  updated_at = now()
where id = '99a3a25b-bcbf-5f80-a0b3-7ce16741b58e' and owner_id is null;

update public.clinical_templates set
  name = 'Valoración cardiovascular especializada · estudio y conducta',
  description = 'Estudios cardiovasculares realizados o interpretados en consulta (electrocardiograma, ecocardiograma, prueba de esfuerzo, Holter, MAPA): indicación, condiciones del examen, técnica, hallazgos y conclusión con su impacto en la conducta. Úsala cuando la cita gira alrededor del estudio.',
  sections = '[
    {"key":"indicacion_del_estudio","label":"Estudio realizado e indicación","order":1,"required":true,
     "instruction":"Estudio realizado y su indicación tal como la enunció el médico, con la pregunta clínica que se busca responder. No deduzcas la indicación a partir del diagnóstico ni amplíes el alcance del estudio."},
    {"key":"consentimiento_y_verificacion","label":"Consentimiento y verificación previa","order":2,"required":false,
     "instruction":"Explicación del estudio, riesgos y aceptación del paciente, y verificación previa (alergias, marcapasos, embarazo, contraindicaciones) tal como quedó en la consulta. Si el consentimiento no se mencionó, indícalo; nunca lo des por obtenido."},
    {"key":"condiciones_del_examen","label":"Condiciones del examen","order":3,"required":false,
     "instruction":"Condiciones en que se hizo el estudio: ayuno, medicamentos suspendidos con el nombre y el tiempo dichos, presión arterial y frecuencia basales con sus cifras, y calidad de la ventana o del registro. Solo lo consignado; nunca supongas la preparación."},
    {"key":"tecnica_y_parametros","label":"Técnica y parámetros","order":4,"required":false,
     "instruction":"Protocolo o técnica empleada tal como se narró (derivaciones, ventanas, protocolo de esfuerzo, duración del registro, cargas alcanzadas) con los parámetros dictados. Transcribe cifras y tiempos literal; no agregues pasos estándar que no se mencionaron."},
    {"key":"hallazgos_del_estudio","label":"Hallazgos del estudio","order":5,"required":true,
     "instruction":"Hallazgos EXCLUSIVAMENTE como el médico los dictó: ritmo, frecuencia, intervalos, alteraciones del segmento ST, diámetros y fracción de eyección, válvulas, presiones estimadas o eventos del registro. Transcribe cada medida y porcentaje literal; nunca los calcules, estimes ni normalices."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones","order":6,"required":false,
     "instruction":"Síntomas durante el estudio, motivo de terminación si se suspendió, comportamiento de la presión y la frecuencia, arritmias y complicaciones inmediatas, tal como se describieron. Si no se habló de complicaciones, escribe que no se consignaron, no que no las hubo."},
    {"key":"conclusion_del_estudio","label":"Conclusión e impacto en la conducta","order":7,"required":true,
     "instruction":"Conclusión del estudio con las palabras del médico y cómo modifica la conducta según él lo enunció. Nunca emitas una conclusión, un grado de severidad ni una clasificación que no se haya dictado: este informe orienta decisiones invasivas."},
    {"key":"recomendaciones_y_seguimiento","label":"Recomendaciones y seguimiento","order":8,"required":true,
     "instruction":"Cambios de tratamiento con dosis transcritas literal, estudios adicionales o procedimientos programados con su indicación, remisiones y restricciones de actividad, con el plazo del próximo control y los signos de alarma explicados."}
  ]'::jsonb,
  updated_at = now()
where id = '91396c9c-0f0a-5dcf-ac77-e43b4211ce2e' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c1000000-0000-4000-8000-000000000005', null,
   'Valoración preoperatoria · riesgo cardiovascular y conducta perioperatoria',
   'Concepto cardiovascular previo a una cirugía: indicación y urgencia del procedimiento, capacidad funcional como la enunció el médico, riesgo declarado y conducta perioperatoria con el manejo de antiagregantes y anticoagulantes. Úsala cuando la cita es para autorizar o condicionar una cirugía.',
   'cardiologia', 'Cardiología', 'institutional', false, 'active',
   '[
    {"key":"cirugia_propuesta","label":"Cirugía propuesta y solicitante","order":1,"required":true,
     "instruction":"Cirugía o procedimiento propuesto, especialidad y cirujano que solicita el concepto, fecha prevista y carácter urgente o electivo, tal como se enunciaron. No supongas el tipo de anestesia ni la magnitud del procedimiento si no se dijeron."},
    {"key":"antecedentes_cardiovasculares","label":"Antecedentes cardiovasculares","order":2,"required":false,
     "instruction":"Infarto, angioplastia con stents y su fecha, revascularización, falla cardiaca, valvulopatías, arritmias, marcapasos o desfibrilador, con las fechas dichas. Las fechas de stents son críticas: transcríbelas literal y, si no se dijeron, indícalo en vez de estimarlas."},
    {"key":"comorbilidades_y_riesgo","label":"Comorbilidades y factores de riesgo","order":3,"required":false,
     "instruction":"Hipertensión, diabetes, enfermedad renal, EPOC, apnea del sueño, anemia, tabaquismo y obesidad con su estado de control tal como se enunciaron, junto con eventos cerebrovasculares previos. No agregues comorbilidades que no se mencionaron."},
    {"key":"medicamentos_y_anticoagulacion","label":"Medicamentos, antiagregación y anticoagulación","order":4,"required":false,
     "instruction":"Medicación completa con dosis y frecuencia transcritas literal, con atención especial a antiagregantes, anticoagulantes, betabloqueadores e hipoglicemiantes. Nunca completes una dosis, ni indiques suspender o continuar un fármaco por tu cuenta: solo lo que el médico dictó."},
    {"key":"capacidad_funcional","label":"Capacidad funcional","order":5,"required":true,
     "instruction":"Capacidad funcional EXACTAMENTE como la enunció el médico y como la describió el paciente (subir pisos, caminar cuadras, actividades que tolera). Si el médico dio un valor en METs, transcríbelo literal; nunca lo estimes, calcules ni deduzcas del relato."},
    {"key":"sintomas_actuales","label":"Síntomas cardiovasculares actuales","order":6,"required":false,
     "instruction":"Angina, disnea, síncope, palpitaciones o edema en las últimas semanas, con su patrón y estabilidad tal como los refirió el paciente. Solo lo referido; no listes negativos que no se preguntaron ni califiques la estabilidad por tu cuenta."},
    {"key":"estudios_y_paraclinicos","label":"Estudios y paraclínicos revisados","order":7,"required":false,
     "instruction":"Electrocardiograma, ecocardiograma con la fracción de eyección dicha, pruebas de isquemia, angiografía y laboratorios revisados: transcribe valores, fechas y conclusiones literal, tal como el médico los leyó. Si un estudio está pendiente o no se aportó, escríbelo así."},
    {"key":"examen_cardiovascular","label":"Examen cardiovascular","order":8,"required":true,
     "instruction":"Presión arterial con las cifras dichas y el brazo y la posición si se enunciaron, frecuencia y ritmo, ingurgitación yugular, auscultación con soplos y ruidos agregados, campos pulmonares, pulsos y edemas. No completes segmentos no examinados."},
    {"key":"riesgo_y_concepto","label":"Riesgo declarado y concepto","order":9,"required":true,
     "instruction":"Riesgo cardiovascular perioperatorio y concepto (apto, apto con condiciones, aplazado u otra fórmula) EXCLUSIVAMENTE tal como los declaró el médico: transcríbelos literal y completos. Nunca calcules un puntaje de riesgo ni emitas el concepto tú. Si no se emitió, indícalo."},
    {"key":"conducta_perioperatoria","label":"Conducta perioperatoria y seguimiento","order":10,"required":true,
     "instruction":"Manejo perioperatorio dictado: qué medicamentos continuar o suspender con el fármaco, la dosis y los días exactos dichos, monitoreo requerido, estudios adicionales previos y remisiones. Transcríbelo literal; una instrucción inventada sobre anticoagulación puede causar un sangrado o una trombosis."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

update public.clinical_templates set
  name = 'Consulta inicial · morfología, distribución y evolución de las lesiones',
  description = 'Primera consulta dermatológica: descripción morfológica de las lesiones, distribución y evolución, tratamientos previos, antecedentes atópicos y de exposición solar, y examen cutáneo. Úsala para el estudio inicial de una dermatosis; para lunares en vigilancia usa la plantilla de lesión pigmentada.',
  sections = '[
    {"key":"motivo_y_evolucion","label":"Motivo de consulta y tiempo de evolución","order":1,"required":true,
     "instruction":"Motivo en las palabras del paciente y desde cuándo tiene las lesiones, con la zona donde aparecieron primero, tal como lo relató. No nombres la dermatosis en esta sección ni traduzcas el relato a un diagnóstico."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":2,"required":true,
     "instruction":"Evolución de las lesiones: forma de aparición, progresión, brotes y remisiones, prurito, dolor, ardor o descamación, factores desencadenantes referidos (sol, cosméticos, medicamentos, estrés, alimentos) y compromiso de uñas, cuero cabelludo o mucosas. Solo lo referido en la consulta."},
    {"key":"tratamientos_previos","label":"Tratamientos previos y respuesta","order":3,"required":false,
     "instruction":"Cremas, ungüentos, jabones, medicamentos sistémicos y remedios caseros usados, con el nombre, el tiempo de uso y la respuesta tal como los enunció el paciente. Transcribe los nombres y concentraciones literal; nunca supongas cuál corticoide o antibiótico usó."},
    {"key":"antecedentes_y_atopia","label":"Antecedentes personales, atopia y familiares","order":4,"required":false,
     "instruction":"Antecedentes de atopia (asma, rinitis, dermatitis), psoriasis, autoinmunidad, inmunosupresión, cáncer de piel y medicamentos actuales con sus dosis, más antecedentes familiares dermatológicos con el parentesco dicho. Si algo no se exploró, indícalo."},
    {"key":"exposicion_y_ocupacion","label":"Exposición solar, ocupacional y cosmética","order":5,"required":false,
     "instruction":"Fototipo si el médico lo enunció, exposición solar y uso de protector solar, quemaduras previas, cámaras de bronceo, ocupación y contacto con químicos, agua o guantes, y productos cosméticos usados. Solo lo mencionado; nunca asignes el fototipo tú."},
    {"key":"examen_dermatologico","label":"Examen dermatológico","order":6,"required":true,
     "instruction":"Describe con vocabulario dermatológico lo que el médico dictó: tipo de lesión elemental (mácula, pápula, placa, vesícula, pústula, nódulo, úlcera), color, bordes, superficie, tamaño con las medidas dichas, número, distribución y topografía, y compromiso de uñas, pelo y mucosas. No completes zonas no examinadas."},
    {"key":"dermatoscopia","label":"Dermatoscopia y pruebas en consulta","order":7,"required":false,
     "instruction":"Hallazgos dermatoscópicos o de pruebas hechas en consulta (luz de Wood, raspado, KOH) EXCLUSIVAMENTE como los describió el médico, con el patrón y las estructuras que nombró. Si no se realizaron, indícalo; nunca interpretes ni infieras un patrón."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":8,"required":true,
     "instruction":"Impresión diagnóstica y diferenciales con la precisión y el grado de certeza con que el médico los formuló. Severidad, extensión o clasificaciones solo si él las enunció; nunca asignes un diagnóstico ni un grado a partir de la descripción."},
    {"key":"plan_y_educacion","label":"Plan, cuidados de la piel y educación","order":9,"required":true,
     "instruction":"Tratamientos tópicos y sistémicos con el nombre, la concentración, la cantidad, la forma de aplicación y la duración transcritos literal; biopsias o cultivos solicitados; cuidados de la piel, jabones y protector solar indicados, con la educación dada. Nunca completes una concentración ni una pauta."},
    {"key":"proximo_control_y_alarmas","label":"Próximo control y signos de alarma","order":10,"required":false,
     "instruction":"Plazo del próximo control, cuándo se entregan los resultados de biopsia o cultivo, remisiones con la razón dicha y los signos por los que debe consultar antes, tal como se explicaron. Solo lo indicado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = 'd0e165ae-8446-59c2-8091-9d3568e5c225' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · respuesta cutánea y tolerancia al tratamiento',
  description = 'Control de una dermatosis en tratamiento: uso real del tópico o del sistémico, evolución de las lesiones, efectos adversos, resultados de biopsia o laboratorio y ajuste del plan. Úsala para el seguimiento de acné, psoriasis, dermatitis, micosis y demás dermatosis ya diagnosticadas.',
  sections = '[
    {"key":"diagnostico_en_seguimiento","label":"Diagnóstico en seguimiento y tratamiento vigente","order":1,"required":true,
     "instruction":"Diagnóstico dermatológico en seguimiento, tiempo de evolución y tratamiento vigente con nombre, concentración y pauta transcritos literal, tal como se enunciaron. No reconstruyas el esquema previo si no se mencionó hoy."},
    {"key":"intervalo_y_adherencia","label":"Intervalo y uso real del tratamiento","order":2,"required":false,
     "instruction":"Tiempo desde el último control y cómo usó realmente el tratamiento: cuántas veces al día, en qué zonas, cuánto duró el frasco, suspensiones y su motivo, y acceso al medicamento por la EPS. Nunca supongas adherencia ni completes la pauta que el paciente no recordó."},
    {"key":"evolucion_de_las_lesiones","label":"Evolución de las lesiones","order":3,"required":false,
     "instruction":"Evolución referida: aparición de lesiones nuevas, mejoría o extensión, prurito, dolor, descamación y el impacto estético o emocional que el paciente expresó. Solo lo relatado; no interpretes tú el porcentaje de mejoría."},
    {"key":"efectos_adversos","label":"Efectos adversos y tolerancia","order":4,"required":false,
     "instruction":"Ardor, irritación, resequedad, atrofia, fotosensibilidad, cambios de pigmentación u otros efectos atribuidos al tratamiento, con su momento de aparición y qué hizo el paciente. Si no se preguntó por efectos adversos, indícalo en vez de escribir que no los hubo."},
    {"key":"resultados_de_estudios","label":"Resultados de biopsia, cultivo o laboratorio","order":5,"required":false,
     "instruction":"Informe de patología, cultivo, KOH o laboratorios de control: transcribe el diagnóstico histopatológico, los márgenes y los valores literal, tal como el médico los leyó. Nunca interpretes ni resumas un informe de patología; si está pendiente, escríbelo así."},
    {"key":"examen_de_control","label":"Examen dermatológico de control","order":6,"required":true,
     "instruction":"Estado actual de las lesiones con la morfología, el número, el tamaño con las medidas dichas y la topografía, además de secuelas (cicatrices, manchas residuales). Compara con el examen previo solo si el médico hizo la comparación; nunca estimes medidas."},
    {"key":"analisis_de_respuesta","label":"Análisis de la respuesta al tratamiento","order":7,"required":true,
     "instruction":"Evaluación de la respuesta y del diagnóstico actualizado EXCLUSIVAMENTE como los enunció el médico, incluidos los puntajes de severidad que él haya dado. Nunca declares control, falla terapéutica ni severidad por tu cuenta."},
    {"key":"ajuste_y_proximo_control","label":"Ajuste del plan y próximo control","order":8,"required":true,
     "instruction":"Cambios del tratamiento con nombre, concentración, cantidad, forma de aplicación y duración transcritos literal, estudios o procedimientos programados, cuidados de la piel y protección solar indicados, con el plazo del próximo control y los signos de alarma explicados."}
  ]'::jsonb,
  updated_at = now()
where id = 'b4d4d12c-49b8-5421-964b-0f66806a9a90' and owner_id is null;

update public.clinical_templates set
  name = 'Procedimiento dermatológico · biopsia, crioterapia y electrocirugía',
  description = 'Procedimientos hechos en el consultorio de dermatología: biopsia, extirpación, crioterapia, electrocoagulación, infiltración o drenaje. Documenta indicación, consentimiento, anestesia, técnica, muestra enviada a patología, tolerancia y cuidados posteriores.',
  sections = '[
    {"key":"indicacion_y_lesion","label":"Procedimiento, lesión intervenida e indicación","order":1,"required":true,
     "instruction":"Procedimiento realizado, indicación enunciada por el médico y lesión intervenida con su localización anatómica exacta, lateralidad y tamaño dicho. La localización debe quedar inequívoca: nunca la deduzcas ni la aproximes si no se dictó."},
    {"key":"consentimiento_informado","label":"Consentimiento informado","order":2,"required":false,
     "instruction":"Explicación del procedimiento, riesgos (cicatriz, discromía, infección, recidiva) y alternativas dadas al paciente, y su aceptación, tal como quedó en la consulta. Si el consentimiento no se mencionó, indícalo; nunca lo des por obtenido."},
    {"key":"verificacion_previa","label":"Verificación previa y antecedentes de riesgo","order":3,"required":false,
     "instruction":"Alergias, incluida la de anestésicos locales, anticoagulación o antiagregación, diabetes, inmunosupresión, marcapasos para electrocirugía y tendencia a queloides, solo si se preguntaron. Registra también la asepsia realizada tal como se describió."},
    {"key":"anestesia","label":"Anestesia empleada","order":4,"required":false,
     "instruction":"Anestésico usado con su concentración, con o sin vasoconstrictor, cantidad infiltrada y técnica (local, troncular), EXCLUSIVAMENTE como el médico los dictó. Nunca completes la concentración ni el volumen que falten."},
    {"key":"tecnica_realizada","label":"Técnica realizada","order":5,"required":true,
     "instruction":"Describe la técnica como la narró el médico: tipo de biopsia (punch con su diámetro, incisional, excisional, afeitado), márgenes tomados, ciclos y tiempo de crioterapia, potencia de electrocirugía, cierre y número y calibre de puntos. Transcribe cifras literal; no agregues pasos no mencionados."},
    {"key":"muestra_a_patologia","label":"Muestra enviada a patología","order":6,"required":true,
     "instruction":"Muestra obtenida, número de frascos, rótulo y orientación, medio de conservación y estudio solicitado, tal como se dictaron. Si el médico indicó que no se envió muestra, consígnalo; nunca supongas el destino ni el resultado de un espécimen."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones inmediatas","order":7,"required":false,
     "instruction":"Tolerancia del paciente, sangrado, dolor, hemostasia lograda y complicaciones inmediatas tal como se describieron, con el estado del sitio al terminar. Si no se habló de complicaciones, escribe que no se consignaron, no que no las hubo."},
    {"key":"cuidados_posteriores","label":"Cuidados posteriores","order":8,"required":true,
     "instruction":"Cuidados de la herida indicados (limpieza, apósitos, cremas con su nombre y frecuencia), analgesia con dosis transcrita literal, restricciones de sol, agua o ejercicio y signos de alarma explicados. No agregues cuidados habituales que el médico no dictó."},
    {"key":"seguimiento_y_resultados","label":"Seguimiento y entrega de resultados","order":9,"required":false,
     "instruction":"Plazo para retiro de puntos y control del sitio, fecha en que se entrega el resultado de patología y cómo se le informará al paciente, y remisiones con la razón dicha. Solo lo indicado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = '1ab8522a-4e8a-5e53-bd92-0998bee674c9' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c1000000-0000-4000-8000-000000000006', null,
   'Seguimiento de lesión pigmentada · dermatoscopia y tamizaje de cáncer de piel',
   'Consulta de vigilancia de lunares y lesiones pigmentadas: cambios referidos por el paciente, factores de riesgo, examen cutáneo completo, descripción y dermatoscopia de la lesión, comparación con el registro fotográfico y conducta. Úsala en el control de nevus y en el tamizaje de cáncer de piel.',
   'dermatologia', 'Dermatología', 'institutional', false, 'active',
   '[
    {"key":"motivo_y_lesion_de_interes","label":"Motivo y lesión de interés","order":1,"required":true,
     "instruction":"Motivo de la consulta y cuál es la lesión que preocupa, con su localización anatómica exacta y lateralidad tal como se dijeron, o si se trata de un control programado de lunares. Nunca deduzcas la localización ni asumas cuál lesión se está vigilando."},
    {"key":"cambios_referidos","label":"Cambios referidos por el paciente","order":2,"required":false,
     "instruction":"Cambios que el paciente reporta y desde cuándo: crecimiento, cambio de color o de bordes, sangrado, prurito, dolor, costra que no cura o aparición reciente. Registra sus palabras y el tiempo que él refirió; no interpretes esos cambios como signos de malignidad."},
    {"key":"factores_de_riesgo","label":"Antecedentes y factores de riesgo","order":3,"required":false,
     "instruction":"Fototipo si el médico lo enunció, quemaduras solares, exposición solar y ocupacional, cámaras de bronceo, número de nevus referido, inmunosupresión, antecedente personal o familiar de melanoma o de cáncer de piel con el parentesco dicho. Nunca asignes el fototipo ni cuentes nevus tú."},
    {"key":"examen_cutaneo_completo","label":"Examen cutáneo completo","order":4,"required":true,
     "instruction":"Alcance real del examen: si se revisó toda la superficie corporal o solo un área, incluidos cuero cabelludo, palmas, plantas, uñas y mucosas si se examinaron, y el número de lesiones sospechosas encontradas. No des por revisadas zonas que no se examinaron."},
    {"key":"descripcion_de_la_lesion","label":"Descripción clínica de la lesión","order":5,"required":true,
     "instruction":"Describe cada lesión de interés como la dictó el médico: tipo, color y policromía, simetría, bordes, superficie, ulceración y diámetro con las medidas exactas dichas. Transcribe las medidas literal; nunca las estimes, redondees ni conviertas."},
    {"key":"hallazgos_dermatoscopicos","label":"Hallazgos dermatoscópicos","order":6,"required":true,
     "instruction":"Hallazgos dermatoscópicos EXCLUSIVAMENTE como el médico los describió: patrón global y estructuras que él nombró (red pigmentada, glóbulos, estrías, velo, estructuras de regresión, patrón vascular). Si no se hizo dermatoscopia, indícalo; nunca infieras ni completes un patrón."},
    {"key":"registro_fotografico","label":"Registro fotográfico y comparación","order":7,"required":false,
     "instruction":"Registro fotográfico o mapeo realizado y la comparación con imágenes previas SOLO si el médico la hizo en la consulta, con lo que él dijo que cambió. Nunca afirmes que una lesión cambió o se mantuvo estable sin que él lo haya enunciado."},
    {"key":"analisis_y_conducta","label":"Análisis y conducta","order":8,"required":true,
     "instruction":"Impresión sobre cada lesión y la conducta decidida (vigilancia, dermatoscopia digital, biopsia o extirpación con el margen dicho) EXCLUSIVAMENTE como el médico las enunció. Nunca califiques una lesión como benigna o sospechosa por tu cuenta: de ese juicio depende una conducta oncológica."},
    {"key":"educacion_y_proximo_control","label":"Educación, fotoprotección y próximo control","order":9,"required":false,
     "instruction":"Educación dada sobre autoexamen de la piel, fotoprotección y signos de alarma, con las palabras del médico, plazo del próximo control o del mapeo, y cuándo se entregan los resultados si se tomó una biopsia. Solo lo indicado en la consulta."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

update public.clinical_templates set
  name = 'Consulta inicial · síntomas metabólicos, hormonales y laboratorios',
  description = 'Primera valoración endocrinológica: síntomas por ejes hormonales, antecedentes personales y familiares, laboratorios previos leídos literalmente y examen dirigido (tiroides, piel, distribución de la grasa). Úsala para el estudio inicial de tiroides, obesidad, diabetes de novo u otro trastorno hormonal.',
  sections = '[
    {"key":"motivo_y_remision","label":"Motivo de consulta y remisión","order":1,"required":true,
     "instruction":"Motivo en las palabras del paciente y quién lo remite con la pregunta concreta o el hallazgo que motivó la remisión (un laboratorio alterado, una imagen), tal como se enunció. No traduzcas el motivo a un diagnóstico endocrino."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":2,"required":true,
     "instruction":"Cronología del cuadro: inicio y evolución de los síntomas, cambios de peso con las cifras y el tiempo dichos, tratamientos recibidos y su respuesta. Transcribe los pesos y fechas literal; nunca calcules la magnitud del cambio ni el índice de masa corporal."},
    {"key":"sintomas_por_ejes","label":"Síntomas por ejes hormonales","order":3,"required":false,
     "instruction":"Síntomas efectivamente interrogados por eje: tiroideo (intolerancia al frío o calor, temblor, palpitaciones, caída del pelo, estreñimiento), suprarrenal, hipofisario (cefalea, cambios visuales, galactorrea), gonadal (ciclos, libido, hirsutismo) y metabólico (poliuria, polidipsia). No listes negativos no preguntados."},
    {"key":"antecedentes","label":"Antecedentes personales y familiares","order":4,"required":false,
     "instruction":"Antecedentes patológicos y quirúrgicos (tiroidectomía, radioyodo, radioterapia de cuello), autoinmunidad, diabetes gestacional, fracturas por fragilidad y antecedentes familiares de enfermedad tiroidea, diabetes o cáncer endocrino con el parentesco dicho. Si no se exploraron, indícalo."},
    {"key":"medicamentos_y_suplementos","label":"Medicamentos, suplementos y hábitos","order":5,"required":false,
     "instruction":"Medicamentos con dosis y horario transcritos literal, en especial levotiroxina, corticoides, hipoglicemiantes, anticonceptivos y suplementos con biotina o yodo, junto con alimentación, actividad física y sueño referidos. Nunca completes una dosis ni un horario que no se dijeron."},
    {"key":"laboratorios_previos","label":"Laboratorios e imágenes previos","order":6,"required":false,
     "instruction":"Perfil tiroideo, glucemia, hemoglobina glicosilada, perfil lipídico, cortisol, prolactina, densitometría, ecografía de tiroides o imágenes traídos por el paciente: transcribe valores, unidades, rangos y fechas literal. Nunca conviertas unidades, interpretes ni completes un resultado."},
    {"key":"examen_fisico_endocrino","label":"Examen físico endocrinológico","order":7,"required":true,
     "instruction":"Signos vitales y antropometría solo con las cifras dichas (nunca calcules IMC ni perímetros), palpación de tiroides con tamaño, consistencia y nódulos descritos, piel y faneras, distribución de la grasa, acantosis, estrías, hirsutismo, temblor y reflejos, y examen de pies si se hizo."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":8,"required":true,
     "instruction":"Impresión diagnóstica y diferenciales con la precisión y el grado de certeza con que el médico los formuló. Clasificaciones, estadios o metas no se agregan si él no las enunció; nunca conviertas un valor de laboratorio en diagnóstico por tu cuenta."},
    {"key":"plan_de_estudio_y_tratamiento","label":"Plan de estudio y tratamiento","order":9,"required":true,
     "instruction":"Laboratorios, imágenes o pruebas dinámicas solicitados con su objetivo dicho, y tratamiento con medicamento, dosis, horario respecto a las comidas y duración transcritos literal, incluidos los fármacos que se suspenden. Nunca titules ni recalcules una dosis hormonal."},
    {"key":"educacion_y_proximo_control","label":"Educación y próximo control","order":10,"required":false,
     "instruction":"Educación dada sobre alimentación, actividad física, toma correcta del medicamento y preparación de los exámenes, con las palabras del médico, remisiones con la razón dicha, plazo del próximo control y con qué resultados debe volver el paciente."}
  ]'::jsonb,
  updated_at = now()
where id = '0225b072-88d8-5ca4-a8a6-32a17de3dc86' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · metas metabólicas y ajuste terapéutico',
  description = 'Control endocrinológico de una condición ya diagnosticada: adherencia y tolerancia, laboratorios de control leídos literalmente, evaluación de las metas que enunció el médico y ajuste del tratamiento. Úsala para controles de tiroides, obesidad, osteoporosis o diabetes sin insulina.',
  sections = '[
    {"key":"diagnosticos_en_seguimiento","label":"Diagnósticos en seguimiento y tratamiento vigente","order":1,"required":true,
     "instruction":"Diagnósticos endocrinos en seguimiento con su tiempo de evolución y el tratamiento vigente con dosis y horario transcritos literal, más el motivo puntual del control. No reconstruyas esquemas previos que no se mencionaron hoy."},
    {"key":"intervalo_y_adherencia","label":"Intervalo y adherencia","order":2,"required":false,
     "instruction":"Tiempo desde el último control, adherencia real (olvidos, suspensiones y su motivo, toma en ayunas o con alimentos) y entrega del medicamento por la EPS. Transcribe las dosis dichas literal; no supongas cumplimiento ni completes el esquema."},
    {"key":"evolucion_de_sintomas","label":"Evolución de síntomas y peso","order":3,"required":false,
     "instruction":"Evolución de los síntomas del eje comprometido y cambios de peso con las cifras y el tiempo dichos, junto con alimentación, actividad física y sueño referidos. Transcribe los pesos literal; nunca calcules la diferencia ni el porcentaje de cambio."},
    {"key":"efectos_adversos","label":"Efectos adversos y tolerancia","order":4,"required":false,
     "instruction":"Efectos atribuidos al tratamiento (palpitaciones, temblor, insomnio, síntomas digestivos, mialgias, hipoglucemias) con su momento de aparición y qué hizo el paciente. Si no se preguntó por efectos adversos, indícalo en vez de escribir que no los hubo."},
    {"key":"laboratorios_de_control","label":"Laboratorios de control","order":5,"required":false,
     "instruction":"Resultados traídos al control (TSH, T4 libre, hemoglobina glicosilada, glucemia, perfil lipídico, calcio, vitamina D, densitometría): transcribe valores, unidades, rangos y fechas literal, tal como el médico los leyó. Nunca conviertas unidades ni interpretes un valor por tu cuenta."},
    {"key":"examen_de_control","label":"Examen físico de control","order":6,"required":true,
     "instruction":"Signos vitales y peso con las cifras dichas, palpación de tiroides con los cambios descritos, piel y faneras, temblor, reflejos y examen dirigido a la condición en seguimiento. Compara con hallazgos previos solo si el médico hizo la comparación; nunca calcules antropometría."},
    {"key":"analisis_y_metas","label":"Análisis del control y metas","order":7,"required":true,
     "instruction":"Estado de control y cumplimiento de las metas EXCLUSIVAMENTE como las enunció el médico (metas de TSH, de hemoglobina glicosilada, de peso o de densidad ósea). Nunca fijes una meta ni declares control o descompensación a partir de los valores por tu cuenta."},
    {"key":"ajuste_terapeutico","label":"Ajuste terapéutico","order":8,"required":true,
     "instruction":"Medicamentos que se inician, titulan, continúan o suspenden con dosis, presentación, horario y duración transcritos literal, y los laboratorios o imágenes solicitados con su objetivo dicho. Nunca calcules una titulación hormonal ni ajustes una dosis por tu cuenta."},
    {"key":"proximo_control_y_educacion","label":"Educación y próximo control","order":9,"required":false,
     "instruction":"Educación dada sobre alimentación, actividad física, toma del medicamento y preparación de los exámenes, remisiones con la razón dicha, plazo del próximo control, con qué resultados debe volver y los signos de alarma explicados."}
  ]'::jsonb,
  updated_at = now()
where id = '6c78da61-eeaf-5368-8d59-e5752a963659' and owner_id is null;

update public.clinical_templates set
  name = 'Valoración endocrinológica · pruebas dinámicas y estudio dirigido',
  description = 'Cita centrada en un estudio endocrinológico: prueba dinámica de supresión o estimulación, curva de tolerancia, punción de tiroides o ecografía en consulta. Documenta indicación, preparación, protocolo, resultados literales y su impacto en la conducta.',
  sections = '[
    {"key":"indicacion_del_estudio","label":"Estudio realizado e indicación","order":1,"required":true,
     "instruction":"Prueba o procedimiento realizado y su indicación tal como la enunció el médico, con la pregunta clínica que se busca responder. No deduzcas la indicación a partir del diagnóstico ni amplíes el alcance del estudio."},
    {"key":"consentimiento_y_riesgos","label":"Consentimiento y verificación previa","order":2,"required":false,
     "instruction":"Explicación de la prueba, riesgos y aceptación del paciente, y verificación previa (embarazo, alergias, anticoagulación, contraindicaciones) tal como quedó en la consulta. Si el consentimiento no se mencionó, indícalo; nunca lo des por obtenido."},
    {"key":"preparacion_y_condiciones","label":"Preparación y condiciones del estudio","order":3,"required":false,
     "instruction":"Preparación cumplida: ayuno, medicamentos o suplementos suspendidos con el nombre y el tiempo dichos (biotina, levotiroxina, corticoides), hora de inicio y condiciones basales. Solo lo consignado; nunca supongas que la preparación fue correcta."},
    {"key":"protocolo_y_tecnica","label":"Protocolo y técnica","order":4,"required":false,
     "instruction":"Protocolo o técnica empleada tal como se narró: sustancia administrada con su dosis, tiempos de las tomas, número de punciones o pases y guía ecográfica, con las cifras dictadas. Transcríbelas literal; no agregues pasos estándar que no se mencionaron."},
    {"key":"resultados_del_estudio","label":"Resultados y hallazgos","order":5,"required":true,
     "instruction":"Resultados EXCLUSIVAMENTE como el médico los dictó: valores en cada tiempo con sus unidades, características ecográficas del nódulo con sus medidas y patrón, o material obtenido en la punción. Transcribe cada cifra literal; nunca la calcules, conviertas ni normalices."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones","order":6,"required":false,
     "instruction":"Síntomas durante la prueba, hipoglucemia u otros eventos, y complicaciones inmediatas del procedimiento tal como se describieron, con el estado en que quedó el paciente. Si no se habló de complicaciones, escribe que no se consignaron, no que no las hubo."},
    {"key":"interpretacion_y_conducta","label":"Interpretación y conducta","order":7,"required":true,
     "instruction":"Interpretación del estudio y la conducta derivada EXCLUSIVAMENTE con las palabras del médico, incluidas las limitaciones que él reconoció. Nunca declares una prueba positiva, negativa o no concluyente si él no lo enunció."},
    {"key":"recomendaciones_y_seguimiento","label":"Recomendaciones y seguimiento","order":8,"required":true,
     "instruction":"Reinicio de los medicamentos suspendidos con la dosis y el momento dichos, estudios adicionales o remisiones solicitados, cuándo se entregan los resultados pendientes y el plazo del próximo control, con los signos de alarma explicados."}
  ]'::jsonb,
  updated_at = now()
where id = '8fbdf80e-397f-5ad6-8f5a-9b674ec43653' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c1000000-0000-4000-8000-000000000007', null,
   'Control de diabetes con insulina · automonitoreo, hipoglucemias y titulación',
   'Control del paciente diabético en tratamiento con insulina: esquema y técnica de aplicación, glucometrías y patrón de las cifras, hipoglucemias, laboratorios, tamizaje de complicaciones y titulación de la dosis transcrita literalmente. Úsala en los controles de insulinoterapia.',
   'endocrinologia', 'Endocrinología', 'institutional', false, 'active',
   '[
    {"key":"diagnostico_y_tiempo","label":"Diagnóstico, tiempo de evolución y motivo del control","order":1,"required":true,
     "instruction":"Tipo de diabetes y tiempo de evolución tal como se enunciaron, tiempo con insulina y el motivo puntual de este control. No agregues complicaciones ni diagnósticos que el médico no haya mencionado hoy."},
    {"key":"esquema_de_insulina","label":"Esquema de insulina y demás medicamentos","order":2,"required":true,
     "instruction":"Esquema completo con el tipo de insulina, las unidades por aplicación, los horarios y la relación con las comidas, más los demás antidiabéticos con sus dosis, TODO transcrito literal. Nunca completes unidades faltantes, ni conviertas, ni sumes dosis: una cifra inventada causa una hipoglucemia grave."},
    {"key":"tecnica_y_adherencia","label":"Técnica de aplicación y adherencia","order":3,"required":false,
     "instruction":"Cómo aplica la insulina según lo relató: sitios de aplicación y rotación, tipo de aguja y su reutilización, conservación del frasco o lapicero, olvidos de dosis y acceso al insumo por la EPS. Solo lo referido; no supongas que la técnica es correcta."},
    {"key":"glucometrias","label":"Glucometrías y patrón de las cifras","order":4,"required":true,
     "instruction":"Glucometrías del paciente con sus valores, fechas y momentos (ayunas, preprandial, posprandial, madrugada) o los datos del monitoreo continuo que el médico haya leído. Transcríbelos literal, sin promediar, redondear ni convertir unidades. Si no trae registro, escríbelo así."},
    {"key":"hipoglucemias","label":"Hipoglucemias","order":5,"required":false,
     "instruction":"Episodios de hipoglucemia con su frecuencia, horario, cifras dichas, síntomas, si hubo pérdida de la percepción de los avisos, necesidad de ayuda de otra persona y cómo los resolvió. Transcribe las cifras literal; si no se preguntó por hipoglucemias, indícalo."},
    {"key":"alimentacion_y_actividad","label":"Alimentación, actividad física y conteo","order":6,"required":false,
     "instruction":"Horarios y contenido de las comidas, omisión de tiempos de comida, conteo de carbohidratos si lo usa, actividad física y consumo de alcohol, tal como los describió el paciente. No juzgues la dieta ni calcules raciones."},
    {"key":"laboratorios","label":"Laboratorios de control","order":7,"required":false,
     "instruction":"Hemoglobina glicosilada, glucemia, creatinina, relación albuminuria-creatinuria, perfil lipídico y potasio traídos al control: transcribe valores, unidades y fechas literal, tal como el médico los leyó. Nunca conviertas unidades ni estimes una glicosilada a partir de las glucometrías."},
    {"key":"tamizaje_de_complicaciones","label":"Tamizaje de complicaciones","order":8,"required":false,
     "instruction":"Estado de los tamizajes que el médico mencione (fondo de ojo, examen de pies con sensibilidad, función renal, valoración cardiovascular): hechos con su fecha y resultado dichos, pendientes o solicitados hoy. No propongas tamizajes ni periodicidades por tu cuenta."},
    {"key":"examen_fisico","label":"Examen físico dirigido","order":9,"required":true,
     "instruction":"Signos vitales y peso con las cifras dichas, revisión de los sitios de aplicación en busca de lipohipertrofia, examen de pies con pulsos, piel, uñas y sensibilidad si se evaluaron, y demás hallazgos descritos. No completes lo que no se examinó."},
    {"key":"analisis_y_metas","label":"Análisis del control y metas","order":10,"required":true,
     "instruction":"Estado del control glicémico, patrón identificado y metas EXCLUSIVAMENTE como los enunció el médico. Nunca fijes una meta de glicosilada ni concluyas por tu cuenta que hay hiperglucemia de ayuno, efecto del alba o mal control a partir de las cifras."},
    {"key":"titulacion_y_ajuste","label":"Titulación del esquema y ajuste del plan","order":11,"required":true,
     "instruction":"Nuevo esquema con el tipo de insulina, las unidades exactas, los horarios y la fecha de inicio, más los cambios en los demás medicamentos, TODO transcrito literal. Nunca calcules una titulación, un factor de corrección ni una dosis total: transcribe solo lo que el médico dictó."},
    {"key":"educacion_y_proximo_control","label":"Educación y próximo control","order":12,"required":false,
     "instruction":"Educación dada sobre manejo de hipoglucemias, días de enfermedad, técnica y rotación de sitios, conservación de la insulina y ejercicio, con las palabras del médico, plazo del próximo control, con qué resultados debe volver y los signos de alarma explicados."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

update public.clinical_templates set
  name = 'Consulta inicial · síntomas digestivos, dieta y estudios previos',
  description = 'Primera valoración por gastroenterología: caracterización del síntoma digestivo, hábito intestinal, signos de alarma, dieta, medicamentos gastrolesivos y estudios previos. Úsala cuando el paciente consulta o es remitido por dolor abdominal, reflujo, diarrea, estreñimiento o sangrado.',
  sections = '[
    {"key":"motivo_y_remision","label":"Motivo de consulta y remisión","order":1,"required":true,
     "instruction":"Motivo en las palabras del paciente y quién lo remite con la pregunta o el hallazgo que motivó la remisión, tal como se enunció. No traduzcas el síntoma a un diagnóstico digestivo."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":2,"required":true,
     "instruction":"Caracteriza el síntoma como se relató: dolor con localización, irradiación, carácter y relación con las comidas; pirosis y regurgitación; náuseas y vómito; disfagia y su tipo; distensión y saciedad temprana, con la cronología y los tratamientos ya recibidos. Solo lo referido."},
    {"key":"habito_intestinal","label":"Hábito intestinal y características de las deposiciones","order":3,"required":false,
     "instruction":"Frecuencia y consistencia de las deposiciones, esfuerzo, urgencia, moco, sangre visible, melenas, incontinencia y cambios recientes, tal como los describió el paciente. Registra la escala de Bristol solo si el médico la nombró; nunca clasifiques tú las heces."},
    {"key":"signos_de_alarma","label":"Signos de alarma digestivos","order":4,"required":false,
     "instruction":"Signos de alarma efectivamente interrogados: pérdida de peso con las cifras dichas, disfagia progresiva, sangrado, anemia, vómito persistente, masa abdominal, fiebre y despertar nocturno por el síntoma. No listes negativos que no se preguntaron ni concluyas que no hay alarma."},
    {"key":"dieta_y_habitos","label":"Dieta, alcohol y hábitos","order":5,"required":false,
     "instruction":"Dieta habitual, horarios de comida, alimentos que desencadenan el síntoma según el paciente, café, picante, lactosa y gluten, consumo de alcohol y tabaco con la cantidad referida, y actividad física. Solo lo relatado; no atribuyas el síntoma a un alimento."},
    {"key":"antecedentes_y_medicamentos","label":"Antecedentes, medicamentos y familiares","order":6,"required":false,
     "instruction":"Cirugías abdominales, hepatitis, transfusiones, enfermedad ácido-péptica, erradicación de Helicobacter pylori, medicamentos gastrolesivos (antiinflamatorios, aspirina, anticoagulantes, hierro) con sus dosis, y antecedentes familiares de cáncer digestivo o enfermedad inflamatoria con el parentesco dicho."},
    {"key":"estudios_previos","label":"Estudios y paraclínicos previos","order":7,"required":false,
     "instruction":"Endoscopias, colonoscopias, ecografías, tomografías, biopsias y laboratorios traídos por el paciente: transcribe hallazgos, diagnósticos histopatológicos, valores y fechas literal, tal como el médico los leyó. Nunca interpretes ni completes un informe que no se leyó en la consulta."},
    {"key":"examen_fisico","label":"Examen físico abdominal","order":8,"required":true,
     "instruction":"Estado general, signos vitales y peso con las cifras dichas, ictericia, palidez, estigmas de hepatopatía, inspección y auscultación del abdomen, palpación con dolor y su localización, masas, visceromegalias, ascitis y tacto rectal si se realizó. No completes lo no examinado."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":9,"required":true,
     "instruction":"Impresión diagnóstica y diferenciales con la precisión y el grado de certeza con que el médico los formuló. Clasificaciones, escalas o estadios solo si él los enunció; nunca los apliques ni los deduzcas de los hallazgos."},
    {"key":"plan_y_proximo_control","label":"Plan, estudios y próximo control","order":10,"required":true,
     "instruction":"Estudios solicitados con su objetivo y preparación dichos, tratamiento con medicamento, dosis, horario respecto a las comidas y duración transcritos literal, recomendaciones dietarias tal como se dictaron, remisiones, plazo del próximo control y signos de alarma explicados."}
  ]'::jsonb,
  updated_at = now()
where id = '70d97323-42a7-5373-92c1-a9833760d14e' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · síntomas, nutrición y resultados de estudios',
  description = 'Control de un paciente digestivo ya valorado: evolución de los síntomas, adherencia y tolerancia, estado nutricional y peso, resultados nuevos y ajuste del plan. Úsala para el seguimiento de reflujo, enfermedad inflamatoria, hígado graso, cirrosis o síndrome de intestino irritable.',
  sections = '[
    {"key":"diagnosticos_en_seguimiento","label":"Diagnósticos en seguimiento y tratamiento vigente","order":1,"required":true,
     "instruction":"Diagnósticos digestivos activos con su tiempo de evolución y el tratamiento vigente con dosis y horario transcritos literal, más el motivo puntual del control. No reconstruyas la historia previa que no se mencionó hoy."},
    {"key":"intervalo_y_adherencia","label":"Intervalo y adherencia","order":2,"required":false,
     "instruction":"Tiempo desde el último control, adherencia real al tratamiento y a las medidas dietarias, suspensiones con su motivo y entrega del medicamento por la EPS. Transcribe dosis y horarios literal; no supongas cumplimiento ni completes el esquema."},
    {"key":"evolucion_de_sintomas","label":"Evolución de los síntomas","order":3,"required":false,
     "instruction":"Evolución del dolor, la pirosis, el hábito intestinal, el sangrado o la distensión desde el último control, con la frecuencia y el impacto en la vida diaria que refirió el paciente. Solo lo relatado; no interpretes tú la respuesta al tratamiento."},
    {"key":"nutricion_y_peso","label":"Estado nutricional y peso","order":4,"required":false,
     "instruction":"Peso actual y previo con las cifras y fechas dichas, apetito, tolerancia a los alimentos, restricciones que mantiene y uso de suplementos nutricionales. Transcribe los pesos literal; nunca calcules la pérdida, el porcentaje ni el índice de masa corporal."},
    {"key":"efectos_adversos","label":"Efectos adversos y tolerancia","order":5,"required":false,
     "instruction":"Efectos atribuidos al tratamiento (diarrea, estreñimiento, náuseas, cefalea, síntomas de inmunosupresión) con su momento de aparición y qué hizo el paciente. Si no se preguntó por efectos adversos, indícalo en vez de escribir que no los hubo."},
    {"key":"resultados_nuevos","label":"Resultados de estudios y laboratorios","order":6,"required":false,
     "instruction":"Endoscopias, imágenes, biopsias, calprotectina o laboratorios traídos al control: transcribe hallazgos, diagnósticos histopatológicos, valores, unidades y fechas literal, tal como el médico los leyó. Nunca interpretes un informe de patología ni completes resultados pendientes."},
    {"key":"examen_de_control","label":"Examen físico de control","order":7,"required":true,
     "instruction":"Signos vitales y peso con las cifras dichas, palidez o ictericia, abdomen con dolor, masas, visceromegalias o ascitis, edemas y tacto rectal si se realizó. Compara con hallazgos previos solo si el médico hizo la comparación; no completes lo no examinado."},
    {"key":"analisis_de_evolucion","label":"Análisis de la evolución y metas","order":8,"required":true,
     "instruction":"Evaluación de la respuesta y de las metas EXCLUSIVAMENTE como las enunció el médico (remisión clínica, cicatrización, control de síntomas o metas de peso). Nunca declares remisión, actividad de la enfermedad ni falla terapéutica por tu cuenta."},
    {"key":"ajuste_y_proximo_control","label":"Ajuste del plan y próximo control","order":9,"required":true,
     "instruction":"Cambios de tratamiento con medicamento, dosis, horario y duración transcritos literal, estudios o procedimientos programados con su preparación, recomendaciones dietarias dictadas, remisiones, plazo del próximo control y signos de alarma explicados."}
  ]'::jsonb,
  updated_at = now()
where id = '196322d6-0d07-5451-82d4-876559f6aed0' and owner_id is null;

update public.clinical_templates set
  name = 'Procedimiento endoscópico · endoscopia o colonoscopia con hallazgos',
  description = 'Informe de un procedimiento endoscópico realizado por el gastroenterólogo: indicación, consentimiento, preparación y sedación, técnica y extensión alcanzada, hallazgos por segmentos, biopsias o terapéutica, tolerancia e indicaciones posteriores.',
  sections = '[
    {"key":"indicacion_del_procedimiento","label":"Procedimiento realizado e indicación","order":1,"required":true,
     "instruction":"Procedimiento realizado (endoscopia de vías digestivas altas, colonoscopia, rectosigmoidoscopia u otro) y su indicación tal como la enunció el médico, con la pregunta clínica que se busca responder. No deduzcas la indicación del diagnóstico previo."},
    {"key":"consentimiento_informado","label":"Consentimiento informado","order":2,"required":false,
     "instruction":"Explicación del procedimiento, riesgos (sangrado, perforación, riesgos de la sedación) y alternativas dadas al paciente, y su aceptación, tal como quedó registrado. Si el consentimiento no se mencionó, indícalo; nunca lo des por obtenido."},
    {"key":"preparacion_y_sedacion","label":"Preparación, ayuno y sedación","order":3,"required":false,
     "instruction":"Calidad de la preparación tal como la calificó el médico, ayuno cumplido, medicamentos suspendidos (anticoagulantes, antiagregantes) con el tiempo dicho, tipo de sedación y quién la administró, con los fármacos y dosis dictados. Nunca completes dosis ni califiques tú la preparación."},
    {"key":"tecnica_y_extension","label":"Técnica y extensión alcanzada","order":4,"required":false,
     "instruction":"Equipo utilizado, vía de ingreso, hasta dónde se avanzó (segundo duodeno, ciego con identificación de sus reparos, íleon terminal), tiempo de retiro y dificultades técnicas, tal como se dictaron. Si el examen fue incompleto, consigna la razón dicha; nunca supongas la extensión."},
    {"key":"hallazgos_por_segmentos","label":"Hallazgos por segmentos","order":5,"required":true,
     "instruction":"Hallazgos segmento por segmento EXCLUSIVAMENTE como el médico los dictó: mucosa, erosiones, úlceras, várices, pólipos con su número, tamaño en milímetros, localización y morfología, y masas o estenosis. Transcribe cada medida y clasificación literal; nunca las estimes ni las asignes tú."},
    {"key":"biopsias_y_terapeutica","label":"Biopsias, polipectomía y terapéutica","order":6,"required":true,
     "instruction":"Biopsias tomadas con su número, sitio y frasco, polipectomías con la técnica y si la resección fue completa, hemostasia, dilatación o ligadura, tal como se dictaron. Registra el estudio solicitado a patología; nunca supongas el destino ni el resultado de una muestra."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones inmediatas","order":7,"required":false,
     "instruction":"Tolerancia del paciente, comportamiento de los signos vitales y la saturación si se mencionaron, sangrado u otras complicaciones inmediatas y el estado en que quedó al terminar. Si no se habló de complicaciones, escribe que no se consignaron, no que no las hubo."},
    {"key":"conclusion_endoscopica","label":"Conclusión endoscópica","order":8,"required":true,
     "instruction":"Conclusión del procedimiento con las palabras del médico y las clasificaciones que él enunció. Nunca emitas un diagnóstico endoscópico, un grado ni una clasificación que no se haya dictado: este informe define la conducta y el intervalo de vigilancia."},
    {"key":"indicaciones_y_seguimiento","label":"Indicaciones posteriores y seguimiento","order":9,"required":true,
     "instruction":"Indicaciones al salir: dieta, reinicio de medicamentos con la dosis y el momento dichos, restricciones y signos de alarma explicados, además de cuándo se entrega el resultado de patología y el plazo del control o de la próxima vigilancia, solo como se dictaron."}
  ]'::jsonb,
  updated_at = now()
where id = '55d8e1a8-136f-5300-9182-5781d1a8016a' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c1000000-0000-4000-8000-000000000008', null,
   'Consulta de resultados · informe de endoscopia, biopsia y conducta',
   'Cita dedicada a entregar y explicar resultados: informe endoscópico y de patología transcritos literalmente, correlación con los síntomas, conducta decidida, tratamiento y plan de vigilancia. Úsala cuando el paciente vuelve solo a que le expliquen sus estudios.',
   'gastroenterologia', 'Gastroenterología', 'institutional', false, 'active',
   '[
    {"key":"motivo_de_la_consulta","label":"Motivo de la consulta y estudios que trae","order":1,"required":true,
     "instruction":"Consigna que la cita es para entrega de resultados y cuáles estudios trae el paciente, con la fecha y la institución donde se realizaron, tal como se dijeron. Si falta algún resultado esperado, indícalo; no supongas cuáles exámenes se hicieron."},
    {"key":"sintomas_desde_el_estudio","label":"Síntomas desde el estudio","order":2,"required":false,
     "instruction":"Evolución de los síntomas desde que se realizó el estudio, tolerancia al procedimiento, complicaciones tardías referidas (dolor, sangrado, fiebre) y tratamiento que ha tomado en el intervalo. Solo lo relatado por el paciente."},
    {"key":"informe_endoscopico","label":"Informe endoscópico o de imagen","order":3,"required":true,
     "instruction":"Transcribe el informe tal como el médico lo leyó en voz alta: extensión del examen, hallazgos por segmentos, número, tamaño y localización de las lesiones y la conclusión del endoscopista, literal. Nunca resumas, completes ni reinterpretes un informe que no se leyó."},
    {"key":"informe_de_patologia","label":"Informe de patología","order":4,"required":true,
     "instruction":"Transcribe el diagnóstico histopatológico EXACTAMENTE como fue leído: tipo de lesión, displasia y su grado, márgenes, Helicobacter pylori, atrofia o metaplasia e inmunohistoquímica. Nunca traduzcas, gradúes ni concluyas malignidad por tu cuenta; si está pendiente, escríbelo así."},
    {"key":"laboratorios_complementarios","label":"Laboratorios complementarios","order":5,"required":false,
     "instruction":"Laboratorios revisados en esta cita (hemograma, hierro, pruebas hepáticas, calprotectina, serologías) con valores, unidades y fechas transcritos literal. Nunca conviertas unidades ni interpretes un valor que no se comentó."},
    {"key":"correlacion_y_diagnostico","label":"Correlación clínica y diagnóstico","order":6,"required":true,
     "instruction":"Correlación entre los síntomas y los resultados y el diagnóstico final EXCLUSIVAMENTE como los enunció el médico, incluidas las dudas o los estudios que él considera insuficientes. Nunca establezcas la correlación ni el diagnóstico por tu cuenta."},
    {"key":"explicacion_al_paciente","label":"Explicación dada al paciente","order":7,"required":false,
     "instruction":"Cómo le explicó el médico el resultado al paciente y a su familia, qué preguntas hizo y qué preocupaciones expresó, con sus palabras. Registra el pronóstico solo si el médico lo enunció; nunca lo formules ni lo suavices tú."},
    {"key":"conducta_y_tratamiento","label":"Conducta y tratamiento","order":8,"required":true,
     "instruction":"Conducta decidida y tratamiento con medicamento, dosis, horario respecto a las comidas y duración transcritos literal, incluidos los esquemas de erradicación, y las recomendaciones dietarias dictadas. Nunca completes un esquema ni recalcules una dosis."},
    {"key":"vigilancia_y_remisiones","label":"Plan de vigilancia, remisiones y próximo control","order":9,"required":true,
     "instruction":"Intervalo de vigilancia o de repetición del estudio EXCLUSIVAMENTE con el plazo que dijo el médico, nuevos estudios solicitados, remisiones (cirugía, oncología, nutrición) con la razón dicha, próximo control y signos de alarma explicados. Nunca fijes tú un intervalo de seguimiento."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();
