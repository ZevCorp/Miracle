import Foundation
import Security
import UCore

public enum Credentials {
    private static let service = "com.zevcorp.u.mac.native"
    public static func read(_ name: String) async -> String? {
        try? await readChecked(name)
    }
    public static func readChecked(_ name: String) async throws -> String? {
        try await Task.detached { try readSynchronously(name) }.value
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
