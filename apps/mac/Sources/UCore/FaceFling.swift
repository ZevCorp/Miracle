import CoreGraphics
import Foundation

/// How the face moves when the user grabs it, calqued from Windows (FaceGestures.cs, EdgeSnap.cs,
/// MuelleEase.cs, Vuelo.cs, LanzarConScroll.cs) so both clients feel the same.
/// Coordinates are y-down (Quartz / Windows); the AppKit adapter converts.
public enum FaceFling {
    /// (13 px)²: under this a press is a tap. 10 px turned ordinary clicks into throws on Windows.
    public static let moveThresholdSquared = 169.0
    /// A deliberate click on a 66 px target lasts half a second; 750 ms stops long-press firing by itself.
    public static let longPressSeconds = 0.75
    /// Only a real throw crosses to the other side; repositioning drags easily pass 260 px/s.
    public static let throwSpeed = 900.0
    static let stiffness = 4.5
    static let maxInitialSlope = 2.2
    /// Two-finger gesture: silence that closes it, and the tail that decides the throw.
    public static let scrollPause = 0.11
    public static let scrollWindow = 0.12

    public static func isDrag(dx: Double, dy: Double) -> Bool { dx * dx + dy * dy > moveThresholdSquared }

    public struct Landing: Equatable, Sendable {
        public let origin: CGPoint
        public let duration: Double
        public let slopeX: Double
        public let slopeY: Double
        public let arc: Double
        public let crossed: Bool
    }

    /// Always to a side edge: dropped mid-screen the face sits on the user's work. Speed decides
    /// which side (only a clearly horizontal throw crosses) and how far the height travels.
    public static func landing(frame: CGRect, workArea: CGRect, vx: Double, vy: Double) -> Landing {
        let width = frame.width, height = frame.height
        let leftEdge = workArea.minX, rightEdge = max(workArea.minX, workArea.maxX - width)
        let thrown = abs(vx) >= throwSpeed && abs(vx) > abs(vy)
        let toRight = thrown ? vx > 0 : frame.midX >= workArea.midX
        let destinationX = toRight ? rightEdge : leftEdge
        let jumpY = min(max(vy * 0.22, -workArea.height * 0.55), workArea.height * 0.55)
        let destinationY = min(max(frame.minY + jumpY, workArea.minY), max(workArea.minY, workArea.maxY - height))
        let dx = destinationX - frame.minX, dy = destinationY - frame.minY
        let distance = (dx * dx + dy * dy).squareRoot()
        let crossed = thrown && ((frame.midX >= workArea.midX) != toRight)
        let origin = CGPoint(x: destinationX, y: destinationY)
        guard distance >= 0.5 else { return Landing(origin: origin, duration: 0, slopeX: 0, slopeY: 0, arc: 0, crossed: crossed) }
        // Duration follows distance; force shortens it a little so a hard throw arrives sooner
        // without looking like a teleport.
        let force = min(1, (vx * vx + vy * vy).squareRoot() / 5000)
        let seconds = min(max((360 + distance * 0.78) * (1 - force * 0.22), 320), 1200) / 1000
        func slope(_ v: Double, _ d: Double) -> Double { abs(d) < 1 ? 0 : min(max(v * seconds / d, 0), maxInitialSlope) }
        // Upward belly, felt rather than seen.
        let arc = min(distance * 0.04, 22) * (dx >= 0 ? -1 : 1)
        return Landing(origin: origin, duration: seconds, slopeX: slope(vx, dx), slopeY: slope(vy, dy), arc: arc, crossed: crossed)
    }

    /// Critically damped spring leaving at the release speed, normalised so it lands exactly at 1.
    public static func spring(_ t: Double, slope: Double) -> Double {
        func raw(_ t: Double) -> Double { 1 - (1 + (stiffness - slope) * t) * exp(-stiffness * t) }
        let end = raw(1)
        return abs(end) < 1e-6 ? t : raw(t) / end
    }

    /// Where the face is at progress t of a flight. Lands exactly on the destination at t ≥ 1.
    public static func position(from start: CGPoint, landing: Landing, at t: Double) -> CGPoint {
        guard t < 1, landing.duration > 0 else { return landing.origin }
        let t = max(0, t)
        let dx = landing.origin.x - start.x, dy = landing.origin.y - start.y
        let length = (dx * dx + dy * dy).squareRoot()
        let belly = length > 1 && abs(landing.arc) > 0.5 ? sin(Double.pi * t) : 0
        let arcX = length > 1 ? -dy / length * landing.arc : 0, arcY = length > 1 ? dx / length * landing.arc : 0
        return CGPoint(x: start.x + dx * spring(t, slope: landing.slopeX) + arcX * belly,
                       y: start.y + dy * spring(t, slope: landing.slopeY) + arcY * belly)
    }
}

/// Release velocity of a mouse drag. The trajectory rules (0.65), not the last frame: a 5 px tremor
/// before letting go must not decide whether the face crosses the screen.
public struct FaceVelocity: Sendable {
    public private(set) var vx = 0.0, vy = 0.0
    private var last: CGPoint = .zero, lastTime = 0.0
    public init() {}
    public mutating func reset(at point: CGPoint, time: Double) { vx = 0; vy = 0; last = point; lastTime = time }
    public mutating func sample(_ point: CGPoint, time: Double) {
        let dt = time - lastTime
        guard dt > 0.0005 else { return }
        vx = vx * 0.65 + (point.x - last.x) / dt * 0.35
        vy = vy * 0.65 + (point.y - last.y) / dt * 0.35
        last = point; lastTime = time
    }
}

/// Two-finger push: the face follows each delta at once, and the throw uses only the end of the
/// gesture — how it was moving when the fingers stopped, not the average of the whole stroll.
public struct ScrollFling: Sendable {
    private var recent: [(time: Double, dx: Double, dy: Double)] = []
    public init() {}
    public mutating func add(dx: Double, dy: Double, at time: Double) {
        recent.append((time, dx, dy))
        recent.removeAll { time - $0.time > FaceFling.scrollWindow }
    }
    /// `pause` is the silence that closed the gesture (0 when the trackpad reported the lift).
    public mutating func finish(at now: Double, pause: Double) -> (vx: Double, vy: Double) {
        recent.removeAll { now - $0.time > FaceFling.scrollWindow + pause }
        defer { recent.removeAll() }
        guard let first = recent.first else { return (0, 0) }
        let dx = recent.reduce(0) { $0 + $1.dx }, dy = recent.reduce(0) { $0 + $1.dy }
        let seconds = max(now - first.time - pause, 0.04)
        return (dx / seconds, dy / seconds)
    }
}
