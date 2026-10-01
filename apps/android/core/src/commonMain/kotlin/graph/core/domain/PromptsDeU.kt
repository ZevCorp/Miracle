package graph.core.domain

/**
 * LO QUE VA PRIMERO EN TODO PROMPT DE LA APP QUE LE HABLA A LA PERSONA EN NOMBRE DE Ü (spec 010).
 *
 * Hasta el 2026-10-01 cada prompt de la app que produce algo que Ü dice o propone —anticipar lo siguiente, proponer
 * mientras aprende, la reunión, lo que entendió de un video— se presentaba con su propia Ü («Eres Ü. Acabas de…», «Eres
 * Ü, un asistente con voz propia…»), y ninguno sabía si le hablaba a un médico. Ahora empiezan igual que el cerebro: quién
 * es Ü de la constitución y, si se eligió, «QUIÉN TE HABLA». Lo demás de cada prompt —su trabajo y su JSON— es suyo.
 *
 * Va fuera de la raw string de cada prompt a propósito: interpolar un texto de varias líneas dentro de un
 * `"""…""".trimIndent()` deja la sangría del código fuente en el texto (spec 009).
 */
object PromptsDeU {

    /** Quién es Ü y, si se eligió, quién le habla, separados por una línea en blanco. Sin elegir: solo quién es Ü. */
    fun cabecera(perfil: PerfilDeUso): String = componer(ConstitucionDeU.QUIEN, perfil.bloqueDelPrompt())

    /**
     * Lo que se pone detrás del bloque del perfil en todo prompt cuyo resultado va a la memoria (spec 010, promesa 1010).
     * Sin ella, el criterio de cada destilador («con los nombres y datos CONCRETOS», «si aporta algo reutilizable») podía
     * más que «Los datos de un paciente no van a tu memoria», que el bloque del médico trae y el destilador no sabía que
     * mandaba (revisión del 2026-10-01).
     */
    const val PRECEDENCIA_DE_LA_MEMORIA = "Lo que dice QUIÉN TE HABLA sobre la memoria manda sobre el criterio de abajo."

    /**
     * El prompt de un destilador de memoria: su [papel], el bloque del perfil con [PRECEDENCIA_DE_LA_MEMORIA], y su
     * [criterio]. Sin perfil elegido no hay bloque ni frase, y queda el prompt de antes: papel y criterio separados por una
     * línea en blanco.
     */
    fun paraLaMemoria(perfil: PerfilDeUso, papel: String, criterio: String): String {
        val bloque = perfil.bloqueDelPrompt()
        if (bloque.isEmpty()) return componer(papel, criterio)
        return componer(papel, bloque, PRECEDENCIA_DE_LA_MEMORIA, criterio)
    }

    /** Como `composePrompt` de Graph: cada bloque sin blancos a los lados, los vacíos fuera, una línea en blanco entre ellos. */
    fun componer(vararg bloques: String): String =
        bloques.map { it.trim() }.filter { it.isNotEmpty() }.joinToString("\n\n")
}
