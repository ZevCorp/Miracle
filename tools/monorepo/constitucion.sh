#!/usr/bin/env bash
# La constitución de Ü —quién es, cómo habla, qué hace cuando le piden algo y cómo trata a un médico o a
# una persona— vive en cuatro copias, porque la leen cuatro programas que no comparten código:
#
#   apps/windows/windows-client/src/Voice/ConstitucionDeU.cs                        (la voz de Ü en Windows)
#   services/graph/src/application/prompts/ConstitucionDeU.js                       (el cerebro de Ü en Graph)
#   apps/android/core/src/commonMain/kotlin/graph/core/domain/ConstitucionDeU.kt    (el cerebro local de Android)
#   apps/mac/Sources/UCore/ConstitucionDeU.swift                                    (la voz y Luna en el Mac; desde
#                                                                                    el 2026-10-01, spec 001 del Mac)
#
# Si las copias se separan, el mismo usuario oye a varias Ü distintas según por dónde le hable: es lo que
# pasaba hasta el 2026-10-01 (la voz decía «no pidas permiso», Graph «pregunta siempre» y el cerebro local
# de Android era «viva y divertida», con emojis). Este script compara los cuatro textos de cada copia con
# los de Graph TAL COMO LOS VE EL PROGRAMA: la plantilla de JS tal cual, la raw string de C# y el literal
# multilínea de Swift sin la sangría de sus comillas de cierre (las dos lenguas siguen la misma regla), y la de
# Kotlin después de trimIndent(). Así cuenta también la sangría de las viñetas
# («  · »): una viñeta escrita con la sangría del párrafo pierde sus dos espacios y ya no es el mismo texto.
# Cada marca «// constitucion:<bloque>» tiene que estar una sola vez en cada copia. Sale con 1 si algo difiere.
# Lo corre el CI de la raíz. Uso:  bash tools/monorepo/constitucion.sh
set -eu

raiz="$(git rev-parse --show-toplevel)"
cs="$raiz/apps/windows/windows-client/src/Voice/ConstitucionDeU.cs"
js="$raiz/services/graph/src/application/prompts/ConstitucionDeU.js"
kt="$raiz/apps/android/core/src/commonMain/kotlin/graph/core/domain/ConstitucionDeU.kt"
sw="$raiz/apps/mac/Sources/UCore/ConstitucionDeU.swift"

for f in "$cs" "$js" "$kt" "$sw"; do
  [ -f "$f" ] || { printf '\033[31m  ✘  falta %s\033[0m\n' "${f#$raiz/}"; exit 1; }
done

python3 - "$cs" "$js" "$kt" "$sw" <<'PY'
import re, sys

cs_path, js_path, kt_path, sw_path = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
BLOQUES = ["quien", "obedece", "perfil-medico", "perfil-persona"]

def leer(ruta):
    with open(ruta, encoding="utf-8") as f:
        return f.read().replace("\r", "")

def sangria(linea):
    return len(linea) - len(linea.lstrip())

def tal_cual(crudo):
    """La plantilla de JS: el texto es lo que hay entre las comillas invertidas, sin tocar."""
    return crudo

def raw_string_cs(crudo):
    """La raw string de C# 11: el salto tras las comillas de apertura y el último renglón (la sangría de las comillas de
    cierre) no son texto, y esa sangría se quita de cada renglón; un renglón en blanco queda vacío."""
    renglones = crudo.split("\n")
    if len(renglones) < 3 or renglones[0].strip() or renglones[-1].strip():
        return None
    cierre = renglones[-1]
    cuerpo = []
    for r in renglones[1:-1]:
        if not r.strip():
            cuerpo.append("")
        elif r.startswith(cierre):
            cuerpo.append(r[len(cierre):])
        else:
            return None  # C# no compila: un renglón con menos sangría que el cierre
    return "\n".join(cuerpo)

def trim_indent_kt(crudo):
    """trimIndent() de Kotlin: fuera el primer y el último renglón si están en blanco, y a cada renglón se le quita la
    sangría mínima de los que no están en blanco (un renglón en blanco más corto queda vacío)."""
    renglones = crudo.split("\n")
    if renglones and not renglones[0].strip():
        renglones = renglones[1:]
    if renglones and not renglones[-1].strip():
        renglones = renglones[:-1]
    minima = min((sangria(r) for r in renglones if r.strip()), default=0)
    return "\n".join(r[minima:] if r.strip() else "" for r in renglones)

def extraer(fuente, bloque, abre, cierra, nombre, como):
    marcas = re.findall(r"//\s*constitucion:" + re.escape(bloque) + r"\s*\n", fuente)
    if len(marcas) != 1:
        sys.exit(f"  ✘  {nombre}: la marca «// constitucion:{bloque}» está {len(marcas)} veces; tiene que estar una")
    marca = re.search(r"//\s*constitucion:" + re.escape(bloque) + r"\s*\n", fuente)
    i = fuente.find(abre, marca.end())
    j = fuente.find(cierra, i + len(abre)) if i >= 0 else -1
    if i < 0 or j < 0:
        sys.exit(f"  ✘  {nombre}: no encuentro el texto de «{bloque}» después de su marca")
    texto = como(fuente[i + len(abre):j])
    if texto is None:
        sys.exit(f"  ✘  {nombre}: el texto de «{bloque}» no es una raw string que se pueda leer (comillas o sangría)")
    return texto

# Graph es la referencia; las otras tres se comparan con ella.
cs, js, kt, sw = leer(cs_path), leer(js_path), leer(kt_path), leer(sw_path)
mal = 0
for b in BLOQUES:
    ref = extraer(js, b, "`", "`", "ConstitucionDeU.js", tal_cual)
    if "${" in ref:
        print(f"\033[31m  ✘  {b}: la copia de Graph interpola (${{…}}); tiene que ser texto fijo\033[0m"); mal += 1; continue
    copias = [
        ("Windows", extraer(cs, b, '"""', '"""', "ConstitucionDeU.cs", raw_string_cs)),
        ("Android", extraer(kt, b, '"""', '"""', "ConstitucionDeU.kt", trim_indent_kt)),
        # El literal multilínea de Swift quita la sangría del cierre como la raw string de C#.
        ("Mac", extraer(sw, b, '"""', '"""', "ConstitucionDeU.swift", raw_string_cs)),
    ]
    for nombre, texto in copias:
        # En una raw string de Kotlin, «$» seguido de una letra, «_» o «{» interpola: el texto dejaría de ser fijo.
        if nombre == "Android" and re.search(r"\$[A-Za-z_{]", texto):
            print(f"\033[31m  ✘  {b}: la copia de Android interpola ($…); tiene que ser texto fijo\033[0m"); mal += 1; continue
        # En un literal de Swift, «\» escapa o interpola («\(…)»): el texto que ve el programa ya no sería el escrito.
        if nombre == "Mac" and "\\" in texto:
            print(f"\033[31m  ✘  {b}: la copia del Mac lleva «\\» (escape o interpolación); tiene que ser texto fijo\033[0m"); mal += 1; continue
        if texto != ref:
            mal += 1
            la, lr = texto.split("\n"), ref.split("\n")
            n = next((k for k in range(min(len(la), len(lr))) if la[k] != lr[k]), min(len(la), len(lr)))
            print(f"\033[31m  ✘  la constitución de Ü difiere en «{b}» entre {nombre} y Graph (línea {n + 1} del bloque)\033[0m")
            print(f"     {nombre + ':':9}", repr(la[n]) if n < len(la) else "(se acaba)")
            print("     Graph:   ", repr(lr[n]) if n < len(lr) else "(se acaba)")
if mal:
    print("     Edita las cuatro copias a la vez: ConstitucionDeU.cs (Windows), ConstitucionDeU.js (Graph), ConstitucionDeU.kt (Android) y ConstitucionDeU.swift (Mac).")
    sys.exit(1)
print("  ✔  la constitución de Ü dice lo mismo en Windows, en Graph, en Android y en el Mac")
PY
