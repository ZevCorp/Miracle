#!/bin/bash
# Genera las frases de frases.json como audio (voces del sistema) para --listen-test.
# Uso: Tests/escucha/generar.sh <carpeta-de-salida>
set -euo pipefail
out="${1:?Uso: generar.sh <carpeta>}"
mkdir -p "$out"
voices=("Paulina" "Eddy (Español (México))" "Flo (Español (México))" "Reed (Español (México))" "Mónica")
python3 - "$(dirname "$0")/frases.json" "$out" "${voices[@]}" <<'PY'
import json, subprocess, sys
source, out, voices = sys.argv[1], sys.argv[2], sys.argv[3:]
manifest = []
for index, entry in enumerate(json.load(open(source))):
    name = f"{index:02d}.aiff"
    voice = voices[index % len(voices)]
    subprocess.run(["say", "-v", voice, "-o", f"{out}/{name}", entry["text"]], check=True)
    manifest.append({"file": name, "expect": entry["expect"], "text": entry["text"], "voice": voice})
json.dump(manifest, open(f"{out}/manifest.json", "w"), ensure_ascii=False, indent=1)
print(f"{len(manifest)} frases en {out}")
PY
