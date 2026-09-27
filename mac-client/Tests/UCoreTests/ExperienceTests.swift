import Foundation
import UCore

extension AgentTests {
    func testVoicePresentationAccumulatesReplyAndResetsAtNextTurn() throws {
        var state = TaskPresentation()
        state.receiveUserFragment("Abre informes")
        state.receiveAssistantFragment("Voy a ")
        state.receiveAssistantFragment("abrir informes.")
        XCTAssertEqual(state.title, "Abre informes")
        XCTAssertEqual(state.detail, "Voy a abrir informes.")
        state.receiveUserFragment("Ahora cierra")
        state.receiveAssistantFragment("Cerrando.")
        XCTAssertEqual(state.title, "Ahora cierra")
        XCTAssertEqual(state.detail, "Cerrando.")
        state.stop()
        state.begin("Nueva tarea")
        state.receiveAssistantFragment("Lista.")
        XCTAssertEqual(state.detail, "Lista.")
    }

    func testPresentationKeepsTaskAndDistinguishesStop() throws {
        var state = TaskPresentation()
        state.receiveUserFragment("Abre ")
        state.receiveUserFragment("el navegador")
        XCTAssertEqual(state.title, "Ü")
        XCTAssertEqual(state.detail, "Abre el navegador")
        state.commitUserTurn()
        state.update("Buscando Safari", phase: .working)
        XCTAssertEqual(state.title, "Abre el navegador")
        state.stop()
        XCTAssertEqual(state.phase, .stopped)
        XCTAssertEqual(state.title, "Abre el navegador")
        state.update("Falló la conexión", phase: .error)
        XCTAssertEqual(state.phase, .error)
        state.commitUserTurn()
        XCTAssertEqual(state.title, "Abre el navegador")
    }
    func testMemoryNeverTurnsRememberedIntoLive() throws {
        var memory = NavigationMemory()
        let button = MemoryElement(selector: "button:next", label: "Siguiente", role: "AXButton")
        memory.arrive(at: "mac://fixture/a")
        memory.observe(surface: "mac://fixture/a", elements: [button])
        try memory.teach(surface: "mac://fixture/a", selector: button.selector, meaning: "Abre detalles", at: Date(timeIntervalSince1970: 1))
        memory.arrive(at: "mac://fixture/b")
        memory.observe(surface: "mac://fixture/a", elements: [])
        XCTAssertEqual(memory.currentSurface, "mac://fixture/b")
        XCTAssertEqual(memory.entries(surface: "mac://fixture/a").count, 1)
        XCTAssertEqual(memory.isLive(surface: "mac://fixture/a", selector: button.selector), false)
        XCTAssertThrowsError(try memory.teach(surface: "mac://fixture/a", selector: "never-seen", meaning: "Inventado", at: Date()))
        let decoded = try JSONDecoder().decode(NavigationMemory.self, from: JSONEncoder().encode(memory))
        XCTAssertEqual(decoded.entries(surface: "mac://fixture/a").first?.meaning, "Abre detalles")
        XCTAssertEqual(decoded.isLive(surface: "mac://fixture/a", selector: button.selector), false)
    }
    func testMemoryRoutesOnlyThroughObservedEdges() throws {
        var memory = NavigationMemory()
        let button = MemoryElement(selector: "next", label: "Siguiente", role: "AXButton")
        memory.observe(surface: "a", elements: [button])
        XCTAssertThrowsError(try memory.recordTransition(from: "a", selector: "invented", to: "b"))
        try memory.recordTransition(from: "a", selector: "next", to: "b")
        memory.observe(surface: "b", elements: [button])
        try memory.recordTransition(from: "b", selector: "next", to: "c")
        XCTAssertEqual(memory.nextStep(from: "a", to: "c")?.selector, "next")
        memory.observe(surface: "a", elements: [])
        XCTAssertNil(memory.nextStep(from: "a", to: "c"))
    }
    func testMemoryPersistenceAndCorruptionAreExplicit() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let url = root.appendingPathComponent("memory.json"), store = MemoryStore(url: root.appendingPathComponent("memory.json"))
        var memory = NavigationMemory()
        memory.observe(surface: "a", elements: [MemoryElement(selector: "button", label: "Abrir", role: "AXButton")])
        try memory.teach(surface: "a", selector: "button", meaning: "Abre el informe", at: Date())
        try await store.save(memory)
        let restored = try await store.load()
        XCTAssertEqual(restored.entries(surface: "a").first?.meaning, "Abre el informe")
        XCTAssertEqual(restored.isLive(surface: "a", selector: "button"), false)
        try Data("broken".utf8).write(to: url)
        do { _ = try await store.load(); XCTFail("Corrupt memory was silently erased") } catch {}
        XCTAssertEqual(try String(contentsOf: url), "broken")
    }
}
