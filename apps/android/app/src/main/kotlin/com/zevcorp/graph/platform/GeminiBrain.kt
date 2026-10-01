package com.zevcorp.graph.platform

import android.util.Base64
import graph.core.domain.*
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*

private const val BASE = "https://generativelanguage.googleapis.com"

private class HttpRes(val code: Int, val body: String)

/**
 * POST al motor con DOS garantías combinadas:
 *  · CANCELABLE de verdad: si el Job se cancela (botón Stop) mientras está bloqueada leyendo, cada
 *    intento hace disconnect() desde otro hilo y rompe la lectura al instante (en vez de esperar el
 *    readTimeout de 300s); el backoff usa `delay`, también cancelable.
 *  · RESILIENTE a la sobrecarga de Google (429/5xx): esos errores son temporales ("please try again
 *    later") y sin reintento hacían "fallar todo" al primer bache. Reintenta con backoff exponencial.
 * Solo se reintentan códigos HTTP transitorios; las excepciones de red/cancelación se propagan.
 */
private suspend fun http(url: String, headers: Map<String, String>, body: ByteArray): HttpRes {
    var wait = 800L
    var attempt = 1
    while (true) {
        val res = httpOnce(url, headers, body)
        if (!GeminiHttp.transient(res.code) || attempt >= 4) return res
        LogBus.log("gemini", "HTTP ${res.code} transitorio (sobrecarga de Google) · reintento $attempt/3 en ${wait}ms")
        delay(wait)
        wait = (wait * 2).coerceAtMost(8000L)
        attempt++
    }
}

private suspend fun httpOnce(url: String, headers: Map<String, String>, body: ByteArray): HttpRes =
    suspendCancellableCoroutine { cont ->
        val c = URL(url).openConnection() as HttpURLConnection
        cont.invokeOnCancellation { runCatching { c.disconnect() } }
        try {
            c.requestMethod = "POST"
            c.connectTimeout = 30_000
            c.readTimeout = 300_000
            headers.forEach { (k, v) -> c.setRequestProperty(k, v) }
            c.doOutput = true
            c.outputStream.use { it.write(body) }
            val code = c.responseCode
            val text = (if (code < 400) c.inputStream else c.errorStream)?.bufferedReader()?.readText() ?: ""
            c.disconnect()
            if (cont.isActive) cont.resumeWith(Result.success(HttpRes(code, text)))
        } catch (e: Throwable) {
            if (cont.isActive) cont.resumeWith(Result.failure(e))
        }
    }

private fun js(s: String) = JsonPrimitive(s)
private fun jo(vararg pairs: Pair<String, JsonElement>) = JsonObject(pairs.toMap())
// Acceso TOLERANTE: si el campo no existe o no es un valor simple (viene como objeto/array), devuelve
// "" en vez de reventar. El modelo a veces envuelve un argumento en un objeto y eso abortaba el turno.
private fun JsonObject.str(key: String) = (this[key] as? JsonPrimitive)?.contentOrNull ?: ""
private fun JsonElement?.primOrNull() = this as? JsonPrimitive

/**
 * Gemini 3.5 Flash con computer-use nativo (Interactions API) MÁS las herramientas MCP declaradas.
 *
 * Protocolo (ai.google.dev/gemini-api/docs/computer-use): POST /v1beta/interactions con
 * tool {type:"computer_use", environment:"mobile"}; el servidor mantiene la conversación vía
 * previous_interaction_id y cada turno reenvía los function_result (con screenshot inline).
 * Las herramientas MCP se añaden como funciones custom junto a ask_user y speak; el modelo elige
 * en cada turno entre un gesto MCP y las acciones de computer-use.
 */
class GeminiBrain(
    private val apiKey: () -> String,
    private val model: () -> String,
    private val tools: List<McpTool>,
    private val listApps: () -> String,
    /** Memoria del usuario (reglas/preferencias destiladas): se inyecta en el system prompt. */
    private val memory: () -> String = { "" },
    /** Con quién habla Ü (spec 010): su bloque va en el prompt del hilo, después de quién es Ü. */
    private val perfil: () -> PerfilDeUso = { PerfilDeUso.SIN_ELEGIR },
) : ThreadedBrain {

    private val mcpNames = tools.map { it.name }.toSet()

    private class Call(
        val id: String,
        val name: String,
        val safety: Boolean,
        // La primera acción que produjo esta función en el turno: su resultado es actionResults[actionIndex]. null si no
        // produjo ninguna (take_screenshot, ask_user, speak, list_apps, o una función que no existe). Spec 009, promesa 910.
        val actionIndex: Int? = null,
    )

    private var previousId = ""
    private var startId = ""              // punto de reanudación del hilo de conversación compartido
    private var continuationMessage = ""  // mensaje del usuario a enviar como turno de continuación
    private var pending = listOf<Call>()
    private val internalResults = HashMap<String, JsonObject>() // resueltos localmente (list_apps)
    private var informText = ""
    private var goal = ""

    /** Id de la última interacción (el hilo de conversación server-side para continuar después). */
    override val interactionId get() = previousId
    /**
     * ¿El hilo quedó con function_calls SIN responder? (tarea cortada a mitad: error/500/Stop/maxTurns).
     * Un hilo así está ENVENENADO: reanudarlo hace que el servidor exija responder esas llamadas
     * colgadas y CUALQUIER tarea futura falle con 400 "Each Function Response must be matched to a
     * Function Call by name". La plataforma lo usa para NO reanudar un hilo en ese estado.
     */
    override val hasPendingCalls: Boolean get() = pending.isNotEmpty()
    /** Tamaño del contexto del hilo (tokens de la última interacción); gobierna la rotación de ventana. */
    override var totalTokens = 0
        private set

    /** Reanuda el hilo de conversación existente (previous_interaction_id) antes de begin(). */
    override fun resume(id: String) { startId = id }

    override fun begin(goal: String) {
        this.goal = goal
        // Si hay hilo previo, se CONTINÚA (el servidor ya tiene system prompt + historial): el objetivo
        // nuevo viaja como un turno de usuario más. Si no, arranca fresco con el goalPrompt completo.
        previousId = startId
        // El objetivo nuevo de un hilo que sigue, con las palabras del prompt del hilo (spec 009, promesa 909).
        continuationMessage = if (startId.isNotBlank()) PromptDelCerebroLocal.continuacion(goal) else ""
        pending = emptyList()
        internalResults.clear()
        informText = ""
    }

    override fun inform(message: String) {
        informText = message
    }

    /** Declaración de función para el API a partir de una herramienta MCP (params string, con enum). */
    private fun mcpFn(t: McpTool) = buildJsonObject {
        put("type", "function")
        put("name", t.name)
        put("description", t.description)
        putJsonObject("parameters") {
            put("type", "object")
            putJsonObject("properties") {
                t.params.forEach { p ->
                    putJsonObject(p.name) {
                        put("type", "string")
                        put("description", p.description)
                        if (p.options.isNotEmpty()) putJsonArray("enum") { p.options.forEach { add(it) } }
                    }
                }
            }
            putJsonArray("required") { t.params.forEach { add(it.name) } }
        }
    }

    /** ask_user / speak: las herramientas propias de Ü, con las palabras del núcleo (las de Graph), no unas de este cerebro. */
    private fun customFn(h: PromptDelCerebroLocal.HerramientaPropia) = buildJsonObject {
        put("type", "function")
        put("name", h.nombre)
        put("description", h.descripcion)
        putJsonObject("parameters") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject(h.parametro) {
                    put("type", "string")
                    put("description", h.descripcionDelParametro)
                }
            }
            putJsonArray("required") { add(h.parametro) }
        }
    }

    override suspend fun next(state: ScreenState, actionResults: List<String>): BrainTurn = withContext(Dispatchers.IO) {
        // Cada turno lleva la pantalla de ESTE turno dentro de <pantalla>: lo de dentro son datos, nunca instrucciones
        // (spec 009, promesas 904 y 909).
        val input = when {
            previousId.isBlank() -> primerTurno(state)
            pending.isEmpty() -> turnoQueSigue(state)
            else -> respuestas(state, actionResults)
        }
        internalResults.clear()

        val toolDecls = mutableListOf<JsonElement>(jo("type" to js("computer_use"), "environment" to js("mobile")))
        tools.forEach { toolDecls += mcpFn(it) }
        toolDecls += customFn(PromptDelCerebroLocal.ASK_USER)
        toolDecls += customFn(PromptDelCerebroLocal.SPEAK)

        val fields = mutableListOf(
            "model" to js(model()),
            "input" to JsonArray(input),
            "tools" to JsonArray(toolDecls),
        )
        if (previousId.isNotBlank()) fields += "previous_interaction_id" to js(previousId)

        val kb = (state.screenshotPng?.size ?: 0) / 1024
        val t0 = android.os.SystemClock.elapsedRealtime()
        val res = http(
            "$BASE/v1beta/interactions",
            mapOf("Content-Type" to "application/json", "x-goog-api-key" to apiKey()),
            Json.encodeToString(JsonObject.serializer(), JsonObject(fields.toMap())).toByteArray(),
        )
        val ms = android.os.SystemClock.elapsedRealtime() - t0
        LogBus.log("gemini", "interacción → HTTP ${res.code} · ${ms}ms · envié ${kb}KB de pantalla · recibí ${res.body.length}B")
        if (res.code >= 300) {
            // Auto-recuperación: si el hilo previo ya no existe/expiró (aún no hicimos nada este turno),
            // se reinicia la ventana y se reintenta FRESCO una vez. Evita quedar atascado tras un
            // reinicio del servidor o un lapso largo. Solo posible en el primer turno de un hilo reanudado.
            if (startId.isNotBlank() && previousId == startId) {
                LogBus.log("gemini", "hilo previo inválido (${res.code}); abro ventana nueva y reintento")
                previousId = ""; startId = ""; continuationMessage = ""
                return@withContext next(state, actionResults)
            }
            LogBus.log("gemini", "ERROR ${res.code}: ${res.body.take(300)}")
            error("Gemini HTTP ${res.code}: ${res.body.take(200)}")
        }
        // Diagnóstico: cuerpo crudo de la respuesta (truncado). Útil para ver qué decidió el modelo.
        LogBus.log("gemini", "raw ← ${res.body.take(1500)}")
        runCatching { parseTurn(Json.parseToJsonElement(res.body).jsonObject, state) }
            .getOrElse { e ->
                LogBus.log("gemini", "PARSE FALLÓ: ${e.message} · body=${res.body.take(1200)}")
                throw e
            }
    }

    private fun image(png: ByteArray) = jo(
        "type" to js("image"), "mime_type" to js("image/png"),
        "data" to js(Base64.encodeToString(png, Base64.NO_WRAP)),
    )

    private fun textItem(t: String) = jo("type" to js("text"), "text" to js(t))
    private fun jsonItem(o: JsonObject) = textItem(Json.encodeToString(JsonObject.serializer(), o))

    /** El primer turno de un hilo: el prompt entero, armado en el núcleo, la pantalla y, si la hay, la captura. */
    private fun primerTurno(state: ScreenState): List<JsonElement> = buildList {
        add(textItem(PromptDelCerebroLocal.goalPrompt(goal, tools, memory(), PromptDelCerebroLocal.Proveedor.GEMINI, perfil()) + "\n\n" + PromptDelCerebroLocal.estado(state)))
        state.screenshotPng?.let { add(image(it)) }
    }

    /**
     * Un turno sin llamadas pendientes en un hilo que sigue: el objetivo nuevo (continuationMessage), la respuesta a una
     * duda (informText) o «Continúa.», con la pantalla.
     */
    private fun turnoQueSigue(state: ScreenState): List<JsonElement> {
        val msg = continuationMessage.ifBlank { informText.ifBlank { "Continúa." } }
        continuationMessage = ""
        informText = ""
        return buildList {
            add(textItem(msg + "\n" + PromptDelCerebroLocal.estado(state)))
            state.screenshotPng?.let { add(image(it)) }
        }
    }

    /**
     * La respuesta a las llamadas del turno anterior. Cada función se contesta con el resultado de SU acción (actionIndex),
     * no con el de la acción que ocupa su posición en la lista (spec 009, promesa 910). La pantalla de ESTE turno va UNA
     * vez, dentro de <pantalla>, en el último resultado, y la captura también, si ningún take_screenshot la llevó ya: antes
     * el árbol iba suelto como campos "screen"/"ui" del JSON de cada resultado, fuera de la etiqueta que el prompt nombra
     * (promesa 909; lo mismo que hace `geminiBrain.js` de Graph con «Resultado aplicado.» y la pantalla).
     */
    private fun respuestas(state: ScreenState, actionResults: List<String>): List<JsonElement> {
        var capturaEnviada = false
        val input = pending.mapIndexed { i, call ->
            val result = mutableListOf<JsonElement>()
            when {
                // take_screenshot: ES el momento de mandar la imagen (computer-use bajo demanda).
                call.name == "take_screenshot" -> {
                    result += textItem("Captura de la pantalla actual.")
                    state.screenshotPng?.let { result += image(it); capturaEnviada = true }
                }
                call.name == "ask_user" -> result += jsonItem(jo("answer" to js(informText.ifBlank { "(sin respuesta)" })))
                internalResults.containsKey(call.id) -> result += jsonItem(internalResults.getValue(call.id))
                call.name == "speak" -> result += jsonItem(jo("said" to js("true")))
                else -> {
                    // safety_acknowledgement va EMBEBIDO en el JSON del resultado (nunca como campo
                    // de primer nivel del function_result: eso da HTTP 400), para acciones nativas
                    // y para funciones custom (MCP) que traigan safety_decision. Doc oficial:
                    // action_result["safety_acknowledgement"] = true, y ese dict se json.dumps al "text".
                    val salida = if (call.actionIndex != null) actionResults.getOrNull(call.actionIndex) ?: "ok"
                        else PromptDelCerebroLocal.herramientaQueNoExiste(call.name)
                    val resObj = linkedMapOf<String, JsonElement>("result" to js(salida))
                    if (call.safety) resObj["safety_acknowledgement"] = JsonPrimitive(true)
                    result += jsonItem(JsonObject(resObj))
                }
            }
            if (i == pending.lastIndex) {
                result += textItem(PromptDelCerebroLocal.estado(state))
                // imagen solo si el modelo la pidió (tras un tap/type de computer-use) y no la llevó ya un take_screenshot
                if (!capturaEnviada) state.screenshotPng?.let { result += image(it) }
            }
            // El function_result NO lleva campos fuera de este esquema (type/name/call_id/result):
            // cualquier extra (p.ej. safety_acknowledgement) es rechazado con 400 por la API.
            JsonObject(mapOf(
                "type" to js("function_result"), "name" to js(call.name),
                "call_id" to js(call.id), "result" to JsonArray(result)))
        }
        informText = ""
        return input
    }

    private fun parseTurn(body: JsonObject, state: ScreenState): BrainTurn {
        previousId = body.str("id").ifBlank { previousId }
        // Tamaño del contexto del hilo (incluye el historial cacheado): gobierna la rotación de ventana.
        (body["usage"] as? JsonObject)?.get("total_tokens").primOrNull()?.intOrNull?.let { totalTokens = it }
        val items = (body["steps"] ?: body["outputs"] ?: body["output"])?.jsonArray.orEmpty()

        val actions = mutableListOf<AgentAction>()
        val calls = mutableListOf<Call>()
        val intents = mutableListOf<String>()
        var question: String? = null
        var speech: String? = null
        var text = ""
        for (item in items.map { it.jsonObject }) {
            when (item.str("type")) {
                "text" -> text += item.str("text")
                // El API a veces devuelve el texto final envuelto en model_output/message:
                // sin esto el turno parece "vacío" y el motor cae a un fallback genérico.
                "model_output", "message", "output_text" -> text += extractText(item)
                "function_call" -> {
                    val name = item.str("name")
                    val id = item.str("call_id").ifBlank { item.str("id") }.ifBlank { "call_${calls.size}" }
                    val args = (item["arguments"] as? JsonObject) ?: (item["args"] as? JsonObject) ?: JsonObject(emptyMap())
                    // La API EXIGE acuse siempre que una llamada traiga safety_decision, sea nativa de
                    // computer_use o una función custom (MCP aprendida como whatsapp_chat). El acuse va
                    // EMBEBIDO en el JSON del resultado (ver next()), no como campo de primer nivel del
                    // function_result — tal cual la documentación oficial (action_result["safety_acknowledgement"]=true).
                    val safety = args["safety_decision"] != null
                    if (name !in setOf("ask_user", "speak")) intents += args.str("intent")
                    val indice = actions.size

                    fun px(key: String, size: Int) =
                        args[key].primOrNull()?.intOrNull?.let { it * size / 1000 } ?: -1
                    when {
                        name in mcpNames -> actions += AgentAction.Mcp(
                            name, args.filterKeys { it != "intent" && it != "safety_decision" }
                                .mapValues { it.value.primOrNull()?.contentOrNull ?: "" })
                        name == "click" -> actions += AgentAction.Tap(px("x", state.width), px("y", state.height))
                        name == "type" -> {
                            actions += AgentAction.Type(px("x", state.width), px("y", state.height), args.str("text"))
                            if (args["press_enter"].primOrNull()?.booleanOrNull == true) actions += AgentAction.Key("enter")
                        }
                        name == "open_app" -> actions += AgentAction.OpenApp(args.str("app_name").ifBlank { args.str("name") })
                        name == "navigate" -> actions += AgentAction.OpenApp(args.str("url"))
                        name == "drag_and_drop" -> actions += AgentAction.Swipe(
                            px("start_x", state.width), px("start_y", state.height),
                            px("end_x", state.width), px("end_y", state.height), 400)
                        name == "long_press" -> {
                            val x = px("x", state.width); val y = px("y", state.height)
                            actions += AgentAction.Swipe(x, y, x, y, (args["seconds"].primOrNull()?.intOrNull ?: 1) * 1000L)
                        }
                        name == "scroll" -> actions += AgentAction.Scroll(args.str("direction") != "up")
                        name == "press_key" -> actions += AgentAction.Key(args.str("key"))
                        name == "go_back" -> actions += AgentAction.Key("back")
                        name == "wait" -> actions += AgentAction.Wait((args["seconds"].primOrNull()?.intOrNull ?: 2) * 1000L)
                        name == "take_screenshot" -> {} // el screenshot va en cada function_result
                        name == "list_apps" -> internalResults[id] = jo("apps" to js(listApps()))
                        name == "ask_user" -> question = args.str("question")
                        name == "speak" -> speech = args.str("text")
                    }
                    // Su resultado será el de la primera acción que produjo aquí, si produjo alguna: un `type` con
                    // press_enter produce dos (spec 009, promesa 910).
                    calls += Call(id, name, safety, actionIndex = indice.takeIf { actions.size > it })
                }
            }
        }
        pending = calls
        speech?.let { s -> calls.firstOrNull { it.name == "speak" }?.let { internalResults[it.id] = jo("said" to js("true")) } }
        // El próximo turno adjunta screenshot si el modelo pidió ver o va a tocar por coordenadas.
        val needsShot = calls.any { it.name == "take_screenshot" } ||
            actions.any { it is AgentAction.Tap || it is AgentAction.Type }
        when {
            calls.isNotEmpty() ->
                LogBus.log("gemini", "decide: ${calls.joinToString(", ") { it.name }}" + (question?.let { " · pregunta" } ?: ""))
            text.isNotBlank() ->
                LogBus.log("gemini", "responde con texto (${text.length} chars): ${text.take(160)}")
            else -> // ni acciones ni texto: diagnóstico del "final vacío"
                LogBus.log("gemini", "final VACÍO · items recibidos: [${items.joinToString(", ") { it.jsonObject.str("type") }}]")
        }
        return BrainTurn(actions, question, done = calls.isEmpty(), text = text, needsScreenshot = needsShot,
            narration = intents.firstOrNull { it.isNotBlank() } ?: "", speech = speech, intents = intents)
    }

    /** Extrae el texto de un item envuelto (model_output/message): campo text o content anidado. */
    private fun extractText(item: JsonObject): String {
        item.str("text").takeIf { it.isNotBlank() }?.let { return it }
        return when (val content = item["content"] ?: item["output"]) {
            is JsonPrimitive -> content.contentOrNull ?: ""
            is JsonArray -> content.joinToString("") { part -> (part as? JsonObject)?.str("text") ?: "" }
            is JsonObject -> content.str("text")
            else -> ""
        }
    }

    // El prompt de este cerebro lo arma el núcleo (PromptDelCerebroLocal, spec 009): la constitución de Ü y el mismo texto
    // de Android que el cerebro de Graph. Aquí no se escribe ningún texto de prompt.
}
