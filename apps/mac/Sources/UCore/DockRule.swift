import CoreGraphics
import Foundation

/// THE DOCK ("el muelle"): Ü's panel, glued to the right edge of the screen and always there. Windows
/// Muelle + ReglaDelMuelle, in Swift. Pure; geometry is global y-down (Quartz), like FaceFling.
///
/// At rest only a thin tab shows against the edge; the cursor unfolds the panel leftwards from it, and
/// the tab never moves while it does — a hover menu whose anchor moves under the cursor flickers.
public enum DockRule {
    /// The gesture target of the tab. The drawing is 5 wide: hitting five points would be aim.
    public static let tabWidth = 14.0
    public static let tabHeight = 64.0
    public static let drawWidth = 5.0
    public static let drawHeight = tabHeight - 8
    /// The tab grows a little under the hand: it says "this is touchable" without taking more room.
    public static let drawWidthOpen = drawWidth + 2
    /// Away from the right edge: a piece glued to the glass reads as cut, not floating.
    public static let edgeGap = 10.0
    /// The wait before folding after the cursor leaves. The path from the tab to a button crosses the
    /// border and fires a false exit; without this the panel closes in the face of whoever was going
    /// to press it.
    public static let grace = 0.35
    /// How forgiving dropping the face on the dock is, around its box.
    public static let grabMargin = 24.0

    /// Unfolding: slides 24 points in from the right with a cubic ease-out and fades in.
    public static let unfold = 0.18
    public static let fadeIn = 0.15
    public static let fold = 0.14
    public static let slide = 24.0
    public static let tabGrow = 0.14
    public static let tabShrink = 0.18

    /// Must it be unfolded now? The cursor opens it, but it is not the only one that decides to close
    /// it (promesa 148): something to read or to write keeps it open. Talking by voice does not.
    public static func unfolded(cursorOver: Bool, conversationOpen: Bool, keyboardInside: Bool) -> Bool {
        cursorOver || conversationOpen || keyboardInside
    }

    /// Glued to the right edge with the tab still: the height grows up and down from the kept centre.
    public static func frame(size: CGSize, visible: CGRect, center: Double) -> CGRect {
        let x = visible.maxX - size.width - edgeGap
        let y = min(max(center - size.height / 2, visible.minY), max(visible.minY, visible.maxY - size.height))
        return CGRect(x: x, y: y, width: size.width, height: size.height)
    }

    public static func defaultCenter(_ visible: CGRect) -> Double { visible.midY }

    /// Does dropping the face at `drop` store it in the dock? (promesa 149)
    public static func stores(dock: CGRect, drop: CGPoint) -> Bool {
        let box = dock.insetBy(dx: -grabMargin, dy: -grabMargin)
        return drop.x >= box.minX && drop.x <= box.maxX && drop.y >= box.minY && drop.y <= box.maxY
    }

    /// Where the face APPEARS when pulled out: centred on the cursor, never where it was stored —
    /// that jumped away from the hand (2026-09-06 on Windows).
    public static func placeOnAppear(cursor: CGPoint, face: CGSize, work: CGRect) -> CGPoint {
        placeOnTakeOut(drop: CGPoint(x: cursor.x - face.width / 2, y: cursor.y - face.height / 2), face: face, work: work)
    }

    /// Where it stays after taking it out: where it is dropped, whole inside the screen (promesa 150).
    /// The deliberate exception to "always to a side": taking it out says WHERE you want it.
    public static func placeOnTakeOut(drop: CGPoint, face: CGSize, work: CGRect) -> CGPoint {
        CGPoint(x: min(max(drop.x, work.minX), max(work.minX, work.maxX - face.width)),
                y: min(max(drop.y, work.minY), max(work.minY, work.maxY - face.height)))
    }

    /// One frame of the panel's motion: `dx` is how far right of its place it is, `opacity` its alpha.
    public struct Frame: Sendable, Equatable {
        public let dx: Double
        public let opacity: Double
        public init(dx: Double, opacity: Double) { self.dx = dx; self.opacity = opacity }
    }

    /// WPF DoubleAnimation(24→0, 180 ms, CubicEase out) and opacity to 1 in 150 ms, from where it was.
    public static func unfolding(at elapsed: Double, from: Frame) -> Frame {
        let p = NotchMotion.cubicOut(elapsed / unfold)
        let fade = min(1, max(0, elapsed / fadeIn))
        return Frame(dx: slide * (1 - p), opacity: from.opacity + (1 - from.opacity) * fade)
    }

    /// Opacity to 0 in 140 ms with a cubic ease-in, slide back to 24 linearly, from where it was.
    public static func folding(at elapsed: Double, from: Frame) -> Frame {
        let t = min(1, max(0, elapsed / fold))
        return Frame(dx: from.dx + (slide - from.dx) * t, opacity: from.opacity * (1 - NotchMotion.cubicIn(t)))
    }
}
