import Foundation

/// One presentation state for the window, face and notch. No timer or platform dependency.
public struct TaskPresentation: Sendable, Equatable {
    public enum Phase: String, Sendable {
        case ready = "Lista", listening = "Te escucho", working = "Trabajando", speaking = "Hablando"
        case question = "Necesito un dato", error = "Necesito atención", stopped = "Detenida"
    }
    public var title = "Ü"
    public var detail = "Dime qué necesitas hacer."
    public var phase: Phase = .ready
    private var userTurn = ""
    private var assistantTurn = ""
    public init() {}
    public mutating func receiveUserFragment(_ text: String) {
        assistantTurn = ""
        userTurn += text
        detail = userTurn
        phase = .listening
    }
    public mutating func receiveAssistantFragment(_ text: String) {
        commitUserTurn()
        assistantTurn += text
        detail = assistantTurn
    }
    public mutating func commitUserTurn() {
        let text = userTurn.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        title = text; userTurn = ""
    }
    public mutating func begin(_ text: String) {
        assistantTurn = ""; userTurn = text; commitUserTurn()
    }
    public mutating func update(_ text: String, phase: Phase) { detail = text; self.phase = phase }
    public mutating func stop() { commitUserTurn(); update("Tarea detenida.", phase: .stopped) }
}
