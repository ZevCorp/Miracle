#!/usr/bin/env python3
"""sabotea — el paso 5 del método, con máquina: rompe el código a propósito, corre el juez, comprueba
que la promesa se puso ROJA y deja el archivo exactamente como estaba.

    python3 .claude/skills/sabotea/scripts/sabotea.py <sabotajes.json> [--solo N,M] [--sin-linea-base]

El archivo de sabotajes (rutas relativas a «carpeta», que es relativa a la raíz del repo):

    {
      "carpeta": "services/graph",
      "juez": "node scripts/contrato.js telemetria",
      "limite_s": 600,
      "sabotajes": [
        {"promesa": 101, "archivo": "src/application/use-cases/WindowsTelemetryService.js",
         "ancla": "texto EXACTO que existe una sola vez", "reemplazo": "el texto roto",
         "clausula": "opcional: un trozo del motivo que debe salir en la salida del juez",
         "por_que": "qué rompe, en palabras del dominio"}
      ]
    }

Por qué cada comprobación (todas pagadas):
- Árbol limpio en los archivos a sabotear: revertir con `git checkout` se lleva lo no commiteado.
- El ancla tiene que estar UNA vez, y el diff no puede quedar vacío: el 2026-08-21 un sabotaje no
  llegó a aplicarse (CRLF) y el verde que salió no probaba nada.
- Línea base: si la promesa ya estaba roja antes de sabotear, el rojo no prueba nada.
- NO SE PUDO JUZGAR (99) no es un rojo de la promesa: el sabotaje rompió el arnés, no la promesa.
- El archivo se restaura byte a byte pase lo que pase (también con Ctrl+C), y se comprueba.

Sale con el número de sabotajes que NO pusieron roja su promesa (0 = todos valen), o 99 si no se
pudo montar el ensayo.
"""
import json
import os
import re
import signal
import subprocess
import sys
import time

ANSI = re.compile(r"\x1b\[[0-9;]*m")
# Las líneas de rojo de los cinco jueces: Graph/Android/Mac/raíz «✘ N · …», Windows «✘ N. …».
ROJA = re.compile(r"^\s*(?:✘|⧗ PENDIENTE|⧗ SIN JUEZ)\s+(\d+)(?:\s+·|\.)", re.M)
VERDE = re.compile(r"^\s*✔\s+(\d+)(?:\s+·|\.)", re.M)
VEREDICTO = re.compile(r"^(CONTRATO INTACTO.*|CONTRATO ROTO.*|NO SE PUDO JUZGAR.*|PARCIAL.*|VOZ .*)$", re.M)

pendientes_de_restaurar = {}


def restaurar_todo(*_):
    for ruta, original in list(pendientes_de_restaurar.items()):
        with open(ruta, "wb") as f:
            f.write(original)
        pendientes_de_restaurar.pop(ruta, None)
    if _:
        print("\n⚠ interrumpido: los archivos saboteados quedaron restaurados.")
        sys.exit(130)


def git(*args, cwd=None):
    return subprocess.run(["git", *args], capture_output=True, text=True, cwd=cwd)


def correr_juez(juez, carpeta, limite):
    inicio = time.time()
    try:
        r = subprocess.run(juez, shell=True, cwd=carpeta, capture_output=True, timeout=limite,
                           text=True, encoding="utf-8", errors="replace")
        salida = ANSI.sub("", (r.stdout or "") + "\n" + (r.stderr or ""))
        codigo = r.returncode
    except subprocess.TimeoutExpired as e:
        salida = ANSI.sub("", (e.stdout or b"").decode("utf-8", "replace") if isinstance(e.stdout, bytes) else (e.stdout or ""))
        codigo = None
    rojas = {int(n) for n in ROJA.findall(salida)}
    verdes = {int(n) for n in VERDE.findall(salida)}
    veredictos = VEREDICTO.findall(salida)
    return {
        "codigo": codigo,
        "salida": salida,
        "rojas": rojas,
        "verdes": verdes,
        "veredicto": veredictos[-1].strip() if veredictos else ("(sin veredicto: se pasó del límite)" if codigo is None else "(sin veredicto)"),
        "segundos": round(time.time() - inicio, 1),
    }


def preparar_texto(contenido: bytes, texto: str) -> bytes:
    """Si el archivo usa CRLF y el ancla viene con LF, se adapta. Es la trampa del 2026-08-21."""
    crlf = b"\r\n" in contenido
    t = texto
    if crlf and "\n" in t and "\r\n" not in t:
        t = t.replace("\n", "\r\n")
    return t.encode("utf-8")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        print(__doc__)
        sys.exit(2)
    plan_ruta = os.path.abspath(args[0])
    with open(plan_ruta, encoding="utf-8") as f:
        plan = json.load(f)
    solo = None
    if "--solo" in sys.argv:
        solo = {int(x) for x in sys.argv[sys.argv.index("--solo") + 1].split(",")}

    raiz = git("rev-parse", "--show-toplevel", cwd=os.path.dirname(plan_ruta)).stdout.strip() or os.getcwd()
    carpeta = os.path.join(raiz, plan.get("carpeta", "."))
    juez = plan["juez"]
    limite = int(plan.get("limite_s", 900))
    sabotajes = [s for s in plan["sabotajes"] if solo is None or int(s["promesa"]) in solo]
    if not sabotajes:
        print("NO SE PUDO JUZGAR: el plan no tiene sabotajes (o --solo no coincide con ninguno)")
        sys.exit(99)

    signal.signal(signal.SIGINT, restaurar_todo)
    signal.signal(signal.SIGTERM, restaurar_todo)

    # ── antes de tocar nada ───────────────────────────────────────────────────────────────────────
    sucios = []
    for s in sabotajes:
        ruta = os.path.join(carpeta, s["archivo"])
        if not os.path.isfile(ruta):
            print(f"NO SE PUDO JUZGAR: no existe {os.path.relpath(ruta, raiz)} (sabotaje de la promesa {s['promesa']})")
            sys.exit(99)
        if git("status", "--porcelain", "--", ruta, cwd=raiz).stdout.strip():
            sucios.append(os.path.relpath(ruta, raiz))
    if sucios:
        print("NO SE PUDO JUZGAR: commitea antes de sabotear; estos archivos tienen cambios sin commitear:")
        for s in sorted(set(sucios)):
            print(f"  - {s}")
        print("  (revertir un sabotaje sobre cambios sin commitear se los lleva: pasó el 2026-08-21)")
        sys.exit(99)

    print(f"\n# sabotea · {len(sabotajes)} sabotaje(s) · juez: `{juez}` en {os.path.relpath(carpeta, raiz) or '.'}\n")

    base = None
    if "--sin-linea-base" not in sys.argv:
        print("… línea base (sin sabotear)", flush=True)
        base = correr_juez(juez, carpeta, limite)
        print(f"  {base['veredicto']}  ({base['segundos']} s)")
        if base["veredicto"].startswith("NO SE PUDO JUZGAR") or base["codigo"] is None:
            print("NO SE PUDO JUZGAR: el juez no juzga ni sin sabotear. Arregla eso primero.")
            print("\n".join(base["salida"].strip().splitlines()[-12:]))
            sys.exit(99)

    filas, fallidos = [], 0
    for i, s in enumerate(sabotajes, 1):
        n = int(s["promesa"])
        ruta = os.path.join(carpeta, s["archivo"])
        rel = os.path.relpath(ruta, raiz)
        with open(ruta, "rb") as f:
            original = f.read()
        ancla = preparar_texto(original, s["ancla"])
        reemplazo = preparar_texto(original, s["reemplazo"])
        veces = original.count(ancla)
        print(f"\n[{i}/{len(sabotajes)}] promesa {n} · {s.get('por_que', rel)}", flush=True)

        if base is not None and n in base["rojas"]:
            filas.append((n, s, "—", "✘ ya estaba roja antes de sabotear: el rojo no probaría nada", base["veredicto"], ""))
            fallidos += 1
            print("  ✘ la promesa ya estaba roja en la línea base")
            continue
        if base is not None and n not in base["verdes"]:
            print(f"  ⚠ la línea base no imprimió «✔ {n}»: ¿el juez de esta promesa está en este comando?")
        if veces != 1:
            motivo = "el ancla no está en el archivo" if veces == 0 else f"el ancla está {veces} veces: hazla única"
            filas.append((n, s, "—", f"✘ no se aplicó: {motivo}", "—", ""))
            fallidos += 1
            print(f"  ✘ {motivo}")
            continue

        pendientes_de_restaurar[ruta] = original
        try:
            with open(ruta, "wb") as f:
                f.write(original.replace(ancla, reemplazo, 1))
            if git("diff", "--quiet", "--", ruta, cwd=raiz).returncode == 0:
                filas.append((n, s, "—", "✘ el diff quedó vacío: el sabotaje no cambió nada", "—", ""))
                fallidos += 1
                print("  ✘ git diff vacío tras sabotear")
                continue
            r = correr_juez(juez, carpeta, limite)
        finally:
            with open(ruta, "wb") as f:
                f.write(original)
            pendientes_de_restaurar.pop(ruta, None)

        restaurado = git("diff", "--quiet", "--", ruta, cwd=raiz).returncode == 0
        otras = sorted(x for x in r["rojas"] if x != n and (base is None or x not in base["rojas"]))
        clausula = s.get("clausula")
        vio_clausula = (clausula is None) or (clausula in r["salida"])
        if r["veredicto"].startswith("NO SE PUDO JUZGAR"):
            estado = "✘ rompió el arnés (99), no la promesa: busca un sabotaje que compile"
        elif r["codigo"] is None:
            estado = f"✘ el juez se pasó de {limite} s"
        elif n in r["rojas"] and vio_clausula:
            estado = "✔ se puso roja"
        elif n in r["rojas"]:
            estado = f"⚠ roja, pero sin la cláusula «{clausula}» en la salida"
        else:
            estado = "✘ SIGUIÓ VERDE: la promesa no vigila esto"
        if not estado.startswith("✔"):
            fallidos += 1
        if not restaurado:
            estado += " · ⚠ EL ARCHIVO NO QUEDÓ IGUAL"
            fallidos += 1
        filas.append((n, s, f"{r['segundos']} s", estado, r["veredicto"], ", ".join(map(str, otras))))
        print(f"  {estado}  ·  {r['veredicto']}  ({r['segundos']} s)")
        if otras:
            print(f"  también se pusieron rojas: {', '.join(map(str, otras))}")
        if not estado.startswith("✔"):
            for linea in [l for l in r["salida"].splitlines() if l.strip()][-6:]:
                print(f"      {linea[:160]}")

    # ── la tabla que va a la spec («Los sabotajes») y al PR ───────────────────────────────────────
    print("\n## Los sabotajes\n")
    print("| Promesa | Se rompió | Resultado | También rojas | Veredicto del juez |")
    print("|---|---|---|---|---|")
    for n, s, _seg, estado, veredicto, otras in filas:
        que = s.get("por_que") or f"`{s['archivo']}`"
        print(f"| {n} | {que} (`{os.path.basename(s['archivo'])}`) | {estado} | {otras or '—'} | {veredicto} |")
    print()
    total = len(filas)
    if fallidos == 0:
        print(f"SABOTAJES VÁLIDOS: {total} de {total} promesas se pusieron rojas al romper su código.")
    else:
        print(f"SABOTAJES FALLIDOS: {fallidos} de {total}. Una promesa que no se pone roja no vigila nada.")
    sys.exit(min(fallidos, 98))


if __name__ == "__main__":
    main()
