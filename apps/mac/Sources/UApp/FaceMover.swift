import UMac
import AppKit
import OSLog
import SwiftUI
import UCore

/// Grabbing, dragging and throwing the face, as on Windows. The physics lives in UCore.FaceFling;
/// this is the AppKit side: events in, window frames out. All geometry here is y-down (Quartz).
@MainActor
final class FaceMover {
    private let panel: NSPanel
    private let logger = Logger(subsystem: "com.zevcorp.u.mac", category: "Face")
    var onTap: (() -> Void)?
    var onLongPress: (() -> Void)?
    /// Asked on every release after a drag, with the cursor (y-down). True means someone kept the face
    /// (the dock, promesa 149) and it must not fly to a side.
    var onDrop: ((CGPoint) -> Bool)?
    private var takingOut = false

    private var pressed = false, moved = false, longFired = false
    private var downMouse = CGPoint.zero, downOrigin = CGPoint.zero
    private var velocity = FaceVelocity()
    private var longPress: Timer?

    private var flight: Timer?
    private var flightStart = CGPoint.zero, flightBegan = 0.0
    private var landing: FaceFling.Landing?

    private var scroll = ScrollFling()
    private var scrolling = false
    private var scrollEnd: Timer?
    private var scrollTap: CFMachPort?
    private var scrollSource: CFRunLoopSource?
    private var momentumUntil = 0.0

    init(panel: NSPanel) { self.panel = panel }

    // MARK: coordinates

    private var primaryTop: Double { Double(NSScreen.screens.first?.frame.maxY ?? 0) }
    private var mouse: CGPoint { let p = NSEvent.mouseLocation; return CGPoint(x: p.x, y: primaryTop - p.y) }
    var frame: CGRect {
        let f = panel.frame
        return CGRect(x: f.minX, y: primaryTop - f.maxY, width: f.width, height: f.height)
    }
    private func place(_ origin: CGPoint) {
        panel.setFrameOrigin(NSPoint(x: origin.x, y: primaryTop - origin.y - panel.frame.height))
    }
    private func workArea() -> CGRect {
        let center = NSPoint(x: panel.frame.midX, y: panel.frame.midY)
        let screen = NSScreen.screens.first { $0.frame.contains(center) } ?? NSScreen.main ?? NSScreen.screens[0]
        let v = screen.visibleFrame
        return CGRect(x: v.minX, y: primaryTop - v.maxY, width: v.width, height: v.height)
    }

    // MARK: mouse

    func mouseDown() {
        stopFlight()
        logger.info("down mouse=(\(Int(self.mouse.x)),\(Int(self.mouse.y))) origin=(\(Int(self.frame.minX)),\(Int(self.frame.minY)))")
        pressed = true; moved = false; longFired = false
        downMouse = mouse; downOrigin = frame.origin
        velocity.reset(at: downMouse, time: ProcessInfo.processInfo.systemUptime)
        longPress?.invalidate()
        longPress = Timer.scheduledTimer(withTimeInterval: FaceFling.longPressSeconds, repeats: false) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.pressed, !self.moved else { return }
                self.longFired = true
                self.onLongPress?()
            }
        }
    }

    func mouseDragged() {
        guard pressed else { return }
        let now = mouse
        let dx = now.x - downMouse.x, dy = now.y - downMouse.y
        if !moved, FaceFling.isDrag(dx: dx, dy: dy) { moved = true; longPress?.invalidate() }
        guard moved else { return }
        place(CGPoint(x: downOrigin.x + dx, y: downOrigin.y + dy))
        velocity.sample(now, time: ProcessInfo.processInfo.systemUptime)
        logger.info("drag mouse=(\(Int(now.x)),\(Int(now.y))) down=(\(Int(self.downMouse.x)),\(Int(self.downMouse.y))) origin=(\(Int(self.frame.minX)),\(Int(self.frame.minY)))")
    }

    func mouseUp() {
        guard pressed else { return }
        pressed = false; longPress?.invalidate()
        if longFired { return }
        guard moved else { onTap?(); return }
        if onDrop?(mouse) == true { takingOut = false; return }
        if takingOut {
            // Taken out of the dock: it stays where it is dropped, whole on the screen (promesa 150).
            takingOut = false
            let origin = DockRule.placeOnTakeOut(drop: frame.origin, face: frame.size, work: workArea())
            place(origin); remember(origin)
            return
        }
        snap(vx: velocity.vx, vy: velocity.vy, gesture: "drag")
    }

    /// Pulled out of the dock: it appears centred under the cursor, never where it was stored, and
    /// the same gesture keeps dragging it.
    func beginTakeOut() {
        stopFlight()
        place(DockRule.placeOnAppear(cursor: mouse, face: frame.size, work: workArea()))
        pressed = true; moved = true; longFired = false; takingOut = true
        downMouse = mouse; downOrigin = frame.origin
        velocity.reset(at: downMouse, time: ProcessInfo.processInfo.systemUptime)
    }

    // MARK: two fingers

    /// The face goes with the fingers, not after them. Once the gesture starts it is heard through
    /// an event tap: the face slides out from under the cursor at once, and without the tap the rest
    /// of the push would scroll whatever is below instead.
    func scrollWheel(_ event: NSEvent) {
        let now = ProcessInfo.processInfo.systemUptime
        logger.info("scroll phase=\(event.phase.rawValue) momentum=\(event.momentumPhase.rawValue) d=(\(event.scrollingDeltaX),\(event.scrollingDeltaY)) precise=\(event.hasPreciseScrollingDeltas) inverted=\(event.isDirectionInvertedFromDevice) scrolling=\(self.scrolling)")
        if !event.momentumPhase.isEmpty { return }
        if !scrolling {
            guard event.phase.isEmpty || event.phase.contains(.began) || event.phase.contains(.changed) else { return }
            scrolling = true
            stopFlight()
            startScrollTap()
        }
        if event.phase.contains(.ended) || event.phase.contains(.cancelled) {
            finishScroll(pause: 0)
            return
        }
        let unit = event.hasPreciseScrollingDeltas ? 1.0 : 10.0
        // The direction is the finger's, not the document's: this pushes an object.
        let sign = event.isDirectionInvertedFromDevice ? 1.0 : -1.0
        let dx = event.scrollingDeltaX * unit * sign, dy = event.scrollingDeltaY * unit * sign
        guard dx != 0 || dy != 0 else { return }
        let work = workArea(), current = frame
        place(CGPoint(x: min(max(current.minX + dx, work.minX - current.width * 0.35), work.maxX - current.width * 0.65),
                      y: min(max(current.minY + dy, work.minY - current.height * 0.35), work.maxY - current.height * 0.65)))
        scroll.add(dx: dx, dy: dy, at: now)
        // Mouse wheels have no phases: silence closes the gesture.
        scrollEnd?.invalidate()
        if event.phase.isEmpty {
            scrollEnd = Timer.scheduledTimer(withTimeInterval: FaceFling.scrollPause, repeats: false) { [weak self] _ in
                Task { @MainActor in self?.finishScroll(pause: FaceFling.scrollPause) }
            }
        }
    }

    private func finishScroll(pause: Double) {
        guard scrolling else { return }
        scrolling = false; scrollEnd?.invalidate()
        // Keep swallowing the trackpad's momentum briefly so it does not scroll the app below.
        momentumUntil = ProcessInfo.processInfo.systemUptime + 1.5
        let v = scroll.finish(at: ProcessInfo.processInfo.systemUptime, pause: pause)
        snap(vx: v.vx, vy: v.vy, gesture: "two-finger")
        Timer.scheduledTimer(withTimeInterval: 1.6, repeats: false) { [weak self] _ in
            Task { @MainActor in if self?.scrolling == false { self?.stopScrollTap() } }
        }
    }

    private func startScrollTap() {
        guard scrollTap == nil else { return }
        let mask = CGEventMask(1) << CGEventType.scrollWheel.rawValue
        let callback: CGEventTapCallBack = { _, type, event, info in
            guard let info else { return Unmanaged.passUnretained(event) }
            let mover = Unmanaged<FaceMover>.fromOpaque(info).takeUnretainedValue()
            if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
                MainThread.run { if let tap = mover.scrollTap { CGEvent.tapEnable(tap: tap, enable: true) } }
                return Unmanaged.passUnretained(event)
            }
            guard type == .scrollWheel, let ns = NSEvent(cgEvent: event) else { return Unmanaged.passUnretained(event) }
            let consumed = MainThread.run { () -> Bool in
                if mover.scrolling { mover.scrollWheel(ns); return true }
                return !ns.momentumPhase.isEmpty && ProcessInfo.processInfo.systemUptime < mover.momentumUntil
            }
            return consumed ? nil : Unmanaged.passUnretained(event)
        }
        guard let tap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap, options: .defaultTap,
                                          eventsOfInterest: mask, callback: callback, userInfo: Unmanaged.passUnretained(self).toOpaque()) else {
            logger.error("scroll tap unavailable; two-finger push only while the cursor is over the face")
            return
        }
        scrollTap = tap
        scrollSource = CFMachPortCreateRunLoopSource(nil, tap, 0)
        CFRunLoopAddSource(CFRunLoopGetMain(), scrollSource, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)
    }

    private func stopScrollTap() {
        if let tap = scrollTap { CGEvent.tapEnable(tap: tap, enable: false) }
        if let source = scrollSource { CFRunLoopRemoveSource(CFRunLoopGetMain(), source, .commonModes) }
        scrollTap = nil; scrollSource = nil
    }

    // MARK: flight

    private func snap(vx: Double, vy: Double, gesture: String) {
        let start = frame
        let target = FaceFling.landing(frame: start, workArea: workArea(), vx: vx, vy: vy)
        logger.info("\(gesture, privacy: .public) release v=(\(Int(vx)),\(Int(vy))) px/s from (\(Int(start.minX)),\(Int(start.minY))) to (\(Int(target.origin.x)),\(Int(target.origin.y))) in \(Int(target.duration * 1000)) ms crossed=\(target.crossed)")
        remember(target.origin)
        guard target.duration > 0 else { place(target.origin); return }
        stopFlight()
        landing = target; flightStart = start.origin; flightBegan = ProcessInfo.processInfo.systemUptime
        let timer = Timer(timeInterval: 1.0 / 120, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.frameTick() }
        }
        RunLoop.main.add(timer, forMode: .common)
        flight = timer
    }

    private func frameTick() {
        guard let landing else { stopFlight(); return }
        let t = (ProcessInfo.processInfo.systemUptime - flightBegan) / landing.duration
        place(FaceFling.position(from: flightStart, landing: landing, at: t))
        if t >= 1 { stopFlight() }
    }

    /// Anything else placing the face (grabbing it, following an action) ends the flight first.
    func stopFlight() {
        flight?.invalidate(); flight = nil; landing = nil
    }

    // MARK: where the user left it

    private func remember(_ origin: CGPoint) {
        UserDefaults.standard.set([origin.x, origin.y], forKey: "faceOrigin")
    }

    /// Restores the last position if it still falls on a connected screen.
    func restore() -> Bool {
        guard let saved = UserDefaults.standard.array(forKey: "faceOrigin") as? [Double], saved.count == 2 else { return false }
        let origin = CGPoint(x: saved[0], y: saved[1])
        let appKit = NSPoint(x: origin.x + panel.frame.width / 2, y: primaryTop - origin.y - panel.frame.height / 2)
        guard NSScreen.screens.contains(where: { $0.visibleFrame.contains(appKit) }) else { return false }
        place(origin)
        return true
    }
}

/// The face's hosting view hands left-button and scroll events to FaceMover; the right button stays
/// with SwiftUI for the context menu.
final class FaceHostingView: NSHostingView<Face> {
    weak var mover: FaceMover?
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override func hitTest(_ point: NSPoint) -> NSView? {
        let hit = super.hitTest(point)
        return hit == nil ? nil : self
    }
    override func mouseDown(with event: NSEvent) {
        Logger(subsystem: "com.zevcorp.u.mac", category: "Face").info("mouseDown on face view")
        if event.modifierFlags.contains(.control) { super.mouseDown(with: event); return }
        MainThread.run { mover?.mouseDown() }
    }
    override func mouseDragged(with event: NSEvent) { MainThread.run { mover?.mouseDragged() } }
    override func mouseUp(with event: NSEvent) { MainThread.run { mover?.mouseUp() } }
    override func scrollWheel(with event: NSEvent) { MainThread.run { mover?.scrollWheel(event) } }
}
