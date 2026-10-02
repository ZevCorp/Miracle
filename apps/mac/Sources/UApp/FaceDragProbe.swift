import AppKit
import UCore

/// Drives the RUNNING Ü's face with real mouse and trackpad events (CGEvent at the HID level, the same
/// path a physical mouse takes) and measures where its window goes. Moves the real cursor for ~20 s.
@MainActor
enum FaceDragProbe {
    static func run(output: URL) async {
        var evidence: [String: Any] = ["date": ISO8601DateFormatter().string(from: Date()), "passed": false]
        let savedCursor = CGEvent(source: nil)?.location ?? .zero
        defer {
            CGWarpMouseCursorPosition(savedCursor)
            if let data = try? JSONSerialization.data(withJSONObject: evidence, options: [.prettyPrinted, .sortedKeys]) { try? data.write(to: output, options: .atomic) }
            NSApp.terminate(nil)
        }
        guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: "com.zevcorp.u.mac").first(where: { $0.processIdentifier != getpid() }) else {
            evidence["error"] = "Ü no está abierta."; return
        }
        let probe = Probe(pid: app.processIdentifier)
        for _ in 0..<50 where probe.face() == nil { try? await Task.sleep(for: .milliseconds(100)) }
        guard let start = probe.face() else { evidence["error"] = "No encontré la ventana de la carita."; return }
        evidence["start"] = probe.describe(start)
        var metrics: [String: Any] = [:], failures: [String] = []
        func check(_ name: String, _ ok: Bool, _ detail: [String: Any]) {
            metrics[name] = detail.merging(["ok": ok]) { $1 }
            if !ok { failures.append(name) }
        }

        // M1 + M2: a calm drag follows the cursor; releasing goes to the nearest side edge.
        var face = start
        let work = probe.workArea(for: face)
        let inward = face.midX > work.midX ? -1.0 : 1.0
        let grab = CGPoint(x: face.midX, y: face.midY)
        let offset = CGPoint(x: face.minX - grab.x, y: face.minY - grab.y)
        let rise = face.midY > work.midY ? -1.0 : 1.0
        let path = CGPoint(x: 260 * inward, y: 120 * rise)
        probe.move(to: grab); try? await Task.sleep(for: .milliseconds(150))
        let cursor = CGEvent(source: nil)?.location ?? .zero
        evidence["cursorLlegoALaCarita"] = hypot(cursor.x - grab.x, cursor.y - grab.y) < 2
        evidence["ventanaBajoElCursor"] = probe.windowOwner(at: grab)
        probe.post(.leftMouseDown, grab)
        var worst = 0.0, instant = 0.0
        for step in 1...40 {
            let p = CGPoint(x: grab.x + path.x * Double(step) / 40, y: grab.y + path.y * Double(step) / 40)
            probe.post(.leftMouseDragged, p)
            try? await Task.sleep(for: .milliseconds(20))
            if step % 5 == 0 {
                if let now = probe.face() { instant = max(instant, hypot(now.minX - (p.x + offset.x), now.minY - (p.y + offset.y))) }
                // What the eye sees: the face once the app has handled this move.
                try? await Task.sleep(for: .milliseconds(25))
                if let now = probe.face() { worst = max(worst, hypot(now.minX - (p.x + offset.x), now.minY - (p.y + offset.y))) }
            }
        }
        try? await Task.sleep(for: .milliseconds(40))
        let released = probe.face() ?? face
        check("M1_arrastreSigueAlCursor", worst <= 3, ["maxDesviacionPx": worst.rounded(), "retrasoInstantaneoPx": instant.rounded()])
        probe.post(.leftMouseUp, CGPoint(x: grab.x + path.x, y: grab.y + path.y))
        var trip = await probe.settle()
        face = trip.last ?? released
        let nearestRight = released.midX >= work.midX
        let edgeX = nearestRight ? work.maxX - face.width : work.minX
        check("M2_soltarVaAlBordeCercano", abs(face.minX - edgeX) <= 1 && abs(face.minY - released.minY) <= 60,
              ["x": face.minX, "bordeEsperado": edgeX, "alturaSoltada": released.minY, "alturaFinal": face.minY])
        check("M8_dentroTrasSoltar", probe.inside(face), probe.describe(face))

        // M3 + M5: a hard horizontal throw crosses to the other side, travelling like a thrown object.
        func throwAcross(_ name: String) async -> Bool {
            let before = probe.face() ?? face
            let area = probe.workArea(for: before)
            let direction = before.midX > area.midX ? -1.0 : 1.0
            let hand = CGPoint(x: before.midX, y: before.midY)
            probe.move(to: hand); try? await Task.sleep(for: .milliseconds(120))
            probe.post(.leftMouseDown, hand)
            for step in 1...8 {
                probe.post(.leftMouseDragged, CGPoint(x: hand.x + direction * 30 * Double(step), y: hand.y))
                try? await Task.sleep(for: .milliseconds(8))
            }
            let letGo = probe.face() ?? before
            probe.post(.leftMouseUp, CGPoint(x: hand.x + direction * 240, y: hand.y))
            let released = Date()
            trip = await probe.settle()
            let seconds = probe.lastMotion.timeIntervalSince(released)
            guard let end = trip.last else { return false }
            let target = direction > 0 ? area.maxX - end.width : area.minX
            let distance = abs(target - letGo.minX)
            var jump = 0.0
            for (a, b) in zip(trip, trip.dropFirst()) { jump = max(jump, hypot(b.minX - a.minX, b.minY - a.minY)) }
            let crossed = abs(end.minX - target) <= 1
            check(name, crossed, ["x": end.minX, "bordeContrario": target])
            check(name + "_viaje", seconds >= 0.25 && seconds <= 1.4 && jump <= max(distance * 0.35, 40) && crossed,
                  ["duracionS": (seconds * 100).rounded() / 100, "mayorSaltoPx": jump.rounded(), "recorridoPx": distance.rounded(), "muestras": trip.count])
            check("M8_dentroTras" + name, probe.inside(end), probe.describe(end))
            return crossed
        }
        _ = await throwAcross("M3_lanzamientoCruza")
        _ = await throwAcross("M4_lanzamientoDeVuelta")

        // M6: the same vertical gesture, weak and strong: force decides how far the height travels.
        func verticalThrow(stepMs: Int) async -> (dy: Double, sameSide: Bool) {
            let before = probe.face() ?? face
            let area = probe.workArea(for: before)
            let down = before.midY < area.midY ? 1.0 : -1.0
            let hand = CGPoint(x: before.midX, y: before.midY)
            probe.move(to: hand); try? await Task.sleep(for: .milliseconds(120))
            probe.post(.leftMouseDown, hand)
            for step in 1...6 {
                probe.post(.leftMouseDragged, CGPoint(x: hand.x, y: hand.y + down * 8 * Double(step)))
                try? await Task.sleep(for: .milliseconds(stepMs))
            }
            let letGo = probe.face() ?? before
            probe.post(.leftMouseUp, CGPoint(x: hand.x, y: hand.y + down * 48))
            let end = (await probe.settle()).last ?? letGo
            return (abs(end.minY - letGo.minY), (end.midX > area.midX) == (before.midX > area.midX))
        }
        let weak = await verticalThrow(stepMs: 40)
        // Bring it back so the strong throw has the same room to travel.
        let strong = await verticalThrow(stepMs: 3)
        check("M6_fuerzaDecideAltura", strong.dy > weak.dy + 40 && weak.sameSide && strong.sameSide,
              ["recorridoFlojoPx": weak.dy.rounded(), "recorridoFuertePx": strong.dy.rounded()])

        // M7: two fingers. The face moves with the fingers, then a fast push throws it to the side
        // it was heading to.
        let before = probe.face() ?? face
        let area = probe.workArea(for: before)
        let inside = before.midX > area.midX ? -1.0 : 1.0
        let hand = CGPoint(x: before.midX, y: before.midY)
        probe.move(to: hand); try? await Task.sleep(for: .milliseconds(150))
        let sign = probe.scrollSign()
        probe.scroll(phase: 1, dx: 0, dy: 0)
        var follow: [Double] = []
        for step in 1...24 {
            probe.scroll(phase: 2, dx: inside * 14 * sign, dy: 0)
            try? await Task.sleep(for: .milliseconds(10))
            if step % 6 == 0, let now = probe.face() { follow.append(now.minX - before.minX) }
        }
        probe.scroll(phase: 4, dx: 0, dy: 0)
        let end = (await probe.settle()).last ?? before
        let movedWithFingers = follow.count == 4 && zip(follow, follow.dropFirst()).allSatisfy { inside * ($1 - $0) > 20 }
        let target = inside > 0 ? area.maxX - end.width : area.minX
        check("M7_dosDedosSigueYLanza", movedWithFingers && abs(end.minX - target) <= 1,
              ["desplazamientoDuranteGestoPx": follow.map { $0.rounded() }, "x": end.minX, "bordeEsperado": target])
        check("M8_dentroTrasDosDedos", probe.inside(end), probe.describe(end))

        evidence["metrics"] = metrics
        evidence["failures"] = failures
        evidence["passed"] = failures.isEmpty
    }
}

@MainActor
private final class Probe {
    let pid: pid_t
    let source = CGEventSource(stateID: .hidSystemState)
    var lastMotion = Date()
    init(pid: pid_t) { self.pid = pid }

    /// The face window of the running app, in global y-down coordinates.
    func face() -> CGRect? {
        guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] else { return nil }
        for window in list where (window[kCGWindowOwnerPID as String] as? pid_t) == pid {
            guard let bounds = window[kCGWindowBounds as String] as? [String: Double],
                  let rect = CGRect(dictionaryRepresentation: bounds as CFDictionary) else { continue }
            if abs(rect.width - VoiceHalo.panelSize) < 1, abs(rect.height - VoiceHalo.panelSize) < 1 { return rect }
        }
        return nil
    }
    func workArea(for rect: CGRect) -> CGRect {
        let top = NSScreen.screens.first?.frame.maxY ?? 0
        let center = NSPoint(x: rect.midX, y: top - rect.midY)
        let screen = NSScreen.screens.first { $0.frame.contains(center) } ?? NSScreen.main ?? NSScreen.screens[0]
        let v = screen.visibleFrame
        return CGRect(x: v.minX, y: top - v.maxY, width: v.width, height: v.height)
    }
    /// Which app owns the topmost window under a point, and its layer.
    func windowOwner(at point: CGPoint) -> String {
        guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] else { return "?" }
        for window in list {
            guard let bounds = window[kCGWindowBounds as String] as? [String: Double],
                  let rect = CGRect(dictionaryRepresentation: bounds as CFDictionary), rect.contains(point) else { continue }
            let owner = window[kCGWindowOwnerName as String] as? String ?? "?"
            return "\(owner) pid=\(window[kCGWindowOwnerPID as String] ?? 0) layer=\(window[kCGWindowLayer as String] ?? 0) \(Int(rect.width))x\(Int(rect.height))"
        }
        return "ninguna"
    }
    func inside(_ rect: CGRect) -> Bool { workArea(for: rect).insetBy(dx: -1, dy: -1).contains(rect) }
    func describe(_ rect: CGRect) -> [String: Double] { ["x": rect.minX, "y": rect.minY, "w": rect.width] }

    func post(_ type: CGEventType, _ point: CGPoint) {
        CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: point, mouseButton: .left)?.post(tap: .cghidEventTap)
    }
    func move(to point: CGPoint) { post(.mouseMoved, point) }

    /// How the app will read a synthetic scroll (natural scrolling or not), so the push goes inward.
    func scrollSign() -> Double {
        guard let event = makeScroll(phase: 2, dx: 1, dy: 0), let ns = NSEvent(cgEvent: event) else { return 1 }
        return ns.isDirectionInvertedFromDevice ? 1 : -1
    }
    private func makeScroll(phase: Int64, dx: Double, dy: Double) -> CGEvent? {
        guard let event = CGEvent(scrollWheelEvent2Source: source, units: .pixel, wheelCount: 2, wheel1: Int32(dy), wheel2: Int32(dx), wheel3: 0) else { return nil }
        event.setIntegerValueField(.scrollWheelEventIsContinuous, value: 1)
        event.setIntegerValueField(.scrollWheelEventScrollPhase, value: phase)
        event.setDoubleValueField(.scrollWheelEventPointDeltaAxis1, value: dy)
        event.setDoubleValueField(.scrollWheelEventPointDeltaAxis2, value: dx)
        return event
    }
    func scroll(phase: Int64, dx: Double, dy: Double) { makeScroll(phase: phase, dx: dx, dy: dy)?.post(tap: .cghidEventTap) }

    /// Samples the face until it stops moving (150 ms still, 2.5 s at most). Returns the trip.
    func settle() async -> [CGRect] {
        var trip: [CGRect] = []
        var still = Date(), began = Date()
        lastMotion = Date()
        while Date().timeIntervalSince(began) < 2.5 {
            if let now = face() {
                if let last = trip.last, abs(last.minX - now.minX) > 0.5 || abs(last.minY - now.minY) > 0.5 { still = Date(); lastMotion = Date() }
                trip.append(now)
            }
            if Date().timeIntervalSince(still) > 0.15 && trip.count > 3 { break }
            try? await Task.sleep(for: .milliseconds(8))
        }
        return trip
    }
}
