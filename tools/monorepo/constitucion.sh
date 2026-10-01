#!/usr/bin/env bash
# La constitución de Ü —quién es, cómo habla, qué hace cuando le piden algo y cómo trata a un médico o a
# una persona— vive en dos copias, porque la leen dos programas que no comparten código:
#
#   apps/windows/windows-client/src/Voice/ConstitucionDeU.cs        (la voz de Ü en Windows)
#   services/graph/src/application/prompts/ConstitucionDeU.js       (el cerebro de Ü en Graph)
#
# Si las copias se separan, el mismo usuario oye a dos Ü distintas según por dónde le hable: es lo que
# pasaba hasta el 2026-10-01 (la voz decía «no pidas permiso» y Graph «pregunta siempre»). Este script
# compara los cuatro textos, línea a línea, sin mirar la sangría ni las líneas en blanco, y sale con 1 si
# alguno difiere. Lo corre el CI de la raíz. Uso:  bash tools/monorepo/constitucion.sh
set -eu

raiz="$(git rev-parse --show-toplevel)"
cs="$raiz/apps/windows/windows-client/src/Voice/ConstitucionDeU.cs"
js="$raiz/services/graph/src/application/prompts/ConstitucionDeU.js"

for f in "$cs" "$js"; do
  [ -f "$f" ] || { printf '\033[31m  ✘  falta %s\033[0m\n' "${f#$raiz/}"; exit 1; }
done

python3 - "$cs" "$js" <<'PY'
import re, sys

cs_path, js_path = sys.argv[1], sys.argv[2]
BLOQUES = ["quien", "obedece", "perfil-medico", "perfil-persona"]

def leer(ruta):
    with open(ruta, encoding="utf-8") as f:
        return f.read().replace("\r", "")

def normalizar(texto):
    return "\n".join(l.strip() for l in texto.split("\n") if l.strip())

def extraer(fuente, bloque, abre, cierra, nombre):
    marca = re.search(r"//\s*constitucion:" + re.escape(bloque) + r"\s*\n", fuente)
    if not marca:
        sys.exit(f"  ✘  {nombre}: falta la marca «// constitucion:{bloque}»")
    i = fuente.find(abre, marca.end())
    j = fuente.find(cierra, i + len(abre)) if i >= 0 else -1
    if i < 0 or j < 0:
        sys.exit(f"  ✘  {nombre}: no encuentro el texto de «{bloque}» después de su marca")
    return normalizar(fuente[i + len(abre):j])

cs, js = leer(cs_path), leer(js_path)
mal = 0
for b in BLOQUES:
    a = extraer(cs, b, '"""', '"""', "ConstitucionDeU.cs")
    c = extraer(js, b, "`", "`", "ConstitucionDeU.js")
    if "${" in c:
        print(f"\033[31m  ✘  {b}: la copia de Graph interpola (${{…}}); tiene que ser texto fijo\033[0m"); mal += 1; continue
    if a != c:
        mal += 1
        la, lc = a.split("\n"), c.split("\n")
        n = next((k for k in range(min(len(la), len(lc))) if la[k] != lc[k]), min(len(la), len(lc)))
        print(f"\033[31m  ✘  la constitución de Ü difiere en «{b}» (línea {n + 1} del bloque)\033[0m")
        print("     Windows:", la[n] if n < len(la) else "(se acaba)")
        print("     Graph:  ", lc[n] if n < len(lc) else "(se acaba)")
if mal:
    print("     Edita las dos copias a la vez: ConstitucionDeU.cs (Windows) y ConstitucionDeU.js (Graph).")
    sys.exit(1)
print("  ✔  la constitución de Ü dice lo mismo en Windows y en Graph")
PY
