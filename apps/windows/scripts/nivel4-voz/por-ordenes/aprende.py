"""
EL NIVEL 4 DE LA SPEC 074, SIN MANOS: ¿aprende la Ü de verdad de una sesión, y lo usa en la siguiente?

    python aprende.py <U.exe> <carpeta de datos NUEVA> <puerto desde el que buscar uno libre> <etiqueta>

Arranca una Ü de pruebas con sus propios datos (vacíos: no sabe nada), y le manda por u_orden —el camino de lo
escrito en el chat— una sesión detrás de otra. Entre sesión y sesión CUELGA, que es lo que lanza el repaso, y
espera a que el repaso termine. Lo que se juzga no es lo que Ü dice que aprendió: es su aprendido.json, la
línea del log que dice con qué instrucciones abrió la sesión siguiente, y lo que hizo cuando se le pidió.

    1. enseñar una tarea            → queda UNA habilidad con sus pasos
    2. decir una preferencia        → queda la preferencia
    3. pedir la tarea               → la sesión abre con lo aprendido y sigue los pasos
    4. corregir la tarea            → sigue habiendo UNA, reconstruida
    5. pedir la tarea otra vez      → la hace a la manera corregida
    6. una pregunta suelta          → no se guarda nada

- En modo texto la voz no suena y no abre el micrófono: esto no prueba que la preferencia cambie cómo HABLA.
- Solo arranca con el PC quieto, y cierra por PID lo que ella misma abrió.
- U_NIVEL4_SEMILLA: una config.json con correo, nombre y «PresentacionHecha».
"""
import ctypes, glob, io, json, os, re, shutil, socket, subprocess, sys, time, unicodedata, urllib.request

exe, datos, puerto, etiqueta = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
SEMILLA = os.environ.get("U_NIVEL4_SEMILLA", r"C:\U-versiones\onda-datos\roaming\U\config.json")
APPS = ("CalculatorApp.exe", "SystemSettings.exe", "notepad.exe", "Notepad.exe", "mspaint.exe")
APRENDIDO = os.path.join(datos, "roaming", "U", "aprendido.json")
PENDIENTES = os.path.join(datos, "local", "U", "sesiones-por-repasar")


class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]


def quieto_ms():
    li = LASTINPUTINFO(); li.cbSize = ctypes.sizeof(li)
    ctypes.windll.user32.GetLastInputInfo(ctypes.byref(li))
    return ctypes.windll.kernel32.GetTickCount() - li.dwTime


def procesos():
    out = subprocess.run(["tasklist", "/fo", "csv", "/nh"], capture_output=True, text=True, encoding="cp850", errors="replace").stdout
    vivos = {}
    for linea in out.splitlines():
        partes = [p.strip('"') for p in linea.split('","')]
        if len(partes) >= 2 and partes[0] in APPS:
            vivos[int(partes[1])] = partes[0]
    return vivos


def mcp(herramienta, argumentos, espera=15):
    cuerpo = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": herramienta, "arguments": argumentos}}).encode("utf-8")
    r = urllib.request.Request(f"http://127.0.0.1:{puerto}/mcp/", data=cuerpo, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r, timeout=espera) as resp:
        return resp.read().decode("utf-8", "replace")


PID = None


def el_log():
    logs = sorted(glob.glob(os.path.join(datos, "local", "U", "logs", f"u-*-p{PID}-*.log")), key=os.path.getmtime)
    return logs[-1] if logs else None


def leer(desde=0):
    p = el_log()
    if not p:
        return []
    with io.open(p, encoding="utf-8", errors="replace") as f:
        return f.read().splitlines()[desde:]


def llano(s):
    return "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn")


def aprendido():
    if not os.path.exists(APRENDIDO):
        return {"habilidades": [], "preferencias": [], "observaciones": []}
    return json.load(io.open(APRENDIDO, encoding="utf-8"))


def habilidad_dice(a, *trozos):
    for h in a["habilidades"]:
        todo = llano(h["nombre"] + " " + h.get("cuando", "") + " " + " ".join(h.get("pasos", [])))
        if all(llano(t) in todo for t in trozos):
            return True
    return False


VEREDICTOS = []


def juzga(que, vale, detalle=""):
    VEREDICTOS.append((que, bool(vale)))
    print(f"    {'✔' if vale else '✘'} {que}" + (f"  — {detalle}" if detalle and not vale else ""))


def sesion(orden, tope=150):
    """Una sesión entera: la orden, esperar a que termine, colgar, y esperar al repaso. Devuelve sus líneas del log."""
    marca = len(leer())
    print(f"[{etiqueta}] → {orden}")
    mcp("u_orden", {"texto": orden})
    time.sleep(1.5)
    if not any("orden de prueba" in l for l in leer(marca)):
        print("NO SE PUDO PROBAR: la orden no llegó a ESTA Ü (no está en su log)."); raise SystemExit(3)
    t0 = time.time(); ultimo = time.time(); vistas = 0
    while time.time() - t0 < tope:
        time.sleep(1)
        nuevas = [l for l in leer(marca) if re.search(r"voz-viva|mapa-mcp|plan:|mano:|voz-turno|aprendido", l)]
        if len(nuevas) != vistas:
            vistas = len(nuevas); ultimo = time.time()
        abrio = any("sesión abierta" in l or "no se pudo abrir" in l or "el servidor dice" in l for l in nuevas)
        termino = any('"type":"response.output_item.done"' in l and '"type":"message"' in l for l in leer(marca))
        if abrio and ((termino and time.time() - ultimo > 5) or time.time() - ultimo > 30):
            break
    try:
        mcp("u_colgar", {}, espera=20)
    except Exception as e:
        print(f"[{etiqueta}] u_colgar: {e}")
    # EL REPASO corre al colgar, en segundo plano: se espera a su línea, o a la que dice que no había qué repasar.
    t0 = time.time()
    while time.time() - t0 < 45:
        time.sleep(1)
        if any(re.search(r"repaso: (sesión \S+ repasada|sesión \S+: la persona no dijo|la sesión \S+ NO se repasó|\d+ sesión)", l) for l in leer(marca)):
            break
    time.sleep(1.5)
    lineas = leer(marca)
    for l in lineas:
        if re.search(r"instrucciones de quien actúa|llamada recibida|Ü dijo:| plan: |repaso: |aprendido: |preferencias de la persona|el servidor dice|voz-turno: llamadas=", l):
            print(f"    {l[:300]}")
    return lineas


# ── el PC quieto ──
t0 = time.time()
while quieto_ms() < 20_000:
    if time.time() - t0 > 600:
        print("NO SE PUDO PROBAR: el PC no estuvo quieto 20 s en diez minutos."); sys.exit(4)
    time.sleep(2)

# ── los datos, sembrados y VACÍOS de lo aprendido ──
if os.path.exists(APRENDIDO) or (os.path.isdir(PENDIENTES) and os.listdir(PENDIENTES)):
    print(f"NO SE PUDO PROBAR: «{datos}» ya trae algo aprendido o por repasar. Esta prueba necesita una carpeta nueva."); sys.exit(5)
os.makedirs(os.path.join(datos, "roaming", "U"), exist_ok=True)
os.makedirs(os.path.join(datos, "feed"), exist_ok=True)
cfg = json.load(io.open(SEMILLA, encoding="utf-8-sig"))
cfg["UpdateFeedUrl"] = os.path.join(datos, "feed")
# CON EL PERFIL YA ELEGIDO: un equipo con correo y sin perfil lo pregunta una vez (spec 078 de main), y esa ventana le
# salía en pantalla a la persona en cada corrida de una Ü de pruebas. U_NIVEL4_PERFIL=medico prueba el otro.
cfg["Perfil"] = os.environ.get("U_NIVEL4_PERFIL", "persona")
json.dump(cfg, io.open(os.path.join(datos, "roaming", "U", "config.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)


def libre(p):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", p)); return True
        except OSError:
            return False


while not libre(puerto):
    puerto += 1
antes = procesos()
entorno = dict(os.environ, U_DATA_DIR=datos, U_MCP_PUERTO=str(puerto), U_ORDENES_DE_PRUEBA="1")
u = subprocess.Popen([exe], env=entorno, cwd=os.path.dirname(exe))
PID = u.pid
print(f"[{etiqueta}] Ü de pruebas: PID {u.pid} · {exe}")

try:
    t0 = time.time()
    while not any("atajo: doble Ctrl" in l for l in leer()):
        if time.time() - t0 > 60:
            print("NO SE PUDO PROBAR: la Ü de pruebas no terminó de arrancar en 60 s."); raise SystemExit(2)
        time.sleep(1)
    if not any(f"servidor MCP escuchando en 127.0.0.1:{puerto}/mcp" in l for l in leer()):
        print(f"NO SE PUDO PROBAR: esta Ü no abrió su MCP en {puerto}."); raise SystemExit(3)
    print(f"[{etiqueta}] arrancó · su MCP escucha en {puerto} · log {el_log()}")

    # 1. ENSEÑAR
    l1 = sesion("te voy a enseñar a calcular el IVA: abres la calculadora, escribes el valor, lo multiplicas por 0,19 y me dices el resultado. No lo hagas ahora, solo apréndetelo.")
    a = aprendido()
    juzga("1. tras enseñar queda UNA habilidad", len(a["habilidades"]) == 1, f"hay {len(a['habilidades'])}")
    juzga("1. con la calculadora y el 0,19 en sus pasos", habilidad_dice(a, "calculadora") and (habilidad_dice(a, "0,19") or habilidad_dice(a, "0.19")), json.dumps(a["habilidades"], ensure_ascii=False))
    en_vivo = any("llamada recibida" in l and "habilidad_escribir" in l for l in l1)
    print(f"    (guardada {'EN EL MOMENTO por quien actúa' if en_vivo else 'por el repaso al colgar'})")
    juzga("1. la sesión se repasó al colgar", any("repasada en" in l for l in l1))

    # 2. UNA PREFERENCIA
    l2 = sesion("de ahora en adelante, cuando termines algo dime solo el resultado, sin explicaciones")
    a = aprendido()
    juzga("2. queda la preferencia, en lo aprendido", len(a["preferencias"]) == 1, f"hay {len(a['preferencias'])}")
    juzga("2. y no se inventó otra habilidad", len(a["habilidades"]) == 1, f"hay {len(a['habilidades'])}")
    print(f"    (guardada {'EN EL MOMENTO con preferencia_guardar' if any('llamada recibida' in l and 'preferencia_guardar' in l for l in l2) else 'por el repaso al colgar'})")

    # 3. PEDIR LA TAREA, en una sesión nueva
    l3 = sesion("calcula el IVA de 250000")
    abre = [l for l in l3 if "instrucciones de quien actúa" in l]
    llego = abre and re.search(r"(\d+) de lo aprendido", abre[0]) and int(re.search(r"(\d+) de lo aprendido", abre[0]).group(1)) > 0
    juzga("3. la sesión nueva abre con lo aprendido en sus instrucciones", llego, abre[0] if abre else "no hay línea de instrucciones")
    juzga("3. y a quien habla se le mandan las preferencias", any("preferencias de la persona, a la voz" in l for l in l3))
    rechazos = [l for l in l3 if "el servidor dice" in l]
    juzga("3. sin que el servidor rechace nada", not rechazos, " | ".join(rechazos)[:300])
    hecho = " ".join(l for l in l3 if " plan: " in l or "llamada recibida" in l or "mapa-mcp" in l or "mano:" in l)
    juzga("3. y usa la calculadora", "calc" in llano(hecho), hecho[:300])
    dicho = " ".join(l for l in l3 if "Ü dijo:" in l or "output_text" in l)
    juzga("3. y da el resultado: 47.500", re.search(r"47[\.\s,]?500", dicho) is not None, dicho[-300:])

    # 4. CORREGIR
    l4 = sesion("te corrijo cómo se calcula el IVA: después de multiplicar por 0,19 súmale el valor original, quiero que me digas el total con el IVA incluido. No lo hagas ahora.")
    a = aprendido()
    juzga("4. tras corregir sigue habiendo UNA habilidad", len(a["habilidades"]) == 1, json.dumps([h["nombre"] for h in a["habilidades"]], ensure_ascii=False))
    juzga("4. reconstruida: sus pasos ya hablan de sumar el valor o del total", habilidad_dice(a, "sum") or habilidad_dice(a, "total"), json.dumps(a["habilidades"], ensure_ascii=False))
    juzga("4. y conserva lo que seguía valiendo: el 0,19", habilidad_dice(a, "0,19") or habilidad_dice(a, "0.19"), json.dumps(a["habilidades"], ensure_ascii=False))

    # 5. PEDIRLA OTRA VEZ
    l5 = sesion("calcula el IVA de 100000")
    dicho = " ".join(l for l in l5 if "Ü dijo:" in l or "output_text" in l)
    juzga("5. ahora da el total con IVA: 119.000", re.search(r"119[\.\s,]?000", dicho) is not None, dicho[-300:])

    # 6. UNA PREGUNTA SUELTA
    antes_a = json.dumps(aprendido(), ensure_ascii=False, sort_keys=True)
    l6 = sesion("¿cuánto es dos más dos?")
    juzga("6. una pregunta suelta no cambia lo aprendido", json.dumps(aprendido(), ensure_ascii=False, sort_keys=True) == antes_a)

    quedan = os.listdir(PENDIENTES) if os.path.isdir(PENDIENTES) else []
    juzga("y no queda ningún diario sin repasar", len([q for q in quedan if q.endswith(".json")]) == 0, ", ".join(quedan))
finally:
    try:
        u.terminate(); u.wait(10)
    except Exception:
        try: u.kill()
        except Exception: pass
    for pid, nombre in procesos().items():
        if pid not in antes:
            subprocess.run(["taskkill", "/pid", str(pid), "/f"], capture_output=True)
            print(f"[{etiqueta}] cerrada {nombre} (PID {pid}), que abrió la prueba")
    p = el_log()
    if p:
        shutil.copy(p, os.path.join(datos, f"{etiqueta}.log"))
    if os.path.exists(APRENDIDO):
        print(f"[{etiqueta}] lo aprendido quedó así:\n" + io.open(APRENDIDO, encoding="utf-8").read())
    bien = sum(1 for _, v in VEREDICTOS if v)
    print(f"[{etiqueta}] {bien} de {len(VEREDICTOS)} comprobaciones bien · log copiado en {os.path.join(datos, etiqueta + '.log')}")
