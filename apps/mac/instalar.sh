#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SOURCE="$ROOT/.artifacts/U.app"
DESTINATION="$HOME/Applications/U.app"
EXPECTED_IDENTIFIER="com.zevcorp.u.mac"
LEGACY_DESKTOP_APP="$HOME/Desktop/U/U-Mac/U.app"
TRASH="$HOME/.Trash"

stop_bundle() {
  local executable="$1"
  local signal="$2"
  local pid
  while IFS= read -r pid; do
    [[ "$pid" == "$$" ]] && continue
    kill "-$signal" "$pid" 2>/dev/null || true
  done < <(/usr/bin/pgrep -f -- "$executable" 2>/dev/null || true)
}

if [[ ! -x "$SOURCE/Contents/MacOS/U" ]]; then
  "$ROOT/build.sh" release
fi
# Ü stays on: a login agent opens it at login and reopens it if it dies (not if you quit it).
AGENT_LABEL="com.zevcorp.u.mac"
AGENT_PLIST="$HOME/Library/LaunchAgents/$AGENT_LABEL.plist"
# The agent is stopped first, so it does not reopen the old copy while the bundle is replaced.
/bin/launchctl bootout "gui/$(id -u)/$AGENT_LABEL" 2>/dev/null || true
# Stop only the known U copies before replacing the canonical installed bundle.
stop_bundle "$DESTINATION/Contents/MacOS/U" TERM
stop_bundle "$LEGACY_DESKTOP_APP/Contents/MacOS/U" TERM
sleep 1
stop_bundle "$DESTINATION/Contents/MacOS/U" KILL
stop_bundle "$LEGACY_DESKTOP_APP/Contents/MacOS/U" KILL
mkdir -p "$HOME/Applications"
mkdir -p "$TRASH"

# The old Desktop bundle has the historical ad-hoc TCC identity. Move it to the
# Trash so System Settings cannot keep offering its stale record as another U.
if [[ -d "$LEGACY_DESKTOP_APP" ]]; then
  mv "$LEGACY_DESKTOP_APP" "$TRASH/U.app.legacy-$(date +%Y%m%d-%H%M%S)"
fi

STAGING="$HOME/Applications/.U.installing-$(/usr/bin/uuidgen).app"
/usr/bin/ditto "$SOURCE" "$STAGING"
# A repo inside iCloud Drive (Documents/Desktop sync) tags the bundle with FinderInfo and
# file-provider attributes, and `codesign --verify --strict` rejects them as detritus.
/usr/bin/xattr -cr "$STAGING"
actual_identifier="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$STAGING/Contents/Info.plist")"
if [[ "$actual_identifier" != "$EXPECTED_IDENTIFIER" ]]; then
  echo "La app preparada tiene un identificador inesperado: $actual_identifier" >&2
  exit 1
fi
if [[ -d "$DESTINATION" ]]; then
  mv "$DESTINATION" "$TRASH/U.app.previous-$(date +%Y%m%d-%H%M%S)"
fi
mv "$STAGING" "$DESTINATION"
/usr/bin/codesign --verify --deep --strict "$DESTINATION"
actual_requirement="$(/usr/bin/codesign -d -r- "$DESTINATION" 2>&1)"
if [[ "$actual_requirement" == *"cdhash"* ]]; then
  echo "La app instalada tiene una firma ad hoc inestable; no se instaló." >&2
  exit 1
fi
echo "App instalada en: $DESTINATION"
echo "Identidad TCC: $EXPECTED_IDENTIFIER"
echo "Abre siempre esta copia para conservar el registro de permisos de macOS."
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$AGENT_PLIST" <<AGENT
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>$AGENT_LABEL</string>
<key>ProgramArguments</key><array><string>$DESTINATION/Contents/MacOS/U</string></array>
<key>AssociatedBundleIdentifiers</key><string>$EXPECTED_IDENTIFIER</string>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
<key>ThrottleInterval</key><integer>10</integer>
<key>ProcessType</key><string>Interactive</string>
<key>LimitLoadToSessionType</key><string>Aqua</string>
</dict></plist>
AGENT
if /bin/launchctl bootstrap "gui/$(id -u)" "$AGENT_PLIST" 2>/dev/null; then
  echo "Ü se abre sola al iniciar sesión y vuelve si se cierra por un fallo (agente $AGENT_LABEL)."
else
  echo "No se pudo registrar el arranque automático; se abre esta vez a mano." >&2
  open "$DESTINATION"
fi
