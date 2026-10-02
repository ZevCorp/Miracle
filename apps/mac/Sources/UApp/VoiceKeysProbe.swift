import AppKit
import CryptoKit
import UCore
import UMac

/// Which voice credential works: the one in this Mac's Keychain and the one Graph serves are tried
/// separately against Live 1 (no microphone, one short session each). Never prints a key: only
/// whether each exists, whether they are the same one, and what Live 1 answered.
@MainActor
enum VoiceKeysProbe {
    static func run(output: URL) async {
        var evidence: [String: Any] = ["date": ISO8601DateFormatter().string(from: Date())]
        defer {
            if let data = try? JSONSerialization.data(withJSONObject: evidence, options: [.prettyPrinted, .sortedKeys]) { try? data.write(to: output, options: .atomic) }
            NSApp.terminate(nil)
        }
        func fingerprint(_ key: String) -> String { SHA256.hash(data: Data(key.utf8)).prefix(4).map { String(format: "%02x", $0) }.joined() }
        func check(_ key: String?) async -> [String: Any] {
            guard let key = key?.trimmingCharacters(in: .whitespacesAndNewlines), !key.isEmpty else { return ["presente": false] }
            let began = Date()
            do {
                let ok = try await VoiceProbe.check(key: key)
                return ["presente": true, "huella": fingerprint(key), "responde": ok, "segundos": (Date().timeIntervalSince(began) * 10).rounded() / 10]
            } catch {
                return ["presente": true, "huella": fingerprint(key), "responde": false, "error": error.localizedDescription]
            }
        }
        // The credential a build for testers carries, tried by itself: on this Mac the Keychain one
        // goes first and would hide a dead one.
        evidence["pruebas"] = await check(Credentials.bundled("OPENAI_API_KEY"))
        var local: String?
        do { local = try await Credentials.readChecked("OPENAI_API_KEY", allowInteraction: true) }
        catch { evidence["llaveroError"] = error.localizedDescription }
        evidence["local"] = await check(local)
        do {
            guard let graphKey = try await Credentials.readChecked("GRAPH_API_KEY", allowInteraction: true), !graphKey.isEmpty else {
                evidence["graph"] = ["presente": false, "error": "No hay credencial de Graph en el Llavero."]; return
            }
            let graph = try GraphClient(baseURL: UserDefaults.standard.string(forKey: "graphURL") ?? GraphClient.defaultURL, apiKey: graphKey)
            let keys = try await graph.providerKeys()
            evidence["graph"] = await check(keys.openai)
            evidence["graphEntregaJev"] = keys.typesafe?.isEmpty == false
            if let l = local, let g = keys.openai { evidence["sonLaMismaClave"] = l.trimmingCharacters(in: .whitespacesAndNewlines) == g.trimmingCharacters(in: .whitespacesAndNewlines) }
        } catch { evidence["graph"] = ["presente": false, "error": error.localizedDescription] }
    }
}
