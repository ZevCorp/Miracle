import UMac
import AppKit
import ApplicationServices
import UCore

/// Measures the RUNNING Ü's notch and dock the way a person meets them: it moves the real cursor with
/// HID-level events, produces the events a conversation would (through --probe-hooks) and times the
/// windows from the window server. Moves the cursor for about a minute.
///
/// The score is the success metric of the port from Windows: every check below is a behaviour of
/// Windows PanelDeAcciones or Muelle, with the number it has to meet.
@MainActor
enum NotchProbe {
    static let channel = Notification.Name("com.zevcorp.u.mac.probe")

    static func run(output: URL) async {
        var evidence: [String: Any] = ["date": ISO8601DateFormatter().string(from: Date()), "passed": false]
        let savedCursor = CGEvent(source: nil)?.location ?? .zero
        defer {
            CGWarpMouseCursorPosition(savedCursor)
            if let data = try? JSONSerialization.data(withJSONObject: evidence, options: [.prettyPrinted, .sortedKeys]) { try? data.write(to: output, options: .atomic) }
            NSApp.terminate(nil)
        }
        // Measure the copy that answers the hooks, never a stale copy still closing after an install.
        guard let pid = (await WindowProbe(pid: 0).dump()["pid"] as? Int).map({ pid_t($0) }) else {
            evidence["error"] = "Ü no contesta a la sonda: ábrela con --probe-hooks."; return
        }
        let others = NSRunningApplication.runningApplications(withBundleIdentifier: "com.zevcorp.u.mac").filter { $0.processIdentifier != getpid() && $0.processIdentifier != pid }
        others.forEach { $0.terminate() }
        evidence["pid"] = Int(pid); evidence["copiasViejasCerradas"] = others.count
        let p = WindowProbe(pid: pid)
        p.watchForPeople()
        for _ in 0..<50 where p.dock() == nil { try? await Task.sleep(for: .milliseconds(100)) }
        guard p.dock() != nil else { evidence["error"] = "No encontré el muelle."; return }
        try? await Task.sleep(for: .milliseconds(others.isEmpty ? 0 : 1500))

        var metrics: [String: Any] = [:], failures: [String] = []
        func check(_ name: String, _ ok: Bool, _ detail: [String: Any]) {
            metrics[name] = detail.merging(["ok": ok]) { $1 }
            if !ok { failures.append(name) }
        }

        let screen = p.screen, visible = p.visible
        let restW = NotchLayout.compactWidth + NotchController.shadowSide * 2, restH = NotchLayout.compactHeight + NotchController.shadowTop + NotchController.shadowBottom
        let rest = CGRect(x: visible.midX - restW / 2, y: visible.minY + NotchLayout.gap - NotchController.shadowTop, width: restW, height: restH)
        let away = CGPoint(x: visible.midX, y: visible.midY + 120)
        let edge = CGPoint(x: visible.midX, y: screen.minY)
        // Start clean: whatever an earlier run left in the notch is cleared first.
        p.send("closeChat"); p.send("clear"); p.send("expiry:90")
        await p.glide(to: away, ms: 150)
        try? await Task.sleep(for: .milliseconds(700))

        // N1: hidden at launch (and after any cleanup): nothing said, nobody at the edge.
        var state = await p.dump()
        check("N1_ocultoSinNadaQueDecir", p.notch() == nil && state["notchPhase"] as? String == "hidden", ["fase": state["notchPhase"] ?? "?", "ventana": p.notch().map { p.describe($0.rect) } ?? "ninguna"])

        // N2 + N3: touching the top edge brings it out, dropping from above with a small bounce.
        let touched = Date()
        p.move(to: edge)
        let arrival = await p.sample(seconds: 0.9) { p.notch() }
        let first = arrival.first { $0.value != nil }
        let latency = first.map { $0.t } ?? 99
        let frames = arrival.compactMap { $0.value }
        let final = frames.last?.rect ?? .zero
        let settledAt = arrival.last { s in s.value.map { abs($0.rect.minY - final.minY) > 0.5 || $0.alpha < 0.99 } ?? true }?.t ?? 99
        check("N2_bordeLoAsoma", latency <= 0.25 && abs(final.minX - rest.minX) <= 1 && abs(final.minY - rest.minY) <= 1 && abs(final.width - restW) < 1,
              ["latenciaS": round2(latency), "asentadoS": round2(settledAt), "final": p.describe(final), "esperado": p.describe(rest),
               "trayectoria": arrival.enumerated().filter { $0.offset % 3 == 0 }.map { s in s.element.value.map { "\(round2(s.element.t)) y=\(round2($0.rect.minY)) a=\(round2($0.alpha))" } ?? "\(round2(s.element.t)) -" }])
        let highest = frames.map { $0.rect.minY }.min() ?? 0, lowest = frames.map { $0.rect.minY }.max() ?? 0
        let alphas = frames.map { $0.alpha }
        check("N3_caeConRebote", rest.minY - highest >= 6 && lowest - rest.minY >= 0.3 && lowest - rest.minY <= 3 && settledAt <= latency + 0.5 && (alphas.first ?? 1) < 0.8,
              ["caidaDesdePx": round2(rest.minY - highest), "rebotePx": round2(lowest - rest.minY), "alfaInicial": round2(alphas.first ?? 1), "muestras": frames.count])
        _ = touched

        // N4: from the edge down to the piece, the bridge keeps it: never gone on the way.
        let pieceCentre = CGPoint(x: rest.midX, y: rest.minY + NotchController.shadowTop + NotchLayout.compactHeight / 2)
        var gone = 0
        for step in 1...30 {
            p.move(to: CGPoint(x: edge.x, y: edge.y + (pieceCentre.y - edge.y) * Double(step) / 30))
            try? await Task.sleep(for: .milliseconds(20))
            if p.notch() == nil { gone += 1 }
        }
        let hold = await p.sample(seconds: 1.2) { p.notch() }
        let holdGaps = hold.filter { $0.value == nil || ($0.value?.alpha ?? 0) < 0.99 }.count
        check("N4_seLlegaALaPiezaSinQueSeVaya", gone == 0 && holdGaps == 0, ["ausenciasEnElCamino": gone, "parpadeosAlQuedarse": holdGaps])

        // N5: leaving the zone sends a hover-only notch away, rising while it fades.
        let leftAt = Date()
        await p.glide(to: away, ms: 60)
        let exit = await p.sample(seconds: 0.9) { p.notch() }
        let hiddenAt = exit.first { $0.value == nil }?.t ?? 99
        let exitFrames = exit.compactMap { $0.value }
        let rose = (exitFrames.first?.rect.minY ?? 0) - (exitFrames.map { $0.rect.minY }.min() ?? 0)
        check("N5_alejarseLoRetira", hiddenAt <= 0.6 && rose >= 3, ["ocultoTrasS": round2(hiddenAt + 0.06), "subioPx": round2(rose), "desdeQueSalio": round2(Date().timeIntervalSince(leftAt))])

        // N6: a burst of in and out never leaves it stuck: it ends where the cursor says.
        var mismatches: [String] = []
        for i in 0..<12 {
            p.move(to: i % 2 == 0 ? edge : away)
            try? await Task.sleep(for: .milliseconds([60, 140, 90, 220, 70, 300][i % 6]))
        }
        p.move(to: away); try? await Task.sleep(for: .milliseconds(750))
        state = await p.dump()
        if p.notch() != nil || state["notchPhase"] as? String != "hidden" { mismatches.append("fuera pero visible (\(state["notchPhase"] ?? "?"))") }
        p.move(to: edge); try? await Task.sleep(for: .milliseconds(750))
        if let w = p.notch() { if abs(w.rect.minY - rest.minY) > 1 || w.alpha < 0.99 { mismatches.append("en el borde pero a medias \(p.describe(w.rect)) alfa \(round2(w.alpha))") } }
        else { mismatches.append("en el borde pero oculto") }
        p.move(to: away); try? await Task.sleep(for: .milliseconds(750))
        if p.notch() != nil { mismatches.append("fuera otra vez pero visible") }
        check("N6_rafagaSinTrabarse", mismatches.isEmpty, ["desajustes": mismatches])

        // N7: news brings it out wherever the cursor is, saying exactly that.
        p.send("notify:Abriendo Safari…")
        let news = await p.sample(seconds: 0.7) { p.notch() }
        let newsAt = news.first { $0.value != nil }?.t ?? 99
        state = await p.dump()
        check("N7_noticiaLoTrae", newsAt <= 0.2 && state["notchText"] as? String == "Abriendo Safari…" && p.notch().map { abs($0.rect.minY - rest.minY) <= 1 } == true,
              ["latenciaS": round2(newsAt), "texto": state["notchText"] ?? "?"])

        // N8: with something to say, passing by the edge and leaving does not take it away.
        p.move(to: edge); try? await Task.sleep(for: .milliseconds(300))
        p.move(to: away); try? await Task.sleep(for: .milliseconds(700))
        check("N8_loQueDiceLoSostiene", p.notch() != nil, ["visible": p.notch() != nil])

        // N9: nothing new for the expiry and nothing in progress: it goes by itself. (3 s instead of 90.)
        p.send("expiry:3")
        p.send("notify:Listo")
        let expiryStart = Date()
        let expiry = await p.waitUntil(seconds: 7) { p.notch() == nil }
        let expiredAfter = expiry ? Date().timeIntervalSince(expiryStart) : 99
        check("N9_caducaSolo", expiredAfter >= 3 && expiredAfter <= 5.8, ["ocultoTrasS": round2(expiredAfter), "caducidadS": 3])

        // N10: a step in progress never expires; its outcome restarts the clock.
        p.send("begin:Buscando el archivo")
        try? await Task.sleep(for: .milliseconds(6500))
        let stillThere = p.notch() != nil
        state = await p.dump()
        let spinning = state["notchState"] as? String == "working"
        p.send("done:Archivo encontrado")
        let doneAt = Date()
        let afterDone = await p.waitUntil(seconds: 7) { p.notch() == nil }
        let doneAfter = afterDone ? Date().timeIntervalSince(doneAt) : 99
        check("N10_enCursoNoCaduca", stillThere && spinning && doneAfter >= 3 && doneAfter <= 5.8, ["visibleTras6.5s": stillThere, "estado": state["notchState"] ?? "?", "ocultoTrasElDesenlaceS": round2(doneAfter)])
        p.send("expiry:90")

        // N11: the chat grows down from the same top edge, holds the notch, and closes back.
        p.send("openChat")
        try? await Task.sleep(for: .milliseconds(500))
        let chat = p.notch()
        try? await Task.sleep(for: .milliseconds(1200))
        let chatHeld = p.notch() != nil
        p.send("closeChat")
        try? await Task.sleep(for: .milliseconds(400))
        let back = p.notch()
        check("N11_chatCreceDesdeElMismoBorde",
              chat.map { abs($0.rect.width - 468) < 1 && abs($0.rect.height - 408) < 1 && abs($0.rect.minY - rest.minY) <= 1 && abs($0.rect.midX - rest.midX) <= 1 } == true
              && chatHeld && back.map { abs($0.rect.width - restW) < 1 && abs($0.rect.minY - rest.minY) <= 1 } == true,
              ["chat": chat.map { p.describe($0.rect) } ?? "ninguno", "seSostuvo": chatHeld, "alCerrar": back.map { p.describe($0.rect) } ?? "ninguno"])

        // N12: news arriving during the exit is not swallowed by it — the old stuck notch.
        p.send("clear")
        try? await Task.sleep(for: .milliseconds(80))
        p.send("notify:Sigo aquí")
        try? await Task.sleep(for: .milliseconds(700))
        state = await p.dump()
        let revived = p.notch()
        check("N12_noticiaDuranteLaSalidaNoSePierde",
              revived.map { abs($0.rect.minY - rest.minY) <= 1 && $0.alpha > 0.99 } == true && state["notchText"] as? String == "Sigo aquí" && state["notchPhase"] as? String == "shown",
              ["texto": state["notchText"] ?? "?", "fase": state["notchPhase"] ?? "?", "alfa": revived.map { round2($0.alpha) } ?? 0])

        // N13: the conversation ends: it leaves and forgets.
        p.send("clear")
        let cleared = await p.waitUntil(seconds: 1) { p.notch() == nil }
        try? await Task.sleep(for: .milliseconds(100))
        state = await p.dump()
        check("N13_colgarLoRetiraYOlvida", cleared && state["notchText"] as? String == "Ü", ["oculto": cleared, "texto": state["notchText"] ?? "?"])

        // N14: the chat takes the keyboard without taking the focus from the app underneath.
        p.send("openChat")
        try? await Task.sleep(for: .milliseconds(500))
        // Only type if the notch holds the keyboard: otherwise the keys would reach the user's app.
        let keyed = (await p.dump())["notchKey"] as? Bool == true
        if keyed { await p.type("hola") }
        try? await Task.sleep(for: .milliseconds(300))
        state = await p.dump()
        let typed = keyed ? state["draft"] as? String ?? "" : "(el notch no tenía el teclado)"
        p.send("closeChat")
        try? await Task.sleep(for: .milliseconds(300))
        let emptied = (await p.dump())["draft"] as? String ?? "?"
        check("N14_elChatRecibeElTeclado", typed == "hola" && emptied.isEmpty, ["escrito": typed, "trasCerrar": emptied])

        // N15: the glass around the piece (its shadow room) lets clicks through to what is below.
        p.send("notify:Probando clics")
        try? await Task.sleep(for: .milliseconds(600))
        let piece = CGRect(x: rest.minX + NotchController.shadowSide, y: rest.minY + NotchController.shadowTop, width: NotchLayout.compactWidth, height: NotchLayout.compactHeight)
        let glass = CGPoint(x: piece.minX - 14, y: piece.midY)
        let notchPassed = await p.clickThrough(at: glass)
        let pieceBlocks = !(await p.clickThrough(at: CGPoint(x: piece.minX + 60, y: piece.midY)))
        check("N15_elMargenDejaPasarLosClics", notchPassed && pieceBlocks, ["margenPasa": notchPassed, "piezaLoRecibe": pieceBlocks])

        // N16: the bar is on every desktop (Space), full-screen ones included, like the face and the dock.
        let everySpace = Desktops.all()
        let notchSpaces = p.notch().map { Desktops.of(window: $0.number) } ?? []
        let dockSpaces = p.dock().map { Desktops.of(window: $0.number) } ?? []
        check("N16_enTodosLosEscritorios", !everySpace.isEmpty && Set(notchSpaces) == Set(everySpace) && Set(dockSpaces) == Set(everySpace),
              ["escritorios": everySpace.count, "notchEn": notchSpaces.count, "muelleEn": dockSpaces.count])
        p.send("clear")
        await p.glide(to: away, ms: 60)
        try? await Task.sleep(for: .milliseconds(400))

        // N17: with the voice open, the left of the notch is the pause button, and pressing it stops Ü.
        // Without a working voice credential (no balance), the same button is pressed with a task in
        // progress instead: the pause must work in both, and the detail says which one was measured.
        p.send("talk")
        var talking = await p.waitForDump(seconds: 8) { $0["liveConnected"] as? Bool == true }
        let withVoice = talking
        if !talking {
            p.send("clear"); p.send("busy:1"); p.send("begin:Trabajando en la prueba")
            talking = await p.waitForDump(seconds: 2) { $0["notchPhase"] as? String == "shown" }
        }
        try? await Task.sleep(for: .milliseconds(600))
        let pause = AXFinder(pid: p.pid).frame(label: "Pausar Ü")
        var paused = false, hidden = false
        if let pause, pause.width > 10 {
            await p.glide(to: CGPoint(x: pause.midX, y: pause.midY), ms: 150)
            p.post(.leftMouseDown, CGPoint(x: pause.midX, y: pause.midY)); try? await Task.sleep(for: .milliseconds(60))
            p.post(.leftMouseUp, CGPoint(x: pause.midX, y: pause.midY))
            paused = await p.waitForDump(seconds: 2) { $0["microphone"] as? Bool == false && $0["liveConnected"] as? Bool == false && $0["busy"] as? Bool == false }
            await p.glide(to: away, ms: 80)
            // Hanging up takes the notch away; stopping a task leaves "detenido a mano" said (promesa 259).
            hidden = withVoice ? await p.waitUntil(seconds: 1.5) { p.notch() == nil }
                               : (await p.dump())["notchState"] as? String == "skipped"
        } else if withVoice { p.send("talk") }
        p.send("busy:0"); p.send("clear")
        let inLeftThird = pause.map { $0.midX < rest.minX + NotchController.shadowSide + NotchLayout.compactWidth / 3 } ?? false
        check("N17_pausarDesdeLaIzquierdaDelNotch", talking && pause != nil && inLeftThird && paused && hidden,
              ["medidoCon": withVoice ? "la voz abierta" : "una tarea en curso (la voz no abrió: credencial sin saldo)", "botón": pause.map { p.describe($0) } ?? "no encontrado", "aLaIzquierda": inLeftThird, "seDetuvo": paused, "notchSeFue": hidden])
        try? await Task.sleep(for: .milliseconds(500))

        // ── The dock ─────────────────────────────────────────────────────────────────────────────
        guard let tab = p.dock()?.rect else { evidence["metrics"] = metrics; evidence["failures"] = failures + ["sin muelle"]; return }
        let tabCentre = CGPoint(x: tab.midX, y: tab.midY)
        // D1: the tab, 14 × 64, 10 points off the right edge and centred.
        check("D1_pestanaEnElBorde", abs(tab.width - 14) < 1 && abs(tab.height - 64) < 1 && abs(tab.maxX - (visible.maxX - 10)) <= 1 && abs(tab.midY - visible.midY) <= 1,
              ["pestana": p.describe(tab), "bordeDerecho": visible.maxX, "centro": visible.midY])

        // D2: the cursor on the tab unfolds it at once, and the tab does not move.
        await p.glide(to: CGPoint(x: tab.midX - 40, y: tab.midY), ms: 120)
        try? await Task.sleep(for: .milliseconds(200))
        let enteredAt = Date()
        p.move(to: tabCentre)
        let opening = await p.waitUntil(seconds: 1) { (p.dock()?.rect.width ?? 0) > 100 }
        let openLatency = opening ? Date().timeIntervalSince(enteredAt) : 99
        let open = p.dock()?.rect ?? .zero
        check("D2_cursorDespliega", openLatency <= 0.15 && abs(open.maxX - tab.maxX) <= 1 && abs(open.midY - tab.midY) <= 1,
              ["latenciaS": round2(openLatency), "abierto": p.describe(open)])
        try? await Task.sleep(for: .milliseconds(250))
        state = await p.dump()
        let bar = (state["dockBar"] as? [String: Double]).flatMap { CGRect(dictionaryRepresentation: $0 as CFDictionary) } ?? .zero

        // D3: the way from the tab to a button crosses glass and the edge: it must not fold.
        var folds = 0
        let button = CGPoint(x: bar.midX, y: bar.midY)
        for step in 1...25 {
            p.move(to: CGPoint(x: tabCentre.x + (button.x - tabCentre.x) * Double(step) / 25, y: tabCentre.y + (button.y - tabCentre.y) * Double(step) / 25))
            try? await Task.sleep(for: .milliseconds(16))
            if (p.dock()?.rect.width ?? 0) < 100 { folds += 1 }
        }
        let stay = await p.sample(seconds: 1.0) { p.dock() }
        folds += stay.filter { ($0.value?.rect.width ?? 0) < 100 }.count
        check("D3_caminoAlBotonNoLoPliega", folds == 0 && bar.width > 100, ["plegadosEnElCamino": folds, "barra": p.describe(bar)])

        // D9: unfolded, the glass left of the bar (where the status chip goes) lets clicks through.
        let dockNow = p.dock()?.rect ?? .zero
        let dockGlass = CGPoint(x: dockNow.minX + 40, y: bar.midY)
        let dockPassed = await p.clickThrough(at: dockGlass)
        check("D9_elMargenDelMuelleDejaPasarLosClics", dockPassed && dockNow.width > 100, ["margenPasa": dockPassed, "punto": ["x": dockGlass.x, "y": dockGlass.y]])
        p.move(to: button); try? await Task.sleep(for: .milliseconds(200))

        // D4: leaving folds it after the grace, never before.
        let leftDock = Date()
        p.move(to: away)
        let folded = await p.waitUntil(seconds: 1.5) { (p.dock()?.rect.width ?? 999) < 20 }
        let foldAfter = folded ? Date().timeIntervalSince(leftDock) : 99
        check("D4_seGraciaAntesDePlegar", foldAfter >= 0.33 && foldAfter <= 0.8, ["plegadoTrasS": round2(foldAfter), "graciaS": DockRule.grace])

        // D5: out and back inside the grace: it never folds.
        p.move(to: tabCentre); try? await Task.sleep(for: .milliseconds(300))
        p.move(to: away); try? await Task.sleep(for: .milliseconds(180))
        p.move(to: tabCentre)
        let back5 = await p.sample(seconds: 0.9) { p.dock() }
        let flicker = back5.filter { ($0.value?.rect.width ?? 0) < 100 }.count
        check("D5_volverDentroDeLaGracia", flicker == 0, ["plegados": flicker])

        // D6: the notch chat keeps it unfolded after the cursor leaves; closing it folds it.
        p.send("openChat")
        try? await Task.sleep(for: .milliseconds(200))
        p.move(to: away)
        try? await Task.sleep(for: .milliseconds(1200))
        let heldByChat = (p.dock()?.rect.width ?? 0) > 100
        p.send("closeChat")
        let closedAt = Date()
        let foldedAfterChat = await p.waitUntil(seconds: 1.5) { (p.dock()?.rect.width ?? 999) < 20 }
        let chatFoldAfter = foldedAfterChat ? Date().timeIntervalSince(closedAt) : 99
        check("D6_elChatLoSostiene", heldByChat && chatFoldAfter <= 0.9, ["sostenido": heldByChat, "plegadoTrasCerrarS": round2(chatFoldAfter)])
        p.send("clear")

        // D7: a burst over the tab ends where the cursor says.
        var dockMismatch: [String] = []
        for i in 0..<12 {
            p.move(to: i % 2 == 0 ? tabCentre : away)
            try? await Task.sleep(for: .milliseconds([40, 120, 70, 260, 90, 30][i % 6]))
        }
        p.move(to: away); try? await Task.sleep(for: .milliseconds(1000))
        if (p.dock()?.rect.width ?? 999) > 20 { dockMismatch.append("fuera pero desplegado") }
        p.move(to: tabCentre); try? await Task.sleep(for: .milliseconds(400))
        if (p.dock()?.rect.width ?? 0) < 100 { dockMismatch.append("encima pero plegado") }
        p.move(to: away); try? await Task.sleep(for: .milliseconds(1000))
        if (p.dock()?.rect.width ?? 999) > 20 { dockMismatch.append("fuera otra vez pero desplegado") }
        state = await p.dump()
        if state["dockUnfolded"] as? Bool != false { dockMismatch.append("el estado dice desplegado") }
        check("D7_rafagaSinTrabarse", dockMismatch.isEmpty, ["desajustes": dockMismatch])

        // D8: drop the face on the dock to put it away; pull it out and it stays where it is dropped.
        if let faceRect = p.face() {
            let grab = CGPoint(x: faceRect.midX, y: faceRect.midY)
            await p.glide(to: grab, ms: 100)
            try? await Task.sleep(for: .milliseconds(150))
            p.post(.leftMouseDown, grab)
            let target = CGPoint(x: tab.midX - 6, y: tab.midY)
            for step in 1...30 {
                p.post(.leftMouseDragged, CGPoint(x: grab.x + (target.x - grab.x) * Double(step) / 30, y: grab.y + (target.y - grab.y) * Double(step) / 30))
                try? await Task.sleep(for: .milliseconds(12))
            }
            try? await Task.sleep(for: .milliseconds(60))
            p.post(.leftMouseUp, target)
            try? await Task.sleep(for: .milliseconds(500))
            state = await p.dump()
            let stored = p.face() == nil && state["dockGuarding"] as? Bool == true
            // Unfold and pull it out of its seat.
            try? await Task.sleep(for: .milliseconds(400))
            state = await p.dump()
            let seatBar = (state["dockBar"] as? [String: Double]).flatMap { CGRect(dictionaryRepresentation: $0 as CFDictionary) } ?? .zero
            let seat = CGPoint(x: seatBar.midX, y: seatBar.minY + 23 + 2 + DockController.seat / 2)
            p.move(to: seat); try? await Task.sleep(for: .milliseconds(300))
            p.post(.leftMouseDown, seat)
            let drop = CGPoint(x: visible.midX + 150, y: visible.midY - 60)
            var underHand = 99.0
            for step in 1...30 {
                let hand = CGPoint(x: seat.x + (drop.x - seat.x) * Double(step) / 30, y: seat.y + (drop.y - seat.y) * Double(step) / 30)
                p.post(.leftMouseDragged, hand)
                try? await Task.sleep(for: .milliseconds(16))
                if step == 20, let f = p.face() {
                    try? await Task.sleep(for: .milliseconds(30))
                    let now = p.face() ?? f
                    underHand = hypot(now.midX - hand.x, now.midY - hand.y)
                }
            }
            p.post(.leftMouseUp, drop)
            try? await Task.sleep(for: .milliseconds(700))
            state = await p.dump()
            let out = p.face()
            let stayed = out.map { hypot($0.midX - drop.x, $0.midY - drop.y) <= 3 } == true
            check("D8_guardarYSacarLaCarita", stored && underHand <= 24 && stayed && state["dockGuarding"] as? Bool == false,
                  ["guardada": stored, "barraAlSacar": p.describe(seatBar), "distanciaAlCursorPx": round2(underHand), "sueltaEn": p.describe(out ?? .zero), "soltadaEnCursor": ["x": drop.x, "y": drop.y]])
            p.move(to: away); try? await Task.sleep(for: .milliseconds(800))
        } else {
            check("D8_guardarYSacarLaCarita", false, ["error": "no encontré la carita"])
        }

        evidence["metrics"] = metrics
        evidence["failures"] = failures
        // A person moving the mouse during the run makes it void, not failed: it is repeated.
        evidence["interferencia"] = p.interference
        evidence["origenDeLaInterferencia"] = p.foreignSources
        evidence["valida"] = p.interference.isEmpty
        evidence["score"] = "\(metrics.count - failures.count)/\(metrics.count)"
        evidence["passed"] = failures.isEmpty
    }

    private static func round2(_ x: Double) -> Double { (x * 100).rounded() / 100 }
}

@MainActor
final class WindowProbe {
    struct Window { let rect: CGRect; let alpha: Double; let sharing: Int; let layer: Int; let number: Int }
    struct Sample<T> { let t: Double; let value: T? }
    let pid: pid_t
    let source = CGEventSource(stateID: .hidSystemState)
    /// Where the probe last put the cursor. If the real cursor is elsewhere, a person moved it.
    private var expected: CGPoint?
    private var expectedAt = Date()
    private var strayed = 0
    private var watch: Timer?
    private(set) var interference: [String] = []
    private let began = Date()
    init(pid: pid_t) { self.pid = pid }

    private var tap: CFMachPort?
    /// Who else moved the mouse or typed: 0 is a person's hardware, any other pid is a program.
    private(set) var foreignSources: [String: Int] = [:]

    /// Listens (without blocking anything) to every mouse move, click and key, and counts the ones
    /// this probe did not post, by the process that posted them.
    private func tapForeignEvents() {
        let mask = (1 << CGEventType.mouseMoved.rawValue) | (1 << CGEventType.leftMouseDown.rawValue) | (1 << CGEventType.keyDown.rawValue) | (1 << CGEventType.leftMouseDragged.rawValue)
        let callback: CGEventTapCallBack = { _, type, event, info in
            guard let info, type.rawValue < 0x7fff_ffff else { return Unmanaged.passUnretained(event) }
            let probe = Unmanaged<WindowProbe>.fromOpaque(info).takeUnretainedValue()
            let source = event.getIntegerValueField(.eventSourceUnixProcessID)
            if source != Int64(getpid()) {
                let who = source == 0 ? "hardware (una persona)" : (NSRunningApplication(processIdentifier: pid_t(source))?.localizedName ?? "pid \(source)")
                MainThread.run { probe.foreignSources[who, default: 0] += 1 }
            }
            return Unmanaged.passUnretained(event)
        }
        tap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .tailAppendEventTap, options: .listenOnly,
                                eventsOfInterest: CGEventMask(mask), callback: callback, userInfo: Unmanaged.passUnretained(self).toOpaque())
        if let tap { CFRunLoopAddSource(CFRunLoopGetMain(), CFMachPortCreateRunLoopSource(nil, tap, 0), .commonModes); CGEvent.tapEnable(tap: tap, enable: true) }
    }

    /// Samples the real cursor every 20 ms against where the probe left it.
    func watchForPeople() {
        tapForeignEvents()
        watch = Timer.scheduledTimer(withTimeInterval: 0.02, repeats: true) { [weak self] _ in
            MainThread.run {
                // The probe's own events take a moment to land: only a lasting difference, well after
                // the probe's last move, is someone else's hand.
                guard let self else { return }
                guard let expected = self.expected, let now = CGEvent(source: nil)?.location,
                      Date().timeIntervalSince(self.expectedAt) > 0.08 else { self.strayed = 0; return }
                if hypot(now.x - expected.x, now.y - expected.y) > 1.5 { self.strayed += 1 } else { self.strayed = 0 }
                if self.strayed >= 3 {
                    self.interference.append("\((Date().timeIntervalSince(self.began) * 100).rounded() / 100)s: cursor en (\(Int(now.x)),\(Int(now.y))) y no en (\(Int(expected.x)),\(Int(expected.y)))")
                    self.expected = now; self.strayed = 0
                }
            }
        }
    }

    var screen: CGRect { Glass.screen }
    var visible: CGRect { Glass.visible }

    func windows() -> [Window] {
        guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] else { return [] }
        return list.compactMap { w in
            guard (w[kCGWindowOwnerPID as String] as? pid_t) == pid,
                  let bounds = w[kCGWindowBounds as String] as? [String: Double],
                  let rect = CGRect(dictionaryRepresentation: bounds as CFDictionary) else { return nil }
            return Window(rect: rect, alpha: w[kCGWindowAlpha as String] as? Double ?? 1,
                          sharing: w[kCGWindowSharingState as String] as? Int ?? 1, layer: w[kCGWindowLayer as String] as? Int ?? 0,
                          number: w[kCGWindowNumber as String] as? Int ?? 0)
        }
    }
    func notch() -> Window? {
        windows().first { (abs($0.rect.width - (NotchLayout.compactWidth + 48)) < 1 && abs($0.rect.height - (NotchLayout.compactHeight + 48)) < 1) || (abs($0.rect.width - 468) < 1 && abs($0.rect.height - 408) < 1) }
    }
    func dock() -> Window? {
        windows().first { (abs($0.rect.width - DockRule.tabWidth) < 1 && abs($0.rect.height - DockRule.tabHeight) < 1) || abs($0.rect.width - DockController.unfoldedWidth) < 1 }
    }
    func face() -> CGRect? {
        windows().first { abs($0.rect.width - VoiceHalo.panelSize) < 1 && abs($0.rect.height - VoiceHalo.panelSize) < 1 }?.rect
    }
    func describe(_ r: CGRect) -> [String: Double] { ["x": r.minX, "y": r.minY, "w": r.width, "h": r.height] }

    func post(_ type: CGEventType, _ point: CGPoint) {
        expected = point; expectedAt = Date(); strayed = 0
        CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: point, mouseButton: .left)?.post(tap: .cghidEventTap)
    }
    func move(to point: CGPoint) { post(.mouseMoved, point) }
    func glide(to point: CGPoint, ms: Int) async {
        let from = CGEvent(source: nil)?.location ?? point
        let steps = max(1, ms / 10)
        for i in 1...steps {
            move(to: CGPoint(x: from.x + (point.x - from.x) * Double(i) / Double(steps), y: from.y + (point.y - from.y) * Double(i) / Double(steps)))
            try? await Task.sleep(for: .milliseconds(10))
        }
    }

    /// Types like a person does: a key every ~80 ms, not a burst the window server may coalesce.
    func type(_ text: String) async {
        let codes: [Character: CGKeyCode] = ["h": 4, "o": 31, "l": 37, "a": 0]
        for c in text {
            guard let code = codes[c] else { continue }
            CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: true)?.post(tap: .cghidEventTap)
            try? await Task.sleep(for: .milliseconds(30))
            CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: false)?.post(tap: .cghidEventTap)
            try? await Task.sleep(for: .milliseconds(50))
        }
    }

    /// Puts the probe's own decoy window under `point` (below Ü's floating panels, above everyone
    /// else's windows), clicks there, and says whether the decoy got the click. No click ever lands on
    /// the user's apps.
    func clickThrough(at point: CGPoint, below level: Int = NSWindow.Level.floating.rawValue) async -> Bool {
        let decoy = NSPanel(contentRect: Glass.appKit(CGRect(x: point.x - 20, y: point.y - 20, width: 40, height: 40)), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        let catcher = ClickCatcher()
        decoy.contentView = catcher
        decoy.backgroundColor = NSColor.white.withAlphaComponent(0.02)
        decoy.isOpaque = false
        decoy.level = NSWindow.Level(rawValue: level - 1)
        decoy.orderFrontRegardless()
        try? await Task.sleep(for: .milliseconds(150))
        move(to: point); try? await Task.sleep(for: .milliseconds(60))
        post(.leftMouseDown, point); try? await Task.sleep(for: .milliseconds(40))
        post(.leftMouseUp, point); try? await Task.sleep(for: .milliseconds(150))
        decoy.orderOut(nil)
        return catcher.clicks > 0
    }

    /// One key by its code, pressed and released like a person does.
    func key(_ code: CGKeyCode) async {
        CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: true)?.post(tap: .cghidEventTap)
        try? await Task.sleep(for: .milliseconds(30))
        CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: false)?.post(tap: .cghidEventTap)
        try? await Task.sleep(for: .milliseconds(50))
    }

    /// Brings an app to the front the way accessibility clients do (AXFrontmost): since macOS 14 an
    /// app launched from the background cannot take the front by itself. True when it is in front.
    func bringToFront(_ pid: pid_t) async -> Bool {
        let app = AXUIElementCreateApplication(pid)
        for _ in 0..<20 {
            if NSWorkspace.shared.frontmostApplication?.processIdentifier == pid { return true }
            AXUIElementSetAttributeValue(app, kAXFrontmostAttribute as CFString, kCFBooleanTrue)
            try? await Task.sleep(for: .milliseconds(100))
        }
        return NSWorkspace.shared.frontmostApplication?.processIdentifier == pid
    }

    /// Every window under a point, front to back: owner, layer, size. For diagnosing clicks.
    func stack(at point: CGPoint) -> [String] {
        guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] else { return [] }
        return list.compactMap { w in
            guard let bounds = w[kCGWindowBounds as String] as? [String: Double],
                  let rect = CGRect(dictionaryRepresentation: bounds as CFDictionary), rect.contains(point) else { return nil }
            return "\(w[kCGWindowOwnerName as String] as? String ?? "?") capa=\(w[kCGWindowLayer as String] ?? 0) \(Int(rect.width))x\(Int(rect.height))"
        }.prefix(6).map { $0 }
    }

    /// The process owning the topmost ordinary window (layer 0) under a point. A probe clicks only
    /// where its own test window is on top, never on someone else's app.
    static func ownerOfTopWindow(at point: CGPoint) -> pid_t? {
        guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] else { return nil }
        for w in list where (w[kCGWindowLayer as String] as? Int) == 0 {
            guard let bounds = w[kCGWindowBounds as String] as? [String: Double],
                  let rect = CGRect(dictionaryRepresentation: bounds as CFDictionary), rect.contains(point) else { continue }
            return w[kCGWindowOwnerPID as String] as? pid_t
        }
        return nil
    }

    func waitForDump(seconds: Double, _ condition: ([String: Any]) -> Bool) async -> Bool {
        let began = Date()
        while Date().timeIntervalSince(began) < seconds {
            if condition(await dump()) { return true }
            try? await Task.sleep(for: .milliseconds(80))
        }
        return false
    }

    func send(_ command: String) {
        DistributedNotificationCenter.default().postNotificationName(NotchProbe.channel, object: command, userInfo: nil, deliverImmediately: true)
    }
    func dump() async -> [String: Any] {
        let file = FileManager.default.temporaryDirectory.appendingPathComponent("u-notch-dump-\(UUID().uuidString).json")
        send("dump:" + file.path)
        for _ in 0..<40 {
            try? await Task.sleep(for: .milliseconds(25))
            if let data = try? Data(contentsOf: file), let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                try? FileManager.default.removeItem(at: file)
                return json
            }
        }
        return [:]
    }

    func sample<T>(seconds: Double, _ read: () -> T?) async -> [Sample<T>] {
        let began = Date()
        var out: [Sample<T>] = []
        while Date().timeIntervalSince(began) < seconds {
            out.append(Sample(t: Date().timeIntervalSince(began), value: read()))
            try? await Task.sleep(for: .milliseconds(6))
        }
        return out
    }
    func waitUntil(seconds: Double, _ condition: () -> Bool) async -> Bool {
        let began = Date()
        while Date().timeIntervalSince(began) < seconds {
            if condition() { return true }
            try? await Task.sleep(for: .milliseconds(6))
        }
        return false
    }
}

private final class ClickCatcher: NSView {
    var clicks = 0
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override func mouseDown(with event: NSEvent) { clicks += 1 }
}

@_silgen_name("CGSMainConnectionID") private func CGSMainConnectionID() -> Int32
@_silgen_name("CGSCopySpacesForWindows") private func CGSCopySpacesForWindows(_ connection: Int32, _ mask: Int32, _ windows: CFArray) -> CFArray?
@_silgen_name("CGSCopyManagedDisplaySpaces") private func CGSCopyManagedDisplaySpaces(_ connection: Int32) -> CFArray?

/// The desktops (Spaces) of this Mac and the ones a window is on, as the window server sees them.
/// Only the probe asks: the app itself just declares that its panels join every Space.
enum Desktops {
    static func all() -> [Int] {
        (CGSCopyManagedDisplaySpaces(CGSMainConnectionID()) as? [[String: Any]] ?? [])
            .flatMap { ($0["Spaces"] as? [[String: Any]] ?? []).compactMap { $0["ManagedSpaceID"] as? Int } }
    }
    static func of(window number: Int) -> [Int] {
        CGSCopySpacesForWindows(CGSMainConnectionID(), 7, [number] as CFArray) as? [Int] ?? []
    }
}
