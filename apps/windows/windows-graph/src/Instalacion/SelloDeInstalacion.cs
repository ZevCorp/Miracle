using System.IO;
using System.Net;
using System.Net.Http;
using System.Text.Json;

namespace U.Graph;

/// <summary>
/// EL SELLO: pone la credencial de la instalación en cada petición que va a Graph, y en ninguna otra.
/// Promesas 681 y 686 (spec 076).
/// </summary>
/// <remarks>
/// POR QUÉ UN MANEJADOR Y NO UNA CABECERA EN CADA SITIO. El 2026-09-30 había SEIS clientes HTTP
/// hablando con Graph, cada uno poniéndose la X-API-Key a mano (<c>GraphClient</c>,
/// <c>BackendClient</c>, <c>EjecutorDeExportaciones</c>, <c>RellenadorSap</c>, <c>DictadoEnVivo</c> y
/// <c>ClavesDelBackend</c>). Añadir la credencial igual era seis ediciones y la certeza de olvidar el
/// séptimo: con la compuerta puesta, esa parte de Ü fallaría con 403 mientras todo lo demás funciona.
/// Es el patrón nº5 —el diagnóstico de la superficie SAP se cableó en dos de los TRES sitios—.
///
/// POR QUÉ SE LEE AL ENVIAR Y NO AL CONSTRUIR. Tres de los seis son campos estáticos que nacen antes
/// de que la instalación se haya presentado, y la credencial puede cambiar a mitad de sesión (Graph
/// deja de conocerla y se presenta de nuevo). Una cabecera fijada al construir se quedaría con la vieja.
///
/// Y ESCUCHA LOS RECHAZOS. Un 403 de Graph que nombre a la instalación —pendiente, revocada,
/// desconocida— se anota en la credencial, sin quitarle el cuerpo a quien hizo la petición.
/// </remarks>
public sealed class SelloDeInstalacion : DelegatingHandler
{
    private readonly CredencialDeInstalacion? _credencial;

    /// <summary>El de la app: sella con la credencial viva, sobre el manejador de siempre.</summary>
    public SelloDeInstalacion() : this(new HttpClientHandler(), null) { }

    /// <param name="credencial">Null = la viva de la app, mirada en cada envío.</param>
    public SelloDeInstalacion(HttpMessageHandler interno, CredencialDeInstalacion? credencial) : base(interno)
        => _credencial = credencial;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var credencial = Sellar(request);
        var respuesta = await base.SendAsync(request, ct).ConfigureAwait(false);
        if (credencial != null && respuesta.StatusCode == HttpStatusCode.Forbidden)
            await AnotarRechazoAsync(credencial, respuesta, ct).ConfigureAwait(false);
        return respuesta;
    }

    protected override HttpResponseMessage Send(HttpRequestMessage request, CancellationToken ct)
    {
        Sellar(request);
        return base.Send(request, ct);
    }

    /// <summary>Devuelve la credencial si la petición va a Graph; null si va a otro sitio.</summary>
    private CredencialDeInstalacion? Sellar(HttpRequestMessage request)
    {
        var credencial = _credencial ?? CredencialDeInstalacion.Viva;
        if (credencial == null || !credencial.EsDeGraph(request.RequestUri)) return null;

        // Se quita SIEMPRE lo que trajera: la credencial la pone el sello y nadie más.
        request.Headers.Remove(CredencialDeInstalacion.Cabecera);
        string valor = credencial.Valor;
        // SIN CREDENCIAL NO VIAJA NADA, ni vacía: Graph leería una cabecera vacía como una credencial
        // inventada y contestaría «no te conozco» en vez de «preséntate».
        if (valor.Length > 0) request.Headers.TryAddWithoutValidation(CredencialDeInstalacion.Cabecera, valor);
        return credencial;
    }

    private static async Task AnotarRechazoAsync(CredencialDeInstalacion credencial, HttpResponseMessage respuesta, CancellationToken ct)
    {
        try
        {
            // Se carga en memoria para que quien pidió siga pudiendo leerlo entero después de nosotros.
            await respuesta.Content.LoadIntoBufferAsync().ConfigureAwait(false);
            string cuerpo = await respuesta.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            using var doc = JsonDocument.Parse(cuerpo);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return;
            string code = Texto(doc.RootElement, "code");
            if (!code.StartsWith("instalacion_", StringComparison.Ordinal)) return;
            credencial.AnotarRechazo(code, Texto(doc.RootElement, "codigo"));
        }
        // Un 403 que no es JSON, o que no se puede leer, no es de instalaciones: se deja pasar tal cual.
        catch (Exception e) when (e is JsonException or HttpRequestException or IOException or InvalidOperationException) { }
    }

    private static string Texto(JsonElement raiz, string nombre) =>
        raiz.TryGetProperty(nombre, out var v) && v.ValueKind == JsonValueKind.String ? (v.GetString() ?? "").Trim() : "";
}

/// <summary>
/// Cómo se construye un cliente HTTP que habla con Graph: con el sello puesto. Promesa 686.
/// </summary>
public static class RedDeGraph
{
    public static HttpClient Cliente(TimeSpan plazo) => new(new SelloDeInstalacion()) { Timeout = plazo };
}

/// <summary>
/// Graph contestó 403 nombrando a la instalación: espera aprobación, la revocaron, o no se ha
/// presentado. NO es un fallo de red ni una clave que falta, y por eso tiene su propio tipo: quien lo
/// recibe puede decirlo con su nombre y volver a intentarlo cuando toque (promesa 687).
/// </summary>
public sealed class GraphNiegaLaInstalacion : Exception
{
    /// <summary>El código estable de Graph: instalacion_pendiente, instalacion_revocada…</summary>
    public string Code { get; }

    /// <summary>El código corto de la instalación, si Graph lo dijo.</summary>
    public string Codigo { get; }

    public GraphNiegaLaInstalacion(string code, string codigo) : base(Frase(code, codigo))
    {
        Code = code ?? "";
        Codigo = codigo ?? "";
    }

    private static string Frase(string code, string codigo) => code switch
    {
        "instalacion_pendiente" => CredencialDeInstalacion.Decir(CredencialDeInstalacion.Pendiente, codigo),
        "instalacion_revocada" => CredencialDeInstalacion.Decir(CredencialDeInstalacion.Revocada, codigo),
        "instalacion_desconocida" => "Graph ya no conoce esta instalación: se está presentando de nuevo",
        _ => CredencialDeInstalacion.Decir(CredencialDeInstalacion.SinPresentar, codigo),
    };

    /// <summary>
    /// Null si el cuerpo de un 403 no habla de la instalación; la excepción si sí.
    /// </summary>
    public static GraphNiegaLaInstalacion? DeUn403(string? cuerpo)
    {
        if (string.IsNullOrWhiteSpace(cuerpo)) return null;
        try
        {
            using var doc = JsonDocument.Parse(cuerpo);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return null;
            string code = doc.RootElement.TryGetProperty("code", out var c) && c.ValueKind == JsonValueKind.String ? c.GetString() ?? "" : "";
            if (!code.StartsWith("instalacion_", StringComparison.Ordinal)) return null;
            string codigo = doc.RootElement.TryGetProperty("codigo", out var k) && k.ValueKind == JsonValueKind.String ? k.GetString() ?? "" : "";
            return new GraphNiegaLaInstalacion(code, codigo);
        }
        catch (JsonException) { return null; }
    }
}
