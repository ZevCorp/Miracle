import Foundation

/// How much Luna may spend in a day on this Mac (asked by the user, 2026-10-02: testers share one
/// provider key). Only Luna is counted: the live voice and Jev have no cap. The count is per Mac and
/// per calendar day, and it is the provider that says how many tokens each turn took.
public struct LunaBudget: Equatable, Sendable {
    public static let dailyTokens = 10_000_000
    public static let refusal = "Luna llegó a su tope de hoy (10 millones de tokens). Mañana vuelve a estar disponible; mientras tanto puedo seguir conversando contigo. Díselo a la persona y no llames más herramientas."

    public private(set) var day: String
    public private(set) var used: Int
    public init(day: String = "", used: Int = 0) { self.day = day; self.used = max(0, used) }

    /// A new day starts from zero; a count the provider did not send, or a negative one, adds nothing.
    public mutating func add(_ tokens: Int?, on today: String) {
        if day != today { day = today; used = 0 }
        if let tokens, tokens > 0 { used += tokens }
    }
    public func exhausted(on today: String) -> Bool { day == today && used >= Self.dailyTokens }
    public func remaining(on today: String) -> Int { day == today ? max(0, Self.dailyTokens - used) : Self.dailyTokens }

    /// Tokens of one finished Luna turn, as the Responses API reports them inside a Live event.
    public static func tokens(in event: [String: Any]) -> Int? {
        guard event["type"] as? String == "response.completed",
              let usage = (event["response"] as? [String: Any])?["usage"] as? [String: Any] else { return nil }
        if let total = usage["total_tokens"] as? Int { return total }
        let parts = [usage["input_tokens"] as? Int, usage["output_tokens"] as? Int].compactMap { $0 }
        return parts.isEmpty ? nil : parts.reduce(0, +)
    }

    public static func day(_ date: Date, calendar: Calendar = .current) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
}
