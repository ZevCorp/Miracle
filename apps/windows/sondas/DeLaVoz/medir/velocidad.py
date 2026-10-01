"""
CUÁNTO PIENSA EL DELEGADO, con el session.start de la app (sus instrucciones y su catálogo entero).

    python velocidad.py <sonda-de-la-voz.exe> <apertura-de-la-app.json> luna-medium-priority,sol-low [corridas]

La frase entra por la voz, como audio: «primera llamada» incluye lo que tarda la voz en delegar.
El session.start de la app lo vuelca sondas/VolcarApertura. Cada corrida es una sesión de pago (~25 s).
Medido el 2026-10-01 (spec 073), seis corridas por combinación: ver la tabla de la spec.
"""
import io, os, re, statistics as st, subprocess, sys

exe, apertura = sys.argv[1], sys.argv[2]
n = int(sys.argv[4]) if len(sys.argv) > 4 else 6
CONFIG = {
    "sol-low":              ["--delegado", "gpt-6.1-sol", "--esfuerzo", "low"],
    "sol-priority":         ["--delegado", "gpt-6.1-sol", "--esfuerzo", "low", "--tier", "priority"],
    "luna-low":             ["--delegado", "gpt-6-luna", "--esfuerzo", "low"],
    "luna-none":            ["--delegado", "gpt-6-luna", "--esfuerzo", "none"],
    "luna-medium":          ["--delegado", "gpt-6-luna", "--esfuerzo", "medium"],
    "luna-priority":        ["--delegado", "gpt-6-luna", "--esfuerzo", "low", "--tier", "priority"],
    "luna-medium-priority": ["--delegado", "gpt-6-luna", "--esfuerzo", "medium", "--tier", "priority"],
}
salida = os.path.join(os.path.dirname(os.path.abspath(apertura)), "out")
for nombre in sys.argv[3].split(","):
    primeras, vueltas, llamadas, sin_medida = [], [], [], 0
    for i in range(n):
        p = subprocess.run([exe, "--apertura", apertura, "--ms-por-paso", "300", "--salida", salida] + CONFIG[nombre],
                           capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=240)
        t = p.stdout
        m = re.search(r"pensó, por vuelta \(ms\): ([\d, ]+)", t)
        v = [int(x) for x in m.group(1).split(", ")] if m else []
        ll = re.search(r"primera llamada del delegado tras la petición: (\d+) ms", t)
        if not v:
            # UNA CORRIDA SIN MEDIDA SE CUENTA COMO TAL: no encoge el denominador (patrón nº10).
            sin_medida += 1
            print(f"[{nombre} {i + 1}/{n}] SIN MEDIDA: {re.findall(r'ERROR\s+(.*)', t)[:1]}", flush=True)
            continue
        primeras.append(v[0]); vueltas += v
        if ll: llamadas.append(int(ll.group(1)))
        print(f"[{nombre} {i + 1}/{n}] primer plan {v[0]} ms · vueltas {v} · primera llamada {ll.group(1) if ll else '—'} ms", flush=True)
    if primeras:
        print(f"== {nombre}: {len(primeras)} de {n} con medida · primer plan mediana {st.median(primeras):.0f} ms (de {min(primeras)} a {max(primeras)}) · "
              f"por vuelta mediana {st.median(vueltas):.0f} ms (n={len(vueltas)}) · primera llamada tras la petición mediana {st.median(llamadas):.0f} ms", flush=True)
    else:
        print(f"== {nombre}: ninguna de las {n} corridas dio medida", flush=True)
