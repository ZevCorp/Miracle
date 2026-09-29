-- Por qué: renovación del catálogo de plantillas — lote del área 1 (medicina clínica, parte 2).
-- Las 24 plantillas de fábrica de estas 8 especialidades salían del generador genérico: pedían
-- "antecedentes" y "plan" sin nombrar nunca lo que define cada nota (hemograma y dosis de
-- anticoagulante, cultivos y antimicrobianos, TFG y estado de volemia, espirometría y técnica
-- inhalatoria, semiología del déficit y crisis, estadificación y toxicidad, actividad de
-- enfermedad, alérgenos y reacciones). Se reescriben las 3 de fábrica por especialidad y se
-- agrega una 4ª nueva por cada una, con guardas anti-alucinación reforzadas donde una cifra
-- inventada hace daño: dosis, laboratorios, escalas y estadios.
--
-- hematologia: "Consulta inicial · síndrome anémico, sangrado y hemograma alterado", "Control y
--   seguimiento · respuesta hematológica y toxicidad del tratamiento", "Valoración hematológica ·
--   aspirado y biopsia de médula ósea", 4ª: "Consulta de resultados y anticoagulación · ajuste de
--   dosis y riesgo de sangrado" — es la cita más repetida de la consulta hematológica y la de
--   mayor riesgo documental: la dosis y el INR mal transcritos causan sangrado o trombosis.
-- infectologia: "Consulta inicial · foco infeccioso, exposiciones y antimicrobianos previos",
--   "Control y seguimiento · respuesta antimicrobiana, cultivos y desescalamiento", "Valoración
--   infectológica · toma de muestras y terapia antimicrobiana parenteral", 4ª: "Control de VIH ·
--   carga viral, CD4 y terapia antirretroviral" — es la consulta crónica más frecuente del
--   infectólogo y exige un registro propio de adherencia, tamizajes y confidencialidad.
-- nefrologia: "Consulta inicial · función renal, volemia y estudio de proteinuria", "Control y
--   seguimiento · progresión de la enfermedad renal y metas", "Valoración renal · biopsia renal y
--   acceso para diálisis", 4ª: "Enfermedad renal crónica avanzada · preparación de terapia de
--   reemplazo renal" — la elección de modalidad y el acceso se deciden en una cita que hoy no
--   tenía plantilla y que es la de mayor peso médico-legal de la especialidad.
-- neumologia: "Consulta inicial · disnea, tos y exposición respiratoria", "Control y seguimiento ·
--   disnea, saturación y técnica inhalatoria", "Valoración respiratoria · procedimiento
--   diagnóstico y pruebas funcionales", 4ª: "Control de EPOC y asma · espirometría, control de
--   síntomas y oxígeno" — EPOC y asma son el grueso de la consulta y requieren dictar la
--   espirometría y la técnica inhalatoria con detalle que el control genérico no pedía.
-- neurologia: "Consulta inicial · semiología neurológica y cronología del déficit", "Control y
--   seguimiento · déficit, crisis y funcionalidad", "Valoración neurológica · procedimiento
--   diagnóstico o terapéutico", 4ª: "Seguimiento de epilepsia · registro de crisis y ajuste de
--   anticonvulsivantes" — el conteo de crisis, los niveles séricos y las restricciones (conducir,
--   embarazo) son el punto donde una alucinación tiene consecuencias directas.
-- oncologia: "Consulta inicial · diagnóstico oncológico, estadificación y estado funcional",
--   "Control y seguimiento · toxicidad, respuesta y soporte", "Valoración oncológica · aptitud
--   para el ciclo y administración de quimioterapia", 4ª: "Consulta de resultados y decisión
--   terapéutica · opciones, junta y consentimiento" — es la cita que define el tratamiento y
--   donde debe quedar por escrito qué se informó y qué eligió el paciente.
-- reumatologia: "Consulta inicial · dolor inflamatorio, articulaciones y compromiso sistémico",
--   "Control y seguimiento · actividad de enfermedad y tolerancia terapéutica", "Valoración
--   reumatológica · artrocentesis e infiltración articular", 4ª: "Terapia biológica · tamizaje
--   previo, aplicación y seguridad" — el tamizaje de tuberculosis y hepatitis antes del biológico
--   y el seguimiento de infecciones son obligatorios y no cabían en el control genérico.
-- alergologia: "Consulta inicial · desencadenantes, reacciones y antecedentes atópicos", "Control
--   y seguimiento · control de síntomas y exposición a alérgenos", "Valoración alergológica ·
--   pruebas cutáneas y estudio de hipersensibilidad", 4ª: "Inmunoterapia y prueba de reto
--   controlada · aplicación, tolerancia y reacción" — son procedimientos con riesgo de
--   anafilaxia: dosis, vial y tiempo de observación deben quedar transcritos literal.

update public.clinical_templates set
  name = 'Consulta inicial · síndrome anémico, sangrado y hemograma alterado',
  description = 'Primera valoración hematológica: cronología del síndrome anémico, del sangrado o de las adenopatías, antecedentes transfusionales y trombóticos, examen dirigido y lectura del hemograma tal como se dictó. Úsala cuando el paciente llega remitido por un hemograma alterado o por síntomas hematológicos aún sin estudio.',
  sections = '[
    {"key":"motivo_de_consulta","label":"Motivo de consulta y remisión","order":1,"required":true,
     "instruction":"Documenta el motivo en las palabras del paciente y quién lo remite (medicina general, urgencias, otro especialista, EPS), con el hallazgo que motivó la remisión tal como se enunció. No traduzcas el motivo a un diagnóstico hematológico."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":2,"required":true,
     "instruction":"Cronología del cuadro: astenia, disnea de esfuerzo, palidez, fiebre, sudoración nocturna, pérdida de peso, sangrados (epistaxis, gingivorragia, hipermenorrea, hematomas) con su magnitud, adenopatías o dolor óseo, tal como los refirió el paciente. Solo lo mencionado; no completes la revisión de síntomas B."},
    {"key":"antecedentes_hematologicos","label":"Antecedentes hematológicos y transfusionales","order":3,"required":false,
     "instruction":"Anemias previas y su manejo, transfusiones con número de unidades y reacciones, trombosis venosas o arteriales, pérdidas gestacionales a repetición, sangrado en cirugías o extracciones dentales y suplencia de hierro, B12 o ácido fólico. Si un antecedente no se exploró, indícalo."},
    {"key":"medicamentos_y_exposiciones","label":"Medicamentos y exposiciones","order":4,"required":false,
     "instruction":"Medicamentos en curso con la dosis tal como se dictó, en especial anticoagulantes, antiagregantes, AINE, quimioterápicos y antibióticos; exposición a benceno, solventes, pesticidas o radiación y consumo de alcohol. Transcribe las dosis literal, nunca las estimes ni las completes."},
    {"key":"antecedentes_familiares","label":"Antecedentes familiares","order":5,"required":false,
     "instruction":"Antecedentes familiares de anemia, hemofilia u otro trastorno de la coagulación, trombofilia, esplenectomía, linfoma o leucemia, con el parentesco tal como se mencionó. Si no se interrogaron, escríbelo así en vez de dejar la sección vacía."},
    {"key":"examen_fisico_hematologico","label":"Examen físico dirigido","order":6,"required":true,
     "instruction":"Palidez mucocutánea, ictericia, petequias, equimosis o hematomas con su localización, adenopatías con región, tamaño y consistencia tal como se describieron, y hepatomegalia o esplenomegalia en centímetros bajo el reborde solo si el médico los dictó. Nunca midas tú ni completes lo no examinado."},
    {"key":"hemograma_y_paraclinicos","label":"Hemograma y paraclínicos revisados","order":7,"required":false,
     "instruction":"Valores leídos en la consulta: hemoglobina, hematocrito, VCM, HCM, plaquetas, leucocitos y diferencial, reticulocitos, extendido de sangre periférica, ferritina, LDH y pruebas de coagulación, con la fecha dicha. Transcribe cada cifra literal; nunca la calcules, la interpoles ni la des por normal."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":8,"required":true,
     "instruction":"Razonamiento y diagnósticos con la precisión con que el médico los formuló (tipo de anemia, citopenia, sospecha de neoplasia hematológica) y los diferenciales que dejó planteados. No clasifiques, gradúes ni estadifiques por tu cuenta."},
    {"key":"plan_de_estudio_y_tratamiento","label":"Plan de estudio y tratamiento","order":9,"required":true,
     "instruction":"Estudios solicitados (mielograma, biopsia de médula ósea, electroforesis, estudio de trombofilia, imágenes), tratamiento con dosis y vía tal como se dictaron, transfusiones programadas y remisiones o autorizaciones ante la EPS. Transcribe las dosis literal, sin recalcularlas."},
    {"key":"proximo_control_y_alarmas","label":"Próximo control y signos de alarma","order":10,"required":false,
     "instruction":"Cuándo vuelve a control y con qué resultados, e incapacidad con los días exactos solo si se otorgó. Registra los signos de alarma explicados (fiebre, sangrado que no cede, disnea en reposo, hematomas espontáneos) únicamente como se dieron en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = 'f82feb7d-b70c-5915-b25d-0e26199dfcd6' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · respuesta hematológica y toxicidad del tratamiento',
  description = 'Control del paciente hematológico ya en tratamiento: adherencia, síntomas del intervalo, toxicidad, requerimiento transfusional, hemograma de control transcrito literal y evaluación de la respuesta. Úsala para el seguimiento de anemias, citopenias y neoplasias hematológicas en manejo, no para la primera valoración.',
  sections = '[
    {"key":"diagnosticos_activos","label":"Diagnósticos activos y esquema en curso","order":1,"required":true,
     "instruction":"Diagnósticos hematológicos activos con su tiempo de evolución, línea de tratamiento y esquema vigente con las dosis tal como el médico los enunció. Si el diagnóstico sigue en estudio, consígnalo así; no lo cierres tú."},
    {"key":"intervalo_y_adherencia","label":"Intervalo y adherencia","order":2,"required":false,
     "instruction":"Tiempo desde el último control, adherencia al tratamiento (dosis omitidas, suspensiones, demoras de autorización con la EPS) y suplementos que continúa. Solo lo referido por el paciente; si la adherencia no se exploró, indícalo."},
    {"key":"sintomas_y_sangrado","label":"Síntomas del intervalo y eventos de sangrado","order":3,"required":false,
     "instruction":"Astenia, disnea, palpitaciones, fiebre y dolor óseo del intervalo, y episodios de sangrado con sitio, magnitud y duración tal como los describió el paciente. Registra transfusiones recibidas fuera de la consulta solo si se mencionaron."},
    {"key":"toxicidad_y_transfusiones","label":"Toxicidad, infecciones y transfusiones","order":4,"required":false,
     "instruction":"Efectos adversos referidos (náusea, mucositis, neuropatía, neutropenia febril), hospitalizaciones del intervalo y transfusiones con el número de unidades y las reacciones tal como se dijeron. Transcribe cifras y unidades literal; no las estimes ni las sumes."},
    {"key":"hemograma_de_control","label":"Hemograma y paraclínicos de control","order":5,"required":false,
     "instruction":"Resultados nuevos leídos en la consulta: hemoglobina, plaquetas, neutrófilos absolutos, reticulocitos, LDH, ferritina y función renal o hepática, con la fecha dicha. Transcríbelos literal; no compares con cifras previas que el médico no haya citado ni reconstruyas tendencias."},
    {"key":"examen_fisico_de_control","label":"Examen físico de control","order":6,"required":true,
     "instruction":"Examen dirigido: palidez, ictericia, lesiones purpúricas, adenopatías y visceromegalias con las medidas dichas, y estado del catéter o acceso venoso si se revisó. No completes hallazgos de sistemas que no se examinaron."},
    {"key":"evaluacion_de_respuesta","label":"Evaluación de la respuesta","order":7,"required":true,
     "instruction":"Valoración de la respuesta con las palabras del médico (respuesta completa o parcial, refractariedad, recaída, remisión) y estado funcional o ECOG solo si él lo enunció. Nunca definas la categoría de respuesta ni asignes el puntaje por tu cuenta."},
    {"key":"ajuste_del_plan_y_proximo_control","label":"Ajuste del plan y próximo control","order":8,"required":true,
     "instruction":"Cambios de dosis o de esquema con las cifras exactas dictadas, transfusiones o factores estimulantes ordenados, nuevos paraclínicos, remisiones y autorizaciones, incapacidad con los días dichos, y fecha del próximo control con lo que debe traer el paciente."}
  ]'::jsonb,
  updated_at = now()
where id = '404d849b-fb11-5b60-b6dd-86a68b25cd78' and owner_id is null;

update public.clinical_templates set
  name = 'Valoración hematológica · aspirado y biopsia de médula ósea',
  description = 'Registro del procedimiento hematológico realizado: aspirado o biopsia de médula ósea, punción lumbar con quimioterapia intratecal o transfusión, con indicación, consentimiento, estado hemostático, técnica, muestras enviadas y tolerancia. Úsala solo cuando el procedimiento se ejecuta, no en la consulta que lo indica.',
  sections = '[
    {"key":"indicacion_del_procedimiento","label":"Indicación del procedimiento","order":1,"required":true,
     "instruction":"Procedimiento realizado y su indicación tal como la enunció el médico (estudio de citopenia, estadificación, control de respuesta, soporte transfusional). No deduzcas la indicación del diagnóstico ni la amplíes."},
    {"key":"verificacion_y_consentimiento","label":"Verificación de seguridad y consentimiento","order":2,"required":false,
     "instruction":"Identificación del paciente, consentimiento informado con los riesgos explicados, ayuno, alergias y verificación del sitio, tal como se registró. Si el consentimiento no se mencionó, indícalo; no lo des por obtenido."},
    {"key":"estado_hemostatico_previo","label":"Estado hemostático y preparación previa","order":3,"required":false,
     "instruction":"Plaquetas, INR o TTP previos y suspensión de anticoagulantes o antiagregantes con los días dichos, además de premedicación o sedación con dosis. Transcribe cada cifra y cada dosis literal; nunca las estimes ni asumas que se suspendió lo que no se dijo."},
    {"key":"tecnica_y_sitio","label":"Técnica, sitio y asepsia","order":4,"required":true,
     "instruction":"Sitio y lateralidad (cresta ilíaca posterosuperior u otro), asepsia, anestesia local con el fármaco y la cantidad dictados, agujas empleadas y número de punciones, en el orden en que el médico lo describió. No completes pasos de técnica que no se narraron."},
    {"key":"hallazgos_y_muestras","label":"Hallazgos y muestras obtenidas","order":5,"required":true,
     "instruction":"Aspecto del aspirado, calidad del cilindro o material obtenido y hallazgos macroscópicos, con las muestras enviadas y su destino (morfología, citometría, citogenética, cultivo, patología) tal como se dictaron. En transfusiones, registra hemocomponente, unidades y volumen literal."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones inmediatas","order":6,"required":false,
     "instruction":"Tolerancia del paciente, dolor referido, signos vitales durante y después del procedimiento con los valores dichos, sangrado en el sitio y reacciones transfusionales. Si no hubo complicaciones, escríbelo solo si el médico lo afirmó."},
    {"key":"indicaciones_posteriores","label":"Indicaciones posteriores","order":7,"required":true,
     "instruction":"Cuidados del sitio de punción, reposo, reinicio de anticoagulantes con la fecha y la dosis dictadas, analgesia con dosis literal y signos por los que debe consultar de urgencia, tal como se explicaron. No agregues recomendaciones estándar."},
    {"key":"seguimiento_y_resultados","label":"Seguimiento y entrega de resultados","order":8,"required":false,
     "instruction":"Cuándo estarán los resultados y cómo se entregan, próxima cita o procedimiento programado y remisiones derivadas, solo como se acordó en la consulta. No fijes plazos que nadie mencionó."}
  ]'::jsonb,
  updated_at = now()
where id = '37016e6a-c90a-5ae0-bdb0-5d15d015680a' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c1000000-0000-4000-8000-000000000009', null,
   'Consulta de resultados y anticoagulación · ajuste de dosis y riesgo de sangrado',
   'Cita centrada en revisar resultados y manejar la anticoagulación: INR o control del anticoagulante directo transcritos literal, eventos de sangrado o trombosis, interacciones y ajuste de dosis tal como lo dictó el médico. Úsala cuando el eje de la consulta son los laboratorios y la dosis, no la valoración clínica completa.',
   'hematologia', 'Hematología', 'institutional', false, 'active',
   '[
    {"key":"motivo_y_resultados_a_revisar","label":"Motivo de la cita y resultados a revisar","order":1,"required":true,
     "instruction":"Qué resultados trae el paciente y qué motiva la revisión, con la fecha de cada examen tal como se enunció. Si un resultado pedido no fue traído o quedó pendiente de autorización en la EPS, consígnalo así."},
    {"key":"indicacion_y_tiempo_de_anticoagulacion","label":"Indicación y tiempo de anticoagulación","order":2,"required":false,
     "instruction":"Indicación del anticoagulante (fibrilación auricular, trombosis venosa profunda, embolia pulmonar, válvula mecánica, trombofilia), fecha de inicio y duración prevista, tal como las enunció el médico. No asumas la duración ni la indicación si no se dijeron."},
    {"key":"resultados_de_laboratorio","label":"Resultados de laboratorio","order":3,"required":true,
     "instruction":"INR y rango meta, TP y TTP, hemograma con hemoglobina y plaquetas, creatinina o depuración y anti-Xa cuando se hayan leído, cada uno con su fecha. Transcribe TODAS las cifras literal: nunca las calcules, las conviertas ni las promedies, y no des por normal lo que no se leyó."},
    {"key":"eventos_hemorragicos","label":"Eventos hemorrágicos del intervalo","order":4,"required":false,
     "instruction":"Sangrados desde el último control con sitio, magnitud, duración y si requirieron atención o transfusión (gingivorragia, epistaxis, hematuria, melenas, hematomas, sangrado menstrual abundante), tal como los describió el paciente. Solo lo referido."},
    {"key":"eventos_tromboticos","label":"Síntomas y eventos trombóticos","order":5,"required":false,
     "instruction":"Síntomas sugestivos de trombosis o embolia referidos en el intervalo (edema y dolor en miembro, disnea súbita, dolor torácico, déficit neurológico) y estudios realizados por ellos. Registra solo lo que se mencionó; no infieras el evento a partir de los laboratorios."},
    {"key":"adherencia_e_interacciones","label":"Adherencia, interacciones y dieta","order":6,"required":false,
     "instruction":"Toma del anticoagulante (dosis omitidas, horario, uso de pastillero), medicamentos nuevos que puedan interactuar (antibióticos, AINE, antifúngicos, herbales) y cambios de dieta o de consumo de alcohol. Transcribe los nombres y las dosis tal como se dijeron."},
    {"key":"examen_fisico_dirigido","label":"Examen físico dirigido","order":7,"required":false,
     "instruction":"Signos vitales con los valores dichos, palidez, lesiones purpúricas o hematomas con su localización y examen de miembros inferiores si se realizó. No completes hallazgos de un examen que no se hizo."},
    {"key":"analisis_y_control_de_la_meta","label":"Análisis y control de la meta","order":8,"required":true,
     "instruction":"Valoración del control de la anticoagulación con las palabras del médico (en meta, subterapéutico, supraterapéutico, riesgo de sangrado) y su razonamiento. Nunca clasifiques el control ni calcules tiempo en rango terapéutico por tu cuenta."},
    {"key":"ajuste_de_dosis_y_plan","label":"Ajuste de dosis y plan","order":9,"required":true,
     "instruction":"Dosis indicada tal como fue dictada (miligramos, días de la semana, dosis semanal total, suspensión o reversión) transcrita LITERAL: nunca la recalcules, redondees ni completes la que falte. Añade nuevos exámenes, remisiones y manejo del sangrado si se ordenó."},
    {"key":"educacion_y_proximo_control","label":"Educación y próximo control","order":10,"required":false,
     "instruction":"Educación dada sobre signos de sangrado, cuidado ante procedimientos odontológicos o cirugías, y cuándo repetir el control con qué examen. Registra únicamente lo que se explicó en la consulta; no agregues recomendaciones de rutina."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();
update public.clinical_templates set
  name = 'Consulta inicial · foco infeccioso, exposiciones y antimicrobianos previos',
  description = 'Primera valoración infectológica: curva febril y búsqueda del foco, historia de exposiciones y viajes, estado de inmunosupresión, antimicrobianos ya recibidos y cultivos disponibles transcritos literal. Úsala en el paciente remitido por fiebre, infección de manejo difícil o hallazgo microbiológico sin estudio previo.',
  sections = '[
    {"key":"motivo_y_remision","label":"Motivo de consulta y remisión","order":1,"required":true,
     "instruction":"Motivo en las palabras del paciente y quién remite (hospitalización, urgencias, EPS, otro especialista), con la pregunta concreta que se le hace al infectólogo tal como se enunció. No la reformules como diagnóstico."},
    {"key":"enfermedad_actual","label":"Enfermedad actual y curva febril","order":2,"required":true,
     "instruction":"Cronología del cuadro: inicio, fiebre con las cifras y el patrón referidos, escalofrío, síntomas localizadores por aparatos, pérdida de peso y evolución con los tratamientos ya recibidos. Transcribe las temperaturas tal como se dijeron; no las estimes ni describas un patrón que nadie mencionó."},
    {"key":"exposiciones_y_epidemiologia","label":"Exposiciones y antecedentes epidemiológicos","order":3,"required":false,
     "instruction":"Viajes y zonas visitadas con fechas, contacto con animales, picaduras, consumo de agua o alimentos de riesgo, actividad laboral, contactos enfermos, tuberculosis en el entorno y conductas de riesgo, tal como los relató el paciente. Si no se interrogaron, indícalo; no supongas exposiciones por la región."},
    {"key":"estado_de_inmunosupresion","label":"Estado de inmunosupresión y comorbilidades","order":4,"required":false,
     "instruction":"Condiciones que comprometen la inmunidad mencionadas: VIH con su último control, diabetes, cirrosis, cáncer o quimioterapia, trasplante, esteroides o inmunomoduladores con dosis, esplenectomía, neutropenia y catéteres o dispositivos implantados. Transcribe las dosis literal; no infieras inmunosupresión."},
    {"key":"antimicrobianos_previos_y_alergias","label":"Antimicrobianos previos y alergias","order":5,"required":false,
     "instruction":"Antimicrobianos recibidos con nombre, dosis, vía y días de tratamiento tal como se dictaron, respuesta obtenida, hospitalizaciones recientes y alergias con la reacción descrita. Transcribe los esquemas literal; nunca los completes ni asumas que un ciclo se cumplió."},
    {"key":"examen_fisico_infectologico","label":"Examen físico en busca del foco","order":6,"required":true,
     "instruction":"Signos vitales con los valores dichos, estado general, piel y tejidos blandos, sitios de catéter o herida quirúrgica, orofaringe, adenopatías, auscultación cardiopulmonar (soplos), abdomen, examen neurológico y osteoarticular, según lo explorado. No completes sistemas no examinados."},
    {"key":"cultivos_y_paraclinicos","label":"Cultivos, imágenes y paraclínicos","order":7,"required":false,
     "instruction":"Hemocultivos, urocultivo, cultivos de secreciones o líquidos con el germen aislado y el antibiograma, PCR moleculares, serologías, reactantes de fase aguda e imágenes, cada uno con su fecha. Transcribe germen, sensibilidad y cifras LITERAL; nunca deduzcas el microorganismo ni des por negativo un cultivo pendiente."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":8,"required":true,
     "instruction":"Razonamiento sobre el foco probable, el microorganismo sospechado y los diferenciales, exactamente como el médico los planteó. No afirmes etiología, resistencia ni severidad que él no haya enunciado."},
    {"key":"plan_antimicrobiano","label":"Plan antimicrobiano y estudios","order":9,"required":true,
     "instruction":"Antimicrobianos indicados con nombre, dosis, vía, intervalo y duración tal como se dictaron: transcríbelos LITERAL, sin ajustar por peso ni por función renal y sin completar la duración que falte. Añade cultivos y estudios solicitados, drenajes o retiro de dispositivos y remisiones."},
    {"key":"aislamiento_control_y_alarmas","label":"Aislamiento, notificación, control y alarmas","order":10,"required":false,
     "instruction":"Medidas de aislamiento o precauciones, notificación a salud pública y estudio de contactos solo si se mencionaron, incapacidad con los días dichos, próximo control y signos de alarma explicados al paciente. No agregues medidas de rutina que nadie indicó."}
  ]'::jsonb,
  updated_at = now()
where id = '4c2e7f2d-e7a4-5a89-90bb-24804bbadeda' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · respuesta antimicrobiana, cultivos y desescalamiento',
  description = 'Seguimiento del paciente con infección en tratamiento: evolución de la fiebre y del foco, resultados microbiológicos nuevos, toxicidad del antimicrobiano y decisión de continuar, desescalar o suspender con los días exactos dictados. Úsala para los controles de infecciones agudas o en manejo antimicrobiano prolongado.',
  sections = '[
    {"key":"diagnostico_y_esquema_vigente","label":"Diagnóstico infeccioso y esquema vigente","order":1,"required":true,
     "instruction":"Diagnóstico infeccioso con el foco y el germen documentado si lo hay, y esquema antimicrobiano en curso con dosis, vía y día de tratamiento tal como se enunciaron. Transcribe el día de tratamiento literal; no lo calcules a partir de fechas."},
    {"key":"evolucion_clinica","label":"Evolución clínica y curva febril","order":2,"required":false,
     "instruction":"Evolución desde el último control: persistencia o resolución de la fiebre con las cifras referidas, síntomas del foco, apetito y estado general, tal como los describió el paciente. Solo lo mencionado; no concluyas mejoría que el médico no haya afirmado."},
    {"key":"adherencia_y_administracion","label":"Adherencia y administración del tratamiento","order":3,"required":false,
     "instruction":"Cumplimiento del esquema, dosis omitidas, dificultades de acceso o autorización ante la EPS, tolerancia de la vía oral y estado del acceso venoso o del catéter si se administra parenteral. Registra solo lo referido en la consulta."},
    {"key":"toxicidad_antimicrobiana","label":"Toxicidad y efectos adversos","order":4,"required":false,
     "instruction":"Efectos adversos referidos (diarrea, rash, náusea, ototoxicidad, tendinopatía, flebitis) y alteraciones de laboratorio atribuidas al antimicrobiano, como creatinina o transaminasas, con los valores dichos. Transcribe las cifras literal; no atribuyas causalidad que el médico no haya enunciado."},
    {"key":"resultados_microbiologicos","label":"Cultivos, antibiograma y paraclínicos nuevos","order":5,"required":false,
     "instruction":"Resultados nuevos leídos en la consulta: germen aislado, antibiograma con sensibilidad y resistencia, cultivos de control, reactantes de fase aguda e imágenes, con su fecha. Transcríbelos LITERAL; nunca infieras sensibilidad ni des por negativo un cultivo pendiente."},
    {"key":"examen_fisico_de_control","label":"Examen físico de control","order":6,"required":true,
     "instruction":"Signos vitales con los valores dichos y examen del foco: herida o sitio quirúrgico, piel y tejidos blandos, auscultación, abdomen o sitio de catéter, según lo explorado hoy. No completes sistemas no examinados ni repitas hallazgos previos como si fueran actuales."},
    {"key":"evaluacion_de_respuesta","label":"Evaluación de la respuesta al tratamiento","order":7,"required":true,
     "instruction":"Valoración de la respuesta con las palabras del médico (respuesta adecuada, falla terapéutica, sobreinfección, resistencia). No declares curación ni fracaso por tu cuenta ni a partir de las cifras."},
    {"key":"ajuste_del_esquema","label":"Ajuste del esquema antimicrobiano","order":8,"required":true,
     "instruction":"Decisión sobre el tratamiento tal como se dictó: continuar, desescalar, rotar, pasar a vía oral o suspender, con nombre, dosis, vía y DÍAS TOTALES exactos. Transcríbelo literal, nunca calcules la fecha de finalización ni ajustes la dosis. Incluye nuevos estudios, drenajes y remisiones."},
    {"key":"proximo_control_y_alarmas","label":"Próximo control y signos de alarma","order":9,"required":false,
     "instruction":"Cuándo vuelve y con qué exámenes o cultivos de control, incapacidad con los días dichos y signos de alarma explicados (fiebre que reaparece, dolor creciente, secreción, dificultad respiratoria). Solo la educación dada en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = '3327445a-1886-512d-b5b1-f2d24c9e1dc6' and owner_id is null;

update public.clinical_templates set
  name = 'Valoración infectológica · toma de muestras y terapia antimicrobiana parenteral',
  description = 'Registro del acto realizado por infectología: toma de muestras para cultivo o biopsia, punción o drenaje de colección, inicio de terapia antimicrobiana parenteral ambulatoria o profilaxis posexposición, con indicación, consentimiento, técnica, tolerancia e indicaciones posteriores. Úsala solo cuando el procedimiento se ejecuta.',
  sections = '[
    {"key":"indicacion_y_contexto","label":"Indicación y contexto del procedimiento","order":1,"required":true,
     "instruction":"Procedimiento realizado y su indicación tal como la enunció el médico (aislamiento del germen, drenaje del foco, inicio de terapia parenteral ambulatoria, profilaxis posexposición). No amplíes la indicación ni la deduzcas del diagnóstico."},
    {"key":"consentimiento_y_verificacion","label":"Consentimiento y verificación previa","order":2,"required":false,
     "instruction":"Consentimiento informado con los riesgos explicados, verificación de identidad, sitio y lateralidad, alergias a antimicrobianos o antisépticos y estado de coagulación si se revisó. Si el consentimiento no se mencionó, indícalo; no lo des por obtenido."},
    {"key":"preparacion_y_bioseguridad","label":"Preparación y medidas de bioseguridad","order":3,"required":false,
     "instruction":"Asepsia, antiséptico empleado, elementos de protección y precauciones de aislamiento aplicadas, y premedicación o anestesia local con el fármaco y la cantidad dictados. Transcribe las dosis literal; no completes pasos que no se narraron."},
    {"key":"tecnica_y_hallazgos","label":"Técnica y hallazgos","order":4,"required":true,
     "instruction":"Descripción del procedimiento en el orden en que se dictó: sitio y lateralidad, abordaje, material empleado y hallazgos macroscópicos (aspecto y volumen del líquido o del material drenado). Transcribe volúmenes y medidas literal; nunca los estimes tú."},
    {"key":"muestras_y_destino","label":"Muestras tomadas y su destino","order":5,"required":true,
     "instruction":"Muestras obtenidas con el tipo y el número de frascos, y los estudios solicitados en cada una (Gram, cultivo, micológico, BK y cultivo para micobacterias, PCR, patología), tal como se dictaron. Si una muestra fue insuficiente o no se tomó, consígnalo así."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones inmediatas","order":6,"required":false,
     "instruction":"Tolerancia del paciente, signos vitales durante y después con los valores dichos, dolor, sangrado y reacciones al antimicrobiano o al antiséptico. Afirma ausencia de complicaciones solo si el médico lo declaró."},
    {"key":"indicaciones_posteriores","label":"Indicaciones posteriores y esquema","order":7,"required":true,
     "instruction":"Cuidados del sitio, esquema antimicrobiano con nombre, dosis, vía, intervalo y duración transcritos LITERAL, cuidados del catéter si quedó instalado y signos por los que debe consultar. No recalcules dosis ni agregues cuidados de rutina."},
    {"key":"seguimiento_y_resultados","label":"Seguimiento y entrega de resultados","order":8,"required":false,
     "instruction":"Cuándo estarán los cultivos o la patología y cómo se informan, próxima cita o curación programada, y notificación o estudio de contactos solo si se mencionaron. No fijes plazos que nadie dijo."}
  ]'::jsonb,
  updated_at = now()
where id = 'f649b41b-27de-5525-b612-c9963fb2e196' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c1000000-0000-4000-8000-00000000000a', null,
   'Control de VIH · carga viral, CD4 y terapia antirretroviral',
   'Control del paciente con VIH u otra infección crónica en manejo: adherencia al antirretroviral, carga viral y CD4 transcritos literal, tolerancia, tamizaje de infecciones de transmisión sexual y coinfecciones, y ajuste del esquema. Úsala para los controles programados del programa, no para la primera valoración.',
   'infectologia', 'Infectología', 'institutional', false, 'active',
   '[
    {"key":"contexto_del_control","label":"Contexto del control y esquema vigente","order":1,"required":true,
     "instruction":"Tiempo desde el diagnóstico, esquema antirretroviral vigente con los fármacos y las dosis tal como se enunciaron, y tiempo en ese esquema. Transcribe el esquema literal; no lo abrevies con siglas que el médico no usó."},
    {"key":"adherencia","label":"Adherencia al tratamiento","order":2,"required":false,
     "instruction":"Adherencia referida: dosis omitidas en el último mes, horario, interrupciones y sus causas, entrega oportuna de los medicamentos por la EPS y apoyo del programa. Registra solo lo dicho; no estimes porcentajes de adherencia que el paciente no haya referido."},
    {"key":"sintomas_y_eventos_del_intervalo","label":"Síntomas y eventos del intervalo","order":3,"required":false,
     "instruction":"Síntomas del intervalo: fiebre, pérdida de peso, diarrea, tos, lesiones en piel o mucosas, síntomas neurológicos, y hospitalizaciones o infecciones oportunistas con su manejo. Todo tal como lo refirió el paciente; no infieras deterioro a partir de los laboratorios."},
    {"key":"tolerancia_y_efectos_adversos","label":"Tolerancia y efectos adversos","order":4,"required":false,
     "instruction":"Efectos adversos referidos (náusea, insomnio, sueños vívidos, cambios de peso, dislipidemia, alteración renal u ósea) y su relación temporal con el esquema, además de medicamentos nuevos con riesgo de interacción. Transcribe nombres y dosis tal como se dijeron."},
    {"key":"carga_viral_y_cd4","label":"Carga viral, CD4 y paraclínicos","order":5,"required":true,
     "instruction":"Carga viral con el valor y la fecha exactos (indetectable o el número de copias tal como se leyó), recuento y porcentaje de CD4, hemograma, función renal y hepática y perfil lipídico. Transcribe TODO literal: nunca conviertas a logaritmos, no compares con previos que no se citaron ni des por indetectable lo pendiente."},
    {"key":"tamizajes_y_coinfecciones","label":"Tamizajes, coinfecciones y vacunación","order":6,"required":false,
     "instruction":"Tamizaje de sífilis, hepatitis B y C, tuberculosis y otras infecciones de transmisión sexual con sus resultados y fechas, citología cervical o anal si se mencionó, y vacunación aplicada o pendiente. Transcribe resultados literal; si un tamizaje no se hizo, escríbelo así."},
    {"key":"salud_sexual_y_apoyo","label":"Salud sexual, planificación y red de apoyo","order":7,"required":false,
     "instruction":"Prácticas de prevención, uso de preservativo, estado de la pareja y su vinculación al programa, planificación o deseo de embarazo, consumo de sustancias, salud mental y red de apoyo, únicamente si se abordaron en la consulta. Escribe con respeto y sin juicios de valor."},
    {"key":"examen_fisico","label":"Examen físico dirigido","order":8,"required":true,
     "instruction":"Peso y signos vitales con los valores dichos, piel y mucosas, cavidad oral, adenopatías, examen cardiopulmonar, abdominal, genital y neurológico según lo explorado. No completes lo que no se examinó."},
    {"key":"analisis_y_metas","label":"Análisis y metas del control","order":9,"required":true,
     "instruction":"Valoración del control con las palabras del médico (supresión virológica, falla virológica, recuperación inmunológica, sospecha de resistencia) y sus diferenciales. Nunca declares falla ni resistencia por tu cuenta a partir de las cifras."},
    {"key":"plan_y_proximo_control","label":"Ajuste del plan y próximo control","order":10,"required":true,
     "instruction":"Continuidad o cambio del esquema con fármacos y dosis transcritos LITERAL, profilaxis indicadas, exámenes solicitados, remisiones (psicología, nutrición, ginecología) y fórmula o autorización ante la EPS. Cierra con la fecha del próximo control y con qué debe volver."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();
update public.clinical_templates set
  name = 'Consulta inicial · función renal, volemia y estudio de proteinuria',
  description = 'Primera valoración nefrológica: cronología del deterioro de la función renal o del edema, exposición a nefrotóxicos, examen con estado de volemia y presión arterial, y lectura literal de creatinina, TFG, uroanálisis y proteinuria. Úsala cuando el paciente llega remitido por creatinina elevada, proteinuria, hematuria o edema.',
  sections = '[
    {"key":"motivo_y_remision","label":"Motivo de consulta y remisión","order":1,"required":true,
     "instruction":"Motivo en las palabras del paciente y quién lo remite, con el hallazgo que originó la remisión tal como se enunció (creatinina elevada, proteinuria, hematuria, edema, hipertensión de difícil manejo). No lo conviertas en diagnóstico."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":2,"required":true,
     "instruction":"Cronología: edema y su distribución, cambios en el volumen y el aspecto de la orina (oliguria, nicturia, orina espumosa, hematuria), disnea, astenia, náusea, prurito y calambres, con el tiempo de evolución referido. Solo lo mencionado; no completes síntomas urémicos que nadie describió."},
    {"key":"antecedentes_nefrologicos","label":"Antecedentes nefrológicos y factores de riesgo","order":3,"required":false,
     "instruction":"Hipertensión y diabetes con su tiempo de evolución y control referido, litiasis, infecciones urinarias a repetición, uropatía obstructiva, enfermedades autoinmunes, episodios previos de lesión renal aguda y creatininas anteriores con sus fechas. Transcribe las cifras literal; si no hay previas, indícalo."},
    {"key":"nefrotoxicos_y_medicamentos","label":"Medicamentos y exposición a nefrotóxicos","order":4,"required":false,
     "instruction":"Medicamentos con dosis tal como se dictaron, con énfasis en AINE, IECA o ARA II, diuréticos, aminoglucósidos, litio, herbales y medios de contraste recientes. Transcribe cada dosis literal; nunca la ajustes por función renal ni completes la que falte."},
    {"key":"antecedentes_familiares","label":"Antecedentes familiares","order":5,"required":false,
     "instruction":"Antecedentes familiares de enfermedad renal crónica, diálisis o trasplante, riñón poliquístico, glomerulopatías o sordera asociada, con el parentesco mencionado. Si no se interrogaron, escríbelo así."},
    {"key":"examen_fisico_y_volemia","label":"Examen físico, presión arterial y estado de volemia","order":6,"required":true,
     "instruction":"Presión arterial con las cifras, la posición y el brazo tal como se dictaron, peso, estado de volemia (edema con su grado y localización, ingurgitación yugular, crépitos, signos de deshidratación) y examen del acceso vascular o del catéter si lo tiene. Nunca calcules ni promedies cifras de tensión."},
    {"key":"laboratorios_y_uroanalisis","label":"Laboratorios, uroanálisis e imágenes","order":7,"required":false,
     "instruction":"Creatinina y TFG tal como el médico las enunció, BUN, sodio, potasio, bicarbonato, calcio, fósforo, uroanálisis con sedimento, relación proteína o albúmina sobre creatinina en orina, proteinuria de 24 horas y ecografía renal, con sus fechas. Transcribe TODO literal: nunca estimes la TFG ni conviertas unidades."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":8,"required":true,
     "instruction":"Razonamiento y diagnósticos con la precisión con que el médico los formuló, incluida la causa probable y el estadio de enfermedad renal crónica SOLO si él lo enunció. Nunca asignes estadio ni categoría de albuminuria por tu cuenta."},
    {"key":"plan_y_nefroproteccion","label":"Plan, nefroprotección y educación","order":9,"required":true,
     "instruction":"Estudios solicitados (inmunológicos, biopsia renal, imágenes), medicamentos indicados o suspendidos con dosis literal, metas de presión arterial y de proteinuria si el médico las dictó, restricción de sal, líquidos o proteína, y remisiones ante la EPS. No recalcules dosis ni fijes metas propias."},
    {"key":"proximo_control_y_alarmas","label":"Próximo control y signos de alarma","order":10,"required":false,
     "instruction":"Cuándo vuelve y con qué exámenes, incapacidad con los días dichos si se otorgó, y signos de alarma explicados (disminución marcada de la orina, edema creciente, disnea, vómito persistente). Solo la educación dada en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = 'c5bf805a-8999-545c-b688-c07d2fb84d6a' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · progresión de la enfermedad renal y metas',
  description = 'Control del paciente nefrológico ya en manejo: evolución de la función renal con las cifras nuevas transcritas literal, control de la presión arterial y de la volemia, electrolitos, anemia y metabolismo óseo, adherencia y ajuste de la nefroprotección. Úsala para el seguimiento habitual, no para la cita de preparación de diálisis.',
  sections = '[
    {"key":"diagnosticos_y_estadio","label":"Diagnósticos activos y estadio","order":1,"required":true,
     "instruction":"Diagnóstico nefrológico con su causa y tiempo de evolución, y estadio de enfermedad renal crónica únicamente si el médico lo enunció hoy. No lo derives de la TFG ni lo arrastres de notas previas."},
    {"key":"intervalo_y_adherencia","label":"Intervalo, adherencia y dieta","order":2,"required":false,
     "instruction":"Tiempo desde el último control, adherencia a los medicamentos y a la restricción de sal, líquidos, potasio o proteína, dificultades de entrega en la EPS y uso de AINE u otros nefrotóxicos por cuenta propia. Solo lo referido; si no se exploró, indícalo."},
    {"key":"sintomas_del_intervalo","label":"Síntomas del intervalo y volumen urinario","order":3,"required":false,
     "instruction":"Edema, disnea, nicturia, cambios en el volumen urinario, calambres, prurito, náusea y astenia referidos desde el último control, con su evolución. Registra solo lo dicho; no describas síntomas urémicos a partir de las cifras."},
    {"key":"laboratorios_de_control","label":"Laboratorios de control","order":4,"required":false,
     "instruction":"Creatinina y TFG nuevas tal como se leyeron, con la fecha, y potasio, sodio, bicarbonato, calcio, fósforo, PTH, hemoglobina, ferritina y proteinuria de control. Transcribe cada valor LITERAL: nunca calcules la TFG, no estimes la variación ni des por estable lo que no se comparó en voz alta."},
    {"key":"examen_de_control","label":"Examen de control, presión arterial y volemia","order":5,"required":true,
     "instruction":"Presión arterial con las cifras, la posición y el brazo dictados, peso y su cambio si el médico lo mencionó, estado de volemia (edema, yugulares, crépitos) y revisión del acceso vascular o del catéter peritoneal si lo tiene. No completes lo no examinado."},
    {"key":"evaluacion_de_metas","label":"Evaluación de metas y progresión","order":6,"required":true,
     "instruction":"Cumplimiento de las metas que el médico enunció (presión arterial, proteinuria, hemoglobina, potasio, fósforo) y su lectura sobre la progresión o estabilidad de la función renal. Nunca declares progresión, mejoría ni cumplimiento de meta por tu cuenta."},
    {"key":"ajuste_del_plan","label":"Ajuste del plan y nefroprotección","order":7,"required":true,
     "instruction":"Cambios de medicamentos con dosis exactas transcritas literal (antihipertensivos, IECA o ARA II, iSGLT2, diuréticos, quelantes, hierro, eritropoyetina, bicarbonato), suspensión de nefrotóxicos, nuevos exámenes y remisiones. Nunca ajustes la dosis por la TFG tú mismo."},
    {"key":"educacion_y_proximo_control","label":"Educación y próximo control","order":8,"required":false,
     "instruction":"Educación dada sobre dieta, líquidos, cuidado del acceso o autocuidado renal, vacunación mencionada, incapacidad con los días dichos, y fecha del próximo control con los exámenes que debe traer. Solo lo hablado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = '261972ee-da32-5a7a-8cec-d763b5b8ad46' and owner_id is null;

update public.clinical_templates set
  name = 'Valoración renal · biopsia renal y acceso para diálisis',
  description = 'Registro del procedimiento nefrológico: biopsia renal percutánea, colocación o valoración de catéter, o revisión del acceso vascular o peritoneal, con indicación, consentimiento, estado hemostático y de presión arterial, técnica, muestras, tolerancia e indicaciones posteriores. Úsala solo cuando el procedimiento se ejecuta.',
  sections = '[
    {"key":"indicacion_del_procedimiento","label":"Indicación del procedimiento","order":1,"required":true,
     "instruction":"Procedimiento realizado y su indicación tal como la enunció el médico (estudio de glomerulopatía, proteinuria en rango nefrótico, lesión renal sin causa clara, inicio de terapia de reemplazo, disfunción del acceso). No la deduzcas del diagnóstico."},
    {"key":"consentimiento_y_verificacion","label":"Consentimiento y verificación de seguridad","order":2,"required":false,
     "instruction":"Consentimiento informado con los riesgos explicados (sangrado, pérdida del riñón, transfusión), verificación de identidad, lateralidad y ayuno. Si el consentimiento no se mencionó, indícalo de forma explícita; no lo des por obtenido."},
    {"key":"condiciones_previas","label":"Condiciones previas: hemostasia y presión arterial","order":3,"required":false,
     "instruction":"Presión arterial previa con las cifras dichas, hemoglobina, plaquetas, INR y TTP, suspensión de anticoagulantes o antiagregantes con los días dictados, y ecografía que descarte riñón único o alteración anatómica. Transcribe todas las cifras literal; nunca las estimes."},
    {"key":"tecnica_y_sitio","label":"Técnica, guía imagenológica y sitio","order":4,"required":true,
     "instruction":"Lateralidad y polo abordado, posición del paciente, guía ecográfica, asepsia, anestesia local con el fármaco y la cantidad dictados, calibre de la aguja y número de pases, o descripción del acceso intervenido, en el orden en que se narró. No completes pasos que no se dictaron."},
    {"key":"muestras_y_hallazgos","label":"Muestras obtenidas y hallazgos","order":5,"required":true,
     "instruction":"Número y longitud de cilindros obtenidos, presencia de glomérulos referida por el médico y estudios a los que se envía la muestra (microscopía de luz, inmunofluorescencia, microscopía electrónica). En accesos, describe el hallazgo tal como se dictó. Nunca estimes cantidades ni suficiencia de la muestra."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones inmediatas","order":6,"required":false,
     "instruction":"Tolerancia, dolor referido, signos vitales y presión arterial durante y después con los valores dichos, sangrado, hematuria macroscópica y necesidad de observación o transfusión. Afirma ausencia de complicaciones solo si el médico lo declaró."},
    {"key":"indicaciones_posteriores","label":"Indicaciones posteriores","order":7,"required":true,
     "instruction":"Reposo y su duración tal como se indicó, control de presión arterial y de la orina, hidratación, analgesia con dosis literal, reinicio de anticoagulantes con la fecha dictada y cuidados del acceso o del sitio de punción. No agregues cuidados de rutina que no se dijeron."},
    {"key":"seguimiento_y_resultados","label":"Seguimiento y entrega de resultados","order":8,"required":false,
     "instruction":"Cuándo estará la patología y cómo se entrega, cita de control programada, signos por los que debe consultar de urgencia (orina con sangre persistente, dolor lumbar intenso, mareo) y remisiones derivadas, solo como se acordaron."}
  ]'::jsonb,
  updated_at = now()
where id = '06b0cb56-b687-5f89-9b64-d9724087e012' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c1000000-0000-4000-8000-00000000000b', null,
   'Enfermedad renal crónica avanzada · preparación de terapia de reemplazo renal',
   'Cita de preparación del paciente con enfermedad renal crónica avanzada: síntomas urémicos, laboratorios que soportan la decisión, educación sobre hemodiálisis, diálisis peritoneal y trasplante, elección informada del paciente, plan de acceso y vacunación. Úsala cuando la consulta gira en torno a elegir y preparar la terapia de reemplazo.',
   'nefrologia', 'Nefrología', 'institutional', false, 'active',
   '[
    {"key":"diagnostico_y_trayectoria","label":"Diagnóstico, estadio y trayectoria","order":1,"required":true,
     "instruction":"Causa de la enfermedad renal, tiempo de evolución y estadio o TFG actual únicamente como el médico los enunció, con la trayectoria de deterioro que él describió. Nunca calcules la TFG ni asignes el estadio a partir de la creatinina."},
    {"key":"sintomas_uremicos","label":"Síntomas urémicos y sobrecarga de volumen","order":2,"required":false,
     "instruction":"Náusea, vómito, hiporexia, prurito, insomnio, calambres, disnea, edema y disminución del volumen urinario referidos, con su intensidad y evolución. Solo lo que dijo el paciente; no infieras uremia desde los laboratorios."},
    {"key":"laboratorios_que_soportan_la_decision","label":"Laboratorios que soportan la decisión","order":3,"required":true,
     "instruction":"Creatinina, TFG, potasio, bicarbonato, calcio, fósforo, PTH, hemoglobina y albúmina con la fecha exacta, tal como el médico los leyó. Transcríbelos LITERAL: nunca los calcules, conviertas ni compares con previos que no se citaron; sobre estas cifras se decide iniciar diálisis."},
    {"key":"examen_y_estado_de_volemia","label":"Examen físico y estado de volemia","order":4,"required":true,
     "instruction":"Presión arterial con las cifras y la posición dictadas, peso seco si se mencionó, edema con su grado, ingurgitación yugular, crépitos y examen de vasos de miembros superiores para el futuro acceso, según lo explorado. No completes lo no examinado."},
    {"key":"medicamentos_y_ajustes","label":"Medicamentos y ajustes por función renal","order":5,"required":false,
     "instruction":"Medicamentos vigentes con dosis literal (diuréticos, antihipertensivos, quelantes de fósforo, hierro, eritropoyetina, bicarbonato, vitamina D) y suspensiones indicadas. Transcribe las dosis tal como se dictaron; nunca las ajustes tú por la TFG."},
    {"key":"educacion_sobre_modalidades","label":"Educación sobre las modalidades","order":6,"required":false,
     "instruction":"Modalidades explicadas al paciente y a su familia (hemodiálisis, diálisis peritoneal, trasplante, manejo conservador) y qué se dijo de cada una: requisitos, frecuencia, implicaciones en la vida diaria. Registra solo lo que efectivamente se explicó en la consulta."},
    {"key":"decision_y_consentimiento","label":"Decisión del paciente y consentimiento","order":7,"required":true,
     "instruction":"Modalidad elegida y quién participó en la decisión, con las palabras del paciente cuando expresó su preferencia, y consentimiento informado si se registró. Si la decisión quedó aplazada, escríbelo así; nunca atribuyas al paciente una elección que no manifestó."},
    {"key":"plan_de_acceso","label":"Plan de acceso vascular o peritoneal","order":8,"required":true,
     "instruction":"Acceso planeado (fístula arteriovenosa, injerto, catéter tunelizado, catéter peritoneal), lado y estudios previos como el mapeo venoso, con la remisión a cirugía vascular y el plazo dictado. Registra cuidados del brazo indicados solo si se mencionaron."},
    {"key":"vacunacion_y_remisiones","label":"Vacunación, trasplante y remisiones","order":9,"required":false,
     "instruction":"Vacunación contra hepatitis B, influenza o neumococo indicada o pendiente, estudio para lista de trasplante y remisiones a nutrición, psicología, trabajo social o a la unidad renal, con las autorizaciones que deben tramitarse ante la EPS. Solo lo dicho."},
    {"key":"proximo_control_y_alarmas","label":"Próximo control y signos de alarma","order":10,"required":false,
     "instruction":"Fecha del próximo control y exámenes que debe traer, y signos de alarma explicados para consultar antes (disnea, edema que aumenta, vómito persistente, disminución marcada de la orina, alteración del estado de conciencia). Solo la educación dada hoy."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();
update public.clinical_templates set
  name = 'Consulta inicial · disnea, tos y exposición respiratoria',
  description = 'Primera valoración neumológica: cronología de la disnea, la tos o las sibilancias, exposición a humo de leña, tabaco y riesgos laborales, examen respiratorio completo y lectura literal de espirometría, imágenes y oximetría. Úsala cuando el paciente llega remitido por síntomas respiratorios o un estudio anormal sin diagnóstico.',
  sections = '[
    {"key":"motivo_y_remision","label":"Motivo de consulta y remisión","order":1,"required":true,
     "instruction":"Motivo en las palabras del paciente y quién lo remite, con el hallazgo que originó la remisión tal como se enunció (disnea, tos crónica, radiografía o espirometría anormal, hipoxemia). No lo traduzcas a un diagnóstico respiratorio."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":2,"required":true,
     "instruction":"Cronología de los síntomas: disnea con su grado o escala mMRC solo si el médico la enunció, tos seca o productiva con las características del esputo, hemoptisis, sibilancias, dolor torácico, variación nocturna o estacional, y exacerbaciones con hospitalizaciones y uso de esteroides. Solo lo referido; nunca asignes el grado tú."},
    {"key":"exposiciones_y_tabaquismo","label":"Exposiciones y tabaquismo","order":3,"required":false,
     "instruction":"Tabaquismo con el índice paquetes-año tal como lo dictó el médico, humo de leña con años y horas al día referidos, exposición laboral a polvos, sílice, asbesto o vapores, aves y humedad en casa, y biomasa. Transcribe los índices literal; nunca los calcules ni los estimes tú."},
    {"key":"antecedentes_respiratorios","label":"Antecedentes respiratorios y comorbilidades","order":4,"required":false,
     "instruction":"Asma o EPOC previos, tuberculosis y su tratamiento, neumonías, hospitalizaciones en UCI o ventilación mecánica, atopia, reflujo, falla cardiaca, apnea del sueño y uso de oxígeno domiciliario. Registra medicamentos inhalados con dosis literal; si un antecedente no se exploró, indícalo."},
    {"key":"examen_fisico_respiratorio","label":"Examen físico respiratorio","order":5,"required":true,
     "instruction":"Signos vitales y saturación con los valores dichos y si fue con oxígeno o al ambiente, patrón respiratorio, uso de músculos accesorios, cianosis, hipocratismo digital, expansión torácica, percusión y auscultación (sibilancias, roncus, crépitos, ruidos disminuidos) con su localización. No completes lo no auscultado."},
    {"key":"pruebas_y_estudios","label":"Pruebas funcionales, imágenes y paraclínicos","order":6,"required":false,
     "instruction":"Espirometría con VEF1, CVF, relación VEF1/CVF, porcentaje del predicho y respuesta al broncodilatador, oximetría, gases arteriales, radiografía o tomografía de tórax y otros estudios, con sus fechas. Transcribe TODAS las cifras y conclusiones literal; nunca las calcules, interpretes ni normalices."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":7,"required":true,
     "instruction":"Razonamiento y diagnósticos con la precisión con que el médico los formuló, incluida la clasificación de gravedad o el grupo de EPOC SOLO si él los enunció. Deja explícitos los diferenciales; nunca clasifiques ni estadifiques por tu cuenta."},
    {"key":"plan_y_terapia_inhalada","label":"Plan, terapia inhalada y estudios","order":8,"required":true,
     "instruction":"Inhaladores y demás medicamentos con principio activo, dosis, número de disparos y frecuencia transcritos LITERAL, oxígeno con litros por minuto y horas si se indicó, estudios solicitados, rehabilitación pulmonar, vacunación y remisiones ante la EPS. Nunca ajustes dosis ni flujos."},
    {"key":"educacion_y_cesacion","label":"Educación, técnica inhalatoria y cesación","order":9,"required":false,
     "instruction":"Enseñanza de la técnica inhalatoria y uso de inhalocámara, consejería para dejar el cigarrillo o el humo de leña y medidas ambientales en casa, tal como se explicaron. Registra solo la educación efectivamente dada en la consulta."},
    {"key":"proximo_control_y_alarmas","label":"Próximo control y signos de alarma","order":10,"required":false,
     "instruction":"Cuándo vuelve y con qué exámenes, incapacidad con los días dichos si se otorgó, y signos de alarma explicados (disnea en reposo, cianosis, fiebre, esputo purulento, hemoptisis, somnolencia). Solo lo hablado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = 'b0a0ce7d-262d-53ee-a712-978d547bcb2f' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · disnea, saturación y técnica inhalatoria',
  description = 'Control del paciente neumológico en tratamiento: evolución de la disnea y la tos, exacerbaciones del intervalo, adherencia y técnica del inhalador, saturación y estudios nuevos transcritos literal, y ajuste del plan. Úsala para el seguimiento general de cualquier patología respiratoria en manejo.',
  sections = '[
    {"key":"diagnosticos_y_tratamiento_vigente","label":"Diagnósticos activos y tratamiento vigente","order":1,"required":true,
     "instruction":"Diagnósticos respiratorios activos con su tiempo de evolución y tratamiento vigente con principio activo, dosis y número de disparos tal como se enunciaron. Transcribe el esquema literal; no lo resumas en categorías que el médico no usó."},
    {"key":"intervalo_y_exacerbaciones","label":"Intervalo y exacerbaciones","order":2,"required":false,
     "instruction":"Tiempo desde el último control y exacerbaciones del intervalo: número de episodios, atención en urgencias u hospitalización, uso de esteroides o antibióticos con los días dichos. Transcribe las cifras literal; no sumes episodios ni los estimes."},
    {"key":"evolucion_de_sintomas","label":"Evolución de la disnea, tos y despertares","order":3,"required":false,
     "instruction":"Evolución de la disnea con la escala que el médico haya enunciado, tos y esputo, sibilancias, despertares nocturnos, limitación de la actividad y uso de rescate en la última semana. Solo lo referido por el paciente; nunca asignes puntajes de control tú mismo."},
    {"key":"adherencia_y_tecnica_inhalatoria","label":"Adherencia y técnica inhalatoria","order":4,"required":false,
     "instruction":"Adherencia al inhalador y a los demás medicamentos, uso de inhalocámara, errores de técnica observados en la consulta, disponibilidad del medicamento en la EPS y adherencia al oxígeno con las horas referidas. Registra solo lo verificado o referido hoy."},
    {"key":"estudios_nuevos","label":"Espirometría, oximetría y estudios nuevos","order":5,"required":false,
     "instruction":"Espirometría, oximetría de reposo o de esfuerzo, gases arteriales, imágenes o polisomnografía nuevas, con sus valores, porcentajes y fechas. Transcríbelos LITERAL, indicando si la saturación fue al ambiente o con oxígeno; nunca compares con previos que el médico no haya citado."},
    {"key":"examen_de_control","label":"Examen físico de control","order":6,"required":true,
     "instruction":"Signos vitales y saturación con los valores dichos y la fuente de oxígeno, patrón respiratorio, uso de músculos accesorios, edema de miembros y auscultación con la localización de los hallazgos. No completes lo no examinado."},
    {"key":"evaluacion_del_control","label":"Evaluación del control de la enfermedad","order":7,"required":true,
     "instruction":"Valoración del control con las palabras del médico (controlado, parcialmente controlado, no controlado, exacerbación) y su razonamiento. Nunca definas la categoría de control ni calcules puntajes de cuestionarios por tu cuenta."},
    {"key":"ajuste_del_plan","label":"Ajuste del plan y rehabilitación","order":8,"required":true,
     "instruction":"Cambios de inhaladores o de dosis con las cifras exactas dictadas, esteroides o antibióticos con los días indicados, ajuste de oxígeno en litros por minuto y horas, rehabilitación pulmonar, vacunación, nuevos estudios y remisiones. Transcribe todo literal, sin recalcular."},
    {"key":"proximo_control_y_alarmas","label":"Próximo control y signos de alarma","order":9,"required":false,
     "instruction":"Fecha del próximo control y exámenes que debe traer, incapacidad con los días dichos, plan de acción ante crisis y signos de alarma explicados (disnea que no cede con el rescate, cianosis, fiebre, somnolencia). Solo lo dicho hoy."}
  ]'::jsonb,
  updated_at = now()
where id = 'f8b75654-6e80-5812-8eb4-424526cf5af1' and owner_id is null;

update public.clinical_templates set
  name = 'Valoración respiratoria · procedimiento diagnóstico y pruebas funcionales',
  description = 'Registro del procedimiento neumológico realizado: broncoscopia, toracentesis, biopsia pleural, prueba de caminata de seis minutos o titulación de oxígeno, con indicación, consentimiento, técnica, hallazgos, muestras y tolerancia. Úsala solo cuando el procedimiento o la prueba se ejecuta, no en la consulta que la indica.',
  sections = '[
    {"key":"indicacion_del_procedimiento","label":"Indicación del procedimiento o prueba","order":1,"required":true,
     "instruction":"Procedimiento o prueba realizada y su indicación tal como la enunció el médico (estudio de masa o infiltrado, derrame pleural, hemoptisis, evaluación funcional, titulación de oxígeno). No amplíes la indicación ni la deduzcas del diagnóstico."},
    {"key":"consentimiento_y_verificacion","label":"Consentimiento y verificación de seguridad","order":2,"required":false,
     "instruction":"Consentimiento informado con los riesgos explicados, verificación de identidad, sitio y lateralidad, ayuno, alergias y suspensión de anticoagulantes con los días dichos. Si el consentimiento no se mencionó, indícalo; no lo des por obtenido."},
    {"key":"condiciones_previas","label":"Condiciones previas y monitoreo basal","order":3,"required":false,
     "instruction":"Signos vitales y saturación basales con los valores dichos y si fue al ambiente o con oxígeno, coagulación y plaquetas, sedación o anestesia local con el fármaco y la cantidad dictados, y monitoreo empleado. Transcribe cifras y dosis literal; nunca las estimes."},
    {"key":"tecnica_y_hallazgos","label":"Técnica y hallazgos","order":4,"required":true,
     "instruction":"Descripción en el orden en que se dictó: vía de abordaje, lateralidad y sitio, guía ecográfica, hallazgos endoscópicos por segmentos o aspecto y volumen del líquido obtenido. En pruebas funcionales, registra distancia recorridas, saturación mínima y síntomas tal como se dictaron; nunca calcules ni estimes valores."},
    {"key":"muestras_y_destino","label":"Muestras obtenidas y su destino","order":5,"required":true,
     "instruction":"Muestras tomadas (lavado broncoalveolar, cepillado, biopsias, líquido pleural) con el número y los estudios solicitados en cada una (citología, patología, Gram y cultivo, BK, ADA, químicas). Si una muestra fue insuficiente o no se obtuvo, consígnalo así."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones inmediatas","order":6,"required":false,
     "instruction":"Tolerancia del paciente, saturación y signos vitales durante y después con los valores dichos, tos, dolor, sangrado, desaturación o sospecha de neumotórax y la conducta tomada. Afirma ausencia de complicaciones solo si el médico lo declaró."},
    {"key":"indicaciones_posteriores","label":"Indicaciones posteriores","order":7,"required":true,
     "instruction":"Radiografía de control si se ordenó, reposo, reinicio de la vía oral y de los anticoagulantes con la fecha dictada, analgesia con dosis literal, oxígeno indicado con litros por minuto y signos por los que debe consultar de urgencia. No agregues indicaciones de rutina."},
    {"key":"seguimiento_y_resultados","label":"Seguimiento y entrega de resultados","order":8,"required":false,
     "instruction":"Cuándo estarán los resultados de patología o cultivos y cómo se entregan, cita de control programada y remisiones derivadas, solo como se acordaron en la consulta. No fijes plazos que nadie mencionó."}
  ]'::jsonb,
  updated_at = now()
where id = '72282a30-721e-5355-8f9b-49c9c20a499c' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c1000000-0000-4000-8000-00000000000c', null,
   'Control de EPOC y asma · espirometría, control de síntomas y oxígeno',
   'Control dedicado a EPOC o asma: exacerbaciones y uso de rescate, espirometría dictada con sus valores literales, técnica inhalatoria verificada, indicación y adherencia al oxígeno, y plan de acción escrito. Úsala en el seguimiento de la enfermedad obstructiva ya diagnosticada, cuando la cita gira en torno al control y al inhalador.',
   'neumologia', 'Neumología', 'institutional', false, 'active',
   '[
    {"key":"diagnostico_y_clasificacion","label":"Diagnóstico y clasificación vigente","order":1,"required":true,
     "instruction":"Diagnóstico (EPOC, asma, superposición) con su tiempo de evolución y la clasificación de gravedad o el grupo que el médico haya enunciado hoy. Nunca asignes grupo, escalón ni gravedad por tu cuenta ni los arrastres de notas previas."},
    {"key":"control_de_sintomas","label":"Control de síntomas y uso de rescate","order":2,"required":true,
     "instruction":"Disnea con la escala mMRC solo si el médico la dictó, tos y esputo, sibilancias, despertares nocturnos, limitación de la actividad y número de veces por semana que usó el rescate. Transcribe la frecuencia tal como la refirió el paciente; nunca la promedies ni asignes puntajes de CAT o ACT tú."},
    {"key":"exacerbaciones","label":"Exacerbaciones del intervalo","order":3,"required":false,
     "instruction":"Número de exacerbaciones desde el último control, atenciones en urgencias, hospitalizaciones o UCI, y ciclos de esteroide o antibiótico con los días dichos. Transcribe las cifras literal; no las sumes ni las estimes a partir del relato."},
    {"key":"desencadenantes_y_exposicion","label":"Desencadenantes y exposición actual","order":4,"required":false,
     "instruction":"Exposición vigente a cigarrillo, humo de leña, polvo laboral, ácaros, mascotas o humedad, y desencadenantes identificados por el paciente (ejercicio, frío, infecciones, emociones). Registra solo lo referido; no supongas exposiciones por el entorno."},
    {"key":"adherencia_y_tecnica","label":"Adherencia y técnica inhalatoria verificada","order":5,"required":true,
     "instruction":"Medicamentos inhalados con principio activo, dosis y disparos transcritos literal, adherencia referida, disponibilidad en la EPS y la técnica revisada hoy con los errores concretos observados y corregidos. No afirmes que la técnica es adecuada si no se verificó en la consulta."},
    {"key":"espirometria_y_oximetria","label":"Espirometría, oximetría y estudios","order":6,"required":false,
     "instruction":"Espirometría con VEF1 en litros y porcentaje del predicho, CVF, relación VEF1/CVF, respuesta al broncodilatador y fecha, más oximetría o gases con la fuente de oxígeno. Transcribe TODO literal: nunca calcules porcentajes, no clasifiques la obstrucción ni compares con previos no citados."},
    {"key":"examen_fisico","label":"Examen físico dirigido","order":7,"required":true,
     "instruction":"Signos vitales y saturación con los valores dichos y si fue al ambiente o con oxígeno, patrón y frecuencia respiratoria, uso de músculos accesorios, tórax en tonel, edema y auscultación con la localización de sibilancias o crépitos. No completes lo no examinado."},
    {"key":"oxigeno_domiciliario","label":"Oxígeno domiciliario y dispositivos","order":8,"required":false,
     "instruction":"Indicación de oxígeno con litros por minuto y horas al día tal como se dictaron, adherencia referida, tipo de fuente (concentrador, cilindro), y uso de VMNI o CPAP si se mencionó. Transcribe los flujos literal; nunca los ajustes ni los deduzcas de la saturación."},
    {"key":"analisis_y_control","label":"Análisis y evaluación del control","order":9,"required":true,
     "instruction":"Valoración del control y del riesgo futuro con las palabras del médico (controlado, no controlado, exacerbador frecuente) y su razonamiento sobre las causas del descontrol. Nunca definas la categoría ni el fenotipo por tu cuenta."},
    {"key":"ajuste_del_tratamiento","label":"Ajuste del tratamiento y plan de acción","order":10,"required":true,
     "instruction":"Escalamiento o desescalamiento con principio activo, dosis y disparos transcritos LITERAL, rescate indicado, esteroide o antibiótico con los días dictados, plan de acción escrito ante crisis, vacunación, rehabilitación pulmonar y remisiones. Nunca modifiques ni completes dosis."},
    {"key":"educacion_y_proximo_control","label":"Educación, cesación y próximo control","order":11,"required":false,
     "instruction":"Consejería para dejar el cigarrillo o el humo de leña, medidas ambientales en casa, incapacidad con los días dichos, y fecha del próximo control con los exámenes que debe traer. Registra únicamente lo que se explicó hoy."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();
update public.clinical_templates set
  name = 'Consulta inicial · semiología neurológica y cronología del déficit',
  description = 'Primera valoración neurológica: forma de instauración y cronología del síntoma o del déficit, antecedentes vasculares y familiares, examen neurológico completo por dominios y lectura literal de neuroimágenes y estudios. Úsala en el paciente remitido por cefalea, mareo, crisis, déficit focal o deterioro cognitivo sin estudio.',
  sections = '[
    {"key":"motivo_y_informante","label":"Motivo de consulta e informante","order":1,"required":true,
     "instruction":"Motivo en las palabras del paciente y, cuando el relato lo da un acompañante, señala quién informa y en calidad de qué. Registra quién remite y por qué tal como se enunció. No conviertas el motivo en diagnóstico."},
    {"key":"enfermedad_actual","label":"Enfermedad actual y cronología","order":2,"required":true,
     "instruction":"Forma de instauración (súbita, progresiva, fluctuante), fecha y hora de inicio si se dieron, evolución, síntomas asociados y factores desencadenantes o de alivio, con el detalle semiológico dictado. En cefalea incluye localización, calidad, intensidad, duración, aura y fotofobia; en crisis, la descripción del testigo. Solo lo referido."},
    {"key":"antecedentes_neurologicos","label":"Antecedentes neurológicos y vasculares","order":3,"required":false,
     "instruction":"Enfermedad cerebrovascular, trauma craneoencefálico, crisis previas, meningitis, migraña, deterioro cognitivo y factores de riesgo (hipertensión, diabetes, dislipidemia, fibrilación auricular, tabaquismo), con su tiempo de evolución. Si un antecedente no se exploró, indícalo."},
    {"key":"medicamentos_y_toxicos","label":"Medicamentos, tóxicos y antecedentes familiares","order":4,"required":false,
     "instruction":"Medicamentos con dosis tal como se dictaron, en especial anticonvulsivantes, anticoagulantes, neurolépticos y analgésicos de uso frecuente; alcohol y sustancias psicoactivas; y antecedentes familiares de epilepsia, migraña, demencia o enfermedad neuromuscular. Transcribe las dosis literal."},
    {"key":"examen_neurologico","label":"Examen neurológico","order":5,"required":true,
     "instruction":"Estado de conciencia y orientación, lenguaje, pares craneales, fuerza por grupos con la escala que el médico dictó, tono, sensibilidad, reflejos, signos meníngeos, coordinación y marcha, con la lateralidad de cada hallazgo. Transcribe puntajes (Glasgow, NIHSS, MMSE) solo si él los enunció; nunca los calcules."},
    {"key":"neuroimagenes_y_estudios","label":"Neuroimágenes y estudios","order":6,"required":false,
     "instruction":"Tomografía o resonancia cerebral, angiotomografía, electroencefalograma, electromiografía, punción lumbar y laboratorios, con su fecha y la conclusión tal como el médico la leyó en la consulta. Transcríbelo LITERAL: nunca interpretes una imagen ni completes hallazgos que no se leyeron."},
    {"key":"analisis_e_impresion","label":"Análisis, topografía e impresión diagnóstica","order":7,"required":true,
     "instruction":"Razonamiento del médico sobre la localización topográfica y la etiología probable, con los diagnósticos y diferenciales tal como los formuló. Nunca propongas una topografía ni una etiología que él no haya enunciado."},
    {"key":"plan_y_tratamiento","label":"Plan, tratamiento y estudios solicitados","order":8,"required":true,
     "instruction":"Medicamentos con principio activo, dosis, vía y titulación tal como se dictaron (transcríbelos LITERAL, sin recalcular por peso), estudios solicitados, remisiones ante la EPS, terapia física o del lenguaje e incapacidad con los días exactos si se otorgó."},
    {"key":"educacion_y_restricciones","label":"Educación, restricciones y signos de alarma","order":9,"required":false,
     "instruction":"Restricciones indicadas (conducir, alturas, natación, manejo de máquinas), recomendaciones al cuidador y signos de alarma explicados para consultar de urgencia. Registra únicamente las restricciones que el médico dictó; nunca añadas las de rutina."},
    {"key":"proximo_control","label":"Próximo control","order":10,"required":false,
     "instruction":"Cuándo vuelve y con qué exámenes o registros debe regresar (diario de cefalea o de crisis, resultados pendientes) y qué queda pendiente de autorización. Solo lo acordado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = 'bf081b39-3243-52f3-a1ab-42cea72e6723' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · déficit, crisis y funcionalidad',
  description = 'Control del paciente neurológico en manejo: evolución del déficit o de los episodios, adherencia y efectos adversos del tratamiento, estudios nuevos transcritos literal, examen neurológico comparativo y funcionalidad. Úsala para el seguimiento general de cualquier condición neurológica, salvo el seguimiento específico de epilepsia.',
  sections = '[
    {"key":"diagnosticos_y_tratamiento","label":"Diagnósticos activos y tratamiento vigente","order":1,"required":true,
     "instruction":"Diagnósticos neurológicos activos con su tiempo de evolución y tratamiento vigente con principio activo y dosis tal como se enunciaron. Transcribe el esquema literal; si el diagnóstico sigue en estudio, consígnalo así."},
    {"key":"intervalo_y_adherencia","label":"Intervalo, adherencia y terapias","order":2,"required":false,
     "instruction":"Tiempo desde el último control, adherencia al tratamiento con las dosis omitidas referidas, dificultades de entrega en la EPS y cumplimiento de terapia física, ocupacional o del lenguaje. Solo lo referido; si no se exploró, indícalo."},
    {"key":"evolucion_del_deficit","label":"Evolución del déficit y episodios del intervalo","order":3,"required":false,
     "instruction":"Evolución del déficit motor, sensitivo, del lenguaje o cognitivo, y episodios del intervalo (crisis, cefaleas, mareo, caídas) con su número, duración y descripción del testigo. Transcribe los conteos tal como se dijeron; nunca los estimes ni los promedies."},
    {"key":"efectos_adversos","label":"Tolerancia y efectos adversos","order":4,"required":false,
     "instruction":"Efectos adversos referidos (somnolencia, mareo, temblor, alteración del ánimo o de la memoria, exantema, ganancia de peso) y su relación temporal con el medicamento, tal como los describió el paciente. No atribuyas causalidad que el médico no haya enunciado."},
    {"key":"estudios_nuevos","label":"Estudios y niveles séricos nuevos","order":5,"required":false,
     "instruction":"Neuroimágenes, electroencefalograma, electromiografía, laboratorios y niveles séricos de fármacos nuevos, con su valor, fecha y la conclusión leída por el médico. Transcríbelos LITERAL; nunca interpretes un estudio ni compares con previos que no se citaron."},
    {"key":"examen_neurologico_de_control","label":"Examen neurológico de control","order":6,"required":true,
     "instruction":"Examen dirigido con la lateralidad de cada hallazgo: lenguaje, pares craneales, fuerza con la escala dictada, tono, reflejos, coordinación y marcha. Compara con el examen previo solo si el médico hizo la comparación; nunca calcules puntajes de escalas."},
    {"key":"funcionalidad_y_analisis","label":"Funcionalidad y análisis de la evolución","order":7,"required":true,
     "instruction":"Independencia para actividades básicas e instrumentales, apoyo del cuidador, retorno al trabajo o al estudio, y la lectura del médico sobre la evolución (estable, en mejoría, en progresión). Nunca declares progresión ni asignes escalas funcionales por tu cuenta."},
    {"key":"ajuste_del_plan","label":"Ajuste del plan y remisiones","order":8,"required":true,
     "instruction":"Cambios de dosis o de fármaco con las cifras exactas y el esquema de titulación transcritos literal, terapias indicadas, nuevos estudios, remisiones y autorizaciones ante la EPS, e incapacidad con los días dichos. Nunca recalcules ni completes dosis."},
    {"key":"proximo_control_y_alarmas","label":"Próximo control, restricciones y alarmas","order":9,"required":false,
     "instruction":"Fecha del próximo control y qué debe traer, restricciones vigentes tal como se dictaron y signos de alarma explicados para consultar de urgencia (déficit nuevo, cefalea súbita e intensa, crisis prolongada, alteración de la conciencia). Solo lo dicho hoy."}
  ]'::jsonb,
  updated_at = now()
where id = '30b1fd02-2572-509f-b0e8-6ce5be7041bc' and owner_id is null;

update public.clinical_templates set
  name = 'Valoración neurológica · procedimiento diagnóstico o terapéutico',
  description = 'Registro del procedimiento neurológico realizado: punción lumbar, aplicación de toxina botulínica, bloqueo de nervio occipital o estudio neurofisiológico en consulta, con indicación, consentimiento, técnica, hallazgos, dosis y sitios, tolerancia e indicaciones posteriores. Úsala solo cuando el procedimiento se ejecuta.',
  sections = '[
    {"key":"indicacion_del_procedimiento","label":"Indicación del procedimiento","order":1,"required":true,
     "instruction":"Procedimiento realizado y su indicación tal como la enunció el médico (sospecha de neuroinfección, estudio de desmielinizante, distonía o espasticidad, cefalea refractaria, estudio neurofisiológico). No amplíes ni deduzcas la indicación."},
    {"key":"consentimiento_y_verificacion","label":"Consentimiento y verificación de seguridad","order":2,"required":false,
     "instruction":"Consentimiento informado con los riesgos explicados, verificación de identidad y del sitio con su lateralidad, alergias, y descarte de hipertensión endocraneana o de coagulopatía si se mencionó. Si el consentimiento no se registró, indícalo; no lo des por obtenido."},
    {"key":"condiciones_previas","label":"Condiciones previas y medicación","order":3,"required":false,
     "instruction":"Signos vitales y examen neurológico basal con los valores dichos, plaquetas e INR, suspensión de anticoagulantes o antiagregantes con los días dictados y premedicación o anestesia local con el fármaco y la cantidad. Transcribe cifras y dosis literal; nunca las estimes."},
    {"key":"tecnica_y_sitio","label":"Técnica, sitio y dosis aplicadas","order":4,"required":true,
     "instruction":"Posición del paciente, espacio intervertebral o músculos y puntos infiltrados con su lateralidad, agujas empleadas, número de intentos, guía ecográfica o electromiográfica y, cuando aplique, la dosis en unidades por sitio y la dosis total transcritas LITERAL. Nunca sumes ni distribuyas dosis tú."},
    {"key":"hallazgos_y_muestras","label":"Hallazgos y muestras","order":5,"required":true,
     "instruction":"Presión de apertura y aspecto del líquido cefalorraquídeo tal como se dictaron, número de tubos y estudios solicitados en cada uno (citoquímico, Gram y cultivo, PCR, citología), o los hallazgos del estudio neurofisiológico. Transcribe cifras y trazados literal; nunca los interpretes."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones inmediatas","order":6,"required":false,
     "instruction":"Tolerancia del paciente, dolor referido, signos vitales durante y después con los valores dichos, sangrado, parestesias y cambios neurológicos observados, con la conducta tomada. Afirma ausencia de complicaciones solo si el médico lo declaró."},
    {"key":"indicaciones_posteriores","label":"Indicaciones posteriores","order":7,"required":true,
     "instruction":"Reposo y su duración, hidratación, analgesia con dosis literal, manejo de la cefalea pospunción, reinicio de anticoagulantes con la fecha dictada y cuidados del sitio, tal como se explicaron. No agregues cuidados de rutina que no se dijeron."},
    {"key":"seguimiento_y_resultados","label":"Seguimiento y entrega de resultados","order":8,"required":false,
     "instruction":"Cuándo estarán los resultados y cómo se entregan, cita de control o próxima aplicación con el intervalo dictado, y signos por los que debe consultar de urgencia. Solo lo acordado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = '183c2ac4-7216-5940-a7e2-caa46ea461e4' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c1000000-0000-4000-8000-00000000000d', null,
   'Seguimiento de epilepsia · registro de crisis y ajuste de anticonvulsivantes',
   'Control específico del paciente con epilepsia: conteo y semiología de las crisis del intervalo, adherencia y desencadenantes, niveles séricos y estudios transcritos literal, ajuste del anticonvulsivante, restricciones para conducir y consejería preconcepcional. Úsala cuando la cita gira en torno a las crisis y al ajuste del tratamiento.',
   'neurologia', 'Neurología', 'institutional', false, 'active',
   '[
    {"key":"diagnostico_y_tipo_de_epilepsia","label":"Diagnóstico, tipo de crisis y tiempo de evolución","order":1,"required":true,
     "instruction":"Tipo de epilepsia y de crisis con la denominación exacta que usó el médico (focal, generalizada, con o sin alteración de la conciencia), edad de inicio y etiología si la enunció. Nunca reclasifiques las crisis ni asignes un síndrome que él no haya nombrado."},
    {"key":"registro_de_crisis","label":"Registro de crisis del intervalo","order":2,"required":true,
     "instruction":"Número de crisis desde el último control con la fecha de la última, duración, semiología descrita por el testigo, factor desencadenante, estado posictal, lesiones o consultas a urgencias y episodios de estado epiléptico. Transcribe los conteos LITERAL: nunca los sumes, promedies ni estimes a partir del relato."},
    {"key":"adherencia_y_desencadenantes","label":"Adherencia y desencadenantes","order":3,"required":false,
     "instruction":"Dosis omitidas y su frecuencia, horario de la toma, disponibilidad del medicamento en la EPS o cambios de laboratorio farmacéutico, privación de sueño, alcohol, estrés, fiebre y ciclo menstrual como desencadenantes referidos. Solo lo dicho por el paciente o su acompañante."},
    {"key":"tratamiento_vigente","label":"Tratamiento anticonvulsivante vigente","order":4,"required":true,
     "instruction":"Anticonvulsivantes en curso con principio activo, dosis en miligramos, número de tomas al día y tiempo en ese esquema, transcritos LITERAL tal como se dictaron. No conviertas presentaciones, no calcules dosis por kilogramo ni completes la que falte."},
    {"key":"efectos_adversos","label":"Efectos adversos y tolerancia","order":5,"required":false,
     "instruction":"Somnolencia, mareo, diplopía, temblor, irritabilidad, alteración de la memoria, exantema, caída del cabello, ganancia o pérdida de peso y síntomas del ánimo, con su relación temporal con el fármaco según lo refirió el paciente. No atribuyas causalidad no enunciada."},
    {"key":"niveles_y_estudios","label":"Niveles séricos, laboratorios y electroencefalograma","order":6,"required":false,
     "instruction":"Nivel sérico del anticonvulsivante con su valor y fecha, hemograma, función hepática, sodio y vitamina D, y electroencefalograma o resonancia nuevos con la conclusión leída por el médico. Transcribe TODO literal: nunca declares un nivel terapéutico ni interpretes el trazado."},
    {"key":"examen_neurologico","label":"Examen neurológico dirigido","order":7,"required":true,
     "instruction":"Estado de conciencia, lenguaje, pares craneales, fuerza y reflejos con la lateralidad de cada hallazgo, marcha, coordinación, nistagmo y temblor, además de encías y piel si se revisaron por efectos del fármaco. No completes lo no examinado."},
    {"key":"impacto_funcional_y_animo","label":"Impacto funcional, ánimo y adherencia escolar o laboral","order":8,"required":false,
     "instruction":"Rendimiento escolar o laboral, ausencias, síntomas depresivos o de ansiedad, estigma y red de apoyo, tal como los refirió el paciente. Registra solo lo abordado en la consulta; escribe con respeto y sin juicios de valor."},
    {"key":"analisis_del_control","label":"Análisis del control de crisis","order":9,"required":true,
     "instruction":"Lectura del médico sobre el control (libre de crisis, control parcial, epilepsia farmacorresistente) y las causas del descontrol que él identificó. Nunca declares farmacorresistencia ni libertad de crisis por tu cuenta a partir del conteo."},
    {"key":"ajuste_del_tratamiento","label":"Ajuste del tratamiento","order":10,"required":true,
     "instruction":"Cambio de dosis, adición o retiro de fármaco con el esquema de titulación y las fechas exactas transcritos LITERAL, rescate para crisis prolongadas con dosis y vía, nuevos estudios, remisiones a cirugía de epilepsia o a neuropsicología, y autorizaciones ante la EPS. Nunca recalcules dosis."},
    {"key":"restricciones_y_preconcepcional","label":"Restricciones y consejería preconcepcional","order":11,"required":false,
     "instruction":"Restricciones dictadas para conducir, trabajar en alturas, nadar o manejar maquinaria con el plazo dicho, planificación familiar, ácido fólico con la dosis dictada y riesgo del fármaco en el embarazo, si el tema se abordó. Nunca inventes plazos ni restricciones."},
    {"key":"educacion_y_proximo_control","label":"Educación al acompañante y próximo control","order":12,"required":false,
     "instruction":"Qué hacer durante una crisis y cuándo consultar de urgencia según lo explicado al acompañante, diario de crisis solicitado, incapacidad con los días dichos y fecha del próximo control con lo que debe traer. Solo la educación dada hoy."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();
update public.clinical_templates set
  name = 'Consulta inicial · diagnóstico oncológico, estadificación y estado funcional',
  description = 'Primera valoración oncológica: cronología del cuadro, patología e inmunohistoquímica transcritas literal, estudios de extensión, tratamientos ya recibidos, estado funcional y comorbilidades que condicionan la terapia. Úsala cuando el paciente llega remitido con diagnóstico de cáncer o con una biopsia sospechosa para definir estudio.',
  sections = '[
    {"key":"motivo_y_remision","label":"Motivo de consulta y remisión","order":1,"required":true,
     "instruction":"Motivo en las palabras del paciente y quién lo remite, con el diagnóstico o el hallazgo que originó la remisión tal como se enunció, y qué sabe el paciente de su enfermedad si se abordó. Escribe con respeto y sin adelantar pronósticos."},
    {"key":"enfermedad_actual","label":"Enfermedad actual y cronología","order":2,"required":true,
     "instruction":"Cronología desde el primer síntoma: fecha de aparición, evolución, síntomas locales y sistémicos (pérdida de peso con los kilos referidos, dolor, fiebre, sudoración), y ruta recorrida hasta el diagnóstico con las fechas dichas. Solo lo referido; no reconstruyas la cronología con fechas no mencionadas."},
    {"key":"patologia_y_biomarcadores","label":"Patología, inmunohistoquímica y biomarcadores","order":3,"required":true,
     "instruction":"Tipo histológico, grado, márgenes, inmunohistoquímica y biomarcadores (receptores hormonales, HER2, Ki-67, PD-L1, EGFR, ALK, KRAS) con el resultado, el porcentaje y la fecha del informe, tal como el médico los leyó. Transcríbelo LITERAL; nunca infieras un marcador ni lo des por positivo o negativo."},
    {"key":"estudios_de_extension","label":"Estudios de extensión y estadificación","order":4,"required":false,
     "instruction":"Tomografías, resonancia, PET, gammagrafía ósea y laboratorios con marcadores tumorales, cada uno con su fecha y la conclusión leída en la consulta, y el estadio TNM únicamente si el médico lo enunció. Nunca estadifiques, no infieras metástasis ni interpretes imágenes."},
    {"key":"tratamientos_previos","label":"Tratamientos oncológicos previos","order":5,"required":false,
     "instruction":"Cirugías, radioterapia con la dosis y el número de sesiones referidos, y esquemas de quimioterapia u hormonoterapia previos con el nombre, el número de ciclos, las fechas y la respuesta obtenida, tal como se dictaron. Transcríbelos literal; no completes ciclos ni dosis que no se dijeron."},
    {"key":"antecedentes_y_estado_funcional","label":"Antecedentes, comorbilidades y estado funcional","order":6,"required":false,
     "instruction":"Comorbilidades que condicionan el tratamiento (cardiopatía, función renal o hepática, diabetes, infecciones), medicamentos con dosis, alergias, antecedentes familiares de cáncer y estado funcional ECOG o Karnofsky SOLO si el médico lo enunció. Nunca asignes el puntaje tú."},
    {"key":"examen_fisico_oncologico","label":"Examen físico oncológico","order":7,"required":true,
     "instruction":"Peso y signos vitales con los valores dichos, estado general, examen de la lesión primaria con sus medidas literales, cadenas ganglionares con región y tamaño, visceromegalias, examen de mamas, piel y mucosas, y sitio de dolor óseo, según lo explorado. Nunca midas ni completes lo no examinado."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":8,"required":true,
     "instruction":"Diagnóstico oncológico con la precisión con que el médico lo formuló, intención del tratamiento (curativa o paliativa) y estadio solo si él los enunció, con la información que quedó pendiente por definir. Nunca declares pronóstico, estadio ni intención por tu cuenta."},
    {"key":"plan_inicial","label":"Plan inicial, estudios y junta médica","order":9,"required":true,
     "instruction":"Estudios y biopsias solicitadas, presentación en junta multidisciplinaria, esquema propuesto con nombre y dosis solo si se dictaron, remisiones (cirugía, radioterapia, cuidado paliativo, nutrición, psicología) y autorizaciones ante la EPS. Transcribe dosis y ciclos literal, sin calcularlos."},
    {"key":"informacion_y_proximo_control","label":"Información al paciente y próximo control","order":10,"required":false,
     "instruction":"Qué se le explicó al paciente y a su familia sobre el diagnóstico y los siguientes pasos, dudas que expresó, apoyo requerido, incapacidad con los días dichos y fecha del próximo control con los exámenes que debe traer. Registra solo lo hablado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = '8b066117-ed2d-5edd-80a5-ba6ec8a20c5b' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · toxicidad, respuesta y soporte',
  description = 'Control del paciente oncológico en tratamiento o en vigilancia: toxicidad del ciclo previo con su grado dictado, síntomas y soporte, laboratorios e imágenes de reevaluación transcritos literal, evaluación de la respuesta y continuidad del esquema. Úsala para los seguimientos entre ciclos y para el control postratamiento.',
  sections = '[
    {"key":"diagnostico_y_esquema","label":"Diagnóstico, esquema y ciclo actual","order":1,"required":true,
     "instruction":"Diagnóstico oncológico con su estadio si el médico lo enunció, esquema en curso con los fármacos y las dosis dictadas, línea de tratamiento y número de ciclo cumplido. Transcribe el ciclo y las dosis literal; no los calcules a partir de fechas."},
    {"key":"toxicidad_del_ciclo","label":"Toxicidad del ciclo previo","order":2,"required":true,
     "instruction":"Efectos adversos desde el último ciclo con su duración e intensidad: náusea, vómito, mucositis, diarrea, neuropatía, alopecia, rash, fiebre o neutropenia febril, con el grado SOLO si el médico lo enunció. Nunca asignes grado de toxicidad ni gradúes tú los síntomas."},
    {"key":"sintomas_y_soporte","label":"Síntomas, dolor y medidas de soporte","order":3,"required":false,
     "instruction":"Dolor con la intensidad que refirió el paciente en la escala usada por el médico, apetito, peso, insomnio, ánimo y uso de analgésicos, antieméticos o factores estimulantes con dosis literal. Registra la red de apoyo y las necesidades de cuidado paliativo si se abordaron."},
    {"key":"intervalo_y_eventos","label":"Intervalo, hospitalizaciones y adherencia","order":4,"required":false,
     "instruction":"Tiempo desde el último control o ciclo, hospitalizaciones o consultas a urgencias del intervalo con su motivo, retrasos del tratamiento y sus causas (autorización de la EPS, citopenia, infección) y adherencia a la terapia oral. Solo lo dicho."},
    {"key":"laboratorios_e_imagenes","label":"Laboratorios, marcadores e imágenes de control","order":5,"required":false,
     "instruction":"Hemograma con neutrófilos y plaquetas, función renal y hepática, marcadores tumorales e imágenes de reevaluación, con su valor, fecha y la conclusión leída por el médico. Transcríbelo LITERAL: nunca interpretes una imagen, no calcules porcentajes de cambio ni infieras progresión."},
    {"key":"examen_fisico_de_control","label":"Examen físico de control","order":6,"required":true,
     "instruction":"Peso y signos vitales con los valores dichos, estado general, mucosas, piel, examen de la lesión o del lecho quirúrgico con las medidas dictadas, cadenas ganglionares, abdomen y estado del catéter o puerto si se revisó. No completes lo no examinado."},
    {"key":"evaluacion_de_respuesta","label":"Evaluación de la respuesta y estado funcional","order":7,"required":true,
     "instruction":"Categoría de respuesta con las palabras del médico (respuesta completa, parcial, enfermedad estable, progresión) y estado funcional ECOG solo si él lo enunció. Nunca declares progresión ni respuesta por tu cuenta, ni asignes el puntaje funcional."},
    {"key":"continuidad_del_tratamiento","label":"Continuidad o ajuste del tratamiento","order":8,"required":true,
     "instruction":"Decisión sobre el tratamiento tal como se dictó: continuar, reducir dosis con el porcentaje exacto, diferir el ciclo con la nueva fecha, cambiar de línea o suspender. Transcribe fármacos, dosis y fechas LITERAL, junto con soporte, transfusiones, remisiones y autorizaciones."},
    {"key":"proximo_control_y_alarmas","label":"Próximo control y signos de alarma","order":9,"required":false,
     "instruction":"Fecha del próximo ciclo o control y exámenes que debe traer, incapacidad con los días dichos, y signos de alarma explicados (fiebre, sangrado, vómito incoercible, disnea, dolor no controlado). Solo lo explicado hoy."}
  ]'::jsonb,
  updated_at = now()
where id = 'da944254-9a2d-5e99-8683-8c80476a38b4' and owner_id is null;

update public.clinical_templates set
  name = 'Valoración oncológica · aptitud para el ciclo y administración de quimioterapia',
  description = 'Valoración previa a la administración y registro del ciclo: verificación de laboratorios y estado clínico, cálculo del esquema tal como lo dictó el médico, premedicación, administración por el acceso venoso, reacciones inmediatas e indicaciones al egreso. Úsala el día de la infusión, no en la consulta de control.',
  sections = '[
    {"key":"indicacion_y_esquema","label":"Indicación, esquema y número de ciclo","order":1,"required":true,
     "instruction":"Diagnóstico, esquema a administrar con los fármacos dictados, número de ciclo e intención del tratamiento tal como se enunciaron. No deduzcas el ciclo de fechas previas ni completes el esquema con fármacos que no se nombraron."},
    {"key":"consentimiento_y_verificacion","label":"Consentimiento y verificación previa","order":2,"required":false,
     "instruction":"Consentimiento informado para la quimioterapia con los riesgos explicados, verificación de identidad, del esquema y de la fecha del ciclo, y alergias o reacciones previas a citotóxicos o contrastes. Si el consentimiento no se mencionó, indícalo; no lo des por obtenido."},
    {"key":"aptitud_clinica_y_laboratorios","label":"Aptitud clínica y laboratorios previos","order":3,"required":true,
     "instruction":"Estado clínico previo con signos vitales, peso y talla dichos, toxicidad residual del ciclo anterior, y hemograma con neutrófilos y plaquetas, función renal y hepática con su fecha. Transcribe TODAS las cifras LITERAL: nunca calcules superficie corporal ni depuración, ni declares apto por tu cuenta."},
    {"key":"dosis_y_preparacion","label":"Dosis calculadas y preparación","order":4,"required":true,
     "instruction":"Dosis de cada fármaco tal como el médico las dictó, con la unidad, el porcentaje de reducción si lo hubo y el volumen o tiempo de infusión, además de la premedicación con dosis y vía. Transcríbelo LITERAL: nunca recalcules por superficie corporal ni ajustes por función renal."},
    {"key":"administracion_y_acceso","label":"Administración y acceso venoso","order":5,"required":true,
     "instruction":"Acceso utilizado (periférico, puerto, catéter central) con su estado y permeabilidad, orden y hora de inicio y fin de cada infusión tal como se registraron, e hidratación administrada. Consigna solo los tiempos y volúmenes dictados; no los estimes."},
    {"key":"reacciones_y_tolerancia","label":"Reacciones inmediatas y tolerancia","order":6,"required":false,
     "instruction":"Signos vitales durante la infusión con los valores dichos, reacciones de hipersensibilidad, extravasación, náusea o dolor, y la conducta tomada (suspensión, medicamentos de rescate con dosis). Afirma que no hubo reacciones solo si el médico o la enfermera lo declararon."},
    {"key":"indicaciones_al_egreso","label":"Indicaciones al egreso","order":7,"required":true,
     "instruction":"Medicamentos para la casa con nombre, dosis, frecuencia y días transcritos literal (antieméticos, factores estimulantes, analgésicos), cuidados del acceso, hidratación y medidas ante mucositis o diarrea, tal como se explicaron. No agregues indicaciones de rutina."},
    {"key":"proximo_ciclo_y_alarmas","label":"Próximo ciclo y signos de alarma","order":8,"required":false,
     "instruction":"Fecha del próximo ciclo y exámenes previos que debe traer, autorizaciones pendientes ante la EPS, e instrucción de consultar de urgencia ante fiebre, sangrado o vómito persistente, tal como se explicó. Solo lo acordado hoy."}
  ]'::jsonb,
  updated_at = now()
where id = 'e1ebe51e-446d-5a90-81f7-86779396c5ba' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c1000000-0000-4000-8000-00000000000e', null,
   'Consulta de resultados y decisión terapéutica · opciones, junta y consentimiento',
   'Cita en la que se entregan resultados y se define el tratamiento: patología y estudios de extensión leídos literal, concepto de junta multidisciplinaria, opciones explicadas con sus riesgos, preferencias del paciente y decisión con su consentimiento. Úsala cuando la consulta define la conducta oncológica, no para el control entre ciclos.',
   'oncologia', 'Oncología clínica', 'institutional', false, 'active',
   '[
    {"key":"motivo_y_acompanante","label":"Motivo de la cita y acompañantes","order":1,"required":true,
     "instruction":"Propósito de la cita (entrega de resultados y definición del tratamiento), quién acompaña al paciente y qué desea saber sobre su enfermedad, con sus propias palabras cuando lo expresó. Escribe con respeto y sin adelantar conclusiones."},
    {"key":"resultados_de_patologia","label":"Resultados de patología y biomarcadores","order":2,"required":true,
     "instruction":"Informe de patología con tipo histológico, grado, márgenes, número de ganglios comprometidos y biomarcadores con su porcentaje y fecha, tal como el médico los leyó en voz alta. Transcríbelo LITERAL: nunca infieras un resultado, no lo redondees ni completes el que no se leyó."},
    {"key":"estudios_de_extension","label":"Estudios de extensión y estadio","order":3,"required":true,
     "instruction":"Tomografías, PET, gammagrafía o resonancia con la fecha y la conclusión leída, y el estadio o TNM SOLO tal como lo enunció el médico. Nunca estadifiques por tu cuenta, no interpretes imágenes ni afirmes metástasis que no se hayan dictado."},
    {"key":"estado_clinico_y_comorbilidades","label":"Estado clínico, funcional y comorbilidades","order":4,"required":false,
     "instruction":"Síntomas actuales, peso, estado funcional ECOG solo si el médico lo enunció, comorbilidades y medicamentos con dosis que condicionan la elección del tratamiento. Nunca asignes el puntaje funcional ni descartes una comorbilidad no interrogada."},
    {"key":"concepto_de_junta","label":"Concepto de junta multidisciplinaria","order":5,"required":false,
     "instruction":"Concepto de la junta con su fecha y las especialidades participantes, y la recomendación EXACTAMENTE como el médico la leyó o la refirió. Si el caso no ha pasado por junta o quedó pendiente, escríbelo así; nunca redactes una recomendación que no se dictó."},
    {"key":"opciones_explicadas","label":"Opciones terapéuticas explicadas","order":6,"required":true,
     "instruction":"Opciones que se le presentaron al paciente (cirugía, radioterapia, quimioterapia, terapia dirigida, inmunoterapia, ensayo clínico, manejo de soporte) con lo que se dijo de cada una en cuanto a intención, duración y efectos esperados. Registra solo lo efectivamente explicado; no añadas alternativas."},
    {"key":"riesgos_y_pronostico_informado","label":"Riesgos y pronóstico informado","order":7,"required":false,
     "instruction":"Riesgos, efectos adversos y expectativa de beneficio tal como el médico los enunció, incluidos los efectos sobre la fertilidad si se abordaron. Nunca cites cifras de supervivencia, porcentajes ni pronósticos que no se dijeron en la consulta."},
    {"key":"preferencias_del_paciente","label":"Preferencias y preguntas del paciente","order":8,"required":false,
     "instruction":"Preguntas, temores y preferencias expresadas por el paciente y su familia, entre comillas cuando sean textuales, y sus objetivos de cuidado si los manifestó. No interpretes ni resumas su postura en términos clínicos que él no usó."},
    {"key":"decision_y_consentimiento","label":"Decisión terapéutica y consentimiento","order":9,"required":true,
     "instruction":"Conducta definida con el esquema, la intención y la fecha de inicio tal como se dictaron, y consentimiento informado si se firmó o se explicó. Si el paciente pidió tiempo, no aceptó o quedó pendiente de junta, consígnalo así; nunca atribuyas una decisión que no manifestó."},
    {"key":"plan_operativo","label":"Plan operativo, remisiones y autorizaciones","order":10,"required":true,
     "instruction":"Exámenes previos al inicio, valoraciones requeridas (cardiología, odontología, nutrición, psicología, fertilidad), remisiones a cirugía o radioterapia, autorizaciones y trámites ante la EPS, y medicamentos con dosis literal. No inventes plazos ni requisitos."},
    {"key":"proximo_control_y_soporte","label":"Próximo control, soporte y alarmas","order":11,"required":false,
     "instruction":"Fecha del próximo control o del inicio del tratamiento, apoyo ofrecido (psicooncología, trabajo social, cuidado paliativo), incapacidad con los días dichos y signos por los que debe consultar antes. Solo lo acordado en la consulta."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();
update public.clinical_templates set
  name = 'Consulta inicial · dolor inflamatorio, articulaciones y compromiso sistémico',
  description = 'Primera valoración reumatológica: caracterización del dolor inflamatorio y la rigidez matinal, patrón y número de articulaciones comprometidas, manifestaciones extraarticulares, examen articular por regiones y lectura literal de autoanticuerpos e imágenes. Úsala cuando el paciente llega remitido por poliartralgia o autoanticuerpo positivo.',
  sections = '[
    {"key":"motivo_y_remision","label":"Motivo de consulta y remisión","order":1,"required":true,
     "instruction":"Motivo en las palabras del paciente y quién lo remite, con el hallazgo que originó la remisión tal como se enunció (poliartralgia, factor reumatoide o ANA positivo, rigidez, lumbalgia inflamatoria). No lo conviertas en diagnóstico."},
    {"key":"caracterizacion_del_dolor","label":"Caracterización del dolor y rigidez matinal","order":2,"required":true,
     "instruction":"Tiempo de evolución, ritmo inflamatorio o mecánico del dolor, rigidez matinal con los minutos referidos, patrón de compromiso (simétrico, aditivo, migratorio), articulaciones afectadas y respuesta a AINE o esteroide. Transcribe los minutos y el número de articulaciones tal como se dijeron; nunca los estimes."},
    {"key":"manifestaciones_sistemicas","label":"Manifestaciones extraarticulares y sistémicas","order":3,"required":false,
     "instruction":"Fenómeno de Raynaud, xerostomía y xeroftalmia, fotosensibilidad, aftas, alopecia, rash malar, psoriasis, uveítis, serositis, disnea, disfagia y síntomas constitucionales, tal como los refirió el paciente. Si un dominio no se interrogó, indícalo; no listes negativos no preguntados."},
    {"key":"antecedentes_reumatologicos","label":"Antecedentes personales y familiares","order":4,"required":false,
     "instruction":"Enfermedades autoinmunes previas, infecciones recientes, trombosis o pérdidas gestacionales, psoriasis, enfermedad inflamatoria intestinal, tuberculosis o contacto, hepatitis, y antecedentes familiares de enfermedad reumática con el parentesco dicho. Si no se exploraron, escríbelo así."},
    {"key":"medicamentos_previos","label":"Medicamentos y tratamientos previos","order":5,"required":false,
     "instruction":"AINE, esteroides con dosis y tiempo, antimaláricos, metotrexato u otros modificadores de la enfermedad ya usados con su dosis, duración, respuesta y motivo de suspensión, tal como se dictaron. Transcribe las dosis literal; nunca las recalcules ni completes."},
    {"key":"examen_articular","label":"Examen articular y de piel","order":6,"required":true,
     "instruction":"Articulaciones dolorosas e inflamadas nombradas una a una con su lateralidad, derrame, deformidades, dactilitis, entesitis, nódulos, arcos de movimiento, fuerza y hallazgos de piel, mucosas y uñas. Transcribe los conteos articulares solo si el médico los dictó; nunca los cuentes ni los estimes tú."},
    {"key":"laboratorios_e_imagenes","label":"Autoanticuerpos, reactantes e imágenes","order":7,"required":false,
     "instruction":"Factor reumatoide, anti-CCP, ANA con su patrón y título, ENA, ANCA, complemento, VSG y PCR, uroanálisis, y radiografías o ecografía articular, con su valor y fecha tal como se leyeron. Transcríbelo LITERAL: nunca infieras positividad, títulos ni erosiones no dictadas."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":8,"required":true,
     "instruction":"Razonamiento y diagnóstico con la precisión con que el médico lo formuló, con los diferenciales planteados y los criterios de clasificación SOLO si él los enunció. Nunca apliques criterios ni cierres el diagnóstico por tu cuenta."},
    {"key":"plan_y_tratamiento","label":"Plan, tratamiento y tamizajes","order":9,"required":true,
     "instruction":"Medicamentos con principio activo, dosis, vía y frecuencia transcritos LITERAL (esteroide, metotrexato con ácido fólico, antimaláricos, AINE), laboratorios de seguimiento y tamizajes previos a inmunosupresión, remisiones (oftalmología, fisiatría) y autorizaciones ante la EPS. Nunca ajustes dosis."},
    {"key":"educacion_y_proximo_control","label":"Educación, incapacidad y próximo control","order":10,"required":false,
     "instruction":"Educación dada sobre la enfermedad, protección articular, ejercicio, fotoprotección y riesgo de infección, incapacidad con los días dichos, y fecha del próximo control con los exámenes que debe traer. Solo lo explicado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = 'e1b3edec-0a09-5c12-95d0-6ffe9a818d57' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · actividad de enfermedad y tolerancia terapéutica',
  description = 'Control del paciente reumatológico en tratamiento: rigidez, articulaciones comprometidas y brotes del intervalo, adherencia y toxicidad del inmunosupresor, laboratorios de seguridad transcritos literal, evaluación de la actividad y ajuste del esquema. Úsala para el seguimiento habitual, no para el inicio de un biológico.',
  sections = '[
    {"key":"diagnostico_y_tratamiento","label":"Diagnóstico activo y tratamiento vigente","order":1,"required":true,
     "instruction":"Diagnóstico reumatológico con su tiempo de evolución y tratamiento vigente con principio activo, dosis y frecuencia tal como se enunciaron, incluido el esteroide en curso. Transcribe el esquema literal, sin abreviarlo ni convertir presentaciones."},
    {"key":"intervalo_y_adherencia","label":"Intervalo, adherencia y suministro","order":2,"required":false,
     "instruction":"Tiempo desde el último control, dosis omitidas, suspensiones por cuenta propia y sus motivos, y dificultades de entrega o autorización ante la EPS. Registra solo lo referido; si la adherencia no se exploró, indícalo."},
    {"key":"actividad_referida","label":"Síntomas del intervalo y brotes","order":3,"required":false,
     "instruction":"Rigidez matinal con los minutos referidos, articulaciones que duelen o se inflaman, brotes con su número y duración, dolor nocturno, fatiga y limitación para las actividades diarias. Transcribe los tiempos y conteos tal como los dio el paciente; nunca los promedies."},
    {"key":"toxicidad_e_infecciones","label":"Toxicidad, infecciones y comorbilidad","order":4,"required":false,
     "instruction":"Efectos adversos referidos (náusea, aftas, caída del cabello, elevación de transaminasas, citopenias, síntomas oculares por antimaláricos) e infecciones del intervalo con su manejo y hospitalizaciones. No atribuyas causalidad que el médico no haya enunciado."},
    {"key":"laboratorios_de_seguimiento","label":"Laboratorios de seguimiento","order":5,"required":false,
     "instruction":"Hemograma, transaminasas, creatinina, uroanálisis, VSG y PCR nuevos con su valor y fecha, y complemento o anticuerpos si se repitieron. Transcríbelos LITERAL; nunca los compares con previos que el médico no haya citado ni declares normalidad por tu cuenta."},
    {"key":"examen_articular_de_control","label":"Examen articular de control","order":6,"required":true,
     "instruction":"Articulaciones dolorosas e inflamadas con su lateralidad, derrame, deformidad, entesitis o dactilitis, arcos de movimiento y hallazgos de piel y mucosas explorados hoy. Compara con el examen previo solo si el médico hizo la comparación; nunca cuentes articulaciones tú."},
    {"key":"evaluacion_de_la_actividad","label":"Evaluación de la actividad de la enfermedad","order":7,"required":true,
     "instruction":"Estado de actividad con las palabras del médico (remisión, actividad baja, moderada o alta) y los índices DAS28, SDAI, BASDAI o SLEDAI ÚNICAMENTE con el puntaje que él dictó. Nunca calcules el índice ni clasifiques la actividad por tu cuenta."},
    {"key":"ajuste_del_tratamiento","label":"Ajuste del tratamiento","order":8,"required":true,
     "instruction":"Cambios de dosis, escalamiento o descenso del esteroide con el esquema exacto y las fechas transcritos LITERAL, inicio o cambio de modificador de la enfermedad o de biológico, infiltración indicada, nuevos laboratorios y remisiones. Nunca recalcules ni completes dosis."},
    {"key":"educacion_y_proximo_control","label":"Educación, incapacidad y próximo control","order":9,"required":false,
     "instruction":"Educación dada sobre protección articular, ejercicio, salud ósea, vacunación y prevención de infecciones, incapacidad con los días dichos, y fecha del próximo control con los exámenes que debe traer. Solo lo hablado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = '50118889-4f6e-5ea3-a337-955e95ca5580' and owner_id is null;

update public.clinical_templates set
  name = 'Valoración reumatológica · artrocentesis e infiltración articular',
  description = 'Registro del procedimiento reumatológico realizado: artrocentesis diagnóstica o evacuadora e infiltración articular o de partes blandas, con indicación, consentimiento, técnica y sitio, características del líquido, fármaco y dosis infiltrados, tolerancia y cuidados posteriores. Úsala solo cuando el procedimiento se ejecuta.',
  sections = '[
    {"key":"indicacion_del_procedimiento","label":"Indicación del procedimiento","order":1,"required":true,
     "instruction":"Procedimiento realizado y su indicación tal como la enunció el médico (estudio de monoartritis, sospecha de artritis séptica o por cristales, derrame a tensión, infiltración por dolor persistente). No amplíes ni deduzcas la indicación."},
    {"key":"consentimiento_y_verificacion","label":"Consentimiento y verificación de seguridad","order":2,"required":false,
     "instruction":"Consentimiento informado con los riesgos explicados, verificación de identidad, articulación y lateralidad, alergias a anestésicos o esteroides, infección de piel en el sitio y estado de coagulación si se revisó. Si el consentimiento no se mencionó, indícalo."},
    {"key":"condiciones_previas","label":"Condiciones previas y anticoagulación","order":3,"required":false,
     "instruction":"Anticoagulantes o antiagregantes y su suspensión con los días dictados, INR o plaquetas con los valores dichos, glucemia en diabéticos si se mencionó, y asepsia y antiséptico empleados. Transcribe las cifras literal; nunca las estimes ni des la suspensión por hecha."},
    {"key":"tecnica_y_sitio","label":"Técnica, articulación y abordaje","order":4,"required":true,
     "instruction":"Articulación o estructura intervenida con su lateralidad, abordaje empleado, guía ecográfica si se usó, anestesia local con el fármaco y la cantidad dictados y calibre de la aguja, en el orden en que se narró. No completes pasos de técnica que no se dictaron."},
    {"key":"liquido_y_muestras","label":"Líquido obtenido y muestras enviadas","order":5,"required":true,
     "instruction":"Volumen, color, turbidez y viscosidad del líquido tal como se dictaron, y estudios solicitados (recuento celular, Gram y cultivo, cristales con luz polarizada). Transcribe volúmenes y descripciones literal; nunca los estimes ni concluyas el tipo de derrame."},
    {"key":"farmaco_infiltrado","label":"Fármaco infiltrado y dosis","order":6,"required":true,
     "instruction":"Medicamento infiltrado con el nombre, la concentración, la dosis en miligramos y el volumen, junto con el anestésico asociado, EXACTAMENTE como los dictó el médico. Transcríbelo LITERAL: nunca conviertas concentraciones, no sumes volúmenes ni completes la dosis que falte."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones inmediatas","order":7,"required":false,
     "instruction":"Tolerancia del paciente, dolor durante y después, sangrado, mareo o reacción vasovagal, y alivio inmediato referido tras la infiltración. Afirma ausencia de complicaciones solo si el médico lo declaró."},
    {"key":"indicaciones_y_seguimiento","label":"Indicaciones posteriores y seguimiento","order":8,"required":true,
     "instruction":"Reposo relativo de la articulación con el tiempo dictado, frío local, analgesia con dosis literal, reinicio de anticoagulantes con la fecha dicha, signos de alarma de infección articular y cuándo estarán los resultados del líquido. No agregues cuidados de rutina."}
  ]'::jsonb,
  updated_at = now()
where id = '2a5ac62a-b3e6-5fc1-9cf9-e57a1552055c' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c1000000-0000-4000-8000-00000000000f', null,
   'Terapia biológica · tamizaje previo, aplicación y seguridad',
   'Consulta de inicio o continuidad de terapia biológica o de molécula pequeña: tamizaje de tuberculosis y hepatitis con resultados literales, vacunación, actividad de la enfermedad que justifica el escalamiento, aplicación y vigilancia de infecciones y eventos adversos. Úsala cuando la cita gira en torno al biológico y su seguridad.',
   'reumatologia', 'Reumatología', 'institutional', false, 'active',
   '[
    {"key":"diagnostico_y_justificacion","label":"Diagnóstico y justificación del biológico","order":1,"required":true,
     "instruction":"Diagnóstico con su tiempo de evolución, modificadores de la enfermedad ya usados con dosis, duración y motivo de falla, y la razón que el médico dio para escalar o continuar el biológico. Transcribe la justificación tal como la enunció; no la construyas tú."},
    {"key":"actividad_actual","label":"Actividad de la enfermedad que soporta la decisión","order":2,"required":true,
     "instruction":"Rigidez matinal en minutos, articulaciones dolorosas e inflamadas y el índice de actividad (DAS28, SDAI, BASDAI, SLEDAI) ÚNICAMENTE con el puntaje que el médico dictó, junto con VSG y PCR. Nunca calcules el índice ni clasifiques la actividad; sobre esta cifra se autoriza el medicamento."},
    {"key":"tamizaje_de_infecciones","label":"Tamizaje de tuberculosis, hepatitis y VIH","order":3,"required":true,
     "instruction":"PPD o IGRA con su resultado y fecha, radiografía de tórax, antígeno de superficie y anticore de hepatitis B, hepatitis C y VIH, tal como el médico los leyó. Transcríbelos LITERAL: nunca los des por negativos, no infieras un resultado y consigna expresamente el tamizaje pendiente."},
    {"key":"vacunacion_y_profilaxis","label":"Vacunación y profilaxis indicadas","order":4,"required":false,
     "instruction":"Vacunas aplicadas o pendientes (influenza, neumococo, hepatitis B, herpes zóster) con las fechas dichas, contraindicación de vacunas vivas si se mencionó, y profilaxis para tuberculosis latente con el fármaco, la dosis y la duración dictados. Transcríbelo literal."},
    {"key":"comorbilidades_y_riesgos","label":"Comorbilidades y riesgos para la terapia","order":5,"required":false,
     "instruction":"Infecciones recurrentes, falla cardiaca, enfermedad desmielinizante, antecedente de cáncer, embarazo o lactancia, cirugías próximas y comedicación con esteroide o metotrexato con dosis. Registra solo lo interrogado; no descartes un riesgo que no se exploró."},
    {"key":"laboratorios_de_seguridad","label":"Laboratorios de seguridad","order":6,"required":false,
     "instruction":"Hemograma, transaminasas, creatinina, uroanálisis y perfil lipídico con su valor y fecha tal como se leyeron. Transcríbelos LITERAL; nunca declares que están dentro de rango ni compares con previos que el médico no haya citado."},
    {"key":"examen_fisico","label":"Examen físico y búsqueda de foco infeccioso","order":7,"required":true,
     "instruction":"Signos vitales con los valores dichos, examen articular con la lateralidad de los hallazgos, piel y mucosas, y búsqueda de foco infeccioso activo (orofaringe, piel, urinario, pulmonar) según lo explorado hoy. No completes lo no examinado."},
    {"key":"medicamento_y_aplicacion","label":"Medicamento biológico, dosis y aplicación","order":8,"required":true,
     "instruction":"Biológico o molécula pequeña indicado con el nombre, la dosis, la vía y el intervalo transcritos LITERAL, y si se aplicó hoy: sitio, hora, lote si se dictó y premedicación. Nunca ajustes la dosis por peso ni completes el intervalo que no se dijo."},
    {"key":"reacciones_y_tolerancia","label":"Reacciones a la infusión y tolerancia","order":9,"required":false,
     "instruction":"Reacciones durante o después de la aplicación (reacción infusional, dolor o eritema en el sitio, fiebre, hipotensión) con los signos vitales dichos y la conducta tomada. Afirma que no hubo reacciones solo si el médico lo declaró."},
    {"key":"educacion_en_seguridad","label":"Educación en seguridad y signos de alarma","order":10,"required":true,
     "instruction":"Educación dada sobre suspender el biológico ante infección, consultar por fiebre, tos persistente o pérdida de peso, cadena de frío y técnica de autoaplicación, y conducta ante cirugías. Registra únicamente lo que se explicó hoy; no agregues advertencias de rutina."},
    {"key":"tramites_y_proximo_control","label":"Trámites ante la EPS y próximo control","order":11,"required":false,
     "instruction":"Autorización o continuidad del medicamento ante la EPS, soportes entregados, fecha de la próxima aplicación con el intervalo dictado y del próximo control con los laboratorios que debe traer. Solo lo acordado en la consulta."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();
update public.clinical_templates set
  name = 'Consulta inicial · desencadenantes, reacciones y antecedentes atópicos',
  description = 'Primera valoración alergológica: descripción de la reacción con su cronología y gravedad, sospecha de desencadenante (alimento, medicamento, picadura, aeroalérgeno), ambiente del hogar, antecedentes atópicos familiares y estudios previos leídos literal. Úsala cuando el paciente consulta por una reacción o por síntomas alérgicos sin estudio.',
  sections = '[
    {"key":"motivo_y_remision","label":"Motivo de consulta y remisión","order":1,"required":true,
     "instruction":"Motivo en las palabras del paciente o del cuidador y quién lo remite, con el episodio o síntoma que originó la consulta tal como se enunció. No conviertas el motivo en un diagnóstico de alergia."},
    {"key":"descripcion_de_la_reaccion","label":"Descripción de la reacción y cronología","order":2,"required":true,
     "instruction":"Cada episodio con su fecha, el tiempo entre la exposición y el inicio, los síntomas por sistemas (urticaria, angioedema, broncoespasmo, vómito, hipotensión, síncope), la duración, el tratamiento recibido y la atención en urgencias. Solo lo referido; nunca clasifiques la gravedad ni afirmes anafilaxia si no se dijo."},
    {"key":"sospecha_de_desencadenante","label":"Desencadenante sospechado y exposición","order":3,"required":true,
     "instruction":"Sustancia o exposición sospechada con el detalle dictado: alimento y su forma de preparación, medicamento con nombre comercial o genérico, dosis y vía, picadura de himenóptero, látex o ejercicio, además de cofactores (AINE, alcohol, ejercicio). No atribuyas la reacción a un agente que el médico no señaló."},
    {"key":"sintomas_respiratorios_y_cutaneos","label":"Síntomas respiratorios, nasales y cutáneos habituales","order":4,"required":false,
     "instruction":"Rinorrea, estornudos, prurito nasal u ocular, obstrucción, tos, sibilancias y despertares nocturnos, dermatitis o urticaria recurrente, con su estacionalidad y su relación con lugares o actividades. Registra solo lo referido; si un dominio no se interrogó, indícalo."},
    {"key":"ambiente_y_exposiciones","label":"Ambiente del hogar y exposiciones","order":5,"required":false,
     "instruction":"Humedad, moho, alfombras, peluches, colchón y almohada, mascotas dentro de la casa, humo de cigarrillo o de leña, y exposición laboral o escolar, tal como los describió el paciente. No supongas exposiciones por el tipo de vivienda o la ciudad."},
    {"key":"antecedentes_atopicos","label":"Antecedentes atópicos personales y familiares","order":6,"required":false,
     "instruction":"Asma, rinitis, dermatitis atópica, alergia alimentaria o medicamentosa previas con su manejo, uso de adrenalina autoinyectable, y antecedentes atópicos familiares con el parentesco dicho. Si no se exploraron, escríbelo así en vez de dejar la sección vacía."},
    {"key":"examen_fisico","label":"Examen físico dirigido","order":7,"required":true,
     "instruction":"Signos vitales y saturación con los valores dichos, piel (urticaria, dermografismo, eccema con su distribución), mucosa nasal y cornetes, orofaringe, otoscopia, auscultación pulmonar y ojos, según lo explorado. No completes lo no examinado."},
    {"key":"estudios_previos","label":"Estudios previos revisados","order":8,"required":false,
     "instruction":"Pruebas cutáneas, IgE específicas con su valor y clase, IgE total, eosinófilos, triptasa y espirometría previas, con su fecha y la lectura que hizo el médico. Transcríbelo LITERAL: nunca declares una sensibilización, no conviertas unidades ni interpretes un resultado no leído."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":9,"required":true,
     "instruction":"Razonamiento y diagnóstico con la precisión con que el médico lo formuló (alergia mediada por IgE, intolerancia, urticaria crónica, rinitis alérgica) y los diferenciales planteados. Nunca confirmes ni descartes una alergia por tu cuenta."},
    {"key":"plan_y_evitacion","label":"Plan, evitación y tratamiento de rescate","order":10,"required":true,
     "instruction":"Pruebas solicitadas, medidas de evitación indicadas, medicamentos con principio activo, dosis y frecuencia transcritos LITERAL, adrenalina autoinyectable con la dosis dictada y su entrenamiento, plan escrito ante reacción, remisiones y próximo control con signos de alarma. Nunca ajustes dosis."}
  ]'::jsonb,
  updated_at = now()
where id = '6ffb3e24-d730-5bf6-bf20-f66e87f5e826' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · control de síntomas y exposición a alérgenos',
  description = 'Control del paciente alérgico en manejo: síntomas y reacciones desde la última cita, adherencia y técnica de los dispositivos, cumplimiento de las medidas de evitación, estudios nuevos transcritos literal y ajuste del tratamiento. Úsala para el seguimiento de rinitis, asma alérgica, urticaria o dermatitis ya diagnosticadas.',
  sections = '[
    {"key":"diagnosticos_y_tratamiento","label":"Diagnósticos activos y tratamiento vigente","order":1,"required":true,
     "instruction":"Diagnósticos alergológicos activos con su tiempo de evolución y tratamiento vigente con principio activo, dosis y frecuencia tal como se enunciaron, incluidos inhalados, nasales y tópicos. Transcribe el esquema literal, sin abreviarlo."},
    {"key":"intervalo_y_reacciones","label":"Intervalo y reacciones desde el último control","order":2,"required":false,
     "instruction":"Tiempo desde el último control y reacciones del intervalo con su número, desencadenante identificado, síntomas, tratamiento recibido, uso de adrenalina y consultas a urgencias. Transcribe los conteos tal como se dieron; nunca los estimes ni los sumes."},
    {"key":"control_de_sintomas","label":"Control de síntomas y días con molestias","order":3,"required":false,
     "instruction":"Síntomas nasales, oculares, cutáneos o respiratorios en las últimas semanas, días con molestias, despertares nocturnos, uso de rescate y afectación del estudio o del trabajo. Solo lo referido; nunca calcules puntajes de cuestionarios de control."},
    {"key":"adherencia_y_dispositivos","label":"Adherencia y técnica de los dispositivos","order":4,"required":false,
     "instruction":"Adherencia al antihistamínico, al corticoide nasal o inhalado y al emoliente, técnica de aplicación revisada hoy con los errores concretos observados, disponibilidad del medicamento en la EPS y vigencia de la adrenalina autoinyectable. No afirmes técnica adecuada si no se verificó."},
    {"key":"medidas_de_evitacion","label":"Cumplimiento de las medidas de evitación","order":5,"required":false,
     "instruction":"Cumplimiento de las medidas indicadas (control de ácaros, retiro de alfombras o peluches, mascota fuera de la habitación, lectura de etiquetas, evitación del medicamento implicado) y las dificultades que refirió. Registra solo lo hablado."},
    {"key":"estudios_nuevos","label":"Estudios nuevos revisados","order":6,"required":false,
     "instruction":"Pruebas cutáneas, IgE específicas con su valor y clase, eosinófilos, espirometría u óxido nítrico exhalado nuevos, con su fecha y la lectura hecha por el médico. Transcríbelo LITERAL; nunca interpretes el resultado ni lo compares con previos no citados."},
    {"key":"examen_de_control","label":"Examen físico de control","order":7,"required":true,
     "instruction":"Signos vitales y saturación con los valores dichos, piel con la distribución y el estado de las lesiones, mucosa nasal y cornetes, orofaringe, ojos y auscultación pulmonar, según lo explorado hoy. No completes lo no examinado."},
    {"key":"analisis_del_control","label":"Análisis del control de la enfermedad","order":8,"required":true,
     "instruction":"Valoración del control con las palabras del médico (controlado, parcialmente controlado, no controlado) y las causas del descontrol que él identificó (exposición persistente, mala técnica, adherencia). Nunca definas la categoría por tu cuenta."},
    {"key":"ajuste_y_proximo_control","label":"Ajuste del plan y próximo control","order":9,"required":true,
     "instruction":"Cambios de medicamento o de dosis transcritos LITERAL, indicación o continuidad de inmunoterapia, renovación de la adrenalina, plan escrito ante reacción, nuevos estudios, remisiones e incapacidad con los días dichos. Cierra con la fecha del próximo control y qué debe traer."}
  ]'::jsonb,
  updated_at = now()
where id = '5b375c82-e284-5150-b268-b716c4d94a4f' and owner_id is null;

update public.clinical_templates set
  name = 'Valoración alergológica · pruebas cutáneas y estudio de hipersensibilidad',
  description = 'Registro de las pruebas realizadas en consulta: prick, intradérmicas o de parche, con suspensión previa de antihistamínicos, controles positivo y negativo, alérgenos probados y lecturas en milímetros transcritas literal, además de la tolerancia y la conducta. Úsala el día en que se ejecutan las pruebas, no en la cita que las indica.',
  sections = '[
    {"key":"indicacion_de_las_pruebas","label":"Indicación de las pruebas","order":1,"required":true,
     "instruction":"Pruebas realizadas y su indicación tal como la enunció el médico (estudio de rinitis o asma, sospecha de alergia alimentaria o medicamentosa, dermatitis de contacto). No amplíes la indicación ni la deduzcas del diagnóstico."},
    {"key":"consentimiento_y_verificacion","label":"Consentimiento y verificación previa","order":2,"required":false,
     "instruction":"Consentimiento informado con los riesgos explicados, incluida la posibilidad de reacción sistémica, verificación de identidad y disponibilidad de adrenalina y equipo de reanimación en el sitio. Si el consentimiento no se mencionó, indícalo; no lo des por obtenido."},
    {"key":"condiciones_previas","label":"Condiciones previas y suspensión de medicamentos","order":3,"required":true,
     "instruction":"Suspensión de antihistamínicos, antidepresivos u otros fármacos con los días exactos dictados, uso reciente de esteroide tópico o sistémico, estado de la piel y ausencia de reacción aguda o embarazo si se mencionó. Transcribe los días literal; nunca los estimes ni des la suspensión por hecha."},
    {"key":"tecnica_y_alergenos","label":"Técnica y alérgenos probados","order":4,"required":true,
     "instruction":"Tipo de prueba (prick, prick-prick, intradérmica, parche), sitio de aplicación, batería y alérgenos probados uno a uno con la concentración o dilución dictada, y controles positivo e histamina y negativo con solución salina. No agregues alérgenos ni concentraciones que no se dictaron."},
    {"key":"lecturas_y_resultados","label":"Lecturas y resultados","order":5,"required":true,
     "instruction":"Tiempo de lectura y resultado de CADA alérgeno con el diámetro de la pápula y del eritema en milímetros, o la graduación del parche, EXACTAMENTE como los dictó el médico. Transcríbelos LITERAL: nunca midas, redondees ni declares positivo o negativo por tu cuenta."},
    {"key":"tolerancia_y_reacciones","label":"Tolerancia y reacciones adversas","order":6,"required":false,
     "instruction":"Prurito, reacción local extensa, síntomas sistémicos, signos vitales durante la observación con los valores dichos y el tratamiento administrado con su dosis si hubo reacción. Afirma que no hubo reacciones solo si el médico lo declaró."},
    {"key":"interpretacion","label":"Interpretación del médico","order":7,"required":true,
     "instruction":"Correlación entre los resultados y la historia clínica EXCLUSIVAMENTE con las palabras del médico. Nunca concluyas sensibilización, alergia clínica ni tolerancia por tu cuenta: una prueba positiva sin correlación clínica no es un diagnóstico."},
    {"key":"conducta_y_seguimiento","label":"Conducta, evitación y seguimiento","order":8,"required":true,
     "instruction":"Medidas de evitación indicadas, medicamentos con dosis literal, indicación de inmunoterapia o de prueba de reto, pruebas complementarias solicitadas y fecha del próximo control, tal como se dictaron. No agregues recomendaciones de rutina ni fijes plazos que nadie dijo."}
  ]'::jsonb,
  updated_at = now()
where id = '7bd1d155-20fe-5ae4-bd28-f82aab55d198' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c1000000-0000-4000-8000-000000000010', null,
   'Inmunoterapia y prueba de reto controlada · aplicación, tolerancia y reacción',
   'Sesión de inmunoterapia con alérgenos o de prueba de reto controlada con alimento o medicamento: verificación de seguridad, vial y dosis o dosis progresivas transcritas literal, monitoreo y tiempo de observación, reacciones con su manejo y conducta para la siguiente sesión. Úsala cada vez que se aplica o se reta, por el riesgo de anafilaxia.',
   'alergologia', 'Alergología e inmunología', 'institutional', false, 'active',
   '[
    {"key":"tipo_de_sesion_e_indicacion","label":"Tipo de sesión e indicación","order":1,"required":true,
     "instruction":"Tipo de sesión (inmunoterapia subcutánea o sublingual, prueba de reto con alimento o medicamento, desensibilización) y su indicación tal como la enunció el médico, con el alérgeno o fármaco implicado. No deduzcas el tipo de sesión ni el agente."},
    {"key":"consentimiento_y_recursos","label":"Consentimiento y recursos de emergencia","order":2,"required":false,
     "instruction":"Consentimiento informado con el riesgo de anafilaxia explicado, verificación de identidad y del producto, y disponibilidad de adrenalina, oxígeno y equipo de reanimación en el sitio. Si el consentimiento no se mencionó, indícalo; no lo des por obtenido."},
    {"key":"condiciones_previas","label":"Condiciones previas y criterios de seguridad","order":3,"required":true,
     "instruction":"Estado clínico del día: infección o fiebre, asma no controlada, síntomas actuales, uso de betabloqueadores o IECA, ejercicio o alcohol reciente, embarazo si se mencionó, y espirometría o pico flujo previo con el valor dicho. Transcribe las cifras literal; nunca declares apto por tu cuenta."},
    {"key":"antecedente_de_la_sesion_previa","label":"Antecedente de la sesión previa","order":4,"required":false,
     "instruction":"Fecha y dosis de la última aplicación, tiempo transcurrido y reacciones que presentó (local o sistémica) con su manejo. Transcribe la dosis previa literal; nunca la reconstruyas ni asumas que el intervalo se cumplió."},
    {"key":"vial_dosis_y_via","label":"Vial, dosis y vía administrada","order":5,"required":true,
     "instruction":"Vial o concentración, número de dosis dentro del esquema, dosis administrada con su volumen o miligramos, vía y sitio de aplicación, o cada dosis progresiva del reto con su hora, EXACTAMENTE como las dictó el médico. Transcríbelo LITERAL: nunca escales, dupliques ni calcules una dosis."},
    {"key":"monitoreo_y_observacion","label":"Monitoreo y tiempo de observación","order":6,"required":true,
     "instruction":"Signos vitales, saturación y pico flujo o espirometría durante la observación con los valores y las horas dictados, y el tiempo total que permaneció en observación. Transcribe cada valor y cada tiempo literal; nunca los estimes ni des por completado un periodo no mencionado."},
    {"key":"reacciones_y_manejo","label":"Reacciones presentadas y manejo","order":7,"required":true,
     "instruction":"Reacciones locales (pápula, eritema, prurito con su tamaño dictado) o sistémicas (urticaria, angioedema, broncoespasmo, hipotensión, síntomas gastrointestinales) con la hora de aparición, y el tratamiento aplicado con fármaco, dosis y vía literales. Afirma que no hubo reacción solo si el médico lo declaró."},
    {"key":"resultado_del_reto","label":"Resultado del reto o de la sesión","order":8,"required":true,
     "instruction":"Conclusión de la sesión EXCLUSIVAMENTE con las palabras del médico (reto tolerado, reto positivo, sesión completada, dosis suspendida). Nunca declares tolerancia ni alergia confirmada por tu cuenta: de esta conclusión depende que el paciente vuelva a exponerse al agente."},
    {"key":"conducta_para_la_siguiente_dosis","label":"Conducta para la siguiente dosis","order":9,"required":true,
     "instruction":"Dosis y fecha de la próxima aplicación, ajuste o repetición de la dosis y decisión de continuar o suspender el esquema, transcritos LITERAL tal como se dictaron. Nunca proyectes el escalamiento ni calcules la siguiente dosis del protocolo."},
    {"key":"indicaciones_al_egreso","label":"Indicaciones al egreso y signos de alarma","order":10,"required":false,
     "instruction":"Reposo y evitación de ejercicio, alcohol o baño caliente tras la aplicación, medicamentos para la casa con dosis literal, uso de la adrenalina autoinyectable y signos por los que debe consultar de urgencia, tal como se explicaron. No agregues indicaciones de rutina."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();
