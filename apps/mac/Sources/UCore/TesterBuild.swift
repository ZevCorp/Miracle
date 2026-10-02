import Foundation

/// A credential that travels inside a build handed to testers (`empaquetar.sh`). It is NOT a secret
/// store: whoever has the app can read it back. The mask only keeps the plain key out of `strings`
/// and of secret scanners; what bounds the damage is the date after which the app stops using it,
/// and revoking the key at the provider.
public enum BundledCredential {
    private static let mask = Array("Ü para Mac · versión de pruebas".utf8)

    public static func seal(_ key: String) -> String {
        Data(key.trimmingCharacters(in: .whitespacesAndNewlines).utf8.enumerated().map { $1 ^ mask[$0 % mask.count] }).base64EncodedString()
    }

    /// The key, or nil when there is none, it is damaged, or its time is over.
    public static func open(_ sealed: String?, until: Date?, now: Date) -> String? {
        guard let sealed, let until, now < until, let data = Data(base64Encoded: sealed), !data.isEmpty,
              let key = String(bytes: data.enumerated().map { $1 ^ mask[$0 % mask.count] }, encoding: .utf8),
              key.unicodeScalars.allSatisfy({ $0.isASCII && $0.value > 32 && $0.value < 127 }) else { return nil }
        return key
    }
}

/// The login agent a copy installed by hand (dragged from the .dmg) writes for itself, so Ü is on
/// after every login without `instalar.sh`. Only a copy that lives in an Applications folder does it:
/// a copy running from the disk image or translocated by Gatekeeper has a path that will not exist.
public enum LoginAgent {
    public static let label = "com.zevcorp.u.mac"

    /// The plist to write, or nil when nothing has to change.
    public static func plist(executable: String, home: String, existing: String?) -> String? {
        let folder = (((executable as NSString).deletingLastPathComponent as NSString).deletingLastPathComponent as NSString).deletingLastPathComponent
        let app = (folder as NSString).deletingLastPathComponent
        guard folder.hasSuffix(".app"), app == "/Applications" || app == home + "/Applications" else { return nil }
        let path = executable.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;")
        let wanted = """
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0"><dict>
        <key>Label</key><string>\(label)</string>
        <key>ProgramArguments</key><array><string>\(path)</string></array>
        <key>AssociatedBundleIdentifiers</key><string>\(label)</string>
        <key>RunAtLoad</key><true/>
        <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
        <key>ThrottleInterval</key><integer>10</integer>
        <key>ProcessType</key><string>Interactive</string>
        <key>LimitLoadToSessionType</key><string>Aqua</string>
        </dict></plist>

        """
        // An agent that already opens this copy is left alone, whoever wrote it.
        if let existing, existing.contains("<string>\(path)</string>") { return nil }
        return wanted
    }
}
