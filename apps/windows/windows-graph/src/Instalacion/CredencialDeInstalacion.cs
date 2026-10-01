using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;

namespace U.Graph;

/// <summary>
/// LA CREDENCIAL DE ESTA INSTALACIÓN. Promesas 680 y 682–685 (spec 076).
/// </summary>
/// <remarks>
/// QUÉ PROBLEMA RESUELVE. Todas las instalaciones compartían UNA clave de Graph, embebida en el
/// instalador, y el instalador es público porque el repo lo es. Medido el 2026-09-30: con esa clave,
/// <c>/api/v1/agent/claves</c> entregaba las claves crudas de OpenAI y TypeSafe, y todo <c>/api/v1</c>
/// quedaba abierto a cualquiera que descargara el instalador. No había forma de cortar a una
/// instalación sin cortarlas a todas.
///
/// CÓMO. La clave embebida pasa a servir solo para PRESENTARSE: la instalación dice quién es, Graph le
/// da una credencial propia y la deja PENDIENTE hasta que un administrador la aprueba en Provider
/// Studio. Esa credencial viaja en cada petición (<see cref="SelloDeInstalacion"/>), se puede revocar
/// de una en una, y en Graph solo queda su huella.
///
/// CONVIVE CON UN GRAPH QUE AÚN NO SABE DE ESTO. La producción se actualiza en su propio paso, así que
/// esta versión de Ü va a hablar con un Graph anterior: ahí presentarse da 404, no se insiste, no
/// viaja ninguna cabecera y todo sigue exactamente como antes.
///
/// SE LE INYECTA TODO —el disco, la red y el log— para que el contrato la juzgue entera sin red y
/// sin pantalla. <see cref="DeGraph"/> le pone los de verdad.
///
/// LO QUE ESTO NO ES: no impide que una instalación APROBADA reciba las claves de terceros en
/// memoria. Eso es la spec siguiente (que no salgan nunca de Graph), y está escrito en la 076.
/// </remarks>
public sealed class CredencialDeInstalacion
{
    /// <summary>La cabecera en la que viaja. La misma que lee Graph (registerWindowsDeviceRoutes.js).</summary>
    public const string Cabecera = "X-Device-Token";

    // LA SITUACIÓN, para la máquina: una palabra fija por caso. «pendiente», «aprobada» y «revocada»
    // son las que usa Graph en su tabla; las demás son de este lado.
    public const string SinPresentar = "sin presentar";
    public const string SinCorreo = "sin correo";
    public const string SinConfirmar = "sin confirmar";
    public const string Pendiente = "pendiente";
    public const string Aprobada = "aprobada";
    public const string Revocada = "revocada";
    public const string NoSePudo = "no se pudo";
    public const string NoHaceFalta = "no hace falta";

    private readonly Uri? _destino;
    private readonly Func<string?> _leer;
    private readonly Action<string?> _guardar;
    private readonly Func<string, CancellationToken, Task<(int Estado, string Cuerpo)>> _presentar;
    private readonly Func<string, CancellationToken, Task<(int Estado, string Cuerpo)>> _preguntar;
    private readonly Action<string> _log;
    private readonly object _candado = new();

    private string _valor = "";
    private string _codigo = "";
    private string _situacion = SinPresentar;
    private string _causa = "";
    private int _vigilando;

    /// <param name="destino">La base de Graph. La credencial solo viaja ahí (<see cref="EsDeGraph"/>).</param>
    /// <param name="leer">Lo guardado en un arranque anterior, ya en claro, o null.</param>
    /// <param name="guardar">Guarda lo que se le dé; null borra. Quien protege el disco es el almacén.</param>
    /// <param name="presentar">POST del alta con la clave embebida. Recibe el cuerpo JSON.</param>
    /// <param name="preguntar">GET del estado. Recibe la credencial.</param>
    /// <param name="log">Dónde contar lo que pasó. NUNCA recibe la credencial.</param>
    public CredencialDeInstalacion(
        string destino,
        Func<string?> leer,
        Action<string?> guardar,
        Func<string, CancellationToken, Task<(int Estado, string Cuerpo)>> presentar,
        Func<string, CancellationToken, Task<(int Estado, string Cuerpo)>> preguntar,
        Action<string> log)
    {
        Uri.TryCreate((destino ?? "").Trim(), UriKind.Absolute, out _destino);
        _leer = leer ?? throw new ArgumentNullException(nameof(leer));
        _guardar = guardar ?? throw new ArgumentNullException(nameof(guardar));
        _presentar = presentar ?? throw new ArgumentNullException(nameof(presentar));
        _preguntar = preguntar ?? throw new ArgumentNullException(nameof(preguntar));
        _log = log ?? (_ => { });
        Cargar();
    }

    /// <summary>La credencial, para la cabecera. Cadena vacía si no hay: nunca null.</summary>
    public string Valor { get { lock (_candado) return _valor; } }

    /// <summary>Una de las constantes de arriba.</summary>
    public string Situacion { get { lock (_candado) return _situacion; } }

    /// <summary>El código corto con el que el administrador reconoce esta instalación en el panel.</summary>
    public string Codigo { get { lock (_candado) return _codigo; } }

    /// <summary>Qué pasa, en una frase para la persona y para el log. Jamás lleva la credencial.</summary>
    public string Estado { get { lock (_candado) return Decir(_situacion, _codigo, _causa); } }

    /// <summary>Avisa cuando la situación CAMBIA —no en cada pregunta—, con la situación nueva.</summary>
    public event Action<string>? AlCambiar;

    /// <summary>La de la app viva. Null en el contrato: ahí no viaja ninguna cabecera.</summary>
    public static CredencialDeInstalacion? Viva { get; set; }

    /// <summary>
    /// ¿Esta dirección es la de Graph? Esquema, host y puerto, los tres: la credencial es un secreto de
    /// Graph, y un dominio que solo EMPIEZA igual, o el mismo host por http, no es Graph.
    /// </summary>
    public bool EsDeGraph(Uri? uri) =>
        uri != null && _destino != null && uri.IsAbsoluteUri
        && string.Equals(uri.Scheme, _destino.Scheme, StringComparison.OrdinalIgnoreCase)
        && string.Equals(uri.Host, _destino.Host, StringComparison.OrdinalIgnoreCase)
        && uri.Port == _destino.Port;

    /// <summary>
    /// La frase de cada situación. Un solo sitio para las dos piezas que la dicen —esta y
    /// <c>ClavesDelBackend</c>—, para que «espera aprobación» no acabe escrito de dos maneras.
    /// </summary>
    public static string Decir(string situacion, string codigo, string causa = "")
    {
        string cod = string.IsNullOrWhiteSpace(codigo) ? "" : $" · código {codigo}";
        return situacion switch
        {
            Pendiente => $"esta instalación espera aprobación{cod}",
            Aprobada => $"instalación aprobada{cod}",
            Revocada => $"el acceso de esta instalación fue revocado{cod}",
            SinCorreo => "falta el correo de quien usa Ü: sin él la instalación no se presenta",
            SinConfirmar => $"instalación con credencial, sin confirmar todavía con Graph{cod}",
            NoHaceFalta => $"Graph todavía no reparte credenciales por instalación ({causa}): se sigue como siempre",
            NoSePudo => $"no pude presentarme a Graph: {causa}",
            _ => "esta instalación todavía no se ha presentado a Graph",
        };
    }

    // ── Presentarse ──────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Se presenta a Graph si todavía no tiene credencial. UN intento por llamada. Devuelve la situación.
    /// </summary>
    /// <remarks>
    /// CON CREDENCIAL NO HACE NADA. Presentarse deja una fila en el panel: una instalación que se
    /// presentara en cada arranque llenaría la lista de pendientes de sí misma.
    /// </remarks>
    public async Task<string> PresentarseAsync(IReadOnlyDictionary<string, string> datos, CancellationToken ct = default)
    {
        if (Valor.Length > 0) return Situacion;

        // SIN CORREO NO. El primer arranque abre antes de que la persona diga quién es, y una fila sin
        // correo no se puede reconocer ni aprobar. Vacío no es ausente (patrón nº9).
        if (datos == null || !datos.TryGetValue("email", out var correo) || string.IsNullOrWhiteSpace(correo))
        {
            Fijar(SinCorreo);
            return SinCorreo;
        }

        int estado;
        string cuerpo;
        try
        {
            (estado, cuerpo) = await _presentar(JsonSerializer.Serialize(datos), ct).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception e)
        {
            Fijar(NoSePudo, Cadena(e));
            return NoSePudo;
        }

        // UN GRAPH ANTERIOR A LA SPEC 076 no tiene esta ruta. No es un fallo que reintentar: es que no
        // hace falta credencial, y Ü sigue como siempre.
        if (estado == 404)
        {
            Fijar(NoHaceFalta, "HTTP 404");
            return NoHaceFalta;
        }
        if (estado < 200 || estado > 299)
        {
            string code = Campo(cuerpo, "code");
            Fijar(NoSePudo, $"HTTP {estado}" + (code.Length > 0 ? $" ({code})" : ""));
            return NoSePudo;
        }

        string token = Campo(cuerpo, "token");
        if (token.Length == 0)
        {
            Fijar(NoSePudo, "Graph contestó un alta sin credencial dentro");
            return NoSePudo;
        }
        string codigo = Campo(cuerpo, "codigo");

        // SE GUARDA ANTES DE USARLA. Si no se puede guardar se usa igual —esta sesión funciona—, y el
        // siguiente arranque se presenta de nuevo: se dice, no se calla.
        try { _guardar(JsonSerializer.Serialize(new Dictionary<string, string> { ["token"] = token, ["codigo"] = codigo })); }
        catch (Exception e) { _log($"no pude guardar la credencial ({Cadena(e)}); el siguiente arranque se presenta otra vez."); }

        lock (_candado) { _valor = token; _codigo = codigo; }
        // Nace pendiente SIEMPRE: aunque el alta dijera otra cosa, quien decide es la pregunta siguiente.
        Fijar(Pendiente);
        return Pendiente;
    }

    // ── Preguntar ────────────────────────────────────────────────────────────────────────────────

    private enum Respondio { Contesto, YaNoLaConoce, NoSePudo }

    /// <summary>Pregunta a Graph cómo está esta instalación. Devuelve la situación.</summary>
    public async Task<string> PreguntarAsync(CancellationToken ct = default)
    {
        await PreguntarInternoAsync(ct).ConfigureAwait(false);
        return Situacion;
    }

    private async Task<Respondio> PreguntarInternoAsync(CancellationToken ct)
    {
        string valor = Valor;
        if (valor.Length == 0) return Respondio.YaNoLaConoce;

        int estado;
        string cuerpo;
        try
        {
            (estado, cuerpo) = await _preguntar(valor, ct).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception e)
        {
            // NO PODER PREGUNTAR NO ES ESTAR REVOCADA: la situación se queda como estaba.
            _log($"no pude preguntar mi estado ({Cadena(e)}).");
            return Respondio.NoSePudo;
        }

        if (estado == 404)
        {
            // GRAPH YA NO LA CONOCE (se borró la fila, o la base es otra). Seguir enseñando una
            // credencial que nadie reconoce es quedarse fuera para siempre: se tira y se presenta de nuevo.
            Olvidar("Graph ya no conoce esta credencial");
            return Respondio.YaNoLaConoce;
        }
        if (estado < 200 || estado > 299)
        {
            _log($"Graph contestó HTTP {estado} al preguntar mi estado.");
            return Respondio.NoSePudo;
        }

        string codigo = Campo(cuerpo, "codigo");
        if (codigo.Length > 0) lock (_candado) _codigo = codigo;
        Fijar(Campo(cuerpo, "estado") switch
        {
            Aprobada => Aprobada,
            Revocada => Revocada,
            // Todo lo que no sea «aprobada» o «revocada» es esperar: un estado nuevo en Graph no puede
            // leerse aquí como un pase.
            _ => Pendiente,
        });
        return Respondio.Contesto;
    }

    // ── Vigilar ──────────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Se presenta si hace falta y pregunta hasta que la aprueban o la revocan. Termina sola.
    /// </summary>
    /// <remarks>
    /// POR QUÉ NO ES EL BUCLE QUE YA SE PAGÓ (pendiente nº3 de CLAUDE.md: 14 turnos rebotando). Entre
    /// dos intentos hay SIEMPRE una pausa, la de los fallos crece hasta cinco minutos, y hay cuatro
    /// salidas que no dependen de la suerte: aprobada, revocada, sin correo, y un Graph que no sabe de
    /// instalaciones. La pausa se inyecta para que el contrato juzgue el orden sin esperar de verdad.
    ///
    /// Quien instala llama al administrador, este aprueba en el panel, y Ü se entera sola en segundos:
    /// reiniciar «para que coja la aprobación» es el paso que nadie recuerda el día de la instalación.
    /// </remarks>
    public async Task VigilarAsync(IReadOnlyDictionary<string, string> datos, Func<int, CancellationToken, Task> pausa, CancellationToken ct = default)
    {
        if (pausa == null) throw new ArgumentNullException(nameof(pausa));
        // UNA SOLA VIGILANCIA A LA VEZ: dos preguntarían el doble y se presentarían dos veces.
        if (Interlocked.Exchange(ref _vigilando, 1) == 1) return;
        try
        {
            int fallos = 0, esperas = 0, desconocidas = 0;
            while (!ct.IsCancellationRequested)
            {
                if (Valor.Length == 0)
                {
                    await PresentarseAsync(datos, ct).ConfigureAwait(false);
                    if (Valor.Length == 0)
                    {
                        if (Situacion is SinCorreo or NoHaceFalta) return;
                        await pausa(EsperaTrasFallo(++fallos), ct).ConfigureAwait(false);
                        continue;
                    }
                    fallos = 0;
                    // Recién presentada ya se sabe pendiente: preguntar en el mismo instante es un viaje
                    // para oír lo mismo. Y si Graph la «olvida» una y otra vez, se espera como en un fallo.
                    await pausa(desconocidas > 1 ? EsperaTrasFallo(desconocidas) : EsperaDePendiente(esperas++), ct).ConfigureAwait(false);
                }

                var r = await PreguntarInternoAsync(ct).ConfigureAwait(false);
                if (r == Respondio.NoSePudo) { await pausa(EsperaTrasFallo(++fallos), ct).ConfigureAwait(false); continue; }
                fallos = 0;
                if (r == Respondio.YaNoLaConoce) { desconocidas++; continue; }
                if (Situacion is Aprobada or Revocada) return;
                await pausa(EsperaDePendiente(esperas++), ct).ConfigureAwait(false);
            }
        }
        catch (OperationCanceledException) { }
        finally { Interlocked.Exchange(ref _vigilando, 0); }
    }

    /// <summary>30 s, 1 min, 2 min, y de ahí cinco minutos: un Graph caído una tarde no acaba en «mañana».</summary>
    private static int EsperaTrasFallo(int fallos) => fallos switch { <= 1 => 30_000, 2 => 60_000, 3 => 120_000, _ => 300_000 };

    /// <summary>
    /// Cada 20 s los primeros cinco minutos —que es cuando alguien está al teléfono con el
    /// administrador—, cada minuto la primera hora, y después cada cinco.
    /// </summary>
    private static int EsperaDePendiente(int vuelta) => vuelta < 15 ? 20_000 : vuelta < 75 ? 60_000 : 300_000;

    // ── Lo que dicen las demás peticiones ────────────────────────────────────────────────────────

    /// <summary>
    /// Graph rechazó una petición cualquiera por la instalación: se anota, para enterarse por la
    /// primera respuesta que lo diga y no al cabo de la siguiente pregunta.
    /// </summary>
    public void AnotarRechazo(string code, string codigo = "")
    {
        if (!string.IsNullOrWhiteSpace(codigo)) lock (_candado) _codigo = codigo.Trim();
        switch (code)
        {
            case "instalacion_pendiente": Fijar(Pendiente); break;
            case "instalacion_revocada": Fijar(Revocada); break;
            case "instalacion_desconocida": Olvidar("Graph ya no conoce esta credencial"); break;
            // «sin credencial» no cambia nada: es lo que ya sabemos si no hay, y si la hay es que la
            // petición salió antes de tenerla.
        }
    }

    // ── Por dentro ───────────────────────────────────────────────────────────────────────────────

    private void Cargar()
    {
        string? guardado;
        try { guardado = _leer(); }
        catch (Exception e) { _log($"no pude leer la credencial guardada ({Cadena(e)})."); return; }
        if (string.IsNullOrWhiteSpace(guardado)) return;

        string token = Campo(guardado, "token");
        if (token.Length == 0)
        {
            // Lo que no se entiende no es una credencial: mandarlo como tal sería presentarse con basura.
            _log("lo guardado no se entiende; se ignora y la instalación se presenta de nuevo.");
            return;
        }
        lock (_candado) { _valor = token; _codigo = Campo(guardado, "codigo"); _situacion = SinConfirmar; }
    }

    private void Olvidar(string porque)
    {
        try { _guardar(null); }
        catch (Exception e) { _log($"no pude borrar la credencial guardada ({Cadena(e)})."); }
        lock (_candado) { _valor = ""; _codigo = ""; }
        _log($"{porque}; se presenta de nuevo.");
        Fijar(SinPresentar);
    }

    private void Fijar(string situacion, string causa = "")
    {
        bool cambio;
        string estado;
        lock (_candado)
        {
            cambio = _situacion != situacion || _causa != causa;
            bool cambioDeSituacion = _situacion != situacion;
            _situacion = situacion;
            _causa = causa;
            estado = Decir(_situacion, _codigo, _causa);
            if (cambio) _log(estado);
            cambio = cambioDeSituacion;
        }
        if (!cambio) return;
        // Quien escucha es la interfaz: que un fallo suyo no tumbe la vigilancia.
        try { AlCambiar?.Invoke(situacion); }
        catch (Exception e) { _log($"quien escuchaba el cambio lanzó ({Cadena(e)})."); }
    }

    /// <summary>Un campo de texto de un JSON. Cadena vacía si no está, no es texto o no es JSON.</summary>
    private static string Campo(string? json, string nombre)
    {
        if (string.IsNullOrWhiteSpace(json)) return "";
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.ValueKind == JsonValueKind.Object
                && doc.RootElement.TryGetProperty(nombre, out var v)
                && v.ValueKind == JsonValueKind.String
                ? (v.GetString() ?? "").Trim()
                : "";
        }
        catch (JsonException) { return ""; }
    }

    /// <summary>La cadena ENTERA de la excepción: un catch mudo convierte «sin red» en «no se pudo» (patrón nº3).</summary>
    private static string Cadena(Exception e)
    {
        var partes = new List<string>();
        for (var x = e; x != null; x = x.InnerException) partes.Add($"{x.GetType().Name}: {x.Message}");
        return string.Join(" ← ", partes);
    }

    // ── La de la app ─────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// La de verdad: se presenta con la clave que el instalador lleva embebida, y guarda la credencial
    /// protegida para este usuario de Windows.
    /// </summary>
    /// <remarks>
    /// UN ARCHIVO POR GRAPH. Quien desarrolla cambia de Graph con GRAPH_BASE_URL —el local, el de
    /// producción—; con un solo archivo, cada cambio «olvidaría» la credencial del otro y dejaría una
    /// fila pendiente nueva en cada ida y vuelta.
    /// </remarks>
    public static CredencialDeInstalacion DeGraph(GraphConfig config, Action<string> log)
    {
        string baseUrl = (config.BaseUrl ?? "").TrimEnd('/');
        string url = baseUrl + "/api/v1/agent/enroll";
        string marca = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(baseUrl.ToLowerInvariant())))[..8].ToLowerInvariant();
        var almacen = new AlmacenProtegido(Path.Combine(UserPaths.Local, "U", $"instalacion-{marca}.bin"));
        // SIN el sello: estas dos peticiones son las que consiguen la credencial, y la ponen ellas.
        var http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };

        async Task<(int, string)> Enviar(HttpRequestMessage req, CancellationToken ct)
        {
            using (req)
            {
                req.Headers.Add("X-API-Key", config.ApiKey ?? "");
                using var res = await http.SendAsync(req, ct).ConfigureAwait(false);
                return ((int)res.StatusCode, await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false));
            }
        }

        return new CredencialDeInstalacion(
            baseUrl,
            almacen.Leer,
            almacen.Guardar,
            (cuerpo, ct) => Enviar(new HttpRequestMessage(HttpMethod.Post, url) { Content = new StringContent(cuerpo, Encoding.UTF8, "application/json") }, ct),
            (credencial, ct) =>
            {
                var req = new HttpRequestMessage(HttpMethod.Get, url);
                req.Headers.TryAddWithoutValidation(Cabecera, credencial);
                return Enviar(req, ct);
            },
            log);
    }
}
