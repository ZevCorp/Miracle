#!/usr/bin/env python3
"""numera — el siguiente número libre de spec y de promesas, mirando TODAS las ramas, no solo la tuya.

    python3 .claude/skills/numera/scripts/numera.py <windows|android|mac|graph> [--sin-fetch] [--bloque N]

Por qué existe (2026-10-01): los números se elegían a mano mirando main, y main no ve las ramas
vivas. Así nacieron dos specs 005, dos 027 en Windows, dos 007 en Android y las promesas 335-345
registradas dos veces en Contrato.cs. La spec 075 tuvo que escribir a mano qué bloques tenían
«otras ramas sin mergear». Este script mira main, cada rama remota y cada rama local, y lo dice.

No escribe nada: propone. La reserva se escribe en el contrato o en la spec, a mano.
"""
import re
import subprocess
import sys
from collections import defaultdict

PROYECTOS = {
    "windows": "apps/windows",
    "android": "apps/android",
    "mac": "apps/mac",
    "graph": "services/graph",
}
# En Windows la numeración es continua y la comparten el núcleo y «Ü desde cero» (spec 052, 430-441).
# La voz tiene su propio contrato, numerado aparte desde 1.
WIN_GLOBAL = ["apps/windows/tests/ContratoDelGrafo/Contrato.cs", "apps/windows/u/Contrato/Contrato.cs"]
WIN_VOZ = ["apps/windows/voz/Contrato/Contrato.cs"]
RE_PRUEBA = re.compile(r'(?:Prueba\("|Promesa\()(\d+)[.,]')
RE_RESERVA = re.compile(r"//\s*(\d+)\s*[-–]\s*(\d+)\s+reservad", re.IGNORECASE)
RE_SPEC = re.compile(r"(?:^|/)(\d{3})-[^/]+\.md$")
RE_FILA = re.compile(r"^\|\s*(~~)?\s*(\d+)\s*(~~)?\s*\|")
# Solo cuentan las filas de la tabla de promesas («| # | Promesa |…»): las de fases o diagnóstico
# también empiezan por «| 1 |» y no son promesas.
RE_CABECERA = re.compile(r"^\|\s*#\s*\|\s*Promesa\b", re.IGNORECASE)


def git(*args, ok=False):
    # core.quotepath=false: sin él git cita los nombres con tildes («007-ü-responde…») y no se reconocen.
    r = subprocess.run(["git", "-c", "core.quotepath=false", *args], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0 and not ok:
        raise SystemExit(f"NO SE PUDO JUZGAR: git {' '.join(args)} → {r.stderr.strip()}")
    return r.stdout if r.returncode == 0 else ""


def refs():
    """main primero, luego las remotas y las locales. HEAD aparte: puede tener lo tuyo sin empujar."""
    salida = git("for-each-ref", "--format=%(refname:short)", "refs/remotes", "refs/heads")
    todas = [r for r in salida.split() if not r.endswith("/HEAD") and r != "origin"]
    orden = [r for r in ("origin/main", "main") if r in todas]
    orden += sorted(r for r in todas if r not in orden)
    return ["HEAD"] + orden


def mostrar(ref, ruta):
    return git("show", f"{ref}:{ruta}", ok=True)


def specs_en(ref, carpeta):
    # Sin -r: solo lo que cuelga directo de docs/specs. En fuentes/ hay material (p. ej. el audio del
    # que salió la 052) con el mismo prefijo, y no es otra spec.
    nombres = git("ls-tree", "--name-only", ref, "--", f"{carpeta}/docs/specs/", ok=True).split("\n")
    por_numero = defaultdict(list)
    for n in nombres:
        m = RE_SPEC.search(n)
        if m:
            por_numero[int(m.group(1))].append(n.rsplit("/", 1)[-1])
    return por_numero


def filas_en(ref, carpeta, specs):
    """Las filas «| N | …» de las tablas de promesas de cada spec. Las tachadas cuentan: su número no se recicla."""
    por_numero = defaultdict(set)
    for nombres in specs.values():
        for nombre in nombres:
            texto = mostrar(ref, f"{carpeta}/docs/specs/{nombre}")
            en_tabla = False
            for linea in texto.splitlines():
                if RE_CABECERA.match(linea):
                    en_tabla = True
                    continue
                if not linea.startswith("|"):
                    en_tabla = False
                    continue
                m = RE_FILA.match(linea)
                if en_tabla and m:
                    por_numero[int(m.group(2))].add(nombre)
    return por_numero


RE_PRUEBA_TEXTO = re.compile(r'(?:Prueba\("(\d+)\.\s*|Promesa\((\d+),\s*")([^"]{0,60})')


def textos_en(ref, rutas):
    """número → primeras palabras de su enunciado, para saber si dos ramas usan el mismo número para cosas distintas."""
    out = defaultdict(set)
    for ruta in rutas:
        for m in RE_PRUEBA_TEXTO.finditer(mostrar(ref, ruta)):
            out[int(m.group(1) or m.group(2))].add(normal(m.group(3)))
    return out


def normal(t):
    return re.sub(r"[^\w ]", "", t.lower()).strip()[:40]


def pruebas_en(ref, rutas):
    numeros = defaultdict(int)
    reservas = []
    for ruta in rutas:
        texto = mostrar(ref, ruta)
        for m in RE_PRUEBA.finditer(texto):
            numeros[int(m.group(1))] += 1
        for m in RE_RESERVA.finditer(texto):
            reservas.append((int(m.group(1)), int(m.group(2)), ruta.rsplit("/", 1)[-1]))
    return numeros, reservas


def rangos(numeros):
    """[335, 336, 337, 340] → '335-337, 340'"""
    out, ini, prev = [], None, None
    for n in sorted(numeros):
        if ini is None:
            ini = prev = n
        elif n == prev + 1:
            prev = n
        else:
            out.append(f"{ini}-{prev}" if ini != prev else f"{ini}")
            ini = prev = n
    if ini is not None:
        out.append(f"{ini}-{prev}" if ini != prev else f"{ini}")
    return ", ".join(out)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args or args[0] not in PROYECTOS:
        print(__doc__)
        raise SystemExit(2)
    proyecto = args[0]
    carpeta = PROYECTOS[proyecto]
    bloque = 10
    if "--bloque" in sys.argv:
        bloque = int(sys.argv[sys.argv.index("--bloque") + 1])

    raiz = git("rev-parse", "--show-toplevel").strip()
    import os
    os.chdir(raiz)
    if "--sin-fetch" not in sys.argv:
        r = subprocess.run(["git", "fetch", "-q", "--prune", "origin"], capture_output=True, text=True)
        if r.returncode != 0:
            print(f"⚠ git fetch falló ({r.stderr.strip()[:120]}): se juzga con las ramas que ya hay en local.")
    if git("rev-parse", "--is-shallow-repository", ok=True).strip() == "true":
        print("⚠ clon superficial: las ramas que no se han bajado no cuentan. `git fetch --unshallow` para verlas todas.")

    lista = refs()
    print(f"\n# numera · {proyecto} ({carpeta}) · {len(lista)} refs mirados\n")

    # ── specs ────────────────────────────────────────────────────────────────────────────────────
    spec_max_por_ref, dup_specs, spec_ref = {}, {}, {}
    for ref in lista:
        specs = specs_en(ref, carpeta)
        spec_ref[ref] = specs
        if specs:
            spec_max_por_ref[ref] = max(specs)
        for n, nombres in specs.items():
            if len(set(nombres)) > 1:
                dup_specs[n] = sorted(set(nombres))
    if not spec_max_por_ref:
        print(f"NO SE PUDO JUZGAR: no hay {carpeta}/docs/specs/NNN-*.md en ningún ref")
        raise SystemExit(99)
    tope = max(spec_max_por_ref.values())
    main_ref = "origin/main" if "origin/main" in spec_max_por_ref else lista[1] if len(lista) > 1 else "HEAD"
    print("## Specs")
    print(f"- main va por la **{spec_max_por_ref.get(main_ref, 0):03d}**; el número más alto en cualquier rama es **{tope:03d}**.")
    por_encima = defaultdict(set)
    for ref, specs in spec_ref.items():
        for n, nombres in specs.items():
            if n > spec_max_por_ref.get(main_ref, 0):
                por_encima[n].update(f"{x} ({ref})" for x in nombres)
    for n in sorted(por_encima):
        print(f"  - {n:03d} ya está tomada fuera de main: {', '.join(sorted(por_encima[n]))}")
    siguiente_spec = tope + 1
    archivos_por_numero = defaultdict(lambda: defaultdict(set))
    for ref, specs in spec_ref.items():
        for n, nombres in specs.items():
            for x in nombres:
                archivos_por_numero[n][x].add(ref)
    choques_spec = {n: a for n, a in archivos_por_numero.items() if len(a) > 1 and n not in dup_specs}
    print(f"- **Siguiente spec libre: {siguiente_spec:03d}**")
    if dup_specs:
        print("- ✘ números de spec repetidos (dos archivos con el mismo NNN):")
        for n, nombres in sorted(dup_specs.items()):
            print(f"  - {n:03d}: {', '.join(nombres)}")
    if choques_spec:
        print("- ✘ chocarán al mergear (el mismo NNN con otro archivo en otra rama):")
        for n, archivos in sorted(choques_spec.items()):
            partes = [f"{x} ({', '.join(sorted(r for r in refs_ if r != 'HEAD'))[:80] or 'HEAD'})" for x, refs_ in sorted(archivos.items())]
            print(f"  - {n:03d}: " + " · ".join(partes))

    # ── promesas ─────────────────────────────────────────────────────────────────────────────────
    print("\n## Promesas")
    if proyecto == "windows":
        usados, reservas_todas, dobles = defaultdict(set), [], {}
        main_max = 0
        for ref in lista:
            numeros, reservas = pruebas_en(ref, WIN_GLOBAL)
            for n in numeros:
                usados[n].add(ref)
            if ref == main_ref and numeros:
                main_max = max(numeros)
            if ref in ("HEAD", main_ref):
                for n, veces in numeros.items():
                    if veces > 1:
                        dobles[n] = veces
            reservas_todas += [(a, b, ref) for a, b, _ in reservas]
        tope_usado = max(usados) if usados else 0
        tope_reservado = max((b for _, b, _ in reservas_todas), default=0)
        print(f"- main va por la **{main_max}**; la más alta en cualquier rama es **{tope_usado}**.")
        fuera = {n: refs_ for n, refs_ in usados.items() if n > main_max}
        if fuera:
            por_rama = defaultdict(list)
            for n, rs in fuera.items():
                for r in rs:
                    if r not in (main_ref, "main"):
                        por_rama[r].append(n)
            for r, ns in sorted(por_rama.items()):
                print(f"  - {r}: {rangos(ns)}")
        vistas = sorted(set((a, b) for a, b, _ in reservas_todas))
        if vistas:
            print("- Reservas escritas en el contrato (comentario «NNN-MMM reservadas»): " + ", ".join(f"{a}-{b}" for a, b in vistas))
        inicio = max(tope_usado, tope_reservado) + 1
        inicio = ((inicio + 9) // 10) * 10  # bloques redondos: se leen y se reservan mejor
        print(f"- **Siguiente bloque libre: {inicio}-{inicio + bloque - 1}**")
        print(f"  Reserva sugerida, encima de su banner en Contrato.cs:")
        import datetime
        hoy = datetime.date.today().isoformat()
        print(f"  // {inicio}-{inicio + bloque - 1} reservadas el {hoy} para la spec {siguiente_spec:03d}: main va por la {main_max} y hay ramas vivas hasta la {tope_usado}.")
        if dobles:
            print(f"- ✘ números registrados dos veces en el contrato: {rangos(dobles)}")
            print("  Una promesa con dos cuerpos da un verde que no dice cuál se juzgó. Renumera la más nueva.")
        en_main = textos_en(main_ref, WIN_GLOBAL)
        choques = defaultdict(list)
        for ref in lista:
            if ref in (main_ref, "main", "HEAD"):
                continue
            # Un número choca si la rama lo usa con un texto que main no tiene para ese número. Una rama
            # que solo va atrasada trae textos que main también tiene, y no cuenta.
            for n, ts in textos_en(ref, WIN_GLOBAL).items():
                if n in en_main and any(t and not any(t[:20] == m[:20] for m in en_main[n]) for t in ts):
                    choques[ref].append(n)
        if choques:
            print("- ✘ ramas que usan números que en main ya son de otra promesa (chocarán al mergear):")
            for ref, ns in sorted(choques.items()):
                print(f"  - {ref}: {rangos(ns)}")
        # la voz, aparte
        voz_main, _ = pruebas_en(main_ref, WIN_VOZ)
        voz_dobles = [n for n, v in voz_main.items() if v > 1]
        if voz_dobles:
            print(f"- ✘ en el contrato de la voz, números registrados dos veces: {rangos(voz_dobles)}")
        voz_todas = defaultdict(set)
        for ref in lista:
            ns, _ = pruebas_en(ref, WIN_VOZ)
            for n in ns:
                voz_todas[n].add(ref)
        if voz_todas:
            print(f"- La voz (voz/Contrato, numeración propia): main va por la {max(voz_main) if voz_main else 0}, "
                  f"la más alta en cualquier rama es la {max(voz_todas)} → siguiente: **{max(voz_todas) + 1}**")
    else:
        desde = siguiente_spec * 100 + 1
        hasta = siguiente_spec * 100 + 99
        ocupadas = defaultdict(set)
        repetidas = {}
        for ref in lista:
            filas = filas_en(ref, carpeta, spec_ref[ref])
            for n, specs in filas.items():
                ocupadas[n].update(f"{s} ({ref})" for s in specs)
                if len(specs) > 1 and ref in ("HEAD", main_ref):
                    repetidas[n] = sorted(specs)
        choque = [n for n in ocupadas if desde <= n <= hasta]
        print(f"- La spec {siguiente_spec:03d} numera desde **{desde}** (NNN×100+1) hasta {hasta}.")
        if choque:
            print(f"  ✘ pero ya hay filas en ese bloque: {rangos(choque)} → {', '.join(sorted(set().union(*(ocupadas[n] for n in choque))))}")
        else:
            print(f"  Libre en todas las ramas miradas.")
        if repetidas:
            print("- ✘ promesas que están en dos specs (el juez sale con 99):")
            for n, specs in sorted(repetidas.items()):
                print(f"  - {n}: {', '.join(specs)}")
        if proyecto == "mac":
            print("- En Mac, cada promesa nueva toca tres sitios: la función test…, su llamada en "
                  "ContractRunner.swift (y el número de su línea PASS) y la fila de la spec.")
    print()


if __name__ == "__main__":
    main()
