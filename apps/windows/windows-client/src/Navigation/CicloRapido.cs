using U.Ciclo;

namespace U.WindowsClient.Navigation;

/// <summary>
/// EL CICLO DE u/ DENTRO DE map_take (spec 054, promesas 485-488): ver → clic → volver a ver, y nada más.
/// </summary>
/// <remarks>
/// LÍNEA BASE DEL 2026-09-27, plan fijo en este PC: un ciclo de la rama costaba 2.268 ms de mediana y el de u/ 502,
/// con el clic igual (76 vs 61 ms). El resto era lo que el camino del núcleo hace alrededor: la compuerta de vivo
/// (EsperarloVivo, con lecturas enteras), 6-10 ubicaciones por clic, un asentado que identifica la pantalla en cada
/// vuelta, y al final OTRA lectura entera —de la ventana de la persona— pegada a la respuesta. Aquí hay una lectura
/// antes (ninguna si la del ciclo anterior es reciente), el clic, y las lecturas de la espera; la última de ellas ES
/// la respuesta. Lo que se desconectó de este camino, y dónde vive entero, está en docs/patrimonio-del-grafo.md.
/// </remarks>
public sealed class CicloRapido
{
    private readonly Func<IntPtr> _ventana;
    private readonly Func<IntPtr, Lectura> _leer;
    private readonly Action<int, int> _clic;
    private readonly Func<bool> _freno;
    private readonly Func<long> _reloj;
    private Lectura? _ultima;
    private IntPtr _ultimaVentana;
    private long _ultimaEn;

    /// <summary>Una lectura más vieja que esto se vuelve a hacer antes de pulsar (promesa 487).</summary>
    public const int VigenciaMs = 2000;

    public CicloRapido(Func<IntPtr> ventana, Func<IntPtr, Lectura> leer, Action<int, int> clic, Func<bool> freno, Func<long> relojMs)
    {
        _ventana = ventana; _leer = leer; _clic = clic; _freno = freno; _reloj = relojMs;
    }

    /// <summary>El título de la ventana, para la cabecera de lo que se ve. Sin él, la cabecera va sin nombre.</summary>
    public Func<IntPtr, string>? Titulo { get; set; }

    /// <summary>¿La ventana es SAP? Entonces el ciclo no se encarga (promesa 498). La regla es Uia.Sap.EsVentana.</summary>
    public Func<IntPtr, bool>? EsSap { get; set; }

    /// <summary>La consulta al tope de intentos antes de pulsar (promesa 204): si devuelve algo, no se pulsa y eso se contesta.</summary>
    public Func<string, string?>? AntesDePulsar { get; set; }

    /// <summary>
    /// ¿Está libre el punto que se va a pulsar? null = sí; si no, por qué (promesa 510): un clic de Ü no cae sobre una
    /// ventana de Ü. Es una propiedad y no un parámetro: el contrato construye el ciclo con cinco (485-499).
    /// </summary>
    public Func<int, int, string?>? LibrarElPunto { get; set; }

    /// <summary>
    /// EL AVISO TRAS EL CLIC, con la caja de lo pulsado (promesa 504): la carita va a verlo. Sale después del clic y antes
    /// de esperar el cambio, y no se le espera: quien lo atiende lo pasa al hilo de la interfaz.
    /// </summary>
    public Action<Caja>? TrasPulsar { get; set; }

    /// <summary>
    /// EL AVISO DE VERDAD (promesa 504): por el mismo pulso que la mano rápida y la escalera, con la caja del elemento. Si
    /// quien lo escucha revienta, lanza con el porqué, y el ciclo lo deja en <see cref="AvisoFallido"/>.
    /// </summary>
    public static void AvisarALaCarita(Caja c)
    {
        if (U.Graph.Surfaces.UiaSurface.AvisarDelPulso(c.X, c.Y, c.Ancho, c.Alto) is { } fallo)
            throw new InvalidOperationException(fallo);
    }

    /// <summary>Lo que costó mirar bajo el punto en el último Pulsar, en ms: casi siempre 0; más solo si hubo que apartar la carita.</summary>
    public long MsLibrar { get; private set; }

    /// <summary>Por qué reventó el último aviso, o vacío. El clic no se entera; el log sí (patrón nº3: nada de catch mudo).</summary>
    public string AvisoFallido { get; private set; } = "";

    /// <summary>Del último Pulsar: si se pulsó algo, si la pantalla cambió, y lo que costó cada parte.</summary>
    public bool Pulso { get; private set; }
    public bool Cambio { get; private set; }
    public string Pulsado { get; private set; } = "";

    /// <summary>
    /// La clave de lo pulsado, la MISMA con la que se consultó al tope antes de pulsar (promesa 499): así el tope cuenta los
    /// fallos de ese botón aunque la próxima vez se pida de otra forma.
    /// </summary>
    public string ClaveDelPulsado { get; private set; } = "";

    private static string ClaveDe(Accionable a) => $"uia:name={a.Nombre};ct={a.Tipo}";
    public (long Ver, long Clic, long Esperar, int Lecturas) Tiempos { get; private set; }

    /// <summary>Por qué el último Pulsar no se encargó (null), para que el log lo diga: tres causas, tres frases (aprendizaje nº2).</summary>
    public string PorQueNo { get; private set; } = "";

    /// <summary>
    /// Del último Pulsar que NO encontró el nombre: si las dos lecturas con que lo buscó eran la misma pantalla
    /// (spec 081, promesa 791). Entonces <see cref="Ultima"/> es una lectura quieta, y sobre ella se puede elegir sin
    /// esperar. Falso si la pantalla cambió entre las dos —puede estar cargando— o si no se dejó leer.
    /// </summary>
    public bool QuietaAlNoEncontrar { get; private set; }

    /// <summary>La última lectura, para quien quiera contar lo que se ve sin volver a leer.</summary>
    public Lectura? Ultima => _ultima;
    public IntPtr UltimaVentana => _ultimaVentana;
    public long UltimaEnMs => _ultimaEn;

    /// <summary>
    /// Pulsa lo pedido si es suyo. null = no es un clic por nombre en UIA, o no está en pantalla: decide el camino de
    /// siempre (SAP, AutomationId, destinos del grafo). Si no, la respuesta entera, con lo que se ve después.
    /// </summary>
    public string? Pulsar(string exit, int cual)
    {
        Pulso = false; Cambio = false; Pulsado = ""; ClaveDelPulsado = ""; Tiempos = default;
        PorQueNo = ""; AvisoFallido = ""; MsLibrar = 0; QuietaAlNoEncontrar = false;
        if (!QueSePide(exit, out string nombre, out string tipo)) { PorQueNo = "no es un clic por nombre en UIA"; return null; }
        IntPtr v = _ventana();
        if (v == IntPtr.Zero) { PorQueNo = "no hay ventana de trabajo delante (ni se pudo traer)"; return null; }
        // SAP no es del ciclo (promesa 498): por UIA solo se ve un panel opaco, y «no está» mentiría. Ni se lee.
        if (EsSap?.Invoke(v) == true) { PorQueNo = "delante está SAP: va por la mano de SAP"; return null; }

        long t0 = _reloj();
        bool fresca = _ultima != null && _ultimaVentana == v && t0 - _ultimaEn < VigenciaMs;
        var antes = fresca ? _ultima! : Leer(v);
        var iguales = Buscar(antes, nombre, tipo);
        // Se busca en una lectura nueva solo si la de antes LEYÓ algo: una vacía es «no se dejó leer a tiempo» (494), y
        // repetirla eran otros 4 s para lo mismo (14 s por clic en Edge, 2026-09-27).
        if (iguales.Count == 0 && antes.Accionables.Count > 0)
        {
            string huellaDeAntes = antes.Huella;
            antes = Leer(v); iguales = Buscar(antes, nombre, tipo);
            // DOS LECTURAS SEGUIDAS, Y LA MISMA PANTALLA (spec 081, promesa 791): está quieta, que es justo lo que
            // una espera comprobaría con dos lecturas más. Quien resuelve el nombre de un tiro mira esto.
            QuietaAlNoEncontrar = iguales.Count == 0 && antes.Accionables.Count > 0 && antes.Huella == huellaDeAntes;
        }
        // LO QUE NO ESTÁ SE DICE AL MOMENTO (promesa 493), como u/. Caer al camino de siempre costaba 60 s por clic en
        // Edge (2026-09-27): el grafo que ese camino consultaba ya no se alimenta, y su lector no aguanta una página.
        if (iguales.Count == 0)
            // Sin un solo accionable no es «no está»: es que la pantalla no se dejó leer a tiempo (promesa 494). Dos causas, dos frases.
            return antes.Accionables.Count == 0
                ? $"no pude leer la pantalla a tiempo: no sé si «{nombre}» está. No pulsé nada."
                : $"«{nombre}» no está a la vista: no pulsé nada.\n\n" + Describir(antes, v);

        Accionable el;
        if (iguales.Count > 1)
        {
            if (cual < 1 || cual > iguales.Count) return Numerar(nombre, iguales);
            el = iguales[cual - 1];
        }
        else el = iguales[0];

        if (_freno()) return $"no pulsé «{el.Nombre}»: el freno está echado (Escape).";
        string clave = ClaveDe(el);
        string? veto = AntesDePulsar?.Invoke(clave);
        if (!string.IsNullOrWhiteSpace(veto)) return veto;

        long msVer = _reloj() - t0;
        var (x, y) = Raton.Centro(el.Caja);
        // UN CLIC DE Ü NO CAE SOBRE UNA VENTANA DE Ü (promesa 510). La firma (508) evita que abra la voz, pero no que la
        // ventana se active ni que el clic se pierda: se mira antes, y si está tapado, se dice y no se pulsa.
        long tl = _reloj();
        string? tapado = LibrarElPunto?.Invoke(x, y);
        MsLibrar = _reloj() - tl;
        if (tapado is { Length: > 0 }) return $"no pulsé «{el.Nombre}»: {tapado}.";
        long tc = _reloj();
        _clic(x, y);
        long msClic = _reloj() - tc;
        try { TrasPulsar?.Invoke(el.Caja); }
        catch (Exception e) { AvisoFallido = $"{e.GetType().Name}: {e.Message}"; }

        Lectura despues = antes;
        var a = Asentado.Esperar(() => { despues = Leer(v); return despues.Huella; }, antes.Huella, Asentado.TechoTras(el.Tipo), _reloj);
        Pulso = true; Cambio = a.Cambio; Pulsado = el.Nombre; ClaveDelPulsado = clave;
        Tiempos = (msVer, msClic, a.Ms, a.Lecturas);
        return $"pulsé «{el.Nombre}» ({el.Tipo}) y la pantalla {(a.Cambio ? "cambió" : "no cambió")}.\n\n" + Describir(despues, v);
    }

    /// <summary>
    /// SOBRE QUÉ VENTANA (promesa 491): la de delante, la que la persona ve, como u/. Solo si delante está la propia Ü
    /// —o nada—, la de trabajo. Sin el fondo, la ventana de trabajo dejó de seguir al foco y el ciclo leía la
    /// Calculadora de antes con el Bloc de notas delante (30 clics seguidos, 2026-09-27).
    /// </summary>
    public static IntPtr ElegirVentana(IntPtr delante, bool delanteEsU, IntPtr trabajo) =>
        delante != IntPtr.Zero && !delanteEsU ? delante : trabajo;

    [System.Runtime.InteropServices.DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [System.Runtime.InteropServices.DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);

    /// <summary>La ventana de delante y si es de este mismo proceso (la carita, el panel).</summary>
    public static (IntPtr Ventana, bool EsU) Delante()
    {
        IntPtr h = GetForegroundWindow();
        if (h == IntPtr.Zero) return (IntPtr.Zero, false);
        GetWindowThreadProcessId(h, out uint pid);
        return (h, pid == (uint)Environment.ProcessId);
    }

    /// <summary>Lo que se ve, en el formato del inventario de los actos (promesa 263): EN PANTALLA AHORA, y lo que dice.</summary>
    public string Describir(Lectura l, IntPtr v)
    {
        string t = Titulo?.Invoke(v) ?? "";
        var sb = new System.Text.StringBuilder();
        sb.Append("EN PANTALLA AHORA").Append(t.Length > 0 ? $", en «{t}»" : "").Append($" ({l.Accionables.Count} elemento(s)):\n");
        foreach (var a in l.Accionables) sb.Append($"  «{a.Nombre}» ({a.Tipo})\n");
        if (l.Textos.Count > 0)
        {
            sb.Append("LA PANTALLA DICE:\n");
            foreach (var x in l.Textos) sb.Append($"  · {x}\n");
        }
        return sb.ToString().TrimEnd();
    }

    /// <summary>
    /// MIRAR con el mismo lector y la misma memoria que el ciclo (promesa 495): lo que se lee aquí es lo que el clic
    /// siguiente reutiliza si tiene menos de 2 s.
    /// </summary>
    public Lectura Mirar(IntPtr v) => Leer(v);

    private Lectura Leer(IntPtr v)
    {
        var l = _leer(v);
        _ultima = l; _ultimaVentana = v; _ultimaEn = _reloj();
        return l;
    }

    private static List<Accionable> Buscar(Lectura l, string nombre, string tipo)
    {
        var exactos = l.Accionables.Where(a => string.Equals(a.Nombre.Trim(), nombre, StringComparison.Ordinal)
                                            && (tipo.Length == 0 || string.Equals(a.Tipo, tipo, StringComparison.Ordinal))).ToList();
        return exactos.Count > 0 ? exactos
            : l.Accionables.Where(a => string.Equals(a.Nombre.Trim(), nombre, StringComparison.OrdinalIgnoreCase)
                                     && (tipo.Length == 0 || string.Equals(a.Tipo, tipo, StringComparison.OrdinalIgnoreCase))).ToList();
    }

    private static string Numerar(string nombre, List<Accionable> iguales) =>
        $"hay {iguales.Count} «{nombre}» a la vista: "
        + string.Join("; ", iguales.Select((a, i) => $"{i + 1}) «{a.Nombre}» ({a.Tipo})"))
        + ". Repite con which=N para pulsar ese.";

    /// <summary>¿Es un clic por nombre en UIA? SAP, AutomationId y ubicaciones del grafo no (promesa 488).</summary>
    private static bool QueSePide(string exit, out string nombre, out string tipo)
    {
        nombre = ""; tipo = "";
        string e = (exit ?? "").Trim();
        if (e.Length == 0 || e.StartsWith("sap:", StringComparison.OrdinalIgnoreCase) || e.Contains("://")) return false;
        if (e.StartsWith(U.Graph.Surfaces.UiaSelector.Prefix, StringComparison.OrdinalIgnoreCase))
        {
            var claves = U.Graph.Surfaces.UiaSelector.Parse(e);
            if (!claves.TryGetValue("name", out var n) || string.IsNullOrWhiteSpace(n)) return false;
            nombre = n.Trim();
            if (claves.TryGetValue("ct", out var ct)) tipo = ct ?? "";
            return true;
        }
        nombre = e;
        return true;
    }
}
