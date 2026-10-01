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

/// When macOS refuses voice processing there is no echo cancellation: through open speakers the
/// microphone hears Ü's own voice and Live answers itself or cuts itself off. While Ü is audibly
/// speaking, and for a short tail, the microphone is sent as silence. With headphones there is no
/// echo, so the person can still interrupt by voice. Pure: the audio engine asks this.
public enum EchoGuard {
    /// The room keeps ringing a moment after the last sample is played.
    public static let tail = 0.35
    public static func silences(voiceProcessing: Bool, openSpeaker: Bool, playing: Bool, sinceLastPlayback: Double) -> Bool {
        guard !voiceProcessing, openSpeaker else { return false }
        return playing || sinceLastPlayback < tail
    }
}
