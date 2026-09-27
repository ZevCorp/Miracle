import Foundation
import Security
import UCore

public enum Credentials {
    private static let service = "com.zevcorp.u.mac.native"
    private static let readTimeoutNanoseconds: UInt64 = 5_000_000_000
    public static func read(_ name: String) async -> String? {
        try? await readChecked(name)
    }
    public static func readChecked(_ name: String) async throws -> String? {
        try await withThrowingTaskGroup(of: String?.self) { group in
            group.addTask { try readSynchronously(name) }
            group.addTask {
                try await Task.sleep(nanoseconds: readTimeoutNanoseconds)
                throw AgentError.unavailable("El Llavero tardó demasiado en responder. Abre Configuración, guarda de nuevo la credencial y vuelve a intentarlo.")
            }
            defer { group.cancelAll() }
            guard let first = try await group.next() else { throw CancellationError() }
            return first
        }
    }
    private static func readSynchronously(_ name: String) throws -> String? {
        if let env = ProcessInfo.processInfo.environment[name], !env.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return env }
        var result: CFTypeRef?
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                                    kSecAttrAccount as String: name, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else {
            throw AgentError.unavailable("No pude acceder a la credencial en el Llavero (\(status)). Desbloquea el Llavero y autoriza a Ü si macOS lo solicita; después vuelve a conectar.")
        }
        guard let bytes = result as? Data else { throw AgentError.invalid("La credencial del Llavero no tiene un formato válido.") }
        return String(data: bytes, encoding: .utf8)
    }
    public static func save(_ name: String, value: String) async throws {
        try await Task.detached { try saveSynchronously(name, value: value) }.value
    }
    private static func saveSynchronously(_ name: String, value: String) throws {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: name]
        let clean = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if clean.isEmpty { SecItemDelete(query as CFDictionary); return }
        let attributes: [String: Any] = [kSecValueData as String: Data(clean.utf8)]
        var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var create = query.merging(attributes) { _, new in new }
            create[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            status = SecItemAdd(create as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw AgentError.unavailable("No pude guardar la credencial en el Llavero (\(status)).") }
    }
}
