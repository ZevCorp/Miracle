import AppKit
import AVFoundation
import UCore
import UMac

/// Bounded synthetic-audio evaluation. Never opens a microphone or executes a tool.
@MainActor
enum SocialVoiceProbe {
    static func run(directory: URL) async {
        var results: [[String: Any]] = []
        defer {
            let report: [String: Any] = ["microphoneOpened": false, "results": results,
                "passed": results.count == 5 && results.allSatisfy { $0["passed"] as? Bool == true }]
            if let data = try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]) {
                try? data.write(to: directory.appendingPathComponent("results.json"), options: .atomic)
            }
            NSApp.terminate(nil)
        }
        do {
            let key = try await Credentials.readChecked("OPENAI_API_KEY") ?? ""
            for (name, expectsReply) in [("direct", true), ("other", false), ("other_unseen", false), ("shared", true), ("video", false)] {
                let file = try AVAudioFile(forReading: directory.appendingPathComponent(name + ".aiff"))
                guard let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)) else { throw AgentError.invalid("Fixture inválida") }
                try file.read(into: buffer)
                let pcm = try PCMEncoder(source: file.processingFormat).encode(buffer)
                results.append(try await check(key: key, pcm: pcm, name: name, expectsReply: expectsReply))
            }
        } catch { results.append(["passed": false, "error": error.localizedDescription]) }
    }

    private static func check(key: String, pcm: Data, name: String, expectsReply: Bool) async throws -> [String: Any] {
        let session = URLSession(configuration: .ephemeral)
        var request = URLRequest(url: URL(string: "wss://api.openai.com/v1/live/sessions")!)
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        let socket = session.webSocketTask(with: request); socket.resume()
        defer { socket.cancel(with: .normalClosure, reason: nil); session.invalidateAndCancel() }
        func send(_ event: [String: Any]) async throws {
            try await socket.send(.string(String(decoding: JSONSerialization.data(withJSONObject: event), as: UTF8.self)))
        }
        var sender: Task<Void, Error>?
        let timeout = Task { try await Task.sleep(for: .seconds(30)); socket.cancel(with: .goingAway, reason: nil) }
        defer { timeout.cancel(); sender?.cancel() }
        var observationFinished = false, started = false, audibleBytes = 0, calls = 0, transcript = ""
        try await send(LiveProtocol.start())
        do {
            while true {
                let message = try await socket.receive()
                let data: Data
                switch message { case .data(let d): data = d; case .string(let s): data = Data(s.utf8); @unknown default: continue }
                guard let event = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { continue }
                let type = event["type"] as? String
                if type == "error" { throw AgentError.unavailable(LiveProtocol.errorMessage(code: (event["error"] as? [String: Any])?["code"] as? String ?? "unknown")) }
                if type == "session.started" {
                    started = true
                    if name == "video" || name == "direct" {
                        try await send(LiveProtocol.taskContext("Escenario de prueba: el usuario pidió ver un video sin comentarios. El video ya se está reproduciendo."))
                    }
                    sender = Task {
                        let input = pcm + Data(repeating: 0, count: 48000 * 10)
                        for offset in stride(from: 0, to: input.count, by: 4800) {
                            try Task.checkCancellation()
                            try await send(["type": "session.input_audio.append", "audio": input.subdata(in: offset..<min(offset + 4800, input.count)).base64EncodedString()])
                            try await Task.sleep(for: .milliseconds(100))
                        }
                        observationFinished = true
                        socket.cancel(with: .normalClosure, reason: nil)
                    }
                }
                if type == "session.output_audio.delta", let encoded = event["delta"] as? String, let audio = Data(base64Encoded: encoded), try LiveAudioChunk(audio).level > 0.001 { audibleBytes += audio.count }
                if type == "session.output_transcript.delta", let delta = event["delta"] as? String { transcript += delta }
                if let nested = event["event"] as? [String: Any], LiveProtocol.call(in: nested) != nil { calls += 1 }
            }
        } catch {
            guard observationFinished else { throw error }
        }
        // Surface failed sends instead of mistaking a broken connection for silence.
        try await sender?.value
        return ["case": name, "passed": started && calls == 0 && ((audibleBytes > 0) == expectsReply),
                "audibleMilliseconds": audibleBytes / 48, "toolCalls": calls,
                "observationAfterInputSeconds": 10, "reply": transcript]
    }
}
