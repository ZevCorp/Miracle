import AppKit
import UMac
import SwiftUI

/// Exercises the shipping AppKit view without microphone, network, or user chat data.
@MainActor
enum ChatScrollProbe {
    static func run(output: URL) async {
        var failures: [String] = []
        var checks = 0
        func check(_ condition: Bool, _ name: String) {
            checks += 1
            if !condition { failures.append(name) }
        }
        let view = ChatTranscriptView(frame: NSRect(x: 0, y: 0, width: 500, height: 320))
        let window = NSWindow(contentRect: view.frame, styleMask: [.titled], backing: .buffered, defer: false)
        window.contentView = view
        window.layoutIfNeeded()
        var entries = (0..<200).map { ChatTranscriptEntry(id: UUID(), text: "Mensaje \($0) " + String(repeating: "contenido largo ", count: 12), user: $0 % 2 == 0) }
        view.update(entries: entries, monochrome: false)
        check(view.following && view.isAtBottom, "initial history follows bottom")
        entries[199].text += " primer token"
        view.update(entries: entries, monochrome: false)
        check(view.isAtBottom, "streaming follows bottom")
        window.makeFirstResponder(view.textView)
        check(window.firstResponder === view.textView, "text view owns focus before test")
        let key = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [], timestamp: 0,
            windowNumber: window.windowNumber, context: nil, characters: "", charactersIgnoringModifiers: "", isARepeat: false, keyCode: 116)!
        view.textView.keyDown(with: key)
        let position = view.scrollView.contentView.bounds.origin
        let selection = NSRange(location: 30, length: 12)
        view.textView.setSelectedRange(selection)
        let focus = window.firstResponder
        check(!view.following, "PageUp enters reading")
        let model = AppModel(persistConversation: false)
        model.microphone = true
        model.mode = .speaking
        let start = Date()
        for _ in 0..<100 {
            entries[199].text += " nuevo"
            view.update(entries: entries, monochrome: false)
        }
        let streamingMilliseconds = Date().timeIntervalSince(start) * 1000
        check(view.scrollView.contentView.bounds.origin == position, "100 streaming updates preserve position")
        check(view.textView.selectedRange() == selection, "streaming preserves selection")
        check(window.firstResponder === focus, "streaming preserves focus")
        check(model.microphone && model.mode == .speaking, "scroll leaves voice state unchanged")
        check(view.unreadMessages == 1, "counter counts changed message once")
        entries.append(ChatTranscriptEntry(id: UUID(), text: "Otro mensaje", user: false))
        view.update(entries: entries, monochrome: false)
        check(view.unreadMessages == 2, "new message increments counter")
        check(!view.jumpButton.isHidden, "reading exposes return button")
        view.jumpButton.performClick(nil)
        check(view.following && view.isAtBottom && view.unreadMessages == 0, "return button resumes")
        view.textView.pageUp(nil)
        view.textView.scrollToEndOfDocument(nil)
        check(view.following && view.isAtBottom, "keyboard End resumes")
        view.textView.pageUp(nil)
        view.scrollView.contentView.scroll(to: NSPoint(x: 0, y: view.textView.bounds.height))
        view.scrollView.reflectScrolledClipView(view.scrollView.contentView)
        check(view.following, "manual return to bottom resumes")
        check(view.textView.string.contains("Mensaje 0") && view.textView.string.contains("Mensaje 199"), "long history retained")
        let selectedEnd = NSRange(location: view.textView.string.utf16.count - 8, length: 5)
        view.textView.setSelectedRange(selectedEnd)
        entries[200].text += " y más texto"
        view.update(entries: entries, monochrome: false)
        check(view.textView.selectedRange() == selectedEnd, "selection in growing message survives")
        check(window.firstResponder === focus, "return and keyboard do not steal focus")
        check(view.textView.string.contains(String(repeating: " nuevo", count: 100)), "all streamed tokens retained")
        let result: [String: Any] = ["passed": failures.isEmpty, "checks": checks, "failures": failures,
                                     "streaming100UpdatesMilliseconds": streamingMilliseconds, "voiceTest": "simulated active state; no microphone or network"]
        if let data = try? JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]) {
            try? data.write(to: output, options: .atomic)
        }
        model.messages = entries.suffix(4).map { ChatMessage(text: $0.text, user: $0.user) }
        let preview = NSHostingView(rootView: ConversationView(model: model).background(Color(nsColor: .windowBackgroundColor)).environment(\.colorScheme, .light))
        preview.frame = NSRect(x: 0, y: 0, width: 510, height: 630)
        window.setContentSize(preview.frame.size)
        window.contentView = preview
        preview.layoutSubtreeIfNeeded()
        try? await Task.sleep(for: .milliseconds(200))
        preview.layoutSubtreeIfNeeded()
        if let bitmap = preview.bitmapImageRepForCachingDisplay(in: preview.bounds) {
            preview.cacheDisplay(in: preview.bounds, to: bitmap)
            try? bitmap.representation(using: .png, properties: [:])?.write(to: output.deletingPathExtension().appendingPathExtension("png"))
        }
        NSApp.terminate(nil)
    }
}
