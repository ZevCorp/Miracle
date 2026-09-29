import Foundation

public final class GraphClient: @unchecked Sendable {
    public static let defaultURL = "https://graph-eight-pied.vercel.app"
    /// A desktop interaction must fail visibly instead of leaving the assistant loading for minutes.
    public static let requestTimeout: TimeInterval = 20
    private let base: URL
    private let apiKey: String
    private let transport: URLSession
    public init(baseURL: String = defaultURL, apiKey: String, transport: URLSession = .shared) throws {
        guard let url = URL(string: baseURL), url.scheme == "https", url.host != nil,
              url.user == nil, url.password == nil, url.query == nil, url.fragment == nil else {
            throw AgentError.invalid("La dirección de Graph debe ser HTTPS y no contener credenciales.")
        }
        self.base = url; self.apiKey = apiKey.trimmingCharacters(in: .whitespacesAndNewlines); self.transport = transport
    }
    public func request(path: String, body: Data? = nil) throws -> URLRequest {
        guard !apiKey.isEmpty else { throw AgentError.invalid("Añade tu credencial de Graph en Configuración.") }
        var request = URLRequest(url: base.appendingPathComponent("api/v1").appendingPathComponent(path))
        request.httpMethod = body == nil ? "GET" : "POST"
        request.httpBody = body
        request.timeoutInterval = Self.requestTimeout
        request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("mac_app", forHTTPHeaderField: "X-Miracle-App")
        request.setValue("conscious_bridge", forHTTPHeaderField: "X-Miracle-Feature")
        return request
    }
    public func data(path: String, body: Data? = nil) async throws -> Data {
        let data: Data, response: URLResponse
        do {
            (data, response) = try await transport.data(for: request(path: path, body: body))
        } catch let error as URLError where error.code == .timedOut {
            throw AgentError.unavailable("Graph no respondió en 20 segundos. La tarea se detuvo; puedes volver a intentarlo.")
        }
        try Task.checkCancellation()
        guard let http = response as? HTTPURLResponse else { throw AgentError.unavailable("Graph no entregó una respuesta HTTP.") }
        guard (200..<300).contains(http.statusCode) else {
            // Graph emits a short public diagnostic on server failures. Never include arbitrary
            // response data (which might contain a key or a screen fragment) in the UI.
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            let safe = message?.trimmingCharacters(in: .whitespacesAndNewlines)
            if http.statusCode >= 500, let safe, !safe.isEmpty {
                throw AgentError.unavailable("Graph respondió HTTP \(http.statusCode): \(String(safe.prefix(300)))")
            }
            throw AgentError.backend(http.statusCode)
        }
        return data
    }
    public func turn(_ value: TurnRequest) async throws -> TurnResponse {
        let bytes = try await data(path: "agent/turn", body: JSONEncoder().encode(value))
        let response = try JSONDecoder().decode(TurnResponse.self, from: bytes)
        if response.error != nil { throw AgentError.unavailable("Graph no pudo resolver este turno.") }
        return response
    }
    public func voiceKey() async throws -> String {
        let keys = try await providerKeys()
        guard let key = keys.openai, !key.isEmpty else { throw AgentError.unavailable("Graph no tiene configurada la credencial de voz.") }
        return key
    }
    public struct ProviderKeys: Decodable, Sendable { public let openai: String?; public let typesafe: String? }
    public func providerKeys() async throws -> ProviderKeys {
        try JSONDecoder().decode(ProviderKeys.self, from: await data(path: "agent/claves"))
    }
}
