"""
CUÁNTO TARDA UN PEDIDO, Y EN QUÉ SE VA: Luna pensando, las manos ejecutando, y cuántos clics hizo Jev.

    python velocidad.py <U.exe> <carpeta de datos NUEVA> <puerto> <etiqueta> "<la orden>" [--edge <url>] [--tope 120]

Arranca una Ü de pruebas con sus propios datos, le manda UNA orden por u_orden —el camino de lo escrito— y saca
del log de ESA Ü la línea de tiempo: cada llamada de quien planea, cada paso del plan, cada vuelta de Jev
(«⏱ dónde … decidir … total») y cada clic del ciclo rápido («mano: ⏱ ciclo»).

--edge <url> abre ANTES un Edge APARTE (su propio perfil, en C:\\U-tmp) con esa dirección y lo deja delante: lo
que la orden haga en «el navegador» cae en esa ventana y no en las pestañas de la persona. Al terminar se cierra
por PID.

EL VIGILANTE. Mientras corre la orden se mira qué ventana está delante cada 40 ms. Si pasa al frente una ventana
que ya existía antes de la prueba y no es de la prueba —una nota de la persona, su navegador—, la Ü de pruebas se
cierra en el acto: una orden libre teclea donde esté el foco, y el 2026-10-01 una dejó cuatro diálogos en el Bloc
de notas del dueño. Una corrida que el vigilante cortó no mide nada, y lo dice.

Solo arranca con el PC quieto 20 s.
"""
import ctypes, ctypes.wintypes as wt, glob, io, json, os, re, shutil, socket, subprocess, sys, threading, time, urllib.request

args = sys.argv[1:]
def opcion(nombre, defecto=None):
    if nombre in args:
        i = args.index(nombre); v = args[i + 1]; del args[i:i + 2]; return v
    return defecto
EDGE = opcion("--edge")
TOPE = int(opcion("--tope", "120"))
exe, datos, puerto, etiqueta, orden = args[0], args[1], int(args[2]), args[3], args[4]
SEMILLA = os.environ.get("U_NIVEL4_SEMILLA", r"C:\U-versiones\onda-datos\roaming\U\config.json")
MSEDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
# Ventanas NUEVAS de estos procesos son de la prueba aunque el proceso ya existiera (las apps de la tienda viven
# en ApplicationFrameHost). Una ventana nueva del Bloc de notas o de un navegador de la persona NO.
ANFITRIONES = {"applicationframehost.exe", "systemsettings.exe", "explorer.exe", "calculatorapp.exe", "mspaint.exe",
               "shellexperiencehost.exe", "searchhost.exe", "startmenuexperiencehost.exe", "textinputhost.exe"}

u32, k32 = ctypes.windll.user32, ctypes.windll.kernel32


class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]


def quieto_ms():
    li = LASTINPUTINFO(); li.cbSize = ctypes.sizeof(li)
    u32.GetLastInputInfo(ctypes.byref(li))
    return k32.GetTickCount() - li.dwTime


def pid_de(h):
    pid = wt.DWORD()
    u32.GetWindowThreadProcessId(wt.HWND(h), ctypes.byref(pid))
    return pid.value


def titulo(h):
    b = ctypes.create_unicode_buffer(300)
    u32.GetWindowTextW(wt.HWND(h), b, 300)
    return b.value


def nombre_del_proceso(pid):
    h = k32.OpenProcess(0x1000, False, pid)
    if not h:
        return ""
    try:
        b = ctypes.create_unicode_buffer(600); n = wt.DWORD(600)
        return os.path.basename(b.value).lower() if k32.QueryFullProcessImageNameW(h, 0, b, ctypes.byref(n)) else ""
    finally:
        k32.CloseHandle(h)


def ventanas():
    todas = set()
    @ctypes.WINFUNCTYPE(ctypes.c_bool, wt.HWND, wt.LPARAM)
    def cada(h, _):
        todas.add(h); return True
    u32.EnumWindows(cada, 0)
    return todas


def procesos():
    out = subprocess.run(["tasklist", "/fo", "csv", "/nh"], capture_output=True, text=True, encoding="cp850", errors="replace").stdout
    vivos = {}
    for linea in out.splitlines():
        partes = [p.strip('"') for p in linea.split('","')]
        if len(partes) >= 2 and partes[1].isdigit():
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


def seg(linea):
    m = re.match(r"\[(\d\d):(\d\d):(\d\d)\]", linea)
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3)) if m else None


t0 = time.time()
while quieto_ms() < 20_000:
    if time.time() - t0 > 600:
        print("NO SE PUDO MEDIR: el PC no estuvo quieto 20 s en diez minutos."); sys.exit(4)
    time.sleep(2)

os.makedirs(os.path.join(datos, "roaming", "U"), exist_ok=True)
os.makedirs(os.path.join(datos, "feed"), exist_ok=True)
cfg = json.load(io.open(SEMILLA, encoding="utf-8-sig"))
cfg["UpdateFeedUrl"] = os.path.join(datos, "feed")
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
ventanas_de_antes = ventanas()
entorno = dict(os.environ, U_DATA_DIR=datos, U_MCP_PUERTO=str(puerto), U_ORDENES_DE_PRUEBA="1")
u = subprocess.Popen([exe], env=entorno, cwd=os.path.dirname(exe))
PID = u.pid
edge = None
cortada = []      # por qué cortó el vigilante, si cortó
vigilando = threading.Event()
fin = threading.Event()


def vigilante():
    while not fin.is_set():
        time.sleep(0.04)
        if not vigilando.is_set():
            continue
        h = u32.GetForegroundWindow()
        if not h:
            continue
        pid = pid_de(h)
        if pid == PID or (edge is not None and pid == edge.pid) or pid not in antes:
            continue
        if h not in ventanas_de_antes and nombre_del_proceso(pid) in ANFITRIONES:
            continue
        cortada.append(f"pasó al frente «{titulo(h)[:60]}» ({nombre_del_proceso(pid)}, PID {pid}), que ya estaba antes de la prueba")
        try: u.kill()
        except Exception: pass
        return


threading.Thread(target=vigilante, daemon=True).start()
print(f"[{etiqueta}] Ü de pruebas: PID {u.pid} · {exe}")

try:
    t0 = time.time()
    while not any("atajo: doble Ctrl" in l for l in leer()):
        if time.time() - t0 > 60:
            print("NO SE PUDO MEDIR: la Ü de pruebas no terminó de arrancar en 60 s."); raise SystemExit(2)
        time.sleep(1)
    if not any(f"servidor MCP escuchando en 127.0.0.1:{puerto}/mcp" in l for l in leer()):
        print(f"NO SE PUDO MEDIR: esta Ü no abrió su MCP en {puerto}."); raise SystemExit(3)
    # Jev en frío cuesta 400-600 ms la primera vez: la medida empieza con él caliente, como en una sesión de verdad.
    t0 = time.time()
    while time.time() - t0 < 15 and not any("Jev caliente" in l or "no hay clave de Jev" in l for l in leer()):
        time.sleep(0.5)
    print(f"[{etiqueta}] arrancó · MCP en {puerto} · " + next((l.split("plan:")[1].strip() for l in leer() if "Jev caliente" in l), "SIN «Jev caliente» en el log"))

    if EDGE:
        perfil = os.path.join(r"C:\U-tmp", "edge-pruebas-" + etiqueta)
        edge = subprocess.Popen([MSEDGE, f"--user-data-dir={perfil}", "--no-first-run", "--no-default-browser-check",
                                 "--disable-features=msEdgeSidebarV2", "--new-window", EDGE])
        t0 = time.time()
        while time.time() - t0 < 20 and pid_de(u32.GetForegroundWindow()) != edge.pid:
            time.sleep(0.2)
        if pid_de(u32.GetForegroundWindow()) != edge.pid:
            print("NO SE PUDO MEDIR: el Edge de pruebas no quedó delante."); raise SystemExit(5)
        time.sleep(3)   # que termine de cargar la página
        print(f"[{etiqueta}] Edge de pruebas delante (PID {edge.pid}): «{titulo(u32.GetForegroundWindow())[:60]}»")

    if quieto_ms() < 3_000:
        print("NO SE PUDO MEDIR: la persona volvió al PC antes de mandar la orden."); raise SystemExit(4)
    marca = len(leer())
    vigilando.set()
    print(f"[{etiqueta}] → {orden}")
    reloj = time.time()
    mcp("u_orden", {"texto": orden})
    time.sleep(1.5)
    if not any("orden de prueba" in l for l in leer(marca)):
        print("NO SE PUDO MEDIR: la orden no llegó a ESTA Ü."); raise SystemExit(3)
    ultimo = time.time(); vistas = 0; acabo = None
    while time.time() - reloj < TOPE and not cortada and u.poll() is None:
        time.sleep(0.5)
        lineas = leer(marca)
        nuevas = sum(1 for l in lineas if re.search(r"voz-viva|mapa-mcp|plan:|mano:", l))
        if nuevas != vistas:
            vistas = nuevas; ultimo = time.time()
        termino = [l for l in lineas if '"type":"response.output_item.done"' in l and '"type":"message"' in l]
        if termino and time.time() - ultimo > 5:
            acabo = seg(termino[-1]); break
        if time.time() - ultimo > 30:
            break
    vigilando.clear()
    if u.poll() is None:
        try: mcp("u_colgar", {}, espera=20)
        except Exception as e: print(f"[{etiqueta}] u_colgar: {e}")
        time.sleep(3)
    lineas = leer(marca)

    # LA LÍNEA DE TIEMPO
    inicio = next((seg(l) for l in lineas if "orden de prueba" in l), None)
    print()
    for l in lineas:
        if re.search(r"llamada recibida:|plan: |mano: ⏱|mapa-mcp: ←|voz-turno: llamadas=|pantalla del pedido|sesión cerrada|el servidor dice|Ü dijo:", l):
            s = seg(l)
            print(f"  +{(s - inicio) if s is not None and inicio is not None else 0:>3} s  " + re.sub(r"^\[\d\d:\d\d:\d\d\] \[[^\]]+\] ", "", l)[:230])
    print()
    llamadas = [l.split("llamada recibida:")[1].strip() for l in lineas if "llamada recibida:" in l]
    jev = [float(m.group(1)) for l in lineas if "plan:" in l for m in [re.search(r"total (\d+(?:\.\d+)?) ms", l)] if m]
    pulso = [l for l in lineas if "plan:" in l and "· pulsé " in l]
    ciclos = [l for l in lineas if "mano: ⏱ ciclo" in l]
    planes = [l for l in lineas if "📋 plan de" in l]
    turno = next((l.split("voz-turno:")[1].strip() for l in reversed(lineas) if "voz-turno: llamadas=" in l), "sin línea de turno")
    print(f"[{etiqueta}] RESUMEN")
    print(f"    de la orden a la respuesta: {(acabo - inicio) if acabo and inicio else '— (no terminó dentro del tope)'} s")
    print(f"    llamadas de quien planea: {len(llamadas)} → " + ", ".join(f"{n}×{t}" for t, n in sorted({t: llamadas.count(t) for t in set(llamadas)}.items(), key=lambda x: -x[1])))
    print(f"    planes: {len(planes)} · vueltas de Jev: {len(jev)} (pulsó en {len(pulso)})" + (f" · mediana {sorted(jev)[len(jev)//2]:.0f} ms, de {min(jev):.0f} a {max(jev):.0f}" if jev else ""))
    print(f"    clics por el ciclo rápido: {len(ciclos)}")
    print(f"    el turno: {turno[:200]}")
    if cortada:
        print(f"    CORTADA POR EL VIGILANTE: {cortada[0]} — esta corrida no mide nada")
finally:
    fin.set()
    try:
        u.terminate(); u.wait(10)
    except Exception:
        try: u.kill()
        except Exception: pass
    if edge is not None:
        subprocess.run(["taskkill", "/pid", str(edge.pid), "/t", "/f"], capture_output=True)
        print(f"[{etiqueta}] cerrado el Edge de pruebas (PID {edge.pid})")
    for pid, nombre in procesos().items():
        if pid not in antes and nombre.lower() in ("calculatorapp.exe", "systemsettings.exe", "mspaint.exe"):
            subprocess.run(["taskkill", "/pid", str(pid), "/f"], capture_output=True)
            print(f"[{etiqueta}] cerrada {nombre} (PID {pid}), que abrió la prueba")
    nuevas = [h for h in ventanas() - ventanas_de_antes if u32.IsWindowVisible(wt.HWND(h)) and titulo(h)]
    for h in nuevas:
        print(f"[{etiqueta}] OJO, ventana nueva que sigue abierta: «{titulo(h)[:70]}» ({nombre_del_proceso(pid_de(h))})")
    p = el_log()
    if p:
        shutil.copy(p, os.path.join(datos, f"{etiqueta}.log"))
        print(f"[{etiqueta}] log copiado en {os.path.join(datos, etiqueta + '.log')}")
