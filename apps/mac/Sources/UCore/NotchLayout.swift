import CoreGraphics
import Foundation

/// Windows MedidaDelNotch + ReglaDeLaBandeja, in Swift. How big the notch is, where it sits and which
/// strip of the screen brings it out. Pure; all geometry is global y-down (Quartz), like FaceFling.
///
/// The notch measures the same whatever it says (promesa 249): 290 × 62 compact, 420 × 360 with the
/// chat open, and the chat keeps the same top edge and grows downwards.
public struct NotchLayout: Sendable {
    /// The size of the macOS volume bar (measured 2026-10-01 from the user's screen: 290 × 62 points,
    /// corners of 20). The person already knows that shape at the top of the screen; a piece of the
    /// same size reads as part of the system instead of a banner over their work.
    public static let compactWidth = 290.0
    public static let compactHeight = 62.0
    public static let chatWidth = 420.0
    public static let chatHeight = 360.0
    public static let cornerRadius = 20.0
    /// The gap under the menu bar. Windows leaves the same under its work area: glued to the edge the
    /// notch and the bar read as one broken piece.
    public static let gap = 8.0
    /// The side margins of the strip that brings it out: the screen edge is where the cursor has the
    /// least fine control, so the strip is more generous than the piece.
    public static let peekMargin = 140.0
    /// The strip is a few points tall on purpose: the gesture is touching the EDGE.
    public static let peekHeight = 6.0

    public let width: Double
    public let height: Double
    public init(expanded: Bool, availableWidth: Double, availableHeight: Double) {
        width = min(expanded ? Self.chatWidth : Self.compactWidth, max(0, availableWidth - 16))
        height = min(expanded ? Self.chatHeight : Self.compactHeight, max(0, availableHeight - 16))
    }
    public var size: CGSize { CGSize(width: width, height: height) }

    /// Top and centre of the free area (promesa 251), always inside it. `visible` is the screen minus
    /// the menu bar and the Dock, so the piece hangs under the menu bar and never behind it.
    public static func place(_ size: CGSize, in visible: CGRect) -> CGRect {
        var x = visible.minX + (visible.width - size.width) / 2
        var y = visible.minY + gap
        x = max(visible.minX, min(x, visible.maxX - size.width))
        y = max(visible.minY, min(y, visible.maxY - size.height))
        return CGRect(x: x, y: y, width: size.width, height: size.height)
    }

    /// The strip that brings the notch out even with nothing new to say (promesa 260): the top edge of
    /// the physical screen, centred where the piece lives. On a Mac the edge is inside the menu bar,
    /// which is exactly where the cursor stops when it is thrown upwards.
    public static func peekZone(screen: CGRect, visible: CGRect, size: CGSize) -> CGRect {
        let width = min(size.width + peekMargin * 2, visible.width)
        let x = max(visible.minX, visible.minX + (visible.width - width) / 2)
        return CGRect(x: x, y: screen.minY, width: width, height: min(peekHeight, screen.height))
    }

    public static func peeks(screen: CGRect, visible: CGRect, size: CGSize, cursor: CGPoint) -> Bool {
        contains(peekZone(screen: screen, visible: visible, size: size), cursor)
    }

    /// The whole intent zone: the edge strip, and while the piece is out also the bridge from the edge
    /// down to the piece, 12 points wider on each side. Leaving it is what sends a hover-only notch away.
    public static func keepsIntent(screen: CGRect, visible: CGRect, size: CGSize, cursor: CGPoint, shown: Bool) -> Bool {
        if peeks(screen: screen, visible: visible, size: size, cursor: cursor) { return true }
        guard shown else { return false }
        let piece = place(size, in: visible)
        let bridge = CGRect(x: piece.minX - 12, y: screen.minY, width: piece.width + 24, height: max(0, piece.maxY - screen.minY))
        return contains(bridge, cursor)
    }

    /// The cursor is on the visible piece.
    public static func overPiece(visible: CGRect, size: CGSize, cursor: CGPoint) -> Bool {
        contains(place(size, in: visible), cursor)
    }

    /// Closed on every edge, like WPF Rect.Contains: the last pixel row of the screen counts.
    static func contains(_ rect: CGRect, _ p: CGPoint) -> Bool {
        p.x >= rect.minX && p.x <= rect.maxX && p.y >= rect.minY && p.y <= rect.maxY
    }
}
