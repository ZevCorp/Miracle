import type { Consultation, NoteSection } from "./types";

// Fecha de referencia de la demo (la más reciente se considera "hoy").
export const MOCK_TODAY = "2026-06-20";

function recomendaciones(items: string[]): NoteSection {
  return { id: "recomendaciones", titulo: "Recomendaciones", kind: "lista", items };
}

export const consultations: Consultation[] = [
  // ---- c1 · Showcase: asma (borrador, hoy) ----
  {
    id: "c1",
    pacienteId: "p1",
    medicoId: "d1",
    servicio: "Consulta externa",
    especialidad: "Medicina interna",
    tipo: "presencial",
    estado: "borrador",
    fecha: "2026-06-20T14:30:00",
    duracionMin: 12,
    plantilla: "Consulta general adulto",
    motivo: "Dificultad para respirar y tos de 5 días",
    note: [
      {
        id: "identificacion",
        titulo: "Identificación",
        kind: "texto",
        texto: "Paciente femenina de 28 años, con antecedente de asma bronquial en la infancia.",
      },
      {
        id: "motivo",
        titulo: "Motivo de consulta",
        kind: "texto",
        texto: "“Tengo dificultad para respirar y tos desde hace cinco días”.",
      },
      {
        id: "enfermedad_actual",
        titulo: "Enfermedad actual",
        kind: "texto",
        texto:
          "Cuadro de 5 días de evolución consistente en disnea progresiva, tos y sibilancias de predominio nocturno. Refiere mayor uso del inhalador de rescate durante la última semana. Niega fiebre, dolor torácico u otros síntomas asociados.",
      },
      {
        id: "antecedentes",
        titulo: "Antecedentes",
        kind: "texto",
        texto:
          "Patológicos: asma bronquial desde la infancia. Quirúrgicos: niega. Alérgicos: no refiere. Farmacológicos: salbutamol inhalado a demanda.",
        colapsadaPorDefecto: true,
      },
      {
        id: "examen_fisico",
        titulo: "Examen físico",
        kind: "texto",
        texto:
          "Paciente en aceptables condiciones generales, alerta, afebril. Auscultación pulmonar con sibilancias espiratorias difusas. Signos vitales por confirmar.",
      },
      {
        id: "analisis",
        titulo: "Análisis",
        kind: "texto",
        texto:
          "Probable exacerbación de asma bronquial de intensidad leve a moderada. Pendiente correlación con saturación de oxígeno y respuesta a broncodilatador.",
      },
      {
        id: "plan",
        titulo: "Plan",
        kind: "lista",
        items: [
          "Broncodilatador inhalado según indicación médica.",
          "Medición de saturación de oxígeno.",
          "Educación sobre técnica inhalatoria.",
          "Control en 48 horas o antes si hay signos de alarma.",
        ],
      },
      recomendaciones([
        "Use el inhalador según la indicación del médico.",
        "Evite humo, polvo y cambios bruscos de temperatura.",
        "Acuda a urgencias si presenta dificultad respiratoria marcada.",
        "Consulte si aparece fiebre o el silbido en el pecho empeora.",
      ]),
    ],
    transcript: [
      { t: "00:08", hablante: "Médico", texto: "¿Hace cuánto presenta la dificultad para respirar y la tos?" },
      { t: "00:14", hablante: "Paciente", texto: "Como cinco días. En las noches me cuesta más y silba el pecho." },
      { t: "00:29", hablante: "Médico", texto: "¿Ha usado el inhalador? ¿Tiene antecedente de asma?" },
      { t: "00:35", hablante: "Paciente", texto: "Sí, asma desde niña. Esta semana lo usé más de lo normal." },
      { t: "00:48", hablante: "Médico", texto: "¿Ha tenido fiebre o dolor en el pecho?" },
      { t: "00:52", hablante: "Paciente", texto: "Fiebre no. Dolor tampoco, solo la dificultad para respirar." },
    ],
    resumen:
      "Paciente femenina de 28 años con antecedente de asma bronquial, quien consulta por cuadro de 5 días de disnea, tos y sibilancias de predominio nocturno, con mayor uso de broncodilatador de rescate. Al examen físico se documentan sibilancias espiratorias difusas, sin fiebre ni compromiso hemodinámico evidente. Se plantea probable exacerbación asmática leve a moderada; se indica manejo broncodilatador, medición de saturación y control en 48 horas con educación sobre signos de alarma.",
    codigos: [
      { id: "k1", sistema: "CIE-10", codigo: "J45.9", descripcion: "Asma, no especificada", confianza: 88, estado: "sugerido" },
      { id: "k2", sistema: "CUPS", codigo: "890201", descripcion: "Consulta de primera vez por medicina especializada", confianza: 94, estado: "sugerido" },
      { id: "k3", sistema: "CUPS", codigo: "903841", descripcion: "Oximetría de pulso", confianza: 72, estado: "sugerido" },
    ],
    auditoria: [
      { id: "a1", fecha: "2026-06-20T14:42:00", actor: "Miracle IA", accion: "Nota generada por IA", detalle: "A partir de transcripción de 12 minutos." },
    ],
  },

  // ---- c2 · Lesión dorsal (revisada, hoy) ----
  {
    id: "c2",
    pacienteId: "p3",
    medicoId: "d2",
    servicio: "Consulta externa",
    especialidad: "Medicina general",
    tipo: "presencial",
    estado: "revisada",
    fecha: "2026-06-20T14:02:00",
    duracionMin: 9,
    plantilla: "Consulta general adulto",
    motivo: "“Tengo una masa en la espalda”",
    note: [
      { id: "identificacion", titulo: "Identificación", kind: "texto", texto: "Paciente femenina de 18 años, sin antecedentes patológicos relevantes." },
      { id: "motivo", titulo: "Motivo de consulta", kind: "texto", texto: "“Tengo una masa en la espalda”." },
      {
        id: "enfermedad_actual",
        titulo: "Enfermedad actual",
        kind: "texto",
        texto:
          "Paciente de 18 años que consulta por lesión en región dorsal y, adicionalmente, por dolor abdominal. Niega antecedentes patológicos, quirúrgicos y alérgicos de relevancia.",
      },
      { id: "examen_fisico", titulo: "Examen físico", kind: "texto", texto: "Paciente en aceptables condiciones generales, alerta, activa, afebril e hidratada, sin dificultad respiratoria. Abdomen blando, no doloroso a la palpación, sin masas ni signos de irritación peritoneal.", colapsadaPorDefecto: true },
      { id: "analisis", titulo: "Análisis", kind: "texto", texto: "Paciente de 18 años con lesión en región dorsal y dolor abdominal, sin antecedentes patológicos previos, sin antecedentes quirúrgicos y sin alergias conocidas." },
      {
        id: "plan",
        titulo: "Plan",
        kind: "lista",
        items: [
          "Medidas locales para el cuidado de la lesión dorsal.",
          "Manejo sintomático de la molestia abdominal.",
          "Vigilancia de signos de alarma.",
        ],
      },
      recomendaciones([
        "Mantenga la zona de la espalda limpia y seca.",
        "Evite rascarse, apretar o manipular la lesión.",
        "Use ropa cómoda que no roce demasiado la zona.",
        "Observe si la lesión cambia de tamaño, color o dolor.",
        "Consulte si el dolor de estómago empeora o se vuelve intenso.",
      ]),
    ],
    transcript: [
      { t: "00:05", hablante: "Médico", texto: "Cuénteme, ¿qué la trae a consulta?" },
      { t: "00:09", hablante: "Paciente", texto: "Tengo una masa en la espalda y también me ha dolido el estómago." },
      { t: "00:21", hablante: "Médico", texto: "¿Desde cuándo notó la lesión? ¿Le duele?" },
      { t: "00:27", hablante: "Paciente", texto: "Hace unos días. No me duele mucho, pero me preocupa." },
    ],
    resumen:
      "Paciente de 18 años, sin antecedentes patológicos relevantes, sin antecedentes quirúrgicos y sin alergias, quien consultó inicialmente por masa en la espalda asociada a dolor dorsal y adicionalmente dolor abdominal. Al examen físico se documenta paciente en aceptables condiciones generales, con abdomen blando, no doloroso, sin masas ni signos de irritación peritoneal. Se indican medidas locales para el cuidado de la lesión dorsal y recomendaciones generales para la molestia abdominal, con vigilancia de signos de alarma.",
    codigos: [
      { id: "k1", sistema: "CIE-10", codigo: "R22.2", descripcion: "Tumefacción, masa o prominencia localizada en el tronco", confianza: 80, estado: "aceptado" },
      { id: "k2", sistema: "CIE-10", codigo: "R10.4", descripcion: "Otros dolores abdominales y los no especificados", confianza: 76, estado: "sugerido" },
      { id: "k3", sistema: "CUPS", codigo: "890301", descripcion: "Consulta de control o de seguimiento por medicina general", confianza: 91, estado: "aceptado" },
    ],
    auditoria: [
      { id: "a1", fecha: "2026-06-20T14:11:00", actor: "Miracle IA", accion: "Nota generada por IA" },
      { id: "a2", fecha: "2026-06-20T14:16:00", actor: "Dr. Felipe Castaño", accion: "Código aceptado", detalle: "CIE-10 R22.2" },
      { id: "a3", fecha: "2026-06-20T14:18:00", actor: "Dr. Felipe Castaño", accion: "Nota marcada como revisada" },
    ],
  },

  // ---- c3 · HTA/DM control (aprobada, ayer) ----
  {
    id: "c3",
    pacienteId: "p2",
    medicoId: "d1",
    servicio: "Consulta externa",
    especialidad: "Medicina interna",
    tipo: "presencial",
    estado: "aprobada",
    fecha: "2026-06-19T10:20:00",
    duracionMin: 14,
    plantilla: "Control enfermedad crónica",
    motivo: "Control de hipertensión y diabetes",
    note: [
      { id: "identificacion", titulo: "Identificación", kind: "texto", texto: "Paciente masculino de 54 años con hipertensión arterial y diabetes mellitus tipo 2 en seguimiento." },
      { id: "motivo", titulo: "Motivo de consulta", kind: "texto", texto: "Control de enfermedades crónicas." },
      { id: "enfermedad_actual", titulo: "Enfermedad actual", kind: "texto", texto: "Refiere adecuada adherencia al tratamiento. Sin síntomas cardiovasculares actuales. Glucometrías en rangos aceptables según refiere." },
      { id: "examen_fisico", titulo: "Examen físico", kind: "texto", texto: "Tensión arterial controlada en consulta. Examen cardiopulmonar sin alteraciones. Sin edemas.", colapsadaPorDefecto: true },
      { id: "analisis", titulo: "Análisis", kind: "texto", texto: "Hipertensión arterial y diabetes mellitus tipo 2 con adecuado control clínico." },
      { id: "plan", titulo: "Plan", kind: "lista", items: ["Continuar tratamiento actual.", "Solicitar perfil metabólico y función renal.", "Control en 3 meses."] },
      recomendaciones(["Mantenga dieta baja en sal y azúcares.", "Realice actividad física según tolerancia.", "Continúe la toma de medicamentos sin suspenderlos."]),
    ],
    transcript: [
      { t: "00:06", hablante: "Médico", texto: "¿Cómo ha estado con los medicamentos y las glucometrías?" },
      { t: "00:12", hablante: "Paciente", texto: "Bien, los he tomado juiciosos. El azúcar me ha dado más o menos normal." },
    ],
    resumen:
      "Paciente masculino de 54 años con hipertensión arterial y diabetes mellitus tipo 2, en control, con adecuada adherencia y sin síntomas actuales. Se documenta control clínico aceptable; se continúa tratamiento, se solicitan paraclínicos de seguimiento y se programa control en 3 meses.",
    codigos: [
      { id: "k1", sistema: "CIE-10", codigo: "I10", descripcion: "Hipertensión esencial (primaria)", confianza: 95, estado: "aceptado" },
      { id: "k2", sistema: "CIE-10", codigo: "E11.9", descripcion: "Diabetes mellitus tipo 2 sin complicaciones", confianza: 92, estado: "aceptado" },
      { id: "k3", sistema: "CUPS", codigo: "890301", descripcion: "Consulta de control o de seguimiento por medicina especializada", confianza: 93, estado: "aceptado" },
    ],
    auditoria: [
      { id: "a1", fecha: "2026-06-19T10:34:00", actor: "Miracle IA", accion: "Nota generada por IA" },
      { id: "a2", fecha: "2026-06-19T10:40:00", actor: "Dra. Daniela Rincón", accion: "Códigos aceptados", detalle: "I10, E11.9" },
      { id: "a3", fecha: "2026-06-19T10:41:00", actor: "Dra. Daniela Rincón", accion: "Nota aprobada" },
    ],
  },

  // ---- c4 · Lumbalgia urgencias (exportada, anteayer) ----
  {
    id: "c4",
    pacienteId: "p4",
    medicoId: "d2",
    servicio: "Urgencias",
    especialidad: "Medicina general",
    tipo: "presencial",
    estado: "exportada",
    fecha: "2026-06-18T22:38:00",
    duracionMin: 7,
    plantilla: "Atención de urgencias",
    motivo: "Dolor lumbar agudo",
    note: [
      { id: "identificacion", titulo: "Identificación", kind: "texto", texto: "Paciente masculino de 41 años con lumbalgia mecánica recurrente." },
      { id: "motivo", titulo: "Motivo de consulta", kind: "texto", texto: "Dolor lumbar de inicio agudo tras esfuerzo." },
      { id: "enfermedad_actual", titulo: "Enfermedad actual", kind: "texto", texto: "Dolor lumbar mecánico tras levantar peso, sin irradiación a miembros inferiores, sin déficit neurológico ni alteración de esfínteres." },
      { id: "analisis", titulo: "Análisis", kind: "texto", texto: "Lumbalgia mecánica aguda sin signos de alarma." },
      { id: "plan", titulo: "Plan", kind: "lista", items: ["Analgesia y relajante muscular según indicación.", "Reposo relativo y calor local.", "Signos de alarma explicados."] },
      recomendaciones(["Evite cargar peso durante unos días.", "Aplique calor local en la zona.", "Consulte si aparece debilidad o pérdida de control de esfínteres."]),
    ],
    transcript: [
      { t: "00:04", hablante: "Médico", texto: "¿Cómo empezó el dolor de espalda?" },
      { t: "00:09", hablante: "Paciente", texto: "Levantando una caja en el trabajo. Me quedó doliendo la cintura." },
    ],
    resumen:
      "Paciente masculino de 41 años con lumbalgia mecánica aguda tras esfuerzo, sin irradiación ni déficit neurológico. Se maneja con analgesia, relajante muscular y medidas generales, con explicación de signos de alarma.",
    codigos: [
      { id: "k1", sistema: "CIE-10", codigo: "M54.5", descripcion: "Lumbago no especificado", confianza: 90, estado: "aceptado" },
      { id: "k2", sistema: "CUPS", codigo: "890201", descripcion: "Consulta de primera vez por medicina general - urgencias", confianza: 88, estado: "aceptado" },
    ],
    auditoria: [
      { id: "a1", fecha: "2026-06-18T22:45:00", actor: "Miracle IA", accion: "Nota generada por IA" },
      { id: "a2", fecha: "2026-06-18T22:49:00", actor: "Dr. Felipe Castaño", accion: "Nota aprobada" },
      { id: "a3", fecha: "2026-06-18T22:50:00", actor: "Dr. Felipe Castaño", accion: "Nota exportada a HC", detalle: "Copiada al sistema de historia clínica." },
    ],
  },

  // ---- c5 · Hipotiroidismo telemedicina (borrador, hoy) ----
  {
    id: "c5",
    pacienteId: "p5",
    medicoId: "d1",
    servicio: "Consulta externa",
    especialidad: "Medicina interna",
    tipo: "telemedicina",
    estado: "borrador",
    fecha: "2026-06-20T11:05:00",
    duracionMin: 11,
    plantilla: "Control enfermedad crónica",
    motivo: "Control de hipotiroidismo",
    note: [
      { id: "identificacion", titulo: "Identificación", kind: "texto", texto: "Paciente femenina de 67 años con hipotiroidismo y osteoartrosis de rodilla." },
      { id: "motivo", titulo: "Motivo de consulta", kind: "texto", texto: "Control de hipotiroidismo y entrega de resultados." },
      { id: "enfermedad_actual", titulo: "Enfermedad actual", kind: "texto", texto: "Refiere mejoría de astenia con la dosis actual de levotiroxina. Persisten molestias articulares en rodilla derecha." },
      { id: "analisis", titulo: "Análisis", kind: "texto", texto: "Hipotiroidismo en tratamiento; pendiente ajuste según TSH. Osteoartrosis de rodilla sintomática." },
      { id: "plan", titulo: "Plan", kind: "lista", items: ["Revisar TSH y ajustar levotiroxina si es necesario.", "Medidas no farmacológicas para osteoartrosis.", "Control en 6 semanas."] },
      recomendaciones(["Tome la levotiroxina en ayunas.", "Realice ejercicios de bajo impacto para la rodilla."]),
    ],
    transcript: [
      { t: "00:07", hablante: "Médico", texto: "¿Cómo se ha sentido con la levotiroxina?" },
      { t: "00:13", hablante: "Paciente", texto: "Mejor del cansancio, doctora. La rodilla sí me sigue molestando." },
    ],
    resumen:
      "Paciente femenina de 67 años con hipotiroidismo en tratamiento, con mejoría sintomática, y osteoartrosis de rodilla sintomática. Se plantea revisar TSH para ajuste de levotiroxina y medidas no farmacológicas para la articulación, con control en 6 semanas.",
    codigos: [
      { id: "k1", sistema: "CIE-10", codigo: "E03.9", descripcion: "Hipotiroidismo, no especificado", confianza: 89, estado: "sugerido" },
      { id: "k2", sistema: "CIE-10", codigo: "M17.1", descripcion: "Otra gonartrosis primaria", confianza: 74, estado: "sugerido" },
      { id: "k3", sistema: "CUPS", codigo: "890301", descripcion: "Consulta de control por medicina especializada", confianza: 90, estado: "sugerido" },
    ],
    auditoria: [
      { id: "a1", fecha: "2026-06-20T11:16:00", actor: "Miracle IA", accion: "Nota generada por IA" },
    ],
  },

  // ---- c6 · Pediatría dermatitis (aprobada, ayer) ----
  {
    id: "c6",
    pacienteId: "p6",
    medicoId: "d2",
    servicio: "Consulta externa",
    especialidad: "Pediatría",
    tipo: "presencial",
    estado: "aprobada",
    fecha: "2026-06-19T16:45:00",
    duracionMin: 10,
    plantilla: "Consulta pediátrica",
    motivo: "Brote de dermatitis",
    note: [
      { id: "identificacion", titulo: "Identificación", kind: "texto", texto: "Paciente masculino de 9 años con dermatitis atópica conocida." },
      { id: "motivo", titulo: "Motivo de consulta", kind: "texto", texto: "Brote de lesiones en pliegues con prurito." },
      { id: "enfermedad_actual", titulo: "Enfermedad actual", kind: "texto", texto: "Exacerbación de dermatitis atópica con prurito en flexuras, sin signos de sobreinfección." },
      { id: "analisis", titulo: "Análisis", kind: "texto", texto: "Dermatitis atópica en exacerbación leve." },
      { id: "plan", titulo: "Plan", kind: "lista", items: ["Emolientes y medidas de cuidado de la piel.", "Manejo tópico según indicación.", "Control si no mejora."] },
      recomendaciones(["Use emolientes varias veces al día.", "Evite jabones fuertes y agua muy caliente."]),
    ],
    transcript: [
      { t: "00:05", hablante: "Médico", texto: "¿Hace cuánto le aparecieron las lesiones al niño?" },
      { t: "00:10", hablante: "Paciente", texto: "Hace como una semana, le pican mucho en los pliegues." },
    ],
    resumen:
      "Paciente masculino de 9 años con dermatitis atópica en exacerbación leve, con prurito en flexuras y sin signos de sobreinfección. Se indican emolientes, manejo tópico y medidas de cuidado de la piel, con control en caso de no mejoría.",
    codigos: [
      { id: "k1", sistema: "CIE-10", codigo: "L20.9", descripcion: "Dermatitis atópica, no especificada", confianza: 91, estado: "aceptado" },
      { id: "k2", sistema: "CUPS", codigo: "890201", descripcion: "Consulta de primera vez por medicina especializada - pediatría", confianza: 90, estado: "aceptado" },
    ],
    auditoria: [
      { id: "a1", fecha: "2026-06-19T16:55:00", actor: "Miracle IA", accion: "Nota generada por IA" },
      { id: "a2", fecha: "2026-06-19T16:59:00", actor: "Dr. Felipe Castaño", accion: "Nota aprobada" },
    ],
  },
];
