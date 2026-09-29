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

    /// <summary>Cada paso en cuanto termina, para el log.</summary>
    public Action<string>? AlTerminarPaso { get; set; }

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
    /// vio ese nombre—; si no está a la vista, pasa a Jev como objetivo. Cualquier otra frase es un objetivo para Jev.
    /// </summary>
    public Recorrido Objetivo(string paso, IReadOnlyList<string> hecho)
    {
        string p = (paso ?? "").Trim();
        foreach (string prefijo in new[] { "pulsa:", "pulsar:" })
        {
            if (!p.StartsWith(prefijo, StringComparison.OrdinalIgnoreCase)) continue;
            string nombre = p[prefijo.Length..].Trim().Trim('«', '»', '"', '\'', '“', '”').Trim();
            if (nombre.Length > 0 && _pulsarPorNombre(nombre))
            {
                _acciones++;
                return new Recorrido(Array.Empty<Vuelta>(), $"cumplido: pulsé «{nombre}» por el ciclo rápido", true);
            }
            return Contar(_conJev($"pulsar «{nombre}»", hecho));
        }
        return Contar(_conJev(p, hecho));
    }

    private Recorrido Contar(Recorrido r)
    {
        _acciones += r.Vueltas.Count(v => v.Elegida.Length > 0);
        return r;
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
