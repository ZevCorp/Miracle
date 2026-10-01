package graph.core.contrato

import graph.core.contrato.Contrato009CerebroLocal.Companion.emojis
import graph.core.domain.PromptDelCerebroLocal
import graph.core.precision.Freno
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * LAS PROMESAS 905 Y 908-911 SE JUZGAN LEYENDO LAS FUENTES (docs/specs/009), mismo criterio que 703-705
 * (`Contrato007WakeWordEnApp.kt`): `OpenAiBrain`, `GeminiBrain`, `MemoryStore` y la burbuja son Android y no corren en
 * `jvmTest`, pero lo que prometen está escrito — de dónde sale el prompt, qué le llega al modelo en cada turno, con qué
 * se contesta cada llamada y qué textos fijos narra, dice o pregunta Ü. Lo que es del núcleo se juzga corriéndolo.
 */
class Contrato009CerebroLocalEnApp {

    companion object {
        val PROMESAS = mapOf(
            905 to "`OpenAiBrain` y `GeminiBrain` arman su prompt, el estado de la pantalla y las herramientas ask_user y speak con lo del núcleo: en su fuente no queda texto de prompt propio de la Ü vieja ni emojis fuera del log; y lo que la app le escribe al cerebro en el objetivo no le pide contestar con speak, que es solo para avisos.",
            908 to "Lo que la app y el núcleo narran, dicen o preguntan con texto fijo no lleva emojis: la burbuja arranca con «En marcha.» sin anunciar el pedido, los saludos de la palabra de activación van sin emojis, y el alto se avisa con «Ya paro.».",
            909 to "Cada turno de `OpenAiBrain` y `GeminiBrain` le lleva al modelo la pantalla de ese turno dentro de `<pantalla>` —el primero, el que sigue un hilo y el que contesta llamadas—, y el árbol de la pantalla no viaja suelto fuera de la etiqueta; un objetivo nuevo en un hilo que sigue llega como «Objetivo del usuario: …».",
            910 to "Cada llamada del cerebro local se contesta con el resultado de su propia acción, no con el de la que ocupa su lugar en la lista de llamadas; y una llamada a una herramienta que no existe se contesta diciendo que no existe, nunca «ok».",
            911 to "La memoria que la app le pasa al cerebro local la arma el núcleo con el formato de Graph: las notas generales bajo «### General» y las de cada app bajo «### <app>», una por renglón con «- » y sin sangría, que es lo que el prompt nombra cuando dice «lo que está bajo General».",
        )
        fun promesa(n: Int) = "promesa $n: ${PROMESAS.getValue(n)}"
    }

    @Test
    fun promesa905() {
        val p = 905
        val viejas = listOf(
            "Eres Ü", "personalidad", "chispa", "long-press", "idioma del usuario", "siempre la herramienta",
            "mejor criterio", "duda real e importante",
        )
        for (nombre in listOf("OpenAiBrain.kt", "GeminiBrain.kt")) {
            val fuente = fuenteDeLaApp(nombre)
            val codigo = sinComentarios(fuente)
            for (uso in listOf(
                "PromptDelCerebroLocal.goalPrompt(",
                "PromptDelCerebroLocal.estado(",
                "PromptDelCerebroLocal.ASK_USER",
                "PromptDelCerebroLocal.SPEAK",
            )) {
                assertTrue(uso in codigo, promesa(p) + " · $nombre no usa $uso")
            }
            val bajo = codigo.lowercase()
            for (frase in viejas) {
                assertFalse(frase.lowercase() in bajo, promesa(p) + " · $nombre todavía dice «$frase»")
            }
            for ((i, linea) in fuente.lines().withIndex()) {
                val t = linea.trim()
                if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || "LogBus.log" in linea) continue
                assertEquals(emptyList(), emojis(linea), promesa(p) + " · $nombre:${i + 1} lleva emojis: «$t»")
            }
        }
        // speak es un aviso que no necesita respuesta (PromptDelCerebroLocal.SPEAK): un texto de la app que le pide contestar
        // o agradecer «con speak» le da al cerebro dos órdenes contrarias para el mismo caso.
        val conSpeak = Regex(""""[^"]*\bcon speak\b""")
        for (archivo in fuentes("app/src/main/kotlin")) {
            for ((i, linea) in archivo.readLines().withIndex()) {
                val t = linea.trim()
                if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue
                assertFalse(conSpeak.containsMatchIn(linea), promesa(p) + " · ${archivo.name}:${i + 1} le pide al cerebro contestar con speak: «$t»")
            }
        }
    }

    @Test
    fun promesa908() {
        val p = 908
        // El primer argumento literal de narrate( / speak( / ask(: lo que Ü narra, dice o pregunta con texto fijo.
        val llamada = Regex("""\b(narrate|speak|ask)\(\s*"((?:[^"\\]|\\.)*)"""")
        var literales = 0
        for (archivo in fuentes("app/src/main/kotlin") + fuentes("core/src/commonMain/kotlin")) {
            for ((i, linea) in archivo.readLines().withIndex()) {
                if (linea.trim().startsWith("//")) continue
                for (m in llamada.findAll(linea)) {
                    literales++
                    val texto = m.groupValues[2]
                    assertEquals(emptyList(), emojis(texto), promesa(p) + " · ${archivo.name}:${i + 1} ${m.groupValues[1]}(«$texto»)")
                    assertFalse(texto.startsWith("¡Vamos!"), promesa(p) + " · ${archivo.name}:${i + 1} ${m.groupValues[1]}(«$texto»)")
                }
            }
        }
        assertTrue(literales >= 10, promesa(p) + " · solo encontré $literales textos fijos: el juez no está leyendo lo que debe")

        val burbuja = fuenteDeLaApp("FloatingBubble.kt")
        val saludos = Regex("""SALUDOS\s*=\s*listOf\(([\s\S]*?)\)""").find(burbuja)?.groupValues?.get(1)
            ?: fail(promesa(p) + " · no encuentro la lista SALUDOS")
        assertEquals(emptyList(), emojis(saludos), promesa(p) + " · los saludos llevan emojis: $saludos")
        assertFalse(Regex("""narrate\([^)]*\$\{?prompt""").containsMatchIn(burbuja), promesa(p) + " · la burbuja narra el pedido")
        val arranque = cuerpo(burbuja, Regex("""suspend fun runPromptAwait\s*\("""))
        assertTrue("narrate(\"En marcha.\")" in arranque, promesa(p) + " · runPromptAwait no narra «En marcha.»: $arranque")

        assertEquals("Ya paro.", Freno.ALTO, promesa(p) + " · el aviso del alto")
        assertEquals(emptyList(), emojis(Freno.DEVUELVO_EL_CONTROL), promesa(p) + " · la frase de soltar lleva emojis")
    }

    @Test
    fun promesa909() {
        val p = 909
        assertEquals("Objetivo del usuario: abre la cámara", PromptDelCerebroLocal.continuacion("  abre la cámara \n"), promesa(p))
        val turnos = listOf("primerTurno", "turnoQueSigue", "respuestas")
        for (nombre in listOf("OpenAiBrain.kt", "GeminiBrain.kt")) {
            val codigo = sinComentarios(fuenteDeLaApp(nombre))
            val siguiente = cuerpo(codigo, Regex("""suspend fun next\s*\("""))
            for (turno in turnos) {
                assertTrue(Regex("""\b$turno\(""").containsMatchIn(siguiente), promesa(p) + " · $nombre: next() no arma su turno con $turno()")
                val c = cuerpo(codigo, Regex("""fun $turno\s*\("""))
                assertTrue("PromptDelCerebroLocal.estado(" in c, promesa(p) + " · $nombre: $turno() no manda la pantalla dentro de <pantalla>")
            }
            // El árbol lo lee PromptDelCerebroLocal.estado y solo él: si el cerebro nombra uiContext, lo manda suelto.
            assertFalse("uiContext" in codigo, promesa(p) + " · $nombre manda el árbol de la pantalla fuera de <pantalla>")
            assertTrue("PromptDelCerebroLocal.continuacion(" in codigo, promesa(p) + " · $nombre no manda el objetivo nuevo como «Objetivo del usuario: …»")
        }
    }

    @Test
    fun promesa910() {
        val p = 910
        val noExiste = PromptDelCerebroLocal.herramientaQueNoExiste("borrar_todo")
        assertTrue("«borrar_todo»" in noExiste && "No existe" in noExiste, promesa(p) + " · «$noExiste»")
        assertFalse(noExiste.trim().lowercase().startsWith("ok"), promesa(p) + " · «$noExiste»")
        for (nombre in listOf("OpenAiBrain.kt", "GeminiBrain.kt")) {
            val codigo = sinComentarios(fuenteDeLaApp(nombre))
            // La declaración entera, hasta la primera línea en blanco: sus comentarios pueden llevar paréntesis.
            val llamada = Regex("""class Call\b([\s\S]*?)\n\s*\n""").find(codigo)?.groupValues?.get(1)
                ?: fail(promesa(p) + " · $nombre: no encuentro la clase Call")
            assertTrue(Regex("""\bactionIndex\s*:\s*Int\?""").containsMatchIn(llamada), promesa(p) + " · $nombre: una llamada no recuerda el índice de su acción")
            assertTrue("actionIndex" in cuerpo(codigo, Regex("""fun parseTurn\s*\(""")), promesa(p) + " · $nombre: parseTurn no anota el índice de la acción de cada llamada")
            val respuestas = cuerpo(codigo, Regex("""fun respuestas\s*\("""))
            assertTrue(Regex("""actionResults\.getOrNull\(\s*call\.actionIndex\s*\)""").containsMatchIn(respuestas), promesa(p) + " · $nombre: no contesta con el resultado de la acción de la llamada")
            assertFalse(Regex("""actionResults\.getOrElse\(\s*i\b|actionResults\[\s*i\s*]|getOrNull\(\s*i\s*\)""").containsMatchIn(respuestas), promesa(p) + " · $nombre: contesta por la posición de la llamada")
            assertTrue("PromptDelCerebroLocal.herramientaQueNoExiste(" in respuestas, promesa(p) + " · $nombre: una herramienta que no existe se contesta como hecha")
        }
    }

    @Test
    fun promesa911() {
        val p = 911
        val bloque = PromptDelCerebroLocal::bloqueDeMemoria
        assertEquals("", bloque(emptyList(), emptyMap()), promesa(p) + " · sin notas")
        assertEquals(
            "### General\n- Mi hermana es Ana\n- Vivo en Cali\n\n### WhatsApp\n- El grupo de la familia se llama Casa",
            bloque(listOf("Mi hermana es Ana", " Vivo en Cali "), mapOf("WhatsApp" to listOf("El grupo de la familia se llama Casa"))),
            promesa(p) + " · generales y de app",
        )
        assertEquals("### Maps\n- La casa es la de Chapinero", bloque(emptyList(), mapOf("Maps" to listOf("La casa es la de Chapinero"))), promesa(p) + " · solo de app")
        assertEquals("### General\n- A", bloque(listOf("A", "  "), mapOf("Maps" to listOf(" "))), promesa(p) + " · notas en blanco")
        assertEquals("### General\n- Una nota en dos renglones", bloque(listOf("Una nota\n  en dos renglones"), emptyMap()), promesa(p) + " · una nota es un renglón")

        val memoria = bloque(listOf("Mi hermana es Ana"), mapOf("WhatsApp" to listOf("El grupo de la familia se llama Casa")))
        val prompt = PromptDelCerebroLocal.goalPrompt("llama a mi hermana", emptyList(), memoria, PromptDelCerebroLocal.Proveedor.OPENAI)
        assertTrue("lo que está bajo General vale siempre" in prompt, promesa(p) + " · el prompt no nombra General")
        assertTrue("<memoria>\n### General\n- Mi hermana es Ana\n\n### WhatsApp\n" in prompt, promesa(p) + " · la memoria no llega con su formato")

        val store = sinComentarios(fuenteDeLaApp("MemoryStore.kt"))
        val promptBlock = cuerpo(store, Regex("""fun promptBlock\s*\("""))
        assertTrue("PromptDelCerebroLocal.bloqueDeMemoria(" in promptBlock, promesa(p) + " · MemoryStore.promptBlock no usa el formato del núcleo")
        assertFalse("appendLine" in promptBlock, promesa(p) + " · MemoryStore.promptBlock arma el formato por su cuenta")
    }

    /* ---------- Ayudas para leer las fuentes (mismo patrón que Contrato007SostenerParaApagar) ---------- */

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
