import Foundation
import UCore

/// A build for testers (2026-10-02): the .dmg carries a temporary voice credential and the installed
/// copy keeps itself on. Judged here without a Keychain, a disk image or launchd.
extension AgentTests {
    func testBundledCredentialOpensOnlyWholeAndOnlyUntilItsDate() {
        let key = "sk-proj-Abc_123-xyz"
        let sealed = BundledCredential.seal("  \(key)\n")
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        // The plain key is not in what travels inside the app.
        XCTAssertEqual(sealed.contains("sk-proj"), false)
        XCTAssertEqual(BundledCredential.open(sealed, until: now.addingTimeInterval(60), now: now), key)
        // Temporary: on its date and after it, the app has no credential of its own.
        XCTAssertNil(BundledCredential.open(sealed, until: now, now: now))
        XCTAssertNil(BundledCredential.open(sealed, until: now.addingTimeInterval(-1), now: now))
        XCTAssertNil(BundledCredential.open(sealed, until: nil, now: now))
        // A build without one, or a damaged one, gives nothing instead of garbage sent to the provider.
        XCTAssertNil(BundledCredential.open(nil, until: now.addingTimeInterval(60), now: now))
        XCTAssertNil(BundledCredential.open("", until: now.addingTimeInterval(60), now: now))
        XCTAssertNil(BundledCredential.open("no es base64", until: now.addingTimeInterval(60), now: now))
        XCTAssertNil(BundledCredential.open(Data([0, 1, 2, 3]).base64EncodedString(), until: now.addingTimeInterval(60), now: now))
    }

    func testOnlyACopyInApplicationsKeepsItselfOnAndWritesItsAgentOnce() {
        let home = "/Users/ana"
        let installed = "/Applications/U.app/Contents/MacOS/U"
        let written = LoginAgent.plist(executable: installed, home: home, existing: nil)
        XCTAssertEqual(written?.contains("<string>\(installed)</string>"), true)
        XCTAssertEqual(written?.contains("<key>RunAtLoad</key><true/>"), true)
        // Quitting by hand is respected: launchd only reopens after a failure.
        XCTAssertEqual(written?.contains("<key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>"), true)
        // Already written for this copy: nothing to do.
        XCTAssertNil(LoginAgent.plist(executable: installed, home: home, existing: written))
        // Moved to the personal folder: the agent follows the copy.
        let personal = home + "/Applications/U.app/Contents/MacOS/U"
        XCTAssertEqual(LoginAgent.plist(executable: personal, home: home, existing: written)?.contains(personal), true)
        // From the disk image, translocated, or from the build folder: no agent to a path that goes away.
        XCTAssertNil(LoginAgent.plist(executable: "/Volumes/Ü para Mac/U.app/Contents/MacOS/U", home: home, existing: nil))
        XCTAssertNil(LoginAgent.plist(executable: "/private/var/folders/x/T/AppTranslocation/1/d/U.app/Contents/MacOS/U", home: home, existing: nil))
        XCTAssertNil(LoginAgent.plist(executable: home + "/repo/apps/mac/.artifacts/U.app/Contents/MacOS/U", home: home, existing: nil))
        XCTAssertNil(LoginAgent.plist(executable: "/Applications/Otra/U.app/Contents/MacOS/U", home: home, existing: nil))
    }
}

extension AgentTests {
    func testLunaStopsAtTenMillionTokensADayAndStartsOverTheNextDay() {
        XCTAssertEqual(LunaBudget.dailyTokens, 10_000_000)
        var budget = LunaBudget()
        XCTAssertEqual(budget.exhausted(on: "2026-10-02"), false)
        budget.add(9_999_999, on: "2026-10-02")
        XCTAssertEqual(budget.exhausted(on: "2026-10-02"), false)
        XCTAssertEqual(budget.remaining(on: "2026-10-02"), 1)
        // A turn without a count, or with a nonsense one, neither adds nor forgives.
        budget.add(nil, on: "2026-10-02"); budget.add(-5, on: "2026-10-02")
        XCTAssertEqual(budget.used, 9_999_999)
        budget.add(1, on: "2026-10-02")
        XCTAssertEqual(budget.exhausted(on: "2026-10-02"), true)
        XCTAssertEqual(budget.remaining(on: "2026-10-02"), 0)
        // What was saved yesterday does not close today.
        XCTAssertEqual(budget.exhausted(on: "2026-10-03"), false)
        XCTAssertEqual(budget.remaining(on: "2026-10-03"), LunaBudget.dailyTokens)
        budget.add(10, on: "2026-10-03")
        XCTAssertEqual(budget, LunaBudget(day: "2026-10-03", used: 10))
        // The provider's own count is the one used; only a finished Luna turn carries it.
        XCTAssertEqual(LunaBudget.tokens(in: ["type": "response.completed", "response": ["usage": ["input_tokens": 900, "output_tokens": 100, "total_tokens": 1000]]]), 1000)
        XCTAssertEqual(LunaBudget.tokens(in: ["type": "response.completed", "response": ["usage": ["input_tokens": 900, "output_tokens": 100]]]), 1000)
        XCTAssertNil(LunaBudget.tokens(in: ["type": "response.completed", "response": ["id": "r"]]))
        XCTAssertNil(LunaBudget.tokens(in: ["type": "response.created", "response": ["usage": ["total_tokens": 7]]]))
        var utc = Calendar(identifier: .gregorian); utc.timeZone = TimeZone(identifier: "UTC")!
        XCTAssertEqual(LunaBudget.day(Date(timeIntervalSince1970: 1_790_985_600), calendar: utc), "2026-10-03")
    }
}
