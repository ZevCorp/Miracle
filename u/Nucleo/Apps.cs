using System.Diagnostics;
using System.Runtime.InteropServices;

namespace U.Ciclo;

/// <summary>
/// ABRIR UNA APP y esperar a que esté delante, sin más. En main, map_open_app tardó 560-13.995 ms y dos de
/// cinco veces no trajo la app al frente (2026-09-24). Aquí: ShellExecute, y se mira la ventana de delante
/// cada 15 ms hasta que cambie, con techo de 3 s.
/// </summary>
public static class Apps
{
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();

    /// <summary>Los nombres con los que se pide, a lo que Windows sabe abrir.</summary>
    public static string Comando(string nombre) => (nombre ?? "").Trim().ToLowerInvariant() switch
    {
        "bloc de notas" or "notepad" or "bloc" => "notepad.exe",
        "configuración" or "configuracion" or "ajustes" or "settings" => "ms-settings:",
        "explorador" or "explorador de archivos" or "archivos" or "explorer" => "explorer.exe",
        "calculadora" or "calc" => "calc.exe",
        "navegador" or "chrome" => "chrome.exe",
        "edge" => "msedge.exe",
        "paint" => "mspaint.exe",
        var otro => otro,
    };

    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int max);

    private static string Titulo(IntPtr h)
    {
        var sb = new System.Text.StringBuilder(512);
        GetWindowText(h, sb, sb.Capacity);
        return sb.ToString();
    }

    /// <summary>
    /// ¿LLEGÓ? (promesa 469). Otra ventana delante, o la MISMA con otro título: una dirección abierta con el navegador
    /// delante abre una pestaña en esa ventana, y solo cambia el título. Mirando solo la ventana, «abre: https://…» con
    /// Chrome delante fallaba siempre a los 3 s —13 veces en un pedido de la ronda libre del 2026-09-26—.
    /// </summary>
    public static bool Llego(IntPtr antes, string tituloAntes, IntPtr ahora, string tituloAhora) =>
        ahora != IntPtr.Zero && (ahora != antes || !string.Equals(tituloAhora, tituloAntes, StringComparison.Ordinal));

    private static readonly string[] Navegadores = { "chrome", "msedge", "firefox", "brave", "opera" };

    /// <summary>
    /// ¿LA VENTANA DE DELANTE ES LA APP PEDIDA? (promesa 470). Por el proceso; y las de la tienda —Calculadora,
    /// Configuración— viven todas en ApplicationFrameHost, así que también por el título. Una dirección vale con
    /// cualquier navegador delante.
    /// </summary>
    public static bool EsLaPedida(string pedida, string proceso, string titulo)
    {
        string c = Comando(pedida).ToLowerInvariant(), p = (proceso ?? "").ToLowerInvariant(), t = titulo ?? "";
        bool Titulo(params string[] s) => s.Any(x => t.Contains(x, StringComparison.OrdinalIgnoreCase));
        if (c.StartsWith("http://") || c.StartsWith("https://") || c.StartsWith("www.")) return Navegadores.Contains(p);
        if (c.StartsWith("ms-settings:")) return (p == "systemsettings" || p == "applicationframehost") && Titulo("Configuración", "Settings");
        if (c == "calc.exe") return p == "calculatorapp" || (p == "applicationframehost" && Titulo("Calculadora", "Calculator"));
        if (c.EndsWith(".exe")) return p == Path.GetFileNameWithoutExtension(c);
        return false;
    }

    /// <summary>
    /// ¿SE CARGA EN LA PESTAÑA DE DELANTE? (promesa 473): una dirección, con un navegador delante. Abrirla con
    /// ShellExecute crea una pestaña nueva cada vez, y el 2026-09-26 las pruebas dejaron Chrome con 133 procesos y
    /// 15 GB: leer una página pasó de 1,6 a 4-7 s.
    /// </summary>
    public static bool EnLaMismaPestana(string pedida, string procesoDelante)
    {
        string c = (pedida ?? "").Trim().ToLowerInvariant();
        bool direccion = c.StartsWith("http://") || c.StartsWith("https://") || c.StartsWith("www.");
        return direccion && Navegadores.Contains((procesoDelante ?? "").ToLowerInvariant());
    }

    /// <summary>Cuánto se espera a que cambie algo: poco si la app pedida ya estaba delante (promesa 470).</summary>
    public static int Techo(bool yaEstabaDelante) => yaEstabaDelante ? 700 : 3000;

    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);

    private static string Proceso(IntPtr h)
    {
        if (h == IntPtr.Zero) return "";
        GetWindowThreadProcessId(h, out uint pid);
        try { using var p = Process.GetProcessById((int)pid); return p.ProcessName; }
        catch (ArgumentException) { return ""; }   // el proceso ya no existe
    }

    /// <summary>La primera ventana VISIBLE de la app pedida (promesa 472). Sin ninguna, IntPtr.Zero.</summary>
    public static IntPtr Candidata(IEnumerable<(IntPtr Ventana, string Proceso, string Titulo, bool Visible)> ventanas, string pedida) =>
        ventanas.FirstOrDefault(v => v.Visible && v.Ventana != IntPtr.Zero && EsLaPedida(pedida, v.Proceso, v.Titulo)).Ventana;

    private delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumProc cb, IntPtr l);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] private static extern bool BringWindowToTop(IntPtr h);
    [DllImport("user32.dll")] private static extern bool AttachThreadInput(uint a, uint b, bool unir);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();

    /// <summary>Las ventanas de primer nivel con título, en orden Z (de arriba abajo).</summary>
    private static List<(IntPtr, string, string, bool)> Ventanas()
    {
        var todas = new List<(IntPtr, string, string, bool)>();
        EnumWindows((h, _) =>
        {
            string t = Titulo(h);
            if (t.Length > 0 && IsWindowVisible(h)) todas.Add((h, Proceso(h), t, true));
            return todas.Count < 200;
        }, IntPtr.Zero);
        return todas;
    }

    /// <summary>
    /// TRAER AL FRENTE DE VERDAD, con la técnica de main (UiaSurface.TraerAlFrente): Windows no deja que quien no está
    /// delante le robe el primer plano —la llamada «funciona» y solo parpadea el botón en la barra—; la salida es
    /// engancharse un instante a la cola de entrada del hilo que sí está delante. Y se comprueba después.
    /// </summary>
    private static bool TraerAlFrente(IntPtr win)
    {
        if (GetForegroundWindow() == win) return true;
        if (IsIconic(win)) ShowWindow(win, 9 /* SW_RESTORE */);
        uint mio = GetCurrentThreadId(), suyo = GetWindowThreadProcessId(GetForegroundWindow(), out _);
        bool unido = suyo != 0 && mio != suyo && AttachThreadInput(mio, suyo, true);
        try { SetForegroundWindow(win); BringWindowToTop(win); }
        finally { if (unido) AttachThreadInput(mio, suyo, false); }
        for (int i = 0; i < 12 && GetForegroundWindow() != win; i++) Thread.Sleep(20);
        return GetForegroundWindow() == win;
    }

    /// <summary>Abre y espera a que cambie la ventana de delante o su título. Devuelve (llegó, ms).</summary>
    public static (bool Llego, long Ms) Abrir(string nombre)
    {
        var antes = GetForegroundWindow();
        string tituloAntes = Titulo(antes);
        bool yaDelante = EsLaPedida(nombre, Proceso(antes), tituloAntes);
        var r = Stopwatch.StartNew();
        // Un nombre que Windows no sabe abrir es «no llegó», no una excepción que tumbe el plan entero
        // (Luna pidió «abre: comando de Windows» el 2026-09-24, 23:29, y el Win32Exception subió hasta arriba).
        try { Process.Start(new ProcessStartInfo(Comando(nombre)) { UseShellExecute = true })?.Dispose(); }
        catch (System.ComponentModel.Win32Exception) { return (false, r.ElapsedMilliseconds); }
        int techo = Techo(yaDelante);
        long proximaBusqueda = 300;
        while (r.ElapsedMilliseconds < techo)
        {
            var ahora = GetForegroundWindow();
            if (Llego(antes, tituloAntes, ahora, Titulo(ahora))) return (true, r.ElapsedMilliseconds);
            // ABIERTA PERO DETRÁS (promesa 472): si su ventana ya existe y no pasó al frente, se trae. Solo se busca
            // cuando no llegó sola en 300 ms; lo normal no paga la búsqueda.
            if (!yaDelante && r.ElapsedMilliseconds >= proximaBusqueda)
            {
                proximaBusqueda = r.ElapsedMilliseconds + 150;
                var suya = Candidata(Ventanas(), nombre);
                if (suya != IntPtr.Zero && suya != ahora && TraerAlFrente(suya)) return (true, r.ElapsedMilliseconds);
            }
            Thread.Sleep(15);
        }
        // Nada cambió, pero la de delante ES la pedida: ya estaba abierta (promesa 470).
        var final = GetForegroundWindow();
        return (EsLaPedida(nombre, Proceso(final), Titulo(final)), r.ElapsedMilliseconds);
    }
}
