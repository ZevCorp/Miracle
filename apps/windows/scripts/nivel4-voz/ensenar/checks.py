"""
LOS CHECKS: ¿el ✓ de una sección dispara lo que Ü aprendió? (spec 084)

    python checks.py <U.exe> <carpeta de datos NUEVA> <puerto> <etiqueta> <aprendido.json con la habilidad ya enseñada>

Parte de una Ü que YA sabe «registrar un paciente en el HIS» (el aprendido.json que deja ensenar.py), y hace lo que
haría la persona en la nota, por las órdenes de prueba u_nota (el ✓) y u_aprobar (el botón):

    A. ✓ en una sección con un paciente   → propone UNA acción con esa habilidad → aprobar → el HIS lo recibe, triage 4
    B. ✓ en una sección que no es de nada → dice que no hay acción, y no propone
    C. «Ejecutar todo» con dos secciones  → UNA acción en común → aprobar → el HIS recibe al segundo paciente
    D. colgar                             → el indicador carga y termina (lo dice el log)
    E. una Ü que no sabe nada             → ✓ contesta sin llamar al modelo

LO QUE SE JUZGA no es lo que Ü dice: es lo que el SISTEMA recibió, lo que u_nota devuelve y el log.
Se corre con la persona FUERA del PC. Cierra por PID lo que abrió.
"""
import ctypes, ctypes.wintypes as wt, glob, http.server, io, json, os, re, shutil, socket, subprocess, sys, threading, time, urllib.request

sys.stdout.reconfigure(line_buffering=True)
exe, datos, puerto, etiqueta, semilla_aprendido = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4], sys.argv[5]
AQUI = os.path.dirname(os.path.abspath(__file__))
SEMILLA = os.environ.get("U_NIVEL4_SEMILLA", r"C:\U-versiones\onda-datos\roaming\U\config.json")
MSEDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PUERTO_HIS = 8899
u32, k32 = ctypes.windll.user32, ctypes.windll.kernel32

SECCION_A = ("DATOS DEL PACIENTE\nLaura Sofía Martínez Rojas, cédula de ciudadanía 52 33 44 55, afiliada a Sanitas. "
             "Consulta por un dolor leve de tobillo desde ayer.")
SECCION_B = "PENDIENTES DE LA SEMANA\nComprar pan, llamar al contador y pagar el arriendo el viernes."
TODO_C = ("DATOS DEL PACIENTE\nJuan Esteban Ríos Mejía, cédula de ciudadanía 80 11 22 33, EPS Sura.\n\n"
          "MOTIVO DE CONSULTA\nDolor leve de espalda.")

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


def del_sistema(ruta): return [d for _, r, d in recibido if r == ruta]


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


def mcp(p, herramienta, argumentos, espera=120):
    cuerpo = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": herramienta, "arguments": argumentos}}).encode("utf-8")
    r = urllib.request.Request(f"http://127.0.0.1:{p}/mcp/", data=cuerpo, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r, timeout=espera) as resp:
        crudo = resp.read().decode("utf-8", "replace")
    try:
        d = json.loads(crudo)
        return "\n".join(c.get("text", "") for c in d.get("result", {}).get("content", [])) or crudo
    except Exception: return crudo


def leer(carpeta, pid, desde=0):
    logs = sorted(glob.glob(os.path.join(carpeta, "local", "U", "logs", f"u-*-p{pid}-*.log")), key=os.path.getmtime)
    if not logs: return []
    with io.open(logs[-1], encoding="utf-8", errors="replace") as f: return f.read().splitlines()[desde:]


def sin_tildes(t):
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", str(t).lower()) if unicodedata.category(c) != "Mn")


def libre(p):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try: s.bind(("127.0.0.1", p)); return True
        except OSError: return False


def sembrar(carpeta, aprendido):
    os.makedirs(os.path.join(carpeta, "roaming", "U"), exist_ok=True); os.makedirs(os.path.join(carpeta, "feed"), exist_ok=True)
    cfg = json.load(io.open(SEMILLA, encoding="utf-8-sig"))
    cfg["UpdateFeedUrl"] = os.path.join(carpeta, "feed"); cfg["Perfil"] = os.environ.get("U_NIVEL4_PERFIL", "persona")
    json.dump(cfg, io.open(os.path.join(carpeta, "roaming", "U", "config.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    if aprendido: shutil.copyfile(aprendido, os.path.join(carpeta, "roaming", "U", "aprendido.json"))


def arrancar(carpeta, p):
    while not libre(p): p += 1
    entorno = dict(os.environ, U_DATA_DIR=carpeta, U_MCP_PUERTO=str(p), U_ORDENES_DE_PRUEBA="1")
    proc = subprocess.Popen([exe], env=entorno, cwd=os.path.dirname(exe))
    t = time.time()
    while not any("atajo: doble Ctrl" in l for l in leer(carpeta, proc.pid)):
        if time.time() - t > 60: print("NO SE PUDO MEDIR: la Ü de pruebas no arrancó en 60 s."); proc.kill(); raise SystemExit(2)
        time.sleep(1)
    time.sleep(5)
    return proc, p


def propuesta(texto):
    d = {}
    for linea in texto.splitlines():
        if "=" in linea: k, v = linea.split("=", 1); d[k.strip()] = v.strip()
    return d


def aprobar_y_esperar(pid, p, tope=300):
    marca = len(leer(datos, pid)); t = time.time()
    print("   " + mcp(p, "u_aprobar", {}))
    while time.time() - t < tope:
        time.sleep(1)
        fin = [l for l in leer(datos, pid, marca) if "accion: terminó" in l]
        if fin: return round(time.time() - t), re.sub(r"^\[\d\d:\d\d:\d\d\] \[[^\]]+\] ", "", fin[-1])[:200]
    return round(time.time() - t), "no terminó en el plazo de la prueba"


# ── La corrida ──
t0 = time.time()
while quieto_ms() < 20_000:
    if time.time() - t0 > 600: print("NO SE PUDO MEDIR: el PC no estuvo quieto 20 s en diez minutos."); sys.exit(4)
    time.sleep(2)

sembrar(datos, semilla_aprendido)
ensenadas = json.load(io.open(semilla_aprendido, encoding="utf-8-sig"))
ensenadas = ensenadas.get("habilidades") or ensenadas.get("Habilidades") or []
nombre_ensenado = ensenadas[0]["nombre"] if ensenadas else ""
print(f"[{etiqueta}] la Ü de pruebas ya sabe: «{nombre_ensenado}» ({len(ensenadas[0]['pasos']) if ensenadas else 0} pasos)")

antes = {p for p, _, _ in procesos()}
cursor = wt.POINT(); u32.GetCursorPos(ctypes.byref(cursor))
u, puerto = arrancar(datos, puerto); PID = u.pid
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
r = {}
u2 = None
try:
    t0 = time.time(); delante = False
    while time.time() - t0 < 25 and not delante:
        for h in ventanas():
            if pid_de(h) in edge_pids() and u32.IsWindowVisible(wt.HWND(h)) and texto_de(u32.GetClassNameW, h, 100) == "Chrome_WidgetWin_1" and "HIS" in texto_de(u32.GetWindowTextW, h):
                # Delante vale también un globo del propio Edge de pruebas («sincronizar perfil»): el HIS está debajo, a la vista.
                delante = traer_al_frente(h) or pid_de(u32.GetForegroundWindow()) in edge_pids(); break
        time.sleep(0.5)
    if not delante:
        # DICE QUÉ PASO FALLÓ (patrón nº2): no encontrar la ventana y no poder ponerla delante son dos cosas.
        suyas = [(texto_de(u32.GetClassNameW, h, 100), texto_de(u32.GetWindowTextW, h)[:50]) for h in ventanas() if pid_de(h) in edge_pids() and u32.IsWindowVisible(wt.HWND(h))]
        d = u32.GetForegroundWindow()
        print(f"NO SE PUDO MEDIR: el sistema médico no quedó delante. Ventanas visibles del Edge de pruebas: {suyas}. "
              f"Delante está «{texto_de(u32.GetWindowTextW, d)[:50]}» ({texto_de(u32.GetClassNameW, d, 100)}, PID {pid_de(d)}). El HIS recibió {len(recibido)} aviso(s).")
        raise SystemExit(3)
    time.sleep(3)
    print(f"[{etiqueta}] Ü de pruebas PID {PID} · MCP {puerto} · el HIS delante")
    vigilando.set()

    print(f"\n[{etiqueta}] A · ✓ en una sección con un paciente")
    t = time.time(); r["A"] = propuesta(mcp(puerto, "u_nota", {"texto": SECCION_A})); r["A_s"] = round(time.time() - t, 1)
    print(f"   pensó en {r['A_s']} s: {r['A']}")
    if r["A"].get("hay") == "si" and u.poll() is None: r["A_hecho"] = aprobar_y_esperar(PID, puerto); print(f"   {r['A_hecho']}")

    print(f"\n[{etiqueta}] B · ✓ en una sección que no es de nada enseñado")
    if u.poll() is None:
        t = time.time(); r["B"] = propuesta(mcp(puerto, "u_nota", {"texto": SECCION_B})); r["B_s"] = round(time.time() - t, 1)
        print(f"   pensó en {r['B_s']} s: {r['B']}")

    print(f"\n[{etiqueta}] C · «Ejecutar todo» con dos secciones")
    if u.poll() is None:
        t = time.time(); r["C"] = propuesta(mcp(puerto, "u_nota", {"texto": TODO_C, "todo": "1"})); r["C_s"] = round(time.time() - t, 1)
        print(f"   pensó en {r['C_s']} s: {r['C']}")
        if r["C"].get("hay") == "si" and u.poll() is None: r["C_hecho"] = aprobar_y_esperar(PID, puerto); print(f"   {r['C_hecho']}")
    vigilando.clear()

    print(f"\n[{etiqueta}] D · colgar: el indicador carga y termina")
    if u.poll() is None:
        marca = len(leer(datos, PID))
        try: mcp(puerto, "u_colgar", {}, espera=25)
        except Exception as e: print(f"   u_colgar: {e}")
        t = time.time()
        while time.time() - t < 90:
            time.sleep(2)
            tras = leer(datos, PID, marca)
            if any("indicador: «" in l for l in tras): break
        r["D"] = [re.sub(r"^\[\d\d:\d\d:\d\d\] \[[^\]]+\] ", "", l) for l in leer(datos, PID, marca) if "indicador:" in l]
        print(f"   {r['D']}")

    print(f"\n[{etiqueta}] E · una Ü que no sabe nada")
    # LA PRIMERA SE CIERRA ANTES: Ü es un solo proceso (spec 031), y una segunda no arranca con la primera viva.
    try: u.terminate(); u.wait(10)
    except Exception: pass
    time.sleep(2)
    vacia = datos + "-vacia"; sembrar(vacia, None)
    u2, puerto2 = arrancar(vacia, puerto + 1)
    r["E"] = propuesta(mcp(puerto2, "u_nota", {"texto": SECCION_A}))
    r["E_log"] = any("no se llama al modelo" in l for l in leer(vacia, u2.pid))
    print(f"   {r['E']} · sin llamar al modelo: {r['E_log']}")
finally:
    fin.set()
    for proc in (u, u2):
        if proc is None: continue
        try: proc.terminate(); proc.wait(10)
        except Exception:
            try: proc.kill()
            except Exception: pass
    for pid in edge_pids(): subprocess.run(["taskkill", "/pid", str(pid), "/f"], capture_output=True)
    u32.SetCursorPos(cursor.x, cursor.y)
    servidor.shutdown()

    def campo(p, c): return sin_tildes(p.get(c, ""))
    def doc(d): return re.sub(r"\D", "", d.get("documento", ""))
    pacientes = del_sistema("/api/pacientes"); triages = del_sistema("/api/triage")
    pa = next((p for p in pacientes if doc(p) == "52334455"), None); ta = next((t for t in triages if doc(t) == "52334455"), None)
    pc = next((p for p in pacientes if doc(p) == "80112233"), None); tc = next((t for t in triages if doc(t) == "80112233"), None)
    A, B, C, E = r.get("A", {}), r.get("B", {}), r.get("C", {}), r.get("E", {})
    pruebas = [
        ("A · el ✓ propone UNA acción, con la habilidad que se le enseñó", A.get("hay") == "si" and sin_tildes(A.get("habilidad", "")) == sin_tildes(nombre_ensenado) and len(A.get("accion", "")) > 10,
         f"{A} · {r.get('A_s')} s"),
        ("A · aprobada, el sistema recibió a la paciente de la sección, con SUS datos", bool(pa) and "laura" in campo(pa, "nombres") and "martinez" in campo(pa, "apellidos") and campo(pa, "eps") == "sanitas",
         json.dumps(pa, ensure_ascii=False) if pa else f"el sistema recibió: {json.dumps(pacientes, ensure_ascii=False)[:300]}"),
        ("A · y aplicó la regla enseñada: dolor leve → triage 4", bool(ta) and "triage 4" in sin_tildes(ta.get("triage", "")), f"{ta} · {r.get('A_hecho')}"),
        ("B · con una sección que no es de nada enseñado, NO propone acción y dice por qué", B.get("hay") == "no" and len(B.get("porque", "")) > 10 and not B.get("accion"), f"{B} · {r.get('B_s')} s"),
        ("C · «Ejecutar todo» propone UNA acción en común", C.get("hay") == "si" and sin_tildes(C.get("habilidad", "")) == sin_tildes(nombre_ensenado), f"{C} · {r.get('C_s')} s"),
        ("C · aprobada, el sistema recibió al paciente de las dos secciones juntas", bool(pc) and "juan" in campo(pc, "nombres") and "rios" in campo(pc, "apellidos") and campo(pc, "eps") == "sura",
         json.dumps(pc, ensure_ascii=False) if pc else f"el sistema recibió: {json.dumps(pacientes, ensure_ascii=False)[:300]}"),
        ("C · con su triage 4", bool(tc) and "triage 4" in sin_tildes(tc.get("triage", "")), f"{tc} · {r.get('C_hecho')}"),
        ("D · al colgar, el indicador cargó y terminó con algo", any("cargando" in l for l in r.get("D", [])) and any("indicador: «" in l for l in r.get("D", [])), str(r.get("D"))),
        ("E · sin nada aprendido, el ✓ lo dice sin llamar al modelo", E.get("hay") == "no" and "ensen" in sin_tildes(E.get("porque", "")) and r.get("E_log") is True, f"{E}"),
    ]
    print(f"\n[{etiqueta}] LA MEDICIÓN" + (f"  (CORTADA: {cortada[0]})" if cortada else ""))
    for que, ok, detalle in pruebas: print(f"  {'✔' if ok else '✘'} {que}\n      {detalle}")
    rechazos = del_sistema("/api/rechazo")
    if rechazos: print(f"  · el sistema rechazó {len(rechazos)} guardado(s): {json.dumps(rechazos, ensure_ascii=False)[:300]}")
    buenas = sum(1 for _, ok, _ in pruebas if ok)
    print(f"\n  LOS CHECKS: {buenas} de {len(pruebas)}" + ("  — TODO BIEN" if buenas == len(pruebas) else ""))
    print(f"  logs en {datos}")
