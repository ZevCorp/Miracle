#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
configuration="${1:-release}"
if [[ "$configuration" != release && "$configuration" != debug ]]; then
  echo 'Uso: ./build.sh [release|debug]' >&2
  exit 2
fi
APP_IDENTIFIER="com.zevcorp.u.mac"
signing_identity="${CODE_SIGN_IDENTITY:-}"
signing_keychain=""
signing_mode="developer-id"
restore_keychain_search_list() { :; }
if [[ -z "$signing_identity" ]]; then
  IFS=$'\t' read -r signing_identity signing_keychain signing_mode < <("$PWD/ensure-local-signing.sh" --metadata)
  saved_keychains=()
  while IFS= read -r keychain; do saved_keychains+=("$keychain"); done < <(security list-keychains -d user | sed -E 's/^[[:space:]]*"//; s/"[[:space:]]*$//')
  security list-keychains -d user -s "$signing_keychain" "${saved_keychains[@]}"
  restore_keychain_search_list() { security list-keychains -d user -s "${saved_keychains[@]}"; }
  trap restore_keychain_search_list EXIT
fi
swift run -c "$configuration" NativeContract
swift build -c "$configuration" --product U
swift build -c "$configuration" --product UFixture
swift build -c "$configuration" --product UCredentialStore
binary_dir="$(swift build -c "$configuration" --show-bin-path)"
output_dir="$PWD/.artifacts"
mkdir -p "$output_dir"
# Bundles are assembled and signed outside the repo: with the repo in iCloud Drive (Documents or
# Desktop sync), iCloud re-adds com.apple.FinderInfo to a bundle within a second, and codesign
# refuses to sign "resource fork, Finder information, or similar detritus". Measured 2026-09-30.
staging_dir="$(mktemp -d "${TMPDIR:-/tmp}/u-mac-build.XXXXXX")"
trap 'restore_keychain_search_list; rm -rf "$staging_dir"' EXIT
make_bundle() {
  local executable="$1" identifier="$2" display_name="$3"
  local bundle="$staging_dir/$executable.app"
  mkdir -p "$bundle/Contents/MacOS" "$bundle/Contents/Resources"
  cp "$binary_dir/$executable" "$bundle/Contents/MacOS/$executable"
  if [[ "$executable" == U ]]; then
    cp "$binary_dir/UCredentialStore" "$bundle/Contents/MacOS/UCredentialStore"
    if [[ "$signing_mode" == "developer-id" ]]; then
      /usr/bin/codesign --force --options runtime --timestamp --identifier com.zevcorp.u.mac.credential-store --sign "$CODE_SIGN_IDENTITY" "$bundle/Contents/MacOS/UCredentialStore"
    else
      /usr/bin/codesign --force --keychain "$signing_keychain" --identifier com.zevcorp.u.mac.credential-store --sign "$signing_identity" "$bundle/Contents/MacOS/UCredentialStore"
    fi
  fi
  cat > "$bundle/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>$executable</string>
<key>CFBundleIdentifier</key><string>$identifier</string>
<key>CFBundleName</key><string>$display_name</string>
<key>CFBundleDisplayName</key><string>$display_name</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSMinimumSystemVersion</key><string>14.0</string>
<key>LSUIElement</key><true/>
<key>NSHighResolutionCapable</key><true/>
<key>NSMicrophoneUsageDescription</key><string>Ü usa el micrófono para escuchar lo que le pides. Puedes silenciarlo en cualquier momento.</string>
<key>NSSpeechRecognitionUsageDescription</key><string>Ü convierte tu voz en texto para entender tus peticiones cuando utilizas el dictado nativo.</string>
<key>NSAppleEventsUsageDescription</key><string>Ü puede abrir y utilizar aplicaciones cuando se lo pides.</string>
<key>NSScreenCaptureUsageDescription</key><string>Ü necesita ver la pantalla para comprobar el resultado de las acciones que realiza.</string>
<key>USigningMode</key><string>$signing_mode</string>
</dict></plist>
PLIST
  /usr/bin/plutil -lint "$bundle/Contents/Info.plist"
  # The copied binaries still come from .build inside the repo and can carry its attributes.
  /usr/bin/xattr -cr "$bundle"
  if [[ "$signing_mode" == "developer-id" ]]; then
    /usr/bin/codesign --force --options runtime --timestamp --entitlements entitlements.plist --sign "$CODE_SIGN_IDENTITY" "$bundle"
  else
    /usr/bin/codesign --force --keychain "$signing_keychain" --entitlements entitlements.plist --sign "$signing_identity" "$bundle"
  fi
  /usr/bin/codesign --verify --deep --strict "$bundle"
  rm -rf "$output_dir/$executable.app"
  /usr/bin/ditto "$bundle" "$output_dir/$executable.app"
}
make_bundle U "$APP_IDENTIFIER" 'Ü para Mac'
make_bundle UFixture com.zevcorp.u.mac.fixture 'Ü Prueba local'
/usr/bin/ditto -c -k --keepParent "$staging_dir/U.app" "$output_dir/U-Mac.zip"
echo "App lista: $output_dir/U.app"
echo "Firma: $signing_mode ($signing_identity)"
echo "Abre con: open \"$output_dir/U.app\""
