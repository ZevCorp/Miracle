import UMac
import AppKit
import OSLog
import SwiftUI
import UCore

/// What the dock view draws. The controller writes it; SwiftUI only reads.
@MainActor
final class DockSurface: ObservableObject {
    @Published var unfolded = false
    @Published var dx = DockRule.slide
    @Published var opacity = 0.0
    @Published var guarding = false
    @Published var menuOpen = false
    /// The bar as drawn, in the window's y-down coordinates. The cursor is "over the dock" only on
    /// what is drawn: the room around it for the shadow is glass.
    var barInWindow = CGRect.zero
    /// The bar's own height, measured by SwiftUI; the unfolded window follows it.
    var barHeight = 0.0
}

private final class DockPanel: NSPanel {
    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}

/// THE DOCK ("el muelle"), as on Windows: a thin tab against the right edge, always there, and the
/// panel unfolding leftwards from it when the cursor arrives. It folds 350 ms after the cursor leaves,
/// unless the notch chat is open. The face can be dropped on it to put it away, and pulled out again.
@MainActor
final class DockController {
    /// Room left of the bar for the status chip, and around the bar for its shadow.
    /// The bar is narrower than on Windows (150) since 2026-10-01: unfolded it sits over the right side
    /// of whatever the person is reading, and the big one covered too much of it.
    static let chipColumn = 178.0, shadow = 24.0, barWidth = 132.0
    /// The stored face, a little smaller than the floating one so it fits the bar.
    static let seat = 58.0
    static var unfoldedWidth: Double { chipColumn + shadow * 2 + barWidth + DockRule.tabWidth }

    private let panel: NSPanel
    let surface = DockSurface()
    private let logger = Logger(subsystem: "com.zevcorp.u.mac", category: "Dock")
    private let conversationOpen: () -> Bool
    private var poll: Timer?
    private var grace: Timer?
    private var motion: Timer?
    private var motionBegan = 0.0, motionFrom = DockRule.Frame(dx: DockRule.slide, opacity: 0)
    private var wasOver = false
    /// The tab's vertical centre (y-down). It does not move when the panel unfolds.
    private var center: Double?

    var unfolded: Bool { surface.unfolded }
    var onChange: ((Bool) -> Void)?
    var onTakeOut: (() -> Void)?
    var onSeatTap: (() -> Void)?

    init(model: AppModel, learn: LearnController, conversationOpen: @escaping () -> Bool) {
        self.conversationOpen = conversationOpen
        panel = DockPanel(contentRect: NSRect(x: 0, y: 0, width: DockRule.tabWidth, height: DockRule.tabHeight), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isOpaque = false; panel.backgroundColor = .clear; panel.hasShadow = false
        panel.level = .floating; panel.hidesOnDeactivate = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]
        panel.isReleasedWhenClosed = false
        panel.animationBehavior = .none
        panel.acceptsMouseMovedEvents = true
        let host = DockHostingView(rootView: DockView(model: model, learn: learn, surface: surface, dock: self))
        host.sizingOptions = []
        panel.contentView = host
        place()
        panel.orderFrontRegardless()
        // The cursor is sampled often: entering has to feel like MouseEnter, not like a poll.
        poll = Timer(timeInterval: 0.05, repeats: true) { _ in MainThread.run { [weak self] in self?.checkCursor() } }
        RunLoop.main.add(poll!, forMode: .common)
    }

    /// The window, in y-down screen coordinates. Dropping the face near it stores it (promesa 149).
    var frame: CGRect { Glass.yDown(panel.frame) }

    /// SwiftUI measured the bar. A new height (the menu, the stop button) re-sizes the window around
    /// the same centre, so the tab does not move.
    func barMeasured(_ rect: CGRect) {
        surface.barInWindow = rect
        guard abs(rect.height - surface.barHeight) > 0.5 else { return }
        surface.barHeight = rect.height
        if surface.unfolded { place() }
    }

    /// The drawn bar on screen (y-down), for the probe.
    var barOnScreen: CGRect { surface.barInWindow.offsetBy(dx: frame.minX, dy: frame.minY) }

    /// The tab and, unfolded, the drawn bar: what the cursor can be "over".
    private func cursorOver() -> Bool {
        let p = Glass.mouse, f = frame
        let tab = CGRect(x: f.maxX - DockRule.tabWidth, y: f.midY - DockRule.tabHeight / 2, width: DockRule.tabWidth, height: DockRule.tabHeight)
        if tab.contains(p) { return true }
        guard surface.unfolded else { return false }
        return surface.barInWindow.offsetBy(dx: f.minX, dy: f.minY).insetBy(dx: -1, dy: -1).contains(p)
    }

    private func checkCursor() {
        let over = cursorOver()
        defer { wasOver = over }
        if over && !wasOver { unfold("el cursor entró") }
        else if !over && wasOver { startGrace() }
    }

    func toggle() { surface.unfolded ? fold("lo pidió la aplicación") : unfold("lo pidió la aplicación") }

    func unfold(_ why: String) {
        grace?.invalidate(); grace = nil
        guard !surface.unfolded else { return }
        surface.unfolded = true
        place()
        runMotion()
        // Opened with nobody near (a shortcut, the menu): arm the watch anyway, or it stays open forever.
        if !cursorOver() { startGrace() }
        logger.info("desplegado · \(why, privacy: .public)")
        onChange?(true)
    }

    func fold(_ why: String) {
        grace?.invalidate(); grace = nil
        guard surface.unfolded else { return }
        surface.unfolded = false
        surface.menuOpen = false
        runMotion()
        logger.info("plegado · \(why, privacy: .public)")
        onChange?(false)
    }

    private func startGrace() {
        guard grace == nil else { return }
        let timer = Timer(timeInterval: DockRule.grace, repeats: true) { _ in MainThread.run { [weak self] in self?.reconsider() } }
        RunLoop.main.add(timer, forMode: .common)
        grace = timer
    }

    /// Asked again every 350 ms while it is open without the cursor: when what held it ends (the chat
    /// closes), it folds without needing the cursor to pass by again.
    private func reconsider() {
        let must = DockRule.unfolded(cursorOver: cursorOver(), conversationOpen: conversationOpen(), keyboardInside: panel.isKeyWindow)
        if !must { fold("el cursor se fue y no quedaba nada abierto") }
    }

    // MARK: the face, put away (promesas 149 y 150)

    var guarding: Bool {
        get { surface.guarding }
        set {
            guard surface.guarding != newValue else { return }
            surface.guarding = newValue
            logger.info("\(newValue ? "la carita queda guardada aquí" : "la carita sale del muelle", privacy: .public)")
        }
    }

    // MARK: motion

    private func runMotion() {
        motionFrom = DockRule.Frame(dx: surface.dx, opacity: surface.opacity)
        motionBegan = ProcessInfo.processInfo.systemUptime
        motion?.invalidate()
        let timer = Timer(timeInterval: 1.0 / 120, repeats: true) { _ in MainThread.run { [weak self] in self?.motionTick() } }
        RunLoop.main.add(timer, forMode: .common)
        motion = timer
        motionTick()
    }

    private func motionTick() {
        let elapsed = ProcessInfo.processInfo.systemUptime - motionBegan
        if surface.unfolded {
            let f = DockRule.unfolding(at: elapsed, from: DockRule.Frame(dx: DockRule.slide, opacity: motionFrom.opacity))
            surface.dx = f.dx; surface.opacity = f.opacity
            if elapsed >= DockRule.unfold { motion?.invalidate(); motion = nil }
        } else {
            let f = DockRule.folding(at: elapsed, from: motionFrom)
            surface.dx = f.dx; surface.opacity = f.opacity
            if elapsed >= DockRule.fold {
                motion?.invalidate(); motion = nil
                place()
            }
        }
    }

    /// Glued to the right edge with the tab still. Folded, the window is the tab and nothing else, so
    /// the rest of the edge stays the user's.
    func place() {
        let visible = Glass.visible
        let middle = center ?? DockRule.defaultCenter(visible)
        center = middle
        let open = surface.unfolded || motion != nil
        // Unfolded, the window is as tall as the bar and its shadow: glass beyond it would still be
        // a window over someone else's work.
        let barHeight = surface.barHeight > 0 ? surface.barHeight + Self.shadow * 2 : 620
        let size = open ? CGSize(width: Self.unfoldedWidth, height: min(max(DockRule.tabHeight, barHeight), max(DockRule.tabHeight, visible.height - 24)))
                        : CGSize(width: DockRule.tabWidth, height: DockRule.tabHeight)
        panel.setFrame(Glass.appKit(DockRule.frame(size: size, visible: visible, center: middle)), display: true)
    }

    func screenChanged() { center = nil; place() }
    func hide() { fold("Ü se oculta"); panel.orderOut(nil) }
    func show() { place(); panel.orderFrontRegardless() }
    var isVisible: Bool { panel.isVisible }
    var contentView: NSView? { panel.contentView }
}

/// Clicks land without activating Ü first: the dock lives over someone else's work.
private final class DockHostingView: NSHostingView<DockView> {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

// MARK: - view

/// The Windows studio palette ("Estudio"): the bar floats over someone else's desktop.
private enum Studio {
    static let bar = Color(red: 0xF7 / 255, green: 0xF9 / 255, blue: 0xFD / 255)
    static let barEdge = Color(red: 0xC6 / 255, green: 0xD0 / 255, blue: 0xE2 / 255)
    static let surface = Color.white
    static let edge = Color(red: 0xE3 / 255, green: 0xE7 / 255, blue: 0xEE / 255)
    static let ink = Color(red: 0x0F / 255, green: 0x15 / 255, blue: 0x24 / 255)
    static let inkMid = Color(red: 0x5A / 255, green: 0x64 / 255, blue: 0x78 / 255)
    static let alert = Color(red: 0xD3 / 255, green: 0x2F / 255, blue: 0x45 / 255)
    static let alertSoft = Color(red: 0xFD / 255, green: 0xEC / 255, blue: 0xEF / 255)
    static let shadow = Color(red: 0x1B / 255, green: 0x24 / 255, blue: 0x37 / 255)
    static let tabRest = Color(red: 0xA8 / 255, green: 0xA8 / 255, blue: 0xAE / 255).opacity(0.5)
}

private struct DockView: View {
    @ObservedObject var model: AppModel
    @ObservedObject var learn: LearnController
    @ObservedObject var surface: DockSurface
    let dock: DockController

    var body: some View {
        HStack(spacing: 0) {
            if surface.unfolded || surface.opacity > 0 {
                HStack(alignment: .bottom, spacing: 0) {
                    chip.frame(width: DockController.chipColumn, alignment: .trailing)
                    bar.padding(DockController.shadow)
                }
                .opacity(surface.opacity)
                .offset(x: surface.dx)
            } else {
                Spacer(minLength: 0)
            }
            tab
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
        .coordinateSpace(name: "dock")
        .environment(\.colorScheme, .light)
    }

    /// 14 × 64 of gesture for a 5 point drawing. White with an edge while the face is put away here:
    /// without it, "I put it away" and "Ü closed" would look the same.
    private var tab: some View {
        ZStack {
            Color.clear.contentShape(Rectangle())
            Capsule()
                .fill(surface.guarding ? Studio.surface : Studio.tabRest)
                .overlay(Capsule().strokeBorder(Studio.edge, lineWidth: surface.guarding ? 1 : 0))
                .frame(width: surface.unfolded ? DockRule.drawWidthOpen : DockRule.drawWidth, height: DockRule.drawHeight)
                .animation(.linear(duration: surface.unfolded ? DockRule.tabGrow : DockRule.tabShrink), value: surface.unfolded)
        }
        .frame(width: DockRule.tabWidth, height: DockRule.tabHeight)
        .accessibilityElement()
        .accessibilityLabel(surface.guarding ? "Panel de Ü, con la carita guardada" : "Panel de Ü")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction { dock.toggle() }
    }

    @ViewBuilder private var chip: some View {
        if (model.busy || model.microphone) && !model.status.isEmpty {
            Text(model.status)
                .font(.system(size: 11))
                .lineLimit(1).truncationMode(.tail)
                .foregroundStyle(Color.white.opacity(0.93))
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(RoundedRectangle(cornerRadius: 10).fill(Color(red: 0x0F / 255, green: 0x13 / 255, blue: 0x1C / 255).opacity(0.95)))
                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Color.white.opacity(0.22), lineWidth: 1))
                .frame(maxWidth: 170, alignment: .trailing)
                .padding(.trailing, 8).padding(.bottom, 14 + DockController.shadow)
        } else {
            Color.clear.frame(width: 1, height: 1)
        }
    }

    private var bar: some View {
        VStack(spacing: 0) {
            if surface.guarding {
                ZStack {
                    FaceArtwork(mode: model.mode, dark: UserDefaults.standard.bool(forKey: "faceDark"))
                    SeatGrip(dock: dock)
                }
                .frame(width: DockController.seat, height: DockController.seat)
                .padding(.top, 2).padding(.bottom, 10)
                .accessibilityLabel("Carita guardada: arrástrala para sacarla")
            }
            learnPill
            // No "Colgar": while Ü is talking, Detener below (and the pause on the notch) end it. One
            // way to stop is clearer than two that look different.
            if !model.microphone {
                pill("Hablar", system: "waveform") { model.toggleLiveFromFace() }.padding(.top, 7)
            }
            pill("Chat", system: "bubble.left") { model.setNotchExpanded(true) }.padding(.top, 7)
            pill("Memoria", system: "brain") { model.selectedTab = 2; model.showWindow?() }.padding(.top, 7)
            VStack(spacing: 0) {
                if model.busy || model.microphone {
                    Button { model.stop(reason: "muelle") } label: {
                        Label("Detener", systemImage: "stop.fill").font(.system(size: 13, weight: .semibold))
                            .frame(maxWidth: .infinity).frame(height: 34)
                            .background(Capsule().fill(Color.black))
                            .contentShape(Capsule())
                            .foregroundStyle(Color.white)
                    }.buttonStyle(.plain)
                    Rectangle().fill(Studio.edge).frame(height: 1).padding(.horizontal, 6).padding(.top, 8)
                }
                Button { withAnimation(.easeOut(duration: 0.18)) { surface.menuOpen.toggle() } } label: {
                    Image(systemName: "chevron.up").font(.system(size: 11, weight: .semibold))
                        .rotationEffect(.degrees(surface.menuOpen ? 180 : 0))
                        .foregroundStyle(Studio.inkMid)
                        .frame(maxWidth: .infinity).frame(height: 22).contentShape(Rectangle())
                }
                .buttonStyle(.plain).padding(.top, 4)
                .accessibilityLabel(surface.menuOpen ? "Cerrar menú" : "Abrir menú")
                if surface.menuOpen {
                    VStack(alignment: .leading, spacing: 2) {
                        row("Abrir Ü", system: "macwindow") { model.selectedTab = 0; model.showWindow?() }
                        row("Configuración", system: "gearshape") { model.selectedTab = 1; model.showWindow?() }
                        row("Salir de Ü", system: "power") { NSApp.terminate(nil) }
                        Rectangle().fill(Studio.edge).frame(height: 1).padding(.vertical, 6)
                        Text(model.hasCredential ? "Graph configurado" : "Graph sin credencial")
                            .font(.system(size: 10)).foregroundStyle(Studio.inkMid)
                        Text("Ü para Mac \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "")")
                            .font(.system(size: 10)).foregroundStyle(Studio.inkMid.opacity(0.8))
                    }.padding(.top, 4).transition(.opacity)
                }
            }.padding(.top, 8)
        }
        .padding(.horizontal, 10).padding(.vertical, 23)
        .frame(width: DockController.barWidth)
        .background(Capsule(style: .circular).fill(Studio.bar).shadow(color: Studio.shadow.opacity(0.18), radius: 14, x: 0, y: 6))
        .overlay(Capsule(style: .circular).strokeBorder(Studio.barEdge, lineWidth: 1))
        .fixedSize(horizontal: false, vertical: true)
        .background(GeometryReader { g in
            Color.clear.onAppear { dock.barMeasured(g.frame(in: .named("dock"))) }
                .onChange(of: g.frame(in: .named("dock"))) { dock.barMeasured(g.frame(in: .named("dock"))) }
        })
    }

    /// APRENDER, first as Learn is on Windows. It says what pressing it will do: start the demo,
    /// cancel the wait for the app, or finish the recording; and while Graph structures it, it waits.
    @ViewBuilder private var learnPill: some View {
        if learn.closing {
            HStack(spacing: 8) { ProgressView().controlSize(.small); Text("Aprendiendo…").font(.system(size: 13, weight: .medium)) }
                .foregroundStyle(Studio.inkMid)
                .frame(maxWidth: .infinity).frame(height: 34)
                .background(Capsule().fill(Studio.surface))
                .overlay(Capsule().strokeBorder(Studio.edge, lineWidth: 1))
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Aprendiendo: Graph está estructurando lo que enseñaste")
        } else if learn.teaching {
            Button { learn.toggle() } label: {
                Label(learn.recording ? "Terminar" : "Cancelar", systemImage: learn.recording ? "stop.circle.fill" : "xmark.circle")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.white)
                    .frame(maxWidth: .infinity).frame(height: 34)
                    .background(Capsule().fill(Color.black))
                    .contentShape(Capsule())
            }
            .buttonStyle(LiftStyle())
            .accessibilityLabel(learn.recording ? "Terminar de enseñar" : "Cancelar la enseñanza")
        } else {
            pill("Aprender", system: "graduationcap") { learn.toggle() }
                .accessibilityLabel("Aprender: enséñale a Ü una tarea")
        }
    }

    private func pill(_ title: String, system: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: system)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Studio.ink)
                .frame(maxWidth: .infinity).frame(height: 34)
                .background(Capsule().fill(Studio.surface))
                .overlay(Capsule().strokeBorder(Studio.edge, lineWidth: 1))
                .contentShape(Capsule())
        }
        .buttonStyle(LiftStyle())
    }

    private func row(_ title: String, system: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: system).font(.system(size: 11)).foregroundStyle(Studio.ink)
                .frame(maxWidth: .infinity, alignment: .leading).frame(height: 22).contentShape(Rectangle())
        }.buttonStyle(.plain)
    }
}

/// Rises under the hand and sinks when pressed: the only animation of the pills.
private struct LiftStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View { Lifted(configuration: configuration) }
    private struct Lifted: View {
        let configuration: ButtonStyle.Configuration
        @State private var hover = false
        var body: some View {
            configuration.label
                .offset(y: configuration.isPressed ? 0.5 : hover ? -1 : 0)
                .shadow(color: Studio.shadow.opacity(hover && !configuration.isPressed ? 0.12 : 0), radius: 4, y: 2)
                .animation(.easeOut(duration: 0.12), value: hover)
                .onHover { hover = $0 }
        }
    }
}

/// The stored face: a tap talks, a drag pulls it out under the hand and keeps dragging it.
private struct SeatGrip: NSViewRepresentable {
    let dock: DockController
    func makeNSView(context: Context) -> GripView { let v = GripView(); v.dock = dock; return v }
    func updateNSView(_ view: GripView, context: Context) { view.dock = dock }

    final class GripView: NSView {
        weak var dock: DockController?
        private var down = CGPoint.zero, pulled = false
        override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
        override func mouseDown(with event: NSEvent) { down = NSEvent.mouseLocation; pulled = false }
        override func mouseDragged(with event: NSEvent) {
            let p = NSEvent.mouseLocation
            // Once pulled, the face takes the gesture over (AppDelegate follows it to the release).
            MainThread.run {
                if !pulled, FaceFling.isDrag(dx: p.x - down.x, dy: p.y - down.y) { pulled = true; dock?.onTakeOut?() }
            }
        }
        override func mouseUp(with event: NSEvent) {
            MainThread.run { if !pulled { dock?.onSeatTap?() } }
        }
    }
}
