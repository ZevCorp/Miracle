import UMac
import AppKit
import OSLog
import SwiftUI
import UCore

/// Global y-down geometry for the primary display, the one with the menu bar. Windows places the notch
/// and the dock on the primary work area; following NSScreen.main instead made them jump between
/// displays whenever another app's window took the focus.
@MainActor
enum Glass {
    static var primary: NSScreen? { NSScreen.screens.first }
    static var top: Double { Double(primary?.frame.maxY ?? 0) }
    static func yDown(_ r: NSRect) -> CGRect { CGRect(x: r.minX, y: top - r.maxY, width: r.width, height: r.height) }
    static func appKit(_ r: CGRect) -> NSRect { NSRect(x: r.minX, y: top - r.maxY, width: r.width, height: r.height) }
    static var mouse: CGPoint { let p = NSEvent.mouseLocation; return CGPoint(x: p.x, y: top - p.y) }
    static var screen: CGRect { yDown(primary?.frame ?? .zero) }
    static var visible: CGRect { yDown(primary?.visibleFrame ?? .zero) }
}

/// What the notch view draws. The controller writes it; SwiftUI only reads.
@MainActor
final class NotchSurface: ObservableObject {
    @Published var speech = NotchSpeech()
    @Published var chatOpen = false
    @Published var scale = 1.0
    @Published var focusRequest = 0
}

final class NotchPanel: NSPanel {
    var acceptsKeyboard = false
    override var canBecomeKey: Bool { acceptsKeyboard }
    override var canBecomeMain: Bool { false }
    /// AppKit keeps windows below the menu bar. The notch's shadow room reaches into it and its drop
    /// starts from under it; constrained, the drop and the rise were flattened into a jump (measured).
    override func constrainFrameRect(_ frameRect: NSRect, to screen: NSScreen?) -> NSRect { frameRect }
}

/// THE NOTCH, as on Windows (PanelDeAcciones): top centre, hidden until there is something to say or the
/// cursor touches the top edge, a drop with a small bounce to arrive and a rise to leave. When to be on
/// screen is NotchPresence's decision; this class only turns its commands into a window.
@MainActor
final class NotchController {
    /// Room for the shadow around the piece, so the blur is not cut against the window edge.
    static let shadowTop = 20.0, shadowSide = 24.0, shadowBottom = 28.0

    let panel: NotchPanel
    let surface = NotchSurface()
    private let logger = Logger(subsystem: "com.zevcorp.u.mac", category: "Notch")
    private var presence = NotchPresence()
    private var spaceObservation: NSObjectProtocol?
    private var hoverTimer: Timer?
    private var expiryTimer: Timer?
    private var motion: Timer?
    private enum Motion { case arriving(from: Double), leaving }
    private var motionKind: Motion?
    private var motionBegan = 0.0
    /// Where the piece is going to rest (y-down, window frame).
    private var rest = CGRect.zero

    var onChatChange: ((Bool) -> Void)?
    var chatOpen: Bool { presence.chatOpen }
    var phase: NotchPresence.Phase { presence.phase }

    init(model: AppModel) {
        panel = NotchPanel(contentRect: NSRect(x: 0, y: 0, width: 10, height: 10), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isOpaque = false; panel.backgroundColor = .clear; panel.hasShadow = false
        panel.level = .floating; panel.hidesOnDeactivate = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]
        panel.isReleasedWhenClosed = false
        panel.animationBehavior = .none
        let host = NSHostingView(rootView: NotchView(model: model, surface: surface))
        // The window size is ours. Letting SwiftUI resize the window from its content is what left the
        // old notch half-resized between compact and chat.
        host.sizingOptions = []
        panel.contentView = host
        panel.alphaValue = 0
        place()

        // On every desktop where the person is: the panel joins all Spaces (full-screen ones too), and
        // after a change of Space it is put in place and in front again, so calling Ü from any of them
        // brings the bar there.
        spaceObservation = NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.activeSpaceDidChangeNotification, object: nil, queue: .main) { [weak self] _ in
            MainThread.run {
                guard let self, self.presence.onScreen else { return }
                self.place()
                self.panel.orderFrontRegardless()
            }
        }
        // Sampling, not a global mouse hook: the gesture is approaching the edge, not every pixel.
        hoverTimer = repeating(NotchPresence.hoverPoll) { [weak self] in self?.checkHover() }
        expiryTimer = repeating(NotchPresence.expiryCheck) { [weak self] in
            guard let self else { return }
            self.apply(self.presence.tick(at: self.now, working: self.surface.speech.state == .working), why: "caducó")
        }
    }

    private var now: Double { ProcessInfo.processInfo.systemUptime }

    private func repeating(_ seconds: Double, _ work: @escaping @MainActor () -> Void) -> Timer {
        let timer = Timer(timeInterval: seconds, repeats: true) { _ in MainThread.run { work() } }
        RunLoop.main.add(timer, forMode: .common)
        return timer
    }

    // MARK: what it says (Windows Habla / CierraTurno / Empieza / Termina / Detenido / Avisar)

    func speak(_ text: String, fromU: Bool) {
        guard !NotchSpeech.clean(text).isEmpty else { return }
        paint { fromU ? $0.uSays(text) : $0.personSays(text) }
    }
    func closeTurn() { paint { $0.closeTurn() } }
    func begin(_ text: String) { paint { $0.begin(text) } }
    func end(_ text: String, ok: Bool) { paint { $0.end(text, ok: ok) } }
    func stopped(_ text: String) { paint { $0.stopped(text) } }
    func notify(_ text: String) {
        guard !NotchSpeech.clean(text).isEmpty else { return }
        paint { $0.uSays(text) }
    }

    /// Windows Limpiar: the conversation is over. Leaves, and forgets once gone.
    func clear() { apply(presence.clear(), why: "limpiar") }

    private func paint(_ change: (inout NotchSpeech) -> Void) {
        var speech = surface.speech
        change(&speech)
        if speech != surface.speech { surface.speech = speech }
        apply(presence.painted(at: now), why: "hay algo que decir")
        place()
    }

    // MARK: chat

    func openChat(focus: Bool) {
        let command = presence.openChat()
        if !surface.chatOpen {
            surface.chatOpen = true
            place()
        }
        apply(command, why: "chat")
        panel.acceptsKeyboard = true
        if focus {
            panel.makeKeyAndOrderFront(nil)
            surface.focusRequest += 1
        }
        onChatChange?(true)
    }

    func closeChat() {
        guard presence.chatOpen || surface.chatOpen else { return }
        presence.closeChat()
        surface.chatOpen = false
        panel.acceptsKeyboard = false
        if panel.isKeyWindow { panel.resignKey() }
        // Shrink after SwiftUI has drawn the compact piece, so the chat is never cut for a frame.
        DispatchQueue.main.async { [weak self] in self?.place() }
        onChatChange?(false)
    }

    /// Only for the live probe: measuring the expiry must not take 90 s.
    func setExpiry(_ seconds: Double) { presence.expiry = seconds }

    // MARK: hover (promesa 260)

    private func checkHover() {
        let size = NotchLayout(expanded: false, availableWidth: Glass.visible.width, availableHeight: Glass.visible.height).size
        let inside = NotchLayout.keepsIntent(screen: Glass.screen, visible: Glass.visible, size: size, cursor: Glass.mouse, shown: presence.onScreen)
        apply(presence.hover(inside: inside, at: now), why: "cursor en el borde")
    }

    // MARK: window

    private func apply(_ command: NotchPresence.Command, why: String) {
        switch command {
        case .none: return
        case .forget:
            surface.speech.forget()
        case .appear:
            logger.notice("appear: \(why, privacy: .public)")
            place()
            let from = panel.isVisible ? panel.alphaValue : 0
            if !panel.isVisible { panel.alphaValue = 0 }
            panel.orderFrontRegardless()
            animate(.arriving(from: from))
        case .leave:
            logger.notice("leave: \(why, privacy: .public)")
            animate(.leaving)
        }
    }

    private func animate(_ kind: Motion) {
        motion?.invalidate()
        motionKind = kind; motionBegan = now
        frameTick()
        let timer = Timer(timeInterval: 1.0 / 120, repeats: true) { _ in MainThread.run { [weak self] in self?.frameTick() } }
        RunLoop.main.add(timer, forMode: .common)
        motion = timer
    }

    private func frameTick() {
        guard let kind = motionKind else { motion?.invalidate(); motion = nil; return }
        let elapsed = now - motionBegan
        switch kind {
        case .arriving(let from):
            let f = NotchMotion.arriving(at: elapsed)
            show(dy: f.dy, scale: f.scale, alpha: from + (1 - from) * f.opacity)
            if elapsed >= NotchMotion.entrance { finishMotion() }
        case .leaving:
            let f = NotchMotion.leaving(at: elapsed)
            show(dy: f.dy, scale: 1, alpha: min(panel.alphaValue, f.opacity))
            if elapsed >= NotchMotion.exit {
                finishMotion()
                if presence.left() {
                    panel.orderOut(nil)
                    panel.alphaValue = 0
                    show(dy: 0, scale: 1, alpha: 0)
                    surface.speech.forget()
                }
            }
        }
    }

    private func finishMotion() { motion?.invalidate(); motion = nil; motionKind = nil }

    private func show(dy: Double, scale: Double, alpha: Double) {
        panel.alphaValue = alpha
        if surface.scale != scale { surface.scale = scale }
        panel.setFrame(Glass.appKit(rest.offsetBy(dx: 0, dy: dy)), display: false)
    }

    /// Top and centre (promesa 251). What is placed is the visible piece, not the window: the window
    /// carries the room for the shadow and is moved back by it.
    func place() {
        let visible = Glass.visible
        let layout = NotchLayout(expanded: surface.chatOpen, availableWidth: visible.width, availableHeight: visible.height)
        let piece = NotchLayout.place(layout.size, in: visible)
        rest = CGRect(x: piece.minX - Self.shadowSide, y: piece.minY - Self.shadowTop,
                      width: piece.width + Self.shadowSide * 2, height: piece.height + Self.shadowTop + Self.shadowBottom)
        if motionKind == nil { panel.setFrame(Glass.appKit(rest), display: true) }
    }
}
