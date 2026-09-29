import Foundation
import Security
import CryptoKit

// This target deliberately has no dependency on the app. Its code identity stays
// unchanged when UI/voice code is rebuilt with a local (non-Developer-ID) signer.
// Only a signed Ü parent with this helper's certificate can receive a credential.
func trustedParent(_ pid: pid_t) -> Bool {
    guard pid > 1, getppid() == pid else { return false }
    var own: SecCode?, parent: SecCode?, info: CFDictionary?, staticCode: SecStaticCode?
    guard SecCodeCopySelf([], &own) == errSecSuccess, let own,
          SecCodeCopyStaticCode(own, [], &staticCode) == errSecSuccess, let staticCode,
          SecCodeCopySigningInformation(staticCode, SecCSFlags(rawValue: kSecCSSigningInformation), &info) == errSecSuccess,
          let certificates = (info as? [String: Any])?[kSecCodeInfoCertificates as String] as? [SecCertificate],
          let root = certificates.last else { return false }
    let fingerprint = Insecure.SHA1.hash(data: SecCertificateCopyData(root) as Data).map { String(format: "%02x", $0) }.joined()
    var requirement: SecRequirement?
    let rule = "identifier \"com.zevcorp.u.mac\" and certificate root = H\"\(fingerprint)\""
    guard SecRequirementCreateWithString(rule as CFString, [], &requirement) == errSecSuccess,
          SecCodeCopyGuestWithAttributes(nil, [kSecGuestAttributePid as String: pid] as CFDictionary, [], &parent) == errSecSuccess,
          let parent else { return false }
    return SecCodeCheckValidity(parent, [], requirement) == errSecSuccess
}

let parentPID = getppid()
guard trustedParent(parentPID) else { exit(77) }
let args = CommandLine.arguments
guard args.count == 4, ["read", "save"].contains(args[1]),
      ["OPENAI_API_KEY", "GRAPH_API_KEY"].contains(args[2]),
      ["silent", "authorize"].contains(args[3]) else { exit(64) }
let interactive = args[3] == "authorize"
guard SecKeychainSetUserInteractionAllowed(interactive) == errSecSuccess else { exit(70) }
let service = "com.zevcorp.u.mac.credentials.store"
var query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                           kSecAttrService as String: service, kSecAttrAccount as String: args[2]]
var status: OSStatus
var value: CFTypeRef?
if args[1] == "read" {
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    status = SecItemCopyMatching(query as CFDictionary, &value)
    // Existing installations can authorize migration explicitly. Silent reads
    // must never prompt for an old item's ACL.
    if status == errSecItemNotFound && interactive {
        query[kSecAttrService as String] = "com.zevcorp.u.mac.native"
        status = SecItemCopyMatching(query as CFDictionary, &value)
        if status == errSecSuccess, let bytes = value as? Data {
            let migrated: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service, kSecAttrAccount as String: args[2], kSecValueData as String: bytes]
            status = SecItemAdd(migrated as CFDictionary, nil)
        }
    }
} else {
    let bytes = FileHandle.standardInput.readDataToEndOfFile()
    guard bytes.count <= 16384, trustedParent(parentPID) else { exit(64) }
    if bytes.isEmpty { status = SecItemDelete(query as CFDictionary) }
    else {
        let attributes = [kSecValueData as String: bytes]
        status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            status = SecItemAdd(query.merging(attributes) { _, new in new } as CFDictionary, nil)
        }
    }
}
guard trustedParent(parentPID) else { exit(77) }
var result: [String: Any] = ["status": status]
if status == errSecSuccess, let bytes = value as? Data, let text = String(data: bytes, encoding: .utf8) { result["value"] = text }
let output = try JSONSerialization.data(withJSONObject: result)
FileHandle.standardOutput.write(output)
