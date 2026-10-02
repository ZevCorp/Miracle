"""
EL BANCO DE METAS LARGAS: cuántas se logran, y a qué ritmo van las manos.

    python banco.py <U.exe> <carpeta de datos NUEVA> <puerto> <etiqueta> [--solo a,b] [--orden "…"] [--tope 180]

Arranca UNA Ü de pruebas con sus propios datos y le da, una por una y por u_orden —el camino de lo escrito—, las
metas del banco. De cada una saca del log de ESA Ü las dos medidas de las specs 081 y 082:

  · los MILISEGUNDOS POR CICLO DE CLIC —ver, pulsar, volver a ver— de cada camino: por nombre exacto («mano: ⏱
    ciclo»), de un tiro, y las vueltas de las manos dentro de un objetivo («⏱ dónde … total»);
  · si la meta SE LOGRÓ, con una comprobación que no depende de lo que Ü diga que hizo: el resultado que tiene que
    aparecer en su respuesta, o lo que tiene que existir en el disco.

--orden "…" da una orden suelta en vez del banco (no se juzga: solo se mide). --solo elige metas por nombre.

LO QUE CUIDA DE LA PERSONA:
  · Solo arranca con el PC quieto 20 s, y antes de cada meta vuelve a mirar.
  · EL TESTIGO: antes de cada orden pone delante una ventanita propia. Una orden libre teclea donde esté el foco, y
    el 2026-10-01 una dejó cuatro diálogos en el Bloc de notas del dueño; si algo se teclea de más, cae en el testigo.
  · EL VIGILANTE: mientras corre una meta mira qué ventana está delante cada 40 ms. Si pasa al frente una ventana
    que ya existía antes de la prueba y no es de la prueba, la Ü de pruebas se cierra en el acto, y esa meta no cuenta.
  · Las metas de navegador corren en un Edge APARTE (perfil propio en C:\\U-tmp), que se cierra por PID.
  · Lo que se crea en disco se crea en C:\\U-tmp\\banco-<etiqueta>.
  · Al terminar cierra por PID lo que abrió y dice qué ventanas nuevas quedaron.

LO QUE NO PUEDE EVITAR, medido el 2026-10-01, y por eso se corre con la persona FUERA del PC:
  · Estar quieto 5 s no es no estar: viendo un video no se toca nada, y la prueba le pone ventanas encima.
  · Si Ü abre una dirección «aparte» (o con map_go_to), se abre en el navegador de siempre de la persona: quedaron
    tres pestañas en su Chrome y en su Edge. El vigilante corta la meta, pero la pestaña ya está abierta.
  · Con una Calculadora de la persona abierta, «abre: calculadora» trae esa al frente y la meta se corta.
"""
import ctypes, ctypes.wintypes as wt, glob, io, json, os, re, shutil, socket, statistics, subprocess, sys, threading, time, urllib.request

sys.stdout.reconfigure(line_buffering=True)   # a un archivo, Python guarda la salida hasta el final: no se veía por dónde iba
args = sys.argv[1:]
def opcion(nombre, defecto=None):
    if nombre in args:
        i = args.index(nombre); v = args[i + 1]; del args[i:i + 2]; return v
    return defecto
SOLO = [x.strip() for x in (opcion("--solo", "") or "").split(",") if x.strip()]
ORDEN = opcion("--orden")
EDGE = opcion("--edge")   # con --orden: la dirección con que abre el Edge de pruebas
TOPE = int(opcion("--tope", "180"))
PEDIDO_VIEJO = opcion("--pedido-viejo")   # siembra el hilo con un pedido de antes sin contestar (promesa 801)
exe, datos, puerto, etiqueta = args[0], args[1], int(args[2]), args[3]
SEMILLA = os.environ.get("U_NIVEL4_SEMILLA", r"C:\U-versiones\onda-datos\roaming\U\config.json")
MSEDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
CARPETA = os.path.join(r"C:\U-tmp", "banco-" + etiqueta)
# Ventanas NUEVAS de estos procesos son de la prueba aunque el proceso ya existiera (las apps de la tienda viven en
# ApplicationFrameHost; el Explorador, en explorer). Una ventana nueva del Bloc de notas o de un navegador NO.
ANFITRIONES = {"applicationframehost.exe", "systemsettings.exe", "explorer.exe", "calculatorapp.exe", "mspaint.exe",
               "shellexperiencehost.exe", "searchhost.exe", "startmenuexperiencehost.exe", "textinputhost.exe"}

u32, k32 = ctypes.windll.user32, ctypes.windll.kernel32


def sin_separadores(t):
    """«5.535», «5 535» y «5,535» son 5535: quita los separadores que van ENTRE dígitos."""
    return re.sub(r"(?<=\d)[.,\s\u00a0\u202f](?=\d)", "", t)


# ── Las metas. Cada una: la orden, si necesita el Edge de pruebas, y cómo se sabe que se logró ──
METAS = [
    dict(nombre="calc-botones", edge=None,
         # «UNA CALCULADORA NUEVA», y no «la calculadora»: si la persona tiene una abierta, Ü trae esa al frente —que es
         # lo correcto para ella— y el vigilante corta la meta por tocar una ventana que no es de la prueba.
         orden="abre una calculadora nueva y calcula 123 por 45 pulsando los botones con el ratón, sin usar el teclado; dime el resultado",
         logro=lambda r, _: ("5535" in sin_separadores(r), "la respuesta trae 5535")),
    dict(nombre="calc-larga", edge=None,
         orden="abre una calculadora nueva y, pulsando sus botones con el ratón: suma 17 más 28, al resultado multiplícalo por 3 y a eso réstale 26. Dime el resultado final",
         logro=lambda r, _: ("109" in sin_separadores(r), "la respuesta trae 109")),
    dict(nombre="configuracion", edge=None,
         orden="abre la Configuración de Windows y dime dos cosas: qué resolución de pantalla está puesta, y cuánta memoria RAM instalada tiene este equipo",
         logro=lambda r, _: (bool(re.search(r"\d{3,4}\s*[x×]\s*\d{3,4}", r)) and bool(re.search(r"\d\s*GB", r, re.I)), "la respuesta trae una resolución y unos GB")),
    dict(nombre="carpetas", edge=None, explorador=CARPETA,
         orden=f"en el Explorador de archivos, dentro de la carpeta {CARPETA} crea una carpeta llamada Facturas, y dentro de Facturas otra llamada 2026",
         logro=lambda _, __: (os.path.isdir(os.path.join(CARPETA, "Facturas", "2026")), "existe Facturas\\2026 en el disco")),
    dict(nombre="wikipedia", edge="https://es.wikipedia.org/wiki/Wikipedia:Portada", tope=300,
         # «EN EL NAVEGADOR QUE TIENES DELANTE»: sin eso Ü puede abrir la dirección en el navegador de siempre de la
         # persona —es lo correcto para ella—, y el 2026-10-01 dejó tres pestañas en su Chrome y en su Edge.
         orden="en el navegador que tienes delante, sin abrir otra ventana: en Wikipedia, busca el artículo de Bogotá y dime a qué altitud está la ciudad; después abre el artículo de Medellín y dime en qué año se fundó",
         logro=lambda r, _: (bool(re.search(r"26[0-9]{2}", sin_separadores(r))) and "16" in r, "la respuesta trae la altitud de Bogotá (26xx m) y un año de 16xx")),
    dict(nombre="investigacion", edge="https://www.google.com/?hl=es", tope=600,
         orden="en el navegador que tienes delante, sin abrir otra ventana: ve a Google y haz una investigación sobre los últimos agentes de inteligencia artificial: abre al menos tres fuentes distintas, léelas, y resume en cinco puntos lo más importante diciendo de qué fuente sale cada uno",
         logro=lambda r, lineas: (len(r) >= 400 and len(paginas_vistas(lineas)) >= 4, "abrió al menos tres páginas además del buscador y devolvió un resumen")),
]


def paginas_vistas(lineas):
    vistas = set()
    for l in lineas:
        m = re.search(r"EN PANTALLA AHORA, en «([^»]{4,80})", l)
        if m:
            vistas.add(re.sub(r"\s*[-–—]\s*(Perfil \d+:\s*)?Microsoft.?\s*Edge.*$", "", m.group(1)).strip()[:50])
    return vistas


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


def clase(h):
    b = ctypes.create_unicode_buffer(120)
    u32.GetClassNameW(wt.HWND(h), b, 120)
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


class PROCESSENTRY32W(ctypes.Structure):
    _fields_ = [("dwSize", wt.DWORD), ("cntUsage", wt.DWORD), ("th32ProcessID", wt.DWORD), ("th32DefaultHeapID", ctypes.c_size_t),
                ("th32ModuleID", wt.DWORD), ("cntThreads", wt.DWORD), ("th32ParentProcessID", wt.DWORD), ("pcPriClassBase", ctypes.c_long),
                ("dwFlags", wt.DWORD), ("szExeFile", ctypes.c_wchar * 260)]


def procesos():
    """
    Los procesos vivos, por la foto del sistema y NO por `tasklist`: el 2026-10-01 `tasklist` tardó cuatro minutos y
    medio en contestar en esta máquina (va por WMI, que estaba ocupado), y el banco parecía colgado antes de arrancar.
    """
    return {pid: nombre for pid, _, nombre in foto_de_procesos()}


def foto_de_procesos():
    """(pid, pid del padre, ejecutable) de cada proceso vivo."""
    k32.CreateToolhelp32Snapshot.restype = wt.HANDLE
    foto = k32.CreateToolhelp32Snapshot(0x2, 0)
    vivos = []
    if not foto or foto == wt.HANDLE(-1).value:
        return vivos
    try:
        e = PROCESSENTRY32W(); e.dwSize = ctypes.sizeof(e)
        sigue = k32.Process32FirstW(wt.HANDLE(foto), ctypes.byref(e))
        while sigue:
            vivos.append((e.th32ProcessID, e.th32ParentProcessID, e.szExeFile))
            sigue = k32.Process32NextW(wt.HANDLE(foto), ctypes.byref(e))
    finally:
        k32.CloseHandle(wt.HANDLE(foto))
    return vivos


def familia_de(raiz, sin=()):
    """
    Un proceso y todos sus descendientes, aunque él ya haya muerto. Edge se relanza a sí mismo
    («--edge-skip-compat-layer») y el que se lanzó termina: el 2026-10-01 las ventanas eran de un hijo, el banco
    esperaba verlas en el padre, las dio por no abiertas y dejó cuatro Edge de pruebas abiertos en la pantalla.
    """
    padres = {pid: padre for pid, padre, _ in foto_de_procesos() if pid not in sin}
    familia = {raiz}
    crecio = True
    while crecio:
        crecio = False
        for pid, padre in padres.items():
            if padre in familia and pid not in familia:
                familia.add(pid); crecio = True
    return familia


def a_la_vista(h):
    """Visible de verdad: las apps de la tienda suspendidas guardan una ventana «visible» pero tapada por el sistema (cloaked)."""
    if not u32.IsWindowVisible(wt.HWND(h)):
        return False
    tapada = wt.DWORD(0)
    ctypes.windll.dwmapi.DwmGetWindowAttribute(wt.HWND(h), 14, ctypes.byref(tapada), ctypes.sizeof(tapada))
    return tapada.value == 0


def traer_al_frente(h):
    """Windows no deja robar el primer plano a quien no lo tiene: hay que engancharse un instante al hilo que sí."""
    delante = u32.GetForegroundWindow()
    if delante == h:
        return True
    # TRES INTENTOS, y el último por otra vía: el 2026-10-01 el enganche falló una vez con un navegador delante y la
    # meta quedó «NO CORRIÓ» sin decir por qué. SwitchToThisWindow es lo que usa Alt+Tab, y no teclea nada.
    for intento in range(3):
        delante = u32.GetForegroundWindow()
        mio, suyo = k32.GetCurrentThreadId(), u32.GetWindowThreadProcessId(wt.HWND(delante), None)
        unido = suyo and suyo != mio and u32.AttachThreadInput(mio, suyo, True)
        try:
            u32.ShowWindow(wt.HWND(h), 5); u32.SetForegroundWindow(wt.HWND(h)); u32.BringWindowToTop(wt.HWND(h))
            if intento == 2: u32.SwitchToThisWindow(wt.HWND(h), True)
        finally:
            if unido: u32.AttachThreadInput(mio, suyo, False)
        for _ in range(15):
            if u32.GetForegroundWindow() == h: return True
            time.sleep(0.02)
        time.sleep(0.3)
    return u32.GetForegroundWindow() == h


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


# ── EL TESTIGO: una ventanita propia que se pone delante antes de cada orden ──
testigo = {"hwnd": 0}


def ventana_testigo():
    import tkinter
    raiz = tkinter.Tk()
    raiz.title("Ü · banco de pruebas (testigo)")
    raiz.geometry("360x90+40+40")
    caja = tkinter.Text(raiz, height=3, width=44)
    caja.insert("1.0", "Si aquí aparece texto, una orden tecleó sin tener su app delante.")
    caja.pack()
    raiz.update()
    testigo["hwnd"] = u32.GetParent(raiz.winfo_id()) or raiz.winfo_id()
    raiz.mainloop()


threading.Thread(target=ventana_testigo, daemon=True).start()

t0 = time.time()
while quieto_ms() < 20_000:
    if time.time() - t0 > 600:
        print("NO SE PUDO MEDIR: el PC no estuvo quieto 20 s en diez minutos."); sys.exit(4)
    time.sleep(2)

os.makedirs(os.path.join(datos, "roaming", "U"), exist_ok=True)
os.makedirs(os.path.join(datos, "feed"), exist_ok=True)
os.makedirs(CARPETA, exist_ok=True)
cfg = json.load(io.open(SEMILLA, encoding="utf-8-sig"))
cfg["UpdateFeedUrl"] = os.path.join(datos, "feed")
# CON EL PERFIL YA ELEGIDO: un equipo con correo y sin perfil lo pregunta una vez (spec 078 de main), y esa ventana le
# salía en pantalla a la persona en cada corrida de una Ü de pruebas. U_NIVEL4_PERFIL=medico prueba el otro.
cfg["Perfil"] = os.environ.get("U_NIVEL4_PERFIL", "persona")
json.dump(cfg, io.open(os.path.join(datos, "roaming", "U", "config.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
HILO = os.path.join(datos, "roaming", "U", "conversacion-personal.json")
if PEDIDO_VIEJO:
    # UN PEDIDO DE ANTES, SIN CONTESTAR, en el hilo guardado (promesa 801): lo que se pida ahora no debe arrastrarlo.
    viejo = [dict(userId=cfg.get("Email", ""), role="usuario", text=PEDIDO_VIEJO,
                  createdAt=time.strftime("%Y-%m-%dT%H:%M:%S.0000000+00:00", time.gmtime(time.time() - 600)))]
    json.dump(viejo, io.open(HILO, "w", encoding="utf-8"), ensure_ascii=False)


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
# LAS QUE LA PERSONA TENÍA A LA VISTA (también minimizadas). Una app de la tienda que quedó suspendida guarda su
# ventana, tapada por el sistema: no es de nadie, y si la prueba la despierta —Configuración, el 2026-10-01— es de la
# prueba. Sin esta distinción el vigilante cortaba la meta en el mismo segundo de abrirla.
a_la_vista_antes = {h for h in ventanas_de_antes if a_la_vista(h)}
entorno = dict(os.environ, U_DATA_DIR=datos, U_MCP_PUERTO=str(puerto), U_ORDENES_DE_PRUEBA="1")
u = subprocess.Popen([exe], env=entorno, cwd=os.path.dirname(exe))
PID = u.pid
edge = None
edge_pids = set()
cortada = []
vigilando = threading.Event()
fin = threading.Event()


def vigilante():
    while not fin.is_set():
        time.sleep(0.04)
        if not vigilando.is_set():
            continue
        h = u32.GetForegroundWindow()
        if not h or h == testigo["hwnd"]:
            continue
        pid = pid_de(h)
        if pid in (PID, os.getpid()) or pid in edge_pids or pid not in antes:
            continue
        if h not in a_la_vista_antes and nombre_del_proceso(pid) in ANFITRIONES:
            continue
        cortada.append(f"pasó al frente «{titulo(h)[:60]}» ({nombre_del_proceso(pid)}, PID {pid}), que ya estaba antes de la prueba")
        vigilando.clear()
        try: u.kill()
        except Exception: pass


threading.Thread(target=vigilante, daemon=True).start()


def arrancar_edge(url, nombre):
    global edge
    perfil = os.path.join(r"C:\U-tmp", f"edge-pruebas-{etiqueta}-{nombre}")
    edge = subprocess.Popen([MSEDGE, f"--user-data-dir={perfil}", "--no-first-run", "--no-default-browser-check",
                             "--disable-features=msEdgeSidebarV2", "--new-window", url])
    return al_frente_la_de(familia_del_edge, "Chrome_WidgetWin_1")


def familia_del_edge():
    global edge_pids
    edge_pids = familia_de(edge.pid, sin=antes) if edge is not None else set()
    return edge_pids


def al_frente_la_de(cuales, clase_de_ventana, espera=20):
    """
    Espera a que un proceso de la prueba tenga su ventana y la pone delante. Windows no deja que un proceso lanzado
    desde el fondo se ponga delante solo —parpadea en la barra de tareas—: el 2026-10-01 las dos metas de navegador
    quedaron «NO CORRIÓ» por eso, con el Edge de pruebas abierto detrás.
    """
    t = time.time()
    while time.time() - t < espera:
        pids = cuales() if callable(cuales) else cuales
        if pid_de(u32.GetForegroundWindow()) in pids:
            time.sleep(3); return True
        for h in ventanas():
            if pid_de(h) in pids and a_la_vista(h) and clase(h) == clase_de_ventana and titulo(h):
                if traer_al_frente(h):
                    time.sleep(3); return True
        time.sleep(0.3)
    return False


explorador = []


def arrancar_explorador(carpeta):
    """
    Un Explorador APARTE para la meta de carpetas. Windows 11 abre una carpeta como pestaña del Explorador que ya haya:
    el 2026-10-01 la meta acabó en una pestaña de la ventana de Descargas de la persona, y el vigilante la cortó.
    «/separate» lo abre en un proceso propio, que se cierra por PID.
    """
    de_antes = {p for p, n in procesos().items() if n.lower() == "explorer.exe"}
    subprocess.Popen(["explorer.exe", "/separate,", carpeta])
    t = time.time()
    while time.time() - t < 20:
        nuevos = [p for p, n in procesos().items() if n.lower() == "explorer.exe" and p not in de_antes]
        if nuevos and al_frente_la_de(nuevos, "CabinetWClass", espera=4):
            explorador[:] = nuevos
            return True
        time.sleep(0.5)
    explorador[:] = [p for p, n in procesos().items() if n.lower() == "explorer.exe" and p not in de_antes]
    return False


def cerrar_explorador():
    for pid in explorador:
        subprocess.run(["taskkill", "/pid", str(pid), "/f"], capture_output=True)
    explorador.clear()
    devolver_exploradores()


def exploradores_de_la_persona():
    """{ventana: carpeta} de los Exploradores abiertos, por Shell.Application (con PowerShell: aquí Python no trae COM)."""
    ps = "$s = New-Object -ComObject Shell.Application; $s.Windows() | ForEach-Object { '{0}|{1}' -f $_.HWND, $_.LocationURL }"
    salida = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True, errors="replace").stdout
    return {l.split("|", 1)[0].strip(): l.split("|", 1)[1].strip() for l in salida.splitlines() if "|" in l}


def devolver_exploradores():
    """
    AUNQUE LA PRUEBA TENGA SU EXPLORADOR, Windows puede llevar la carpeta de pruebas a una ventana de la persona: el
    2026-10-01 su ventana de Descargas acabó dos veces en C:\\U-tmp\\banco-…. Lo que estaba en otra carpeta antes de
    la prueba y ahora está en la de pruebas vuelve atrás (GoBack), que es deshacer justo esa navegación.
    """
    movidas = [h for h, ruta in exploradores_de_la_persona().items()
               if h in exploradores_antes and "/U-tmp/banco-" in ruta and exploradores_antes[h] != ruta]
    if not movidas:
        return
    ps = ("$s = New-Object -ComObject Shell.Application; $s.Windows() | Where-Object { @(" + ",".join(movidas)
          + ") -contains $_.HWND -and $_.LocationURL -like '*U-tmp/banco-*' } | ForEach-Object { $_.GoBack() }")
    subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True)
    print(f"[{etiqueta}] {len(movidas)} ventana(s) del Explorador de la persona habían ido a la carpeta de pruebas: devueltas a donde estaban")


exploradores_antes = exploradores_de_la_persona()   # antes de la primera orden: la Ü de pruebas aún no ha hecho nada


def cerrar_edge():
    global edge, edge_pids
    if edge is not None:
        # TODA LA FAMILIA, por PID: «taskkill /t» sobre el que se lanzó no encuentra nada si ese ya terminó.
        for pid in familia_del_edge():
            subprocess.run(["taskkill", "/pid", str(pid), "/f"], capture_output=True)
        edge = None; edge_pids = set()


def limpiar_lo_abierto():
    for pid, nombre in procesos().items():
        if pid not in antes and nombre.lower() in ("calculatorapp.exe", "systemsettings.exe", "mspaint.exe"):
            subprocess.run(["taskkill", "/pid", str(pid), "/f"], capture_output=True)
    # Las ventanas del Explorador que abrió la prueba: son del proceso de siempre, así que se cierran por ventana.
    for h in ventanas() - ventanas_de_antes:
        if u32.IsWindowVisible(wt.HWND(h)) and clase(h) == "CabinetWClass":
            u32.PostMessageW(wt.HWND(h), 0x0010, 0, 0)
    # Y las de la tienda que la prueba despertó: estaban tapadas antes, y ahora se ven. Se cierran por ventana.
    for h in ventanas_de_antes - a_la_vista_antes:
        if a_la_vista(h) and clase(h) == "ApplicationFrameWindow":
            u32.PostMessageW(wt.HWND(h), 0x0010, 0, 0)
    time.sleep(1)


def mediana(xs):
    return statistics.median(xs) if xs else None


def medir(lineas):
    """
    Los ciclos de clic de un tramo de log, por camino, en milisegundos POR CLIC. Salen de la línea que el plan deja
    por cada paso («⏱ paso «…»: N ms · <camino> · K clic(s) · M ms por clic»): el paso ENTERO, con sus búsquedas
    fallidas y sus esperas dentro. Un paso de K clics cuenta K veces. Lo que se pulsa fuera de un plan (map_take
    suelto) sale de «mano: ⏱ ciclo» solo si en ese tramo no hubo ningún plan, para no contarlo dos veces.
    """
    exactos, jev, tiro = [], [], []
    hubo_plan = False
    for l in lineas:
        m = re.search(r"⏱ paso «.*»: \d+ ms · ([^·]+?) · (\d+) clic\(s\) · (\d+) ms por clic", l)
        if not m:
            continue
        hubo_plan = True
        camino, clics, ms = m.group(1).strip(), int(m.group(2)), int(m.group(3))
        destino = exactos if camino.startswith("por nombre") else tiro if camino == "de un tiro" else jev
        destino.extend([ms] * clics)
    if not hubo_plan:
        for l in lineas:
            m = re.search(r"mano: ⏱ ciclo «[^»]*»: ver (\d+) ms · clic (\d+) ms · volver a ver (\d+) ms", l)
            if m:
                exactos.append(sum(int(x) for x in m.groups()))
    return exactos, jev, tiro


def correr(meta):
    """Una meta: la orden, la espera hasta que termina, y lo que dejó en el log."""
    if u.poll() is not None:
        return dict(nombre=meta["nombre"], estado="NO CORRIÓ", detalle="la Ü de pruebas ya no vive")
    t = time.time()
    while quieto_ms() < 5_000:
        if time.time() - t > 300:
            return dict(nombre=meta["nombre"], estado="NO CORRIÓ", detalle="la persona está usando el PC")
        time.sleep(1)
    if meta.get("edge"):
        if not arrancar_edge(meta["edge"], meta["nombre"]):
            cerrar_edge()
            return dict(nombre=meta["nombre"], estado="NO CORRIÓ", detalle="el Edge de pruebas no quedó delante")
    elif meta.get("explorador"):
        if not arrancar_explorador(meta["explorador"]):
            cerrar_explorador()
            return dict(nombre=meta["nombre"], estado="NO CORRIÓ", detalle="el Explorador de pruebas no quedó delante")
    elif not traer_al_frente(testigo["hwnd"]):
        d = u32.GetForegroundWindow()
        return dict(nombre=meta["nombre"], estado="NO CORRIÓ",
                    detalle=f"no pude poner el testigo delante: sigue delante «{titulo(d)[:50]}» ({nombre_del_proceso(pid_de(d))})")

    cortada.clear()
    marca = len(leer())
    vigilando.set()
    print(f"\n[{etiqueta}] ── {meta['nombre']} → {meta['orden']}")
    reloj = time.time()
    try:
        mcp("u_orden", {"texto": meta["orden"]})
    except Exception as e:
        vigilando.clear()
        return dict(nombre=meta["nombre"], estado="NO CORRIÓ", detalle=f"u_orden: {e}" + (f" · {cortada[0]}" if cortada else ""))
    ultimo = time.time(); vistas = 0; acabo = None
    tope = max(TOPE, meta.get("tope", 0))
    while time.time() - reloj < tope and not cortada and u.poll() is None:
        time.sleep(0.5)
        lineas = leer(marca)
        nuevas = sum(1 for l in lineas if re.search(r"voz-viva|mapa-mcp|plan:|mano:|meta:", l))
        if nuevas != vistas:
            vistas = nuevas; ultimo = time.time()
        finales = [l for l in lineas if '"type":"response.output_item.done"' in l and '"type":"message"' in l]
        # CON UNA META ABIERTA NO HA TERMINADO: que quien actúa conteste no cierra nada; lo cierra la meta (spec 082).
        abiertas = sum(1 for l in lineas if "meta: creada" in l) - sum(1 for l in lineas if re.search(r"meta: (cumplida|bloqueada|pausada)", l))
        if finales and abiertas <= 0 and time.time() - ultimo > 6:
            acabo = seg(finales[-1]); break
        if time.time() - ultimo > 60:
            break
    vigilando.clear()
    dicho = ""
    if u.poll() is None:
        # LA RESPUESTA ENTERA viene de u_colgar: el log recorta cada línea a unos 450 caracteres.
        try:
            cruda = mcp("u_colgar", {}, espera=20)
            textos = [c.get("text", "") for c in json.loads(cruda[cruda.index("{"):]).get("result", {}).get("content", [])]
            dicho = next((t.split("\nÜ dijo:\n", 1)[1] for t in textos if "\nÜ dijo:\n" in t), "").strip()
        except Exception as e: print(f"[{etiqueta}] u_colgar: {e}")
        time.sleep(3)
    lineas = leer(marca)
    inicio = next((seg(l) for l in lineas if "orden de prueba" in l), None)
    for l in lineas:
        if re.search(r"llamada recibida:|plan: |mano: ⏱|meta: |voz-turno: llamadas=|sesión cerrada|el servidor dice", l):
            s = seg(l)
            print(f"  +{(s - inicio) if s is not None and inicio is not None else 0:>3} s  " + re.sub(r"^\[\d\d:\d\d:\d\d\] \[[^\]]+\] ", "", l)[:210])
    respuesta = dicho
    if not respuesta:
        # Sin u_colgar —la cortó el vigilante—, lo que quede en el log, aunque venga recortado («…»).
        trozos = [m for l in lineas if '"type":"response.output_item.done"' in l and '"type":"message"' in l
                  for m in re.findall(r'"type":"output_text"[^}]*?"text":"((?:[^"\\]|\\.)*)', l)]
        respuesta = " ".join(t.encode("utf-8").decode("unicode_escape", "replace") if "\\u" in t else t.replace('\\"', '"').replace("\\n", "\n") for t in trozos)
    llamadas = [l.split("llamada recibida:")[1].strip() for l in lineas if "llamada recibida:" in l]
    exactos, jev, tiro = medir(lineas)
    turno = next((l.split("voz-turno:")[1].strip() for l in reversed(lineas) if "voz-turno: llamadas=" in l), "")
    pensar = re.search(r"pensar=(\d+) ms ejecutar=(\d+) ms", turno)
    r = dict(nombre=meta["nombre"], segundos=(acabo - inicio) if acabo and inicio else None, llamadas=len(llamadas),
             herramientas=", ".join(f"{n}×{t}" for t, n in sorted({t: llamadas.count(t) for t in set(llamadas)}.items(), key=lambda x: -x[1])),
             planes=sum(1 for l in lineas if "📋 plan de" in l), exactos=exactos, jev=jev, tiro=tiro,
             pensar=int(pensar.group(1)) if pensar else None, ejecutar=int(pensar.group(2)) if pensar else None,
             metas=sum(1 for l in lineas if "meta: creada" in l), continuaciones=sum(1 for l in lineas if "meta: continúa" in l),
             respuesta=respuesta, caduco=any("expired" in l for l in lineas))
    if cortada:
        r.update(estado="CORTADA", detalle=cortada[0])
    elif meta.get("logro") is None:
        r.update(estado="MEDIDA", detalle="orden suelta: no se juzga")
    else:
        try:
            ok, que = meta["logro"](respuesta, lineas)
        except Exception as e:
            ok, que = False, f"la comprobación reventó: {e}"
        r.update(estado="LOGRADA" if ok and acabo else ("NO TERMINÓ" if not acabo else "NO LOGRADA"), detalle=que)
    print(f"  = {r['estado']}: {r['detalle']} · respuesta ({len(respuesta)} caracteres): «{respuesta[:300]}»")
    cerrar_edge()
    cerrar_explorador()
    limpiar_lo_abierto()
    return r


resultados = []
print(f"[{etiqueta}] Ü de pruebas: PID {u.pid} · {exe}")
try:
    t0 = time.time()
    while not any("atajo: doble Ctrl" in l for l in leer()):
        if time.time() - t0 > 60:
            print("NO SE PUDO MEDIR: la Ü de pruebas no terminó de arrancar en 60 s."); raise SystemExit(2)
        time.sleep(1)
    if not any(f"servidor MCP escuchando en 127.0.0.1:{puerto}/mcp" in l for l in leer()):
        print(f"NO SE PUDO MEDIR: esta Ü no abrió su MCP en {puerto}."); raise SystemExit(3)
    t0 = time.time()
    while time.time() - t0 < 15 and not any("Jev caliente" in l or "no hay clave de Jev" in l for l in leer()):
        time.sleep(0.5)
    print(f"[{etiqueta}] arrancó · MCP en {puerto} · " + next((l.split("plan:")[1].strip() for l in leer() if "Jev caliente" in l), "SIN «Jev caliente» en el log"))

    metas = [dict(nombre="orden", edge=EDGE, orden=ORDEN, logro=None)] if ORDEN else [m for m in METAS if not SOLO or m["nombre"] in SOLO]
    for meta in metas:
        resultados.append(correr(meta))
        if resultados[-1]["estado"] == "NO CORRIÓ":   # un paso no ejecutado deja su rastro, con el motivo (patrón nº10)
            print(f"\n[{etiqueta}] ── {meta['nombre']} NO CORRIÓ: {resultados[-1]['detalle']}")
        if u.poll() is not None:
            # La cortó el vigilante: se levanta otra para las metas que quedan, con los mismos datos. SIN EL HILO: la
            # orden cortada quedó en él sin contestar, y la meta siguiente la heredaría como un pedido pendiente
            # (medido el 2026-10-01; eso es la promesa 801, que se mide aparte con --pedido-viejo).
            try: os.remove(HILO)
            except OSError: pass
            u = subprocess.Popen([exe], env=entorno, cwd=os.path.dirname(exe)); PID = u.pid
            t0 = time.time()
            while time.time() - t0 < 60 and not any("atajo: doble Ctrl" in l for l in leer()):
                time.sleep(1)
            time.sleep(8)
finally:
    fin.set()
    try:
        u.terminate(); u.wait(10)
    except Exception:
        try: u.kill()
        except Exception: pass
    cerrar_edge()
    limpiar_lo_abierto()
    nuevas = [h for h in ventanas() - ventanas_de_antes if u32.IsWindowVisible(wt.HWND(h)) and titulo(h) and h != testigo["hwnd"]]
    for h in nuevas:
        print(f"[{etiqueta}] OJO, ventana nueva que sigue abierta: «{titulo(h)[:70]}» ({nombre_del_proceso(pid_de(h))})")
    for p in glob.glob(os.path.join(datos, "local", "U", "logs", "u-*.log")):
        shutil.copy(p, os.path.join(datos, f"{etiqueta}-{os.path.basename(p)}"))

    # ── LAS DOS MEDIDAS ──
    def f(x): return "—" if x is None else f"{x:.0f}"
    print(f"\n[{etiqueta}] EL BANCO")
    print(f"  {'meta':<15}{'estado':<12}{'s':>5}{'llam.':>7}{'planes':>7}{'  ms/ciclo: exacto':>20}{'tiro':>7}{'manos':>7}   {'pensar/ejecutar':<16} herramientas")
    todos = []
    for r in resultados:
        ex, jv, ti = r.get("exactos", []), r.get("jev", []), r.get("tiro", [])
        todos += ex + jv + ti
        pe = f"{f(r.get('pensar'))}/{f(r.get('ejecutar'))} ms"
        print(f"  {r['nombre']:<15}{r['estado']:<12}{f(r.get('segundos')):>5}{r.get('llamadas', 0):>7}{r.get('planes', 0):>7}"
              f"{f(mediana(ex)) + f' ({len(ex)})':>20}{f(mediana(ti)) + f' ({len(ti)})':>7}{f(mediana(jv)) + f' ({len(jv)})':>7}   {pe:<16} {r.get('herramientas', '')}"
              + (f" · {r['metas']} meta(s), {r['continuaciones']} continuación(es)" if r.get("metas") else "") + (" · CADUCÓ" if r.get("caduco") else "")
              + (f" · {r['detalle']}" if r["estado"] != "LOGRADA" else ""))
    juzgadas = [r for r in resultados if r["estado"] in ("LOGRADA", "NO LOGRADA", "NO TERMINÓ")]
    print(f"\n  METAS LOGRADAS: {sum(1 for r in juzgadas if r['estado'] == 'LOGRADA')} de {len(juzgadas)}"
          + (f" · {len(resultados) - len(juzgadas)} sin juzgar (cortadas o que no corrieron)" if len(resultados) != len(juzgadas) else ""))
    print(f"  MS POR CICLO DE CLIC: mediana {f(mediana(todos))} sobre {len(todos)} ciclo(s)")
    print(f"  logs en {datos}")
