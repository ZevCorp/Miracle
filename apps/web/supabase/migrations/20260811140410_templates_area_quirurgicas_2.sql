-- Por qué: renovación del catálogo de plantillas — lote del área 4, segundo grupo de
-- especialidades quirúrgicas (coloproctología, ortopedia, oftalmología, otorrinolaringología,
-- urología y cirugía oral y maxilofacial). Las 18 plantillas de fábrica de estas seis salían
-- del generador genérico: pedían "examen físico" y "plan" sin nombrar nunca la semiología que
-- define cada consulta (anoscopia y tacto rectal, arcos de movimiento y estado neurovascular,
-- agudeza visual y presión intraocular, otoscopia y audiometría, PSA y tacto prostático,
-- apertura oral y oclusión). Se reescriben las 3 de fábrica por especialidad y se agrega una
-- 4ª nueva por cada una. Las cifras que aquí se documentan (grados, milímetros, mmHg, dB, PSA,
-- días de incapacidad) son justo donde una alucinación hace daño: toda instruction las pide
-- transcritas literal, nunca calculadas ni asignadas por la IA.
--
-- coloproctologia: "Consulta inicial · hábito intestinal y síntomas anorrectales", "Control y
--   seguimiento · síntomas anorrectales, continencia y cicatrización", "Valoración
--   coloproctológica · procedimiento anorrectal en consultorio", 4ª: "Patología anal benigna ·
--   hemorroides, fisura y fístula con anoscopia" — es el motivo de consulta más frecuente de
--   la especialidad y el que exige dejar por escrito la anoscopia y el grado tal como se dictó.
-- ortopedia: "Consulta inicial · dolor osteomuscular, mecanismo de lesión e imágenes",
--   "Control y seguimiento · consolidación, dolor y rehabilitación", "Valoración ortopédica ·
--   procedimiento en consultorio e infiltración", 4ª: "Fractura y trauma agudo · manejo inicial
--   e inmovilización" — encargo fijado: es la atención de mayor riesgo documental (estado
--   neurovascular y síndrome compartimental) y la que más termina en revisión médico-legal.
-- oftalmologia: "Consulta inicial · agudeza visual, síntomas oculares y fondo de ojo",
--   "Control y seguimiento · visión, presión intraocular y adherencia al colirio", "Valoración
--   oftalmológica · procedimiento en consultorio y láser", 4ª: "Urgencia ocular · ojo rojo,
--   trauma y pérdida súbita de visión" — es el escenario de mayor valor documental no cubierto:
--   la agudeza visual del primer contacto y la hora de la conducta definen el pronóstico visual.
-- otorrinolaringologia: "Consulta inicial · síntomas de oído, nariz y garganta", "Control y
--   seguimiento · síntomas, audición y respuesta al tratamiento", "Valoración
--   otorrinolaringológica · procedimiento en consultorio", 4ª: "Valoración de hipoacusia ·
--   otoscopia, audiometría e impedanciometría" — es la consulta más frecuente y la que soporta
--   trámites ante EPS y ARL: los umbrales por frecuencia deben quedar literales.
-- urologia: "Consulta inicial · síntomas urinarios, función sexual y estudios", "Control y
--   seguimiento · síntomas urinarios, PSA y función renal", "Valoración urológica ·
--   procedimiento en consultorio y cateterismo", 4ª: "Valoración prostática · síntomas
--   urinarios bajos, tacto rectal y PSA" — es la cita más frecuente del varón adulto y el PSA
--   es el dato donde una cifra inventada cambia una decisión de biopsia.
-- cirugia_maxilofacial: "Consulta inicial · dolor facial, oclusión y estudio imagenológico",
--   "Control y seguimiento · cicatrización, apertura oral y dolor", "Valoración maxilofacial ·
--   procedimiento quirúrgico en consultorio", 4ª: "Trauma facial · fracturas, oclusión y manejo
--   inicial" — es la urgencia propia de la especialidad y la de mayor exposición médico-legal.

update public.clinical_templates set
  name = 'Consulta inicial · hábito intestinal y síntomas anorrectales',
  description = 'Primera consulta de coloproctología: hábito intestinal, síntomas anorrectales con su cronología, examen anorrectal completo con anoscopia y estudios previos transcritos. Úsala cuando el paciente llega remitido o consulta por primera vez por sangrado, dolor anal, masa, prurito o cambio del hábito intestinal.',
  sections = '[
    {"key":"motivo_de_consulta","label":"Motivo de consulta","order":1,"required":true,
     "instruction":"Documenta el motivo en las palabras del paciente (sangrado al limpiarse, dolor al obrar, masa que sale, escape de materia) sin traducirlo a un diagnóstico. Registra quién lo remite y el tiempo de evolución solo si se mencionaron."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":2,"required":true,
     "instruction":"Cronología del cuadro: inicio, evolución, sangrado (color, cantidad, relación con la deposición), dolor y su duración tras obrar, prolapso y si reduce, secreción, prurito y tratamientos ya usados con su respuesta. Solo lo referido por el paciente; no completes síntomas que no se preguntaron."},
    {"key":"habito_intestinal","label":"Hábito intestinal y esfuerzo defecatorio","order":3,"required":false,
     "instruction":"Frecuencia y consistencia de las deposiciones, esfuerzo, sensación de evacuación incompleta, tiempo en el sanitario, uso de laxantes y aporte de fibra y líquidos, tal como los describió el paciente. La escala de Bristol se consigna solo si el médico la enunció; nunca la asignes tú."},
    {"key":"antecedentes_coloproctologicos","label":"Antecedentes coloproctológicos","order":4,"required":false,
     "instruction":"Cirugías anorrectales previas, hemorroidectomía, fisurectomía, drenajes, enfermedad inflamatoria intestinal, radioterapia pélvica, partos y desgarros, y antecedente familiar de cáncer colorrectal o pólipos. Incluye tamizaciones previas con su fecha solo si se mencionó; si no se exploraron, indícalo."},
    {"key":"sintomas_de_alarma","label":"Síntomas de alarma referidos","order":5,"required":false,
     "instruction":"Pérdida de peso, cambio del calibre de la deposición, sangrado mezclado con la materia, anemia referida, masa palpable o antecedente familiar cercano, solo si se preguntaron en la consulta. No listes como negativos los síntomas que nadie exploró."},
    {"key":"examen_anorrectal","label":"Examen anorrectal","order":6,"required":true,
     "instruction":"Inspección perianal (fisura, plicomas, orificios fistulosos, mamelones, dermatitis) con la localización horaria tal como se dictó, tacto rectal con tono esfinteriano, dolor y masas, y anoscopia con sus hallazgos. Registra la posición del examen si se dijo; no completes lo que no se examinó."},
    {"key":"estudios_previos","label":"Estudios previos aportados","order":7,"required":false,
     "instruction":"Colonoscopia, rectosigmoidoscopia, biopsias, manometría, ecografía endoanal o resonancia aportadas: transcribe hallazgos, distancias y conclusiones literal, tal como el médico los leyó en consulta, con su fecha. Si un estudio no se aportó o está pendiente, escríbelo así."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":8,"required":true,
     "instruction":"Razonamiento clínico y diagnósticos con la precisión con que el médico los formuló. El grado hemorroidal, la clasificación de una fístula o la cronicidad de una fisura se consignan solo si él las enunció; nunca las gradúes tú. Deja explícitos los diferenciales que consideró."},
    {"key":"plan_y_educacion","label":"Plan, estudios y educación","order":9,"required":true,
     "instruction":"Medidas higiénico-dietarias, tópicos y medicamentos con la dosis dicha, estudios solicitados, programación de procedimiento o cirugía, remisión a otra especialidad e incapacidad con los días exactos solo si se otorgó. Transcribe todo literal; no agregues indicaciones habituales que no se dictaron."},
    {"key":"proximo_control_y_signos_de_alarma","label":"Próximo control y signos de alarma","order":10,"required":false,
     "instruction":"Cuándo vuelve a control y con qué resultados, y los signos por los que debe consultar antes según se le explicaron (sangrado abundante, fiebre, dolor incontrolable, retención urinaria, imposibilidad de obrar). Solo lo hablado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = 'ff031514-b83d-5475-bc96-01b721496870' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · síntomas anorrectales, continencia y cicatrización',
  description = 'Seguimiento coloproctológico: evolución del sangrado y del dolor, continencia, cicatrización de la herida anorrectal en el posoperatorio y resultados nuevos transcritos. Úsala para controles de patología anal en manejo médico y para el seguimiento posterior a cirugía o a procedimiento en consultorio.',
  sections = '[
    {"key":"diagnosticos_activos","label":"Diagnósticos activos y antecedente quirúrgico","order":1,"required":true,
     "instruction":"Diagnósticos activos con su tiempo de evolución y, si aplica, el procedimiento o cirugía previa con su fecha tal como se mencionó. No reconstruyas de memoria la técnica realizada: consigna solo lo que el médico citó en esta consulta."},
    {"key":"intervalo_y_adherencia","label":"Intervalo desde el último control y adherencia","order":2,"required":false,
     "instruction":"Tiempo desde el último control y adherencia a lo indicado: baños de asiento, fibra y líquidos, tópicos, laxantes y analgesia, con la frecuencia con que el paciente dice usarlos. Si la adherencia no se exploró, indícalo en vez de suponerla."},
    {"key":"evolucion_de_sintomas","label":"Evolución de los síntomas anorrectales","order":3,"required":false,
     "instruction":"Evolución del sangrado, del dolor al obrar y después de obrar, del prolapso, la secreción y el prurito: mejoría, empeoramiento o estabilidad tal como lo refirió el paciente. Consigna la intensidad del dolor solo con la cifra o el término que él usó."},
    {"key":"habito_intestinal_y_continencia","label":"Hábito intestinal y continencia","order":4,"required":false,
     "instruction":"Frecuencia y consistencia actuales, esfuerzo y respuesta a la fibra o al laxante, y continencia discriminando gases, líquidos y sólidos, así como uso de protector, tal como lo describió el paciente. Los puntajes de continencia se transcriben solo si el médico los enunció; nunca los calcules."},
    {"key":"herida_y_cicatrizacion","label":"Herida quirúrgica y cicatrización","order":5,"required":false,
     "instruction":"En el posoperatorio, estado de la herida anorrectal: tejido de granulación, secreción, dehiscencia, sangrado, signos de infección y estado del sedal si lo hay, tal como se describió. Si en esta consulta no se revisó la herida, escríbelo así."},
    {"key":"resultados_nuevos","label":"Resultados nuevos aportados","order":6,"required":false,
     "instruction":"Colonoscopia, patología, ecografía endoanal o manometría aportadas desde el último control: transcribe hallazgos y conclusiones literal, con su fecha, tal como el médico los leyó. No interpretes ni completes un resultado que no se leyó en consulta."},
    {"key":"examen_anorrectal_de_control","label":"Examen anorrectal de control","order":7,"required":true,
     "instruction":"Inspección perianal, tacto rectal con tono esfinteriano y anoscopia si se realizó, con la localización horaria dictada. Compara con hallazgos previos únicamente si el médico hizo esa comparación en voz alta; no completes lo que no se examinó."},
    {"key":"analisis_y_evaluacion","label":"Análisis y evaluación de la evolución","order":8,"required":true,
     "instruction":"Evaluación de la respuesta al tratamiento y del estado de cicatrización con las palabras del médico. Recaída, curación o necesidad de cirugía se consignan solo si él las enunció; nunca concluyas tú a partir de los hallazgos descritos."},
    {"key":"ajuste_del_plan_y_proximo_control","label":"Ajuste del plan y próximo control","order":9,"required":true,
     "instruction":"Cambios de tratamiento con dosis literal, curaciones, programación de procedimiento o cirugía, estudios solicitados, remisión e incapacidad con los días exactos solo si se otorgó. Cierra con el plazo del próximo control y qué debe traer el paciente."}
  ]'::jsonb,
  updated_at = now()
where id = '2ba7dee0-98c2-5a05-9b1e-86f1c46de457' and owner_id is null;

update public.clinical_templates set
  name = 'Valoración coloproctológica · procedimiento anorrectal en consultorio',
  description = 'Registro de procedimientos anorrectales realizados en consultorio (anoscopia diagnóstica, ligadura con bandas, esclerosis, drenaje de absceso, curación o retiro de puntos): indicación, consentimiento, técnica, hallazgos e indicaciones posteriores. Úsala el mismo día del procedimiento.',
  sections = '[
    {"key":"indicacion_del_procedimiento","label":"Indicación del procedimiento","order":1,"required":true,
     "instruction":"Procedimiento realizado y su indicación tal como el médico la enunció, con el diagnóstico que lo motiva. No deduzcas la indicación de los síntomas: consigna solo la declarada en la consulta."},
    {"key":"verificacion_y_consentimiento","label":"Verificación de seguridad y consentimiento informado","order":2,"required":false,
     "instruction":"Verificación de identidad y del procedimiento a realizar, alergias, anticoagulación o antiagregación suspendida, y consentimiento informado con los riesgos explicados. Si el consentimiento no se mencionó, indícalo; no des por hecho que se obtuvo."},
    {"key":"preparacion_y_anestesia","label":"Preparación, posición y anestesia local","order":3,"required":false,
     "instruction":"Preparación previa (enema, ayuno), posición del paciente (Sims, litotomía, genupectoral), asepsia y anestesia local con el anestésico y la dosis tal como se dictaron. Transcribe la dosis literal; nunca la calcules ni la completes."},
    {"key":"tecnica_y_hallazgos","label":"Técnica y hallazgos","order":4,"required":true,
     "instruction":"Descripción de la técnica en el orden en que el médico la dictó y de los hallazgos con su localización horaria: paquetes hemorroidales, fisura, orificios fistulosos, trayecto, colección drenada. Número de bandas, volumen o cantidad drenada se transcriben literal; nunca los estimes."},
    {"key":"conducta_realizada","label":"Conducta realizada y muestras","order":5,"required":true,
     "instruction":"Qué se hizo finalmente (ligadura, esclerosis, drenaje con o sin sedal, curación, retiro de puntos), material utilizado y muestras enviadas a patología con su rótulo, solo si se mencionaron. Si no se tomó muestra, consígnalo así."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones inmediatas","order":6,"required":false,
     "instruction":"Tolerancia del paciente, dolor durante el acto, sangrado, reacción vagal u otra complicación inmediata y cómo se manejó, tal como se describió. Si el médico declaró que no hubo complicaciones, escríbelo; si no se dijo nada, indícalo en vez de afirmar que el procedimiento fue sin novedad."},
    {"key":"indicaciones_posteriores","label":"Indicaciones posteriores","order":7,"required":true,
     "instruction":"Analgesia y medicamentos con dosis literal, baños de asiento, cuidados de la herida, dieta y fibra, reposo e incapacidad con los días exactos solo si se otorgó. No agregues indicaciones habituales del procedimiento que el médico no haya dictado."},
    {"key":"seguimiento","label":"Seguimiento y signos de alarma","order":8,"required":true,
     "instruction":"Cuándo vuelve a control o a nueva sesión, resultados que debe traer y los signos por los que debe consultar de urgencia según se le explicaron (sangrado abundante, fiebre, dolor que no cede, retención urinaria). Solo lo hablado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = '56322f4c-9545-51b2-900d-671bd7062af5' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c4000000-0000-4000-8000-000000000007', null,
   'Patología anal benigna · hemorroides, fisura y fístula con anoscopia',
   'Consulta enfocada en enfermedad hemorroidal, fisura anal, fístula o absceso: caracterización del sangrado y del dolor, hábito intestinal, inspección perianal con localización horaria, tacto rectal y anoscopia, con el grado o la clasificación consignados solo como los enunció el médico.',
   'coloproctologia', 'Coloproctología', 'institutional', false, 'active',
   '[
    {"key":"motivo_y_tiempo_de_evolucion","label":"Motivo y tiempo de evolución","order":1,"required":true,
     "instruction":"Motivo en las palabras del paciente y tiempo de evolución tal como lo refirió, junto con los episodios previos y su manejo. No traduzcas el síntoma a un diagnóstico ni estimes el tiempo si no se dijo."},
    {"key":"caracteristicas_del_sangrado","label":"Características del sangrado","order":2,"required":false,
     "instruction":"Color del sangrado, si gotea, mancha el papel o salpica el sanitario, si es mezclado con la materia, cantidad referida y frecuencia, tal como lo describió el paciente. No conviertas su descripción en una cifra de volumen ni la clasifiques."},
    {"key":"dolor_y_defecacion","label":"Dolor y relación con la defecación","order":3,"required":false,
     "instruction":"Dolor: momento en que aparece respecto a la deposición, duración posterior, carácter (ardor, punzada) y qué lo alivia, con la intensidad expresada en las palabras o en la cifra que usó el paciente. No asignes tú un puntaje de dolor."},
    {"key":"prolapso_secrecion_y_prurito","label":"Prolapso, secreción y prurito","order":4,"required":false,
     "instruction":"Prolapso y si reduce solo, con maniobra o no reduce; secreción purulenta o mucosa, mancha en la ropa interior, prurito y lesiones por rascado, tal como se refirieron. Solo lo mencionado en la consulta; no completes el cuadro típico."},
    {"key":"habito_intestinal_y_esfuerzo","label":"Hábito intestinal y esfuerzo","order":5,"required":false,
     "instruction":"Frecuencia y consistencia de las deposiciones, esfuerzo, tiempo en el sanitario, fibra y líquidos, laxantes y episodios de estreñimiento o diarrea. La escala de Bristol solo si el médico la enunció; nunca la asignes tú a partir de la descripción."},
    {"key":"antecedentes_y_factores","label":"Antecedentes y factores predisponentes","order":6,"required":false,
     "instruction":"Cirugías anorrectales previas, partos y desgarros, esfuerzo físico u ocupación con bipedestación prolongada, anticoagulantes o antiagregantes, enfermedad inflamatoria intestinal e inmunosupresión, solo si se mencionaron. Si no se exploraron, indícalo."},
    {"key":"inspeccion_perianal","label":"Inspección perianal","order":7,"required":true,
     "instruction":"Hallazgos de la inspección con la localización horaria tal como se dictó: plicomas, mamelones, trombo, fisura y su borde, orificios fistulosos, induración, eritema o colección. Describe lo observado sin concluir el diagnóstico en esta sección."},
    {"key":"tacto_rectal_y_anoscopia","label":"Tacto rectal y anoscopia","order":8,"required":true,
     "instruction":"Tacto rectal con tono esfinteriano, dolor, masas y contenido del dedil, y anoscopia con los paquetes o lesiones vistas y su localización horaria. Si el tacto o la anoscopia no se realizaron por dolor o por decisión del médico, escríbelo así con la razón dicha."},
    {"key":"clasificacion_referida","label":"Grado o clasificación enunciada","order":9,"required":false,
     "instruction":"Grado hemorroidal, cronicidad de la fisura o clasificación de la fístula EXCLUSIVAMENTE como los enunció el médico, con sus mismas palabras. Nunca gradúes ni clasifiques tú a partir de los hallazgos; si no se enunció clasificación, indícalo."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":10,"required":true,
     "instruction":"Razonamiento clínico y diagnósticos con la precisión con que el médico los formuló, incluidos los diferenciales que consideró y la necesidad de descartar patología proximal si él la planteó. No agregues conclusiones propias."},
    {"key":"plan_manejo_y_educacion","label":"Plan, manejo y educación","order":11,"required":true,
     "instruction":"Medidas higiénico-dietarias, tópicos y medicamentos con dosis literal, indicación de procedimiento o cirugía, estudios solicitados (colonoscopia y su motivo), remisión e incapacidad con los días exactos solo si se otorgó, y lo que se le explicó al paciente."},
    {"key":"control_y_signos_de_alarma","label":"Control y signos de alarma","order":12,"required":false,
     "instruction":"Plazo del próximo control y signos por los que debe consultar antes según se explicaron (sangrado abundante, fiebre, dolor progresivo, masa que no reduce, retención urinaria). Solo lo hablado en la consulta."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

update public.clinical_templates set
  name = 'Consulta inicial · dolor osteomuscular, mecanismo de lesión e imágenes',
  description = 'Primera consulta de ortopedia y traumatología: mecanismo de la lesión o cronología del dolor, examen osteomuscular con arcos de movimiento y maniobras, estado neurovascular e imágenes transcritas literal. Úsala para el paciente nuevo con dolor articular, lesión deportiva o secuela, no para el trauma agudo.',
  sections = '[
    {"key":"motivo_de_consulta","label":"Motivo de consulta","order":1,"required":true,
     "instruction":"Documenta el motivo en las palabras del paciente, con el segmento y el lado comprometido tal como se dijeron, y quién lo remite. La lateralidad es crítica: no la infieras si no se enunció, escribe que no se especificó."},
    {"key":"mecanismo_y_cronologia","label":"Mecanismo de lesión y cronología","order":2,"required":true,
     "instruction":"Mecanismo tal como lo describió el paciente (torsión, caída de altura, golpe directo, sobreuso), fecha o tiempo desde el evento, evolución del dolor, episodios de bloqueo, inestabilidad o fallo, y tratamientos ya recibidos con su respuesta. Solo lo referido; no reconstruyas el mecanismo."},
    {"key":"dolor_y_funcion","label":"Dolor y limitación funcional","order":3,"required":false,
     "instruction":"Localización e irradiación del dolor, qué lo aumenta y qué lo alivia, dolor nocturno o de reposo, y limitación para la marcha, el trabajo o el deporte con las distancias o actividades que mencionó el paciente. La intensidad se registra con la cifra o el término que él usó; no le asignes un puntaje."},
    {"key":"antecedentes_ortopedicos","label":"Antecedentes ortopédicos y generales","order":4,"required":false,
     "instruction":"Fracturas, cirugías y material de osteosíntesis o prótesis, infiltraciones previas, terapia física recibida, osteoporosis, artritis, diabetes, tabaquismo, anticoagulación y ocupación o deporte que practica. Solo lo mencionado; si un antecedente no se exploró, indícalo."},
    {"key":"examen_osteomuscular","label":"Examen osteomuscular","order":5,"required":true,
     "instruction":"Inspección (edema, deformidad, atrofia, cicatrices), palpación con los puntos dolorosos referidos, arcos de movimiento activos y pasivos con los grados tal como se dictaron, fuerza con la escala solo si el médico la enunció, estabilidad y maniobras específicas con su resultado. No completes lo no examinado."},
    {"key":"estado_neurovascular","label":"Estado neurovascular y marcha","order":6,"required":false,
     "instruction":"Pulsos distales, llenado capilar, sensibilidad y fuerza distal, y patrón de marcha o uso de ayuda externa, tal como se describieron. Si el examen neurovascular no se realizó, escríbelo así; no lo des por normal."},
    {"key":"imagenes_y_estudios","label":"Imágenes y estudios aportados","order":7,"required":false,
     "instruction":"Radiografías, tomografía, resonancia o electromiografía aportadas: transcribe el hallazgo y la conclusión literal, con su fecha, tal como el médico los leyó. No clasifiques la lesión ni midas ángulos por tu cuenta; si un estudio está pendiente, escríbelo así."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":8,"required":true,
     "instruction":"Razonamiento clínico y diagnósticos con la precisión con que el médico los formuló, incluidos los diferenciales. Clasificaciones y grados (lesión meniscal, artrosis, tendinopatía) solo si él los enunció; nunca los asignes tú a partir de los hallazgos."},
    {"key":"plan_y_educacion","label":"Plan, terapia y educación","order":9,"required":true,
     "instruction":"Analgesia y medicamentos con dosis literal, inmovilización u ortesis indicada, terapia física con el número de sesiones dicho, estudios solicitados, indicación quirúrgica y remisión, más lo que se le explicó al paciente sobre su lesión. Transcribe todo tal como se dictó."},
    {"key":"incapacidad_y_proximo_control","label":"Incapacidad y próximo control","order":10,"required":false,
     "instruction":"Incapacidad con los días exactos y las restricciones laborales o deportivas solo si se otorgaron, y plazo del próximo control con los resultados que debe traer. Nunca calcules días de incapacidad ni agregues restricciones que el médico no haya dictado."}
  ]'::jsonb,
  updated_at = now()
where id = '8bf98df9-8a7b-52f4-b420-85768a7affa8' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · consolidación, dolor y rehabilitación',
  description = 'Control ortopédico de fractura, posoperatorio o patología en manejo: evolución del dolor y la función, control radiológico con el hallazgo transcrito, examen con arcos y fuerza, avance de la terapia y ajuste del apoyo, la inmovilización y la incapacidad. Úsala para todo control ya iniciado el tratamiento.',
  sections = '[
    {"key":"diagnostico_y_tiempo_de_evolucion","label":"Diagnóstico, lateralidad y tiempo de evolución","order":1,"required":true,
     "instruction":"Diagnóstico con el segmento y el lado, fecha de la lesión o de la cirugía y semanas de evolución tal como se enunciaron. No calcules el tiempo transcurrido si las fechas no se dijeron: indica que no se precisó."},
    {"key":"intervalo_y_tratamiento_recibido","label":"Intervalo y tratamiento recibido","order":2,"required":false,
     "instruction":"Qué se ha hecho desde el último control: inmovilización y su tolerancia, cirugía realizada, sesiones de terapia asistidas, analgesia usada y adherencia al apoyo indicado, con lo que el paciente refirió. Si la adherencia no se exploró, indícalo."},
    {"key":"evolucion_del_dolor_y_funcion","label":"Evolución del dolor y de la función","order":3,"required":false,
     "instruction":"Evolución del dolor, capacidad de carga o apoyo, marcha, uso de muletas o cabestrillo y retorno a las actividades laborales o deportivas, tal como lo refirió el paciente. Registra la intensidad solo con la cifra o el término que él usó."},
    {"key":"control_radiologico","label":"Control radiológico","order":4,"required":false,
     "instruction":"Radiografías o tomografía de control: transcribe literal el hallazgo tal como el médico lo leyó, incluidos los signos de consolidación, la posición del material de osteosíntesis y las mediciones dictadas. Nunca afirmes consolidación ni midas desplazamientos por tu cuenta."},
    {"key":"examen_de_control","label":"Examen físico de control","order":5,"required":true,
     "instruction":"Estado de la herida o del sitio quirúrgico (cicatrización, secreción, signos de infección, retiro de puntos), edema, arcos de movimiento con los grados dictados, fuerza, estabilidad y estado neurovascular distal. Compara con lo previo solo si el médico hizo la comparación."},
    {"key":"rehabilitacion_y_adherencia","label":"Rehabilitación y adherencia","order":6,"required":false,
     "instruction":"Avance en terapia física según el reporte o el relato del paciente, ejercicios en casa, tolerancia y limitaciones persistentes. Consigna metas funcionales solo como las enunció el médico; no propongas objetivos de rehabilitación por tu cuenta."},
    {"key":"analisis_y_evaluacion_de_metas","label":"Análisis y evaluación de la evolución","order":7,"required":true,
     "instruction":"Evaluación de la evolución frente a lo esperado con las palabras del médico: consolidación, retardo, rigidez, infección o necesidad de nueva intervención se consignan solo si él las enunció. Nunca concluyas tú el estado de consolidación a partir de los hallazgos."},
    {"key":"ajuste_del_plan_incapacidad_y_control","label":"Ajuste del plan, incapacidad y próximo control","order":8,"required":true,
     "instruction":"Cambios de apoyo o inmovilización, medicamentos con dosis literal, nuevas sesiones de terapia con el número dicho, estudios solicitados, remisión e incapacidad o restricciones con los días exactos solo si se otorgaron. Cierra con el plazo del próximo control y qué debe traer."}
  ]'::jsonb,
  updated_at = now()
where id = '780e3c7d-599a-5081-9b10-9f36ad7ad135' and owner_id is null;

update public.clinical_templates set
  name = 'Valoración ortopédica · procedimiento en consultorio e infiltración',
  description = 'Registro de procedimientos ortopédicos ambulatorios (infiltración, artrocentesis, colocación o retiro de yeso o férula, retiro de material de sutura o de clavos percutáneos): indicación, consentimiento, técnica, material utilizado con dosis literal e indicaciones posteriores. Úsala el mismo día del procedimiento.',
  sections = '[
    {"key":"indicacion_del_procedimiento","label":"Indicación y lateralidad","order":1,"required":true,
     "instruction":"Procedimiento realizado, articulación o segmento y LADO, con la indicación tal como el médico la enunció. La lateralidad debe quedar explícita: si no se dijo, escribe que no se especificó; nunca la deduzcas del resto de la consulta."},
    {"key":"verificacion_y_consentimiento","label":"Verificación de seguridad y consentimiento informado","order":2,"required":false,
     "instruction":"Verificación de identidad, sitio y procedimiento, alergias (incluida la del anestésico local), anticoagulación, infección activa de la piel y consentimiento informado con los riesgos explicados. Si el consentimiento no se mencionó, indícalo; no lo des por obtenido."},
    {"key":"asepsia_y_anestesia","label":"Asepsia, posición y anestesia","order":3,"required":false,
     "instruction":"Posición del paciente, antisepsia utilizada, uso de guía ecográfica si se mencionó y anestésico local con nombre, concentración y volumen tal como se dictaron. Transcribe las dosis literal; nunca las calcules ni las completes."},
    {"key":"tecnica_y_hallazgos","label":"Técnica y hallazgos","order":4,"required":true,
     "instruction":"Vía de abordaje y pasos en el orden en que el médico los dictó, y hallazgos del acto: líquido aspirado con su volumen, color y aspecto, resistencia al ingreso, reducción lograda o alineación obtenida. Volúmenes y medidas se transcriben literal; nunca los estimes."},
    {"key":"material_utilizado","label":"Material y medicamento aplicado","order":5,"required":false,
     "instruction":"Medicamento infiltrado con nombre, dosis y volumen exactos, tipo de yeso, férula u ortesis colocada, material retirado y muestras enviadas a laboratorio o patología, solo si se mencionaron. Transcribe cada dosis tal como se dictó; nunca la deduzcas de la práctica habitual."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones inmediatas","order":6,"required":false,
     "instruction":"Tolerancia del paciente, dolor durante el acto, sangrado, reacción vagal, alteración neurovascular distal tras la inmovilización y cómo se manejó, tal como se describió. Si no se comentó nada al respecto, indícalo en vez de afirmar que no hubo complicaciones."},
    {"key":"indicaciones_posteriores","label":"Indicaciones posteriores y cuidados","order":7,"required":true,
     "instruction":"Analgesia y medicamentos con dosis literal, reposo, hielo, carga o apoyo permitido, cuidados del yeso o de la férula, restricción de actividad e incapacidad con los días exactos solo si se otorgó. No agregues cuidados habituales que no se dictaron."},
    {"key":"seguimiento_y_signos_de_alarma","label":"Seguimiento y signos de alarma","order":8,"required":true,
     "instruction":"Plazo del próximo control o de una nueva sesión, estudios que debe traer y los signos por los que debe consultar de urgencia según se le explicaron (dolor progresivo bajo el yeso, adormecimiento, cambio de color de los dedos, fiebre, secreción). Solo lo hablado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = 'fe80b014-9745-56e7-990e-54dded6ae42d' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c4000000-0000-4000-8000-000000000008', null,
   'Fractura y trauma agudo · manejo inicial e inmovilización',
   'Atención del trauma osteomuscular agudo: mecanismo, deformidad y estado de la piel, estado neurovascular distal, hallazgo radiológico transcrito literal, reducción e inmovilización con su tolerancia, analgesia y educación sobre síndrome compartimental. Úsala en urgencias o en la primera atención de una fractura o luxación.',
   'ortopedia', 'Ortopedia y traumatología', 'institutional', false, 'active',
   '[
    {"key":"mecanismo_y_hora_del_trauma","label":"Mecanismo y hora del trauma","order":1,"required":true,
     "instruction":"Mecanismo tal como lo describió el paciente o el acompañante (caída de altura y desde cuánto, accidente de tránsito y su cinemática, golpe directo, torsión), hora o tiempo transcurrido y segmento y LADO afectado. No reconstruyas el mecanismo ni estimes la hora si no se dijeron."},
    {"key":"atencion_inicial_previa","label":"Atención inicial previa","order":2,"required":false,
     "instruction":"Atención recibida antes de esta consulta: inmovilización provisional, analgesia aplicada, traslado, institución que lo atendió y estudios ya realizados, con lo que se refirió. Si no recibió atención previa, escríbelo así; no supongas manejo prehospitalario."},
    {"key":"dolor_e_impotencia_funcional","label":"Dolor e impotencia funcional","order":3,"required":false,
     "instruction":"Dolor con la intensidad que expresó el paciente, imposibilidad de mover el segmento o de apoyar, adormecimiento u hormigueo referidos y otros sitios de dolor mencionados. Solo lo referido; no le asignes un puntaje de dolor ni completes síntomas."},
    {"key":"inspeccion_deformidad_y_piel","label":"Inspección: deformidad y estado de la piel","order":4,"required":true,
     "instruction":"Deformidad, angulación, acortamiento, edema y equimosis, y ESTADO DE LA PIEL: íntegra o con herida, con su tamaño, aspecto y exposición ósea tal como se describieron. Si el médico no calificó la fractura como abierta o cerrada, no lo hagas tú; transcribe solo lo observado."},
    {"key":"estado_neurovascular_distal","label":"Estado neurovascular distal","order":5,"required":true,
     "instruction":"Pulsos distales, llenado capilar, temperatura y color, sensibilidad y movilidad distal, EXACTAMENTE como los describió el médico, antes y después de la inmovilización si lo evaluó dos veces. Si algún componente no se examinó, escríbelo así; nunca lo des por normal."},
    {"key":"hallazgo_radiologico","label":"Hallazgo radiológico","order":6,"required":true,
     "instruction":"Transcribe LITERAL lo que el médico leyó de la radiografía o la tomografía: hueso, sitio, trazo, desplazamiento y angulación con las cifras dictadas. No clasifiques la fractura ni le apliques ninguna clasificación por tu cuenta, y no midas ángulos ni desplazamientos: solo lo enunciado."},
    {"key":"impresion_diagnostica","label":"Impresión diagnóstica","order":7,"required":true,
     "instruction":"Diagnóstico con la precisión con que el médico lo formuló, incluidas lesiones asociadas y el diagnóstico de luxación o fractura-luxación solo si él lo enunció. No agregues diagnósticos derivados de los hallazgos que el médico no haya dicho."},
    {"key":"reduccion_e_inmovilizacion","label":"Reducción, inmovilización y tolerancia","order":8,"required":true,
     "instruction":"Maniobra de reducción realizada, sedación o anestesia usada con la dosis literal, tipo de inmovilización colocada (férula, yeso, cabestrillo, tracción), control radiológico posterior si se hizo y tolerancia del paciente al procedimiento. Solo lo realizado en esta atención."},
    {"key":"analgesia_y_medicacion","label":"Analgesia y medicación indicada","order":9,"required":false,
     "instruction":"Medicamentos indicados con nombre, dosis, vía, frecuencia y duración TAL COMO se dictaron, incluidos analgesia, antibiótico y toxoide tetánico si se aplicaron. Transcríbelos literal; nunca calcules una dosis ni completes un esquema que no se enunció."},
    {"key":"educacion_signos_de_alarma","label":"Educación y signos de alarma explicados","order":10,"required":false,
     "instruction":"Signos de alarma explicados al paciente, en especial los del síndrome compartimental (dolor que aumenta pese a la analgesia, adormecimiento, dedos fríos o morados, dolor al estirar los dedos), además de cuidados del yeso y elevación. Registra solo lo que se le explicó en la consulta."},
    {"key":"plan_definitivo_y_control","label":"Plan definitivo y control","order":11,"required":true,
     "instruction":"Conducta definida: manejo conservador o quirúrgico con el plazo dicho, hospitalización o remisión con la institución mencionada, estudios pendientes, incapacidad con los días exactos solo si se otorgó y fecha del control. No decidas tú la conducta ni sugieras cirugía que no se planteó."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

update public.clinical_templates set
  name = 'Consulta inicial · agudeza visual, síntomas oculares y fondo de ojo',
  description = 'Primera consulta oftalmológica: síntomas visuales con su cronología, antecedentes oculares y sistémicos, agudeza visual y refracción, presión intraocular, biomicroscopía y fondo de ojo, todos transcritos tal como se dictaron. Úsala para el paciente nuevo o remitido, no para la urgencia ocular.',
  sections = '[
    {"key":"motivo_de_consulta","label":"Motivo de consulta","order":1,"required":true,
     "instruction":"Documenta el motivo en las palabras del paciente (ve borroso de lejos, ve manchas, le arden los ojos) y el ojo comprometido tal como se dijo, además de quién lo remite. Si no se precisó el ojo, escríbelo así; no lo infieras."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":2,"required":true,
     "instruction":"Cronología: inicio y forma de instauración de los síntomas, si es uno o ambos ojos, visión borrosa de cerca o de lejos, moscas volantes, fotopsias, halos, diplopía, dolor, ardor o lagrimeo, y tratamientos ya usados con su respuesta. Solo lo referido en la consulta."},
    {"key":"antecedentes_oftalmologicos","label":"Antecedentes oftalmológicos y corrección actual","order":3,"required":false,
     "instruction":"Uso de gafas o lentes de contacto y desde cuándo, fórmula anterior si se mencionó, cirugías oculares (catarata, refractiva, láser) con su fecha, trauma ocular previo, ambliopía, estrabismo y antecedente familiar de glaucoma o de ceguera. Si no se exploraron, indícalo."},
    {"key":"antecedentes_sistemicos_y_medicamentos","label":"Antecedentes sistémicos y medicamentos","order":4,"required":false,
     "instruction":"Diabetes e hipertensión con su tiempo de evolución y control referido, enfermedad autoinmune, y medicamentos de riesgo ocular mencionados (esteroides, hidroxicloroquina, tamsulosina, anticoagulantes) con la dosis dicha. Solo lo hablado en la consulta."},
    {"key":"agudeza_visual_y_refraccion","label":"Agudeza visual y refracción","order":5,"required":true,
     "instruction":"Agudeza visual de cada ojo, sin corrección y con corrección o con agujero estenopeico, EXACTAMENTE en la notación que dictó el médico; nunca la conviertas de una escala a otra ni la estimes. Refracción y adición se transcriben literal, con su eje y signo tal como se leyeron."},
    {"key":"presion_intraocular","label":"Presión intraocular","order":6,"required":false,
     "instruction":"Presión intraocular de cada ojo en mmHg tal como se dictó, con el método y la hora de la toma si se mencionaron, y paquimetría solo si se enunció. Nunca estimes ni ajustes la cifra; si no se tomó la presión en esta consulta, escríbelo así."},
    {"key":"biomicroscopia","label":"Biomicroscopía de segmento anterior","order":7,"required":true,
     "instruction":"Hallazgos por ojo en párpados, conjuntiva, córnea (tinción, infiltrados, edema), cámara anterior y su profundidad, iris, pupila y su reactividad, y cristalino con el grado de catarata solo si el médico lo enunció. No completes estructuras que no se examinaron."},
    {"key":"fondo_de_ojo","label":"Fondo de ojo y polo posterior","order":8,"required":false,
     "instruction":"Fondo de ojo por ojo con o sin dilatación según se dijo: papila con la relación copa-disco tal como se dictó, mácula, vasos y retina periférica. Transcribe cifras y hallazgos literal; nunca calcules la relación copa-disco ni clasifiques una retinopatía por tu cuenta."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":9,"required":true,
     "instruction":"Razonamiento y diagnósticos por ojo con la precisión con que el médico los formuló, incluidos los diferenciales. Estadios y clasificaciones (glaucoma, retinopatía diabética, degeneración macular) solo si él las enunció; nunca las asignes tú."},
    {"key":"plan_educacion_y_control","label":"Plan, educación y próximo control","order":10,"required":true,
     "instruction":"Fórmula de lentes tal como se dictó, colirios con nombre, número de gotas, ojo y frecuencia literales, estudios solicitados (campimetría, OCT, ecografía), láser o cirugía programada, remisión y educación dada, más el plazo del próximo control. No completes esquemas que no se dictaron."}
  ]'::jsonb,
  updated_at = now()
where id = '62b8356f-2a07-5032-8ff6-3070e612c7f6' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · visión, presión intraocular y adherencia al colirio',
  description = 'Control oftalmológico de patología crónica (glaucoma, retinopatía diabética, posoperatorio, ojo seco): adherencia y técnica de aplicación del colirio, agudeza visual y presión intraocular de control, exámenes nuevos transcritos y evaluación de la meta enunciada por el médico.',
  sections = '[
    {"key":"diagnosticos_activos","label":"Diagnósticos activos por ojo","order":1,"required":true,
     "instruction":"Diagnósticos activos especificando el ojo y el tiempo de evolución, y cirugías o láser previos con su fecha, tal como se mencionaron en esta consulta. No reconstruyas antecedentes que el médico no haya citado."},
    {"key":"intervalo_y_adherencia","label":"Intervalo, adherencia y técnica del colirio","order":2,"required":false,
     "instruction":"Tiempo desde el último control y adherencia al tratamiento: qué colirios usa, cuántas gotas, en qué ojo y a qué horas según lo que refiere el paciente, si olvida dosis y cómo los aplica. Transcribe el esquema tal como él lo describió; no lo corrijas ni lo completes."},
    {"key":"sintomas_en_el_intervalo","label":"Síntomas en el intervalo","order":3,"required":false,
     "instruction":"Cambios en la visión, moscas volantes o fotopsias nuevas, dolor, ojo rojo, halos, y molestias atribuidas al colirio (ardor, sensación de cuerpo extraño, sequedad). Solo lo referido por el paciente en la consulta."},
    {"key":"agudeza_visual_de_control","label":"Agudeza visual de control","order":4,"required":true,
     "instruction":"Agudeza visual de cada ojo en la notación EXACTA que dictó el médico, con y sin corrección si así se tomó. Nunca la conviertas ni la estimes, y compara con la visita previa solo si el médico hizo esa comparación en voz alta."},
    {"key":"presion_intraocular_de_control","label":"Presión intraocular de control","order":5,"required":false,
     "instruction":"Presión intraocular de cada ojo en mmHg tal como se dictó, con método y hora si se dijeron. Transcríbela literal; nunca la promedies, la ajustes ni la califiques como controlada por tu cuenta. Si no se tomó en esta consulta, escríbelo así."},
    {"key":"examen_y_estudios_de_control","label":"Examen y estudios de control","order":6,"required":false,
     "instruction":"Biomicroscopía y fondo de ojo de control por ojo, y estudios nuevos (campimetría, OCT, angiografía, ecografía) con los valores y conclusiones transcritos literal tal como el médico los leyó. No interpretes un estudio que no se leyó en la consulta."},
    {"key":"evaluacion_de_metas","label":"Evaluación de metas y progresión","order":7,"required":true,
     "instruction":"Evaluación de la meta de presión intraocular, de la estabilidad del campo visual o de la progresión, EXCLUSIVAMENTE como las enunció el médico. Nunca fijes tú una meta ni declares progresión o control a partir de las cifras registradas."},
    {"key":"ajuste_del_plan_y_proximo_control","label":"Ajuste del plan y próximo control","order":8,"required":true,
     "instruction":"Cambios en los colirios con nombre, gotas, ojo y frecuencia literales, láser o cirugía programada, estudios solicitados, remisión a otra subespecialidad o a la EPS e incapacidad solo si se otorgó. Cierra con el plazo del próximo control y qué debe traer."}
  ]'::jsonb,
  updated_at = now()
where id = 'e00bbf8c-df5a-50ad-a6b4-46d56b4486ea' and owner_id is null;

update public.clinical_templates set
  name = 'Valoración oftalmológica · procedimiento en consultorio y láser',
  description = 'Registro de procedimientos oftalmológicos ambulatorios (láser YAG o argón, iridotomía, retiro de cuerpo extraño corneal, inyección intravítrea, sondaje lagrimal): verificación del ojo, consentimiento, parámetros del equipo transcritos, hallazgos, tolerancia e indicaciones posteriores.',
  sections = '[
    {"key":"indicacion_del_procedimiento","label":"Indicación del procedimiento","order":1,"required":true,
     "instruction":"Procedimiento realizado y su indicación tal como el médico la enunció, con el diagnóstico que lo motiva. No deduzcas la indicación de los hallazgos previos: consigna solo la declarada en esta consulta."},
    {"key":"verificacion_del_ojo_y_consentimiento","label":"Verificación del ojo y consentimiento informado","order":2,"required":true,
     "instruction":"Verificación de identidad y del OJO a intervenir tal como se confirmó, alergias, anticoagulación y consentimiento informado con los riesgos explicados. La lateralidad debe quedar explícita; si no se enunció, escríbelo así. Si el consentimiento no se mencionó, indícalo."},
    {"key":"preparacion_y_anestesia","label":"Preparación y anestesia tópica","order":3,"required":false,
     "instruction":"Dilatación o miosis previa, antisepsia, blefarostato y anestésico tópico o subconjuntival con nombre y dosis tal como se dictaron. Transcribe los medicamentos literal; nunca completes la preparación habitual del procedimiento."},
    {"key":"tecnica_y_parametros","label":"Técnica y parámetros del equipo","order":4,"required":true,
     "instruction":"Técnica en el orden en que el médico la dictó y parámetros del equipo EXACTAMENTE como se enunciaron: tipo de láser, energía, potencia, duración, tamaño de spot y número de disparos, o el fármaco y volumen inyectado. Nunca inventes ni redondees un parámetro; si no se dictó, indícalo."},
    {"key":"hallazgos_del_procedimiento","label":"Hallazgos y resultado inmediato","order":5,"required":true,
     "instruction":"Hallazgos durante el acto y resultado inmediato descrito por el médico: apertura de la cápsula, permeabilidad de la iridotomía, retiro completo o parcial del cuerpo extraño y anillo de óxido, reflujo del sitio de inyección. Solo lo que él describió."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones inmediatas","order":6,"required":false,
     "instruction":"Tolerancia del paciente, dolor, sangrado, hemorragia subconjuntival, elevación de la presión intraocular posprocedimiento con la cifra dicha y cómo se manejó. Si no se comentó nada al respecto, indícalo en vez de afirmar que no hubo complicaciones."},
    {"key":"indicaciones_posteriores","label":"Indicaciones posteriores","order":7,"required":true,
     "instruction":"Colirios posprocedimiento con nombre, número de gotas, ojo, frecuencia y duración literales, oclusión, restricciones de actividad y analgesia indicada. Transcribe todo tal como se dictó; no agregues el esquema habitual del procedimiento."},
    {"key":"seguimiento_y_signos_de_alarma","label":"Seguimiento y signos de alarma","order":8,"required":true,
     "instruction":"Cuándo vuelve a control o a nueva sesión y los signos por los que debe consultar de urgencia según se le explicaron (dolor intenso, pérdida de visión, ojo rojo progresivo, náuseas con dolor ocular). Solo lo hablado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = 'dd9b5550-4990-5d3a-a1e6-4c4623802935' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c4000000-0000-4000-8000-000000000009', null,
   'Urgencia ocular · ojo rojo, trauma y pérdida súbita de visión',
   'Atención oftalmológica urgente: hora de inicio y mecanismo o exposición, agudeza visual del primer contacto, biomicroscopía con fluoresceína y pupila, presión intraocular, conducta inmediata realizada y remisión con signos de alarma. Úsala en trauma ocular, quemadura química, ojo rojo doloroso o pérdida súbita de visión.',
   'oftalmologia', 'Oftalmología', 'institutional', false, 'active',
   '[
    {"key":"motivo_y_hora_de_inicio","label":"Motivo y hora de inicio","order":1,"required":true,
     "instruction":"Motivo en las palabras del paciente, OJO afectado y hora o tiempo exacto desde el inicio del cuadro tal como se dijeron. En la urgencia ocular el tiempo define la conducta: si no se precisó la hora, escríbelo así; nunca la estimes."},
    {"key":"mecanismo_o_exposicion","label":"Mecanismo del trauma o exposición","order":2,"required":false,
     "instruction":"Mecanismo tal como se describió: golpe, proyectil, esmerilado o pulido sin protección, sustancia química con su nombre y si hubo lavado previo, uso de lente de contacto o cirugía ocular reciente. No supongas el agente causal ni el material del cuerpo extraño."},
    {"key":"sintomas_visuales","label":"Síntomas visuales y oculares","order":3,"required":true,
     "instruction":"Pérdida de visión y si fue súbita o progresiva, cortina o sombra, moscas y fotopsias, dolor, fotofobia, halos, diplopía, secreción y lagrimeo, todo como lo refirió el paciente. Solo los síntomas explorados; no listes negativos que no se preguntaron."},
    {"key":"antecedentes_relevantes","label":"Antecedentes relevantes para la urgencia","order":4,"required":false,
     "instruction":"Cirugía o inyección ocular reciente con su fecha, glaucoma, uso de lentes de contacto y su higiene, diabetes, anticoagulación, inmunosupresión y trauma previo, solo si se mencionaron en la consulta. Si no se exploraron, indícalo."},
    {"key":"agudeza_visual_de_urgencia","label":"Agudeza visual del primer contacto","order":5,"required":true,
     "instruction":"Agudeza visual de cada ojo en la notación EXACTA que dictó el médico, incluidas las categorías gruesas si así se registró (cuenta dedos, movimiento de manos, percepción de luz). Es el dato médico-legal más importante de la urgencia: nunca lo conviertas, estimes ni omitas."},
    {"key":"inspeccion_y_biomicroscopia","label":"Inspección y biomicroscopía","order":6,"required":true,
     "instruction":"Párpados y órbita, conjuntiva e hiperemia con su patrón, córnea con la tinción de fluoresceína y el tamaño del defecto tal como se dictó, cámara anterior (hipopión, hifema y su altura), pupila con su reactividad y defecto pupilar aferente si se evaluó. No completes lo no examinado."},
    {"key":"presion_intraocular","label":"Presión intraocular","order":7,"required":false,
     "instruction":"Presión intraocular en mmHg tal como se dictó, con el método y la hora. Si no se tomó por sospecha de trauma abierto o por otra razón, escribe esa razón tal como el médico la enunció; nunca estimes la cifra ni la des por normal."},
    {"key":"fondo_de_ojo","label":"Fondo de ojo si se realizó","order":8,"required":false,
     "instruction":"Fondo de ojo por ojo si se realizó, con los hallazgos dictados en papila, mácula, vasos y retina periférica, y ecografía ocular si se hizo. Si no se dilató o no se visualizó el fondo, escribe la razón dicha en vez de dejar la sección vacía."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":9,"required":true,
     "instruction":"Impresión diagnóstica por ojo con la precisión con que el médico la formuló y los diferenciales que planteó, incluida la sospecha de trauma ocular abierto solo si él la enunció. Nunca concluyas un diagnóstico a partir de los hallazgos descritos."},
    {"key":"conducta_inmediata","label":"Conducta inmediata realizada","order":10,"required":true,
     "instruction":"Lo realizado en la urgencia: lavado ocular con la solución y el tiempo dichos, retiro de cuerpo extraño, colirios o medicamentos aplicados con nombre, dosis y hora literales, oclusión o protector rígido, y ayuno si se indicó. Solo lo efectivamente realizado y dictado."},
    {"key":"remision_y_signos_de_alarma","label":"Remisión, plan y signos de alarma","order":11,"required":true,
     "instruction":"Remisión con el nivel o la institución mencionada y su urgencia, cirugía programada, tratamiento ambulatorio con dosis literal, incapacidad con los días exactos solo si se otorgó, control con su plazo y signos de alarma explicados al paciente. No decidas tú la remisión."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

update public.clinical_templates set
  name = 'Consulta inicial · síntomas de oído, nariz y garganta',
  description = 'Primera consulta otorrinolaringológica: síntomas óticos, nasales y faringolaríngeos con su cronología, antecedentes de exposición a ruido y cirugías, y examen completo con otoscopia, rinoscopia, orofaringe y laringoscopia. Úsala para el paciente nuevo o remitido por síntomas de oído, nariz o garganta.',
  sections = '[
    {"key":"motivo_de_consulta","label":"Motivo de consulta","order":1,"required":true,
     "instruction":"Documenta el motivo en las palabras del paciente (no oigo del oído derecho, vivo congestionado, me duele al tragar) y quién lo remite. Registra el lado comprometido tal como se dijo; si no se precisó, escríbelo así."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":2,"required":true,
     "instruction":"Cronología: inicio, evolución, si es continuo o en episodios, factores que lo agravan o alivian, tratamientos ya recibidos (antibióticos, corticoide nasal, antihistamínico) con su duración y respuesta. Solo lo referido; no completes el cuadro clínico típico."},
    {"key":"sintomas_oticos","label":"Síntomas óticos","order":3,"required":false,
     "instruction":"Hipoacusia con su lado y forma de instauración, otalgia, otorrea y su aspecto, tinnitus, plenitud ótica, vértigo con su duración y desencadenante, e inestabilidad, tal como los refirió el paciente. Solo los síntomas explorados en la consulta."},
    {"key":"sintomas_nasales_y_faringeos","label":"Síntomas nasales, faríngeos y laríngeos","order":4,"required":false,
     "instruction":"Obstrucción nasal y su lado, rinorrea con su aspecto, estornudos, prurito, epistaxis y su frecuencia, alteración del olfato, ronquido y apneas presenciadas, odinofagia, disfagia, reflujo, disfonía y tos, según lo referido. No listes negativos que no se preguntaron."},
    {"key":"antecedentes_orl","label":"Antecedentes otorrinolaringológicos y exposición","order":5,"required":false,
     "instruction":"Cirugías previas (amigdalectomía, septoplastia, timpanoplastia, adenoidectomía), otitis a repetición, trauma nasal, rinitis alérgica, asma, exposición ocupacional o recreativa a ruido, tabaquismo, alcohol y uso de audífono. Si no se exploraron, indícalo."},
    {"key":"otoscopia","label":"Otoscopia","order":6,"required":true,
     "instruction":"Otoscopia por oído: conducto auditivo externo (cerumen, otorrea, edema), membrana timpánica con su color, transparencia, posición, perforación y su localización o tamaño tal como se dictaron, y presencia de líquido o burbujas. Si un oído no se visualizó, escribe la razón dicha."},
    {"key":"rinoscopia_y_orofaringe","label":"Rinoscopia y orofaringe","order":7,"required":true,
     "instruction":"Rinoscopia anterior con estado de cornetes, mucosa, secreción, desviación septal y su lado, pólipos o costras; y orofaringe con amígdalas, su tamaño solo si el médico lo graduó, exudado, pilares, úvula y paladar. No gradúes tú la hipertrofia ni la desviación."},
    {"key":"cuello_y_laringoscopia","label":"Cuello y laringoscopia","order":8,"required":false,
     "instruction":"Palpación del cuello (adenopatías con localización y tamaño dictados, tiroides, masas) y nasofibrolaringoscopia o laringoscopia indirecta si se realizó, con los hallazgos de cavum, hipofaringe, cuerdas vocales y su movilidad. Transcribe medidas literal; si no se realizó, escríbelo."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":9,"required":true,
     "instruction":"Razonamiento y diagnósticos con la precisión con que el médico los formuló, con lado incluido, y los diferenciales que consideró. Clasificaciones o grados solo si él los enunció; nunca los asignes tú a partir de los hallazgos descritos."},
    {"key":"plan_educacion_y_control","label":"Plan, estudios, educación y control","order":10,"required":true,
     "instruction":"Medicamentos con nombre, dosis, vía y duración literales, lavados nasales, estudios solicitados (audiometría, impedanciometría, tomografía, nasofibroscopia), cirugía planteada, remisión, incapacidad con los días exactos solo si se otorgó y plazo del próximo control."}
  ]'::jsonb,
  updated_at = now()
where id = '113755f7-5901-5bc1-8fb4-7ed29a830197' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · síntomas, audición y respuesta al tratamiento',
  description = 'Control otorrinolaringológico: evolución de los síntomas, adherencia y técnica de aplicación de los medicamentos nasales u óticos, resultados nuevos de audiometría o imagen transcritos, examen dirigido y ajuste del plan. Úsala para controles de patología en manejo o de posoperatorio de la especialidad.',
  sections = '[
    {"key":"diagnosticos_activos","label":"Diagnósticos activos y antecedente quirúrgico","order":1,"required":true,
     "instruction":"Diagnósticos activos con lado y tiempo de evolución, y cirugía otorrinolaringológica previa con su fecha si se mencionó. Consigna solo lo que el médico citó en esta consulta; no reconstruyas antecedentes."},
    {"key":"intervalo_y_adherencia","label":"Intervalo, adherencia y técnica","order":2,"required":false,
     "instruction":"Tiempo desde el último control y adherencia: si completó el antibiótico, cómo aplica el corticoide nasal o las gotas óticas, cuántas veces al día y si hace lavados nasales, según lo que refiere el paciente. Transcribe el esquema como él lo describió; no lo corrijas."},
    {"key":"evolucion_de_sintomas","label":"Evolución de los síntomas","order":3,"required":false,
     "instruction":"Evolución de la obstrucción, la rinorrea, la otalgia, la otorrea, el tinnitus, el vértigo o la disfonía: mejoría, empeoramiento o estabilidad tal como lo refirió el paciente, y efectos adversos atribuidos al tratamiento. Solo lo mencionado en la consulta."},
    {"key":"resultados_nuevos","label":"Resultados nuevos aportados","order":4,"required":false,
     "instruction":"Audiometría, impedanciometría, tomografía, resonancia o patología aportadas: transcribe umbrales por frecuencia y oído, tipo de curva y conclusiones LITERAL, con su fecha, tal como el médico los leyó. Nunca promedies umbrales ni clasifiques el grado de hipoacusia por tu cuenta."},
    {"key":"examen_orl_de_control","label":"Examen otorrinolaringológico de control","order":5,"required":true,
     "instruction":"Otoscopia, rinoscopia y orofaringe de control, y estado de la cavidad quirúrgica, la herida, el tapón o el tubo de ventilación si aplica, con los hallazgos por lado. Compara con lo previo solo si el médico hizo esa comparación; no completes lo no examinado."},
    {"key":"audicion_y_dispositivos","label":"Audición y uso de dispositivos","order":6,"required":false,
     "instruction":"Percepción del paciente sobre su audición, uso y tolerancia del audífono o del implante, horas de uso diario y dificultades referidas, y necesidad de terapia o de reprogramación solo si se mencionó. Solo lo hablado en la consulta."},
    {"key":"analisis_y_metas","label":"Análisis y evaluación de la respuesta","order":7,"required":true,
     "instruction":"Evaluación de la respuesta al tratamiento y de las metas con las palabras del médico: resolución, recaída, necesidad de cirugía o de nuevo estudio se consignan solo si él las enunció. Nunca concluyas tú a partir de los hallazgos o los umbrales registrados."},
    {"key":"ajuste_del_plan_y_proximo_control","label":"Ajuste del plan y próximo control","order":8,"required":true,
     "instruction":"Cambios de medicamento con dosis y duración literales, estudios solicitados, programación quirúrgica, remisión a la EPS o a otra especialidad e incapacidad con los días exactos solo si se otorgó. Cierra con el plazo del próximo control y qué debe traer el paciente."}
  ]'::jsonb,
  updated_at = now()
where id = '32f9e9a0-0e96-5449-a110-baa5da9e76a1' and owner_id is null;

update public.clinical_templates set
  name = 'Valoración otorrinolaringológica · procedimiento en consultorio',
  description = 'Registro de procedimientos otorrinolaringológicos ambulatorios (lavado ótico, extracción de cuerpo extraño, cauterización de epistaxis, taponamiento nasal, nasofibrolaringoscopia, punción o biopsia): indicación, lateralidad, técnica, hallazgos, tolerancia e indicaciones posteriores.',
  sections = '[
    {"key":"indicacion_del_procedimiento","label":"Indicación y lateralidad","order":1,"required":true,
     "instruction":"Procedimiento realizado, lado o fosa intervenida e indicación tal como el médico la enunció. La lateralidad debe quedar explícita: si no se dijo, escribe que no se especificó; nunca la deduzcas de la historia."},
    {"key":"verificacion_y_consentimiento","label":"Verificación de seguridad y consentimiento informado","order":2,"required":false,
     "instruction":"Verificación de identidad y del sitio, alergias, anticoagulación o antiagregación, y consentimiento informado con los riesgos explicados (incluido el del acompañante o representante en menores). Si no se mencionó, indícalo; no lo des por obtenido."},
    {"key":"preparacion_y_anestesia","label":"Preparación y anestesia tópica","order":3,"required":false,
     "instruction":"Preparación del paciente, vasoconstrictor o anestésico tópico con nombre, concentración y forma de aplicación tal como se dictaron, y necesidad de sujeción en niños si se mencionó. Transcribe los medicamentos literal; nunca completes el esquema habitual."},
    {"key":"tecnica_y_hallazgos","label":"Técnica y hallazgos","order":4,"required":true,
     "instruction":"Técnica en el orden en que el médico la dictó y hallazgos: aspecto del conducto tras el lavado, tipo y localización del cuerpo extraño, punto sangrante y su ubicación, hallazgos de la nasofibrolaringoscopia con la movilidad cordal. Medidas y cantidades se transcriben literal."},
    {"key":"conducta_realizada","label":"Conducta realizada y material","order":5,"required":true,
     "instruction":"Qué se hizo finalmente (extracción completa o parcial, cauterización química o eléctrica, taponamiento anterior o posterior con el material y el tiempo de permanencia indicados, toma de muestra) y muestras enviadas a laboratorio o patología, solo si se mencionaron."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones inmediatas","order":6,"required":false,
     "instruction":"Tolerancia del paciente, dolor, sangrado, laceración del conducto, vértigo o reacción vagal durante el acto y cómo se manejaron, tal como se describieron. Si no se comentó nada, indícalo en vez de afirmar que no hubo complicaciones."},
    {"key":"indicaciones_posteriores","label":"Indicaciones posteriores","order":7,"required":true,
     "instruction":"Medicamentos con dosis y duración literales, cuidados del oído o de la nariz (no mojar, no sonarse, humidificación), cuándo se retira el taponamiento y restricciones de actividad. Transcribe todo tal como se dictó; no agregues cuidados que no se dieron."},
    {"key":"seguimiento_y_signos_de_alarma","label":"Seguimiento y signos de alarma","order":8,"required":true,
     "instruction":"Plazo del próximo control o del retiro del material, estudios que debe traer y los signos por los que debe consultar de urgencia según se le explicaron (sangrado que no cede, fiebre, dolor intenso, vértigo, dificultad respiratoria). Solo lo hablado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = 'a8f91694-df36-5f5d-a035-f84e77022d3e' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c4000000-0000-4000-8000-00000000000a', null,
   'Valoración de hipoacusia · otoscopia, audiometría e impedanciometría',
   'Consulta enfocada en pérdida auditiva: caracterización de la hipoacusia y síntomas asociados, exposición a ruido y ototóxicos, otoscopia, diapasones y resultados de audiometría e impedanciometría transcritos literal. Úsala en el estudio de hipoacusia, incluida la de origen ocupacional que soporta trámites ante EPS o ARL.',
   'otorrinolaringologia', 'Otorrinolaringología', 'institutional', false, 'active',
   '[
    {"key":"motivo_y_tiempo_de_evolucion","label":"Motivo y tiempo de evolución","order":1,"required":true,
     "instruction":"Motivo en las palabras del paciente y tiempo de evolución tal como lo refirió, junto con quién nota la pérdida (él, la familia, el trabajo) y quién lo remite. No estimes el tiempo si no se dijo."},
    {"key":"caracteristicas_de_la_hipoacusia","label":"Características de la hipoacusia","order":2,"required":false,
     "instruction":"Lado o si es bilateral, forma de instauración (súbita, progresiva, fluctuante), simetría percibida, dificultad en ambiente ruidoso o con el teléfono y necesidad de subir el volumen, tal como lo describió el paciente. Solo lo referido; no clasifiques la pérdida en esta sección."},
    {"key":"sintomas_asociados","label":"Síntomas asociados","order":3,"required":false,
     "instruction":"Tinnitus con su carácter y lado, vértigo con su duración y desencadenante, plenitud ótica, otalgia, otorrea, autofonía y algiacusia, según lo referido en la consulta. No listes como ausentes los síntomas que no se preguntaron."},
    {"key":"exposicion_a_ruido_y_ototoxicos","label":"Exposición a ruido y ototóxicos","order":4,"required":false,
     "instruction":"Exposición ocupacional a ruido con el oficio, los años y el uso de protección auditiva tal como los relató el trabajador, exposición recreativa, y medicamentos ototóxicos recibidos (aminoglucósidos, quimioterapia, diuréticos de asa) con lo que se mencionó. Si no se exploró, indícalo."},
    {"key":"antecedentes_oticos_y_familiares","label":"Antecedentes óticos y familiares","order":5,"required":false,
     "instruction":"Otitis a repetición, cirugías óticas, trauma craneal o acústico, meningitis, radioterapia, hipoacusia familiar y antecedentes perinatales si el paciente es menor, solo si se mencionaron. Si algún antecedente no se exploró, escríbelo así."},
    {"key":"otoscopia","label":"Otoscopia","order":6,"required":true,
     "instruction":"Otoscopia por oído: conducto (cerumen impactado, otorrea, estenosis), membrana timpánica con color, transparencia, retracción, perforación y su localización, y presencia de líquido. Si un oído no se visualizó o requirió lavado previo, escríbelo tal como ocurrió."},
    {"key":"pruebas_de_diapasones","label":"Pruebas con diapasones","order":7,"required":false,
     "instruction":"Weber con su lateralización y Rinne por oído EXACTAMENTE como los dictó el médico. Nunca deduzcas el patrón conductivo o neurosensorial a partir de ellos ni completes la prueba que no se realizó: si no se hicieron diapasones, indícalo."},
    {"key":"audiometria_e_impedanciometria","label":"Audiometría e impedanciometría","order":8,"required":true,
     "instruction":"Transcribe LITERAL lo que el médico leyó: umbrales por frecuencia y por oído en vía aérea y ósea, discriminación de la palabra, tipo de curva timpanométrica y reflejos, con la fecha del estudio. Nunca promedies umbrales, calcules PTA ni asignes el grado o el tipo de hipoacusia tú."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":9,"required":true,
     "instruction":"Diagnóstico con la precisión con que el médico lo formuló, incluidos el tipo, el grado y la posible causa SOLO si él los enunció, y los diferenciales que planteó. El origen ocupacional se consigna únicamente como el médico lo declaró; nunca lo califiques tú."},
    {"key":"plan_estudios_y_amplificacion","label":"Plan, estudios y amplificación","order":10,"required":true,
     "instruction":"Estudios solicitados (potenciales evocados, emisiones otoacústicas, tomografía, resonancia), medicamentos con dosis literal, indicación de audífono o de cirugía, terapia auditiva y remisión a la EPS, la ARL u otra especialidad, tal como se dictaron."},
    {"key":"educacion_y_proximo_control","label":"Educación y próximo control","order":11,"required":false,
     "instruction":"Recomendaciones de protección auditiva y estrategias de comunicación explicadas al paciente, y plazo del próximo control con los resultados que debe traer. Solo lo que efectivamente se le explicó en la consulta."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

update public.clinical_templates set
  name = 'Consulta inicial · síntomas urinarios, función sexual y estudios',
  description = 'Primera consulta urológica: síntomas del tracto urinario inferior, síntomas sexuales y reproductivos abordados con respeto, antecedentes urológicos, examen con genitales y tacto rectal, y laboratorios e imágenes transcritos literal. Úsala para el paciente nuevo o remitido a urología.',
  sections = '[
    {"key":"motivo_de_consulta","label":"Motivo de consulta","order":1,"required":true,
     "instruction":"Documenta el motivo en las palabras del paciente (orina muchas veces en la noche, le arde al orinar, le duele el costado) y quién lo remite. No lo traduzcas a un diagnóstico ni completes el motivo con los hallazgos posteriores."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":2,"required":true,
     "instruction":"Cronología: inicio y evolución, dolor con su localización e irradiación, hematuria y en qué momento de la micción, fiebre, expulsión de cálculos, retención y tratamientos ya recibidos con su respuesta. Solo lo referido por el paciente."},
    {"key":"sintomas_urinarios_bajos","label":"Síntomas urinarios de llenado y vaciamiento","order":3,"required":false,
     "instruction":"Frecuencia diurna, nicturia con el número de veces tal como lo dijo el paciente, urgencia, incontinencia y su tipo, y síntomas de vaciamiento (chorro débil, esfuerzo, intermitencia, goteo terminal, vaciamiento incompleto). Los puntajes de escalas se transcriben solo si el médico los enunció."},
    {"key":"sintomas_sexuales_y_reproductivos","label":"Síntomas sexuales y reproductivos","order":4,"required":false,
     "instruction":"Función eréctil, eyaculación, libido, dolor y planes reproductivos o estudio de infertilidad, documentados con respeto y solo si se abordaron en la consulta. Los puntajes de cuestionarios se transcriben literal únicamente si el médico los enunció; nunca los calcules."},
    {"key":"antecedentes_urologicos","label":"Antecedentes urológicos y generales","order":5,"required":false,
     "instruction":"Litiasis previas y su manejo, infecciones urinarias a repetición, cirugías urológicas, sondas o cateterismos, enfermedad renal, diabetes, hipertensión, medicamentos que afectan la micción y antecedente familiar de cáncer de próstata o renal. Si no se exploraron, indícalo."},
    {"key":"examen_fisico_urologico","label":"Examen físico urológico","order":6,"required":true,
     "instruction":"Abdomen con globo vesical y puñopercusión por lado, genitales externos (pene, meato, testículos con su tamaño y consistencia dictados, epidídimo, varicocele, hidrocele, hernia) y tacto rectal con tamaño, consistencia, surco medio, nódulos y dolor tal como se describieron. Si no se realizó, escríbelo."},
    {"key":"laboratorios_e_imagenes","label":"Laboratorios e imágenes aportados","order":7,"required":false,
     "instruction":"PSA con su valor, unidades y fecha, creatinina, uroanálisis, urocultivo con germen y sensibilidad, ecografía renal y de vías urinarias con el residuo posmiccional, tomografía o uroflujometría: transcribe todo LITERAL tal como el médico lo leyó. Nunca calcules ni normalices un resultado."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":8,"required":true,
     "instruction":"Razonamiento y diagnósticos con la precisión con que el médico los formuló, con lateralidad cuando aplique, y los diferenciales considerados. Clasificaciones y estadios solo si él los enunció; nunca los asignes tú a partir de las cifras registradas."},
    {"key":"plan_y_educacion","label":"Plan, estudios y educación","order":9,"required":true,
     "instruction":"Medicamentos con nombre, dosis y duración literales, ingesta de líquidos y medidas indicadas, estudios solicitados, programación de procedimiento o cirugía, remisión e incapacidad con los días exactos solo si se otorgó, más lo que se le explicó al paciente."},
    {"key":"proximo_control_y_signos_de_alarma","label":"Próximo control y signos de alarma","order":10,"required":false,
     "instruction":"Plazo del próximo control, resultados que debe traer y signos por los que debe consultar antes según se le explicaron (retención urinaria, fiebre con escalofrío, hematuria abundante, dolor incontrolable). Solo lo hablado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = 'd52ad5c3-27ae-5334-8d16-ad34189ab0f8' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · síntomas urinarios, PSA y función renal',
  description = 'Control urológico: evolución de los síntomas, adherencia y efectos adversos del tratamiento, resultados nuevos de PSA, función renal, uroflujometría o imágenes transcritos literal, examen dirigido y ajuste del plan. Úsala para el seguimiento de hiperplasia prostática, litiasis, vigilancia oncológica o posoperatorio.',
  sections = '[
    {"key":"diagnosticos_activos","label":"Diagnósticos activos y antecedente quirúrgico","order":1,"required":true,
     "instruction":"Diagnósticos activos con su tiempo de evolución, lateralidad cuando aplique, y procedimientos o cirugías previas con su fecha si se mencionaron. Consigna solo lo citado por el médico en esta consulta."},
    {"key":"intervalo_y_adherencia","label":"Intervalo, adherencia y efectos adversos","order":2,"required":false,
     "instruction":"Tiempo desde el último control, adherencia a los medicamentos con el esquema que refiere el paciente y efectos adversos mencionados (mareo o hipotensión ortostática, alteración de la eyaculación, boca seca, disminución de la libido). Si no se exploró la adherencia, indícalo."},
    {"key":"evolucion_de_sintomas","label":"Evolución de los síntomas urinarios","order":3,"required":false,
     "instruction":"Cambios en el chorro, el esfuerzo, la nicturia con el número de veces referido, la urgencia y la incontinencia, episodios de retención, infecciones o cólicos en el intervalo y expulsión de cálculos, tal como lo refirió el paciente. Solo lo mencionado."},
    {"key":"resultados_nuevos","label":"Resultados nuevos aportados","order":4,"required":false,
     "instruction":"PSA con valor, unidades y fecha, creatinina y tasa de filtración si se leyó, uroanálisis, urocultivo, uroflujometría con el flujo máximo y el residuo posmiccional, imágenes y patología: transcribe todo LITERAL. Nunca calcules velocidad de PSA, densidad ni tendencias por tu cuenta."},
    {"key":"examen_urologico_de_control","label":"Examen urológico de control","order":5,"required":true,
     "instruction":"Examen dirigido a la condición en seguimiento: abdomen y globo vesical, puñopercusión, genitales, tacto rectal con los hallazgos dictados, y estado de la herida, la sonda o el catéter si aplica. Compara con lo previo solo si el médico hizo esa comparación."},
    {"key":"evaluacion_de_metas","label":"Evaluación de metas y respuesta","order":6,"required":true,
     "instruction":"Evaluación de la respuesta al tratamiento y de las metas (síntomas, PSA, función renal, ausencia de recidiva) EXCLUSIVAMENTE como las enunció el médico. Nunca declares control, progresión ni necesidad de biopsia a partir de las cifras registradas."},
    {"key":"ajuste_del_plan","label":"Ajuste del plan y procedimientos","order":7,"required":true,
     "instruction":"Cambios de medicamento con dosis literal, estudios solicitados, programación de cistoscopia, biopsia o cirugía, cambio de sonda, remisión a la EPS o a otra especialidad e incapacidad con los días exactos solo si se otorgó. Transcribe lo dictado, sin completar esquemas."},
    {"key":"proximo_control_y_signos_de_alarma","label":"Próximo control y signos de alarma","order":8,"required":false,
     "instruction":"Plazo del próximo control, exámenes que debe traer y signos por los que debe consultar antes según se le explicaron (retención urinaria, fiebre, hematuria con coágulos, dolor lumbar intenso). Solo lo hablado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = '8e4e6053-7cb5-5ea8-aed2-16bb14f94014' and owner_id is null;

update public.clinical_templates set
  name = 'Valoración urológica · procedimiento en consultorio y cateterismo',
  description = 'Registro de procedimientos urológicos ambulatorios (cateterismo vesical y cambio de sonda, cistoscopia, biopsia de próstata, retiro de catéter, circuncisión menor): indicación, consentimiento, técnica con calibres y volúmenes literales, tolerancia e indicaciones posteriores.',
  sections = '[
    {"key":"indicacion_del_procedimiento","label":"Indicación del procedimiento","order":1,"required":true,
     "instruction":"Procedimiento realizado y su indicación tal como el médico la enunció, con el diagnóstico que lo motiva y la lateralidad cuando aplique. No deduzcas la indicación de los síntomas previos."},
    {"key":"verificacion_y_consentimiento","label":"Verificación de seguridad y consentimiento informado","order":2,"required":false,
     "instruction":"Verificación de identidad y del procedimiento, alergias (látex, anestésico, medio de contraste), anticoagulación, profilaxis antibiótica con el medicamento y la dosis dichos, y consentimiento informado con los riesgos explicados. Si no se mencionó, indícalo."},
    {"key":"asepsia_y_anestesia","label":"Asepsia, posición y anestesia","order":3,"required":false,
     "instruction":"Posición del paciente, antisepsia utilizada, campos estériles y anestésico local o gel de lidocaína con la cantidad y el tiempo de espera tal como se dictaron. Transcribe las dosis literal; nunca las completes con la práctica habitual."},
    {"key":"tecnica_y_hallazgos","label":"Técnica y hallazgos","order":4,"required":true,
     "instruction":"Técnica en el orden en que el médico la dictó y hallazgos del acto: calibre de la sonda en French, dificultad al paso, falsa vía, aspecto de la uretra y de la vejiga en la cistoscopia, lesiones vistas y número de cilindros de biopsia. Calibres, números y volúmenes se transcriben literal."},
    {"key":"conducta_y_material","label":"Conducta realizada, drenaje y muestras","order":5,"required":true,
     "instruction":"Qué quedó finalmente (sonda fijada con el volumen del balón dicho, catéter retirado, lavado vesical), volumen y aspecto de la orina drenada EXACTAMENTE como se dictaron, y muestras enviadas a patología o cultivo con su rótulo. Nunca estimes el volumen drenado."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones inmediatas","order":6,"required":false,
     "instruction":"Tolerancia del paciente, dolor, hematuria, reacción vagal, hipotensión o sangrado y cómo se manejaron, tal como se describieron. Si no se comentó nada al respecto, indícalo en vez de afirmar que no hubo complicaciones."},
    {"key":"indicaciones_posteriores","label":"Indicaciones posteriores y cuidados","order":7,"required":true,
     "instruction":"Medicamentos con dosis y duración literales, cuidados de la sonda y de la bolsa recolectora, ingesta de líquidos, restricciones de actividad y relaciones sexuales, e incapacidad con los días exactos solo si se otorgó. Transcribe lo dictado, sin agregar cuidados de rutina."},
    {"key":"seguimiento_y_signos_de_alarma","label":"Seguimiento y signos de alarma","order":8,"required":true,
     "instruction":"Cuándo vuelve para control, cambio de sonda o entrega de resultados, y los signos por los que debe consultar de urgencia según se le explicaron (fiebre con escalofrío, no drenaje de orina, hematuria con coágulos, dolor intenso). Solo lo hablado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = '2718d45c-79ad-5bcf-9a22-7a57f3cd58dd' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c4000000-0000-4000-8000-00000000000b', null,
   'Valoración prostática · síntomas urinarios bajos, tacto rectal y PSA',
   'Consulta enfocada en próstata: síntomas de llenado y vaciamiento con su impacto en la vida diaria, factores de riesgo, tacto rectal descrito tal como se dictó, PSA y ecografía con residuo posmiccional transcritos literal, y conducta (tratamiento, vigilancia o biopsia) como la definió el médico.',
   'urologia', 'Urología', 'institutional', false, 'active',
   '[
    {"key":"motivo_y_tiempo_de_evolucion","label":"Motivo y tiempo de evolución","order":1,"required":true,
     "instruction":"Motivo en las palabras del paciente y tiempo de evolución tal como lo refirió, indicando si consulta por síntomas o por un PSA alterado, y quién lo remite. No estimes el tiempo ni el motivo si no se enunciaron."},
    {"key":"sintomas_de_vaciamiento_y_llenado","label":"Síntomas de vaciamiento y de llenado","order":2,"required":false,
     "instruction":"Chorro débil, esfuerzo para iniciar, intermitencia, goteo terminal y sensación de vaciamiento incompleto; frecuencia, urgencia, incontinencia y nicturia con el número de veces tal como lo dijo el paciente. Transcribe las cifras que él dio; no las promedies."},
    {"key":"escala_de_sintomas","label":"Escala de síntomas referida","order":3,"required":false,
     "instruction":"Puntaje de IPSS, de calidad de vida o de cualquier otra escala EXCLUSIVAMENTE como lo enunció el médico, con su categoría si él la dijo. Nunca calcules, estimes ni clasifiques el puntaje a partir de los síntomas descritos; si no se aplicó escala, indícalo."},
    {"key":"impacto_en_la_vida_diaria","label":"Impacto en la vida diaria","order":4,"required":false,
     "instruction":"Cómo afectan los síntomas el sueño, el trabajo, los viajes y la vida sexual, y qué tanto le molestan según sus propias palabras. Solo lo que el paciente expresó; no infieras el grado de afectación."},
    {"key":"antecedentes_y_factores_de_riesgo","label":"Antecedentes y factores de riesgo","order":5,"required":false,
     "instruction":"Antecedente familiar de cáncer de próstata con el parentesco y la edad dichos, PSA y biopsias previas con su fecha y resultado, retención urinaria o infecciones previas, cirugías, y medicamentos que alteran el PSA o la micción (finasteride, dutasteride, anticolinérgicos). Si no se exploraron, indícalo."},
    {"key":"examen_y_tacto_rectal","label":"Examen físico y tacto rectal","order":6,"required":true,
     "instruction":"Abdomen con globo vesical y examen genital, y TACTO RECTAL descrito tal como lo dictó el médico: tamaño estimado por él, consistencia, superficie, surco medio, nódulos, límites y dolor. Nunca estimes el tamaño ni afirmes un hallazgo que él no haya enunciado; si no se realizó, escribe la razón."},
    {"key":"psa_y_laboratorios","label":"PSA y laboratorios","order":7,"required":true,
     "instruction":"PSA total y fracciones con su VALOR, unidades y fecha EXACTAMENTE como el médico los leyó, junto con creatinina, uroanálisis y urocultivo. Nunca calcules densidad, velocidad ni relación de PSA, y no lo interpretes como normal o alterado si el médico no lo dijo."},
    {"key":"ecografia_y_residuo","label":"Ecografía y residuo posmiccional","order":8,"required":false,
     "instruction":"Ecografía de próstata y vías urinarias: volumen prostático, residuo posmiccional, pared vesical, litiasis e hidronefrosis, y uroflujometría si se realizó, transcritos LITERAL con su fecha. Nunca conviertas volúmenes ni calcules el residuo por tu cuenta."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":9,"required":true,
     "instruction":"Diagnóstico con la precisión con que el médico lo formuló y los diferenciales que planteó. La sospecha de cáncer, la clasificación de riesgo o la indicación de biopsia se consignan solo si él las enunció; nunca las concluyas tú a partir del PSA o del tacto."},
    {"key":"plan_tratamiento_o_biopsia","label":"Plan: tratamiento, estudios o biopsia","order":10,"required":true,
     "instruction":"Medicamentos con nombre, dosis y duración literales, medidas conductuales indicadas, estudios solicitados (resonancia, uroflujometría, PSA de control con su plazo), programación de biopsia o de cirugía y remisión. Transcribe lo dictado; no propongas conductas que no se plantearon."},
    {"key":"control_y_signos_de_alarma","label":"Control, educación y signos de alarma","order":11,"required":false,
     "instruction":"Lo explicado al paciente sobre su condición, plazo del próximo control con los exámenes que debe traer y signos por los que debe consultar antes (retención urinaria, fiebre, hematuria). Solo lo hablado en la consulta."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

update public.clinical_templates set
  name = 'Consulta inicial · dolor facial, oclusión y estudio imagenológico',
  description = 'Primera consulta de cirugía oral y maxilofacial: dolor facial y de la articulación temporomandibular con la apertura oral medida, estado dental y oclusión, examen extraoral e intraoral con lesiones medidas literalmente e imágenes transcritas. Úsala para el paciente nuevo o remitido por odontología.',
  sections = '[
    {"key":"motivo_de_consulta","label":"Motivo de consulta","order":1,"required":true,
     "instruction":"Documenta el motivo en las palabras del paciente (le duele la quijada, no puede abrir la boca, tiene una bolita en la encía) y quién lo remite, con el lado comprometido tal como se dijo. Si no se precisó el lado, escríbelo así."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":2,"required":true,
     "instruction":"Cronología: inicio, evolución, dolor con su localización, carácter e irradiación, edema, fiebre, dificultad para abrir la boca o para tragar, trauma previo y tratamientos ya recibidos (antibióticos, analgésicos, procedimientos dentales) con su respuesta. Solo lo referido."},
    {"key":"dolor_facial_y_atm","label":"Dolor facial y articulación temporomandibular","order":3,"required":false,
     "instruction":"Dolor articular o muscular, chasquidos, bloqueos, desviación al abrir, bruxismo y dolor a la masticación, con la apertura oral en milímetros EXACTAMENTE como la midió y dictó el médico. Nunca estimes la apertura ni conviertas la descripción del paciente en milímetros."},
    {"key":"estado_dental_y_oclusion","label":"Estado dental y oclusión","order":4,"required":false,
     "instruction":"Piezas comprometidas con la nomenclatura que usó el médico, caries, restos radiculares, terceros molares, prótesis y estado periodontal, y oclusión con la clase o alteración SOLO si él la enunció. Nunca numeres una pieza ni clasifiques la oclusión por tu cuenta."},
    {"key":"antecedentes_medicos_y_odontologicos","label":"Antecedentes médicos y odontológicos","order":5,"required":false,
     "instruction":"Cirugías maxilofaciales u odontológicas previas, bifosfonatos o antirresortivos, radioterapia de cabeza y cuello, diabetes, anticoagulación, tabaquismo, alcohol, alergias a anestésicos o antibióticos e higiene oral. Si un antecedente no se exploró, indícalo."},
    {"key":"examen_extraoral","label":"Examen extraoral","order":6,"required":true,
     "instruction":"Simetría facial, edema con su localización y extensión descrita, eritema, puntos dolorosos, palpación de la articulación temporomandibular y de los músculos masticatorios, sensibilidad del trigémino por rama y adenopatías cervicales con el tamaño dictado. No completes lo no examinado."},
    {"key":"examen_intraoral","label":"Examen intraoral","order":7,"required":true,
     "instruction":"Mucosas, encía, piso de boca, lengua, paladar y trígono retromolar, con las lesiones descritas en localización, aspecto y TODAS las medidas transcritas literal como las dictó el médico; nunca las midas ni las estimes. Incluye trismus, fluctuación, drenaje y estado de las piezas involucradas."},
    {"key":"imagenes","label":"Imágenes aportadas","order":8,"required":false,
     "instruction":"Radiografía panorámica, periapical, tomografía o cone beam: transcribe el hallazgo y la conclusión LITERAL, con su fecha, tal como el médico los leyó (lesión radiolúcida, relación con el conducto dentario, trazo de fractura). No interpretes ni midas una imagen por tu cuenta."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":9,"required":true,
     "instruction":"Razonamiento y diagnósticos con la precisión con que el médico los formuló, con lateralidad y pieza cuando aplique, y los diferenciales considerados. Clasificaciones y sospecha de malignidad solo si él las enunció; nunca las concluyas tú."},
    {"key":"plan_y_proximo_control","label":"Plan, procedimientos y próximo control","order":10,"required":true,
     "instruction":"Medicamentos con nombre, dosis y duración literales, indicación de exodoncia, biopsia, drenaje o cirugía con su programación, estudios solicitados, remisión, dieta y cuidados explicados, incapacidad con los días exactos solo si se otorgó y plazo del próximo control."}
  ]'::jsonb,
  updated_at = now()
where id = 'ddd07f69-2e93-5cba-aced-909abe929a79' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · cicatrización, apertura oral y dolor',
  description = 'Control maxilofacial posterior a cirugía o a manejo médico: evolución del dolor y del edema, estado de la herida o el alveolo, apertura oral en milímetros, control imagenológico transcrito y ajuste del plan. Úsala para el posoperatorio de exodoncia, drenaje, biopsia u osteosíntesis y para patología en seguimiento.',
  sections = '[
    {"key":"diagnostico_y_procedimiento_previo","label":"Diagnóstico y procedimiento previo","order":1,"required":true,
     "instruction":"Diagnóstico con lado y pieza cuando aplique, procedimiento o cirugía realizada y su fecha, y días de posoperatorio tal como se enunciaron. No calcules los días si las fechas no se dijeron ni reconstruyas la técnica empleada."},
    {"key":"intervalo_y_adherencia","label":"Intervalo, adherencia y cuidados","order":2,"required":false,
     "instruction":"Si completó el antibiótico y la analgesia con el esquema que refiere, cumplimiento de la dieta blanda o líquida, higiene oral y enjuagues, y uso de hielo o de elásticos si se indicaron. Transcribe lo que el paciente dice hacer; no lo corrijas ni lo completes."},
    {"key":"evolucion_del_dolor_y_sintomas","label":"Evolución del dolor y de los síntomas","order":3,"required":false,
     "instruction":"Evolución del dolor con la intensidad que expresó el paciente, edema, fiebre, sangrado, mal sabor u olor, parestesia o adormecimiento del labio o la lengua y dificultad para alimentarse. Solo lo referido en la consulta."},
    {"key":"herida_y_cicatrizacion","label":"Herida, alveolo y cicatrización","order":4,"required":true,
     "instruction":"Estado de la herida o del alveolo: sutura íntegra o dehiscente, tejido de granulación, coágulo, exposición ósea, secreción, signos de infección y estado del material de osteosíntesis o del drenaje, tal como se describió. Si no se revisó la herida hoy, escríbelo así."},
    {"key":"apertura_oral_y_funcion","label":"Apertura oral, oclusión y función","order":5,"required":false,
     "instruction":"Apertura oral en milímetros EXACTAMENTE como la midió el médico, trismus, oclusión referida por el paciente y comparada solo si él hizo la comparación, y movimientos mandibulares. Nunca estimes los milímetros ni afirmes que la oclusión es la habitual."},
    {"key":"control_imagenologico","label":"Control imagenológico","order":6,"required":false,
     "instruction":"Radiografía o tomografía de control: transcribe LITERAL el hallazgo tal como el médico lo leyó, incluidos consolidación, posición del material de osteosíntesis y evolución de la lesión. Nunca afirmes consolidación ni midas por tu cuenta."},
    {"key":"analisis_y_metas","label":"Análisis y evaluación de la evolución","order":7,"required":true,
     "instruction":"Evaluación de la evolución con las palabras del médico: cicatrización adecuada, alveolitis, infección, retardo de consolidación o necesidad de reintervención se consignan solo si él las enunció. Nunca concluyas tú a partir de los hallazgos."},
    {"key":"ajuste_del_plan_y_proximo_control","label":"Ajuste del plan y próximo control","order":8,"required":true,
     "instruction":"Cambios de medicamento con dosis literal, curación o retiro de puntos realizado, ajuste de la dieta, terapia de apertura, retiro de material, remisión a odontología o a otra especialidad e incapacidad con los días exactos solo si se otorgó, más el plazo del próximo control."}
  ]'::jsonb,
  updated_at = now()
where id = '74de144e-d45a-57c0-a8f4-22ff043e41ec' and owner_id is null;

update public.clinical_templates set
  name = 'Valoración maxilofacial · procedimiento quirúrgico en consultorio',
  description = 'Registro de procedimientos maxilofaciales ambulatorios (exodoncia quirúrgica y de terceros molares, biopsia, drenaje de absceso, frenillectomía, retiro de material): indicación con la pieza y el lado, anestesia con dosis literal, técnica, muestras e indicaciones posteriores. Úsala el mismo día del procedimiento.',
  sections = '[
    {"key":"indicacion_y_sitio","label":"Indicación, pieza y lateralidad","order":1,"required":true,
     "instruction":"Procedimiento realizado con la pieza o la zona intervenida y el LADO, y su indicación tal como el médico la enunció. Usa la nomenclatura dental que él dictó; nunca numeres una pieza ni asignes lateralidad por tu cuenta."},
    {"key":"verificacion_y_consentimiento","label":"Verificación de seguridad y consentimiento informado","order":2,"required":false,
     "instruction":"Verificación de identidad, pieza y sitio, alergias a anestésicos o antibióticos, anticoagulación, uso de antirresortivos, profilaxis administrada con su dosis, y consentimiento informado con los riesgos explicados. Si no se mencionó, indícalo; no lo des por obtenido."},
    {"key":"anestesia_local","label":"Anestesia local","order":3,"required":false,
     "instruction":"Técnica anestésica (troncular, infiltrativa, intraligamentaria) y anestésico con nombre, concentración, presencia de vasoconstrictor y número de cartuchos o volumen EXACTAMENTE como se dictaron, con la aspiración negativa si se mencionó. Nunca calcules ni completes la dosis."},
    {"key":"tecnica_y_hallazgos","label":"Técnica y hallazgos","order":4,"required":true,
     "instruction":"Pasos en el orden en que el médico los dictó: incisión y colgajo, osteotomía, odontosección, luxación, exodoncia, curetaje, drenaje o toma de biopsia, con los hallazgos (anquilosis, fractura radicular, tejido patológico, cantidad de material purulento) transcritos tal como se describieron."},
    {"key":"conducta_y_material","label":"Hemostasia, sutura y muestras","order":5,"required":true,
     "instruction":"Hemostasia lograda, material de sutura con el calibre y el número de puntos dichos, uso de material de relleno o membrana, colocación de dren, y muestras enviadas a patología con su rótulo. Si no se tomó muestra, consígnalo así; no supongas el envío."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones inmediatas","order":6,"required":false,
     "instruction":"Tolerancia del paciente, sangrado, comunicación bucosinusal, fractura de la tabla, exposición o lesión del nervio dentario o lingual y cómo se manejaron, tal como se describieron. Si no se comentó nada, indícalo en vez de afirmar que no hubo complicaciones."},
    {"key":"indicaciones_posteriores","label":"Indicaciones posteriores y cuidados","order":7,"required":true,
     "instruction":"Medicamentos con nombre, dosis y duración literales, mordida de gasa con el tiempo indicado, hielo, dieta blanda y fría, no fumar, no succionar ni enjuagarse el primer día, higiene y reposo, e incapacidad con los días exactos solo si se otorgó. Transcribe lo dictado."},
    {"key":"seguimiento_y_signos_de_alarma","label":"Seguimiento y signos de alarma","order":8,"required":true,
     "instruction":"Cuándo vuelve para control, retiro de puntos o entrega del resultado de patología, y los signos por los que debe consultar de urgencia según se le explicaron (sangrado que no cede, edema progresivo, fiebre, dificultad para abrir la boca o para tragar). Solo lo hablado."}
  ]'::jsonb,
  updated_at = now()
where id = '3cb12fde-eba3-5eda-ace8-395f871ef4a3' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c4000000-0000-4000-8000-00000000000c', null,
   'Trauma facial · fracturas, oclusión y manejo inicial',
   'Atención del trauma facial agudo: mecanismo y hora, examen extraoral con escalones óseos y heridas medidas literalmente, valoración ocular y de la sensibilidad, oclusión referida por el paciente, hallazgo imagenológico transcrito sin clasificar y manejo inicial con plan quirúrgico o remisión.',
   'cirugia_maxilofacial', 'Cirugía oral y maxilofacial', 'institutional', false, 'active',
   '[
    {"key":"mecanismo_y_hora_del_trauma","label":"Mecanismo y hora del trauma","order":1,"required":true,
     "instruction":"Mecanismo tal como lo describieron el paciente o el acompañante (accidente de tránsito con su cinemática, agresión, caída, deportivo), hora o tiempo transcurrido y zona facial impactada. No reconstruyas el mecanismo ni atribuyas responsabilidades: es el relato de quien consulta."},
    {"key":"atencion_previa_y_estado_general","label":"Atención previa y estado general","order":2,"required":false,
     "instruction":"Atención recibida antes de esta consulta, institución que lo remite, pérdida de conciencia, vómito, amnesia del evento, estudios ya realizados y medicamentos aplicados con su dosis y hora. Registra los signos vitales solo con los valores dichos; si no se atendió antes, escríbelo."},
    {"key":"sintomas_y_alteraciones_funcionales","label":"Síntomas y alteraciones funcionales referidas","order":3,"required":false,
     "instruction":"Dolor con su localización, diplopía o visión borrosa, adormecimiento de la mejilla, el labio o los dientes, sensación de que los dientes no encajan igual, dificultad para abrir la boca, epistaxis y salida de líquido por la nariz, todo como lo refirió el paciente."},
    {"key":"examen_extraoral","label":"Examen extraoral","order":4,"required":true,
     "instruction":"Edema, equimosis y hematomas con su localización, deformidad y asimetría, escalones óseos palpables en reborde orbitario, malar, arco cigomático y mandíbula, crepitación, y heridas con su localización, profundidad y TODAS las medidas transcritas literal como las dictó el médico."},
    {"key":"examen_ocular_y_neurosensorial","label":"Examen ocular y sensibilidad facial","order":5,"required":false,
     "instruction":"Agudeza visual referida o medida tal como se dictó, movimientos oculares y diplopía, posición del globo, pupilas, hemorragia subconjuntival, telecanto, y sensibilidad por rama del trigémino (infraorbitaria, mentoniana). Si algún componente no se evaluó, escríbelo; no lo des por normal."},
    {"key":"examen_intraoral_y_oclusion","label":"Examen intraoral y oclusión","order":6,"required":true,
     "instruction":"Oclusión tal como la percibe el paciente y como la describió el médico, escalones y movilidad de segmentos, hematoma en piso de boca, laceraciones de mucosa, piezas fracturadas, luxadas o avulsionadas con la nomenclatura dictada, y apertura oral en milímetros literal."},
    {"key":"hallazgo_imagenologico","label":"Hallazgo imagenológico","order":7,"required":true,
     "instruction":"Transcribe LITERAL lo que el médico leyó de la tomografía, la panorámica o la radiografía: hueso comprometido, trazo, desplazamiento y compromiso de senos u órbita. No apliques ninguna clasificación de fractura facial por tu cuenta y no midas desplazamientos: solo lo enunciado."},
    {"key":"impresion_diagnostica","label":"Impresión diagnóstica","order":8,"required":true,
     "instruction":"Diagnóstico con la precisión con que el médico lo formuló, incluidas las lesiones asociadas y el compromiso de otros sistemas si él lo mencionó. Nunca concluyas un tipo de fractura ni agregues diagnósticos derivados de los hallazgos descritos."},
    {"key":"manejo_inicial_realizado","label":"Manejo inicial realizado","order":9,"required":true,
     "instruction":"Lo realizado en esta atención: control del sangrado, taponamiento, sutura de heridas con el material y el número de puntos dichos, reimplante o ferulización dental, inmovilización o bloqueo intermaxilar, y medicamentos (analgesia, antibiótico, toxoide) con dosis y vía literales."},
    {"key":"plan_quirurgico_o_remision","label":"Plan quirúrgico, remisión y ayuno","order":10,"required":true,
     "instruction":"Conducta definida: manejo conservador o cirugía con el plazo dicho, hospitalización o remisión con la institución y la especialidad mencionadas (oftalmología, neurocirugía), estudios pendientes, ayuno indicado e incapacidad con los días exactos solo si se otorgó. No decidas tú la conducta."},
    {"key":"educacion_y_signos_de_alarma","label":"Educación y signos de alarma","order":11,"required":false,
     "instruction":"Cuidados explicados al paciente (dieta blanda o líquida, higiene, no sonarse la nariz, frío local, posición) y signos por los que debe consultar de urgencia según se le dijeron (dificultad respiratoria, pérdida de visión, vómito persistente, fiebre, sangrado). Solo lo explicado."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();
