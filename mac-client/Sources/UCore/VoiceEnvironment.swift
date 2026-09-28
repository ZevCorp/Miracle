import Foundation

public struct AudioActivity: Sendable {
    public let pid: Int32
    public let input: Bool
    public let output: Bool
    public init(pid: Int32, input: Bool, output: Bool) {
        self.pid = pid; self.input = input; self.output = output
    }
}

public enum LiveInputMode: Sendable {
    case microphone, addressedText
    public var forwardsMicrophone: Bool { self == .microphone }
    public func acceptsLocalUtterance(_ text: String) -> Bool {
        self == .addressedText && VoiceActivation.isGreeting(text)
    }
}

/// Audio activity is a privacy signal, not proof of a video, call, or speaker identity.
public enum VoiceEnvironment: String, Sendable {
    case quiet, otherAudio, unknown
    public var inputMode: LiveInputMode { self == .quiet ? .microphone : .addressedText }
    public static func evaluate(_ processes: [AudioActivity]?, ownPID: Int32) -> Self {
        guard let processes else { return .unknown }
        return processes.contains { $0.pid != ownPID && ($0.input || $0.output) } ? .otherAudio : .quiet
    }
}
