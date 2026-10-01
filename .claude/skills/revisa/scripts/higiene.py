#!/usr/bin/env python3
"""higiene — busca en el código las clases de error que este repo ya pagó, y las CUENTA.

    python3 .claude/skills/revisa/scripts/higiene.py                 # lo que tu rama añadió (contra origin/main)
    python3 .claude/skills/revisa/scripts/higiene.py --todo [ruta]   # todo el repo (o una carpeta): cuántos sitios hay
    python3 .claude/skills/revisa/scripts/higiene.py --clase catch-mudo --todo apps/windows --sitios

En modo rama solo mira las LÍNEAS AÑADIDAS (y los archivos nuevos): lo que tú trajiste, no lo heredado.
En modo --todo da el recuento por clase, que es el número que va al commit (patrón nº5: «cuenta los
sitios»). --sitios lista todos; sin él, los 5 primeros de cada clase.

Cada regla dice de dónde sale (patrón nº, aprendizaje nº, spec o commit), para que se pueda discutir
la regla y no el aviso. ✘ = se pagó caro y casi nunca tiene excusa; ⚠ = mírala, puede estar bien.
Es grep con criterio, no un compilador: un ⚠ se decide leyendo el código.

Sale con el número de ✘ en modo rama (máx. 98); en --todo, con 0.
"""
import os
import re
import subprocess
import sys
from collections import defaultdict

# ── las reglas ─────────────────────────────────────────────────────────────────────────────────────
# (clase, severidad, extensiones, regex, por qué, qué hacer, filtro de ruta opcional)
CS, PS, JS, KT, SW, SQL = (".cs",), (".ps1",), (".js", ".mjs", ".cjs", ".ts", ".tsx"), (".kt",), (".swift",), (".sql",)

REGLAS = [
    ("catch-mudo", "✘", CS + JS + KT + SW,
     r"catch\s*(?:\([^)]*\))?\s*\{\s*\}|\.catch\(\s*\(\s*\w*\s*\)\s*=>\s*\{\s*\}\s*\)",
     "patrón nº3: un catch que se traga el motivo convierte un fallo en un misterio",
     "reporta el motivo entero, con su InnerException/cause; si de verdad se ignora, di por qué en el mismo bloque y deja rastro en el log",
     lambda r: not re.search(r"(^|/)(tests?|Tests|sondas|scripts)/|Contrato|\.test\.|Test\.kt$|Tests?\.swift$", r)),
    ("matar-u-por-nombre", "✘", PS + CS + (".sh", ".bat", ".cmd"),
     # Entre la U y la tubería puede haber parámetros (-ErrorAction …): lo que delata es que lo primero
     # después de la tubería sea Stop-Process, sin un Where-Object que filtre por ruta. (2026-10-01: la
     # revisión de prueba lo encontró leyendo; esta regla no lo veía.)
     r"Stop-Process\s+(?:-Name|-ProcessName)\s+[\"']?U[\"']?\b|taskkill\s+/IM\s+U\.exe|GetProcessesByName\(\s*\"U\"\s*\)[^;\n]*\.Kill|Get-Process\s+(?:-Name\s+|-ProcessName\s+)?[\"']?U[\"']?\b[^|\n]*\|\s*Stop-Process",
     "aprendizaje del 2026-09-05: todas las instancias se llaman U, y una es la que el usuario tiene abierta trabajando (pasó dos veces)",
     "ciérrala por ruta: Get-Process U | Where-Object { $_.Path -like \"*\\windows-client\\bin\\*\" } | Stop-Process", None),
    ("voz-paralela", "✘", CS,
     r"VoiceIO\.Speak\s*\(|new\s+SpeechSynthesizer\s*\(|System\.Speech\.Synthesis",
     "regla voz-única: toda salida hablada va por ConversacionEnVivo; VoiceIO queda para el dictado de respaldo",
     "habla por ConversacionEnVivo (abre la sesión y espera «el servidor la confirmó» si está cerrada)",
     lambda r: "/Contrato/" not in r and "ContratoDelGrafo" not in r and not r.endswith("VoiceIO.cs")),
    ("process-start-sin-carpeta", "⚠", CS,
     r"Process\.Start\s*\(|new\s+ProcessStartInfo\b",
     "spec 072: 8 Process.Start sin WorkingDirectory bloqueaban a Velopack (heredaban la carpeta de la app y la dejaban ocupada)",
     "pon WorkingDirectory explícito (una carpeta que no sea la de la app) en su ProcessStartInfo", None),
    ("sap-enlace-temprano", "✘", CS,
     r"using\s+SAPFEWSELib|SAPFEWSELib\.",
     "patrón nº12: COM siempre con enlace tardío; con referencia temprana, otra versión de SAP GUI rompe en tiempo de carga",
     "Type.GetTypeFromProgID(\"SapROTWr.SapROTWrapper\") + dynamic", None),
    ("findbyid-sin-normalizar", "⚠", CS,
     r"\.FindById\s*\(\s*(?![\"$])(?![^)\n]*Normalize)",
     "patrón nº12: los ids de SAP llegan con formas distintas (aprendizaje nº16: comparar identidades de distinta forma es falso siempre, y en silencio)",
     "SapSelector.Normalize(id) en cada FindById", None),
    ("vacio-no-es-ausente", "⚠", CS,
     r"\.(?:Text|Value|Name|Title|Tooltip|Id)\s*\?\?(?!\s*(?:\"\"|string\.Empty|null\b|default\b))",
     "patrón nº9: lo que viene de COM, de la red o de disco llega vacío, no null, y ?? no salta",
     "string.IsNullOrWhiteSpace(x) ? alternativa : x", None),
    ("ruta-anclada-al-repo", "✘", CS + PS + JS + KT + (".sh",),
     r"[\"'`](?:[A-Za-z]:\\{1,2}|/home/|/Users/|~/)[^\"'`\n]*(?:U-Windows-App|Pagina-web-clientes-final|presentacion-ceipa|Graph)[^\"'`\n]*[\"'`]",
     "patrón nº11: la carpeta del clon se llama distinto en cada máquina y en cada árbol de trabajo",
     "resuélvela desde git rev-parse --show-toplevel, desde la ubicación del propio archivo, o por variable (U_REPO)", None),
    ("no-pude-sin-fallo", "✘", CS,
     r"NO PUDE JUZGAR",
     "aprendizaje nº17-18: un juez que no puede juzgar dice «no sé», no «inocente»: si no suma un fallo, la promesa sale verde",
     "_fallos++ junto al aviso (o Pendiente(...)), para que cuente como incumplida", None),
    ("debe-con-dos-afirmaciones", "⚠", CS,
     r"\bDebe\s*\([^,;\"]*&&",
     "skill /promesas: una afirmación por comprobación; dos en un Debe dan un rojo que no dice cuál falló",
     "parte en dos Debe(...), cada uno con su texto en la voz de la promesa", None),
    ("ignore-en-contrato", "✘", KT,
     r"@Ignore\b",
     "Android: un test silenciado del contrato cuenta como roto; retirar una promesa es tacharla en la spec",
     "quita @Ignore; si la promesa se retira, ~~tacha~~ su fila en la spec", lambda r: "/contrato/" in r),
    ("log-con-datos-clinicos", "⚠", JS + KT,
     r"console\.(?:log|info|warn|error|debug)\s*\([^)\n]*\b(?:transcript\w*|transcripci\w*|texto|nota|note|notes|patient\w*|paciente\w*|req\.body|body|prompt|messages|content|apiKey|api_key|token|device_id)\b|Log\.[dviwe]\s*\([^)\n]*\b(?:transcript|texto|prompt|token|apiKey)\b",
     "4 fixes en Graph y 9 en Android: logs con cuerpos, claves o device_id. El texto clínico no sale a un log",
     "loguea metadatos (longitud, ids hasheados, estado), nunca el contenido; en Graph, redactUrlForLog", None),
    ("fetch-sin-plazo", "⚠", JS,
     r"\bfetch\s*\(",
     "portal ae053d6: un fetch sin plazo deja la pantalla esperando para siempre",
     "AbortSignal.timeout(ms) o un AbortController con plazo", lambda r: "/tests/" not in r and "/scripts/" not in r and not r.endswith(".test.ts")),
    ("host-de-ia-directo", "⚠", JS + KT + SW + CS,
     r"api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.deepgram\.com|api\.soniox\.com|openrouter\.ai/api",
     "Graph promesa 13 y portal D21: el texto clínico sale por el escudo; una ruta nueva a un proveedor que no es un transporte conocido lo salta",
     "pasa por LLMProvider (Graph) o callAnthropicJson (portal), o regístrala como excepción con /frontera-ia",
     lambda r: "/scripts/" not in r and "/tests/" not in r and "Test" not in r),
    ("protegido-sin-certificar", "⚠", (".tsx",),
     r"[\"'>`][^\"'<`\n]*\b(?:[Pp]rotegid[oa]s?|[Aa]nonimizad[oa]s?|[Dd]atos\s+cifrados)\b",
     "portal D21 (2026-09-07): la UI decía «protegido» con el redactor apagado desde julio. La UI solo dice lo que el servidor certificó",
     "describePrivacySummary(privacy) + PrivacyShieldBadge", lambda r: "/apps/web/" in "/" + r or r.startswith("apps/web/")),
    ("definer-sin-search-path", "✘", SQL,
     r"security\s+definer(?![^;]{0,400}search_path)",
     "Supabase: una función security definer sin search_path fijo se puede secuestrar con un objeto del mismo nombre",
     "security definer set search_path = '' y nombres calificados (public.tabla)", None),
]

RE_CREATE_TABLE = re.compile(r"create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.\"]+)", re.I)
RE_RLS = re.compile(r"alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([\w.\"]+)\s+enable\s+row\s+level\s+security", re.I)


def git(*args, ok=True):
    r = subprocess.run(["git", "-c", "core.quotepath=false", *args], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    return r.stdout if (r.returncode == 0 or ok) else ""


def lineas_añadidas(base, ruta):
    """Los números de línea nuevos de un archivo, contra base (incluye lo no commiteado)."""
    salida = git("diff", "-U0", base, "--", ruta)
    nuevas = set()
    for m in re.finditer(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@", salida, re.M):
        ini, n = int(m.group(1)), int(m.group(2) or 1)
        nuevas.update(range(ini, ini + n))
    return nuevas


def leer(ruta):
    try:
        with open(ruta, "rb") as f:
            return f.read()
    except OSError:
        return None


def contexto_ok(clase, texto, idx):
    """Reglas que necesitan mirar alrededor del acierto para no gritar en falso."""
    if clase == "process-start-sin-carpeta":
        ventana = texto[max(0, idx - 600): idx + 900]
        return "WorkingDirectory" not in ventana
    if clase == "no-pude-sin-fallo":
        ventana = texto[max(0, idx - 300): idx + 300]
        return "_fallos++" not in ventana and "_fallos +=" not in ventana and "Pendiente(" not in ventana
    if clase == "debe-con-dos-afirmaciones":
        # «Count == 1 && d[0]…» o «x != null && x.Algo» es una guarda para no reventar con un índice,
        # no dos afirmaciones: el rojo sigue diciendo qué falló.
        primero = re.split(r"&&", texto[idx: idx + 300], maxsplit=1)[0]
        return not re.search(r"(Count|Length|Count\(\))\s*[=!<>]=?\s*\d+\s*$|(!=\s*null|is\s+not\s+null|is\s+\w+\s+\w+|\.Any\(\))\s*$", primero.strip())
    if clase == "log-con-datos-clinicos":
        fin = texto.find("\n", idx)
        linea = texto[idx: fin if fin > 0 else len(texto)]
        sin_textos = re.sub(r'"(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|`[^`]*`', '""', linea)
        sin_textos = re.sub(r"\b\w+\.message\b", "", sin_textos)
        return bool(re.search(r"\b(?:transcript\w*|transcripci\w*|texto|nota|note|notes|patient\w*|paciente\w*|req\.body|body|prompt|messages|content|apiKey|api_key|token|device_id)\b", sin_textos))
    if clase == "fetch-sin-plazo":
        ventana = texto[idx: idx + 700]
        return not re.search(r"signal|AbortSignal|timeout|Timeout", ventana)
    return True


def revisar_archivo(ruta, solo_lineas, clases):
    hallazgos = []
    crudo = leer(ruta)
    if crudo is None or b"\x00" in crudo[:4000]:
        return hallazgos
    texto = crudo.decode("utf-8", errors="replace")
    ext = os.path.splitext(ruta)[1].lower()
    inicios = [0] + [m.end() for m in re.finditer("\n", texto)]

    def linea_de(idx):
        lo, hi = 0, len(inicios) - 1
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if inicios[mid] <= idx:
                lo = mid
            else:
                hi = mid - 1
        return lo + 1

    for clase, sev, exts, patron, porque, arreglo, filtro in REGLAS:
        if clases and clase not in clases:
            continue
        if ext not in exts or (filtro and not filtro(ruta)):
            continue
        flags = re.I if ext == ".sql" else 0
        for m in re.finditer(patron, texto, flags | re.S if ext == ".sql" else flags):
            n = linea_de(m.start())
            if solo_lineas is not None and n not in solo_lineas:
                continue
            if not contexto_ok(clase, texto, m.start()):
                continue
            linea = texto[inicios[n - 1]: inicios[n] if n < len(inicios) else len(texto)].strip()
            if linea.startswith(("//", "#", "*", "--", "/*")):
                continue
            hallazgos.append((clase, sev, ruta, n, linea[:140], porque, arreglo))

    # .ps1 con algo que no es ASCII y sin BOM: PowerShell 5.1 lo lee como ANSI (anotado en 9 cabeceras de scripts).
    if ext == ".ps1" and (not clases or "ps1-sin-bom" in clases):
        # Solo importa fuera de los comentarios: una tilde en un comentario sale rota y no rompe nada;
        # en un texto o un patrón («ÍNTEGRA», «✔») cambia lo que el script compara.
        fuera_de_comentarios = [l for l in texto.splitlines() if not l.lstrip().startswith("#")]
        if not crudo.startswith(b"\xef\xbb\xbf") and any(ord(c) > 127 for l in fuera_de_comentarios for c in l):
            if solo_lineas is None or solo_lineas:
                hallazgos.append(("ps1-sin-bom", "✘", ruta, 1, "(el archivo entero)",
                                  "PowerShell 5.1 lee un .ps1 sin BOM como ANSI: las tildes y los ✔ salen rotos (y un ✘ roto escondió 14 sabotajes)",
                                  "guárdalo como UTF-8 con BOM"))

    # Una tabla nueva sin RLS en la misma migración.
    if ext == ".sql" and "supabase/migrations/" in ruta and (not clases or "tabla-sin-rls" in clases):
        creadas = {m.group(1).strip('"').split(".")[-1].lower(): m.start() for m in RE_CREATE_TABLE.finditer(texto)
                   if "temp" not in texto[max(0, m.start() - 20): m.start()].lower()}
        con_rls = {m.group(1).strip('"').split(".")[-1].lower() for m in RE_RLS.finditer(texto)}
        for tabla, idx in creadas.items():
            n = linea_de(idx)
            if tabla not in con_rls and (solo_lineas is None or n in solo_lineas):
                hallazgos.append(("tabla-sin-rls", "✘", ruta, n, f"create table {tabla}",
                                  "Supabase deja las tablas abiertas a anon por defecto: 3 fixes en Graph cerrando lo que quedó abierto",
                                  f"alter table {tabla} enable row level security; y revoke all … from anon (Graph) o sus policies (portal)"))
    return hallazgos


def revisar_repo(archivos_por_version):
    """Lo que solo se ve mirando una carpeta entera: versiones de migración repetidas, specs repetidas."""
    hallazgos = []
    for carpeta in ("services/graph/supabase/migrations", "apps/web/supabase/migrations"):
        if not os.path.isdir(carpeta):
            continue
        por_version = defaultdict(list)
        for f in sorted(os.listdir(carpeta)):
            m = re.match(r"^(\d{14})_", f)
            if m:
                por_version[m.group(1)].append(f)
        for v, fs in por_version.items():
            if len(fs) > 1:
                hallazgos.append(("migracion-version-repetida", "✘", f"{carpeta}/{fs[1]}", 1, " y ".join(fs),
                                  "la CLI de Supabase identifica la migración por su versión: dos con la misma, una no se aplica",
                                  "renombra la más nueva con un timestamp libre (/migracion lo calcula)"))
    return hallazgos


def main():
    argv = sys.argv[1:]
    todo = "--todo" in argv
    sitios = "--sitios" in argv
    clases = set()
    if "--clase" in argv:
        clases = set(argv[argv.index("--clase") + 1].split(","))
    resto = [a for i, a in enumerate(argv) if not a.startswith("--") and (i == 0 or argv[i - 1] != "--clase")]

    raiz = git("rev-parse", "--show-toplevel").strip() or "."
    os.chdir(raiz)

    if todo:
        rutas = resto or ["."]
        archivos = [f for f in git("ls-files", "--", *rutas).splitlines()
                    if "/node_modules/" not in f and "graphify-out/" not in f and "/vendor/" not in f]
        objetivo = {f: None for f in archivos}
        titulo = f"todo lo versionado en {', '.join(rutas)}"
    else:
        base = git("merge-base", "HEAD", "origin/main").strip()
        if not base:
            print("NO SE PUDO REVISAR: no hay origin/main con el que comparar (git fetch origin main), o usa --todo")
            sys.exit(99)
        cambiados = set(git("diff", "--name-only", "--diff-filter=AMR", base).splitlines())
        nuevos = set(git("ls-files", "--others", "--exclude-standard").splitlines())
        objetivo = {}
        for f in sorted(cambiados | nuevos):
            if resto and not any(f.startswith(r.rstrip("/")) for r in resto):
                continue
            objetivo[f] = None if f in nuevos else lineas_añadidas(base, f)
        # Una migración vieja editada: la regla es «una migración nueva no edita una vieja».
        editadas = [f for f in git("diff", "--name-only", "--diff-filter=M", base).splitlines() if "/supabase/migrations/" in f]
        titulo = f"lo que la rama añadió ({len(objetivo)} archivo(s), contra {base[:9]})"

    hallazgos = []
    for ruta, solo in objetivo.items():
        if os.path.isfile(ruta):
            hallazgos += revisar_archivo(ruta, solo, clases)
    if todo or any("/supabase/migrations/" in f for f in objetivo):
        h = revisar_repo(objetivo)
        h = [x for x in h if not clases or x[0] in clases]
        hallazgos += [x for x in h if todo or x[2] in objetivo or any(x[4].find(os.path.basename(f)) >= 0 for f in objetivo)]
    if not todo:
        for f in editadas:
            hallazgos.append(("migracion-vieja-editada", "✘", f, 1, "(modificada, no añadida)",
                              "una migración nueva no edita una vieja: la vieja ya está aplicada en producción y el cambio no llega",
                              "deshaz la edición y escribe una migración nueva que haga el cambio"))

    vistos, unicos = set(), []
    for h in hallazgos:
        if (h[0], h[2], h[3]) not in vistos:
            vistos.add((h[0], h[2], h[3]))
            unicos.append(h)
    hallazgos = unicos
    por_clase = defaultdict(list)
    for h in hallazgos:
        por_clase[h[0]].append(h)

    print(f"\n# higiene · {titulo}\n")
    if not hallazgos:
        print("Nada de las clases de error conocidas. (Es grep con criterio: no sustituye leer el diff.)")
        sys.exit(0)

    print("| Clase | | Sitios | De dónde sale |")
    print("|---|---|---|---|")
    for clase, hs in sorted(por_clase.items(), key=lambda kv: (kv[1][0][1] != "✘", -len(kv[1]))):
        print(f"| `{clase}` | {hs[0][1]} | {len(hs)} | {hs[0][5]} |")

    for clase, hs in sorted(por_clase.items(), key=lambda kv: (kv[1][0][1] != "✘", -len(kv[1]))):
        print(f"\n## {hs[0][1]} {clase} · {len(hs)} sitio(s)")
        print(f"Qué hacer: {hs[0][6]}")
        mostrar = hs if (sitios or not todo) else hs[:5]
        for _c, _s, ruta, n, linea, _p, _a in mostrar:
            print(f"- `{ruta}:{n}` — {linea}")
        if len(mostrar) < len(hs):
            print(f"- … y {len(hs) - len(mostrar)} más (--sitios para verlos todos)")

    graves = sum(1 for h in hallazgos if h[1] == "✘")
    print(f"\nTotal: {len(hallazgos)} hallazgo(s), {graves} ✘.")
    sys.exit(0 if todo else min(graves, 98))


if __name__ == "__main__":
    main()
