import AppKit
import Combine
import OSLog
import UCore
import UMac

typealias ChatMessage = ConversationMessage

@MainActor
final class AppModel: ObservableObject {
    typealias Mode = TaskPresentation.Phase
    @Published var presentation = TaskPresentation()
    var mode: Mode { get { presentation.phase } set { presentation.phase = newValue } }
    @Published var voiceLevel = 0.0
    @Published var faceEyeShift = 0.0
    @Published var jevStatus = "Jev · pendiente de conexión"
    private var jev: JevClient?
    var status: String { get { presentation.detail } set { presentation.detail = newValue } }
    @Published var draft = ""
    @Published var partial = ""
    @Published var messages: [ChatMessage] = [] { didSet { scheduleHistorySave() } }
    private var historyEnabled = false
    private var historySave: Task<Void, Never>?
    private let historyQueue = DispatchQueue(label: "com.zevcorp.u.mac.history")
    private let history = ConversationArchive(url: FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("U Mac/conversation.json"))
    @Published var microphone = false
    @Published var busy = false
    @Published var liveConnected = false
    @Published var nativeDictation = UserDefaults.standard.bool(forKey: "nativeDictation")
    let liveVoice = LiveVoice()
    private var voiceConnection: Task<Void, Never>?
    private var voiceID = UUID()
    @Published var graphURL = UserDefaults.standard.string(forKey: "graphURL") ?? GraphClient.defaultURL
    @Published var assistantContext = UserDefaults.standard.string(forKey: "assistantContext") ?? ""
    /// Con quién habla Ü en este Mac (spec 001, 2026-10-01), guardado en UserDefaults. Sin elegir, todo es lo de
    /// antes: nada viaja a Graph y la voz abre sin «QUIÉN TE HABLA».
    @Published private(set) var perfil = PerfilDeUso.guardado(en: .standard)
    /// La bienvenida que pregunta «¿Para qué me vas a usar?» ocupa la ventana mientras esto es verdad.
    @Published var eligiendoPerfil = false
    @Published var credential = ""
    @Published var openAICredential = ""
    @Published var hasCredential = false
    private var credentialRefresh: Task<Void, Never>?
    private var cachedGraphCredential: String?
    @Published var configurationMessage = ""
    @Published var checkingVoice = false
    @Published var voiceCheckMessage = ""
    @Published var checkingCredential = false
    @Published var permissionSnapshot = PermissionCenter.readSnapshot()
    /// Ir a una pestaña —Configuración, un aviso de permisos, Memoria— gana a la bienvenida pendiente: se
    /// muestra lo que se pidió, y si nunca se eligió el perfil, la pregunta vuelve al abrir la app (spec 001).
    @Published var selectedTab = 0 { didSet { if eligiendoPerfil { eligiendoPerfil = false } } }
    @Published private(set) var notchExpanded = false
    var onNotchExpansion: ((Bool) -> Void)?
    func setNotchExpanded(_ expanded: Bool) { notchExpanded = expanded; onNotchExpansion?(expanded) }
    let permissions = PermissionCenter()
    let desktop = Desktop()
    let speech = Speech()
    private let wakeSpeech = Speech()
    private var wakeTask: Task<Void, Never>?
    private var wakeID = UUID()
    private var pendingWakeGreeting: String?
    @Published var wakeListening = false
    @Published var wakeStatus = ""
    @Published var wakeEnabled = UserDefaults.standard.object(forKey: "wakeEnabled") as? Bool ?? true
    var showWindow: (() -> Void)?
    var hideWindow: (() -> Void)?
    var lastExternalApp: NSRunningApplication?
    private var work: Task<Void, Never>?
    private var permissionObservation: AnyCancellable?
    private var answer: CheckedContinuation<String, Error>?
    private var questionID = UUID()
    private var runID = UUID()
    private var awakeUntil = Date.distantPast
    private let userID: String = {
        if let id = UserDefaults.standard.string(forKey: "userID") { return id }
        let id = UUID().uuidString; UserDefaults.standard.set(id, forKey: "userID"); return id
    }()
    init(persistConversation: Bool = true) {
        if persistConversation {
            do {
                messages = try history.load()
                historyEnabled = true
            } catch {
                status = "No se pudo leer el historial guardado. El archivo se conserva sin sobrescribir."
            }
        }
        wakeSpeech.onState = { [weak self] listening, _ in
            self?.wakeListening = listening
            if listening { self?.wakeStatus = "Esperando que llames a You para conversar." }
        }
        wakeSpeech.onError = { [weak self] message in
            self?.wakeListening = false; self?.wakeStatus = message
            self?.status = message
        }
        wakeSpeech.onText = { [weak self] text in
            guard let self, self.wakeEnabled, !self.microphone, !self.busy,
                  VoiceActivation.isGreeting(text) else { return }
            self.pendingWakeGreeting = text
            self.nativeDictation = false
            self.toggleMicrophone()
        }
        permissionObservation = permissions.$snapshot.sink { [weak self] snapshot in
            self?.permissionSnapshot = snapshot
        }
        speech.onPartial = { [weak self] text in self?.partial = text }
        speech.onText = { [weak self] text in self?.heard(text) }
        speech.onState = { [weak self] listening, speaking in
            guard let self, self.nativeDictation, self.microphone else { return }
            if speaking { self.mode = .speaking }
            else if self.answer != nil { self.mode = .question }
            else if self.busy { self.mode = .working }
            else { self.mode = listening ? .listening : .ready }
        }
        speech.onError = { [weak self] text in self?.microphone = false; self?.fail(text) }
        liveVoice.onLevel = { [weak self] level in self?.voiceLevel = level }
        liveVoice.onState = { [weak self] text in
            guard let self else { return }
            self.liveConnected = self.liveVoice.connected
            self.status = text
            self.mode = self.liveConnected ? .listening : .ready
            if self.liveConnected, let greeting = self.pendingWakeGreeting {
                self.pendingWakeGreeting = nil
                Task { do { try await self.liveVoice.text(greeting) } catch { self.fail(error.localizedDescription) } }
            }
            if !self.liveConnected && text.contains("terminó") {
                self.microphone = false; self.desktop.stop(); self.startWakeListening()
            }
        }
        liveVoice.onText = { [weak self] text, user in
            guard let self else { return }
            if user { self.presentation.receiveUserFragment(text) }
            else { self.presentation.receiveAssistantFragment(text) }
            if user, self.answer != nil { self.submit(text) }
            else {
                // Live sends transcript deltas. Keep one message per speaker turn.
                if let last = self.messages.indices.last, self.messages[last].user == user {
                    self.messages[last].text += text
                } else { self.append(text, user: user) }
            }
        }
        liveVoice.onSpeaking = { [weak self] speaking in
            guard let self else { return }
            self.mode = speaking ? .speaking : self.busy ? .working : .listening
        }
        liveVoice.onError = { [weak self] text in
            guard let self else { return }
            self.work?.cancel(); self.work = nil; self.runID = UUID()
            self.desktop.stop(); self.busy = false; self.liveConnected = false; self.microphone = false
            self.fail(text)
            self.pendingWakeGreeting = nil
            self.startWakeListening()
        }
        liveVoice.onTool = { [weak self] name, args in
            guard let self else { throw CancellationError() }
            return try await self.liveTool(name, args: args)
        }
    }
    private func scheduleHistorySave() {
        guard historyEnabled else { return }
        historySave?.cancel()
        historySave = Task { [weak self] in
            do { try await Task.sleep(for: .milliseconds(300)) } catch { return }
            guard let self else { return }
            let snapshot = self.messages
            let store = self.history
            self.historyQueue.async { [weak self] in
                do { try store.save(snapshot) }
                catch {
                    Task { @MainActor [weak self] in self?.status = "No se pudo guardar el historial: " + error.localizedDescription }
                }
            }
        }
    }
    func flushHistory() {
        guard historyEnabled else { return }
        historySave?.cancel()
        let snapshot = messages
        do { try historyQueue.sync { try history.save(snapshot) } }
        catch { status = "No se pudo guardar el historial: " + error.localizedDescription }
    }
    func setWakeEnabled(_ enabled: Bool) {
        wakeEnabled = enabled
        UserDefaults.standard.set(enabled, forKey: "wakeEnabled")
        if enabled { startWakeListening() }
        else { stopWakeListening(); wakeStatus = "Activación por saludo desactivada." }
    }
    func startWakeListening() {
        guard wakeEnabled, !microphone, !busy, wakeTask == nil, !wakeListening else { return }
        wakeStatus = "Preparando activación por voz…"
        let id = UUID(); wakeID = id
        wakeTask = Task { [weak self] in
            guard let self else { return }
            await self.wakeSpeech.start(localOnly: true)
            if self.wakeID == id { self.wakeTask = nil }
        }
    }
    private func stopWakeListening() {
        wakeID = UUID()
        wakeTask?.cancel(); wakeTask = nil
        wakeSpeech.stop(); wakeListening = false
    }
    func refreshPermissions() {
        permissions.refreshAndPoll()
    }
    func refreshCredentialPresence() {
        if credentialRefresh == nil {
            checkingCredential = true
            credentialRefresh = Task { [weak self] in
                defer { self?.credentialRefresh = nil; self?.checkingCredential = false }
                do { self?.hasCredential = try await Credentials.readChecked("GRAPH_API_KEY") != nil }
                catch { self?.configurationMessage = error.localizedDescription }
            }
        }
    }
    func saveConfiguration() async {
        do {
            _ = try GraphClient(baseURL: graphURL, apiKey: "validation")
            if !credential.isEmpty {
                try await Credentials.save("GRAPH_API_KEY", value: credential)
                cachedGraphCredential = credential.trimmingCharacters(in: .whitespacesAndNewlines)
                hasCredential = !cachedGraphCredential!.isEmpty
                credential = ""
            }
            if !openAICredential.isEmpty { try await Credentials.save("OPENAI_API_KEY", value: openAICredential); openAICredential = "" }
            UserDefaults.standard.set(graphURL, forKey: "graphURL")
            configurationMessage = hasCredential ? "Guardado en el Llavero de macOS." : "La conexión se guardará cuando añadas una credencial de Graph."
        } catch { configurationMessage = error.localizedDescription }
    }
    func saveAssistantContext() {
        assistantContext = AssistantContext(text: assistantContext).text
        UserDefaults.standard.set(assistantContext, forKey: "assistantContext")
        configurationMessage = assistantContext.isEmpty ? "El contexto personal se eliminó de este Mac." : "El contexto personal se guardó y se aplicará a la próxima conversación."
    }
    /// Guarda lo que se eligió en la bienvenida o en «Cómo me usas». En el Mac no hay un id de conversación que
    /// olvidar: la sesión de Graph vive lo que dura una tarea (`AgentEngine.run`), así que la siguiente nace
    /// sin sesión y con este perfil. La voz en vivo ya abierta conserva el suyo hasta que se cierre: su sesión
    /// no se rehace a mitad (lo dice el mensaje).
    func elegirPerfil(tipo: String, especialidad: String) {
        let nuevo = PerfilDeUso(tipo: tipo, especialidad: especialidad)
        guard nuevo.elegido else { return }
        let cambio = nuevo != perfil
        nuevo.guardar(en: .standard)
        perfil = nuevo
        eligiendoPerfil = false
        guard cambio else { return }
        configurationMessage = liveConnected
            ? "Cómo me usas: \(nuevo.paraElMenu). La voz que está abierta sigue como empezó; lo aplico desde la próxima conversación."
            : "Cómo me usas: \(nuevo.paraElMenu). Lo aplico desde la próxima tarea."
    }
    func checkConnection() {
        Task {
            await saveConfiguration()
            do {
                let client = try await makeClient()
                let keys = try await client.providerKeys()
                configurationMessage = "Graph conectado. Voz: \(keys.openai?.isEmpty == false ? "disponible" : "sin credencial"). Jev: \(keys.typesafe?.isEmpty == false ? "disponible" : "sin credencial TypeSafe")."
            } catch { configurationMessage = error.localizedDescription }
        }
    }
    func makeClient() async throws -> GraphClient {
        try Task.checkCancellation()
        let key: String
        if let cachedGraphCredential, !cachedGraphCredential.isEmpty { key = cachedGraphCredential }
        else if let stored = try await Credentials.readChecked("GRAPH_API_KEY"), !stored.isEmpty {
            key = stored; cachedGraphCredential = stored
        } else {
            throw AgentError.unavailable("Falta la credencial de Graph. Guárdala en Configuración para conectar Live 1.")
        }
        hasCredential = true
        return try GraphClient(baseURL: graphURL, apiKey: key)
    }
    func checkVoice() {
        guard !checkingVoice, !microphone, !busy else { return }
        checkingVoice = true; voiceCheckMessage = "Comprobando Graph y Live 1… No se abrirá el micrófono."
        Task {
            defer { checkingVoice = false }
            do {
                let local = try await Credentials.readChecked("OPENAI_API_KEY", allowInteraction: true)
                let graph = local == nil ? try await makeClient().providerKeys() : nil
                let key = try voiceCredential(local: local, graph: graph?.openai)
                guard try await VoiceProbe.check(key: key) else { throw AgentError.unavailable("Live 1 no completó la prueba.") }
                voiceCheckMessage = "Live 1 y Luna respondieron. Ahora pulsa Hablar con Live 1 para probar micrófono y altavoces."
            } catch { voiceCheckMessage = error.localizedDescription }
        }
    }
    private func voiceCredential(local: String?, graph: String?) throws -> String {
        if let local, !local.isEmpty { return local }
        if let graph, !graph.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return graph }
        throw AgentError.unavailable("No hay una credencial de OpenAI para Live 1. Guárdala en el Llavero o configúrala en Graph.")
    }
    func toggleLiveFromFace() {
        if microphone { stop(); return }
        nativeDictation = false
        UserDefaults.standard.set(false, forKey: "nativeDictation")
        toggleMicrophone()
    }
    func toggleMicrophone() {
        if microphone {
            Logger(subsystem: "com.zevcorp.u.mac", category: "Session").info("microphone off: toggle")
            voiceID = UUID(); voiceConnection?.cancel(); voiceConnection = nil
            microphone = false; liveConnected = false; liveVoice.stop(); speech.stop(); partial = ""
            if busy { stop() } else { mode = .ready }
            pendingWakeGreeting = nil; startWakeListening()
            return
        }
        guard !busy else { status = "Detén la tarea antes de cambiar el modo de voz."; return }
        if !nativeDictation && permissions.snapshot.microphone != .granted {
            selectedTab = 1
            showWindow?()
            permissions.request(.microphone)
            fail("Activa Micrófono en Configuración para usar la voz en vivo.")
            return
        }
        guard !checkingVoice else { status = "Espera a que termine la comprobación de Live 1."; return }
        stopWakeListening()
        microphone = true; awakeUntil = Date().addingTimeInterval(45)
        if nativeDictation { Task { await speech.start() }; return }
        let id = UUID(); voiceID = id
        hideWindow?(); lastExternalApp?.activate(options: [])
        desktop.begin()
        voiceConnection = Task { [weak self] in
            guard let self else { return }
            do {
                self.status = "Preparando la credencial de voz…"
                let local = try await Credentials.readChecked("OPENAI_API_KEY")
                // A local Live key is enough to start a conversation. Graph may be recovering and
                // must not hold the microphone UI hostage while its optional Jev key is fetched.
                let hasLocalVoiceKey = local?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
                let keys = hasLocalVoiceKey ? nil : try? await self.makeClient().providerKeys()
                let key = try self.voiceCredential(local: local, graph: keys?.openai)
                let jevKey = keys?.typesafe
                guard self.voiceID == id, !Task.isCancelled else { return }
                self.jev = jevKey.flatMap { $0.isEmpty ? nil : JevClient(key: $0) }
                self.jevStatus = self.jev == nil ? "Jev sin credencial · decide Luna" : "Jev · listo"
                guard self.voiceID == id, !Task.isCancelled else { return }
                try await self.liveVoice.start(key: key, userContext: AssistantContext(text: self.assistantContext, perfil: self.perfil))
                if hasLocalVoiceKey {
                    Task { [weak self] in
                        guard let self, let delayedKeys = try? await self.makeClient().providerKeys(),
                              self.voiceID == id, !Task.isCancelled else { return }
                        self.jev = delayedKeys.typesafe.flatMap { $0.isEmpty ? nil : JevClient(key: $0) }
                        self.jevStatus = self.jev == nil ? "Jev sin credencial · decide Luna" : "Jev · listo"
                    }
                }

            } catch {
                guard self.voiceID == id else { return }
                self.microphone = false; self.liveConnected = false; self.fail(error.localizedDescription)
                self.pendingWakeGreeting = nil; self.startWakeListening()
            }
        }
    }
    private func liveTool(_ name: String, args: [String: String]) async throws -> String {
        presentation.commitUserTurn()
        if name == "stop_task" { stopExecution(); return "Tarea detenida. Puedes seguir conversando." }
        if name == "map_tramo" {
            guard !busy else { return "Ya hay una tarea en marcha." }
            guard let jev else { return "Jev no tiene credencial TypeSafe. Usa las herramientas AX directas." }
            let goal = args["goal"] ?? ""
            guard !goal.isEmpty else { throw AgentError.invalid("Falta el objetivo.") }
            startJev(goal: goal, client: jev)
            return "En marcha con Jev. Recibirás el desenlace sin consultar."
        }
        guard !busy else { throw AgentError.unavailable("Hay otra acción en curso. Espera su resultado antes de operar otra vez.") }
        busy = true; mode = .working
        let id = voiceID
        defer { if voiceID == id { busy = false; mode = answer == nil ? .listening : .question } }
        if name == "map_decidir" {
            guard let jev else { return "Jev no tiene credencial. Decide con las herramientas AX." }
            var previous = "", repeats = 0
            return try await desktop.jevStep(jev, goal: args["goal"] ?? "", previous: &previous, repeats: &repeats,
                onStep: { self.status = $0 }) ?? "Control accionado. Lee read_screen para comprobar el resultado."
        }
        if name == "look" {
            let state = try await desktop.observe(screenshot: true)
            guard let screenshot = state.screenshot else { throw AgentError.unavailable("No se obtuvo una captura.") }
            try await liveVoice.addImage(screenshot)
            return "Captura adjunta. \(state.screen), \(state.width) × \(state.height)."
        }
        if name == "key" { return try await desktop.execute(AgentAction(kind: "key", key: args["key"])) }
        if name == "scroll" { return try await desktop.tool("map_scroll", args: args) }
        return try await desktop.tool(name, args: args)
    }
    private func startJev(goal: String, client: JevClient) {
        let id = UUID(); runID = id
        busy = true; mode = .working; status = "Jev · observando"; desktop.begin()
        work = Task { [weak self] in
            guard let self else { return }
            var result = "Se alcanzó el límite de 15 pasos. Decide Luna con read_screen.", previous = "", repeats = 0
            do {
                for _ in 0..<15 {
                    try Task.checkCancellation()
                    if let outcome = try await self.desktop.jevStep(client, goal: goal, previous: &previous, repeats: &repeats,
                        onStep: { self.status = $0 }) { result = outcome; break }
                }
            } catch is CancellationError { return }
            catch { result = "Tramo detenido: " + error.localizedDescription + " Decide Luna con read_screen." }
            guard self.runID == id, !Task.isCancelled else { return }
            self.work = nil; self.busy = false; self.mode = .listening; self.status = result
            do { try await self.liveVoice.notify(result) }
            catch { if self.runID == id { self.fail("No pude comunicar el desenlace a la voz.") } }
        }
    }
    private func stopExecution() {
        work?.cancel(); work = nil; runID = UUID(); desktop.stop()
        answer?.resume(throwing: CancellationError()); answer = nil
        busy = false; presentation.stop()
        if liveConnected { desktop.begin() }
    }
    private func heard(_ phrase: String) {
        partial = ""
        let trimmed = phrase.trimmingCharacters(in: .whitespacesAndNewlines)
        let folded = trimmed.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "es"))
        if ["detente", "para", "cancela", "cancelar", "alto"].contains(folded) { stop(reason: "orden de voz"); return }
        if answer != nil { submit(trimmed); return }
        let prefixes = ["oye u", "hola u", "oye ü", "hola ü", "u ", "ü "]
        if let prefix = prefixes.first(where: { trimmed.lowercased().hasPrefix($0) }) {
            awakeUntil = Date().addingTimeInterval(45)
            let command = String(trimmed.dropFirst(prefix.count)).trimmingCharacters(in: .whitespacesAndNewlines.union(.punctuationCharacters))
            if !command.isEmpty { submit(command) }
            return
        }
        guard Date() < awakeUntil else { return }
        guard !busy else { return }
        awakeUntil = Date().addingTimeInterval(45)
        submit(trimmed)
    }
    func submitDraft() { let text = draft; draft = ""; submit(text) }
    func submit(_ text: String) {
        let goal = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !goal.isEmpty else { return }
        presentation.begin(goal)
        append(goal, user: true)
        if let continuation = answer {
            answer = nil; mode = .working; hideWindow?()
            lastExternalApp?.activate(options: [])
            continuation.resume(returning: goal); return
        }
        if liveConnected {
            hideWindow?(); lastExternalApp?.activate(options: [])
            Task { do { try await liveVoice.text(goal) } catch { fail(error.localizedDescription) } }
            return
        }
        guard !busy else { append("Hay una tarea en curso. Deténla antes de iniciar otra."); return }
        guard permissions.snapshot.canControlComputer else {
            selectedTab = 1; showWindow?(); fail("Falta el permiso de Accesibilidad."); return
        }
        hideWindow?()
        if NSWorkspace.shared.frontmostApplication?.processIdentifier == getpid() { lastExternalApp?.activate(options: []) }
        let id = UUID(); runID = id
        busy = true; mode = .working; status = "Mirando la pantalla…"; desktop.begin()
        work = Task { [weak self] in
            guard let self else { return }
            defer { if self.runID == id { self.busy = false; self.work = nil } }
            do {
                // Give macOS the focus handoff after the command window closes.
                try await Task.sleep(nanoseconds: 250_000_000)
                let client = try await self.makeClient()
                let engine = AgentEngine(turn: { try await client.turn($0) },
                    observe: { try await self.desktop.observe(screenshot: $0) },
                    execute: { try await self.desktop.execute($0) },
                    ask: { try await self.ask($0) })
                engine.userID = self.userID
                engine.userContext = AssistantContext(text: self.assistantContext).graphContext
                engine.perfil = self.perfil.paraElCable
                engine.onStatus = { [weak self] text in self?.status = text; self?.mode = .working }
                engine.onSpeech = { [weak self] text in self?.append(text); if self?.microphone == true { self?.speech.say(text) } }
                let result = try await engine.run(goal: goal)
                try Task.checkCancellation()
                guard self.runID == id else { return }
                self.status = result; self.mode = .ready; self.append(result)
                if self.microphone && !self.liveConnected { self.speech.say(result) }
            } catch is CancellationError {
                if self.runID == id { self.status = "Tarea detenida."; self.mode = .ready }
            } catch {
                if self.runID == id { self.fail(error.localizedDescription) }
            }
        }
    }
    private func ask(_ question: String) async throws -> String {
        try Task.checkCancellation()
        let pendingID = UUID(); questionID = pendingID
        mode = .question; status = question; append(question); setNotchExpanded(true)
        if microphone && !liveConnected { speech.say(question) }
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                if Task.isCancelled { continuation.resume(throwing: CancellationError()) }
                else { answer = continuation }
            }
        } onCancel: { [weak self] in
            Task { @MainActor in
                guard let self, self.questionID == pendingID else { return }
                self.answer?.resume(throwing: CancellationError()); self.answer = nil
            }
        }
    }
    func stop(reason: String = "interfaz") {
        Logger(subsystem: "com.zevcorp.u.mac", category: "Session").info("stop: \(reason, privacy: .public)")
        voiceID = UUID(); voiceConnection?.cancel(); voiceConnection = nil
        liveVoice.stop(); liveConnected = false
        desktop.stop(); work?.cancel(); work = nil; runID = UUID()
        answer?.resume(throwing: CancellationError()); answer = nil
        busy = false; partial = ""; microphone = false
        speech.stop(); presentation.stop()
        pendingWakeGreeting = nil; startWakeListening()
    }
    func fail(_ text: String) { mode = .error; status = text; append(text) }
    func append(_ text: String, user: Bool = false) {
        messages.append(ChatMessage(text: text, user: user))
    }
}
