import Foundation
import UCore

public enum MiracleCloud {
    public static let url = URL(string: ProcessInfo.processInfo.environment["MIRACLE_SUPABASE_URL"] ?? "https://zyvfamlhlmztliexvmej.supabase.co")!
    public static let publishableKey = ProcessInfo.processInfo.environment["MIRACLE_SUPABASE_KEY"] ?? "sb_publishable_qroW231Ts7UYAEgr_f5cnQ_3SrW2ZrI"
}

public struct MiracleSessionToken: Sendable, Equatable {
    public let accessToken: String
    public let refreshToken: String
    public let expiresAt: Date
}

/// Minimal Supabase password session. Passwords are used only for the login request; tokens are
/// kept in memory and the refresh token is stored by the existing Keychain bridge.
public actor MiracleSession {
    private let transport: URLSession
    private var token: MiracleSessionToken?
    public init(transport: URLSession = .shared) { self.transport = transport }
    public func current() -> MiracleSessionToken? { token }
    public func login(email: String, password: String) async throws -> MiracleSessionToken {
        var request = URLRequest(url: MiracleCloud.url.appendingPathComponent("auth/v1/token?grant_type=password"))
        request.httpMethod = "POST"; request.setValue(MiracleCloud.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "password": password])
        let (data, response) = try await transport.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw AgentError.unavailable("Miracle no respondió con HTTP.") }
        guard (200..<300).contains(http.statusCode), let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let access = json["access_token"] as? String else {
            throw AgentError.backend(http.statusCode)
        }
        let refresh = json["refresh_token"] as? String ?? ""
        let expires = Date().addingTimeInterval(json["expires_in"] as? Double ?? 3600)
        let value = MiracleSessionToken(accessToken: access, refreshToken: refresh, expiresAt: expires)
        token = value
        return value
    }
    public func logout() { token = nil }
}
