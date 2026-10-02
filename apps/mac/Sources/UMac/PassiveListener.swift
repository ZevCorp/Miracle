import Foundation
import OSLog
import UCore

/// Passive listening: Soniox transcribes the room and Jev judges each phrase as it grows.
/// Only the latest phrase is judged; a newer one cancels the pending question.
@MainActor
public final class PassiveListener {
    public struct Cycle: Sendable {
        public let phrase: String
        public let decision: IntentDecision
        public let action: ListenIntent
        /// From the Soniox message carrying the text to Jev's answer: the 300 ms target.
        public let milliseconds: Double
        public let endpoint: Bool
    }
    public var onPhrase: ((String) -> Void)?
    public var onCycle: ((Cycle) -> Void)?
    public var onDecision: ((ListenIntent, String) -> Void)?
    public var onError: ((String) -> Void)?
    public var onLevel: ((Double) -> Void)?
    public private(set) var listening = false
    private var epoch = UUID()
    private var socket: URLSessionWebSocketTask?
    private var session: URLSession?
    private var receiver: Task<Void, Never>?
    private var sender: Task<Void, Never>?
    private var keepAlive: Task<Void, Never>?
    private var judging: Task<Void, Never>?
    private var phrases = PhraseBuffer()
    private let audio = DuplexAudio()
    private var jev: JevClient?
    private let logger = Logger(subsystem: "com.zevcorp.u.mac", category: "Passive")
    public init() {}

    /// `feed` replaces the microphone for tests: PCM 24 kHz mono Int16, paced by the caller.
    public func start(sonioxKey: String, jev: JevClient, feed: AsyncStream<Data>? = nil) async throws {
        stop()
        let id = UUID(); epoch = id
        self.jev = jev
        phrases.reset()
        let session = URLSession(configuration: .ephemeral)
        let socket = session.webSocketTask(with: SonioxProtocol.url)
        self.session = session; self.socket = socket
        socket.resume()
        let start = try JSONSerialization.data(withJSONObject: SonioxProtocol.start(apiKey: sonioxKey))
        try await socket.send(.string(String(decoding: start, as: UTF8.self)))
        guard epoch == id else { throw CancellationError() }
        listening = true
        Task { await jev.warm() }
        receiver = Task { [weak self] in
            do {
                while !Task.isCancelled {
                    let message = try await socket.receive()
                    let arrived = ContinuousClock.now
                    guard let self, self.epoch == id else { return }
                    let data: Data
                    switch message { case .data(let bytes): data = bytes; case .string(let text): data = Data(text.utf8); @unknown default: continue }
                    self.handle(SonioxProtocol.parse(data), arrived: arrived, epoch: id)
                }
            } catch {
                guard let self, self.epoch == id, !Task.isCancelled else { return }
                self.fail("Se interrumpió la escucha pasiva (Soniox): " + error.localizedDescription)
            }
        }
        let frames: AsyncStream<Data>
        if let feed { frames = feed } else {
            var continuation: AsyncStream<Data>.Continuation!
            frames = AsyncStream(bufferingPolicy: .bufferingNewest(32)) { continuation = $0 }
            let sink = continuation!
            try audio.start(onPCM: { sink.yield($0) }, onError: { [weak self] reason in
                Task { @MainActor in if self?.epoch == id { self?.fail(reason) } }
            })
        }
        sender = Task { [weak self] in
            for await data in frames {
                guard let self, self.epoch == id, !Task.isCancelled else { return }
                if let chunk = try? LiveAudioChunk(data) { self.onLevel?(chunk.level) }
                do { try await socket.send(.data(data)) }
                catch { if self.epoch == id { self.fail("No pude enviar el audio a Soniox.") }; return }
            }
            // End of a test feed: an empty frame asks Soniox to finish and close.
            guard let self, self.epoch == id else { return }
            try? await socket.send(.data(Data()))
        }
        // Jev's TLS connection goes cold after a quiet minute; the first phrase must not pay it.
        keepAlive = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(25))
                guard let self, self.epoch == id else { return }
                await self.jev?.warm()
            }
        }
    }
    public func stop() {
        epoch = UUID(); listening = false
        receiver?.cancel(); receiver = nil; sender?.cancel(); sender = nil
        keepAlive?.cancel(); keepAlive = nil; judging?.cancel(); judging = nil
        audio.stop()
        socket?.cancel(with: .normalClosure, reason: nil); socket = nil
        session?.invalidateAndCancel(); session = nil
        onLevel?(0)
    }
    private func handle(_ update: SonioxProtocol.Update, arrived: ContinuousClock.Instant, epoch id: UUID) {
        if let error = update.error { fail(error); return }
        let previous = phrases.previous
        guard let phrase = phrases.receive(update) else {
            if update.finished { logger.info("soniox finished"); listening = false }
            return
        }
        onPhrase?(phrase)
        judging?.cancel()
        let jev = self.jev
        judging = Task { [weak self] in
            guard let jev else { return }
            do {
                let decision = try await jev.intent(phrase: phrase, previous: previous == phrase ? "" : previous)
                let elapsed = arrived.duration(to: .now)
                guard let self, self.epoch == id, !Task.isCancelled else { return }
                let action = JevIntent.action(decision)
                let ms = Double(elapsed.components.seconds) * 1000 + Double(elapsed.components.attoseconds) / 1e15
                self.logger.info("cycle \(Int(ms))ms \(decision.intent.rawValue, privacy: .public) \(decision.confidence) → \(action.rawValue, privacy: .public)")
                self.onCycle?(Cycle(phrase: phrase, decision: decision, action: action, milliseconds: ms, endpoint: update.endpoint))
                // Talking can start mid-phrase: Live opens while the person finishes. Acting waits
                // for the endpoint so "abre Safari y busca vuelos" is not cut at "abre Safari".
                if action == .hablar || (action == .ejecutar && update.endpoint) { self.onDecision?(action, phrase) }
            } catch is CancellationError {
            } catch {
                guard let self, self.epoch == id else { return }
                self.logger.error("jev intent failed: \(error.localizedDescription, privacy: .public)")
            }
        }
    }
    private func fail(_ reason: String) { logger.error("passive failed: \(reason, privacy: .public)"); stop(); onError?(reason) }
}
