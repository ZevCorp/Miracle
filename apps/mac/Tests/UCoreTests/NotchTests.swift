import CoreGraphics
import Foundation
import UCore

/// The notch and the dock behave as on Windows (2026-09-30, asked by the user: the Mac notch got
/// stuck and glitched when hiding and appearing). The Windows promises, judged here without a screen.
extension AgentTests {
    // A 1440 × 900 screen with a 25 point menu bar and no Dock, in y-down coordinates.
    private var screen: CGRect { CGRect(x: 0, y: 0, width: 1440, height: 900) }
    private var visible: CGRect { CGRect(x: 0, y: 25, width: 1440, height: 875) }
    private var compact: CGSize { NotchLayout(expanded: false, availableWidth: 1440, availableHeight: 875).size }

    func testNotchHangsTopCentreUnderTheMenuBar() {
        let piece = NotchLayout.place(compact, in: visible)
        XCTAssertEqual(piece, CGRect(x: 575, y: 33, width: 290, height: 62))
        let chat = NotchLayout.place(NotchLayout(expanded: true, availableWidth: 1440, availableHeight: 875).size, in: visible)
        XCTAssertEqual(chat.minY, piece.minY)
        XCTAssertEqual(chat.midX, piece.midX)
        // A piece wider than the free area stays inside it instead of spilling on both sides.
        let narrow = CGRect(x: 100, y: 25, width: 300, height: 400)
        let squeezed = NotchLayout.place(CGSize(width: 340, height: 44), in: narrow)
        XCTAssertEqual(squeezed.minX, 100)
    }

    func testTopEdgeStripBringsTheNotchOutAndTheBridgeKeepsIt() {
        let zone = NotchLayout.peekZone(screen: screen, visible: visible, size: compact)
        XCTAssertEqual(zone, CGRect(x: 435, y: 0, width: 570, height: 6))
        XCTAssertEqual(NotchLayout.peeks(screen: screen, visible: visible, size: compact, cursor: CGPoint(x: 720, y: 0)), true)
        XCTAssertEqual(NotchLayout.peeks(screen: screen, visible: visible, size: compact, cursor: CGPoint(x: 455, y: 5)), true)
        // Going up to close a window is not touching the edge.
        XCTAssertEqual(NotchLayout.peeks(screen: screen, visible: visible, size: compact, cursor: CGPoint(x: 720, y: 14)), false)
        XCTAssertEqual(NotchLayout.peeks(screen: screen, visible: visible, size: compact, cursor: CGPoint(x: 100, y: 0)), false)
        // Hidden, only the strip counts; out, the bridge down to the piece keeps the intent.
        let onPiece = CGPoint(x: 720, y: 70)
        XCTAssertEqual(NotchLayout.keepsIntent(screen: screen, visible: visible, size: compact, cursor: onPiece, shown: false), false)
        XCTAssertEqual(NotchLayout.keepsIntent(screen: screen, visible: visible, size: compact, cursor: onPiece, shown: true), true)
        XCTAssertEqual(NotchLayout.keepsIntent(screen: screen, visible: visible, size: compact, cursor: CGPoint(x: 582, y: 40), shown: true), true)
        XCTAssertEqual(NotchLayout.keepsIntent(screen: screen, visible: visible, size: compact, cursor: CGPoint(x: 720, y: 120), shown: true), false)
        XCTAssertEqual(NotchLayout.overPiece(visible: visible, size: compact, cursor: onPiece), true)
    }

    func testNotchSpeechKeepsTaskAndActivityApart() {
        var speech = NotchSpeech()
        XCTAssertEqual(speech.text, "Ü")
        speech.personSays("abre el correo")
        XCTAssertEqual(speech.text, "abre el correo")
        XCTAssertEqual(speech.task, "Ü")
        speech.closeTurn()
        XCTAssertEqual(speech.task, "abre el correo")
        XCTAssertEqual(speech.text, "abre el correo")
        speech.begin("abriendo Mail")
        XCTAssertEqual(speech.state, .working)
        XCTAssertEqual(speech.state.spins, true)
        speech.end("Mail abierto", ok: true)
        XCTAssertEqual(speech.state, .done)
        XCTAssertEqual(speech.task, "abre el correo")
        speech.uSays("Listo 🎉")
        XCTAssertEqual(speech.text, "Listo")
        XCTAssertEqual(speech.state, .voice)
        speech.stopped("")
        XCTAssertEqual(speech.text, "detenido")
        XCTAssertEqual(speech.state, .skipped)
        XCTAssertEqual(speech.state.inkOpacity < NotchState.done.inkOpacity, true)
        // An empty transcript does not change the task.
        speech.closeTurn()
        XCTAssertEqual(speech.task, "abre el correo")
        speech.forget()
        XCTAssertEqual(speech, NotchSpeech())
    }

    func testNotchIsHiddenAtLaunchNewsBringsItOutAndItExpires() {
        var presence = NotchPresence()
        XCTAssertEqual(presence.onScreen, false)
        XCTAssertEqual(presence.painted(at: 0), .appear)
        XCTAssertEqual(presence.painted(at: 10), .none)
        XCTAssertEqual(presence.tick(at: 99, working: false), .none)
        XCTAssertEqual(presence.tick(at: 101, working: true), .none)
        XCTAssertEqual(presence.tick(at: 101, working: false), .leave)
        XCTAssertEqual(presence.phase, .leaving)
        XCTAssertEqual(presence.left(), true)
        XCTAssertEqual(presence.onScreen, false)
        // Once gone, the clock is off until there is news again.
        XCTAssertEqual(presence.tick(at: 500, working: false), .none)
    }

    func testTouchingTheTopEdgeBringsItOutAndLeavingSendsItAway() {
        var presence = NotchPresence()
        XCTAssertEqual(presence.hover(inside: true, at: 0), .appear)
        XCTAssertEqual(presence.hoverOnly, true)
        XCTAssertEqual(presence.hover(inside: true, at: 0.15), .none)
        XCTAssertEqual(presence.hover(inside: false, at: 0.30), .leave)
        XCTAssertEqual(presence.left(), true)
        // Out because it had something to say: the cursor leaving does not take it away.
        _ = presence.painted(at: 1)
        XCTAssertEqual(presence.hover(inside: true, at: 1.15), .none)
        XCTAssertEqual(presence.hover(inside: false, at: 1.30), .none)
        XCTAssertEqual(presence.onScreen, true)
        // Out only by hover, then news arrives: now the content holds it, with its own expiry.
        var hovered = NotchPresence()
        _ = hovered.hover(inside: true, at: 0)
        _ = hovered.painted(at: 0.1)
        XCTAssertEqual(hovered.hover(inside: false, at: 0.2), .none)
        XCTAssertEqual(hovered.onScreen, true)
    }

    func testTheNotchNeverGetsStuckBetweenLeavingAndComing() {
        var presence = NotchPresence()
        _ = presence.painted(at: 0)
        XCTAssertEqual(presence.clear(), .leave)
        // News during the exit brings it back, and the finished exit must not hide it or forget.
        XCTAssertEqual(presence.painted(at: 0.1), .appear)
        XCTAssertEqual(presence.left(), false)
        XCTAssertEqual(presence.phase, .shown)
        // The cursor coming back during a hover exit brings it back too.
        var hovered = NotchPresence()
        _ = hovered.hover(inside: true, at: 0)
        XCTAssertEqual(hovered.hover(inside: false, at: 0.15), .leave)
        XCTAssertEqual(hovered.hover(inside: true, at: 0.30), .appear)
        XCTAssertEqual(hovered.left(), false)
        // The expiry never pulls it out from under the cursor.
        var under = NotchPresence()
        _ = under.painted(at: 0)
        _ = under.hover(inside: true, at: 50)
        XCTAssertEqual(under.tick(at: 200, working: false), .none)
        XCTAssertEqual(under.hover(inside: false, at: 201), .none)
        XCTAssertEqual(under.tick(at: 202, working: false), .leave)
        // Clearing while hidden forgets what it said without showing anything.
        var hidden = NotchPresence()
        XCTAssertEqual(hidden.clear(), .forget)
        XCTAssertEqual(hidden.onScreen, false)
    }

    func testTheChatHoldsTheNotch() {
        var presence = NotchPresence()
        XCTAssertEqual(presence.openChat(), .appear)
        XCTAssertEqual(presence.hover(inside: false, at: 1), .none)
        XCTAssertEqual(presence.tick(at: 1000, working: false), .none)
        XCTAssertEqual(presence.onScreen, true)
        presence.closeChat()
        // Closing the chat restarts the clock that was running, not a new 90 s.
        XCTAssertEqual(presence.hover(inside: false, at: 1001), .none)
        XCTAssertEqual(presence.tick(at: 1002, working: false), .leave)
    }

    func testNotchDropsWithASmallBounceAndLeavesRising() {
        let start = NotchMotion.arriving(at: 0)
        XCTAssertEqual(start, NotchMotion.Frame(scale: 0.9, dy: -14, opacity: 0))
        let end = NotchMotion.arriving(at: NotchMotion.entrance)
        XCTAssertEqual(abs(end.scale - 1) < 1e-9 && abs(end.dy) < 1e-9 && end.opacity == 1, true)
        let overshoot = stride(from: 0.0, through: NotchMotion.entrance, by: 0.005).map { NotchMotion.arriving(at: $0).dy }.max() ?? 0
        XCTAssertEqual(overshoot > 0.5 && overshoot < 2.5, true)
        XCTAssertEqual(NotchMotion.arriving(at: NotchMotion.fadeIn).opacity, 1)
        let gone = NotchMotion.leaving(at: NotchMotion.exit)
        XCTAssertEqual(gone.dy, -10)
        XCTAssertEqual(gone.opacity, 0)
        XCTAssertEqual(NotchMotion.leaving(at: 0).opacity, 1)
    }

    func testDockUnfoldsWithTheCursorAndStaysForWhatIsBeingRead() {
        XCTAssertEqual(DockRule.unfolded(cursorOver: true, conversationOpen: false, keyboardInside: false), true)
        XCTAssertEqual(DockRule.unfolded(cursorOver: false, conversationOpen: true, keyboardInside: false), true)
        XCTAssertEqual(DockRule.unfolded(cursorOver: false, conversationOpen: false, keyboardInside: true), true)
        XCTAssertEqual(DockRule.unfolded(cursorOver: false, conversationOpen: false, keyboardInside: false), false)
        XCTAssertEqual(DockRule.grace, 0.35)
    }

    func testDockTabStaysOnTheRightEdgeWhileThePanelGrowsLeft() {
        let folded = DockRule.frame(size: CGSize(width: DockRule.tabWidth, height: DockRule.tabHeight), visible: visible, center: DockRule.defaultCenter(visible))
        XCTAssertEqual(folded, CGRect(x: 1416, y: 430.5, width: 14, height: 64))
        let open = DockRule.frame(size: CGSize(width: 214, height: 420), visible: visible, center: DockRule.defaultCenter(visible))
        XCTAssertEqual(open.maxX, folded.maxX)
        XCTAssertEqual(open.midY, folded.midY)
        // Taller than the screen: pinned inside, from the top.
        let huge = DockRule.frame(size: CGSize(width: 214, height: 2000), visible: visible, center: 462.5)
        XCTAssertEqual(huge.minY, visible.minY)
    }

    func testDockStoresTheDroppedFaceAndGivesItBackUnderTheHand() {
        let dock = CGRect(x: 1416, y: 430, width: 14, height: 64)
        XCTAssertEqual(DockRule.stores(dock: dock, drop: CGPoint(x: 1400, y: 420)), true)
        XCTAssertEqual(DockRule.stores(dock: dock, drop: CGPoint(x: 1380, y: 460)), false)
        let face = CGSize(width: 118, height: 118)
        XCTAssertEqual(DockRule.placeOnAppear(cursor: CGPoint(x: 700, y: 400), face: face, work: visible), CGPoint(x: 641, y: 341))
        // Next to the dock the natural drop spills off the screen: it is clamped back inside.
        XCTAssertEqual(DockRule.placeOnTakeOut(drop: CGPoint(x: 1400, y: 890), face: face, work: visible), CGPoint(x: 1322, y: 782))
    }

    func testDockSlidesInFromTheRightAndFadesOut() {
        let hidden = DockRule.Frame(dx: DockRule.slide, opacity: 0)
        XCTAssertEqual(DockRule.unfolding(at: 0, from: hidden), hidden)
        XCTAssertEqual(DockRule.unfolding(at: DockRule.unfold, from: hidden), DockRule.Frame(dx: 0, opacity: 1))
        XCTAssertEqual(DockRule.unfolding(at: 0.09, from: hidden).dx < 12, true)
        let open = DockRule.Frame(dx: 0, opacity: 1)
        XCTAssertEqual(DockRule.folding(at: DockRule.fold, from: open), DockRule.Frame(dx: 24, opacity: 0))
        XCTAssertEqual(DockRule.folding(at: 0.07, from: open).opacity > 0.8, true)
    }

    func testLongSentenceTravelsAndRestsAtEachEnd() {
        XCTAssertEqual(NotchMarquee.offset(excess: 0.5, elapsed: 5), 0)
        XCTAssertEqual(NotchMarquee.offset(excess: 60, elapsed: 0.5), 0)
        let travel = 60 / NotchMarquee.speed
        XCTAssertEqual(abs(NotchMarquee.offset(excess: 60, elapsed: 0.9 + travel / 2) + 30) < 1e-6, true)
        XCTAssertEqual(NotchMarquee.offset(excess: 60, elapsed: 0.9 + travel + 0.5), -60)
        XCTAssertEqual(NotchMarquee.offset(excess: 60, elapsed: 0.9 + travel * 2 + 0.9 + 1.0), 0)
        // It never leaves the window of the text.
        let worst = stride(from: 0.0, through: 30, by: 0.05).map { NotchMarquee.offset(excess: 60, elapsed: $0) }
        XCTAssertEqual(worst.allSatisfy { $0 <= 0 && $0 >= -60 }, true)
    }
}
