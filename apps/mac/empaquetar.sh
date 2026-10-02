#!/bin/bash
# Arma el .dmg que se entrega a quien prueba Ü en otro Mac: app universal (Apple Silicon + Intel),
# firmada con la identidad estable de este Mac, con un LÉEME para abrirla la primera vez.
#
#   ./empaquetar.sh              el .dmg, con la credencial de voz de pruebas si este Mac tiene una
#   ./empaquetar.sh --sin-clave  el .dmg sin ninguna credencial dentro
#
# La credencial de pruebas NO vive en el repo (es público). Se lee de la variable U_PRUEBAS_OPENAI_KEY
# o del archivo «~/Library/Application Support/U Mac/Pruebas/openai-key», y viaja dentro de la app
# enmascarada, no cifrada: quien tenga el .dmg puede sacarla. Por eso caduca sola a los
# U_PRUEBAS_DIAS días (30) y hay que ponerle tope de gasto y revocarla al terminar las pruebas.
set -euo pipefail
cd "$(dirname "$0")"
con_clave=1
case "${1:-}" in '') ;; --sin-clave) con_clave=0 ;; *) echo 'Uso: ./empaquetar.sh [--sin-clave]' >&2; exit 2 ;; esac
dias="${U_PRUEBAS_DIAS:-30}"
archivo_clave="$HOME/Library/Application Support/U Mac/Pruebas/openai-key"

# El contrato y la app de este Mac (arm64 o Intel, la que toque), firmada.
./build.sh release

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
fi
# Fuera del repo, como en build.sh: iCloud Drive ensucia los bundles y codesign los rechaza.
staging_dir="$(mktemp -d "${TMPDIR:-/tmp}/u-mac-dmg.XXXXXX")"
trap 'restore_keychain_search_list; rm -rf "$staging_dir"' EXIT

# Las dos arquitecturas de lo que corre en el Mac de otra persona: la app y su ayudante del Llavero.
for product in U UCredentialStore; do
  swift build -c release --product "$product" --triple arm64-apple-macosx14.0 --scratch-path .build-arm
  swift build -c release --product "$product" --triple x86_64-apple-macosx14.0 --scratch-path .build-intel
done
arm_bin="$(swift build -c release --triple arm64-apple-macosx14.0 --scratch-path .build-arm --show-bin-path)"
intel_bin="$(swift build -c release --triple x86_64-apple-macosx14.0 --scratch-path .build-intel --show-bin-path)"

disk="$staging_dir/Ü para Mac"
app="$disk/U.app"
mkdir -p "$disk"
/usr/bin/ditto .artifacts/U.app "$app"
for product in U UCredentialStore; do
  /usr/bin/lipo -create "$arm_bin/$product" "$intel_bin/$product" -output "$app/Contents/MacOS/$product"
done

clave="${U_PRUEBAS_OPENAI_KEY:-}"
if [[ -z "$clave" && -f "$archivo_clave" ]]; then clave="$(<"$archivo_clave")"; fi
if [[ "$con_clave" == 1 && -n "$clave" ]]; then
  sellada="$(printf '%s' "$clave" | .artifacts/U.app/Contents/MacOS/U --seal-credential)"
  hasta="$(/bin/date -u -v+"$dias"d +%Y-%m-%dT%H:%M:%SZ)"
  cat > "$app/Contents/Resources/pruebas.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>OPENAI_API_KEY</key><string>$sellada</string>
<key>hasta</key><date>$hasta</date>
</dict></plist>
PLIST
  /usr/bin/plutil -lint "$app/Contents/Resources/pruebas.plist"
  credencial="credencial de voz de pruebas dentro, válida hasta $hasta"
else
  credencial="sin credencial dentro"
fi

/usr/bin/xattr -cr "$app"
if [[ "$signing_mode" == "developer-id" ]]; then
  /usr/bin/codesign --force --options runtime --timestamp --identifier com.zevcorp.u.mac.credential-store --sign "$signing_identity" "$app/Contents/MacOS/UCredentialStore"
  /usr/bin/codesign --force --options runtime --timestamp --entitlements entitlements.plist --sign "$signing_identity" "$app"
else
  /usr/bin/codesign --force --keychain "$signing_keychain" --identifier com.zevcorp.u.mac.credential-store --sign "$signing_identity" "$app/Contents/MacOS/UCredentialStore"
  /usr/bin/codesign --force --keychain "$signing_keychain" --entitlements entitlements.plist --sign "$signing_identity" "$app"
fi
/usr/bin/codesign --verify --deep --strict "$app"
if [[ "$(/usr/bin/codesign -d -r- "$app" 2>&1)" == *"cdhash"* ]]; then
  echo 'La app quedó con firma ad hoc: los permisos de macOS se perderían en cada versión. No se empaqueta.' >&2
  exit 1
fi

ln -s /Applications "$disk/Aplicaciones"
cat > "$disk/LÉEME — cómo abrir Ü.txt" <<'LEEME'
Ü para Mac — versión de pruebas
===============================

1. Arrastra «U» a la carpeta «Aplicaciones» de esta misma ventana.

2. Abre «U» desde Aplicaciones. La primera vez macOS dirá que no pudo verificarla
   (es una versión de pruebas, todavía sin el sello de Apple). Pulsa «Aceptar» y luego:

      Ajustes del Sistema → Privacidad y seguridad → baja hasta «Seguridad»
      → junto a «U» pulsa «Abrir igualmente» → confirma con tu contraseña o huella.

   Solo se hace una vez. Si prefieres la Terminal, esta línea hace lo mismo:

      xattr -dr com.apple.quarantine /Applications/U.app && open /Applications/U.app

3. Ü te pedirá tres permisos. Sin ellos no puede ayudarte:

      Accesibilidad            para hacer clic y escribir por ti
      Grabación de pantalla    para ver el resultado de lo que hace
      Micrófono                para escucharte

   Cada uno se activa en Ajustes del Sistema → Privacidad y seguridad. Después de dar
   Accesibilidad y Grabación de pantalla, cierra Ü (Ü en la barra de menús → Salir de Ü)
   y vuelve a abrirla.

4. Para hablarle, pulsa la carita Ü de la pantalla. Para detenerla, tecla Esc.
   El panel de la derecha aparece al llevar el cursor al borde derecho de la pantalla.

Ü queda encendida: se abre sola cada vez que inicias sesión. Para quitarla, sal de Ü y
arrastra «U» de Aplicaciones a la Papelera.

Requiere macOS 14 o posterior. Funciona en Mac con Apple Silicon y con Intel.
LEEME

mkdir -p .artifacts
dmg="$PWD/.artifacts/U-Mac-pruebas.dmg"
rm -f "$dmg"
/usr/bin/hdiutil create -quiet -volname 'Ü para Mac' -srcfolder "$disk" -fs HFS+ -format UDZO -ov "$staging_dir/U.dmg"
if [[ "$signing_mode" == "developer-id" ]]; then
  /usr/bin/codesign --force --timestamp --sign "$signing_identity" "$staging_dir/U.dmg"
fi
/usr/bin/hdiutil verify -quiet "$staging_dir/U.dmg"
cp "$staging_dir/U.dmg" "$dmg"
echo "Disco listo: $dmg ($(/usr/bin/du -h "$dmg" | cut -f1 | tr -d ' '))"
echo "Arquitecturas: $(/usr/bin/lipo -archs "$app/Contents/MacOS/U")"
echo "Firma: $signing_mode ($signing_identity)"
echo "Credencial: $credencial"
if [[ "$signing_mode" != "developer-id" ]]; then
  echo "Sin sello de Apple: cada persona aprueba la app una vez (está en el LÉEME del disco)."
fi
