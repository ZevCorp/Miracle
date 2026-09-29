import Foundation

/// Windows ReglaDelHalo, sized for the native Mac face. No desktop or animation timer.
public struct VoiceHalo: Sendable {
    public static let faceSize = 66.0
    public static let padding = 26.0
    public static let panelSize = faceSize + 2 * padding
    public let diameter: Double
    public let opacity: Double
    public init(active: Bool, level: Double, time: Double) {
        let safeLevel = level.isFinite ? max(0, min(1, level)) : 0
        let force = safeLevel > 0.004 ? min(1, pow(safeLevel, 0.55) * 1.45) : 0.18 + 0.10 * sin(time * 2.56)
        diameter = Self.faceSize * (1.12 + force * 0.43)
        opacity = active ? 0.50 + force * 0.42 : 0
    }
}
