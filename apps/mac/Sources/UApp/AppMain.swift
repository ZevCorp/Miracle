import AppKit
import OSLog
import SwiftUI
import UCore
import UMac

final class FloatingPanel: NSPanel {
    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    lazy var model = AppModel()
    var diagnosticMode = false
    private var terminationSignal: DispatchSourceSignal?
    var face: NSPanel!
    var faceMover: FaceMover!
    var window: NSWindow!
    var statusItem: NSStatusItem!
    var globalKeys: Any?
    var localKeys: Any?
    var observation: NSObjectProtocol?
    var highlight: NSPanel?
    var notch: NotchController!
    var dock: DockController!
    var learn: LearnController!
    var screenObservation: NSObjectProtocol?
    private var probeObservation: NSObjectProtocol?
    private var takeOutMonitor: Any?
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Diagnostics run in a separate process and must never close the user's UI.
        let diagnosticFlags = ["--passive-flow-test", "--voice-keys-test", "--listen-probe", "--listen-test", "--cycle-test", "--notch-test", "--learn-test", "--social-voice-test", "--wake-mic-test", "--chat-scroll-test", "--wake-test", "--spoken-voice-test", "--configure-voice-key", "--configure-graph-key", "--launch-test", "--face-drag-test", "--voice-test", "--audio-test", "--execution-test", "--smoke-test", "--diagnose"]
        diagnosticMode = CommandLine.arguments.contains(where: diagnosticFlags.contains)
        if !diagnosticMode { terminateOlderCopies() }
        if let index = CommandLine.arguments.firstIndex(of: "--listen-probe"), CommandLine.arguments.count > index + 1 {
            Task { await ListenProbe.probe(output: URL(fileURLWithPath: CommandLine.arguments[index + 1])) }
            return
        }
        if let index = CommandLine.arguments.firstIndex(of: "--passive-flow-test"), CommandLine.arguments.count > index + 1 {
            Task { await PassiveFlowProbe.run(output: URL(fileURLWithPath: CommandLine.arguments[index + 1])) }
            return
        }
        if let index = CommandLine.arguments.firstIndex(of: "--cycle-test"), CommandLine.arguments.count > index + 2 {
            Task { await CycleProbe.run(directory: URL(fileURLWithPath: CommandLine.arguments[index + 1]), output: URL(fileURLWithPath: CommandLine.arguments[index + 2])) }
            return
        }
        if let index = CommandLine.arguments.firstIndex(of: "--listen-test"), CommandLine.arguments.count > index + 2 {
            Task { await ListenProbe.listen(directory: URL(fileURLWithPath: CommandLine.arguments[index + 1]), output: URL(fileURLWithPath: CommandLine.arguments[index + 2])) }
            return
        }
        if let index = CommandLine.arguments.firstIndex(of: "--social-voice-test"), CommandLine.arguments.count > index + 1 {
            Task { await SocialVoiceProbe.run(directory: URL(fileURLWithPath: CommandLine.arguments[index + 1])) }
            return
        }
        if let index = CommandLine.arguments.firstIndex(of: "--chat-scroll-test"), CommandLine.arguments.count > index + 1 {
            Task { await ChatScrollProbe.run(output: URL(fileURLWithPath: CommandLine.arguments[index + 1])) }
            return
        }
        if let index = CommandLine.arguments.firstIndex(of: "--wake-mic-test"), CommandLine.arguments.count > index + 2 {
            Task { await WakeProbe.microphone(input: URL(fileURLWithPath: CommandLine.arguments[index + 1]), output: URL(fileURLWithPath: CommandLine.arguments[index + 2])) }
            return
        }
        if let index = CommandLine.arguments.firstIndex(of: "--wake-test"), CommandLine.arguments.count > index + 2 {
            Task { await WakeProbe.run(input: URL(fileURLWithPath: CommandLine.arguments[index + 1]), output: URL(fileURLWithPath: CommandLine.arguments[index + 2])) }
            return
        }
        if let index = CommandLine.arguments.firstIndex(of: "--spoken-voice-test"), CommandLine.arguments.count > index + 2 {
            Task { await SmokeTest.spokenVoice(input: URL(fileURLWithPath: CommandLine.arguments[index + 1]), output: URL(fileURLWithPath: CommandLine.arguments[index + 2])) }
            return
        }
        if let index = CommandLine.arguments.firstIndex(of: "--configure-voice-key"), CommandLine.arguments.count > index + 1 {
            Task { await SmokeTest.configureVoice(output: URL(fileURLWithPath: CommandLine.arguments[index + 1])) }
            return
        }
        if let index = CommandLine.arguments.firstIndex(of: "--voice-keys-test"), CommandLine.arguments.count > index + 1 {
            Task { await VoiceKeysProbe.run(output: URL(fileURLWithPath: CommandLine.arguments[index + 1])) }
            return
        }
        if let index = CommandLine.arguments.firstIndex(of: "--learn-test"), CommandLine.arguments.count > index + 1 {
            Task { await LearnProbe.run(output: URL(fileURLWithPath: CommandLine.arguments[index + 1])) }
            return
        }
        if let index = CommandLine.arguments.firstIndex(of: "--notch-test"), CommandLine.arguments.count > index + 1 {
            Task { await NotchProbe.run(output: URL(fileURLWithPath: CommandLine.arguments[index + 1])) }
            return
        }
        if let index = CommandLine.arguments.firstIndex(of: "--face-drag-test"), CommandLine.arguments.count > index + 1 {
            Task { await FaceDragProbe.run(output: URL(fileURLWithPath: CommandLine.arguments[index + 1])) }
            return
        }
        if let index = CommandLine.arguments.firstIndex(of: "--launch-test"), CommandLine.arguments.count > index + 1 {
            Task { await SmokeTest.launch(output: URL(fileURLWithPath: CommandLine.arguments[index + 1])) }
            return
        }
        if let index = CommandLine.arguments.firstIndex(of: "--configure-graph-key"), CommandLine.arguments.count > index + 1 {
            Task { await SmokeTest.configureGraph(output: URL(fileURLWithPath: CommandLine.arguments[index + 1])) }
            return
        }
        if let index = CommandLine.arguments.firstIndex(of: "--audio-test"), CommandLine.arguments.count > index + 1 {
            Task { await SmokeTest.audio(output: URL(fileURLWithPath: CommandLine.arguments[index + 1])) }
            return
        }
        if let index = CommandLine.arguments.firstIndex(of: "--voice-test"), CommandLine.arguments.count > index + 1 {
            Task { await SmokeTest.voice(output: URL(fileURLWithPath: CommandLine.arguments[index + 1])) }
            return
        }
        if let index = CommandLine.arguments.firstIndex(of: "--execution-test"), CommandLine.arguments.count > index + 1 {
            Task { await SmokeTest.execution(output: URL(fileURLWithPath: CommandLine.arguments[index + 1])) }
            return
        }
        if let index = CommandLine.arguments.firstIndex(of: "--smoke-test"), CommandLine.arguments.count > index + 1 {
            Task { await SmokeTest.run(output: URL(fileURLWithPath: CommandLine.arguments[index + 1])) }
            return
        }
        if CommandLine.arguments.contains("--diagnose") {
            Task {
            let permissions = model.permissions.snapshot
            let result: [String: Any] = ["accessibility": permissions.accessibility.isGranted, "screenCapture": permissions.screenCapture.isGranted,
                                       "microphone": permissions.microphone.isGranted, "speech": permissions.speech.isGranted,
                                       "bundleIdentifier": Bundle.main.bundleIdentifier ?? "", "bundlePath": Bundle.main.bundleURL.path,
                                       "graphConfigured": await Credentials.read("GRAPH_API_KEY") != nil, "architecture": "native-swift", "version": "0.1.0"]
            if let data = try? JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]) { print(String(decoding: data, as: UTF8.self)) }
            NSApp.terminate(nil)
            }
            return
        }
        // Route installer termination through AppKit so pending history is flushed.
        signal(SIGTERM, SIG_IGN)
        terminationSignal = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
        terminationSignal?.setEventHandler { NSApp.terminate(nil) }
        terminationSignal?.resume()
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 510, height: 630), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Ü para Mac"; window.isReleasedWhenClosed = false; window.delegate = self
        window.contentView = NSHostingView(rootView: MainView(model: model)); window.center()
        face = FloatingPanel(contentRect: NSRect(x: 0, y: 0, width: VoiceHalo.panelSize, height: VoiceHalo.panelSize), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        face.isOpaque = false; face.backgroundColor = .clear; face.hasShadow = false
        face.level = .floating; face.hidesOnDeactivate = false; face.isMovableByWindowBackground = false
        face.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        let faceView = FaceHostingView(rootView: Face(model: model))
        faceMover = FaceMover(panel: face)
        faceView.mover = faceMover
        faceMover.onTap = { [weak self] in self?.model.toggleLiveFromFace() }
        faceMover.onLongPress = { UserDefaults.standard.set(!UserDefaults.standard.bool(forKey: "faceDark"), forKey: "faceDark") }
        face.contentView = faceView
        if !faceMover.restore(), let frame = NSScreen.main?.visibleFrame { face.setFrameOrigin(NSPoint(x: frame.maxX - VoiceHalo.panelSize - 20, y: frame.minY + 95)) }
        face.orderFrontRegardless()
        // THE NOTCH (Windows PanelDeAcciones): born at launch and hidden, so touching the top edge works
        // from the first second, before Ü has said anything.
        notch = NotchController(model: model)
        model.onNotchExpansion = { [weak self] expanded in
            guard let self else { return }
            // Closing the chat empties its line, as on Windows (CerrarChat → _entradaChat.Clear()).
            // Opening it to write takes the keyboard like Windows EnfocarEntrada → Activate(): a
            // non-activating panel alone lost keys to the app underneath (measured). Closing it gives
            // the keyboard back to the app the person was using.
            if expanded {
                NSApp.activate()
                self.notch.openChat(focus: true)
            } else {
                self.notch.closeChat(); self.model.draft = ""
                if NSApp.isActive && !self.window.isVisible { self.model.lastExternalApp?.activate() }
            }
        }
        model.onNotch = { [weak self] event in
            guard let notch = self?.notch else { return }
            Logger(subsystem: "com.zevcorp.u.mac", category: "Notch").debug("evento del modelo: \(String(describing: event).prefix(40), privacy: .private)")
            switch event {
            case .speak(let text, let fromU): notch.speak(text, fromU: fromU)
            case .closeTurn: notch.closeTurn()
            case .begin(let text): notch.begin(text)
            case .end(let text, let ok): notch.end(text, ok: ok)
            case .stopped(let text): notch.stopped(text)
            case .notify(let text): notch.notify(text)
            case .clear: notch.clear()
            }
        }
        // THE DOCK (Windows Muelle): the tab against the right edge, always there. The notch chat keeps
        // it unfolded; talking by voice does not.
        // APRENDER (Windows Learn): its button lives in the dock and its statuses reach the notch.
        learn = LearnController(model: model)
        learn.onStatus = { [weak self] text in self?.notch.notify(text) }
        dock = DockController(model: model, learn: learn) { [weak self] in self?.notch.chatOpen == true }
        dock.onSeatTap = { [weak self] in self?.model.toggleLiveFromFace() }
        dock.onTakeOut = { [weak self] in
            guard let self else { return }
            self.faceMover.beginTakeOut()
            self.face.orderFrontRegardless()
            // The seat leaves the view as soon as the face is out, and with it the view that was
            // receiving the drag: the rest of the gesture is followed at the application level.
            self.takeOutMonitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDragged, .leftMouseUp]) { [weak self] event in
                guard let self else { return event }
                if event.type == .leftMouseDragged { self.faceMover.mouseDragged() }
                else {
                    if let monitor = self.takeOutMonitor { NSEvent.removeMonitor(monitor) }
                    self.takeOutMonitor = nil
                    self.faceMover.mouseUp()
                }
                return event
            }
            self.dock.guarding = false
        }
        faceMover.onDrop = { [weak self] cursor in
            guard let self, DockRule.stores(dock: self.dock.frame, drop: cursor) else { return false }
            self.face.orderOut(nil)
            self.dock.guarding = true
            return true
        }
        screenObservation = NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.notch.place(); self?.dock.screenChanged() }
        }
        if CommandLine.arguments.contains("--probe-hooks") { listenToProbe() }
        model.showWindow = { [weak self] in self?.show() }
        model.hideWindow = { [weak self] in self?.window.orderOut(nil) }
        model.desktop.onHighlight = { [weak self] frame in self?.showHighlight(frame); self?.moveFace(beside: frame) }
        model.desktop.onAction = { [weak self] frame in self?.moveFace(beside: frame) }
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.title = "Ü"
        let menu = NSMenu()
        for (title, action, key) in [("Abrir Ü", #selector(show), ""),  ("Abrir chat del notch", #selector(showChat), ""), ("Abrir panel lateral", #selector(toggleDock), ""), ("Aprender / terminar", #selector(toggleLearn), ""), ("Hablar / silenciar", #selector(toggleVoice), ""), ("Detener tarea", #selector(stop), ""), ("Cómo me usas…", #selector(howYouUseMe), ""), ("Configuración…", #selector(settings), ","), ("Salir de Ü", #selector(quit), "q")] {
            let item = NSMenuItem(title: title, action: action, keyEquivalent: key); item.target = self; menu.addItem(item)
        }
        statusItem.menu = menu
        globalKeys = NSEvent.addGlobalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if event.cgEvent?.getIntegerValueField(.eventSourceUserData) == InputDriver.syntheticEventTag { return }
            if event.keyCode == 53 { Task { @MainActor in self?.model.stop(reason: "tecla Esc") } }
            if event.keyCode == 49 && event.modifierFlags.contains(.option) { Task { @MainActor in self?.show() } }
        }
        localKeys = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if event.cgEvent?.getIntegerValueField(.eventSourceUserData) == InputDriver.syntheticEventTag { return event }
            if event.keyCode == 53 {
                // Esc in the notch chat closes the chat, as on Windows; anywhere else it stops.
                if let self, self.notch.chatOpen, event.window === self.notch.panel { self.model.setNotchExpanded(false); return nil }
                Task { @MainActor in self?.model.stop(reason: "tecla Esc") }
            }
            return event
        }
        observation = NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main) { [weak self] note in
            guard let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication, app.processIdentifier != getpid() else { return }
            Task { @MainActor in self?.model.lastExternalApp = app }
        }
        if let app = NSWorkspace.shared.frontmostApplication, app.processIdentifier != getpid() { model.lastExternalApp = app }
        if !model.permissions.snapshot.canControlComputer { model.selectedTab = 1; show() }
        // Spec 001 (2026-10-01): mientras no haya un perfil que esta versión entienda, Ü pregunta al empezar
        // para qué se usa (lo decide PerfilDeUso, y lo juzga la promesa 108). Va DESPUÉS de elegir la pestaña:
        // cambiar de pestaña cierra la bienvenida (AppModel.selectedTab), y al elegir, la ventana sigue en la
        // que tocaba (Configuración si faltan permisos).
        if PerfilDeUso.hayQuePreguntar(en: .standard) { model.eligiendoPerfil = true; show() }
        model.startWakeListening()
        learn.finishPending()
    }
    private func terminateOlderCopies() {
        for app in NSWorkspace.shared.runningApplications {
            guard app.processIdentifier != getpid(),
                  app.executableURL?.lastPathComponent == "U",
                  [PermissionCenter.bundleIdentifier, "com.zevcorp.u", "com.zevcorp.u.mac.native"].contains(app.bundleIdentifier)
            else { continue }
            // A copy running a diagnostic shows no UI and ends by itself: closing it only broke the
            // measurement another session was taking.
            if Self.arguments(of: app.processIdentifier).contains(where: { $0.hasPrefix("--") && $0 != "--probe-hooks" }) { continue }
            // There must be one process even when `open -n` was used by an old launcher.
            // A graceful close first, waited for: a forced one looks like a crash to the login agent,
            // which reopened that copy 10 s later and closed this one in turn (measured 2026-09-30).
            app.terminate()
            let deadline = Date().addingTimeInterval(2)
            while !app.isTerminated && Date() < deadline { RunLoop.current.run(until: Date().addingTimeInterval(0.05)) }
            if !app.isTerminated { app.forceTerminate() }
        }
    }

    /// Another process's command line (KERN_PROCARGS2), to tell a diagnostic run from a normal Ü.
    private static func arguments(of pid: pid_t) -> [String] {
        var mib = [CTL_KERN, KERN_PROCARGS2, pid], size = 0
        guard sysctl(&mib, 3, nil, &size, nil, 0) == 0, size > 4 else { return [] }
        var buffer = [UInt8](repeating: 0, count: size)
        guard sysctl(&mib, 3, &buffer, &size, nil, 0) == 0 else { return [] }
        let argc = buffer.withUnsafeBytes { $0.load(as: Int32.self) }
        var index = MemoryLayout<Int32>.size
        while index < size && buffer[index] != 0 { index += 1 }      // the executable path
        while index < size && buffer[index] == 0 { index += 1 }      // padding
        var arguments: [String] = []
        while arguments.count < Int(argc) && index < size {
            let start = index
            while index < size && buffer[index] != 0 { index += 1 }
            arguments.append(String(decoding: buffer[start..<index], as: UTF8.self))
            index += 1
        }
        return Array(arguments.dropFirst())
    }
    @objc func show() {
        if let app = NSWorkspace.shared.frontmostApplication, app.processIdentifier != getpid() { model.lastExternalApp = app }
        NSApp.activate(ignoringOtherApps: true); window.makeKeyAndOrderFront(nil); model.refreshPermissions()
    }
    @objc func showChat() { model.setNotchExpanded(true) }
    @objc func toggleDock() { dock.toggle() }
    @objc func toggleLearn() { learn.toggle() }
    @objc func settings() { model.selectedTab = 1; show() }
    @objc func howYouUseMe() { model.eligiendoPerfil = true; show() }
    @objc func toggleVoice() { model.toggleMicrophone() }
    @objc func stop() { model.stop(reason: "menú") }
    @objc func quit() { NSApp.terminate(nil) }
    func applicationWillTerminate(_ notification: Notification) {
        guard !diagnosticMode else { return }
        model.flushHistory()
        model.stop()
        if let globalKeys { NSEvent.removeMonitor(globalKeys) }
        if let localKeys { NSEvent.removeMonitor(localKeys) }
        if let observation { NSWorkspace.shared.notificationCenter.removeObserver(observation) }
        if let screenObservation { NotificationCenter.default.removeObserver(screenObservation) }
        if let probeObservation { DistributedNotificationCenter.default().removeObserver(probeObservation) }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    /// Opening Ü again (Spotlight, Finder, Launchpad) while it is already on shows its window instead
    /// of doing nothing visible: Ü lives in the face, the dock and the notch, and has no Dock icon.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !diagnosticMode { show() }
        return true
    }
    /// Only with --probe-hooks: lets NotchProbe (another process) produce the events a conversation
    /// would, and read back what the notch and the dock believe. Never on in a normal launch.
    private func listenToProbe() {
        probeObservation = DistributedNotificationCenter.default().addObserver(forName: NotchProbe.channel, object: nil, queue: .main) { [weak self] note in
            let command = note.object as? String ?? ""
            Task { @MainActor in self?.probe(command) }
        }
    }
    private func probe(_ command: String) {
        let (verb, text) = command.firstIndex(of: ":").map { (String(command[..<$0]), String(command[command.index(after: $0)...])) } ?? (command, "")
        switch verb {
        case "notify": notch.notify(text)
        case "person": notch.speak(text, fromU: false)
        case "closeTurn": notch.closeTurn()
        case "begin": notch.begin(text)
        case "done": notch.end(text, ok: true)
        case "fail": notch.end(text, ok: false)
        case "stopped": notch.stopped(text)
        case "clear": notch.clear()
        case "openChat": model.setNotchExpanded(true)
        case "closeChat": model.setNotchExpanded(false)
        case "expiry": notch.setExpiry(Double(text) ?? NotchPresence.expiry)
        case "dock": dock.toggle()
        case "shot":
            // What the notch and the dock draw, rendered from their own views into this user's
            // temporary folder: a visual check that needs no screen recording.
            guard URL(fileURLWithPath: text).standardizedFileURL.path.hasPrefix(FileManager.default.temporaryDirectory.standardizedFileURL.path) else { return }
            for (name, view) in [("notch", notch.panel.contentView), ("dock", dock.contentView)] {
                guard let view, let rep = view.bitmapImageRepForCachingDisplay(in: view.bounds) else { continue }
                view.cacheDisplay(in: view.bounds, to: rep)
                try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: text + "-" + name + ".png"))
            }
        case "talk": model.toggleLiveFromFace()
        case "busy": model.busy = text == "1"
        case "submit": model.submit(text)
        case "learn": learn.toggle()
        case "learnDry": learn.dryRun = text == "1"
        case "front": NSApp.activate(); window.makeKeyAndOrderFront(nil)
        case "back": window.orderOut(nil)
        case "dump":
            // Only into this user's temporary folder: the hooks must not become a way to write files.
            guard URL(fileURLWithPath: text).standardizedFileURL.path.hasPrefix(FileManager.default.temporaryDirectory.standardizedFileURL.path) else { return }
            let state: [String: Any] = ["pid": Int(getpid()), "notchPhase": notch.phase.rawValue, "notchText": notch.surface.speech.text,
                                        "notchState": notch.surface.speech.state.rawValue, "chatOpen": notch.chatOpen,
                                        "dockUnfolded": dock.unfolded, "dockGuarding": dock.guarding, "faceVisible": face.isVisible,
                                        "dockBar": dock.barOnScreen.dictionaryRepresentation, "draft": model.draft, "notchKey": notch.panel.isKeyWindow,
                                        "messages": model.messages.count, "lastMessage": model.messages.last?.text ?? "", "lastFromUser": model.messages.last?.user ?? false,
                                        "voiceLevel": model.voiceLevel, "busy": model.busy, "microphone": model.microphone, "liveConnected": model.liveConnected, "mode": model.mode.rawValue, "status": model.status,
                                        "learnTeaching": learn.teaching, "learnRecording": learn.recording, "learnClosing": learn.closing,
                                        "learnSteps": learn.steps, "learnStatus": learn.status, "lessonEvents": learn.lessonEvents,
                                        "lessonFile": learn.lastLesson?.path ?? "", "auraPhase": learn.auraPhase.rawValue, "auraOnScreen": learn.auraOnScreen]
            if let data = try? JSONSerialization.data(withJSONObject: state, options: [.sortedKeys]) { try? data.write(to: URL(fileURLWithPath: text), options: .atomic) }
        default: break
        }
    }
    private func moveFace(beside quartzFrame: CGRect) {
        guard !window.isVisible else { return }
        let primaryHeight = CGDisplayBounds(CGMainDisplayID()).height
        let target = CGRect(x: quartzFrame.minX, y: primaryHeight - quartzFrame.maxY, width: quartzFrame.width, height: quartzFrame.height)
        let screen = NSScreen.screens.first { $0.frame.contains(CGPoint(x: target.midX, y: target.midY)) } ?? NSScreen.main
        guard let bounds = screen?.visibleFrame else { return }
        let size = face.frame.size, gap = 10.0
        var x = target.maxX + gap, y = target.midY - size.height / 2
        if x + size.width > bounds.maxX { x = target.minX - size.width - gap }
        if x < bounds.minX { x = target.midX - size.width / 2; y = target.minY - size.height - gap }
        x = max(bounds.minX, min(x, bounds.maxX - size.width))
        y = max(bounds.minY, min(y, bounds.maxY - size.height))
        model.faceEyeShift = target.midX < x + size.width / 2 ? -3.5 : 3.5
        // Never wait for a visual transition before issuing the AX or CGEvent action.
        faceMover.stopFlight()
        face.setFrameOrigin(CGPoint(x: x, y: y))
    }
    func showHighlight(_ quartzFrame: CGRect) {
        highlight?.close()
        let primaryHeight = CGDisplayBounds(CGMainDisplayID()).height
        let frame = CGRect(x: quartzFrame.minX, y: primaryHeight - quartzFrame.maxY, width: quartzFrame.width, height: quartzFrame.height)
        let panel = NSPanel(contentRect: frame.insetBy(dx: -3, dy: -3), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isOpaque = false; panel.backgroundColor = .clear; panel.level = .floating; panel.ignoresMouseEvents = true
        panel.contentView = NSHostingView(rootView: RoundedRectangle(cornerRadius: 5).stroke(Color.purple, lineWidth: 3).padding(2))
        panel.orderFrontRegardless(); highlight = panel
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak panel] in panel?.orderOut(nil) }
    }
}

@main
@MainActor
struct UMacApplication {
    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.accessory)
        withExtendedLifetime(delegate) { app.run() }
    }
}
