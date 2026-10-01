using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace U.WindowsClient.Voice;

/// <summary>
/// LO QUE PASÓ EN UNA SESIÓN DE VOZ (spec 074, promesa 707): lo que dijo la persona, lo que hizo Ü y cómo
/// salió, y lo que la persona tocó, en el orden en que pasó. Es lo que se repasa al cerrar.
/// </summary>
/// <remarks>
/// <para>POR QUÉ NO BASTA EL HILO. <see cref="ConversacionPersonal"/> guarda solo el texto de los turnos, sin a
/// qué sesión pertenecen, sin las herramientas y sin cómo salieron. Un repaso sobre eso no distingue «lo
/// pidió y salió» de «lo pidió, falló, y lo corrigió» — y la corrección es justo lo que hay que aprender.</para>
/// <para>DE CADA HERRAMIENTA, LA PRIMERA LÍNEA. El inventario de la pantalla que viene detrás son miles de
/// caracteres por llamada, y no enseña nada de lo que la persona quiere.</para>
/// <para>EN MEMORIA MIENTRAS DURA, Y A DISCO AL CERRAR. Si el repaso falla, el archivo sigue ahí y se repasa
/// la próxima vez (711).</para>
/// </remarks>
public sealed class DiarioDeLaSesion
{
    /// <summary>Con menos palabras que estas en total, la persona no dijo nada que repasar: «hola», «gracias, chao».</summary>
    public const int MinimoDePalabras = 5;

    /// <summary>Cuánto del diario viaja al repaso, en caracteres. Una sesión de una hora no es un prompt de una hora.</summary>
    public const int TopeDelTexto = 24_000;

    private static readonly JsonSerializerOptions Json = new()
    {
        WriteIndented = true,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private readonly object _candado = new();
    private readonly List<Entrada> _entradas = new();
    private readonly Func<DateTimeOffset> _reloj;

    public sealed class Entrada
    {
        [JsonPropertyName("cuando")] public DateTimeOffset Cuando { get; set; }
        /// <summary>«persona», «u», «hizo» o «toco».</summary>
        [JsonPropertyName("quien")] public string Quien { get; set; } = "";
        [JsonPropertyName("texto")] public string Texto { get; set; } = "";
    }

    private sealed class Documento
    {
        [JsonPropertyName("sesion")] public string Sesion { get; set; } = "";
        [JsonPropertyName("entradas")] public List<Entrada> Entradas { get; set; } = new();
    }

    public DiarioDeLaSesion(string sesion, Func<DateTimeOffset>? reloj = null)
    {
        Sesion = string.IsNullOrWhiteSpace(sesion) ? Guid.NewGuid().ToString("n") : sesion.Trim();
        _reloj = reloj ?? (() => DateTimeOffset.Now);
    }

    public string Sesion { get; }

    /// <summary>Dónde esperan los diarios que aún no se repasaron.</summary>
    public static string CarpetaPorDefecto => Path.Combine(global::U.Graph.UserPaths.Local, "U", "sesiones-por-repasar");

    /// <summary>Lo que dijo o escribió la persona.</summary>
    public void Persona(string texto) => Anotar("persona", texto);

    /// <summary>Lo que dijo Ü.</summary>
    public void U(string texto) => Anotar("u", texto);

    /// <summary>Lo que la persona tocó en pantalla, tal como lo entrega <see cref="LoQueHiciste"/>.</summary>
    public void Toco(string linea) => Anotar("toco", linea);

    /// <summary>Una herramienta que Ü usó: cuál, con qué, y cómo salió.</summary>
    public void Hizo(string herramienta, string argumentos, string resultado, bool fallo)
    {
        string primera = (resultado ?? "").Split('\n')[0].Trim();
        if (primera.Length > 240) primera = primera[..240] + "…";
        // LOS ARGUMENTOS, CASI ENTEROS: el plan de un map_hacer —diez pasos— ES lo que se hizo, y es de donde
        // sale una habilidad. Lo que se recorta es el resultado, no el pedido.
        string con = Espacios(argumentos);
        if (con.Length > 700) con = con[..700] + "…";
        Anotar("hizo", $"{herramienta}{(con.Length > 0 ? " " + con : "")} → {(fallo ? "NO SALIÓ: " : "")}{primera}");
    }

    private void Anotar(string quien, string texto)
    {
        string limpio = quien == "hizo" ? (texto ?? "").Trim() : Espacios(texto);
        if (limpio.Length == 0) return;
        lock (_candado) _entradas.Add(new Entrada { Cuando = _reloj(), Quien = quien, Texto = limpio });
    }

    public IReadOnlyList<Entrada> Entradas
    {
        get { lock (_candado) return _entradas.ToList(); }
    }

    /// <summary>Solo lo que dijo la persona: es contra lo que se comprueba cada cita (708).</summary>
    public IReadOnlyList<string> DichoPorLaPersona
    {
        get { lock (_candado) return _entradas.Where(e => e.Quien == "persona").Select(e => e.Texto).ToList(); }
    }

    /// <summary>Si la persona dijo algo con sustancia. Sin eso no hay nada que aprender y no se gasta un repaso (712).</summary>
    public bool TieneQueRepasar
        => DichoPorLaPersona.Sum(t => t.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length) >= MinimoDePalabras;

    /// <summary>El diario como lo lee quien repasa: una línea por cosa, en orden, diciendo de quién es.</summary>
    public string Texto(int tope = TopeDelTexto)
    {
        List<Entrada> entradas;
        lock (_candado) entradas = _entradas.ToList();
        if (entradas.Count == 0) return "";
        var t0 = entradas[0].Cuando;
        var lineas = entradas.Select(e =>
        {
            var d = e.Cuando - t0;
            string quien = e.Quien switch { "persona" => "PERSONA", "u" => "Ü", "hizo" => "Ü HIZO", "toco" => "LA PERSONA TOCÓ", _ => e.Quien.ToUpperInvariant() };
            return $"[{(int)d.TotalMinutes:00}:{d.Seconds:00}] {quien}: {e.Texto}";
        }).ToList();
        string texto = string.Join("\n", lineas);
        if (texto.Length <= tope) return texto;

        // SE RECORTA POR DELANTE Y SE DICE (patrón nº10): lo último que pasó es lo que más pesa, y lo que no
        // viaja no puede desaparecer sin rastro — quien repasa tiene que saber que falta el principio.
        int quitadas = 0;
        while (lineas.Count > 1 && string.Join("\n", lineas).Length > tope - 80) { lineas.RemoveAt(0); quitadas++; }
        return $"[recortado: faltan las {quitadas} primeras líneas de la sesión]\n" + string.Join("\n", lineas);
    }

    /// <summary>Escribe el diario en <paramref name="carpeta"/> y devuelve su ruta. Atómico: o entero, o nada.</summary>
    public string Guardar(string carpeta)
    {
        Directory.CreateDirectory(carpeta);
        string archivo = Path.Combine(carpeta, Regex.Replace(Sesion, @"[^\w\-]", "_") + ".json");
        var doc = new Documento { Sesion = Sesion, Entradas = Entradas.ToList() };
        string temporal = archivo + "." + Guid.NewGuid().ToString("N") + ".tmp";
        File.WriteAllText(temporal, JsonSerializer.Serialize(doc, Json));
        File.Move(temporal, archivo, overwrite: true);
        return archivo;
    }

    /// <summary>El diario que hay en <paramref name="archivo"/>. Null si no se puede leer: quien llama decide qué hacer con él.</summary>
    public static DiarioDeLaSesion? Leer(string archivo)
    {
        try
        {
            var doc = JsonSerializer.Deserialize<Documento>(File.ReadAllText(archivo), Json);
            if (doc == null || string.IsNullOrWhiteSpace(doc.Sesion)) return null;
            var diario = new DiarioDeLaSesion(doc.Sesion);
            lock (diario._candado) diario._entradas.AddRange(doc.Entradas.Where(e => !string.IsNullOrWhiteSpace(e.Texto)));
            return diario;
        }
        catch (JsonException) { return null; }
        catch (IOException) { return null; }
    }

    private static string Espacios(string? texto) => Regex.Replace(texto ?? "", @"\s+", " ").Trim();
}
