-- Por qué: renovación del catálogo de plantillas — lote del área 4 (especialidades
-- quirúrgicas mayores). Las 18 plantillas de fábrica de estas 6 especialidades salían del
-- generador genérico y no pedían nada de lo que define una nota quirúrgica: los hallazgos
-- intraoperatorios como los dictó el cirujano, el sangrado solo si se enunció, el material
-- implantado con marca y medidas, el estado de la herida y de los drenajes en el control, ni
-- la semiología propia de cada área (pulsos por territorio, Glasgow por componente, función
-- pulmonar). Se reescriben las 3 de fábrica por especialidad y se agrega una 4ª nueva.
--
-- cirugia_general: "Consulta inicial · valoración quirúrgica de patología abdominal y de
--   pared", "Control posoperatorio · herida quirúrgica, dolor y retiro de puntos",
--   "Descripción quirúrgica · técnica, hallazgos intraoperatorios y cierre", 4ª: "Urgencia
--   quirúrgica · abdomen agudo y decisión operatoria" — es la valoración más frecuente del
--   cirujano general y la decisión de operar o no es el punto de mayor riesgo documental.
-- cirugia_cardiovascular: "Consulta inicial · síntomas cardiovasculares y estudio de la
--   indicación quirúrgica", "Control posoperatorio · recuperación cardiovascular,
--   esternotomía y anticoagulación", "Descripción quirúrgica · procedimiento cardiovascular
--   y tiempos de perfusión", 4ª: "Valoración preoperatoria · riesgo quirúrgico, optimización
--   y consentimiento" — la cita donde se decide una cirugía de alto riesgo y se explica ese
--   riesgo a la familia; escalas y consentimiento no pueden quedar implícitos.
-- cirugia_torax: "Consulta inicial · síntomas torácicos, función pulmonar y estudio de la
--   lesión", "Control y seguimiento · evolución respiratoria, drenajes y herida",
--   "Descripción quirúrgica · toracoscopia o toracotomía con hallazgos y drenajes", 4ª:
--   "Toracostomía cerrada · inserción de tubo de tórax y manejo inicial del drenaje" — es el
--   procedimiento más frecuente del área, casi siempre urgente y el peor documentado.
-- cirugia_vascular: "Consulta inicial · enfermedad arterial y venosa con examen de pulsos",
--   "Control y seguimiento · perfusión, permeabilidad del injerto y herida", "Procedimiento
--   vascular · técnica abierta o endovascular y hallazgos", 4ª: "Pie diabético · perfusión,
--   infección y plan de salvamento de la extremidad" — la consulta vascular más frecuente en
--   Colombia y aquella en la que un dato inventado puede costar una extremidad.
-- neurocirugia: "Consulta inicial · déficit neurológico, dolor y estudio neuroquirúrgico",
--   "Control posoperatorio · evolución neurológica y herida quirúrgica", "Descripción
--   quirúrgica · procedimiento neuroquirúrgico y hallazgos", 4ª: "Trauma craneoencefálico ·
--   Glasgow, tomografía y conducta neuroquirúrgica" — la urgencia neuroquirúrgica más
--   frecuente; el Glasgow y la tomografía deben quedar literales, nunca calculados.
-- cirugia_plastica: "Consulta inicial · defecto funcional o estético y plan reconstructivo",
--   "Control y seguimiento · cicatrización, simetría y cuidados posoperatorios",
--   "Descripción quirúrgica · técnica reconstructiva o estética e implantes", 4ª:
--   "Valoración preoperatoria estética · expectativas, consentimiento y registro
--   fotográfico" — es la consulta de mayor riesgo médico-legal de la especialidad:
--   expectativas del paciente, consentimiento y fotos son el núcleo del documento.

update public.clinical_templates set
  name = 'Consulta inicial · valoración quirúrgica de patología abdominal y de pared',
  description = 'Primera valoración por cirugía general: cronología del síntoma quirúrgico, examen abdominal y de pared, estudios aportados y definición de si hay o no indicación operatoria. Úsala en la primera cita ambulatoria o cuando el paciente llega remitido por medicina general, urgencias o la EPS.',
  sections = '[
    {"key":"motivo_de_consulta","label":"Motivo de consulta","order":1,"required":true,
     "instruction":"Documenta el motivo en las palabras del paciente y quién lo remite (medicina general, EPS, urgencias, otro especialista) tal como se dijo. No traduzcas el motivo a un diagnóstico ni asumas que hay indicación quirúrgica."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":2,"required":true,
     "instruction":"Cronología del cuadro: inicio, localización e irradiación del dolor, cambios del hábito intestinal, náusea, vómito, fiebre, masa o abultamiento, y tratamientos ya recibidos con su respuesta. Solo lo referido en la consulta; si un dato no se mencionó, indícalo en vez de completarlo."},
    {"key":"antecedentes_quirurgicos","label":"Antecedentes quirúrgicos y abdominales","order":3,"required":false,
     "instruction":"Cirugías previas con su fecha aproximada y abordaje (abierto o laparoscópico), hernias o eventraciones previas, mallas, episodios de obstrucción y complicaciones anestésicas, tal como los relató el paciente. Si una fecha no se precisó, escríbelo así; nunca la estimes."},
    {"key":"antecedentes_y_riesgo_quirurgico","label":"Antecedentes personales y riesgo quirúrgico","order":4,"required":false,
     "instruction":"Comorbilidades, medicación crónica con énfasis en anticoagulantes y antiagregantes, alergias, tabaquismo, alcohol e índice de masa corporal solo si el médico lo enunció. Transcribe dosis y clasificaciones de riesgo (ASA) literal; nunca las asignes ni las calcules tú."},
    {"key":"revision_por_sistemas","label":"Revisión por sistemas dirigida","order":5,"required":false,
     "instruction":"Síntomas digestivos, urinarios y generales explorados en la consulta: pérdida de peso con las cifras dichas, ictericia, melenas, hematoquecia, saciedad temprana. Registra solo lo que se preguntó; no listes negativos que nadie mencionó."},
    {"key":"examen_fisico_quirurgico","label":"Examen físico abdominal y de pared","order":6,"required":true,
     "instruction":"Estado general y signos vitales con los valores dichos; inspección, palpación, signos de irritación peritoneal y maniobras nombradas por el cirujano, características de la masa o de la hernia (tamaño, reductibilidad, anillo) y estado de heridas o cicatrices. No completes lo no examinado."},
    {"key":"estudios_aportados","label":"Estudios y ayudas diagnósticas aportadas","order":7,"required":false,
     "instruction":"Laboratorios, ecografía, tomografía, endoscopia o patología que el paciente trajo: transcribe fechas, valores y conclusiones literal, tal como el cirujano los leyó en voz alta. Si un estudio está pendiente o no fue aportado, escríbelo así; nunca interpretes imágenes que no se describieron."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":8,"required":true,
     "instruction":"Razonamiento y diagnósticos con la precisión con que el cirujano los formuló, incluidos los diferenciales que consideró. Las clasificaciones (Tokio, Hinchey, tipo de hernia) se transcriben solo si él las enunció: nunca las asignes tú a partir de los hallazgos."},
    {"key":"plan_quirurgico_y_educacion","label":"Plan, indicación quirúrgica y educación","order":9,"required":true,
     "instruction":"Conducta definida: manejo médico, estudios adicionales, remisión o programación quirúrgica con el procedimiento y el abordaje tal como se nombraron. Registra la explicación de riesgos y beneficios dada al paciente y la incapacidad solo si se otorgó, con los días exactos. No des por firmado el consentimiento."},
    {"key":"proximo_control_y_signos_de_alarma","label":"Próximo control y signos de alarma","order":10,"required":false,
     "instruction":"Cuándo vuelve a control y con qué resultados, y los signos de alarma que se le explicaron para consultar a urgencias (dolor que aumenta, fiebre, vómito persistente, hernia que no reduce, sangrado). Solo lo dicho en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = 'e24483e9-7377-59d1-86fd-c18ce6ed3a0a' and owner_id is null;

update public.clinical_templates set
  name = 'Control posoperatorio · herida quirúrgica, dolor y retiro de puntos',
  description = 'Control tras una cirugía o de una patología en manejo expectante: días de posoperatorio, estado de la herida y de los drenajes, dolor, tolerancia a la vía oral y retiro de material de sutura. Úsala en los controles ambulatorios de cirugía general.',
  sections = '[
    {"key":"procedimiento_previo","label":"Procedimiento previo y tiempo de evolución","order":1,"required":true,
     "instruction":"Cirugía o diagnóstico en seguimiento, fecha del procedimiento y días de posoperatorio tal como se dijeron; si la fecha no se enunció, indícalo y no la calcules. Registra hallazgos operatorios o el resultado de patología solo si el cirujano los citó en esta consulta."},
    {"key":"evolucion_referida","label":"Evolución referida por el paciente","order":2,"required":false,
     "instruction":"Evolución desde el alta o el último control en palabras del paciente: dolor y su intensidad con la escala solo si él la dio, fiebre, náusea, tolerancia a la vía oral, deposiciones y gases, actividad y regreso al trabajo. Solo lo referido; no infieras una evolución favorable."},
    {"key":"medicacion_y_adherencia","label":"Medicación, analgesia y adherencia","order":3,"required":false,
     "instruction":"Analgésicos, antibióticos y profilaxis antitrombótica que viene recibiendo, con dosis y días tal como se dictaron: transcríbelos literal, sin ajustar ni completar esquemas. Registra efectos adversos y suspensiones referidas por el paciente."},
    {"key":"estado_de_la_herida","label":"Estado de la herida quirúrgica","order":4,"required":true,
     "instruction":"Aspecto de la herida descrito por el cirujano: bordes, afrontamiento, eritema, edema, dehiscencia, secreción con sus características y signos de infección del sitio operatorio. Registra el tamaño solo si se midió y se dictó; nunca lo estimes a partir de la descripción."},
    {"key":"drenajes_y_dispositivos","label":"Drenajes, sondas y dispositivos","order":5,"required":false,
     "instruction":"Drenajes, sondas o dispositivos aún presentes: tipo, sitio, características y cantidad del débito tal como se dictaron, y si se retiraron hoy. Las cifras de débito se transcriben literal; si no se cuantificó, escríbelo así en vez de aproximarlo."},
    {"key":"examen_fisico_de_control","label":"Examen físico de control","order":6,"required":true,
     "instruction":"Signos vitales con los valores dichos y examen dirigido: abdomen, sitio quirúrgico, colecciones, hernia incisional o abultamiento y estado de la pared. Compara con hallazgos previos solo si el cirujano hizo la comparación; no completes lo no examinado."},
    {"key":"procedimientos_realizados_hoy","label":"Curación y retiro de material de sutura","order":7,"required":false,
     "instruction":"Curación realizada, retiro de puntos, grapas o mecha, drenaje de colección u otro procedimiento hecho en la consulta, con la técnica y la tolerancia tal como se describieron. Si no se realizó ningún procedimiento, indícalo; no lo des por hecho por tratarse de un control."},
    {"key":"analisis_y_ajuste_del_plan","label":"Análisis, ajuste del plan y próximo control","order":8,"required":true,
     "instruction":"Evaluación de la evolución con las palabras del cirujano, cambios de tratamiento, estudios o remisiones solicitadas, incapacidad con los días exactos solo si se otorgó, recomendaciones de cuidado de la herida y de actividad, y fecha del próximo control con los signos de alarma explicados."}
  ]'::jsonb,
  updated_at = now()
where id = '74310c72-2c5e-5739-8a69-bee0712a8de5' and owner_id is null;

update public.clinical_templates set
  name = 'Descripción quirúrgica · técnica, hallazgos intraoperatorios y cierre',
  description = 'Nota operatoria dictada por el cirujano: indicación, equipo, verificación de seguridad, técnica paso a paso, hallazgos intraoperatorios, muestras enviadas y estado del paciente al terminar. Úsala para documentar cualquier procedimiento quirúrgico de cirugía general, ambulatorio o de sala.',
  sections = '[
    {"key":"indicacion_y_procedimiento","label":"Indicación y procedimiento realizado","order":1,"required":true,
     "instruction":"Diagnóstico preoperatorio, procedimiento realizado con su nombre completo y abordaje (abierto, laparoscópico, convertido) y carácter electivo o urgente, tal como los dictó el cirujano. Si el procedimiento cambió respecto a lo programado, consígnalo con la razón que él dio."},
    {"key":"equipo_y_anestesia","label":"Equipo quirúrgico y anestesia","order":2,"required":false,
     "instruction":"Cirujano, ayudantes, anestesiólogo e instrumentadora nombrados, y tipo de anestesia administrada tal como se enunció. Registra la posición del paciente y la profilaxis antibiótica con el medicamento y la dosis dichos; no agregues la profilaxis habitual si nadie la mencionó."},
    {"key":"verificacion_y_consentimiento","label":"Lista de verificación y consentimiento informado","order":3,"required":false,
     "instruction":"Consentimiento informado y lista de chequeo de cirugía segura (identificación, marcación del sitio, conteo de compresas e instrumental) SOLO como se mencionaron en la sala. Si no se habló del consentimiento, indícalo de forma explícita; nunca lo des por firmado."},
    {"key":"tecnica_quirurgica","label":"Técnica quirúrgica","order":4,"required":true,
     "instruction":"Descripción de la técnica en el orden en que la dictó el cirujano: incisión y su longitud si la dio, puertos y su calibre, disección, estructuras identificadas, ligaduras, dispositivos de energía y material de sutura con el calibre nombrado. No completes pasos estándar que él no describió."},
    {"key":"hallazgos_intraoperatorios","label":"Hallazgos intraoperatorios","order":5,"required":true,
     "instruction":"Hallazgos EXACTAMENTE como los dictó el cirujano: órgano comprometido, aspecto, adherencias, colecciones, perforación o compromiso vascular, con lateralidad y con las medidas y cantidades transcritas literal. Nunca midas, estimes ni clasifiques tú un hallazgo."},
    {"key":"sangrado_y_liquidos","label":"Sangrado, líquidos y hemoderivados","order":6,"required":false,
     "instruction":"Sangrado estimado, líquidos administrados y transfusiones SOLO si se enunciaron en la sala, con las cifras y unidades literales. Si el sangrado no se cuantificó, escribe que no se consignó; nunca lo estimes a partir del tipo de cirugía."},
    {"key":"muestras_y_dispositivos","label":"Muestras, mallas y dispositivos implantados","order":7,"required":false,
     "instruction":"Muestras enviadas a patología o cultivo con su rótulo tal como se dictó, y mallas, drenajes o dispositivos implantados con marca, tamaño y sitio si se nombraron. Si no se enviaron muestras o no se dejaron drenajes, consígnalo así."},
    {"key":"cierre_y_estado_final","label":"Cierre y estado al terminar","order":8,"required":true,
     "instruction":"Cierre por planos con el material nombrado, conteo de compresas e instrumental si se declaró, complicaciones intraoperatorias o su ausencia tal como el cirujano la enunció, y estado y destino del paciente al salir de sala (recuperación, cuidados intensivos, hospitalización)."},
    {"key":"indicaciones_posoperatorias","label":"Indicaciones posoperatorias y seguimiento","order":9,"required":true,
     "instruction":"Indicaciones dictadas: dieta, analgesia y antibióticos con dosis literales, movilización, manejo de drenajes y cuidado de la herida. Cierra con la fecha del control, el retiro de puntos y los signos de alarma explicados. Transcribe las dosis tal cual; no las ajustes ni las completes."}
  ]'::jsonb,
  updated_at = now()
where id = 'b67f2634-7e56-5f6b-bd7f-a12b5f8eadc4' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c4000000-0000-4000-8000-000000000001', null,
   'Urgencia quirúrgica · abdomen agudo y decisión operatoria',
   'Valoración de urgencias por dolor abdominal agudo o sospecha de patología quirúrgica: horas de evolución, examen peritoneal, paraclínicos e imágenes leídas y la decisión de llevar a cirugía, observar o dar de alta. Úsala en la interconsulta de urgencias o en la valoración del paciente hospitalizado.',
   'cirugia_general', 'Cirugía general', 'institutional', false, 'active',
   '[
    {"key":"motivo_y_contexto_de_la_valoracion","label":"Motivo y contexto de la valoración","order":1,"required":true,
     "instruction":"Quién solicita la valoración (urgencias, hospitalización, otra institución), hora de la solicitud y hora de la valoración tal como se dijeron, y motivo con las palabras del paciente o del médico remitente. No deduzcas la hora ni el nivel de urgencia."},
    {"key":"enfermedad_actual_y_cronologia","label":"Enfermedad actual y horas de evolución","order":2,"required":true,
     "instruction":"Horas o días exactos de evolución tal como se enunciaron, inicio y migración del dolor, intensidad, náusea, vómito, fiebre, deposiciones y gases, y analgesia recibida antes de la valoración con su efecto. Transcribe los tiempos literal; nunca los calcules ni los redondees."},
    {"key":"antecedentes_relevantes","label":"Antecedentes relevantes para la urgencia","order":3,"required":false,
     "instruction":"Cirugías abdominales previas, comorbilidades, anticoagulantes y antiagregantes con su última dosis, alergias, embarazo y última menstruación si se preguntaron, y ayuno con la hora referida. Si un antecedente no se exploró, indícalo."},
    {"key":"estado_hemodinamico","label":"Estado hemodinámico y signos vitales","order":4,"required":true,
     "instruction":"Signos vitales con los valores dichos, estado de conciencia, perfusión y signos de respuesta inflamatoria o de choque descritos por el médico. Nunca calcules índices ni asignes escalas de gravedad que no se hayan enunciado en la valoración."},
    {"key":"examen_abdominal","label":"Examen abdominal dirigido","order":5,"required":true,
     "instruction":"Inspección, ruidos intestinales, defensa, rebote y signos peritoneales, maniobras nombradas por el cirujano, tacto rectal solo si se realizó, y hallazgos en hernias, heridas o cicatrices previas. No completes signos que no se exploraron ni conviertas una descripción en un signo con nombre propio."},
    {"key":"paraclinicos_e_imagenes","label":"Paraclínicos e imágenes leídas","order":6,"required":false,
     "instruction":"Laboratorios e imágenes disponibles: transcribe valores, hora de la toma y conclusiones literal, tal como el médico los leyó. Si un estudio está pendiente o no se ha realizado, escríbelo así; nunca describas hallazgos de una imagen que nadie describió."},
    {"key":"analisis_y_diagnostico","label":"Análisis e impresión diagnóstica de urgencia","order":7,"required":true,
     "instruction":"Diagnóstico de trabajo y diferenciales con las palabras del cirujano, y clasificaciones de gravedad solo si él las enunció; nunca las asignes tú. Deja claro el grado de certeza que expresó y si el cuadro requiere observación seriada."},
    {"key":"decision_quirurgica","label":"Decisión quirúrgica y justificación","order":8,"required":true,
     "instruction":"Conducta definida: cirugía inmediata o diferida con el procedimiento nombrado, manejo médico con observación, o alta; con la justificación tal como la expresó el cirujano y la hora de la decisión si se dijo. No conviertas una sospecha en una indicación operatoria."},
    {"key":"consentimiento_y_preparacion","label":"Consentimiento informado y preparación","order":9,"required":false,
     "instruction":"Explicación de riesgos y alternativas al paciente o a la familia y consentimiento informado tal como se mencionaron, junto con la preparación indicada (ayuno, líquidos, antibiótico, hemoderivados reservados) con las dosis dictadas. Si el consentimiento no se mencionó, indícalo; no lo des por firmado."},
    {"key":"plan_inmediato_y_reevaluacion","label":"Plan inmediato y reevaluación","order":10,"required":true,
     "instruction":"Órdenes dadas: líquidos, analgesia y antibióticos con dosis literales, sonda o drenaje, estudios pendientes e interconsultas. Registra el plazo de reevaluación y los criterios por los que se debe llamar de nuevo al cirujano, tal como se explicaron al equipo o a la familia."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

update public.clinical_templates set
  name = 'Consulta inicial · síntomas cardiovasculares y estudio de la indicación quirúrgica',
  description = 'Primera valoración por cirugía cardiovascular: clase funcional y angina como las enunció el médico, factores de riesgo, examen cardiovascular y lectura de los estudios que definen si hay indicación operatoria. Úsala en la primera cita del paciente remitido por cardiología, urgencias o la EPS.',
  sections = '[
    {"key":"motivo_y_remitente","label":"Motivo de consulta y remisión","order":1,"required":true,
     "instruction":"Motivo en palabras del paciente y quién lo remite (cardiología, medicina interna, urgencias, EPS) con el diagnóstico de remisión tal como se enunció. No conviertas el motivo de remisión en una indicación quirúrgica ya definida."},
    {"key":"enfermedad_actual","label":"Enfermedad actual y clase funcional","order":2,"required":true,
     "instruction":"Cronología de disnea, dolor torácico, palpitaciones, síncope y edemas: inicio, progresión y desencadenantes referidos. La clase funcional NYHA y la escala de angina CCS se registran SOLO si el médico las enunció; nunca las asignes tú a partir de los síntomas."},
    {"key":"factores_de_riesgo","label":"Factores de riesgo cardiovascular","order":3,"required":false,
     "instruction":"Hipertensión, diabetes, dislipidemia, tabaquismo con paquetes-año solo si se dio la cifra, obesidad, enfermedad renal y antecedentes familiares, tal como se refirieron. Transcribe cifras y metas literal; nunca las calcules ni las completes."},
    {"key":"antecedentes_cardiovasculares","label":"Antecedentes cardiovasculares y quirúrgicos","order":4,"required":false,
     "instruction":"Infartos, revascularizaciones, angioplastias con stent, valvulopatías, arritmias, dispositivos implantados, endocarditis y cirugías cardiacas o torácicas previas con su fecha aproximada, solo como los relató el paciente. Si una fecha no se precisó, indícalo."},
    {"key":"medicacion_y_anticoagulacion","label":"Medicación actual y anticoagulación","order":5,"required":false,
     "instruction":"Medicamentos con dosis tal como se dictaron, con énfasis en antiagregantes, anticoagulantes, betabloqueadores y diuréticos, y el último día de administración si se preguntó. Transcribe las dosis literal; nunca las ajustes ni completes las que falten."},
    {"key":"examen_cardiovascular","label":"Examen cardiovascular","order":6,"required":true,
     "instruction":"Signos vitales con los valores dichos y, si se especificaron, la posición y el brazo de la toma de tensión; ingurgitación yugular, auscultación con soplos y ruidos agregados descritos por el médico, pulsos periféricos, edemas y estado de la piel y de cicatrices previas. No completes lo no examinado."},
    {"key":"estudios_aportados","label":"Estudios cardiovasculares aportados","order":7,"required":false,
     "instruction":"Electrocardiograma, ecocardiograma con fracción de eyección y gradientes, cateterismo, angiotomografía o pruebas de esfuerzo: transcribe fechas, cifras y conclusiones literal, tal como el médico las leyó. Si un estudio falta o está pendiente, escríbelo así; nunca infieras valores."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":8,"required":true,
     "instruction":"Diagnóstico y razonamiento con las palabras del cirujano, incluidos los diferenciales. Las clasificaciones y escalas de riesgo se transcriben solo si él las enunció y con su puntaje literal: nunca las calcules ni las asignes tú."},
    {"key":"plan_y_estudios_pendientes","label":"Plan, estudios pendientes y remisiones","order":9,"required":true,
     "instruction":"Estudios complementarios solicitados, ajustes de medicación con dosis literales, remisiones (hemodinamia, junta médico-quirúrgica, otra especialidad) y la conducta quirúrgica solo con el grado de definición que el cirujano expresó. No anticipes una programación que no se dijo."},
    {"key":"proximo_control_y_signos_de_alarma","label":"Próximo control y signos de alarma","order":10,"required":false,
     "instruction":"Cuándo vuelve y con qué estudios, y los signos de alarma explicados para consultar a urgencias (dolor torácico, disnea de reposo, síncope, palpitaciones sostenidas). Solo lo dicho en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = '697b28c6-f91d-58da-a92a-97d2c44a9ec1' and owner_id is null;

update public.clinical_templates set
  name = 'Control posoperatorio · recuperación cardiovascular, esternotomía y anticoagulación',
  description = 'Control del paciente operado del corazón o de grandes vasos: días de posoperatorio, clase funcional actual, estado de la herida esternal y de safenectomía, arritmias, control de anticoagulación con el INR literal y rehabilitación cardiaca. Úsala en los controles ambulatorios tras cirugía cardiovascular.',
  sections = '[
    {"key":"procedimiento_previo","label":"Procedimiento previo y tiempo de posoperatorio","order":1,"required":true,
     "instruction":"Cirugía realizada con el procedimiento nombrado, fecha e institución, y días o semanas de posoperatorio tal como se dijeron; si la fecha no se enunció, indícalo y no la calcules. Cita hallazgos operatorios o complicaciones previas solo si el cirujano los mencionó hoy."},
    {"key":"evolucion_y_clase_funcional","label":"Evolución referida y clase funcional","order":2,"required":false,
     "instruction":"Evolución desde el alta en palabras del paciente: disnea, dolor torácico, palpitaciones, edemas, fatiga y tolerancia al esfuerzo. La clase funcional NYHA solo si el médico la enunció en esta consulta; nunca la deduzcas del relato."},
    {"key":"medicacion_y_adherencia","label":"Medicación, adherencia y anticoagulación","order":3,"required":false,
     "instruction":"Medicamentos actuales con dosis literales, adherencia referida y control de anticoagulación con el INR y la dosis semanal EXACTAMENTE como se dictaron. Nunca calcules ni ajustes tú una dosis de anticoagulante ni infieras un INR que no se leyó en la consulta."},
    {"key":"herida_esternal_y_safenectomia","label":"Estado de la herida esternal y de safenectomía","order":4,"required":true,
     "instruction":"Aspecto de la herida esternal y de los sitios de safenectomía o de toma de arteria radial: bordes, secreción, eritema, dehiscencia, signos de mediastinitis e inestabilidad esternal descritos por el cirujano. Registra medidas solo si se dictaron; nunca las estimes."},
    {"key":"examen_cardiovascular_de_control","label":"Examen cardiovascular de control","order":5,"required":true,
     "instruction":"Signos vitales con los valores dichos, ritmo, auscultación cardiaca y pulmonar, ingurgitación yugular, edemas y pulsos, comparando con controles previos solo si el médico hizo la comparación. No completes sistemas no examinados."},
    {"key":"arritmias_y_eventos","label":"Arritmias, eventos y reingresos","order":6,"required":false,
     "instruction":"Fibrilación auricular, palpitaciones documentadas, síncope, derrame pericárdico, sangrados, infecciones o reingresos hospitalarios ocurridos en el intervalo, tal como se refirieron y con sus fechas. Solo lo mencionado en la consulta."},
    {"key":"estudios_de_control","label":"Estudios de control","order":7,"required":false,
     "instruction":"Electrocardiograma, ecocardiograma, radiografía de tórax y laboratorios de control: transcribe fracción de eyección, gradientes, hemoglobina, creatinina e INR literal, con su fecha. Si un estudio está pendiente, escríbelo así; nunca normalices un resultado."},
    {"key":"rehabilitacion_y_recomendaciones","label":"Rehabilitación cardiaca y recomendaciones","order":8,"required":false,
     "instruction":"Ingreso o adherencia a rehabilitación cardiaca, actividad permitida, restricciones esternales, conducción, regreso al trabajo y educación en dieta y cesación de tabaco, tal como se explicaron. Registra la incapacidad solo si se otorgó, con los días exactos."},
    {"key":"ajuste_del_plan_y_proximo_control","label":"Ajuste del plan y próximo control","order":9,"required":true,
     "instruction":"Cambios de medicación con dosis literales, estudios y remisiones solicitados, y fecha o plazo del próximo control con lo que debe traer. Cierra con los signos de alarma explicados (fiebre, secreción por la herida, disnea, dolor torácico, sangrado)."}
  ]'::jsonb,
  updated_at = now()
where id = '454efaa9-0996-5582-9546-c54af3785745' and owner_id is null;

update public.clinical_templates set
  name = 'Descripción quirúrgica · procedimiento cardiovascular y tiempos de perfusión',
  description = 'Nota operatoria de cirugía cardiovascular: abordaje, canulación y tiempos de circulación extracorpórea y de pinzamiento aórtico transcritos literal, injertos o prótesis con marca y tamaño, salida de bomba y estado al trasladar a cuidados intensivos.',
  sections = '[
    {"key":"indicacion_y_procedimiento","label":"Indicación y procedimiento realizado","order":1,"required":true,
     "instruction":"Diagnóstico preoperatorio, procedimiento realizado con su nombre completo y carácter electivo, urgente o emergente, tal como los dictó el cirujano. Si el plan cambió en sala, consígnalo con la razón que él expresó."},
    {"key":"equipo_anestesia_y_monitoreo","label":"Equipo, anestesia y monitoreo","order":2,"required":false,
     "instruction":"Cirujano, ayudantes, anestesiólogo y perfusionista nombrados, tipo de anestesia, accesos y monitoreo invasivo instalados y profilaxis antibiótica con medicamento y dosis dichos. No agregues el monitoreo habitual si no se mencionó."},
    {"key":"verificacion_y_consentimiento","label":"Lista de verificación y consentimiento informado","order":3,"required":false,
     "instruction":"Consentimiento informado del paciente o de su familia y lista de chequeo de cirugía segura, incluido el conteo de compresas e instrumental, SOLO como se mencionaron en sala. Si no se habló del consentimiento, indícalo; nunca lo des por firmado."},
    {"key":"abordaje_y_canulacion","label":"Abordaje y canulación","order":4,"required":true,
     "instruction":"Abordaje utilizado (esternotomía, minitoracotomía u otro) y estrategia de canulación arterial y venosa tal como la dictó el cirujano, junto con la protección miocárdica y la cardioplejia nombradas. No completes una técnica estándar que él no describió."},
    {"key":"tiempos_de_perfusion","label":"Tiempos de circulación extracorpórea y pinzamiento","order":5,"required":false,
     "instruction":"Tiempo de circulación extracorpórea, de pinzamiento aórtico y de paro circulatorio, con la temperatura, EXCLUSIVAMENTE como se dictaron en minutos. Transcríbelos literal; nunca los calcules, estimes ni completes. Si no se enunciaron, escribe que no se consignaron."},
    {"key":"tecnica_y_hallazgos","label":"Técnica, hallazgos e injertos o prótesis","order":6,"required":true,
     "instruction":"Descripción de la técnica en el orden dictado, hallazgos intraoperatorios (calcificación, estado valvular, calidad de los lechos), injertos con su origen y destino y prótesis o anillos con marca y número EXACTOS como se nombraron. Nunca asignes un tamaño ni un injerto que no se dijo."},
    {"key":"salida_de_bomba_y_soporte","label":"Salida de bomba, sangrado y soporte","order":7,"required":false,
     "instruction":"Salida de circulación extracorpórea, ritmo de salida, marcapaso epicárdico, soporte inotrópico o mecánico, sangrado estimado y hemoderivados transfundidos SOLO si se enunciaron, con cifras y unidades literales. Si el sangrado no se cuantificó, escríbelo así."},
    {"key":"cierre_drenajes_y_traslado","label":"Cierre, drenajes y traslado","order":8,"required":true,
     "instruction":"Cierre esternal y por planos con el material nombrado, drenajes mediastinales y pleurales con su sitio, conteo declarado, complicaciones intraoperatorias o su ausencia tal como se enunció, y estado hemodinámico y destino del paciente al salir de sala."},
    {"key":"indicaciones_posoperatorias","label":"Indicaciones posoperatorias y seguimiento","order":9,"required":true,
     "instruction":"Indicaciones dictadas para cuidados intensivos: soporte, anticoagulación y antibióticos con dosis literales, metas de tensión, manejo de drenajes, estudios de control y plazo de la próxima valoración. Transcribe las dosis tal cual; no las ajustes."}
  ]'::jsonb,
  updated_at = now()
where id = 'ae2516d0-59db-5480-a827-010a1ea146dd' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c4000000-0000-4000-8000-000000000002', null,
   'Valoración preoperatoria · riesgo quirúrgico, optimización y consentimiento',
   'Cita previa a la cirugía cardiovascular: revisión de los estudios definitivos, escalas de riesgo transcritas como las enunció el cirujano, manejo de antiagregantes y anticoagulantes, concepto de junta médico-quirúrgica y consentimiento informado con la explicación del riesgo. Úsala en la consulta que antecede a la programación.',
   'cirugia_cardiovascular', 'Cirugía cardiovascular', 'institutional', false, 'active',
   '[
    {"key":"motivo_y_procedimiento_propuesto","label":"Motivo y procedimiento propuesto","order":1,"required":true,
     "instruction":"Procedimiento propuesto con su nombre tal como se enunció y el diagnóstico que lo motiva. Registra si la cirugía es electiva, prioritaria o urgente solo si el cirujano lo dijo; nunca deduzcas la prioridad a partir de los hallazgos."},
    {"key":"estado_clinico_actual","label":"Estado clínico actual y clase funcional","order":2,"required":true,
     "instruction":"Síntomas actuales, tolerancia al esfuerzo y descompensaciones recientes referidas. Clase funcional NYHA y angina CCS SOLO si el médico las enunció hoy; nunca las asignes tú. Registra hospitalizaciones desde la última consulta con sus fechas."},
    {"key":"comorbilidades_y_riesgo","label":"Comorbilidades y evaluación del riesgo","order":3,"required":false,
     "instruction":"Comorbilidades que pesan en el riesgo (enfermedad renal, EPOC, diabetes, enfermedad cerebrovascular, cirugía cardiaca previa) tal como se refirieron. Las escalas de riesgo se transcriben con su puntaje literal solo si el cirujano lo enunció: nunca las calcules tú."},
    {"key":"medicacion_y_suspension","label":"Medicación y suspensión de antitrombóticos","order":4,"required":false,
     "instruction":"Plan de suspensión o continuación de antiagregantes y anticoagulantes con el medicamento, los días y la terapia puente EXACTAMENTE como se indicaron; transcríbelos literal y nunca completes un esquema que no se dictó. Incluye el resto de la medicación crónica con dosis."},
    {"key":"examen_fisico_preoperatorio","label":"Examen físico preoperatorio","order":5,"required":true,
     "instruction":"Signos vitales con los valores dichos, examen cardiovascular y pulmonar, pulsos y estado de los accesos, valoración de la vía aérea si se exploró, estado de la piel y focos infecciosos (dental, urinario, cutáneo) descritos. No completes lo no examinado."},
    {"key":"estudios_definitivos","label":"Estudios definitivos revisados","order":6,"required":false,
     "instruction":"Cateterismo, ecocardiograma, angiotomografía, doppler carotídeo, espirometría y laboratorios preoperatorios: transcribe cifras, fechas y conclusiones literal como las leyó el médico. Si un estudio está pendiente o vencido, escríbelo así; nunca supongas un resultado normal."},
    {"key":"decision_de_junta","label":"Decisión de junta médico-quirúrgica","order":7,"required":false,
     "instruction":"Concepto de la junta médico-quirúrgica o de las especialidades consultadas SOLO si se mencionó en la consulta, con la fecha y la conducta acordada tal como se enunciaron. No atribuyas una decisión colegiada que no se dijo."},
    {"key":"consentimiento_informado","label":"Consentimiento informado y explicación del riesgo","order":8,"required":true,
     "instruction":"Explicación dada al paciente y a su familia sobre el procedimiento, alternativas, riesgos, transfusión y posibilidad de cuidados intensivos, y si el consentimiento fue firmado, tal como se registró en la consulta. Si no se mencionó, indícalo; nunca lo des por firmado."},
    {"key":"preparacion_y_optimizacion","label":"Preparación y optimización preoperatoria","order":9,"required":true,
     "instruction":"Indicaciones previas a la cirugía: ayuno, baño, medicamentos que continúan o se suspenden con dosis literales, corrección de anemia o de la glicemia, valoraciones pendientes y reserva de hemoderivados. Solo lo indicado en la consulta."},
    {"key":"programacion_y_signos_de_alarma","label":"Programación y signos de alarma","order":10,"required":false,
     "instruction":"Fecha y lugar de la cirugía si se dieron, documentos y exámenes que debe traer, y los signos por los que debe consultar antes (dolor torácico, disnea, fiebre, infección de piel o dental). No inventes fechas ni trámites administrativos."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

update public.clinical_templates set
  name = 'Consulta inicial · síntomas torácicos, función pulmonar y estudio de la lesión',
  description = 'Primera valoración por cirugía de tórax: cronología de tos, disnea o hemoptisis, exposición al tabaco e inhalados, lectura de las imágenes que muestran la lesión pulmonar, pleural o mediastinal y definición de la ruta diagnóstica o quirúrgica. Úsala en la primera cita del paciente remitido por neumología, oncología o la EPS.',
  sections = '[
    {"key":"motivo_y_remitente","label":"Motivo de consulta y remisión","order":1,"required":true,
     "instruction":"Motivo en palabras del paciente y quién lo remite (neumología, oncología, urgencias, EPS) con el hallazgo que motiva la remisión tal como se enunció. No conviertas un hallazgo imagenológico en un diagnóstico ni en una indicación quirúrgica."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":2,"required":true,
     "instruction":"Cronología de tos, expectoración, hemoptisis con la cuantía referida, disnea, dolor torácico, fiebre y pérdida de peso con las cifras dichas. Incluye tratamientos recibidos y su respuesta. Solo lo referido; si un dato no se mencionó, indícalo en vez de completarlo."},
    {"key":"exposicion_y_habitos","label":"Exposición al tabaco y a inhalados","order":3,"required":false,
     "instruction":"Tabaquismo con los paquetes-año SOLO si el médico dio la cifra (nunca la calcules), exposición a humo de leña, asbesto, sílice u otros inhalados ocupacionales, y consumo de alcohol o sustancias, tal como se refirieron en la consulta."},
    {"key":"antecedentes_respiratorios","label":"Antecedentes respiratorios y quirúrgicos","order":4,"required":false,
     "instruction":"Tuberculosis, EPOC, asma, neumonías, empiema o neumotórax previos, cirugías torácicas y toracostomías anteriores con su fecha aproximada, oxígeno domiciliario, comorbilidades y medicación con dosis. Si una fecha no se precisó, escríbelo así."},
    {"key":"examen_del_torax","label":"Examen físico del tórax","order":5,"required":true,
     "instruction":"Signos vitales con los valores dichos y saturación con o sin oxígeno tal como se enunció; inspección, expansibilidad, percusión, auscultación con ruidos agregados o abolidos y su localización, adenopatías, y cicatrices o sitios de drenaje previos. No completes lo no examinado."},
    {"key":"estudios_de_imagen","label":"Imágenes y estudios aportados","order":6,"required":false,
     "instruction":"Radiografía, tomografía, PET-CT, broncoscopia o biopsias aportadas: transcribe fecha, tamaño y localización de la lesión y las conclusiones literal, tal como el cirujano las leyó. Si un estudio está pendiente, escríbelo así; nunca describas una imagen que nadie describió."},
    {"key":"funcion_pulmonar_y_riesgo","label":"Función pulmonar y riesgo quirúrgico","order":7,"required":false,
     "instruction":"Espirometría, gases arteriales, capacidad de difusión o prueba de caminata con los valores y porcentajes EXACTAMENTE como se dictaron; nunca los calcules ni los interpretes tú. Registra el concepto de operabilidad solo si el cirujano lo enunció."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":8,"required":true,
     "instruction":"Diagnóstico de trabajo y diferenciales con las palabras del cirujano. La estadificación oncológica se transcribe solo si él la enunció, con su fórmula literal: nunca asignes un estadio ni una clasificación a partir de las imágenes."},
    {"key":"plan_diagnostico_y_quirurgico","label":"Plan diagnóstico y conducta quirúrgica","order":9,"required":true,
     "instruction":"Estudios adicionales, procedimientos diagnósticos propuestos (broncoscopia, biopsia, mediastinoscopia), remisión a junta de tórax u oncología y la conducta quirúrgica solo con el grado de definición que el cirujano expresó. No anticipes una resección que no se planteó."},
    {"key":"proximo_control_y_signos_de_alarma","label":"Próximo control y signos de alarma","order":10,"required":false,
     "instruction":"Cuándo vuelve y con qué resultados, y los signos de alarma explicados para consultar a urgencias (disnea súbita, hemoptisis abundante, dolor torácico intenso, fiebre). Solo lo dicho en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = '570acda8-d9ae-5fbe-9d1d-43f543d04b23' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · evolución respiratoria, drenajes y herida',
  description = 'Control tras cirugía de tórax o de una toracostomía: días de evolución, disnea y dolor, débito y fuga aérea del drenaje transcritos literal, estado de la herida y de los puertos, radiografía de control y decisión sobre el tubo. Úsala en el control ambulatorio o en la revista del paciente hospitalizado.',
  sections = '[
    {"key":"procedimiento_previo","label":"Procedimiento previo y tiempo de evolución","order":1,"required":true,
     "instruction":"Cirugía o drenaje realizado con el procedimiento nombrado, fecha y días de evolución tal como se dijeron; si la fecha no se enunció, indícalo y no la calcules. Cita hallazgos operatorios o el resultado de patología solo si el cirujano los mencionó hoy."},
    {"key":"evolucion_respiratoria","label":"Evolución respiratoria referida","order":2,"required":false,
     "instruction":"Disnea y su relación con el esfuerzo, tos, expectoración, hemoptisis, dolor con la intensidad solo si el paciente la graduó, fiebre y tolerancia a la actividad, en palabras del paciente. Solo lo referido; no infieras mejoría."},
    {"key":"drenaje_y_fuga_aerea","label":"Drenaje torácico, débito y fuga aérea","order":3,"required":false,
     "instruction":"Tipo de drenaje, sistema y presión de succión, débito de las últimas horas con sus cifras y características, y presencia o ausencia de fuga aérea y de oscilación EXACTAMENTE como se dictaron. Transcribe las cifras literal; si no se cuantificó el débito, escríbelo así."},
    {"key":"herida_y_sitios_de_puerto","label":"Estado de la herida y de los sitios de puerto","order":4,"required":true,
     "instruction":"Aspecto de la toracotomía o de los puertos y del sitio de inserción del tubo: bordes, secreción, eritema, enfisema subcutáneo y signos de infección descritos por el cirujano. Registra medidas solo si se dictaron; nunca las estimes."},
    {"key":"examen_fisico_de_control","label":"Examen físico de control","order":5,"required":true,
     "instruction":"Signos vitales y saturación con los valores dichos, expansibilidad, percusión y auscultación por campos con los hallazgos y su localización. Compara con el examen previo solo si el cirujano hizo la comparación; no completes lo no examinado."},
    {"key":"imagenes_de_control","label":"Radiografía y estudios de control","order":6,"required":false,
     "instruction":"Radiografía o tomografía de control: transcribe la fecha y los hallazgos (reexpansión, neumotórax residual, derrame, posición del tubo) literal tal como los leyó el cirujano. Si no se tomó control o está pendiente, escríbelo así."},
    {"key":"manejo_del_drenaje_y_analgesia","label":"Manejo del drenaje, analgesia y rehabilitación","order":7,"required":false,
     "instruction":"Decisión sobre el drenaje (continuar, pinzar, retirar) con la razón dicha, curación realizada y retiro de puntos, analgesia con dosis literales, y ejercicios respiratorios o incentivo respiratorio tal como se indicaron. No des por retirado un tubo si no se dijo."},
    {"key":"analisis_y_ajuste_del_plan","label":"Análisis y ajuste del plan","order":8,"required":true,
     "instruction":"Evaluación de la evolución con las palabras del cirujano, cambios de tratamiento, estudios o remisiones solicitadas (oncología, neumología, rehabilitación pulmonar) e incapacidad con los días exactos solo si se otorgó."},
    {"key":"proximo_control_y_signos_de_alarma","label":"Próximo control y signos de alarma","order":9,"required":true,
     "instruction":"Fecha o plazo del próximo control y qué debe traer, junto con los signos de alarma explicados (disnea súbita, dolor que aumenta, fiebre, secreción por la herida, enfisema que crece). Solo lo dicho en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = 'c0d41d9f-a99e-5b17-8e36-223b60c19140' and owner_id is null;

update public.clinical_templates set
  name = 'Descripción quirúrgica · toracoscopia o toracotomía con hallazgos y drenajes',
  description = 'Nota operatoria de cirugía de tórax: abordaje y ventilación monopulmonar, hallazgos pleurales, pulmonares o mediastinales como los dictó el cirujano, resección realizada, muestras enviadas y drenajes dejados con su calibre y posición.',
  sections = '[
    {"key":"indicacion_y_procedimiento","label":"Indicación y procedimiento realizado","order":1,"required":true,
     "instruction":"Diagnóstico preoperatorio, procedimiento realizado con su nombre completo, lateralidad y abordaje (videotoracoscopia, toracotomía, conversión) y carácter electivo o urgente, tal como los dictó el cirujano. La lateralidad se transcribe literal; nunca la supongas."},
    {"key":"equipo_anestesia_y_posicion","label":"Equipo, anestesia, ventilación y posición","order":2,"required":false,
     "instruction":"Cirujano, ayudantes y anestesiólogo nombrados, tipo de anestesia, intubación selectiva o ventilación monopulmonar, posición del paciente y profilaxis antibiótica con medicamento y dosis dichos. No agregues lo que no se mencionó en sala."},
    {"key":"verificacion_y_consentimiento","label":"Lista de verificación y consentimiento informado","order":3,"required":false,
     "instruction":"Consentimiento informado, marcación del lado y lista de chequeo de cirugía segura con el conteo de compresas e instrumental, SOLO como se mencionaron en sala. Si no se habló del consentimiento, indícalo; nunca lo des por firmado."},
    {"key":"tecnica_quirurgica","label":"Técnica quirúrgica","order":4,"required":true,
     "instruction":"Descripción en el orden dictado: número y sitio de los puertos o longitud de la toracotomía, espacio intercostal abordado, disección, uso de suturas mecánicas con su carga, sellantes y material de sutura nombrados. No completes pasos estándar que el cirujano no describió."},
    {"key":"hallazgos_intraoperatorios","label":"Hallazgos intraoperatorios","order":5,"required":true,
     "instruction":"Hallazgos EXACTAMENTE como los dictó el cirujano: estado de la pleura, adherencias, líquido con su aspecto y cantidad, lesión pulmonar o mediastinal con localización, lateralidad y medidas literales, y adenopatías. Nunca midas, estimes ni clasifiques tú un hallazgo."},
    {"key":"resecciones_y_muestras","label":"Resección realizada y muestras enviadas","order":6,"required":false,
     "instruction":"Resección o biopsia efectuada con el segmento o lóbulo nombrado, disección ganglionar por estaciones si se dictó, y muestras enviadas a patología, congelación o cultivo con su rótulo literal. Si no se enviaron muestras, consígnalo así."},
    {"key":"sangrado_y_eventos","label":"Sangrado, líquidos y eventos intraoperatorios","order":7,"required":false,
     "instruction":"Sangrado estimado, líquidos y transfusiones SOLO si se enunciaron, con cifras y unidades literales, junto con eventos como desaturación, arritmia o lesión de estructuras vecinas descritos por el equipo. Si el sangrado no se cuantificó, escríbelo así."},
    {"key":"drenajes_cierre_y_estado_final","label":"Drenajes, cierre y estado al terminar","order":8,"required":true,
     "instruction":"Drenajes dejados con calibre, número y posición tal como se dictaron, prueba de fuga aérea si se realizó, cierre por planos con el material nombrado, conteo declarado y estado y destino del paciente al salir de sala."},
    {"key":"indicaciones_posoperatorias","label":"Indicaciones posoperatorias y seguimiento","order":9,"required":true,
     "instruction":"Indicaciones dictadas: succión o sello de agua del drenaje, analgesia y antibióticos con dosis literales, oxígeno, terapia respiratoria, radiografía de control y plazo de la próxima valoración. Transcribe las dosis tal cual; no las ajustes."}
  ]'::jsonb,
  updated_at = now()
where id = '4ff9257f-7100-54b4-95dd-1d5d3e64b539' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c4000000-0000-4000-8000-000000000003', null,
   'Toracostomía cerrada · inserción de tubo de tórax y manejo inicial del drenaje',
   'Procedimiento de urgencia o de cabecera: indicación (neumotórax, hemotórax, derrame o empiema), consentimiento, técnica de inserción con el calibre y el espacio intercostal literales, material drenado, control radiológico e indicaciones de manejo del sistema. Úsala en urgencias, hospitalización o cuidados intensivos.',
   'cirugia_torax', 'Cirugía de tórax', 'institutional', false, 'active',
   '[
    {"key":"indicacion_y_contexto","label":"Indicación y contexto clínico","order":1,"required":true,
     "instruction":"Indicación del drenaje tal como la enunció el médico (neumotórax, hemotórax, derrame, empiema, trauma) con la lateralidad literal, el estado respiratorio y hemodinámico previo y el sitio de atención. Nunca supongas el lado ni la indicación."},
    {"key":"imagen_previa","label":"Imagen previa que sustenta el procedimiento","order":2,"required":false,
     "instruction":"Radiografía, ecografía o tomografía previa: transcribe la fecha y los hallazgos que sustentan el drenaje (tamaño del neumotórax, altura del derrame, tabicaciones) literal como los leyó el médico. Si el procedimiento se hizo sin imagen previa, escríbelo así."},
    {"key":"consentimiento_y_verificacion","label":"Consentimiento informado y verificación","order":3,"required":true,
     "instruction":"Consentimiento informado del paciente o de su familia, verificación de identidad y del lado, y revisión de anticoagulación o de trastornos de coagulación, SOLO como se mencionaron. Si no se habló del consentimiento, indícalo de forma explícita; nunca lo des por firmado."},
    {"key":"preparacion_y_anestesia","label":"Preparación, asepsia y anestesia local","order":4,"required":false,
     "instruction":"Monitoreo, oxígeno, sedación o analgesia previa, asepsia y anestesia local con el medicamento, la concentración y el volumen EXACTAMENTE como se dictaron. Transcribe las dosis literal; nunca completes una dosis que no se enunció."},
    {"key":"tecnica_de_insercion","label":"Técnica de inserción","order":5,"required":true,
     "instruction":"Sitio de inserción con el espacio intercostal y la línea anatómica, calibre del tubo, técnica de disección roma o con trocar, dirección del tubo y fijación con el material de sutura, EXACTAMENTE como los dictó el médico. Nunca asignes un calibre ni un espacio que no se dijo."},
    {"key":"material_drenado","label":"Material drenado y hallazgos","order":6,"required":true,
     "instruction":"Material obtenido con su aspecto y cantidad inicial transcritos literal (aire, líquido seroso, hemático, purulento), oscilación y fuga aérea, y muestras enviadas a laboratorio, citología o cultivo con su rótulo. Si no se cuantificó, escríbelo así en vez de aproximarlo."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones inmediatas","order":7,"required":false,
     "instruction":"Tolerancia del paciente al procedimiento, dolor, cambios en la saturación y los signos vitales con los valores dichos, y complicaciones inmediatas o su ausencia tal como el médico las enunció (sangrado, enfisema subcutáneo, lesión de estructuras). No las des por ausentes si no se dijo."},
    {"key":"control_radiologico","label":"Control radiológico posprocedimiento","order":8,"required":false,
     "instruction":"Radiografía de control tras el drenaje: transcribe la posición del tubo, la reexpansión y el residuo literal como los leyó el médico, con la hora si se dijo. Si el control está pendiente o no se tomó, escríbelo así; nunca supongas una posición adecuada."},
    {"key":"conexion_y_manejo_del_sistema","label":"Conexión del sistema e indicaciones de manejo","order":9,"required":true,
     "instruction":"Sistema al que se conectó (sello de agua, succión con la presión dicha), curación realizada, y las indicaciones dadas al equipo: cuantificación del débito por turno, vigilancia de la fuga aérea, movilización y analgesia con dosis literales."},
    {"key":"seguimiento_y_signos_de_alarma","label":"Seguimiento y signos de alarma","order":10,"required":true,
     "instruction":"Criterios y plazo para reevaluar o retirar el tubo tal como los expresó el médico, estudios de control programados y los signos por los que se debe avisar de inmediato (desaturación, dolor intenso, sangrado por el tubo, salida accidental)."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

update public.clinical_templates set
  name = 'Consulta inicial · enfermedad arterial y venosa con examen de pulsos',
  description = 'Primera valoración por cirugía vascular: claudicación o dolor de reposo, síntomas venosos, factores de riesgo, examen de pulsos por territorio y lectura del doppler o de la angiotomografía. Úsala en la primera cita del paciente remitido por enfermedad arterial periférica, enfermedad venosa o aneurisma.',
  sections = '[
    {"key":"motivo_y_remitente","label":"Motivo de consulta y remisión","order":1,"required":true,
     "instruction":"Motivo en palabras del paciente y quién lo remite (medicina general, endocrinología, urgencias, EPS) con el diagnóstico de remisión tal como se enunció. No conviertas el motivo en un diagnóstico vascular ni en una indicación de revascularización."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":2,"required":true,
     "instruction":"Cronología del síntoma: claudicación con la distancia referida, dolor de reposo, cambios de color o temperatura, úlceras y su tiempo de evolución, edema, várices, pesadez o sangrado, y tratamientos recibidos con su respuesta. Solo lo referido; no completes distancias ni tiempos."},
    {"key":"factores_de_riesgo","label":"Factores de riesgo vascular","order":3,"required":false,
     "instruction":"Diabetes con su tiempo de evolución y control referido, hipertensión, dislipidemia, tabaquismo con paquetes-año solo si se dio la cifra, enfermedad renal, obesidad y sedentarismo, tal como se mencionaron. Nunca calcules ni completes cifras."},
    {"key":"antecedentes_vasculares","label":"Antecedentes vasculares y procedimientos previos","order":4,"required":false,
     "instruction":"Revascularizaciones, angioplastias con stent, safenectomías, escleroterapia, amputaciones previas, trombosis venosa profunda o embolia pulmonar con su fecha aproximada, y anticoagulantes o antiagregantes con dosis. Si una fecha no se precisó, indícalo."},
    {"key":"examen_vascular_arterial","label":"Examen vascular arterial","order":5,"required":true,
     "instruction":"Pulsos POR TERRITORIO tal como los describió el cirujano (femoral, poplíteo, tibial posterior, pedio, radial, carotídeo) con su lateralidad y la intensidad que él usó; soplos, llenado capilar, temperatura, palidez a la elevación y trofismo de piel y uñas. Nunca declares un pulso que no se exploró."},
    {"key":"examen_venoso_y_heridas","label":"Examen venoso, edema y heridas","order":6,"required":false,
     "instruction":"Várices y su distribución, cordones, hiperpigmentación, lipodermatoesclerosis, edema con la clasificación solo si se enunció, y úlceras con localización, lecho, bordes y medidas transcritas literal. Nunca midas ni estimes una úlcera que no se midió en la consulta."},
    {"key":"estudios_vasculares","label":"Estudios vasculares aportados","order":7,"required":false,
     "instruction":"Doppler, angiotomografía, arteriografía o laboratorios aportados: transcribe fecha, hallazgos y conclusiones literal como los leyó el cirujano. El índice tobillo-brazo se registra SOLO si se enunció, con su valor y lado exactos: nunca lo calcules tú."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":8,"required":true,
     "instruction":"Diagnóstico y diferenciales con las palabras del cirujano. Las clasificaciones (Rutherford, Fontaine, CEAP, grado de isquemia) se transcriben SOLO si él las enunció: nunca las asignes ni las deduzcas de los hallazgos."},
    {"key":"plan_y_medidas","label":"Plan, medidas y educación","order":9,"required":true,
     "instruction":"Conducta definida: manejo médico con dosis literales, terapia compresiva con la clase indicada, programa de caminata, cesación de tabaco, cuidado de pies y heridas, estudios adicionales, remisiones y programación de procedimiento solo con el grado de definición expresado."},
    {"key":"proximo_control_y_signos_de_alarma","label":"Próximo control y signos de alarma","order":10,"required":false,
     "instruction":"Cuándo vuelve y con qué estudios, y los signos de alarma explicados para consultar a urgencias (dolor de reposo, cambio de color del pie, herida que crece, fiebre, pierna fría o dolorosa de aparición súbita)."}
  ]'::jsonb,
  updated_at = now()
where id = '9bcad863-4072-5722-b21f-92a45bfcd15d' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · perfusión, permeabilidad del injerto y herida',
  description = 'Control del paciente revascularizado o en manejo vascular: síntomas actuales, pulsos y perfusión distal, permeabilidad del injerto o del stent según el doppler, evolución de la úlcera con medidas literales, adherencia a la antiagregación y control de los factores de riesgo.',
  sections = '[
    {"key":"diagnosticos_y_procedimiento_previo","label":"Diagnósticos activos y procedimiento previo","order":1,"required":true,
     "instruction":"Diagnóstico vascular en seguimiento y procedimiento realizado con su fecha y tipo (bypass con el conducto usado, angioplastia con stent, safenectomía, amputación), tal como se dijeron. Si la fecha no se enunció, indícalo y no la calcules."},
    {"key":"evolucion_referida","label":"Evolución referida por el paciente","order":2,"required":false,
     "instruction":"Cambios en la claudicación con la distancia referida, dolor de reposo, temperatura y color del pie, edema, y evolución de la herida o de la úlcera en palabras del paciente. Solo lo referido; no infieras mejoría de la perfusión."},
    {"key":"medicacion_y_adherencia","label":"Medicación, antiagregación y adherencia","order":3,"required":false,
     "instruction":"Antiagregantes, anticoagulantes, estatinas y antidiabéticos con dosis literales, adherencia referida y efectos adversos o suspensiones. Transcribe las dosis y el INR tal como se dictaron; nunca los ajustes ni los completes."},
    {"key":"examen_de_perfusion","label":"Examen de pulsos y perfusión distal","order":4,"required":true,
     "instruction":"Pulsos por territorio con lateralidad e intensidad tal como los describió el cirujano, soplo o frémito sobre el injerto, llenado capilar, temperatura y trofismo. El índice tobillo-brazo solo si se enunció, con su valor exacto: nunca lo calcules. No declares pulsos no explorados."},
    {"key":"estado_de_la_herida_o_ulcera","label":"Estado de la herida quirúrgica o de la úlcera","order":5,"required":true,
     "instruction":"Aspecto de la herida de la revascularización o del muñón y evolución de la úlcera: lecho, bordes, exudado, tejido de granulación, signos de infección y medidas transcritas literal tal como se dictaron. Nunca estimes un tamaño ni afirmes una cicatrización que no se describió."},
    {"key":"estudios_de_control","label":"Estudios de control","order":6,"required":false,
     "instruction":"Doppler de control del injerto o del stent, angiotomografía y laboratorios: transcribe fecha, velocidades, permeabilidad y conclusiones literal como los leyó el cirujano. Si un estudio está pendiente, escríbelo así; nunca supongas permeabilidad."},
    {"key":"control_de_factores_de_riesgo","label":"Control de factores de riesgo","order":7,"required":false,
     "instruction":"Cifras de tensión arterial, hemoglobina glicosilada, perfil lipídico y peso EXACTAMENTE como se enunciaron, y el estado del consumo de tabaco. Nunca calcules una meta ni interpretes un valor que el médico no comentó; si no hay resultado, escríbelo así."},
    {"key":"curaciones_y_terapia","label":"Curación, terapia compresiva y rehabilitación","order":8,"required":false,
     "instruction":"Curación realizada en la consulta con la técnica y el apósito nombrados, retiro de puntos, terapia compresiva con la clase indicada, programa de caminata y cuidado de pies, tal como se explicaron. Si no se hizo curación, indícalo."},
    {"key":"ajuste_del_plan_y_proximo_control","label":"Ajuste del plan y próximo control","order":9,"required":true,
     "instruction":"Cambios de tratamiento con dosis literales, estudios y remisiones solicitadas (clínica de heridas, endocrinología, rehabilitación), incapacidad con los días exactos solo si se otorgó, y fecha del próximo control con los signos de alarma explicados."}
  ]'::jsonb,
  updated_at = now()
where id = '9cc91c55-8883-52ad-be0a-df581b07639e' and owner_id is null;

update public.clinical_templates set
  name = 'Procedimiento vascular · técnica abierta o endovascular y hallazgos',
  description = 'Nota operatoria de cirugía vascular: acceso, técnica abierta o endovascular con el material y los dispositivos usados, hallazgos angiográficos o del lecho distal, heparinización, control de pulsos al terminar y estado de la extremidad. Úsala para bypass, endarterectomía, angioplastia, safenectomía o amputación.',
  sections = '[
    {"key":"indicacion_y_procedimiento","label":"Indicación y procedimiento realizado","order":1,"required":true,
     "instruction":"Diagnóstico preoperatorio, procedimiento realizado con su nombre completo, territorio y LATERALIDAD tal como los dictó el cirujano, y carácter electivo o urgente. La lateralidad y el nivel se transcriben literal; nunca los supongas ni los deduzcas."},
    {"key":"equipo_anestesia_y_acceso","label":"Equipo, anestesia y acceso","order":2,"required":false,
     "instruction":"Cirujano, ayudantes y anestesiólogo nombrados, tipo de anestesia, posición y sitio de acceso (femoral, braquial, radial) con el introductor y su calibre si se enunciaron, y profilaxis antibiótica con las dosis dichas. No agregues lo que no se mencionó."},
    {"key":"verificacion_y_consentimiento","label":"Lista de verificación y consentimiento informado","order":3,"required":false,
     "instruction":"Consentimiento informado, marcación del lado y lista de chequeo de cirugía segura con el conteo declarado, SOLO como se mencionaron en sala. Si no se habló del consentimiento, indícalo de forma explícita; nunca lo des por firmado."},
    {"key":"tecnica_quirurgica","label":"Técnica quirúrgica o endovascular","order":4,"required":true,
     "instruction":"Descripción en el orden dictado: incisiones, disección y control vascular, heparinización con la dosis literal, clampeo con sus tiempos si se dieron, anastomosis con el conducto y la sutura nombrados, o navegación con guías, balones y stents con marca y medidas exactas. No completes pasos que no se describieron."},
    {"key":"hallazgos_del_procedimiento","label":"Hallazgos arteriales, venosos o angiográficos","order":5,"required":true,
     "instruction":"Hallazgos EXACTAMENTE como los dictó el cirujano: calidad de la pared y del lecho distal, placa, trombo, calcificación, grado de estenosis y resultado angiográfico, con territorio, lateralidad y porcentajes o medidas literales. Nunca estimes un porcentaje de estenosis ni clasifiques tú."},
    {"key":"sangrado_y_medio_de_contraste","label":"Sangrado, medio de contraste y radiación","order":6,"required":false,
     "instruction":"Sangrado estimado, líquidos y transfusiones, volumen de medio de contraste y tiempo de fluoroscopia SOLO si se enunciaron, con las cifras y unidades literales. Si algún dato no se cuantificó, escríbelo así; nunca lo estimes."},
    {"key":"resultado_y_pulsos_finales","label":"Resultado final y control de pulsos","order":7,"required":true,
     "instruction":"Resultado del procedimiento tal como lo declaró el cirujano, control de pulsos distales o señal doppler al terminar con el territorio y la lateralidad dichos, y aspecto y perfusión de la extremidad. Nunca afirmes un pulso recuperado que no se verificó en voz alta."},
    {"key":"cierre_drenajes_y_estado_final","label":"Cierre, hemostasia del acceso y estado al terminar","order":8,"required":false,
     "instruction":"Cierre por planos o dispositivo de cierre del acceso con el material nombrado, drenajes dejados, complicaciones intraoperatorias o su ausencia tal como se enunció, y estado y destino del paciente al salir de sala."},
    {"key":"indicaciones_posoperatorias","label":"Indicaciones posoperatorias y seguimiento","order":9,"required":true,
     "instruction":"Indicaciones dictadas: reposo del acceso, antiagregación o anticoagulación y analgesia con dosis literales, vigilancia de pulsos y del apósito, movilización, doppler de control y plazo de la próxima valoración con los signos de alarma explicados."}
  ]'::jsonb,
  updated_at = now()
where id = 'f1a72c0d-1b33-597f-9db9-a9fe51109712' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c4000000-0000-4000-8000-000000000004', null,
   'Pie diabético · perfusión, infección y plan de salvamento de la extremidad',
   'Valoración del paciente diabético con úlcera o infección del pie: descripción de la lesión con medidas literales, evaluación de la perfusión y de la neuropatía, signos de infección y de osteomielitis, y la conducta de desbridamiento, revascularización o amputación tal como la definió el cirujano. Úsala en consulta o en urgencias.',
   'cirugia_vascular', 'Cirugía vascular', 'institutional', false, 'active',
   '[
    {"key":"motivo_y_tiempo_de_evolucion","label":"Motivo y tiempo de evolución de la lesión","order":1,"required":true,
     "instruction":"Motivo en palabras del paciente, tiempo exacto de evolución de la úlcera o de la infección tal como se dijo, y desencadenante referido (trauma, calzado, uña, quemadura). Transcribe los tiempos literal; nunca los estimes ni los redondees."},
    {"key":"control_metabolico_y_antecedentes","label":"Control metabólico y antecedentes","order":2,"required":false,
     "instruction":"Años de diabetes, tratamiento actual con dosis literales, hemoglobina glicosilada y glucometrías EXACTAMENTE como se enunciaron, enfermedad renal o diálisis, tabaquismo, amputaciones y revascularizaciones previas. Nunca completes una cifra de control que no se dio."},
    {"key":"tratamientos_previos","label":"Tratamientos y antibióticos previos","order":3,"required":false,
     "instruction":"Antibióticos ya recibidos con el medicamento, la dosis y los días tal como se dictaron, curaciones, desbridamientos u hospitalizaciones previas por la misma lesión. Si no se precisó el esquema, indícalo; nunca lo reconstruyas."},
    {"key":"descripcion_de_la_lesion","label":"Descripción de la lesión","order":4,"required":true,
     "instruction":"Localización con lateralidad y dedo o zona del pie, lecho, bordes, profundidad, exposición de tendón o hueso, tejido necrótico y TODAS las medidas transcritas literal como las dictó el cirujano. Nunca midas, estimes ni conviertas unidades tú."},
    {"key":"signos_de_infeccion","label":"Signos de infección y compromiso sistémico","order":5,"required":true,
     "instruction":"Eritema, edema, calor, secreción con sus características, olor, crepitación, celulitis ascendente, fiebre y signos sistémicos con los valores dichos. La clasificación de severidad de la infección se transcribe solo si el médico la enunció; nunca la asignes tú."},
    {"key":"evaluacion_de_la_perfusion","label":"Evaluación de la perfusión","order":6,"required":true,
     "instruction":"Pulsos por territorio con lateralidad tal como los describió el cirujano, llenado capilar, temperatura, palidez a la elevación y señal doppler. El índice tobillo-brazo o la presión de dedo SOLO si se enunciaron, con su valor exacto: nunca los calcules. No declares pulsos no explorados."},
    {"key":"neuropatia_y_deformidad","label":"Neuropatía, sensibilidad y deformidad","order":7,"required":false,
     "instruction":"Exploración de la sensibilidad protectora (monofilamento, diapasón) SOLO si se realizó y con el resultado dicho, síntomas neuropáticos referidos, deformidades del pie, callosidades y estado del calzado. No des por presente una neuropatía que no se exploró."},
    {"key":"estudios_y_cultivos","label":"Estudios, cultivos e imágenes","order":8,"required":false,
     "instruction":"Laboratorios, radiografía o resonancia del pie y cultivos con su germen y sensibilidad: transcribe valores, fechas y conclusiones literal como los leyó el médico. La osteomielitis se afirma solo si el médico la enunció; si algo está pendiente, escríbelo así."},
    {"key":"clasificacion_y_analisis","label":"Análisis y clasificación de la lesión","order":9,"required":true,
     "instruction":"Impresión diagnóstica con las palabras del cirujano, incluido el riesgo de pérdida de la extremidad si él lo expresó. Las clasificaciones (Wagner, Texas, WIfI) se transcriben SOLO si las enunció, con su grado literal: nunca las asignes ni las deduzcas."},
    {"key":"conducta_y_consentimiento","label":"Conducta quirúrgica y consentimiento informado","order":10,"required":true,
     "instruction":"Conducta definida: desbridamiento, drenaje, revascularización o amputación con el nivel nombrado, o manejo médico, con la urgencia expresada por el cirujano. Registra la explicación dada al paciente y a su familia y el consentimiento solo si se mencionó; nunca lo des por firmado."},
    {"key":"plan_curaciones_y_seguimiento","label":"Plan de curaciones, descarga y seguimiento","order":11,"required":true,
     "instruction":"Antibióticos con dosis y días literales, tipo de curación y frecuencia, descarga de la lesión, control metabólico, remisiones (endocrinología, clínica de heridas, rehabilitación) y plazo del próximo control con los signos de alarma explicados."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

update public.clinical_templates set
  name = 'Consulta inicial · déficit neurológico, dolor y estudio neuroquirúrgico',
  description = 'Primera valoración por neurocirugía: cronología del déficit o del dolor, examen neurológico completo con la fuerza y los reflejos como se dictaron, lectura de la resonancia o de la tomografía y definición de si hay indicación quirúrgica. Úsala en la primera cita del paciente remitido por neurología, dolor o la EPS.',
  sections = '[
    {"key":"motivo_y_remitente","label":"Motivo de consulta y remisión","order":1,"required":true,
     "instruction":"Motivo en palabras del paciente y quién lo remite (neurología, medicina del dolor, urgencias, EPS) con el hallazgo o diagnóstico de remisión tal como se enunció. No conviertas un hallazgo de imagen en una indicación quirúrgica."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":2,"required":true,
     "instruction":"Cronología del cuadro: inicio y progresión del dolor con su irradiación y los factores que lo modifican, déficit motor o sensitivo, alteración de esfínteres, cefalea, convulsiones, vómito o cambios visuales, y tratamientos recibidos con su respuesta. Solo lo referido."},
    {"key":"antecedentes_neuroquirurgicos","label":"Antecedentes neurológicos y quirúrgicos","order":3,"required":false,
     "instruction":"Cirugías de columna o de cráneo previas con fecha aproximada y nivel operado, trauma craneoencefálico, epilepsia, derivaciones ventriculares, tumores, radioterapia y anticoagulantes o antiagregantes con dosis. Si una fecha o un nivel no se precisó, indícalo."},
    {"key":"estado_funcional_y_dolor","label":"Estado funcional y caracterización del dolor","order":4,"required":false,
     "instruction":"Impacto en la marcha, el trabajo y las actividades diarias tal como lo refirió el paciente, y la intensidad del dolor con la escala SOLO si el paciente o el médico la enunciaron: nunca gradúes tú el dolor ni asignes una escala funcional."},
    {"key":"examen_neurologico","label":"Examen neurológico","order":5,"required":true,
     "instruction":"Estado de conciencia, orientación y lenguaje, pares craneales, fuerza por grupos musculares con la graduación tal como la dictó el médico, sensibilidad por dermatomas, reflejos con su intensidad, signos de irritación radicular o meníngea, marcha y coordinación. No completes lo no examinado."},
    {"key":"escala_de_glasgow","label":"Escala de Glasgow y signos vitales","order":6,"required":false,
     "instruction":"Escala de coma de Glasgow SOLO si el médico la enunció, con el puntaje total y por componente EXACTAMENTE como los dictó: nunca la calcules, la sumes ni la asignes tú. Registra los signos vitales y el patrón pupilar con los valores dichos."},
    {"key":"imagenes_y_estudios","label":"Imágenes y estudios aportados","order":7,"required":false,
     "instruction":"Resonancia, tomografía, radiografías dinámicas, electromiografía o angiografía aportadas: transcribe fecha, nivel, lateralidad, tamaño y conclusiones literal como las leyó el neurocirujano. Si un estudio está pendiente, escríbelo así; nunca describas una imagen que nadie describió."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":8,"required":true,
     "instruction":"Diagnóstico con el nivel y la lateralidad tal como los formuló el neurocirujano, y los diferenciales que consideró. Las clasificaciones y escalas se transcriben solo si él las enunció: nunca asignes un grado a partir de las imágenes o del examen."},
    {"key":"plan_y_conducta_quirurgica","label":"Plan, conducta quirúrgica y educación","order":9,"required":true,
     "instruction":"Manejo médico con dosis literales, rehabilitación, infiltraciones, estudios adicionales, remisiones y la conducta quirúrgica solo con el grado de definición que expresó el neurocirujano, junto con la explicación de riesgos y beneficios dada al paciente. No des por firmado el consentimiento."},
    {"key":"proximo_control_y_signos_de_alarma","label":"Próximo control y signos de alarma","order":10,"required":false,
     "instruction":"Cuándo vuelve y con qué estudios, y los signos de alarma explicados para consultar de urgencia (pérdida de fuerza, retención o incontinencia, cefalea intensa, vómito, somnolencia, convulsión). Solo lo dicho en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = '816f5cbf-a135-5fdb-8190-2a4d04736660' and owner_id is null;

update public.clinical_templates set
  name = 'Control posoperatorio · evolución neurológica y herida quirúrgica',
  description = 'Control tras cirugía de columna o de cráneo, o seguimiento del paciente en manejo conservador: evolución del déficit y del dolor, examen neurológico comparado, estado de la herida y fuga de líquido cefalorraquídeo, imágenes de control y rehabilitación. Úsala en los controles ambulatorios de neurocirugía.',
  sections = '[
    {"key":"procedimiento_previo","label":"Procedimiento previo y tiempo de evolución","order":1,"required":true,
     "instruction":"Cirugía realizada con el procedimiento, el nivel y la lateralidad nombrados, fecha y días de posoperatorio tal como se dijeron; si la fecha no se enunció, indícalo y no la calcules. Cita hallazgos operatorios o patología solo si el neurocirujano los mencionó hoy."},
    {"key":"evolucion_del_deficit_y_dolor","label":"Evolución del déficit y del dolor","order":2,"required":false,
     "instruction":"Cambios en la fuerza, la sensibilidad, la marcha, los esfínteres, la cefalea y el dolor referidos por el paciente, con la intensidad solo si él la graduó. Registra si el síntoma que motivó la cirugía mejoró, persiste o empeoró con sus propias palabras; no infieras mejoría."},
    {"key":"medicacion_y_adherencia","label":"Medicación, analgesia y adherencia","order":3,"required":false,
     "instruction":"Analgésicos, anticonvulsivantes, corticoides y profilaxis con dosis y días literales, adherencia referida y efectos adversos. Transcribe las dosis y los niveles séricos tal como se dictaron; nunca los ajustes ni los completes."},
    {"key":"examen_neurologico_de_control","label":"Examen neurológico de control","order":4,"required":true,
     "instruction":"Fuerza por grupos con la graduación dictada, sensibilidad, reflejos, marcha, pares craneales y estado de conciencia. Compara con el examen previo SOLO si el neurocirujano hizo la comparación; nunca declares una recuperación que no se exploró ni completes lo no examinado."},
    {"key":"estado_de_la_herida","label":"Estado de la herida y fuga de líquido cefalorraquídeo","order":5,"required":true,
     "instruction":"Aspecto de la herida craneal o de columna: bordes, secreción con sus características, eritema, dehiscencia, colección subcutánea y signos de fuga de líquido cefalorraquídeo descritos por el cirujano. Registra medidas solo si se dictaron; nunca las estimes."},
    {"key":"imagenes_de_control","label":"Imágenes y estudios de control","order":6,"required":false,
     "instruction":"Tomografía, resonancia o radiografías de control: transcribe fecha, posición del material de osteosíntesis, colecciones, hidrocefalia o residuo tumoral literal como los leyó el neurocirujano. Si un estudio está pendiente, escríbelo así."},
    {"key":"rehabilitacion_y_recomendaciones","label":"Rehabilitación, actividad y recomendaciones","order":7,"required":false,
     "instruction":"Terapia física u ocupacional, uso de collar o corsé, restricciones de carga, postura y conducción, regreso al trabajo o al estudio, tal como se indicaron. Registra la incapacidad solo si se otorgó, con los días exactos; nunca los sumes."},
    {"key":"analisis_y_ajuste_del_plan","label":"Análisis y ajuste del plan","order":8,"required":true,
     "instruction":"Evaluación de la evolución con las palabras del neurocirujano, cambios de tratamiento con dosis literales, procedimientos adicionales considerados, retiro de puntos si se hizo y remisiones solicitadas (neurología, dolor, rehabilitación, oncología)."},
    {"key":"proximo_control_y_signos_de_alarma","label":"Próximo control y signos de alarma","order":9,"required":true,
     "instruction":"Fecha o plazo del próximo control y qué debe traer, junto con los signos de alarma explicados (déficit nuevo, fiebre, salida de líquido por la herida, cefalea intensa, somnolencia, convulsión). Solo lo dicho en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = '1c73a8ca-78b4-5e5e-9d47-402b4524f526' and owner_id is null;

update public.clinical_templates set
  name = 'Descripción quirúrgica · procedimiento neuroquirúrgico y hallazgos',
  description = 'Nota operatoria de neurocirugía: posición y neuronavegación, abordaje con el nivel y la lateralidad literales, hallazgos sobre la lesión o la raíz comprometida, material implantado con marca y medidas, y estado neurológico al terminar. Úsala para cirugía de columna, craneotomía o derivaciones.',
  sections = '[
    {"key":"indicacion_y_procedimiento","label":"Indicación y procedimiento realizado","order":1,"required":true,
     "instruction":"Diagnóstico preoperatorio, procedimiento realizado con su nombre completo, NIVEL y LATERALIDAD tal como los dictó el neurocirujano, y carácter electivo o urgente. El nivel y el lado se transcriben literal; nunca los supongas ni los infieras."},
    {"key":"equipo_anestesia_y_posicion","label":"Equipo, anestesia, posición y monitoreo","order":2,"required":false,
     "instruction":"Neurocirujano, ayudantes y anestesiólogo nombrados, tipo de anestesia, posición y fijación craneal, neuronavegación, microscopio, fluoroscopia y monitoreo neurofisiológico usados, y profilaxis antibiótica y anticonvulsivante con las dosis dichas. No agregues lo no mencionado."},
    {"key":"verificacion_y_consentimiento","label":"Lista de verificación y consentimiento informado","order":3,"required":false,
     "instruction":"Consentimiento informado del paciente o de su familia, marcación del sitio y del lado, verificación del nivel con fluoroscopia si se hizo, y conteo de compresas e instrumental, SOLO como se mencionaron en sala. Si el consentimiento no se mencionó, indícalo; nunca lo des por firmado."},
    {"key":"tecnica_quirurgica","label":"Técnica quirúrgica","order":4,"required":true,
     "instruction":"Descripción en el orden dictado: incisión, craneotomía o abordaje con la vía nombrada, apertura dural, laminectomía o discectomía con el nivel, descompresión, microdisección, hemostasia y cierre dural con el material nombrado. No completes pasos estándar que no se describieron."},
    {"key":"hallazgos_intraoperatorios","label":"Hallazgos intraoperatorios","order":5,"required":true,
     "instruction":"Hallazgos EXACTAMENTE como los dictó el neurocirujano: aspecto y consistencia de la lesión, plano de clivaje, compresión radicular o medular, tejido resecado y grado de resección, con localización, lateralidad y medidas literales. Nunca midas, estimes ni clasifiques tú."},
    {"key":"material_implantado_y_muestras","label":"Material implantado y muestras","order":6,"required":false,
     "instruction":"Tornillos, barras, cajas intersomáticas, mallas, injertos, clips, derivaciones o sustitutos durales con marca, tamaño y nivel EXACTOS como se nombraron, y muestras enviadas a patología o cultivo con su rótulo. Si no se implantó material ni se enviaron muestras, consígnalo así."},
    {"key":"sangrado_y_eventos","label":"Sangrado, líquidos y eventos intraoperatorios","order":7,"required":false,
     "instruction":"Sangrado estimado, líquidos y transfusiones SOLO si se enunciaron, con cifras y unidades literales, junto con eventos como desgarro dural, cambios en el monitoreo neurofisiológico o inestabilidad hemodinámica descritos por el equipo. Si el sangrado no se cuantificó, escríbelo así."},
    {"key":"cierre_y_estado_final","label":"Cierre, drenajes y estado al terminar","order":8,"required":true,
     "instruction":"Cierre por planos con el material nombrado, drenajes o sistemas de derivación dejados con su sitio, conteo declarado, complicaciones intraoperatorias o su ausencia tal como se enunció, y estado neurológico y destino del paciente al salir de sala."},
    {"key":"indicaciones_posoperatorias","label":"Indicaciones posoperatorias y seguimiento","order":9,"required":true,
     "instruction":"Indicaciones dictadas: posición de la cabecera, metas de tensión, analgesia, corticoides, anticonvulsivantes y antibióticos con dosis literales, vigilancia neurológica por turno, imágenes de control y plazo de la próxima valoración."}
  ]'::jsonb,
  updated_at = now()
where id = '077fef55-083a-54c2-86cf-84dcd1d66778' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c4000000-0000-4000-8000-000000000005', null,
   'Trauma craneoencefálico · Glasgow, tomografía y conducta neuroquirúrgica',
   'Valoración de urgencias del paciente con trauma de cráneo o de columna: mecanismo y hora del trauma, Glasgow con su puntaje por componente transcrito literal, examen pupilar y neurológico, lectura de la tomografía y decisión de cirugía, observación o remisión. Úsala en urgencias y en la interconsulta al neurocirujano.',
   'neurocirugia', 'Neurocirugía', 'institutional', false, 'active',
   '[
    {"key":"motivo_y_contexto","label":"Motivo, hora del trauma y contexto de la valoración","order":1,"required":true,
     "instruction":"Quién solicita la valoración, hora del trauma y hora de la valoración tal como se dijeron, y sitio de atención. Transcribe las horas literal; nunca las calcules ni deduzcas el tiempo transcurrido si no se enunció."},
    {"key":"mecanismo_del_trauma","label":"Mecanismo del trauma","order":2,"required":true,
     "instruction":"Mecanismo tal como lo refirieron el paciente, la familia o el personal que lo trasladó: caída con la altura dicha, accidente de tránsito con el rol y el uso de casco o cinturón, agresión, herida por arma. No completes detalles del mecanismo que nadie describió."},
    {"key":"estado_inicial_y_atencion_previa","label":"Estado inicial y atención previa","order":3,"required":false,
     "instruction":"Pérdida de conciencia, amnesia, convulsión, vómito y estado al llegar según el relato o el traslado, con las horas dichas; manejo previo recibido (intubación, sedación, líquidos, antibiótico) con dosis literales. Si algo no se informó, indícalo."},
    {"key":"antecedentes_relevantes","label":"Antecedentes relevantes","order":4,"required":false,
     "instruction":"Anticoagulantes o antiagregantes con la última dosis, trastornos de coagulación, cirugías craneales previas, epilepsia, consumo de alcohol o sustancias referido, y comorbilidades. Si un antecedente no se pudo obtener por el estado del paciente, escríbelo así."},
    {"key":"escala_de_glasgow","label":"Escala de coma de Glasgow","order":5,"required":true,
     "instruction":"Puntaje de Glasgow con sus tres componentes (ocular, verbal, motor) y el total EXACTAMENTE como los dictó el médico, con la hora de la valoración. Nunca lo calcules, lo sumes ni lo asignes tú a partir de la descripción; si estaba sedado o intubado, consígnalo tal como se dijo."},
    {"key":"examen_pupilar_y_neurologico","label":"Examen pupilar y neurológico","order":6,"required":true,
     "instruction":"Tamaño, simetría y reactividad pupilar con lateralidad, focalización motora o sensitiva, reflejos de tallo, patrón respiratorio, signos de fractura de base de cráneo y examen de columna con dolor o déficit, tal como se describieron. No completes lo no examinado."},
    {"key":"signos_vitales_y_lesiones_asociadas","label":"Signos vitales y lesiones asociadas","order":7,"required":false,
     "instruction":"Signos vitales y saturación con los valores dichos, presencia de hipotensión o hipoxia referidas, y lesiones asociadas encontradas por el equipo (torácicas, abdominales, ortopédicas). Solo lo mencionado en la valoración."},
    {"key":"tomografia_y_estudios","label":"Tomografía y estudios","order":8,"required":true,
     "instruction":"Tomografía de cráneo o de columna: transcribe fecha, hora y hallazgos literal como los leyó el médico (hematoma con su tipo y grosor, desviación de línea media, fracturas, edema). Las medidas y clasificaciones solo si él las enunció: nunca las midas ni las asignes tú."},
    {"key":"analisis_y_severidad","label":"Análisis y severidad del trauma","order":9,"required":true,
     "instruction":"Impresión diagnóstica con las palabras del neurocirujano y la clasificación de severidad SOLO si él la enunció; nunca la deduzcas del puntaje de Glasgow ni de la tomografía. Deja claro el grado de certeza y el riesgo de deterioro que expresó."},
    {"key":"conducta_y_consentimiento","label":"Conducta neuroquirúrgica y consentimiento informado","order":10,"required":true,
     "instruction":"Conducta definida: cirugía inmediata con el procedimiento nombrado, observación con control neurológico, monitoreo de presión intracraneana o remisión, con la justificación y la hora de la decisión dichas. Registra la explicación a la familia y el consentimiento solo si se mencionaron; nunca lo des por firmado."},
    {"key":"plan_inmediato_y_reevaluacion","label":"Plan inmediato y criterios de reevaluación","order":11,"required":true,
     "instruction":"Órdenes dadas: posición, metas de tensión y oxigenación, sedación, anticonvulsivante, osmoterapia y reversión de la anticoagulación con dosis literales, y estudios de control. Registra el plazo de reevaluación y los criterios por los que se debe llamar de nuevo al neurocirujano."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

update public.clinical_templates set
  name = 'Consulta inicial · defecto funcional o estético y plan reconstructivo',
  description = 'Primera valoración por cirugía plástica: motivo funcional, reconstructivo o estético en palabras del paciente, antecedentes de cirugías y de cicatrización, examen de la zona con medidas literales y opciones de manejo planteadas. Úsala en la primera cita, sea por secuela, defecto de cobertura o consulta estética.',
  sections = '[
    {"key":"motivo_y_expectativa","label":"Motivo de consulta y expectativa del paciente","order":1,"required":true,
     "instruction":"Motivo y expectativa EN PALABRAS DEL PACIENTE, sin traducirlos a un procedimiento ni a un diagnóstico, y quién lo remite si aplica. Registra qué espera lograr tal como lo dijo; no interpretes ni juzgues su motivación."},
    {"key":"enfermedad_actual","label":"Enfermedad actual o historia del defecto","order":2,"required":true,
     "instruction":"Origen y evolución del defecto: trauma, quemadura, cirugía oncológica, infección, malformación o cambio corporal, con las fechas referidas; tratamientos y cirugías previas sobre la zona y su resultado según el paciente. Solo lo referido; no completes fechas."},
    {"key":"antecedentes_y_cicatrizacion","label":"Antecedentes personales y de cicatrización","order":3,"required":false,
     "instruction":"Comorbilidades, tabaquismo, diabetes, anemia, medicación y anticoagulantes con dosis, alergias, alteraciones de la cicatrización (queloides, cicatriz hipertrófica), radioterapia previa y estado nutricional, tal como se refirieron. Si algo no se exploró, indícalo."},
    {"key":"antecedentes_esteticos","label":"Procedimientos estéticos previos e implantes","order":4,"required":false,
     "instruction":"Cirugías estéticas, implantes con marca y volumen si se conocen, rellenos, biopolímeros, toxina o láser previos, con las fechas y el resultado referidos por el paciente. Nunca supongas el material o el volumen de un implante que no se precisó."},
    {"key":"examen_de_la_zona","label":"Examen de la zona comprometida","order":5,"required":true,
     "instruction":"Examen del defecto o de la zona a intervenir: localización con lateralidad, tamaño y profundidad con las medidas transcritas literal, calidad y elasticidad de la piel, cicatrices previas, exposición de estructuras, sensibilidad y perfusión. Nunca midas ni estimes tú."},
    {"key":"evaluacion_de_simetria_y_medidas","label":"Simetría, proporciones y medidas","order":6,"required":false,
     "instruction":"Asimetrías, grado de ptosis, exceso cutáneo, distancias y medidas antropométricas EXACTAMENTE como las dictó el cirujano, con el peso y la talla si se enunciaron. Nunca calcules un índice ni asignes una clasificación que él no haya declarado."},
    {"key":"registro_fotografico","label":"Registro fotográfico","order":7,"required":false,
     "instruction":"Toma de fotografías clínicas, las proyecciones realizadas y la autorización del paciente para su uso, SOLO como se mencionaron en la consulta. Si no se habló del registro fotográfico o de su autorización, indícalo; nunca los des por hechos."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":8,"required":true,
     "instruction":"Diagnóstico y análisis con las palabras del cirujano, incluidas las limitaciones anatómicas que señaló. Las clasificaciones (grado de ptosis, profundidad de la quemadura, escala de cicatriz) se transcriben solo si él las enunció: nunca las asignes tú."},
    {"key":"opciones_y_plan","label":"Opciones de manejo, riesgos y plan","order":9,"required":true,
     "instruction":"Opciones planteadas (manejo médico, injerto, colgajo, expansor, procedimiento estético) con el detalle que dio el cirujano, riesgos, alternativas y limitaciones explicadas al paciente, y estudios o valoraciones prequirúrgicas solicitadas. No des por definido un procedimiento ni por firmado el consentimiento."},
    {"key":"proximo_control_y_recomendaciones","label":"Próximo control y recomendaciones","order":10,"required":false,
     "instruction":"Cuándo vuelve y con qué estudios, y las recomendaciones dadas (cesación de tabaco, control de peso, suspensión de medicamentos, cuidado de la piel) tal como se explicaron. Solo lo dicho en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = '06c030d7-11a9-51dc-818b-be9f0971c130' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · cicatrización, simetría y cuidados posoperatorios',
  description = 'Control tras cirugía plástica o durante el manejo de una herida: días de posoperatorio, evolución de la cicatriz, viabilidad del injerto o del colgajo, seromas y hematomas, uso de faja o compresión, y percepción del resultado en palabras del paciente.',
  sections = '[
    {"key":"procedimiento_previo","label":"Procedimiento previo y tiempo de posoperatorio","order":1,"required":true,
     "instruction":"Procedimiento realizado con su nombre, lateralidad, fecha y días o semanas de posoperatorio tal como se dijeron; si la fecha no se enunció, indícalo y no la calcules. Cita hallazgos operatorios, implantes o patología solo si el cirujano los mencionó hoy."},
    {"key":"evolucion_referida","label":"Evolución y percepción del paciente","order":2,"required":false,
     "instruction":"Dolor con la intensidad solo si el paciente la graduó, edema, equimosis, prurito, sensibilidad, limitación funcional y la percepción del resultado EN SUS PALABRAS. No conviertas una queja en una complicación ni infieras satisfacción."},
    {"key":"estado_de_la_cicatriz","label":"Estado de la herida y de la cicatriz","order":3,"required":true,
     "instruction":"Aspecto de la herida o de la cicatriz: bordes, afrontamiento, secreción, dehiscencia, eritema, induración, hipertrofia o queloide, con las medidas transcritas literal si se dictaron. Nunca estimes un tamaño ni afirmes una cicatrización que no se describió."},
    {"key":"viabilidad_de_injerto_o_colgajo","label":"Viabilidad del injerto o del colgajo","order":4,"required":false,
     "instruction":"Color, temperatura, llenado capilar, sangrado al pinchazo, porcentaje de prendimiento y áreas de necrosis EXACTAMENTE como los describió el cirujano, junto con el estado del sitio donante. Nunca estimes un porcentaje de prendimiento que no se dictó."},
    {"key":"complicaciones_locales","label":"Seroma, hematoma y signos de infección","order":5,"required":false,
     "instruction":"Presencia de seroma, hematoma, colección o signos de infección con la localización dicha, y drenaje o punción realizada con la cantidad y el aspecto obtenidos, transcritos literal. Consigna la ausencia de complicaciones solo si el cirujano la afirmó."},
    {"key":"examen_de_control","label":"Examen de control, simetría y drenajes","order":6,"required":true,
     "instruction":"Signos vitales si se tomaron, simetría, contorno, posición y consistencia de los implantes, movilidad y estado de los drenajes con su débito literal. Compara con controles previos solo si el cirujano hizo la comparación; no completes lo no examinado."},
    {"key":"procedimientos_en_consulta","label":"Curación, retiro de puntos y procedimientos en consulta","order":7,"required":false,
     "instruction":"Curación realizada con el apósito nombrado, retiro de puntos o de drenaje, punción de seroma, masaje o infiltración de la cicatriz, con la técnica y la tolerancia descritas. Si no se realizó ningún procedimiento, indícalo; no lo des por hecho por tratarse de un control."},
    {"key":"cuidados_y_recomendaciones","label":"Cuidados, compresión y recomendaciones","order":8,"required":false,
     "instruction":"Uso de faja o de prendas de compresión con el tiempo indicado, protección solar, manejo de la cicatriz, drenaje linfático, actividad permitida y regreso al trabajo, tal como se explicaron. Registra la incapacidad solo si se otorgó, con los días exactos."},
    {"key":"analisis_y_proximo_control","label":"Análisis, ajuste del plan y próximo control","order":9,"required":true,
     "instruction":"Evaluación de la evolución con las palabras del cirujano, cambios de tratamiento con dosis literales, procedimientos o retoques planteados solo si él los mencionó, y fecha del próximo control con los signos de alarma explicados (fiebre, secreción, dolor que aumenta, cambio de color del colgajo)."}
  ]'::jsonb,
  updated_at = now()
where id = 'f8d69bc8-938f-5256-9a32-10ac69478799' and owner_id is null;

update public.clinical_templates set
  name = 'Descripción quirúrgica · técnica reconstructiva o estética e implantes',
  description = 'Nota operatoria de cirugía plástica: marcación prequirúrgica, técnica con el diseño de colgajos o injertos, implantes y materiales con marca, volumen y lote literales, lipoaspirado o tejido resecado con las cantidades dictadas, y estado del paciente al terminar.',
  sections = '[
    {"key":"indicacion_y_procedimiento","label":"Indicación y procedimiento realizado","order":1,"required":true,
     "instruction":"Diagnóstico preoperatorio, procedimiento realizado con su nombre completo, LATERALIDAD y carácter reconstructivo o estético, tal como los dictó el cirujano. Si el plan cambió en sala, consígnalo con la razón que él expresó; nunca supongas el lado."},
    {"key":"equipo_anestesia_y_posicion","label":"Equipo, anestesia, posición y marcación","order":2,"required":false,
     "instruction":"Cirujano, ayudantes y anestesiólogo nombrados, tipo de anestesia, posición, marcación prequirúrgica realizada con el paciente de pie si se mencionó, y profilaxis antibiótica y antitrombótica con las dosis dichas. No agregues lo no mencionado."},
    {"key":"verificacion_y_consentimiento","label":"Lista de verificación y consentimiento informado","order":3,"required":false,
     "instruction":"Consentimiento informado, marcación del sitio, lista de chequeo de cirugía segura y conteo de compresas e instrumental, SOLO como se mencionaron en sala. Si no se habló del consentimiento, indícalo de forma explícita; nunca lo des por firmado."},
    {"key":"tecnica_quirurgica","label":"Técnica quirúrgica","order":4,"required":true,
     "instruction":"Descripción en el orden dictado: diseño e incisiones con sus longitudes si se dieron, disección y planos, colgajo con su pedículo o injerto con su espesor y sitio donante, anastomosis microquirúrgica si se realizó, y material de sutura con el calibre nombrado. No completes pasos que no se describieron."},
    {"key":"hallazgos_intraoperatorios","label":"Hallazgos intraoperatorios","order":5,"required":true,
     "instruction":"Hallazgos EXACTAMENTE como los dictó el cirujano: calidad y grosor de los tejidos, fibrosis, contractura capsular, biopolímeros, tejido no viable y estado del pedículo o de la anastomosis, con localización, lateralidad y medidas literales. Nunca midas ni clasifiques tú."},
    {"key":"implantes_y_materiales","label":"Implantes, materiales y tejido manejado","order":6,"required":false,
     "instruction":"Implantes con marca, referencia, volumen, perfil y lote EXACTAMENTE como se dictaron, mallas, matrices o expansores, y cantidad de lipoaspirado, grasa infiltrada o tejido resecado con sus volúmenes y pesos literales. Nunca inventes ni redondees un volumen, un lote ni una referencia."},
    {"key":"sangrado_y_liquidos","label":"Sangrado, infiltración y líquidos","order":7,"required":false,
     "instruction":"Sangrado estimado, solución de infiltración tumescente con su composición y volumen, líquidos y transfusiones SOLO si se enunciaron, con cifras y unidades literales. Si el sangrado no se cuantificó, escribe que no se consignó; nunca lo estimes."},
    {"key":"cierre_drenajes_y_estado_final","label":"Cierre, drenajes, vendaje y estado al terminar","order":8,"required":true,
     "instruction":"Cierre por planos con el material nombrado, drenajes dejados con su sitio, vendaje o faja aplicada, conteo declarado, complicaciones intraoperatorias o su ausencia tal como se enunció, y estado y destino del paciente al salir de sala."},
    {"key":"indicaciones_posoperatorias","label":"Indicaciones posoperatorias y seguimiento","order":9,"required":true,
     "instruction":"Indicaciones dictadas: posición, analgesia, antibióticos y profilaxis antitrombótica con dosis literales, manejo de drenajes, uso de faja, cuidado de la herida, vigilancia del colgajo y plazo de la próxima valoración con los signos de alarma explicados."}
  ]'::jsonb,
  updated_at = now()
where id = '162b2eb4-6782-5239-a1ea-9fe624c4b633' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c4000000-0000-4000-8000-000000000006', null,
   'Valoración preoperatoria estética · expectativas, consentimiento y registro fotográfico',
   'Cita previa a un procedimiento estético o reconstructivo programado: expectativas del paciente en sus palabras, riesgo quirúrgico y estudios, procedimiento acordado con sus medidas, consentimiento informado con los riesgos explicados y registro fotográfico autorizado. Úsala en la consulta que antecede a la programación.',
   'cirugia_plastica', 'Cirugía plástica', 'institutional', false, 'active',
   '[
    {"key":"procedimiento_acordado","label":"Procedimiento acordado y motivo","order":1,"required":true,
     "instruction":"Procedimiento acordado con su nombre y lateralidad tal como se enunció, y el motivo del paciente en sus propias palabras. Si aún no hay una decisión definitiva, consígnalo así; nunca conviertas una opción discutida en un procedimiento programado."},
    {"key":"expectativas_del_paciente","label":"Expectativas y resultado esperado","order":2,"required":true,
     "instruction":"Expectativas del paciente EN SUS PALABRAS y entre comillas cuando sean textuales, junto con lo que el cirujano le explicó sobre el resultado alcanzable y sus limitaciones. No suavices ni interpretes la expectativa: es lo que define el acuerdo entre el paciente y el cirujano."},
    {"key":"antecedentes_y_riesgo","label":"Antecedentes, comorbilidades y riesgo quirúrgico","order":3,"required":false,
     "instruction":"Comorbilidades, tabaquismo con el tiempo de suspensión indicado, anticoagulantes y anovulatorios con dosis, alergias, alteraciones de la cicatrización, trombosis previa y antecedentes anestésicos. Las escalas de riesgo se transcriben solo si el médico las enunció: nunca las calcules."},
    {"key":"medicacion_y_suplementos","label":"Medicación, suplementos y suspensiones","order":4,"required":false,
     "instruction":"Medicamentos, suplementos y productos naturales que consume, con las indicaciones de suspensión y los días EXACTAMENTE como se dictaron. Transcríbelos literal; nunca completes un esquema de suspensión que no se enunció."},
    {"key":"examen_y_medidas_preoperatorias","label":"Examen físico y medidas preoperatorias","order":5,"required":true,
     "instruction":"Examen de la zona a intervenir con las medidas, distancias, volúmenes y pesos EXACTAMENTE como los dictó el cirujano, peso y talla si se enunciaron, calidad de la piel, cicatrices, asimetrías y estado de implantes previos. Nunca midas ni calcules tú un índice."},
    {"key":"estudios_prequirurgicos","label":"Estudios prequirúrgicos y valoración anestésica","order":6,"required":false,
     "instruction":"Laboratorios, imágenes y concepto de la valoración preanestésica o de otras especialidades: transcribe valores, fechas y conclusiones literal como los leyó el cirujano. Si un estudio está pendiente o vencido, escríbelo así; nunca supongas un resultado normal."},
    {"key":"registro_fotografico","label":"Registro fotográfico y autorización","order":7,"required":false,
     "instruction":"Fotografías clínicas tomadas con las proyecciones descritas y la autorización del paciente para su uso clínico, docente o publicitario, SOLO como se mencionaron. Si no se habló del registro o de su autorización, indícalo; nunca los des por hechos."},
    {"key":"consentimiento_informado","label":"Consentimiento informado y riesgos explicados","order":8,"required":true,
     "instruction":"Riesgos, alternativas, posibilidad de retoque y limitaciones explicados al paciente, quién estuvo presente y si el consentimiento fue firmado, tal como quedó registrado en la consulta. Si no se mencionó, indícalo; nunca lo des por firmado ni completes los riesgos de rutina."},
    {"key":"plan_quirurgico_y_tecnica_prevista","label":"Plan quirúrgico y técnica prevista","order":9,"required":true,
     "instruction":"Técnica, abordaje, implantes o materiales previstos con volumen y referencia SOLO si se nombraron, tipo de anestesia, tiempo estimado y sitio de la cirugía, tal como se acordaron. Nunca asignes un implante ni un volumen que no se dijo."},
    {"key":"preparacion_preoperatoria","label":"Preparación preoperatoria e indicaciones previas","order":10,"required":false,
     "instruction":"Indicaciones antes de la cirugía: ayuno, baño, suspensión de tabaco y de medicamentos con los días dichos, medias de compresión, acompañante y cuidados en casa. Registra la incapacidad prevista solo si se enunció, con los días exactos."},
    {"key":"programacion_y_signos_de_alarma","label":"Programación, controles y signos de alarma","order":11,"required":false,
     "instruction":"Fecha y lugar del procedimiento si se dieron, documentos y exámenes que debe traer, controles posoperatorios programados y los motivos por los que debe avisar antes de la cirugía (infección de piel, fiebre, gripa, cambio de medicación)."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();
