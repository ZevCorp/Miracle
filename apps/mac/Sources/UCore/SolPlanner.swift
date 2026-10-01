import Foundation

/// Runs one task with Sol over the Responses API. Tools go to the same executor Luna uses, so
/// `map_tramo` still hands the clicking to Jev and reports back when the stretch ends.
public final class SolPlanner: @unchecked Sendable {
    public typealias Execute = @Sendable (String, [String: String]) async throws -> String
    private let key: String
    private let transport: URLSession
    public init(key: String, transport: URLSession = .shared) { self.key = key; self.transport = transport }

    public struct Outcome: Sendable, Equatable {
        public let text: String, ok: Bool, turns: Int
        public init(text: String, ok: Bool, turns: Int) { self.text = text; self.ok = ok; self.turns = turns }
    }

    /// The executor answers `map_tramo` only when Jev's stretch ends, so Sol never polls and never
    /// acts while Jev is clicking.
    public func run(goal: String, context: AssistantContext = .init(), execute: Execute,
                    onStep: (@Sendable (String) -> Void)? = nil) async throws -> Outcome {
        guard !key.isEmpty else { throw AgentError.unavailable("Sol no tiene credencial de OpenAI.") }
        var turn = try await send(SolProtocol.first(goal: goal, context: context))
        for index in 1...SolProtocol.maxTurns {
            try Task.checkCancellation()
            guard !turn.calls.isEmpty else {
                let text = turn.text.trimmingCharacters(in: .whitespacesAndNewlines)
                return Outcome(text: text.isEmpty ? "Sol terminó sin describir el resultado." : text, ok: turn.status == "completed", turns: index)
            }
            var outputs: [(call: String, text: String)] = []
            for call in turn.calls {
                try Task.checkCancellation()
                onStep?(call.name)
                let output: String
                do { output = try await execute(call.name, LiveTools.parseArguments(call.arguments)) }
                catch is CancellationError { throw CancellationError() }
                catch { output = "error: " + error.localizedDescription }
                outputs.append((call.id, output))
            }
            turn = try await send(SolProtocol.next(previous: turn.id, outputs: outputs, context: context))
        }
        return Outcome(text: "Sol alcanzó el límite de \(SolProtocol.maxTurns) pasos sin terminar.", ok: false, turns: SolProtocol.maxTurns)
    }

    private func send(_ body: [String: Any]) async throws -> SolProtocol.Turn {
        var request = URLRequest(url: URL(string: "https://api.openai.com/v1/responses")!)
        request.httpMethod = "POST"; request.timeoutInterval = 60
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let (data, response) = try await transport.data(for: request)
        try Task.checkCancellation()
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else {
            // Only the provider's short message, never the raw body (it can echo user data).
            let message = ((try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? [String: Any])?["message"] as? String
            throw AgentError.unavailable("Sol respondió HTTP \(status)" + (message.map { ": " + String($0.prefix(200)) } ?? "."))
        }
        return try SolProtocol.parse(data)
    }
}
