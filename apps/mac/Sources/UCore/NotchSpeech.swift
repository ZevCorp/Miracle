import Foundation

/// Where the notch line is. Decides its icon. Windows EstadoDelNotch.
public enum NotchState: String, Sendable {
    /// Started, outcome unknown: the ring spins.
    case working
    /// It went well: a check.
    case done
    /// It went wrong: a closed ring with an exclamation (the shape says it, not a red).
    case failed
    /// No outcome: stopped by hand. A dash in a ring, dimmed.
    case skipped
    /// Someone is speaking, the person or Ü: four bars.
    case voice

    /// Only the working ring spins, and spinning is half of what it says.
    public var spins: Bool { self == .working }
    /// Black and white only (promesa 242): a skipped line loses light instead of changing colour.
    public var inkOpacity: Double { self == .skipped ? 0.50 : 0.94 }
}

/// What the notch says at each moment. Windows LoQueDiceElNotch (promesa 252): task and activity are
/// remembered apart, the surface shows one sentence. Pure: nothing is drawn here.
public struct NotchSpeech: Sendable, Equatable {
    public static let noTaskYet = "Ü"
    public private(set) var task = NotchSpeech.noTaskYet
    public private(set) var step = ""
    public private(set) var state: NotchState = .voice
    private var inMouth = ""
    private var stepIsThePerson = false
    public init() {}

    /// The only visible text: the activity while something happens, the last task as the anchor.
    public var text: String { step.isEmpty ? task : step }

    /// The person is speaking: the live sentence waits to become the task when the turn closes.
    public mutating func personSays(_ text: String) {
        let t = Self.clean(text)
        guard !t.isEmpty else { return }
        inMouth = t; step = t; stepIsThePerson = true; state = .voice
    }

    /// The turn is over: what the person said becomes the task, and the activity is free again.
    public mutating func closeTurn() {
        guard !inMouth.isEmpty else { return }
        task = inMouth; inMouth = ""
        if stepIsThePerson { step = "" }
        stepIsThePerson = false
    }

    /// Ü says something: it is what happens now and does not touch the task.
    public mutating func uSays(_ text: String) {
        let t = Self.clean(text)
        guard !t.isEmpty else { return }
        step = t; stepIsThePerson = false; state = .voice
    }

    public mutating func begin(_ text: String) {
        step = Self.clean(text); stepIsThePerson = false; state = .working
    }

    public mutating func end(_ text: String, ok: Bool) {
        let t = Self.clean(text)
        if !t.isEmpty { step = t }
        stepIsThePerson = false; state = ok ? .done : .failed
    }

    /// Stopped by hand (promesa 259): neither done nor failed, it stays said.
    public mutating func stopped(_ text: String) {
        let t = Self.clean(text)
        step = t.isEmpty ? "detenido" : t
        stepIsThePerson = false; state = .skipped
    }

    /// Everything is over: back to how it opened.
    public mutating func forget() { self = NotchSpeech() }

    /// No emoji in the notch: they bring their own colour into a black and white piece.
    public static func clean(_ text: String) -> String {
        var out = String.UnicodeScalarView()
        for scalar in text.unicodeScalars {
            let n = scalar.value
            let emoji = (0x1F000...0x1FAFF).contains(n) || (0x2600...0x27BF).contains(n) || (0xFE0E...0xFE0F).contains(n) || n == 0x200D
            if !emoji { out.append(scalar) }
        }
        return String(out).trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
