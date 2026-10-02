"""
LA CLASE: ¿se le puede ENSEÑAR a Ü, hablando, a usar un sistema médico, y después lo usa sola?

    python ensenar.py <U.exe> <carpeta de datos NUEVA> <puerto> <etiqueta> [--solo-ensenar] [--guion archivo.json]

Es la demo, sin la persona: un sistema de registro de pacientes (his.html, servido aquí mismo) en un Edge de pruebas,
y una clase DICHA —cada frase se sintetiza a audio y entra por u_decir, el oído de prueba: la voz la oye, decide y
delega, que es el camino que una orden escrita se salta—. Antes de la frase que señala, el cursor se pone sobre el
elemento, como lo haría una persona.

    sesión 1, enseñar:  entrar a Pacientes › Nuevo paciente, llenar y guardar, clasificar el triage (señalando),
                        y «guarda esto como la habilidad de registrar un paciente»
    colgar              (lo que lanza el repaso)
    sesión 2, usar:     «registra a este paciente: …» con OTROS datos, sin repetirle un solo paso

LO QUE SE JUZGA no es lo que Ü dice. Es:
  · lo que el SISTEMA recibió (él mismo avisa de cada paciente guardado y cada triage confirmado),
  · lo que quedó en aprendido.json,
  · y el log: si cada frase hablada se delegó, si señalar llamó a map_pointing_at, con qué abrió la sesión 2.

Se corre con la persona FUERA del PC (mueve el cursor y pone ventanas delante). Cierra por PID lo que abrió.
"""
import ctypes, ctypes.wintypes as wt, glob, hashlib, http.server, io, json, os, re, socket, subprocess, sys, threading, time, urllib.request, winreg

sys.stdout.reconfigure(line_buffering=True)
args = sys.argv[1:]
SOLO_ENSENAR = "--solo-ensenar" in args
if SOLO_ENSENAR: args.remove("--solo-ensenar")
GUION = None
if "--guion" in args:
    i = args.index("--guion"); GUION = args[i + 1]; del args[i:i + 2]
exe, datos, puerto, etiqueta = args[0], args[1], int(args[2]), args[3]
AQUI = os.path.dirname(os.path.abspath(__file__))
SEMILLA = os.environ.get("U_NIVEL4_SEMILLA", r"C:\U-versiones\onda-datos\roaming\U\config.json")
MSEDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
FRASES = r"C:\U-tmp\frases-ensenar"
PUERTO_HIS = 8899
APRENDIDO = os.path.join(datos, "roaming", "U", "aprendido.json")
u32, k32 = ctypes.windll.user32, ctypes.windll.kernel32

# ── La clase. «senala» es el id del elemento de his.html sobre el que se pone el cursor antes de hablar. ──
CLASE = [
    dict(nombre="presentar", senala=None,
         dice="Te voy a enseñar a usar este sistema, que es el HIS de la clínica, donde registramos a los pacientes. Míralo bien."),
    dict(nombre="entrar", senala=None,
         dice="Para registrar un paciente nuevo, primero entra a Pacientes, en el menú de arriba, y después pulsa Nuevo paciente. Hazlo tú."),
    dict(nombre="llenar", senala=None,
         dice="Ahora llena el formulario. Tipo de documento, cédula de ciudadanía. Número de documento, 10 20 30 40 50. Nombres, Ana María. "
              "Apellidos, Gómez Ruiz. EPS, Sura. Motivo de consulta, dolor de cabeza. Y pulsa Guardar paciente."),
    dict(nombre="senalar", senala="nivel",
         dice="Mira esto que te estoy señalando con el mouse. Es el nivel de triage. Después de guardar un paciente siempre hay que clasificarlo. "
              "Cuando el motivo es un dolor leve, va en triage 4. Selecciónalo y confirma el triage."),
    dict(nombre="guardar", senala=None,
         dice="Muy bien. Guarda todo esto como la habilidad de registrar un paciente en el HIS, con todos los pasos y con la regla del triage."),
]
USO = [
    dict(nombre="usar", senala=None,
         dice="Registra a este paciente en el HIS. Se llama Carlos Andrés Pérez Londoño, cédula de ciudadanía 71 22 33 44, es de Nueva EPS, "
              "y viene por un dolor leve de rodilla."),
]
if GUION:
    g = json.load(io.open(GUION, encoding="utf-8"))
    CLASE, USO = g.get("clase", CLASE), g.get("uso", USO)


# ── El sistema médico: sirve his.html y apunta lo que el sistema recibe ──
recibido = []


class His(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def do_GET(self):
        cuerpo = io.open(os.path.join(AQUI, "his.html"), "rb").read()
        self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8"); self.send_header("Content-Length", str(len(cuerpo))); self.end_headers()
        self.wfile.write(cuerpo)

    def do_POST(self):
        n = int(self.headers.get("Content-Length", "0"))
        try: dato = json.loads(self.rfile.read(n).decode("utf-8"))
        except Exception: dato = {}
        recibido.append((time.time(), self.path, dato))
        self.send_response(204); self.end_headers()


servidor = http.server.ThreadingHTTPServer(("127.0.0.1", PUERTO_HIS), His)
threading.Thread(target=servidor.serve_forever, daemon=True).start()


def del_sistema(ruta, desde=0.0):
    return [d for t, r, d in recibido if r == ruta and t >= desde]


def geometria():
    geos = [d.get("geo") for _, r, d in recibido if r == "/api/vista" and d.get("geo")]
    return geos[-1] if geos else {}


# ── Windows ──
class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]


def quieto_ms():
    li = LASTINPUTINFO(); li.cbSize = ctypes.sizeof(li); u32.GetLastInputInfo(ctypes.byref(li))
    return k32.GetTickCount() - li.dwTime


def pid_de(h):
    pid = wt.DWORD(); u32.GetWindowThreadProcessId(wt.HWND(h), ctypes.byref(pid)); return pid.value


def texto_de(fn, h, n=300):
    b = ctypes.create_unicode_buffer(n); fn(wt.HWND(h), b, n); return b.value


class PROCESSENTRY32W(ctypes.Structure):
    _fields_ = [("dwSize", wt.DWORD), ("cntUsage", wt.DWORD), ("th32ProcessID", wt.DWORD), ("th32DefaultHeapID", ctypes.c_size_t),
                ("th32ModuleID", wt.DWORD), ("cntThreads", wt.DWORD), ("th32ParentProcessID", wt.DWORD), ("pcPriClassBase", ctypes.c_long),
                ("dwFlags", wt.DWORD), ("szExeFile", ctypes.c_wchar * 260)]


def procesos():
    k32.CreateToolhelp32Snapshot.restype = wt.HANDLE
    foto = k32.CreateToolhelp32Snapshot(0x2, 0); vivos = []
    e = PROCESSENTRY32W(); e.dwSize = ctypes.sizeof(e)
    sigue = k32.Process32FirstW(wt.HANDLE(foto), ctypes.byref(e))
    while sigue:
        vivos.append((e.th32ProcessID, e.th32ParentProcessID, e.szExeFile)); sigue = k32.Process32NextW(wt.HANDLE(foto), ctypes.byref(e))
    k32.CloseHandle(wt.HANDLE(foto))
    return vivos


def familia_de(raiz, sin):
    padres = {p: pp for p, pp, _ in procesos() if p not in sin}
    familia = {raiz}; crecio = True
    while crecio:
        crecio = False
        for p, pp in padres.items():
            if pp in familia and p not in familia: familia.add(p); crecio = True
    return familia


def ventanas():
    todas = []
    @ctypes.WINFUNCTYPE(ctypes.c_bool, wt.HWND, wt.LPARAM)
    def cada(h, _):
        todas.append(h); return True
    u32.EnumWindows(cada, 0)
    return todas


def traer_al_frente(h):
    for intento in range(3):
        delante = u32.GetForegroundWindow()
        if delante == h: return True
        mio, suyo = k32.GetCurrentThreadId(), u32.GetWindowThreadProcessId(wt.HWND(delante), None)
        unido = suyo and suyo != mio and u32.AttachThreadInput(mio, suyo, True)
        try:
            u32.ShowWindow(wt.HWND(h), 3); u32.SetForegroundWindow(wt.HWND(h)); u32.BringWindowToTop(wt.HWND(h))
            if intento == 2: u32.SwitchToThisWindow(wt.HWND(h), True)
        finally:
            if unido: u32.AttachThreadInput(mio, suyo, False)
        time.sleep(0.4)
    return u32.GetForegroundWindow() == h


def mcp(herramienta, argumentos, espera=20):
    cuerpo = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": herramienta, "arguments": argumentos}}).encode("utf-8")
    r = urllib.request.Request(f"http://127.0.0.1:{puerto}/mcp/", data=cuerpo, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r, timeout=espera) as resp:
        return resp.read().decode("utf-8", "replace")


# ── La voz de la persona: cada frase, sintetizada una vez ──
def clave_de_openai():
    k = os.environ.get("OPENAI_API_KEY", "")
    if not k:
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as r: k = winreg.QueryValueEx(r, "OPENAI_API_KEY")[0]
        except OSError: k = ""
    return k


def sintetizar(frase):
    os.makedirs(FRASES, exist_ok=True)
    archivo = os.path.join(FRASES, hashlib.sha256(frase.encode("utf-8")).hexdigest()[:16] + ".pcm")
    if os.path.exists(archivo) and os.path.getsize(archivo) > 1000: return archivo
    for modelo in ("gpt-4o-mini-tts", "tts-1"):
        cuerpo = json.dumps({"model": modelo, "voice": "onyx", "input": frase, "response_format": "pcm"}).encode("utf-8")
        r = urllib.request.Request("https://api.openai.com/v1/audio/speech", data=cuerpo,
                                   headers={"Content-Type": "application/json", "Authorization": "Bearer " + clave_de_openai()})
        try:
            with urllib.request.urlopen(r, timeout=90) as resp: pcm = resp.read()
            io.open(archivo, "wb").write(pcm); return archivo
        except Exception as e: print(f"  (síntesis con {modelo}: {e})")
    raise SystemExit("NO SE PUDO MEDIR: no pude sintetizar la voz de la persona.")


# ── La Ü de pruebas y su log ──
PID = None


def leer(desde=0):
    logs = sorted(glob.glob(os.path.join(datos, "local", "U", "logs", f"u-*-p{PID}-*.log")), key=os.path.getmtime)
    if not logs: return []
    with io.open(logs[-1], encoding="utf-8", errors="replace") as f: return f.read().splitlines()[desde:]


def seg(l):
    m = re.match(r"\[(\d\d):(\d\d):(\d\d)\]", l)
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3)) if m else None


def decir(paso, tope=150):
    """Una frase hablada: el cursor donde señala, el audio por u_decir, y la espera hasta que Ü termina con ella."""
    archivo = sintetizar(paso["dice"])
    if paso.get("senala"):
        g = geometria().get(paso["senala"])
        if g:
            u32.SetCursorPos(int(g["x"]), int(g["y"])); time.sleep(0.2)
            u32.SetCursorPos(int(g["x"]) + 2, int(g["y"]) + 1); time.sleep(0.4)   # un movimiento: una persona no se teletransporta
        else: print(f"  (no sé dónde está «{paso['senala']}» en la pantalla: no señalo)")
    elif u32.GetForegroundWindow():
        u32.SetCursorPos(60, 400)   # el cursor fuera del sistema: lo que no se señala no se señala
    marca = len(leer()); t0 = time.time()
    print(f"\n[{etiqueta}] ── {paso['nombre']} → «{paso['dice']}»" + (f"  (señalando «{paso['senala']}»)" if paso.get("senala") else ""))
    mcp("u_decir", {"archivo": archivo})
    dicho = None; ultimo = time.time(); vistas = 0
    while time.time() - t0 < tope:
        time.sleep(0.5)
        lineas = leer(marca)
        if dicho is None and any("u_decir: dicho" in l for l in lineas): dicho = time.time()
        if any("u_decir falló" in l or "u_decir: la " in l for l in lineas): break
        n = sum(1 for l in lineas if re.search(r"voz-viva|mapa-mcp|plan:|mano:|meta:|aprendido", l))
        if n != vistas: vistas = n; ultimo = time.time()
        # NO SE CUELGA A MEDIAS. La voz delega 3–4 s después de que la persona calla, y un plan de trece pasos pasa más
        # de diez segundos sin escribir una línea: la primera versión de esta espera colgó con el plan corriendo y dio
        # por no hecho lo que sí se hizo. Termina cuando Ü ya contestó algo, no queda ninguna llamada a medias, y lleva
        # diez segundos quieta; o a los 35 s de haber hablado sin que nadie conteste.
        a_medias = sum(1 for l in lineas if "mapa-mcp: →" in l) - sum(1 for l in lineas if "mapa-mcp: ←" in l)
        contesto = any("session.delegation.created" in l or "Ü dijo:" in l for l in lineas)
        if dicho and a_medias <= 0 and ((contesto and time.time() - max(ultimo, dicho) > 10) or (not contesto and time.time() - dicho > 35)): break
    lineas = leer(marca)
    llamadas = [l.split("llamada recibida:")[1].strip() for l in lineas if "llamada recibida:" in l]
    r = dict(nombre=paso["nombre"], segundos=round(time.time() - t0 - 10), delegaciones=sum(1 for l in lineas if "session.delegation.created" in l),
             llamadas=llamadas, dijo=[l.split("Ü dijo:", 1)[1].strip() for l in lineas if "Ü dijo:" in l],
             oyo=[l.split("Tú dijiste:", 1)[1].strip() for l in lineas if "Tú dijiste:" in l], desde=t0,
             fallos=[re.sub(r"^\[\d\d:\d\d:\d\d\] \[[^\]]+\] ", "", l)[:200] for l in lineas if re.search(r"✘|no pude|falló|expired|sesión cerrada|Host desconocido", l)])
    for l in lineas:
        if re.search(r"llamada recibida:|plan: 📋|meta: |aprendido:|Ü dijo:|Tú dijiste:|mapa-mcp: → (map_pointing_at|habilidad|preferencia)|✘", l):
            s = seg(l); s0 = seg(lineas[0]) if lineas else None
            print(f"  +{(s - s0) if s is not None and s0 is not None else 0:>3} s  " + re.sub(r"^\[\d\d:\d\d:\d\d\] \[[^\]]+\] ", "", l)[:230])
    print(f"  = {r['segundos']} s · {r['delegaciones']} delegación(es) · {len(llamadas)} llamada(s): {', '.join(llamadas) or 'ninguna'}")
    return r


def colgar():
    try: mcp("u_colgar", {}, espera=25)
    except Exception as e: print(f"[{etiqueta}] u_colgar: {e}")
    # EL REPASO corre al colgar: se le espera, que es parte de aprender.
    t = time.time()
    while time.time() - t < 90:
        time.sleep(2)
        if any("repaso: sesión" in l or "NO se repasó" in l or "repaso: nada" in l for l in leer()[-80:]): break


def habilidades():
    try: d = json.load(io.open(APRENDIDO, encoding="utf-8-sig"))
    except Exception: return []
    hs = d.get("Habilidades") or d.get("habilidades") or []
    return hs if isinstance(hs, list) else list(hs.values())


def sin_tildes(t):
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", str(t).lower()) if unicodedata.category(c) != "Mn")


# ── La corrida ──
t0 = time.time()
while quieto_ms() < 20_000:
    if time.time() - t0 > 600: print("NO SE PUDO MEDIR: el PC no estuvo quieto 20 s en diez minutos."); sys.exit(4)
    time.sleep(2)
if not clave_de_openai(): print("NO SE PUDO MEDIR: falta OPENAI_API_KEY."); sys.exit(5)
for paso in CLASE + USO: sintetizar(paso["dice"])
print(f"[{etiqueta}] la voz de la persona: {len(CLASE + USO)} frases sintetizadas en {FRASES}")

os.makedirs(os.path.join(datos, "roaming", "U"), exist_ok=True); os.makedirs(os.path.join(datos, "feed"), exist_ok=True)
cfg = json.load(io.open(SEMILLA, encoding="utf-8-sig"))
cfg["UpdateFeedUrl"] = os.path.join(datos, "feed"); cfg["Perfil"] = os.environ.get("U_NIVEL4_PERFIL", "persona")
json.dump(cfg, io.open(os.path.join(datos, "roaming", "U", "config.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)


def libre(p):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try: s.bind(("127.0.0.1", p)); return True
        except OSError: return False


while not libre(puerto): puerto += 1
antes = {p for p, _, _ in procesos()}
cursor = wt.POINT(); u32.GetCursorPos(ctypes.byref(cursor))
entorno = dict(os.environ, U_DATA_DIR=datos, U_MCP_PUERTO=str(puerto), U_ORDENES_DE_PRUEBA="1")
u = subprocess.Popen([exe], env=entorno, cwd=os.path.dirname(exe)); PID = u.pid
perfil = os.path.join(r"C:\U-tmp", f"edge-pruebas-{etiqueta}-his")
edge = subprocess.Popen([MSEDGE, f"--user-data-dir={perfil}", "--no-first-run", "--no-default-browser-check", "--disable-features=msEdgeSidebarV2",
                         "--start-maximized", "--new-window", f"http://127.0.0.1:{PUERTO_HIS}/"])
fin = threading.Event(); cortada = []; vigilando = threading.Event()


def edge_pids(): return familia_de(edge.pid, antes)


def vigilante():
    while not fin.is_set():
        time.sleep(0.05)
        if not vigilando.is_set(): continue
        h = u32.GetForegroundWindow()
        if not h: continue
        pid = pid_de(h)
        if pid in (PID, os.getpid()) or pid not in antes: continue
        cortada.append(f"pasó al frente «{texto_de(u32.GetWindowTextW, h)[:60]}» (PID {pid}), que ya estaba antes de la prueba")
        vigilando.clear()
        try: u.kill()
        except Exception: pass


threading.Thread(target=vigilante, daemon=True).start()
resultados = {}
try:
    t0 = time.time()
    while not any("atajo: doble Ctrl" in l for l in leer()):
        if time.time() - t0 > 60: print("NO SE PUDO MEDIR: la Ü de pruebas no arrancó en 60 s."); raise SystemExit(2)
        time.sleep(1)
    time.sleep(6)
    t0 = time.time(); delante = False
    while time.time() - t0 < 25 and not delante:
        for h in ventanas():
            if pid_de(h) in edge_pids() and u32.IsWindowVisible(wt.HWND(h)) and texto_de(u32.GetClassNameW, h, 100) == "Chrome_WidgetWin_1" and "HIS" in texto_de(u32.GetWindowTextW, h):
                delante = traer_al_frente(h); break
        time.sleep(0.5)
    if not delante: print("NO SE PUDO MEDIR: el sistema médico no quedó delante."); raise SystemExit(3)
    time.sleep(3)
    print(f"[{etiqueta}] Ü de pruebas PID {PID} · MCP {puerto} · el HIS delante · geometría: {geometria()}")
    vigilando.set()

    inicio1 = time.time()
    for paso in CLASE:
        if cortada or u.poll() is not None: break
        resultados[paso["nombre"]] = decir(paso)
    vigilando.clear()
    if u.poll() is None: colgar()
    hs1 = habilidades()
    print(f"\n[{etiqueta}] tras la clase, aprendido.json trae {len(hs1)} habilidad(es):")
    for h in hs1: print("   " + json.dumps(h, ensure_ascii=False)[:900])

    inicio2 = time.time()
    if not SOLO_ENSENAR and u.poll() is None and not cortada:
        time.sleep(4); vigilando.set()
        for paso in USO:
            resultados[paso["nombre"]] = decir(paso, tope=240)
        vigilando.clear()
        abrio = [l for l in leer() if "instrucciones de quien actúa" in l]
        resultados["apertura2"] = abrio[-1].split("instrucciones de quien actúa:")[1].strip() if abrio else ""
        if u.poll() is None: colgar()
finally:
    fin.set()
    try: u.terminate(); u.wait(10)
    except Exception:
        try: u.kill()
        except Exception: pass
    for pid in edge_pids(): subprocess.run(["taskkill", "/pid", str(pid), "/f"], capture_output=True)
    u32.SetCursorPos(cursor.x, cursor.y)
    servidor.shutdown()

    # ── LA MEDICIÓN: nueve comprobaciones, cada una contra algo que no es la palabra de Ü ──
    def campo(p, c): return sin_tildes(p.get(c, ""))
    pacientes = del_sistema("/api/pacientes"); triages = del_sistema("/api/triage"); vistas = [d.get("vista") for d in del_sistema("/api/vista")]
    p1 = next((p for p in pacientes if re.sub(r"\D", "", p.get("documento", "")) == "1020304050"), None)
    p2 = next((p for p in pacientes if re.sub(r"\D", "", p.get("documento", "")) == "71223344"), None)
    t1 = next((t for t in triages if re.sub(r"\D", "", t.get("documento", "")) == "1020304050"), None)
    t2 = next((t for t in triages if re.sub(r"\D", "", t.get("documento", "")) == "71223344"), None)
    hs = habilidades()
    todo = sin_tildes(json.dumps(hs, ensure_ascii=False))
    habladas = [resultados[p["nombre"]] for p in CLASE + USO if p["nombre"] in resultados]
    pruebas = [
        ("cada frase hablada se delegó (la voz no se quedó con ella)", all(r["delegaciones"] >= 1 for r in habladas if r["nombre"] != "presentar") and len(habladas) >= len(CLASE),
         ", ".join(f"{r['nombre']}={r['delegaciones']}" for r in habladas)),
        ("al pedírselo, entró a Paciente nuevo", "nuevo" in vistas, f"vistas: {' → '.join(v for v in vistas if v)}"),
        ("llenó y guardó a la paciente de la clase, con sus datos", bool(p1) and "ana" in campo(p1, "nombres") and "gomez" in campo(p1, "apellidos") and campo(p1, "eps") == "sura" and "cedula de ciudadania" in campo(p1, "tipo"),
         json.dumps(p1, ensure_ascii=False) if p1 else f"el sistema recibió: {json.dumps(pacientes, ensure_ascii=False)[:300]}"),
        ("señalar sirvió: miró lo señalado (map_pointing_at) y clasificó en triage 4", "senalar" in resultados and "map_pointing_at" in resultados["senalar"]["llamadas"] and bool(t1) and "triage 4" in sin_tildes(t1.get("triage", "")),
         f"llamadas: {resultados.get('senalar', {}).get('llamadas')} · triage: {t1}"),
        ("quedó UNA habilidad, con sus pasos", len(hs) == 1 and len(json.dumps(hs[0], ensure_ascii=False)) > 200, f"{len(hs)} habilidad(es)"),
        ("la habilidad trae lo enseñado: Pacientes, Nuevo paciente, Guardar paciente y la regla del triage",
         all(x in todo for x in ("pacientes", "nuevo paciente", "guardar paciente", "triage")) and ("4" in todo or "cuatro" in todo), todo[:400]),
    ]
    if not SOLO_ENSENAR:
        pruebas += [
            ("la sesión siguiente abrió con lo aprendido", bool(re.search(r"[1-9]\d* de lo aprendido", str(resultados.get("apertura2", "")))), str(resultados.get("apertura2", ""))[:160]),
            ("sin repetirle un paso, registró al paciente nuevo con SUS datos", bool(p2) and "carlos" in campo(p2, "nombres") and "perez" in campo(p2, "apellidos") and campo(p2, "eps") == "nueva eps" and "cedula de ciudadania" in campo(p2, "tipo"),
             json.dumps(p2, ensure_ascii=False) if p2 else f"el sistema recibió: {json.dumps(pacientes, ensure_ascii=False)[:300]}"),
            ("y aplicó la regla enseñada: dolor leve → triage 4, confirmado", bool(t2) and "triage 4" in sin_tildes(t2.get("triage", "")), str(t2)),
        ]
    print(f"\n[{etiqueta}] LA MEDICIÓN" + (f"  (CORTADA: {cortada[0]})" if cortada else ""))
    for que, ok, detalle in pruebas: print(f"  {'✔' if ok else '✘'} {que}\n      {detalle}")
    for r in habladas:
        print(f"  · {r['nombre']}: {r['segundos']} s · Ü dijo: {' | '.join(r['dijo'])[:260] or '(nada)'}")
        for f in r["fallos"][:4]: print(f"      ! {f}")
    rechazos = del_sistema("/api/rechazo")
    if rechazos: print(f"  · el sistema rechazó {len(rechazos)} guardado(s): {json.dumps(rechazos, ensure_ascii=False)[:300]}")
    buenas = sum(1 for _, ok, _ in pruebas if ok)
    print(f"\n  LA CLASE: {buenas} de {len(pruebas)}" + ("  — TODO BIEN" if buenas == len(pruebas) else ""))
    print(f"  logs en {datos}")
