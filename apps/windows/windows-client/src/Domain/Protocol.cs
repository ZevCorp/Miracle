using System.Text.Json.Serialization;

namespace U.WindowsClient.Domain;

// Tipos del contrato con el cerebro (Graph, POST /api/v1/agent/turn). Su otro lado es
// services/graph/src/application/use-cases/AgentTurnService.js; el backend viejo de Windows, del que
// esto era espejo, se retira con la spec 078 (2026-10-01). El cliente solo conoce estos tipos del cerebro;
// nada más cruza la frontera.

/// <summary>Estado de pantalla que el cliente captura y envía cada turno.</summary>
public sealed class ScreenState
{
    [JsonPropertyName("screen")] public string Screen { get; set; } = "";
    [JsonPropertyName("uiContext")] public string UiContext { get; set; } = "";
    [JsonPropertyName("width")] public int Width { get; set; }
    [JsonPropertyName("height")] public int Height { get; set; }
    /// <summary>PNG en base64 SIN prefijo data-uri. Solo cuando el turno anterior pidió computer-use.</summary>
    [JsonPropertyName("screenshot")] public string? Screenshot { get; set; }
    /// <summary>Apps instaladas conocidas (resuelve list_apps y alimenta el prompt del cerebro).</summary>
    [JsonPropertyName("apps")] public string[]? Apps { get; set; }

    /// <summary>
    /// El "URL de Windows" del SurfaceLocator: dónde está parado el usuario. Con esto el cerebro
    /// scopea los workflows que declara por MCP (solo los de esta superficie). Opcionales.
    /// </summary>
    [JsonPropertyName("surfaceId")] public string? SurfaceId { get; set; }
    [JsonPropertyName("surfaceOrigin")] public string? SurfaceOrigin { get; set; }
    [JsonPropertyName("surfacePathname")] public string? SurfacePathname { get; set; }
}

/// <summary>Petición a POST /api/v1/agent/turn.</summary>
public sealed class TurnRequest
{
    /// <summary>
    /// Con quién habla Ü (spec 078): solo en el primer turno, porque Graph lo congela en la sesión.
    /// Null si nadie lo eligió: el campo no viaja y el cerebro se porta como siempre. Lo pone
    /// <see cref="Backend.BackendClient"/>, no quien arma la petición.
    /// </summary>
    [JsonPropertyName("profile")] public PerfilEnElCable? Profile { get; set; }
    /// <summary>Blob opaco del turno anterior. Null en el primer turno.</summary>
    [JsonPropertyName("session")] public string? Session { get; set; }
    /// <summary>Objetivo del usuario. Solo en el primer turno.</summary>
    [JsonPropertyName("goal")] public string? Goal { get; set; }
    [JsonPropertyName("userId")] public string? UserId { get; set; }
    [JsonPropertyName("state")] public ScreenState State { get; set; } = new();
    /// <summary>Resultados de las acciones del turno anterior (mismo orden).</summary>
    [JsonPropertyName("results")] public string[] Results { get; set; } = Array.Empty<string>();
    /// <summary>Respuesta del usuario a una pregunta (ask_user) del turno anterior. Null si no hubo.</summary>
    [JsonPropertyName("inform")] public string? Inform { get; set; }
    /// <summary>Zona IANA del computador, para resolver días relativos y recordatorios.</summary>
    [JsonPropertyName("timezone")] public string? Timezone { get; set; }
    [JsonPropertyName("locale")] public string? Locale { get; set; }
    [JsonPropertyName("clientNowUtc")] public string? ClientNowUtc { get; set; }
}

/// <summary>
/// Una acción decidida por el cerebro que el cliente ejecuta localmente. Unión discriminada por
/// <see cref="Kind"/>: computer-use (coordenadas de pantalla real) o llamada MCP (por nombre).
/// </summary>
public sealed class AgentAction
{
    [JsonPropertyName("kind")] public string Kind { get; set; } = "";
    [JsonPropertyName("x")] public int X { get; set; }
    [JsonPropertyName("y")] public int Y { get; set; }
    [JsonPropertyName("x1")] public int X1 { get; set; }
    [JsonPropertyName("y1")] public int Y1 { get; set; }
    [JsonPropertyName("x2")] public int X2 { get; set; }
    [JsonPropertyName("y2")] public int Y2 { get; set; }
    [JsonPropertyName("ms")] public int Ms { get; set; }
    [JsonPropertyName("text")] public string? Text { get; set; }
    [JsonPropertyName("key")] public string? Key { get; set; }
    [JsonPropertyName("down")] public bool Down { get; set; }
    [JsonPropertyName("tool")] public string? Tool { get; set; }
    [JsonPropertyName("args")] public Dictionary<string, string>? Args { get; set; }
}

/// <summary>
/// Con quién habla Ü, tal como viaja a Graph: <c>profile: { kind, specialty, specialtyName }</c> en
/// <c>/api/v1/agent/turn</c>, <c>/teach/process-video</c> y <c>/teach/interpret-steps</c>. Nombres
/// en inglés porque es el contrato HTTP, como <c>StepToRead</c>. Lo construye
/// <see cref="Cuenta.PerfilDeUso.ParaElCable"/>.
/// </summary>
/// <param name="Kind">«medico» o «persona».</param>
/// <param name="Specialty">El código, en el formato de <c>profiles.specialty_code</c> («cardiologia»). Vacío para una persona.</param>
/// <param name="SpecialtyName">El nombre legible. Graph no lo mete en ningún prompt: saca el nombre de su catálogo.</param>
public sealed record PerfilEnElCable(
    [property: JsonPropertyName("kind")] string Kind,
    [property: JsonPropertyName("specialty")] string Specialty,
    [property: JsonPropertyName("specialtyName")] string SpecialtyName);

/// <summary>Respuesta de POST /api/v1/agent/turn: BrainTurn + la sesión opaca actualizada.</summary>
public sealed class TurnResponse
{
    [JsonPropertyName("session")] public string Session { get; set; } = "";
    [JsonPropertyName("actions")] public List<AgentAction> Actions { get; set; } = new();
    [JsonPropertyName("question")] public string? Question { get; set; }
    [JsonPropertyName("done")] public bool Done { get; set; }
    [JsonPropertyName("text")] public string Text { get; set; } = "";
    [JsonPropertyName("needsScreenshot")] public bool NeedsScreenshot { get; set; }
    [JsonPropertyName("narration")] public string Narration { get; set; } = "";
    [JsonPropertyName("speech")] public string? Speech { get; set; }
    [JsonPropertyName("memory")] public string? Memory { get; set; }
    [JsonPropertyName("memoryId")] public string? MemoryId { get; set; }
    [JsonPropertyName("intents")] public List<string> Intents { get; set; } = new();
    [JsonPropertyName("error")] public string? Error { get; set; }
}
