-- Por qué: las plantillas del área de Odontología (área 8) salían de la fábrica genérica del
-- catálogo y no pedían nada de lo que define una nota odontológica: odontograma y nomenclatura
-- dental tal como se dictan, pruebas de vitalidad y percusión, profundidades de sondaje,
-- longitudes de trabajo, aparatología ortodóncica ni materiales protésicos. Este lote reescribe
-- las 3 plantillas de fábrica (inicial, control, procedimiento) de las 5 especialidades del área
-- y agrega una 4ª nueva por especialidad. Cada instruction dice qué documentar con la semiología
-- propia de la especialidad y prohíbe inventar: medidas, dosis y lecturas radiográficas siempre
-- transcritas literal, nunca calculadas por la IA.
--
-- odontologia_general: Consulta inicial · valoración odontológica y odontograma / Control y
--   seguimiento · evolución y control de placa / Procedimiento operatorio · restauraciones,
--   profilaxis y exodoncia simple / Urgencia odontológica · dolor agudo y trauma dental — la 4ª
--   viene fijada por el encargo: la urgencia es la puerta de entrada más frecuente y donde el
--   registro de pruebas, radiografía y antibiótico tiene mayor peso médico-legal.
-- endodoncia: Consulta inicial · diagnóstico pulpar y periapical / Control y seguimiento ·
--   evolución postratamiento y restauración definitiva / Procedimiento · tratamiento de conductos
--   por sesión / Retratamiento de conductos · evaluación del fracaso endodóntico — elegí el
--   retratamiento como 4ª porque el fracaso endodóntico exige dejar literal la causa, la
--   desobturación y la nueva conductometría, y no lo cubre ninguna de las otras 3.
-- periodoncia: Consulta inicial · valoración periodontal y periodontograma / Control y
--   seguimiento · reevaluación periodontal / Procedimiento · raspaje y alisado radicular /
--   Mantenimiento periodontal · fase de soporte — elegí el mantenimiento como 4ª porque es la
--   cita más repetida del paciente ya tratado y su sondaje de vigilancia sostiene el resultado.
-- ortodoncia: Consulta inicial · diagnóstico ortodóncico y plan de aparatología / Control y
--   seguimiento · avance del tratamiento ortodóncico / Procedimiento · instalación de
--   aparatología ortodóncica / Control de aparatología · activación y ajustes del mes — elegí la
--   activación mensual como 4ª porque es la cita más frecuente de toda la especialidad y debe
--   quedar exactamente qué se le hizo a la aparatología en cada visita.
-- rehabilitacion_oral: Consulta inicial · valoración protésica y plan de rehabilitación /
--   Control y seguimiento · adaptación protésica y función / Procedimiento · preparación de
--   pilares y toma de impresiones / Entrega y ajuste de prótesis · asentamiento, oclusión y
--   cuidados — elegí la entrega como 4ª porque concentra la conformidad del paciente, los
--   ajustes finales y los compromisos sobre el trabajo entregado: máximo valor documental.

-- ============================================================================
-- ODONTOLOGÍA GENERAL
-- ============================================================================

update public.clinical_templates set
  name = 'Consulta inicial · valoración odontológica y odontograma',
  description = 'Primera consulta de odontología general: motivo, antecedentes médicos y odontológicos, hábitos de higiene, examen estomatológico, odontograma tal como lo dicta el odontólogo y plan de tratamiento por fases.',
  sections = '[
    {"key":"motivo_de_consulta","label":"Motivo de consulta","order":1,"required":true,"instruction":"Documenta el motivo en las palabras del paciente (dolor, sangrado, estética, revisión). Si señaló un diente o zona, regístralo con la nomenclatura exacta que dictó el odontólogo, sin convertirla a otro sistema. Solo lo dicho en la consulta."},
    {"key":"antecedentes_medicos_y_farmacologicos","label":"Antecedentes médicos y farmacológicos","order":2,"required":false,"instruction":"Registra los antecedentes relevantes para la atención odontológica: diabetes, hipertensión, anticoagulantes o antiagregantes, alergias a anestésicos o látex, necesidad de profilaxis antibiótica y medicación actual, tal como se interrogaron. Si algo no se preguntó, indícalo; no completes con datos típicos."},
    {"key":"antecedentes_odontologicos","label":"Antecedentes odontológicos","order":3,"required":false,"instruction":"Tratamientos previos (exodoncias, endodoncias, prótesis, ortodoncia), experiencias con anestesia, última visita al odontólogo y urgencias anteriores, solo si se hablaron. Si no se trató el tema, dilo."},
    {"key":"habitos_e_higiene_oral","label":"Hábitos e higiene oral","order":4,"required":false,"instruction":"Frecuencia de cepillado, uso de seda dental y enjuague, hábitos relatados (bruxismo, tabaquismo, onicofagia, consumo frecuente de azúcares). No asumas hábitos que el paciente no mencionó."},
    {"key":"examen_estomatologico","label":"Examen estomatológico","order":5,"required":true,"instruction":"Examen de tejidos blandos tal como se dictó: mucosa, lengua, piso de boca, paladar, encía y ATM, además del estado general de higiene y cálculo si se enunció. No describas como sano lo que no se examinó en voz alta."},
    {"key":"odontograma_y_hallazgos_dentales","label":"Odontograma y hallazgos dentales","order":6,"required":true,"instruction":"Transcribe el odontograma tal como lo dictó el odontólogo: cada diente con su nomenclatura exacta (sin convertirla a otro sistema), superficies afectadas, caries, restauraciones existentes, ausencias y movilidad. Nunca agregues dientes ni hallazgos no dictados; si un diente no se mencionó, no lo describas."},
    {"key":"ayudas_diagnosticas","label":"Ayudas diagnósticas","order":7,"required":false,"instruction":"Radiografías (periapical, panorámica, coronales) u otras ayudas tomadas o revisadas: transcribe el hallazgo literal como lo leyó el odontólogo, nunca lo interpretes ni lo amplíes tú. Si no se tomaron imágenes, indícalo."},
    {"key":"analisis_e_impresion_diagnostica","label":"Análisis e impresión diagnóstica","order":8,"required":true,"instruction":"Diagnósticos odontológicos con la precisión con que el odontólogo los formuló, diente por diente cuando así los dictó. No agregues diagnósticos por deducción ni clasificaciones que no se enunciaron."},
    {"key":"plan_de_tratamiento_por_fases","label":"Plan de tratamiento por fases","order":9,"required":true,"instruction":"Plan por fases tal como se propuso (urgencia, higiénica, operatoria, rehabilitación) con los dientes asignados a cada procedimiento según se dictaron. Incluye remisiones a especialidades odontológicas y el orden acordado con el paciente. Solo lo planteado en la consulta."},
    {"key":"educacion_y_proximo_control","label":"Educación y próximo control","order":10,"required":false,"instruction":"Instrucciones de higiene dadas, recomendaciones de dieta, cuándo volver y los motivos para consultar antes, solo si se explicaron al paciente."}
  ]'::jsonb,
  updated_at = now()
where id = 'fca06d0b-b3c7-5f81-aea5-956c18626f1b' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · evolución y control de placa',
  description = 'Cita de control de odontología general: evolución de síntomas y tratamientos en curso, adherencia a la higiene, estado de restauraciones recientes, control de placa y continuación del plan.',
  sections = '[
    {"key":"motivo_del_control","label":"Motivo del control","order":1,"required":true,"instruction":"Indica a qué viene el control (revisión de tratamiento en curso, evaluación de un síntoma, continuación del plan) y el tiempo desde la última cita si se mencionó. Solo lo dicho en la consulta."},
    {"key":"evolucion_desde_la_ultima_cita","label":"Evolución desde la última cita","order":2,"required":false,"instruction":"Cambios relatados por el paciente: dolor, sensibilidad, sangrado, molestias con restauraciones recientes y respuesta a las indicaciones previas. Si refirió estar asintomático, regístralo así; no añadas síntomas no mencionados."},
    {"key":"adherencia_e_higiene_oral","label":"Adherencia e higiene oral","order":3,"required":false,"instruction":"Cumplimiento de las instrucciones de higiene y hábitos corregidos o persistentes tal como se comentaron. Si la adherencia no se evaluó en la cita, indícalo."},
    {"key":"examen_clinico_de_control","label":"Examen clínico de control","order":4,"required":true,"instruction":"Hallazgos del examen de hoy: estado de las restauraciones o tratamientos realizados, encía, placa y cálculo, con los dientes revisados en la nomenclatura exacta que dictó el odontólogo. No repitas hallazgos de citas previas como si fueran de hoy."},
    {"key":"control_de_placa","label":"Control de placa","order":5,"required":false,"instruction":"Índice de placa o valoración del control de placa solo con las cifras o categorías que el odontólogo enunció; nunca las calcules tú. Anota las zonas de acúmulo señaladas."},
    {"key":"analisis_y_evolucion","label":"Análisis y evolución","order":6,"required":true,"instruction":"Concepto del odontólogo sobre la evolución (favorable o no), los hallazgos nuevos y su relación con el plan en curso, con la precisión con que lo formuló. Sin conclusiones propias."},
    {"key":"ajuste_del_plan","label":"Ajuste del plan","order":7,"required":true,"instruction":"Procedimientos realizados hoy y modificaciones al plan de tratamiento (dientes, fases, remisiones) tal como se decidieron. Medicamentos o enjuagues indicados: transcribe nombre, dosis y duración literal, sin completar lo que falte."},
    {"key":"proximo_control","label":"Próximo control","order":8,"required":false,"instruction":"Fecha o intervalo del próximo control, procedimiento programado para esa cita y los signos por los que debe consultar antes, según se explicó al paciente."}
  ]'::jsonb,
  updated_at = now()
where id = 'd3ee19ab-0934-553c-8804-ab2441553036' and owner_id is null;

update public.clinical_templates set
  name = 'Procedimiento operatorio · restauraciones, profilaxis y exodoncia simple',
  description = 'Nota de procedimiento en odontología general (operatoria dental, profilaxis, sellantes, exodoncia simple): diente y superficies tratados, anestesia, técnica, materiales, tolerancia e indicaciones postoperatorias.',
  sections = '[
    {"key":"indicacion_del_procedimiento","label":"Indicación del procedimiento","order":1,"required":true,"instruction":"Procedimiento realizado hoy y su indicación, con el diente y las superficies en la nomenclatura exacta que dictó el odontólogo, sin convertirla ni deducir dientes adicionales."},
    {"key":"verificacion_y_consentimiento","label":"Verificación y consentimiento","order":2,"required":false,"instruction":"Consentimiento informado explicado y aceptado, verificación de antecedentes (alergias, anticoagulantes, profilaxis antibiótica) y signos vitales si se tomaron. Si algo no se verificó en voz alta, no lo des por hecho; indícalo."},
    {"key":"anestesia","label":"Anestesia","order":3,"required":false,"instruction":"Técnica anestésica, anestésico usado y cantidad de cárpulas tal como se dictaron: transcríbelos literal, nunca los estimes. Si el procedimiento se hizo sin anestesia, indícalo."},
    {"key":"tecnica_y_desarrollo","label":"Técnica y desarrollo","order":4,"required":true,"instruction":"Describe el procedimiento como lo narró el odontólogo: aislamiento (dique o rollos de algodón), remoción de caries, grabado y adhesivo, instrumentación o técnica de exodoncia, en su orden. Solo los pasos mencionados; no completes protocolos."},
    {"key":"materiales_utilizados","label":"Materiales utilizados","order":5,"required":false,"instruction":"Materiales con el nombre y la presentación tal como se nombraron (resina y su color, ionómero de vidrio, sellante, sutura). No agregues marcas ni especificaciones que no se dijeron."},
    {"key":"hallazgos_intraoperatorios","label":"Hallazgos intraoperatorios","order":6,"required":true,"instruction":"Hallazgos durante el procedimiento (profundidad de la caries, cercanía o compromiso pulpar, fractura radicular) y las decisiones que se tomaron por ellos, tal como se dictaron. Si el odontólogo dijo que no hubo hallazgos adicionales, regístralo con sus palabras."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones","order":7,"required":false,"instruction":"Tolerancia del paciente, sangrado, verificación de la oclusión y complicaciones inmediatas solo si se mencionaron. Registra la ausencia de complicaciones únicamente si el odontólogo la enunció."},
    {"key":"indicaciones_postoperatorias_y_control","label":"Indicaciones postoperatorias y control","order":8,"required":true,"instruction":"Indicaciones postoperatorias dadas (cuidados de la zona, dieta, higiene), medicamentos con dosis transcrita literal sin completarla, incapacidad si se expidió y cita de control. Solo lo indicado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = 'f8e342ed-b858-56d8-868e-7e159b884f7b' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c8000000-0000-4000-8000-000000000001', null,
   'Urgencia odontológica · dolor agudo y trauma dental',
   'Atención de urgencia por dolor dental agudo, absceso o trauma dentoalveolar: diente señalado, pruebas de vitalidad y percusión, hallazgo radiográfico literal, procedimiento de urgencia, analgesia o antibiótico indicados y remisión a la especialidad.',
   'odontologia_general', 'Odontología general', 'institutional', false, 'active',
   '[
     {"key":"motivo_de_urgencia","label":"Motivo de urgencia","order":1,"required":true,"instruction":"Motivo en palabras del paciente: dolor (inicio, intensidad, qué lo desencadena y qué lo alivia), inflamación o trauma. Registra la hora y el mecanismo del trauma solo si se relataron; no los deduzcas."},
     {"key":"diente_o_zona_afectada","label":"Diente o zona afectada","order":2,"required":true,"instruction":"Diente o cuadrante señalado, con la nomenclatura tal como la dictó el odontólogo, sin convertirla a otro sistema ni suponer dientes vecinos. Describe el estado clínico dictado: caries, fractura y el tejido comprometido si se enunció, luxación, avulsión o inflamación."},
     {"key":"examen_clinico_de_urgencia","label":"Examen clínico de urgencia","order":3,"required":false,"instruction":"Hallazgos del examen: tejidos blandos, edema, fístula, movilidad y oclusión, tal como se describieron. No completes regiones que no se examinaron en voz alta."},
     {"key":"pruebas_de_vitalidad_y_percusion","label":"Pruebas de vitalidad y percusión","order":4,"required":false,"instruction":"Pruebas realizadas (frío, calor, eléctrica, percusión vertical u horizontal, palpación) con la respuesta de cada una tal como la dictó el odontólogo. No registres pruebas que no se hicieron; si alguna no se pudo realizar y así se dijo, regístralo."},
     {"key":"hallazgo_radiografico","label":"Hallazgo radiográfico","order":5,"required":false,"instruction":"Transcribe el hallazgo radiográfico literal como lo leyó el odontólogo (radiolucidez periapical, fractura radicular, ensanchamiento del ligamento). Nunca interpretes la imagen tú ni agregues hallazgos no dictados; si no se tomó radiografía, indícalo."},
     {"key":"diagnostico_de_urgencia","label":"Diagnóstico de urgencia","order":6,"required":true,"instruction":"Diagnóstico con la precisión con que el odontólogo lo formuló (pulpitis, absceso, fractura, luxación, avulsión). No añadas clasificaciones ni severidades que no se enunciaron."},
     {"key":"procedimiento_de_urgencia_realizado","label":"Procedimiento de urgencia realizado","order":7,"required":true,"instruction":"Qué se hizo hoy para resolver la urgencia (apertura y drenaje, eliminación de caries y material sedante, ferulización, reimplante, exodoncia, ajuste oclusal) con la anestesia empleada tal como se dictó. Solo lo realizado en esta cita."},
     {"key":"analgesia_y_antibiotico","label":"Analgesia y antibiótico","order":8,"required":false,"instruction":"Medicamentos indicados con nombre, dosis, frecuencia y duración transcritos literal; nunca completes ni corrijas una dosis. Si el odontólogo dijo que decidió no formular antibiótico, regístralo con sus palabras."},
     {"key":"remision_y_plan","label":"Remisión y plan","order":9,"required":true,"instruction":"Remisión a la especialidad odontológica indicada (endodoncia, cirugía oral, periodoncia) con el motivo dictado, y el plan para el tratamiento definitivo. Incluye incapacidad o certificado solo si se expidió. Solo lo decidido en la consulta."},
     {"key":"control_y_signos_de_alarma","label":"Control y signos de alarma","order":10,"required":false,"instruction":"Cuándo debe volver, cuidados en casa y signos de alarma explicados (fiebre, aumento del edema, dificultad para tragar, dolor que no cede). Solo lo advertido al paciente."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

-- ============================================================================
-- ENDODONCIA
-- ============================================================================

update public.clinical_templates set
  name = 'Consulta inicial · diagnóstico pulpar y periapical',
  description = 'Primera valoración endodóntica del diente remitido o sintomático: caracterización del dolor, pruebas de vitalidad y percusión con sus respuestas, hallazgo radiográfico literal y diagnóstico pulpar y periapical.',
  sections = '[
    {"key":"motivo_y_remision","label":"Motivo y remisión","order":1,"required":true,"instruction":"Motivo en palabras del paciente y, si viene remitido, quién remite y por qué, con el diente en la nomenclatura exacta que se dictó, sin convertirla a otro sistema. Solo lo dicho en la consulta."},
    {"key":"historia_del_dolor","label":"Historia del dolor","order":2,"required":false,"instruction":"Caracteriza el dolor tal como lo relató el paciente: inicio, espontáneo o provocado, con qué estímulo (frío, calor, masticación), duración tras el estímulo, si lo despierta en la noche y respuesta a analgésicos. No clasifiques el dolor más allá de lo dictado."},
    {"key":"antecedentes_del_diente","label":"Antecedentes del diente","order":3,"required":false,"instruction":"Historia del diente: restauraciones previas, caries profunda, trauma, tratamientos endodónticos anteriores, tal como se relataron. Antecedentes médicos relevantes (alergias, anticoagulantes) si se interrogaron; si no se habló de ellos, indícalo."},
    {"key":"examen_clinico","label":"Examen clínico","order":4,"required":true,"instruction":"Examen del diente y tejidos vecinos: caries, restauración presente y su estado, fístula, edema, movilidad, dolor a la palpación apical, tal como se describieron. No registres hallazgos de dientes que no se examinaron en voz alta."},
    {"key":"pruebas_de_vitalidad_y_percusion","label":"Pruebas de vitalidad y percusión","order":5,"required":false,"instruction":"Cada prueba realizada (frío, calor, prueba eléctrica, percusión, palpación) con su respuesta literal como la dictó el endodoncista, incluidos los dientes control si los mencionó. No registres pruebas que no se hicieron ni inventes respuestas."},
    {"key":"hallazgo_radiografico","label":"Hallazgo radiográfico","order":6,"required":false,"instruction":"Transcribe literal la lectura radiográfica del endodoncista: radiolucidez periapical y su tamaño solo si lo dictó, tratamientos previos, conductos visibles, reabsorciones o proximidad a estructuras. Nunca midas ni interpretes tú la imagen; si no se tomó radiografía, indícalo."},
    {"key":"diagnostico_pulpar_y_periapical","label":"Diagnóstico pulpar y periapical","order":7,"required":true,"instruction":"Diagnóstico pulpar y periapical con los términos exactos que enunció el endodoncista (pulpitis irreversible sintomática, necrosis pulpar, periodontitis apical, entre otros). No completes el diagnóstico periapical si solo se enunció el pulpar, ni al revés."},
    {"key":"pronostico_y_plan","label":"Pronóstico y plan","order":8,"required":true,"instruction":"Plan propuesto (tratamiento de conductos, retratamiento, cirugía apical, exodoncia) y pronóstico tal como se explicaron al paciente, con el número de sesiones previsto solo si se dijo. Incluye la aceptación del paciente y el consentimiento si se mencionaron. Solo lo planteado."},
    {"key":"indicaciones_y_proxima_cita","label":"Indicaciones y próxima cita","order":9,"required":false,"instruction":"Medicación previa al tratamiento con dosis transcrita literal sin completarla, cuidados mientras inicia el tratamiento y fecha o intervalo de la próxima cita, según se indicó al paciente."}
  ]'::jsonb,
  updated_at = now()
where id = '21b79587-1b2e-56ff-92af-01e6c2564c10' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · evolución postratamiento y restauración definitiva',
  description = 'Control después del tratamiento de conductos: dolor residual, estado del sellado provisional o de la restauración definitiva y evolución radiográfica del periápice dictada por el endodoncista.',
  sections = '[
    {"key":"motivo_del_control","label":"Motivo del control","order":1,"required":true,"instruction":"Diente en control con su nomenclatura tal como se dictó, tiempo transcurrido desde la obturación si se mencionó y objetivo de la cita. Solo lo dicho en la consulta."},
    {"key":"sintomas_actuales","label":"Síntomas actuales","order":2,"required":false,"instruction":"Dolor o molestias desde el tratamiento: espontáneo, a la masticación o a la percusión, tal como los relató el paciente. Si refirió estar asintomático, regístralo así; no añadas síntomas no mencionados."},
    {"key":"examen_del_diente_tratado","label":"Examen del diente tratado","order":3,"required":true,"instruction":"Estado clínico de hoy: sellado provisional (íntegro, filtrado, perdido) o restauración definitiva presente, fístula, edema, movilidad, dolor a percusión o palpación, según lo dictado. No repitas hallazgos de citas anteriores como si fueran actuales."},
    {"key":"control_radiografico","label":"Control radiográfico","order":4,"required":false,"instruction":"Transcribe literal la lectura de la radiografía de control: calidad y longitud de la obturación y evolución de la lesión periapical (igual, en reducción, cicatrizada) tal como la enunció el endodoncista. Nunca compares ni midas tú; si hoy no se tomó radiografía, indícalo."},
    {"key":"estado_de_la_restauracion_definitiva","label":"Estado de la restauración definitiva","order":5,"required":false,"instruction":"Si la restauración definitiva ya se realizó, quién la hizo y su estado; si está pendiente, lo que se decidió hoy para hacerla y la prioridad que el endodoncista le dio. Solo lo hablado en la cita."},
    {"key":"analisis_y_evolucion","label":"Análisis y evolución","order":6,"required":true,"instruction":"Concepto del endodoncista sobre la evolución (favorable, en observación, fracaso) con sus palabras. No emitas pronóstico propio ni califiques la evolución si él no lo hizo."},
    {"key":"plan","label":"Plan","order":7,"required":true,"instruction":"Conducta definida hoy: alta, nuevo control y su intervalo, remisión para restauración definitiva, retratamiento o cirugía apical, tal como se decidió. Medicamentos con dosis transcrita literal, sin completar la que falte."},
    {"key":"recomendaciones","label":"Recomendaciones","order":8,"required":false,"instruction":"Cuidados indicados (masticación sobre el diente, higiene) y signos por los que debe consultar antes del próximo control, solo según se explicaron al paciente."}
  ]'::jsonb,
  updated_at = now()
where id = '78e577cb-8eb1-53e1-9f9f-1f66602ae6af' and owner_id is null;

update public.clinical_templates set
  name = 'Procedimiento · tratamiento de conductos por sesión',
  description = 'Nota de la sesión de endodoncia: anestesia y aislamiento, acceso y conductos localizados, conductometría con longitudes de trabajo transcritas literal, instrumentación e irrigación, medicación intraconducto u obturación y sellado temporal.',
  sections = '[
    {"key":"diente_e_indicacion","label":"Diente e indicación","order":1,"required":true,"instruction":"Diente tratado con la nomenclatura exacta dictada y el diagnóstico que indica el tratamiento, tal como lo enunció el endodoncista. Indica si es primera sesión o continuación, según se dijo."},
    {"key":"verificacion_y_consentimiento","label":"Verificación y consentimiento","order":2,"required":false,"instruction":"Consentimiento informado y verificación de antecedentes (alergias, anticoagulantes, profilaxis antibiótica) solo si se mencionaron en voz alta; si no se habló de ello, indícalo."},
    {"key":"anestesia_y_aislamiento","label":"Anestesia y aislamiento","order":3,"required":false,"instruction":"Técnica anestésica, anestésico y número de cárpulas transcritos literal, nunca estimados. Registra el aislamiento absoluto con dique de goma si se mencionó y cualquier dificultad dictada para lograrlo."},
    {"key":"acceso_y_conductos","label":"Acceso y conductos","order":4,"required":false,"instruction":"Apertura y localización de conductos tal como se narró: cuántos y cuáles se encontraron, con los nombres que usó el endodoncista. No asumas la anatomía típica del diente; registra solo los conductos dictados."},
    {"key":"conductometria_y_longitudes_de_trabajo","label":"Conductometría y longitudes de trabajo","order":5,"required":true,"instruction":"Transcribe literal cada longitud de trabajo en milímetros con su referencia coronal y el método usado (localizador apical, radiografía), conducto por conducto, tal como se dictaron. Nunca calcules, redondees ni completes una longitud; si alguna no se dictó, indícalo."},
    {"key":"instrumentacion_e_irrigacion","label":"Instrumentación e irrigación","order":6,"required":false,"instruction":"Sistema y calibres de instrumentación y soluciones de irrigación con las concentraciones tal como se nombraron. No agregues concentraciones, calibres ni protocolos que no se dictaron."},
    {"key":"medicacion_u_obturacion","label":"Medicación intraconducto u obturación","order":7,"required":true,"instruction":"Lo realizado al cierre de la sesión: medicación intraconducto (cuál) o obturación (técnica, conos y cemento nombrados) y el sellado temporal colocado, tal como se dictó. Solo lo hecho hoy."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones","order":8,"required":false,"instruction":"Tolerancia del paciente y eventos de la sesión (instrumento fracturado, perforación, escalón) solo si el endodoncista los mencionó; si dijo que no hubo complicaciones, regístralo con sus palabras."},
    {"key":"indicaciones_y_proxima_sesion","label":"Indicaciones y próxima sesión","order":9,"required":true,"instruction":"Analgésicos o antibióticos con dosis transcrita literal sin completarla, cuidados entre sesiones, advertencias dadas y fecha o intervalo de la próxima sesión o del paso a la restauración definitiva."}
  ]'::jsonb,
  updated_at = now()
where id = '3dd1d9cc-8edb-5b30-b082-fb203120c5eb' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c8000000-0000-4000-8000-000000000002', null,
   'Retratamiento de conductos · evaluación del fracaso endodóntico',
   'Valoración y sesión de retratamiento no quirúrgico de un diente con endodoncia previa que fracasa: causa dictada del fracaso, desobturación, hallazgos del sistema de conductos y nueva conductometría transcrita literal.',
   'endodoncia', 'Endodoncia', 'institutional', false, 'active',
   '[
     {"key":"diente_y_motivo_del_retratamiento","label":"Diente y motivo del retratamiento","order":1,"required":true,"instruction":"Diente con tratamiento previo, en la nomenclatura exacta dictada, y el motivo del retratamiento en palabras del paciente o del remitente (dolor persistente, fístula, lesión que no cicatriza). Incluye cuándo se hizo la endodoncia previa solo si se mencionó."},
     {"key":"sintomas_y_examen","label":"Síntomas y examen clínico","order":2,"required":true,"instruction":"Síntomas actuales y examen de hoy: fístula, edema, dolor a percusión o palpación, estado de la restauración presente, tal como se dictaron. No completes lo que no se examinó en voz alta."},
     {"key":"hallazgo_radiografico_previo","label":"Hallazgo radiográfico","order":3,"required":false,"instruction":"Transcribe literal la lectura radiográfica: calidad y longitud de la obturación previa, conductos no tratados visibles, lesión periapical y su evolución, postes o instrumentos en los conductos, tal como la enunció el endodoncista. Nunca midas ni interpretes tú la imagen."},
     {"key":"causa_probable_del_fracaso","label":"Causa probable del fracaso","order":4,"required":false,"instruction":"Causa del fracaso solo con las palabras del endodoncista (filtración coronal, conducto no tratado, obturación corta, fractura). Si no la enunció, indícalo; no propongas causas por tu cuenta."},
     {"key":"plan_y_consentimiento","label":"Plan y consentimiento","order":5,"required":true,"instruction":"Plan acordado (retratamiento no quirúrgico, cirugía apical, exodoncia), pronóstico explicado y consentimiento del paciente, tal como se hablaron. Incluye las alternativas ofrecidas solo si se mencionaron."},
     {"key":"desobturacion_y_permeabilizacion","label":"Desobturación y permeabilización","order":6,"required":false,"instruction":"Desarrollo de la sesión: retiro de la restauración o del poste, técnica y solventes de desobturación, conductos permeabilizados o localizados de nuevo, tal como se narró. Solo lo hecho hoy; registra las dificultades que el endodoncista dictó."},
     {"key":"nueva_conductometria","label":"Nueva conductometría","order":7,"required":false,"instruction":"Nuevas longitudes de trabajo transcritas literal, conducto por conducto, con su referencia y el método tal como se dictaron. Nunca calcules longitudes ni reutilices las del tratamiento previo por tu cuenta; si alguna no se dictó, indícalo."},
     {"key":"medicacion_y_cierre","label":"Medicación y cierre de la sesión","order":8,"required":true,"instruction":"Medicación intraconducto u obturación realizada y el sellado temporal colocado, con los materiales tal como se nombraron. Solo lo realizado en esta sesión."},
     {"key":"indicaciones_y_seguimiento","label":"Indicaciones y seguimiento","order":9,"required":false,"instruction":"Medicamentos con dosis transcrita literal sin completarla, cuidados entre sesiones, próxima sesión y controles radiográficos previstos, tal como se indicaron al paciente."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

-- ============================================================================
-- PERIODONCIA
-- ============================================================================

update public.clinical_templates set
  name = 'Consulta inicial · valoración periodontal y periodontograma',
  description = 'Primera valoración de periodoncia: motivo, factores de riesgo (diabetes, tabaquismo), periodontograma con profundidades de sondaje y sangrado tal como se dictaron, pérdida ósea radiográfica literal y plan de fase higiénica.',
  sections = '[
    {"key":"motivo_de_consulta","label":"Motivo de consulta","order":1,"required":true,"instruction":"Motivo en palabras del paciente (sangrado al cepillarse, movilidad, mal aliento, encías retraídas) o la remisión y quién remite. Solo lo dicho en la consulta."},
    {"key":"antecedentes_y_factores_de_riesgo","label":"Antecedentes y factores de riesgo","order":2,"required":false,"instruction":"Factores que el periodoncista interrogó: diabetes y su control tal como se dijo, tabaquismo (cantidad y tiempo si se mencionaron), embarazo, medicamentos asociados a agrandamiento gingival, historia periodontal familiar. Si algo no se interrogó, indícalo; no lo completes."},
    {"key":"higiene_oral_y_habitos","label":"Higiene oral y hábitos","order":3,"required":false,"instruction":"Técnica y frecuencia de cepillado, uso de seda y cepillos interdentales, tal como los relató el paciente. No asumas hábitos que no se mencionaron."},
    {"key":"periodontograma","label":"Periodontograma","order":4,"required":true,"instruction":"Transcribe las mediciones tal como se dictaron: profundidades de sondaje por diente y sitio, sangrado al sondaje, nivel de inserción, recesiones, compromiso de furca y movilidad, con los dientes en la nomenclatura dictada. Nunca calcules promedios ni completes sitios no dictados; si el registro fue parcial, dilo."},
    {"key":"examen_de_tejidos_y_placa","label":"Examen de tejidos y placa","order":5,"required":false,"instruction":"Aspecto de la encía (color, edema, consistencia), cálculo supragingival y subgingival, e índice de placa o de sangrado solo con las cifras que el periodoncista enunció; nunca las calcules tú."},
    {"key":"hallazgo_radiografico","label":"Hallazgo radiográfico","order":6,"required":false,"instruction":"Transcribe literal la lectura radiográfica del periodoncista: patrón y grado de pérdida ósea, defectos verticales, cálculo visible, tal como los dictó. Nunca interpretes la imagen tú; si no se revisaron radiografías, indícalo."},
    {"key":"diagnostico_periodontal","label":"Diagnóstico periodontal","order":7,"required":true,"instruction":"Diagnóstico con los términos exactos del periodoncista, incluidos estadio y grado solo si él los enunció. No clasifiques ni asignes estadio o grado por deducción de las mediciones."},
    {"key":"plan_de_tratamiento","label":"Plan de tratamiento","order":8,"required":true,"instruction":"Plan por fases tal como se propuso: fase higiénica (raspaje y alisado por cuadrantes o sextantes), reevaluación, posible fase quirúrgica y mantenimiento, con las sesiones acordadas. Incluye interconsultas o remisiones (por ejemplo a medicina por control de la diabetes) solo si se indicaron."},
    {"key":"educacion_y_proxima_cita","label":"Educación y próxima cita","order":9,"required":false,"instruction":"Instrucciones de higiene demostradas o indicadas, recomendaciones sobre tabaquismo si se dieron y fecha o intervalo de la próxima sesión, según se acordó."}
  ]'::jsonb,
  updated_at = now()
where id = 'fc9ead78-007c-5c46-9d68-1961b2c7b0be' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · reevaluación periodontal',
  description = 'Reevaluación tras la fase higiénica o control posquirúrgico: re-sondaje con las cifras dictadas, sangrado, control de placa y decisión entre mantenimiento, repetir instrumentación o fase quirúrgica.',
  sections = '[
    {"key":"motivo_y_fase_del_tratamiento","label":"Motivo y fase del tratamiento","order":1,"required":true,"instruction":"Momento del tratamiento en que llega el paciente (reevaluación tras fase higiénica, control posquirúrgico) y tiempo desde la última sesión solo si se mencionó."},
    {"key":"sintomas_y_adherencia","label":"Síntomas y adherencia","order":2,"required":false,"instruction":"Cambios relatados por el paciente (menos sangrado, sensibilidad tras el raspaje) y cumplimiento de la higiene indicada, tal como se comentaron. Si la adherencia no se evaluó, dilo; no la califiques por tu cuenta."},
    {"key":"re_sondaje_y_mediciones","label":"Re-sondaje y mediciones","order":3,"required":true,"instruction":"Transcribe las mediciones de hoy tal como se dictaron: profundidades de sondaje residuales por diente y sitio, sangrado al sondaje, movilidad. Nunca compares con cifras previas por tu cuenta; registra la comparación solo si el periodoncista la enunció."},
    {"key":"control_de_placa_e_higiene","label":"Control de placa e higiene","order":4,"required":false,"instruction":"Índice de placa o de sangrado con las cifras que se enunciaron, nunca calculadas por ti, y las zonas de acúmulo señaladas. Valoración de la técnica de higiene solo si se comentó."},
    {"key":"sensibilidad_y_efectos_del_tratamiento","label":"Sensibilidad y efectos del tratamiento","order":5,"required":false,"instruction":"Sensibilidad dentinaria u otras molestias atribuidas a la instrumentación tal como las relató el paciente, y el manejo indicado. Solo lo mencionado en la consulta."},
    {"key":"analisis_y_respuesta_al_tratamiento","label":"Análisis y respuesta al tratamiento","order":6,"required":true,"instruction":"Concepto del periodoncista sobre la respuesta: sitios que respondieron, bolsas residuales que preocupan, con sus palabras. No concluyas éxito o fracaso por tu cuenta."},
    {"key":"conducta_y_ajuste_del_plan","label":"Conducta y ajuste del plan","order":7,"required":true,"instruction":"Decisión tomada hoy: paso a mantenimiento y su intervalo, repetir raspaje en sitios específicos (dientes tal como se dictaron) o remisión a fase quirúrgica, tal como se definió. Antimicrobianos o enjuagues con dosis y duración transcritas literal, sin completarlas."},
    {"key":"proxima_cita","label":"Próxima cita","order":8,"required":false,"instruction":"Fecha o intervalo de la próxima cita y lo que se hará en ella, según se acordó con el paciente."}
  ]'::jsonb,
  updated_at = now()
where id = 'f1bf6c87-8fe7-5bc2-8c98-8f4f3356cda0' and owner_id is null;

update public.clinical_templates set
  name = 'Procedimiento · raspaje y alisado radicular',
  description = 'Nota de sesión de raspaje y alisado radicular: cuadrantes o sextantes tratados, anestesia, instrumentación realizada, antimicrobianos locales, tolerancia e indicaciones posteriores.',
  sections = '[
    {"key":"indicacion_y_zona_tratada","label":"Indicación y zona tratada","order":1,"required":true,"instruction":"Cuadrantes, sextantes o dientes tratados hoy, con la nomenclatura exacta dictada, y la indicación (fase higiénica del plan, sitios residuales). No amplíes la zona tratada más allá de lo dicho."},
    {"key":"verificacion_y_consentimiento","label":"Verificación y consentimiento","order":2,"required":false,"instruction":"Consentimiento informado y verificación de antecedentes (anticoagulantes, diabetes, profilaxis antibiótica) solo si se mencionaron en voz alta; si no se habló de ello, indícalo."},
    {"key":"anestesia","label":"Anestesia","order":3,"required":false,"instruction":"Técnica, anestésico y cantidad transcritos literal como se dictaron, nunca estimados. Si se trabajó sin anestesia, regístralo."},
    {"key":"instrumentacion_realizada","label":"Instrumentación realizada","order":4,"required":true,"instruction":"Desarrollo de la sesión tal como se narró: instrumentación ultrasónica o manual con curetas, alisado radicular, pulido, irrigación subgingival. Solo los pasos y las zonas mencionados; no completes protocolos."},
    {"key":"antimicrobianos_locales","label":"Antimicrobianos locales","order":5,"required":false,"instruction":"Antimicrobianos o desinfectantes locales aplicados (cuál y en qué sitios) tal como se nombraron. Si el periodoncista dijo que no se aplicaron, regístralo con sus palabras."},
    {"key":"hallazgos_durante_la_sesion","label":"Hallazgos durante la sesión","order":6,"required":false,"instruction":"Hallazgos dictados durante el procedimiento: cálculo abundante, sangrado, sitios de difícil acceso, tal como se enunciaron. No agregues hallazgos no mencionados."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones","order":7,"required":false,"instruction":"Tolerancia del paciente, sangrado al terminar y complicaciones inmediatas solo si se mencionaron; registra la ausencia de complicaciones únicamente con las palabras del periodoncista."},
    {"key":"indicaciones_y_proxima_sesion","label":"Indicaciones y próxima sesión","order":8,"required":true,"instruction":"Indicaciones posteriores dadas (higiene, sensibilidad esperada, enjuagues con dosis y duración transcritas literal sin completarlas), analgesia si se indicó y fecha de la próxima sesión o de la reevaluación."}
  ]'::jsonb,
  updated_at = now()
where id = 'a5544d01-a3c5-5480-9cbf-50306f9852c3' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c8000000-0000-4000-8000-000000000003', null,
   'Mantenimiento periodontal · fase de soporte',
   'Cita periódica de soporte del paciente periodontal ya tratado: intervalo de recall, sondaje de vigilancia con las cifras dictadas, control de placa, instrumentación de mantenimiento y refuerzo de higiene.',
   'periodoncia', 'Periodoncia', 'institutional', false, 'active',
   '[
     {"key":"intervalo_y_asistencia","label":"Intervalo y asistencia","order":1,"required":true,"instruction":"Intervalo de mantenimiento asignado y tiempo real desde la última sesión, tal como se mencionaron, y si el paciente cumplió la cita programada. Solo lo dicho en la consulta."},
     {"key":"cambios_desde_la_ultima_visita","label":"Cambios desde la última visita","order":2,"required":false,"instruction":"Síntomas nuevos relatados (sangrado, movilidad, sensibilidad), cambios en la salud general o en la medicación y hábito de tabaquismo actual, solo si se hablaron. Si el paciente dijo no tener cambios, regístralo así."},
     {"key":"sondaje_de_vigilancia","label":"Sondaje de vigilancia","order":3,"required":true,"instruction":"Transcribe el sondaje de hoy tal como se dictó: sitios con profundidad aumentada, sangrado al sondaje, supuración, movilidad, con los dientes en la nomenclatura dictada. Nunca completes sitios no dictados ni compares con registros previos salvo que el periodoncista lo haya enunciado."},
     {"key":"control_de_placa","label":"Control de placa","order":4,"required":false,"instruction":"Índice de placa o de sangrado con las cifras enunciadas por el periodoncista, nunca calculadas por ti, y las zonas de acúmulo señaladas."},
     {"key":"instrumentacion_de_mantenimiento","label":"Instrumentación de mantenimiento","order":5,"required":false,"instruction":"Lo realizado hoy: remoción de placa y cálculo, pulido, instrumentación de sitios específicos (dientes tal como se dictaron), aplicación de flúor o desensibilizantes nombrados. Solo lo hecho en esta cita."},
     {"key":"estabilidad_y_sitios_en_recaida","label":"Estabilidad y sitios en recaída","order":6,"required":true,"instruction":"Sitios que el periodoncista señaló en recaída o en observación y su concepto sobre la estabilidad periodontal, con sus palabras. No declares estabilidad ni recaída por tu cuenta."},
     {"key":"refuerzo_de_higiene","label":"Refuerzo de higiene","order":7,"required":false,"instruction":"Refuerzo de la técnica de higiene, aditamentos interdentales indicados y recomendaciones sobre tabaquismo, tal como se dieron. Solo lo explicado al paciente."},
     {"key":"plan_y_proximo_recall","label":"Plan y próximo recall","order":8,"required":true,"instruction":"Conducta definida hoy: mantener o acortar el intervalo, retratamiento de sitios específicos o remisión, tal como se decidió. Enjuagues o antimicrobianos con dosis y duración transcritas literal, sin completar lo que falte."},
     {"key":"signos_de_alerta","label":"Signos de alerta","order":9,"required":false,"instruction":"Signos por los que debe consultar antes del próximo recall (sangrado persistente, movilidad, absceso), según se explicaron al paciente."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

-- ============================================================================
-- ORTODONCIA
-- ============================================================================

update public.clinical_templates set
  name = 'Consulta inicial · diagnóstico ortodóncico y plan de aparatología',
  description = 'Primera valoración de ortodoncia: motivo, hábitos, análisis facial y de oclusión con las medidas dictadas, estudios y cefalometría transcritos literal, diagnóstico y plan con el tipo de aparatología propuesta.',
  sections = '[
    {"key":"motivo_de_consulta","label":"Motivo de consulta","order":1,"required":true,"instruction":"Motivo en palabras del paciente o de su acudiente (apiñamiento, estética de la sonrisa, mordida, remisión de odontología). Registra la edad solo si se mencionó; en menores, quién acompaña."},
    {"key":"antecedentes_y_habitos","label":"Antecedentes y hábitos","order":2,"required":false,"instruction":"Antecedentes odontológicos y hábitos interrogados: succión digital, respiración oral, deglución atípica, onicofagia, bruxismo, ortodoncia previa, tal como se relataron. Si no se interrogaron, indícalo."},
    {"key":"analisis_facial","label":"Análisis facial","order":3,"required":false,"instruction":"Análisis facial tal como lo dictó el ortodoncista: simetría, perfil (recto, convexo, cóncavo), tercios faciales, línea de sonrisa, competencia labial. Solo los rasgos que enunció; no describas lo que no evaluó en voz alta."},
    {"key":"examen_de_oclusion","label":"Examen de oclusión","order":4,"required":true,"instruction":"Oclusión tal como se dictó: clasificación de Angle por lado solo si el ortodoncista la enunció, overjet y overbite con las medidas literales, mordida cruzada o abierta, líneas medias, apiñamiento o diastemas por arcada. Nunca midas, estimes ni clasifiques tú."},
    {"key":"examen_dental_y_periodontal","label":"Examen dental y periodontal","order":5,"required":false,"instruction":"Estado dental relevante para ortodoncia: dientes ausentes, restauraciones grandes, caries activas por resolver antes de la aparatología, salud gingival, con los dientes en la nomenclatura dictada. Solo lo mencionado."},
    {"key":"estudios_y_analisis_cefalometrico","label":"Estudios y análisis cefalométrico","order":6,"required":false,"instruction":"Estudios revisados o solicitados (panorámica, radiografía cefálica lateral, modelos, fotografías) y los valores cefalométricos dictados, transcritos literal. Nunca calcules ni interpretes medidas cefalométricas; si los estudios quedaron pendientes, dilo."},
    {"key":"diagnostico_ortodoncico","label":"Diagnóstico ortodóncico","order":7,"required":true,"instruction":"Diagnóstico con los términos exactos del ortodoncista (clase esquelética o dental, biotipo, discrepancias). No agregues clasificaciones ni severidades que no se enunciaron."},
    {"key":"plan_y_aparatologia_propuesta","label":"Plan y aparatología propuesta","order":8,"required":true,"instruction":"Plan propuesto tal como se explicó: tipo de aparatología (fija metálica, autoligado, cerámica, alineadores, ortopedia funcional), exodoncias con los dientes dictados, duración estimada solo si se dijo y fases del tratamiento. Incluye las alternativas ofrecidas y lo que el paciente aceptó."},
    {"key":"acuerdos_y_proxima_cita","label":"Acuerdos y próxima cita","order":9,"required":false,"instruction":"Acuerdos de la consulta: consentimiento, requisitos antes de iniciar (higiene, operatoria pendiente) y la cita para estudios o instalación, según se definió."}
  ]'::jsonb,
  updated_at = now()
where id = 'cd4aedad-f35d-5be1-856a-8d40428cd94f' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · avance del tratamiento ortodóncico',
  description = 'Evaluación periódica del avance frente al plan: fase del tratamiento, movimiento dentario logrado, adherencia a elásticos e higiene y ajuste de objetivos. Para la cita rutinaria de ajustes use la plantilla de control de aparatología.',
  sections = '[
    {"key":"fase_y_tiempo_de_tratamiento","label":"Fase y tiempo de tratamiento","order":1,"required":true,"instruction":"Fase del tratamiento en que va el paciente (alineación, cierre de espacios, finalización) y tiempo transcurrido con aparatología, tal como lo enunció el ortodoncista. No estimes tiempos por tu cuenta."},
    {"key":"evolucion_y_sintomas","label":"Evolución y síntomas","order":2,"required":false,"instruction":"Relato del paciente desde el último control: dolor, urgencias por aparatología, brackets despegados referidos, molestias con elásticos, tal como se comentaron. Solo lo dicho."},
    {"key":"adherencia_del_paciente","label":"Adherencia del paciente","order":3,"required":false,"instruction":"Uso de elásticos intermaxilares o aparatos removibles con la frecuencia relatada, asistencia a citas e higiene, tal como se comentaron. Si no se evaluó, indícalo; no califiques la adherencia por tu cuenta."},
    {"key":"examen_del_avance","label":"Examen del avance","order":4,"required":true,"instruction":"Movimiento dentario observado tal como lo dictó el ortodoncista: alineación lograda, espacios cerrados o por cerrar, corrección de mordida, línea media. Overjet u otras medidas solo con las cifras literales dictadas, nunca medidas ni estimadas por ti."},
    {"key":"estado_de_la_aparatologia","label":"Estado de la aparatología","order":5,"required":false,"instruction":"Estado de brackets, bandas, arcos y accesorios tal como se describió hoy (completos, despegados, distorsionados), con los dientes en la nomenclatura dictada. No des por íntegro lo que no se revisó en voz alta."},
    {"key":"higiene_y_tejidos","label":"Higiene y tejidos","order":6,"required":false,"instruction":"Higiene alrededor de la aparatología, gingivitis, descalcificaciones o manchas blancas señaladas por el ortodoncista, tal como se dictaron. Solo lo observado en voz alta."},
    {"key":"analisis_y_ajuste_de_objetivos","label":"Análisis y ajuste de objetivos","order":7,"required":true,"instruction":"Concepto del ortodoncista sobre el avance frente a lo planeado y los cambios de estrategia decididos (nueva mecánica, replanteo de exodoncias, tiempo restante solo si lo dijo). Con sus palabras; sin pronósticos propios."},
    {"key":"plan_y_proximo_control","label":"Plan y próximo control","order":8,"required":true,"instruction":"Conducta de hoy y siguientes pasos acordados: qué se hará en las próximas citas, refuerzos indicados al paciente y fecha o intervalo del próximo control, según se definió."}
  ]'::jsonb,
  updated_at = now()
where id = 'dd5e3e7c-74bc-5639-afde-a094d7f6c59d' and owner_id is null;

update public.clinical_templates set
  name = 'Procedimiento · instalación de aparatología ortodóncica',
  description = 'Nota de instalación o cementado de aparatología: tipo de aparato, dientes incluidos, arco inicial y accesorios tal como se dictaron, tolerancia e instrucciones de cuidado y de urgencias.',
  sections = '[
    {"key":"indicacion_y_aparatologia","label":"Indicación y aparatología","order":1,"required":true,"instruction":"Aparatología instalada hoy y su indicación según el plan, tal como se dictó: fija (metálica, cerámica, autoligado), bandas, aparato ortopédico o removible, alineadores. No registres características técnicas que no se mencionaron."},
    {"key":"verificacion_previa","label":"Verificación previa","order":2,"required":false,"instruction":"Condiciones verificadas antes de instalar solo si se mencionaron: profilaxis, operatoria terminada, consentimiento firmado. Si no se habló de ello, indícalo."},
    {"key":"procedimiento_realizado","label":"Procedimiento realizado","order":3,"required":true,"instruction":"Desarrollo tal como se narró: grabado y adhesión, cementado de brackets o bandas con los dientes incluidos en la nomenclatura dictada, y las exclusiones (dientes sin bracket y su razón, solo si se dijo)."},
    {"key":"arco_y_accesorios","label":"Arco y accesorios","order":4,"required":false,"instruction":"Arco inicial colocado con material y calibre transcritos literal como se dictaron, nunca supuestos, más ligaduras, topes, resortes u otros accesorios nombrados. Solo lo colocado hoy."},
    {"key":"tolerancia","label":"Tolerancia","order":5,"required":false,"instruction":"Tolerancia del paciente durante la instalación e incomodidades inmediatas, solo si se mencionaron en la cita."},
    {"key":"instrucciones_de_cuidado","label":"Instrucciones de cuidado","order":6,"required":true,"instruction":"Instrucciones dadas: higiene con aparatología, alimentos a evitar, manejo del dolor inicial (analgésico con dosis transcrita literal si se indicó, sin completarla) y uso de cera de ortodoncia. Solo lo explicado al paciente."},
    {"key":"urgencias_de_aparatologia","label":"Urgencias de aparatología","order":7,"required":false,"instruction":"Qué debe hacer el paciente ante un bracket despegado, un arco que lastima o la pérdida de una ligadura, según se explicó. Si no se habló del tema, indícalo."},
    {"key":"proxima_cita","label":"Próxima cita","order":8,"required":false,"instruction":"Fecha o intervalo de la primera activación y lo previsto para esa cita, según se acordó con el paciente."}
  ]'::jsonb,
  updated_at = now()
where id = '6a6a0fd2-43ef-5f9d-952b-9ecc1428c77f' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c8000000-0000-4000-8000-000000000004', null,
   'Control de aparatología · activación y ajustes del mes',
   'La cita rutinaria de activación: qué se cambió o activó hoy en la aparatología (arcos, ligaduras, elásticos), reparaciones de brackets, higiene observada e indicaciones hasta la próxima activación.',
   'ortodoncia', 'Ortodoncia', 'institutional', false, 'active',
   '[
     {"key":"motivo_y_fase","label":"Motivo y fase","order":1,"required":true,"instruction":"Cita de activación programada: fase del tratamiento tal como la enunció el ortodoncista y tiempo desde la última activación solo si se mencionó."},
     {"key":"novedades_del_paciente","label":"Novedades del paciente","order":2,"required":false,"instruction":"Novedades desde la última cita relatadas por el paciente: dolor, brackets despegados, arcos que lastimaron, uso de elásticos. Si refirió no tener novedades, regístralo así; no añadas molestias no dichas."},
     {"key":"revision_de_la_aparatologia","label":"Revisión de la aparatología","order":3,"required":true,"instruction":"Estado encontrado hoy: brackets o bandas despegados (dientes en la nomenclatura dictada), arco deformado, accesorios perdidos, tal como se dictó. No des por íntegra la aparatología si no se dijo."},
     {"key":"higiene_observada","label":"Higiene observada","order":4,"required":false,"instruction":"Higiene y estado gingival alrededor de la aparatología tal como los describió el ortodoncista hoy; descalcificaciones o gingivitis solo si las señaló."},
     {"key":"activacion_realizada","label":"Activación realizada","order":5,"required":true,"instruction":"Lo que se hizo hoy, en orden: cambio de arco (material y calibre transcritos literal, nunca supuestos), recolocación de brackets (dientes dictados), cambio de ligaduras o cadenas elásticas, activación de resortes, dobleces. Solo lo realizado en esta cita."},
     {"key":"elasticos_indicados","label":"Elásticos indicados","order":6,"required":false,"instruction":"Elásticos intermaxilares indicados: configuración y horas de uso transcritas literal tal como se dictaron. Si el ortodoncista dijo que no se indican elásticos, regístralo con sus palabras."},
     {"key":"avance_observado","label":"Avance observado","order":7,"required":false,"instruction":"Avance que el ortodoncista comentó hoy (alineación, cierre de espacios, corrección de mordida) con sus palabras. No compares con citas previas por tu cuenta."},
     {"key":"indicaciones","label":"Indicaciones","order":8,"required":true,"instruction":"Indicaciones hasta la próxima cita: higiene, alimentos, manejo de molestias (analgésico con dosis transcrita literal si se indicó, sin completarla) y cuándo consultar por urgencia de aparatología. Solo lo explicado."},
     {"key":"proxima_activacion","label":"Próxima activación","order":9,"required":false,"instruction":"Fecha o intervalo de la próxima activación y lo previsto para ella, según se acordó con el paciente."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

-- ============================================================================
-- REHABILITACIÓN ORAL
-- ============================================================================

update public.clinical_templates set
  name = 'Consulta inicial · valoración protésica y plan de rehabilitación',
  description = 'Primera valoración de rehabilitación oral: función masticatoria, piezas ausentes y estado de pilares tal como se dictaron, oclusión y ATM, opciones protésicas discutidas y plan de rehabilitación por fases.',
  sections = '[
    {"key":"motivo_de_consulta","label":"Motivo de consulta","order":1,"required":true,"instruction":"Motivo en palabras del paciente: dificultad para masticar, estética, prótesis antigua que molesta, remisión y quién remite. Solo lo dicho en la consulta."},
    {"key":"antecedentes_protesicos_y_medicos","label":"Antecedentes protésicos y médicos","order":2,"required":false,"instruction":"Prótesis previas y su historia (cuándo y por qué se perdieron los dientes), antecedentes médicos relevantes (diabetes, bruxismo, reflujo, xerostomía por medicamentos) tal como se interrogaron. Si algo no se habló, indícalo."},
    {"key":"examen_de_piezas_y_edentulismo","label":"Examen de piezas y edentulismo","order":3,"required":true,"instruction":"Dientes ausentes y presentes con la nomenclatura exacta dictada, estado de restauraciones y prótesis existentes, y clasificación del edentulismo solo si el rehabilitador la enunció. No deduzcas ausencias que no se dictaron."},
    {"key":"evaluacion_de_pilares_y_soporte","label":"Evaluación de pilares y soporte","order":4,"required":false,"instruction":"Estado de los posibles pilares tal como se dictó: vitalidad o endodoncia previa, soporte periodontal, movilidad, remanente coronal, y el reborde y la mucosa en zonas edéntulas si se describieron. Solo lo evaluado en voz alta."},
    {"key":"oclusion_y_atm","label":"Oclusión y ATM","order":5,"required":false,"instruction":"Oclusión y función tal como se dictaron: dimensión vertical, guías oclusales, facetas de desgaste, hábitos parafuncionales, ruidos o dolor de ATM, apertura con la medida literal si se dictó, nunca estimada por ti."},
    {"key":"ayudas_diagnosticas","label":"Ayudas diagnósticas","order":6,"required":false,"instruction":"Radiografías, modelos de estudio, encerado diagnóstico o fotografías revisados o solicitados: transcribe los hallazgos literal como se leyeron. Si quedaron pendientes, dilo; no interpretes imágenes por tu cuenta."},
    {"key":"diagnostico_y_pronostico","label":"Diagnóstico y pronóstico","order":7,"required":true,"instruction":"Diagnóstico protésico y pronóstico de los pilares con los términos exactos del rehabilitador. No clasifiques ni pronostiques por deducción de los hallazgos."},
    {"key":"opciones_y_plan_de_rehabilitacion","label":"Opciones y plan de rehabilitación","order":8,"required":true,"instruction":"Opciones protésicas discutidas (prótesis fija, removible, total, sobre implantes) con lo explicado de cada una, la opción elegida por el paciente y el plan por fases con los dientes involucrados tal como se dictaron. Incluye interconsultas previas (endodoncia, periodoncia, cirugía) solo si se indicaron."},
    {"key":"acuerdos_y_proxima_cita","label":"Acuerdos y próxima cita","order":9,"required":false,"instruction":"Acuerdos alcanzados: consentimiento, requisitos previos, número de citas previsto solo si se dijo y la próxima cita programada."}
  ]'::jsonb,
  updated_at = now()
where id = 'e60e4f84-af79-5414-9859-4e3a6710d80a' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · adaptación protésica y función',
  description = 'Control del paciente ya rehabilitado: adaptación y confort de la prótesis, función masticatoria, zonas de presión o úlceras, ajustes realizados hoy e higiene de la prótesis.',
  sections = '[
    {"key":"motivo_del_control","label":"Motivo del control","order":1,"required":true,"instruction":"Prótesis o rehabilitación en control (cuál, tal como se nombró) y tiempo desde la entrega o el último ajuste solo si se mencionó."},
    {"key":"adaptacion_y_confort","label":"Adaptación y confort","order":2,"required":false,"instruction":"Relato del paciente: comodidad, dolor o zonas que lastiman, capacidad para masticar y hablar, estabilidad de la prótesis al comer, tal como lo expresó. Solo lo dicho; no añadas molestias."},
    {"key":"examen_de_la_protesis_y_tejidos","label":"Examen de la prótesis y tejidos","order":3,"required":true,"instruction":"Hallazgos de hoy: zonas de presión o úlceras en la mucosa (ubicación tal como se dictó), retención y estabilidad, oclusión de la prótesis, estado de pilares o de la estructura, desgaste o fracturas del material. No completes lo que no se examinó en voz alta."},
    {"key":"higiene_de_la_protesis","label":"Higiene de la prótesis","order":4,"required":false,"instruction":"Higiene de la prótesis y de los dientes remanentes tal como se observó o comentó, e indicaciones de limpieza reforzadas solo si se dieron."},
    {"key":"ajustes_realizados","label":"Ajustes realizados","order":5,"required":false,"instruction":"Ajustes hechos hoy tal como se narraron: alivio de zonas de presión, ajuste oclusal, rebase, pulido, recementación (dientes o zonas dictados). Solo lo realizado en esta cita."},
    {"key":"analisis_de_la_funcion","label":"Análisis de la función","order":6,"required":true,"instruction":"Concepto del rehabilitador sobre la adaptación y la función lograda, con sus palabras. No califiques el resultado por tu cuenta."},
    {"key":"plan","label":"Plan","order":7,"required":true,"instruction":"Conducta definida: nuevos ajustes, cambio o rebase programado, remisión o controles, tal como se decidió. Medicamentos o geles indicados con dosis transcrita literal, sin completarla."},
    {"key":"proximo_control","label":"Próximo control","order":8,"required":false,"instruction":"Intervalo del próximo control y signos por los que debe consultar antes (dolor que aumenta, úlcera que no cede, fractura), según se explicó al paciente."}
  ]'::jsonb,
  updated_at = now()
where id = '98fe1002-57f3-5d47-ae81-07daf836a6c9' and owner_id is null;

update public.clinical_templates set
  name = 'Procedimiento · preparación de pilares y toma de impresiones',
  description = 'Nota de la sesión protésica intermedia: tallado de pilares, retracción gingival, impresiones con los materiales nombrados, registro de mordida, selección de color literal y provisionales.',
  sections = '[
    {"key":"indicacion_y_dientes_tratados","label":"Indicación y dientes tratados","order":1,"required":true,"instruction":"Sesión realizada dentro del plan protésico (tallado, impresión, registro) con los dientes trabajados en la nomenclatura exacta dictada. Solo lo hecho hoy; no amplíes a otros dientes."},
    {"key":"verificacion_y_anestesia","label":"Verificación y anestesia","order":2,"required":false,"instruction":"Consentimiento y verificación previa solo si se mencionaron, y la anestesia empleada con técnica y cantidad transcritas literal, nunca estimadas. Si no se usó anestesia, indícalo."},
    {"key":"preparacion_de_pilares","label":"Preparación de pilares","order":3,"required":true,"instruction":"Tallado tal como se narró: dientes preparados, tipo de terminación o margen solo si el rehabilitador lo enunció, retracción gingival (hilo, técnica) si se mencionó. No describas parámetros de tallado que no se dictaron."},
    {"key":"impresiones_y_materiales","label":"Impresiones y materiales","order":4,"required":false,"instruction":"Impresiones tomadas con los materiales tal como se nombraron (silicona, alginato, cubeta, escáner intraoral), arcadas incluidas y repeticiones si las hubo. Solo lo nombrado en la sesión."},
    {"key":"registro_de_mordida_y_color","label":"Registro de mordida y color","order":5,"required":false,"instruction":"Registro intermaxilar realizado y color seleccionado con la guía y el tono transcritos literal como se dictaron; nunca asignes un tono que no se dijo."},
    {"key":"provisionales","label":"Provisionales","order":6,"required":false,"instruction":"Provisionales confeccionados o recementados (material y dientes dictados) y su ajuste. Si el paciente quedó sin provisional y así se dijo, regístralo con esas palabras."},
    {"key":"tolerancia_e_incidencias","label":"Tolerancia e incidencias","order":7,"required":false,"instruction":"Tolerancia del paciente e incidencias de la sesión (exposición pulpar, sangrado gingival, impresión repetida) solo si se mencionaron; no agregues eventos."},
    {"key":"envio_a_laboratorio_y_proxima_cita","label":"Envío a laboratorio y próxima cita","order":8,"required":true,"instruction":"Indicaciones al laboratorio tal como se dictaron (trabajo solicitado, material), cuidados con el provisional explicados al paciente y fecha o intervalo de la próxima cita (prueba o entrega)."}
  ]'::jsonb,
  updated_at = now()
where id = 'df9d7646-98aa-5f01-ab0b-dc8c9f7974e2' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c8000000-0000-4000-8000-000000000005', null,
   'Entrega y ajuste de prótesis · asentamiento, oclusión y cuidados',
   'Cita de entrega de prótesis fija, removible o total: prueba y asentamiento, ajuste oclusal y de retención, conformidad estética expresada por el paciente, cementación o adaptación final e instrucciones de uso e higiene.',
   'rehabilitacion_oral', 'Rehabilitación oral', 'institutional', false, 'active',
   '[
     {"key":"protesis_entregada","label":"Prótesis entregada","order":1,"required":true,"instruction":"Prótesis entregada hoy: tipo (fija, removible, total) y dientes o zonas involucrados con la nomenclatura exacta dictada, y el material tal como se nombró. Solo lo entregado en esta cita."},
     {"key":"prueba_y_asentamiento","label":"Prueba y asentamiento","order":2,"required":true,"instruction":"Prueba en boca tal como se narró: asentamiento, ajuste marginal en prótesis fija solo si el rehabilitador lo describió, contactos proximales, retención y estabilidad en removible. No califiques el ajuste con términos que no se dictaron."},
     {"key":"ajuste_oclusal","label":"Ajuste oclusal","order":3,"required":false,"instruction":"Ajuste oclusal realizado: contactos verificados (papel de articulación si se mencionó) y zonas desgastadas o ajustadas tal como se dictaron. Solo los ajustes hechos hoy."},
     {"key":"estetica_y_conformidad","label":"Estética y conformidad del paciente","order":4,"required":false,"instruction":"Valoración estética y conformidad expresada por el paciente (color, forma, fonación) con sus palabras o las del rehabilitador. Registra objeciones o pendientes solo si se expresaron; no des por aceptado lo no dicho."},
     {"key":"cementacion_o_adaptacion_final","label":"Cementación o adaptación final","order":5,"required":false,"instruction":"Cementación con el cemento nombrado tal como se dictó (definitiva o provisional) o adaptación final de la prótesis removible, tal como se realizó. No agregues materiales que no se nombraron."},
     {"key":"instrucciones_de_uso_e_higiene","label":"Instrucciones de uso e higiene","order":6,"required":true,"instruction":"Instrucciones dadas: inserción y retiro de la removible, higiene de la prótesis y de los pilares, uso nocturno según lo indicado y alimentación de los primeros días. Solo lo explicado al paciente."},
     {"key":"molestias_esperadas_y_alarma","label":"Molestias esperadas y signos de alarma","order":7,"required":false,"instruction":"Molestias normales advertidas y signos por los que debe consultar antes del control (dolor que aumenta, úlceras, aflojamiento de la prótesis), según se explicaron."},
     {"key":"pendientes_y_compromisos","label":"Pendientes y compromisos","order":8,"required":false,"instruction":"Pendientes acordados (ajustes futuros, rebase, entrega de aditamentos) y compromisos sobre el trabajo entregado, solo si se hablaron en la cita."},
     {"key":"proximo_control","label":"Próximo control","order":9,"required":false,"instruction":"Cita de control posentrega acordada y su objetivo, tal como se definió con el paciente."}
   ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();
