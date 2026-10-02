import AppKit
import ApplicationServices
import UCore

/// What the hands do in other apps while Ü is being taught: every click and every key, resolved to the
/// accessible element it touched. Ü's own windows never count — global monitors do not see them.
/// Needs Accessibility, like the rest of the app. The AX reads run on one serial queue, so the events
/// arrive in the order they happened.
@MainActor
public final class StepRecorder {
    public struct Touched: Sendable {
        public let app: String
        public let selector: String
        public let label: String
        public let role: String
        public let secure: Bool
    }
    public enum Event: Sendable {
        case click(ms: Int, x: Double, y: Double, Touched)
        case typed(ms: Int, text: String, Touched)
        case key(ms: Int, name: String, Touched)
    }

    public var onEvent: ((Event) -> Void)?
    private var monitors: [Any] = []
    private let queue = DispatchQueue(label: "com.zevcorp.u.mac.teach", qos: .userInitiated)
    private var began = Date()
    public init() {}

    public var recording: Bool { !monitors.isEmpty }

    public func start(at date: Date) {
        stop()
        began = date
        if let m = NSEvent.addGlobalMonitorForEvents(matching: .leftMouseDown, handler: { [weak self] event in
            let p = NSEvent.mouseLocation
            let top = NSScreen.screens.first?.frame.maxY ?? 0
            MainActor.assumeIsolated { self?.click(at: CGPoint(x: p.x, y: top - p.y)) }
        }) { monitors.append(m) }
        if let m = NSEvent.addGlobalMonitorForEvents(matching: .keyDown, handler: { [weak self] event in
            let code = event.keyCode, chars = event.characters ?? "", flags = event.modifierFlags
            MainActor.assumeIsolated { self?.key(code: code, characters: chars, flags: flags) }
        }) { monitors.append(m) }
    }

    public func stop() {
        monitors.forEach(NSEvent.removeMonitor)
        monitors.removeAll()
    }

    private var now: Int { Int(Date().timeIntervalSince(began) * 1000) }

    private func click(at point: CGPoint) {
        let ms = now
        let front = NSWorkspace.shared.frontmostApplication
        queue.async { [weak self] in
            let touched = Self.element(at: point, front: front)
            DispatchQueue.main.async { self?.onEvent?(.click(ms: ms, x: point.x, y: point.y, touched)) }
        }
    }

    private func key(code: UInt16, characters: String, flags: NSEvent.ModifierFlags) {
        let ms = now
        let front = NSWorkspace.shared.frontmostApplication
        let command = flags.contains(.command) || flags.contains(.control)
        queue.async { [weak self] in
            let touched = Self.focused(front: front)
            let event: Event?
            if command, let c = characters.first { event = .key(ms: ms, name: (flags.contains(.command) ? "Cmd+" : "Ctrl+") + String(c).uppercased(), touched) }
            else if let name = NamedKey.name(keyCode: code) { event = .key(ms: ms, name: name, touched) }
            else if !characters.isEmpty, characters.unicodeScalars.allSatisfy({ !CharacterSet.controlCharacters.contains($0) }) { event = .typed(ms: ms, text: characters, touched) }
            else { event = nil }
            guard let event else { return }
            DispatchQueue.main.async { self?.onEvent?(event) }
        }
    }

    // MARK: accessibility (serial queue)

    nonisolated private static func element(at point: CGPoint, front: NSRunningApplication?) -> Touched {
        let system = AXUIElementCreateSystemWide()
        AXUIElementSetMessagingTimeout(system, 0.3)
        var hit: AXUIElement?
        guard AXUIElementCopyElementAtPosition(system, Float(point.x), Float(point.y), &hit) == .success, var element = hit else {
            return Touched(app: front?.localizedName ?? "", selector: "", label: "", role: "", secure: false)
        }
        // The hit is often the text inside a button: climb to what can be pressed or edited.
        for _ in 0..<4 {
            if meaningful(element) { break }
            guard let parent = child(element, kAXParentAttribute) else { break }
            element = parent
        }
        return describe(element, fallbackApp: front)
    }

    nonisolated private static func focused(front: NSRunningApplication?) -> Touched {
        let system = AXUIElementCreateSystemWide()
        AXUIElementSetMessagingTimeout(system, 0.3)
        guard let element = child(system, kAXFocusedUIElementAttribute) else {
            return Touched(app: front?.localizedName ?? "", selector: "", label: "", role: "", secure: false)
        }
        return describe(element, fallbackApp: front)
    }

    nonisolated private static func meaningful(_ e: AXUIElement) -> Bool {
        let role = string(e, kAXRoleAttribute)
        if ["AXButton", "AXLink", "AXTextField", "AXTextArea", "AXCheckBox", "AXRadioButton", "AXPopUpButton", "AXMenuItem",
            "AXMenuBarItem", "AXComboBox", "AXCell", "AXRow", "AXTab", "AXSearchField", "AXSecureTextField"].contains(role) { return true }
        var names: CFArray?
        AXUIElementCopyActionNames(e, &names)
        return (names as? [String])?.contains(kAXPressAction) == true
    }

    nonisolated private static func describe(_ e: AXUIElement, fallbackApp: NSRunningApplication?) -> Touched {
        var pid: pid_t = 0
        AXUIElementGetPid(e, &pid)
        let app = NSRunningApplication(processIdentifier: pid) ?? fallbackApp
        let role = string(e, kAXRoleAttribute), subrole = string(e, kAXSubroleAttribute)
        let secure = role == "AXSecureTextField" || subrole == "AXSecureTextField"
        let identifier = string(e, kAXIdentifierAttribute)
        let named = [kAXTitleAttribute, kAXDescriptionAttribute, kAXHelpAttribute, kAXPlaceholderValueAttribute, kAXIdentifierAttribute]
            .lazy.map { string(e, $0) }.first { !$0.isEmpty }
        let label = named ?? (secure ? "Campo protegido" : String(string(e, kAXValueAttribute).prefix(120)))
        // The same identity the reader gives controls, so a taught step and an observed control match.
        let parts = [app?.bundleIdentifier ?? "", role, identifier.isEmpty ? "label:" + label : "id:" + identifier]
        let selector = (try? JSONSerialization.data(withJSONObject: parts)).map { String(decoding: $0, as: UTF8.self) } ?? ""
        return Touched(app: app?.localizedName ?? "", selector: selector, label: label, role: role, secure: secure)
    }

    nonisolated private static func string(_ e: AXUIElement, _ key: String) -> String {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(e, key as CFString, &value) == .success else { return "" }
        return value as? String ?? ""
    }
    nonisolated private static func child(_ e: AXUIElement, _ key: String) -> AXUIElement? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(e, key as CFString, &value) == .success, let value,
              CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
        return (value as! AXUIElement)
    }
}
