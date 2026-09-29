import Foundation

public struct ConversationMessage: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public var text: String
    public let user: Bool
    public init(id: UUID = UUID(), text: String, user: Bool) {
        self.id = id; self.text = text; self.user = user
    }
}

/// Explicit errors prevent corrupt history being silently replaced with an empty chat.
public struct ConversationArchive: Sendable {
    public let url: URL
    public init(url: URL) { self.url = url }
    public func load() throws -> [ConversationMessage] {
        guard FileManager.default.fileExists(atPath: url.path) else { return [] }
        return try JSONDecoder().decode([ConversationMessage].self, from: Data(contentsOf: url))
    }
    public func save(_ messages: [ConversationMessage]) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true,
                                                attributes: [.posixPermissions: 0o700])
        let data = try JSONEncoder().encode(messages)
        try data.write(to: url, options: .atomic)
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
    }
}
