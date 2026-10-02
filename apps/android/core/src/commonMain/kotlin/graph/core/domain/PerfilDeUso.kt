package graph.core.domain

/**
 * CON QUIÉN HABLA Ü EN ESTE TELÉFONO (spec 010): alguien que trabaja en salud —un médico, con su especialidad del
 * catálogo o sin ella—, una persona que la usa en su día a día, o todavía nadie lo dijo. Es puro: no lee disco ni red, y
 * por eso el contrato lo juzga entero.
 *
 * NACE DEL PEDIDO DEL DUEÑO del 2026-10-01: que Ü pregunte al empezar quién la usa y le hable según eso, como ya hacen
 * Windows (`apps/windows/windows-client/src/Cuenta/PerfilDeUso.cs`, su spec 078) y Graph. Es la misma idea reescrita en
 * Kotlin, con dos diferencias deliberadas: la especialidad sale SIEMPRE del catálogo de Graph ([Especialidades]), nunca
 * de texto libre, porque su nombre va al prompt del cerebro local; y no hay cuenta Miracle que mande, porque Android no
 * lee `profiles`.
 *
 * SIN ELEGIR ES LA Ü DE ANTES, BYTE A BYTE: no viaja nada a Graph, el prompt local no lleva bloque, y un valor que esta
 * versión no conoce —uno de una versión futura, o una errata— también es «sin elegir», no un perfil por defecto: adivinar
 * le hablaría a un médico como a un paciente, o al revés.
 */
class PerfilDeUso private constructor(
    /** [MEDICO], [PERSONA] o "" (sin elegir). */
    val tipo: String,
    /** Del catálogo, o `null`. Una persona no tiene. */
    val especialidad: Especialidades.Especialidad?,
) {
    val especialidadCodigo: String get() = especialidad?.codigo ?: ""
    val especialidadNombre: String get() = especialidad?.nombre ?: ""
    val esMedico: Boolean get() = tipo == MEDICO
    val esPersona: Boolean get() = tipo == PERSONA
    val elegido: Boolean get() = tipo.isNotEmpty()

    /**
     * El bloque «QUIÉN TE HABLA» de la constitución, el mismo que arma Graph (`profileBlock` de `conscious-brain/prompt.js`):
     * el del médico con `{ESPECIALIDAD}` sustituido por «, especialista en <Nombre>» o por nada; el de la persona tal cual;
     * vacío sin elegir. El nombre es el del catálogo, nunca el que se guardó.
     */
    fun bloqueDelPrompt(): String = when {
        esMedico -> ConstitucionDeU.PERFIL_MEDICO.replace(
            MARCA_DE_ESPECIALIDAD,
            especialidad?.let { ", especialista en ${it.nombre}" } ?: "",
        )
        esPersona -> ConstitucionDeU.PERFIL_PERSONA
        else -> ""
    }

    /** Lo que se guarda en las preferencias `graph`, con las claves de aquí. [desdeGuardado] lo lee igual. */
    fun guardado(): Map<String, String> = mapOf(
        CLAVE_PERFIL to tipo,
        CLAVE_ESPECIALIDAD to especialidadCodigo,
        CLAVE_ESPECIALIDAD_NOMBRE to especialidadNombre,
    )

    /** Cómo se ve en «Cómo me usas»: «Trabajo en salud · Cardiología», «Uso personal» o «Sin elegir». */
    fun paraElMenu(): String = when {
        esMedico -> if (especialidad != null) "$SALUD · ${especialidad.nombre}" else SALUD
        esPersona -> PERSONAL
        else -> "Sin elegir"
    }

    /** Para el log: «médico · Cardiología (cardiologia)», «médico», «persona» o «sin elegir». */
    fun describir(): String = when {
        esMedico -> if (especialidad != null) "médico · ${especialidad.nombre} (${especialidad.codigo})" else "médico"
        esPersona -> "persona"
        else -> "sin elegir"
    }

    override fun equals(other: Any?): Boolean =
        other is PerfilDeUso && other.tipo == tipo && other.especialidadCodigo == especialidadCodigo

    override fun hashCode(): Int = tipo.hashCode() * 31 + especialidadCodigo.hashCode()

    override fun toString(): String = "PerfilDeUso(${describir()})"

    /** Qué le pregunta la app a quien la abre. Ver [queBienvenida]. */
    enum class Bienvenida {
        /** Nadie dijo su nombre: el nombre y después el perfil. */
        ENTERA,

        /** Ya tenía nombre (una Ü de antes de la spec 010): solo cómo la usa. */
        SOLO_PERFIL,

        /** Ya se sabe quién es y cómo la usa. */
        NADA,
    }

    companion object {
        /** El valor guardado en `perfil` y el `profile.kind` de Graph para alguien que trabaja en salud. */
        const val MEDICO = "medico"

        /** El valor guardado en `perfil` y el `profile.kind` de Graph para el uso personal. */
        const val PERSONA = "persona"

        /** Las claves en las preferencias `graph`. Viven aquí para que nadie las escriba a mano (promesa 1007). */
        const val CLAVE_PERFIL = "perfil"
        const val CLAVE_ESPECIALIDAD = "especialidad"
        const val CLAVE_ESPECIALIDAD_NOMBRE = "especialidadNombre"

        /** Los rótulos de la bienvenida, los mismos que en Windows. */
        const val SALUD = "Trabajo en salud"
        const val PERSONAL = "Uso personal"

        private const val MARCA_DE_ESPECIALIDAD = "{ESPECIALIDAD}"

        /** Nadie lo dijo todavía: lo de antes. */
        val SIN_ELEGIR = PerfilDeUso("", null)

        private val PERSONA_ = PerfilDeUso(PERSONA, null)

        /**
         * Lo que la persona dijo o se guardó, en su forma canónica: «Médico», «médica » y «MEDICO» son [MEDICO]; «Persona»
         * es [PERSONA]; cualquier otra cosa es "", sin elegir.
         */
        fun normalizarTipo(tipo: String?): String = when (Especialidades.normalizarCodigo(tipo)) {
            "medico", "medica" -> MEDICO
            "persona" -> PERSONA
            else -> ""
        }

        /** Un médico con la especialidad del catálogo que diga [especialidad] (código o nombre); si no está, sin ella. */
        fun medico(especialidad: String? = null): PerfilDeUso = PerfilDeUso(MEDICO, Especialidades.buscar(especialidad))

        fun persona(): PerfilDeUso = PERSONA_

        /**
         * El perfil de lo que hay en las preferencias. La especialidad se busca por el código y, si no está, por el nombre
         * guardado, como Graph (`normalizeProfile` de `profile.js`); las dos búsquedas son en el catálogo, así que lo que se
         * guardó a mano y no está en él no llega a ningún sitio. Una persona no tiene especialidad, aunque quede una vieja
         * guardada.
         */
        fun desdeGuardado(perfil: String?, especialidad: String?, especialidadNombre: String?): PerfilDeUso =
            when (normalizarTipo(perfil)) {
                MEDICO -> PerfilDeUso(MEDICO, Especialidades.buscar(especialidad) ?: Especialidades.buscar(especialidadNombre))
                PERSONA -> PERSONA_
                else -> SIN_ELEGIR
            }

        /**
         * Qué bienvenida toca. El nombre se sigue pidiendo como antes; el perfil se pregunta una vez y no bloquea: si la
         * persona cierra la pregunta sin elegir, queda «sin elegir» y se le vuelve a preguntar al abrir la app, como en
         * Windows (`Identidad.QueBienvenida`).
         */
        fun queBienvenida(nombre: String?, perfil: String?): Bienvenida = when {
            nombre.isNullOrBlank() -> Bienvenida.ENTERA
            normalizarTipo(perfil).isEmpty() -> Bienvenida.SOLO_PERFIL
            else -> Bienvenida.NADA
        }
    }
}
