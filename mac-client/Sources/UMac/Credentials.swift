import Foundation
import Security
import LocalAuthentication
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
    private static let service = "com.zevcorp.u.mac.native"
    private static let reader = CredentialReader()
    private static let keychainLock = NSLock()
    public static func read(_ name: String) async -> String? {
        try? await readChecked(name)
    }
    public static func readChecked(_ name: String, allowInteraction: Bool = false) async throws -> String? {
        let result = try await reader.read(name) { try readSynchronously(name, allowInteraction: allowInteraction) }
        try Task.checkCancellation()
        return result
    }
    private static func readSynchronously(_ name: String, allowInteraction: Bool) throws -> String? {
        if let env = ProcessInfo.processInfo.environment[name], !env.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return env }
        // Login-keychain ACL items predate LAContext. Serialize the legacy process-wide
        // interaction flag so silent reads cannot present their old authorization dialog.
        keychainLock.lock()
        defer { keychainLock.unlock() }
        var previousInteraction: DarwinBoolean = true
        let queryStatus = SecKeychainGetUserInteractionAllowed(&previousInteraction)
        guard queryStatus == errSecSuccess else { throw AgentError.unavailable("No pude consultar el estado del Llavero (\(queryStatus)).") }
        let interactionStatus = SecKeychainSetUserInteractionAllowed(allowInteraction)
        guard interactionStatus == errSecSuccess else { throw AgentError.unavailable("No pude configurar la consulta del Llavero (\(interactionStatus)).") }
        defer { SecKeychainSetUserInteractionAllowed(previousInteraction.boolValue) }
        var result: CFTypeRef?
        var query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                                    kSecAttrAccount as String: name, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        let context = LAContext()
        context.interactionNotAllowed = !allowInteraction
        query[kSecUseAuthenticationContext as String] = context
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        if status == errSecInteractionNotAllowed || (!allowInteraction && status == errSecAuthFailed) {
            throw AgentError.unavailable("El Llavero requiere autorización para esta app. En Configuración pulsa Comprobar Live 1 y, si macOS lo solicita, elige Permitir siempre para Ü. El micrófono sigue apagado.")
        }
        guard status == errSecSuccess else {
            throw AgentError.unavailable("No pude acceder a la credencial en el Llavero (\(status)). Desbloquea el Llavero y autoriza a Ü si macOS lo solicita; después vuelve a conectar.")
        }
        guard let bytes = result as? Data else { throw AgentError.invalid("La credencial del Llavero no tiene un formato válido.") }
        return String(data: bytes, encoding: .utf8)
    }
    public static func save(_ name: String, value: String) async throws {
        try await Task.detached { try saveSynchronously(name, value: value) }.value
        await reader.invalidate(name)
    }
    private static func saveSynchronously(_ name: String, value: String) throws {
        keychainLock.lock()
        defer { keychainLock.unlock() }
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
