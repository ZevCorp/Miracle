package graph.core.application

import graph.core.domain.*
import graph.core.precision.Freno
import graph.core.precision.PARASTE_TU
import graph.core.precision.Paraste
import graph.core.precision.SIN_TAREA
import graph.core.pregunta.CompuertaDePregunta
import kotlinx.coroutines.delay
import kotlin.time.TimeSource

private val NO_LOG = GraphLog { _, _ -> }
private val PAQUETE = Regex("""[A-Za-z]\w*(\.\w+)+""")
private val NO_VOICE = object : Voice {
    override fun narrate(text: String) {}
    override fun speak(text: String) {}
}

/**
 * MOTOR DE EJECUCIÓN ÚNICO Y MIXTO.
 *
 * El usuario pide algo (texto o voz) y Gemini 3.5 Flash lo ejecuta eligiendo, en cada turno, la vía
 * más adecuada: un gesto MCP (herramienta declarada, limpia y rápida) o computer-use (mirar la
 * pantalla y tocar por coordenadas, flexible). No hay modos separados: es un solo bucle.
 *
 * SE PUEDE PARAR (spec 003). Una [Paraste] en cualquier punto —la lanza la puerta al tocar con el freno
 * echado— termina la corrida como cancelación: no ejecuta el resto, no pide otro turno, devuelve
 * «paraste: …» y lo narra una vez. Con [freno], además, las esperas del motor se cortan al pedir el alto
 * y no se pide turno a Graph con el alto echado: la puerta ya impide tocar, esto impide pagar un turno. Sin tarea
 * abierta tampoco se pide turno: termina como parada, sin decir que paró por la persona (promesa 318).
 *
 * EL LOG DICE QUÉ HIZO, NO CON QUÉ (promesa 317). Sale del teléfono por la telemetría: la vía, el tipo de acción, su
 * celda, el largo de los textos y el nombre de la herramienta MCP; nunca el objetivo, lo que se escribe, los
 * argumentos, lo que Graph dice o pregunta, ni la ventana más allá de su paquete.
 */
class ExecutionEngine(
    private val brain: () -> Brain,
    private val phone: Phone,
    private val mcp: Mcp,
    private val user: UserChannel? = null,
    private val voice: Voice = NO_VOICE,
    private val log: GraphLog = NO_LOG,
    private val maxTurns: Int = 40,
    /** Señal de vía (consciente vs subconsciente) para la plataforma; solo importa cuando cambia. */
    private val mode: ExecutionMode? = null,
    /** Pausa entre steps enviados juntos en un mismo turno (ajustable desde la app). */
    private val stepDelay: () -> Long = { 350 },
    /** El freno de la tarea en curso. Sin él, el motor solo reacciona a la [Paraste] de la puerta. */
    private val freno: Freno? = null,
    /**
     * PREGUNTA ANTES DE EJECUTAR (spec 006). Se consulta antes de cada acción: lo sensible que el pedido no autorizó, un
     * destino ambiguo o un dato que falta no se ejecutan, se preguntan. Sin ella, el motor hace todo lo que le manden.
     */
    private val compuerta: CompuertaDePregunta? = null,
) {
    /**
     * Ejecuta un objetivo hasta que el modelo devuelve el control con texto. Devuelve ese resumen; si se acaban los
     * [maxTurns] antes, devuelve [NO_TERMINE]. `announce=false` para objetivos internos (reencaminado / acción
     * anticipada): no narra el arranque ni el «Listo.» final, ni dice que no terminó.
     *
     * [dijoLaPersona] es lo que la persona escribió o dictó, que NO siempre es el [goal]: una acción anticipada autónoma y
     * el «CONTEXTO INMEDIATO» de una propuesta los redacta el modelo. Solo esto autoriza lo sensible (spec 006, promesa
     * 611); `null` cuando no hay nada suyo. NO TIENE DEFAULT, y es a propósito (promesa 621): el default era el objetivo, y
     * así un llamador con un objetivo sintético se autorizaba a sí mismo con solo olvidarse. Quien corre el motor dice qué
     * autoriza, y eso lo pide el compilador en vez de un comentario.
     */
    suspend fun run(goal: String, announce: Boolean = true, dijoLaPersona: String?): String {
        val b = brain()
        b.begin(goal)
        compuerta?.empieza(dijoLaPersona.orEmpty()) // solo lo que dijo la persona autoriza (spec 006, promesas 601 y 611)
        if (announce) voice.narrate(EN_MARCHA)
        log.log("run", "▶ objetivo de ${goal.length} caracteres")
        val started = TimeSource.Monotonic.markNow()

        var results = emptyList<String>()
        var summary = ""
        var turns = 0
        var actions = 0
        var terminado = false // el cerebro dijo que acabó; si no, se acabaron los turnos
        var wantShot = false // el screenshot solo se adjunta cuando el modelo va a usar computer-use
        try {
            while (turns < maxTurns) {
                sigue()
                conTarea()
                turns++
                val turnStart = TimeSource.Monotonic.markNow()
                val state = phone.state(withScreenshot = wantShot)
                compuerta?.vio(state) // lo que se ve ahora: con eso se resuelve un destino ambiguo (spec 006)
                val turn = b.next(state, results)
                sigue() // el alto pudo llegar mientras Graph pensaba: ese turno ni se narra, ni pregunta, ni celebra
                conTarea()
                wantShot = turn.needsScreenshot
                val ms = turnStart.elapsedNow().inWholeMilliseconds
                val via = if (state.screenshotPng != null) "👁 imagen" else "📝 texto"
                val decided = when {
                    turn.actions.isNotEmpty() -> turn.actions.joinToString(", ") { describe(it) }
                    turn.question != null -> "pregunta"
                    turn.done -> "fin"
                    else -> "nada aún" // sin acciones ni pregunta y sin terminar (p. ej. pide la imagen): hay otro turno
                }
                log.log("run", "turno $turns · ${ms}ms · $via · \"${paquete(state.screen)}\" · decide: $decided")

                if (turn.narration.isNotBlank()) voice.narrate(turn.narration)
                if (turn.speech != null) { voice.speak(turn.speech); log.log("run", "🗣 ${turn.speech.length} caracteres") }
                if (turn.text.isNotBlank()) summary = turn.text
                if (turn.done) { terminado = true; break }

                val out = mutableListOf<String>()
                turn.actions.forEachIndexed { i, action ->
                    sigue()
                    turn.intents.getOrNull(i)?.takeIf { it.isNotBlank() }?.let { voice.narrate(it) }
                    out += execute(action)
                    actions++
                    if (turn.actions.size > 1) espera(stepDelay()) // deja asentar la UI entre gestos encadenados
                }
                results = out

                turn.question?.let { q ->
                    log.log("run", "❓ pregunta de ${q.length} caracteres")
                    voice.speak(q)
                    b.inform(user?.ask(q)?.ifBlank { SIN_RESPUESTA } ?: SIN_CANAL)
                }
                espera(400)
            }
        } catch (p: Paraste) {
            // Parada, no fallo: ni resumen en voz alta ni «Listo.». Una sola narración, y el control vuelve.
            val secs = started.elapsedNow().inWholeSeconds
            log.log("run", "✋ ${p.motivo} · $turns turnos · $actions acciones · ${secs}s · no sigo")
            if (p.motivo == PARASTE_TU) voice.narrate(PARE)
            return "paraste: paré en el turno $turns tras $actions acciones y no hice el resto"
        }

        val secs = started.elapsedNow().inWholeSeconds
        // Terminó con un mensaje: dilo en voz alta. «Listo.» SOLO SI NO HUBO RESUMEN: tras el resumen era decir dos veces
        // que terminó (spec 009, promesa 907; lo mismo que U.exe en AgentLoop.cs).
        var listo = false
        if (!terminado) {
            // Se acabaron los turnos sin que el cerebro terminara: ni «Listo.» ni un texto de a mitad como resultado, que
            // el prompt le prohíbe escribir mientras tiene llamadas (spec 009, promesa 907). Lo único cierto es que no acabó.
            summary = NO_TERMINE
            if (announce) voice.speak(summary)
        } else if (summary.isNotBlank()) {
            voice.speak(summary)
        } else if (actions == 0 && announce) {
            // No dijo nada y no hizo nada: una frase corta, sin tú ni usted, jamás un listado técnico.
            summary = NO_ENTENDI
            voice.speak(summary)
        } else {
            listo = announce
        }
        log.log("run", "■ ${turns} turnos · $actions acciones · ${secs}s · resumen de ${summary.length} caracteres" + if (terminado) "" else " · sin terminar")
        if (listo) voice.narrate(LISTO)
        return summary.ifBlank { "Hecho" }
    }

    /**
     * LO QUE EL MOTOR DICE POR SU CUENTA (spec 009). Ü no habla con emojis ni con frases de máquina, y estas frases no
     * tutean ni ustedean: Android todavía no sabe si le habla a un médico o a una persona. Lo que viaja cuando una
     * pregunta se queda sin respuesta es el HECHO, no una orden: decía «usa tu mejor criterio», lo contrario de la
     * constitución («si preguntaste y no te contestan, … el dato no se inventa y lo que no se puede deshacer no se hace»).
     * Empieza como el «(sin respuesta)» de Graph y dice lo mismo que U.exe (`AgentLoop.SinRespuesta`).
     */
    companion object {
        const val EN_MARCHA = "En marcha."
        const val LISTO = "Listo."
        const val NO_ENTENDI = "No entendí qué hacer. ¿Cómo sería con otras palabras?"
        const val NO_TERMINE = "No alcancé a terminar; quedó a medias."
        const val PARE = "Paré."
        const val SIN_RESPUESTA = "(sin respuesta: la persona no contestó)"
        const val SIN_CANAL = "(sin respuesta: no hay a quién preguntarle)"
    }

    /** Con el alto echado no se sigue: ni otra acción ni otro turno. */
    private fun sigue() {
        if (freno?.pedido == true) throw Paraste(PARASTE_TU)
    }

    /** Sin tarea abierta no se pide ni se sigue un turno: quien la abrió ya acabó, o nadie la abrió. */
    private fun conTarea() {
        if (freno?.abierta == false) throw Paraste(SIN_TAREA)
    }

    /** Una espera del motor: con freno, a trozos y cortada por el alto; sin él, de un tirón como siempre. */
    private suspend fun espera(ms: Long) {
        val f = freno
        if (f == null) delay(ms)
        else if (f.duerme(ms)) throw Paraste(PARASTE_TU)
    }

    /**
     * Una acción: la compuerta decide si se hace o si primero se pregunta (spec 006). Una acción frenada no señala vía ni
     * toca nada, y deja su línea como cualquier otra: la medida delante del «—», el detalle detrás, para el modelo.
     */
    private suspend fun execute(action: AgentAction): String {
        val result = compuerta?.revisa(action) ?: ejecuta(action)
        log.log("run", "  ▪ ${describe(action)} → ${result.substringBefore(" — ")}") // el detalle nombra etiquetas: es para el modelo
        return result
    }

    private suspend fun ejecuta(action: AgentAction): String {
        // Aviso de vía: MCP = subconsciente, computer-use = consciente (Wait no cambia de vía).
        if (action !is AgentAction.Wait && action !is AgentAction.Unknown) mode?.executing(action is AgentAction.Mcp)
        // Las MCP devuelven su propio detalle de fallo (p.ej. qué taps de una aprendida no salieron):
        // se conserva tal cual para el log y para que el modelo pueda corregir en el siguiente turno.
        val result = when (action) {
            is AgentAction.Mcp -> mcp.call(action.tool, action.args)
            is AgentAction.Tap -> phone.tap(action.x, action.y).asResult()
            is AgentAction.Type -> phone.type(action.x, action.y, action.text).asResult()
            is AgentAction.OpenApp -> phone.openApp(action.name).asResult()
            is AgentAction.Scroll -> phone.scroll(action.down).asResult()
            is AgentAction.Swipe -> phone.swipe(action.x1, action.y1, action.x2, action.y2, action.ms).asResult()
            is AgentAction.Key -> phone.pressKey(action.key).asResult()
            is AgentAction.Wait -> { espera(action.ms); "ok" }
            is AgentAction.Unknown -> "acción desconocida: ${action.kind}"
        }
        return result
    }

    /** De la ventana, solo el paquete: el título es lo que la pantalla muestra (un chat, un contacto). */
    private fun paquete(screen: String): String =
        screen.substringBefore(" · ").trim().takeIf { PAQUETE.matches(it) } ?: "—"

    private fun Boolean.asResult() = if (this) "ok" else "no se pudo ejecutar la acción"

    /** Etiqueta de una acción para el log, distinguiendo la VÍA usada (MCP vs computer-use), sin lo que lleva. */
    private fun describe(a: AgentAction): String = when (a) {
        is AgentAction.Mcp -> "MCP ${a.tool}"
        is AgentAction.Tap -> "computer-use tap(${a.x},${a.y})"
        is AgentAction.Type -> "computer-use type(${a.x},${a.y}) · ${a.text.length} caracteres"
        is AgentAction.OpenApp -> "computer-use open_app · ${a.name.length} caracteres"
        is AgentAction.Scroll -> "computer-use scroll ${if (a.down) "down" else "up"}"
        is AgentAction.Swipe -> "computer-use swipe(${a.x1},${a.y1}→${a.x2},${a.y2})"
        is AgentAction.Key -> "computer-use key ${a.key}"
        is AgentAction.Wait -> "wait ${a.ms}ms"
        is AgentAction.Unknown -> "desconocida ${a.kind}"
    }
}
