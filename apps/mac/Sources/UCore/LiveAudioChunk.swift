import Foundation

/// Silence has duration too: never remove it from the provider's PCM timeline.
public struct LiveAudioChunk: Sendable {
    public let frames: Int
    public let audible: Bool
    public let level: Double
    public init(_ data: Data) throws {
        guard data.count % 2 == 0 else { throw AgentError.invalid("Live 1 envió un fragmento PCM incompleto.") }
        frames = data.count / 2
        var sum = 0.0
        data.withUnsafeBytes { (bytes: UnsafeRawBufferPointer) in
            for index in stride(from: 0, to: bytes.count, by: 2) {
                let sample = Double(Int16(bitPattern: UInt16(bytes[index]) | UInt16(bytes[index + 1]) << 8)) / 32768
                sum += sample * sample
            }
        }
        level = frames == 0 ? 0 : sqrt(sum / Double(frames))
        audible = sum > 0
    }
}
