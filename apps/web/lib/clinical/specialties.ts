export interface ClinicalSpecialty {
  code: string;
  name: string;
  group: "Clínica" | "Quirúrgica" | "Diagnóstico" | "Salud mental" | "Odontología";
  focus: string;
  followUp: string;
  procedure: string;
}

export const clinicalSpecialties: ClinicalSpecialty[] = [
  { code: "medicina-general", name: "Medicina general", group: "Clínica", focus: "enfermedad actual y tamizajes preventivos", followUp: "respuesta al tratamiento y factores de riesgo", procedure: "atención integral y remisión" },
  { code: "medicina-familiar", name: "Medicina familiar", group: "Clínica", focus: "contexto familiar, curso de vida y riesgo biopsicosocial", followUp: "plan familiar y continuidad del cuidado", procedure: "abordaje familiar y coordinación de red" },
  { code: "medicina-interna", name: "Medicina interna", group: "Clínica", focus: "problemas clínicos complejos y comorbilidades", followUp: "metas clínicas, paraclínicos y adherencia", procedure: "valoración integral de adulto" },
  { code: "pediatria", name: "Pediatría", group: "Clínica", focus: "crecimiento, desarrollo y antecedentes perinatales", followUp: "curvas de crecimiento y esquema de vacunación", procedure: "valoración pediátrica integral" },
  { code: "neonatologia", name: "Neonatología", group: "Clínica", focus: "antecedentes maternos, perinatales y adaptación neonatal", followUp: "ganancia ponderal y evolución neonatal", procedure: "valoración del recién nacido" },
  { code: "ginecologia-obstetricia", name: "Ginecología y obstetricia", group: "Clínica", focus: "antecedentes ginecoobstétricos y salud sexual", followUp: "evolución materna, fetal y signos de alarma", procedure: "valoración ginecológica u obstétrica" },
  { code: "urgencias", name: "Medicina de urgencias", group: "Clínica", focus: "triaje, cronología del evento y signos de alarma", followUp: "respuesta a intervenciones y disposición", procedure: "atención inicial de urgencias" },
  { code: "cardiologia", name: "Cardiología", group: "Clínica", focus: "síntomas cardiovasculares, riesgo y estudios previos", followUp: "síntomas, presión arterial y metas cardiovasculares", procedure: "valoración cardiovascular especializada" },
  { code: "dermatologia", name: "Dermatología", group: "Clínica", focus: "morfología, distribución y evolución de lesiones", followUp: "respuesta cutánea y tolerancia al tratamiento", procedure: "valoración dermatológica y dermatoscopia" },
  { code: "endocrinologia", name: "Endocrinología", group: "Clínica", focus: "síntomas metabólicos, hormonales y resultados de laboratorio", followUp: "metas metabólicas y ajuste terapéutico", procedure: "valoración endocrinológica" },
  { code: "gastroenterologia", name: "Gastroenterología", group: "Clínica", focus: "síntomas digestivos, dieta y estudios endoscópicos", followUp: "síntomas, nutrición y resultados de estudios", procedure: "valoración digestiva especializada" },
  { code: "geriatria", name: "Geriatría", group: "Clínica", focus: "funcionalidad, fragilidad, cognición y red de apoyo", followUp: "capacidad funcional, caídas y polifarmacia", procedure: "valoración geriátrica integral" },
  { code: "hematologia", name: "Hematología", group: "Clínica", focus: "síntomas hematológicos, sangrado y hemogramas", followUp: "hemograma, eventos adversos y respuesta", procedure: "valoración hematológica" },
  { code: "infectologia", name: "Infectología", group: "Clínica", focus: "exposición, foco infeccioso y antimicrobianos previos", followUp: "fiebre, cultivos y respuesta antimicrobiana", procedure: "valoración de enfermedad infecciosa" },
  { code: "nefrologia", name: "Nefrología", group: "Clínica", focus: "función renal, líquidos, presión arterial y uroanálisis", followUp: "función renal, electrolitos y nefroprotección", procedure: "valoración renal especializada" },
  { code: "neumologia", name: "Neumología", group: "Clínica", focus: "síntomas respiratorios, exposición y pruebas funcionales", followUp: "disnea, saturación y control inhalatorio", procedure: "valoración respiratoria especializada" },
  { code: "neurologia", name: "Neurología", group: "Clínica", focus: "semiología neurológica, cronología y neuroimágenes", followUp: "déficit neurológico, crisis y funcionalidad", procedure: "valoración neurológica" },
  { code: "oncologia", name: "Oncología clínica", group: "Clínica", focus: "diagnóstico oncológico, estadificación y tratamiento previo", followUp: "toxicidad, respuesta y soporte", procedure: "valoración oncológica" },
  { code: "psiquiatria", name: "Psiquiatría", group: "Salud mental", focus: "síntomas afectivos, pensamiento, riesgo y funcionamiento", followUp: "estado mental, adherencia y riesgo suicida", procedure: "valoración psiquiátrica" },
  { code: "psicologia", name: "Psicología clínica", group: "Salud mental", focus: "motivo de consulta, contexto y recursos de afrontamiento", followUp: "objetivos terapéuticos y evolución emocional", procedure: "valoración psicológica" },
  { code: "reumatologia", name: "Reumatología", group: "Clínica", focus: "dolor inflamatorio, rigidez y compromiso sistémico", followUp: "actividad de enfermedad y tolerancia terapéutica", procedure: "valoración reumatológica" },
  { code: "alergologia", name: "Alergología e inmunología", group: "Clínica", focus: "desencadenantes, reacciones y antecedentes atópicos", followUp: "control de síntomas y exposición a alérgenos", procedure: "valoración alérgica e inmunológica" },
  { code: "dolor-paliativos", name: "Dolor y cuidados paliativos", group: "Clínica", focus: "intensidad de síntomas, funcionalidad y objetivos de cuidado", followUp: "alivio sintomático, efectos adversos y red de apoyo", procedure: "valoración de dolor y cuidado paliativo" },
  { code: "rehabilitacion", name: "Medicina física y rehabilitación", group: "Clínica", focus: "funcionalidad, limitaciones y objetivos de rehabilitación", followUp: "metas funcionales y respuesta al plan", procedure: "valoración de rehabilitación" },
  { code: "medicina-laboral", name: "Medicina laboral", group: "Clínica", focus: "exposición ocupacional, cargo y restricciones", followUp: "evolución laboral y capacidad funcional", procedure: "valoración ocupacional" },
  { code: "medicina-legal", name: "Medicina legal", group: "Clínica", focus: "relato, cronología, hallazgos y cadena de custodia", followUp: "evolución de lesiones y requerimientos periciales", procedure: "valoración médico-legal" },
  { code: "anestesiologia", name: "Anestesiología", group: "Quirúrgica", focus: "riesgo anestésico, vía aérea y antecedentes perioperatorios", followUp: "estado posanestésico y control del dolor", procedure: "valoración preanestésica" },
  { code: "cirugia-general", name: "Cirugía general", group: "Quirúrgica", focus: "síntomas quirúrgicos, abdomen y estudios de apoyo", followUp: "herida, dolor y recuperación posoperatoria", procedure: "valoración quirúrgica" },
  { code: "cirugia-cardiovascular", name: "Cirugía cardiovascular", group: "Quirúrgica", focus: "indicación quirúrgica cardiovascular y riesgo perioperatorio", followUp: "recuperación cardiovascular y complicaciones", procedure: "valoración de cirugía cardiovascular" },
  { code: "cirugia-torax", name: "Cirugía de tórax", group: "Quirúrgica", focus: "síntomas torácicos, función pulmonar e imágenes", followUp: "drenajes, dolor y función respiratoria", procedure: "valoración de cirugía torácica" },
  { code: "cirugia-vascular", name: "Cirugía vascular", group: "Quirúrgica", focus: "síntomas vasculares, pulsos y estudios Doppler", followUp: "perfusión, herida y factores de riesgo", procedure: "valoración vascular periférica" },
  { code: "neurocirugia", name: "Neurocirugía", group: "Quirúrgica", focus: "déficit neurológico, dolor y estudios neuroquirúrgicos", followUp: "evolución neurológica y control de herida", procedure: "valoración neuroquirúrgica" },
  { code: "cirugia-plastica", name: "Cirugía plástica", group: "Quirúrgica", focus: "defecto funcional o estético, piel y tejidos blandos", followUp: "cicatrización, simetría y cuidados", procedure: "valoración de cirugía plástica" },
  { code: "cirugia-pediatrica", name: "Cirugía pediátrica", group: "Quirúrgica", focus: "antecedentes pediátricos, síntomas y evaluación familiar", followUp: "dolor, alimentación y recuperación infantil", procedure: "valoración de cirugía pediátrica" },
  { code: "coloproctologia", name: "Coloproctología", group: "Quirúrgica", focus: "hábito intestinal, síntomas anorrectales y estudios", followUp: "síntomas, continencia y cicatrización", procedure: "valoración coloproctológica" },
  { code: "ortopedia", name: "Ortopedia y traumatología", group: "Quirúrgica", focus: "mecanismo de lesión, dolor, movilidad e imágenes", followUp: "dolor, consolidación y rehabilitación", procedure: "valoración ortopédica" },
  { code: "oftalmologia", name: "Oftalmología", group: "Quirúrgica", focus: "agudeza visual, síntomas oculares y antecedentes", followUp: "visión, presión ocular y adherencia", procedure: "valoración oftalmológica" },
  { code: "otorrinolaringologia", name: "Otorrinolaringología", group: "Quirúrgica", focus: "síntomas de oído, nariz, garganta y audición", followUp: "síntomas, audición y respuesta terapéutica", procedure: "valoración otorrinolaringológica" },
  { code: "urologia", name: "Urología", group: "Quirúrgica", focus: "síntomas urinarios, sexuales y estudios urológicos", followUp: "síntomas, uroflujometría y función renal", procedure: "valoración urológica" },
  { code: "cirugia-maxilofacial", name: "Cirugía oral y maxilofacial", group: "Quirúrgica", focus: "dolor facial, oclusión, trauma e imágenes", followUp: "cicatrización, apertura oral y dolor", procedure: "valoración maxilofacial" },
  { code: "radiologia", name: "Radiología e imágenes diagnósticas", group: "Diagnóstico", focus: "indicación, antecedentes relevantes y estudio solicitado", followUp: "hallazgos, correlación clínica y recomendación", procedure: "informe de estudio de imagen" },
  { code: "patologia", name: "Patología", group: "Diagnóstico", focus: "muestra, contexto clínico y diagnóstico presuntivo", followUp: "correlación histopatológica y estudios complementarios", procedure: "informe anatomopatológico" },
  { code: "medicina-nuclear", name: "Medicina nuclear", group: "Diagnóstico", focus: "indicación, antecedentes y radiofármacos", followUp: "hallazgos funcionales y correlación", procedure: "valoración de medicina nuclear" },
  { code: "genetica", name: "Genética médica", group: "Diagnóstico", focus: "árbol familiar, fenotipo y antecedentes genéticos", followUp: "resultados, consejería y plan familiar", procedure: "valoración genética" },
  { code: "odontologia-general", name: "Odontología general", group: "Odontología", focus: "dolor dental, higiene y antecedentes odontológicos", followUp: "síntomas, control de placa y respuesta", procedure: "valoración odontológica" },
  { code: "endodoncia", name: "Endodoncia", group: "Odontología", focus: "dolor pulpar, pruebas de vitalidad y radiografías", followUp: "dolor, sellado y restauración definitiva", procedure: "valoración endodóntica" },
  { code: "periodoncia", name: "Periodoncia", group: "Odontología", focus: "sangrado gingival, movilidad y periodontograma", followUp: "higiene, inflamación y profundidad de sondaje", procedure: "valoración periodontal" },
  { code: "ortodoncia", name: "Ortodoncia", group: "Odontología", focus: "oclusión, hábitos y análisis facial", followUp: "movimiento dentario, higiene y adherencia", procedure: "valoración ortodóncica" },
  { code: "rehabilitacion-oral", name: "Rehabilitación oral", group: "Odontología", focus: "función masticatoria, oclusión y piezas ausentes", followUp: "adaptación protésica, función y confort", procedure: "valoración de rehabilitación oral" },
];

export const specialtyByCode = new Map(
  clinicalSpecialties.map((specialty) => [specialty.code, specialty]),
);

export function getClinicalSpecialty(code: string) {
  return specialtyByCode.get(code);
}
