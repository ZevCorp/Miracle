import Foundation
import UCore

/// A harmless Live 1 → Luna tool roundtrip. Does not capture or play audio.
enum VoiceProbe {
    /// What the provider counted for each Luna turn of the last check (nil: the turn came without a
    /// count). It is how the daily budget's reading of the event is checked against the real service.
    static var lunaTurns: [Int?] = []
    static func check(key: String, audio: Data? = nil) async throws -> Bool {
        let session = URLSession(configuration: .ephemeral)
        var request = URLRequest(url: URL(string: "wss://api.openai.com/v1/live/sessions")!)
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        let socket = session.webSocketTask(with: request); socket.resume()
        defer { socket.cancel(with: .normalClosure, reason: nil); session.invalidateAndCancel() }
        let timeout = Task { try await Task.sleep(for: .seconds(30)); socket.cancel(with: .goingAway, reason: nil) }
        defer { timeout.cancel() }
        var sender: Task<Void, Error>?
        defer { sender?.cancel() }
        func send(_ event: [String: Any]) async throws {
            try await socket.send(.string(String(decoding: JSONSerialization.data(withJSONObject: event), as: UTF8.self)))
        }
        var start = LiveProtocol.start(), config = LiveProtocol.start()["session"] as! [String: Any]
        config["delegation"] = ["type": "responses", "responses": ["model": "gpt-5.6-luna", "parallel_tool_calls": false,
            "instructions": "Call health_check exactly once. After the result say listo.", "tools": [["type": "function", "name": "health_check", "description": "Local harmless connection check", "parameters": ["type": "object", "properties": [:], "additionalProperties": false]]]]]
        start["session"] = config
        do {
        try await send(start)
        var batch = ToolBatch(), returned = false, completed = false, audible = false
        lunaTurns = []
        while true {
            let message = try await socket.receive()
            let data: Data
            switch message { case .data(let value): data = value; case .string(let value): data = Data(value.utf8); @unknown default: continue }
            guard let event = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { continue }
            if event["type"] as? String == "error" {
                let code = (event["error"] as? [String: Any])?["code"] as? String ?? "unknown"
                throw AgentError.unavailable(LiveProtocol.errorMessage(code: code))
            }
            if event["type"] as? String == "session.started" {
                if let audio {
                    sender = Task {
                        let input = audio + Data(repeating: 0, count: 24000 * 2 * 5)
                        for offset in stride(from: 0, to: input.count, by: 4800) {
                            try Task.checkCancellation()
                            let chunk = input.subdata(in: offset..<min(offset + 4800, input.count))
                            try await send(["type": "session.input_audio.append", "audio": chunk.base64EncodedString()])
                            try await Task.sleep(for: .milliseconds(100))
                        }
                    }
                } else {
                    try await send(["type": "response.item.create", "item": ["type": "message", "role": "user", "content": [["type": "input_text", "text": "Ejecuta health_check ahora."]]]])
                    try await send(["type": "response.create"])
                }
            }
            if event["type"] as? String == "session.output_audio.delta",
               let encoded = event["delta"] as? String, let data = Data(base64Encoded: encoded) {
                let level = try LiveAudioChunk(data).level
                audible = audible || level > 0.001
                if completed && audible { return true }
            }
            if let nested = event["event"] as? [String: Any] {
                if let call = LiveProtocol.call(in: nested) {
                    guard call.name == "health_check", !returned else { throw AgentError.invalid("Llamada inesperada en la prueba de voz.") }
                    _ = batch.begin(call.id)
                    try await send(LiveProtocol.output(call: call.id, text: "ok"))
                    _ = batch.finish(call.id); returned = true
                }
                if nested["type"] as? String == "response.completed" {
                    lunaTurns.append(LunaBudget.tokens(in: nested))
                    if batch.responseDone() { try await send(["type": "response.create"]) }
                    else if returned {
                        completed = true
                        if audio == nil || audible { return true }
                    }
                }
                if nested["type"] as? String == "response.failed" { throw AgentError.unavailable("Falló el delegado Luna.") }
            }
        }
        } catch {
            if let failure = error as? URLError {
                throw AgentError.unavailable(LiveProtocol.connectionError(status: (socket.response as? HTTPURLResponse)?.statusCode, code: failure.errorCode))
            }
            throw error
        }
    }
}
