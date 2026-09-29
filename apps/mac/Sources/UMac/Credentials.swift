import Foundation
import UCore

/// Coalesces reads and keeps successful credentials in process memory only.
public actor CredentialReader {
    private var values: [String: String] = [:]
    private var pending: [String: Task<String?, Error>] = [:]
    public init() {}
    public func read(_ name: String, load: @escaping @Sendable () async throws -> String?) async throws -> String? {
        if let value = values[name] { return value }
        if let task = pending[name] { return try await task.value }
        let task = Task.detached { try await load() }
        pending[name] = task
        defer { pending[name] = nil }
        let result = try await task.value
        if let result { values[name] = result }
        return result
    }
    public func invalidate(_ name: String) async {
        if let task = pending[name] { _ = try? await task.value }
        values[name] = nil
    }
}

public enum Credentials {
    private static let reader = CredentialReader()
    public static func read(_ name: String) async -> String? { try? await readChecked(name) }
    public static func readChecked(_ name: String, allowInteraction: Bool = false) async throws -> String? {
        let result = try await reader.read(name) {
            if let value = ProcessInfo.processInfo.environment[name], !value.isEmpty { return value }
            return try runStore(name, operation: "read", interactive: allowInteraction)["value"] as? String
        }
        try Task.checkCancellation()
        return result
    }
    public static func save(_ name: String, value: String) async throws {
        let clean = value.trimmingCharacters(in: .whitespacesAndNewlines)
        _ = try await Task.detached { try runStore(name, operation: "save", interactive: true, input: Data(clean.utf8)) }.value
        await reader.invalidate(name)
    }
    private static func runStore(_ name: String, operation: String, interactive: Bool, input: Data = Data()) throws -> [String: Any] {
        guard ["OPENAI_API_KEY", "GRAPH_API_KEY"].contains(name),
              let executable = Bundle.main.executableURL else { throw AgentError.invalid("Credencial no compatible.") }
        let process = Process(), output = Pipe(), stdin = Pipe()
        process.executableURL = executable.deletingLastPathComponent().appendingPathComponent("UCredentialStore")
        process.arguments = [operation, name, interactive ? "authorize" : "silent"]
        process.standardInput = stdin; process.standardOutput = output; process.standardError = FileHandle.nullDevice
        try process.run()
        try stdin.fileHandleForWriting.write(contentsOf: input)
        try stdin.fileHandleForWriting.close()
        let data = output.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        guard process.terminationStatus == 0,
              let result = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let status = result["status"] as? Int else {
            throw AgentError.unavailable("No se pudo abrir el almacén seguro de Ü (\(process.terminationStatus)).")
        }
        if status == -25300 { return [:] }
        guard status == 0 else {
            throw AgentError.unavailable("El Llavero no autorizó la credencial (\(status)). Usa Comprobar Live 1 en Configuración para autorizarla.")
        }
        return result
    }
}
