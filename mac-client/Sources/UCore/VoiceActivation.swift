import Foundation

public enum VoiceActivation {
    /// Split by actual acoustic pauses, not by the latency of partial hypotheses.
    public static func latestPhrase(_ segments: [(text: String, start: Double, duration: Double)]) -> String {
        var words: [String] = []
        var end: Double?
        for segment in segments {
            if let end, segment.start - end >= 0.8 { words.removeAll(keepingCapacity: true) }
            words.append(segment.text)
            end = segment.start + segment.duration
        }
        return words.joined(separator: " ")
    }
    public static func requestsPrivacy(_ text: String) -> Bool {
        let value = text.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "es-CO"))
        return ["no te estoy hablando", "estoy en una llamada", "guarda silencio", "no me interrumpas", "estoy viendo un video", "estoy viendo una pelicula", "dejame ver el video", "estoy hablando con otra persona"].contains { value.contains($0) }
    }
    public static let vocabulary = ["You", "Yu", "Ü", "Hola You", "Hola Yu", "Oye You", "You te necesito", "You estás ahí", "You me escuchas"]
    /// Direct address only: arbitrary requests after the name, never an incidental mention.
    public static func isGreeting(_ text: String) -> Bool {
        guard !requestsPrivacy(text) else { return false }
        let normalized = text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "es-CO"))
            .trimmingCharacters(in: .whitespacesAndNewlines.union(.punctuationCharacters))
        let name = "(yu|you|u|iu)"
        let prefix = #"^((hola|oye|hey|ey|buenos dias|buenas tardes|buenas noches)[\s,]+)?"# + name + #"(?=$|[\s,!.?:;])"#
        let question = #"^(me escuchas|estas ahi|te necesito)[\s,¿?!.:]+"# + name + #"[?.!]*$"#
        return normalized.range(of: prefix, options: .regularExpression) != nil
            || normalized.range(of: question, options: .regularExpression) != nil
    }
}

/// Fail closed after an explicit privacy request, until a new session is started.
/// This detects transcript text, not the speaker or media playback.
public struct VoicePrivacyLatch: Sendable {
    private var recent = ""
    public private(set) var stopped = false
    public init() {}
    public mutating func receive(_ delta: String) -> Bool {
        guard !stopped else { return true }
        recent = String((recent + delta).suffix(512))
        stopped = VoiceActivation.requestsPrivacy(recent)
        return stopped
    }
}
