import AppKit
import AVFoundation
import UCore
import UMac

/// Opt-in hardware and service probe; never reads or writes the user's chat.
@MainActor
enum AttentionProbe {
    static func run(output: URL) async {
        var result: [String: Any] = ["passed": false, "date": ISO8601DateFormatter().string(from: Date())]
        let audio = DuplexAudio(), voice = LiveVoice(), player = Process()
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".wav")
        defer {
            voice.stop(); audio.stop()
            if player.isRunning { player.terminate() }
            try? FileManager.default.removeItem(at: file)
            if let data = try? JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]) {
                try? data.write(to: output, options: .atomic)
            }
            NSApp.terminate(nil)
        }
        do {
            let format = AVAudioFormat(standardFormatWithSampleRate: 24_000, channels: 1)!
            let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 240_000)!
            buffer.frameLength = buffer.frameCapacity
            buffer.floatChannelData![0].initialize(repeating: 0, count: Int(buffer.frameLength))
            do { let recording = try AVAudioFile(forWriting: file, settings: format.settings); try recording.write(from: buffer) }
            player.executableURL = URL(fileURLWithPath: "/usr/bin/afplay"); player.arguments = [file.path]
            try player.run()
            try await Task.sleep(nanoseconds: 600_000_000)
            let external = AudioEnvironment.activities()?.contains { $0.pid == player.processIdentifier && $0.output } == true
            result["externalPlaybackDetected"] = external
            try audio.startPlaybackOnly()
            try audio.play(Data(repeating: 0, count: 48_000))
            try await Task.sleep(nanoseconds: 200_000_000)
            let ownInput = AudioEnvironment.activities()?.contains { $0.pid == ProcessInfo.processInfo.processIdentifier && $0.input }
            result["playbackOnlyHasNoInputStream"] = ownInput == false
            audio.stop()
            let key = try await Credentials.readChecked("OPENAI_API_KEY")
            guard let key, !key.isEmpty else { throw AgentError.unavailable("Falta credencial local para la prueba") }
            var failure: String?
            voice.onError = { failure = $0 }
            voice.onTool = { _, _ in "No hay herramientas habilitadas en esta prueba." }
            try await voice.start(key: key, inputMode: .addressedText)
            for _ in 0..<100 {
                if voice.connected || failure != nil { break }
                try await Task.sleep(nanoseconds: 200_000_000)
            }
            guard voice.connected else { throw AgentError.unavailable(failure ?? "Live no conectó") }
            try await voice.text("Yu, esta es una prueba. Responde solamente: listo. No uses herramientas.")
            for _ in 0..<150 {
                if voice.audibleOutputBytesPlayed >= 4800 || failure != nil { break }
                try await Task.sleep(nanoseconds: 200_000_000)
            }
            result["audibleOutputBytesPlayed"] = voice.audibleOutputBytesPlayed
            result["liveInputAudioBytesSent"] = voice.inputAudioBytesSent
            result["liveOutputAudioBytesPlayed"] = voice.outputAudioBytesPlayed
            if let failure { result["error"] = failure }
            result["passed"] = external && ownInput == false && failure == nil && voice.inputAudioBytesSent == 0 && voice.audibleOutputBytesPlayed >= 4800
        } catch { result["error"] = error.localizedDescription }
    }
}
