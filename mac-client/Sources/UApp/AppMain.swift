import AppKit
import SwiftUI
import UCore
import UMac

final class FloatingPanel: NSPanel {
    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}

final class NotchPanel: NSPanel {
    var acceptsKeyboard = false
    override var canBecomeKey: Bool { acceptsKeyboard }
    override var canBecomeMain: Bool { false }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    lazy var model = AppModel()
    var diagnosticMode = false
    private var terminationSignal: DispatchSourceSignal?
    var face: NSPanel!
    var window: NSWindow!
    var statusItem: NSStatusItem!
    var globalKeys: Any?
    var localKeys: Any?
    var observation: NSObjectProtocol?
    var highlight: NSPanel?
    var notch: NSPanel!
    var screenObservation: NSObjectProtocol?
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Diagnostics run in a separate process and must never close the user's UI.
        let diagnosticFlags = ["--wake-mic-test", "--chat-scroll-test", "--wake-test", "--spoken-voice-test", "--configure-voice-key", "--voice-test", "--audio-test", "--execution-test", "--smoke-test", "--diagnose"]
        diagnosticMode = CommandLine.arguments.contains(where: diagnosticFlags.contains)
        if !diagnosticMode { terminateOlderCopies() }
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
        face.level = .floating; face.hidesOnDeactivate = false; face.isMovableByWindowBackground = true
        face.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        face.contentView = NSHostingView(rootView: Face(model: model))
        if let frame = NSScreen.main?.visibleFrame { face.setFrameOrigin(NSPoint(x: frame.maxX - VoiceHalo.panelSize - 20, y: frame.minY + 95)) }
        face.orderFrontRegardless()
        notch = NotchPanel(contentRect: NSRect(x: 0, y: 0, width: 420, height: 66), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        notch.isOpaque = false; notch.backgroundColor = .clear; notch.hasShadow = false
        notch.level = .floating; notch.hidesOnDeactivate = false
        notch.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        notch.contentView = NSHostingView(rootView: NotchView(model: model))
        model.onNotchExpansion = { [weak self] expanded in
            guard let self else { return }
            (self.notch as? NotchPanel)?.acceptsKeyboard = expanded
            self.positionNotch()
            if expanded { self.notch.makeKeyAndOrderFront(nil) }
            else { self.notch.resignKey() }
        }
        positionNotch(); notch.orderFrontRegardless()
        screenObservation = NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.positionNotch() }
        }
        model.showWindow = { [weak self] in self?.show() }
        model.hideWindow = { [weak self] in self?.window.orderOut(nil); self?.notch.resignKey() }
        model.desktop.onHighlight = { [weak self] frame in self?.showHighlight(frame); self?.moveFace(beside: frame) }
        model.desktop.onAction = { [weak self] frame in self?.moveFace(beside: frame) }
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.title = "Ü"
        let menu = NSMenu()
        for (title, action, key) in [("Abrir Ü", #selector(show), ""), ("Abrir chat del notch", #selector(showChat), ""), ("Hablar / silenciar", #selector(toggleVoice), ""), ("Detener tarea", #selector(stop), ""), ("Configuración…", #selector(settings), ","), ("Salir de Ü", #selector(quit), "q")] {
            let item = NSMenuItem(title: title, action: action, keyEquivalent: key); item.target = self; menu.addItem(item)
        }
        statusItem.menu = menu
        globalKeys = NSEvent.addGlobalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if event.cgEvent?.getIntegerValueField(.eventSourceUserData) == InputDriver.syntheticEventTag { return }
            if event.keyCode == 53 { Task { @MainActor in self?.model.stop() } }
            if event.keyCode == 49 && event.modifierFlags.contains(.option) { Task { @MainActor in self?.show() } }
        }
        localKeys = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if event.cgEvent?.getIntegerValueField(.eventSourceUserData) == InputDriver.syntheticEventTag { return event }
            if event.keyCode == 53 { Task { @MainActor in self?.model.stop() } }
            return event
        }
        observation = NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main) { [weak self] note in
            guard let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication, app.processIdentifier != getpid() else { return }
            Task { @MainActor in self?.model.lastExternalApp = app }
        }
        if let app = NSWorkspace.shared.frontmostApplication, app.processIdentifier != getpid() { model.lastExternalApp = app }
        if !model.permissions.snapshot.canControlComputer { model.selectedTab = 1; show() }
        model.startWakeListening()
    }
    private func terminateOlderCopies() {
        for app in NSWorkspace.shared.runningApplications {
            guard app.processIdentifier != getpid(),
                  app.executableURL?.lastPathComponent == "U",
                  [PermissionCenter.bundleIdentifier, "com.zevcorp.u", "com.zevcorp.u.mac.native"].contains(app.bundleIdentifier)
            else { continue }
            // There must be one process even when `open -n` was used by an old launcher.
            // Prefer a graceful close, then force the stale copy if it ignores the request.
            app.terminate()
            if !app.isTerminated { app.forceTerminate() }
        }
    }
    @objc func show() {
        if let app = NSWorkspace.shared.frontmostApplication, app.processIdentifier != getpid() { model.lastExternalApp = app }
        NSApp.activate(ignoringOtherApps: true); window.makeKeyAndOrderFront(nil); model.refreshPermissions()
    }
    @objc func showChat() { model.setNotchExpanded(true) }
    @objc func settings() { model.selectedTab = 1; show() }
    @objc func toggleVoice() { model.toggleMicrophone() }
    @objc func stop() { model.stop() }
    @objc func quit() { NSApp.terminate(nil) }
    func applicationWillTerminate(_ notification: Notification) {
        guard !diagnosticMode else { return }
        model.flushHistory()
        model.stop()
        if let globalKeys { NSEvent.removeMonitor(globalKeys) }
        if let localKeys { NSEvent.removeMonitor(localKeys) }
        if let observation { NSWorkspace.shared.notificationCenter.removeObserver(observation) }
        if let screenObservation { NotificationCenter.default.removeObserver(screenObservation) }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    private func positionNotch() {
        guard let bounds = NSScreen.main?.visibleFrame else { return }
        let layout = NotchLayout(expanded: model.notchExpanded, availableWidth: bounds.width, availableHeight: bounds.height)
        let width = layout.width, height = layout.height
        notch.setFrame(NSRect(x: bounds.midX - width / 2, y: max(bounds.minY, bounds.maxY - height - 8), width: width, height: height), display: true)
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
