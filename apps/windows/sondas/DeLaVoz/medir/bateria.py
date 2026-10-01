"""
LA BATERÍA DE LA SONDA DE LA VOZ: ¿habla la voz mientras se trabaja, dice lo que falla, contesta «¿cómo vas?»?

    python bateria.py <sonda-de-la-voz.exe> <instrucciones-del-delegado.txt> base,falla,pregunta,rapido

Cada corrida es una sesión de pago contra el servidor real (~45 s). Las metas están en la spec 073:
con «base», al menos una frase durante el trabajo en 5 de 5 y un silencio máximo de 5 s.
"""
import os, re, statistics as st, subprocess, sys

exe, instrucciones = sys.argv[1], sys.argv[2]
CONDICIONES = {
    "base":     (5, []),                                                  # 4 pasos de 2,5 s
    "falla":    (3, ["--falla", "3"]),                                    # el tercero no se puede
    "pregunta": (3, ["--ms-por-paso", "4000", "--interrumpe", "Oye, ¿cómo vas? ¿qué llevas hecho?", "--a-los", "5000"]),
    "rapido":   (3, ["--ms-por-paso", "600"]),                            # pasos al ritmo de la app de verdad
    "sin-avances": (2, ["--avances", "ninguno"]),                         # lo que había: la voz no se entera
}
salida = os.path.join(os.path.dirname(os.path.abspath(instrucciones)), "out")


def num(patron, texto):
    m = re.search(patron, texto)
    return int(m.group(1)) if m else None


for nombre in sys.argv[3].split(","):
    n, args = CONDICIONES[nombre]
    filas = []
    for i in range(n):
        p = subprocess.run([exe, "--instrucciones", instrucciones, "--salida", salida] + args,
                           capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=240)
        t = p.stdout
        vueltas = re.search(r"pensó, por vuelta \(ms\): ([\d, ]+)", t)
        fila = {
            "primera_voz": num(r"primera palabra de la voz tras la petición: (\d+) ms", t),
            "primera_llamada": num(r"primera llamada del delegado tras la petición: (\d+) ms", t),
            "frases": num(r"frases de la voz DURANTE el trabajo: (\d+)", t),
            "silencio": num(r"silencio más largo durante el trabajo: (\d+) ms", t),
            "pensar": [int(x) for x in vueltas.group(1).split(", ")] if vueltas else [],
            "errores": num(r"errores: (\d+)", t),
            "delegaciones": t.count("session.delegation.created"),
            "dijo": (re.search(r"la voz dijo: «(.*)»", t) or [None, ""])[1],
        }
        filas.append(fila)
        print(f"[{nombre} {i + 1}/{n}] primera voz={fila['primera_voz']} primera llamada={fila['primera_llamada']} frases={fila['frases']} "
              f"silencio={fila['silencio']} pensar={fila['pensar']} errores={fila['errores']} delegaciones={fila['delegaciones']}\n    dijo: {fila['dijo']}", flush=True)

    def mediana(k):
        v = [f[k] for f in filas if f[k] is not None]
        return f"{st.median(v):.0f} (de {min(v)} a {max(v)})" if v else "—"

    pensar = [x for f in filas for x in f["pensar"]]
    print(f"== {nombre}: n={n} · primera voz {mediana('primera_voz')} ms · primera llamada {mediana('primera_llamada')} ms · "
          f"frases durante el trabajo {[f['frases'] for f in filas]} · silencio máximo {mediana('silencio')} ms · "
          + (f"pensar por vuelta {st.median(pensar):.0f} ms (n={len(pensar)})" if pensar else "sin vueltas"), flush=True)
