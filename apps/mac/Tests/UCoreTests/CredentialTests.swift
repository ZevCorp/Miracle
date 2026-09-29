import Foundation
import UMac

extension AgentTests {
    func testCredentialReadsSharePendingWorkAndCacheSuccess() async throws {
        let reader = CredentialReader()
        let first = Task { try await reader.read("test") { try await Task.sleep(for: .milliseconds(100)); return "value" } }
        try await Task.sleep(for: .milliseconds(20))
        let second = try await reader.read("test") { XCTFail("Duplicate credential read"); return nil }
        XCTAssertEqual(try await first.value, "value")
        XCTAssertEqual(second, "value")
        XCTAssertEqual(try await reader.read("test") { XCTFail("Cache ignored"); return nil }, "value")
        await reader.invalidate("test")
        XCTAssertEqual(try await reader.read("test") { "updated" }, "updated")
    }
}
