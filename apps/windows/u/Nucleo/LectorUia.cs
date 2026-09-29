using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using Interop.UIAutomationClient;

namespace U.Ciclo;

/// <summary>
/// LOS ACCIONABLES DE LA PANTALLA, EN UNA PETICIÓN. Del lector de main se conserva el concepto que ya
/// funcionaba —el subárbol entero en una CacheRequest, 12× más rápido que nodo a nodo (su medida del
/// 2026-09-18)— y se quita lo que lo encarecía:
///
///   · COM crudo (IUIAutomation), no System.Windows.Automation: el envoltorio gestionado no deja pedir la
///     condición del lado del proveedor, así que main traía TODO el árbol y filtraba en casa.
///   · La condición viaja: solo controles accionables y en pantalla. Menos nodos cruzan el proceso.
///   · Modo None: no se piden referencias vivas, porque se pulsa con el ratón por coordenadas.
///   · Un hilo MTA propio: UIA desde un hilo STA con bombeo de mensajes es más lento y se puede bloquear
///     contra la propia ventana de la app.
/// </summary>
public sealed class LectorUia : IDisposable
{
    private const int TipoTexto = 50020;
    /// <summary>Cuántos textos viajan a Jev como mucho, y de qué largo. La pantalla, no un documento.</summary>
    public int MaxTextos { get; init; } = 30;
    private const int PropFoco = 30008, PropValor = 30045;
    private const int PropNombre = 30005, PropTipo = 30003, PropCaja = 30001, PropFuera = 30022, PropHabilitado = 30010;

    private static readonly (int Id, string Nombre)[] TiposAccionables =
    {
        (50000, "Button"), (50002, "CheckBox"), (50003, "ComboBox"), (50004, "Edit"), (50005, "Hyperlink"),
        (50007, "ListItem"), (50011, "MenuItem"), (50013, "RadioButton"), (50015, "Slider"), (50019, "TabItem"),
        (50024, "TreeItem"), (50029, "DataItem"), (50031, "SplitButton"), (50035, "HeaderItem"), (50030, "Document"),
    };

    private BlockingCollection<Action> _cola = null!;
    private Thread _hilo = null!;
    // DE CADA HILO, NO DEL LECTOR (promesa 494): una lectura atascada deja su hilo abandonado con su UIA, y el hilo
    // nuevo trae el suyo; si fueran del lector, el atascado y el nuevo se pisarían.
    [ThreadStatic] private static IUIAutomation _uia;
    [ThreadStatic] private static IUIAutomationCacheRequest _peticion;
    [ThreadStatic] private static IUIAutomationCondition _condicion;
    [ThreadStatic] private static string _foco;
    [ThreadStatic] private static List<(string, string)> _campos;

    public LectorUia() => ArrancarHilo();

    /// <summary>Un hilo MTA con su UIA y su cola. Se llama al crear el lector, y otra vez cada vez que una lectura se atasca.</summary>
    private void ArrancarHilo()
    {
        var cola = new BlockingCollection<Action>();
        var listo = new ManualResetEventSlim();
        var hilo = new Thread(() =>
        {
            _foco = "";
            _campos = new List<(string, string)>();
            _uia = new CUIAutomation8();
            // PLAZOS (promesa 474): sin ellos, una app que no contesta congela a Ü —72 s leyendo YouTube con Chrome a
            // 137 procesos, ronda L5 del 2026-09-26—. Con ellos, la llamada falla a tiempo y la lectura sigue.
            if (_uia is IUIAutomation2 u2)
            {
                u2.ConnectionTimeout = PlazoConectarMs;
                u2.TransactionTimeout = PlazoLeerMs;
                Plazos = ((int)u2.ConnectionTimeout, (int)u2.TransactionTimeout);
            }
            _peticion = _uia.CreateCacheRequest();
            foreach (int p in new[] { PropNombre, PropTipo, PropCaja, PropFuera, PropHabilitado, PropFoco, PropValor }) _peticion.AddProperty(p);
            _peticion.AutomationElementMode = AutomationElementMode.AutomationElementMode_None;
            _peticion.TreeScope = TreeScope.TreeScope_Element;

            // Y los textos (50020): no se ofrecen para pulsar, pero dicen lo que la pantalla muestra (promesa 443).
            var tipos = TiposAccionables.Select(t => _uia.CreatePropertyCondition(PropTipo, t.Id))
                .Append(_uia.CreatePropertyCondition(PropTipo, TipoTexto)).ToArray();
            _condicion = _uia.CreateAndCondition(
                _uia.CreateOrConditionFromArray(tipos),
                _uia.CreatePropertyCondition(PropFuera, false));
            listo.Set();
            foreach (var trabajo in cola.GetConsumingEnumerable()) trabajo();
        })
        { IsBackground = true, Name = "u-lector-uia" };
        hilo.SetApartmentState(ApartmentState.MTA);
        hilo.Start();
        listo.Wait();
        _cola = cola;
        _hilo = hilo;
    }

    /// <summary>
    /// Los accionables de una ventana y de sus ventanas hermanas del mismo proceso (los menús de Windows 11
    /// y los desplegables son ventanas aparte: sin ellas, abrir «Archivo» no enseñaría sus opciones).
    /// </summary>
    public Lectura Leer(IntPtr ventana)
    {
        // PLAZO TOTAL (spec 054, promesa 494). Los plazos de COM cortan una llamada que no contesta, no una que tarda:
        // Wikipedia en Edge tardó 64-136 s en una sola lectura (2026-09-27), y este lector tiene UN hilo con cola, así
        // que lo siguiente esperaba detrás. Ahora se espera PlazoTotalMs y se contesta vacío; mientras esa lectura siga
        // atascada, las siguientes también contestaban vacío... y dejaban a Ü sin ojos el resto de la corrida (10 clics en
        // Edge, 2026-09-27). Ahora el hilo atascado se abandona y las siguientes van a uno nuevo. Vacío es «no sé», no «no hay».
        var tcs = new TaskCompletionSource<Lectura>(TaskCreationOptions.RunContinuationsAsynchronously);
        _cola.Add(() =>
        {
            try
            {
                var crudos = LeerEnElHilo(ventana);
                var textos = crudos.Where(c => c.Tipo == "Text" && !c.FueraDePantalla && c.Caja.Ancho > 0)
                    .Select(c => (c.Nombre ?? "").Trim()).Where(t => t.Length > 0)
                    .Select(t => t.Length > 80 ? t[..80] + "…" : t).Distinct().Take(MaxTextos).ToList();
                tcs.TrySetResult(new Lectura(Accionables.Numerar(crudos.Where(c => c.Tipo != "Text")), textos) { Foco = _foco, Campos = _campos.ToArray() });
            }
            catch (Exception e) { tcs.TrySetException(e); }
        });
        if (!tcs.Task.Wait(PlazoTotalMs))
        {
            var atascada = _cola;
            ArrancarHilo();
            atascada.CompleteAdding();   // el hilo viejo termina lo suyo y se va; nadie espera ya su respuesta
            UltimaAgotada = true;
            return Lectura.Vacia;
        }
        UltimaAgotada = false;
        return tcs.Task.GetAwaiter().GetResult();
    }

    /// <summary>Lo más que se espera una lectura entera (promesa 494). Una sana tarda 20-900 ms; Edge con Wikipedia, ~3 s.</summary>
    public const int PlazoTotalMs = 4000;

    /// <summary>Si la última lectura se contestó vacía por el plazo total, y no porque no hubiera nada.</summary>
    public bool UltimaAgotada { get; private set; }

    private List<Crudo> LeerEnElHilo(IntPtr ventana)
    {
        var crudos = new List<Crudo>();
        _foco = "";
        _campos.Clear();
        if (ventana == IntPtr.Zero) return crudos;
        // Las emergentes primero: un menú abierto tapa la ventana, y lo de arriba es lo que se pulsa.
        foreach (var h in Emergentes(ventana)) LeerUna(h, crudos);
        LeerUna(ventana, crudos);
        return crudos;
    }

    private void LeerUna(IntPtr h, List<Crudo> crudos)
    {
        IUIAutomationElement raiz;
        try { raiz = _uia.ElementFromHandle(h); }
        catch (COMException) { return; }   // la ventana murió entre enumerarla y leerla
        IUIAutomationElementArray todos;
        try { todos = raiz.FindAllBuildCache(TreeScope.TreeScope_Descendants, _condicion, _peticion); }
        catch (COMException e)
        {
            // Una ventana que no contesta en su plazo se salta, y se dice (promesa 474): las demás se leen igual.
            Traza?.Invoke($"leer: una ventana no contestó a tiempo, la salto: 0x{e.HResult:X8}: {e.Message}");
            return;
        }
        if (todos == null) return;
        // Cada ventana se recorta con SU caja (promesa 471): un menú que sobresale de la principal es otra ventana.
        GetWindowRect(h, out var rv);
        var ventana = new Caja(rv.L, rv.T, rv.R - rv.L, rv.B - rv.T);
        for (int i = 0; i < todos.Length; i++)
        {
            var e = todos.GetElement(i);
            try
            {
                var r = e.CachedBoundingRectangle;
                int tipo = e.CachedControlType;
                if (!Accionables.SeVe(new Caja(r.left, r.top, r.right - r.left, r.bottom - r.top), ventana)) continue;
                if (_foco.Length == 0 && e.GetCachedPropertyValue(PropFoco) is bool conFoco && conFoco) _foco = (e.CachedName ?? "").Trim();
                if ((tipo == 50004 || tipo == 50030) && _campos.Count < 12 && e.CachedIsOffscreen == 0)
                    _campos.Add(((e.CachedName ?? "").Trim(), e.GetCachedPropertyValue(PropValor) as string ?? ""));
                crudos.Add(new Crudo(
                    e.CachedName ?? "",
                    NombreDelTipo(tipo),
                    new Caja(r.left, r.top, r.right - r.left, r.bottom - r.top),
                    e.CachedIsEnabled != 0,
                    e.CachedIsOffscreen != 0));
            }
            catch (COMException) { /* un nodo que se fue a mitad de lectura no tumba la lectura */ }
        }
    }

    public const uint PlazoConectarMs = 1500, PlazoLeerMs = 3000;

    /// <summary>Los plazos que UIA tiene de verdad, leídos de vuelta tras ponerlos: (conectar, leer), en ms.</summary>
    public (int, int) Plazos { get; private set; }

    /// <summary>Por dónde dice el lector lo que no pudo hacer: un fallo de UIA que se calla parece que no había nada.</summary>
    public static Action<string>? Traza { get; set; }

    /// <summary>Un trabajo en el hilo MTA del lector, con su resultado.</summary>
    private T EnElHilo<T>(Func<T> trabajo)
    {
        var tcs = new TaskCompletionSource<T>();
        _cola.Add(() => { try { tcs.SetResult(trabajo()); } catch (Exception e) { tcs.SetException(e); } });
        return tcs.Task.GetAwaiter().GetResult();
    }

    /// <summary>Cómo se llama la barra de direcciones de Chrome y Edge, en español y en inglés (promesa 473).</summary>
    public static readonly string[] NombresDeLaBarra = { "Barra de direcciones y de búsqueda", "Address and search bar" };

    /// <summary>
    /// Escribe de una vez en la barra de direcciones del navegador (ValuePattern.SetValue, como escribe main): sin
    /// teclear letra a letra —~16 ms por letra— ni tocar el portapapeles. Devuelve si la encontró y escribió.
    /// </summary>
    /// <summary>¿Es la barra de direcciones? Sin espacios sobrantes: Chrome la llama «Barra de direcciones y de búsqueda ».</summary>
    public static bool EsLaBarra(string nombre) => NombresDeLaBarra.Contains((nombre ?? "").Trim());

    public bool EscribirEnLaBarra(IntPtr ventana, string texto) => EnElHilo(() =>
    {
        try
        {
            // El PRIMER campo de texto de la ventana, que en Chrome y Edge es la barra: 9 ms (sonda del 2026-09-26).
            // Por nombre exacto no se encontraba —lleva un espacio al final—; se comprueba después, sin espacios.
            var barra = _uia.ElementFromHandle(ventana).FindFirst(TreeScope.TreeScope_Descendants, _uia.CreatePropertyCondition(PropTipo, 50004));
            if (barra == null || !EsLaBarra(barra.CurrentName)) return false;
            if (barra.GetCurrentPattern(10002 /* ValuePattern */) is not IUIAutomationValuePattern valor) return false;
            valor.SetValue(texto);
            return true;
        }
        catch (COMException e) { Traza?.Invoke($"barra de direcciones: 0x{e.HResult:X8}: {e.Message}"); return false; }
    });

    private static string NombreDelTipo(int id)
    {
        if (id == TipoTexto) return "Text";
        foreach (var t in TiposAccionables) if (t.Id == id) return t.Nombre;
        return id.ToString();
    }

    // ── Las ventanas emergentes del mismo proceso ────────────────────────────────────────────────

    private delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumProc cb, IntPtr l);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr h, out RECT r);
    [StructLayout(LayoutKind.Sequential)] private struct RECT { public int L, T, R, B; }

    [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr h, uint cmd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr h, System.Text.StringBuilder s, int max);

    /// <summary>
    /// Las ventanas visibles POR ENCIMA de la de delante en el orden Z (EnumWindows va de arriba abajo), y de
    /// ellas solo las que le pertenecen (promesa 444): la regla está en <see cref="Emergentes.Elegir"/>.
    /// </summary>
    private static IReadOnlyList<IntPtr> Emergentes(IntPtr ventana)
    {
        var encima = new List<(IntPtr, IntPtr, string, bool)>();
        GetWindowThreadProcessId(ventana, out uint pid);
        EnumWindows((h, _) =>
        {
            if (h == ventana) return false;
            if (!IsWindowVisible(h)) return true;
            if (!GetWindowRect(h, out var r) || r.R - r.L <= 1 || r.B - r.T <= 1) return true;
            GetWindowThreadProcessId(h, out uint p);
            var sb = new System.Text.StringBuilder(64);
            GetClassName(h, sb, sb.Capacity);
            encima.Add((h, GetWindow(h, 4 /* GW_OWNER */), sb.ToString(), p == pid));
            return encima.Count < 40;
        }, IntPtr.Zero);
        return U.Ciclo.Emergentes.Elegir(ventana, encima);
    }

    public void Dispose() => _cola.CompleteAdding();
}
