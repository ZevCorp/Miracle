using System.Diagnostics;
using System.Net.Http.Headers;
using System.Net.WebSockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Voz.Realtime;

// LA SONDA DE LA VOZ (spec 073): ¿habla la voz MIENTRAS el delegado trabaja?
//
//   sonda-de-la-voz [--delegado gpt-6-luna] [--avances callados|ninguno] [--persona <archivo>]
//                   [--frase "..."] [--ms-por-paso 2500] [--falla 3] [--instrucciones <archivo>]
//                   [--esfuerzo low] [--interrumpe "¿cómo vas?" --a-los 6000] [--salida <carpeta>]
//                   [--texto]   la frase entra ESCRITA y sin micrófono, como una orden del chat (u_orden)
//                   [--apertura <archivo>]  el session.start que manda la app, con su catálogo entero
//                   [--tier priority]       el service_tier de la delegación
//
// Sin --persona usa la de la app (ProtocoloGptLive.InstruccionesDeLaVoz), y los avances salen por la misma
// regla que en la app (AvancesParaLaVoz): se mide lo que se distribuye, no una copia.
//
// QUÉ HACE. Sintetiza la frase a audio, abre una sesión GPT-Live de verdad con la persona y el delegado
// pedidos, le manda el audio al ritmo de un micrófono, contesta las herramientas con resultados de mentira
// (cada paso de map_hacer tarda --ms-por-paso; con --falla N el paso N no se puede) y, con --avances callados,
// le va contando a la voz lo que ocurre.
// Al final escribe la línea de tiempo y cuatro números: cuánto tardó en decir la primera palabra, cuántas
// frases dijo durante el trabajo, el silencio más largo durante el trabajo, y lo que pensó el delegado por vuelta.
//
// QUÉ NO HACE. No toca la pantalla, no abre el micrófono y no suena: el audio de la voz se descarta. Lo que
// dijo se lee de su transcripción.
//
// LA CLAVE sale de OPENAI_API_KEY y no se escribe en ningún sitio.

internal static class Programa
{
    private static readonly Stopwatch Reloj = Stopwatch.StartNew();
    private static readonly List<(long Ms, string Quien, string Que)> Linea = new();
    private static readonly object Candado = new();
    private static ClientWebSocket _ws = new();
    private static readonly SemaphoreSlim Envio = new(1, 1);

    private static string _avances = "callados";
    private static int _falla = -1;
    private static string Etiqueta = "";
    private static readonly AvancesParaLaVoz Regla = new(() => Reloj.ElapsedMilliseconds);
    private static readonly ProtocoloGptLive Protocolo = new();
    private static int _msPorPaso = 2500;
    private static long _finDeLaPeticion = -1;      // cuándo terminó de sonar la frase del usuario
    private static long _primeraLlamada = -1, _ultimoResultado = -1;
    private static long _ultimaVozMs = -1;          // la última vez que la voz dijo algo (o se le dictó)
    private static long _delegadoTermino = -1;
    private static int _pendientes;
    private static long _ultimoEnvioAlDelegado = -1;
    private static readonly List<long> Pensar = new();
    private static readonly List<long> VozDurante = new();
    private static readonly StringBuilder DijoU = new(), DijoUsuario = new();
    private static int _aceptados, _rechazados;

    private static async Task<int> Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;
        string Arg(string n, string d) { int i = Array.IndexOf(args, n); return i >= 0 && i + 1 < args.Length ? args[i + 1] : d; }

        string clave = Environment.GetEnvironmentVariable("OPENAI_API_KEY") ?? "";
        if (clave.Length == 0) { Console.WriteLine("NO SE PUDO SONDEAR: falta OPENAI_API_KEY."); return 99; }

        string delegado = Arg("--delegado", Protocolo.Delegado);
        string esfuerzo = Arg("--esfuerzo", "low");
        string frase = Arg("--frase", "Abre la calculadora, multiplica mil doscientos treinta y cuatro por cincuenta y seis, y después abre el bloc de notas y escribe el resultado.");
        string archivoPersona = Arg("--persona", "");
        string archivoInstr = Arg("--instrucciones", "");
        string interrumpe = Arg("--interrumpe", "");
        int aLos = int.Parse(Arg("--a-los", "6000"));
        _avances = Arg("--avances", "callados");
        _falla = int.Parse(Arg("--falla", "-1"));
        bool escrita = args.Contains("--texto");
        string archivoApertura = Arg("--apertura", "");
        string tier = Arg("--tier", "");
        Etiqueta = (tier.Length > 0 ? $" tier={tier}" : "") + (archivoApertura.Length > 0 ? " catalogo=app" : " catalogo=minimo");
        _msPorPaso = int.Parse(Arg("--ms-por-paso", "2500"));
        string salida = Arg("--salida", Path.Combine(Path.GetTempPath(), "sonda-de-la-voz"));
        Directory.CreateDirectory(salida);

        if (archivoPersona.Length > 0 && !File.Exists(archivoPersona)) { Console.WriteLine("NO SE PUDO SONDEAR: --persona <archivo> no existe."); return 99; }
        string persona = archivoPersona.Length > 0 ? File.ReadAllText(archivoPersona, Encoding.UTF8).Trim() : ProtocoloGptLive.InstruccionesDeLaVoz;
        string instrucciones = File.Exists(archivoInstr) ? File.ReadAllText(archivoInstr, Encoding.UTF8).Trim() : InstruccionesDeRespaldo;

        byte[] voz = escrita ? Array.Empty<byte>() : await SintetizarAsync(clave, frase, salida);
        byte[] vozInterrupcion = interrumpe.Length > 0 ? await SintetizarAsync(clave, interrumpe, salida) : Array.Empty<byte>();

        _ws.Options.SetRequestHeader("Authorization", "Bearer " + clave);
        using var fin = new CancellationTokenSource(TimeSpan.FromSeconds(150));
        await _ws.ConnectAsync(new Uri("wss://api.openai.com/v1/live/sessions"), fin.Token);

        // LA APERTURA: la de la app si se da —sus instrucciones y sus 28 herramientas, que es con lo que piensa
        // el delegado de verdad—, o una mínima con dos herramientas. Con dos herramientas gpt-6-luna pensó 1,0 s
        // por vuelta; lo que tarda con el catálogo entero es otra medida, y es la que cuenta.
        JsonObject delegacion = new()
        {
            ["model"] = delegado,
            ["instructions"] = instrucciones,
            ["tools"] = JsonSerializer.SerializeToNode(Herramientas),
            ["tool_choice"] = "auto",
        };
        if (archivoApertura.Length > 0)
        {
            var deLaApp = JsonNode.Parse(File.ReadAllText(archivoApertura, Encoding.UTF8))!["session"]!["delegation"]!["responses"]!.AsObject();
            delegacion["instructions"] = deLaApp["instructions"]!.GetValue<string>();
            delegacion["tools"] = deLaApp["tools"]!.DeepClone();
        }
        delegacion["reasoning"] = new JsonObject { ["effort"] = esfuerzo };
        if (tier.Length > 0) delegacion["service_tier"] = tier;
        var inicio = new JsonObject
        {
            ["type"] = "session.start",
            ["session"] = new JsonObject
            {
                ["model"] = "gpt-live-1",
                ["instructions"] = persona,
                ["audio"] = new JsonObject
                {
                    ["format"] = new JsonObject { ["type"] = "audio/pcm", ["rate"] = 24000 },
                    ["output"] = new JsonObject { ["voice"] = "marin" },
                },
                ["delegation"] = new JsonObject { ["type"] = "responses", ["responses"] = delegacion },
            },
        };
        await MandarCrudoAsync(inicio.ToJsonString(), fin.Token);

        var abierta = new TaskCompletionSource<bool>();
        var recibir = Task.Run(() => RecibirAsync(abierta, fin.Token));
        if (!await abierta.Task) { Console.WriteLine("NO ABRIÓ. Ver la línea de tiempo:"); Volcar(); return 3; }
        Anotar("sonda", $"sesión abierta · delegado={delegado} · esfuerzo={esfuerzo} · avances={_avances}");

        // EL MICRÓFONO: medio segundo de silencio, la frase al ritmo real, y silencio hasta el final. El servidor
        // necesita el caño abierto para saber que la persona calló.
        if (escrita)
        {
            // COMO LO ESCRITO EN EL CHAT: un mensaje de usuario y pedir turno, sin un solo trozo de audio.
            await MandarAsync(new { type = "response.item.create", item = new { type = "message", role = "user", content = new[] { new { type = "input_text", text = frase } } } }, fin.Token);
            await MandarAsync(new { type = "response.create" }, fin.Token);
            _finDeLaPeticion = Reloj.ElapsedMilliseconds;
            Anotar("usuario", "(escribió) " + frase);
        }
        var microfono = escrita ? Task.CompletedTask : Task.Run(async () =>
        {
            var ritmo = Stopwatch.StartNew();
            long enviados = 0;
            async Task Tramo(byte[] pcm)
            {
                for (int i = 0; i < pcm.Length; i += 4800)
                {
                    int n = Math.Min(4800, pcm.Length - i);
                    await MandarAsync(new { type = "session.input_audio.append", audio = Convert.ToBase64String(pcm, i, n) }, fin.Token);
                    enviados += n;
                    long debe = enviados * 1000 / 48000;          // 24 kHz · 2 bytes
                    long espera = debe - ritmo.ElapsedMilliseconds;
                    if (espera > 0) await Task.Delay((int)espera, fin.Token);
                }
            }
            await Tramo(new byte[24000]);
            await Tramo(voz);
            _finDeLaPeticion = Reloj.ElapsedMilliseconds;
            Anotar("usuario", "(terminó de hablar)");
            bool yaInterrumpio = vozInterrupcion.Length == 0;
            while (!fin.IsCancellationRequested && _ws.State == WebSocketState.Open)
            {
                if (!yaInterrumpio && _primeraLlamada >= 0 && Reloj.ElapsedMilliseconds - _primeraLlamada >= aLos)
                {
                    yaInterrumpio = true;
                    Anotar("usuario", $"(empieza a preguntar «{interrumpe}»)");
                    await Tramo(vozInterrupcion);
                    Anotar("usuario", "(terminó de preguntar)");
                }
                await Tramo(new byte[4800]);
            }
        });

        // TERMINA cuando el delegado acabó, no queda llamada pendiente y la voz lleva 6 s callada.
        while (!fin.IsCancellationRequested && _ws.State == WebSocketState.Open)
        {
            await Task.Delay(250);
            long ahora = Reloj.ElapsedMilliseconds;
            if (_delegadoTermino >= 0 && _pendientes == 0 && ahora - Math.Max(_delegadoTermino, _ultimaVozMs) > 6000) break;
            if (_finDeLaPeticion >= 0 && _primeraLlamada < 0 && _delegadoTermino < 0 && ahora - _finDeLaPeticion > 40000) { Anotar("sonda", "40 s sin que el delegado hiciera nada: se corta"); break; }
        }
        try { await MandarAsync(new { type = "session.close" }, CancellationToken.None); } catch { }
        await Task.WhenAny(recibir, Task.Delay(3000));
        fin.Cancel();

        Volcar();
        Resumen(delegado, esfuerzo);
        string nombre = Path.Combine(salida, $"sonda-{DateTime.Now:yyyyMMdd-HHmmss}-{delegado}-{_avances}.txt");
        File.WriteAllLines(nombre, Linea.Select(x => $"{x.Ms,7} ms  {x.Quien,-9} {x.Que}"), Encoding.UTF8);
        Console.WriteLine($"\nLínea de tiempo en {nombre}");
        return 0;
    }

    // ── recibir ──────────────────────────────────────────────────────────────────────────────────

    private static async Task RecibirAsync(TaskCompletionSource<bool> abierta, CancellationToken ct)
    {
        var buf = new byte[1 << 16];
        var ms = new MemoryStream();
        try
        {
            while (_ws.State == WebSocketState.Open && !ct.IsCancellationRequested)
            {
                ms.SetLength(0);
                WebSocketReceiveResult r;
                do { r = await _ws.ReceiveAsync(buf, ct); ms.Write(buf, 0, r.Count); } while (!r.EndOfMessage);
                if (r.MessageType == WebSocketMessageType.Close) { Anotar("servidor", "(cerró el socket)"); abierta.TrySetResult(false); break; }
                using var doc = JsonDocument.Parse(ms.ToArray());
                var m = doc.RootElement;
                string tipo = Texto(m, "type");
                switch (tipo)
                {
                    case "session.started": abierta.TrySetResult(true); break;
                    case "session.output_audio.delta": break;      // se descarta: no suena
                    case "session.output_transcript.delta":
                        {
                            string d = Texto(m, "delta");
                            long ahora = Reloj.ElapsedMilliseconds;
                            // Una frase nueva de la voz = un trozo tras más de 1,2 s sin trozos.
                            if (_ultimaVozMs < 0 || ahora - _ultimaVozMs > 1200)
                            {
                                if (_primeraLlamada >= 0 && (_ultimoResultado < 0 || _pendientes > 0 || _delegadoTermino < 0)) lock (Candado) VozDurante.Add(ahora);
                            }
                            _ultimaVozMs = ahora;
                            lock (Candado) DijoU.Append(d);
                            Anotar("VOZ", d.Trim().Length == 0 ? "·" : d);
                            break;
                        }
                    case "session.input_transcript.delta":
                        lock (Candado) DijoUsuario.Append(Texto(m, "delta"));
                        Anotar("oyó", Texto(m, "delta"));
                        break;
                    case "response.event":
                        if (m.TryGetProperty("event", out var ev)) await DelDelegadoAsync(ev, Texto(m, "delegation_id"), ct);
                        break;
                    case "session.thinking.appended":
                    case "session.commentary.appended":
                    case "session.instructions.appended":
                        _aceptados++;
                        Anotar("servidor", tipo);
                        break;
                    case "error":
                        _rechazados++;
                        Anotar("ERROR", m.TryGetProperty("error", out var e) ? e.GetRawText() : m.GetRawText());
                        if (!abierta.Task.IsCompleted) abierta.TrySetResult(false);
                        break;
                    case "session.closed": Anotar("servidor", "session.closed: " + Texto(m, "reason")); return;
                    case "session.usage.updated": break;
                    default: Anotar("servidor", tipo); break;
                }
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception e) { Anotar("sonda", "recepción cortada: " + e.Message); abierta.TrySetResult(false); }
    }

    private static readonly List<(string Id, string Nombre, string Args)> Tanda = new();

    private static async Task DelDelegadoAsync(JsonElement ev, string delegacion, CancellationToken ct)
    {
        string tipo = Texto(ev, "type");
        switch (tipo)
        {
            case "response.created":
                Anotar("delegado", $"empieza a pensar (delegación {Corto(delegacion)})");
                if (_ultimoEnvioAlDelegado < 0) _ultimoEnvioAlDelegado = Reloj.ElapsedMilliseconds;
                break;
            case "response.output_item.done":
                if (ev.TryGetProperty("item", out var item) && Texto(item, "type") == "function_call")
                {
                    long ahora = Reloj.ElapsedMilliseconds;
                    if (_primeraLlamada < 0) _primeraLlamada = ahora;
                    if (_ultimoEnvioAlDelegado >= 0) { lock (Candado) Pensar.Add(ahora - _ultimoEnvioAlDelegado); _ultimoEnvioAlDelegado = -1; }
                    string id = Texto(item, "call_id"), nombre = Texto(item, "name"), a = Texto(item, "arguments");
                    Interlocked.Increment(ref _pendientes);
                    Anotar("delegado", $"PIDE {nombre} {a}");
                    _ = Task.Run(() => EjecutarAsync(id, nombre, a, ct));
                }
                break;
            case "response.output_text.done":
                Anotar("delegado", "TEXTO: " + Texto(ev, "text"));
                break;
            case "response.completed":
                if (_pendientes == 0)
                {
                    _delegadoTermino = Reloj.ElapsedMilliseconds;
                    if (_ultimoEnvioAlDelegado >= 0) { lock (Candado) Pensar.Add(_delegadoTermino - _ultimoEnvioAlDelegado); _ultimoEnvioAlDelegado = -1; }
                    Anotar("delegado", "terminó (response.completed sin llamadas pendientes)");
                }
                break;
        }
    }

    // ── las manos de mentira ─────────────────────────────────────────────────────────────────────

    private static async Task EjecutarAsync(string id, string nombre, string argumentos, CancellationToken ct)
    {
        string resultado;
        try
        {
            if (nombre == "map_hacer")
            {
                var pasos = new List<string>();
                try
                {
                    using var d = JsonDocument.Parse(argumentos);
                    string crudo = d.RootElement.TryGetProperty("pasos", out var p) ? (p.ValueKind == JsonValueKind.String ? p.GetString() ?? "[]" : p.GetRawText()) : "[]";
                    using var lista = JsonDocument.Parse(crudo);
                    foreach (var x in lista.RootElement.EnumerateArray()) pasos.Add(x.GetString() ?? "");
                }
                catch { pasos.Add(argumentos); }

                var hechos = new List<string>();
                int fallidos = 0;
                for (int i = 0; i < pasos.Count; i++)
                {
                    if (fallidos > 0) { hechos.Add("– " + pasos[i] + ": omitido"); continue; }
                    await Task.Delay(_msPorPaso, ct);
                    bool falla = i + 1 == _falla;
                    string linea = falla ? $"✘ «{pasos[i]}»: no lo encontré en pantalla" : "✔ " + Dicho(pasos[i]);
                    if (falla) fallidos++;
                    hechos.Add(linea);
                    Anotar("manos", $"paso {i + 1} de {pasos.Count}: {linea}");
                    await AvanceAsync(linea, ct);
                }
                int bien = hechos.Count(h => h.StartsWith('✔'));
                // LA PANTALLA DE MENTIRA ES LA DE LO QUE SÍ SE HIZO. Con la de todos los pasos, un plan que
                // fallaba en «abre: bloc de notas» devolvía una pantalla con el bloc abierto y el número
                // escrito, y el delegado concluía —con razón— que había quedado hecho (2026-10-01).
                var cumplidos = pasos.Take(bien).ToList();
                resultado = $"{bien} de {pasos.Count} hechos · {fallidos} fallido(s) · {pasos.Count - bien - fallidos} omitido(s) | " + string.Join(" | ", hechos)
                    + " |  | EN PANTALLA AHORA, en «" + Pantalla(cumplidos) + "» (12 elemento(s)): |   «Minimizar» (Button) |   «Cerrar» (Button) | LA PANTALLA DICE: " + Dice(cumplidos);
            }
            else
            {
                await Task.Delay(Math.Max(400, _msPorPaso / 3), ct);
                resultado = "EN PANTALLA AHORA, en «Escritorio» (8 elemento(s)): |   «Inicio» (Button) |   «Buscar» (Button) | LA PANTALLA DICE: nada relevante";
            }
        }
        catch (OperationCanceledException) { return; }

        await SoltarAvancesAsync(ct);
        await MandarAsync(new { type = "response.item.create", item = new { type = "function_call_output", call_id = id, output = resultado } }, ct);
        _ultimoResultado = Reloj.ElapsedMilliseconds;
        Anotar("manos", $"resultado de {nombre} devuelto");
        if (Interlocked.Decrement(ref _pendientes) == 0)
        {
            _ultimoEnvioAlDelegado = Reloj.ElapsedMilliseconds;
            await MandarAsync(new { type = "response.create" }, ct);
        }
    }

    private static string Pantalla(List<string> pasos) =>
        pasos.Any(p => p.Contains("bloc", StringComparison.OrdinalIgnoreCase) || p.Contains("notepad", StringComparison.OrdinalIgnoreCase)) ? "Sin título - Bloc de notas" : "Calculadora";

    private static string Dice(List<string> pasos) =>
        pasos.Any(p => p.Contains("bloc", StringComparison.OrdinalIgnoreCase)) ? "69104" : "La pantalla muestra 69.104";

    /// <summary>Cómo cuenta el ejecutor de verdad un paso cumplido: en pasado («abrí …», «escribí …»).</summary>
    private static string Dicho(string paso)
    {
        int dos = paso.IndexOf(':');
        if (dos < 0) return $"«{paso}»: cumplido";
        string que = paso[(dos + 1)..].Trim();
        return paso[..dos].Trim().ToLowerInvariant() switch
        {
            "abre" => $"abrí {que}",
            "escribe" => $"escribí «{que}»",
            "pulsa" => $"«pulsa: {que}»: cumplido",
            "tecla" => $"pulsé la tecla «{que}»",
            _ => $"«{paso}»: cumplido",
        };
    }

    /// <summary>
    /// LO QUE SE LE CUENTA A LA VOZ mientras las manos trabajan: la línea del paso, tal como la entrega el
    /// ejecutor de la app, por la misma regla (AvancesParaLaVoz) y con el mismo mensaje (ProtocoloGptLive.Avance).
    /// </summary>
    private static async Task AvanceAsync(string linea, CancellationToken ct)
    {
        if (_avances == "ninguno") return;
        string l = linea.Trim();
        bool fallo = l.StartsWith('✘');
        if (fallo || l.StartsWith('✔')) l = l[1..].Trim();
        string? aviso = fallo ? Regla.Fallo(l) : Regla.Hecho(l);
        if (aviso == null) { Anotar("sonda", "(avance guardado para el siguiente)"); return; }
        Anotar("sonda", "AVANCE → " + aviso);
        await MandarCrudoAsync(Protocolo.Avance(aviso), ct);
    }

    private static async Task SoltarAvancesAsync(CancellationToken ct)
    {
        if (_avances == "ninguno" || Regla.AlTerminar() is not { } aviso) return;
        Anotar("sonda", "AVANCE (al terminar la tanda) → " + aviso);
        await MandarCrudoAsync(Protocolo.Avance(aviso), ct);
    }

    private static async Task MandarCrudoAsync(string json, CancellationToken ct)
    {
        if (json.Length == 0) return;
        await Envio.WaitAsync(ct);
        try { await _ws.SendAsync(Encoding.UTF8.GetBytes(json), WebSocketMessageType.Text, true, ct); }
        finally { Envio.Release(); }
    }

    // ── piezas ───────────────────────────────────────────────────────────────────────────────────

    private static async Task<byte[]> SintetizarAsync(string clave, string frase, string salida)
    {
        string huella = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(frase)))[..16];
        string archivo = Path.Combine(salida, $"frase-{huella}.pcm");
        if (File.Exists(archivo)) return await File.ReadAllBytesAsync(archivo);
        using var http = new HttpClient();
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", clave);
        foreach (string modelo in new[] { "gpt-4o-mini-tts", "tts-1" })
        {
            var cuerpo = JsonSerializer.Serialize(new { model = modelo, voice = "alloy", input = frase, response_format = "pcm" });
            using var r = await http.PostAsync("https://api.openai.com/v1/audio/speech", new StringContent(cuerpo, Encoding.UTF8, "application/json"));
            if (!r.IsSuccessStatusCode) { Console.WriteLine($"  (síntesis con {modelo}: {(int)r.StatusCode})"); continue; }
            byte[] pcm = await r.Content.ReadAsByteArrayAsync();
            await File.WriteAllBytesAsync(archivo, pcm);
            return pcm;
        }
        throw new InvalidOperationException("no pude sintetizar la frase con ningún modelo de voz");
    }

    private static async Task MandarAsync(object mensaje, CancellationToken ct)
    {
        byte[] bytes = JsonSerializer.SerializeToUtf8Bytes(mensaje);
        await Envio.WaitAsync(ct);
        try { await _ws.SendAsync(bytes, WebSocketMessageType.Text, true, ct); }
        finally { Envio.Release(); }
    }

    private static void Anotar(string quien, string que)
    {
        lock (Candado) Linea.Add((Reloj.ElapsedMilliseconds, quien, que.Replace("\n", " ")));
    }

    private static void Volcar()
    {
        // Los trozos seguidos de la voz, en una línea: se leen como frases y no como sílabas.
        Console.WriteLine("\n── LÍNEA DE TIEMPO (ms desde que arrancó la sonda) ──");
        string? previo = null; long desde = 0; var junto = new StringBuilder();
        void Soltar() { if (previo != null) Console.WriteLine($"{desde,7} ms  {previo,-9} {junto}"); junto.Clear(); }
        foreach (var (ms, quien, que) in Linea)
        {
            bool pegable = quien is "VOZ" or "oyó";
            if (pegable && quien == previo) { junto.Append(que); continue; }
            Soltar();
            previo = quien; desde = ms; junto.Append(que);
            if (!pegable) { Soltar(); previo = null; }
        }
        Soltar();
    }

    private static void Resumen(string delegado, string esfuerzo)
    {
        Console.WriteLine("\n── MEDIDAS ──");
        Console.WriteLine($"delegado={delegado} esfuerzo={esfuerzo} avances={_avances} ms_por_paso={_msPorPaso}" + Etiqueta);
        Console.WriteLine($"oyó: «{DijoUsuario.ToString().Trim()}»");
        long primeraVoz = Linea.Where(x => x.Quien == "VOZ" && x.Ms >= _finDeLaPeticion).Select(x => x.Ms).DefaultIfEmpty(-1).First();
        Console.WriteLine($"primera palabra de la voz tras la petición: {(primeraVoz < 0 ? "nunca" : (primeraVoz - _finDeLaPeticion) + " ms")}");
        Console.WriteLine($"primera llamada del delegado tras la petición: {(_primeraLlamada < 0 ? "nunca" : (_primeraLlamada - _finDeLaPeticion) + " ms")}");
        if (_primeraLlamada >= 0)
        {
            long finTrabajo = _delegadoTermino >= 0 ? _delegadoTermino : _ultimoResultado;
            Console.WriteLine($"el trabajo duró: {finTrabajo - _primeraLlamada} ms");
            // EL SILENCIO MÁS LARGO durante el trabajo: entre la primera llamada y el final, el hueco mayor sin voz.
            var hitos = new List<long> { _primeraLlamada };
            hitos.AddRange(Linea.Where(x => x.Quien == "VOZ" && x.Ms > _primeraLlamada && x.Ms < finTrabajo).Select(x => x.Ms));
            hitos.Add(finTrabajo);
            long hueco = 0; for (int i = 1; i < hitos.Count; i++) hueco = Math.Max(hueco, hitos[i] - hitos[i - 1]);
            Console.WriteLine($"frases de la voz DURANTE el trabajo: {VozDurante.Count}");
            Console.WriteLine($"silencio más largo durante el trabajo: {hueco} ms");
        }
        if (Pensar.Count > 0) Console.WriteLine($"el delegado pensó, por vuelta (ms): {string.Join(", ", Pensar)}");
        Console.WriteLine($"avances aceptados por el servidor: {_aceptados} · errores: {_rechazados}");
        Console.WriteLine($"la voz dijo: «{DijoU.ToString().Trim()}»");
    }

    private static string Texto(JsonElement o, string campo)
        => o.ValueKind == JsonValueKind.Object && o.TryGetProperty(campo, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";

    private static string Corto(string id) => id.Length > 10 ? id[..10] + "…" : id;

    private static readonly object[] Herramientas =
    {
        new
        {
            type = "function", name = "map_hacer",
            description = "HACE UN PLAN ENTERO EN UNA LLAMADA: le das la lista de pasos, en orden, y las manos los cumplen seguidos en la pantalla real. Devuelve cómo acabó cada paso y lo que hay en pantalla ahora.",
            parameters = new
            {
                type = "object",
                properties = new { pasos = new { type = "string", description = "Lista JSON de pasos, en orden: [\"abre: calculadora\", \"escribe: 1234*56=\"]. Cada paso es «abre: …», «pulsa: …», «escribe: …», «tecla: …», o un objetivo dicho con tus palabras." } },
                required = Array.Empty<string>(),
            },
        },
        new
        {
            type = "function", name = "map_what_i_see",
            description = "Lee lo que hay en pantalla ahora mismo: los elementos accionables y los textos visibles.",
            parameters = new { type = "object", properties = new { }, required = Array.Empty<string>() },
        },
    };

    private const string InstruccionesDeRespaldo =
        "Eres las manos de Ü, un asistente que maneja el ordenador de quien habla. Para actuar usa map_hacer con todos los pasos "
        + "que puedas prever; para leer la pantalla, map_what_i_see. Cuando termines, devuelve en una o dos frases qué quedó hecho.";
}
