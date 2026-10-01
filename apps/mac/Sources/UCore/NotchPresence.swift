import Foundation

/// WHEN THE NOTCH IS ON SCREEN. Windows PanelDeAcciones decides this across its timers; here it is one
/// pure state machine with the clock passed in, so the contract judges it without a screen and the
/// running app asks it instead of keeping the decision loose between timers.
///
/// - Hidden at launch. Something real to say (a sentence, a step, an outcome) brings it out.
/// - Nothing new for 90 s and nothing in progress: it goes away by itself.
/// - Touching the top edge brings it out with nothing to say (promesa 260); if that was the only
///   reason, leaving the intent zone sends it away again.
/// - The chat holds it: no expiry and no hover exit while the conversation is open.
///
/// Two things are firmer than on Windows, and both are the "stuck notch" the user reported on the Mac:
/// news or the cursor arriving while it is leaving bring it back instead of being swallowed by the
/// exit, and the expiry never pulls it out from under the cursor.
public struct NotchPresence: Sendable, Equatable {
    public static let expiry = 90.0
    public static let expiryCheck = 2.0
    public static let hoverPoll = 0.15

    public enum Phase: String, Sendable { case hidden, shown, leaving }
    public enum Command: String, Sendable { case none, appear, leave, forget }

    public private(set) var phase: Phase = .hidden
    public private(set) var chatOpen = false
    public private(set) var expiring = false
    public private(set) var lastChange = 0.0
    public private(set) var inZone = false
    public private(set) var hoverOnly = false
    /// Settable only so a live probe can measure the expiry without waiting 90 s.
    public var expiry = NotchPresence.expiry
    public init() {}

    /// On screen, including the exit animation (Windows IsVisible).
    public var onScreen: Bool { phase != .hidden }

    /// Something real to say. Brings the piece out and restarts the expiry.
    public mutating func painted(at now: Double) -> Command {
        hoverOnly = false
        expiring = true
        lastChange = now
        return bringOut()
    }

    /// The cursor, sampled every 150 ms. `inside` is NotchLayout.keepsIntent.
    public mutating func hover(inside: Bool, at now: Double) -> Command {
        if chatOpen { inZone = true; return .none }
        var command = Command.none
        if inside && !inZone && phase != .shown {
            hoverOnly = true
            command = bringOut()
        } else if !inside && inZone && hoverOnly {
            hoverOnly = false
            command = clear()
        }
        inZone = inside
        return command
    }

    /// The expiry clock, checked every 2 s. A step in progress never expires.
    public mutating func tick(at now: Double, working: Bool) -> Command {
        guard expiring, !working, !chatOpen, !inZone, now - lastChange > expiry else { return .none }
        return clear()
    }

    /// Windows Limpiar: leave, and forget what it said once it is gone.
    public mutating func clear() -> Command {
        expiring = false
        hoverOnly = false
        switch phase {
        case .shown: phase = .leaving; return .leave
        case .leaving: return .none
        case .hidden: return .forget
        }
    }

    /// The exit animation finished. False if something brought it back meanwhile: then nothing may
    /// be hidden or forgotten.
    public mutating func left() -> Bool {
        guard phase == .leaving else { return false }
        phase = .hidden
        return true
    }

    public mutating func openChat() -> Command {
        guard !chatOpen else { return .none }
        chatOpen = true
        expiring = false
        hoverOnly = false
        return bringOut()
    }

    public mutating func closeChat() {
        guard chatOpen else { return }
        chatOpen = false
        expiring = true
    }

    private mutating func bringOut() -> Command {
        if phase == .shown { return .none }
        phase = .shown
        return .appear
    }
}

/// How the notch arrives and leaves: it drops from the top edge and settles with a small bounce, and
/// leaves rising while it fades (Windows PanelDeAcciones.Aparecer/Limpiar). Same curves as WPF.
public enum NotchMotion {
    public static let entrance = 0.38
    public static let fadeIn = 0.20
    public static let exit = 0.20
    public static let textFade = 0.22
    /// The drop: from 14 points above. The exit rises 10.
    public static let drop = 14.0
    public static let rise = 10.0

    public struct Frame: Sendable, Equatable {
        public let scale: Double
        public let dy: Double
        public let opacity: Double
        public init(scale: Double, dy: Double, opacity: Double) { self.scale = scale; self.dy = dy; self.opacity = opacity }
    }

    /// WPF BackEase EaseOut. Amplitude 0.35: a big bounce on a work piece reads as a toy.
    public static func backOut(_ t: Double, amplitude: Double = 0.35) -> Double {
        let u = 1 - min(1, max(0, t))
        return 1 - (u * u * u - u * amplitude * sin(.pi * u))
    }
    public static func cubicIn(_ t: Double) -> Double { let x = min(1, max(0, t)); return x * x * x }
    public static func cubicOut(_ t: Double) -> Double { let x = 1 - min(1, max(0, t)); return 1 - x * x * x }

    /// `dy` is y-down: negative is above the resting place.
    public static func arriving(at elapsed: Double) -> Frame {
        let p = backOut(elapsed / entrance)
        return Frame(scale: 0.9 + 0.1 * p, dy: -drop * (1 - p), opacity: min(1, max(0, elapsed / fadeIn)))
    }

    public static func leaving(at elapsed: Double) -> Frame {
        let p = cubicIn(elapsed / exit)
        return Frame(scale: 1, dy: -rise * p, opacity: 1 - p)
    }
}

/// A sentence longer than the notch travels back and forth instead of being cut (Windows
/// PanelDeAcciones marquee): 0.42 points every 32 ms, 0.9 s still at each end and 1.3 s back home.
public enum NotchMarquee {
    public static let speed = 0.42 / 0.032
    public static let firstPause = 0.9
    public static let endPause = 0.9
    public static let homePause = 1.3

    /// How far left the text is, `elapsed` seconds after it changed. Zero when it fits.
    public static func offset(excess: Double, elapsed: Double) -> Double {
        guard excess > 1, elapsed > firstPause else { return 0 }
        let travel = excess / speed
        let period = travel + endPause + travel + homePause
        let t = (elapsed - firstPause).truncatingRemainder(dividingBy: period)
        if t < travel { return -speed * t }
        if t < travel + endPause { return -excess }
        if t < travel * 2 + endPause { return -excess + speed * (t - travel - endPause) }
        return 0
    }
}
