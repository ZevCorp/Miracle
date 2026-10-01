#!/usr/bin/env python3
"""tablero — en qué va cada spec de cada proyecto, y qué está raro, leído de los archivos (no de memoria).

    python3 .claude/skills/tablero/scripts/tablero.py [windows|android|mac|graph ...] [--dias N] [--todas] [--json]

Por spec: número, título, estado (la línea «Estado:» de su cabecera), cuántas promesas tiene su tabla
(y cuántas tachadas), las casillas del Cierre marcadas, y la fecha de su último commit.

Lo raro, que es para lo que sirve:
  - dos specs con el mismo número;
  - una spec sin línea «Estado:», o con el de la plantilla sin rellenar;
  - «propuesto» y sin tocar hace más de N días (por defecto 14): ¿sigue viva o se abandona?;
  - «implementado» con casillas del Cierre sin marcar;
  - una spec numerada sin tabla de promesas.

Sin --todas, solo lista las abiertas y las raras; las implementadas en orden se cuentan.
"""
import datetime
import glob
import json
import unicodedata
import os
import re
import subprocess
import sys
from collections import defaultdict

PROYECTOS = {"windows": "apps/windows", "android": "apps/android", "mac": "apps/mac", "graph": "services/graph"}
RE_SPEC = re.compile(r"^(\d{3})-(.+)\.md$")
RE_CABECERA = re.compile(r"^\|\s*#\s*\|\s*Promesa\b", re.I)
RE_FILA = re.compile(r"^\|\s*(~~)?\s*(\d+)\s*(~~)?\s*\|")
RE_ESTADO = re.compile(r"^\s*\**Estado\**\s*:\s*(.+)$", re.I)
CERRADOS = ("implementad", "cerrad", "hecho", "terminad", "mergead", "verde")
ABIERTOS = ("propuest", "en curso", "en marcha", "construcci", "borrador", "fase", "rojo")
RE_FECHA = re.compile(r"\b(20\d\d-\d\d-\d\d)\b")


def git(*args):
    r = subprocess.run(["git", "-c", "core.quotepath=false", *args], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    return r.stdout if r.returncode == 0 else ""


def fechas_de(carpeta):
    """La fecha del último commit de cada archivo de specs, en una sola llamada a git."""
    salida = git("log", "--format=@%cs", "--name-only", "--", f"{carpeta}/docs/specs")
    fechas, actual = {}, None
    for linea in salida.splitlines():
        if linea.startswith("@"):
            actual = linea[1:]
        elif linea.strip() and actual:
            fechas.setdefault(linea.strip(), actual)
    return fechas


def leer_spec(ruta):
    with open(ruta, encoding="utf-8", errors="replace") as f:
        texto = f.read()
    lineas = texto.splitlines()
    titulo = next((l.lstrip("# ").strip() for l in lineas if l.startswith("# ")), "")
    titulo = re.sub(r"^(Plan de implementación|Spec \d+|\d{3})\s*[:—-]\s*", "", titulo)
    estado = ""
    for l in lineas[:15]:
        m = RE_ESTADO.match(l)
        if m:
            estado = m.group(1).strip()
            break
    promesas = tachadas = 0
    numeros, filas = [], []
    en_tabla = False
    for l in lineas:
        if RE_CABECERA.match(l):
            en_tabla = True
            continue
        if not l.startswith("|"):
            en_tabla = False
            continue
        m = RE_FILA.match(l)
        if en_tabla and m:
            promesas += 1
            numeros.append(int(m.group(2)))
            celdas = [c.strip() for c in l.strip().strip("|").split("|")]
            filas.append((int(m.group(2)), celdas[1] if len(celdas) > 1 else "", bool(m.group(1))))
            if m.group(1):
                tachadas += 1
    # Las casillas del Cierre: desde un título que diga «Cierre» hasta el siguiente título del mismo nivel o mayor.
    marcadas = sin_marcar = 0
    dentro, nivel = False, 0
    for l in lineas:
        t = re.match(r"^(#+)\s+(.*)", l)
        if t:
            if dentro and len(t.group(1)) <= nivel:
                dentro = False
            if re.search(r"\bcierre\b", t.group(2), re.I):
                dentro, nivel = True, len(t.group(1))
            continue
        if dentro:
            if re.match(r"^\s*[-*]\s+\[[xX]\]", l):
                marcadas += 1
            elif re.match(r"^\s*[-*]\s+\[\s\]", l):
                sin_marcar += 1
    # La fecha que declara la cabecera («Nace del diagnóstico del …», «implementado (…)»): el traslado
    # al monorepo (2026-09-28) tocó todos los archivos, así que la de git no dice cuándo se propuso.
    declaradas = RE_FECHA.findall(" ".join(lineas[:6]))
    return {
        "declarada": max(declaradas) if declaradas else "",
        "titulo": titulo, "estado": estado, "promesas": promesas, "tachadas": tachadas, "filas": filas,
        "rango": f"{min(numeros)}-{max(numeros)}" if numeros else "", "cierre": (marcadas, sin_marcar),
    }


def normal(t):
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]", "", re.sub(r"[`*_~«»\"']", "", t)).strip()


def contrato_de(nombre, carpeta):
    """Número de promesa → los textos con que el contrato la juzga hoy (árbol de trabajo)."""
    patrones = {
        "windows": [("tests/ContratoDelGrafo/Contrato.cs", r'Prueba\("(\d+)\.\s*([^"]+)"'),
                    ("u/Contrato/Contrato.cs", r'Promesa\((\d+),\s*"([^"]+)"')],
        "graph": [("scripts/verify-*.js", r"promesa\((\d+),\s*['\"`]([^'\"`]+)")],
        "android": [("core/src/*Test/kotlin/graph/core/contrato/*.kt", r'(\d+)\s+to\s+"([^"]+)"')],
    }.get(nombre)
    if not patrones:
        return None
    out = defaultdict(set)
    for patron_archivo, rx in patrones:
        for ruta in glob.glob(f"{carpeta}/{patron_archivo}"):
            with open(ruta, encoding="utf-8", errors="replace") as f:
                for m in re.finditer(rx, f.read()):
                    out[int(m.group(1))].add(normal(m.group(2)))
    return out


def cruce(filas, contrato):
    """(con su texto, número de otra promesa, ausentes) entre las filas vivas de una spec y el contrato."""
    igual = otra = falta = 0
    for n, texto, tachada in filas:
        if tachada:
            continue
        t = normal(texto)[:22]
        if n not in contrato:
            falta += 1
        elif any(c[:22] == t or c.startswith(t[:16]) or t.startswith(c[:16]) for c in contrato[n]):
            igual += 1
        else:
            otra += 1
    return igual, otra, falta


def clasificar(estado):
    # Manda lo que está en negrita («**propuesto**»): el resto de la línea suele narrar historia
    # («…promesas verdes en la fase 1»), y leída entera confunde abierta con cerrada.
    m = re.search(r"\*\*(.+?)\*\*", estado)
    e = (m.group(1) if m else estado).lower()
    if not e:
        return "sin estado"
    if "<aaaa" in e or "<persona>" in e:
        return "plantilla sin rellenar"
    if any(c in e for c in CERRADOS) and "propuest" not in e:
        return "cerrada"
    if any(a in e for a in ABIERTOS):
        return "abierta"
    return "abierta"


def corto(estado):
    m = re.search(r"\*\*(.+?)\*\*", estado)
    base = m.group(1) if m else estado
    return base[:40]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dias = 14
    if "--dias" in sys.argv:
        dias = int(sys.argv[sys.argv.index("--dias") + 1])
        args = [a for a in args if a != str(dias)]
    elegidos = args or list(PROYECTOS)
    raiz = git("rev-parse", "--show-toplevel").strip() or "."
    os.chdir(raiz)
    hoy = datetime.date.today()
    todo = {}

    for nombre in elegidos:
        carpeta = PROYECTOS[nombre]
        dir_specs = f"{carpeta}/docs/specs"
        if not os.path.isdir(dir_specs):
            continue
        fechas = fechas_de(carpeta)
        contrato = contrato_de(nombre, carpeta)
        specs, por_numero = [], defaultdict(list)
        for archivo in sorted(os.listdir(dir_specs)):
            m = RE_SPEC.match(archivo)
            if not m:
                continue
            ruta = f"{dir_specs}/{archivo}"
            d = leer_spec(ruta)
            d["numero"], d["archivo"] = m.group(1), archivo
            d["fecha"] = fechas.get(ruta, "sin commit")
            d["clase"] = "cerrada" if d["numero"] == "000" else clasificar(d["estado"])
            raros = []
            # La 000 es el inventario de lo heredado: no tiene estado porque no se implementa.
            if d["clase"] in ("sin estado", "plantilla sin rellenar") and d["numero"] != "000":
                raros.append(d["clase"])
            referencia = d["declarada"] or (d["fecha"] if d["fecha"] != "sin commit" else "")
            if d["clase"] == "abierta" and referencia:
                edad = (hoy - datetime.date.fromisoformat(referencia)).days
                if edad > dias:
                    raros.append(f"abierta desde hace {edad} días ({'su cabecera' if d['declarada'] else 'git'})")
            if d["clase"] == "cerrada" and d["cierre"][1]:
                raros.append(f"cerrada con {d['cierre'][1]} casilla(s) del Cierre sin marcar")
            # Lo que la cabecera dice que falta, aunque la marque como cerrada («implementado, nivel 4 a mano pendiente»).
            if d["clase"] == "cerrada" and re.search(r"pendiente|falta|sin probar|no se prob|no la ha probado|sin medir|a mano", d["estado"], re.I):
                raros.append("cerrada, pero su estado dice que falta algo")
            d["cruce"] = None
            if contrato is not None and d["filas"] and d["numero"] != "000":
                igual, otra, falta = cruce(d["filas"], contrato)
                d["cruce"] = (igual, otra, falta)
                vivas = igual + otra + falta
                if d["clase"] != "cerrada" and vivas and igual == vivas:
                    raros.append(f"sus {vivas} promesas ya están en el contrato con su texto: ¿actualizar el estado?")
                if d["clase"] != "cerrada" and otra:
                    raros.append(f"{otra} de sus números ya son de OTRAS promesas en el contrato: renumerar antes de empezar")
            if d["promesas"] == 0 and d["numero"] != "000" and d["clase"] != "cerrada":
                raros.append("sin tabla «| # | Promesa |»")
            d["raros"] = raros
            specs.append(d)
            por_numero[d["numero"]].append(archivo)
        for n, archivos in por_numero.items():
            if len(archivos) > 1:
                for d in specs:
                    if d["numero"] == n:
                        d["raros"].insert(0, f"número repetido ({len(archivos)} specs con el {n})")
        todo[nombre] = specs

    if "--json" in sys.argv:
        print(json.dumps(todo, ensure_ascii=False, indent=2))
        return

    print(f"# Tablero de specs · {hoy.isoformat()}\n")
    print("| Proyecto | Specs | Abiertas | Cerradas | Con algo raro | Promesas en tablas |")
    print("|---|---|---|---|---|---|")
    for nombre, specs in todo.items():
        ab = sum(1 for d in specs if d["clase"] == "abierta")
        ce = sum(1 for d in specs if d["clase"] == "cerrada")
        ra = sum(1 for d in specs if d["raros"])
        pr = sum(d["promesas"] - d["tachadas"] for d in specs)
        print(f"| {nombre} | {len(specs)} | {ab} | {ce} | {ra} | {pr} |")

    for nombre, specs in todo.items():
        filas = [d for d in specs if "--todas" in sys.argv or d["clase"] != "cerrada" or d["raros"]]
        if not filas:
            continue
        print(f"\n## {nombre} ({PROYECTOS[nombre]}/docs/specs)\n")
        print("| Spec | Estado | Promesas | En el contrato | Cierre | Último commit | Lo raro |")
        print("|---|---|---|---|---|---|---|")
        for d in sorted(filas, key=lambda x: x["numero"], reverse=True):
            pr = f"{d['promesas']}" + (f" ({d['tachadas']} tachadas)" if d["tachadas"] else "") + (f" · {d['rango']}" if d["rango"] else "")
            ci = f"{d['cierre'][0]}/{sum(d['cierre'])}" if sum(d["cierre"]) else "—"
            cz = d.get("cruce")
            en_contrato = "—" if not cz else f"{cz[0]}/{sum(cz)}" + (f" ({cz[1]} de otra)" if cz[1] else "")
            print(f"| {d['numero']} {d['titulo'][:60]} | {corto(d['estado']) or '—'} | {pr} | {en_contrato} | {ci} | {d['fecha']} | {'; '.join(d['raros']) or ''} |")
    print("\nAbiertas = el estado dice propuesto/en curso/fase…; cerradas = implementado/cerrado/verde.")
    print("En el contrato = filas vivas de la spec cuyo número está en el contrato con el mismo texto (Windows, Graph, Android; Mac no).")
    print(f"«Abierta desde hace» cuenta desde la fecha más reciente que declara su cabecera, o si no tiene, desde su último commit; umbral: {dias} días (--dias N).")


if __name__ == "__main__":
    main()
