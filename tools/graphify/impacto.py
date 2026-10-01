"""A quién afecta lo que cambia esta rama, según el mapa de graphify de cada proyecto.

    bash tools/graphify/impacto.sh [--base <ref>] [<proyecto>...]

Por qué existe (2026-10-01): medido con agentes, preguntarle al mapa «antes de cada grep» no
ahorraba nada; donde el mapa sí gana es en la pregunta que con grep cuesta una cadena de búsquedas:
quién de fuera depende de lo que toqué.

Lo que mira: los símbolos cuyas LÍNEAS cambiaron (no el archivo entero: tocar un método no afecta a
quien llama a otro del mismo archivo), y quién los llama, referencia o importa desde fuera del
cambio, con el archivo y la línea de la llamada. Los documentos que los citan van aparte.

Salida: 0 si pudo mirar —afecte a alguien o a nadie—, 2 si no pudo (sin mapa, sin base). Un juez
que no puede correr no dice «no afecta a nadie»: dice que no pudo.

Solo biblioteca estándar: corre con cualquier Python 3.8+, también el que trae graphify.
"""

import json
import os
import re
import subprocess
import sys
from collections import defaultdict

# Relaciones que son uso de verdad. Las estructurales (un archivo «contiene» su clase, una clase
# «tiene» su método) no son dependencias de nadie de fuera.
USO = {
    "calls", "references", "imports", "imports_from", "implements", "inherits", "extends",
    "uses", "indirect_call", "dynamic_import", "re_exports", "dispatches_to", "mixes_in",
    "embeds", "requires", "rationale_for",
}
CODIGO = {".cs", ".xaml", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".py", ".kt", ".kts", ".swift",
          ".java", ".go", ".rs", ".ps1", ".sh"}
POR_SIMBOLO = 8      # archivos que se nombran por símbolo; el resto se cuenta
DOCUMENTOS = 8


def git(*args):
    r = subprocess.run(["git", *args], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip()}")
    return r.stdout


def linea(loc):
    m = re.match(r"L?(\d+)", str(loc or ""))
    return int(m.group(1)) if m else None


def es_codigo(archivo):
    return os.path.splitext(archivo)[1].lower() in CODIGO


def es_espacio(n):
    """Un espacio de nombres no es de nadie: lo «importa» medio proyecto."""
    return n.get("type") == "namespace" or "namespace" in str(n.get("metadata", {}).get("kind", ""))


def dentro(ruta, proyecto):
    return ruta[len(proyecto) + 1:] if ruta.startswith(proyecto + "/") else ruta


def tramos_cambiados(base, proyecto):
    """{archivo relativo al proyecto: [(desde, hasta), …]} en el código de HOY, contra la base."""
    salida = git("diff", "-U0", "--no-color", "--no-ext-diff", base, "--", proyecto)
    tramos, actual = defaultdict(list), None
    for l in salida.splitlines():
        if l.startswith("+++ "):
            ruta = l[4:].strip()
            actual = None if ruta == "/dev/null" else dentro(ruta[2:] if ruta.startswith("b/") else ruta, proyecto)
            if actual is not None:
                tramos[actual]  # un archivo cambiado sin tramos (binario) también cuenta
        elif l.startswith("@@") and actual is not None:
            m = re.search(r"\+(\d+)(?:,(\d+))?", l)
            if m:
                desde, n = int(m.group(1)), int(m.group(2) or 1)
                tramos[actual].append((desde, desde + max(n, 1) - 1))
    return tramos


def mirar(raiz, proyecto, base):
    """Devuelve (texto, pudo_mirar). texto None: la rama no cambia código en el proyecto."""
    tramos = tramos_cambiados(base, proyecto)
    # Sin código cambiado no hay a quién afectar, y se dice en una línea: el primer comentario de
    # verdad gastó tres bloques en decir «0 símbolos» de tres proyectos con un .md. Va ANTES de
    # buscar el mapa: para saber que un .md no afecta a nadie no hace falta mapa.
    if not any(es_codigo(a) for a in tramos):
        return None, True

    grafo_ruta = os.path.join(raiz, proyecto, "graphify-out", "graph.json")
    if not os.path.isfile(grafo_ruta):
        return (f"### {proyecto}\n\nNo hay mapa de este proyecto, así que no pude mirar. Créalo con "
                f"`graphify update .` dentro de `{proyecto}` (o `tools/graphify/instalar`).\n"), False

    # Un archivo que nace en la rama no lo usa nadie de fuera todavía: si el mapa dice que sí, es
    # que confundió su nombre con el de otro. El 2026-10-01 una sonda nueva declaraba su propio
    # LogBus y el mapa le colgó 278 llamadas que eran del de verdad.
    nuevos = {dentro(a.strip(), proyecto)
              for a in git("diff", "--name-only", "--diff-filter=A", base, "--", proyecto).splitlines() if a.strip()}

    with open(grafo_ruta, encoding="utf-8") as f:
        g = json.load(f)
    nodos = {n["id"]: n for n in g.get("nodes", [])}
    aristas = g.get("links") or g.get("edges") or []

    # Solo el código cuenta para saber si el mapa es viejo: unas notas tocadas después no cambian
    # quién llama a quién, y un aviso en falso enseña a no creerse el aviso.
    avisos = []
    t_grafo = os.path.getmtime(grafo_ruta)
    viejos = [a for a in tramos
              if es_codigo(a) and os.path.isfile(os.path.join(raiz, proyecto, a))
              and os.path.getmtime(os.path.join(raiz, proyecto, a)) > t_grafo + 1]
    if viejos:
        avisos.append(f"⚠ El mapa es más viejo que el código que juzga ({len(viejos)} archivo(s) cambiaron "
                      f"después, p. ej. `{viejos[0]}`). Rehazlo con `graphify update .` en `{proyecto}`; "
                      "hasta entonces esto puede quedarse corto.")

    # Los símbolos de cada archivo, en orden: cada uno abarca hasta el siguiente.
    por_archivo = defaultdict(list)
    for n in nodos.values():
        if n.get("file_type", "code") == "code" and linea(n.get("source_location")) is not None:
            por_archivo[n.get("source_file", "")].append(n)
    cambiados, sin_simbolos = [], []
    for archivo, rangos in sorted(tramos.items()):
        if archivo in nuevos:
            continue
        simbolos = sorted(por_archivo.get(archivo, []), key=lambda n: linea(n["source_location"]))
        if not simbolos:
            if es_codigo(archivo):
                sin_simbolos.append(archivo)
            continue
        for i, n in enumerate(simbolos):
            desde = linea(n["source_location"])
            hasta = linea(simbolos[i + 1]["source_location"]) - 1 if i + 1 < len(simbolos) else 10 ** 9
            hasta = max(hasta, desde)
            if not es_espacio(n) and (not rangos or any(a <= hasta and b >= desde for a, b in rangos)):
                cambiados.append(n)
    ids = {n["id"] for n in cambiados}
    archivos_cambiados = set(tramos)

    # Dos definiciones con el MISMO nombre completo (espacio de nombres + clase + miembro) en
    # archivos distintos: el mapa resuelve por nombre y le cuelga todos los usos a una sola. El
    # 2026-10-01 el LogBus de verdad tenía CERO usos en el mapa y su copia en una sonda, 348. Leer
    # «no afecta a nadie» ahí es el fallo peligroso, así que se cuentan los usos de las dos y se dice.
    clase_de = {e.get("target"): nodos.get(e.get("source"), {}).get("label", "")
                for e in aristas if e.get("relation") == "method"}

    def nombre_completo(n):
        ns = n.get("metadata", {}).get("namespace")
        return (ns, clase_de.get(n["id"], ""), n.get("label")) if ns and not es_espacio(n) else None

    por_nombre = defaultdict(list)
    for n in nodos.values():
        if n.get("file_type", "code") == "code" and nombre_completo(n):
            por_nombre[nombre_completo(n)].append(n)
    gemelo_de, gemelos = {}, defaultdict(set)   # id de la otra definición -> id cambiado
    for n in cambiados:
        clave = nombre_completo(n)
        for otro in por_nombre.get(clave, []) if clave else []:
            if otro["id"] != n["id"] and otro.get("source_file") != n.get("source_file"):
                gemelo_de[otro["id"]] = n["id"]
                gemelos[n["id"]].add(otro.get("source_file", ""))
    archivos_gemelos = {a for s in gemelos.values() for a in s}

    # Un documento que habla de una clase habla también de sus métodos: si cambia uno, el documento
    # puede haberse quedado viejo. Para el código no se sube: quien llama a OTRO método de la clase
    # no se entera del cambio.
    clases = {e.get("source") for e in aristas if e.get("target") in ids and e.get("relation") == "method"}

    quien = defaultdict(lambda: defaultdict(list))   # id cambiado -> archivo -> [(línea, quién, relación, inferido)]
    docs = defaultdict(set)                          # documento -> {símbolos cambiados que cita}
    # Los que citan la CLASE de un método cambiado van resumidos, una línea por clase: FaceWindow
    # sale en veinte documentos, y veinte líneas por tocarle un método tapaban lo demás.
    docs_de_clase = defaultdict(set)                 # clase -> {documentos que la citan}
    for e in aristas:
        t = gemelo_de.get(e.get("target"), e.get("target"))
        if (t not in ids and t not in clases) or e.get("relation") not in USO:
            continue
        origen = nodos.get(e.get("source"), {})
        archivo = e.get("source_file") or origen.get("source_file", "")
        if archivo in archivos_cambiados or archivo in archivos_gemelos:
            continue
        if origen.get("file_type", "code") != "code":
            etiqueta = nodos.get(t, {}).get("label", t)
            if t in ids:
                docs[archivo].add(etiqueta)
            else:
                docs_de_clase[etiqueta].add(archivo)
            continue
        if t not in ids:
            continue
        ln = linea(e.get("source_location")) or linea(origen.get("source_location")) or 0
        quien[t][archivo].append((ln, origen.get("label", ""), e.get("relation"), e.get("confidence") == "INFERRED"))

    # Indirectos: quién depende de los que dependen, solo contado.
    afectados = {a for por in quien.values() for a in por}
    directos = {e.get("source") for e in aristas
                if gemelo_de.get(e.get("target"), e.get("target")) in ids and e.get("relation") in USO}
    indirectos = set()
    for e in aristas:
        if e.get("target") in directos and e.get("relation") in USO:
            o = nodos.get(e.get("source"), {})
            if o.get("file_type", "code") == "code" and o.get("source_file") not in archivos_cambiados:
                indirectos.add(o.get("source_file"))
    indirectos -= afectados

    for d in docs:                                   # el que ya sale por un símbolo no se repite por su clase
        for citan in docs_de_clase.values():
            citan.discard(d)
    todos_los_docs = set(docs) | {d for citan in docs_de_clase.values() for d in citan}

    out = [f"### {proyecto}", ""]
    out += [a + "\n" for a in avisos]
    out.append(f"{len(cambiados)} símbolo(s) cambiado(s) en {len([a for a in archivos_cambiados - nuevos if es_codigo(a)])} archivo(s) de código que ya "
               f"existían. **{len(afectados)} archivo(s) de código de fuera dependen de ellos**"
               + (f", {len(indirectos)} más a dos saltos" if indirectos else "")
               + (f", y {len(todos_los_docs)} documento(s) los citan." if todos_los_docs else "."))
    out.append("")
    if not quien:
        out.append("Nadie de fuera del cambio llama ni referencia a lo que cambiaste.")
        out.append("")
    for n in sorted(cambiados, key=lambda n: (n.get("source_file", ""), linea(n["source_location"]))):
        por = quien.get(n["id"])
        if not por:
            continue
        usos = sum(len(set(v)) for v in por.values())
        out.append(f"- `{n.get('label')}` ({n.get('source_file')}:{linea(n['source_location'])}) ← "
                   f"{usos} uso(s) en {len(por)} archivo(s)")
        if gemelos.get(n["id"]):
            out.append("  - ⚠ comparte nombre completo con otra definición en "
                       + ", ".join(f"`{a}`" for a in sorted(gemelos[n["id"]]))
                       + ": el mapa no distingue a cuál de las dos se llama, así que van los usos de ambas.")
        for archivo in sorted(por)[:POR_SIMBOLO]:
            lista = sorted(set(por[archivo]))
            mas = "".join(f", `:{u[0]}`" for u in lista[1:6]) + (f" y {len(lista) - 6} más" if len(lista) > 6 else "")
            _, lab, rel, inf = lista[0]
            out.append(f"  - `{archivo}:{lista[0][0]}`{mas} — {lab} ({rel}{', inferido' if inf else ''})")
        if len(por) > POR_SIMBOLO:
            out.append(f"  - … y {len(por) - POR_SIMBOLO} archivo(s) más")
    if nuevos:
        out.append("")
        out.append(f"{len(nuevos)} archivo(s) nuevo(s) quedan fuera: nadie de fuera usa todavía lo que acaba de nacer.")
    if sin_simbolos:
        out.append("")
        out.append("Sin símbolos en el mapa (no se pudo seguir quién los usa): "
                   + ", ".join(f"`{a}`" for a in sin_simbolos[:10])
                   + (f" y {len(sin_simbolos) - 10} más" if len(sin_simbolos) > 10 else ""))
    if todos_los_docs:
        out.append("")
        out.append("**Documentos** que citan lo cambiado (revisa si siguen diciendo la verdad):")
        for d in sorted(docs)[:DOCUMENTOS]:
            out.append(f"- `{d}` — {', '.join(sorted(docs[d])[:4])}")
        if len(docs) > DOCUMENTOS:
            out.append(f"- … y {len(docs) - DOCUMENTOS} más")
        for clase, citan in sorted(docs_de_clase.items()):
            if citan:
                lista = sorted(citan)
                out.append(f"- la clase `{clase}`, de la que cambió algún método, sale en {len(lista)}: "
                           + ", ".join(f"`{d}`" for d in lista[:3])
                           + (f" y {len(lista) - 3} más" if len(lista) > 3 else ""))
    out.append("")
    return "\n".join(out), True


def main(argv):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass
    base, proyectos = "origin/main", []
    i = 0
    while i < len(argv):
        if argv[i] == "--base" and i + 1 < len(argv):
            base = argv[i + 1]; i += 2; continue
        if argv[i] in ("-h", "--help"):
            print(__doc__); return 0
        proyectos.append(argv[i].rstrip("/\\")); i += 1

    try:
        raiz = git("rev-parse", "--show-toplevel").strip()
        os.chdir(raiz)
        mb = git("merge-base", base, "HEAD").strip()
    except RuntimeError as e:
        print(f"No pude mirar: no encuentro la base `{base}` ({e}).")
        return 2

    if not proyectos:
        tocados = git("diff", "--name-only", mb).splitlines()
        proyectos = sorted({"/".join(p.split("/")[:2]) for p in tocados
                            if p.startswith(("apps/", "services/")) and p.count("/") >= 2})
    if not proyectos:
        print("La rama no toca ningún proyecto (apps/*, services/*): no hay a quién afectar.")
        return 0

    print(f"## A quién afecta, según el mapa de graphify (contra `{base}`)\n")
    pudo, sin_codigo = True, []
    for p in proyectos:
        texto, ok = mirar(raiz, p, mb)
        if texto is None:
            sin_codigo.append(p)
        else:
            print(texto)
        pudo = pudo and ok
    if sin_codigo:
        print("La rama no cambia código en " + ", ".join(f"`{p}`" for p in sin_codigo)
              + ": ahí no hay a quién afectar.")
    return 0 if pudo else 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
