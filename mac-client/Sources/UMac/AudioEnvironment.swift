import Foundation
import CoreAudio
import UCore

/// Reads activity metadata only. Does not capture other applications' audio.
public enum AudioEnvironment {
    public static func read() -> VoiceEnvironment {
        .evaluate(activities(), ownPID: ProcessInfo.processInfo.processIdentifier)
    }
    public static func activities() -> [AudioActivity]? {
        guard #available(macOS 14.2, *) else { return nil }
        var address = property(kAudioHardwarePropertyProcessObjectList)
        var size: UInt32 = 0
        let system = AudioObjectID(kAudioObjectSystemObject)
        guard AudioObjectGetPropertyDataSize(system, &address, 0, nil, &size) == noErr,
              size % UInt32(MemoryLayout<AudioObjectID>.size) == 0 else { return nil }
        var objects = [AudioObjectID](repeating: 0, count: Int(size) / MemoryLayout<AudioObjectID>.size)
        guard !objects.isEmpty else { return [] }
        let status = objects.withUnsafeMutableBytes {
            AudioObjectGetPropertyData(system, &address, 0, nil, &size, $0.baseAddress!)
        }
        guard status == noErr else { return nil }
        var activities: [AudioActivity] = []
        for object in objects.prefix(Int(size) / MemoryLayout<AudioObjectID>.size) {
            guard let pid = scalar(object, kAudioProcessPropertyPID),
                  let input = scalar(object, kAudioProcessPropertyIsRunningInput),
                  let output = scalar(object, kAudioProcessPropertyIsRunningOutput) else { return nil }
            activities.append(.init(pid: Int32(bitPattern: pid), input: input != 0, output: output != 0))
        }
        return activities
    }
    private static func property(_ selector: AudioObjectPropertySelector) -> AudioObjectPropertyAddress {
        .init(mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    }
    private static func scalar(_ object: AudioObjectID, _ selector: AudioObjectPropertySelector) -> UInt32? {
        var address = property(selector), value: UInt32 = 0
        var size = UInt32(MemoryLayout<UInt32>.size)
        guard AudioObjectGetPropertyData(object, &address, 0, nil, &size, &value) == noErr,
              size == MemoryLayout<UInt32>.size else { return nil }
        return value
    }
}
