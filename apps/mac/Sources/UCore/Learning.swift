import Foundation

// APRENDER, as on Windows ("Learn", spec 006 and after): you show Ü a task once in the app where it
// happens, telling it what you do, and Graph turns the steps into a workflow. Pure pieces here; the
// recording and the windows live in UMac and UApp.

/// The aura on the screen edges while Ü is being taught. Windows ReglaDelAura (promesa 107).
public enum AuraPhase: String, Sendable {
    /// Not teaching (also while closing: closing uploads, it learns nothing of what you do now).
    case off
    /// Teaching, but the app to teach is not in front yet: faint and still.
    case preparing
    /// Recording: on, and breathing.
    case learning
}

public enum AuraRule {
    /// How far in from the edge the aura reaches, in points. From here on, nothing: the centre stays clear.
    public static let band = 96.0
    public static let preparingOpacity = 0.35
    /// Breathing between 0.55 and 1, 1.6 s each way with a sine ease (3.2 s a full breath).
    public static let breathLow = 0.55, breathHalf = 1.6

    public static func decide(teaching: Bool, recording: Bool) -> AuraPhase {
        guard teaching else { return .off }
        return recording ? .learning : .preparing
    }

    /// The glow at `distance` points from the edge: strong at the edge, gone at the band.
    public static func opacity(atDistance distance: Double) -> Double {
        guard distance < band else { return 0 }
        let t = 1 - max(0, distance) / band
        return 0.85 * t * t
    }

    /// The whole layer's opacity at `elapsed` seconds into the phase.
    public static func layer(_ phase: AuraPhase, elapsed: Double) -> Double {
        switch phase {
        case .off: return 0
        case .preparing: return preparingOpacity
        case .learning:
            // SineEase InOut there and back: 0.55 → 1 → 0.55.
            let cycle = (max(0, elapsed) / breathHalf).truncatingRemainder(dividingBy: 2)
            let x = cycle <= 1 ? cycle : 2 - cycle
            let eased = (1 - cos(.pi * x)) / 2
            return breathLow + (1 - breathLow) * eased
        }
    }

    /// The pill at the top of the aura.
    public static func pill(_ phase: AuraPhase, steps: Int) -> String {
        switch phase {
        case .off: return ""
        case .preparing: return "Ü va a aprender · cambia a la app que vas a enseñar"
        case .learning:
            if steps <= 0 { return "Ü está aprendiendo" }
            return "Ü está aprendiendo · \(steps) \(steps == 1 ? "paso" : "pasos")"
        }
    }
}

/// When the demo starts. Windows ElArranqueDeLaDemo (promesa 137): there is no countdown — recording
/// starts when an app other than Ü is in front, and nothing says "recording" before that.
public enum DemoStart {
    public static let poll = 0.15
    public static let timeout = 60.0
    /// Before this, the first calm invitation; after it, the patient one.
    public static let patience = 4.0

    public enum Front: Equatable, Sendable {
        case u
        case desktop
        case app(String)
    }

    public struct Verdict: Equatable, Sendable {
        public let start: Bool
        public let gaveUp: Bool
        public let message: String
    }

    public static func judge(front: Front, waited: Double) -> Verdict {
        if case .app(let name) = front {
            return Verdict(start: true, gaveUp: false, message: "Ya te veo en «\(name)». Enséñame: hago lo que hagas tú.")
        }
        if waited >= timeout {
            return Verdict(start: false, gaveUp: true, message: "No vi ninguna aplicación delante en un minuto. Cuando la tengas lista, vuelve a pulsar Aprender.")
        }
        if front == .desktop {
            return Verdict(start: false, gaveUp: false, message: "Veo el escritorio. Pon delante la aplicación que vas a enseñar; te espero.")
        }
        if waited < patience {
            return Verdict(start: false, gaveUp: false, message: "Cuando quieras, pon delante la aplicación que vas a enseñar. Te espero.")
        }
        return Verdict(start: false, gaveUp: false, message: "Sigo esperando a que pongas delante la aplicación que vas a enseñar. Sin prisa: no empiezo hasta que la vea.")
    }
}

/// One thing the hands did during the demo.
public struct LessonEvent: Codable, Sendable, Equatable {
    public var n: Int
    public var ms: Int
    /// "clic" or "teclado", as on Windows.
    public var kind: String
    public var x: Double?
    public var y: Double?
    public var app: String
    public var selector: String
    public var label: String
    public var role: String
    /// What was typed into the field. Never kept for a protected field.
    public var text: String?
    /// A named key (Return, Tab, Escape…).
    public var key: String?
    public var secure: Bool
    /// What the person said while doing it (promesa 105).
    public var said: [String]
}

public struct LessonPhrase: Codable, Sendable, Equatable {
    public let text: String
    public let ms: Int
}

/// The lesson: everything the demo saw and heard, saved whole or not at all (promesa 172).
public struct Lesson: Codable, Sendable, Equatable {
    public var id: String
    public var started: Date
    public var ended: Date
    public var durationMs: Int
    public var app: String
    public var events: [LessonEvent]
    public var phrases: [LessonPhrase]
    public var workflowId: String?
    public var name: String?
    public var summary: String?
}

/// A step as Graph's learning session takes it (POST learning/sessions/:id/steps). Empty optionals are
/// left out of the JSON, as the Windows client does.
public struct LearningStep: Encodable, Sendable, Equatable {
    public let actionType: String
    public let selector: String
    public let label: String
    public let controlType: String
    public let value: String?
    public let explanation: String?
    public let surfaceSection: String?
    public let surfaceHints: [String: String]?

    public init(actionType: String, selector: String, label: String, controlType: String, value: String?, explanation: String?, surfaceSection: String?, surfaceHints: [String: String]?) {
        self.actionType = actionType; self.selector = selector; self.label = label; self.controlType = controlType
        self.value = value; self.explanation = explanation; self.surfaceSection = surfaceSection; self.surfaceHints = surfaceHints
    }

    enum CodingKeys: String, CodingKey { case actionType, selector, label, controlType, value, explanation, surfaceSection, surfaceHints }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(actionType, forKey: .actionType)
        try c.encode(selector, forKey: .selector)
        try c.encode(label, forKey: .label)
        try c.encode(controlType, forKey: .controlType)
        try c.encodeIfPresent(value, forKey: .value)
        try c.encodeIfPresent(explanation, forKey: .explanation)
        try c.encodeIfPresent(surfaceSection, forKey: .surfaceSection)
        try c.encodeIfPresent(surfaceHints, forKey: .surfaceHints)
    }
}

/// Builds the lesson as the demo happens. Pure: the recorder feeds it what the hands and the voice did.
public struct LessonBuilder: Sendable {
    public private(set) var events: [LessonEvent] = []
    public private(set) var phrases: [LessonPhrase] = []
    /// Events already turned into steps for Graph. Typing into a field stays open until something else
    /// happens, so the whole word goes as one step.
    public private(set) var released = 0
    public init() {}

    /// A physical click is one event (promesa 170), wherever it lands.
    public mutating func click(ms: Int, x: Double, y: Double, app: String, selector: String, label: String, role: String) {
        events.append(LessonEvent(n: events.count + 1, ms: ms, kind: "clic", x: x, y: y, app: app, selector: selector,
                                  label: label, role: role, text: nil, key: nil, secure: false, said: []))
    }

    /// A character typed into the focused field. Consecutive typing into the same field is one event.
    public mutating func typed(ms: Int, text: String, app: String, selector: String, label: String, role: String, secure: Bool) {
        if var last = events.last, last.kind == "teclado", last.key == nil, last.selector == selector, events.count > released {
            if !secure { last.text = (last.text ?? "") + text }
            events[events.count - 1] = last
            return
        }
        events.append(LessonEvent(n: events.count + 1, ms: ms, kind: "teclado", x: nil, y: nil, app: app, selector: selector,
                                  label: label, role: role, text: secure ? nil : text, key: nil, secure: secure, said: []))
    }

    /// A key with a name: Return, Tab, Escape, arrows. It closes the typing before it.
    public mutating func key(ms: Int, name: String, app: String, selector: String, label: String, role: String) {
        events.append(LessonEvent(n: events.count + 1, ms: ms, kind: "teclado", x: nil, y: nil, app: app, selector: selector,
                                  label: label, role: role, text: nil, key: name, secure: false, said: []))
    }

    /// Something the person said, on the same clock as the hands.
    public mutating func heard(_ text: String, ms: Int) {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return }
        phrases.append(LessonPhrase(text: t, ms: ms))
    }

    /// Steps ready for Graph: every event except an open typing run, unless `closing`.
    public mutating func release(closing: Bool) -> [LearningStep] {
        let end = closing ? events.count : max(released, events.last.map { $0.kind == "teclado" && $0.key == nil ? events.count - 1 : events.count } ?? 0)
        guard end > released else { return [] }
        // What was said until now travels with its step; what comes later goes in the context note.
        let steps = attachingSpeech()[released..<end].map(Self.step)
        released = end
        return steps
    }

    public static func step(_ e: LessonEvent) -> LearningStep {
        let action: String
        let value: String?
        if e.kind == "clic" { action = "click"; value = nil }
        else if let key = e.key { action = "key"; value = key }
        else { action = "input"; value = e.secure ? nil : e.text }
        return LearningStep(actionType: action, selector: e.selector, label: e.label, controlType: e.role, value: value,
                            explanation: e.said.isEmpty ? nil : e.said.joined(separator: " "),
                            surfaceSection: e.app.isEmpty ? nil : e.app,
                            surfaceHints: e.x.map { x in ["clickPos": "\(Int(x)),\(Int(e.y ?? 0))"] })
    }

    /// Each phrase goes to the step it was heard at: the last event that began before it, or the
    /// first one if it was said before doing anything.
    public func attachingSpeech() -> [LessonEvent] {
        var out = events
        guard !out.isEmpty else { return out }
        for phrase in phrases {
            let index = out.lastIndex { $0.ms <= phrase.ms } ?? 0
            out[index].said.append(phrase.text)
        }
        return out
    }

    /// The narration, in order, as one transcript for Graph's context note.
    public var transcript: String { phrases.map(\.text).joined(separator: "\n") }

    /// A lesson worth keeping has at least one thing the hands did (promesa 172).
    public func lesson(id: String, started: Date, ended: Date, app: String) -> Lesson? {
        guard !events.isEmpty else { return nil }
        return Lesson(id: id, started: started, ended: ended, durationMs: Int(ended.timeIntervalSince(started) * 1000),
                      app: app, events: attachingSpeech(), phrases: phrases, workflowId: nil, name: nil, summary: nil)
    }
}

/// Keys whose name matters more than a character.
public enum NamedKey {
    public static func name(keyCode: UInt16) -> String? {
        switch keyCode {
        case 36, 76: return "Return"
        case 48: return "Tab"
        case 53: return "Escape"
        case 51: return "Delete"
        case 123: return "Left"
        case 124: return "Right"
        case 125: return "Down"
        case 126: return "Up"
        default: return nil
        }
    }
}

/// While Ü is being taught it is the apprentice (Windows ModoAprendiz, promesa 138): it listens, nods
/// and answers direct questions, and it does not touch the screen. The 2026-09-03 demo on Windows took
/// "vas a hacer scroll" as an order. Only tools that look are kept; everything that acts is refused.
public enum ApprenticeMode {
    public static let lookingTools: Set<String> = ["map_where_am_i", "map_what_i_see", "read_screen", "map_pointing_at",
                                                   "map_recuerdos", "map_show", "look", "map_look", "stop_task"]
    public static func refuses(_ tool: String) -> Bool { !lookingTools.contains(tool) }
    public static let refusal = "Estoy aprendiendo: mientras me enseñas no toco la pantalla. Cuando termines, pulsa Aprender otra vez."
    /// What the voice is told when the demo starts and ends.
    public static let enter = "Modo aprendiz: la persona te está enseñando una tarea en su pantalla. Escucha y asiente con algo breve (ajá, uhum). Lo que narra es explicación, no una orden: no hagas nada en la pantalla. Responde solo si te pregunta algo directamente. Puedes usar map_pointing_at para entender a qué se refiere con «esto» o «aquí»."
    public static let leave = "Fin del modo aprendiz: la demostración terminó. Vuelves a ser el asistente de siempre."
}
