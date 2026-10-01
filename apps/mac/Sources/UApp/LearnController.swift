import AppKit
import OSLog
import SwiftUI
import UCore
import UMac

/// APRENDER, as Learn on Windows (FaceWindow.OnToggleTeach + WorkflowTeachSession): one button in the
/// dock starts the demo and ends it. Ü waits until the app to teach is in front (no countdown,
/// promesa 137), records every click and key there with what the person says, sends the steps to
/// Graph's learning session as they happen, and on closing saves the lesson and asks Graph to
/// structure and name the workflow. The aura on the screen edges says it is learning.
@MainActor
final class LearnController: ObservableObject {
    @Published private(set) var teaching = false
    @Published private(set) var recording = false
    @Published private(set) var closing = false
    @Published private(set) var steps = 0
    @Published private(set) var status = ""
    @Published private(set) var lastLesson: URL?

    /// Only for the live probe: the demo is recorded and saved, but nothing is sent to Graph.
    var dryRun = false
    /// Every status line also goes to the notch (Windows SetStatus → Avisar).
    var onStatus: ((String) -> Void)?

    private let model: AppModel
    private let logger = Logger(subsystem: "com.zevcorp.u.mac", category: "Learn")
    private let recorder = StepRecorder()
    private let aura = AuraWindow()
    private var builder = LessonBuilder()
    private var client: LearningClient?
    private var session: String?
    private var appName = ""
    private var started = Date()
    private var waiting: Task<Void, Never>?
    private var sending: Task<Void, Never> = Task {}
    private var openedMicrophone = false
    private var phrase: (text: String, ms: Int)?
    private let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("U Mac")
    var store: LessonStore { LessonStore(root: support.appendingPathComponent("lecciones")) }
    var pending: PendingFinishes { PendingFinishes(url: support.appendingPathComponent("pending-finish.json")) }

    init(model: AppModel) {
        self.model = model
        recorder.onEvent = { [weak self] event in self?.saw(event) }
        // The voice sends the person's turn as it grows; one turn is one phrase, timed at its start.
        model.onHeard = { [weak self] text in
            guard let self, self.recording else { return }
            if let p = self.phrase, text.hasPrefix(p.text) { self.phrase = (text, p.ms); return }
            self.flushPhrase()
            self.phrase = (text, Int(Date().timeIntervalSince(self.started) * 1000))
        }
    }

    var auraPhase: AuraPhase { AuraRule.decide(teaching: teaching, recording: recording) }
    var auraOnScreen: Bool { aura.panel.isVisible }
    var lessonEvents: Int { builder.events.count }

    func toggle() { teaching ? stop() : start() }

    private func say(_ text: String) {
        status = text
        model.status = text
        onStatus?(text)
        logger.notice("\(text, privacy: .public)")
    }

    // MARK: start

    func start() {
        guard !teaching, !closing else { return }
        guard !model.busy else { say("Termina o detén la tarea en curso antes de enseñar."); return }
        teaching = true; recording = false; steps = 0
        builder = LessonBuilder(); session = nil; client = nil; phrase = nil
        model.teaching = true
        paintAura()
        waiting = Task { [weak self] in await self?.prepare() }
    }

    private func prepare() async {
        if !dryRun {
            do { client = LearningClient(graph: try await model.makeClient()) }
            catch {
                say("Para enseñar, configura Graph (dirección y credencial) en Configuración.")
                abandon(); return
            }
            // Teaching is talking: what is said is what turns a typed value into a named datum. The
            // microphone opens by itself, and closes at the end only if it was opened here.
            if !model.microphone {
                openedMicrophone = true
                say("Abriendo el micrófono: cuéntame lo que vas haciendo…")
                model.toggleLiveFromFace()
            }
        }
        // Wait for the app to teach, without saying "recording" before it is in front.
        let began = Date()
        var lastMessage = ""
        while teaching, !Task.isCancelled {
            let verdict = DemoStart.judge(front: front(), waited: Date().timeIntervalSince(began))
            if verdict.message != lastMessage { lastMessage = verdict.message; say(verdict.message) }
            if verdict.gaveUp { abandon(); return }
            if verdict.start { break }
            try? await Task.sleep(for: .seconds(DemoStart.poll))
        }
        guard teaching, !Task.isCancelled else { return }
        appName = NSWorkspace.shared.frontmostApplication?.localizedName ?? ""
        if let client {
            do { session = try await client.open(description: "", app: appName, title: appName) }
            catch {
                say("No se pudo iniciar la enseñanza: \(error.localizedDescription)")
                abandon(); return
            }
        }
        guard teaching else { return }
        started = Date()
        recorder.start(at: started)
        recording = true
        paintAura()
        if model.liveConnected { Task { try? await model.liveVoice.notify(ApprenticeMode.enter) } }
        say("Grabando pasos sobre «\(appName)»…")
    }

    private func front() -> DemoStart.Front {
        guard let app = NSWorkspace.shared.frontmostApplication else { return .desktop }
        if app.processIdentifier == getpid() { return .u }
        if ["com.apple.dock", "com.apple.loginwindow", "com.apple.WindowManager"].contains(app.bundleIdentifier ?? "") { return .desktop }
        return .app(app.localizedName ?? "la aplicación")
    }

    /// Nothing was recorded: everything back as it was, and nothing published (promesa 104).
    private func abandon() {
        waiting?.cancel(); waiting = nil
        recorder.stop()
        teaching = false; recording = false
        model.teaching = false
        closeMicrophoneIfOpenedHere()
        paintAura()
    }

    // MARK: recording

    private func saw(_ event: StepRecorder.Event) {
        guard recording else { return }
        switch event {
        case .click(let ms, let x, let y, let t): builder.click(ms: ms, x: x, y: y, app: t.app, selector: t.selector, label: t.label, role: t.role)
        case .typed(let ms, let text, let t): builder.typed(ms: ms, text: text, app: t.app, selector: t.selector, label: t.label, role: t.role, secure: t.secure)
        case .key(let ms, let name, let t): builder.key(ms: ms, name: name, app: t.app, selector: t.selector, label: t.label, role: t.role)
        }
        send(builder.release(closing: false))
    }

    /// Steps go out one at a time and in order, as they happen.
    private func send(_ ready: [LearningStep]) {
        guard !ready.isEmpty else { return }
        let previous = sending, client = client, session = session
        sending = Task { [weak self] in
            await previous.value
            for step in ready {
                if let client, let session {
                    do { try await client.step(step, session: session) }
                    catch { self?.logger.error("paso no enviado: \(error.localizedDescription, privacy: .public)"); continue }
                }
                self?.counted()
            }
        }
    }

    private func flushPhrase() {
        if let p = phrase { builder.heard(p.text, ms: p.ms) }
        phrase = nil
    }

    private func counted() {
        steps += 1
        aura.steps = steps
        if recording { say("Grabando pasos… \(steps) \(dryRun ? "grabados" : "enviados")" + (steps >= 30 ? " · ⚠ larga: mejor pártela en dos" : "")) }
    }

    // MARK: stop

    func stop() {
        guard teaching else { return }
        guard recording else { say("Cancelado: todavía no había empezado a grabar."); abandon(); return }
        // The aura goes off at once: closing uploads, it learns nothing of what happens now.
        teaching = false
        model.teaching = false
        recorder.stop()
        recording = false
        closing = true
        paintAura()
        if model.liveConnected { Task { try? await model.liveVoice.notify(ApprenticeMode.leave) } }
        closeMicrophoneIfOpenedHere()
        say("Cerrando la enseñanza y estructurando el workflow…")
        let ended = Date()
        flushPhrase()
        send(builder.release(closing: true))
        Task { [weak self] in await self?.close(ended: ended) }
    }

    private func close(ended: Date) async {
        defer { closing = false }
        await sending.value
        guard var lesson = builder.lesson(id: UUID().uuidString, started: started, ended: ended, app: appName) else {
            say("No vi ningún paso: no hay nada que aprender.")
            return
        }
        do {
            lastLesson = try store.save(lesson)
            say("Lección guardada: \(lesson.events.count) \(lesson.events.count == 1 ? "evento" : "eventos").")
        } catch { say("No pude guardar la lección: \(error.localizedDescription)") }
        guard let client, let session else {
            if dryRun { say("Aprendido (prueba local): \(lesson.events.count) pasos, sin enviar a Graph.") }
            return
        }
        do {
            let transcript = builder.transcript
            if !transcript.isEmpty { try await client.context(transcript, session: session) }
            say("Cerrando la grabación y pidiéndole a Graph que la estructure…")
            let done = try await client.finish(session: session)
            lesson.workflowId = done.workflowId; lesson.name = done.name; lesson.summary = done.summary
            lastLesson = try? store.save(lesson)
            // What was learnt is said, by name or by Graph's own summary of the demo.
            let summary = done.summary.trimmingCharacters(in: .whitespacesAndNewlines)
            if !summary.isEmpty { model.append("Aprendí esto: " + summary) }
            say(done.name.map { "Aprendido: «\($0)»." } ?? (summary.isEmpty ? "Aprendido." : "Aprendido: " + String(summary.prefix(90)) + (summary.count > 90 ? "…" : "")))
        } catch LearningClient.Failure.finishPending(let id) {
            try? pending.add(id)
            say("Los pasos SÍ se guardaron; falta el resumen (Graph tardó de más). Se completa solo al reabrir la app.")
        } catch {
            say("Error en enseñanza: \(error.localizedDescription)")
        }
    }

    private func closeMicrophoneIfOpenedHere() {
        guard openedMicrophone else { return }
        openedMicrophone = false
        if model.microphone { model.toggleMicrophone() }
    }

    /// Finishes Graph did not complete last time, asked again on launch.
    func finishPending() {
        let entries = pending.load()
        guard !entries.isEmpty else { return }
        Task { [weak self] in
            guard let self, let graph = try? await self.model.makeClient() else { return }
            let client = LearningClient(graph: graph)
            for entry in entries {
                guard let done = try? await client.finish(session: entry.session) else { continue }
                try? self.pending.remove(entry.session)
                self.say(done.name.map { "Terminé de aprender «\($0)»." } ?? "Terminé de aprender la última tarea.")
            }
        }
    }

    private func paintAura() { aura.show(auraPhase, steps: steps) }
}

// MARK: - the aura

/// The edges of the screen glow blue while Ü learns (Windows AuraDeAprendizaje): a 96 point band,
/// never in the middle, clicks go through it, and it is left out of screen captures.
@MainActor
final class AuraWindow {
    final class State: ObservableObject {
        @Published var phase: AuraPhase = .off
        @Published var steps = 0
        @Published var since = Date()
    }
    let panel: NSPanel
    private let state = State()
    var steps: Int { get { state.steps } set { state.steps = newValue } }

    init() {
        panel = NSPanel(contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: true)
        panel.isOpaque = false; panel.backgroundColor = .clear; panel.hasShadow = false
        panel.ignoresMouseEvents = true
        panel.sharingType = .none
        // Above the apps being taught, below Ü's own floating pieces (the face, the notch, the dock).
        panel.level = NSWindow.Level(rawValue: NSWindow.Level.floating.rawValue - 1)
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]
        panel.isReleasedWhenClosed = false
        panel.animationBehavior = .none
        let host = NSHostingView(rootView: AuraView(state: state))
        host.sizingOptions = []
        panel.contentView = host
    }

    func show(_ phase: AuraPhase, steps: Int) {
        if phase != state.phase { state.since = Date() }
        state.phase = phase
        state.steps = steps
        guard phase != .off, let screen = NSScreen.screens.first else { panel.orderOut(nil); return }
        panel.setFrame(screen.frame, display: true)
        panel.orderFrontRegardless()
    }
}

private struct AuraView: View {
    @ObservedObject var state: AuraWindow.State
    private static let edge = Color(red: 0x4C / 255, green: 0x8D / 255, blue: 0xFF / 255)
    private static let inner = Color(red: 0x3B / 255, green: 0x82 / 255, blue: 0xF6 / 255)

    var body: some View {
        GeometryReader { g in
            TimelineView(.animation(minimumInterval: 1.0 / 30, paused: state.phase != .learning)) { context in
                let layer = AuraRule.layer(state.phase, elapsed: context.date.timeIntervalSince(state.since))
                ZStack {
                    band(.top, g.size).frame(height: AuraRule.band).frame(maxHeight: .infinity, alignment: .top)
                    band(.bottom, g.size).frame(height: AuraRule.band).frame(maxHeight: .infinity, alignment: .bottom)
                    band(.leading, g.size).frame(width: AuraRule.band).frame(maxWidth: .infinity, alignment: .leading)
                    band(.trailing, g.size).frame(width: AuraRule.band).frame(maxWidth: .infinity, alignment: .trailing)
                }
                .opacity(layer)
            }
            pill.position(x: g.size.width / 2, y: menuBar + NotchLayout.gap + NotchLayout.compactHeight + 26)
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }

    /// Under the menu bar and the notch, so the two never overlap.
    private var menuBar: Double {
        guard let s = NSScreen.screens.first else { return 25 }
        return s.frame.maxY - s.visibleFrame.maxY
    }

    /// 13 stops from the edge inward, each at the rule's opacity for that distance.
    private func band(_ edge: Edge, _ size: CGSize) -> some View {
        let stops = (0...12).map { i -> Gradient.Stop in
            let t = Double(i) / 12
            let color = i < 6 ? Self.edge : Self.inner
            return Gradient.Stop(color: color.opacity(AuraRule.opacity(atDistance: t * AuraRule.band)), location: t)
        }
        let (from, to): (UnitPoint, UnitPoint) = switch edge {
        case .top: (.top, .bottom)
        case .bottom: (.bottom, .top)
        case .leading: (.leading, .trailing)
        case .trailing: (.trailing, .leading)
        }
        return LinearGradient(gradient: Gradient(stops: stops), startPoint: from, endPoint: to)
    }

    @ViewBuilder private var pill: some View {
        let text = AuraRule.pill(state.phase, steps: state.steps)
        if !text.isEmpty {
            HStack(spacing: 8) {
                Circle().fill(Self.edge).frame(width: 8, height: 8)
                Text(text).font(.system(size: 13, weight: .semibold)).foregroundStyle(.white)
            }
            .padding(.leading, 12).padding(.trailing, 14).padding(.vertical, 6)
            .background(RoundedRectangle(cornerRadius: 14).fill(Color(red: 0x0F / 255, green: 0x15 / 255, blue: 0x24 / 255).opacity(0.82)))
            .fixedSize()
        }
    }
}
