using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace U.WindowsClient.Voice;

/// <summary>Hilo conversacional durable que une las sesiones de voz del mismo usuario.</summary>
public sealed class ConversacionPersonal
{
    private static readonly object Candado = new();
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };
    private const int MaxTurnos = 160;
    private const int MaxTextoPorTurno = 4000;

    private readonly string _userId;
    private readonly string _archivo;

    public ConversacionPersonal(string userId, string? archivo = null)
    {
        _userId = string.IsNullOrWhiteSpace(userId) ? "anon" : userId.Trim();
        _archivo = archivo ?? ArchivoPorDefecto;
    }

    /// <summary>Dónde guarda la app. Un solo sitio que lo dice: la Memoria (spec 071) lee de aquí mismo.</summary>
    public static string ArchivoPorDefecto => Path.Combine(
        U.Graph.UserPaths.Roaming,
        "U", "conversacion-personal.json");

    public void Agregar(string quien, string texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return;
        string rol = quien.Trim().ToLowerInvariant() is "usuario" or "asistente" ? quien.Trim().ToLowerInvariant() : "asistente";
        string limpio = texto.Trim();
        if (limpio.Length > MaxTextoPorTurno) limpio = limpio[..MaxTextoPorTurno];

        lock (Candado)
        {
            var documento = Leer();
            var ultimo = documento.Turnos
                .Where(x => x.UserId == _userId)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefault();
            if (ultimo != null && ultimo.Role == rol && DateTimeOffset.UtcNow - ultimo.CreatedAt <= TimeSpan.FromSeconds(15))
            {
                ultimo.Text = $"{ultimo.Text} {limpio}".Trim();
                if (ultimo.Text.Length > MaxTextoPorTurno) ultimo.Text = ultimo.Text[^MaxTextoPorTurno..];
            }
            else
            {
                documento.Turnos.Add(new Turno
                {
                    UserId = _userId,
                    Role = rol,
                    Text = limpio,
                    CreatedAt = DateTimeOffset.UtcNow,
                });
            }
            var propios = documento.Turnos.Where(x => x.UserId == _userId).ToList();
            if (propios.Count > MaxTurnos)
            {
                var quitar = propios.Take(propios.Count - MaxTurnos).ToHashSet();
                documento.Turnos.RemoveAll(x => quitar.Contains(x));
            }
            Escribir(documento);
        }
    }

    public string Contexto(int maxTurnos = 56, int maxCaracteres = 18000)
    {
        lock (Candado)
        {
            var turnos = Leer().Turnos
                .Where(x => x.UserId == _userId)
                .OrderByDescending(x => x.CreatedAt)
                .Take(Math.Max(1, maxTurnos))
                .Reverse()
                .Select(x => $"- {x.Role}: {x.Text}")
                .ToList();
            string contexto = string.Join("\n", turnos);
            if (contexto.Length <= maxCaracteres) return contexto;
            return contexto[^maxCaracteres..];
        }
    }

    /// <summary>Cuántos mensajes admite el servidor al abrir una sesión de GPT-Live.</summary>
    internal const int MensajesDeApertura = 128;

    /// <summary>
    /// CUÁNTO PUEDE PESAR LA HISTORIA AL ABRIR, en caracteres. El servidor admite 8.192 fichas («Initial items
    /// must not exceed 8192 tokens.») y aquí no hay tokenizador: con 21.542 caracteres abrió y con 34.564 no
    /// (2026-09-30). 16.000 deja margen aunque el texto salga a dos caracteres por ficha.
    /// </summary>
    internal const int PresupuestoDeApertura = 16_000;

    /// <summary>Turnos de texto para reconstruir la misma ventana de conversación al abrir la voz.</summary>
    /// <remarks>
    /// CON PRESUPUESTO (spec 073, promesa 680). Mandaba los últimos 56 turnos sin mirar cuánto pesaban —cada uno
    /// hasta 4.000 caracteres—, y el 29 y 30 de septiembre de 2026 el servidor rechazó 13 aperturas: la sesión
    /// ni abría ni se reintentaba, y tocar la carita no hacía nada. Se queda con lo más reciente que quepa, y
    /// si ni el último turno cabe, lo recorta por delante en vez de abrir sin historia.
    /// </remarks>
    public IReadOnlyList<(string Role, string Text)> Historial(int maxTurnos = 56, int maxCaracteres = PresupuestoDeApertura)
    {
        lock (Candado)
        {
            var recientes = Leer().Turnos
                .Where(x => x.UserId == _userId)
                .OrderByDescending(x => x.CreatedAt)
                .Take(Math.Clamp(maxTurnos, 1, MensajesDeApertura));

            var caben = new List<(string Role, string Text)>();
            int queda = Math.Max(1, maxCaracteres);
            foreach (var turno in recientes)
            {
                if (turno.Text.Length > queda)
                {
                    if (caben.Count == 0) caben.Add((turno.Role, turno.Text[^queda..]));   // lo último que se dijo, aunque sea a medias
                    break;
                }
                caben.Add((turno.Role, turno.Text));
                queda -= turno.Text.Length;
            }
            caben.Reverse();
            return caben;
        }
    }

    private Documento Leer()
    {
        if (!File.Exists(_archivo)) return new Documento();
        try
        {
            string json = File.ReadAllText(_archivo);
            return JsonSerializer.Deserialize<Documento>(json, Json) ?? new Documento();
        }
        catch (IOException) { return new Documento(); }
        catch (JsonException) { return new Documento(); }
    }

    private void Escribir(Documento documento)
    {
        string? carpeta = Path.GetDirectoryName(_archivo);
        if (!string.IsNullOrWhiteSpace(carpeta)) Directory.CreateDirectory(carpeta);
        string temporal = _archivo + "." + Guid.NewGuid().ToString("N") + ".tmp";
        File.WriteAllText(temporal, JsonSerializer.Serialize(documento, Json));
        File.Move(temporal, _archivo, overwrite: true);
    }

    private sealed class Documento
    {
        [JsonPropertyName("turnos")] public List<Turno> Turnos { get; set; } = new();
    }

    private sealed class Turno
    {
        [JsonPropertyName("userId")] public string UserId { get; set; } = "";
        [JsonPropertyName("role")] public string Role { get; set; } = "asistente";
        [JsonPropertyName("text")] public string Text { get; set; } = "";
        [JsonPropertyName("createdAt")] public DateTimeOffset CreatedAt { get; set; }
    }
}
