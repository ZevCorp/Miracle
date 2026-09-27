import AppKit

public struct ChatTranscriptEntry: Equatable {
    public let id: UUID
    public var text: String
    public let user: Bool
    public init(id: UUID, text: String, user: Bool) { self.id = id; self.text = text; self.user = user }
}

/// One stable text storage: streaming appends never replace the view or its responder.
@MainActor
public final class ChatTranscriptTextView: NSTextView {
    weak var transcript: ChatTranscriptView?
    public override func pageUp(_ sender: Any?) { transcript?.page(-1) }
    public override func pageDown(_ sender: Any?) { transcript?.page(1) }
    public override func scrollToEndOfDocument(_ sender: Any?) { transcript?.followLatest() }
    public override func scrollToBeginningOfDocument(_ sender: Any?) { transcript?.scroll(to: 0) }
    public override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 116: pageUp(nil)
        case 121: pageDown(nil)
        case 115: scrollToBeginningOfDocument(nil)
        case 119: scrollToEndOfDocument(nil)
        default: super.keyDown(with: event)
        }
    }
}

@MainActor
public final class ChatTranscriptView: NSView {
    public let scrollView = NSScrollView()
    public let textView = ChatTranscriptTextView(frame: .zero)
    public let jumpButton = NSButton(title: "Ir al mensaje actual", target: nil, action: nil)
    public private(set) var following = true
    public var unreadMessages: Int { unread.count }
    private var unread = Set<UUID>()
    private var entries: [ChatTranscriptEntry] = []
    private var offsets: [Int] = []
    private var monochrome = false
    private var updating = false
    private var laidOutWidth: CGFloat = 0
    public var isAtBottom: Bool {
        textView.bounds.height - scrollView.contentView.bounds.maxY <= 2
    }

    public override init(frame: NSRect) {
        super.init(frame: frame)
        scrollView.hasVerticalScroller = true
        scrollView.drawsBackground = false
        scrollView.autohidesScrollers = true
        scrollView.documentView = textView
        textView.transcript = self
        textView.isEditable = false
        textView.isSelectable = true
        textView.isRichText = true
        textView.drawsBackground = false
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.textContainerInset = NSSize(width: 20, height: 20)
        textView.textContainer?.lineFragmentPadding = 0
        textView.textContainer?.widthTracksTextView = false
        textView.setAccessibilityLabel("Historial de conversación")
        addSubview(scrollView)
        jumpButton.bezelStyle = .rounded
        jumpButton.controlSize = .small
        jumpButton.target = self
        jumpButton.action = #selector(jump)
        jumpButton.isHidden = true
        addSubview(jumpButton)
        scrollView.contentView.postsBoundsChangedNotifications = true
        NotificationCenter.default.addObserver(self, selector: #selector(scrolled),
            name: NSView.boundsDidChangeNotification, object: scrollView.contentView)
        layout()
    }
    required init?(coder: NSCoder) { nil }

    public override func layout() {
        super.layout()
        let origin = scrollView.contentView.bounds.origin
        updating = true
        scrollView.frame = bounds
        if laidOutWidth != scrollView.contentSize.width {
            laidOutWidth = scrollView.contentSize.width
            measure()
        }
        if following { scrollToBottom() } else { restore(origin) }
        updating = false
        placeButton()
    }

    public func update(entries next: [ChatTranscriptEntry], monochrome: Bool) {
        guard next != entries || self.monochrome != monochrome else { return }
        let oldByID = Dictionary(uniqueKeysWithValues: entries.map { ($0.id, $0.text) })
        if !following {
            for entry in next where oldByID[entry.id] != entry.text { unread.insert(entry.id) }
        }
        let appearanceChanged = self.monochrome != monochrome
        var unchanged = 0
        if !appearanceChanged {
            while unchanged < min(entries.count, next.count), entries[unchanged] == next[unchanged] { unchanged += 1 }
        }
        let offset = unchanged < offsets.count ? offsets[unchanged] : (textView.textStorage?.length ?? 0)
        offsets = Array(offsets.prefix(unchanged))
        entries = next
        self.monochrome = monochrome
        let origin = scrollView.contentView.bounds.origin
        let selection = textView.selectedRanges
        let output = NSMutableAttributedString()
        for entry in next.dropFirst(unchanged) {
            offsets.append(offset + output.length)
            let paragraph = NSMutableParagraphStyle()
            paragraph.paragraphSpacing = 12
            paragraph.lineSpacing = 3
            let color: NSColor = monochrome ? .white : .labelColor
            output.append(NSAttributedString(string: entry.user ? "Tú\n" : "You\n", attributes: [
                .font: NSFont.systemFont(ofSize: 11, weight: .semibold),
                .foregroundColor: monochrome ? NSColor.white.withAlphaComponent(0.65) : NSColor.secondaryLabelColor]))
            output.append(NSAttributedString(string: entry.text + "\n\n", attributes: [
                .font: NSFont.systemFont(ofSize: 13), .foregroundColor: color, .paragraphStyle: paragraph]))
        }
        updating = true
        if let storage = textView.textStorage {
            // Keep the unchanged prefix, including selected text, in the same text storage.
            let oldTail = (storage.string as NSString).substring(from: offset)
            let prefix = appearanceChanged ? 0 : (oldTail as NSString).commonPrefix(with: output.string, options: []).utf16.count
            let changed = NSRange(location: offset + prefix, length: storage.length - offset - prefix)
            storage.replaceCharacters(in: changed, with: output.attributedSubstring(from:
                NSRange(location: prefix, length: output.length - prefix)))
            if selection.allSatisfy({ NSMaxRange($0.rangeValue) <= storage.length }) {
                textView.selectedRanges = selection
            }
        }
        measure()
        if following { scrollToBottom() } else { restore(origin) }
        updating = false
        updateButton()
    }

    private func measure() {
        let width = max(1, scrollView.contentSize.width)
        textView.textContainer?.containerSize = NSSize(width: max(1, width - 40), height: .greatestFiniteMagnitude)
        if let container = textView.textContainer, let manager = textView.layoutManager {
            manager.ensureLayout(for: container)
            let height = max(scrollView.contentSize.height, ceil(manager.usedRect(for: container).height) + 64)
            textView.setFrameSize(NSSize(width: width, height: height))
        }
    }
    private func restore(_ point: NSPoint) {
        scrollView.contentView.scroll(to: point)
        scrollView.reflectScrolledClipView(scrollView.contentView)
    }
    private func scrollToBottom() {
        restore(NSPoint(x: 0, y: max(0, textView.bounds.height - scrollView.contentSize.height)))
    }
    @objc private func scrolled() {
        guard !updating else { return }
        following = isAtBottom
        if following { unread.removeAll() }
        updateButton()
    }
    public func scroll(to y: CGFloat) {
        restore(NSPoint(x: 0, y: max(0, min(y, textView.bounds.height - scrollView.contentSize.height))))
        scrolled()
    }
    public func page(_ direction: CGFloat) {
        scroll(to: scrollView.contentView.bounds.minY + direction * scrollView.contentSize.height * 0.85)
    }
    public func followLatest() {
        following = true
        unread.removeAll()
        updating = true
        scrollToBottom()
        updating = false
        updateButton()
    }
    @objc private func jump() { followLatest() }
    private func updateButton() {
        jumpButton.isHidden = following
        jumpButton.title = unread.isEmpty ? "Ir al mensaje actual" : "Ir al mensaje actual · \(unread.count)"
        jumpButton.setAccessibilityLabel(jumpButton.title)
        placeButton()
    }
    private func placeButton() {
        jumpButton.sizeToFit()
        jumpButton.setFrameOrigin(NSPoint(x: max(8, (bounds.width - jumpButton.frame.width) / 2), y: 8))
    }
}
