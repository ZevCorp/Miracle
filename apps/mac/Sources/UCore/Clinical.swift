import Foundation

public struct ClinicalTemplate: Codable, Equatable, Sendable {
    public let id: String
    public let name: String
    public let specialty: String
    public let isDefault: Bool
    public init(id: String, name: String, specialty: String, isDefault: Bool = false) {
        self.id = id; self.name = name; self.specialty = specialty; self.isDefault = isDefault
    }
}

public struct ClinicalSection: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let title: String
    public let text: String
    public init(id: String, title: String, text: String) {
        self.id = id; self.title = title; self.text = text
    }
}

public struct ClinicalNote: Codable, Equatable, Sendable {
    public let summary: String
    public let sections: [ClinicalSection]
    public let warnings: [String]
    public init(summary: String = "", sections: [ClinicalSection] = [], warnings: [String] = []) {
        self.summary = summary; self.sections = sections; self.warnings = warnings
    }
}

public struct ClinicalEncounter: Codable, Equatable, Sendable {
    public let id: String
    public let status: String
    public let transcript: String
    public let note: ClinicalNote?
    public init(id: String, status: String, transcript: String = "", note: ClinicalNote? = nil) {
        self.id = id; self.status = status; self.transcript = transcript; self.note = note
    }
}

public enum ConsultationState: Equatable, Sendable {
    case idle, recording, savingTranscript, generatingNote, noteReady, failed(String)
}

public enum ClinicalError: Error, LocalizedError, Equatable, Sendable {
    case unauthenticated
    case emptyTranscript
    case missingEncounter
    case backend(code: String, message: String)
    public var errorDescription: String? {
        switch self {
        case .unauthenticated: return "Inicia sesión con tu cuenta de Miracle antes de grabar."
        case .emptyTranscript: return "El dictado estaba conectado pero no llegó ni una palabra. Revisa el micrófono y vuelve a intentarlo."
        case .missingEncounter: return "La consulta no tiene un identificador válido."
        case .backend(_, let message): return message
        }
    }
}

/// The clinical boundary. The UI and state machine never know HTTP routes or JSON details.
public protocol ClinicalAPI: Sendable {
    func templates(specialty: String?) async throws -> [ClinicalTemplate]
    func createTemplate(name: String, specialty: String) async throws -> ClinicalTemplate
    func createEncounter(templateID: String) async throws -> String
    func saveTranscript(encounterID: String, transcript: String) async throws -> Int
    func generateNote(encounterID: String) async throws -> ClinicalNote
    func encounter(encounterID: String) async throws -> ClinicalEncounter
}

/// HTTP implementation of the portal contract. Authentication is injected so the public client
/// never stores or invents a password; the account/session layer can refresh the bearer token.
public final class ClinicalHTTPClient: ClinicalAPI, @unchecked Sendable {
    private let baseURL: URL
    private let bearer: String
    private let transport: URLSession
    public init(baseURL: URL, bearerToken: String, transport: URLSession = .shared) throws {
        guard baseURL.scheme == "https", baseURL.host != nil else { throw AgentError.invalid("La dirección del portal debe ser HTTPS.") }
        self.baseURL = baseURL; self.bearer = bearerToken; self.transport = transport
    }
    public func templates(specialty: String?) async throws -> [ClinicalTemplate] {
        var components = URLComponents(url: baseURL.appendingPathComponent("api/clinical/templates"), resolvingAgainstBaseURL: false)!
        if let specialty, !specialty.isEmpty { components.queryItems = [URLQueryItem(name: "specialty", value: specialty)] }
        let root = try await request(url: components.url!, method: "GET", body: nil)
        let array = root["templates"] as? [[String: Any]] ?? []
        return array.compactMap { json in
            guard let id = json["id"] as? String, let name = json["name"] as? String else { return nil }
            return ClinicalTemplate(id: id, name: name, specialty: json["specialty"] as? String ?? "", isDefault: json["is_default"] as? Bool ?? false)
        }
    }
    public func createTemplate(name: String, specialty: String) async throws -> ClinicalTemplate {
        let root = try await request(path: "api/clinical/templates", method: "POST", body: ["name": name, "specialty": specialty, "description": "Plantilla abierta: la estructura la pone el organizador, no el médico.", "sections": OpenClinicalTemplate.sections])
        let json = root["template"] as? [String: Any] ?? root
        guard let id = json["id"] as? String else { throw ClinicalError.backend(code: "MISSING_ID", message: "El portal no devolvió la plantilla creada.") }
        return ClinicalTemplate(id: id, name: json["name"] as? String ?? name, specialty: json["specialty"] as? String ?? specialty)
    }
    public func createEncounter(templateID: String) async throws -> String {
        let root = try await request(path: "api/clinical/encounters", method: "POST", body: ["patient_id": NSNull(), "consultation_type": "presencial", "template_id": templateID])
        guard let id = root["encounter_id"] as? String else { throw ClinicalError.backend(code: "MISSING_ID", message: "El portal no devolvió la consulta creada.") }
        return id
    }
    public func saveTranscript(encounterID: String, transcript: String) async throws -> Int {
        let root = try await request(path: "api/clinical/encounters/\(encounterID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? encounterID)/transcript", method: "POST", body: ["transcript": transcript])
        return root["transcript_length"] as? Int ?? transcript.count
    }
    public func generateNote(encounterID: String) async throws -> ClinicalNote {
        let root = try await request(path: "api/clinical/encounters/\(encounterID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? encounterID)/generate-note", method: "POST", body: [:])
        let json = root["note_json"] as? [String: Any] ?? root
        return ClinicalNote.from(json: json)
    }
    public func encounter(encounterID: String) async throws -> ClinicalEncounter {
        let root = try await request(path: "api/clinical/encounters/\(encounterID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? encounterID)", body: nil)
        let json = root["encounter"] as? [String: Any] ?? root
        return ClinicalEncounter(id: json["id"] as? String ?? encounterID, status: json["status"] as? String ?? "", transcript: json["transcript"] as? String ?? "", note: (json["note_json"] as? [String: Any]).map(ClinicalNote.from))
    }
    private func request(url: URL) async throws -> [String: Any] { try await request(url: url, method: "GET", body: nil) }
    private func request(path: String, method: String = "GET", body: [String: Any]?) async throws -> [String: Any] {
        try await request(url: baseURL.appendingPathComponent(path), method: method, body: body)
    }
    private func request(url: URL, method: String = "GET", body: [String: Any]?) async throws -> [String: Any] {
        guard !bearer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw ClinicalError.unauthenticated }
        var request = URLRequest(url: url); request.httpMethod = method; request.timeoutInterval = 90
        request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization"); request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body) }
        let (data, response) = try await transport.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw ClinicalError.backend(code: "NO_HTTP", message: "El portal no respondió con HTTP.") }
        guard (200..<300).contains(http.statusCode) else {
            let error = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? [String: Any]
            throw ClinicalError.backend(code: error?["code"] as? String ?? "HTTP_\(http.statusCode)", message: error?["message"] as? String ?? "El portal respondió HTTP \(http.statusCode).")
        }
        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw ClinicalError.backend(code: "INVALID_JSON", message: "El portal devolvió una respuesta ilegible.") }
        return root
    }
}

private extension ClinicalNote {
    static func from(json: [String: Any]) -> ClinicalNote {
        let sections = (json["sections"] as? [[String: Any]] ?? json["note"] as? [[String: Any]] ?? []).compactMap { item -> ClinicalSection? in
            let id = item["id"] as? String ?? item["key"] as? String ?? UUID().uuidString
            let title = item["title"] as? String ?? item["titulo"] as? String ?? item["label"] as? String ?? "Sección"
            let text = item["text"] as? String ?? item["texto"] as? String ?? item["content"] as? String ?? item["contenido"] as? String ?? ""
            return ClinicalSection(id: id, title: title, text: text)
        }
        return ClinicalNote(summary: json["summary"] as? String ?? json["resumen"] as? String ?? "", sections: sections, warnings: json["warnings"] as? [String] ?? json["avisos"] as? [String] ?? [])
    }
}

private extension OpenClinicalTemplate {
    static let sections: [[String: Any]] = [
        ["label": "Nota", "order": 1, "instruction": "Organiza lo dicho en la consulta sin inventar datos."],
        ["label": "Hallazgos y datos objetivos", "order": 2, "instruction": "Incluye solo signos, medidas y resultados mencionados."],
        ["label": "Plan y recomendaciones", "order": 3, "instruction": "Incluye medicamentos, estudios y controles tal como se dijeron."]
    ]
}

public enum OpenClinicalTemplate {
    public static let name = "Nota abierta (Ü)"
    public static let specialty = "medicina_general"
    public static func find(in templates: [ClinicalTemplate]) -> ClinicalTemplate? {
        templates.first { $0.name.trimmingCharacters(in: .whitespacesAndNewlines).compare(name, options: [.caseInsensitive, .diacriticInsensitive]) == .orderedSame }
    }
}

/// Consultation lifecycle. Every irreversible side effect is behind an injected closure.
@MainActor
public final class ConsultationSession {
    public private(set) var state: ConsultationState = .idle
    public private(set) var encounterID = ""
    public private(set) var transcript = ""
    public private(set) var note: ClinicalNote?
    public private(set) var portalVisible = false
    public private(set) var failure: ClinicalError?
    public var onChange: ((ConsultationState) -> Void)?

    private let api: ClinicalAPI
    private let authenticated: () -> Bool
    private let beginDictation: () async throws -> Bool
    private let stopDictation: () async -> String
    private let mirror: ((String, ClinicalNote, String) async -> Bool)?

    public init(api: ClinicalAPI, authenticated: @escaping () -> Bool,
                beginDictation: @escaping () async throws -> Bool,
                stopDictation: @escaping () async -> String,
                mirror: ((String, ClinicalNote, String) async -> Bool)? = nil) {
        self.api = api; self.authenticated = authenticated; self.beginDictation = beginDictation
        self.stopDictation = stopDictation; self.mirror = mirror
    }

    @discardableResult
    public func start(templateID: String) async -> Bool {
        guard authenticated() else { return fail(.unauthenticated) }
        guard state != .recording && state != .generatingNote else { return false }
        do {
            let id = try await api.createEncounter(templateID: templateID)
            guard !id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return fail(.backend(code: "MISSING_ID", message: "Miracle no devolvió el identificador de la consulta.")) }
            guard try await beginDictation() else { return fail(.backend(code: "TRANSCRIPTION_UNAVAILABLE", message: "No se pudo abrir el dictado. Comprueba la red y vuelve a intentarlo.")) }
            encounterID = id; transcript = ""; note = nil; failure = nil; portalVisible = false
            transition(.recording); return true
        } catch let error as ClinicalError { return fail(error) }
        catch { return fail(.backend(code: "START_FAILED", message: "No se pudo abrir la consulta: \(error.localizedDescription)")) }
    }

    public func stop() async {
        guard state == .recording else { return }
        let words = await stopDictation().trimmingCharacters(in: .whitespacesAndNewlines)
        guard !words.isEmpty else { _ = fail(.emptyTranscript); return }
        transcript = words; transition(.savingTranscript)
        do {
            _ = try await api.saveTranscript(encounterID: encounterID, transcript: words)
            transition(.generatingNote)
            let generated = try await api.generateNote(encounterID: encounterID)
            note = generated
            portalVisible = mirror == nil ? false : await mirror!(encounterID, generated, words)
            transition(.noteReady)
        } catch let error as ClinicalError { _ = fail(error) }
        catch { _ = fail(.backend(code: "NOTE_FAILED", message: "No se pudo organizar la nota: \(error.localizedDescription)")) }
    }

    @discardableResult
    public func retryNote() async -> Bool {
        guard case .failed = state, !encounterID.isEmpty else { return false }
        do {
            transition(.generatingNote)
            let generated = try await api.generateNote(encounterID: encounterID)
            note = generated; portalVisible = mirror == nil ? false : await mirror!(encounterID, generated, transcript)
            failure = nil; transition(.noteReady); return true
        } catch let error as ClinicalError { return fail(error) }
        catch { return fail(.backend(code: "NOTE_FAILED", message: "No se pudo reintentar la nota: \(error.localizedDescription)")) }
    }

    public func reset() {
        encounterID = ""; transcript = ""; note = nil; failure = nil; portalVisible = false; transition(.idle)
    }

    @discardableResult private func fail(_ error: ClinicalError) -> Bool {
        failure = error; transition(.failed(error.localizedDescription)); return false
    }
    private func transition(_ next: ConsultationState) { state = next; onChange?(next) }
}
