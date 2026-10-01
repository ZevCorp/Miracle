using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace U.WindowsClient.Voice;

/// <summary>
/// LO QUE PASÓ EN UNA SESIÓN DE VOZ (spec 074, promesa 767): lo que dijo la persona, lo que hizo Ü y cómo
/// salió, y lo que la persona tocó, en el orden en que pasó. Es lo que se repasa al cerrar.
/// </summary>
/// <remarks>
/// <para>POR QUÉ NO BASTA EL HILO. <see cref="ConversacionPersonal"/> guarda solo el texto de los turnos, sin a
/// qué sesión pertenecen, sin las herramientas y sin cómo salieron. Un repaso sobre eso no distingue «lo
/// pidió y salió» de «lo pidió, falló, y lo corrigió» — y la corrección es justo lo que hay que aprender.</para>
/// <para>DE CADA HERRAMIENTA, LA PRIMERA LÍNEA. El inventario de la pantalla que viene detrás son miles de
/// caracteres por llamada, y no enseña nada de lo que la persona quiere.</para>
/// <para>EN MEMORIA MIENTRAS DURA, Y A DISCO AL CERRAR. Si el repaso falla, el archivo sigue ahí y se repasa
/// la próxima vez (771).</para>
/// <para>CON FOTOS (spec 079, promesa 783): de lo que la persona tocó y de lo que a Ü no le salió, que son los
/// dos momentos que un texto no explica — en SAP un clic no tiene nombre, y «no está a la vista» no dice qué
/// había a la vista. Pocas, las más recientes, y viven lo que vive el diario: se retiran con él.</para>
/// </remarks>
public sealed class DiarioDeLaSesion
{
    /// <summary>Con menos palabras que estas en total, la persona no dijo nada que repasar: «hola», «gracias, chao».</summary>
    public const int MinimoDePalabras = 5;

    /// <summary>Cuánto del diario viaja al repaso, en caracteres. Una sesión de una hora no es un prompt de una hora.</summary>
    public const int TopeDelTexto = 24_000;

    /// <summary>Cuántas fotos se queda un diario: las más recientes. Son las que verá el repaso, todas.</summary>
    public const int TopeDeFotos = 6;

    private static readonly JsonSerializerOptions Json = new()
    {
        WriteIndented = true,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private readonly object _candado = new();
    private readonly List<Entrada> _entradas = new();
    private readonly Func<DateTimeOffset> _reloj;

    /// <summary>De dónde se leen las fotos de un diario que vino del disco.</summary>
    private string _carpetaDeFotos = "";

    public sealed class Entrada
    {
        [JsonPropertyName("cuando")] public DateTimeOffset Cuando { get; set; }
        /// <summary>«persona», «u», «hizo» o «toco».</summary>
        [JsonPropertyName("quien")] public string Quien { get; set; } = "";
        [JsonPropertyName("texto")] public string Texto { get; set; } = "";
        /// <summary>El archivo de su foto, junto al diario. Vacío si no tiene, o si todavía no se guardó.</summary>
        [JsonPropertyName("foto")] public string Foto { get; set; } = "";
        /// <summary>La foto mientras el diario vive en memoria.</summary>
        [JsonIgnore] public byte[]? Jpeg { get; set; }
        [JsonIgnore] public bool TieneFoto => Jpeg != null || Foto.Length > 0;
    }

    /// <summary>Una foto del diario, como se le da a quien repasa: rotulada con su número y su línea.</summary>
    public sealed record FotoDelDiario(string Rotulo, byte[] Jpeg);

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

    /// <summary>
    /// Lo que la persona tocó en pantalla, tal como lo entrega <see cref="LoQueHiciste"/>. Devuelve con qué
    /// ponerle después su foto (<see cref="PonerFoto"/>), que se está tomando en otro hilo; -1 si no se anotó.
    /// </summary>
    public int Toco(string linea) => Anotar("toco", linea);

    /// <summary>Una herramienta que Ü usó: cuál, con qué, y cómo salió. Con la foto de la pantalla si no salió.</summary>
    public void Hizo(string herramienta, string argumentos, string resultado, bool fallo, byte[]? foto = null)
    {
        string primera = (resultado ?? "").Split('\n')[0].Trim();
        if (primera.Length > 240) primera = primera[..240] + "…";
        // LOS ARGUMENTOS, CASI ENTEROS: el plan de un map_hacer —diez pasos— ES lo que se hizo, y es de donde
        // sale una habilidad. Lo que se recorta es el resultado, no el pedido.
        string con = Espacios(argumentos);
        if (con.Length > 700) con = con[..700] + "…";
        int id = Anotar("hizo", $"{herramienta}{(con.Length > 0 ? " " + con : "")} → {(fallo ? "NO SALIÓ: " : "")}{primera}");
        PonerFoto(id, foto);
    }

    private int Anotar(string quien, string texto)
    {
        string limpio = quien == "hizo" ? (texto ?? "").Trim() : Espacios(texto);
        if (limpio.Length == 0) return -1;
        lock (_candado)
        {
            _entradas.Add(new Entrada { Cuando = _reloj(), Quien = quien, Texto = limpio });
            return _entradas.Count - 1;
        }
    }

    /// <summary>
    /// Le pone a una entrada la foto de ese momento. Con más fotos que <see cref="TopeDeFotos"/>, la más vieja
    /// pierde la suya: la entrada se queda, sin marca, para que el texto no prometa una foto que no viaja.
    /// </summary>
    public void PonerFoto(int id, byte[]? jpeg)
    {
        if (jpeg == null || jpeg.Length == 0) return;
        lock (_candado)
        {
            if (id < 0 || id >= _entradas.Count) return;
            _entradas[id].Jpeg = jpeg;
            _entradas[id].Foto = "";
            var conFoto = _entradas.Where(e => e.TieneFoto).ToList();
            foreach (var vieja in conFoto.Take(Math.Max(0, conFoto.Count - TopeDeFotos))) { vieja.Jpeg = null; vieja.Foto = ""; }
        }
    }

    public IReadOnlyList<Entrada> Entradas
    {
        get { lock (_candado) return _entradas.ToList(); }
    }

    /// <summary>Solo lo que dijo la persona: es contra lo que se comprueba cada cita (768).</summary>
    public IReadOnlyList<string> DichoPorLaPersona
    {
        get { lock (_candado) return _entradas.Where(e => e.Quien == "persona").Select(e => e.Texto).ToList(); }
    }

    /// <summary>Si la persona dijo algo con sustancia. Sin eso no hay nada que aprender y no se gasta un repaso (772).</summary>
    public bool TieneQueRepasar
        => DichoPorLaPersona.Sum(t => t.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length) >= MinimoDePalabras;

    /// <summary>Cada entrada como una línea, diciendo de quién es y, si lleva foto, cuál.</summary>
    private static List<(Entrada Entrada, string Linea, int Foto)> Lineas(List<Entrada> entradas)
    {
        var lineas = new List<(Entrada, string, int)>();
        if (entradas.Count == 0) return lineas;
        var t0 = entradas[0].Cuando;
        int fotos = 0;
        foreach (var e in entradas)
        {
            var d = e.Cuando - t0;
            string quien = e.Quien switch { "persona" => "PERSONA", "u" => "Ü", "hizo" => "Ü HIZO", "toco" => "LA PERSONA TOCÓ", _ => e.Quien.ToUpperInvariant() };
            int n = e.TieneFoto ? ++fotos : 0;
            lineas.Add((e, $"[{(int)d.TotalMinutes:00}:{d.Seconds:00}] {quien}: {e.Texto}" + (n > 0 ? $" [FOTO {n}]" : ""), n));
        }
        return lineas;
    }

    /// <summary>El diario como lo lee quien repasa: una línea por cosa, en orden, diciendo de quién es.</summary>
    public string Texto(int tope = TopeDelTexto)
    {
        List<Entrada> entradas;
        lock (_candado) entradas = _entradas.ToList();
        if (entradas.Count == 0) return "";
        var lineas = Lineas(entradas).Select(l => l.Linea).ToList();
        string texto = string.Join("\n", lineas);
        if (texto.Length <= tope) return texto;

        // SE RECORTA POR DELANTE Y SE DICE (patrón nº10): lo último que pasó es lo que más pesa, y lo que no
        // viaja no puede desaparecer sin rastro — quien repasa tiene que saber que falta el principio.
        int quitadas = 0;
        while (lineas.Count > 1 && string.Join("\n", lineas).Length > tope - 80) { lineas.RemoveAt(0); quitadas++; }
        return $"[recortado: faltan las {quitadas} primeras líneas de la sesión]\n" + string.Join("\n", lineas);
    }

    /// <summary>
    /// Las fotos del diario, en su orden, cada una rotulada con el número que lleva en <see cref="Texto"/> y con
    /// su línea. Una que ya no se puede leer del disco no sale, y las demás siguen.
    /// </summary>
    public IReadOnlyList<FotoDelDiario> FotosParaElRepaso()
    {
        List<Entrada> entradas;
        lock (_candado) entradas = _entradas.ToList();
        var fotos = new List<FotoDelDiario>();
        foreach (var (e, linea, n) in Lineas(entradas))
        {
            if (n == 0) continue;
            byte[]? jpeg = e.Jpeg;
            if (jpeg == null && _carpetaDeFotos.Length > 0)
            {
                try { jpeg = File.ReadAllBytes(Path.Combine(_carpetaDeFotos, e.Foto)); }
                catch (IOException) { }
                catch (UnauthorizedAccessException) { }
            }
            if (jpeg is { Length: > 0 }) fotos.Add(new FotoDelDiario($"FOTO {n} — la pantalla en este momento del diario: {linea}", jpeg));
        }
        return fotos;
    }

    private static string CarpetaDeFotosDe(string archivo)
        => Path.Combine(Path.GetDirectoryName(archivo) ?? "", Path.GetFileNameWithoutExtension(archivo) + ".fotos");

    /// <summary>Escribe el diario en <paramref name="carpeta"/> —y sus fotos a su lado— y devuelve su ruta. Atómico: o entero, o nada.</summary>
    public string Guardar(string carpeta)
    {
        Directory.CreateDirectory(carpeta);
        string archivo = Path.Combine(carpeta, Regex.Replace(Sesion, @"[^\w\-]", "_") + ".json");
        List<Entrada> entradas;
        lock (_candado) entradas = _entradas.ToList();

        // LAS FOTOS PRIMERO: un diario que nombra una foto que no llegó a escribirse mandaría al repaso a buscarla.
        string fotos = CarpetaDeFotosDe(archivo);
        int n = 0;
        foreach (var e in entradas.Where(x => x.Jpeg != null))
        {
            Directory.CreateDirectory(fotos);
            string nombre = $"{++n:00}.jpg";
            File.WriteAllBytes(Path.Combine(fotos, nombre), e.Jpeg!);
            e.Foto = nombre;
        }
        if (n > 0) _carpetaDeFotos = fotos;

        var doc = new Documento { Sesion = Sesion, Entradas = entradas };
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
            var diario = new DiarioDeLaSesion(doc.Sesion) { _carpetaDeFotos = CarpetaDeFotosDe(archivo) };
            lock (diario._candado) diario._entradas.AddRange(doc.Entradas.Where(e => !string.IsNullOrWhiteSpace(e.Texto)));
            return diario;
        }
        catch (JsonException) { return null; }
        catch (IOException) { return null; }
    }

    /// <summary>
    /// Retira un diario ya repasado, con sus fotos. No deja en disco fotos de la pantalla de nadie: es lo último
    /// que hace un repaso que salió bien.
    /// </summary>
    public static void Retirar(string archivo)
    {
        File.Delete(archivo);
        string fotos = CarpetaDeFotosDe(archivo);
        if (Directory.Exists(fotos)) Directory.Delete(fotos, recursive: true);
    }

    private static string Espacios(string? texto) => Regex.Replace(texto ?? "", @"\s+", " ").Trim();
}
