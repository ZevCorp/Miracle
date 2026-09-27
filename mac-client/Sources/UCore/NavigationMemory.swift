import Foundation

public struct MemoryElement: Codable, Sendable, Equatable {
    public let selector: String
    public let label: String
    public let role: String
    public init(selector: String, label: String, role: String) { self.selector = selector; self.label = label; self.role = role }
}

/// Knowledge survives an observation. Liveness never survives a restart.
public struct NavigationMemory: Codable, Sendable {
    public struct Entry: Codable, Sendable, Equatable {
        public let element: MemoryElement
        public var meaning: String?
        public var learnedAt: Date?
        public var destination: String?
        public var selector: String { element.selector }
    }
    private var surfaces: [String: [String: Entry]] = [:]
    private var live: [String: Set<String>] = [:]
    public private(set) var currentSurface = ""
    public private(set) var revision: UInt64 = 0
    public init() {}
    private enum CodingKeys: String, CodingKey { case schema, surfaces }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        guard try values.decode(Int.self, forKey: .schema) == 1 else { throw AgentError.invalid("Versión de memoria no compatible. Se conserva el archivo original.") }
        surfaces = try values.decode([String: [String: Entry]].self, forKey: .surfaces)
    }
    public func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(1, forKey: .schema); try values.encode(surfaces, forKey: .surfaces)
    }
    public mutating func arrive(at surface: String) { if !surface.isEmpty { currentSurface = surface } }
    public mutating func observe(surface: String, elements: [MemoryElement]) {
        guard !surface.isEmpty else { return }
        // Duplicate identities cannot be recalled safely. Their live AX ids remain usable separately.
        let groups = Dictionary(grouping: elements.filter { !$0.selector.isEmpty }, by: \.selector)
        live[surface] = Set(groups.filter { $0.value.count == 1 }.keys)
        for (selector, matches) in groups where matches.count == 1 {
            let old = surfaces[surface]?[selector]
            let entry = Entry(element: matches[0], meaning: old?.meaning, learnedAt: old?.learnedAt, destination: old?.destination)
            if old != entry { surfaces[surface, default: [:]][selector] = entry; revision &+= 1 }
        }
    }
    public func isLive(surface: String, selector: String) -> Bool { live[surface]?.contains(selector) == true }
    public func entries(surface: String) -> [Entry] { (surfaces[surface] ?? [:]).values.sorted { $0.selector < $1.selector } }
    public var knownSurfaces: [String] { surfaces.keys.sorted() }
    public mutating func teach(surface: String, selector: String, meaning: String, at date: Date) throws {
        guard var entry = surfaces[surface]?[selector] else { throw AgentError.invalid("No se puede enseñar un control que nunca se observó.") }
        let text = meaning.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, text.count <= 2000 else { throw AgentError.invalid("El recuerdo debe tener entre 1 y 2000 caracteres.") }
        entry.meaning = text; entry.learnedAt = date
        surfaces[surface]?[selector] = entry; revision &+= 1
    }
    public mutating func forget(surface: String, selector: String) {
        guard var entry = surfaces[surface]?[selector] else { return }
        entry.meaning = nil; entry.learnedAt = nil; surfaces[surface]?[selector] = entry; revision &+= 1
    }
    public mutating func recordTransition(from: String, selector: String, to: String) throws {
        guard var entry = surfaces[from]?[selector] else { throw AgentError.invalid("La transición no tiene un control observado.") }
        guard !to.isEmpty, to != from else { return }
        if entry.destination != to { entry.destination = to; surfaces[from]?[selector] = entry; revision &+= 1 }
    }
    public func nextStep(from: String, to: String) -> MemoryElement? {
        guard from != to else { return nil }
        var visited: Set<String> = [from], queue: [(String, MemoryElement?)] = [(from, nil)], index = 0
        while index < queue.count, index < 10000 {
            let (surface, first) = queue[index]; index += 1
            for entry in entries(surface: surface) {
                guard let destination = entry.destination else { continue }
                if first == nil && !isLive(surface: from, selector: entry.selector) { continue }
                let step = first ?? entry.element
                if destination == to { return step }
                if visited.insert(destination).inserted { queue.append((destination, step)) }
            }
        }
        return nil
    }
}

/// Serialized atomic persistence, separate from the decision model and the action's critical path.
public actor MemoryStore {
    private let url: URL
    public init(url: URL) { self.url = url }
    public func load() throws -> NavigationMemory {
        guard FileManager.default.fileExists(atPath: url.path) else { return NavigationMemory() }
        return try JSONDecoder().decode(NavigationMemory.self, from: Data(contentsOf: url))
    }
    public func save(_ memory: NavigationMemory) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        try encoder.encode(memory).write(to: url, options: .atomic)
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
    }
}
