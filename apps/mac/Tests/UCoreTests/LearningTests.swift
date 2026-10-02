import Foundation
import UCore

/// Aprender behaves as Learn on Windows (2026-09-30, asked by the user). The Windows promises that
/// can be judged without a screen, a microphone or the network.
extension AgentTests {
    func testAuraIsOnOnlyWhileTeachingAndLeavesTheCentreClear() {
        XCTAssertEqual(AuraRule.decide(teaching: false, recording: false), .off)
        XCTAssertEqual(AuraRule.decide(teaching: true, recording: false), .preparing)
        XCTAssertEqual(AuraRule.decide(teaching: true, recording: true), .learning)
        // Closing: the button is off while the recording still uploads — the aura says nothing is learnt.
        XCTAssertEqual(AuraRule.decide(teaching: false, recording: true), .off)
        XCTAssertEqual(abs(AuraRule.opacity(atDistance: 0) - 0.85) < 1e-9, true)
        XCTAssertEqual(AuraRule.opacity(atDistance: 96), 0)
        XCTAssertEqual(AuraRule.opacity(atDistance: 400), 0)
        XCTAssertEqual(AuraRule.opacity(atDistance: 48) < AuraRule.opacity(atDistance: 10), true)
        XCTAssertEqual(AuraRule.layer(.preparing, elapsed: 7), 0.35)
        XCTAssertEqual(AuraRule.layer(.off, elapsed: 7), 0)
        let breath = stride(from: 0.0, through: 6.4, by: 0.05).map { AuraRule.layer(.learning, elapsed: $0) }
        XCTAssertEqual(abs((breath.min() ?? 0) - 0.55) < 0.01 && abs((breath.max() ?? 0) - 1) < 0.01, true)
        XCTAssertEqual(abs(AuraRule.layer(.learning, elapsed: 1.6) - 1) < 1e-9, true)
        XCTAssertEqual(abs(AuraRule.layer(.learning, elapsed: 3.2) - 0.55) < 1e-9, true)
        XCTAssertEqual(AuraRule.pill(.preparing, steps: 0), "Ü va a aprender · cambia a la app que vas a enseñar")
        XCTAssertEqual(AuraRule.pill(.learning, steps: 0), "Ü está aprendiendo")
        XCTAssertEqual(AuraRule.pill(.learning, steps: 1), "Ü está aprendiendo · 1 paso")
        XCTAssertEqual(AuraRule.pill(.learning, steps: 4), "Ü está aprendiendo · 4 pasos")
    }

    func testDemoWaitsForTheAppInsteadOfCountingDown() {
        XCTAssertEqual(DemoStart.judge(front: .u, waited: 0.2).start, false)
        XCTAssertEqual(DemoStart.judge(front: .u, waited: 0.2).message, "Cuando quieras, pon delante la aplicación que vas a enseñar. Te espero.")
        XCTAssertEqual(DemoStart.judge(front: .u, waited: 10).message.hasPrefix("Sigo esperando"), true)
        XCTAssertEqual(DemoStart.judge(front: .desktop, waited: 10).message.hasPrefix("Veo el escritorio"), true)
        let go = DemoStart.judge(front: .app("Notas"), waited: 1)
        XCTAssertEqual(go.start, true)
        XCTAssertEqual(go.message.contains("«Notas»"), true)
        // Nothing says "recording" before the app is in front.
        for waited in [0.0, 3, 5, 30, 59] { XCTAssertEqual(DemoStart.judge(front: .u, waited: waited).message.lowercased().contains("grab"), false) }
        let late = DemoStart.judge(front: .u, waited: 60)
        XCTAssertEqual(late.gaveUp, true)
        XCTAssertEqual(late.message.contains("Aprender"), true)
    }

    func testLessonKeepsEachClickAndOneStepPerTypedField() {
        var b = LessonBuilder()
        b.heard("voy a crear una nota", ms: 50)
        b.click(ms: 100, x: 10, y: 20, app: "Notas", selector: "[\"notes\",\"AXButton\",\"id:new\"]", label: "Nueva nota", role: "AXButton")
        b.typed(ms: 300, text: "h", app: "Notas", selector: "campo", label: "Título", role: "AXTextField", secure: false)
        b.typed(ms: 350, text: "ola", app: "Notas", selector: "campo", label: "Título", role: "AXTextField", secure: false)
        // The open typing run is not sent yet: the whole word goes as one step.
        let first = b.release(closing: false)
        XCTAssertEqual(first.map(\.actionType), ["click"])
        XCTAssertEqual(first[0].explanation, "voy a crear una nota")
        b.heard("y aquí escribo el título", ms: 320)
        b.key(ms: 500, name: "Return", app: "Notas", selector: "campo", label: "Título", role: "AXTextField")
        b.typed(ms: 700, text: "secreto", app: "Notas", selector: "clave", label: "Contraseña", role: "AXTextField", secure: true)
        b.typed(ms: 720, text: "123", app: "Notas", selector: "clave", label: "Contraseña", role: "AXTextField", secure: true)
        let rest = b.release(closing: true)
        XCTAssertEqual(rest.map(\.actionType), ["input", "key", "input"])
        XCTAssertEqual(rest[0].value, "hola")
        XCTAssertEqual(rest[0].explanation, "y aquí escribo el título")
        XCTAssertEqual(rest[1].value, "Return")
        // A protected field is a step without its value, ever.
        XCTAssertNil(rest[2].value)
        XCTAssertEqual(b.events.count, 4)
        XCTAssertEqual(b.events.last?.text == nil, true)
        XCTAssertEqual(b.release(closing: true).isEmpty, true)
        // Two clicks in the same place are two events (promesa 170).
        var c = LessonBuilder()
        c.click(ms: 1, x: 5, y: 5, app: "A", selector: "s", label: "OK", role: "AXButton")
        c.click(ms: 2, x: 5, y: 5, app: "A", selector: "s", label: "OK", role: "AXButton")
        XCTAssertEqual(c.events.count, 2)
    }

    func testLessonIsWholeOrNotWrittenAndSpeechGoesToItsStep() throws {
        XCTAssertNil(LessonBuilder().lesson(id: "x", started: Date(), ended: Date(), app: "A"))
        var b = LessonBuilder()
        b.click(ms: 100, x: 1, y: 1, app: "A", selector: "a", label: "Uno", role: "AXButton")
        b.click(ms: 2000, x: 2, y: 2, app: "A", selector: "b", label: "Dos", role: "AXButton")
        b.heard("este es el primero", ms: 900)
        b.heard("y este el segundo", ms: 2500)
        let start = Date(timeIntervalSince1970: 1_790_000_000)
        let lesson = try XCTUnwrap(b.lesson(id: "l1", started: start, ended: start.addingTimeInterval(3), app: "A"))
        XCTAssertEqual(lesson.events[0].said, ["este es el primero"])
        XCTAssertEqual(lesson.events[1].said, ["y este el segundo"])
        XCTAssertEqual(lesson.durationMs, 3000)
        XCTAssertEqual(b.transcript, "este es el primero\ny este el segundo")
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("u-lessons-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: folder) }
        let store = LessonStore(root: folder)
        let file = try store.save(lesson)
        XCTAssertEqual(file.deletingLastPathComponent().lastPathComponent.hasPrefix("leccion_"), true)
        XCTAssertEqual(store.latest(), lesson)
    }

    func testTheApprenticeLooksButNeverTouchesTheScreen() {
        for tool in ["map_click", "map_type", "map_scroll", "map_go_to", "map_open_app", "launch_app", "key", "scroll", "map_tramo", "map_decidir", "open_url", "map_esto_es", "send_email"] {
            XCTAssertEqual(ApprenticeMode.refuses(tool), true)
        }
        for tool in ["map_where_am_i", "read_screen", "map_pointing_at", "look", "stop_task"] { XCTAssertEqual(ApprenticeMode.refuses(tool), false) }
        XCTAssertEqual(ApprenticeMode.refusal.contains("Aprender"), true)
    }

    func testARefusedVoiceCredentialIsToldApartFromANetworkFailure() {
        for code in ["credit_balance_exhausted", "insufficient_quota.credit_balance_exhausted", "invalid_api_key"] {
            XCTAssertEqual(LiveProtocol.credentialRefused(code: code), true)
        }
        for code in ["response_cancel_not_active", "invalid_model", "unknown", "rate_limit_exceeded"] {
            XCTAssertEqual(LiveProtocol.credentialRefused(code: code), false)
        }
        XCTAssertEqual(LiveProtocol.voiceRefusedSummary(triedBoth: true).contains("ninguna credencial"), true)
        XCTAssertEqual(LiveProtocol.voiceRefusedSummary(triedBoth: false).contains("saldo"), true)
    }

    func testWithoutEchoCancellationUDoesNotHearItselfThroughTheSpeakers() {
        // Voice processing on: macOS cancels the echo, nothing is silenced and the person can interrupt.
        XCTAssertEqual(EchoGuard.silences(voiceProcessing: true, openSpeaker: true, playing: true, sinceLastPlayback: 0), false)
        // Refused, open speakers: silent while Ü speaks and for the tail of the room.
        XCTAssertEqual(EchoGuard.silences(voiceProcessing: false, openSpeaker: true, playing: true, sinceLastPlayback: 99), true)
        XCTAssertEqual(EchoGuard.silences(voiceProcessing: false, openSpeaker: true, playing: false, sinceLastPlayback: 0.2), true)
        XCTAssertEqual(EchoGuard.silences(voiceProcessing: false, openSpeaker: true, playing: false, sinceLastPlayback: 0.5), false)
        // Headphones: no echo to guard against.
        XCTAssertEqual(EchoGuard.silences(voiceProcessing: false, openSpeaker: false, playing: true, sinceLastPlayback: 0), false)
    }

    func testStepJSONLeavesOutWhatWasNotSeen() throws {
        let step = LearningStep(actionType: "click", selector: "s", label: "OK", controlType: "AXButton", value: nil, explanation: nil, surfaceSection: nil, surfaceHints: nil)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(step)) as? [String: Any])
        XCTAssertEqual(Set(json.keys), ["actionType", "selector", "label", "controlType"])
    }

    func testLearningSessionSendsStepsInOrderAndFinishesOrStaysPending() async throws {
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [MockGraphProtocol.self]
        let session = URLSession(configuration: config)
        defer { session.invalidateAndCancel(); MockGraphProtocol.respond = nil }
        let graph = try GraphClient(baseURL: "https://test.invalid", apiKey: "test-only", transport: session)
        let client = LearningClient(graph: graph, transport: session, sleep: { _ in })
        var paths: [String] = [], bodies: [[String: Any]] = [], finishes = 0
        MockGraphProtocol.respond = { request in
            let path = request.url?.path ?? ""
            paths.append(path)
            bodies.append(Self.body(request))
            XCTAssertEqual(request.value(forHTTPHeaderField: "X-API-Key"), "test-only")
            XCTAssertEqual(request.timeoutInterval, 90)
            if path.hasSuffix("/learning/sessions") { return (200, Data(#"{"session":{"id":"ses 1","recording":true}}"#.utf8)) }
            if path.hasSuffix("/steps") { return (200, Data("{\"step\":{\"step_order\":\(paths.filter { $0.hasSuffix("/steps") }.count)}}".utf8)) }
            if path.hasSuffix("/context-notes") { return (200, Data("{}".utf8)) }
            finishes += 1
            return finishes < 3 ? (503, Data("{}".utf8)) : (200, Data(#"{"workflow_id":"wf-9","summary":"Crea una nota","workflow":{"name":"Crear nota"}}"#.utf8))
        }
        let id = try await client.open(description: "", app: "Notas", title: "Notas")
        XCTAssertEqual(id, "ses 1")
        XCTAssertEqual(bodies[0]["description"] as? String, "Workflow sin descripción")
        XCTAssertEqual((bodies[0]["context"] as? [String: String])?["platform"], "macos")
        var b = LessonBuilder()
        b.click(ms: 1, x: 1, y: 1, app: "Notas", selector: "a", label: "Nueva", role: "AXButton")
        b.typed(ms: 2, text: "hola", app: "Notas", selector: "t", label: "Título", role: "AXTextField", secure: false)
        var orders: [Int] = []
        for step in b.release(closing: true) { orders.append(try await client.step(step, session: id)) }
        XCTAssertEqual(orders, [1, 2])
        XCTAssertEqual(paths[1], "/api/v1/learning/sessions/ses%201/steps")
        XCTAssertEqual(bodies[2]["value"] as? String, "hola")
        try await client.context("voy a crear una nota", session: id)
        XCTAssertEqual((bodies[3]["note"] as? [String: String])?["mode"], "training")
        let done = try await client.finish(session: id)
        XCTAssertEqual(done, LearningClient.Finished(workflowId: "wf-9", summary: "Crea una nota", name: "Crear nota"))
        XCTAssertEqual(finishes, 3)
        // Graph slow three times: the steps are safe, the finish stays pending for the next launch.
        finishes = -10
        do { _ = try await client.finish(session: id); XCTFail("a finish that never came was accepted") }
        catch { XCTAssertEqual(error as? LearningClient.Failure, .finishPending(session: id)) }
        let pending = PendingFinishes(url: FileManager.default.temporaryDirectory.appendingPathComponent("u-pending-\(UUID().uuidString).json"))
        try pending.add(id); try pending.add(id)
        XCTAssertEqual(pending.load().map(\.session), [id])
        try pending.remove(id)
        XCTAssertEqual(pending.load().isEmpty, true)
        // A refusal is not retried and does not pretend to be pending.
        MockGraphProtocol.respond = { _ in (401, Data("{}".utf8)) }
        do { _ = try await client.finish(session: id); XCTFail("401 was accepted") }
        catch { XCTAssertEqual(error as? LearningClient.Failure, .rejected(401, nil)) }
    }

    static func body(_ request: URLRequest) -> [String: Any] {
        var data = request.httpBody ?? Data()
        if data.isEmpty, let stream = request.httpBodyStream {
            stream.open(); defer { stream.close() }
            var buffer = [UInt8](repeating: 0, count: 4096)
            while stream.hasBytesAvailable { let n = stream.read(&buffer, maxLength: buffer.count); if n <= 0 { break }; data.append(buffer, count: n) }
        }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    }
}

func XCTUnwrap<T>(_ value: T?, file: StaticString = #filePath, line: UInt = #line) throws -> T {
    guard let value else { XCTFail("Expected a value", file: file, line: line); throw CancellationError() }
    return value
}
