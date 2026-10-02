import Foundation

/// Graph's learning session, the same four calls the Windows client makes (windows-graph GraphClient):
/// open the session, send each step in order, add what was said, and finish. The session id always
/// travels in the path: Graph runs serverless and keeps no "active session" between requests.
public final class LearningClient: @unchecked Sendable {
    /// Finishing structures the workflow on the server and can take long: Windows waits 90 s.
    public static let timeout: TimeInterval = 90
    /// Finish is retried on these, after 3 s and after 8 s; then the finish stays pending.
    public static let retryable: Set<Int> = [0, 408, 429, 502, 503, 504]
    public static let retryDelays: [Double] = [3, 8]

    public struct Finished: Sendable, Equatable {
        public let workflowId: String
        public let summary: String
        public let name: String?
        public init(workflowId: String, summary: String, name: String?) { self.workflowId = workflowId; self.summary = summary; self.name = name }
    }

    public enum Failure: Error, Equatable {
        /// The steps are saved; only the finish is missing. It is retried on the next launch.
        case finishPending(session: String)
        case rejected(Int, String?)
        case malformed(String)
    }

    private let graph: GraphClient
    private let transport: URLSession
    private let sleep: @Sendable (Double) async throws -> Void

    public init(graph: GraphClient, transport: URLSession = .shared,
                sleep: @escaping @Sendable (Double) async throws -> Void = { try await Task.sleep(for: .seconds($0)) }) {
        self.graph = graph; self.transport = transport; self.sleep = sleep
    }

    private func post(_ path: String, _ body: Data) async throws -> (Int, [String: Any]) {
        var request = try graph.request(path: path, body: body)
        request.timeoutInterval = Self.timeout
        request.setValue("teach", forHTTPHeaderField: "X-Miracle-Feature")
        let data: Data, response: URLResponse
        do { (data, response) = try await transport.data(for: request) }
        catch is CancellationError { throw CancellationError() }
        catch { return (0, [:]) }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        return (status, json)
    }

    private func require(_ path: String, _ body: Data) async throws -> [String: Any] {
        let (status, json) = try await post(path, body)
        guard (200..<300).contains(status) else { throw Failure.rejected(status, json["error"] as? String) }
        return json
    }

    private static func escape(_ id: String) -> String { id.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: "-_"))) ?? id }

    /// Opens the session. Its id IS the workflow id.
    public func open(description: String, app: String, title: String) async throws -> String {
        let body: [String: Any] = ["description": description.isEmpty ? "Workflow sin descripción" : description,
                                   "app_id": app, "source_url": "", "source_origin": "", "source_pathname": "",
                                   "source_title": title, "context": ["surface": app, "platform": "macos"]]
        let json = try await require("learning/sessions", try JSONSerialization.data(withJSONObject: body))
        guard let session = json["session"] as? [String: Any], let id = session["id"] as? String, !id.isEmpty else {
            throw Failure.malformed("Graph no devolvió un id de sesión.")
        }
        return id
    }

    /// Sends one step; returns its order in the session.
    @discardableResult
    public func step(_ step: LearningStep, session: String) async throws -> Int {
        let json = try await require("learning/sessions/\(Self.escape(session))/steps", try JSONEncoder().encode(step))
        return (json["step"] as? [String: Any])?["step_order"] as? Int ?? 0
    }

    public func context(_ transcript: String, session: String) async throws {
        let body: [String: Any] = ["note": ["role": "clinical_context", "transcript": transcript, "mode": "training"]]
        _ = try await require("learning/sessions/\(Self.escape(session))/context-notes", try JSONSerialization.data(withJSONObject: body))
    }

    /// Closes the session: Graph structures and stores the workflow, and names it.
    public func finish(session: String) async throws -> Finished {
        let path = "learning/sessions/\(Self.escape(session))/finish"
        var attempt = 0
        while true {
            let (status, json) = try await post(path, Data("{}".utf8))
            if (200..<300).contains(status) {
                let workflow = json["workflow"] as? [String: Any]
                // Graph names a workflow by its description; an untitled demo keeps the placeholder.
                let name = [workflow?["name"], workflow?["title"], workflow?["description"]].compactMap { $0 as? String }
                    .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .first { !$0.isEmpty && $0 != "Workflow sin descripción" }
                return Finished(workflowId: json["workflow_id"] as? String ?? session, summary: json["summary"] as? String ?? "",
                                name: name?.isEmpty == false ? name : nil)
            }
            guard Self.retryable.contains(status) else { throw Failure.rejected(status, json["error"] as? String) }
            guard attempt < Self.retryDelays.count else { throw Failure.finishPending(session: session) }
            try await sleep(Self.retryDelays[attempt])
            attempt += 1
        }
    }
}

/// Finishes that Graph did not complete in time. Windows PendingFinish: the steps are safe on the
/// server; the finish is asked again on the next launch.
public struct PendingFinishes: Sendable {
    public struct Entry: Codable, Sendable, Equatable {
        public let session: String
        public let savedAt: Date
        public init(session: String, savedAt: Date) { self.session = session; self.savedAt = savedAt }
    }
    public let url: URL
    public init(url: URL) { self.url = url }
    public func load() -> [Entry] {
        guard let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode([Entry].self, from: data)) ?? []
    }
    public func save(_ entries: [Entry]) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        if entries.isEmpty { try? FileManager.default.removeItem(at: url); return }
        try JSONEncoder().encode(entries).write(to: url, options: .atomic)
    }
    public func add(_ session: String, at date: Date = Date()) throws {
        var all = load().filter { $0.session != session }
        all.append(Entry(session: session, savedAt: date))
        try save(all)
    }
    public func remove(_ session: String) throws { try save(load().filter { $0.session != session }) }
}

/// Where lessons are kept: one folder per demo with its leccion.json (Windows LeccionEnDisco).
public struct LessonStore: Sendable {
    public let root: URL
    public init(root: URL) { self.root = root }
    public static func folderName(_ date: Date) -> String {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyyMMdd_HHmmss"
        return "leccion_" + f.string(from: date)
    }
    @discardableResult
    public func save(_ lesson: Lesson) throws -> URL {
        let folder = root.appendingPathComponent(Self.folderName(lesson.started))
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]; encoder.dateEncodingStrategy = .iso8601
        let file = folder.appendingPathComponent("leccion.json")
        try encoder.encode(lesson).write(to: file, options: .atomic)
        return file
    }
    public func latest() -> Lesson? {
        guard let folders = try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil) else { return nil }
        guard let last = folders.filter({ $0.lastPathComponent.hasPrefix("leccion_") }).map(\.lastPathComponent).sorted().last else { return nil }
        let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
        return (try? Data(contentsOf: root.appendingPathComponent(last).appendingPathComponent("leccion.json"))).flatMap { try? decoder.decode(Lesson.self, from: $0) }
    }
}
