import Foundation

private var checks = 0
func XCTFail(_ message: String, file: StaticString = #filePath, line: UInt = #line) { fatalError("\(file):\(line): \(message)") }
func XCTAssertEqual<T: Equatable>(_ a: T, _ b: T, file: StaticString = #filePath, line: UInt = #line) {
    checks += 1
    if a != b { XCTFail("\(a) != \(b)", file: file, line: line) }
}
func XCTAssertNil<T>(_ value: T?, file: StaticString = #filePath, line: UInt = #line) {
    checks += 1
    if value != nil { XCTFail("Expected nil", file: file, line: line) }
}
func XCTAssertThrowsError<T>(_ work: @autoclosure () throws -> T, file: StaticString = #filePath, line: UInt = #line) {
    checks += 1
    do { _ = try work(); XCTFail("Expected error", file: file, line: line) } catch {}
}
@main
struct ContractRunner {
    @MainActor static func main() async throws {
        let tests = AgentTests()
        try tests.testConversationArchivePreservesHistoryAndRejectsCorruption()
        tests.testTaskUpdatesInformWithoutDemandingSpeech()
        tests.testLiveUsesNativeConversationPolicy()
        tests.testWakeGreetingRequiresDirectAddress()
        try await tests.testCredentialReadsSharePendingWorkAndCacheSuccess()
        try await tests.testGraphWireContractAndQuestionContinuation()
        try await tests.testTurnLimitNeverReportsSuccess()
        try await tests.testCancellationPreventsActionsAfterNetworkReturns()
        try tests.testMalformedActionsDoNotClickOrigin()
        try tests.testRetinaAndSecondaryDisplayCoordinates()
        try tests.testStopGateAndStaleObservation()
        try tests.testGraphRequiresHTTPSAndKeepsCredentialsOutOfURL()
        try tests.testAmbiguousLabelsRequireDisambiguation()
        try tests.testToolBatchWaitsForEveryResultAndOnlyContinuesOnce()
        try await tests.testFailedActionStopsDependentBatchAndCannotBecomeSuccess()
        try await tests.testHTTPAuthenticationErrorsAndCredentialFetch()
        try tests.testUnsupportedVoiceProcessingFallsBackToDeviceAudio()
        try tests.testMultichannelMicrophoneProducesReal24kPCM()
        try tests.testLiveOneWireAndUTF8Limit()
        try tests.testJevClosedChoicesAndHandoff()
        try await tests.testJevHTTPDeadlineRetryAndCancellation()
        try tests.testNotchExpansionHasFixedSizesAndFitsSmallDisplays()
        try tests.testConversationHaloIsBoundedAndOffWhenDisconnected()
        try tests.testLiveHandshakeErrorsDoNotMisreportPermissionsOrBalance()
        try tests.testAssistantContextReachesLiveAndGraphWithoutLosingTheUserPreference()
        try tests.testLiveAudioPreservesSilentTimeAndRejectsBrokenPCM()
        try tests.testVoicePresentationAccumulatesReplyAndResetsAtNextTurn()
        try tests.testPresentationKeepsTaskAndDistinguishesStop()
        try tests.testMemoryNeverTurnsRememberedIntoLive()
        try tests.testMemoryRoutesOnlyThroughObservedEdges()
        try await tests.testMemoryPersistenceAndCorruptionAreExplicit()
        print("PASS: 31 contracts, \(checks) assertions. No network, microphone or desktop access.")
    }
}
