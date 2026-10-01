using System.IO;
using System.Text.Json;
using U.WindowsClient.Diagnostics;

namespace U.WindowsClient.Clases;

public sealed record SeccionDeApuntes(string Clave, string Titulo, string Contenido);

/// <summary>Lo que queda de una clase una vez organizada: de qué fue, y sus secciones con texto.</summary>
public sealed record ApuntesDeClase(string Titulo, string Resumen, IReadOnlyList<SeccionDeApuntes> Secciones);

/// <summary>Una clase grabada: lo que se dijo, y sus apuntes cuando ya los hay.</summary>
public sealed class Clase
{
    private string _titulo = "";

    public string Id { get; set; } = "";

    public DateTimeOffset Fecha { get; set; }

    public int DuracionSegundos { get; set; }

    /// <summary>Todo lo que se dijo. Se guarda ANTES de pedir los apuntes (promesa 757).</summary>
    public string Transcripcion { get; set; } = "";

    /// <summary>Nulo mientras no se hayan podido organizar. La clase existe igual.</summary>
    public ApuntesDeClase? Apuntes { get; set; }

    /// <summary>El título que se le puso, o el de sus apuntes. Vacío si todavía no tiene ninguno.</summary>
    public string Titulo
    {
        get => _titulo.Length > 0 ? _titulo : Apuntes?.Titulo ?? "";
        set => _titulo = (value ?? "").Trim();
    }
}

/// <summary>
/// EL CUADERNO: dónde viven las clases grabadas. Un archivo por clase en <c>%APPDATA%\U\clases</c>.
/// </summary>
/// <remarks>
/// EN EL EQUIPO Y NO EN UN SERVIDOR (spec 080). Un estudiante no tiene cuenta: se le pidió el nombre y
/// nada más. Sus clases son suyas y se quedan en su disco, que además es lo que hace que la primera
/// grabación funcione sin registrarse en ningún sitio.
///
/// EN ROAMING Y NO EN LOCAL, y hay un motivo medido: <c>%LOCALAPPDATA%\U</c> es la carpeta que el
/// instalador reemplaza y que el desinstalador borra entera (2026-09-30: 4,7 GB de lecciones y
/// recuerdos vivían ahí). Un semestre de clases no puede irse con una reinstalación.
///
/// UN ARCHIVO POR CLASE. Una clase de dos horas son cien mil caracteres; reescribir un único archivo
/// con todas cada vez que se guarda una sería reescribir el semestre entero, y un corte a media
/// escritura se las llevaría todas.
/// </remarks>
public sealed class CuadernoDeClases
{
    private static readonly object Candado = new();
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    private readonly string _carpeta;

    /// <param name="carpeta">Ruta opcional, usada por el contrato.</param>
    public CuadernoDeClases(string? carpeta = null) => _carpeta = carpeta ?? CarpetaPorDefecto;

    public static string CarpetaPorDefecto => Path.Combine(U.Graph.UserPaths.Roaming, "U", "clases");

    /// <summary>Crea la clase con lo que se dijo y la guarda. A partir de aquí ya no se pierde.</summary>
    public Clase Abrir(string transcripcion, DateTimeOffset fecha, int duracionSegundos)
    {
        var clase = new Clase
        {
            Id = fecha.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N")[..6],
            Fecha = fecha,
            DuracionSegundos = Math.Max(0, duracionSegundos),
            Transcripcion = transcripcion ?? "",
        };
        Guardar(clase);
        return clase;
    }

    /// <summary>Escribe la clase entera. Por un temporal y un cambio de nombre: nunca queda a medias.</summary>
    public void Guardar(Clase clase)
    {
        if (string.IsNullOrWhiteSpace(clase.Id)) throw new ArgumentException("la clase no tiene id", nameof(clase));
        lock (Candado)
        {
            Directory.CreateDirectory(_carpeta);
            string archivo = Path.Combine(_carpeta, clase.Id + ".json");
            string temporal = archivo + "." + Guid.NewGuid().ToString("N") + ".tmp";
            File.WriteAllText(temporal, JsonSerializer.Serialize(clase, Json));
            File.Move(temporal, archivo, overwrite: true);
        }
    }

    /// <summary>Todas, la más reciente primero. Un archivo que no se entiende se salta y se dice.</summary>
    public IReadOnlyList<Clase> Todas()
    {
        lock (Candado)
        {
            if (!Directory.Exists(_carpeta)) return Array.Empty<Clase>();
            var clases = new List<Clase>();
            foreach (string archivo in Directory.EnumerateFiles(_carpeta, "*.json"))
            {
                try
                {
                    var c = JsonSerializer.Deserialize<Clase>(File.ReadAllText(archivo), Json);
                    if (c != null && c.Id.Length > 0) clases.Add(c);
                }
                catch (Exception e) when (e is JsonException or IOException or UnauthorizedAccessException)
                {
                    LogBus.Log("clases", $"no pude leer «{Path.GetFileName(archivo)}» ({e.GetType().Name}): se salta");
                }
            }
            return clases.OrderByDescending(c => c.Fecha).ThenByDescending(c => c.Id, StringComparer.Ordinal).ToList();
        }
    }

    public Clase? Leer(string id) => Todas().FirstOrDefault(c => c.Id == id);
}
