import Foundation

public enum VoiceActivation {
    /// Require a direct greeting, not an incidental mention or a prefix of YouTube.
    public static func isGreeting(_ text: String) -> Bool {
        let normalized = text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "es-CO"))
            .trimmingCharacters(in: .whitespacesAndNewlines.union(.punctuationCharacters))
        return normalized.range(of: #"^(hola|oye|hey|ey|buenos dias|buenas tardes|buenas noches)[\s,]+(yu|you|u|iu)(?=$|[\s,!.?:;])"#, options: .regularExpression) != nil
    }
}
