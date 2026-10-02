package graph.core.domain

/**
 * EL CATÁLOGO DE ESPECIALIDADES, el de Graph (spec 010): código en snake_case y nombre con tildes.
 *
 * ES UNA COPIA de `services/graph/src/domain/clinical/specialtyNames.js` (los 49 pares, en su orden), hecha el
 * 2026-10-01. Copia y no lectura porque la regla 3 del monorepo prohíbe leer archivos de otro proyecto y `packages/`
 * todavía no existe. Graph normaliza `profile.specialty` contra esa lista y descarta lo que no está en ella, así que un
 * código que viaja desde aquí tiene que ser uno de los suyos. Windows guarda los del portal en kebab-case
 * («medicina-general»); `buscar` los encuentra igual, porque la normalización es la de Graph.
 *
 * LO QUE NO ESTÁ EN EL CATÁLOGO NO ES UNA ESPECIALIDAD. Windows deja escribir una a mano; aquí no, porque su nombre va
 * tal cual al prompt del cerebro local, y un texto libre en un prompt del sistema es una puerta para meterle órdenes. Si
 * Graph añade una especialidad, se añade aquí y en el test de la promesa 1001, a mano.
 */
object Especialidades {

    data class Especialidad(val codigo: String, val nombre: String)

    val TODAS: List<Especialidad> = listOf(
        Especialidad("medicina_general", "Medicina general"),
        Especialidad("medicina_familiar", "Medicina familiar"),
        Especialidad("medicina_interna", "Medicina interna"),
        Especialidad("pediatria", "Pediatría"),
        Especialidad("neonatologia", "Neonatología"),
        Especialidad("ginecologia_obstetricia", "Ginecología y obstetricia"),
        Especialidad("urgencias", "Medicina de urgencias"),
        Especialidad("cardiologia", "Cardiología"),
        Especialidad("dermatologia", "Dermatología"),
        Especialidad("endocrinologia", "Endocrinología"),
        Especialidad("gastroenterologia", "Gastroenterología"),
        Especialidad("geriatria", "Geriatría"),
        Especialidad("hematologia", "Hematología"),
        Especialidad("infectologia", "Infectología"),
        Especialidad("nefrologia", "Nefrología"),
        Especialidad("neumologia", "Neumología"),
        Especialidad("neurologia", "Neurología"),
        Especialidad("oncologia", "Oncología clínica"),
        Especialidad("psiquiatria", "Psiquiatría"),
        Especialidad("psicologia", "Psicología clínica"),
        Especialidad("reumatologia", "Reumatología"),
        Especialidad("alergologia", "Alergología e inmunología"),
        Especialidad("dolor_paliativos", "Dolor y cuidados paliativos"),
        Especialidad("rehabilitacion", "Medicina física y rehabilitación"),
        Especialidad("medicina_laboral", "Medicina laboral"),
        Especialidad("medicina_legal", "Medicina legal"),
        Especialidad("anestesiologia", "Anestesiología"),
        Especialidad("cirugia_general", "Cirugía general"),
        Especialidad("cirugia_cardiovascular", "Cirugía cardiovascular"),
        Especialidad("cirugia_torax", "Cirugía de tórax"),
        Especialidad("cirugia_vascular", "Cirugía vascular"),
        Especialidad("neurocirugia", "Neurocirugía"),
        Especialidad("cirugia_plastica", "Cirugía plástica"),
        Especialidad("cirugia_pediatrica", "Cirugía pediátrica"),
        Especialidad("coloproctologia", "Coloproctología"),
        Especialidad("ortopedia", "Ortopedia y traumatología"),
        Especialidad("oftalmologia", "Oftalmología"),
        Especialidad("otorrinolaringologia", "Otorrinolaringología"),
        Especialidad("urologia", "Urología"),
        Especialidad("cirugia_maxilofacial", "Cirugía oral y maxilofacial"),
        Especialidad("radiologia", "Radiología e imágenes diagnósticas"),
        Especialidad("patologia", "Patología"),
        Especialidad("medicina_nuclear", "Medicina nuclear"),
        Especialidad("genetica", "Genética médica"),
        Especialidad("odontologia_general", "Odontología general"),
        Especialidad("endodoncia", "Endodoncia"),
        Especialidad("periodoncia", "Periodoncia"),
        Especialidad("ortodoncia", "Ortodoncia"),
        Especialidad("rehabilitacion_oral", "Rehabilitación oral"),
    )

    /** Nombre normalizado → especialidad: «Ginecología y obstetricia» se encuentra aunque su código sea otro. */
    private val porNombre: Map<String, Especialidad> = TODAS.associateBy { normalizarCodigo(it.nombre) }
    private val porCodigo: Map<String, Especialidad> = TODAS.associateBy { it.codigo }

    /**
     * El `normalizeSpecialtyCode` de Graph: sin tildes, en minúsculas, y cada tramo de lo que no es letra o número pasa a
     * ser un `_`, sin `_` en los bordes. «Medicina-General» → «medicina_general»; «CARDIOLOGÍA» → «cardiologia».
     */
    fun normalizarCodigo(texto: String?): String {
        val sb = StringBuilder()
        var hueco = false
        for (c in (texto ?: "").lowercase()) {
            if (c in '̀'..'ͯ') continue // una tilde ya separada de su letra (texto en forma NFD)
            val base = sinTilde(c)
            if (base in 'a'..'z' || base in '0'..'9') {
                if (hueco && sb.isNotEmpty()) sb.append('_')
                sb.append(base)
                hueco = false
            } else {
                hueco = true
            }
        }
        return sb.toString()
    }

    /**
     * La especialidad de un código o de un nombre, o `null` si no está en el catálogo. Como Graph (`catalogCode` de
     * `profile.js`): se mira lo escrito hasta 80 caracteres, primero como código y después como nombre.
     */
    fun buscar(texto: String?): Especialidad? {
        val clave = normalizarCodigo(texto?.take(LARGO_QUE_SE_MIRA))
        if (clave.isEmpty()) return null
        return porCodigo[clave] ?: porNombre[clave]
    }

    private const val LARGO_QUE_SE_MIRA = 80

    /** Las letras con tilde del español y sus vecinas: common no tiene `java.text.Normalizer`. */
    private fun sinTilde(c: Char): Char = when (c) {
        'á', 'à', 'â', 'ä', 'ã', 'å' -> 'a'
        'é', 'è', 'ê', 'ë' -> 'e'
        'í', 'ì', 'î', 'ï' -> 'i'
        'ó', 'ò', 'ô', 'ö', 'õ' -> 'o'
        'ú', 'ù', 'û', 'ü' -> 'u'
        'ñ' -> 'n'
        'ç' -> 'c'
        else -> c
    }
}
