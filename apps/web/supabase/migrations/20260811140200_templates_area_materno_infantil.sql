-- Renovación del catálogo de plantillas clínicas · lote materno-infantil (área 2).
--
-- Por qué: las 12 plantillas de fábrica de pediatría, neonatología, ginecología y
-- obstetricia y cirugía pediátrica salían del generador genérico del catálogo (mismas
-- secciones para todas las especialidades). Este lote las reescribe con contenido clínico
-- real de cada especialidad y agrega una 4ª plantilla nueva por especialidad para el
-- escenario de mayor valor que las otras 3 no cubrían. Además se ajusta SOLO la
-- description de la consulta pediátrica integral (b2000000-...-0001, que sigue activa)
-- para posicionarla como la nota todo-en-uno frente al nuevo "Control de niño sano".
--
-- pediatria: "Consulta inicial · enfermedad aguda en el niño" / "Control y seguimiento ·
--   patología pediátrica en tratamiento" / "Procedimiento pediátrico ambulatorio · técnica,
--   tolerancia y cuidados" / 4ª: "Control de niño sano · crecimiento, desarrollo y
--   prevención" — la mayoría de citas pediátricas en Miracle son controles programados de
--   rutina y ninguna plantilla los cubría sin arrastrar secciones de enfermedad.
-- neonatologia: "Consulta inicial · valoración del recién nacido" / "Control y seguimiento ·
--   evolución y ganancia ponderal del neonato" / "Atención del recién nacido en sala de
--   partos · adaptación y cuidados inmediatos" / 4ª: "Control del prematuro y recién nacido
--   de riesgo · seguimiento tras el alta" — el egresado de la unidad neonatal necesita
--   seguimiento de edad corregida, curvas del prematuro, ROP y neurodesarrollo que ninguna
--   de las otras 3 documenta.
-- ginecologia_obstetricia: "Consulta inicial · valoración ginecológica" / "Control y
--   seguimiento · evolución ginecológica y resultados" / "Procedimiento ginecológico ·
--   técnica, hallazgos y cuidados" / 4ª: "Control prenatal · seguimiento obstétrico" — la
--   cita obstétrica más frecuente y la de mayor riesgo documental (edad gestacional,
--   fetocardia, paraclínicos del trimestre) no tenía plantilla propia.
-- cirugia_pediatrica: "Consulta inicial · valoración quirúrgica del niño" / "Control y
--   seguimiento · patología quirúrgica en espera o manejo expectante" / "Procedimiento
--   quirúrgico ambulatorio · nota operatoria pediátrica" / 4ª: "Control postoperatorio ·
--   recuperación del niño operado" — la cita más frecuente tras cirugía ambulatoria, con
--   requisitos propios (herida, analgesia por peso, patología, reintegro escolar).

-- ============================================================================
-- pediatria
-- ============================================================================

update public.clinical_templates set
  name = 'Consulta inicial · enfermedad aguda en el niño',
  description = 'Primera valoración cuando el niño consulta por enfermedad: fiebre, tos, diarrea, dolor u otro cuadro agudo. Cubre cronología, antecedentes relevantes, examen físico y plan con dosis por peso. Para la cita de rutina del niño que viene sano use «Control de niño sano».',
  sections = '[
    {"key":"identificacion_y_acompanante","label":"Identificación y acompañante","order":1,"required":false,"instruction":"Registra la edad exacta en años y meses (en lactantes, meses y días), quién acompaña al niño y quién da la información (madre, padre, abuela u otro cuidador). Si la edad no se dijo en la consulta, no la infieras ni la calcules."},
    {"key":"motivo_de_consulta","label":"Motivo de consulta","order":2,"required":true,"instruction":"Documenta el motivo en las palabras del cuidador o del propio niño cuando pueda expresarlo. No lo traduzcas a lenguaje técnico ni a un diagnóstico."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":3,"required":false,"instruction":"Cronología del cuadro agudo: inicio, evolución, fiebre con cifras y duración si se mencionaron, síntomas asociados, apetito, tolerancia a la vía oral, diuresis, deposiciones, sueño, contacto con enfermos y tratamientos ya dados con su respuesta. Solo lo dicho en la consulta; si un dato no se mencionó, no lo completes."},
    {"key":"antecedentes_relevantes","label":"Antecedentes relevantes","order":4,"required":false,"instruction":"Perinatales resumidos si se comentaron, enfermedades previas, hospitalizaciones, alergias a medicamentos o alimentos, medicación crónica y estado del esquema PAI si se revisó el carné de vacunación. Si un antecedente no se exploró, indícalo en lugar de inventarlo."},
    {"key":"revision_por_sistemas_dirigida","label":"Revisión por sistemas dirigida","order":5,"required":false,"instruction":"Síntomas por sistemas que el médico interrogó: respiratorio, digestivo, urinario, piel, neurológico. Registra también los negativos que se preguntaron de forma explícita. No agregues sistemas que no se revisaron."},
    {"key":"examen_fisico_pediatrico","label":"Examen físico pediátrico","order":6,"required":true,"instruction":"Estado general, signos vitales con los valores dichos, estado de hidratación, trabajo respiratorio (tirajes, aleteo, saturación si se enunció), piel y exantemas, ORL, cardiopulmonar, abdomen y neurológico. Describe solo lo examinado; no completes sistemas no explorados."},
    {"key":"analisis_e_impresion_diagnostica","label":"Análisis e impresión diagnóstica","order":7,"required":true,"instruction":"Razonamiento clínico y diagnósticos con la precisión con que el médico los formuló, incluida la clasificación de severidad solo si él la enunció. Deja explícitos los diferenciales que consideró. No agregues diagnósticos ni escalas que no se dijeron."},
    {"key":"plan_y_dosis_por_peso","label":"Plan y dosis por peso","order":8,"required":true,"instruction":"Medicamentos con la dosis tal como fue indicada (mg/kg/dosis, mL, frecuencia y duración): transcríbela literal, nunca la recalcules ni completes la que falte. Añade hidratación, medidas en casa, paraclínicos, remisiones e incapacidad del cuidador o excusa escolar si se indicaron."},
    {"key":"signos_de_alarma_y_proximo_control","label":"Signos de alarma y próximo control","order":9,"required":false,"instruction":"Signos de alarma explicados al cuidador para volver de urgencia (dificultad para respirar, rechazo de la vía oral, somnolencia, fiebre que persiste, convulsión) y cuándo es el control. Registra solo los que se explicaron en esta consulta."}
  ]'::jsonb,
  updated_at = now()
where id = 'a6bbcf53-4a5b-52de-821f-c558a823ebee' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · patología pediátrica en tratamiento',
  description = 'Seguimiento del niño que ya tiene un diagnóstico y vuelve por evolución de su enfermedad o tratamiento: asma, dermatitis, anemia, egreso hospitalario reciente, entre otros. No es la cita de rutina del niño sano; para esa use «Control de niño sano».',
  sections = '[
    {"key":"diagnostico_y_motivo_del_control","label":"Diagnóstico en seguimiento y motivo del control","order":1,"required":true,"instruction":"Diagnóstico o problema en seguimiento tal como lo nombró el médico, tiempo de evolución si se dijo y motivo de esta cita (control programado, egreso hospitalario, cambio de síntomas). No agregues diagnósticos no mencionados."},
    {"key":"evolucion_desde_el_ultimo_control","label":"Evolución desde el último control","order":2,"required":false,"instruction":"Cambios desde la última consulta según el cuidador o el niño: síntomas, crisis o recaídas, ausencias al jardín o colegio, visitas a urgencias u hospitalizaciones en el intervalo. Solo lo relatado; si no se habló de la evolución, indícalo."},
    {"key":"adherencia_y_tolerancia","label":"Adherencia y tolerancia al tratamiento","order":3,"required":false,"instruction":"Cumplimiento del tratamiento según lo relatado (dosis olvidadas, técnica inhalatoria si se revisó, dificultades para conseguir el medicamento con la EPS) y efectos adversos referidos. No asumas buena ni mala adherencia si no se comentó."},
    {"key":"paraclinicos_y_estudios_nuevos","label":"Paraclínicos y estudios nuevos","order":4,"required":false,"instruction":"Resultados de laboratorio o imágenes revisados en la consulta: transcríbelos literal con unidades y fecha si se dijeron; nunca los calcules, interpretes por tu cuenta ni completes valores ausentes. Si no se revisaron resultados, escríbelo."},
    {"key":"crecimiento_intercurrente","label":"Crecimiento intercurrente","order":5,"required":false,"instruction":"Peso, talla y demás medidas tomadas hoy con los valores dichos, y los percentiles o puntuaciones Z solo si el médico los enunció: nunca los calcules ni los estimes tú. Anota la tendencia de la curva solo si se comentó."},
    {"key":"examen_fisico_de_control","label":"Examen físico de control","order":6,"required":true,"instruction":"Examen dirigido al problema en seguimiento y signos vitales con los valores dichos. Describe los hallazgos tal como los enunció el médico y aclara qué se examinó; no completes sistemas no explorados."},
    {"key":"analisis_y_evolucion","label":"Análisis y evolución","order":7,"required":true,"instruction":"Concepto del médico sobre la evolución (mejoría, estabilidad o empeoramiento) con su justificación, y el estado del diagnóstico tal como lo formuló. Usa solo las clasificaciones de control o severidad que él enunció."},
    {"key":"ajuste_del_plan","label":"Ajuste del plan","order":8,"required":true,"instruction":"Cambios al tratamiento con dosis transcritas literal (mg/kg, mL, frecuencia, duración), sin recalcular ninguna. Incluye paraclínicos solicitados, remisiones, recomendaciones al cuidador y trámites con la EPS si se mencionaron."},
    {"key":"proximo_control_y_signos_de_alarma","label":"Próximo control y signos de alarma","order":9,"required":false,"instruction":"Fecha o plazo del próximo control y los signos de alarma reforzados al cuidador en esta cita. Solo los que se explicaron hoy; no repitas listas genéricas."}
  ]'::jsonb,
  updated_at = now()
where id = '2052a426-003e-5f56-8e51-129404638119' and owner_id is null;

update public.clinical_templates set
  name = 'Procedimiento pediátrico ambulatorio · técnica, tolerancia y cuidados',
  description = 'Nota de procedimientos menores en el niño: curaciones, retiro de puntos, nebulizaciones, hidratación oral supervisada, lavado ótico, entre otros. Documenta indicación, consentimiento, técnica, tolerancia y las indicaciones al cuidador.',
  sections = '[
    {"key":"indicacion_y_contexto","label":"Indicación y contexto","order":1,"required":true,"instruction":"Procedimiento realizado y su indicación tal como la enunció el médico, con la edad exacta del niño en años y meses y el diagnóstico que lo motiva. No agregues indicaciones no dichas."},
    {"key":"verificacion_y_consentimiento","label":"Verificación y consentimiento","order":2,"required":false,"instruction":"Consentimiento informado del acudiente y asentimiento del niño cuando aplique, verificación de identidad, alergias y ayuno si se mencionaron. Si algún punto no se verbalizó, indícalo en lugar de darlo por hecho."},
    {"key":"preparacion_analgesia_y_contencion","label":"Preparación, analgesia y contención","order":3,"required":false,"instruction":"Preparación realizada: analgesia o anestesia local con dosis transcrita literal (nunca la calcules tú), medidas de contención o distracción empleadas y presencia del cuidador durante el procedimiento, según lo dicho."},
    {"key":"tecnica_y_hallazgos","label":"Técnica y hallazgos","order":4,"required":true,"instruction":"Describe la técnica paso a paso tal como la relató el médico, los materiales usados y los hallazgos encontrados (aspecto de la herida, secreciones, cuerpo extraño, respuesta clínica). Solo lo descrito en la consulta."},
    {"key":"conducta_realizada","label":"Conducta realizada","order":5,"required":true,"instruction":"Qué se hizo al final: curación completada, puntos retirados totales o parciales, muestra enviada, medicamento administrado con dosis literal. Registra únicamente lo que el médico dijo haber realizado."},
    {"key":"tolerancia_y_complicaciones_inmediatas","label":"Tolerancia y complicaciones inmediatas","order":6,"required":false,"instruction":"Cómo toleró el niño el procedimiento (llanto, dolor referido, sangrado, reacciones) y las complicaciones inmediatas si las hubo. Si el médico dijo que no hubo complicaciones, regístralo así; no lo asumas por tu cuenta."},
    {"key":"indicaciones_al_cuidador","label":"Indicaciones al cuidador","order":7,"required":true,"instruction":"Cuidados en casa explicados al cuidador: manejo de la herida o del sitio del procedimiento, analgesia con dosis transcrita literal, baño, actividad y retorno al jardín o colegio, excusa escolar si se expidió. Solo lo indicado hoy."},
    {"key":"seguimiento_y_alarma","label":"Seguimiento y signos de alarma","order":8,"required":false,"instruction":"Cuándo debe volver a control o a nueva curación y los signos de alarma para consultar de urgencia que se explicaron (sangrado, signos de infección, dolor que no cede). Solo los mencionados."}
  ]'::jsonb,
  updated_at = now()
where id = '20327160-e1ff-57e2-8836-1da6bd3aa38e' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c2000000-0000-4000-8000-000000000001', null,
   'Control de niño sano · crecimiento, desarrollo y prevención',
   'La cita de rutina programada del niño que viene sano: curvas de crecimiento, hitos del desarrollo, alimentación, esquema PAI, tamizajes y crianza. Sin sección de enfermedad actual. Si el niño consulta enfermo, use la consulta de enfermedad aguda o la consulta pediátrica integral.',
   'pediatria', 'Pediatría', 'institutional', false, 'active',
   '[
    {"key":"identificacion_y_acompanante","label":"Identificación y acompañante","order":1,"required":false,"instruction":"Edad exacta en años y meses (en lactantes, meses y días), quién trae al niño al control y quién responde las preguntas. Si la edad no se enunció en la consulta, no la infieras ni la calcules."},
    {"key":"curvas_de_crecimiento","label":"Curvas de crecimiento","order":2,"required":true,"instruction":"Peso, talla, perímetro cefálico e IMC con los valores medidos hoy tal como se dictaron, y los percentiles o puntuaciones Z únicamente si el médico los enunció: nunca los calcules, estimes ni interpretes tú. Registra la tendencia de la curva solo si se comentó."},
    {"key":"hitos_del_desarrollo","label":"Hitos del desarrollo","order":3,"required":false,"instruction":"Hitos evaluados para la edad (motor grueso y fino, lenguaje, social) tal como los valoró el médico: alcanzados, en progreso o rezagados. Incluye la escala de desarrollo solo si se aplicó y se enunció su resultado. No listes hitos que no se exploraron."},
    {"key":"alimentacion_segun_etapa","label":"Alimentación según la etapa","order":4,"required":false,"instruction":"Alimentación actual según la edad: lactancia materna exclusiva o mixta, fórmula, alimentación complementaria y su tolerancia, dieta familiar, apetito y suplementos (hierro, vitamina D) con dosis transcrita literal. Solo lo conversado en la cita."},
    {"key":"esquema_pai_y_vacunas_de_hoy","label":"Esquema PAI y vacunas aplicadas hoy","order":5,"required":false,"instruction":"Estado del esquema PAI para la edad según el carné de vacunación: al día o incompleto, vacunas aplicadas hoy con su nombre y refuerzos pendientes. Si el carné no se revisó, escríbelo así; no marques el esquema como completo sin que se haya dicho."},
    {"key":"tamizajes_por_edad","label":"Tamizajes según la edad","order":6,"required":false,"instruction":"Tamizajes que el médico mencionó haber revisado, solicitado o realizado según la edad: visión, audición, anemia, salud oral, entre otros, con sus resultados transcritos literal. No agregues tamizajes que no se nombraron ni sugieras pendientes."},
    {"key":"examen_fisico_completo","label":"Examen físico completo","order":7,"required":true,"instruction":"Examen por sistemas del niño sano: estado general, signos vitales con los valores dichos, piel, cabeza y fontanelas según la edad, ORL, cardiopulmonar, abdomen, genital, caderas en el lactante, columna, marcha y neurológico. Solo lo examinado; no completes sistemas no explorados."},
    {"key":"crianza_sueno_y_prevencion","label":"Crianza, sueño, pantallas y prevención de accidentes","order":8,"required":false,"instruction":"Temas de crianza abordados según la edad: sueño y dónde duerme, tiempo de pantallas, pautas de disciplina, prevención de accidentes (transporte, agua, quemaduras, caídas) y salud oral. Registra solo los que se conversaron en esta cita."},
    {"key":"analisis_y_concepto_de_salud","label":"Análisis y concepto del estado de salud","order":9,"required":true,"instruction":"Concepto del médico sobre el estado de salud, la nutrición y el desarrollo del niño con la clasificación exacta que él enunció (por ejemplo niño sano, o el riesgo detectado). No emitas clasificaciones nutricionales ni de desarrollo que no se dijeron."},
    {"key":"plan_y_educacion_al_cuidador","label":"Plan y educación al cuidador","order":10,"required":true,"instruction":"Recomendaciones y educación dadas al cuidador, suplementos o medicamentos con dosis transcrita literal, tamizajes o remisiones solicitados y trámites con la EPS si se mencionaron. Solo lo indicado en esta consulta."},
    {"key":"proximo_control","label":"Próximo control","order":11,"required":false,"instruction":"Cuándo es el siguiente control de crecimiento y desarrollo y qué vacunas o tamizajes corresponderán, únicamente si el médico lo enunció. Añade los signos por los que debe consultar antes, si se explicaron."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

-- Ajuste permitido: SOLO la description de la consulta pediátrica integral (sigue activa),
-- para diferenciarla del nuevo "Control de niño sano".
update public.clinical_templates set
  description = 'Consulta todo-en-uno de pediatría: sirve tanto para el niño que llega sano como para el que consulta enfermo, en una sola nota con perinatales, alimentación, curvas, hitos, esquema PAI, enfermedad actual y dosis por peso. Si la cita es el control de rutina programado del niño que viene sano, prefiera la plantilla «Control de niño sano».'
where id = 'b2000000-0000-4000-8000-000000000001' and owner_id is null;

-- ============================================================================
-- neonatologia
-- ============================================================================

update public.clinical_templates set
  name = 'Consulta inicial · valoración del recién nacido',
  description = 'Primera valoración ambulatoria u hospitalaria del recién nacido: antecedentes maternos y del parto, adaptación neonatal, antropometría, alimentación, examen neonatal completo y tamizajes. Para el seguimiento posterior use los controles de la especialidad.',
  sections = '[
    {"key":"identificacion_del_recien_nacido","label":"Identificación del recién nacido","order":1,"required":false,"instruction":"Edad en días u horas de vida tal como la enunció el médico (no la calcules a partir de fechas), sexo, quién acompaña y quién da la información. Anota la procedencia (alojamiento conjunto, egreso, remisión) si se dijo."},
    {"key":"motivo_de_valoracion","label":"Motivo de la valoración","order":2,"required":true,"instruction":"Motivo por el que se valora al recién nacido en las palabras de quien consulta o remite: primera consulta, ictericia, dificultades con la lactancia, entre otros. No lo conviertas en un diagnóstico."},
    {"key":"antecedentes_maternos_y_del_embarazo","label":"Antecedentes maternos y del embarazo","order":3,"required":false,"instruction":"Fórmula obstétrica G-P-A tal como se dictó, controles prenatales, serologías y tamizajes maternos con resultados transcritos literal, patologías del embarazo y medicamentos maternos. Si un dato no se mencionó, indícalo; no lo completes."},
    {"key":"parto_y_adaptacion_neonatal","label":"Parto y adaptación neonatal","order":4,"required":false,"instruction":"Vía del parto y sus detalles, edad gestacional al nacer tal como la enunció el médico (nunca la recalcules tú), Apgar transcrito literal, necesidad de reanimación y hospitalización neonatal si la hubo. Solo lo referido en la consulta."},
    {"key":"antropometria_al_nacer_y_actual","label":"Antropometría al nacer y actual","order":5,"required":false,"instruction":"Peso, talla y perímetro cefálico al nacer y actuales con los valores dictados, y su clasificación o percentiles únicamente si el médico los enunció: nunca los calcules ni los estimes tú. No calcules pérdida ni ganancia de peso salvo que se haya dicho."},
    {"key":"alimentacion_y_eliminaciones","label":"Alimentación y eliminaciones","order":6,"required":false,"instruction":"Lactancia materna (agarre, succión, frecuencia de tomas), fórmula si la recibe con las cantidades dichas, vómito o regurgitación, número de micciones y deposiciones con sus características si se relataron. Solo lo mencionado."},
    {"key":"examen_fisico_neonatal","label":"Examen físico neonatal","order":7,"required":true,"instruction":"Examen del recién nacido tal como se describió: estado general, fontanelas, ictericia con su extensión si se enunció, cardiopulmonar y soplos, abdomen y muñón umbilical, caderas (Ortolani y Barlow si se realizaron), genitales, reflejos primitivos y tono. No completes lo no examinado."},
    {"key":"analisis_e_impresion_diagnostica","label":"Análisis e impresión diagnóstica","order":8,"required":true,"instruction":"Razonamiento y diagnósticos neonatales con la precisión con que el médico los formuló (por ejemplo recién nacido a término sano, o la condición que él nombró). Incluye clasificaciones solo si las enunció; no agregues diagnósticos propios."},
    {"key":"plan_tamizajes_y_educacion","label":"Plan, tamizajes y educación","order":9,"required":true,"instruction":"Conducta indicada, tamizajes neonatales mencionados (auditivo, metabólico, cardiopatías, visual) con su estado o resultado transcrito literal, medicamentos con dosis literal y educación a los padres sobre lactancia y cuidados. Solo lo dicho en la consulta."},
    {"key":"proximo_control_y_signos_de_alarma","label":"Próximo control y signos de alarma","order":10,"required":false,"instruction":"Cuándo es el próximo control y los signos de alarma explicados a los padres (mala succión, ictericia que avanza, fiebre o hipotermia, quejido, somnolencia). Registra únicamente los que se explicaron."}
  ]'::jsonb,
  updated_at = now()
where id = 'c541ff75-7cf2-5cec-8438-ba509fd0f82d' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · evolución y ganancia ponderal del neonato',
  description = 'Control del recién nacido a término en sus primeras semanas: evolución de la alimentación, ictericia, ganancia de peso, tamizajes pendientes y educación a los padres. Para el prematuro o el egresado de la unidad neonatal use la plantilla de recién nacido de riesgo.',
  sections = '[
    {"key":"edad_y_contexto_del_control","label":"Edad y contexto del control","order":1,"required":false,"instruction":"Edad en días de vida tal como la enunció el médico, sin calcularla tú a partir de fechas, y contexto del control (primer control tras el egreso, control de ictericia, seguimiento de peso). Registra quién acompaña e informa."},
    {"key":"motivo_y_diagnosticos_en_seguimiento","label":"Motivo y diagnósticos en seguimiento","order":2,"required":true,"instruction":"Motivo del control y diagnósticos activos tal como los nombró el médico (ictericia en seguimiento, pérdida de peso, entre otros). No agregues diagnósticos ni antecedentes no mencionados."},
    {"key":"evolucion_del_intervalo","label":"Evolución desde el último control","order":3,"required":false,"instruction":"Cómo ha estado el bebé según los padres: lactancia y frecuencia de tomas, vómito, color de la piel, micciones y deposiciones, sueño y estado de alerta. Solo lo relatado; si un aspecto no se preguntó, indícalo."},
    {"key":"peso_y_ganancia_ponderal","label":"Peso y ganancia ponderal","order":4,"required":false,"instruction":"Peso de hoy y pesos previos con los valores dictados. La ganancia o pérdida (gramos por día o porcentaje) regístrala únicamente si el médico la enunció: nunca la calcules tú ni la estimes a partir de los pesos."},
    {"key":"paraclinicos_y_tamizajes","label":"Paraclínicos y tamizajes","order":5,"required":false,"instruction":"Resultados revisados en la cita: bilirrubinas con cifras transcritas literal, TSH neonatal, hemoclasificación y demás tamizajes con su estado exacto. Nunca calcules ni interpretes valores por tu cuenta; si no se revisaron, escríbelo."},
    {"key":"examen_fisico_de_control","label":"Examen físico de control","order":6,"required":true,"instruction":"Examen dirigido del neonato: estado general y de hidratación, ictericia y su extensión si se enunció, fontanelas, cardiopulmonar, abdomen y muñón o cicatriz umbilical, tono y reflejos. Solo lo examinado y descrito por el médico."},
    {"key":"analisis_y_evolucion","label":"Análisis y evolución","order":7,"required":true,"instruction":"Concepto del médico sobre la evolución del recién nacido (adecuada o no y por qué) y el estado de cada diagnóstico en seguimiento tal como lo formuló. No emitas clasificaciones que no se dijeron."},
    {"key":"plan_y_ajustes","label":"Plan y ajustes","order":8,"required":true,"instruction":"Conducta indicada: ajustes a la alimentación, medicamentos o suplementos con dosis transcrita literal (nunca la recalcules), paraclínicos de control, fototerapia o remisión si se indicó, y educación dada a los padres."},
    {"key":"proximo_control_y_signos_de_alarma","label":"Próximo control y signos de alarma","order":9,"required":false,"instruction":"Cuándo vuelve a control y los signos de alarma reforzados a los padres (ictericia que avanza, rechazo del seno, fiebre o hipotermia, quejido, letargia). Solo los explicados en esta cita."}
  ]'::jsonb,
  updated_at = now()
where id = '0323efcc-3b02-5d6d-9b3c-9f899d4d890b' and owner_id is null;

update public.clinical_templates set
  name = 'Atención del recién nacido en sala de partos · adaptación y cuidados inmediatos',
  description = 'Nota de la atención inmediata del recién nacido en sala de partos o cesárea: preparación, adaptación, Apgar, maniobras de reanimación si se requirieron, profilaxis, antropometría y destino. Úsela para documentar el nacimiento, no para consultas posteriores.',
  sections = '[
    {"key":"contexto_e_indicacion","label":"Contexto e indicación de la atención","order":1,"required":true,"instruction":"Contexto del nacimiento atendido: vía del parto, antecedentes maternos y factores de riesgo enunciados por el médico, y edad gestacional tal como la dictó, sin recalcularla por FUM ni ecografía."},
    {"key":"preparacion_y_verificacion","label":"Preparación y verificación previa","order":2,"required":false,"instruction":"Preparación descrita antes del nacimiento: equipo de reanimación verificado, personal presente y sus roles, temperatura de la sala si se mencionó. Solo lo que se dijo haber verificado."},
    {"key":"nacimiento_y_adaptacion","label":"Nacimiento y adaptación","order":3,"required":true,"instruction":"Hora de nacimiento si se enunció, llanto, tono y esfuerzo respiratorio al nacer, Apgar al minuto y a los cinco minutos transcrito literal (nunca lo deduzcas tú), y momento del pinzamiento del cordón si se dijo."},
    {"key":"maniobras_y_reanimacion","label":"Maniobras y reanimación","order":4,"required":false,"instruction":"Maniobras realizadas paso a paso tal como se relataron: estimulación, ventilación con presión positiva, oxígeno con la concentración dicha, intubación o masaje si ocurrieron y la respuesta del bebé. Si el médico dijo que no requirió reanimación, regístralo así."},
    {"key":"profilaxis_y_cuidados_inmediatos","label":"Profilaxis y cuidados inmediatos","order":5,"required":false,"instruction":"Vitamina K y profilaxis ocular con dosis transcrita literal si se enunciaron, contacto piel a piel, inicio de lactancia en la primera hora e identificación del recién nacido. Solo lo realizado y dicho; no marques profilaxis no mencionadas."},
    {"key":"antropometria_y_examen_inicial","label":"Antropometría y examen físico inicial","order":6,"required":true,"instruction":"Peso, talla y perímetro cefálico con los valores dictados y el examen inicial descrito: permeabilidad anal y de coanas si se verificó, malformaciones evidentes o su ausencia si se enunció, cordón, y clasificación del recién nacido solo si el médico la formuló."},
    {"key":"conducta_y_destino","label":"Conducta y destino","order":7,"required":true,"instruction":"Destino del recién nacido tal como se indicó: alojamiento conjunto, observación o traslado a la unidad neonatal con el motivo enunciado. Incluye las órdenes dadas. No agregues conductas no dichas."},
    {"key":"indicaciones_y_seguimiento","label":"Indicaciones y seguimiento","order":8,"required":false,"instruction":"Indicaciones a los padres y al servicio: lactancia, vigilancia de signos de alarma, tamizajes pendientes y cuándo será la siguiente valoración, únicamente según lo mencionado en la atención."}
  ]'::jsonb,
  updated_at = now()
where id = '81ef3923-f30c-5322-8a55-38528b1f7856' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c2000000-0000-4000-8000-000000000002', null,
   'Control del prematuro y recién nacido de riesgo · seguimiento tras el alta',
   'Seguimiento ambulatorio del prematuro o del recién nacido de riesgo egresado de la unidad neonatal: edad corregida, crecimiento con curvas del prematuro, neurodesarrollo, tamizajes (ROP, auditivo), vacunación e inmunoprofilaxis. Para el recién nacido a término sano use el control neonatal estándar.',
   'neonatologia', 'Neonatología', 'institutional', false, 'active',
   '[
    {"key":"antecedente_neonatal_y_edades","label":"Antecedente neonatal y edades","order":1,"required":false,"instruction":"Resumen del antecedente tal como se enunció: edad gestacional y peso al nacer dictados, diagnósticos del egreso y días de hospitalización si se dijeron. Registra la edad cronológica y la edad corregida únicamente como las enunció el médico: nunca las calcules tú."},
    {"key":"motivo_del_control","label":"Motivo del control","order":2,"required":true,"instruction":"Motivo de esta cita de seguimiento y diagnósticos activos tal como los nombró el médico (displasia broncopulmonar, riesgo de retinopatía, entre otros). No agregues diagnósticos no mencionados."},
    {"key":"evolucion_desde_el_egreso","label":"Evolución desde el egreso o el último control","order":3,"required":false,"instruction":"Evolución relatada por los padres: episodios respiratorios, apneas, tolerancia a la alimentación, reingresos o visitas a urgencias, oxígeno domiciliario si lo usa. Solo lo relatado en la consulta."},
    {"key":"alimentacion_y_suplementos","label":"Alimentación y suplementos","order":4,"required":false,"instruction":"Lactancia, fórmula o fortificador con las cantidades dichas, y suplementos (hierro, vitamina D u otros) con dosis transcrita literal: nunca la recalcules ni completes la que falte. Tolerancia y dificultades referidas por los padres."},
    {"key":"crecimiento_con_curvas","label":"Crecimiento con curvas del prematuro","order":5,"required":false,"instruction":"Peso, talla y perímetro cefálico de hoy con los valores dictados, y los percentiles o puntuaciones Z (Fenton, Intergrowth u OMS) únicamente si el médico los enunció con la curva usada: nunca los calcules ni los estimes tú."},
    {"key":"neurodesarrollo","label":"Neurodesarrollo según edad corregida","order":6,"required":false,"instruction":"Hitos del desarrollo valorados según la edad corregida tal como los describió el médico: alcanzados o rezagados, tono y postura, y resultados de escalas solo si se aplicaron y se enunciaron. No evalúes hitos por tu cuenta."},
    {"key":"tamizajes_del_prematuro","label":"Tamizajes y controles del prematuro","order":7,"required":false,"instruction":"Estado de los tamizajes mencionados: retinopatía del prematuro (ROP) con el hallazgo dictado, tamizaje auditivo, ecografía cerebral y laboratorios con resultados transcritos literal. Si un tamizaje no se mencionó, no lo des por hecho ni por pendiente."},
    {"key":"vacunacion_e_inmunoprofilaxis","label":"Vacunación e inmunoprofilaxis","order":8,"required":false,"instruction":"Esquema PAI según la edad cronológica revisado en el carné de vacunación: al día o pendiente, vacunas aplicadas hoy y palivizumab u otra inmunoprofilaxis solo si el médico la mencionó. Si el carné no se revisó, escríbelo."},
    {"key":"examen_fisico","label":"Examen físico","order":9,"required":true,"instruction":"Examen del lactante de riesgo tal como se describió: estado general, patrón respiratorio y saturación si se enunció, fontanelas, cardiopulmonar, abdomen, caderas, tono y postura. No completes sistemas no examinados."},
    {"key":"analisis_y_evolucion","label":"Análisis y evolución","order":10,"required":true,"instruction":"Concepto del médico sobre crecimiento, neurodesarrollo y evolución de cada diagnóstico, con las clasificaciones que él enunció. Deja explícito lo que consideró en riesgo o pendiente. No emitas juicios que no se dijeron."},
    {"key":"plan_educacion_y_proximo_control","label":"Plan, educación y próximo control","order":11,"required":true,"instruction":"Conducta: ajustes de alimentación y medicamentos con dosis literal, interconsultas y remisiones, educación a los padres, trámites con la EPS si se mencionaron, próximo control y signos de alarma explicados. Solo lo indicado hoy."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

-- ============================================================================
-- ginecologia_obstetricia
-- ============================================================================

update public.clinical_templates set
  name = 'Consulta inicial · valoración ginecológica',
  description = 'Primera consulta ginecológica por síntomas, tamizaje o planificación: antecedentes ginecoobstétricos, salud sexual y reproductiva, examen ginecológico y plan. Para el seguimiento de una paciente ya valorada o para la gestante, use el control o el control prenatal.',
  sections = '[
    {"key":"motivo_de_consulta","label":"Motivo de consulta","order":1,"required":true,"instruction":"Motivo de la consulta en las palabras de la paciente (síntoma, tamizaje, planificación familiar, deseo de fertilidad). No lo traduzcas a un diagnóstico ni agregues motivos no expresados."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":2,"required":false,"instruction":"Cronología del cuadro: inicio y evolución, dolor pélvico y su relación con el ciclo, patrón de sangrado con cantidad y duración como se relataron, flujo y sus características, síntomas urinarios o digestivos asociados y manejos previos con su respuesta. Solo lo mencionado."},
    {"key":"antecedentes_ginecoobstetricos","label":"Antecedentes ginecoobstétricos","order":3,"required":false,"instruction":"Fórmula obstétrica G-P-A tal como se dictó, sin recalcularla. Menarquia, ciclos, FUM solo si se enunció, método de planificación actual, última citología con fecha y resultado dichos, cirugías ginecológicas y menopausia si aplica. Si un dato no se preguntó, indícalo."},
    {"key":"antecedentes_personales_y_familiares","label":"Antecedentes personales y familiares","order":4,"required":false,"instruction":"Antecedentes médicos, quirúrgicos, alérgicos y medicación actual, y familiares relevantes mencionados (cáncer de mama, ovario o cérvix, trombosis). Solo lo referido en la consulta."},
    {"key":"salud_sexual_y_reproductiva","label":"Salud sexual y reproductiva","order":5,"required":false,"instruction":"Aspectos de salud sexual que la paciente y el médico conversaron: actividad sexual, dispareunia, deseo de fertilidad o de anticoncepción, tamizaje de ITS. Redáctalo con respeto y registra únicamente lo que se habló de forma explícita."},
    {"key":"examen_ginecologico","label":"Examen ginecológico","order":6,"required":true,"instruction":"Hallazgos tal como los describió el médico: abdomen, especuloscopia (cérvix, flujo, sangrado), tacto bimanual (útero y anexos), y examen de mamas si se realizó. Aclara qué se examinó; no completes hallazgos no descritos."},
    {"key":"analisis_e_impresion_diagnostica","label":"Análisis e impresión diagnóstica","order":7,"required":true,"instruction":"Razonamiento y diagnósticos con la precisión con que el médico los formuló, incluidos los diferenciales que consideró. No agregues clasificaciones ni estadios que no se enunciaron."},
    {"key":"plan_y_paraclinicos","label":"Plan y paraclínicos","order":8,"required":true,"instruction":"Conducta indicada: citología o pruebas de tamizaje, ecografía y laboratorios solicitados, medicamentos o método de planificación con dosis y pauta transcritas literal, remisiones y trámites con la EPS si se mencionaron."},
    {"key":"proximo_control_y_signos_de_alarma","label":"Próximo control y signos de alarma","order":9,"required":false,"instruction":"Cuándo volver a control o por resultados, y los signos de alarma explicados (sangrado abundante, dolor intenso, fiebre). Solo los mencionados en esta consulta."}
  ]'::jsonb,
  updated_at = now()
where id = '50deb254-2444-5388-8d9e-1f812a86380e' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · evolución ginecológica y resultados',
  description = 'Seguimiento ginecológico de una paciente ya valorada: revisión de resultados (citología, biopsia, ecografía), evolución de los síntomas, tolerancia al tratamiento hormonal o anticonceptivo y ajuste del plan. Para la gestante use el control prenatal.',
  sections = '[
    {"key":"diagnostico_y_motivo_del_control","label":"Diagnóstico y motivo del control","order":1,"required":true,"instruction":"Diagnóstico o situación en seguimiento tal como la nombró el médico (miomatosis, hallazgo en citología, planificación, terapia hormonal) y motivo de esta cita. No agregues diagnósticos no mencionados."},
    {"key":"evolucion_desde_el_ultimo_control","label":"Evolución desde el último control","order":2,"required":false,"instruction":"Evolución de los síntomas desde la última cita según la paciente: patrón de sangrado, dolor, flujo, síntomas climatéricos u otros relatados. Si no hubo cambios o un síntoma no se abordó, indícalo."},
    {"key":"adherencia_y_tolerancia","label":"Adherencia y tolerancia al tratamiento","order":3,"required":false,"instruction":"Uso del anticonceptivo o tratamiento hormonal según lo relatado: adherencia, efectos adversos (sangrado irregular, cefalea u otros referidos) y dificultades con la EPS para conseguirlo. No asumas adherencia que no se comentó."},
    {"key":"resultados_nuevos","label":"Resultados nuevos","order":4,"required":false,"instruction":"Citología, biopsia, ecografía o laboratorios revisados hoy: transcríbelos literal con fecha y hallazgo tal como los leyó el médico; nunca los interpretes ni completes por tu cuenta. Si no se revisaron resultados, escríbelo."},
    {"key":"examen_dirigido","label":"Examen ginecológico dirigido","order":5,"required":true,"instruction":"Examen dirigido al problema en seguimiento con los hallazgos tal como se describieron (especuloscopia, tacto bimanual, mamas si se examinaron). Aclara qué se exploró; no completes lo no examinado."},
    {"key":"analisis_y_evolucion","label":"Análisis y evolución","order":6,"required":true,"instruction":"Concepto del médico sobre la evolución y el estado del diagnóstico tal como lo formuló (resolución, persistencia, progresión). Usa solo las clasificaciones que él enunció."},
    {"key":"ajuste_del_plan","label":"Ajuste del plan","order":7,"required":true,"instruction":"Cambios al tratamiento con dosis y pauta transcritas literal, nuevos estudios o tamizajes solicitados, remisiones (por ejemplo a colposcopia u oncología, solo si se indicaron) y recomendaciones dadas a la paciente."},
    {"key":"proximo_control_y_signos_de_alarma","label":"Próximo control y signos de alarma","order":8,"required":false,"instruction":"Cuándo vuelve a control o por resultados, y los signos de alarma explicados en esta cita. Solo los mencionados; no repitas listas genéricas."}
  ]'::jsonb,
  updated_at = now()
where id = '824f8bdd-cd7c-5797-8331-4fa75c67ada0' and owner_id is null;

update public.clinical_templates set
  name = 'Procedimiento ginecológico · técnica, hallazgos y cuidados',
  description = 'Nota de procedimientos ginecológicos ambulatorios: citología, colposcopia, biopsia de cérvix, inserción o retiro de DIU o implante, entre otros. Documenta indicación, consentimiento, técnica, hallazgos, tolerancia y cuidados posteriores.',
  sections = '[
    {"key":"indicacion_y_contexto","label":"Indicación y contexto","order":1,"required":true,"instruction":"Procedimiento realizado y su indicación tal como la enunció el médico, con el diagnóstico o hallazgo que lo motiva y la fórmula obstétrica G-P-A si se dictó. No agregues indicaciones no dichas."},
    {"key":"verificacion_y_consentimiento","label":"Verificación y consentimiento","order":2,"required":false,"instruction":"Consentimiento informado firmado y explicación de riesgos según se mencionó, verificación de alergias y de la posibilidad de embarazo únicamente si el médico dijo haberla descartado. Lo que no se verbalizó, indícalo como no consignado."},
    {"key":"preparacion_y_asepsia","label":"Preparación y asepsia","order":3,"required":false,"instruction":"Posición, asepsia y antisepsia, anestesia local con dosis transcrita literal si se usó, e instrumental relevante mencionado. Solo los pasos que se relataron en la consulta."},
    {"key":"tecnica_y_hallazgos","label":"Técnica y hallazgos","order":4,"required":true,"instruction":"Describe la técnica paso a paso tal como la relató el médico y los hallazgos: aspecto del cérvix, hallazgos colposcópicos con la terminología que él usó, sitio de la biopsia, tipo de dispositivo insertado o retirado. Solo lo descrito."},
    {"key":"muestras_y_conducta","label":"Muestras y conducta realizada","order":5,"required":true,"instruction":"Muestras tomadas y enviadas a patología o laboratorio con su rotulación si se mencionó, y lo realizado al final del procedimiento. Registra únicamente lo que el médico dijo haber hecho."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones inmediatas","order":6,"required":false,"instruction":"Tolerancia de la paciente, dolor referido, sangrado y complicaciones inmediatas si las hubo. Si el médico dijo que no hubo complicaciones, regístralo así; no lo asumas por tu cuenta."},
    {"key":"indicaciones_posteriores","label":"Indicaciones posteriores","order":7,"required":true,"instruction":"Cuidados explicados a la paciente: abstinencia o restricciones temporales, analgesia con dosis transcrita literal, signos de alarma (sangrado abundante, fiebre, dolor intenso) y qué hacer si aparecen. Solo lo indicado hoy."},
    {"key":"seguimiento_y_resultados","label":"Seguimiento y entrega de resultados","order":8,"required":false,"instruction":"Cuándo y cómo se entregarán los resultados de patología o citología, próxima cita y controles del dispositivo si aplican, según lo mencionado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = '32d0f259-8cdb-5427-9020-07b0481481d0' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c2000000-0000-4000-8000-000000000003', null,
   'Control prenatal · seguimiento obstétrico',
   'Cita de control del embarazo: edad gestacional tal como la enuncia el médico, síntomas y signos de alarma, examen obstétrico con altura uterina y fetocardia, paraclínicos del trimestre, vacunación materna y plan hasta la próxima cita. Para consultas ginecológicas no obstétricas use las demás plantillas.',
   'ginecologia_obstetricia', 'Ginecología y obstetricia', 'institutional', false, 'active',
   '[
    {"key":"datos_obstetricos_y_edad_gestacional","label":"Datos obstétricos y edad gestacional","order":1,"required":false,"instruction":"Fórmula obstétrica G-P-A tal como se dictó y edad gestacional TAL COMO la enunció el médico en esta consulta: nunca la recalcules a partir de la FUM ni de ecografías, ni la actualices por fechas. Incluye la FUM o la ecografía de referencia solo si se mencionaron."},
    {"key":"evolucion_del_embarazo","label":"Evolución del embarazo desde el último control","order":2,"required":true,"instruction":"Cómo ha seguido la gestante desde la última cita, en sus palabras: síntomas, tolerancia, sueño y percepción de movimientos fetales si ella o el médico los comentaron. Solo lo relatado."},
    {"key":"sintomas_y_signos_de_alarma","label":"Síntomas y signos de alarma interrogados","order":3,"required":false,"instruction":"Signos de alarma que el médico interrogó y sus respuestas: sangrado, salida de líquido, cefalea, alteraciones visuales, epigastralgia, edema, disminución de movimientos fetales, actividad uterina. Registra también los negativos explícitos; no agregues los no preguntados."},
    {"key":"examen_obstetrico","label":"Examen obstétrico","order":4,"required":true,"instruction":"Hallazgos con los valores dichos: presión arterial, peso, altura uterina, frecuencia cardiaca fetal, movimientos y presentación fetal si se evaluaron, edema. Transcribe las cifras literal, sin calcular ni estimar ninguna, y no completes lo no examinado."},
    {"key":"paraclinicos_del_trimestre","label":"Paraclínicos del trimestre","order":5,"required":false,"instruction":"Laboratorios y ecografías revisados en la cita: transcríbelos literal con el valor y la fecha que se dijeron (hemoclasificación, serologías, glucemia o prueba de tolerancia, urocultivo, ecografías). Nunca calcules, interpretes ni completes resultados; si no se revisaron, escríbelo."},
    {"key":"vacunacion_y_suplementos","label":"Vacunación materna y suplementos","order":6,"required":false,"instruction":"Vacunas maternas revisadas o aplicadas según se mencionó (tétanos o Tdap, influenza, otras) y suplementos con dosis transcrita literal (ácido fólico, hierro, calcio). Si la vacunación no se revisó, indícalo."},
    {"key":"clasificacion_del_riesgo","label":"Clasificación del riesgo obstétrico","order":7,"required":false,"instruction":"Clasificación del riesgo obstétrico únicamente si el médico la enunció en la consulta, con los factores que él nombró. Si indicó remisión a alto riesgo obstétrico u otra especialidad, regístrala. No clasifiques el riesgo por tu cuenta."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión","order":8,"required":true,"instruction":"Concepto del médico sobre la evolución del embarazo y los diagnósticos tal como los formuló. Usa solo los términos y clasificaciones que él enunció; no agregues impresiones propias."},
    {"key":"plan_y_educacion","label":"Plan y educación","order":9,"required":true,"instruction":"Conducta hasta la próxima cita: paraclínicos y ecografías solicitados, medicamentos y suplementos con dosis literal, curso de preparación para el parto, plan de parto y educación sobre los signos para acudir a urgencias, según lo indicado hoy."},
    {"key":"proxima_cita","label":"Próxima cita","order":10,"required":false,"instruction":"Fecha o plazo de la próxima cita de control prenatal y qué debe traer la paciente (resultados, carné materno), únicamente según lo mencionado en la consulta."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

-- ============================================================================
-- cirugia_pediatrica
-- ============================================================================

update public.clinical_templates set
  name = 'Consulta inicial · valoración quirúrgica del niño',
  description = 'Primera valoración del niño remitido por posible patología quirúrgica: hernias, fimosis, testículo no descendido, masas, entre otras. Cubre remisión, antecedentes, estudios de apoyo, examen quirúrgico y la decisión de cirugía o manejo expectante.',
  sections = '[
    {"key":"identificacion_y_acompanante","label":"Identificación y acompañante","order":1,"required":false,"instruction":"Edad exacta en años y meses (en lactantes, meses y días), quién acompaña al niño y quién da la información. No infieras la edad si no se dijo en la consulta."},
    {"key":"motivo_y_remision","label":"Motivo de consulta y remisión","order":2,"required":true,"instruction":"Motivo en las palabras del cuidador o del niño y quién remite (pediatra, medicina general, EPS) con el diagnóstico de remisión si se mencionó. No lo conviertas en un diagnóstico propio."},
    {"key":"enfermedad_actual","label":"Enfermedad actual","order":3,"required":false,"instruction":"Cronología del problema: cuándo se notó, cómo ha cambiado, dolor, episodios agudos relatados (por ejemplo aumento súbito de volumen o irreductibilidad, tal como los describieron) y manejos previos. Solo lo mencionado en la consulta."},
    {"key":"antecedentes_pediatricos_y_quirurgicos","label":"Antecedentes pediátricos y quirúrgicos","order":4,"required":false,"instruction":"Perinatales relevantes si se comentaron (prematuridad, hospitalizaciones), cirugías y anestesias previas con sus complicaciones si las hubo, alergias, medicación y estado del esquema PAI si se revisó. Si un antecedente no se exploró, indícalo."},
    {"key":"estudios_de_apoyo","label":"Estudios de apoyo","order":5,"required":false,"instruction":"Ecografías, imágenes o laboratorios que se revisaron: transcribe el hallazgo y la fecha tal como se dijeron, sin interpretarlos ni completarlos por tu cuenta. Si no se aportaron estudios, escríbelo."},
    {"key":"examen_fisico_quirurgico","label":"Examen físico quirúrgico","order":6,"required":true,"instruction":"Hallazgos tal como los describió el médico: región inguinal y escrotal (hernia reductible o no, testículos palpables y su posición), abdomen, masas con tamaño solo si lo enunció, piel y región a operar. Aclara qué se examinó; no completes hallazgos no descritos."},
    {"key":"analisis_e_impresion_diagnostica","label":"Análisis e impresión diagnóstica","order":7,"required":true,"instruction":"Razonamiento y diagnóstico quirúrgico con la precisión con que el médico lo formuló, incluidos los diferenciales que consideró y la lateralidad tal como la dictó. No agregues diagnósticos ni lateralidades no dichas."},
    {"key":"plan_quirurgico_y_preparacion","label":"Plan quirúrgico y preparación","order":8,"required":true,"instruction":"Decisión tomada: cirugía indicada con el procedimiento nombrado por el médico, manejo expectante u observación. Incluye valoración preanestésica, exámenes prequirúrgicos, consentimiento y trámites de autorización con la EPS si se mencionaron."},
    {"key":"educacion_y_proximo_paso","label":"Educación al cuidador y próximo paso","order":9,"required":false,"instruction":"Explicaciones dadas al cuidador sobre la condición y la cirugía, signos de alarma mientras espera (dolor agudo, vómito, cambios de coloración, irreductibilidad) y cuál es el siguiente paso. Solo lo explicado hoy."}
  ]'::jsonb,
  updated_at = now()
where id = 'a20d8531-ebf9-5402-928d-210ef1857264' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · patología quirúrgica en espera o manejo expectante',
  description = 'Seguimiento del niño con patología quirúrgica aún no operada: en espera de cirugía o de autorización, o en manejo expectante u observación. Vigila cambios del cuadro y mantiene la programación. Para la cita después de la cirugía use el control postoperatorio.',
  sections = '[
    {"key":"diagnostico_y_motivo_del_control","label":"Diagnóstico y motivo del control","order":1,"required":true,"instruction":"Diagnóstico quirúrgico en seguimiento tal como lo nombró el médico, con la lateralidad si se dictó, y motivo de la cita (espera de cirugía, autorización pendiente, observación). No agregues diagnósticos no mencionados."},
    {"key":"evolucion_del_cuadro","label":"Evolución del cuadro","order":2,"required":false,"instruction":"Cambios desde la última cita según el cuidador: dolor, tamaño o características de la lesión, episodios agudos relatados (irreductibilidad, cambios de color) y visitas a urgencias en el intervalo. Solo lo relatado."},
    {"key":"estado_del_tramite","label":"Estado del trámite y la programación","order":3,"required":false,"instruction":"Estado de la programación quirúrgica según se comentó: autorización de la EPS, valoración preanestésica, exámenes prequirúrgicos y fecha tentativa si se enunció. No inventes fechas ni estados de trámite."},
    {"key":"estudios_nuevos","label":"Estudios nuevos","order":4,"required":false,"instruction":"Imágenes o laboratorios nuevos revisados en la cita, transcritos literal con el hallazgo y la fecha tal como se dijeron, sin interpretarlos por tu cuenta. Si no hubo estudios nuevos, escríbelo."},
    {"key":"examen_fisico_de_control","label":"Examen físico de control","order":5,"required":true,"instruction":"Examen dirigido a la patología en seguimiento con los hallazgos tal como se describieron y su comparación con la valoración previa solo si el médico la hizo. No completes hallazgos no descritos."},
    {"key":"analisis_y_conducta","label":"Análisis y conducta","order":6,"required":true,"instruction":"Concepto del médico: el cuadro sigue igual, mejoró o cambió la indicación (por ejemplo pasar de observación a cirugía), tal como él lo formuló. No modifiques la indicación quirúrgica por tu cuenta."},
    {"key":"plan_y_programacion","label":"Plan y programación","order":7,"required":true,"instruction":"Conducta indicada: mantener observación o programar cirugía, exámenes o valoraciones pendientes, ayuno e instrucciones prequirúrgicas si se dieron, y gestiones con la EPS mencionadas en la cita."},
    {"key":"proximo_control_y_signos_de_alarma","label":"Próximo control y signos de alarma","order":8,"required":false,"instruction":"Cuándo vuelve a control y los signos de alarma reforzados al cuidador para consultar de urgencia mientras espera (dolor agudo, vómito, masa irreductible, fiebre). Solo los explicados hoy."}
  ]'::jsonb,
  updated_at = now()
where id = 'c94276f0-8dad-58b4-b3de-db80895e1ab1' and owner_id is null;

update public.clinical_templates set
  name = 'Procedimiento quirúrgico ambulatorio · nota operatoria pediátrica',
  description = 'Nota operatoria de procedimientos pediátricos ambulatorios o menores: herniorrafia, circuncisión, resección de lesiones, drenajes, entre otros. Documenta verificación, anestesia, técnica, hallazgos, tolerancia e indicaciones postoperatorias.',
  sections = '[
    {"key":"indicacion_y_diagnostico_preoperatorio","label":"Indicación y diagnóstico preoperatorio","order":1,"required":true,"instruction":"Procedimiento realizado y diagnóstico preoperatorio tal como los enunció el cirujano, con la lateralidad dictada y la edad exacta del niño en años y meses. No agregues indicaciones ni lateralidades no dichas."},
    {"key":"verificacion_consentimiento_y_ayuno","label":"Verificación, consentimiento y ayuno","order":2,"required":false,"instruction":"Lista de verificación de cirugía segura si se mencionó, consentimiento informado del acudiente y asentimiento del niño cuando aplique, confirmación de ayuno y del sitio quirúrgico. Lo que no se verbalizó, regístralo como no consignado."},
    {"key":"anestesia_y_equipo","label":"Anestesia y equipo participante","order":3,"required":false,"instruction":"Tipo de anestesia o sedación tal como se dijo, quién la administró y miembros del equipo mencionados. Medicamentos anestésicos con dosis transcrita literal: nunca la calcules por peso tú."},
    {"key":"tecnica_y_hallazgos_operatorios","label":"Técnica y hallazgos operatorios","order":4,"required":true,"instruction":"Describe la técnica paso a paso tal como la relató el cirujano (incisión, disección, material de sutura mencionado) y los hallazgos operatorios con sus características dictadas. Solo lo descrito; no completes pasos estándar no relatados."},
    {"key":"conducta_y_muestras","label":"Conducta realizada y muestras","order":5,"required":true,"instruction":"Lo realizado al final: procedimiento completado o modificado según lo dicho, pieza o muestra enviada a patología con su rotulación si se mencionó, sangrado estimado solo si el cirujano lo enunció."},
    {"key":"tolerancia_y_complicaciones_inmediatas","label":"Tolerancia y complicaciones inmediatas","order":6,"required":false,"instruction":"Tolerancia del niño al procedimiento y a la anestesia, complicaciones inmediatas y su manejo si ocurrieron. Si el cirujano dijo que no hubo complicaciones, regístralo así; no lo asumas por tu cuenta."},
    {"key":"indicaciones_postoperatorias","label":"Indicaciones postoperatorias","order":7,"required":true,"instruction":"Indicaciones al cuidador: analgesia con dosis transcrita literal (mg/kg, mL, frecuencia), nunca recalculada por ti; cuidados de la herida, baño, alimentación y reposo, excusa escolar si se expidió. Solo lo indicado hoy."},
    {"key":"seguimiento_y_signos_de_alarma","label":"Seguimiento y signos de alarma","order":8,"required":false,"instruction":"Cita de control postoperatorio con el plazo mencionado y los signos de alarma explicados (fiebre, sangrado, secreción, dolor que no cede con la analgesia). Solo los explicados hoy."}
  ]'::jsonb,
  updated_at = now()
where id = 'c9423ab9-aafe-50d2-b6e8-e2cf189d2a58' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c2000000-0000-4000-8000-000000000004', null,
   'Control postoperatorio · recuperación del niño operado',
   'Cita de control después de la cirugía pediátrica: evolución del dolor y la alimentación, revisión de la herida, retiro de puntos, resultado de patología si existe y reintegro a las actividades y al colegio. Para el niño aún no operado use el control de patología en espera.',
   'cirugia_pediatrica', 'Cirugía pediátrica', 'institutional', false, 'active',
   '[
    {"key":"cirugia_realizada_y_contexto","label":"Cirugía realizada y contexto","order":1,"required":false,"instruction":"Procedimiento realizado y fecha tal como se enunciaron, y días de postoperatorio únicamente si el médico los dijo: no los calcules a partir de fechas. Edad del niño en años y meses y quién lo acompaña."},
    {"key":"motivo_del_control","label":"Motivo del control","order":2,"required":true,"instruction":"Motivo de la cita: control programado de la cirugía, revisión de la herida, retiro de puntos o un síntoma nuevo, en las palabras del cuidador o del niño. No agregues motivos no expresados."},
    {"key":"evolucion_postoperatoria","label":"Evolución postoperatoria","order":3,"required":false,"instruction":"Evolución relatada: dolor y su manejo en casa, fiebre si la hubo con las cifras dichas, tolerancia a la vía oral, deposiciones y micción, sueño y nivel de actividad del niño. Solo lo relatado; lo que no se preguntó, indícalo."},
    {"key":"analgesia_y_medicamentos","label":"Analgesia y medicamentos en casa","order":4,"required":false,"instruction":"Medicamentos que el niño recibe con la dosis tal como la refirió el cuidador o la indicó el médico: transcríbela literal, nunca la recalcules por peso ni completes la que falte. Anota si la analgesia fue suficiente según lo dicho."},
    {"key":"examen_de_herida_y_fisico","label":"Examen de la herida y físico dirigido","order":5,"required":true,"instruction":"Herida quirúrgica tal como la describió el médico: afrontada, eritema, secreción, hematoma, dehiscencia; retiro de puntos si se realizó hoy. Añade el examen dirigido a la región operada. No completes hallazgos no descritos."},
    {"key":"resultado_de_patologia","label":"Resultado de patología","order":6,"required":false,"instruction":"Resultado de la pieza quirúrgica solo si se comentó en la cita: transcríbelo literal tal como lo leyó el médico, sin interpretarlo. Si aún está pendiente o no se mencionó, escríbelo así."},
    {"key":"analisis_y_evolucion","label":"Análisis y evolución","order":7,"required":true,"instruction":"Concepto del médico sobre la recuperación (satisfactoria o con la complicación que él nombró) y el estado de la herida tal como lo formuló. No califiques la evolución por tu cuenta."},
    {"key":"plan_y_reintegro","label":"Plan y reintegro a actividades","order":8,"required":true,"instruction":"Conducta: cuidados de la herida, ajuste o suspensión de la analgesia con dosis literal, retorno al colegio o jardín y a la actividad física con los plazos que el médico enunció, excusa escolar o certificado si se expidió, y remisiones."},
    {"key":"proximo_control_y_signos_de_alarma","label":"Próximo control y signos de alarma","order":9,"required":false,"instruction":"Si requiere otro control, cuándo, y los signos de alarma reforzados al cuidador (fiebre, secreción o apertura de la herida, dolor en aumento, vómito). Solo los explicados en esta cita."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();
