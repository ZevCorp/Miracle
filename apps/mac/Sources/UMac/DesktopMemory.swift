import Foundation
import Combine
import UCore

/// Bridges transient AX ids to durable, unambiguous identities. Disk work never blocks a click.
@MainActor
public final class DesktopMemory: ObservableObject {
    @Published public private(set) var revision: UInt64 = 0
    private let store: MemoryStore
    private let loading: Task<NavigationMemory, Error>
    private var loaded = false
    private var saveTask: Task<Void, Never>?
    public private(set) var graph = NavigationMemory()
    public private(set) var error: String?
    public init(url: URL? = nil) {
        let location = url ?? URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Library/Application Support/U Mac/memory.json")
        let store = MemoryStore(url: location); self.store = store
        loading = Task { try await store.load() }
        Task { [weak self] in
            do { try await self?.prepare() } catch { self?.error = "No pude cargar la memoria: \(error.localizedDescription)" }
        }
    }
    public func prepare() async throws {
        guard !loaded else { return }
        let restored = try await loading.value
        // Multiple tools may await the same load. Only the first installs the snapshot.
        if !loaded { graph = restored; loaded = true; revision &+= 1 }
    }
    public static func surface(_ snapshot: DesktopSnapshot) -> String {
        if let url = snapshot.documentURL, let host = url.host { return "web://" + host + url.path }
        return "mac://" + snapshot.bundleID + "/" + snapshot.title
    }
    public func observe(_ snapshot: DesktopSnapshot) {
        guard loaded else { return }
        let surface = Self.surface(snapshot)
        let elements = snapshot.controls.filter { !$0.identity.isEmpty && !$0.target.label.isEmpty && $0.value != "[protegido]" }
            .map { MemoryElement(selector: $0.identity, label: $0.target.label, role: $0.target.role) }
        graph.arrive(at: surface); graph.observe(surface: surface, elements: elements)
    }
    public func teach(_ query: String, meaning: String, snapshot: DesktopSnapshot) async throws -> String {
        try await prepare(); observe(snapshot)
        let target = try TargetResolver.resolve(query, in: snapshot.controls.map(\.target))
        guard let control = snapshot.controls.first(where: { $0.target.id == target.id }),
              graph.isLive(surface: Self.surface(snapshot), selector: control.identity) else { throw AgentError.ambiguous(query) }
        try graph.teach(surface: Self.surface(snapshot), selector: control.identity, meaning: meaning, at: Date())
        // Explicit teaching is acknowledged only after the durable write succeeds.
        try await store.save(graph)
        revision &+= 1
        return "Recuerdo guardado sobre «\(target.label)»: \(meaning)"
    }
    public func forget(surface: String, selector: String) async throws {
        try await prepare()
        var updated = graph; updated.forget(surface: surface, selector: selector)
        try await store.save(updated); graph = updated; revision &+= 1
    }
    public func describe(snapshot: DesktopSnapshot) async throws -> String {
        try await prepare(); observe(snapshot)
        let surface = Self.surface(snapshot)
        let entries = graph.entries(surface: surface).filter { $0.meaning != nil }
        if entries.isEmpty { return "No hay recuerdos enseñados en esta pantalla." }
        return entries.map { entry in
            "\(graph.isLive(surface: surface, selector: entry.selector) ? "visible" : "recordado, no visible"): \(entry.element.label) — \(entry.meaning ?? "")"
        }.joined(separator: "\n")
    }
    public func transition(from: DesktopSnapshot, control: AccessibleControl, to: DesktopSnapshot) {
        guard loaded else { return }
        let source = Self.surface(from), destination = Self.surface(to)
        guard source != destination else { return }
        do { try graph.recordTransition(from: source, selector: control.identity, to: destination); saveSoon() }
        catch { self.error = error.localizedDescription }
    }
    private func saveSoon() {
        guard saveTask == nil else { return }
        saveTask = Task { [weak self] in
            guard let self else { return }
            defer { self.saveTask = nil }
            do {
                repeat {
                    try await Task.sleep(for: .milliseconds(500))
                    let revision = self.graph.revision
                    try await self.store.save(self.graph)
                    if self.graph.revision == revision { break }
                } while !Task.isCancelled
            } catch { self.error = "No pude guardar la memoria: \(error.localizedDescription)" }
        }
    }
}
