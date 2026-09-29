import AppKit
import AVFoundation
import UCore
import UMac

private final class AudioProbeState: @unchecked Sendable {
    private let lock = NSLock()
    private var bytes = 0
    private var message: String?
    func add(_ count: Int) { lock.lock(); bytes += count; lock.unlock() }
    func fail(_ value: String) { lock.lock(); message = value; lock.unlock() }
    func read() -> (Int, String?) { lock.lock(); defer { lock.unlock() }; return (bytes, message) }
}

@MainActor
struct SmokeTest {
    /// Sends a synthetic spoken fixture; no room audio or desktop actions are captured.
    static func spokenVoice(input: URL, output: URL) async {
        var evidence: [String: Any] = ["passed": false, "microphoneOpened": false]
        defer {
            if let data = try? JSONSerialization.data(withJSONObject: evidence, options: [.prettyPrinted, .sortedKeys]) { try? data.write(to: output, options: .atomic) }
            NSApp.terminate(nil)
        }
        do {
            let file = try AVAudioFile(forReading: input)
            guard let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)) else { throw AgentError.invalid("Audio de prueba inválido.") }
            try file.read(into: buffer)
            let pcm = try PCMEncoder(source: file.processingFormat).encode(buffer)
            let key = try await Credentials.readChecked("OPENAI_API_KEY") ?? ""
            evidence["inputBytes"] = pcm.count
            evidence["spokenInputLunaToolAndAudibleReply"] = try await VoiceProbe.check(key: key, audio: pcm)
            evidence["passed"] = true
        } catch { evidence["error"] = error.localizedDescription }
    }
    /// Installer recovery input comes from stdin, never argv, preferences or a file.
    /// Validate the supplied credential before creating a new app-owned Keychain item.
    static func configureVoice(output: URL) async {
        var evidence: [String: Any] = ["passed": false, "stage": "validate_voice"]
        defer {
            if let data = try? JSONSerialization.data(withJSONObject: evidence, options: [.prettyPrinted, .sortedKeys]) {
                try? data.write(to: output, options: .atomic)
            }
            NSApp.terminate(nil)
        }
        do {
            guard let key = readLine(), !key.isEmpty else { throw AgentError.invalid("Falta la credencial en la entrada del instalador.") }
            guard try await VoiceProbe.check(key: key) else { throw AgentError.unavailable("La prueba de Live no terminó.") }
            evidence["stage"] = "save_keychain"
            try await Credentials.save("OPENAI_API_KEY", value: key)
            evidence["passed"] = try await Credentials.readChecked("OPENAI_API_KEY") == key
            evidence["stage"] = "complete"
        } catch { evidence["error"] = error.localizedDescription }
    }
    /// Opens the installed app's real microphone and output route without contacting any service.
    static func audio(output: URL) async {
        var evidence: [String: Any] = ["date": ISO8601DateFormatter().string(from: Date()), "passed": false]
        let audio = DuplexAudio()
        let state = AudioProbeState()
        defer {
            audio.stop()
            if let data = try? JSONSerialization.data(withJSONObject: evidence, options: [.prettyPrinted, .sortedKeys]) {
                try? data.write(to: output, options: .atomic)
            }
            NSApp.terminate(nil)
        }
        do {
            try audio.start(onPCM: { data in state.add(data.count) }, onError: { message in state.fail(message) })
            try await Task.sleep(for: .seconds(2))
            let (receivedBytes, streamError) = state.read()
            evidence["capturedBytes"] = receivedBytes
            if let streamError { evidence["streamError"] = streamError }
            evidence["voiceProcessing"] = audio.voiceProcessingEnabled
            evidence["passed"] = receivedBytes > 0
        } catch { evidence["error"] = error.localizedDescription }
    }

    /// Writes progress before Keychain access so an OS authorization wait is observable.
    static func voice(output: URL) async {
        var evidence: [String: Any] = ["date": ISO8601DateFormatter().string(from: Date()), "passed": false,
                                        "microphoneOpened": false, "stage": "keychain"]
        func save() {
            if let data = try? JSONSerialization.data(withJSONObject: evidence, options: [.prettyPrinted, .sortedKeys]) {
                try? data.write(to: output, options: .atomic)
            }
        }
        save()
        defer { save(); NSApp.terminate(nil) }
        do {
            let started = Date()
            let local = try await Credentials.readChecked("OPENAI_API_KEY")
            evidence["keychainMilliseconds"] = Date().timeIntervalSince(started) * 1000
            let key: String
            if let local, !local.isEmpty {
                key = local
                evidence["credentialSource"] = "local"
                evidence["cachedReadMatches"] = try await Credentials.readChecked("OPENAI_API_KEY") == local
            } else {
                let credential = try await Credentials.readChecked("GRAPH_API_KEY") ?? ""
                evidence["stage"] = "graph"; save()
                let graph = try GraphClient(baseURL: UserDefaults.standard.string(forKey: "graphURL") ?? GraphClient.defaultURL, apiKey: credential)
                let keys = try await graph.providerKeys()
                guard let remote = keys.openai, !remote.isEmpty else { throw AgentError.unavailable("Graph no entrega credencial de Live 1.") }
                key = remote; evidence["credentialSource"] = "graph"
            }
            evidence["stage"] = "live_one_luna"; save()
            evidence["passed"] = try await VoiceProbe.check(key: key)
            evidence["stage"] = "complete"
        } catch { evidence["error"] = error.localizedDescription; evidence["stage"] = "failed" }
    }
    /// Opt-in integration probe. Only clicks the local fixture; never opens the microphone.
    static func execution(output: URL) async {
        var evidence: [String: Any] = ["date": ISO8601DateFormatter().string(from: Date()), "passed": false]
        let desktop = Desktop(); desktop.begin()
        defer {
            desktop.stop()
            if let data = try? JSONSerialization.data(withJSONObject: evidence, options: [.prettyPrinted, .sortedKeys]) { try? data.write(to: output, options: .atomic) }
            NSApp.terminate(nil)
        }
        do {
            let graph = try GraphClient(baseURL: UserDefaults.standard.string(forKey: "graphURL") ?? GraphClient.defaultURL,
                                        apiKey: await Credentials.read("GRAPH_API_KEY") ?? "")
            let keys = try await graph.providerKeys()
            evidence["graphVoiceKey"] = keys.openai?.isEmpty == false
            evidence["graphJevKey"] = keys.typesafe?.isEmpty == false
            if let key = keys.openai { evidence["liveOneLunaToolRoundtrip"] = try await VoiceProbe.check(key: key) }
            guard let key = keys.typesafe, !key.isEmpty else { throw AgentError.unavailable("Graph no entrega typesafe.") }
            guard let fixture = NSRunningApplication.runningApplications(withBundleIdentifier: "com.zevcorp.u.mac.fixture").first else { throw AgentError.unavailable("Abre UFixture.app antes de la prueba.") }
            fixture.activate(options: [])
            for _ in 0..<30 {
                if NSWorkspace.shared.frontmostApplication?.processIdentifier == fixture.processIdentifier { break }
                try await Task.sleep(for: .milliseconds(20))
            }
            let client = JevClient(key: key)
            var timings: [[String: Double]] = []
            for _ in 0..<5 {
                var previous = "", repeats = 0
                let outcome = try await desktop.jevStep(client, goal: "Pulsa el botón Sumar uno una vez ahora. No está cumplido todavía.", previous: &previous, repeats: &repeats, onStep: { _ in })
                timings.append(desktop.lastJevTiming)
                if let outcome { throw AgentError.unavailable(outcome) }
            }
            evidence["steps"] = timings
            let observed = try await desktop.observe()
            evidence["fiveClicksVerified"] = observed.uiContext.contains("Contador: 5")
            evidence["passed"] = evidence["fiveClicksVerified"] as? Bool == true && evidence["liveOneLunaToolRoundtrip"] as? Bool == true
        } catch { evidence["error"] = error.localizedDescription }
    }
    static func run(output: URL) async {
        var evidence: [String: Any] = ["date": ISO8601DateFormatter().string(from: Date()), "passed": false]
        let memoryURL = output.deletingPathExtension().appendingPathExtension("memory.json")
        let desktop = Desktop(memoryURL: memoryURL); desktop.begin()
        defer {
            desktop.stop()
            if let data = try? JSONSerialization.data(withJSONObject: evidence, options: [.prettyPrinted, .sortedKeys]) { try? data.write(to: output, options: .atomic) }
            NSApp.terminate(nil)
        }
        do {
            guard let fixture = NSRunningApplication.runningApplications(withBundleIdentifier: "com.zevcorp.u.mac.fixture").first else { throw AgentError.unavailable("Abre primero UFixture.app.") }
            fixture.activate(options: [])
            try await Task.sleep(nanoseconds: 500_000_000)
            let before = try await desktop.observe()
            evidence["app"] = before.screen
            guard before.uiContext.contains("Sumar uno") else { throw AgentError.unavailable("AX no encontró el botón de prueba.") }
            _ = try await desktop.tool("click_element", args: ["label": "Sumar uno"])
            let after = try await desktop.observe()
            guard after.uiContext.contains("Contador: 1") else { throw AgentError.unavailable("AXPress no incrementó el contador.") }
            evidence["axPress"] = true
            _ = try await desktop.tool("map_esto_es", args: ["sobre": "Sumar uno", "significado": "Incrementa el contador de prueba"])
            let restored = DesktopMemory(url: memoryURL)
            try await restored.prepare()
            guard let snap = desktop.snapshot else { throw AgentError.invalid("Falta la observación de prueba.") }
            let surface = DesktopMemory.surface(snap)
            guard let entry = restored.graph.entries(surface: surface).first(where: { $0.meaning == "Incrementa el contador de prueba" }),
                  !restored.graph.isLive(surface: surface, selector: entry.selector) else { throw AgentError.invalid("El recuerdo no sobrevivió o restauró visibilidad obsoleta.") }
            let recall = try await restored.describe(snapshot: snap)
            guard recall.contains("visible: Sumar uno") else { throw AgentError.invalid("El recuerdo no se enlazó a la observación nueva.") }
            evidence["memoryPersistedAndReobserved"] = true
            try await restored.forget(surface: surface, selector: entry.selector)
            let forgotten = try await MemoryStore(url: memoryURL).load()
            guard forgotten.entries(surface: surface).allSatisfy({ $0.meaning == nil }) else { throw AgentError.invalid("Olvidar no persistió.") }
            evidence["memoryForgotten"] = true
            var readTimes: [Double] = [], memoryTimes: [Double] = []
            for _ in 0..<20 {
                let start = ProcessInfo.processInfo.systemUptime
                let sample = try await desktop.reader.read(pid: fixture.processIdentifier, bundleID: snap.bundleID, appName: snap.appName, actionableOnly: true)
                let readEnd = ProcessInfo.processInfo.systemUptime
                desktop.memory.observe(sample)
                readTimes.append((readEnd - start) * 1000)
                memoryTimes.append((ProcessInfo.processInfo.systemUptime - readEnd) * 1000)
            }
            func percentiles(_ values: [Double]) -> [String: Double] {
                let sorted = values.sorted()
                return ["p50ms": sorted[(sorted.count - 1) / 2], "p95ms": sorted[Int(ceil(Double(sorted.count) * 0.95)) - 1]]
            }
            evidence["localHarness"] = ["samples": 20, "fixtureOnly": true, "readAX": percentiles(readTimes), "memory": percentiles(memoryTimes)]
            _ = try await desktop.tool("set_value", args: ["label": "Texto de prueba", "text": "¡Hola, Mac! 👋"])
            let typed = try await desktop.observe()
            guard typed.uiContext.contains("¡Hola, Mac! 👋") else { throw AgentError.unavailable("AXValue no conservó Unicode.") }
            evidence["axValueUnicode"] = true
            if ScreenCapture.allowed {
                let shot = try await desktop.observe(screenshot: true)
                guard let encoded = shot.screenshot, let bytes = Data(base64Encoded: encoded), let image = NSBitmapImageRep(data: bytes), image.pixelsWide == shot.width, image.pixelsHigh == shot.height else { throw AgentError.unavailable("La captura no coincide con el espacio de coordenadas.") }
                evidence["screenshotCoordinates"] = true
                try bytes.write(to: output.deletingPathExtension().appendingPathExtension("png"))
            } else { evidence["screenshotCoordinates"] = "blocked: screen capture permission" }
            desktop.stop()
            do { _ = try await desktop.execute(AgentAction(kind: "key", key: "space")); throw AgentError.invalid("La cancelación no bloqueó la entrada.") }
            catch AgentError.stopped { evidence["stopGate"] = true }
            evidence["passed"] = true
        } catch { evidence["error"] = error.localizedDescription }
    }
}
