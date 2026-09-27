import Foundation

public struct NotchLayout: Sendable {
    public let width: Double
    public let height: Double
    public init(expanded: Bool, availableWidth: Double, availableHeight: Double) {
        width = min(420, max(0, availableWidth - 16))
        height = min(expanded ? 390 : 66, max(0, availableHeight - 16))
    }
}
