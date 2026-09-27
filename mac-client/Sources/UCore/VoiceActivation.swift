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
        return ["no te estoy hablando", "estoy en una llamada", "guarda silencio", "no me interrumpas"].contains { value.contains($0) }
    }
    public static let vocabulary = ["You", "Yu", "Ü", "Hola You", "Hola Yu", "Oye You", "You te necesito", "You estás ahí", "You me escuchas"]
    /// Direct address only: arbitrary requests after the name, never an incidental mention.
    public static func isGreeting(_ text: String) -> Bool {
        let normalized = text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "es-CO"))
            .trimmingCharacters(in: .whitespacesAndNewlines.union(.punctuationCharacters))
        let name = "(yu|you|u|iu)"
        let prefix = #"^((hola|oye|hey|ey|buenos dias|buenas tardes|buenas noches)[\s,]+)?"# + name + #"(?=$|[\s,!.?:;])"#
        let question = #"^(me escuchas|estas ahi|te necesito)[\s,¿?!.:]+"# + name + #"[?.!]*$"#
        return normalized.range(of: prefix, options: .regularExpression) != nil
            || normalized.range(of: question, options: .regularExpression) != nil
    }
}
