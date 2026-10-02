import AppKit
import UCore
import UMac

/// The big cycle against the real models, without a microphone: Live 1 decides to hand over,
/// Sol plans, and Live comes back to tell what was done. Room audio is synthetic.
@MainActor
enum CycleProbe {
    struct LiveRun { var started = false, calls: [String] = [], audibleMs = 0, transcript = "", error: String?, events: [String: Int] = [:]
        var summary: [String: Any] { ["started": started, "calls": calls, "audibleMs": audibleMs, "said": transcript, "error": error ?? NSNull(), "events": events] } }

    /// One Live session: optional room audio, then optional internal messages, observed for `listen` seconds.
    static func live(key: String, context: String? = nil, pcm: Data = Data(), message: String?, listen: Double = 25) async -> LiveRun {
        var run = LiveRun()
        let internalMessage = message
        let session = URLSession(configuration: .ephemeral)
        var request = URLRequest(url: URL(string: "wss://api.openai.com/v1/live/sessions")!)
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        let socket = session.webSocketTask(with: request); socket.resume()
        defer { socket.cancel(with: .normalClosure, reason: nil); session.invalidateAndCancel() }
        func send(_ event: [String: Any]) async throws {
            try await socket.send(.string(String(decoding: JSONSerialization.data(withJSONObject: event), as: UTF8.self)))
        }
        var sender: Task<Void, Error>?
        let deadline = Task { try await Task.sleep(for: .seconds(listen)); socket.cancel(with: .normalClosure, reason: nil) }
        defer { deadline.cancel(); sender?.cancel() }
        do {
            try await send(LiveProtocol.start())
            while true {
                let message = try await socket.receive()
                let data: Data
                switch message { case .data(let d): data = d; case .string(let s): data = Data(s.utf8); @unknown default: continue }
                guard let event = try JSONSerialization.jsonObject(with: data) as? [String: Any], let type = event["type"] as? String else { continue }
                let nestedType = (event["event"] as? [String: Any])?["type"] as? String
                run.events[nestedType.map { type + ":" + $0 } ?? type, default: 0] += 1
                if type == "error" { run.error = (event["error"] as? [String: Any])?["code"] as? String ?? "unknown" }
                if type == "session.started" {
                    run.started = true
                    if let context { try await send(LiveProtocol.taskContext(context)) }
                    sender = Task {
                        // Room audio at real time, a second of quiet, then the internal message the app sends.
                        let input = pcm + Data(count: 48_000)
                        for offset in stride(from: 0, to: input.count, by: 4_800) {
                            try Task.checkCancellation()
                            try await send(["type": "session.input_audio.append", "audio": input.subdata(in: offset..<min(offset + 4_800, input.count)).base64EncodedString()])
                            try await Task.sleep(for: .milliseconds(100))
                        }
                        guard let internalMessage else { return }
                        try await send(LiveProtocol.taskContext(internalMessage))
                        try await send(["type": "response.item.create", "item": ["type": "message", "role": "developer", "content": [["type": "input_text", "text": internalMessage]]]])
                        try await send(["type": "response.create"])
                    }
                }
                if type == "session.output_audio.delta", let encoded = event["delta"] as? String, let audio = Data(base64Encoded: encoded),
                   try LiveAudioChunk(audio).level > 0.001 { run.audibleMs += audio.count / 48 }
                if type == "session.output_transcript.delta", let delta = event["delta"] as? String { run.transcript += delta }
                if let nested = event["event"] as? [String: Any], let call = LiveProtocol.call(in: nested) {
                    run.calls.append(call.name)
                    try await send(LiveProtocol.output(call: call.id, text: call.name == "escucha_pasiva" ? "Escucha pasiva activada." : "Hecho."))
                    if call.name == "escucha_pasiva" { return run }
                }
            }
        } catch { if run.error == nil, !deadline.isCancelled, (error as NSError).code != 57 { run.error = error.localizedDescription } }
        return run
    }

    static func run(directory: URL, output: URL) async {
        var evidence: [String: Any] = ["date": ISO8601DateFormatter().string(from: Date()), "sol": SolProtocol.model]
        defer { ListenProbe.write(evidence, to: output); NSApp.terminate(nil) }
        do {
            let keys = try await ListenProbe.keys()
            let manifest = try JSONSerialization.jsonObject(with: Data(contentsOf: directory.appendingPathComponent("manifest.json"))) as? [[String: String]] ?? []
            func audio(_ expect: String, _ count: Int) throws -> Data {
                try manifest.filter { $0["expect"] == expect }.prefix(count).reduce(Data()) { room, entry in
                    room + (try ListenProbe.pcm24k(directory.appendingPathComponent(entry["file"]!))) + Data(count: 24_000)
                }
            }
            // 1. People talk among themselves near the Mac: Live should hand over, silently.
            let background = await live(key: keys.openai, pcm: try audio("nada", 4), message: LiveProtocol.passiveCheck)
            evidence["handoverWithBackgroundTalk"] = background.summary.merging(["passed": background.calls.contains("escucha_pasiva"), "note": "la app silencia a Live mientras decide (LiveVoice.muted); audibleMs es lo que habría sonado"]) { $1 }
            // 2. Live just asked something and waits for the answer: it should stay.
            let waiting = await live(key: keys.openai, context: "Hace un momento le preguntaste a la persona si quiere que le envíes el resumen de la reunión por correo. Te dijo «déjame pensarlo un segundo» y todavía no responde.",
                                     message: LiveProtocol.passiveCheck, listen: 20)
            evidence["staysWhileWaitingForAnswer"] = waiting.summary.merging(["passed": waiting.started && !waiting.calls.contains("escucha_pasiva")]) { $1 }
            // 3. Sol finished a task started from passive listening: Live tells it.
            let told = await live(key: keys.openai, message: LiveProtocol.resumeAfterTask(request: "Yu, abre Safari y busca vuelos a Medellín", outcome: "Safari quedó al frente con la búsqueda «vuelos a Medellín» en Google; se ven los resultados.", ok: true), listen: 20)
            evidence["liveTellsTheResult"] = told.summary.merging(["passed": told.audibleMs > 500 && (told.transcript.localizedCaseInsensitiveContains("Medellín") || told.transcript.localizedCaseInsensitiveContains("Safari")) && told.calls.isEmpty]) { $1 }
            // 4. Sol plans for real; the desktop is simulated so a locked screen cannot fake a failure.
            final class Trace: @unchecked Sendable { var calls: [String] = []; var first: Double? }
            let trace = Trace(), started = ContinuousClock.now
            let outcome: SolPlanner.Outcome
            do { outcome = try await SolPlanner(key: keys.openai).run(goal: "Yu, abre Safari y busca vuelos a Medellín") { name, args in
                if trace.first == nil { let e = started.duration(to: .now); trace.first = Double(e.components.seconds) * 1000 + Double(e.components.attoseconds) / 1e15 }
                trace.calls.append(name + " " + (args.values.sorted().joined(separator: " | ")))
                switch name {
                case "launch_app": return "Safari abierto y al frente."
                case "read_screen": return "App: Safari. Controles: 1) Barra de direcciones (AXTextField) 2) Atrás (AXButton). Página: Google, campo Buscar (AXTextField)."
                case "open_url": return "Abierto \(args["url"] ?? "") en Safari."
                default: return "Hecho."
                }
            } } catch { outcome = SolPlanner.Outcome(text: "error: " + error.localizedDescription, ok: false, turns: 0) }
            let total = started.duration(to: .now)
            evidence["solPlans"] = ["passed": outcome.ok && (trace.calls.first?.hasPrefix("launch_app") == true || trace.calls.contains { $0.hasPrefix("open_url") }),
                                    "calls": trace.calls, "text": outcome.text, "turns": outcome.turns,
                                    "firstToolMs": trace.first ?? -1, "totalMs": Double(total.components.seconds) * 1000 + Double(total.components.attoseconds) / 1e15]
            evidence["passed"] = ["handoverWithBackgroundTalk", "staysWhileWaitingForAnswer", "liveTellsTheResult", "solPlans"]
                .allSatisfy { (evidence[$0] as? [String: Any])?["passed"] as? Bool == true }
        } catch { evidence["error"] = error.localizedDescription }
    }
}
