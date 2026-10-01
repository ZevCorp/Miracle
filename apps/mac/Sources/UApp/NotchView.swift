import SwiftUI
import UCore
import UMac

/// The notch, drawn as on Windows: black, one sentence, one icon and the messages button. The chat
/// opens inside the same piece and grows down from the same top edge. Only draws: when it is on
/// screen is NotchController's business.
struct NotchView: View {
    @ObservedObject var model: AppModel
    @ObservedObject var surface: NotchSurface
    var body: some View {
        let layout = NotchLayout(expanded: surface.chatOpen, availableWidth: 10_000, availableHeight: 10_000)
        VStack(spacing: 0) {
            piece
                .frame(width: layout.width, height: layout.height)
                .scaleEffect(surface.scale, anchor: .top)
            Spacer(minLength: 0)
        }
        .padding(.top, NotchController.shadowTop)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .environment(\.colorScheme, .dark)
    }

    private var shape: RoundedRectangle { RoundedRectangle(cornerRadius: NotchLayout.cornerRadius, style: .continuous) }

    private var piece: some View {
        ZStack {
            if surface.chatOpen { NotchChat(model: model, surface: surface) }
            else { NotchCompact(model: model, speech: surface.speech) { model.setNotchExpanded(true) } }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // Real black, and a one pixel edge of light instead of a frame (Windows PaletaDelNotch).
        .background(Color.black.opacity(0.96), in: shape)
        .overlay(shape.strokeBorder(Color.white.opacity(0.14), lineWidth: 1))
        .clipShape(shape)
        .background(shape.fill(Color.black).shadow(color: .black.opacity(0.45), radius: 12, x: 0, y: 4))
        .foregroundStyle(Color.white.opacity(0.94))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Ü: tarea, conversación y controles")
    }
}

/// One line, one icon, the messages button (MedidaDelNotch).
private struct NotchCompact: View {
    @ObservedObject var model: AppModel
    let speech: NotchSpeech
    let openChat: () -> Void
    @State private var textOpacity = 1.0
    @State private var textWidth = 0.0
    @State private var changedAt = Date()
    private static let textWindow = NotchLayout.compactWidth - 14 - 14 - 30 - 8 - 4 - 30

    var body: some View {
        HStack(spacing: 0) {
            leading.frame(width: 30, height: 30)
            Spacer().frame(width: 8)
            marquee.frame(width: Self.textWindow, height: 30).clipped()
            Spacer().frame(width: 4)
            Button(action: openChat) {
                BubbleGlyph().stroke(style: StrokeStyle(lineWidth: 1.6, lineCap: .round, lineJoin: .round))
                    .frame(width: 17, height: 17)
                    .frame(width: 30, height: 30)
                    .contentShape(Rectangle())
            }
            .buttonStyle(NotchButtonStyle())
            .accessibilityLabel("Abrir conversación")
        }
        .padding(.horizontal, 14).padding(.vertical, 16)
        .onChange(of: speech.state) {
            // A change of state fades in; a sentence still being spoken does not blink word by word.
            textOpacity = 0.18
            withAnimation(.timingCurve(0.215, 0.61, 0.355, 1, duration: NotchMotion.textFade)) { textOpacity = 1 }
        }
        .onChange(of: speech.text) { changedAt = Date() }
    }

    private var excess: Double { max(0, textWidth - Self.textWindow) }

    /// The left of the notch. While Ü is talking or working it is the pause button: the same place
    /// the eye goes to see what Ü is doing is where the hand stops it. The ring keeps spinning around
    /// the pause mark while a step is in progress. At rest it is only the state icon.
    @ViewBuilder private var leading: some View {
        if model.microphone || model.busy {
            Button { model.stop(reason: "notch") } label: {
                ZStack {
                    Circle().fill(Color.white.opacity(0.14))
                    if speech.state.spins {
                        TimelineView(.animation) { context in
                            Circle().inset(by: 1).trim(from: 0, to: 0.75)
                                .stroke(Color.white.opacity(0.9), style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
                                .rotationEffect(.degrees(-90 + context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 1.1) / 1.1 * 360))
                        }
                    }
                    HStack(spacing: 3.5) {
                        RoundedRectangle(cornerRadius: 1.2).frame(width: 3.2, height: 11)
                        RoundedRectangle(cornerRadius: 1.2).frame(width: 3.2, height: 11)
                    }.foregroundStyle(Color.white)
                }
                .frame(width: 28, height: 28)
                .contentShape(Circle())
            }
            .buttonStyle(NotchButtonStyle())
            .help("Pausar Ü")
            .accessibilityLabel("Pausar Ü")
        } else {
            NotchIcon(state: speech.state).frame(width: 22, height: 22)
        }
    }

    private var marquee: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30, paused: excess <= 1)) { context in
            let offset = NotchMarquee.offset(excess: excess, elapsed: context.date.timeIntervalSince(changedAt))
            Text(speech.text)
                .font(.system(size: 14, weight: .semibold))
                .lineLimit(1)
                .fixedSize()
                .foregroundStyle(Color.white.opacity(speech.state.inkOpacity))
                .opacity(textOpacity)
                .background(GeometryReader { g in Color.clear.preference(key: TextWidthKey.self, value: g.size.width) })
                .offset(x: excess > 1 ? offset : 0)
                .frame(width: Self.textWindow, alignment: excess > 1 ? .leading : .center)
                .accessibilityIdentifier("notch-text")
                .accessibilityLabel(speech.text)
        }
        .onPreferenceChange(TextWidthKey.self) { textWidth = $0 }
    }
}

private struct TextWidthKey: PreferenceKey {
    static let defaultValue = 0.0
    static func reduce(value: inout Double, nextValue: () -> Double) { value = max(value, nextValue()) }
}

/// The chat inside the notch: close, the conversation, and a line to write (Windows CrearChat).
private struct NotchChat: View {
    @ObservedObject var model: AppModel
    @ObservedObject var surface: NotchSurface
    @FocusState private var focused: Bool
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Button { model.setNotchExpanded(false) } label: {
                    Path { p in p.move(to: CGPoint(x: 7, y: 7)); p.addLine(to: CGPoint(x: 17, y: 17)); p.move(to: CGPoint(x: 17, y: 7)); p.addLine(to: CGPoint(x: 7, y: 17)) }
                        .stroke(style: StrokeStyle(lineWidth: 1.7, lineCap: .round))
                        .frame(width: 24, height: 24).frame(width: 28, height: 28).contentShape(Rectangle())
                }
                .buttonStyle(NotchButtonStyle())
                .accessibilityLabel("Cerrar conversación")
            }.frame(height: 28)
            NotchTranscript(entries: model.messages.suffix(40).map { ChatTranscriptEntry(id: $0.id, text: $0.text, user: $0.user) })
                .padding(.vertical, 10)
            HStack(spacing: 0) {
                TextField("", text: $model.draft, prompt: Text(model.mode == .question ? "Tu respuesta…" : "Escríbele a Ü…").foregroundStyle(Color.white.opacity(0.4)))
                    .textFieldStyle(.plain)
                    .font(.system(size: 14))
                    .padding(.horizontal, 12)
                    .frame(height: 38)
                    .background(Color.white.opacity(0.094))
                    .focused($focused)
                    .onSubmit { model.submitDraft() }
                    .accessibilityLabel("Mensaje para Ü")
                Button { model.submitDraft() } label: {
                    Path { p in p.move(to: CGPoint(x: 5, y: 12)); p.addLine(to: CGPoint(x: 19, y: 12)); p.move(to: CGPoint(x: 12, y: 5)); p.addLine(to: CGPoint(x: 19, y: 12)); p.addLine(to: CGPoint(x: 12, y: 19)) }
                        .stroke(style: StrokeStyle(lineWidth: 1.7, lineCap: .round, lineJoin: .round))
                        .frame(width: 22, height: 22).frame(width: 38, height: 38).contentShape(Rectangle())
                }
                .buttonStyle(NotchButtonStyle())
                .accessibilityLabel("Enviar mensaje")
            }.padding(.bottom, 2)
        }
        .padding(.horizontal, 18).padding(.vertical, 14)
        .onChange(of: surface.focusRequest) { focused = true }
        .onAppear { if surface.focusRequest > 0 { focused = true } }
    }
}

private struct NotchTranscript: NSViewRepresentable {
    let entries: [ChatTranscriptEntry]
    func makeNSView(context: Context) -> ChatTranscriptView { ChatTranscriptView(frame: .zero) }
    func updateNSView(_ view: ChatTranscriptView, context: Context) { view.update(entries: entries, monochrome: true) }
}

private struct NotchButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        NotchButtonBody(configuration: configuration)
    }
    private struct NotchButtonBody: View {
        let configuration: ButtonStyle.Configuration
        @State private var hover = false
        var body: some View {
            configuration.label
                .background(RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(hover ? 0.10 : 0)))
                .opacity(configuration.isPressed ? 0.72 : 1)
                .onHover { hover = $0 }
        }
    }
}

/// One icon per state, same box (24), same stroke (1.6), monoline (Windows IconosDelNotch).
struct NotchIcon: View {
    let state: NotchState
    var body: some View {
        let stroke = StrokeStyle(lineWidth: 1.6, lineCap: .round, lineJoin: .round)
        Group {
            if state.spins {
                TimelineView(.animation) { context in
                    Circle().inset(by: 12 - 8.8).trim(from: 0, to: 0.75).stroke(style: stroke)
                        .rotationEffect(.degrees(-90 + context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 1.1) / 1.1 * 360))
                }
            } else {
                IconShape(state: state).stroke(style: stroke)
            }
        }
        .frame(width: 24, height: 24)
        .scaleEffect(22.0 / 24.0)
        .foregroundStyle(Color.white.opacity(state.inkOpacity))
        .accessibilityHidden(true)
    }
}

private struct IconShape: Shape {
    let state: NotchState
    func path(in rect: CGRect) -> Path {
        var p = Path()
        func line(_ a: CGPoint, _ b: CGPoint) { p.move(to: a); p.addLine(to: b) }
        func ring() { p.addEllipse(in: CGRect(x: 12 - 9.4, y: 12 - 9.4, width: 18.8, height: 18.8)) }
        switch state {
        case .done:
            p.move(to: CGPoint(x: 4.5, y: 12.6)); p.addLine(to: CGPoint(x: 9.8, y: 17.6)); p.addLine(to: CGPoint(x: 19.5, y: 6.8))
        case .failed:
            ring(); line(CGPoint(x: 12, y: 7.4), CGPoint(x: 12, y: 13.4)); line(CGPoint(x: 12, y: 16.9), CGPoint(x: 12, y: 17.5))
        case .skipped:
            ring(); line(CGPoint(x: 8, y: 12), CGPoint(x: 16, y: 12))
        case .voice, .working:
            line(CGPoint(x: 5.5, y: 10), CGPoint(x: 5.5, y: 14)); line(CGPoint(x: 10, y: 6.5), CGPoint(x: 10, y: 17.5))
            line(CGPoint(x: 14, y: 8.5), CGPoint(x: 14, y: 15.5)); line(CGPoint(x: 18.5, y: 11), CGPoint(x: 18.5, y: 13))
        }
        return p
    }
}

/// The messages button: a speech bubble with its tail, in a 24 box scaled to fit.
private struct BubbleGlyph: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        // M3,4 A2,2 0 0 1 5,2 H19 A2,2 0 0 1 21,4 V13 A2,2 0 0 1 19,15 H10 L6,19 V15 H5 A2,2 0 0 1 3,13 Z
        func corner(_ x: Double, _ y: Double, from: Double) {
            p.addArc(center: CGPoint(x: x, y: y), radius: 2, startAngle: .degrees(from), endAngle: .degrees(from + 90), clockwise: false)
        }
        p.move(to: CGPoint(x: 3, y: 4)); corner(5, 4, from: 180)
        p.addLine(to: CGPoint(x: 19, y: 2)); corner(19, 4, from: 270)
        p.addLine(to: CGPoint(x: 21, y: 13)); corner(19, 13, from: 0)
        p.addLine(to: CGPoint(x: 10, y: 15)); p.addLine(to: CGPoint(x: 6, y: 19)); p.addLine(to: CGPoint(x: 6, y: 15))
        p.addLine(to: CGPoint(x: 5, y: 15)); corner(5, 13, from: 90)
        p.closeSubpath()
        let bounds = CGRect(x: 3, y: 2, width: 18, height: 17)
        let s = min(rect.width / bounds.width, rect.height / bounds.height)
        return p.applying(CGAffineTransform(translationX: -bounds.minX, y: -bounds.minY).concatenating(CGAffineTransform(scaleX: s, y: s))
            .concatenating(CGAffineTransform(translationX: rect.minX + (rect.width - bounds.width * s) / 2, y: rect.minY + (rect.height - bounds.height * s) / 2)))
    }
}
