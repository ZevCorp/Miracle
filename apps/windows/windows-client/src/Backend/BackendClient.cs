using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using U.Graph;
using U.WindowsClient.Domain;

namespace U.WindowsClient.Backend;

/// <summary>
/// El único puente con el cerebro: <c>POST {BackendUrl}/api/v1/agent/turn</c> (Graph, el backend
/// central) más las rutas de enseñanza <c>/api/v1/teach/*</c>. El cliente manda el estado de pantalla
/// y recibe las acciones a ejecutar. No hay otra llamada de red con inteligencia: si este endpoint no
/// responde, el cliente no sabe pensar por su cuenta — a propósito.
///
/// La credencial es la MISMA que usa el módulo de workflows (windows-graph): la X-API-Key de
/// <see cref="GraphConfig"/> (%APPDATA%\U\graph.json o env GRAPH_API_KEY). Una sola fuente a
/// propósito: dos keys para el mismo backend era justo el lío que el port a Graph vino a eliminar.
///
/// UN SOLO CONTRATO (spec 078, promesa 707). Hasta el 2026-10-01 había un modo viejo —prefijo
/// <c>/api</c> y <c>Authorization: Bearer ClientToken</c>— para volver a u-windows-backend en una
/// emergencia, y se activaba con cualquier localhost. Ese backend llevaba muerto desde septiembre y
/// se retira (spec 078); lo que sí rompía el modo viejo era <c>scripts/dev-local.ps1</c>, que levanta GRAPH en
/// localhost: el cliente le hablaba como al backend viejo y Graph contestaba 401. Hoy cualquier URL
/// —Graph remoto o local— recibe lo mismo: <c>/api/v1</c> con X-API-Key.
///
/// EL PERFIL VIAJA SOLO (spec 078, promesa 705): quien arma el turno no tiene que acordarse.
/// <see cref="Perfil"/> se pone una vez al crear el puente y va en el primer turno de cada objetivo.
/// </summary>
public sealed class BackendClient
{
    private const string Prefijo = "/api/v1";

    private readonly HttpClient _http;
    private readonly string _baseUrl;
    private readonly string _userId;

    private static readonly JsonSerializerOptions Json = new()
    {
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    /// <summary>
    /// Con quién habla Ü (<see cref="Cuenta.PerfilDeUso.ParaElCable"/>). Null si nadie lo eligió:
    /// entonces no viaja y Graph se porta como siempre. Lo leen también las peticiones de la
    /// enseñanza (<see cref="Teach.TeachSession"/>).
    /// </summary>
    public PerfilEnElCable? Perfil { get; set; }

    /// <param name="config">De aquí sale la URL de esta ejecución (<see cref="Config.BackendUrlEnUso"/>).</param>
    /// <param name="graphConfig">La X-API-Key de Graph.</param>
    /// <param name="transporte">Para el contrato: un <see cref="HttpMessageHandler"/> que ve lo que
    /// sale, con el mismo patrón que <see cref="Cuenta.SesionMiracle"/>. Null en la app.</param>
    public BackendClient(Config config, GraphConfig graphConfig, HttpMessageHandler? transporte = null)
    {
        _baseUrl = config.BackendUrlEnUso.TrimEnd('/');
        _userId = config.UserId;
        _http = transporte == null
            ? new HttpClient { Timeout = TimeSpan.FromMinutes(5) }
            : new HttpClient(transporte, disposeHandler: false) { Timeout = TimeSpan.FromMinutes(5) };

        // La X-API-Key (miracle_…) que ya usa windows-graph.
        if (!string.IsNullOrWhiteSpace(graphConfig.ApiKey))
            _http.DefaultRequestHeaders.Add("X-API-Key", graphConfig.ApiKey);

        // Atribución del consumo de IA del puente consciente (computer-use).
        // Sin esto, todo el gasto del cerebro quedaría como «sin atribuir» y no
        // se podría separar del resto de la app de Windows.
        _http.DefaultRequestHeaders.Add("X-Miracle-App", "windows_app");
        _http.DefaultRequestHeaders.Add("X-Miracle-Feature", "conscious_bridge");
        if (!string.IsNullOrWhiteSpace(config.Email))
            _http.DefaultRequestHeaders.Add("X-Miracle-User-Email", config.Email);
    }

    public async Task<TurnResponse> TurnAsync(TurnRequest req, CancellationToken ct)
    {
        req.UserId = _userId;
        // El perfil va en el PRIMER turno (sin sesión todavía): Graph lo congela en ella, como la
        // plataforma. Repetirlo en cada vuelta no le dice nada nuevo.
        if (req.Session == null) req.Profile ??= Perfil;
        var body = JsonSerializer.Serialize(req, Json);
        using var content = new StringContent(body, Encoding.UTF8, "application/json");
        using var res = await Send($"{Prefijo}/agent/turn", content, ct);
        var text = await res.Content.ReadAsStringAsync(ct);
        if (IsAuthFailure(res.StatusCode))
            throw new InvalidOperationException(AuthErrorMessage(res.StatusCode));
        var parsed = JsonSerializer.Deserialize<TurnResponse>(text, Json);
        if (parsed == null) throw new InvalidOperationException($"respuesta vacía del backend (HTTP {(int)res.StatusCode})");
        if (!res.IsSuccessStatusCode)
            throw new InvalidOperationException(parsed.Error ?? $"backend HTTP {(int)res.StatusCode}");
        return parsed;
    }

    /// <summary>
    /// POST genérico hacia cualquier endpoint del backend que devuelva JSON tipado. El <paramref name="path"/>
    /// va SIN el prefijo de API (p.ej. <c>/teach/upload-token</c>): el prefijo (/api/v1) lo pone este
    /// cliente.
    /// </summary>
    public async Task<T?> PostAsync<T>(string path, object req, CancellationToken ct) where T : class
    {
        var body = JsonSerializer.Serialize(req, Json);
        using var content = new StringContent(body, Encoding.UTF8, "application/json");
        using var res = await Send($"{Prefijo}{path}", content, ct);
        var text = await res.Content.ReadAsStringAsync(ct);
        if (IsAuthFailure(res.StatusCode))
            throw new InvalidOperationException(AuthErrorMessage(res.StatusCode));
        if (!res.IsSuccessStatusCode)
            throw new InvalidOperationException($"backend HTTP {(int)res.StatusCode}: {text}");
        return JsonSerializer.Deserialize<T>(text, Json);
    }

    public async Task<T?> GetAsync<T>(string path, CancellationToken ct) where T : class
    {
        using var res = await SendGet($"{Prefijo}{path}", ct);
        var text = await res.Content.ReadAsStringAsync(ct);
        if (IsAuthFailure(res.StatusCode))
            throw new InvalidOperationException(AuthErrorMessage(res.StatusCode));
        if (!res.IsSuccessStatusCode)
            throw new InvalidOperationException($"backend HTTP {(int)res.StatusCode}: {text}");
        return JsonSerializer.Deserialize<T>(text, Json);
    }

    /// <summary>
    /// El POST de esta clase, con el semáforo de conexión anotado. Este es el SEGUNDO embudo hacia
    /// Graph —el primero es <c>GraphClient.SendAsync</c>—, y hay que contarlo: la telemetría hace
    /// POST cada 60 s por aquí, así que es una señal de vida periódica que ya existía y se tiraba.
    /// </summary>
    private async Task<HttpResponseMessage> Send(string path, HttpContent content, CancellationToken ct)
    {
        string host = GraphHealth.HostOf(_baseUrl);
        try
        {
            var res = await _http.PostAsync($"{_baseUrl}{path}", content, ct);
            int code = (int)res.StatusCode;
            GraphHealth.Report(
                res.IsSuccessStatusCode ? GraphLink.Ok
                : code is 401 or 403 ? GraphLink.KeyRechazada
                : GraphLink.ErrorDelServidor, host, code);
            return res;
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            GraphHealth.Report(GraphLink.SinRespuesta, host, 0,
                $"sin respuesta en {_http.Timeout.TotalMinutes:0} min");
            throw;
        }
        catch (OperationCanceledException) { throw; }  // la pidió quien llama: no dice nada del backend
        catch (Exception e)
        {
            GraphHealth.Report(GraphLink.SinContacto, host, 0, e.Message);
            throw;
        }
    }

    private async Task<HttpResponseMessage> SendGet(string path, CancellationToken ct)
    {
        string host = GraphHealth.HostOf(_baseUrl);
        try
        {
            var res = await _http.GetAsync($"{_baseUrl}{path}", ct);
            GraphHealth.Report(
                res.IsSuccessStatusCode ? GraphLink.Ok
                : (int)res.StatusCode is 401 or 403 ? GraphLink.KeyRechazada : GraphLink.ErrorDelServidor,
                host, (int)res.StatusCode);
            return res;
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            GraphHealth.Report(GraphLink.SinRespuesta, host, 0, $"sin respuesta en {_http.Timeout.TotalMinutes:0} min");
            throw;
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception e)
        {
            GraphHealth.Report(GraphLink.SinContacto, host, 0, e.Message);
            throw;
        }
    }

    private static bool IsAuthFailure(HttpStatusCode status) =>
        status == HttpStatusCode.Unauthorized || status == HttpStatusCode.Forbidden;

    /// <summary>
    /// Un 401/403 contra Graph casi siempre es que la máquina no tiene la API key configurada. El
    /// mensaje le dice al usuario exactamente dónde ponerla, porque "backend HTTP 401" no le daba
    /// nada que hacer.
    /// </summary>
    private static string AuthErrorMessage(HttpStatusCode status) =>
        $"falta la API key de Graph o no es válida (HTTP {(int)status}). Configúrala en " +
        @"%APPDATA%\U\graph.json (campo ApiKey, key miracle_…) o en la variable de entorno GRAPH_API_KEY.";
}
