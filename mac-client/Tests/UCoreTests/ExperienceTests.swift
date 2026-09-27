import Foundation
import UCore

extension AgentTests {
    func testWakeGreetingRequiresDirectAddress() {
        for text in ["Hola Yu", "¡Hola, You! ¿Me escuchas?", "Oye Ü, abre el navegador", "hola U", "buenos días Yu", "You", "You, te necesito", "Yu haz esto", "You ¿estás ahí?", "¿Me escuchas, You?"] {
            XCTAssertEqual(VoiceActivation.isGreeting(text), true)
        }
        for text in ["hola", "hola YouTube", "hola ustedes", "le dije hola Yu ayer", "oye Juan", "yo te necesito", "hola hijo mío", "hablaba de You ayer"] {
            XCTAssertEqual(VoiceActivation.isGreeting(text), false)
        }
        for text in ["You, guarda silencio", "no te estoy hablando", "estoy en una llamada"] {
            XCTAssertEqual(VoiceActivation.requestsPrivacy(text), true)
        }
        XCTAssertEqual(VoiceActivation.requestsPrivacy("abre el archivo de llamadas"), false)
        XCTAssertEqual(AssistantContext().graphContext.contains("Kaizen"), true)
        let session = LiveProtocol.start()["session"] as! [String: Any]
        XCTAssertEqual((session["instructions"] as! String).contains("colombiano"), true)
        XCTAssertEqual((session["instructions"] as! String).contains("sin voseo"), true)
    }
    func testNotchExpansionHasFixedSizesAndFitsSmallDisplays() throws {
        let compact = NotchLayout(expanded: false, availableWidth: 1440, availableHeight: 900)
        let chat = NotchLayout(expanded: true, availableWidth: 1440, availableHeight: 900)
        XCTAssertEqual(compact.height, 66)
        XCTAssertEqual(chat.width, compact.width)
        XCTAssertEqual(chat.height, 390)
        let tiny = NotchLayout(expanded: true, availableWidth: 320, availableHeight: 240)
        XCTAssertEqual(tiny.width <= 320 && tiny.height <= 240, true)
    }

    func testConversationHaloIsBoundedAndOffWhenDisconnected() throws {
        XCTAssertEqual(VoiceHalo(active: false, level: 1, time: 10).opacity, 0)
        for level in [0.0, 0.003, 0.2, 1, 2, Double.nan] {
            let halo = VoiceHalo(active: true, level: level, time: 0)
            XCTAssertEqual(halo.diameter <= VoiceHalo.panelSize, true)
            XCTAssertEqual(halo.opacity >= 0.5 && halo.opacity <= 0.92, true)
        }
        XCTAssertEqual(VoiceHalo(active: true, level: 0.5, time: 0).diameter > VoiceHalo.faceSize, true)
    }

    func testLiveHandshakeErrorsDoNotMisreportPermissionsOrBalance() throws {
        XCTAssertEqual(LiveProtocol.connectionError(status: 401, code: -1011).contains("401"), true)
        XCTAssertEqual(LiveProtocol.connectionError(status: 403, code: -1011).contains("403"), true)
        XCTAssertEqual(LiveProtocol.connectionError(status: 429, code: -1011).contains("saldo"), false)
        XCTAssertEqual(LiveProtocol.connectionError(status: nil, code: -1001).contains("tiempo"), true)
        XCTAssertEqual(LiveProtocol.connectionError(status: 503, code: -1011).contains("503"), true)
    }

    func testAssistantContextReachesLiveAndGraphWithoutLosingTheUserPreference() throws {
        let context = AssistantContext(text: "Explica con ejemplos simples; evita interrumpir conversaciones ajenas.")
        XCTAssertEqual(context.liveInstructions(base: "Base").contains("ejemplos simples"), true)
        XCTAssertEqual(context.liveInstructions(base: "Base").contains("interrumpir conversaciones ajenas"), true)
        XCTAssertEqual(context.graphContext.contains(context.text), true)
        let session = LiveProtocol.start(userContext: context)["session"] as! [String: Any]
        XCTAssertEqual((session["instructions"] as? String)?.contains(context.text), true)
        let delegation = session["delegation"] as! [String: Any]
        let planner = delegation["responses"] as! [String: Any]
        XCTAssertEqual((planner["instructions"] as? String)?.contains(context.text), true)
    }

    func testLiveAudioPreservesSilentTimeAndRejectsBrokenPCM() throws {
        let silence = try LiveAudioChunk(Data(repeating: 0, count: 4800))
        XCTAssertEqual(silence.frames, 2400)
        XCTAssertEqual(silence.audible, false)
        let speech = try LiveAudioChunk(Data([1, 0, 0, 0]))
        XCTAssertEqual(speech.frames, 2)
        XCTAssertEqual(speech.audible, true)
        XCTAssertThrowsError(try LiveAudioChunk(Data([1])))
    }

    func testVoicePresentationAccumulatesReplyAndResetsAtNextTurn() throws {
        var state = TaskPresentation()
        state.receiveUserFragment("Abre informes")
        state.receiveAssistantFragment("Voy a ")
        state.receiveAssistantFragment("abrir informes.")
        XCTAssertEqual(state.title, "Abre informes")
        XCTAssertEqual(state.detail, "Voy a abrir informes.")
        state.receiveUserFragment("Ahora cierra")
        state.receiveAssistantFragment("Cerrando.")
        XCTAssertEqual(state.title, "Ahora cierra")
        XCTAssertEqual(state.detail, "Cerrando.")
        state.stop()
        state.begin("Nueva tarea")
        state.receiveAssistantFragment("Lista.")
        XCTAssertEqual(state.detail, "Lista.")
    }

    func testPresentationKeepsTaskAndDistinguishesStop() throws {
        var state = TaskPresentation()
        state.receiveUserFragment("Abre ")
        state.receiveUserFragment("el navegador")
        XCTAssertEqual(state.title, "Ü")
        XCTAssertEqual(state.detail, "Abre el navegador")
        state.commitUserTurn()
        state.update("Buscando Safari", phase: .working)
        XCTAssertEqual(state.title, "Abre el navegador")
        state.stop()
        XCTAssertEqual(state.phase, .stopped)
        XCTAssertEqual(state.title, "Abre el navegador")
        state.update("Falló la conexión", phase: .error)
        XCTAssertEqual(state.phase, .error)
        state.commitUserTurn()
        XCTAssertEqual(state.title, "Abre el navegador")
    }
    func testMemoryNeverTurnsRememberedIntoLive() throws {
        var memory = NavigationMemory()
        let button = MemoryElement(selector: "button:next", label: "Siguiente", role: "AXButton")
        memory.arrive(at: "mac://fixture/a")
        memory.observe(surface: "mac://fixture/a", elements: [button])
        try memory.teach(surface: "mac://fixture/a", selector: button.selector, meaning: "Abre detalles", at: Date(timeIntervalSince1970: 1))
        memory.arrive(at: "mac://fixture/b")
        memory.observe(surface: "mac://fixture/a", elements: [])
        XCTAssertEqual(memory.currentSurface, "mac://fixture/b")
        XCTAssertEqual(memory.entries(surface: "mac://fixture/a").count, 1)
        XCTAssertEqual(memory.isLive(surface: "mac://fixture/a", selector: button.selector), false)
        XCTAssertThrowsError(try memory.teach(surface: "mac://fixture/a", selector: "never-seen", meaning: "Inventado", at: Date()))
        let decoded = try JSONDecoder().decode(NavigationMemory.self, from: JSONEncoder().encode(memory))
        XCTAssertEqual(decoded.entries(surface: "mac://fixture/a").first?.meaning, "Abre detalles")
        XCTAssertEqual(decoded.isLive(surface: "mac://fixture/a", selector: button.selector), false)
    }
    func testMemoryRoutesOnlyThroughObservedEdges() throws {
        var memory = NavigationMemory()
        let button = MemoryElement(selector: "next", label: "Siguiente", role: "AXButton")
        memory.observe(surface: "a", elements: [button])
        XCTAssertThrowsError(try memory.recordTransition(from: "a", selector: "invented", to: "b"))
        try memory.recordTransition(from: "a", selector: "next", to: "b")
        memory.observe(surface: "b", elements: [button])
        try memory.recordTransition(from: "b", selector: "next", to: "c")
        XCTAssertEqual(memory.nextStep(from: "a", to: "c")?.selector, "next")
        memory.observe(surface: "a", elements: [])
        XCTAssertNil(memory.nextStep(from: "a", to: "c"))
    }
    func testMemoryPersistenceAndCorruptionAreExplicit() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let url = root.appendingPathComponent("memory.json"), store = MemoryStore(url: root.appendingPathComponent("memory.json"))
        var memory = NavigationMemory()
        memory.observe(surface: "a", elements: [MemoryElement(selector: "button", label: "Abrir", role: "AXButton")])
        try memory.teach(surface: "a", selector: "button", meaning: "Abre el informe", at: Date())
        try await store.save(memory)
        let restored = try await store.load()
        XCTAssertEqual(restored.entries(surface: "a").first?.meaning, "Abre el informe")
        XCTAssertEqual(restored.isLive(surface: "a", selector: "button"), false)
        try Data("broken".utf8).write(to: url)
        do { _ = try await store.load(); XCTFail("Corrupt memory was silently erased") } catch {}
        XCTAssertEqual(try String(contentsOf: url), "broken")
    }
}
