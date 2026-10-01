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
        _archivo = archivo ?? Path.Combine(
            U.Graph.UserPaths.Roaming,
            "U", "conversacion-personal.json");
    }

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

    /// <summary>
    /// CUÁNTO PESA, COMO MUCHO, LA HISTORIA QUE SE MANDA AL ABRIR LA VOZ (promesa 667).
    /// </summary>
    /// <remarks>
    /// GPT-Live rechaza la apertura entera con «Initial items must not exceed 8192 tokens», y sin tope de tamaño eso
    /// pasaba en cuanto la conversación crecía: 14 aperturas rechazadas entre el 29 y el 30 de septiembre de 2026,
    /// la del 30 con 34.564 caracteres. A ~4 caracteres por ficha el límite ronda los 32.000; con 20.000 abrió
    /// (medido ese día recortando el archivo a mano). El margen es para lo que no se cuenta aquí: lo que ocupa cada
    /// turno además de su texto, y que un texto con muchos acentos o símbolos gasta más fichas por carácter.
    /// </remarks>
    public const int CaracteresDeHistoria = 20_000;

    /// <summary>Turnos de texto para reconstruir la misma ventana de conversación al abrir la voz.</summary>
    /// <remarks>
    /// Los más recientes que quepan, ENTEROS y en orden: se llena desde el último hacia atrás y se para en el primero
    /// que ya no entra. Un turno partido por la mitad le llega al modelo como una frase que nadie dijo. La única
    /// excepción es que ni el más reciente quepa: entonces va su final, que es lo último que se dijo.
    /// </remarks>
    public IReadOnlyList<(string Role, string Text)> Historial(int maxTurnos = 56, int maxCaracteres = CaracteresDeHistoria)
    {
        lock (Candado)
        {
            var recientes = Leer().Turnos
                .Where(x => x.UserId == _userId)
                .OrderByDescending(x => x.CreatedAt)
                .Take(Math.Max(1, maxTurnos));

            int queda = Math.Max(1, maxCaracteres);
            var caben = new List<(string Role, string Text)>();
            foreach (var turno in recientes)
            {
                string texto = turno.Text ?? "";
                if (texto.Length > queda)
                {
                    if (caben.Count == 0) caben.Add((turno.Role, texto[^queda..]));
                    break;
                }
                caben.Add((turno.Role, texto));
                queda -= texto.Length;
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
