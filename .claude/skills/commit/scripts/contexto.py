#!/usr/bin/env python3
"""contexto — lo que hace falta para escribir el mensaje de commit en la voz del repo, leído del diff.

    python3 .claude/skills/commit/scripts/contexto.py            # lo que está en el índice (git add)
    python3 .claude/skills/commit/scripts/contexto.py --todo     # además, lo no añadido
    python3 .claude/skills/commit/scripts/contexto.py --commit <sha>   # un commit ya hecho

Dice: qué proyectos y módulos toca (para el ámbito), un tipo sugerido, las promesas que el diff
AÑADE (para «Promesa N en verde»), si toca specs, migraciones o la forma del turno, y qué no debería
ir en el commit (.env, binarios, out/, node_modules/). No escribe el mensaje: eso es lo que no se
puede automatizar, porque dice el cambio de comportamiento.
"""
import re
import subprocess
import sys
from collections import Counter


def git(*args):
    r = subprocess.run(["git", "-c", "core.quotepath=false", *args], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    return r.stdout if r.returncode == 0 else ""


PROMESA = [
    (re.compile(r'Prueba\("(\d+)\.\s*([^"]{0,90})'), "Windows"),
    (re.compile(r"Promesa\((\d+),\s*\"([^\"]{0,90})"), "Windows (u)"),
    (re.compile(r"promesa\((\d+),\s*['\"`]([^'\"`]{0,90})"), "Graph"),
    (re.compile(r"fun\s+promesa(\d+)\s*\(()"), "Android"),
]
MODULOS_WINDOWS = {
    "windows-client/src/Voice": "voz", "voz/": "voz", "windows-client/src/Update": "actualizacion",
    "windows-client/src/Ui": "carita", "windows-client/src/Notch": "notch", "windows-graph": "sap",
    "nucleo/": "nucleo", "mapeador/": "mapeador", "tests/ContratoDelGrafo": "contrato", "u/": "u",
}


def ambito(ruta):
    partes = ruta.split("/")
    if ruta.startswith("apps/windows/"):
        resto = ruta[len("apps/windows/"):]
        for prefijo, nombre in MODULOS_WINDOWS.items():
            if resto.startswith(prefijo):
                return nombre
        return "windows"
    if ruta.startswith("apps/android/"):
        return "voice" if "/voz/" in ruta or "/voice/" in ruta else "android"
    if ruta.startswith("apps/mac/"):
        return "mac"
    if ruta.startswith("apps/web/"):
        return "web"
    if ruta.startswith("services/graph/"):
        return "graph"
    if ruta.startswith((".claude/", "tools/", ".githooks/", ".github/", "AGENTS.md", "docs/")):
        return "monorepo"
    return partes[0]


def main():
    todo = "--todo" in sys.argv
    base = ["diff", "--cached"] if not todo else ["diff", "HEAD"]
    if "--commit" in sys.argv:   # un commit ya hecho: para reescribir su mensaje o aprender de él
        sha = sys.argv[sys.argv.index("--commit") + 1]
        base = ["diff", f"{sha}~1", sha]
    archivos = [l for l in git(*base, "--name-only").splitlines() if l]
    if not archivos:
        print("No hay nada en el índice. `git add` lo que va en este commit (o --todo para ver todo).")
        sys.exit(1)
    numstat = git(*base, "--numstat")
    añadidas = sum(int(a) for a, *_ in (l.split("\t") for l in numstat.splitlines()) if a.isdigit())
    quitadas = sum(int(b) for _, b, *_ in (l.split("\t") for l in numstat.splitlines()) if b.isdigit())

    ambitos = Counter(ambito(a) for a in archivos)
    solo_docs = all(a.endswith((".md", ".txt")) or "/docs/" in a for a in archivos)
    solo_pruebas = all(re.search(r"(Contrato|contrato|/tests?/|verify-|Test\.kt|Tests\.swift|\.test\.ts|docs/specs)", a) for a in archivos)
    toca_codigo = any(re.search(r"\.(cs|kt|swift|ts|tsx|js|mjs|py|ps1|sh|sql)$", a) for a in archivos)

    print(f"\n# Contexto del commit · {len(archivos)} archivo(s), +{añadidas} −{quitadas}\n")
    print("Ámbitos tocados: " + ", ".join(f"{k} ({v})" for k, v in ambitos.most_common()))
    if len(ambitos) > 1:
        print("  Varios ámbitos: usa el del cambio de comportamiento (el resto lo acompaña), o el del proyecto si es uno.")
    if solo_docs:
        tipo = "docs"
    elif solo_pruebas:
        tipo = "test"
    elif not toca_codigo:
        tipo = "chore"
    else:
        tipo = "feat o fix (feat si el sistema hace algo nuevo; fix si deja de hacer algo mal)"
    print(f"Tipo sugerido: {tipo}")

    diff = git(*base, "-U0")
    nuevas = "\n".join(l[1:] for l in diff.splitlines() if l.startswith("+") and not l.startswith("+++"))
    vistas = {}
    for patron, donde in PROMESA:
        for m in patron.finditer(nuevas):
            n = int(m.group(1))
            vistas.setdefault(n, (donde, m.group(2).strip()))
    if vistas:
        print("\nPromesas que el diff añade o cambia:")
        for n, (donde, texto) in sorted(vistas.items()):
            print(f"  - {n} ({donde}){': ' + texto if texto else ''}")
        print("  → en el cuerpo: «Promesa N en verde (…). Contrato: X/Y, Z pendientes.» con el recuento del ÚLTIMO juez que corriste.")
    specs = [a for a in archivos if "/docs/specs/" in a]
    if specs:
        print(f"\nSpecs tocadas: {', '.join(s.rsplit('/', 1)[-1] for s in specs)} → cita «spec NNN» en el asunto si el commit la cierra.")
    if any("/supabase/migrations/" in a for a in archivos):
        print("\nTrae una migración: di en el cuerpo si ya está aplicada y dónde (o que falta aplicarla).")
    if any(re.search(r"AgentTurnService|conscious-brain|Protocol\.cs|TurnProtocol\.kt|Protocol\.swift", a) for a in archivos):
        print("\nToca la forma del turno: /contrato-cliente antes de commitear.")

    malos = [a for a in archivos if re.search(r"(^|/)\.env($|\.)|\.jks$|\.keystore$|apikey\.properties$|(^|/)(bin|obj|out|node_modules|\.next|build)/|\.(exe|dll|nupkg|apk|zip)$", a) and not a.endswith(".env.example")]
    if malos:
        print("\n✘ Esto no debería ir en el commit (el repo es público, o es un artefacto):")
        for a in malos:
            print(f"  - {a}")
        print("  git restore --staged <archivo>")
    print()


if __name__ == "__main__":
    main()
