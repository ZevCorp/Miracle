import AVFoundation
import OSLog
import UCore

public enum AudioStartup {
    /// Voice processing improves echo cancellation, but some valid Mac audio routes reject it.
    /// The microphone and speaker must remain usable on those routes.
    public static func enableVoiceProcessing(_ operation: () throws -> Void) -> Bool {
        do { try operation(); return true }
        catch { return false }
    }

    public static func shouldRetryWithoutVoiceProcessing(wasEnabled: Bool) -> Bool {
        wasEnabled
    }

    static func failure(_ stage: String, _ error: Error) -> AgentError {
        let nsError = error as NSError
        return .unavailable("Audio del Mac · \(stage): \(nsError.domain) \(nsError.code) · \(nsError.localizedDescription)")
    }
}

/// A single engine provides input and output so macOS voice processing has the speaker reference.
@MainActor
public final class DuplexAudio {
    private var engine: AVAudioEngine?
    private var player: AVAudioPlayerNode?
    private let playbackFormat = AVAudioFormat(standardFormatWithSampleRate: 24_000, channels: 1)!
    private var epoch = UUID()
    private var pendingFrames: Int = 0
    private var pendingAudibleFrames: Int = 0
    private var tapInstalled = false
    private var configurationObserver: NSObjectProtocol?
    private var watchdog: Task<Void, Never>?
    private var session: UUID?
    private var voiceProcessingWorks = true
    private var restarts: [Date] = []
    private let logger = Logger(subsystem: "com.zevcorp.u.mac", category: "Audio")
    public private(set) var voiceProcessingEnabled = false
    public private(set) var restartCount = 0
    public var onLevel: ((Double) -> Void)?
    public var onSpeaking: ((Bool) -> Void)?
    public init() {}
    public func start(onPCM: @escaping @Sendable (Data) -> Void, onError: @escaping @Sendable (String) -> Void) throws {
        stop()
        restarts = []; restartCount = 0; voiceProcessingWorks = true
        try startWithFallback(onPCM: onPCM, onError: onError)
        let id = UUID(); session = id
        watchdog = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(500))
                guard let self, self.session == id else { return }
                if self.engine?.isRunning != true { self.recover(reason: "engine not running", onPCM: onPCM, onError: onError) }
            }
        }
    }

    /// Voice processing is only tried until it fails once in a session: on routes that reject it,
    /// every failed attempt tears down an aggregate device and reconfigures the microphone again.
    private func startWithFallback(onPCM: @escaping @Sendable (Data) -> Void, onError: @escaping @Sendable (String) -> Void) throws {
        do {
            try startEngine(enableVoiceProcessing: voiceProcessingWorks, onPCM: onPCM, onError: onError)
        } catch {
            let shouldRetry = AudioStartup.shouldRetryWithoutVoiceProcessing(wasEnabled: voiceProcessingEnabled)
            teardown()
            guard shouldRetry else { throw error }
            voiceProcessingWorks = false
            logger.info("voice processing rejected by this route; continuing without it")
            do { try startEngine(enableVoiceProcessing: false, onPCM: onPCM, onError: onError) }
            catch { teardown(); throw error }
        }
        observeConfiguration(onPCM: onPCM, onError: onError)
    }

    /// macOS stops an AVAudioEngine by itself when the device configuration changes (another engine
    /// releasing the microphone, a failed voice-processing unit tearing down its aggregate device, a
    /// route change). Without restarting it the conversation stays open but deaf: measured
    /// 2026-09-30, the engine died 0.2-0.8 s after starting in every attempt. The notification is
    /// the fast path; the watchdog in start() covers a stop that arrives without one.
    private func observeConfiguration(onPCM: @escaping @Sendable (Data) -> Void, onError: @escaping @Sendable (String) -> Void) {
        guard let engine else { return }
        let id = epoch
        configurationObserver = NotificationCenter.default.addObserver(forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self, self.epoch == id else { return }
                self.recover(reason: "configuration changed", onPCM: onPCM, onError: onError)
            }
        }
    }

    private func recover(reason: String, onPCM: @escaping @Sendable (Data) -> Void, onError: @escaping @Sendable (String) -> Void) {
        guard session != nil || engine != nil else { return }
        let now = Date()
        restarts = restarts.filter { now.timeIntervalSince($0) < 10 } + [now]
        guard restarts.count <= 8 else {
            logger.error("audio keeps stopping; giving up after \(self.restarts.count) restarts in 10 s")
            stop()
            onError("El micrófono del Mac se detiene sin parar. Revisa el dispositivo de entrada seleccionado.")
            return
        }
        restartCount += 1
        logger.info("audio \(reason, privacy: .public); restarting the engine (restart \(self.restartCount))")
        teardown()
        do { try startWithFallback(onPCM: onPCM, onError: onError) }
        catch {
            // The watchdog tries again in half a second; the device may still be settling.
            logger.error("audio restart failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    private func startEngine(enableVoiceProcessing: Bool,
                             onPCM: @escaping @Sendable (Data) -> Void,
                             onError: @escaping @Sendable (String) -> Void) throws {
        let engine = AVAudioEngine(), player = AVAudioPlayerNode()
        self.engine = engine; self.player = player
        do {
            let input = engine.inputNode
            voiceProcessingEnabled = enableVoiceProcessing && AudioStartup.enableVoiceProcessing {
                try input.setVoiceProcessingEnabled(true)
            }
            let hardware = input.outputFormat(forBus: 0)
            guard hardware.sampleRate > 0, hardware.channelCount > 0 else {
                throw AgentError.unavailable("Audio del Mac · formato de entrada inválido. Revisa el dispositivo de entrada seleccionado.")
            }
            let encoder = try PCMEncoder(source: hardware)
            engine.attach(player)
            engine.connect(player, to: engine.mainMixerNode, format: playbackFormat)
            // AVAudioEngine owns the main-mixer-to-output connection. Reconnecting it with the
            // hardware input format can make engine.start fail when the input and output devices
            // use different sample rates.
            input.installTap(onBus: 0, bufferSize: 1024, format: nil) { buffer, _ in
                do {
                    let data = try encoder.encode(buffer)
                    if !data.isEmpty { onPCM(data) }
                } catch { onError(error.localizedDescription) }
            }
            tapInstalled = true
            engine.prepare()
            do { try engine.start() }
            catch { throw AudioStartup.failure("inicio del motor", error) }
            player.play()
        } catch {
            if let error = error as? AgentError { throw error }
            throw AudioStartup.failure("preparación", error)
        }
    }
    public func play(_ data: Data) throws {
        let chunk = try LiveAudioChunk(data)
        guard let player, engine?.isRunning == true else { return }
        onLevel?(chunk.level)
        let frames = chunk.frames
        guard frames > 0, pendingFrames + frames <= 24_000 * 30 else { throw AgentError.unavailable("La cola de voz se llenó; la conversación se detuvo.") }
        guard let buffer = AVAudioPCMBuffer(pcmFormat: playbackFormat, frameCapacity: AVAudioFrameCount(frames)), let samples = buffer.floatChannelData?[0] else { return }
        buffer.frameLength = AVAudioFrameCount(frames)
        data.withUnsafeBytes { raw in
            for index in 0..<frames {
                let lo = UInt16(raw[index * 2]), hi = UInt16(raw[index * 2 + 1]) << 8
                samples[index] = Float(Int16(bitPattern: lo | hi)) / 32768
            }
        }
        let id = epoch
        if chunk.audible {
            if pendingAudibleFrames == 0 { onSpeaking?(true) }
            pendingAudibleFrames += frames
        }
        pendingFrames += frames
        player.scheduleBuffer(buffer, completionCallbackType: .dataPlayedBack) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.epoch == id else { return }
                self.pendingFrames = max(0, self.pendingFrames - frames)
                if chunk.audible {
                    self.pendingAudibleFrames = max(0, self.pendingAudibleFrames - frames)
                    if self.pendingAudibleFrames == 0 { self.onSpeaking?(false); self.onLevel?(0) }
                }
            }
        }
    }
    public func stop() {
        session = nil; watchdog?.cancel(); watchdog = nil
        teardown()
    }
    private func teardown() {
        if let configurationObserver { NotificationCenter.default.removeObserver(configurationObserver) }
        configurationObserver = nil
        epoch = UUID(); pendingFrames = 0; pendingAudibleFrames = 0
        player?.stop()
        if let engine {
            engine.stop()
            if tapInstalled { engine.inputNode.removeTap(onBus: 0); tapInstalled = false }
            try? engine.inputNode.setVoiceProcessingEnabled(false)
            engine.reset()
        }
        engine = nil; player = nil; onSpeaking?(false); onLevel?(0)
        voiceProcessingEnabled = false
    }
}
