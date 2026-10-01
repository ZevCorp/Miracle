"""
EL NIVEL 4 DE LA SPEC 078, SIN MANOS: ¿ve quien actúa la pantalla del pedido sin gastar una vuelta en pedirla?

    python vista.py <U.exe> <carpeta de datos NUEVA> <puerto desde el que buscar uno libre> <etiqueta>

Arranca una Ü de pruebas con sus propios datos y le manda por u_orden —el camino de lo escrito— tres sesiones:

    1. «abre la calculadora y escribe 12*12=»      → deja un 144 en pantalla
    2. «¿qué número se ve ahora en la calculadora?» → lo contesta SIN llamar a ninguna herramienta: lo vio
    3. «¿qué día es hoy?»                           → lo sabe, sin abrir nada para averiguarlo

Lo que se juzga sale del log de ESA Ü: la línea «pantalla del pedido mandada», las llamadas que hizo quien
actúa, lo que contestó, y que al colgar cada copia subida se borró de OpenAI y no quedó ninguna apuntada.

- En modo texto la pantalla se manda ANTES que el texto, esperándola. Con el micrófono sube mientras la persona
  habla: eso no lo prueba este arnés.
- Solo usa la Calculadora, que abre ella y cierra ella. Nada que escriba en una app de la persona.
- Solo arranca con el PC quieto, y cierra por PID lo que ella misma abrió.
"""
import ctypes, glob, io, json, os, re, shutil, socket, subprocess, sys, time, urllib.request

exe, datos, puerto, etiqueta = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
SEMILLA = os.environ.get("U_NIVEL4_SEMILLA", r"C:\U-versiones\onda-datos\roaming\U\config.json")
APPS = ("CalculatorApp.exe",)
COPIAS = os.path.join(datos, "local", "U", "copias-por-borrar.json")


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


VEREDICTOS = []


def juzga(que, vale, detalle=""):
    VEREDICTOS.append((que, bool(vale)))
    print(f"    {'✔' if vale else '✘'} {que}" + (f"  — {detalle}" if detalle and not vale else ""))


def sesion(orden, tope=120):
    marca = len(leer())
    print(f"[{etiqueta}] → {orden}")
    mcp("u_orden", {"texto": orden})
    time.sleep(1.5)
    if not any("orden de prueba" in l for l in leer(marca)):
        print("NO SE PUDO PROBAR: la orden no llegó a ESTA Ü (no está en su log)."); raise SystemExit(3)
    t0 = time.time(); ultimo = time.time(); vistas = 0
    while time.time() - t0 < tope:
        time.sleep(1)
        nuevas = [l for l in leer(marca) if re.search(r"voz-viva|mapa-mcp|plan:|mano:|voz-turno", l)]
        if len(nuevas) != vistas:
            vistas = len(nuevas); ultimo = time.time()
        abrio = any("sesión abierta" in l or "no se pudo abrir" in l or "el servidor dice" in l for l in nuevas)
        termino = any('"type":"response.output_item.done"' in l and '"type":"message"' in l for l in leer(marca))
        if abrio and ((termino and time.time() - ultimo > 4) or time.time() - ultimo > 25):
            break
    try:
        mcp("u_colgar", {}, espera=20)
    except Exception as e:
        print(f"[{etiqueta}] u_colgar: {e}")
    time.sleep(5)   # al colgar se borran las copias y se lanza el repaso
    lineas = leer(marca)
    for l in lineas:
        if re.search(r"pantalla del pedido|instrucciones de quien actúa|llamada recibida|Ü dijo:| plan: 📋|mirada (subida|borrada)|no pude borrar|el servidor dice|voz-turno: llamadas=", l):
            print(f"    {l[:280]}")
    return lineas


def llamadas(lineas):
    return [l.split("llamada recibida:")[1].strip() for l in lineas if "llamada recibida:" in l]


t0 = time.time()
while quieto_ms() < 20_000:
    if time.time() - t0 > 600:
        print("NO SE PUDO PROBAR: el PC no estuvo quieto 20 s en diez minutos."); sys.exit(4)
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

    # 1. DEJAR ALGO EN PANTALLA
    l1 = sesion("abre la calculadora y escribe 12*12=")
    juzga("1. con el pedido viajó la pantalla de ese momento", any("pantalla del pedido mandada" in l for l in l1))
    juzga("1. y la copia se borró de OpenAI al colgar", any("mirada borrada de OpenAI" in l for l in l1), " | ".join(l for l in l1 if "mirada" in l)[:300])

    # 2. LO QUE SE VE, SIN PEDIR MIRAR
    l2 = sesion("¿qué número se ve ahora mismo en la calculadora? Dime solo el número.")
    juzga("2. con el pedido viajó la pantalla", any("pantalla del pedido mandada" in l for l in l2))
    pedidas = llamadas(l2)
    juzga("2. quien actúa contestó SIN llamar a ninguna herramienta: lo vio en la foto", len(pedidas) == 0, "llamó a: " + ", ".join(pedidas))
    dicho = " ".join(l for l in l2 if "Ü dijo:" in l or "output_text" in l)
    juzga("2. y contestó 144", "144" in dicho, dicho[-300:])
    turno = [l for l in l2 if "voz-turno: llamadas=" in l]
    print("    (el turno: " + (turno[-1].split("voz-turno:")[1].strip()[:160] if turno else "sin línea de turno") + ")")

    # 3. LA FECHA
    l3 = sesion("¿qué día de la semana es hoy y qué fecha? Contesta en una frase.")
    juzga("3. sabe qué día es sin abrir nada para averiguarlo", len(llamadas(l3)) == 0, "llamó a: " + ", ".join(llamadas(l3)))
    dias = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
    hoy = dias[time.localtime().tm_wday]
    dicho = " ".join(l for l in l3 if "Ü dijo:" in l or "output_text" in l).lower()
    juzga(f"3. y dice que hoy es {hoy}", hoy in dicho, dicho[-300:])

    pendientes = json.load(io.open(COPIAS, encoding="utf-8")) if os.path.exists(COPIAS) else []
    juzga("y no queda ninguna copia apuntada sin borrar", len(pendientes) == 0, json.dumps(pendientes)[:200])
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
    bien = sum(1 for _, v in VEREDICTOS if v)
    print(f"[{etiqueta}] {bien} de {len(VEREDICTOS)} comprobaciones bien · log copiado en {os.path.join(datos, etiqueta + '.log')}")
