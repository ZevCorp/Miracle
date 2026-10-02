import Foundation
import UCore

public final class PortalClient: @unchecked Sendable {
    private let token: String
    private let transport: URLSession
    public init(accessToken: String, transport: URLSession = .shared) { self.token = accessToken; self.transport = transport }

    public func mirror(encounterID: String, note: ClinicalNote, transcript: String, template: String = OpenClinicalTemplate.name, specialty: String = "medicina_general") async -> Bool {
        let sections = note.sections.map { ["id": $0.id, "titulo": $0.title, "kind": "texto", "texto": $0.text] }
        var body: [String: Any] = ["id": encounterID, "patient_id": NSNull(), "servicio": "Consulta externa", "especialidad": specialty, "tipo": "presencial", "estado": "borrador", "motivo": note.summary, "fecha": ISO8601DateFormatter().string(from: .now), "duracion_min": 0, "plantilla": template, "resumen": note.summary, "note": sections, "codigos": []]
        body["transcript"] = transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? [] : [["t": "", "texto": transcript.trimmingCharacters(in: .whitespacesAndNewlines)]]
        do { _ = try await request(path: "rest/v1/consultations?on_conflict=id", method: "POST", body: body, prefer: "resolution=merge-duplicates,return=minimal"); return true }
        catch { return false }
    }

    public func recent(limit: Int = 25) async -> [ClinicalEncounter] {
        do {
            let root = try await requestArray(path: "rest/v1/consultations?select=id,fecha,motivo,estado,resumen,plantilla&order=fecha.desc&limit=\(max(1, min(limit, 100)))")
            return root.compactMap { json in
                guard let id = json["id"] as? String else { return nil }
                let summary = json["resumen"] as? String ?? json["motivo"] as? String ?? ""
                return ClinicalEncounter(id: id, status: json["estado"] as? String ?? "borrador", note: ClinicalNote(summary: summary))
            }
        } catch { return [] }
    }

    private func request(path: String, method: String, body: [String: Any], prefer: String? = nil) async throws -> Data {
        var request = URLRequest(url: MiracleCloud.url.appendingPathComponent(path)); request.httpMethod = method
        request.setValue(MiracleCloud.publishableKey, forHTTPHeaderField: "apikey"); request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization"); request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let prefer { request.setValue(prefer, forHTTPHeaderField: "Prefer") }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await transport.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { throw AgentError.backend((response as? HTTPURLResponse)?.statusCode ?? 0) }
        return data
    }
    private func requestArray(path: String) async throws -> [[String: Any]] {
        var request = URLRequest(url: MiracleCloud.url.appendingPathComponent(path)); request.httpMethod = "GET"; request.setValue(MiracleCloud.publishableKey, forHTTPHeaderField: "apikey"); request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await transport.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { throw AgentError.backend((response as? HTTPURLResponse)?.statusCode ?? 0) }
        return try JSONSerialization.jsonObject(with: data) as? [[String: Any]] ?? []
    }
}
