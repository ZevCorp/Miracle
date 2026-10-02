import Foundation
import UCore

/// The tools Sol drives, on the same desktop Luna uses. The one difference: a Jev stretch answers
/// only when it ends, because Sol has no voice session to be told about it later.
public extension Desktop {
    /// Up to 15 Jev clicks toward `goal`. The text is what the planner reads next.
    func stretch(_ jev: JevClient, goal: String, onStep: @escaping (String) -> Void) async throws -> (text: String, ok: Bool) {
        var previous = "", repeats = 0
        do {
            for _ in 0..<15 {
                try Task.checkCancellation()
                if let outcome = try await jevStep(jev, goal: goal, previous: &previous, repeats: &repeats, onStep: onStep) {
                    return (outcome, true)
                }
            }
        } catch is CancellationError { throw CancellationError() }
        catch { return ("Tramo detenido: " + error.localizedDescription + " Decide con read_screen.", false) }
        return ("Se alcanzó el límite de 15 pasos. Decide con read_screen.", false)
    }
    func planningTool(_ name: String, args: [String: String], jev: JevClient?, onStep: @escaping (String) -> Void) async throws -> String {
        switch name {
        case "map_tramo":
            guard let jev else { return "Jev no tiene credencial TypeSafe. Usa las herramientas AX directas." }
            guard let goal = args["goal"], !goal.isEmpty else { throw AgentError.invalid("Falta el objetivo.") }
            return try await stretch(jev, goal: goal, onStep: onStep).text
        case "map_decidir":
            guard let jev else { return "Jev no tiene credencial. Decide con las herramientas AX." }
            var previous = "", repeats = 0
            return try await jevStep(jev, goal: args["goal"] ?? "", previous: &previous, repeats: &repeats, onStep: onStep)
                ?? "Control accionado. Lee read_screen para comprobar el resultado."
        case "key": return try await execute(AgentAction(kind: "key", key: args["key"]))
        case "scroll": return try await tool("map_scroll", args: args)
        default: return try await tool(name, args: args)
        }
    }
}
