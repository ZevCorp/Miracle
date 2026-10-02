import AppKit
import AVFoundation
import UCore
import UMac

/// Opt-in measurements for passive listening. They run inside the signed app because the keys
/// only leave the Keychain for it. No microphone: recorded phrases are streamed at real time.
@MainActor
enum ListenProbe {
    struct Keys { let graph: GraphClient; let openai: String; let typesafe: String }
    static func keys() async throws -> Keys {
        let graph = try GraphClient(baseURL: UserDefaults.standard.string(forKey: "graphURL") ?? GraphClient.defaultURL,
                                    apiKey: try await Credentials.readChecked("GRAPH_API_KEY", allowInteraction: true) ?? "")
        let remote = try await graph.providerKeys()
        let local = try await Credentials.readChecked("OPENAI_API_KEY", allowInteraction: true)
        guard let typesafe = remote.typesafe, !typesafe.isEmpty else { throw AgentError.unavailable("Graph no entrega la clave de TypeSafe.") }
        return Keys(graph: graph, openai: (local?.isEmpty == false ? local : remote.openai) ?? "", typesafe: typesafe)
    }
    static func percentiles(_ values: [Double]) -> [String: Double] {
        guard !values.isEmpty else { return [:] }
        let sorted = values.sorted()
        func at(_ p: Double) -> Double { sorted[min(sorted.count - 1, Int(ceil(Double(sorted.count) * p)) - 1)] }
        return ["n": Double(sorted.count), "min": sorted[0], "p50": at(0.5), "p90": at(0.9), "p95": at(0.95), "max": sorted.last!]
    }
    static func write(_ evidence: [String: Any], to output: URL) {
        if let data = try? JSONSerialization.data(withJSONObject: evidence, options: [.prettyPrinted, .sortedKeys]) { try? data.write(to: output, options: .atomic) }
    }

    /// Facts the design depends on: Sol's model id, Graph's Soniox session, Jev's raw latency.
    static func probe(output: URL) async {
        var evidence: [String: Any] = ["date": ISO8601DateFormatter().string(from: Date())]
        defer { write(evidence, to: output); NSApp.terminate(nil) }
        do {
            let keys = try await keys()
            evidence["openaiKey"] = !keys.openai.isEmpty
            var request = URLRequest(url: URL(string: "https://api.openai.com/v1/models")!)
            request.setValue("Bearer \(keys.openai)", forHTTPHeaderField: "Authorization")
            if let (data, _) = try? await URLSession.shared.data(for: request),
               let list = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["data"] as? [[String: Any]] {
                let ids = list.compactMap { $0["id"] as? String }
                evidence["models"] = ids.filter { $0.contains("sol") || $0.contains("luna") || $0.contains("live") || $0.hasPrefix("gpt-6") }.sorted()
            }
            do {
                let session = try await keys.graph.transcriptionSession()
                evidence["soniox"] = ["provider": session.provider ?? "", "model": session.model ?? ""]
            } catch { evidence["sonioxError"] = error.localizedDescription }
            let phrases = ["hola Yu, ¿cómo estás?", "Yu, abre Safari y busca vuelos a Medellín", "mañana te llamo, mami", "oye Yu, una pregunta", "y entonces el gol fue en el minuto noventa"]
            // Same phrases, interleaved configurations, so network weather hits all of them alike.
            // Same phrases, interleaved configurations, so network weather hits all of them alike.
            let configurations: [(String, Int, Bool, JevClient)] = [
                ("race2-full", 2, false, JevClient.passive(key: keys.typesafe)),
                ("race2-compact", 2, true, JevClient.passive(key: keys.typesafe)),
                ("race3-compact", 3, true, JevClient(key: keys.typesafe, racers: JevClient.racingSessions(3)))]
            for (_, parallel, _, client) in configurations { JevIntent.parallel = parallel; await client.warm() }
            var times: [String: [Double]] = [:], failures: [String: Int] = [:], answers: [String: [String]] = [:]
            for index in 0..<50 {
                for (name, parallel, compact, client) in configurations {
                    JevIntent.parallel = parallel; JevIntent.compact = compact
                    let started = ContinuousClock.now
                    do {
                        let decision = try await client.intent(phrase: phrases[index % phrases.count])
                        if index < phrases.count { answers[name, default: []].append("\(decision.intent.rawValue) \(decision.confidence)") }
                    } catch { failures[name, default: 0] += 1; continue }
                    let elapsed = started.duration(to: .now)
                    times[name, default: []].append(Double(elapsed.components.attoseconds) / 1e15 + Double(elapsed.components.seconds) * 1000)
                }
            }
            JevIntent.parallel = 2; JevIntent.compact = false
            evidence["jevIntent"] = times.mapValues { percentiles($0) }
            evidence["jevAnswers"] = answers
            evidence["jevFailures"] = failures
        } catch { evidence["error"] = error.localizedDescription }
    }

    /// `directory/manifest.json`: [{"file": "01.aiff", "expect": "hablar", "text": "..."}].
    static func listen(directory: URL, output: URL) async {
        var evidence: [String: Any] = ["date": ISO8601DateFormatter().string(from: Date()),
                                       "thresholds": ["hablar": JevIntent.hablarThreshold, "ejecutar": JevIntent.ejecutarThreshold]]
        defer { write(evidence, to: output); NSApp.terminate(nil) }
        do {
            let keys = try await keys()
            let jev = JevClient.passive(key: keys.typesafe)
            let manifest = try JSONSerialization.jsonObject(with: Data(contentsOf: directory.appendingPathComponent("manifest.json"))) as? [[String: String]] ?? []
            var results: [[String: Any]] = [], cycles: [Double] = [], endpointCycles: [Double] = []
            var correct = 0, falseActs = 0
            for entry in manifest {
                guard let file = entry["file"], let expect = entry["expect"] else { continue }
                let pcm = try pcm24k(directory.appendingPathComponent(file))
                let listener = PassiveListener()
                var got: [[String: Any]] = [], first: ListenIntent?, heard = ""
                listener.onPhrase = { heard = $0 }
                listener.onCycle = { cycle in
                    got.append(["phrase": cycle.phrase, "intent": cycle.decision.intent.rawValue, "confidence": cycle.decision.confidence,
                                "action": cycle.action.rawValue, "ms": cycle.milliseconds, "endpoint": cycle.endpoint])
                    cycles.append(cycle.milliseconds)
                    if cycle.endpoint { endpointCycles.append(cycle.milliseconds) }
                }
                listener.onDecision = { action, _ in if first == nil { first = action } }
                var failure: String?
                listener.onError = { failure = $0 }
                let session = try await keys.graph.transcriptionSession()
                let (feed, continuation) = AsyncStream<Data>.makeStream()
                try await listener.start(sonioxKey: session.access_token ?? "", jev: jev, feed: feed)
                // Real-time pace in 40 ms frames, then 1.5 s of room silence for the endpoint.
                let frame = 24_000 * 2 / 25
                let audio = pcm + Data(count: 24_000 * 2 * 3 / 2)
                var offset = 0
                while offset < audio.count {
                    continuation.yield(audio.subdata(in: offset..<min(audio.count, offset + frame)))
                    offset += frame
                    try await Task.sleep(for: .milliseconds(40))
                }
                // Let the last question to Jev return before closing.
                try await Task.sleep(for: .milliseconds(1200))
                continuation.finish()
                listener.stop()
                let decided = first ?? .nada
                if decided.rawValue == expect { correct += 1 }
                if decided == .ejecutar && expect != "ejecutar" { falseActs += 1 }
                results.append(["file": file, "text": entry["text"] ?? "", "heard": heard, "expect": expect, "decided": decided.rawValue,
                                "cycles": got, "error": failure ?? NSNull()])
                write(evidence.merging(["partial": results]) { $1 }, to: output)
            }
            evidence["results"] = results
            evidence["cycleMs"] = percentiles(cycles)
            evidence["endpointCycleMs"] = percentiles(endpointCycles)
            evidence["accuracy"] = manifest.isEmpty ? 0 : Double(correct) / Double(manifest.count)
            evidence["falseEjecutar"] = falseActs
        } catch { evidence["error"] = error.localizedDescription }
    }

    /// Any file AVAudioFile reads, as the 24 kHz mono Int16 the microphone path sends.
    static func pcm24k(_ url: URL) throws -> Data {
        let file = try AVAudioFile(forReading: url)
        guard let source = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)) else { throw AgentError.invalid("Audio vacío.") }
        try file.read(into: source)
        return try PCMEncoder(source: file.processingFormat).encode(source)
    }
}
