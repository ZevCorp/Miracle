import Foundation
import Speech
import UCore

/// A small on-device vocabulary, cached across launches. Contains no recordings.
@MainActor
public enum WakeVocabulary {
    public static let locale = Locale(identifier: "es-ES")
    private static var cached: SFSpeechLanguageModel.Configuration?
    public static func prepare() async throws -> SFSpeechLanguageModel.Configuration {
        if let cached { return cached }
        let root = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("com.zevcorp.u.mac/WakeVocabulary-v1")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let configuration = SFSpeechLanguageModel.Configuration(
            languageModel: root.appendingPathComponent("model"),
            vocabulary: root.appendingPathComponent("vocabulary"))
        if !FileManager.default.fileExists(atPath: configuration.languageModel.path) || !FileManager.default.fileExists(atPath: root.appendingPathComponent("vocabulary").path) {
            let data = SFCustomLanguageModelData(locale: locale, identifier: "com.zevcorp.u.mac.wake", version: "1")
            for word in ["You", "Yu", "Yú"] {
                data.insert(term: .init(grapheme: word, phonemes: ["j u", "i u", "j\\ u"]))
                for prefix in ["", "Hola ", "Oye ", "Hey ", "Buenos días "] {
                    for suffix in ["", " me escuchas", " estás ahí", " te necesito", " abre el navegador", " ayúdame"] {
                        data.insert(phraseCount: .init(phrase: prefix + word + suffix, count: 20))
                    }
                }
            }
            let source = root.appendingPathComponent("training")
            try await data.export(to: source)
            try await SFSpeechLanguageModel.prepareCustomLanguageModel(for: source,
                clientIdentifier: "com.zevcorp.u.mac", configuration: configuration)
        }
        cached = configuration
        return configuration
    }
}
