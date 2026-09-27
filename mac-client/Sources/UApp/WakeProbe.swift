import AppKit
import Speech
import UCore
import UMac

@MainActor
enum WakeProbe {
    static func run(input: URL, output: URL) async {
        var evidence: [[String: Any]] = []
        for locale in ["es-ES"] {
            guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: locale)) else { continue }
            let request = SFSpeechURLRecognitionRequest(url: input)
            do { request.customizedLanguageModel = try await WakeVocabulary.prepare() }
            catch { evidence.append(["error": error.localizedDescription]); continue }
            request.requiresOnDeviceRecognition = true
            request.contextualStrings = VoiceActivation.vocabulary
            var text = "", failure: String?, done = false
            let task = recognizer.recognitionTask(with: request) { result, error in
                Task { @MainActor in
                    if let result { text = result.bestTranscription.formattedString; done = result.isFinal }
                    if let error { failure = "\((error as NSError).domain):\((error as NSError).code)"; done = true }
                }
            }
            for _ in 0..<120 {
                if done { break }
                try? await Task.sleep(for: .milliseconds(100))
            }
            task.cancel()
            evidence.append(["locale": locale, "transcript": text, "error": failure ?? (done ? "" : "timeout"), "matched": VoiceActivation.isGreeting(text)])
        }
        if let data = try? JSONSerialization.data(withJSONObject: evidence, options: [.prettyPrinted, .sortedKeys]) { try? data.write(to: output, options: .atomic) }
        NSApp.terminate(nil)
    }
}
