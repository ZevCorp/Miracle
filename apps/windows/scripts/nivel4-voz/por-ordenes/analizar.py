"""
Lo que contestó el delegado en cada pedido de calidad.py, leído de SU mensaje final en el log crudo.

    python analizar.py <carpeta de datos> por-defecto,sol-low

«Ü dijo» no sirve para esto: se escribe al cerrar el turno, y si la prueba cuelga antes no sale. El mensaje
final del delegado (response.output_item.done, de tipo message) sí queda siempre, con su hora.
Si acertó lo juzga quien lo lee: la respuesta está entera, y «terminé» no es un veredicto.
"""
import glob, io, json, os, re, sys

for cfg in sys.argv[2].split(","):
    logs = sorted(glob.glob(os.path.join(sys.argv[1], cfg, "local", "U", "logs", "u-*.log")), key=os.path.getmtime)
    if not logs:
        print(f"== {cfg}: sin log"); continue
    lineas = io.open(logs[-1], encoding="utf-8", errors="replace").read().splitlines()
    pedidos, actual = [], None
    for l in lineas:
        m = re.search(r"prueba: orden de prueba: «(.*)»", l)
        if m:
            actual = {"orden": m.group(1), "llamadas": 0, "final": "", "turno": "", "t0": l[1:9], "tfin": "", "errores": []}
            pedidos.append(actual); continue
        if actual is None:
            continue
        if "llamada recibida" in l:
            actual["llamadas"] += l.count(",") + 1
        if "el servidor dice" in l:
            actual["errores"].append(l.split("el servidor dice:")[-1].strip()[:160])
        if '"type":"response.output_item.done"' in l and '"type":"message"' in l:
            try:
                partes = json.loads(l[l.index("{"):])["event"]["item"]["content"]
                actual["final"] = " ".join(p.get("text", "") for p in partes if p.get("type") == "output_text")
            except (ValueError, KeyError):
                t = re.search(r'"text":"(.*?)(?:"\}|…)', l)   # la línea del log puede venir recortada
                if t: actual["final"] = t.group(1)
            actual["tfin"] = l[1:9]
        m = re.search(r"voz-turno: llamadas=.*?(pensar=\d+ ms ejecutar=\d+ ms luna=\d+%.*)", l)
        if m:
            actual["turno"] = m.group(1)

    def seg(h):
        a, b, c = h.split(":"); return int(a) * 3600 + int(b) * 60 + int(c)

    print(f"== {cfg} ({os.path.basename(logs[-1])})")
    for i, p in enumerate(pedidos, 1):
        cuando = f"{seg(p['tfin']) - seg(p['t0'])} s" if p["tfin"] else "nunca"
        print(f"  {i}. «{p['orden']}»\n     {p['llamadas']} llamada(s) · respuesta a los {cuando} · {p['turno']}\n     {p['final'] or '(sin respuesta)'}"
              + (f"\n     ERRORES: {p['errores'][:2]}" if p["errores"] else ""))
