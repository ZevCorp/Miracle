import AppKit
import ApplicationServices
import UCore

/// Measures APRENDER in the RUNNING Ü (opened with --probe-hooks) the way a person uses it: the demo
/// waits for the app, records real clicks and keys in UFixture (our own test window, never the user's
/// apps), and saves the lesson. Dry run: nothing is sent to Graph. Moves the cursor for ~25 s.
@MainActor
enum LearnProbe {
    static func run(output: URL) async {
        var evidence: [String: Any] = ["date": ISO8601DateFormatter().string(from: Date()), "passed": false]
        let savedCursor = CGEvent(source: nil)?.location ?? .zero
        var fixture: NSRunningApplication?
        defer {
            fixture?.terminate()
            CGWarpMouseCursorPosition(savedCursor)
            if let data = try? JSONSerialization.data(withJSONObject: evidence, options: [.prettyPrinted, .sortedKeys]) { try? data.write(to: output, options: .atomic) }
            NSApp.terminate(nil)
        }
        guard let pid = (await WindowProbe(pid: 0).dump()["pid"] as? Int).map({ pid_t($0) }) else {
            evidence["error"] = "Ü no contesta a la sonda: ábrela con --probe-hooks."; return
        }
        let arguments = CommandLine.arguments
        guard let index = arguments.firstIndex(of: "--learn-test"), arguments.count > index + 2 else {
            evidence["error"] = "Falta la ruta de UFixture.app: --learn-test <salida.json> <UFixture.app>"; return
        }
        let fixtureURL = URL(fileURLWithPath: arguments[index + 2])
        let p = WindowProbe(pid: pid)
        p.watchForPeople()
        var metrics: [String: Any] = [:], failures: [String] = []
        func check(_ name: String, _ ok: Bool, _ detail: [String: Any]) {
            metrics[name] = detail.merging(["ok": ok]) { $1 }
            if !ok { failures.append(name) }
        }
        let screen = Glass.screen
        func aura() -> WindowProbe.Window? { p.windows().first { abs($0.rect.width - screen.width) < 1 && abs($0.rect.height - screen.height) < 1 } }

        // "real" as a last argument sends the demo to Graph like a person's would (one test workflow).
        let real = arguments.count > index + 3 && arguments[index + 3] == "real"
        evidence["modo"] = real ? "real: se envía a Graph" : "prueba local: nada llega a Graph"
        p.send(real ? "learnDry:0" : "learnDry:1")
        p.send("expiry:90")
        try? await Task.sleep(for: .milliseconds(300))
        var state = await p.dump()
        let lessonBefore = state["lessonFile"] as? String ?? ""
        let bandPoint = CGPoint(x: screen.minX + 30, y: screen.midY - 150)
        let baselinePasses = await p.clickThrough(at: bandPoint, below: NSWindow.Level.floating.rawValue - 1)
        check("L0_enReposoSinAura", state["learnTeaching"] as? Bool == false && aura() == nil, ["enseñando": state["learnTeaching"] ?? "?", "aura": aura() != nil])

        // L1: with Ü itself in front the demo waits, faint, and says nothing of recording.
        p.send("front")
        let uInFront = await p.bringToFront(pid)
        try? await Task.sleep(for: .milliseconds(300))
        let pressedLearn = await pressDock(p, pid: pid, label: "Aprender: enséñale a Ü una tarea")
        if !pressedLearn { p.send("learn") }
        try? await Task.sleep(for: .milliseconds(900))
        let offersCancel = AXFinder(pid: pid).frame(label: "Cancelar la enseñanza") != nil
        state = await p.dump()
        let offersFinish = AXFinder(pid: pid).frame(label: "Terminar de enseñar") != nil
        check("L8_elMuelleOfreceAprender", pressedLearn && (offersCancel || (real && offersFinish)) && state["learnTeaching"] as? Bool == true,
              ["pulsadoEnElMuelle": pressedLearn, "ofreceCancelar": offersCancel])
        await p.glide(to: CGPoint(x: screen.midX, y: screen.midY + 150), ms: 100)
        try? await Task.sleep(for: .milliseconds(300))
        state = await p.dump()
        let waitingStatus = state["learnStatus"] as? String ?? ""
        let preparingAura = aura()
        // Real: opening the microphone gives the focus back to the app the person was in, and the
        // demo starts there at once; the waiting phase only exists while Ü itself stays in front.
        check(real ? "L1_empiezaEnLaAppDondeEstabas" : "L1_esperaLaAppSinGrabar", real
              ? state["learnTeaching"] as? Bool == true && preparingAura != nil
              : state["learnTeaching"] as? Bool == true && state["learnRecording"] as? Bool == false
              && state["auraPhase"] as? String == "preparing" && preparingAura != nil && !waitingStatus.lowercased().contains("grab"),
              ["üDelante": uInFront, "fase": state["auraPhase"] ?? "?", "estado": waitingStatus, "aura": preparingAura.map { p.describe($0.rect) } ?? "ninguna"])

        // L3b: the aura never takes a click (checked while it waits, so the test click is not a step).
        if !real {
            let under = p.stack(at: bandPoint)
            let bandPasses = await p.clickThrough(at: bandPoint, below: NSWindow.Level.floating.rawValue - 1)
            check("L3b_losClicsAtraviesanElAura", bandPasses && aura() != nil, ["pasa": bandPasses, "pasaSinAura": baselinePasses, "ventanasBajoElPunto": under])
        }

        // L2: the app comes to the front and recording starts at once.
        let config = NSWorkspace.OpenConfiguration(); config.activates = true; config.createsNewApplicationInstance = true
        fixture = try? await NSWorkspace.shared.openApplication(at: fixtureURL, configuration: config)
        guard let fixture else { evidence["error"] = "No pude abrir UFixture en \(fixtureURL.path)"; return }
        _ = await p.waitUntil(seconds: 5) { fixture.isFinishedLaunching }
        try? await Task.sleep(for: .milliseconds(500))
        _ = await p.bringToFront(fixture.processIdentifier)
        var frontAt: Date?
        let started = await p.waitUntil(seconds: 5) {
            if frontAt == nil, NSWorkspace.shared.frontmostApplication?.processIdentifier == fixture.processIdentifier { frontAt = Date() }
            return frontAt != nil
        }
        let recordingStarted = await waitForDump(p, seconds: 2) { $0["learnRecording"] as? Bool == true }
        let recordLatency = frontAt.map { Date().timeIntervalSince($0) } ?? 99
        state = await p.dump()
        let recordingAura = aura()
        check("L2_empiezaAlVerLaApp", started && recordingStarted && (real || recordLatency <= 0.8) && state["auraPhase"] as? String == "learning"
              && (state["learnStatus"] as? String ?? "").contains("Grabando pasos"),
              ["latenciaS": (recordLatency * 100).rounded() / 100, "estado": state["learnStatus"] ?? "?", "fase": state["auraPhase"] ?? "?"])
        check("L3_elAuraNoSeCapturaNiTapa", recordingAura.map { $0.sharing == 0 } == true,
              ["compartida": recordingAura?.sharing ?? -1, "capa": recordingAura?.layer ?? -1])

        // L4: a real click in the app is one event, and the click still reaches the app.
        try? await Task.sleep(for: .milliseconds(300))
        guard let button = AXFinder(pid: fixture.processIdentifier).frame(identifier: "increment"),
              let field = AXFinder(pid: fixture.processIdentifier).frame(identifier: "test-input") else {
            evidence["error"] = "No encontré los controles de UFixture por accesibilidad."; evidence["metrics"] = metrics; return
        }
        let buttonSafe = await safeClick(p, at: CGPoint(x: button.midX, y: button.midY), owner: fixture.processIdentifier)
        // Sent, not only seen: against the real Graph each step takes a network round trip.
        _ = await waitForDump(p, seconds: real ? 8 : 1.5) { ($0["lessonEvents"] as? Int ?? 0) >= 1 && ($0["learnSteps"] as? Int ?? 0) >= 1 }
        state = await p.dump()
        let counter = AXFinder(pid: fixture.processIdentifier).text(prefix: "Contador")
        check("L4_unClicEsUnPasoYLlegaALaApp", buttonSafe && state["lessonEvents"] as? Int == 1 && state["learnSteps"] as? Int == 1 && counter == "Contador: 1",
              ["eventos": state["lessonEvents"] ?? "?", "pasos": state["learnSteps"] ?? "?", "contador": counter ?? "?"])

        // L5: typing a word into a field is one step, closed by the key that follows.
        let fieldSafe = await safeClick(p, at: CGPoint(x: field.midX, y: field.midY), owner: fixture.processIdentifier)
        try? await Task.sleep(for: .milliseconds(400))
        let fixtureFront = fieldSafe && NSWorkspace.shared.frontmostApplication?.processIdentifier == fixture.processIdentifier
        if fixtureFront { await p.type("hola"); await p.key(36) }
        _ = await waitForDump(p, seconds: real ? 10 : 1.5) { ($0["learnSteps"] as? Int ?? 0) >= 4 }
        state = await p.dump()
        check("L5_escribirEsUnPasoPorCampo", fixtureFront && state["lessonEvents"] as? Int == 4 && state["learnSteps"] as? Int == 4,
              ["eventos": state["lessonEvents"] ?? "?", "pasos": state["learnSteps"] ?? "?", "ufixtureDelante": fixtureFront])

        // L6: finishing turns the aura off at once and saves the whole lesson. Pressed in the dock: a
        // click on Ü itself is never a step of the demo.
        let pressedFinish = await pressDock(p, pid: pid, label: "Terminar de enseñar")
        if !pressedFinish { p.send("learn") }
        let auraOff = await p.waitUntil(seconds: 0.5) { aura() == nil }
        let saved = await waitForDump(p, seconds: real ? 150 : 3) { ($0["lessonFile"] as? String ?? "") != lessonBefore && $0["learnClosing"] as? Bool == false }
        state = await p.dump()
        let file = state["lessonFile"] as? String ?? ""
        let lesson = (try? Data(contentsOf: URL(fileURLWithPath: file))).flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
        let events = lesson?["events"] as? [[String: Any]] ?? []
        let seen = events.map { e in [e["kind"] as? String ?? "", e["label"] as? String ?? "", e["text"] as? String ?? e["key"] as? String ?? ""].joined(separator: "|") }
        let expected = ["clic|Sumar uno|", "clic|Texto de prueba|", "teclado|Texto de prueba|hola", "teclado|Texto de prueba|Return"]
        if real {
            let learnt = (state["learnStatus"] as? String ?? "")
            check("L9_graphEstructuraYNombraElWorkflow", learnt.hasPrefix("Aprendido") && (lesson?["workflowId"] as? String)?.isEmpty == false,
                  ["estado": learnt, "workflowId": lesson?["workflowId"] ?? "ninguno", "nombre": lesson?["name"] ?? "sin nombre", "resumen": String((lesson?["summary"] as? String ?? "").prefix(200))])
        }
        check("L6_terminarApagaElAuraYGuardaLaLeccion", pressedFinish && auraOff && saved && state["learnTeaching"] as? Bool == false && seen == expected,
              ["pulsadoTerminar": pressedFinish, "auraApagada": auraOff, "archivo": file, "eventos": seen, "estado": state["learnStatus"] ?? "?"])

        // L7: cancelling while it waits for the app records nothing and writes nothing.
        p.send("front")
        _ = await p.bringToFront(pid)
        try? await Task.sleep(for: .milliseconds(300))
        p.send("learn")
        try? await Task.sleep(for: .milliseconds(600))
        p.send("learn")
        let cancelled = await waitForDump(p, seconds: 1) { $0["learnTeaching"] as? Bool == false }
        try? await Task.sleep(for: .milliseconds(300))
        state = await p.dump()
        check("L7_cancelarAntesDeGrabarNoGuardaNada", cancelled && aura() == nil && state["lessonFile"] as? String == file,
              ["cancelado": cancelled, "aura": aura() != nil, "estado": state["learnStatus"] ?? "?"])

        p.send("back")
        p.send("learnDry:0")
        p.send("clear")
        evidence["metrics"] = metrics
        evidence["failures"] = failures
        evidence["interferencia"] = p.interference
        evidence["origenDeLaInterferencia"] = p.foreignSources
        evidence["valida"] = p.interference.isEmpty
        evidence["score"] = "\(metrics.count - failures.count)/\(metrics.count)"
        evidence["passed"] = failures.isEmpty
    }

    /// Clicks only if the topmost ordinary window under the point is the test app's.
    private static func safeClick(_ p: WindowProbe, at point: CGPoint, owner: pid_t) async -> Bool {
        await p.glide(to: point, ms: 150)
        guard WindowProbe.ownerOfTopWindow(at: point) == owner else { return false }
        p.post(.leftMouseDown, point); try? await Task.sleep(for: .milliseconds(50))
        p.post(.leftMouseUp, point)
        return true
    }

    /// Hovers the dock's tab so it unfolds, finds the button by its accessibility label and clicks it.
    private static func pressDock(_ p: WindowProbe, pid: pid_t, label: String) async -> Bool {
        guard let tab = p.windows().first(where: { abs($0.rect.width - DockRule.tabWidth) < 1 && abs($0.rect.height - DockRule.tabHeight) < 1 })?.rect
                ?? p.windows().first(where: { abs($0.rect.width - DockController.unfoldedWidth) < 1 }).map({ CGRect(x: $0.rect.maxX - DockRule.tabWidth, y: $0.rect.midY - 32, width: DockRule.tabWidth, height: 64) })
        else { return false }
        await p.glide(to: CGPoint(x: tab.midX, y: tab.midY), ms: 150)
        var button: CGRect?
        for _ in 0..<20 where button == nil {
            try? await Task.sleep(for: .milliseconds(100))
            button = AXFinder(pid: pid).frame(label: label)
        }
        guard let button, button.width > 20 else { return false }
        // Along the bar, not across the glass, so the dock stays open on the way.
        await p.glide(to: CGPoint(x: button.maxX - 20, y: tab.midY), ms: 120)
        await p.glide(to: CGPoint(x: button.midX, y: button.midY), ms: 120)
        p.post(.leftMouseDown, CGPoint(x: button.midX, y: button.midY)); try? await Task.sleep(for: .milliseconds(60))
        p.post(.leftMouseUp, CGPoint(x: button.midX, y: button.midY))
        try? await Task.sleep(for: .milliseconds(150))
        return true
    }

    private static func waitForDump(_ p: WindowProbe, seconds: Double, _ condition: ([String: Any]) -> Bool) async -> Bool {
        let began = Date()
        while Date().timeIntervalSince(began) < seconds {
            if condition(await p.dump()) { return true }
            try? await Task.sleep(for: .milliseconds(60))
        }
        return false
    }
}

/// Finds UFixture's controls through accessibility, as any app would see them. Frames are y-down.
struct AXFinder {
    let pid: pid_t
    private func walk(_ visit: (AXUIElement) -> Bool) {
        var stack = [AXUIElementCreateApplication(pid)], seen = 0
        while let e = stack.popLast(), seen < 400 {
            seen += 1
            if visit(e) { return }
            var children: CFTypeRef?
            if AXUIElementCopyAttributeValue(e, kAXChildrenAttribute as CFString, &children) == .success, let list = children as? [AXUIElement] { stack.append(contentsOf: list) }
        }
    }
    private func string(_ e: AXUIElement, _ key: String) -> String {
        var v: CFTypeRef?
        return AXUIElementCopyAttributeValue(e, key as CFString, &v) == .success ? (v as? String ?? "") : ""
    }
    func frame(identifier: String) -> CGRect? { frame { string($0, kAXIdentifierAttribute) == identifier } }
    func frame(label: String) -> CGRect? { frame { string($0, kAXDescriptionAttribute) == label || string($0, kAXTitleAttribute) == label } }
    private func frame(where match: (AXUIElement) -> Bool) -> CGRect? {
        var found: CGRect?
        walk { e in
            guard match(e) else { return false }
            var pos: CFTypeRef?, size: CFTypeRef?
            AXUIElementCopyAttributeValue(e, kAXPositionAttribute as CFString, &pos)
            AXUIElementCopyAttributeValue(e, kAXSizeAttribute as CFString, &size)
            var point = CGPoint.zero, extent = CGSize.zero
            if let pos, let size { AXValueGetValue(pos as! AXValue, .cgPoint, &point); AXValueGetValue(size as! AXValue, .cgSize, &extent) }
            found = CGRect(origin: point, size: extent)
            return true
        }
        return found
    }
    func text(prefix: String) -> String? {
        var found: String?
        walk { e in
            let value = string(e, kAXValueAttribute)
            if value.hasPrefix(prefix) { found = value; return true }
            return false
        }
        return found
    }
}
