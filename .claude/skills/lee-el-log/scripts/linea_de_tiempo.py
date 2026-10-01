#!/usr/bin/env python3
"""linea_de_tiempo — de un log a una línea de tiempo que se puede leer, medir y pegar en una spec.

    python3 linea_de_tiempo.py <archivo|carpeta|-> [opciones]

Entiende:
  - Ü Windows, formato por instancia (desde el 2026-09-22, LogBus.cs):
        [HH:mm:ss] [<origen>-p<pid>-<HHmmss>] <tag>: <mensaje>
    archivos u-AAAAMMDD-<origen>-p<pid>-<HHmmss>.log en %LOCALAPPDATA%\\U\\logs (o en U_DATA_DIR\\logs);
  - Ü Windows, formato viejo: [HH:mm:ss] <tag>: <mensaje>   (u-AAAAMMDD.log);
  - Android, adb logcat (threadtime o time):  MM-DD HH:MM:SS.mmm  PID  TID D Graph: [tag] mensaje

Opciones:
  --instancias          qué instancias hay (origen, pid, ejecutable, primera y última línea) y para
  --instancia <trozo>   solo la instancia cuyo id contiene <trozo> (p. ej. «instalada» o «p4120»)
  --dia AAAAMMDD        en una carpeta, ese día (por defecto, el más reciente)
  --tag <regex>         solo esos tags        (p. ej. 'voz-viva|voz-clic')
  --busca <regex>       solo las líneas cuyo mensaje case
  --desde HH:MM:SS  --hasta HH:MM:SS
  --contexto N          con --busca: N líneas antes y después de cada acierto
  --resumen             por tag: cuántas, primera, última; los errores; los huecos más largos
  --ms                  los «N ms» de cada mensaje, por tag y tramo: cuántos, mediana, máximo
  --md                  la línea de tiempo como tabla markdown (para «Diagnóstico» o «Evidencia»)
  --max N               como mucho N líneas (por defecto 400; 0 = todas)

Por qué existe (2026-10-01): la regla nº1 es «el log antes que la teoría», y el log se leía a ojo.
Los dos lectores que había (anatomia-del-clic.ps1, nivel4-voz/piezas.ps1) esperan el formato viejo,
así que con los logs posteriores al 2026-09-22 leen cero líneas sin decirlo.
"""
import glob
import os
import re
import statistics
import sys
from collections import Counter, defaultdict

RE_WIN_NUEVO = re.compile(r"^\[(\d\d:\d\d:\d\d)\] \[([^\]]+)\] ([^:]{1,40}): ?(.*)$")
RE_WIN_VIEJO = re.compile(r"^\[(\d\d:\d\d:\d\d)\] ([^:\[\]]{1,40}): ?(.*)$")
RE_LOGCAT = re.compile(r"^(?:\d\d-\d\d\s+)?(\d\d:\d\d:\d\d)\.(\d{3})\s+(?:(\d+)\s+(\d+)\s+)?([VDIWEF])[/\s]([^:(]+?)(?:\(\s*\d+\))?\s*:\s(.*)$")
RE_TAG_EN_MSG = re.compile(r"^\[([\w-]+)\]\s*(.*)$")
ERROR = re.compile(r"✘|\b(error|excepci[oó]n|exception|fall[oó]|no se pudo|no pude|timeout|se pas[oó]|rechaz|denegad|forbidden|40[134]|50[0-4])\b", re.I)


def a_segundos(hms, ms=0):
    h, m, s = (int(x) for x in hms.split(":"))
    return h * 3600 + m * 60 + s + ms / 1000


def leer_lineas(fuente, dia=None):
    """Devuelve [(ruta, texto)]. Una carpeta de logs de Windows se lee entera para el día pedido."""
    if fuente == "-":
        return [("stdin", sys.stdin.read())]
    if os.path.isdir(fuente):
        archivos = sorted(glob.glob(os.path.join(fuente, "u-*.log")))
        if not archivos:
            raise SystemExit(f"NO HAY LOGS: {fuente} no tiene u-*.log")
        dias = sorted({re.match(r"u-(\d{8})", os.path.basename(a)).group(1) for a in archivos if re.match(r"u-(\d{8})", os.path.basename(a))})
        elegido = dia or (dias[-1] if dias else None)
        archivos = [a for a in archivos if elegido and os.path.basename(a).startswith(f"u-{elegido}")]
        print(f"· {len(archivos)} archivo(s) del {elegido} en {fuente} (días con log: {', '.join(dias[-5:])})", file=sys.stderr)
    else:
        archivos = [fuente]
    out = []
    for a in archivos:
        # FileShare: en Windows el log está abierto por U.exe; open() de Python lee igual (comparte lectura).
        with open(a, "rb") as f:
            crudo = f.read()
        out.append((a, crudo.decode("utf-8-sig", errors="replace")))
    return out


def parsear(fuentes):
    eventos, formatos, sin_entender = [], Counter(), 0
    for ruta, texto in fuentes:
        nombre = os.path.basename(ruta)
        anterior = None
        for numero, linea in enumerate(texto.splitlines(), 1):
            if not linea.strip():
                continue
            m = RE_WIN_NUEVO.match(linea)
            if m:
                ev = dict(t=a_segundos(m.group(1)), hora=m.group(1), inst=m.group(2), tag=m.group(3).strip(), msg=m.group(4))
                formatos["windows (por instancia)"] += 1
            else:
                m = RE_LOGCAT.match(linea)
                if m:
                    msg = m.group(7)
                    tag = m.group(6).strip()
                    t = RE_TAG_EN_MSG.match(msg)
                    if t:
                        tag, msg = f"{t.group(1)}", t.group(2)
                    ev = dict(t=a_segundos(m.group(1), int(m.group(2))), hora=f"{m.group(1)}.{m.group(2)}",
                              inst=f"pid{m.group(3)}" if m.group(3) else "android", tag=tag, msg=msg, nivel=m.group(5))
                    formatos["android (logcat)"] += 1
                else:
                    m = RE_WIN_VIEJO.match(linea)
                    if m:
                        ev = dict(t=a_segundos(m.group(1)), hora=m.group(1), inst=nombre, tag=m.group(2).strip(), msg=m.group(3))
                        formatos["windows (viejo)"] += 1
                    elif anterior is not None:
                        anterior["msg"] += " ⏎ " + linea.strip()   # continuación (una traza, un JSON partido)
                        continue
                    else:
                        sin_entender += 1
                        continue
            ev["archivo"], ev["n"] = nombre, numero
            eventos.append(ev)
            anterior = ev
    # Varias instancias en un mismo día: se ordenan por hora, estable dentro de cada archivo.
    eventos.sort(key=lambda e: e["t"])
    return eventos, formatos, sin_entender


def opcion(nombre, defecto=None):
    if nombre in sys.argv:
        i = sys.argv.index(nombre)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return defecto


def main():
    posicionales = []
    saltar = False
    for i, a in enumerate(sys.argv[1:], 1):
        if saltar:
            saltar = False
            continue
        if a in ("--instancia", "--dia", "--tag", "--busca", "--desde", "--hasta", "--contexto", "--max"):
            saltar = True
            continue
        if not a.startswith("--"):
            posicionales.append(a)
    if not posicionales:
        print(__doc__)
        sys.exit(2)

    fuentes = leer_lineas(posicionales[0], opcion("--dia"))
    eventos, formatos, sin_entender = parsear(fuentes)
    if not eventos:
        print(f"NO SE ENTENDIÓ NINGUNA LÍNEA ({sin_entender} sin formato conocido). ¿Es un log de Ü? Mira las 3 primeras:")
        for _, texto in fuentes[:1]:
            print("\n".join(texto.splitlines()[:3]))
        sys.exit(99)
    print(f"· {len(eventos)} líneas entendidas · formato: {', '.join(f'{k} ({v})' for k, v in formatos.items())}"
          + (f" · {sin_entender} sin entender" if sin_entender else ""), file=sys.stderr)

    if "--instancias" in sys.argv:
        por = defaultdict(list)
        for e in eventos:
            por[e["inst"]].append(e)
        print("| Instancia | Líneas | Primera | Última | Ejecutable |")
        print("|---|---|---|---|---|")
        for inst, es in sorted(por.items(), key=lambda kv: kv[1][0]["t"]):
            exe = next((re.search(r"ejecutable=(.*)$", e["msg"]).group(1) for e in es if e["tag"] == "instancia" and "ejecutable=" in e["msg"]), "")
            print(f"| {inst} | {len(es)} | {es[0]['hora']} | {es[-1]['hora']} | {exe} |")
        print("\nLa instalada sale como «instalada-…»; las de un árbol de trabajo, con el nombre de su carpeta.")
        return

    # ── filtros ─────────────────────────────────────────────────────────────────────────────────
    sel = eventos
    if opcion("--instancia"):
        sel = [e for e in sel if opcion("--instancia") in e["inst"]]
    if opcion("--tag"):
        rt = re.compile(opcion("--tag"), re.I)
        sel = [e for e in sel if rt.search(e["tag"])]
    if opcion("--desde"):
        d = a_segundos(opcion("--desde"))
        sel = [e for e in sel if e["t"] >= d]
    if opcion("--hasta"):
        h = a_segundos(opcion("--hasta")) + 0.999
        sel = [e for e in sel if e["t"] <= h]
    if opcion("--busca"):
        rb = re.compile(opcion("--busca"), re.I)
        ctx = int(opcion("--contexto", "0"))
        if ctx:
            idx = {i for i, e in enumerate(sel) if rb.search(e["msg"]) or rb.search(e["tag"])}
            ampliado = set()
            for i in idx:
                ampliado.update(range(max(0, i - ctx), min(len(sel), i + ctx + 1)))
            sel = [sel[i] for i in sorted(ampliado)]
        else:
            sel = [e for e in sel if rb.search(e["msg"]) or rb.search(e["tag"])]
    if not sel:
        print("Ninguna línea pasa los filtros.")
        sys.exit(1)
    varias = len({e["inst"] for e in sel}) > 1

    # ── resumen ─────────────────────────────────────────────────────────────────────────────────
    if "--resumen" in sys.argv:
        print(f"# Resumen · {sel[0]['hora']} → {sel[-1]['hora']} · {len(sel)} líneas"
              + (f" · {len({e['inst'] for e in sel})} instancias (filtra con --instancia)" if varias else "") + "\n")
        c = Counter(e["tag"] for e in sel)
        print("| Tag | Líneas | Primera | Última |")
        print("|---|---|---|---|")
        for tag, n in c.most_common(25):
            es = [e for e in sel if e["tag"] == tag]
            print(f"| {tag} | {n} | {es[0]['hora']} | {es[-1]['hora']} |")
        errores = [e for e in sel if ERROR.search(e["msg"]) or e.get("nivel") in ("E", "F")]
        print(f"\n## Lo que suena a error · {len(errores)}")
        for e in errores[:30]:
            print(f"- {e['hora']} [{e['tag']}] {e['msg'][:200]}")
        if len(errores) > 30:
            print(f"- … y {len(errores) - 30} más (--busca para acotar)")
        huecos = sorted(((b["t"] - a["t"], a, b) for a, b in zip(sel, sel[1:]) if a["inst"] == b["inst"]), key=lambda x: -x[0])[:8]
        print("\n## Los silencios más largos (dentro de una misma instancia)")
        for d, a, b in huecos:
            if d < 2:
                break
            print(f"- {d:.0f} s entre {a['hora']} [{a['tag']}] «{a['msg'][:60]}» y {b['hora']} [{b['tag']}] «{b['msg'][:60]}»")
        print("\nUn silencio largo justo antes de un error suele ser la espera que nadie cortó.")
        return

    # ── milisegundos ────────────────────────────────────────────────────────────────────────────
    if "--ms" in sys.argv:
        medidas = defaultdict(list)
        for e in sel:
            # RelojDelClic escribe «gesto · tramo +N ms (nota) · tramo +N ms»: el tramo es lo que va
            # antes del número dentro de cada trozo. Lo demás («(85 ms)») cuenta sin tramo.
            for parte in e["msg"].split(" · "):
                m = re.match(r"^(.+?)\s+\+(\d+(?:[.,]\d+)?)\s*ms\b", parte.strip())
                if m:
                    medidas[(e["tag"], m.group(1).strip()[-30:])].append(float(m.group(2).replace(",", ".")))
                    continue
                for valor in re.findall(r"(\d+(?:[.,]\d+)?)\s*ms\b", parte):
                    medidas[(e["tag"], "—")].append(float(valor.replace(",", ".")))
        if not medidas:
            print("Ningún mensaje trae «N ms».")
            return
        print("| Tag | Tramo | Veces | Mediana ms | Máx ms | Última ms |")
        print("|---|---|---|---|---|---|")
        for (tag, tramo), vs in sorted(medidas.items(), key=lambda kv: (kv[0][0], -statistics.median(kv[1]))):
            print(f"| {tag} | {tramo} | {len(vs)} | {statistics.median(vs):.0f} | {max(vs):.0f} | {vs[-1]:.0f} |")
        print("\nPara un antes/después, corre esto sobre el log de main y sobre el de la rama, con los mismos filtros.")
        return

    # ── línea de tiempo ─────────────────────────────────────────────────────────────────────────
    tope = int(opcion("--max", "400"))
    mostrar = sel if tope == 0 else sel[:tope]
    md = "--md" in sys.argv
    if md:
        print("| Hora | +Δ | " + ("Instancia | " if varias else "") + "Tag | Qué dice |")
        print("|---|---|" + ("---|" if varias else "") + "---|---|")
    previo = None
    for e in mostrar:
        delta = "" if previo is None else f"+{e['t'] - previo['t']:.3f}".rstrip("0").rstrip(".") + " s"
        msg = e["msg"].replace("|", "\\|") if md else e["msg"]
        if md:
            print(f"| {e['hora']} | {delta} | " + (f"{e['inst']} | " if varias else "") + f"{e['tag']} | {msg[:220]} |")
        else:
            marca = "✘ " if ERROR.search(e["msg"]) else "  "
            print(f"{marca}{e['hora']:>12} {delta:>9}  " + (f"[{e['inst']}] " if varias else "") + f"{e['tag']}: {msg[:300]}")
        previo = e
    if len(sel) > len(mostrar):
        print(f"\n… {len(sel) - len(mostrar)} líneas más (--max 0, o acota con --tag/--desde/--busca)")
    if varias and not opcion("--instancia"):
        print("\n⚠ hay líneas de varias instancias mezcladas: --instancias para verlas, --instancia <trozo> para elegir.", file=sys.stderr)


if __name__ == "__main__":
    main()
