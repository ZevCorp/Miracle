import AppKit
import Speech
import UCore
import UMac

@MainActor
enum WakeProbe {
    /// Opt-in acoustic probe using the same Speech instance as the application.
    static func microphone(input: URL, output: URL) async {
        let speech = Speech(), player = Process()
        var candidates: [String] = [], matched = false, error: String?
        speech.onPartial = { text in
            let lower = text.lowercased()
            if lower.contains("hola") || lower.contains("escuchas") || lower.contains("yu") || lower.contains("you") {
                let candidate = String(text.prefix(160))
                if candidates.last != candidate && candidates.count < 30 { candidates.append(candidate) }
            }
        }
        speech.onText = { _ in matched = true }
        speech.onError = { error = $0 }
        await speech.start(localOnly: true)
        do {
            try await Task.sleep(nanoseconds: 1_000_000_000)
            player.executableURL = URL(fileURLWithPath: "/usr/bin/afplay")
            player.arguments = [input.path]; try player.run()
            for _ in 0..<100 {
                if matched || error != nil { break }
                try await Task.sleep(nanoseconds: 150_000_000)
            }
        } catch { }
        speech.stop()
        if player.isRunning { player.terminate() }
        let evidence: [String: Any] = ["matched": matched, "candidates": candidates, "error": error ?? "", "microphoneOpened": true]
        if let data = try? JSONSerialization.data(withJSONObject: evidence, options: [.prettyPrinted, .sortedKeys]) { try? data.write(to: output, options: .atomic) }
        NSApp.terminate(nil)
    }

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
            var segments: [(String, Double, Double)] = []
            let task = recognizer.recognitionTask(with: request) { result, error in
                Task { @MainActor in
                    if let result { text = result.bestTranscription.formattedString; segments = result.bestTranscription.segments.map { ($0.substring, $0.timestamp, $0.duration) }; done = result.isFinal }
                    if let error { failure = "\((error as NSError).domain):\((error as NSError).code)"; done = true }
                }
            }
            for _ in 0..<120 {
                if done { break }
                try? await Task.sleep(for: .milliseconds(100))
            }
            task.cancel()
            evidence.append(["locale": locale, "transcript": text, "error": failure ?? (done ? "" : "timeout"), "matched": VoiceActivation.isGreeting(VoiceActivation.latestPhrase(segments)), "latestPhrase": VoiceActivation.latestPhrase(segments), "segments": segments.map { ["text": $0.0, "start": $0.1, "duration": $0.2] }])
        }
        if let data = try? JSONSerialization.data(withJSONObject: evidence, options: [.prettyPrinted, .sortedKeys]) { try? data.write(to: output, options: .atomic) }
        NSApp.terminate(nil)
    }
}
