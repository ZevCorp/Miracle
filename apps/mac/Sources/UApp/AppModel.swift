import AppKit
import Combine
import OSLog
import UCore
import UMac

typealias ChatMessage = ConversationMessage

/// What the notch hears, in the words of Windows PanelDeAcciones: Habla, CierraTurno, Empieza,
/// Termina, Detenido, Avisar and Limpiar. The model says what happened; the notch decides whether to show.
enum NotchEvent {
    case speak(String, fromU: Bool)
    case closeTurn
    case begin(String)
    case end(String, ok: Bool)
    case stopped(String)
    case notify(String)
    case clear
}

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
    var onNotch: ((NotchEvent) -> Void)?
    /// The cheap-listening cycle (its two-minute quiet count, who decided what) is plumbing: it goes
    /// to the log and never to the notch. The notch is for what the person asked and what Ü says or
    /// does; a countdown on top of someone's work only gets in the way (asked by the user, 2026-10-01).
    private func showTrace(_ text: String) {}
    private let passiveLog = Logger(subsystem: "com.zevcorp.u.mac", category: "Passive")
    /// One line per step of the cheap-listening cycle, for support: what was decided and how fast.
    /// What the person said stays private in the log.
    private func trace(_ event: String, _ detail: String = "", said: String = "", show: String) {
        passiveLog.info("\(event, privacy: .public) \(detail, privacy: .public) \(said, privacy: .private)")
        onTrace?(event, detail)
        showTrace(show)
    }
    private var lastCountdown = 0
    /// Seams for --passive-flow-test: every traced step, and recorded phrases in place of the
    /// microphone while Soniox listens. Unset in the product.
    var onTrace: ((String, String) -> Void)?
    var passiveFeed: (() -> AsyncStream<Data>)?
    /// Aprender: while a demo is recorded Ü is the apprentice and hears what the person says.
    var teaching = false
    var onHeard: ((String) -> Void)?
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
    /// Escucha barata (docs/ESCUCHA-BARATA.md): after a quiet stretch Live 1 decides whether to hand
    /// over; Soniox + Jev then listen for little money, Sol plans what is asked, and Live comes back
    /// to talk or to tell what was done.
    @Published var passive = false
    private let passiveListener = PassiveListener()
    private var interaction = InteractionTimer()
    private var idleWatch: Task<Void, Never>?
    private var voiceKey = ""
    /// Voice credentials the provider refused since the person last asked to talk. The other one (this
    /// Mac's Keychain or the one Graph serves) is tried once before giving up.
    private var refusedVoiceKeys = Set<String>()
    private var typesafeKey = ""
    private var pendingResume: String?
    private var passiveRetries = 0
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
            let wasConnected = self.liveConnected
            self.liveConnected = self.liveVoice.connected
            self.status = text
            self.onNotch?(.notify(text))
            if wasConnected && !self.liveConnected { self.onNotch?(.clear) }
            self.mode = self.liveConnected ? .listening : .ready
            if !wasConnected && self.liveConnected {
                self.trace("live.connected", self.pendingResume == nil ? "start" : "resume",
                           show: self.pendingResume == nil ? "Live 1 en vivo · empieza la cuenta de \(Self.clock(InteractionTimer.quiet))" : "Live 1 de vuelta · va a responder")
                self.watchInteraction()
                if let resume = self.pendingResume {
                    self.pendingResume = nil
                    Task { do { try await self.liveVoice.notify(resume) } catch { self.fail(error.localizedDescription) } }
                }
            }
            if self.liveConnected, let greeting = self.pendingWakeGreeting {
                self.pendingWakeGreeting = nil
                Task { do { try await self.liveVoice.text(greeting) } catch { self.fail(error.localizedDescription) } }
            }
            if !self.liveConnected && text.contains("terminó") {
                // The 15-minute cap no longer hangs up: the cheap half keeps listening.
                if self.microphone && !self.passive { self.enterPassive("la sesión de voz cumplió 15 minutos") }
                else { self.microphone = false; self.desktop.stop(); self.startWakeListening() }
            }
        }
        liveVoice.onText = { [weak self] text, user in
            guard let self else { return }
            self.interaction.touch()
            if user { self.presentation.receiveUserFragment(text) }
            else { self.presentation.receiveAssistantFragment(text); self.onNotch?(.closeTurn) }
            // What the people in the room say is not written in the notch: it covered their work with
            // their own words (asked by the user, 2026-10-01). Ü hears it and answers; only what Ü says
            // and does is shown.
            if !user { self.onNotch?(.speak(self.presentation.detail, fromU: true)) }
            if user { self.onHeard?(self.presentation.detail) }
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
            self.interaction.touch()
            self.mode = speaking ? .speaking : self.busy ? .working : .listening
        }
        liveVoice.onError = { [weak self] text in
            guard let self else { return }
            if self.liveVoice.credentialRefused, self.microphone, !self.voiceKey.isEmpty { self.voiceRefused(text) }
            else { self.voiceFailed(text, summary: nil) }
        }
        liveVoice.onTool = { [weak self] name, args in
            guard let self else { throw CancellationError() }
            return try await self.liveTool(name, args: args)
        }
        let quiet = UserDefaults.standard.double(forKey: "passiveQuietSeconds")
        if quiet > 0 { InteractionTimer.quiet = quiet }
        passiveListener.onLevel = { [weak self] level in if self?.passive == true { self?.voiceLevel = level * 0.5 } }
        passiveListener.onPhrase = { [weak self] phrase in if self?.passive == true { self?.partial = phrase } }
        passiveListener.onDecision = { [weak self] action, phrase in self?.passiveHeard(action, phrase) }
        passiveListener.onCycle = { [weak self] cycle in
            guard let self, self.passive else { return }
            let verdict = "\(cycle.decision.intent.rawValue) \(String(format: "%.2f", cycle.decision.confidence)) · \(Int(cycle.milliseconds)) ms"
            let route = cycle.action == .hablar ? " → Live 1" : cycle.action == .ejecutar ? (cycle.endpoint ? " → Computer Use" : " → espera el fin de la frase") : " → sigue escuchando"
            self.trace("jev.cycle", "intent=\(cycle.decision.intent.rawValue) confidence=\(String(format: "%.2f", cycle.decision.confidence)) ms=\(Int(cycle.milliseconds)) action=\(cycle.action.rawValue) endpoint=\(cycle.endpoint)",
                       said: cycle.phrase, show: "«\(cycle.phrase.suffix(40))» · Jev: \(verdict)\(route)")
        }
        passiveListener.onError = { [weak self] reason in self?.passiveFailed(reason) }
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
    /// No balance or a rejected key is a problem of THAT credential: the other one (this Mac's Keychain
    /// or the one Graph serves) is tried once before telling the person.
    private func voiceRefused(_ text: String) {
        refusedVoiceKeys.insert(voiceKey)
        let id = voiceID
        liveConnected = false
        status = "Esa credencial de voz no sirve; pruebo con la otra…"
        onNotch?(.begin("Probando la otra credencial de voz"))
        Task { [weak self] in
            guard let self else { return }
            let local = await Credentials.read("OPENAI_API_KEY")
            let graph = try? await self.makeClient().providerKeys()
            let next = [local, graph?.openai].compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                .first { !$0.isEmpty && !self.refusedVoiceKeys.contains($0) }
            guard self.voiceID == id, self.microphone else { return }
            var reason = text
            if let next {
                self.voiceKey = next
                do { try await self.liveVoice.start(key: next, userContext: AssistantContext(text: self.assistantContext, perfil: self.perfil)); return }
                catch { reason = error.localizedDescription; self.refusedVoiceKeys.insert(next) }
            }
            guard self.voiceID == id else { return }
            self.voiceFailed(reason, summary: LiveProtocol.voiceRefusedSummary(triedBoth: self.refusedVoiceKeys.count > 1))
        }
    }

    /// The voice could not go on. The reason is said where the person is looking, the notch, and kept
    /// whole in the chat: an assistant that just goes quiet looks broken.
    private func voiceFailed(_ text: String, summary: String?) {
        idleWatch?.cancel(); idleWatch = nil; pendingResume = nil
        work?.cancel(); work = nil; runID = UUID()
        desktop.stop(); busy = false; liveConnected = false; microphone = false
        mode = .error; status = text; append(text)
        onNotch?(.end(summary ?? text, ok: false))
        pendingWakeGreeting = nil
        startWakeListening()
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
            idleWatch?.cancel(); idleWatch = nil; passiveListener.stop(); passive = false; pendingResume = nil
            microphone = false; liveConnected = false; liveVoice.stop(); speech.stop(); partial = ""
            onNotch?(.clear)
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
        refusedVoiceKeys = []
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
                self.voiceKey = key; self.typesafeKey = jevKey ?? ""
                self.jev = jevKey.flatMap { $0.isEmpty ? nil : JevClient(key: $0) }
                self.jevStatus = self.jev == nil ? "Jev sin credencial · decide Luna" : "Jev · listo"
                guard self.voiceID == id, !Task.isCancelled else { return }
                try await self.liveVoice.start(key: key, userContext: AssistantContext(text: self.assistantContext, perfil: self.perfil))
                if hasLocalVoiceKey {
                    Task { [weak self] in
                        guard let self, let delayedKeys = try? await self.makeClient().providerKeys(),
                              self.voiceID == id, !Task.isCancelled else { return }
                        self.jev = delayedKeys.typesafe.flatMap { $0.isEmpty ? nil : JevClient(key: $0) }
                        self.typesafeKey = delayedKeys.typesafe ?? ""
                        self.jevStatus = self.jev == nil ? "Jev sin credencial · decide Luna" : "Jev · listo"
                    }
                }

            } catch {
                guard self.voiceID == id else { return }
                if self.liveVoice.credentialRefused, !self.voiceKey.isEmpty { self.voiceRefused(error.localizedDescription); return }
                self.microphone = false; self.liveConnected = false; self.fail(error.localizedDescription)
                self.pendingWakeGreeting = nil; self.startWakeListening()
            }
        }
    }
    private func liveTool(_ name: String, args: [String: String]) async throws -> String {
        presentation.commitUserTurn()
        onNotch?(.closeTurn)
        // The apprentice does not touch the screen while it is being taught (promesa 138).
        if teaching && ApprenticeMode.refuses(name) { return ApprenticeMode.refusal }
        if name == "stop_task" { stopExecution(); onNotch?(.stopped("detenido")); return "Tarea detenida. Puedes seguir conversando." }
        if name == "escucha_pasiva" {
            // Hang up on the next turn of the run loop: this call's own output is not needed.
            Task { @MainActor [weak self] in self?.enterPassive(args["motivo"] ?? "sin interacción") }
            return "Escucha pasiva activada."
        }
        if name == "map_tramo" { return try await operate(name, args: args) }
        onNotch?(.begin(Self.label(name, args: args)))
        do {
            let result = try await operate(name, args: args)
            onNotch?(.end(result, ok: true))
            return result
        } catch {
            onNotch?(.end(error.localizedDescription, ok: false))
            throw error
        }
    }
    /// What the notch says while a tool runs: the action in words, never the tool's name alone.
    static func label(_ name: String, args: [String: String]) -> String {
        let target = args["label"] ?? args["name"] ?? args["app"] ?? args["query"] ?? args["text"] ?? args["goal"] ?? ""
        let verb: String
        switch name {
        case "look": verb = "Mirando la pantalla"
        case "key": verb = "Pulsando " + (args["key"] ?? "una tecla")
        case "scroll": verb = "Desplazando"
        case "map_decidir": verb = "Jev decide"
        case "read_screen": verb = "Leyendo la pantalla"
        default: verb = name.replacingOccurrences(of: "map_", with: "").replacingOccurrences(of: "_", with: " ").capitalized
        }
        return target.isEmpty || name == "key" ? verb : verb + ": " + target
    }
    private func operate(_ name: String, args: [String: String]) async throws -> String {
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
                onStep: { self.status = $0; self.onNotch?(.begin($0)) }) ?? "Control accionado. Lee read_screen para comprobar el resultado."
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
        onNotch?(.begin("Jev · observando"))
        work = Task { [weak self] in
            guard let self else { return }
            var result = "Se alcanzó el límite de 15 pasos. Decide Luna con read_screen.", previous = "", repeats = 0
            do {
                for _ in 0..<15 {
                    try Task.checkCancellation()
                    if let outcome = try await self.desktop.jevStep(client, goal: goal, previous: &previous, repeats: &repeats,
                        onStep: { self.status = $0; self.onNotch?(.begin($0)) }) { result = outcome; break }
                }
            } catch is CancellationError { return }
            catch { result = "Tramo detenido: " + error.localizedDescription + " Decide Luna con read_screen." }
            guard self.runID == id, !Task.isCancelled else { return }
            self.work = nil; self.busy = false; self.mode = .listening; self.status = result
            self.onNotch?(.end(result, ok: !result.hasPrefix("Tramo detenido") && !result.hasPrefix("Se alcanzó")))
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
                engine.onStatus = { [weak self] text in self?.status = text; self?.mode = .working; self?.onNotch?(.notify(text)) }
                engine.onSpeech = { [weak self] text in self?.append(text); if self?.microphone == true { self?.speech.say(text) } }
                let result = try await engine.run(goal: goal)
                try Task.checkCancellation()
                guard self.runID == id else { return }
                self.status = result; self.mode = .ready; self.append(result)
                self.onNotch?(.notify(result))
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
        mode = .question; status = question; append(question); onNotch?(.notify(question)); setNotchExpanded(true)
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
        let hadConversation = liveConnected || microphone, hadWork = busy
        voiceID = UUID(); voiceConnection?.cancel(); voiceConnection = nil
        liveVoice.stop(); liveConnected = false
        idleWatch?.cancel(); idleWatch = nil; passiveListener.stop(); passive = false; pendingResume = nil
        desktop.stop(); work?.cancel(); work = nil; runID = UUID()
        answer?.resume(throwing: CancellationError()); answer = nil
        busy = false; partial = ""; microphone = false
        speech.stop(); presentation.stop()
        pendingWakeGreeting = nil; startWakeListening()
        // Hanging up ends the conversation and takes the notch away; stopping a task leaves it said
        // (promesa 259). Esc with nothing running brings nothing out.
        if hadConversation { onNotch?(.clear) } else if hadWork { onNotch?(.stopped("detenido a mano")) }
    }
    /// Asks Live, once per quiet stretch, whether to hand over to passive listening.
    private func watchInteraction() {
        idleWatch?.cancel()
        interaction = InteractionTimer()
        idleWatch = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                guard let self, self.liveConnected, !self.passive, !Task.isCancelled else { return }
                self.interaction.holding = self.busy || self.mode == .speaking || self.answer != nil || self.teaching
                if self.interaction.holding { self.interaction.touch(); self.lastCountdown = 0; continue }
                if self.interaction.shouldAsk() {
                    self.interaction.asked()
                    self.trace("live.asked", "quiet=\(Int(InteractionTimer.quiet))", show: "\(Self.clock(InteractionTimer.quiet)) sin interacción → Live 1 decide si pasar a escucha pasiva")
                    self.liveVoice.muted = true
                    try? await self.liveVoice.notify(LiveProtocol.passiveCheck)
                } else if self.interaction.expireQuestion() {
                    self.liveVoice.muted = false; self.lastCountdown = 0
                    self.trace("live.stayed", show: "Live 1 decidió quedarse · la cuenta empieza de nuevo")
                } else if self.interaction.askedAt == nil {
                    // Test countdown only: every 15 s of quiet, how far along the stretch is.
                    let elapsed = Int(Date().timeIntervalSince(self.interaction.lastInteraction))
                    if elapsed < self.lastCountdown { self.lastCountdown = 0; self.showTrace("Hubo interacción · la cuenta empieza de nuevo") }
                    if elapsed >= self.lastCountdown + 15 {
                        self.lastCountdown = elapsed / 15 * 15
                        self.showTrace("Live 1 en vivo · sin interacción \(Self.clock(Double(self.lastCountdown))) de \(Self.clock(InteractionTimer.quiet))")
                    }
                }
            }
        }
    }
    func enterPassive(_ reason: String) {
        guard microphone, !passive else { return }
        trace("passive.enter", said: reason, show: "Live 1 pasa a escucha pasiva (\(reason.prefix(50))) · abriendo Soniox")
        idleWatch?.cancel(); idleWatch = nil; lastCountdown = 0
        voiceID = UUID(); voiceConnection?.cancel(); voiceConnection = nil
        liveVoice.stop(); liveConnected = false
        passive = true; partial = ""; mode = .listening; status = "Escucha pasiva"
        // Going quiet is not news: the notch stays out of the way until Ü is called again.
        let id = voiceID
        voiceConnection = Task { [weak self] in
            guard let self else { return }
            do {
                let graph = try await self.makeClient()
                if self.typesafeKey.isEmpty { self.typesafeKey = try await graph.providerKeys().typesafe ?? "" }
                let session = try await graph.transcriptionSession()
                guard self.voiceID == id, self.passive else { return }
                try await self.passiveListener.start(sonioxKey: session.access_token ?? "", jev: JevClient.passive(key: self.typesafeKey), feed: self.passiveFeed?())
                self.passiveRetries = 0
                self.trace("passive.listening", show: "Escucha pasiva activa · Soniox ⇄ Jev en ciclo")
            } catch {
                guard self.voiceID == id, self.passive else { return }
                self.passiveFailed(error.localizedDescription)
            }
        }
    }
    private func passiveFailed(_ reason: String) {
        guard passive else { return }
        passiveListener.stop()
        trace("passive.failed", "retry=\(passiveRetries)", said: reason, show: "Escucha pasiva falló: \(reason.prefix(60))")
        // A dropped socket or an expired key gets one quick retry; after that Ü falls back to the
        // wake greeting so it stays reachable.
        if passiveRetries < 2 {
            passiveRetries += 1; passive = false
            enterPassive("reintento tras: " + reason)
            return
        }
        passive = false; microphone = false; passiveRetries = 0
        fail("La escucha pasiva se detuvo: " + reason)
        startWakeListening()
    }
    private func passiveHeard(_ action: ListenIntent, _ phrase: String) {
        guard passive else { return }
        trace("passive.route", "action=\(action.rawValue) busy=\(busy)", said: phrase,
              show: action == .hablar || busy ? "Jev activa Live 1 · «\(phrase.suffix(40))»" : "Jev activa Computer Use · «\(phrase.suffix(40))»")
        partial = ""
        append(phrase, user: true)
        switch action {
        case .hablar: resumeLive(LiveProtocol.resumeForSpeech(phrase))
        case .ejecutar:
            if busy { resumeLive(LiveProtocol.resumeForSpeech(phrase)) } else { runSol(phrase) }
        case .nada: break
        }
    }
    /// Reopens Live 1 and hands it what it must say first. Soniox stops: Live hears the room now.
    private func resumeLive(_ message: String) {
        passiveListener.stop(); passive = false; partial = ""
        trace("live.reopen", show: "Reabriendo Live 1…")
        guard !voiceKey.isEmpty else { fail("No hay credencial de voz para volver a Live 1."); return }
        pendingResume = message
        let id = UUID(); voiceID = id
        desktop.begin()
        voiceConnection = Task { [weak self] in
            guard let self else { return }
            do { try await self.liveVoice.start(key: self.voiceKey, userContext: AssistantContext(text: self.assistantContext, perfil: self.perfil)) }
            catch {
                guard self.voiceID == id else { return }
                self.pendingResume = nil; self.microphone = false; self.liveConnected = false
                self.fail(error.localizedDescription); self.startWakeListening()
            }
        }
    }
    /// Sol plans and Jev clicks, with no voice session open. Live comes back to tell the result.
    private func runSol(_ goal: String) {
        guard permissions.snapshot.canControlComputer else { resumeLive(LiveProtocol.resumeForSpeech(goal)); return }
        let id = UUID(); runID = id
        busy = true; mode = .working; status = "Planeando: " + goal; desktop.begin()
        onNotch?(.begin("Planeando: " + goal))
        trace("sol.start", said: goal, show: "Computer Use · Sol 6.1 planea «\(goal.suffix(40))»")
        let started = Date()
        let planner = SolPlanner(key: voiceKey), jev = typesafeKey.isEmpty ? nil : JevClient(key: typesafeKey)
        let context = AssistantContext(text: assistantContext, perfil: perfil)
        work = Task { [weak self] in
            guard let self else { return }
            let outcome: SolPlanner.Outcome
            do {
                outcome = try await planner.run(goal: goal, context: context, execute: { [weak self] name, args in
                    guard let self else { throw CancellationError() }
                    return try await self.solTool(name, args: args, jev: jev)
                })
            } catch is CancellationError { return }
            catch { outcome = SolPlanner.Outcome(text: "No pude completar la tarea: " + error.localizedDescription, ok: false, turns: 0) }
            guard self.runID == id, !Task.isCancelled else { return }
            // Sol's text is Live's script, not a chat turn: Live tells it and that is what the chat keeps.
            self.work = nil; self.busy = false; self.status = outcome.text
            self.onNotch?(.end(outcome.text, ok: outcome.ok))
            self.trace("sol.end", "ok=\(outcome.ok) turns=\(outcome.turns) seconds=\(Int(Date().timeIntervalSince(started)))", said: outcome.text,
                       show: "Computer Use \(outcome.ok ? "terminó" : "no terminó") en \(Int(Date().timeIntervalSince(started))) s · Live 1 vuelve a contarlo")
            let message = LiveProtocol.resumeAfterTask(request: goal, outcome: outcome.text, ok: outcome.ok)
            if self.liveConnected { try? await self.liveVoice.notify(message) } else { self.resumeLive(message) }
        }
    }
    private func solTool(_ name: String, args: [String: String], jev: JevClient?) async throws -> String {
        if name == "stop_task" { return "Nadie pidió detener la tarea." }
        onNotch?(.begin(Self.label(name, args: args)))
        trace("sol.tool", name, show: "Computer Use · " + Self.label(name, args: args))
        return try await desktop.planningTool(name, args: args, jev: jev, onStep: { [weak self] in self?.status = $0; self?.onNotch?(.begin($0)) })
    }
    private static func clock(_ seconds: Double) -> String { String(format: "%d:%02d", Int(seconds) / 60, Int(seconds) % 60) }
    /// The whole reason stays in the chat; the notch gets one readable line of it, not a server's JSON.
    func fail(_ text: String) {
        mode = .error; status = text; append(text)
        let line = text.split(whereSeparator: \.isNewline).first.map(String.init) ?? text
        onNotch?(.notify(line.count > 110 ? String(line.prefix(110)) + "…" : line))
    }
    func append(_ text: String, user: Bool = false) {
        messages.append(ChatMessage(text: text, user: user))
    }
}
