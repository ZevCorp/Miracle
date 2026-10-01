using System.Globalization;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using U.WindowsClient.Diagnostics;

namespace U.WindowsClient.Persona;

/// <summary>Para qué usa Ü esta persona. Hay dos, y no se mezclan (spec 080).</summary>
public enum Rol
{
    /// <summary>Nadie lo ha dicho todavía. No es médico por defecto: sin elegir no hay nada de ninguno.</summary>
    SinElegir,
    Estudiante,
    Medico,
}

public static class Roles
{
    /// <summary>
    /// El rol, dicho como lo dice la gente. Lo que no se entiende queda <see cref="Rol.SinElegir"/>.
    /// </summary>
    /// <remarks>
    /// ESTUDIANTE SE MIRA ANTES QUE MÉDICO, y no es un detalle: «soy estudiante de medicina» lleva las
    /// dos raíces, y quien lo dice graba clases, no consultas.
    /// </remarks>
    public static Rol Leer(string? texto)
    {
        string t = Llano(texto);
        if (t.Length == 0) return Rol.SinElegir;
        if (Tiene(t, "estudi", "alumn", "universi", "student", "pregrado")) return Rol.Estudiante;
        if (Tiene(t, "medic", "doctor", "residente", "physician")) return Rol.Medico;
        return Rol.SinElegir;
    }

    /// <summary>Cómo se le dice a la persona, en minúscula. Vacío si no ha elegido.</summary>
    public static string Nombre(Rol rol) => rol switch
    {
        Rol.Estudiante => "estudiante",
        Rol.Medico => "médico",
        _ => "",
    };

    private static bool Tiene(string texto, params string[] raices) => raices.Any(texto.Contains);

    /// <summary>En minúscula y sin tildes: «Médico», «medico» y «MÉDICO» son lo mismo.</summary>
    internal static string Llano(string? texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return "";
        var sb = new StringBuilder();
        foreach (char c in texto.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD))
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }
}

/// <summary>
/// LO QUE Ü SABE DE QUIEN LO USA: cómo se llama, para qué lo usa, cómo quiere que le hablen y qué le
/// gusta. Es lo que se le pregunta en el primer encuentro, y nada más.
/// </summary>
public sealed class Perfil
{
    public string Nombre { get; set; } = "";
    public Rol Rol { get; set; } = Rol.SinElegir;

    /// <summary>Cómo quiere que le hablen, con sus palabras: «directo y con humor».</summary>
    public string Trato { get; set; } = "";

    public List<string> Gustos { get; set; } = new();

    /// <summary>
    /// El encuentro TERMINÓ. Falso mientras solo se sabe una parte: un nombre sin rol no es una
    /// persona conocida, y por eso el encuentro se vuelve a ofrecer (promesa 751).
    /// </summary>
    public bool Conocido { get; set; }

    public DateTimeOffset? Desde { get; set; }

    /// <summary>Por dónde se supo: «voz», «escrito» o «identidad-previa».</summary>
    public string Origen { get; set; } = "";
}

/// <summary>
/// Dónde vive el perfil: <c>%APPDATA%\U\perfil.json</c>, fuera de la carpeta que el instalador reemplaza.
/// </summary>
public sealed class PerfilDeLaPersona
{
    private static readonly object Candado = new();
    private static readonly JsonSerializerOptions Json = new()
    {
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly string _archivo;

    /// <param name="archivo">Ruta opcional, usada por el contrato.</param>
    public PerfilDeLaPersona(string? archivo = null) => _archivo = archivo ?? ArchivoPorDefecto;

    public static string ArchivoPorDefecto => Path.Combine(U.Graph.UserPaths.Roaming, "U", "perfil.json");

    /// <summary>El perfil guardado. Sin archivo, o con uno que no se entiende, un perfil sin conocer.</summary>
    public Perfil Leer()
    {
        lock (Candado)
        {
            if (!File.Exists(_archivo)) return new Perfil();
            try
            {
                var leido = JsonSerializer.Deserialize<Perfil>(File.ReadAllText(_archivo), Json) ?? new Perfil();
                leido.Nombre ??= "";
                leido.Trato ??= "";
                leido.Gustos ??= new List<string>();
                return leido;
            }
            catch (Exception e) when (e is JsonException or IOException or UnauthorizedAccessException)
            {
                // Un perfil roto no puede tumbar el arranque. Se dice, y se vuelve a preguntar.
                LogBus.Log("perfil", $"no pude leer el perfil ({e.GetType().Name}: {e.Message}): se trata como sin conocer");
                return new Perfil();
            }
        }
    }

    /// <summary>Guarda el perfil entero. Por un temporal y un cambio de nombre: nunca queda a medias.</summary>
    public void Guardar(Perfil perfil)
    {
        lock (Candado)
        {
            string? carpeta = Path.GetDirectoryName(_archivo);
            if (!string.IsNullOrWhiteSpace(carpeta)) Directory.CreateDirectory(carpeta);
            string temporal = _archivo + "." + Guid.NewGuid().ToString("N") + ".tmp";
            File.WriteAllText(temporal, JsonSerializer.Serialize(perfil, Json));
            File.Move(temporal, _archivo, overwrite: true);
        }
    }
}
