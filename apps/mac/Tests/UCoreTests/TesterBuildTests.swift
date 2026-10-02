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
