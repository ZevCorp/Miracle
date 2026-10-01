"""
EL NIVEL 4 DE LA VOZ, SIN MANOS Y SIN SONAR: arranca una Ü de pruebas junto a la del dueño (otra carpeta,
otro puerto de MCP, sus propios datos), le manda órdenes por u_orden —el camino de lo escrito en el chat:
voz, delegado, manos— y lee de SU log la línea voz-turno de cada pedido.

    python nivel4.py <U.exe> <carpeta de datos> <puerto desde el que buscar uno libre> <etiqueta> "orden 1" "orden 2" ...

- En modo texto la voz no suena y no abre el micrófono. Por eso mismo NO prueba que la voz hable mientras
  se trabaja: sin micrófono no se le cuenta nada (promesa 755). Eso lo mide sondas/DeLaVoz.
- Solo arranca con el PC quieto, y cierra por PID lo que ella misma abrió.
- U_NIVEL4_SEMILLA: una config.json con correo, nombre y «PresentacionHecha». Sin correo la Ü se queda en la
  bienvenida y no llega a abrir el MCP.
- El resultado y una copia del log quedan en la carpeta de datos.
"""
import ctypes, io, json, os, re, subprocess, sys, time, urllib.request, glob, shutil

exe, datos, puerto, etiqueta = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
ordenes = sys.argv[5:]
SEMILLA = os.environ.get("U_NIVEL4_SEMILLA", r"C:\U-versiones\onda-datos\roaming\U\config.json")
APPS = ("CalculatorApp.exe", "SystemSettings.exe", "notepad.exe", "Notepad.exe", "mspaint.exe")


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


PID = None   # el log es EL DE ESTA instancia: una corrida anterior deja el suyo en la misma carpeta


def el_log():
    logs = sorted(glob.glob(os.path.join(datos, "local", "U", "logs", f"u-*-p{PID}-*.log")), key=os.path.getmtime)
    return logs[-1] if logs else None


def leer(desde=0):
    p = el_log()
    if not p:
        return []
    with io.open(p, encoding="utf-8", errors="replace") as f:
        return f.read().splitlines()[desde:]


# ── el PC quieto ──
t0 = time.time()
while quieto_ms() < 20_000:
    if time.time() - t0 > 600:
        print("NO SE PUDO PROBAR: el PC no estuvo quieto 20 s en diez minutos."); sys.exit(4)
    time.sleep(2)

# ── los datos, sembrados ──
os.makedirs(os.path.join(datos, "roaming", "U"), exist_ok=True)
os.makedirs(os.path.join(datos, "feed"), exist_ok=True)
cfg = json.load(io.open(SEMILLA, encoding="utf-8-sig"))
cfg["UpdateFeedUrl"] = os.path.join(datos, "feed")
json.dump(cfg, io.open(os.path.join(datos, "roaming", "U", "config.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# EL PUERTO TIENE QUE SER MIO. El 2026-10-01 otra U de pruebas ya escuchaba en el que elegi, la mia no pudo
# abrir su MCP, y mis ordenes las cumplio la de otra sesion. Se busca uno libre y se exige verlo en MI log.
import socket
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

resultado = {"etiqueta": etiqueta, "exe": exe, "pedidos": []}
try:
    t0 = time.time()
    while not any("atajo: doble Ctrl" in l for l in leer()):
        if time.time() - t0 > 60:
            print("NO SE PUDO PROBAR: la Ü de pruebas no terminó de arrancar en 60 s."); raise SystemExit(2)
        time.sleep(1)
    print(f"[{etiqueta}] arrancó en {time.time() - t0:.0f} s · log {el_log()}")
    if not any(f"servidor MCP escuchando en 127.0.0.1:{puerto}/mcp" in l for l in leer()):
        print(f"NO SE PUDO PROBAR: esta Ü no abrió su MCP en {puerto}: " + " | ".join(l for l in leer() if " mcp: " in l)); raise SystemExit(3)
    print(f"[{etiqueta}] su MCP escucha en {puerto}")

    for orden in ordenes:
        marca = len(leer())
        print(f"[{etiqueta}] → {orden}")
        mcp("u_orden", {"texto": orden})
        time.sleep(1.5)
        if not any("orden de prueba" in l for l in leer(marca)):
            print(f"NO SE PUDO PROBAR: la orden no llegó a ESTA Ü (no está en su log)."); raise SystemExit(3)
        # TERMINÓ cuando hubo actividad y el log lleva 12 s sin nada nuevo de la voz ni de las manos; tope 150 s.
        t0 = time.time(); ultimo = time.time(); vistas = 0
        while time.time() - t0 < 150:
            time.sleep(1)
            nuevas = [l for l in leer(marca) if re.search(r"voz-viva|mapa-mcp|plan:|mano:|voz-turno", l)]
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
        time.sleep(2)
        lineas = leer(marca)
        pedido = {
            "orden": orden,
            "turno": [l for l in lineas if "voz-turno: llamadas=" in l],
            "abrio": [l for l in lineas if "sesión abierta" in l][:1],
            "avances": [l for l in lineas if "avance a la voz" in l],
            "llamadas": [l for l in lineas if "llamada recibida" in l],
            "dijo": [l for l in lineas if "Ü dijo:" in l],
            "errores": [l for l in lineas if "el servidor dice" in l or "no se pudo abrir" in l or "fatal:" in l],
            "plan": [l for l in lineas if " plan: " in l],
        }
        resultado["pedidos"].append(pedido)
        for k in ("abrio", "llamadas", "avances", "plan", "dijo", "turno", "errores"):
            for l in pedido[k]:
                print(f"    {l[:260]}")
        time.sleep(3)
finally:
    try:
        u.terminate(); u.wait(10)
    except Exception:
        try: u.kill()
        except Exception: pass
    # LO QUE ABRIÓ LA PRUEBA, y solo eso: lo que ya estaba abierto antes es del dueño.
    for pid, nombre in procesos().items():
        if pid not in antes:
            subprocess.run(["taskkill", "/pid", str(pid), "/f"], capture_output=True)
            print(f"[{etiqueta}] cerrada {nombre} (PID {pid}), que abrió la prueba")
    destino = os.path.join(datos, f"{etiqueta}.json")
    json.dump(resultado, io.open(destino, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    p = el_log()
    if p:
        shutil.copy(p, os.path.join(datos, f"{etiqueta}.log"))
    print(f"[{etiqueta}] resultado en {destino}")
