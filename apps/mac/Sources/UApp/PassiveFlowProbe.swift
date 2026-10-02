import AppKit
import UCore
import UMac

/// The whole cycle through the real AppModel: Live 1 (real microphone, quiet room) decides to hand
/// over, recorded phrases reach Soniox in place of the microphone, Jev routes them, Sol and Jev
/// operate the Mac, and Live comes back. Opens Calculator; nothing else is touched.
@MainActor
enum PassiveFlowProbe {
    static func run(output: URL) async {
        var evidence: [String: Any] = ["date": ISO8601DateFormatter().string(from: Date()), "passed": false]
        var events: [[String: Any]] = [], steps: [[String: Any]] = []
        let started = Date()
        let model = AppModel(persistConversation: false)
        let calculator = "com.apple.calculator"
        let wasRunning = !NSRunningApplication.runningApplications(withBundleIdentifier: calculator).isEmpty
        func save() {
            evidence["events"] = events; evidence["steps"] = steps
            evidence["chat"] = model.messages.suffix(12).map { ($0.user ? "persona: " : "Ü: ") + String($0.text.prefix(160)) }
            ListenProbe.write(evidence, to: output)
        }
        defer {
            model.stop(reason: "fin de la prueba")
            if !wasRunning { NSRunningApplication.runningApplications(withBundleIdentifier: calculator).forEach { $0.terminate() } }
            save(); NSApp.terminate(nil)
        }
        model.onTrace = { event, detail in
            events.append(["t": (Date().timeIntervalSince(started) * 10).rounded() / 10, "event": event, "detail": detail])
        }
        func wait(_ event: String, containing: String = "", after index: Int, seconds: Double) async -> Bool {
            let deadline = Date().addingTimeInterval(seconds)
            while Date() < deadline {
                if events.dropFirst(index).contains(where: { $0["event"] as? String == event && (containing.isEmpty || ($0["detail"] as? String ?? "").contains(containing)) }) { return true }
                try? await Task.sleep(for: .milliseconds(200))
            }
            return false
        }
        func step(_ name: String, _ ok: Bool) -> Bool { steps.append(["step": name, "ok": ok, "t": Int(Date().timeIntervalSince(started))]); save(); return ok }
        do {
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent("u-passive-flow-\(UUID().uuidString)")
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            defer { try? FileManager.default.removeItem(at: directory) }
            func speech(_ text: String, _ name: String) throws -> Data {
                let file = directory.appendingPathComponent(name + ".aiff"), say = Process()
                say.executableURL = URL(fileURLWithPath: "/usr/bin/say"); say.arguments = ["-v", "Paulina", "-o", file.path, text]
                try say.run(); say.waitUntilExit()
                return try ListenProbe.pcm24k(file)
            }
            let other = try speech("Mañana te llamo, mami.", "nada")
            let call = try speech("Hola Yu, ¿me escuchas?", "hablar")
            let order = try speech("Yu, abre la calculadora.", "ejecutar")
            // The "microphone" while passive: silence at real time, with a phrase when one is queued.
            final class Room: @unchecked Sendable { var queued = Data(); var feeder: Task<Void, Never>? }
            let room = Room()
            model.passiveFeed = {
                let (stream, continuation) = AsyncStream<Data>.makeStream()
                room.feeder?.cancel()
                room.feeder = Task { @MainActor in
                    let frame = 24_000 * 2 / 25
                    while !Task.isCancelled {
                        if room.queued.isEmpty { continuation.yield(Data(count: frame)) }
                        else { continuation.yield(room.queued.prefix(frame)); room.queued = room.queued.dropFirst(frame) }
                        try? await Task.sleep(for: .milliseconds(40))
                    }
                    continuation.finish()
                }
                return stream
            }
            evidence["microphone"] = model.permissions.snapshot.microphone == .granted
            evidence["accessibility"] = model.permissions.snapshot.canControlComputer
            InteractionTimer.quiet = 15
            // 1. Tap the face: Live 1.
            model.toggleMicrophone()
            guard step("Live 1 conecta", await wait("live.connected", after: 0, seconds: 40)) else { evidence["status"] = model.status; return }
            // 2. Quiet stretch: Live is asked and hands over (it may stay once; it is asked again).
            guard step("tras el silencio, Live decide y Soniox ⇄ Jev escuchan", await wait("passive.listening", after: 0, seconds: 150)) else { return }
            evidence["timesLiveStayed"] = events.filter { $0["event"] as? String == "live.stayed" }.count
            // 3. Talk among others: nothing happens.
            var mark = events.count
            room.queued = other + Data(count: 48_000)
            _ = step("charla ajena: Jev la oye", await wait("jev.cycle", after: mark, seconds: 12))
            _ = step("charla ajena: no activa nada", !(await wait("passive.route", after: mark, seconds: 3)))
            // 4. A call: Live comes back and answers.
            mark = events.count
            room.queued = call + Data(count: 48_000)
            guard step("«Hola Yu»: Jev activa Live 1", await wait("passive.route", containing: "action=hablar", after: mark, seconds: 12)) else { return }
            guard step("Live 1 de vuelta", await wait("live.connected", containing: "resume", after: mark, seconds: 30)) else { return }
            let before = model.messages.count
            for _ in 0..<60 { if model.messages.dropFirst(before).contains(where: { !$0.user }) { break }; try await Task.sleep(for: .milliseconds(250)) }
            _ = step("Live 1 responde al llamado", model.messages.dropFirst(before).contains { !$0.user })
            // 5. Quiet again: back to passive.
            mark = events.count
            guard step("otra vez en silencio: vuelve a escucha pasiva", await wait("passive.listening", after: mark, seconds: 180)) else { return }
            // 6. An order: Sol plans, Jev and AX operate, Live tells the result.
            mark = events.count
            room.queued = order + Data(count: 48_000)
            guard step("«abre la calculadora»: Jev activa Computer Use", await wait("passive.route", containing: "action=ejecutar", after: mark, seconds: 12)) else { return }
            guard step("Sol 6.1 empieza a planear", await wait("sol.start", after: mark, seconds: 5)) else { return }
            guard step("Sol termina la tarea", await wait("sol.end", containing: "ok=true", after: mark, seconds: 120)) else { return }
            _ = step("la Calculadora quedó abierta", !NSRunningApplication.runningApplications(withBundleIdentifier: calculator).isEmpty)
            guard step("Live 1 vuelve a contarlo", await wait("live.connected", containing: "resume", after: mark, seconds: 30)) else { return }
            let told = model.messages.count
            for _ in 0..<80 { if model.messages.dropFirst(told).contains(where: { !$0.user }) { break }; try await Task.sleep(for: .milliseconds(250)) }
            _ = step("Live 1 cuenta el resultado", model.messages.dropFirst(told).contains { !$0.user })
            let cycles = events.filter { $0["event"] as? String == "jev.cycle" }.compactMap { event -> Double? in
                (event["detail"] as? String)?.split(separator: " ").first { $0.hasPrefix("ms=") }.flatMap { Double($0.dropFirst(3)) }
            }
            evidence["cycleMs"] = cycles
            evidence["passed"] = steps.allSatisfy { $0["ok"] as? Bool == true }
        } catch { evidence["error"] = error.localizedDescription }
    }
}
