// Biblioteca inicial de atajos que Miracle le ofrece al médico.
//
// QUÉ ES ESTO Y QUÉ NO ES. Es una SEMILLA, nunca una fuente de verdad. El médico
// elige qué paquetes instalar; desde el instante en que los instala, esas filas
// son suyas y son indistinguibles de las que escribe él. La aplicación NUNCA
// hace UPDATE ni DELETE automático sobre un atajo del médico, por ninguna vía.
// Cuando este catálogo mejore, volver a instalar solo añade los títulos que no
// tiene: lo suyo —incluido lo que copió de aquí y luego editó— queda intacto.
// Es la única política compatible con "el atajo es del médico", y tiene el
// efecto secundario de que mejorar el catálogo jamás puede tocar una historia
// clínica ya escrita.
//
// POR QUÉ VIVE EN TYPESCRIPT Y NO EN SQL. Los dos corpus buenos que existían
// estaban sin versionar: 76 atajos de urgencias en supabase/seed/, que está en
// .gitignore, y 34 insertados a mano en la cuenta de demo. Aquí se testean sin
// base de datos, se revisan en un diff y no dependen de ningún id de
// organización.
//
// LA CATEGORÍA ES EL NOMBRE DE LA SECCIÓN DE LA NOTA, no la especialidad. Es lo
// que usa categoryMatchesSection (lib/clinical/search.ts) para subir los atajos
// de esa sección al principio de la lista. La especialidad va en el título.
//
// LAS DOS VELOCIDADES. Un hueco existe para OBLIGAR a mirar; donde no hay nada
// que mirar, el hueco es un impuesto. Los hallazgos normales van en prosa
// cerrada y se insertan sin tocar nada. Toda cifra que el médico firma —dosis,
// mg/kg, volumen, hora, tensión, Glasgow— va SIEMPRE dentro de un hueco, igual
// que la disposición legal. Lo garantizan los tests de tests/snippet-catalog.

import type { SnippetDraft } from "./snippets";
import { URGENCIAS_SNIPPETS } from "./snippet-catalog-urgencias";

/**
 * Declaración de intención sobre los huecos, para que el test pueda cazar una
 * edición que rompa la regla. No se guarda en la base: `catalogDrafts` lo quita.
 */
export type SnippetTier = "prosa" | "campos";

export interface CatalogSnippet {
  title: string;
  /** Nombre de una sección de la nota. Ver SECCIONES_CANONICAS. */
  category: string;
  tier: SnippetTier;
  content: string;
}

export interface SnippetPack {
  id: string;
  name: string;
  /** Una línea para la tarjeta del paquete. */
  description: string;
  /** Especialidades a las que se propone primero. Vacío = a todas. */
  specialtyCodes: readonly string[];
  snippets: readonly CatalogSnippet[];
}

/**
 * Secciones con las que se etiqueta el catálogo. No es una lista cerrada para el
 * médico —`category` es texto libre y así debe seguir— pero sí para nosotros:
 * inventar una sección nueva rompe la coincidencia con las plantillas.
 */
export const SECCIONES_CANONICAS: readonly string[] = [
  "Motivo de consulta",
  "Enfermedad actual",
  "Antecedentes",
  "Examen físico",
  "Ayudas diagnósticas",
  "Análisis",
  "Intervenciones",
  "Plan",
  "Recomendaciones",
  "Disposición",
];

/* ------------------------------------------------------------------ */
/* Examen físico normal, por aparatos                                  */
/* ------------------------------------------------------------------ */

/**
 * El bloque que faltaba. De los 76 atajos de urgencias solo 4 eran de examen
 * físico y ninguno describía un aparato normal; de los 76, además, 73 exigían
 * rellenar huecos. Esto es lo que se escribe en casi todas las notas y lo que
 * el médico quiere insertar y seguir.
 *
 * Todos en prosa cerrada: un examen normal no contiene ninguna cifra que se
 * pueda firmar por error, y borrar la línea que no aplica es más rápido —y se
 * decide leyendo, no calculando— que rellenar seis huecos.
 */
const EXAMEN_NORMAL: readonly CatalogSnippet[] = [
  {
    title: "Estado general normal",
    category: "Examen físico",
    tier: "prosa",
    content: `Paciente en buen estado general, consciente, alerta, orientado en las tres esferas, hidratado y afebril al examen. Colabora con el interrogatorio y con el examen físico. Piel y mucosas de coloración normal, sin palidez, ictericia ni cianosis. Llenado capilar menor de dos segundos.`,
  },
  {
    title: "Cardiovascular normal",
    category: "Examen físico",
    tier: "prosa",
    content: `Ruidos cardíacos rítmicos, de buena intensidad, sin soplos, frotes ni ritmo de galope. Sin ingurgitación yugular ni reflujo hepatoyugular. Pulsos periféricos presentes, simétricos y de amplitud conservada en las cuatro extremidades. Llenado capilar menor de dos segundos. Sin edema en miembros inferiores.`,
  },
  {
    title: "Respiratorio normal",
    category: "Examen físico",
    tier: "prosa",
    content: `Paciente sin signos de dificultad respiratoria, con adecuada entrada de aire bilateral. Tórax simétrico, con expansibilidad conservada y sin uso de músculos accesorios. Murmullo vesicular conservado en ambos campos pulmonares, sin ruidos sobreagregados: sin sibilancias, roncus ni crépitos. Habla en frases completas, sin fatiga.`,
  },
  {
    title: "Abdomen normal",
    category: "Examen físico",
    tier: "prosa",
    content: `Abdomen blando, depresible, no doloroso a la palpación superficial ni profunda. Sin masas ni visceromegalias palpables. Ruidos intestinales presentes y de características normales. Sin signos de irritación peritoneal: sin defensa, sin rebote y con Blumberg negativo. Puñopercusión lumbar negativa bilateral. Sin hernias evidentes.`,
  },
  {
    title: "Neurológico básico normal",
    category: "Examen físico",
    tier: "prosa",
    content: `Paciente consciente, alerta y orientado en persona, tiempo y espacio. Lenguaje fluido y coherente, sin disartria ni afasia. Pupilas isocóricas y reactivas a la luz, con movimientos oculares conservados. Pares craneales sin alteraciones evidentes. Fuerza muscular conservada y simétrica en las cuatro extremidades, con sensibilidad superficial conservada. Reflejos osteotendinosos presentes y simétricos. Sin signos meníngeos. Marcha y coordinación sin alteraciones.`,
  },
  {
    title: "Extremidades normales",
    category: "Examen físico",
    tier: "prosa",
    content: `Extremidades simétricas, sin edema, deformidades ni signos inflamatorios. Pulsos periféricos presentes y simétricos, con llenado capilar menor de dos segundos. Movilidad activa y pasiva conservada, sin limitación ni dolor a la movilización. Sin signos de trombosis venosa profunda: sin aumento del diámetro, sin dolor a la palpación de las pantorrillas y sin cordones venosos palpables.`,
  },
  {
    title: "Cabeza y cuello normal",
    category: "Examen físico",
    tier: "prosa",
    content: `Cabeza normocéfala, sin lesiones ni hundimientos a la palpación. Conjuntivas de coloración normal, escleras anictéricas, pupilas isocóricas y reactivas a la luz. Otoscopia con conductos auditivos externos permeables y membranas timpánicas íntegras, sin abombamiento ni eritema. Fosas nasales permeables. Orofaringe de aspecto normal, sin eritema, exudados ni aumento del tamaño amigdalino. Cuello móvil, sin rigidez, sin adenopatías ni masas palpables. Tiroides de tamaño y consistencia normales.`,
  },
  {
    title: "Piel normal",
    category: "Examen físico",
    tier: "prosa",
    content: `Piel de coloración y turgencia normales, hidratada, sin palidez, ictericia ni cianosis. Sin exantemas, petequias, equimosis ni lesiones descamativas. Sin úlceras ni soluciones de continuidad. Faneras de aspecto normal. Sin edema ni signos de infección de tejidos blandos.`,
  },
  {
    title: "Signos vitales",
    category: "Examen físico",
    tier: "campos",
    // La cabecera de cifras del patrón mixto: los signos vitales se miden, no se
    // dan por normales, así que aquí el hueco sí es obligatorio.
    content: `TA [tensión] mmHg · FC [fc] lpm · FR [fr] rpm · T [temperatura] °C · SatO2 [sat] % al ambiente · Peso [peso] kg`,
  },
];

/* ------------------------------------------------------------------ */
/* Medicina general                                                    */
/* ------------------------------------------------------------------ */

/**
 * Los doce primeros son RESCATE: estaban solo en la cuenta demo@miracle.app,
 * insertados a mano en producción y sin versionar en ninguna parte. Se traen
 * verbatim.
 */
const MEDICINA_GENERAL: readonly CatalogSnippet[] = [
  ...EXAMEN_NORMAL,

  // — rescate —
  {
    title: "Examen físico general normal",
    category: "Examen físico",
    tier: "prosa",
    content: `Paciente en buen estado general, consciente, orientado, hidratado y afebril.
Cardiopulmonar: ruidos cardíacos rítmicos, sin soplos. Murmullo vesicular conservado, sin ruidos sobreagregados.
Abdomen: blando, depresible, no doloroso, sin masas ni megalias.
Extremidades: sin edemas, pulsos periféricos presentes y simétricos.
Neurológico: sin déficit focal.`,
  },
  {
    title: "Control de enfermedad crónica",
    category: "Motivo de consulta",
    tier: "prosa",
    content: `Paciente que asiste a control de enfermedad crónica. Refiere adherencia al tratamiento indicado y no ha presentado síntomas nuevos desde la última consulta.`,
  },
  {
    title: "Hipertensión arterial controlada",
    category: "Análisis",
    tier: "prosa",
    content: `Hipertensión arterial esencial en tratamiento, con cifras en meta para la edad y el riesgo cardiovascular del paciente. Sin signos de daño de órgano blanco en la evaluación de hoy. Se continúa el mismo esquema antihipertensivo.`,
  },
  {
    title: "Diabetes mellitus tipo 2",
    category: "Análisis",
    tier: "campos",
    content: `Diabetes mellitus tipo 2 en manejo con [tratamiento actual]. Última hemoglobina glicosilada de [valor] %. Sin síntomas de hipoglucemia ni de descompensación aguda. Se revisan adherencia, técnica de administración y tolerancia al tratamiento.`,
  },
  {
    title: "Infección de vías urinarias baja",
    category: "Análisis",
    tier: "prosa",
    content: `Infección de vías urinarias baja no complicada, en paciente sin criterios de severidad ni compromiso sistémico. No hay signos de compromiso del tracto urinario alto ni factores que obliguen a manejo intrahospitalario.`,
  },
  {
    title: "Faringoamigdalitis aguda",
    category: "Análisis",
    tier: "prosa",
    content: `Faringoamigdalitis aguda de probable origen viral, sin criterios suficientes para iniciar antibiótico de entrada. Se explica al paciente por qué no se formula antibiótico y qué debe vigilar en casa.`,
  },
  {
    title: "Lumbalgia mecánica",
    category: "Análisis",
    tier: "prosa",
    content: `Lumbalgia mecánica sin signos de alarma: sin déficit neurológico, sin fiebre, sin pérdida de peso y sin antecedente traumático de importancia. No hay indicación de estudios de imagen en este momento.`,
  },
  {
    title: "Laboratorios de control",
    category: "Plan",
    tier: "prosa",
    content: `Se solicitan: hemograma, glicemia en ayunas, creatinina, perfil lipídico y parcial de orina.

Traer los resultados impresos a la cita de control.`,
  },
  {
    title: "Control de hipertensión",
    category: "Plan",
    tier: "campos",
    content: `- Se continúa el mismo esquema antihipertensivo.
- Toma de presión arterial en casa, en reposo, y registro en una libreta para traer al control.
- Control médico en [tiempo] con el registro de cifras.
- Laboratorios de control previos a la cita.`,
  },
  {
    title: "Antibiótico ambulatorio",
    category: "Plan",
    tier: "campos",
    content: `Se formula [antibiótico] [dosis] mg vía oral cada [frecuencia] horas por ___ días.

- Tomarlo siempre a la misma hora y completar el tratamiento aunque se sienta mejor antes.
- Consultar antes de terminarlo si aparece fiebre alta, vómito persistente o erupción en la piel.`,
  },
  {
    title: "Hábitos de vida saludable",
    category: "Recomendaciones",
    tier: "prosa",
    content: `- Actividad física de al menos 150 minutos a la semana, según tolerancia.
- Reducir el consumo de sal y de bebidas azucaradas.
- Suspender el cigarrillo y limitar el consumo de alcohol.
- Mantener horarios regulares de sueño.`,
  },
  {
    title: "Signos de alarma generales",
    category: "Recomendaciones",
    tier: "prosa",
    content: `Consultar de inmediato al servicio de urgencias si presenta:

- Fiebre que no cede con el manejo indicado o que dura más de tres días.
- Dificultad para respirar o dolor en el pecho.
- Vómito persistente o incapacidad para tolerar líquidos.
- Somnolencia, confusión o desmayo.`,
  },

  // — nuevos —
  {
    title: "Consulta de control sin cambios",
    category: "Enfermedad actual",
    tier: "prosa",
    content: `Paciente que asiste a control. Refiere adherencia al tratamiento formulado, sin haber suspendido ninguno de los medicamentos indicados. No ha presentado síntomas nuevos ni efectos adversos desde la última consulta. Niega hospitalizaciones o consultas a urgencias en el intervalo.`,
  },
  {
    title: "Cuadro agudo · primera vez",
    category: "Enfermedad actual",
    tier: "campos",
    content: `Cuadro clínico de [tiempo] de evolución, consistente en [síntoma principal], de inicio [súbito / gradual] y de intensidad [leve / moderada / severa].

Se acompaña de ___. Desde el inicio [ha empeorado / se mantiene igual / ha mejorado].
Manejo previo en casa: [medicamento y respuesta / ninguno].
Consulta hoy por ___.`,
  },
  {
    title: "Revisión por sistemas negativa",
    category: "Enfermedad actual",
    tier: "prosa",
    content: `Revisión por sistemas: niega fiebre, pérdida de peso no intencional y sudoración nocturna. Sin dolor torácico, palpitaciones, disnea ni edema. Sin tos, expectoración ni hemoptisis. Sin dolor abdominal, náuseas, vómito ni cambios en el hábito intestinal. Sin síntomas urinarios. Sin cefalea, mareo, déficit motor ni alteración visual. Sin lesiones en piel.`,
  },
  {
    title: "Antecedentes negativos",
    category: "Antecedentes",
    tier: "prosa",
    content: `Antecedentes patológicos: niega. Quirúrgicos: niega. Hospitalizaciones previas: niega. Traumáticos: niega.
Alérgicos: niega alergias conocidas a medicamentos y alimentos.
Transfusionales: niega. Farmacológicos: no recibe medicación de forma habitual.
Familiares: sin antecedentes de importancia referidos.
Tóxicos: niega consumo de cigarrillo, alcohol y sustancias psicoactivas.`,
  },
  {
    title: "Antecedentes cardiovasculares",
    category: "Antecedentes",
    tier: "campos",
    content: `Hipertensión arterial diagnosticada hace [tiempo], en manejo con [medicamentos].
Diabetes mellitus tipo 2 diagnosticada hace [tiempo], en manejo con [medicamentos].
Dislipidemia: [en manejo con ___ / sin tratamiento].

Últimos controles disponibles: ___. Adherencia referida: [buena / irregular].
Tabaquismo: [activo / suspendido / nunca].`,
  },
  {
    title: "Antecedentes ginecoobstétricos",
    category: "Antecedentes",
    tier: "campos",
    content: `G[gestaciones] P[partos] C[cesáreas] A[abortos] V[vivos].

Fecha de la última menstruación: [fecha]. Ciclos [regulares / irregulares].
Método de planificación: [método / ninguno].
Última citología: [fecha], con resultado ___.`,
  },
  {
    title: "Cuadro sin criterios de severidad",
    category: "Análisis",
    tier: "prosa",
    content: `Cuadro clínico sin criterios de severidad ni de compromiso sistémico al momento de esta valoración: paciente hemodinámicamente estable, sin signos de alarma al examen físico y con adecuada tolerancia a la vía oral. No hay indicación de manejo intrahospitalario ni de estudios adicionales en este momento. Se define manejo ambulatorio, con signos de alarma explicados y control programado.`,
  },
  {
    title: "Obesidad y riesgo metabólico",
    category: "Análisis",
    tier: "campos",
    content: `Índice de masa corporal de [imc], que corresponde a [sobrepeso / obesidad grado I / grado II / grado III]. Perímetro abdominal de [perímetro] cm.

Se explica al paciente la relación entre el peso y su riesgo cardiovascular y metabólico. Acepta el plan de cambio de hábitos y se acuerda como meta ___.`,
  },
  {
    title: "Hipotiroidismo en control",
    category: "Análisis",
    tier: "campos",
    content: `Hipotiroidismo primario en manejo con levotiroxina [dosis] mcg día. TSH de control de [valor], tomada el [fecha].

El paciente refiere adherencia [buena / irregular] y toma el medicamento [en ayunas / con alimentos]. Se [continúa el mismo esquema / ajusta la dosis] por ___.`,
  },
  {
    title: "Analgesia ambulatoria",
    category: "Plan",
    tier: "campos",
    content: `[Acetaminofén / Dipirona / Ibuprofeno] [dosis] vía oral cada [frecuencia] horas por ___ días, con las comidas.

- Tomarlo por horario los primeros días y después solo si hay dolor.
- No combinarlo con otros antiinflamatorios ni con medicamentos que contengan el mismo principio activo.
- Suspender y consultar si aparece dolor abdominal, deposiciones negras o vómito con sangre.`,
  },
  {
    title: "Solicitud de imágenes",
    category: "Plan",
    tier: "campos",
    content: `Se solicita [estudio] de [región], con la indicación clínica de ___.

Se explica al paciente la preparación requerida y se le indica traer el estudio y su lectura a la cita de control. La conducta definitiva se define con el resultado.`,
  },
  {
    title: "Remisión a especialista",
    category: "Plan",
    tier: "campos",
    content: `Se remite a [especialidad] para ___.

Se explica al paciente el motivo de la remisión y qué debe llevar a esa consulta: los resultados de laboratorio, las imágenes y la lista de los medicamentos que recibe. El manejo actual continúa sin cambios hasta la valoración.`,
  },
  {
    title: "Incapacidad médica",
    category: "Plan",
    tier: "campos",
    content: `Se expide incapacidad médica por [número] días a partir de hoy: el cuadro actual limita el desempeño de las funciones habituales del paciente.

Se explica que el reposo durante ese lapso hace parte del tratamiento y que debe entregar el documento a su empleador. Se programa control para revaloración antes de definir prórroga.`,
  },
  {
    title: "Consentimiento informado verbal",
    category: "Plan",
    tier: "prosa",
    content: `Se explican al paciente, en lenguaje comprensible, el diagnóstico, las alternativas de manejo, los beneficios esperados y los riesgos del tratamiento propuesto. Se resuelven las preguntas formuladas. El paciente manifiesta haber entendido, acepta el plan y otorga su consentimiento verbal, que queda consignado en esta nota.`,
  },
  {
    title: "Cuidados en casa",
    category: "Recomendaciones",
    tier: "prosa",
    content: `Reposo relativo según tolerancia, con reincorporación gradual a la actividad habitual. Hidratación abundante por vía oral y alimentación fraccionada según apetito.

Completar el tratamiento formulado en los horarios indicados, aunque los síntomas mejoren antes de terminarlo.

Consultar antes de la fecha de control si el cuadro no mejora o si aparece alguno de los signos de alarma explicados.`,
  },
  {
    title: "Adherencia al tratamiento",
    category: "Recomendaciones",
    tier: "prosa",
    content: `Se explica al paciente la importancia de tomar los medicamentos en los horarios indicados y de no suspenderlos por cuenta propia, aunque se sienta mejor. Se recomienda usar un pastillero o una alarma, y llevar la lista de medicamentos a cada consulta.

Se aclara que cualquier medicamento nuevo, incluidos los de venta libre y los productos naturales, debe consultarse antes de iniciarlo.

El paciente comprende las indicaciones y acepta el plan.`,
  },
  {
    title: "Próximo control",
    category: "Recomendaciones",
    tier: "campos",
    content: `Control médico en [tiempo], o antes si aparece alguno de los signos de alarma explicados.

Traer a esa consulta los resultados de los exámenes solicitados y la lista actualizada de medicamentos.`,
  },
];

/* ------------------------------------------------------------------ */
/* Pediatría                                                           */
/* ------------------------------------------------------------------ */

/**
 * RESCATE COMPLETO. Estos 22 existían únicamente en la cuenta demo@miracle.app,
 * insertados a mano en producción el 2026-08-14 y sin versionar en ninguna
 * parte del repo. Se traen verbatim.
 *
 * La serie por bandas de edad es la respuesta al "niño normal universal": no hay
 * un niño promedio: hay tramos, y cada tramo tiene su alimentación, sus vacunas
 * y sus signos de alarma. Van en prosa cerrada y completa —son la educación al
 * cuidador que el pediatra repite idéntica en cada control— y por eso son largos
 * a propósito.
 */
const PEDIATRIA: readonly CatalogSnippet[] = [
  {
    title: "Pediatría · Control de niño sano",
    category: "Motivo de consulta",
    tier: "campos",
    content: `Paciente que asiste a consulta de crecimiento y desarrollo, en compañía de [acudiente]. Sin síntomas agudos al momento de la consulta. Se revisan carné de vacunación, alimentación, sueño y desarrollo psicomotor.`,
  },
  {
    title: "Pediatría · Cuadro respiratorio alto",
    category: "Enfermedad actual",
    tier: "campos",
    content: `Cuadro clínico de [días] días de evolución consistente en rinorrea hialina, congestión nasal y tos, sin dificultad respiratoria. Picos febriles hasta [temperatura] °C manejados en casa con [medicamento]. Tolera la vía oral, mantiene diuresis y conserva su actividad habitual.`,
  },
  {
    title: "Pediatría · Cuadro diarreico agudo",
    category: "Enfermedad actual",
    tier: "campos",
    content: `Cuadro de [días] días de evolución con [número] deposiciones líquidas al día, sin moco ni sangre. [Con/Sin] vómito asociado. Tolera la vía oral, diuresis conservada y sin signos de deshidratación referidos por el acudiente.`,
  },
  {
    title: "Pediatría · Examen físico normal",
    category: "Examen físico",
    tier: "campos",
    // El patrón mixto canónico: cabecera de cifras con huecos (se miden) y
    // cuerpo de prosa cerrada (se dan por normales).
    content: `Peso [peso] kg · Talla [talla] cm · PC [pc] cm · FC [fc] lpm · FR [fr] rpm · T [temp] °C · SatO2 [sat] %

Niño en buen estado general, alerta, hidratado, afebril al examen, sin dificultad respiratoria.
Cabeza y cuello: fontanela normotensa cuando aplica, orofaringe sin eritema ni exudados, otoscopia sin alteraciones, sin adenopatías significativas.
Cardiopulmonar: ruidos cardíacos rítmicos sin soplos. Murmullo vesicular conservado, sin ruidos sobreagregados ni tirajes.
Abdomen: blando, depresible, no doloroso, sin masas ni visceromegalias.
Piel: sin exantemas ni lesiones. Llenado capilar menor de 2 segundos.
Neurológico: activo, reactivo, tono y reflejos acordes a la edad.`,
  },
  {
    title: "Pediatría · Dificultad respiratoria",
    category: "Examen físico",
    tier: "campos",
    content: `FR [fr] rpm · SatO2 [sat] % al ambiente.

Se observan [tirajes subcostales / intercostales / aleteo nasal]. A la auscultación: [sibilancias / crépitos / roncus] en [ambos campos / campo derecho / campo izquierdo].
Resto del examen sin alteraciones.`,
  },
  {
    title: "Pediatría · Crecimiento y desarrollo normal",
    category: "Análisis",
    tier: "campos",
    content: `Niño sano de [edad], con crecimiento y desarrollo acordes para la edad según las curvas de la OMS. Esquema de vacunación [completo/incompleto] para la edad. Sin hallazgos patológicos en el examen de hoy.`,
  },
  {
    title: "Pediatría · IRA alta viral",
    category: "Análisis",
    tier: "prosa",
    content: `Infección respiratoria aguda de vías altas, de probable origen viral. Sin signos de dificultad respiratoria ni criterios de manejo intrahospitalario. No hay indicación de antibiótico; se explica al acudiente por qué no se formula.`,
  },
  {
    title: "Pediatría · EDA sin deshidratación",
    category: "Análisis",
    tier: "prosa",
    content: `Enfermedad diarreica aguda, probablemente viral, sin signos de deshidratación (plan A). Tolera la vía oral. Sin criterios de hospitalización y sin indicación de antibiótico ni de antidiarreicos.`,
  },
  {
    title: "Pediatría · Bronquiolitis",
    category: "Análisis",
    tier: "campos",
    content: `Bronquiolitis en lactante de [edad], con dificultad respiratoria [leve/moderada] y saturación de [sat] % al ambiente. [Sin/Con] criterios de hospitalización. Se explica al acudiente el curso esperado del cuadro, que puede empeorar hacia el tercer o cuarto día, y los signos de alarma.`,
  },
  {
    title: "Pediatría · Otitis media aguda",
    category: "Análisis",
    tier: "campos",
    content: `Otitis media aguda [derecha/izquierda/bilateral]. Otoscopia con membrana timpánica [abombada/eritematosa/opaca]. Se define manejo [antibiótico / observación con analgesia] según la edad y la severidad del cuadro.`,
  },
  {
    title: "Pediatría · Antibiótico por peso",
    category: "Plan",
    tier: "campos",
    content: `Peso confirmado hoy: [peso] kg.

Se formula [antibiótico] a [mg/kg/día] mg/kg/día, repartido cada [frecuencia] horas, por ___ días.
Dosis por toma: [volumen] mL de la suspensión de [concentración].

- Agitar el frasco antes de cada toma y usar la jeringa dosificadora, nunca cucharas de la casa.
- Completar el tratamiento aunque el niño mejore antes.
- Refrigerar si el fabricante lo indica.`,
  },
  {
    title: "Pediatría · Manejo de fiebre en casa",
    category: "Plan",
    tier: "campos",
    content: `Peso confirmado hoy: [peso] kg.

Acetaminofén [dosis] vía oral cada 6 horas, solo si la temperatura es mayor o igual a 38 °C o hay malestar.

- No superar 5 dosis en 24 horas.
- Medios físicos: ropa ligera y líquidos abundantes. No usar alcohol ni agua helada.
- Verificar el peso actual antes de calcular la dosis.`,
  },
  {
    title: "Pediatría · Hidratación oral plan A",
    category: "Plan",
    tier: "campos",
    content: `- Suero de rehidratación oral después de cada deposición: [volumen], en sorbos pequeños o a cucharadas.
- Continuar la alimentación habitual y la lactancia materna sin restricción.
- No suspender la vía oral y no usar antidiarreicos.
- Zinc según la edad, durante 14 días.`,
  },
  {
    title: "Pediatría · Signos de alarma",
    category: "Recomendaciones",
    tier: "prosa",
    content: `Consultar de inmediato al servicio de urgencias si el niño presenta:

- Dificultad para respirar: se le hunden las costillas, respira muy rápido o se le ponen morados los labios.
- Fiebre que no baja con el medicamento, o cualquier fiebre en un menor de 3 meses.
- No tolera líquidos, vomita todo, o lleva más de 6 horas sin orinar.
- Está muy decaído, no responde como siempre, o por el contrario no deja de llorar.
- Convulsión, o brotes en la piel que no desaparecen al estirarla.`,
  },
  {
    title: "Pediatría · Recomendaciones de niño sano",
    category: "Recomendaciones",
    tier: "campos",
    content: `- Continuar el esquema de vacunación según el PAI; traer el carné a cada control.
- Alimentación variada según la edad, sin bebidas azucaradas ni ultraprocesados.
- Límite de pantallas acorde a la edad y rutina de sueño estable.
- Supervisión permanente para prevenir accidentes en casa: caídas, quemaduras e intoxicaciones.
- Próximo control de crecimiento y desarrollo en [tiempo].`,
  },

  // — la serie por bandas de edad —
  {
    title: "Pediatría · Recién nacido (0 a 28 días)",
    category: "Recomendaciones",
    tier: "prosa",
    content: `ALIMENTACIÓN
- Leche materna exclusiva, a libre demanda, día y noche: mínimo 8 a 12 veces en 24 horas. No dar agua, agüitas de hierbas ni fórmula salvo indicación médica.
- Va bien si moja 6 o más pañales al día y sube de peso en los controles.

CUIDADO DEL CORDÓN
- Limpiar la base con agua y jabón, secar bien y dejarlo al aire. No aplicar alcohol, monedas, ombligueros ni fajeros.
- Se cae solo entre los 7 y los 15 días.

SUEÑO SEGURO
- Siempre boca arriba, sobre superficie firme, sin almohadas, peluches ni cobijas sueltas.
- En la habitación de los padres, pero no en la misma cama.

CONSULTAR DE INMEDIATO SI:
- Fiebre de 38 °C o más. En un menor de 3 meses es una urgencia, siempre.
- Se pone amarillo en cara, pecho o abdomen, o el amarillo se intensifica.
- No despierta para comer, se ve muy flojito o rechaza el pecho.
- Respira muy rápido, se le hunden las costillas o hace ruido al respirar.
- Vómito con fuerza o de color verde, o no orina en 12 horas.`,
  },
  {
    title: "Pediatría · 1 a 2 meses",
    category: "Recomendaciones",
    tier: "prosa",
    content: `ALIMENTACIÓN
- Sigue con leche materna exclusiva, a libre demanda. No necesita agua ni ningún otro alimento.

VACUNAS
- A los 2 meses: pentavalente, polio, rotavirus y neumococo. Traer el carné a cada consulta.

QUÉ ESPERAR A ESTA EDAD
- Fija la mirada y sigue objetos, sonríe cuando le sonríen, sostiene la cabeza por momentos estando boca abajo.

RECOMENDACIONES
- Tiempo boca abajo mientras esté despierto y vigilado: fortalece cuello y espalda.
- Háblele y cántele. El lenguaje empieza mucho antes de la primera palabra.
- El llanto de final de la tarde es frecuente a esta edad y va cediendo hacia los 3 o 4 meses.

CONSULTAR SI: hay fiebre, no sonríe ni fija la mirada, no sostiene nada la cabeza, o deja de comer como venía haciéndolo.`,
  },
  {
    title: "Pediatría · 3 a 6 meses",
    category: "Recomendaciones",
    tier: "prosa",
    content: `ALIMENTACIÓN
- Leche materna exclusiva hasta los 6 meses cumplidos. No se necesitan jugos, caldos ni cereales antes de esa edad.

VACUNAS
- A los 4 y 6 meses: pentavalente, polio y neumococo; rotavirus según esquema. Influenza a partir de los 6 meses.

QUÉ ESPERAR A ESTA EDAD
- Sostiene la cabeza firme, se voltea, agarra objetos y se los lleva a la boca, ríe a carcajadas y balbucea.

RECOMENDACIONES PARA LA MADRE
- Rutina de sueño estable: baño, alimento, mismo lugar y misma hora. Ya puede dormir períodos más largos en la noche.
- Todo se lo lleva a la boca: revise que no haya objetos pequeños, bolsas ni cables a su alcance.
- Ya rueda: nunca lo deje solo sobre la cama, el cambiador o el sofá.
- Sin pantallas. A esta edad no aportan nada y desplazan el juego y la conversación, que es lo que construye el lenguaje.

CONSULTAR SI: no sostiene la cabeza, no sigue objetos con la mirada, no emite sonidos, o mantiene siempre las manos empuñadas.`,
  },
  {
    title: "Pediatría · 6 a 9 meses · inicio de alimentación complementaria",
    category: "Recomendaciones",
    tier: "prosa",
    content: `ALIMENTACIÓN COMPLEMENTARIA
- Se inicia a los 6 meses cumplidos, SIN suspender la leche materna, que sigue siendo el alimento principal hasta el año.
- Empezar con purés espesos, una comida al día, y subir progresivamente a dos y tres.
- Ofrecer un alimento nuevo cada 2 o 3 días, para identificar qué le cae mal si algo le cae mal.
- Incluir desde el principio alimentos ricos en hierro: carne, hígado, pollo, huevo y leguminosas.
- NO dar: miel (riesgo de botulismo antes del año), leche de vaca como bebida, sal, azúcar añadida ni jugos.
- Que rechace un alimento las primeras veces es normal: puede necesitar ofrecérselo 10 o 15 veces.

RECOMENDACIONES
- Que coma sentado, acompañado y sin pantallas.
- Suplemento de hierro según indicación: a esta edad se agotan las reservas con las que nació.
- Ya se sienta y gatea: proteja escaleras, tomas eléctricas y productos de aseo.

CONSULTAR SI: no se sienta con apoyo, no lleva objetos a la boca, no responde a su nombre, o rechaza de forma persistente toda comida sólida.`,
  },
  {
    title: "Pediatría · 9 a 12 meses",
    category: "Recomendaciones",
    tier: "prosa",
    content: `ALIMENTACIÓN
- Tres comidas y uno o dos refrigerios, con la leche materna acompañando.
- Textura con grumos y trozos blandos que pueda coger con la mano: ya toca masticar, no solo tragar.

VACUNAS
- Al año: SRP (sarampión, rubéola y paperas), varicela, hepatitis A, fiebre amarilla y refuerzo de neumococo.

QUÉ ESPERAR A ESTA EDAD
- Se para con apoyo, hace pinza con índice y pulgar, dice "mamá" y "papá" con sentido, entiende el "no" y señala lo que quiere.

RECOMENDACIONES PARA LA MADRE
- Se para y camina apoyado: sube el riesgo de caídas y quemaduras. Mangos de ollas hacia adentro y nada caliente en el borde de la mesa.
- Nada de tetero en la cama: aumenta caries y otitis. Buen momento para empezar con taza.

CONSULTAR SI: no se sienta solo, no balbucea, no señala, no hace pinza, o perdió habilidades que ya tenía.`,
  },
  {
    title: "Pediatría · 12 a 18 meses",
    category: "Recomendaciones",
    tier: "prosa",
    content: `ALIMENTACIÓN
- Come de la comida familiar, sin sal ni azúcar añadidas. Leche entera después del año.
- El apetito baja respecto al primer año y eso es normal: ahora crece más despacio. No obligar ni perseguirlo con el plato.

VACUNAS
- A los 18 meses: refuerzos de DPT, polio y SRP.

QUÉ ESPERAR A ESTA EDAD
- Camina solo, dice varias palabras sueltas, imita tareas de la casa, señala partes del cuerpo y bebe en taza.

RECOMENDACIONES PARA LA MADRE
- Empiezan las pataletas y son normales: no es manipulación, es un cerebro que todavía no sabe manejar la frustración. Mantener la calma y la norma.
- Rutina fija de sueño: entre 11 y 14 horas al día contando la siesta.
- Sigue sin pantallas hasta los 2 años.
- Bajo llave los medicamentos y los productos de aseo: es la edad de mayor riesgo de intoxicación en casa.

CONSULTAR SI: no camina a los 18 meses, no dice ninguna palabra, no señala para pedir, o no mira a los ojos.`,
  },
  {
    title: "Pediatría · 18 a 24 meses",
    category: "Recomendaciones",
    tier: "prosa",
    content: `ALIMENTACIÓN
- Come solo, con cuchara, de la comida familiar. Que sea selectivo es esperable: se maneja ofreciendo sin presionar, no negociando con premios.

QUÉ ESPERAR A ESTA EDAD
- Corre, sube escaleras con apoyo, une dos palabras ("más agua"), sigue instrucciones sencillas y juega a imitar.

CONTROL DE ESFÍNTERES
- Se empieza cuando el niño avisa, se mantiene seco dos horas y puede subirse y bajarse la ropa; en general entre los 2 y los 3 años. Adelantarlo no acelera nada y suele traer retrocesos.

RECOMENDACIONES PARA LA MADRE
- Después de los 2 años, máximo una hora de pantalla al día y siempre acompañada.
- Leerle un cuento todos los días: es lo que más impacto tiene sobre el lenguaje a esta edad.
- Buscar juego con otros niños.

CONSULTAR SI: no une dos palabras, no corre, no imita, no sigue instrucciones simples, o perdió habilidades que ya tenía.`,
  },

  // — añadidos que completan la serie y cubren un hueco de seguridad —
  {
    title: "Pediatría · 2 a 5 años",
    category: "Recomendaciones",
    tier: "prosa",
    content: `ALIMENTACIÓN
- Come de la comida familiar en horarios fijos, con la familia y sin pantallas. Ofrecer sin obligar: el niño decide cuánto, el adulto decide qué y cuándo.
- Evitar bebidas azucaradas, paquetes y comida ultraprocesada como recompensa.

VACUNAS
- A los 5 años: refuerzos de DPT y polio. Influenza anual.

QUÉ ESPERAR A ESTA EDAD
- Habla en frases que un extraño entiende, se viste con poca ayuda, juega con otros niños, salta y sube escaleras alternando los pies, y hace preguntas todo el tiempo.

RECOMENDACIONES PARA EL CUIDADOR
- Cepillado de dientes dos veces al día, con supervisión y crema con flúor. Primera consulta odontológica si aún no la ha tenido.
- Máximo una hora de pantalla al día, acompañada, y nunca durante las comidas ni antes de dormir.
- Silla o cojín elevador en el carro hasta que la altura permita el cinturón normal.
- Rutina de sueño estable: entre 10 y 13 horas al día.

CONSULTAR SI: no se le entiende al hablar, no juega con otros niños, se cae con mucha frecuencia, no controla esfínteres de día después de los 4 años, o perdió habilidades que ya tenía.`,
  },
  {
    title: "Pediatría · Antecedentes perinatales",
    category: "Antecedentes",
    tier: "campos",
    content: `Producto de embarazo de [semanas] semanas, con controles prenatales [completos / incompletos]. Parto [vaginal / cesárea].

Peso al nacer [peso]. APGAR [valor]. [Requirió / No requirió] hospitalización neonatal.
Lactancia materna hasta ___. Esquema de vacunación [completo / incompleto] para la edad.`,
  },
  {
    title: "Pediatría · Fiebre sin foco en el menor de 3 meses",
    category: "Análisis",
    tier: "campos",
    // Bloque de seguridad: es el escenario pediátrico donde más caro sale
    // documentar de memoria y egresar sin dejar constancia del razonamiento.
    content: `Lactante de [edad] con fiebre documentada de [temperatura] °C, sin foco identificable al examen físico.

En un menor de 3 meses la fiebre sin foco NO se maneja de forma ambulatoria por la posibilidad de infección bacteriana grave, aunque el niño luzca bien. Se explica esto al acudiente de forma explícita.

Se solicitan estudios y se define [observación en el servicio / hospitalización / remisión] por ___. No se administra antipirético como única conducta ni se egresa sin los resultados.`,
  },
];

/* ------------------------------------------------------------------ */
/* Urgencias                                                           */
/* ------------------------------------------------------------------ */

/**
 * Los 76 portados verbatim del seed, más los bloques de examen normal (que
 * urgencias no tenía: de sus 76 solo 4 eran de examen físico y 73 exigían
 * rellenar huecos) y dos correcciones.
 */
const URGENCIAS: readonly CatalogSnippet[] = [
  ...URGENCIAS_SNIPPETS.map((snippet) =>
    // "Examen de urgencias sin hallazgos" se contradecía: el título afirma que
    // no hay hallazgos y el texto abría pidiendo [buen / regular] estado
    // general. Se conserva el título —los 5 médicos del piloto ya lo tienen— y
    // se cierra la prosa; la variante con hueco queda abajo, con su propio
    // título.
    snippet.title === "Examen de urgencias sin hallazgos"
      ? ({
          title: snippet.title,
          category: snippet.category,
          tier: "prosa",
          content: `Paciente en buen estado general, consciente, orientado, hidratado, sin dificultad respiratoria y afebril al examen.

Cardiopulmonar: ruidos cardíacos rítmicos, sin soplos. Murmullo vesicular conservado en ambos campos, sin agregados.
Abdomen: blando, depresible, no doloroso, sin signos de irritación peritoneal.
Extremidades: sin edema, pulsos simétricos, llenado capilar conservado.
Neurológico: sin déficit focal.`,
        } satisfies CatalogSnippet)
      : snippet,
  ),
  ...EXAMEN_NORMAL,
  {
    title: "Examen de urgencias · estado general a definir",
    category: "Examen físico",
    tier: "campos",
    content: `Paciente en [buen / regular] estado general, consciente, orientado, hidratado, sin dificultad respiratoria y afebril al examen.

Cardiopulmonar: ruidos cardíacos rítmicos, sin soplos. Murmullo vesicular conservado en ambos campos, sin agregados.
Abdomen: blando, depresible, no doloroso, sin signos de irritación peritoneal.
Extremidades: sin edema, pulsos simétricos, llenado capilar conservado.
Neurológico: sin déficit focal.`,
  },
  {
    title: "Reevaluación sin cambios",
    category: "Análisis",
    tier: "prosa",
    content: `Se reevalúa al paciente. Continúa hemodinámicamente estable, consciente, orientado y sin signos de dificultad respiratoria. El examen físico no muestra cambios respecto a la valoración inicial. Tolera la vía oral y refiere mejoría de los síntomas por los que consultó. Se mantiene la conducta definida y se explican de nuevo los signos de alarma.`,
  },
];

/* ------------------------------------------------------------------ */
/* Catálogo                                                            */
/* ------------------------------------------------------------------ */

export const snippetCatalog: readonly SnippetPack[] = [
  {
    id: "medicina-general",
    name: "Medicina general",
    description:
      "Examen físico normal por aparatos, los análisis de la consulta ambulatoria y las recomendaciones que se repiten en cada control.",
    specialtyCodes: ["medicina-general", "medicina-interna", "medicina-familiar"],
    snippets: MEDICINA_GENERAL,
  },
  {
    id: "urgencias",
    name: "Urgencias",
    description:
      "El vocabulario del turno: diagnósticos frecuentes, medicamentos administrados, disposición y entrega. Las cifras siempre en huecos.",
    specialtyCodes: ["urgencias"],
    snippets: URGENCIAS,
  },
  {
    id: "pediatria",
    name: "Pediatría",
    description:
      "Examen y análisis pediátricos, y la educación al cuidador por bandas de edad, del recién nacido a los cinco años.",
    specialtyCodes: ["pediatria"],
    snippets: PEDIATRIA,
  },
];

export function packById(id: string): SnippetPack | null {
  return snippetCatalog.find((pack) => pack.id === id) ?? null;
}

/**
 * Paquetes ordenados para un médico: los de su especialidad primero. Nunca
 * oculta ninguno — un general que empieza a ver niños debe poder instalar
 * pediatría sin que la app decida por él.
 */
export function packsForSpecialty(
  specialtyCode: string | null | undefined,
): SnippetPack[] {
  const code = (specialtyCode ?? "").replace(/_/g, "-").toLowerCase();
  return [...snippetCatalog].sort((a, b) => {
    const suyo = (pack: SnippetPack) => (pack.specialtyCodes.includes(code) ? 0 : 1);
    return suyo(a) - suyo(b);
  });
}

/** Lo que se guarda en la base: sin `tier`, que es solo para los tests. */
export function catalogDrafts(packIds: readonly string[]): SnippetDraft[] {
  const drafts: SnippetDraft[] = [];
  const vistos = new Set<string>();
  for (const id of packIds) {
    for (const snippet of packById(id)?.snippets ?? []) {
      // Los bloques de examen normal están en varios paquetes a propósito:
      // instalar dos paquetes no puede duplicarlos.
      if (vistos.has(snippet.title)) continue;
      vistos.add(snippet.title);
      drafts.push({
        title: snippet.title,
        content: snippet.content,
        category: snippet.category,
      });
    }
  }
  return drafts;
}
