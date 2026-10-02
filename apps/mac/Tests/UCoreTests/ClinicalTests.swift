import Foundation
import UCore

private actor ClinicalMock: ClinicalAPI {
    var created = 0
    var saved: String?
    var generated = 0
    var failGenerate = false
    func templates(specialty: String?) async throws -> [ClinicalTemplate] { [ClinicalTemplate(id: "open", name: OpenClinicalTemplate.name, specialty: OpenClinicalTemplate.specialty)] }
    func createTemplate(name: String, specialty: String) async throws -> ClinicalTemplate { ClinicalTemplate(id: "created", name: name, specialty: specialty) }
    func createEncounter(templateID: String) async throws -> String { created += 1; return "enc-\(created)" }
    func saveTranscript(encounterID: String, transcript: String) async throws -> Int { saved = transcript; return transcript.count }
    func generateNote(encounterID: String) async throws -> ClinicalNote {
        generated += 1
        if failGenerate { throw ClinicalError.backend(code: "NOTE_GENERATION_FAILED", message: "El organizador no respondió.") }
        return ClinicalNote(summary: "Resumen", sections: [ClinicalSection(id: "nota", title: "Nota", text: "Contenido")])
    }
    func encounter(encounterID: String) async throws -> ClinicalEncounter { ClinicalEncounter(id: encounterID, status: "ready") }
}

extension AgentTests {
    func testClinicalTemplateIsAutomaticAndNamed() async throws {
        let mock = ClinicalMock()
        let list = try await mock.templates(specialty: nil)
        XCTAssertEqual(OpenClinicalTemplate.find(in: list)?.id, "open")
        XCTAssertEqual(OpenClinicalTemplate.name, "Nota abierta (Ü)")
        XCTAssertEqual(OpenClinicalTemplate.specialty, "medicina_general")
    }

    func testClinicalCannotStartWithoutAuthenticatedDoctor() async throws {
        let mock = ClinicalMock(); var microphone = false
        let session = ConsultationSession(api: mock, authenticated: { false }, beginDictation: { microphone = true; return true }, stopDictation: { "texto" })
        XCTAssertEqual(await session.start(templateID: "open"), false)
        XCTAssertEqual(session.state, .failed("Inicia sesión con tu cuenta de Miracle antes de grabar."))
        XCTAssertEqual(microphone, false)
    }

    func testClinicalDoesNotBecomeRecordingWhenDictationFails() async throws {
        let mock = ClinicalMock()
        let session = ConsultationSession(api: mock, authenticated: { true }, beginDictation: { false }, stopDictation: { "texto" })
        XCTAssertEqual(await session.start(templateID: "open"), false)
        XCTAssertEqual(session.state, .failed("No se pudo abrir el dictado. Comprueba la red y vuelve a intentarlo."))
    }

    func testClinicalStartAndStopProduceOrganizedNote() async throws {
        let mock = ClinicalMock()
        let session = ConsultationSession(api: mock, authenticated: { true }, beginDictation: { true }, stopDictation: { "La paciente refiere dolor." })
        XCTAssertEqual(await session.start(templateID: "open"), true)
        XCTAssertEqual(session.state, .recording)
        await session.stop()
        XCTAssertEqual(session.state, .noteReady)
        XCTAssertEqual(session.note?.sections.count, 1)
        XCTAssertEqual(session.transcript, "La paciente refiere dolor.")
    }

    func testClinicalEmptyTranscriptFailsBeforeBackendTranscriptCall() async throws {
        let mock = ClinicalMock()
        let session = ConsultationSession(api: mock, authenticated: { true }, beginDictation: { true }, stopDictation: { "   " })
        _ = await session.start(templateID: "open"); await session.stop()
        XCTAssertEqual(session.state, .failed("El dictado estaba conectado pero no llegó ni una palabra. Revisa el micrófono y vuelve a intentarlo."))
        XCTAssertEqual(await mock.saved, nil)
    }

    func testClinicalPortalMirrorFailureDoesNotDiscardNote() async throws {
        let mock = ClinicalMock()
        let session = ConsultationSession(api: mock, authenticated: { true }, beginDictation: { true }, stopDictation: { "texto" }, mirror: { _, _, _ in false })
        _ = await session.start(templateID: "open"); await session.stop()
        XCTAssertEqual(session.state, .noteReady)
        XCTAssertEqual(session.portalVisible, false)
        XCTAssertEqual(session.note?.summary, "Resumen")
    }

    func testClinicalNoteGenerationCanRetrySameEncounter() async throws {
        let mock = ClinicalMock(); await mock.setFailGenerate(true)
        let session = ConsultationSession(api: mock, authenticated: { true }, beginDictation: { true }, stopDictation: { "texto" })
        _ = await session.start(templateID: "open"); await session.stop()
        XCTAssertEqual(session.state, .failed("El organizador no respondió."))
        XCTAssertEqual(await session.retryNote(), false)
        await mock.setFailGenerate(false)
        XCTAssertEqual(await session.retryNote(), true)
        XCTAssertEqual(session.state, .noteReady)
    }

    func testClinicalStateChangeNeverLogsClinicalText() async throws {
        let mock = ClinicalMock(); var states: [ConsultationState] = []
        let session = ConsultationSession(api: mock, authenticated: { true }, beginDictation: { true }, stopDictation: { "PACIENTE PRIVADO" })
        session.onChange = { states.append($0) }
        _ = await session.start(templateID: "open"); await session.stop()
        XCTAssertEqual(states.contains(.recording), true)
        XCTAssertEqual(states.contains(.noteReady), true)
        XCTAssertEqual(states.description.contains("PACIENTE PRIVADO"), false)
    }
}

private extension ClinicalMock {
    func setFailGenerate(_ value: Bool) { failGenerate = value }
}
