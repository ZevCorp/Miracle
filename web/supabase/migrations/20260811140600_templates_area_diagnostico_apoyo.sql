-- Por qué: renovación del área 6 (Diagnóstico) del catálogo de plantillas. Las plantillas de
-- fábrica de radiología, patología, medicina nuclear y genética salían del generador genérico
-- (mismas secciones para todas las especialidades) y no pedían lo que define la nota de cada
-- una: medidas dictadas literal, radiofármacos con dosis exactas, nomenclatura de variantes,
-- trazabilidad de muestras. Este lote: 12 UPDATEs (reescritura de las 3 de fábrica por
-- especialidad) + 3 INSERTs (4ª plantilla nueva, salvo patología).
--
-- · radiologia: "Consulta inicial · valoración e indicación de estudios por imágenes",
--   "Control y seguimiento · lectura comparativa de hallazgos por imágenes", "Procedimiento ·
--   intervencionismo guiado por imagen" + 4ª "Informe de ecografía diagnóstica" (fijada por el
--   encargo: es el estudio operador-dependiente que el radiólogo dicta a diario y sus medidas
--   exigen transcripción literal, nunca calculada por la IA).
-- · patologia: SOLO 3 UPDATEs, SIN 4ª — ya existen sus informes reales (histopatología,
--   citología Bethesda, IHQ, congelación) y duplicarlos confundiría el selector. Las de
--   fábrica se orientan a escenarios complementarios: "Consulta de correlación
--   clínico-patológica · junta de casos", "Revisión de láminas y bloques externos · segunda
--   opinión" y "Recepción y adecuación de muestras".
-- · medicina_nuclear: valoración inicial, control postratamiento y administración de
--   radiofármaco terapéutico + 4ª "Informe de gammagrafía o PET" (el informe del estudio
--   funcional es el entregable central del servicio; radiofármaco, dosis y SUV exigen
--   transcripción literal).
-- · genetica: evaluación inicial con fenotipo, control de enfermedad genética confirmada y
--   toma de muestra con consentimiento + 4ª "Asesoría genética · resultados y plan familiar"
--   (la cita de mayor riesgo documental: variantes, riesgos de recurrencia y patrones de
--   herencia no se pueden inventar ni calcular).

-- ============================================================================
-- RADIOLOGÍA E IMÁGENES DIAGNÓSTICAS
-- ============================================================================

update public.clinical_templates set
  name = 'Consulta inicial · valoración e indicación de estudios por imágenes',
  description = 'Consulta con el radiólogo para definir y justificar el estudio por imágenes: contexto clínico, antecedentes que condicionan la técnica, seguridad del contraste y estudios previos. Úsala cuando el paciente llega remitido para orientar qué estudio realizar.',
  sections = '[
    {"key":"motivo_e_indicacion","label":"Motivo e indicación del estudio","order":1,"required":true,"instruction":"Documenta el motivo de la remisión y el estudio que se busca justificar, en las palabras del paciente o de la orden de remisión (EPS, servicio remitente) tal como se mencionaron. No propongas tú un estudio distinto al hablado."},
    {"key":"enfermedad_actual","label":"Enfermedad actual y contexto clínico","order":2,"required":false,"instruction":"Cronología del cuadro que motiva las imágenes: inicio, evolución, dolor u otros síntomas, cirugías o traumas relacionados y tratamientos recibidos, solo con lo dicho en la consulta. Si un dato no se mencionó, no lo completes."},
    {"key":"antecedentes_relevantes","label":"Antecedentes relevantes para imágenes","order":3,"required":false,"instruction":"Registra antecedentes que condicionan la técnica: cirugías previas, implantes, prótesis, marcapasos, dispositivos metálicos, enfermedad renal, alergias y embarazo o lactancia, únicamente si se mencionaron. Si no se preguntó por alguno, indícalo en lugar de asumir que es negativo."},
    {"key":"estudios_previos","label":"Estudios de imágenes previos","order":4,"required":false,"instruction":"Lista los estudios previos que se comentaron con fecha, institución y resultado tal como el médico o el paciente los citaron. Transcribe las conclusiones literales; no las reinterpretes ni agregues hallazgos que no se leyeron en voz alta."},
    {"key":"verificacion_seguridad","label":"Verificación de seguridad y contraste","order":5,"required":false,"instruction":"Documenta lo verificado para el uso de contraste o del equipo: alergias previas al medio de contraste, creatinina u otros laboratorios con el valor literal que se dijo, posibilidad de embarazo, claustrofobia y ayuno. Nunca calcules ni estimes valores de laboratorio; si algo no se verificó, escríbelo así."},
    {"key":"examen_fisico_dirigido","label":"Examen físico dirigido","order":6,"required":true,"instruction":"Describe solo lo examinado: región anatómica de interés, masas palpables con la ubicación y el tamaño dictados, y signos vitales si se tomaron. No completes sistemas no explorados."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":7,"required":true,"instruction":"Redacta el razonamiento del radiólogo con la precisión con que lo formuló: pregunta clínica a resolver, sospecha diagnóstica y pertinencia del estudio. Incluye diagnósticos diferenciales solo si él los enunció."},
    {"key":"plan_estudio_y_preparacion","label":"Plan: estudio indicado y preparación","order":8,"required":true,"instruction":"Registra el estudio indicado con protocolo, uso de contraste y preparación tal como se explicaron (ayuno, suspensión de medicamentos, hidratación). Transcribe literal cualquier dosis o valor; añade trámites de autorización con la EPS o remisiones solo si se hablaron."},
    {"key":"entrega_y_proximo_paso","label":"Entrega de resultados y próximo paso","order":9,"required":false,"instruction":"Documenta cómo y cuándo se entregará el resultado, con quién debe continuar el paciente y los signos de alarma explicados, únicamente si se mencionaron en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = '82711515-4960-53f0-a53a-f6be6fbf3c9d' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · lectura comparativa de hallazgos por imágenes',
  description = 'Seguimiento por imágenes de un hallazgo conocido (nódulo, masa, lesión en vigilancia): comparación con estudios previos, cambios de tamaño dictados literal y conducta. Úsala cuando el paciente vuelve con estudios de control.',
  sections = '[
    {"key":"hallazgo_en_seguimiento","label":"Hallazgo en seguimiento y diagnósticos activos","order":1,"required":true,"instruction":"Registra el hallazgo o lesión en vigilancia (nódulo, masa, quiste u otro) y el diagnóstico de base tal como el médico los nombró, con el tiempo de seguimiento si lo dijo. No añadas lesiones no mencionadas."},
    {"key":"intervalo_y_estudios_realizados","label":"Intervalo y estudios realizados","order":2,"required":false,"instruction":"Documenta el tiempo transcurrido desde el último control y los estudios de imagen realizados en el intervalo, con fecha, modalidad e institución tal como se citaron. No agregues estudios no mencionados."},
    {"key":"sintomas_del_intervalo","label":"Síntomas del intervalo","order":3,"required":false,"instruction":"Describe síntomas nuevos o cambios clínicos desde el último control únicamente con lo relatado. Si el paciente refirió estar asintomático, escríbelo así; no lo asumas."},
    {"key":"comparacion_con_previos","label":"Comparación con estudios previos","order":4,"required":true,"instruction":"Registra la comparación que el médico hizo entre el estudio actual y los previos: medidas y cambios de tamaño transcritos literal como se dictaron, estabilidad, crecimiento o resolución. Nunca calcules diferencias ni porcentajes de cambio tú; si no se comparó con un estudio, no inventes esa comparación."},
    {"key":"resultados_nuevos","label":"Otros resultados nuevos","order":5,"required":false,"instruction":"Transcribe laboratorios u otros paraclínicos nuevos con el valor literal que se leyó en la consulta, con fecha si se dijo. Nunca los calcules, normalices ni completes."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":6,"required":true,"instruction":"Sintetiza la lectura del médico: estabilidad o cambio del hallazgo, clasificación o categoría (BI-RADS, TI-RADS, Lung-RADS u otra) solo si él la enunció y tal como la dijo, y su interpretación del conjunto. No asignes categorías por tu cuenta."},
    {"key":"plan_y_conducta","label":"Plan y conducta","order":7,"required":true,"instruction":"Registra la conducta definida: nuevo intervalo de imágenes, modalidad del próximo estudio, remisión a otra especialidad o alta de la vigilancia, tal como se indicó. No propongas intervalos ni guías que el médico no mencionó."},
    {"key":"proximo_control","label":"Próximo control","order":8,"required":false,"instruction":"Documenta cuándo debe volver el paciente y con qué estudio o resultado, y los signos de alarma para consultar antes, solo si se explicaron."}
  ]'::jsonb,
  updated_at = now()
where id = 'e882c8dc-b61c-515f-8ac1-77fcc7d11871' and owner_id is null;

update public.clinical_templates set
  name = 'Procedimiento · intervencionismo guiado por imagen',
  description = 'Procedimientos guiados por ecografía, TAC o fluoroscopia (biopsias, drenajes, marcaciones): verificación previa, técnica dictada, muestras enviadas a patología, tolerancia y cuidados posteriores.',
  sections = '[
    {"key":"indicacion_y_contexto","label":"Indicación y contexto","order":1,"required":true,"instruction":"Documenta el procedimiento realizado (biopsia, drenaje, marcación u otro), la lesión objetivo y la indicación clínica tal como se enunciaron, con el servicio remitente o la EPS si se mencionó."},
    {"key":"verificacion_y_consentimiento","label":"Verificación previa y consentimiento","order":2,"required":false,"instruction":"Registra la verificación previa: consentimiento informado explicado y aceptado, pausa de seguridad, ayuno, y estado de coagulación o suspensión de anticoagulantes con los valores y nombres literales que se dijeron. Si algo no se verificó en voz alta, indícalo; no lo des por hecho."},
    {"key":"tecnica_y_guia","label":"Técnica y guía por imagen","order":3,"required":false,"instruction":"Describe la técnica tal como se dictó: modalidad de guía (ecografía, TAC, fluoroscopia), asepsia, anestesia local con la dosis literal, calibre de aguja o catéter y abordaje. No agregues pasos estándar que no se narraron."},
    {"key":"hallazgos_y_muestras","label":"Hallazgos y muestras obtenidas","order":4,"required":true,"instruction":"Registra los hallazgos durante el procedimiento y las muestras obtenidas: número de cilindros o pases, volumen drenado con la cifra literal dictada y aspecto del material. Anota el envío a patología o laboratorio solo si se dijo. Nunca estimes cantidades."},
    {"key":"tolerancia_y_complicaciones","label":"Tolerancia y complicaciones inmediatas","order":5,"required":false,"instruction":"Documenta la tolerancia del paciente y las complicaciones inmediatas o su ausencia tal como el médico lo verbalizó (sangrado, dolor, neumotórax u otras). Si declaró que no hubo complicaciones, regístralo con esas palabras."},
    {"key":"vigilancia_posprocedimiento","label":"Vigilancia posprocedimiento","order":6,"required":false,"instruction":"Registra la vigilancia indicada tras el procedimiento: tiempo de observación, imagen de control (por ejemplo radiografía posbiopsia) y criterios de salida, únicamente los que se enunciaron."},
    {"key":"indicaciones_posteriores","label":"Indicaciones posteriores y signos de alarma","order":7,"required":true,"instruction":"Registra los cuidados en casa explicados: reposo, cuidado del sitio de punción, analgesia con la dosis literal indicada, reinicio de anticoagulantes solo si el médico lo dijo, y los signos de alarma para consultar a urgencias."},
    {"key":"seguimiento_y_resultados","label":"Seguimiento y entrega de resultados","order":8,"required":false,"instruction":"Documenta cuándo y dónde se entregarán los resultados de las muestras, y la cita o remisión de control indicada, solo si se mencionaron."}
  ]'::jsonb,
  updated_at = now()
where id = '6a98ff16-2079-5f87-9b13-ba27146c1aa4' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c6000000-0000-4000-8000-000000000001', null,
   'Informe de ecografía diagnóstica',
   'Informe del estudio ecográfico dictado durante o después de la exploración: técnica, hallazgos órgano por órgano con medidas literales, comparación con previos solo si se hizo, impresión y recomendaciones. Úsala al dictar el informe del estudio, no en consulta con paciente.',
   'radiologia', 'Radiología e imágenes diagnósticas', 'institutional', false, 'active',
   '[
    {"key":"datos_e_indicacion","label":"Datos e indicación del estudio","order":1,"required":true,"instruction":"Registra el tipo de ecografía realizada, la fecha si se dijo, el servicio o médico remitente y la indicación clínica del estudio tal como se enunciaron. No deduzcas la indicación a partir de los hallazgos."},
    {"key":"tecnica_y_transductor","label":"Técnica y transductor","order":2,"required":false,"instruction":"Documenta la técnica solo si el médico la mencionó: transductor utilizado, abordaje, condiciones del paciente (ayuno, vejiga llena) y limitaciones técnicas. Si no se habló de la técnica, indícalo; no describas un protocolo estándar."},
    {"key":"hallazgos_por_organo","label":"Hallazgos por órgano","order":3,"required":true,"instruction":"Redacta los hallazgos órgano por órgano en el orden en que se dictaron: ecogenicidad, contornos, lesiones y vascularización con las palabras del médico. Toda medida va transcrita literal como se dictó (mm o cm); nunca la calcules, conviertas ni estimes tú. No agregues órganos que no se exploraron."},
    {"key":"estructuras_no_evaluadas","label":"Estructuras no evaluadas y limitaciones","order":4,"required":false,"instruction":"Registra las estructuras que el médico declaró no evaluadas o mal visualizadas y la causa dictada (gas intestinal, hábito corporal, falta de preparación). Solo lo que se dijo; no marques como normal lo que no se exploró."},
    {"key":"comparacion_con_previos","label":"Comparación con estudios previos","order":5,"required":false,"instruction":"Incluye la comparación con estudios previos únicamente si el médico la hizo durante el dictado, con las fechas y medidas literales que citó. Si no comparó, indícalo; no inventes estudios previos ni calcules cambios de tamaño."},
    {"key":"impresion_diagnostica","label":"Impresión diagnóstica","order":6,"required":true,"instruction":"Transcribe la impresión diagnóstica con la precisión con que el médico la formuló, incluidas categorías o clasificaciones (BI-RADS, TI-RADS u otras) solo si las enunció. No conviertas hallazgos descriptivos en diagnósticos que no se dictaron."},
    {"key":"recomendaciones","label":"Recomendaciones y correlación","order":7,"required":true,"instruction":"Registra las recomendaciones enunciadas: correlación clínica o con laboratorio, estudios adicionales sugeridos y control ecográfico con el intervalo dictado. No sugieras estudios ni intervalos por tu cuenta."},
    {"key":"observaciones_finales","label":"Observaciones finales","order":8,"required":false,"instruction":"Anota observaciones adicionales dictadas: incidencias durante el estudio, tolerancia del paciente o notas para el médico tratante. Si no se dictaron, no agregues ninguna."}
  ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

-- ============================================================================
-- PATOLOGÍA (solo 3 UPDATEs; los informes reales b1*/c0ca5d00* no se tocan)
-- ============================================================================

update public.clinical_templates set
  name = 'Consulta de correlación clínico-patológica · junta de casos',
  description = 'Discusión de un caso con el equipo tratante o en junta: resumen clínico presentado, informes de patología previos, material revisado y conclusión de la correlación. Úsala para documentar la participación del patólogo en juntas o interconsultas; el informe del espécimen va en las plantillas de informe.',
  sections = '[
    {"key":"motivo_y_solicitante","label":"Motivo de la correlación y solicitante","order":1,"required":true,"instruction":"Documenta quién solicita la correlación o presenta el caso (junta, servicio tratante, interconsulta) y la pregunta concreta que se busca resolver, tal como se planteó en la sesión."},
    {"key":"resumen_clinico_presentado","label":"Resumen clínico presentado","order":2,"required":false,"instruction":"Registra el resumen clínico expuesto por el equipo tratante: evolución, hallazgos de imágenes y tratamientos, únicamente con lo dicho en la reunión. No amplíes la historia con datos que nadie presentó."},
    {"key":"informes_de_patologia_previos","label":"Informes de patología previos","order":3,"required":false,"instruction":"Lista los informes de patología del caso citados en la discusión, con número de espécimen y diagnóstico transcritos literal tal como se leyeron. No resumas ni reformules los diagnósticos escritos."},
    {"key":"material_revisado","label":"Material revisado en la sesión","order":4,"required":false,"instruction":"Registra el material que se revisó: láminas, bloques, recortes o fotografías, con los identificadores mencionados. Si no se revisó material y la discusión fue solo documental, indícalo."},
    {"key":"hallazgos_discutidos","label":"Hallazgos morfológicos discutidos","order":5,"required":true,"instruction":"Documenta los hallazgos morfológicos que el patólogo describió o reconsideró durante la sesión, con su terminología literal. No agregues descripciones microscópicas que no se verbalizaron."},
    {"key":"estudios_complementarios","label":"Estudios complementarios discutidos","order":6,"required":false,"instruction":"Registra los estudios complementarios comentados (inmunohistoquímica, estudios moleculares) y sus resultados con el valor o la interpretación literal que se citó. Nunca completes marcadores o resultados no leídos en la sesión."},
    {"key":"conclusion_de_la_correlacion","label":"Conclusión de la correlación","order":7,"required":true,"instruction":"Redacta la conclusión de la correlación clínico-patológica tal como se formuló: concordancia o discrepancia entre clínica y patología, y el diagnóstico integrado solo si el patólogo lo enunció."},
    {"key":"recomendaciones_y_conducta","label":"Recomendaciones y conducta","order":8,"required":true,"instruction":"Registra las recomendaciones acordadas: estudios adicionales sobre el material, nuevas muestras, remisiones o conducta clínica sugerida por la junta, únicamente las que se dijeron."},
    {"key":"participantes_y_compromisos","label":"Participantes y compromisos","order":9,"required":false,"instruction":"Anota los servicios o especialistas participantes y los compromisos con responsable y plazo, solo si se mencionaron en la sesión."}
  ]'::jsonb,
  updated_at = now()
where id = '52ec7f0b-3ff2-584a-8dcd-9e430b4e1817' and owner_id is null;

update public.clinical_templates set
  name = 'Revisión de láminas y bloques externos · segunda opinión',
  description = 'Revisión de material de otra institución: inventario de láminas y bloques recibidos, diagnóstico externo original, hallazgos de la revisión y concepto final. Úsala para segundas opiniones; no reemplaza el informe de histopatología de especímenes propios.',
  sections = '[
    {"key":"motivo_de_la_revision","label":"Motivo de la revisión","order":1,"required":true,"instruction":"Documenta quién solicita la segunda opinión (paciente, médico tratante, EPS, aseguradora) y el propósito de la revisión tal como se planteó. No supongas el motivo si no se dijo."},
    {"key":"material_recibido","label":"Material recibido","order":2,"required":false,"instruction":"Inventaría el material recibido: número de láminas y bloques, rótulos e identificadores transcritos literal, institución de origen y estado de conservación descrito. Si falta material anunciado, regístralo; nunca completes identificadores."},
    {"key":"diagnostico_externo_original","label":"Diagnóstico externo original","order":3,"required":false,"instruction":"Transcribe el diagnóstico del informe externo tal como está escrito, con institución, fecha y número de espécimen si se citaron. No lo parafrasees ni lo corrijas en esta sección."},
    {"key":"resumen_clinico_disponible","label":"Resumen clínico disponible","order":4,"required":false,"instruction":"Registra la información clínica disponible para la revisión, con su fuente (resumen, historia, el propio paciente). Si la revisión se hizo sin contexto clínico, indícalo."},
    {"key":"hallazgos_de_la_revision","label":"Hallazgos microscópicos de la revisión","order":5,"required":true,"instruction":"Documenta los hallazgos microscópicos descritos por el patólogo revisor con su terminología literal, lámina por lámina si así los dictó. No completes descripciones con hallazgos típicos no verbalizados."},
    {"key":"estudios_adicionales","label":"Estudios adicionales realizados","order":6,"required":false,"instruction":"Registra estudios adicionales hechos sobre el material (recortes, inmunohistoquímica, otros) con cada resultado transcrito literal. Nunca infieras el resultado de un marcador que no se leyó."},
    {"key":"concepto_de_la_revision","label":"Concepto y diagnóstico de la revisión","order":7,"required":true,"instruction":"Redacta el diagnóstico de la revisión tal como se formuló y la relación con el diagnóstico original (concordante, discrepante, no concluyente) solo si el patólogo la enunció explícitamente."},
    {"key":"comentario_y_recomendaciones","label":"Comentario y recomendaciones","order":8,"required":true,"instruction":"Registra el comentario final y las recomendaciones: estudios complementarios, correlación clínica, devolución del material o remisión, únicamente las que se dictaron."}
  ]'::jsonb,
  updated_at = now()
where id = '9a743bbf-fb87-5625-8dc5-e03682b2c5bd' and owner_id is null;

update public.clinical_templates set
  name = 'Recepción y adecuación de muestras',
  description = 'Recepción técnica del espécimen en el laboratorio: verificación de rótulo y orden, estado de fijación, descripción inicial, adecuación o rechazo y destino del material. Úsala para dejar trazabilidad preanalítica antes del estudio histopatológico.',
  sections = '[
    {"key":"datos_de_recepcion","label":"Datos de recepción","order":1,"required":true,"instruction":"Registra fecha y hora de recepción si se dijeron, procedencia (servicio, institución, EPS), quién entrega y quién recibe, y el tipo de espécimen anunciado, tal como se mencionaron. No completes datos de la cadena de custodia que no se dictaron."},
    {"key":"verificacion_de_identificacion","label":"Verificación de rótulo e identificación","order":2,"required":false,"instruction":"Documenta la verificación entre rótulo del recipiente, orden médica e identidad del paciente, transcribiendo los identificadores literal. Registra cualquier discrepancia detectada y cómo se resolvió; si no hubo, dilo explícitamente."},
    {"key":"estado_del_especimen_y_fijacion","label":"Estado del espécimen y fijación","order":3,"required":false,"instruction":"Describe el recipiente y la fijación tal como se narraron: tipo y cantidad de fijador, integridad del recipiente y tiempo fuera de fijador solo si alguien lo dijo. Nunca calcules tiempos de isquemia ni volúmenes por tu cuenta."},
    {"key":"descripcion_inicial","label":"Descripción inicial del material","order":4,"required":true,"instruction":"Registra la descripción del material recibido: número de fragmentos o especímenes y medidas o pesos transcritos literal como se dictaron. Nunca midas, promedies ni estimes tú; si un dato no se dictó, no lo inventes."},
    {"key":"adecuacion_o_rechazo","label":"Adecuación o rechazo de la muestra","order":5,"required":true,"instruction":"Documenta si la muestra fue aceptada, aceptada con observaciones o rechazada, con la causa enunciada (fijación inadecuada, rótulo ausente, material insuficiente) y a quién se notificó. Solo lo dicho; no clasifiques tú la adecuación."},
    {"key":"procesamiento_y_destino","label":"Procesamiento y destino","order":6,"required":false,"instruction":"Registra el destino definido para el material: número de casetes o bloques dictado, estudios solicitados y prioridad (rutina o urgente) tal como se indicaron."},
    {"key":"incidencias_y_comunicaciones","label":"Incidencias y comunicaciones","order":7,"required":false,"instruction":"Anota las comunicaciones con el servicio remitente o el laboratorio sobre esta muestra (llamadas, correcciones de orden) con lo acordado, solo si ocurrieron."},
    {"key":"conducta_y_registro","label":"Conducta y registro","order":8,"required":true,"instruction":"Registra la conducta final: número interno asignado si se dictó, responsable del procesamiento y el paso siguiente del flujo, tal como se enunciaron. No asignes números ni responsables no mencionados."}
  ]'::jsonb,
  updated_at = now()
where id = 'ab84e266-c9f0-5a71-9ace-ee896ac3028c' and owner_id is null;

-- ============================================================================
-- MEDICINA NUCLEAR
-- ============================================================================

update public.clinical_templates set
  name = 'Consulta inicial · valoración para estudio o terapia con radiofármacos',
  description = 'Primera valoración en medicina nuclear: indicación del estudio o la terapia, medicamentos que interfieren, seguridad radiológica (embarazo, lactancia, aislamiento) y preparación. Úsala antes de programar gammagrafías, PET o terapias.',
  sections = '[
    {"key":"motivo_e_indicacion","label":"Motivo e indicación","order":1,"required":true,"instruction":"Documenta el estudio o la terapia con radiofármacos que motiva la valoración y la pregunta clínica del remitente, en las palabras usadas en la consulta y en la orden de remisión (EPS, servicio) si se citó."},
    {"key":"enfermedad_actual_y_contexto","label":"Enfermedad actual y contexto","order":2,"required":false,"instruction":"Cronología de la enfermedad de base que motiva el estudio: diagnóstico, cirugías, tratamientos oncológicos o endocrinos recibidos y evolución, solo con lo mencionado. No completes etapas del tratamiento que no se relataron."},
    {"key":"antecedentes_y_terapias_previas","label":"Antecedentes y terapias previas","order":3,"required":false,"instruction":"Registra antecedentes relevantes: enfermedad tiroidea, renal o cardiaca, terapias previas con radiofármacos con fecha y dosis transcritas literal si se citaron, cirugías y alergias. Si un antecedente no se preguntó, indícalo en vez de asumirlo negativo."},
    {"key":"medicamentos_e_interferencias","label":"Medicamentos e interferencias","order":4,"required":false,"instruction":"Lista los medicamentos actuales mencionados y los que interfieren con el estudio (por ejemplo levotiroxina, amiodarona, contrastes yodados recientes) tal como se hablaron. Registra la instrucción de suspensión con los días exactos que el médico indicó; nunca definas tú los tiempos."},
    {"key":"seguridad_radiologica","label":"Seguridad radiológica","order":5,"required":false,"instruction":"Documenta lo verificado sobre seguridad radiológica: posibilidad de embarazo y prueba realizada, lactancia y su suspensión, convivencia con niños o embarazadas y condiciones para el aislamiento, únicamente con lo conversado. Si algo no se verificó, escríbelo."},
    {"key":"estudios_previos_y_laboratorios","label":"Estudios previos y laboratorios","order":6,"required":false,"instruction":"Transcribe los laboratorios y estudios previos citados (TSH, tiroglobulina, creatinina, imágenes, rastreos) con el valor y la fecha literales que se leyeron. Nunca calcules, actualices ni completes valores."},
    {"key":"examen_fisico_dirigido","label":"Examen físico dirigido","order":7,"required":true,"instruction":"Describe solo lo examinado: región de interés (por ejemplo cuello y tiroides), signos vitales si se tomaron y hallazgos con las medidas dictadas literal. No completes sistemas no explorados."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":8,"required":true,"instruction":"Redacta el análisis del especialista con la precisión con que lo formuló: pertinencia del estudio o la terapia, sospecha diagnóstica y condiciones a resolver antes de programar. Incluye alternativas solo si él las enunció."},
    {"key":"plan_y_preparacion","label":"Plan y preparación","order":9,"required":true,"instruction":"Registra el plan: estudio o terapia programada, preparación explicada (ayuno, suspensión de medicamentos con los tiempos dictados, hidratación), autorizaciones con la EPS y consentimiento pendiente. Transcribe literal cualquier dosis o tiempo; no los calcules tú."}
  ]'::jsonb,
  updated_at = now()
where id = '13820da3-dcf5-543d-8415-a79fb06177cf' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · respuesta a terapia con radiofármacos',
  description = 'Seguimiento después de una terapia o un estudio con radiofármacos (por ejemplo yodo radiactivo): evolución, efectos adversos, cumplimiento de radioprotección, laboratorios de control transcritos literal y ajuste del plan.',
  sections = '[
    {"key":"diagnostico_y_terapia_recibida","label":"Diagnóstico y terapia recibida","order":1,"required":true,"instruction":"Registra el diagnóstico de base y la terapia o el estudio previo que se controla: radiofármaco, fecha y actividad administrada transcritos literal tal como se citaron (mCi o MBq). Nunca recalcules ni conviertas unidades."},
    {"key":"intervalo_y_evolucion","label":"Intervalo y evolución","order":2,"required":false,"instruction":"Documenta el tiempo transcurrido desde la terapia o el último control y la evolución clínica relatada por el paciente en ese intervalo. Solo lo dicho en la consulta."},
    {"key":"radioproteccion_y_adherencia","label":"Radioprotección y adherencia","order":3,"required":false,"instruction":"Registra el cumplimiento referido de las medidas de radioprotección (aislamiento, distancia de niños y embarazadas, manejo de excretas) y la adherencia al tratamiento acompañante, tal como el paciente lo relató. No califiques la adherencia por tu cuenta."},
    {"key":"efectos_adversos","label":"Efectos adversos","order":4,"required":false,"instruction":"Documenta los efectos adversos referidos (sialoadenitis, náuseas, xerostomía, cambios del gusto u otros) o su negación explícita, con las palabras de la consulta. No listes efectos esperables que nadie mencionó."},
    {"key":"resultados_nuevos","label":"Resultados nuevos","order":5,"required":false,"instruction":"Transcribe los laboratorios y estudios de control con el valor literal leído en consulta (TSH, tiroglobulina, anticuerpos, rastreo postratamiento) y su fecha si se dijo. Nunca calcules tendencias ni completes valores faltantes."},
    {"key":"examen_de_control","label":"Examen de control","order":6,"required":true,"instruction":"Describe el examen dirigido realizado: región tratada o estudiada, hallazgos locales con las medidas dictadas literal y signos vitales si se tomaron. No completes lo no examinado."},
    {"key":"evaluacion_de_respuesta","label":"Evaluación de respuesta","order":7,"required":true,"instruction":"Redacta la evaluación de respuesta tal como el especialista la formuló (respuesta excelente, indeterminada, incompleta u otra categoría solo si él la enunció) y su análisis del conjunto de datos. No asignes categorías de respuesta por tu cuenta."},
    {"key":"ajuste_del_plan_y_proximo_control","label":"Ajuste del plan y próximo control","order":8,"required":true,"instruction":"Registra la conducta: continuar vigilancia, nueva dosis o estudio con los valores literales indicados, ajuste del tratamiento acompañante, remisiones y fecha del próximo control con los exámenes que debe traer, solo lo indicado en consulta."}
  ]'::jsonb,
  updated_at = now()
where id = '04abc1e8-b015-5dbe-b38a-58b4d84eb343' and owner_id is null;

update public.clinical_templates set
  name = 'Procedimiento · administración de radiofármaco terapéutico',
  description = 'Administración de una dosis terapéutica de radiofármaco: verificación previa y consentimiento, radiofármaco y actividad transcritos literal, tolerancia inmediata e indicaciones de radioprotección al alta.',
  sections = '[
    {"key":"indicacion_y_contexto","label":"Indicación y contexto","order":1,"required":true,"instruction":"Documenta la indicación de la dosis terapéutica y el diagnóstico que la sustenta tal como se enunciaron, con el servicio remitente o la autorización de la EPS si se mencionó."},
    {"key":"verificacion_previa_y_consentimiento","label":"Verificación previa y consentimiento","order":2,"required":false,"instruction":"Registra la verificación previa: prueba de embarazo con el resultado literal, suspensión de lactancia y de medicamentos con los tiempos dichos, ayuno y consentimiento informado explicado y firmado. Si un punto no se verbalizó, indícalo; no lo des por cumplido."},
    {"key":"radiofarmaco_y_dosis","label":"Radiofármaco y dosis administrada","order":3,"required":true,"instruction":"Transcribe el radiofármaco administrado, la actividad con su unidad (mCi o MBq) y la vía, exactamente como se dictaron. Nunca calcules, redondees ni conviertas la dosis; si la cifra no se dijo, deja constancia de que no se dictó."},
    {"key":"administracion_y_tolerancia","label":"Administración y tolerancia","order":4,"required":false,"instruction":"Describe cómo se administró la dosis y la tolerancia inmediata del paciente tal como se narró, incluidas medidas simultáneas (hidratación, protección gástrica) solo si se mencionaron."},
    {"key":"complicaciones_inmediatas","label":"Complicaciones inmediatas","order":5,"required":false,"instruction":"Registra complicaciones inmediatas o reacciones tal como se verbalizaron, o la constancia explícita de que no las hubo. No enumeres riesgos teóricos como si hubieran ocurrido."},
    {"key":"indicaciones_de_radioproteccion","label":"Indicaciones de radioprotección","order":6,"required":true,"instruction":"Registra las indicaciones de radioprotección explicadas al paciente: aislamiento y su duración con los días literales dichos, distancia de niños y embarazadas, manejo de baño y utensilios, y retorno laboral. No fijes tú tiempos que el médico no dijo."},
    {"key":"seguimiento_y_rastreo","label":"Seguimiento y rastreo posterapia","order":7,"required":false,"instruction":"Documenta el seguimiento indicado: rastreo postratamiento con la fecha prevista, laboratorios de control y cita de revisión, tal como se programaron en la consulta."},
    {"key":"entrega_de_recomendaciones","label":"Entrega de recomendaciones","order":8,"required":false,"instruction":"Anota si se entregaron recomendaciones escritas o carné de radioprotección y a quién contactar ante dudas o síntomas, solo si se mencionó."}
  ]'::jsonb,
  updated_at = now()
where id = 'ee44b924-c1bc-59fa-af9f-d5530a49562b' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c6000000-0000-4000-8000-000000000003', null,
   'Informe de gammagrafía o PET',
   'Informe del estudio gammagráfico, SPECT o PET dictado por el especialista: radiofármaco y dosis literales, protocolo de adquisición, hallazgos funcionales con SUV transcritos, comparación solo si se hizo e impresión diagnóstica. Úsala al dictar el informe del estudio.',
   'medicina_nuclear', 'Medicina nuclear', 'institutional', false, 'active',
   '[
    {"key":"datos_del_estudio","label":"Datos del estudio","order":1,"required":true,"instruction":"Registra el tipo de estudio (gammagrafía, SPECT, SPECT-CT, PET-CT), la fecha si se dijo y el servicio o médico remitente, tal como se dictaron al inicio del informe."},
    {"key":"indicacion_del_estudio","label":"Indicación del estudio","order":2,"required":true,"instruction":"Transcribe la indicación clínica del estudio como la enunció el especialista. No la deduzcas de los hallazgos ni la amplíes con datos de la historia que no se dictaron."},
    {"key":"radiofarmaco_y_dosis","label":"Radiofármaco y dosis","order":3,"required":false,"instruction":"Transcribe el radiofármaco utilizado y la actividad administrada con su unidad exactamente como se dictaron, junto con la vía y el tiempo de captación si se mencionaron. Nunca calcules ni conviertas la dosis; si no se dictó, indícalo."},
    {"key":"protocolo_y_adquisicion","label":"Protocolo y adquisición","order":4,"required":false,"instruction":"Documenta el protocolo solo si se dictó: proyecciones, fases, tiempo de adquisición, uso de CT de atenuación y glucemia previa con el valor literal. No describas protocolos estándar que no se mencionaron."},
    {"key":"hallazgos","label":"Hallazgos","order":5,"required":true,"instruction":"Redacta los hallazgos en el orden dictado: distribución del radiofármaco, zonas hipercaptantes o hipocaptantes con su localización, y valores de SUV o medidas transcritos literal como se dijeron. Nunca calcules SUV, porcentajes de captación ni medidas; no agregues regiones no descritas."},
    {"key":"comparacion_con_previos","label":"Comparación con estudios previos","order":6,"required":false,"instruction":"Incluye la comparación con estudios previos únicamente si el especialista la hizo, con las fechas y los valores literales citados. Si no comparó, indícalo; no inventes estudios anteriores."},
    {"key":"limitaciones_del_estudio","label":"Limitaciones del estudio","order":7,"required":false,"instruction":"Registra las limitaciones del estudio que se dictaron (movimiento, glucemia elevada, artefactos). Si no se mencionaron, no agregues ninguna."},
    {"key":"impresion_diagnostica","label":"Impresión diagnóstica","order":8,"required":true,"instruction":"Transcribe la impresión o conclusión del estudio con la precisión con que se formuló, incluidas categorías o escalas (por ejemplo Deauville) solo si el especialista las enunció. No conviertas descripciones en diagnósticos no dictados."},
    {"key":"recomendaciones","label":"Recomendaciones","order":9,"required":true,"instruction":"Registra las recomendaciones dictadas: correlación clínica o con otras imágenes, estudios complementarios y control sugerido con el intervalo dicho. No propongas conductas por tu cuenta."}
  ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();

-- ============================================================================
-- GENÉTICA MÉDICA
-- ============================================================================

update public.clinical_templates set
  name = 'Consulta inicial · evaluación clínica y fenotipo',
  description = 'Primera consulta de genética: motivo de remisión, historia del desarrollo, árbol familiar descrito en consulta, examen dismorfológico, estudios previos transcritos literal y plan de estudios genéticos con consentimiento.',
  sections = '[
    {"key":"motivo_de_consulta_y_remision","label":"Motivo de consulta y remisión","order":1,"required":true,"instruction":"Documenta el motivo de la consulta en las palabras del paciente o su acudiente y quién remite (especialidad, EPS) con la pregunta que se busca resolver, tal como se dijo."},
    {"key":"historia_del_desarrollo","label":"Enfermedad actual e historia del desarrollo","order":2,"required":false,"instruction":"Cronología del cuadro: inicio de los signos, evolución y, en niños, hitos del desarrollo alcanzados o rezagados tal como se relataron. No completes hitos ni edades que no se mencionaron."},
    {"key":"antecedentes_personales_y_perinatales","label":"Antecedentes personales y perinatales","order":3,"required":false,"instruction":"Registra antecedentes perinatales (embarazo, exposiciones, parto, tamizajes) y personales (hospitalizaciones, cirugías, convulsiones, alergias) únicamente con lo dicho. Si un antecedente no se exploró, indícalo."},
    {"key":"arbol_familiar","label":"Árbol familiar","order":4,"required":false,"instruction":"Describe el árbol familiar tal como se construyó en consulta: generaciones exploradas, familiares afectados con su parentesco, consanguinidad y origen geográfico si se mencionaron. Incluye solo los familiares nombrados; no completes la genealogía ni asumas estados de salud."},
    {"key":"examen_fisico_y_fenotipo","label":"Examen físico y fenotipo","order":5,"required":true,"instruction":"Documenta el examen dismorfológico con los términos exactos que el médico dictó (rasgos faciales, extremidades, piel, perímetro cefálico y otras medidas transcritas literal). Nunca calcules percentiles ni desviaciones; regístralos solo si él los enunció. No describas rasgos no examinados."},
    {"key":"estudios_previos","label":"Estudios previos","order":6,"required":false,"instruction":"Transcribe los estudios previos citados (cariotipo, microarreglos, paneles, exoma, metabólicos) con el resultado literal leído en consulta y el laboratorio si se dijo. No reinterpretes ni reclasifiques resultados."},
    {"key":"analisis_e_impresion","label":"Análisis e impresión diagnóstica","order":7,"required":true,"instruction":"Redacta la hipótesis diagnóstica con la precisión con que el médico la formuló, incluido el patrón de herencia sospechado solo si él lo enunció. Deja explícitos los diferenciales considerados; no agregues síndromes no mencionados."},
    {"key":"plan_de_estudios_y_consentimiento","label":"Plan de estudios y consentimiento","order":8,"required":true,"instruction":"Registra los estudios genéticos solicitados con su nombre exacto tal como se dictó, el proceso de consentimiento explicado, los trámites de autorización con la EPS y las remisiones. No sustituyas el nombre del estudio por otro equivalente."},
    {"key":"educacion_y_proximo_paso","label":"Educación y próximo paso","order":9,"required":false,"instruction":"Documenta lo explicado a la familia sobre el proceso, los tiempos de resultados solo si se dijeron y la próxima cita. Solo lo conversado en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = '64630657-f299-5c74-a970-534f08d4ec61' and owner_id is null;

update public.clinical_templates set
  name = 'Control y seguimiento · enfermedad genética confirmada',
  description = 'Seguimiento de un paciente con diagnóstico genético establecido: evolución por sistemas, adherencia al manejo, resultados nuevos transcritos literal, vigilancia de complicaciones y coordinación multidisciplinaria.',
  sections = '[
    {"key":"diagnostico_y_evolucion","label":"Diagnóstico confirmado y evolución","order":1,"required":true,"instruction":"Registra el diagnóstico genético confirmado con el gen y la variante transcritos literal tal como se citaron, y la evolución desde el último control relatada en consulta. No reescribas ni corrijas la nomenclatura de la variante."},
    {"key":"intervalo_y_adherencia","label":"Intervalo y adherencia","order":2,"required":false,"instruction":"Documenta el tiempo desde el último control, la adherencia al manejo (medicamentos, terapias, dieta) y las barreras referidas (autorizaciones de la EPS, acceso a terapias), solo con lo dicho."},
    {"key":"sintomas_y_cambios_por_sistemas","label":"Síntomas y cambios por sistemas","order":3,"required":false,"instruction":"Registra síntomas nuevos o cambios por sistemas relatados por el paciente o su cuidador. Si se refirió estabilidad, escríbelo así; no asumas la ausencia de síntomas que no se preguntaron."},
    {"key":"resultados_nuevos","label":"Resultados nuevos","order":4,"required":false,"instruction":"Transcribe los paraclínicos y las valoraciones de otras especialidades citados, con el valor o la conclusión literal y su fecha si se dijo. Nunca calcules tendencias ni completes resultados faltantes."},
    {"key":"examen_de_control","label":"Examen de control","order":5,"required":true,"instruction":"Describe el examen dirigido realizado con las medidas dictadas literal (peso, talla, perímetro cefálico) y los hallazgos por sistemas explorados. Nunca calcules percentiles; regístralos solo si el médico los enunció. No completes lo no examinado."},
    {"key":"vigilancia_de_complicaciones","label":"Vigilancia de complicaciones","order":6,"required":false,"instruction":"Registra la vigilancia propia de la enfermedad revisada en la consulta (por ejemplo valoraciones cardiológica, oftalmológica o auditiva) con su estado: hecha, pendiente o vencida, tal como se comentó. No agregues tamizajes que no se mencionaron."},
    {"key":"analisis_y_estado_global","label":"Análisis y estado global","order":7,"required":true,"instruction":"Redacta la valoración global del médico sobre el estado de la enfermedad (estable, en progresión, controlada) con las palabras que usó, y su análisis de los resultados revisados. No emitas juicios de evolución que él no formuló."},
    {"key":"ajuste_del_plan","label":"Ajuste del plan","order":8,"required":true,"instruction":"Registra los ajustes del manejo indicados con las dosis transcritas literal, las remisiones y órdenes nuevas, y los soportes solicitados (incapacidad, informes para el colegio) solo si se indicaron."},
    {"key":"proximo_control_y_alarmas","label":"Próximo control y signos de alarma","order":9,"required":false,"instruction":"Documenta la fecha o el intervalo del próximo control, qué debe traer el paciente y los signos de alarma explicados para consultar antes. Solo lo dicho en la consulta."}
  ]'::jsonb,
  updated_at = now()
where id = '2ee8d279-1672-5f73-b006-d06202b0dbf5' and owner_id is null;

update public.clinical_templates set
  name = 'Procedimiento · consentimiento y toma de muestra para estudio genético',
  description = 'Sesión de toma de muestra para estudio genético: información dada sobre alcances y límites, consentimiento informado, tipo de muestra y rótulo transcritos literal, laboratorio de destino y tiempos de entrega enunciados.',
  sections = '[
    {"key":"indicacion_del_estudio","label":"Indicación del estudio","order":1,"required":true,"instruction":"Documenta el estudio genético que se realizará con su nombre exacto tal como se dictó y la indicación clínica que lo sustenta, con la autorización de la EPS si se mencionó."},
    {"key":"informacion_previa","label":"Información previa al consentimiento","order":2,"required":false,"instruction":"Registra lo que el médico explicó antes del consentimiento: alcance y límites del estudio, posibilidad de hallazgos secundarios o incidentales, implicaciones para otros familiares y confidencialidad, únicamente los puntos que sí se hablaron."},
    {"key":"consentimiento_informado","label":"Consentimiento informado","order":3,"required":false,"instruction":"Documenta el proceso de consentimiento: quién lo otorga (paciente, padres o acudiente), que fue voluntario, las preguntas resueltas y la decisión sobre hallazgos secundarios solo si se discutió. Si algo quedó pendiente, regístralo."},
    {"key":"muestra_y_toma","label":"Muestra y toma","order":4,"required":true,"instruction":"Registra el tipo de muestra tomada (sangre, saliva, otro) y el procedimiento tal como se narró, con el número de tubos y los identificadores del rótulo transcritos literal. Incluye la verificación de identidad del paciente si se verbalizó. No inventes datos del rótulo."},
    {"key":"laboratorio_y_envio","label":"Laboratorio y envío","order":5,"required":false,"instruction":"Documenta el laboratorio de destino y el nombre exacto del estudio enviado tal como se dictaron, con las condiciones de transporte o almacenamiento solo si se mencionaron."},
    {"key":"tolerancia_e_incidencias","label":"Tolerancia e incidencias","order":6,"required":false,"instruction":"Registra la tolerancia del paciente a la toma y cualquier incidencia (punción fallida, muestra insuficiente) o la constancia de que no las hubo, con lo verbalizado en la sesión."},
    {"key":"indicaciones_posteriores","label":"Indicaciones posteriores","order":7,"required":true,"instruction":"Registra las indicaciones dadas: cuidados del sitio de punción, tiempos estimados de resultado únicamente si el médico los dijo, y cómo se entregará el resultado (cita de asesoría). No prometas plazos que no se enunciaron."},
    {"key":"proximo_paso","label":"Próximo paso","order":8,"required":false,"instruction":"Documenta la próxima cita programada y con quién, y los datos de contacto del servicio si se dieron. Solo lo mencionado."}
  ]'::jsonb,
  updated_at = now()
where id = '13973185-0880-5521-a565-f96fea98b9ad' and owner_id is null;

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  ('c6000000-0000-4000-8000-000000000004', null,
   'Asesoría genética · resultados y plan familiar',
   'Consulta de asesoría posterior al resultado: hallazgo transcrito literal con su nomenclatura, explicación dada al paciente, riesgo de recurrencia solo si el médico lo enunció, estudio en cascada de familiares y opciones reproductivas discutidas.',
   'genetica', 'Genética médica', 'institutional', false, 'active',
   '[
    {"key":"motivo_de_la_asesoria","label":"Motivo de la asesoría","order":1,"required":true,"instruction":"Documenta el motivo de la sesión de asesoría (entrega de resultado, riesgo reproductivo, antecedente familiar) y quiénes asisten, tal como se presentó en la consulta."},
    {"key":"arbol_familiar_actualizado","label":"Árbol familiar actualizado","order":2,"required":false,"instruction":"Registra el árbol familiar tal como se describió o actualizó en la sesión: familiares afectados con su parentesco, consanguinidad y nuevos casos desde la última consulta. Solo los familiares nombrados; no completes la genealogía."},
    {"key":"resultado_del_estudio","label":"Resultado del estudio","order":3,"required":true,"instruction":"Transcribe el resultado literal tal como se leyó: gen, variante con su nomenclatura exacta, cigosidad y clasificación (patogénica, VUS u otra) únicamente si el médico la enunció. Nunca reclasifiques, corrijas ni completes la nomenclatura; si un dato no se leyó, indícalo."},
    {"key":"explicacion_dada","label":"Explicación dada al paciente","order":4,"required":false,"instruction":"Documenta cómo el médico explicó el significado del resultado, incluido el patrón de herencia solo si él lo enunció, y en los términos que usó con la familia. No agregues explicaciones técnicas que no se dieron."},
    {"key":"riesgo_de_recurrencia","label":"Riesgo de recurrencia","order":5,"required":false,"instruction":"Registra las cifras de riesgo de recurrencia u ocurrencia únicamente si el médico las dijo, transcritas literal. Nunca calcules porcentajes de riesgo a partir del patrón de herencia; si no se habló de cifras, indícalo."},
    {"key":"implicaciones_familiares","label":"Implicaciones familiares y estudio en cascada","order":6,"required":false,"instruction":"Documenta la recomendación de estudio en cascada: qué familiares se sugirió estudiar y cómo, solo los mencionados en la sesión. Registra si se entregó carta o informe para los familiares."},
    {"key":"opciones_reproductivas","label":"Opciones reproductivas discutidas","order":7,"required":false,"instruction":"Registra las opciones reproductivas discutidas (diagnóstico prenatal, preimplantacional, donación, adopción) únicamente si se hablaron, con la postura expresada por la familia si la manifestó. No sugieras opciones no mencionadas."},
    {"key":"aspectos_emocionales_y_apoyo","label":"Aspectos emocionales y apoyo","order":8,"required":false,"instruction":"Documenta la reacción emocional observada o expresada y el apoyo ofrecido (psicología, grupos de pacientes, trabajo social) tal como ocurrió en la sesión, con respeto y sin juicios de valor."},
    {"key":"plan_y_remisiones","label":"Plan y remisiones","order":9,"required":true,"instruction":"Registra el plan acordado: estudios para el paciente o sus familiares con el nombre exacto dictado, remisiones, trámites con la EPS y soportes entregados, únicamente lo indicado en la sesión."},
    {"key":"proximo_contacto","label":"Próximo contacto","order":10,"required":false,"instruction":"Documenta la próxima cita o la vía de contacto con el servicio y los compromisos de la familia, solo si se acordaron."}
  ]'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialty_code = excluded.specialty_code,
  specialty_name = excluded.specialty_name,
  sections = excluded.sections,
  updated_at = now();
