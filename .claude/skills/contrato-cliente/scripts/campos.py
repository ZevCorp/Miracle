#!/usr/bin/env python3
"""campos — compara, campo por campo, lo que Graph manda y lee en el turno del agente
(POST /api/v1/agent/turn) con lo que leen y mandan los tres clientes: Windows, Android y Mac.

    python3 .claude/skills/contrato-cliente/scripts/campos.py [--ref <git-ref>]

Con --ref, lee los archivos de ese ref (p. ej. origin/main) en vez del árbol de trabajo: sirve para
ver si TU rama cambió la forma respecto a main.

Lo que dice, por estructura (respuesta, petición, estado de pantalla, acción):
  - ✘ un cliente LEE un campo que Graph nunca manda: ese dato llega siempre vacío (deriva silenciosa);
  - ✘ Graph LEE un campo que un cliente nunca manda: esa función no funciona en ese cliente;
  - · un cliente MANDA un campo que Graph no lee: peso muerto, o una función a medio hacer;
  - · Graph MANDA un campo que un cliente no lee: normal si es de otra plataforma; dilo.

Cómo los saca (es lectura de código, no ejecución: lo dudoso se marca):
  - Graph, respuesta: las claves de los objetos «const turn = {…}» de conscious-brain/*.js, más
    «session» y «error» que añade AgentTurnService.js.
  - Graph, petición: los «body.x» y «state.x» que lee AgentTurnService.js; acción: las claves de los
    «actions.push({…})» de conscious-brain/*.js.
  - Windows: [JsonPropertyName("x")] de Protocol.cs; Android: las «val x» de TurnProtocol.kt;
    Mac: las «var x» o los CodingKeys de Protocol.swift.
"""
import re
import subprocess
import sys

G = "services/graph/src"
ARCHIVOS = {
    "graph_turno": f"{G}/application/use-cases/AgentTurnService.js",
    "graph_openai": f"{G}/infrastructure/conscious-brain/openaiBrain.js",
    "graph_gemini": f"{G}/infrastructure/conscious-brain/geminiBrain.js",
    "windows": "apps/windows/windows-client/src/Domain/Protocol.cs",
    "android": "apps/android/core/src/commonMain/kotlin/graph/core/graph/TurnProtocol.kt",
    "mac": "apps/mac/Sources/UCore/Protocol.swift",
}
# Nombre de cada estructura en cada cliente.
CLASES = {
    "respuesta": {"windows": "TurnResponse", "android": "TurnResponse", "mac": "TurnResponse"},
    "petición": {"windows": "TurnRequest", "android": "TurnRequest", "mac": "TurnRequest"},
    "estado de pantalla": {"windows": "ScreenState", "android": "TurnScreenState", "mac": "ScreenState"},
    "acción": {"windows": "AgentAction", "android": "TurnAction", "mac": "AgentAction"},
}


def leer(ruta, ref):
    if ref:
        r = subprocess.run(["git", "show", f"{ref}:{ruta}"], capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode != 0:
            raise SystemExit(f"NO SE PUDO COMPARAR: no está {ruta} en {ref}")
        return r.stdout
    try:
        with open(ruta, encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise SystemExit(f"NO SE PUDO COMPARAR: no está {ruta}. ¿Se movió? Actualiza ARCHIVOS en este script.")


def bloque(texto, inicio_re):
    """El cuerpo entre llaves (o paréntesis, en Kotlin) que sigue al primer acierto de inicio_re."""
    m = re.search(inicio_re, texto)
    if not m:
        return None
    i = m.end()
    while i < len(texto) and texto[i] not in "{(":
        i += 1
    if i >= len(texto):
        return None
    abre = texto[i]
    cierra = "}" if abre == "{" else ")"
    nivel, j = 0, i
    while j < len(texto):
        if texto[j] == abre:
            nivel += 1
        elif texto[j] == cierra:
            nivel -= 1
            if nivel == 0:
                return texto[i + 1: j]
        j += 1
    return None


def claves_de_objeto(cuerpo):
    """Las claves de primer nivel de un literal de objeto JS («a, b: x, c»)."""
    claves, nivel, actual = set(), 0, ""
    for ch in cuerpo + ",":
        if ch in "{[(":
            nivel += 1
        elif ch in "}])":
            nivel -= 1
        if ch == "," and nivel == 0:
            t = actual.strip()
            if t.startswith("..."):
                claves.add(f"…{t[3:].strip()}")
            else:
                m = re.match(r"^['\"]?([A-Za-z_]\w*)['\"]?\s*(?::|$)", t)
                if m:
                    claves.add(m.group(1))
            actual = ""
        else:
            actual += ch
    return claves


def graph():
    turno = leer(ARCHIVOS["graph_turno"], REF)
    cerebros = leer(ARCHIVOS["graph_openai"], REF) + "\n" + leer(ARCHIVOS["graph_gemini"], REF)
    # Lo que se lee de la petición puede vivir en cualquier archivo del cerebro (prompt.js lee
    # state.uiContext): para las lecturas se mira la carpeta entera.
    carpeta = f"{G}/infrastructure/conscious-brain"
    if REF:
        nombres = subprocess.run(["git", "ls-tree", "--name-only", f"{REF}:{carpeta}"], capture_output=True, text=True).stdout.split()
    else:
        import os
        nombres = sorted(os.listdir(carpeta)) if os.path.isdir(carpeta) else []
    todo_el_cerebro = "\n".join(leer(f"{carpeta}/{n}", REF) for n in nombres if n.endswith(".js"))
    resp = set()
    for m in re.finditer(r"const\s+turn\s*=\s*\{", cerebros):
        cuerpo = bloque(cerebros[m.start():], r"const\s+turn\s*=")
        resp |= {c for c in claves_de_objeto(cuerpo) if not c.startswith("…")}
    # Lo que el turno añade al responder: las claves de cada «json: {…}» de AgentTurnService (session,
    # error, y cualquier campo nuevo puesto ahí en vez de en el cerebro). El «...turn» ya está contado.
    for m in re.finditer(r"json:\s*\{", turno):
        cuerpo = bloque(turno[m.start():], r"json:\s*")
        resp |= {c for c in claves_de_objeto(cuerpo or "") if not c.startswith("…")}
    peticion = set(re.findall(r"\bbody\.(\w+)", turno))
    estado = set(re.findall(r"\b(?:state|body\.state)\.(\w+)", turno)) - {"state"}
    # Lo que lee el cerebro de la petición también cuenta (pasa por el turno como argumento).
    estado |= set(re.findall(r"\bstate\.(\w+)", todo_el_cerebro))
    # (los «body.x» del cerebro son respuestas de OpenAI/Gemini, no la petición del cliente: no se cuentan)
    accion = set()
    for m in re.finditer(r"actions\.push\(\s*\{", cerebros):
        cuerpo = bloque(cerebros[m.start():], r"actions\.push\(\s*")
        accion |= {c for c in claves_de_objeto(cuerpo) if not c.startswith("…")}
    # «action.args = {…}» que el turno inyecta (workflow_id) y las acciones que el cerebro arma con mapAction.
    if re.search(r"action\.args\s*=", turno):
        accion.add("args")
    for m in re.finditer(r"return\s*\{\s*kind\s*:", cerebros):
        cuerpo = bloque(cerebros[m.start():], r"return\s*")
        accion |= {c for c in claves_de_objeto(cuerpo) if not c.startswith("…")}
    return {"respuesta": resp, "petición": peticion, "estado de pantalla": estado, "acción": accion}


def windows(clase):
    texto = leer(ARCHIVOS["windows"], REF)
    cuerpo = bloque(texto, rf"class\s+{clase}\b")
    return set(re.findall(r'JsonPropertyName\("(\w+)"\)', cuerpo or ""))


def android(clase):
    texto = leer(ARCHIVOS["android"], REF)
    cuerpo = bloque(texto, rf"class\s+{clase}\s*")
    if cuerpo is None:
        return set()
    nombres = set()
    for m in re.finditer(r"(?:@SerialName\(\"(\w+)\"\)\s*)?\bva[lr]\s+(\w+)\s*:", cuerpo):
        nombres.add(m.group(1) or m.group(2))
    return nombres


def mac(clase):
    texto = leer(ARCHIVOS["mac"], REF)
    cuerpo = bloque(texto, rf"struct\s+{clase}\b[^{{]*")
    if cuerpo is None:
        return set()
    ck = re.search(r"enum\s+CodingKeys[^{]*\{([^}]*)\}", cuerpo)
    if ck:
        return set(re.findall(r"\b(\w+)\b", ck.group(1).replace("case", " "))) - {"String", "CodingKey"}
    nombres = set()
    for linea in cuerpo.splitlines():
        if re.match(r"^\s*(?:public\s+)?(?:static|func|init|enum|struct)\b", linea):
            continue
        m = re.match(r"^\s*(?:public\s+|private\s+|internal\s+)?(?:var|let)\s+(.+)$", linea)
        if m:
            # «public var x: Double?, y: Double?» declara varios en una línea; «var platform = "macos"»,
            # uno sin tipo escrito (2026-10-01: ese no se veía).
            decl = re.sub(r"\[[^\]]*\]", "", m.group(1))       # «[String: String]» no son campos
            decl = re.sub(r"\{.*$", "", decl)                    # un cuerpo computado no
            for trozo in re.split(r",(?![^(]*\))", decl.split("=")[0] if ":" in decl.split("=")[0] else decl):
                n = re.match(r"\s*(\w+)", trozo)
                if n and n.group(1) not in ("static", "lazy", "weak"):
                    nombres.add(n.group(1))
    return nombres


def main():
    global REF
    REF = sys.argv[sys.argv.index("--ref") + 1] if "--ref" in sys.argv else None
    import os
    raiz = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True).stdout.strip()
    if raiz:
        os.chdir(raiz)
    g = graph()
    print(f"\n# El turno del agente, campo por campo{' · ' + REF if REF else ''}\n")
    graves = 0
    for estructura, clases in CLASES.items():
        lado_graph = g[estructura]
        # Quién manda y quién lee, según la dirección del mensaje.
        graph_manda = estructura in ("respuesta", "acción")
        clientes = {"windows": windows(clases["windows"]), "android": android(clases["android"]), "mac": mac(clases["mac"])}
        todos = sorted(lado_graph.union(*clientes.values()))
        print(f"## {estructura} ({'Graph → clientes' if graph_manda else 'clientes → Graph'})\n")
        print("| Campo | Graph | Windows | Android | Mac |")
        print("|---|---|---|---|---|")
        for campo in todos:
            fila = ["✔" if campo in lado_graph else "—"] + ["✔" if campo in clientes[c] else "—" for c in ("windows", "android", "mac")]
            print(f"| `{campo}` | " + " | ".join(fila) + " |")
        print()
        for c, campos in clientes.items():
            if not campos:
                print(f"- ⚠ no encontré `{clases[c]}` en {ARCHIVOS[c]}: ¿cambió de nombre? (no se compara)")
                continue
            if graph_manda:
                lee_y_no_llega = sorted(campos - lado_graph)
                if lee_y_no_llega:
                    graves += len(lee_y_no_llega)
                    print(f"- ✘ {c} lee {', '.join(f'`{x}`' for x in lee_y_no_llega)}, que Graph nunca manda: le llega siempre vacío")
                ignora = sorted(lado_graph - campos)
                if ignora:
                    print(f"- · {c} no lee {', '.join(f'`{x}`' for x in ignora)}")
            else:
                no_lo_manda = sorted(lado_graph - campos)
                if no_lo_manda:
                    graves += len(no_lo_manda)
                    print(f"- ✘ Graph lee {', '.join(f'`{x}`' for x in no_lo_manda)}, que {c} nunca manda: esa función no le llega a {c}")
                sobra = sorted(campos - lado_graph)
                if sobra:
                    print(f"- · {c} manda {', '.join(f'`{x}`' for x in sobra)}, que Graph no lee")
        print()
    print("Es lectura de código: un campo que se arma dinámicamente (spread, Object.assign, mapas) no se ve.")
    print("La forma byte a byte para Windows la juzga la promesa 2 de Graph (scripts/verify-agent-platform.js).")
    sys.exit(min(graves, 98))


REF = None
if __name__ == "__main__":
    main()
