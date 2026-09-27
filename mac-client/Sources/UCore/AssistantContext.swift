import Foundation

/// User-owned guidance that survives app relaunches and travels with a new turn.
public struct AssistantContext: Codable, Sendable, Equatable {
    public var text: String
    public init(text: String = "") { self.text = text.trimmingCharacters(in: .whitespacesAndNewlines) }
    public static let principles = """
    Explica con sencillez y ejemplos concretos; una instrucción útil a la vez. Sé cálida sin invadir.
    Respeta conversaciones con otras personas: ante duda sobre el destinatario, permanece en silencio. No respondas al audio de televisión ni a voces ajenas. No inventes que puedes identificar al hablante.
    Aplica Kaizen con disciplina: observa el resultado, identifica una mejora pequeña, compruébala y evita repetir un fallo sin nueva evidencia.
    De Hermes Agent adopta la separación entre preferencias duraderas y contexto temporal. No afirmes tener Hermes instalado ni haber guardado un aprendizaje sin confirmación de una herramienta de memoria. No guardes conversaciones ajenas ni datos privados incidentales.
    """
    public var graphContext: String { Self.principles + (text.isEmpty ? "" : "\n" + text) }
    public func liveInstructions(base: String) -> String {
        return base + "\n\nCriterios de comportamiento y preferencias (aplícalos sin repetirlos):\n" + graphContext
    }
}
