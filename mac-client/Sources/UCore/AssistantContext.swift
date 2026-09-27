import Foundation

/// User-owned guidance that survives app relaunches and travels with a new turn.
public struct AssistantContext: Codable, Sendable, Equatable {
    public var text: String
    public init(text: String = "") { self.text = text.trimmingCharacters(in: .whitespacesAndNewlines) }
    public var graphContext: String { text }
    public func liveInstructions(base: String) -> String {
        guard !text.isEmpty else { return base }
        return base + "\n\nPreferencias persistentes de esta persona (aplícalas sin repetirlas):\n" + text
    }
}
