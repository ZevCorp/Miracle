package graph.core.contrato

import graph.core.contrato.Contrato009CerebroLocal.Companion.emojis
import graph.core.domain.ConstitucionDeU
import graph.core.domain.PerfilDeUso
import graph.core.domain.PromptsDeU
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * LAS PROMESAS 1007-1010 SE JUZGAN LEYENDO LAS FUENTES (docs/specs/010), mismo criterio que 905 y 908-911: la bienvenida,
 * `GraphApp` y los prompts propios de la app son Android y no corren en `jvmTest`, pero lo que prometen está escrito —qué
 * se pregunta, dónde se guarda, a qué cerebro llega el perfil y con qué empieza cada prompt—. Lo que es del núcleo se
 * juzga corriéndolo.
 */
class Contrato010PerfilEnLaApp {

    companion object {
        val PROMESAS = mapOf(
            1007 to "La app pregunta el perfil con lo del núcleo: después del nombre, la bienvenida ofrece «Trabajo en salud» y «Uso personal», y para salud la lista de especialidades del catálogo con «Sin especialidad»; se puede cambiar en «Cómo me usas»; y se guarda en las preferencias `graph` con las claves del núcleo.",
            1008 to "Los tres cerebros de la app hablan con quien se eligió: Graph lo recibe en el primer turno y OpenAI y Gemini en su prompt; y cambiar el perfil olvida el hilo de la conversación, para que el siguiente turno sea primero y lleve el perfil nuevo.",
            1009 to "Los prompts de la app que le hablan a la persona en nombre de Ü —anticipar lo siguiente, proponer mientras aprende, la reunión y lo que entendió de un video— empiezan con quién es Ü de la constitución y el bloque del perfil; y ningún prompt de la app presenta a Ü con otro nombre ni le pide un tono que la constitución prohíbe.",
            1010 to "Con un médico, lo que Ü guarda por su cuenta no lleva datos de un paciente: los caminos de la memoria automática —lo que destila de un pedido, de una respuesta a sus preguntas y de lo que se le enseña en video— llevan el bloque del perfil y la frase que lo pone por encima de su criterio; y en una reunión, con un paciente delante, no interviene al cierre ni lanza tareas que no le pidan. Sin perfil, esos prompts son los de antes.",
        )
        fun promesa(n: Int) = "promesa $n: ${PROMESAS.getValue(n)}"

        /** Los que le hablan a la persona: lo que devuelven se dice en voz alta o se le propone. */
        val LE_HABLAN = listOf("Anticipation.kt", "LearningInquiry.kt", "MeetingBrain.kt", "GeminiVideo.kt")

        /** Todos los archivos de la app con un prompt propio (los cerebros de computer-use los juzga la 905). */
        val CON_PROMPT = LE_HABLAN + listOf(
            "MemoryDistiller.kt", "ActiveLearning.kt", "GeminiWorkflow.kt", "GeminiLearning.kt", "GeminiClickDoctor.kt",
            "IntentDistiller.kt",
        )
    }

    @Test
    fun promesa1007() {
        val p = 1007
        val main = sinComentarios(fuenteDeLaApp("MainActivity.kt"))
        for (texto in listOf("Trabajo en salud", "Uso personal", "Sin especialidad", "Cómo me usas")) {
            assertTrue(texto in main, promesa(p) + " · MainActivity no dice «$texto»")
        }
        for (uso in listOf("PerfilDeUso.queBienvenida(", "Especialidades.TODAS")) {
            assertTrue(uso in main, promesa(p) + " · MainActivity no usa $uso")
        }
        // Después del nombre viene el perfil: el botón de la bienvenida del nombre sigue con la pregunta del perfil.
        assertTrue("preguntaElPerfil(" in cuerpo(main, Regex("""fun askUserName\s*\(""")), promesa(p) + " · askUserName no sigue con el perfil")
        // Se pregunta UNA vez: girar el teléfono, cambiar el tema o el modo recrean la Activity, y no es abrir la app otra vez.
        assertTrue(
            Regex("""SOLO_PERFIL\s*->\s*if\s*\(\s*savedInstanceState\s*==\s*null\s*\)\s*preguntaElPerfil\(""")
                .containsMatchIn(cuerpo(main, Regex("""override fun onCreate\s*\("""))),
            promesa(p) + " · la pregunta del perfil vuelve a salir cada vez que se recrea la Activity",
        )

        val app = sinComentarios(fuenteDeLaApp("GraphApp.kt"))
        assertTrue("getSharedPreferences(\"graph\"" in app, promesa(p) + " · las preferencias no son «graph»")
        val leer = cuerpo(app, Regex("""fun perfil\s*\("""))
        assertTrue("PerfilDeUso.desdeGuardado(" in leer, promesa(p) + " · GraphApp no lee el perfil con el núcleo")
        for (clave in listOf("CLAVE_PERFIL", "CLAVE_ESPECIALIDAD", "CLAVE_ESPECIALIDAD_NOMBRE")) {
            assertTrue("PerfilDeUso.$clave" in leer, promesa(p) + " · GraphApp no lee $clave")
        }
        assertTrue(".guardado()" in cuerpo(app, Regex("""fun cambiaElPerfil\s*\(""")), promesa(p) + " · GraphApp no guarda lo que dice el núcleo")

        // Las claves son del núcleo: nadie las escribe a mano (una errata dejaría el perfil sin leer).
        val aMano = Regex("""\b(getString|putString|remove)\(\s*"(perfil|especialidad|especialidadNombre)"""")
        for (archivo in fuentes("app/src/main/kotlin")) {
            for ((i, linea) in archivo.readLines().withIndex()) {
                assertFalse(aMano.containsMatchIn(linea), promesa(p) + " · ${archivo.name}:${i + 1} escribe una clave del perfil a mano: «${linea.trim()}»")
            }
        }
    }

    @Test
    fun promesa1008() {
        val p = 1008
        val app = sinComentarios(fuenteDeLaApp("GraphApp.kt"))
        val cerebros = cuerpo(app, Regex("""fun newBrain\s*\("""))
        for (cerebro in listOf("OpenAiBrain(", "GeminiBrain(")) {
            val linea = cerebros.lines().firstOrNull { cerebro in it } ?: fail(promesa(p) + " · newBrain no crea $cerebro")
            assertTrue(Regex("""\bperfil\b""").containsMatchIn(linea), promesa(p) + " · $cerebro no recibe el perfil: «${linea.trim()}»")
        }
        assertTrue(Regex("""GraphBrain\([\s\S]*?\bperfil\s*=""").containsMatchIn(cerebros), promesa(p) + " · GraphBrain no recibe el perfil")

        // El prompt del cerebro local se manda al abrir el hilo: sin olvidar el hilo, el perfil nuevo no llegaría.
        val cambia = cuerpo(app, Regex("""fun cambiaElPerfil\s*\("""))
        assertTrue("conversationId = \"\"" in cambia, promesa(p) + " · cambiar el perfil no olvida el hilo")
        // run() puede correr en otro hilo que la pantalla: un cambio entre comprobar y guardar re-guardaría el hilo viejo.
        // Por eso el hilo guardado recuerda con qué perfil se abrió, y solo se reanuda si sigue siendo ese.
        assertTrue(
            Regex("""conversationId\s*=\s*brain\.interactionId[\s\S]{0,300}?perfilDelHiloGuardado\s*=\s*perfilDelHilo\b""")
                .containsMatchIn(cuerpo(app, Regex("""suspend fun run\s*\("""))),
            promesa(p) + " · al guardar el hilo no se anota con qué perfil se abrió",
        )
        assertTrue(
            Regex("""if\s*\(\s*resume\s*&&\s*perfilDelHiloGuardado\s*==\s*cambiosDePerfil\s*\)\s*sesion\.cerebro\.resume\(""")
                .containsMatchIn(cuerpo(app, Regex("""private fun newSession\s*\("""))),
            promesa(p) + " · se reanuda un hilo abierto con otro perfil",
        )

        for (nombre in listOf("OpenAiBrain.kt", "GeminiBrain.kt")) {
            val codigo = sinComentarios(fuenteDeLaApp(nombre))
            assertTrue(
                Regex("""PromptDelCerebroLocal\.goalPrompt\([^\n]*\bperfil""").containsMatchIn(codigo),
                promesa(p) + " · $nombre no le pasa el perfil a su prompt",
            )
        }
    }

    @Test
    fun promesa1009() {
        val p = 1009
        assertEquals(ConstitucionDeU.QUIEN, PromptsDeU.cabecera(PerfilDeUso.SIN_ELEGIR), promesa(p) + " · sin elegir")
        for (perfil in listOf(PerfilDeUso.medico("cardiologia"), PerfilDeUso.medico(), PerfilDeUso.persona())) {
            assertEquals(ConstitucionDeU.QUIEN + "\n\n" + perfil.bloqueDelPrompt(), PromptsDeU.cabecera(perfil), promesa(p) + " · ${perfil.describir()}")
        }

        for (nombre in LE_HABLAN) {
            val codigo = sinComentarios(fuenteDeLaApp(nombre))
            assertTrue("PromptsDeU.cabecera(" in codigo, promesa(p) + " · $nombre no empieza con quién es Ü y el perfil")
            for (propia in listOf("Eres Ü,", "Eres Ü.")) {
                assertFalse(propia in codigo, promesa(p) + " · $nombre se presenta por su cuenta («$propia»)")
            }
        }

        assertTrue("Eres Ü" in sinComentarios(fuenteDeLaApp("GeminiWorkflow.kt")), promesa(p) + " · GeminiWorkflow no se presenta como Ü")

        val prohibidas = listOf("Eres Graph", "viva y divertida", "con chispa", "¡Claro!", "Chicos,")
        val voseo = Regex("""\b(querés|podés|tenés|decime|contame)\b""")
        for (archivo in fuentes("app/src/main/kotlin")) {
            val codigo = sinComentarios(archivo.readText())
            for (frase in prohibidas) assertFalse(frase in codigo, promesa(p) + " · ${archivo.name} dice «$frase»")
            voseo.find(codigo.lowercase())?.let { fail(promesa(p) + " · ${archivo.name} vosea: «${it.value}»") }
        }
        for (nombre in CON_PROMPT) {
            for ((i, linea) in fuenteDeLaApp(nombre).lines().withIndex()) {
                val t = linea.trim()
                if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || "LogBus.log" in linea) continue
                assertEquals(emptyList(), emojis(linea), promesa(p) + " · $nombre:${i + 1} lleva emojis: «$t»")
            }
        }
    }

    @Test
    fun promesa1010() {
        val p = 1010
        val papel = "Eres la memoria de Ü."
        val criterio = "Responde SOLO JSON."
        val frase = "Lo que dice QUIÉN TE HABLA sobre la memoria manda sobre el criterio de abajo."
        assertEquals(frase, PromptsDeU.PRECEDENCIA_DE_LA_MEMORIA, promesa(p))
        // Sin perfil, el prompt de antes: el papel y el criterio separados por una línea en blanco.
        assertEquals("$papel\n\n$criterio", PromptsDeU.paraLaMemoria(PerfilDeUso.SIN_ELEGIR, papel, criterio), promesa(p) + " · sin perfil")
        for (perfil in listOf(PerfilDeUso.medico("cardiologia"), PerfilDeUso.medico(), PerfilDeUso.persona())) {
            assertEquals(
                "$papel\n\n${perfil.bloqueDelPrompt()}\n\n$frase\n\n$criterio",
                PromptsDeU.paraLaMemoria(perfil, papel, criterio),
                promesa(p) + " · ${perfil.describir()}",
            )
        }
        assertTrue("Los datos de un paciente no van a tu memoria" in PromptsDeU.paraLaMemoria(PerfilDeUso.medico(), papel, criterio), promesa(p) + " · con un médico no llega la regla de la memoria")

        // Los destiladores de texto: lo que se pide, la respuesta del aprendizaje pasivo y la del activo.
        for ((archivo, destiladores) in listOf(
            "MemoryDistiller.kt" to listOf("capture", "captureAnswer"),
            "ActiveLearning.kt" to listOf("distill"),
        )) {
            val codigo = sinComentarios(fuenteDeLaApp(archivo))
            for (d in destiladores) {
                assertTrue("PromptsDeU.paraLaMemoria(" in cuerpo(codigo, Regex("""fun $d\s*\(""")), promesa(p) + " · $archivo: $d no arma su prompt con el perfil")
            }
        }
        // Las notas del video también van a la memoria: detrás de la cabecera, la misma frase, y el perfil leído una vez.
        val video = cuerpo(sinComentarios(fuenteDeLaApp("GeminiVideo.kt")), Regex("""fun generate\s*\("""))
        assertTrue("PromptsDeU.PRECEDENCIA_DE_LA_MEMORIA" in video, promesa(p) + " · GeminiVideo no pone la memoria del perfil por encima de su criterio")
        assertEquals(1, Regex("""\bperfil\(\)""").findAll(video).count(), promesa(p) + " · GeminiVideo lee el perfil más de una vez")

        // La reunión, con un médico y un paciente delante.
        val reunion = sinComentarios(fuenteDeLaApp("MeetingBrain.kt"))
        assertTrue(
            "Si hay un paciente delante, manda QUIÉN TE HABLA: sin intervención de cierre ni tareas que no te pidan." in reunion,
            promesa(p) + " · MeetingBrain no dice qué hacer con un paciente delante",
        )
        assertTrue(".esMedico" in cuerpo(reunion, Regex("""suspend fun consider\s*\(""")), promesa(p) + " · MeetingBrain no lo condiciona a un médico")
    }

    /* ---------- Ayudas para leer las fuentes (mismo patrón que Contrato009CerebroLocalEnApp) ---------- */

    private fun fuenteDeLaApp(nombre: String): String {
        val archivo = fuentes("app/src/main/kotlin").firstOrNull { it.name == nombre } ?: fail("no encuentro $nombre en la app")
        return archivo.readText()
    }

    /**
     * Todos los `.kt` bajo [raizRelativa], subiendo desde el directorio de trabajo hasta encontrarla. Si no aparece o no
     * trae ningún archivo, la promesa falla: una lectura de cero archivos no da verde.
     */
    private fun fuentes(raizRelativa: String): List<File> {
        val desde = File("").absoluteFile
        val raiz = generateSequence(desde) { it.parentFile }
            .map { File(it, raizRelativa) }
            .firstOrNull { it.isDirectory }
            ?: fail("no encuentro $raizRelativa subiendo desde $desde")
        val archivos = raiz.walkTopDown().filter { it.isFile && it.name.endsWith(".kt") }.toList()
        if (archivos.isEmpty()) fail("no hay fuentes en $raiz")
        return archivos
    }

    /** Descarta las líneas comentadas: un comentario que solo MENCIONA un uso no cuenta como el uso. */
    private fun sinComentarios(codigo: String): String =
        codigo.lines().filterNot { it.trim().let { t -> t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") } }.joinToString("\n")

    /** El cuerpo de la función que abre con [firma], hasta la línea que cierra con su misma sangría. */
    private fun cuerpo(codigo: String, firma: Regex): String {
        val lineas = codigo.lines()
        val i = lineas.indexOfFirst { firma.containsMatchIn(it) }
        if (i < 0) fail("no encuentro «${firma.pattern}»")
        val sangria = lineas[i].takeWhile { it == ' ' }
        val fin = (i + 1 until lineas.size).firstOrNull { lineas[it] == "$sangria}" } ?: fail("«${firma.pattern}» no cierra")
        return lineas.subList(i, fin + 1).joinToString("\n")
    }
}
