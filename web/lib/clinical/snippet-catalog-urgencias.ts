// GENERADO al portar supabase/seed/urgencias-hospital-general.sql al repo.
//
// Ese seed está en .gitignore (lleva contraseñas en claro y el repo es
// público), así que estos 76 textos NO estaban versionados en ninguna parte:
// vivían en el disco de una máquina y en las filas de los 5 médicos del
// piloto de urgencias. Se portaron verbatim —md5 verificado contra la base
// de producción— y desde aquí este archivo es la fuente de verdad.
//
// NINGUNA DOSIS VA COMO TEXTO YA ESCRITO. Las cifras solo aparecen dentro de
// un hueco que lib/clinical/placeholders.ts detecta: al insertar, el cursor
// cae en el primero y Tab salta al siguiente. Así el atajo ahorra la
// escritura larga y a la vez OBLIGA a pasar por la cifra, en vez de dejar una
// por defecto que se pueda firmar sin mirar.

import type { CatalogSnippet } from "./snippet-catalog";

export const URGENCIAS_SNIPPETS: readonly CatalogSnippet[] = [
  {
    title: "Paciente que no puede informar",
    category: "Motivo de consulta",
    tier: "campos",
    content: `Paciente que no puede dar información por [alteración de conciencia / barrera idiomática / edad].

La información la aporta [quién informa], en calidad de [parentesco o relación], quien refiere: ___`,
  },
  {
    title: "Cronología del cuadro",
    category: "Enfermedad actual",
    tier: "campos",
    content: `Cuadro clínico de [tiempo] de evolución, que inicia a las [hora] con [síntoma principal].

Se acompaña de ___. Desde el inicio [ha empeorado / se mantiene igual / ha mejorado].
Manejo previo en casa: [medicamento y respuesta / ninguno].
Consulta hoy por ___.`,
  },
  {
    title: "Alergias y medicación habitual",
    category: "Antecedentes",
    tier: "campos",
    content: `ALERGIAS: [medicamento y tipo de reacción / niega alergias conocidas].

Medicación habitual: [medicamentos y dosis / ninguna].
Antecedentes patológicos: ___. Quirúrgicos: ___.`,
  },
  {
    title: "Antecedentes no interrogados",
    category: "Antecedentes",
    tier: "campos",
    content: `No fue posible interrogar antecedentes ni alergias en esta atención por [motivo].

Queda pendiente completarlos con [familiar / historia clínica previa] apenas sea posible. Se advierte al equipo tratante para que lo tenga en cuenta antes de formular.`,
  },
  {
    title: "Examen de urgencias sin hallazgos",
    category: "Examen físico",
    tier: "campos",
    content: `Paciente en [buen / regular] estado general, consciente, orientado, hidratado, sin dificultad respiratoria y afebril al examen.

Cardiopulmonar: ruidos cardíacos rítmicos, sin soplos. Murmullo vesicular conservado en ambos campos, sin agregados.
Abdomen: blando, depresible, no doloroso, sin signos de irritación peritoneal.
Extremidades: sin edema, pulsos simétricos, llenado capilar conservado.
Neurológico: sin déficit focal.`,
  },
  {
    title: "Examen · dolor torácico",
    category: "Examen físico",
    tier: "campos",
    content: `Paciente [con / sin] dificultad respiratoria, [con / sin] palidez ni diaforesis.

Tensión arterial en ambos brazos — derecho: [valor]. Izquierdo: [valor].
Cardiopulmonar: ruidos cardíacos [rítmicos / arrítmicos], [con / sin] soplos ni frote. Murmullo vesicular ___.
Cuello: ingurgitación yugular [presente / ausente].
Extremidades: pulsos [simétricos / asimétricos], sin edema ni signos de trombosis venosa profunda.`,
  },
  {
    title: "Examen · abdomen agudo",
    category: "Examen físico",
    tier: "campos",
    content: `Abdomen [blando / distendido], doloroso a la palpación en [localización], [con / sin] defensa y [con / sin] signos de irritación peritoneal.

Ruidos intestinales [presentes / disminuidos / ausentes]. Signo de [Murphy / Blumberg / McBurney]: [positivo / negativo].
No se palpan masas ni visceromegalias. Puñopercusión lumbar [positiva / negativa] en ___.`,
  },
  {
    title: "Examen · neurológico dirigido",
    category: "Examen físico",
    tier: "campos",
    content: `Escala de coma de Glasgow [valor]: apertura ocular [valor], respuesta verbal [valor], respuesta motora [valor].

Pupilas [isocóricas / anisocóricas], [reactivas / no reactivas] a la luz.
Sin déficit motor ni sensitivo focal. Lenguaje ___. Marcha ___.
Signos meníngeos [presentes / ausentes].`,
  },
  {
    title: "Estudios solicitados y pendientes",
    category: "Ayudas diagnósticas",
    tier: "campos",
    content: `Se solicitan: ___.

Resultados disponibles al momento de esta nota: ___.
Quedan pendientes: ___. La conducta se define cuando lleguen; se explica al paciente y a la familia la razón de la espera.`,
  },
  {
    title: "Medicamentos administrados en urgencias",
    category: "Intervenciones",
    tier: "campos",
    content: `Se administra en el servicio:

- [medicamento] [dosis] [vía] a las [hora].
- [medicamento] [dosis] [vía] a las [hora].

Respuesta observada: ___. Sin reacciones adversas inmediatas.`,
  },
  {
    title: "Sin criterios de severidad · manejo ambulatorio",
    category: "Análisis",
    tier: "campos",
    content: `Cuadro sin criterios de severidad ni de compromiso sistémico al momento de esta valoración: paciente hemodinámicamente estable, sin signos de alarma al examen y con adecuada tolerancia a la vía oral.

No hay indicación de manejo intrahospitalario. Se define manejo ambulatorio, con signos de alarma explicados y control en ___.`,
  },
  {
    title: "Se deja en observación para reevaluación",
    category: "Análisis",
    tier: "campos",
    content: `Se decide dejar al paciente en observación para reevaluación, dado que ___.

Se explica al paciente y a su acompañante por qué no se define la conducta en este momento y qué se está esperando. Se reevaluará en [tiempo], o antes si hay deterioro.`,
  },
  {
    title: "Egreso con reevaluación previa",
    category: "Disposición",
    tier: "campos",
    content: `Antes del egreso se reevalúa al paciente a las [hora]: signos vitales estables, dolor controlado, tolera la vía oral y deambula sin dificultad.

Se da salida con fórmula médica, recomendaciones y signos de alarma explicados. El paciente y su acompañante manifiestan haberlos comprendido.`,
  },
  {
    title: "Remisión a mayor nivel de complejidad",
    category: "Disposición",
    tier: "campos",
    content: `Se remite a mayor nivel de complejidad por requerir [servicio o especialidad], del que no se dispone en esta institución.

Se contacta a [EPS / centro regulador] a las [hora]. Acepta [institución], servicio de [servicio], profesional [nombre].
Sale a las [hora] en [medio de transporte], acompañado por [personal], con [oxígeno / accesos venosos / monitorización] y con copia de los estudios realizados.`,
  },
  {
    title: "Hospitalización y entrega al servicio",
    category: "Disposición",
    tier: "campos",
    content: `Se define hospitalización en [servicio] por ___.

Se entrega el paciente a [médico o servicio receptor] a las [hora], con resumen del caso, estudios realizados y estudios pendientes.
Órdenes dejadas: ___. Se informa a la familia la conducta y su motivo.`,
  },
  {
    title: "Alta voluntaria · no acepta el manejo indicado",
    category: "Disposición",
    tier: "campos",
    content: `El paciente, en pleno uso de sus facultades mentales, manifiesta su decisión de [retirarse del servicio / no aceptar el manejo indicado] a las [hora].

Se le explican en lenguaje claro el diagnóstico, el manejo recomendado y los riesgos de no recibirlo, entre ellos ___. Manifiesta haber comprendido y persiste en su decisión.
Se le indican los signos de alarma por los que debe regresar de inmediato y se deja constancia de que el servicio queda a su disposición.`,
  },
  {
    title: "Entrega de turno",
    category: "Disposición",
    tier: "campos",
    content: `Se entrega el paciente al turno entrante, a [nombre del médico], a las [hora].

Diagnóstico de trabajo: ___. Manejo administrado hasta ahora: ___.
Pendientes: [estudios por resultar / interconsultas por responder / medicamentos por administrar].
Qué vigilar: ___.`,
  },
  {
    title: "Signos de alarma para volver a urgencias",
    category: "Recomendaciones",
    tier: "prosa",
    content: `Consultar de inmediato al servicio de urgencias si presenta:

- Dificultad para respirar o dolor en el pecho.
- Fiebre que no cede con el manejo indicado.
- Vómito persistente o incapacidad para tolerar líquidos.
- Somnolencia, confusión o desmayo.
- Empeoramiento del dolor o aparición de cualquier síntoma nuevo.

Se explican estos signos al paciente y a su acompañante, quienes manifiestan haberlos comprendido.`,
  },
  {
    title: "Cuidados en casa tras el egreso",
    category: "Recomendaciones",
    tier: "campos",
    content: `Reposo relativo según tolerancia, hidratación abundante por vía oral y alimentación fraccionada.

Completar el tratamiento formulado en los horarios indicados, aunque los síntomas mejoren antes de terminarlo.
Control por consulta externa en [tiempo], o antes en urgencias si aparecen los signos de alarma explicados.`,
  },
  {
    title: "Incapacidad y control",
    category: "Plan",
    tier: "campos",
    content: `Se expide incapacidad por [días] día(s) a partir de hoy: el cuadro actual limita el desempeño de las funciones habituales del paciente.

Se explica que el reposo hace parte del tratamiento. Control por [consulta externa / medicina laboral] en [tiempo] para revaloración.`,
  },
  {
    title: "Infección de vías urinarias",
    category: "Análisis",
    tier: "campos",
    content: `Infección de vías urinarias [baja no complicada / alta - pielonefritis], [sin / con] criterios de severidad ni compromiso sistémico.

Se define manejo [ambulatorio / intrahospitalario] por ___.`,
  },
  {
    title: "Enfermedad diarreica aguda",
    category: "Análisis",
    tier: "campos",
    content: `Enfermedad diarreica aguda, de probable origen [viral / bacteriano], con deshidratación [ausente / leve / moderada].

Tolera la vía oral. [Sin / Con] criterios de hospitalización. [No hay / Hay] indicación de antibiótico.`,
  },
  {
    title: "Infección respiratoria aguda de vías altas",
    category: "Análisis",
    tier: "prosa",
    content: `Infección respiratoria aguda de vías altas, de probable origen viral. Sin signos de dificultad respiratoria ni criterios de manejo intrahospitalario.

No hay indicación de antibiótico; se explica al paciente por qué no se formula.`,
  },
  {
    title: "Neumonía adquirida en la comunidad",
    category: "Análisis",
    tier: "campos",
    content: `Neumonía adquirida en la comunidad, con compromiso [lobar / multilobar] en [hemitórax derecho / izquierdo / ambos].

Se evalúa la severidad con la escala y el puntaje enunciados: ___. Se define manejo [ambulatorio / hospitalario] por ___.`,
  },
  {
    title: "Faringoamigdalitis aguda",
    category: "Análisis",
    tier: "campos",
    content: `Faringoamigdalitis aguda de probable origen [viral / bacteriano], [sin / con] criterios suficientes para iniciar antibiótico de entrada.

Se explica al paciente la conducta y qué debe vigilar en casa.`,
  },
  {
    title: "Crisis asmática",
    category: "Análisis",
    tier: "campos",
    content: `Crisis asmática de severidad [leve / moderada / severa], con [buena / parcial / nula] respuesta al broncodilatador.

Saturación y trabajo respiratorio: ___. Se define [egreso / observación / hospitalización] por ___.`,
  },
  {
    title: "EPOC exacerbado",
    category: "Análisis",
    tier: "campos",
    content: `Exacerbación de enfermedad pulmonar obstructiva crónica, de probable origen [infeccioso / no infeccioso].

Respuesta al manejo inicial: ___. Se define [egreso / observación / hospitalización] por ___.`,
  },
  {
    title: "Cólico nefrítico",
    category: "Análisis",
    tier: "campos",
    content: `Cólico nefrítico [derecho / izquierdo], [con / sin] signos de complicación (fiebre, anuria, deterioro de la función renal).

Respuesta a la analgesia: ___. Se define manejo [ambulatorio / hospitalario] y estudio con ___.`,
  },
  {
    title: "Apendicitis aguda · sospecha",
    category: "Análisis",
    tier: "campos",
    content: `Cuadro compatible con apendicitis aguda: dolor [migratorio a fosa ilíaca derecha / localizado en ___], con signos de irritación peritoneal [presentes / ausentes].

Se solicita valoración por cirugía general y se deja al paciente en ayuno. No se administra analgesia que enmascare el cuadro sin antes ___.`,
  },
  {
    title: "Dolor abdominal en estudio",
    category: "Análisis",
    tier: "campos",
    content: `Dolor abdominal sin diagnóstico definido al momento de esta valoración, [sin / con] signos de irritación peritoneal y [sin / con] criterios de abdomen quirúrgico.

Se deja en observación para reevaluación y se solicita ___, ya que ___.`,
  },
  {
    title: "Gastritis y dispepsia",
    category: "Análisis",
    tier: "campos",
    content: `Cuadro compatible con [gastritis / dispepsia] aguda, sin signos de sangrado digestivo ni de complicación.

Sin criterios de manejo intrahospitalario. Se define manejo ambulatorio y control si no hay mejoría.`,
  },
  {
    title: "Migraña y cefalea primaria",
    category: "Análisis",
    tier: "campos",
    content: `Cefalea de características [migrañosas / tensionales], sin signos de alarma neurológicos: sin déficit focal, sin fiebre, sin rigidez de nuca y sin cambio en el patrón habitual.

No hay indicación de neuroimagen en este momento. Respuesta a la analgesia: ___.`,
  },
  {
    title: "Lumbalgia mecánica",
    category: "Análisis",
    tier: "prosa",
    content: `Lumbalgia mecánica sin signos de alarma: sin déficit neurológico, sin fiebre, sin pérdida de peso, sin trauma de importancia y sin compromiso de esfínteres.

No hay indicación de estudios de imagen en este momento.`,
  },
  {
    title: "Esguince y trauma de tejidos blandos",
    category: "Análisis",
    tier: "campos",
    content: `Esguince de [articulación] grado [I / II / III], [con / sin] criterios para descartar fractura según los hallazgos y el mecanismo.

Se indica inmovilización con ___, hielo local, elevación y control ortopédico en ___.`,
  },
  {
    title: "Herida que requiere sutura",
    category: "Análisis",
    tier: "campos",
    content: `Herida en [localización], de aproximadamente [tamaño], [con / sin] compromiso de estructuras profundas, tendones ni compromiso neurovascular.

Se realiza lavado, asepsia y afrontamiento con [material] [número] puntos, previa anestesia local. Se verifica el estado de vacunación antitetánica: ___. Retiro de puntos en ___.`,
  },
  {
    title: "Urgencia hipertensiva",
    category: "Análisis",
    tier: "campos",
    content: `Cifras tensionales elevadas [sin / con] evidencia de daño agudo de órgano blanco, lo que la clasifica como [urgencia / emergencia] hipertensiva.

Respuesta al manejo: ___. Se define [egreso con ajuste de tratamiento / observación / hospitalización] por ___.`,
  },
  {
    title: "Dolor torácico de origen no coronario",
    category: "Análisis",
    tier: "campos",
    content: `Dolor torácico con características [no anginosas / atípicas], electrocardiograma sin cambios isquémicos agudos y marcadores ___.

Se considera un origen [musculoesquelético / pleurítico / digestivo / ansioso]. Se explican los signos de alarma y el motivo por el cual se egresa.`,
  },
  {
    title: "Síndrome coronario agudo · sospecha",
    category: "Análisis",
    tier: "campos",
    content: `Cuadro compatible con síndrome coronario agudo [con / sin] elevación del segmento ST, según el electrocardiograma de las [hora] y los marcadores ___.

Se activa [código infarto / interconsulta a cardiología] a las [hora]. Se define [trombólisis / traslado a hemodinamia / manejo médico] por ___.`,
  },
  {
    title: "Hipoglucemia",
    category: "Análisis",
    tier: "campos",
    content: `Hipoglucemia sintomática, con glucometría de [valor] mg/dL a las [hora], en paciente [con / sin] antecedente de diabetes en tratamiento.

Se corrige con ___ y se controla la glucometría a las [hora]: [valor] mg/dL. Se identifica como causa probable ___.`,
  },
  {
    title: "Descompensación diabética",
    category: "Análisis",
    tier: "campos",
    content: `Hiperglucemia con glucometría de [valor] mg/dL, [con / sin] criterios de cetoacidosis ni estado hiperosmolar según los gases y los paraclínicos.

Se define manejo [ambulatorio con ajuste / hospitalario] por ___.`,
  },
  {
    title: "Reacción alérgica y urticaria",
    category: "Análisis",
    tier: "campos",
    content: `Reacción alérgica de severidad [leve - cutánea / moderada / anafilaxia], desencadenada por [alérgeno probable / desencadenante no identificado].

[Sin / Con] compromiso de la vía aérea ni inestabilidad hemodinámica. Respuesta al manejo: ___. Se observa durante ___ por el riesgo de reacción bifásica.`,
  },
  {
    title: "Vértigo periférico",
    category: "Análisis",
    tier: "campos",
    content: `Cuadro vertiginoso de características [periféricas / centrales], sin déficit neurológico focal ni signos de alarma que sugieran compromiso central.

Respuesta al manejo: ___. Se explican los signos de alarma para reconsultar.`,
  },
  {
    title: "Crisis convulsiva",
    category: "Análisis",
    tier: "campos",
    content: `Crisis convulsiva [tónico-clónica generalizada / focal] de aproximadamente [duración], en paciente [con / sin] antecedente de epilepsia y [con / sin] adherencia al tratamiento.

Estado posictal: ___. Se identifica como desencadenante probable ___. Se define [egreso / observación / hospitalización] y estudio con ___.`,
  },
  {
    title: "Celulitis y infección de tejidos blandos",
    category: "Análisis",
    tier: "campos",
    content: `Celulitis en [localización], [sin / con] signos de compromiso sistémico, absceso ni fascitis.

Se delimita el borde eritematoso para seguimiento. Se define manejo [ambulatorio / hospitalario] por ___.`,
  },
  {
    title: "Dengue · sospecha",
    category: "Análisis",
    tier: "campos",
    content: `Cuadro febril compatible con dengue, [sin signos de alarma / con signos de alarma / grave], según ___.

Hemograma con ___. Se explican los signos de alarma y se indica control con hemograma en ___.`,
  },
  {
    title: "Intoxicación alcohólica aguda",
    category: "Análisis",
    tier: "campos",
    content: `Intoxicación alcohólica aguda, con estado de conciencia ___ y sin evidencia de trauma craneoencefálico asociado al examen.

Se descarta hipoglucemia con glucometría de [valor] mg/dL. Se deja en observación hasta recuperar el estado de alerta y la deambulación segura.`,
  },
  {
    title: "Dipirona · IV",
    category: "Intervenciones",
    tier: "campos",
    content: `Dipirona [1 g / 2 g] IV, diluida y en infusión lenta, a las [hora].

Respuesta: ___.`,
  },
  {
    title: "Acetaminofén",
    category: "Intervenciones",
    tier: "campos",
    content: `Acetaminofén [500 mg / 1 g] [VO / IV] a las [hora].

Respuesta: ___.`,
  },
  {
    title: "Diclofenaco · IM",
    category: "Intervenciones",
    tier: "campos",
    content: `Diclofenaco [75 mg] IM a las [hora]. Se verifica ausencia de contraindicación renal, gástrica y alérgica.

Respuesta: ___.`,
  },
  {
    title: "Ketorolaco · IV",
    category: "Intervenciones",
    tier: "campos",
    content: `Ketorolaco [30 mg] IV a las [hora]. Se verifica ausencia de contraindicación renal, gástrica y alérgica.

Respuesta: ___.`,
  },
  {
    title: "Tramadol · IV",
    category: "Intervenciones",
    tier: "campos",
    content: `Tramadol [50 mg / 100 mg] IV, diluido en [volumen] de solución salina y en infusión lenta, a las [hora].

Respuesta: ___. Sin náuseas ni somnolencia excesiva.`,
  },
  {
    title: "Morfina · IV titulada",
    category: "Intervenciones",
    tier: "campos",
    content: `Morfina [dosis] IV titulada según respuesta, a las [hora], con monitorización de la frecuencia respiratoria y la saturación.

Dosis total administrada: ___. Respuesta: ___.`,
  },
  {
    title: "Butilbromuro de hioscina",
    category: "Intervenciones",
    tier: "campos",
    content: `Butilbromuro de hioscina [20 mg] [IV / IM] a las [hora].

Respuesta: ___.`,
  },
  {
    title: "Metoclopramida · IV",
    category: "Intervenciones",
    tier: "campos",
    content: `Metoclopramida [10 mg] IV, en infusión lenta, a las [hora].

Respuesta: ___. Sin síntomas extrapiramidales.`,
  },
  {
    title: "Ondansetrón · IV",
    category: "Intervenciones",
    tier: "campos",
    content: `Ondansetrón [4 mg / 8 mg] IV a las [hora].

Respuesta: ___.`,
  },
  {
    title: "Ceftriaxona · IV",
    category: "Intervenciones",
    tier: "campos",
    content: `Ceftriaxona [1 g / 2 g] IV cada [12 / 24] horas. Primera dosis a las [hora].

Se verifica ausencia de alergia a betalactámicos antes de administrar.`,
  },
  {
    title: "Ampicilina sulbactam · IV",
    category: "Intervenciones",
    tier: "campos",
    content: `Ampicilina/sulbactam [dosis] IV cada [6 / 8] horas. Primera dosis a las [hora].

Se verifica ausencia de alergia a betalactámicos antes de administrar.`,
  },
  {
    title: "Salbutamol · nebulizado",
    category: "Intervenciones",
    tier: "campos",
    content: `Salbutamol [dosis] nebulizado con [volumen] de solución salina, a las [hora]. Se repiten [número] ciclos con intervalo de [tiempo].

Respuesta: saturación, trabajo respiratorio y auscultación tras la nebulización: ___.`,
  },
  {
    title: "Bromuro de ipratropio · nebulizado",
    category: "Intervenciones",
    tier: "campos",
    content: `Bromuro de ipratropio [dosis] nebulizado junto con el broncodilatador, a las [hora].

Respuesta: ___.`,
  },
  {
    title: "Hidrocortisona · IV",
    category: "Intervenciones",
    tier: "campos",
    content: `Hidrocortisona [dosis] IV a las [hora].

Respuesta: ___.`,
  },
  {
    title: "Metilprednisolona · IV",
    category: "Intervenciones",
    tier: "campos",
    content: `Metilprednisolona [dosis] IV a las [hora].

Respuesta: ___.`,
  },
  {
    title: "Dexametasona",
    category: "Intervenciones",
    tier: "campos",
    content: `Dexametasona [dosis] [IV / IM] a las [hora].

Respuesta: ___.`,
  },
  {
    title: "Difenhidramina · IV",
    category: "Intervenciones",
    tier: "campos",
    content: `Difenhidramina [dosis] [IV / IM] a las [hora], en infusión lenta.

Respuesta de las lesiones y del prurito: ___.`,
  },
  {
    title: "Adrenalina · anafilaxia",
    category: "Intervenciones",
    tier: "campos",
    content: `Adrenalina [dosis] de la dilución [1:1000] por vía INTRAMUSCULAR en cara anterolateral del muslo, a las [hora].

Se repite a los [tiempo] por ___. Respuesta: vía aérea, tensión arterial y lesiones tras la dosis: ___.`,
  },
  {
    title: "Solución salina · líquidos IV",
    category: "Intervenciones",
    tier: "campos",
    content: `Solución salina al 0,9 % [volumen] IV, en [bolo / infusión] en [tiempo], iniciada a las [hora].

Respuesta hemodinámica y diuresis: ___.`,
  },
  {
    title: "Lactato de Ringer · líquidos IV",
    category: "Intervenciones",
    tier: "campos",
    content: `Lactato de Ringer [volumen] IV, en [bolo / infusión] en [tiempo], iniciado a las [hora].

Respuesta hemodinámica y diuresis: ___.`,
  },
  {
    title: "Dextrosa · corrección de hipoglucemia",
    category: "Intervenciones",
    tier: "campos",
    content: `Dextrosa [concentración] [volumen] IV a las [hora], por glucometría de [valor] mg/dL.

Glucometría de control a las [hora]: [valor] mg/dL. Estado de conciencia tras la corrección: ___.`,
  },
  {
    title: "Ácido acetilsalicílico · dolor torácico",
    category: "Intervenciones",
    tier: "campos",
    content: `Ácido acetilsalicílico [dosis] VO, masticado, a las [hora], por sospecha de síndrome coronario agudo.

Se verifica ausencia de alergia y de sangrado activo antes de administrar.`,
  },
  {
    title: "Omeprazol · IV",
    category: "Intervenciones",
    tier: "campos",
    content: `Omeprazol [dosis] IV a las [hora].

Respuesta: ___.`,
  },
  {
    title: "Cefalexina · fórmula de salida",
    category: "Plan",
    tier: "campos",
    content: `Cefalexina [dosis] VO cada [6 / 8] horas por [días] días.

Tomarla siempre a la misma hora y completar el tratamiento aunque se sienta mejor antes.`,
  },
  {
    title: "Amoxicilina · fórmula de salida",
    category: "Plan",
    tier: "campos",
    content: `Amoxicilina [con / sin] ácido clavulánico, [dosis] VO cada [8 / 12] horas por [días] días.

Tomarla siempre a la misma hora y completar el tratamiento aunque se sienta mejor antes.`,
  },
  {
    title: "Ciprofloxacino · fórmula de salida",
    category: "Plan",
    tier: "campos",
    content: `Ciprofloxacino [dosis] VO cada [12] horas por [días] días.

Se explica que no debe tomarse junto con lácteos ni antiácidos, y que debe consultar si aparece dolor tendinoso.`,
  },
  {
    title: "Nitrofurantoína · fórmula de salida",
    category: "Plan",
    tier: "campos",
    content: `Nitrofurantoína [dosis] VO cada [6 / 12] horas por [días] días.

Tomarla con alimentos y completar el tratamiento aunque los síntomas cedan antes.`,
  },
  {
    title: "Analgesia ambulatoria · fórmula de salida",
    category: "Plan",
    tier: "campos",
    content: `[Acetaminofén / Dipirona / Ibuprofeno] [dosis] VO cada [6 / 8] horas por [días] días, condicionado a dolor.

No superar [número] dosis en 24 horas. Consultar si el dolor no cede con el manejo indicado.`,
  },
  {
    title: "Inhalador de rescate · fórmula de salida",
    category: "Plan",
    tier: "campos",
    content: `Salbutamol inhalador, [número] inhalaciones cada [tiempo] condicionado a dificultad respiratoria, con inhalocámara.

Se explica y se verifica la técnica de uso con el paciente. Consultar si necesita usarlo con más frecuencia de la indicada.`,
  },
  {
    title: "Suero de rehidratación oral · fórmula de salida",
    category: "Plan",
    tier: "campos",
    content: `Suero de rehidratación oral [volumen] después de cada deposición, en sorbos pequeños.

Continuar la alimentación habitual. No suspender la vía oral y no usar antidiarreicos.`,
  },
];
