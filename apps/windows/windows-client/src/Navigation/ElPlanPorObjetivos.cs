using System.Text.Json;
using System.Text.RegularExpressions;
using U.Ciclo;
using U.WindowsClient.Diagnostics;

namespace U.WindowsClient.Navigation;

/// <summary>
/// EL PLAN DE LUNA, CUMPLIDO POR JEFF (spec 062, promesas 514-517): Luna manda la lista entera de pasos en UNA llamada
/// (map_hacer) y el ejecutor de u/ los recorre con las manos de U.exe, parando en el primero que falla.
/// </summary>
/// <remarks>
/// LO QUE COSTABA NO TENERLO (sesión del dueño del 2026-09-28, p33388): 25 respuestas de Luna, una acción cada una, ~2 s
/// cada respuesta — ~77 % del pedido era Luna pensando. u/ ya había probado este reparto una noche entera (spec 052: 77 de
/// 78 pedidos): Luna planea por objetivos y Jev elige, dentro de cada objetivo, qué pulsar. Aquí solo se le da a U.exe la
/// forma de pedirlo, y cada paso se cumple o falla EN LA PANTALLA DE AHORA: si falla, vuelve a Luna con lo que hay delante
/// en vez de seguir un plan que ya no vale (la lección de Agent S3).
///
/// Un paso es UNO de estos: «abre: …», «escribe: …», «tecla: …», «desplaza: …», «esperar», los gestos de u/; «pulsa:
/// &lt;nombre&gt;» cuando Luna ya ve el nombre exacto —va por el ciclo rápido, sin Jev—; o una frase, que es un objetivo
/// para Jev.
/// </remarks>
public sealed class ElPlanPorObjetivos
{
    private readonly Func<string, bool> _abrir;
    private readonly Action<string> _escribir;
    private readonly Func<string, bool> _tecla;
    private readonly Func<string, bool> _pulsarPorNombre;
    private readonly Func<string, IReadOnlyList<string>, Recorrido> _conJev;
    private readonly Func<bool> _hayQueParar;
    private readonly Func<string> _loQueHayAhora;
    private readonly Func<long> _relojMs;
    private int _acciones;

    /// <param name="pulsarPorNombre">El ciclo rápido: true si pulsó algo con ese nombre.</param>
    /// <param name="conJev">Un objetivo, con lo ya hecho del plan: el motor de u/ con Jev eligiendo.</param>
    /// <param name="loQueHayAhora">Lo que se ve al terminar, en el formato del inventario (EN PANTALLA AHORA).</param>
    public ElPlanPorObjetivos(Func<string, bool> abrir, Action<string> escribir, Func<string, bool> tecla,
        Func<string, bool> pulsarPorNombre, Func<string, IReadOnlyList<string>, Recorrido> conJev,
        Func<bool> hayQueParar, Func<string> loQueHayAhora, Func<long> relojMs)
    {
        _abrir = abrir; _escribir = escribir; _tecla = tecla; _pulsarPorNombre = pulsarPorNombre; _conJev = conJev;
        _hayQueParar = hayQueParar; _loQueHayAhora = loQueHayAhora; _relojMs = relojMs;
    }

    /// <summary>La rueda del ratón, en muescas (negativas hacia abajo). Sin ella, «desplaza:» falla y lo dice.</summary>
    public Func<int, bool>? Desplazar { get; set; }

    /// <summary>Esperar a que la pantalla se quede quieta, sin pulsar nada.</summary>
    public Func<bool>? EsperarQuieta { get; set; }

    /// <summary>
    /// Abrir una carpeta por el disco, como file_open (promesa 526): true si llegó. Sin ella, «carpeta:» falla y lo dice.
    /// </summary>
    public Func<string, bool>? AbrirCarpeta { get; set; }

    /// <summary>Cada paso en cuanto termina, para el log.</summary>
    public Action<string>? AlTerminarPaso { get; set; }

    /// <summary>
    /// VARIOS CON ESE NOMBRE (promesa 691): si el último «pulsa: X» no pulsó porque hay más de un «X» a la vista, la lista
    /// numerada con que contestó el ciclo rápido; si no, null. Sin ella, lo de antes: el paso pasa a Jev.
    /// </summary>
    /// <remarks>
    /// Hasta el 2026-10-01 el paso pasaba a Jev como «llegar a «X» y pulsarlo», y Jev elegía uno con su umbral. Con dos
    /// pacientes del mismo nombre, eso es equivocarse de paciente sin que nadie se entere. Ahora el plan para con la lista, y
    /// quien planea elige con map_take y which —por el tipo, o mirando— o, si son personas distintas, pregunta (la regla
    /// vive en las instrucciones del delegado).
    /// </remarks>
    public Func<string, string?>? Homonimos { get; set; }

    /// <summary>La cuenta del último plan (promesa 515): la línea que lee la métrica de la spec 062.</summary>
    public string UltimaCuenta { get; private set; } = "";

    /// <summary>
    /// Los pasos de un plan (promesa 515): una lista JSON de textos, un objeto con «pasos», o una línea por paso —sin la
    /// numeración ni la viñeta—. null si no hay nada que ejecutar, y <paramref name="porque"/> dice por qué.
    /// </summary>
    public static IReadOnlyList<string>? Leer(string pasos, out string porque)
    {
        porque = "";
        string t = (pasos ?? "").Trim();
        if (t.StartsWith("```"))
        {
            int ini = t.IndexOf('\n'), fin = t.LastIndexOf("```", StringComparison.Ordinal);
            t = ini >= 0 && fin > ini ? t[(ini + 1)..fin].Trim() : t.Trim('`').Trim();
        }
        const string Vacio = "el plan llegó vacío: no hice nada. Manda «pasos» con la lista de pasos, en orden.";
        if (t.Length == 0) { porque = Vacio; return null; }

        var lista = new List<string>();
        if (t[0] is '[' or '{')
        {
            try
            {
                using var d = JsonDocument.Parse(t);
                var raiz = d.RootElement;
                if (raiz.ValueKind == JsonValueKind.Object && !raiz.TryGetProperty("pasos", out raiz))
                { porque = "el plan no trae «pasos»: no hice nada."; return null; }
                if (raiz.ValueKind != JsonValueKind.Array)
                { porque = "«pasos» tiene que ser una LISTA de pasos: no hice nada."; return null; }
                foreach (var e in raiz.EnumerateArray()) lista.Add(Limpiar(Texto(e)));
            }
            catch (JsonException e) { porque = $"no entendí «pasos» como una lista JSON ({e.Message}): no hice nada."; return null; }
        }
        else lista.AddRange(t.Split('\n').Select(Limpiar));

        lista.RemoveAll(p => p.Length == 0);
        if (lista.Count == 0) { porque = Vacio; return null; }
        return lista;
    }

    /// <summary>Un paso de la lista: su texto, o el primer texto de un objeto ({"paso": "…"}).</summary>
    private static string Texto(JsonElement e) => e.ValueKind switch
    {
        JsonValueKind.String => e.GetString() ?? "",
        JsonValueKind.Object => e.EnumerateObject().Select(p => p.Value).FirstOrDefault(v => v.ValueKind == JsonValueKind.String) is { ValueKind: JsonValueKind.String } v
            ? v.GetString() ?? "" : "",
        _ => "",
    };

    private static readonly Regex Vineta = new(@"^(\d+[\.\)]|[-•*])\s+");
    private static string Limpiar(string linea) => Vineta.Replace((linea ?? "").Trim(), "").Trim();

    /// <summary>La cuenta de un plan, SOBRE EL PLAN ENTERO (promesa 515, patrón nº10): lo omitido también cuenta.</summary>
    public static string Linea(PlanResultado r, int acciones, long ms)
    {
        int n = r.Pasos.Count;
        int k = r.Pasos.Count(p => p.Estado == "Hecho"), f = r.Pasos.Count(p => p.Estado == "Fallido"), o = r.Pasos.Count(p => p.Estado == "Omitido");
        return $"⏱ plan: {n} objetivo(s) · {k} cumplido(s) · {f} fallido(s) · {o} omitido(s) · {acciones} acción(es) · {ms} ms";
    }

    /// <summary>Ejecuta el plan y devuelve el relato para Luna: cómo acabó cada paso, y lo que hay en pantalla ahora.</summary>
    public string Hacer(string pasosTexto)
    {
        var pasos = Leer(pasosTexto, out string porque);
        if (pasos == null) return porque;
        LogBus.Log("plan", $"📋 plan de {pasos.Count} paso(s): {string.Join(" → ", pasos)}");
        long t0 = _relojMs();
        _acciones = 0;
        var ejecutor = new Ejecutor(
            app => { _acciones++; return _abrir(app); },
            texto => { _acciones++; _escribir(texto); },
            tecla => { _acciones++; return _tecla(tecla); },
            Objetivo, _hayQueParar)
        {
            AlTerminarPaso = AlTerminarPaso,
            Desplazar = Desplazar == null ? null : m => { _acciones++; return Desplazar(m); },
            EsperarQuieta = EsperarQuieta,
        };
        var r = ejecutor.Ejecutar(pasos);
        UltimaCuenta = Linea(r.Resultado, _acciones, _relojMs() - t0);
        LogBus.Log("plan", UltimaCuenta);
        string ahora;
        try { ahora = _loQueHayAhora() ?? ""; }
        catch (Exception e) { ahora = $"no pude leer lo que hay ahora ({e.GetType().Name}: {e.Message})"; }
        return ParaLuna.Recortar(r.Relato() + (ahora.Length > 0 ? "\n\n" + ahora : ""));
    }

    /// <summary>
    /// A DÓNDE VA UN PASO QUE NO ES UN GESTO (promesa 516): «pulsa: &lt;nombre&gt;» por el ciclo rápido, sin Jev —Luna ya
    /// vio ese nombre—; si no está a la vista, pasa a Jev como objetivo, y si hay varios con ese nombre, el plan para con
    /// la lista (691). Cualquier otra frase es un objetivo para Jev.
    /// </summary>
    public Recorrido Objetivo(string paso, IReadOnlyList<string> hecho)
    {
        string p = (paso ?? "").Trim();
        // UNA CARPETA POR EL DISCO (promesa 526): 0,17 s y sin Jev. Luna iba carpeta a carpeta con file_open, una vuelta suya
        // por carpeta —20 s pensando para 1,2 s de trabajo (2026-09-29, 03:03)—.
        if (p.StartsWith("carpeta:", StringComparison.OrdinalIgnoreCase))
        {
            string ruta = p[8..].Trim().Trim('«', '»', '"', '\'').Trim();
            if (AbrirCarpeta == null) return new Recorrido(Array.Empty<Vuelta>(), "no sé abrir carpetas aquí: nadie conectó quien las abra", false);
            if (ruta.Length > 0 && AbrirCarpeta(ruta))
            {
                _acciones++;
                return new Recorrido(Array.Empty<Vuelta>(), $"cumplido: abrí la carpeta «{ruta}»", true);
            }
            return new Recorrido(Array.Empty<Vuelta>(), $"no pude abrir la carpeta «{ruta}»: no existe o no se dejó abrir", false);
        }
        foreach (string prefijo in new[] { "pulsa:", "pulsar:" })
        {
            if (!p.StartsWith(prefijo, StringComparison.OrdinalIgnoreCase)) continue;
            string nombre = p[prefijo.Length..].Trim().Trim('«', '»', '"', '\'', '“', '”').Trim();
            if (nombre.Length > 0)
            {
                if (_pulsarPorNombre(nombre)) return Pulsado(nombre);
                // VARIOS NO ES «NO ESTÁ» (promesa 691): ni se espera ni se le pasa a Jev; el plan para con la lista.
                if (Varios(nombre) is { } varios) return varios;
                // SI NO ESTÁ, PUEDE QUE LA PÁGINA AÚN CARGUE (promesa 524): una espera a que se quede quieta y otra búsqueda,
                // antes de pedirle a Jev que adivine sobre una pantalla a medias.
                if (EsperarQuieta?.Invoke() == true)
                {
                    if (_pulsarPorNombre(nombre)) return Pulsado(nombre);
                    if (Varios(nombre) is { } variosTrasEsperar) return variosTrasEsperar;
                }
            }
            // LLEGAR, NO ADIVINAR (promesa 525): si no está en esta pantalla, Jev puede navegar hasta donde esté. Con «pulsar
            // «Sonido»» dentro de Pantalla, Jev eligió «Mostrar más valores» con 0,31 (2026-09-29, 03:04): Sonido cuelga de Sistema.
            return Contar(_conJev($"llegar a «{nombre}» y pulsarlo: si no está en esta pantalla, ve primero a donde esté "
                                + "(la sección que lo contiene, o Atrás)", hecho));
        }
        return Contar(_conJev(p, hecho));
    }

    private Recorrido Pulsado(string nombre)
    {
        _acciones++;
        return new Recorrido(Array.Empty<Vuelta>(), $"cumplido: pulsé «{nombre}» por el ciclo rápido", true);
    }

    /// <summary>El paso que para porque hay varios con ese nombre (promesa 691); null si no fue por eso.</summary>
    private Recorrido? Varios(string nombre)
    {
        string? lista = Homonimos?.Invoke(nombre);
        if (string.IsNullOrWhiteSpace(lista)) return null;
        // «Repite con which=N» es la frase de map_take; aquí which no existe, y se dice dónde está.
        int corte = lista.IndexOf(" Repite con which=N", StringComparison.Ordinal);
        string cuales = (corte > 0 ? lista[..corte] : lista).Trim().TrimEnd('.');
        return new Recorrido(Array.Empty<Vuelta>(),
            $"no pulsé nada: {cuales}. El plan para aquí: el que toque se pulsa con map_take («{nombre}») y which=N", false);
    }

    private Recorrido Contar(Recorrido r)
    {
        _acciones += r.Vueltas.Count(v => v.Elegida.Length > 0);
        return r;
    }

    /// <summary>
    /// DÓNDE TRABAJA EL PLAN (promesa 519): la regla del ciclo rápido (491) — la ventana de delante, y si delante está Ü o
    /// nada, la de trabajo. La de u/ (<c>Donde.Ahora</c>) devuelve la última ajena que vio ELLA, y en U.exe no había visto
    /// ninguna: con Ü delante —la persona le acaba de escribir—, 2 de 4 órdenes dijeron «no hay ninguna ventana delante».
    /// </summary>
    public static Ubicacion? Donde(IntPtr delante, bool delanteEsU, IntPtr trabajo, Func<IntPtr, Ubicacion> describir)
    {
        IntPtr v = CicloRapido.ElegirVentana(delante, delanteEsU, trabajo);
        return v == IntPtr.Zero ? null : describir(v);
    }

    /// <summary>
    /// LA MANO DE JEV EN EL PLAN (promesa 517): el mismo cuidado que las otras seis manos (510). Se mira qué hay bajo el
    /// punto; si es una ventana de Ü, no se pulsa y se dice cuál; si no, clic, y la carita se entera DESPUÉS (504).
    /// null = pulsó.
    /// </summary>
    public static string? Pulsar(Accionable a, Func<int, int, string?>? librar, Action<int, int> clic, Action<Caja>? trasPulsar)
    {
        var (x, y) = Raton.Centro(a.Caja);
        string? tapado = librar?.Invoke(x, y);
        if (!string.IsNullOrWhiteSpace(tapado)) return $"no pulsé «{a.Nombre}»: {tapado}";
        clic(x, y);
        try { trasPulsar?.Invoke(a.Caja); }
        catch (Exception e) { LogBus.Log("plan", $"el aviso a la carita reventó y el clic no se enteró: {e.GetType().Name}: {e.Message}"); }
        return null;
    }
}
