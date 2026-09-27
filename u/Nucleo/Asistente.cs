using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace U.Ciclo;

/// <summary>
/// Ü ENTERO, sin la voz: las dos herramientas de Luna —mirar y hacer— montadas sobre el ciclo. La voz y el
/// modo texto usan esto mismo: un solo camino, para que lo que se mide en uno valga para el otro.
/// </summary>
public sealed class Asistente : IDisposable
{
    private readonly LectorUia _lector = new();
    private readonly ClienteJev _jev;

    /// <summary>Todo lo que pasa, en una línea: la burbuja y el log lo escuchan.</summary>
    public Action<string> Log { get; set; } = _ => { };

    /// <summary>El freno: Escape, o que la persona lo pida.</summary>
    public Func<bool> HayQueParar { get; set; } = Raton.EscapePulsado;

    /// <summary>
    /// La red de seguridad de un objetivo (promesa 464). No es lo que lo para: lo paran cumplirse, que Jev no se
    /// atreva, Escape, o un bucle. Era 8, y cortaba objetivos largos que avanzaban.
    /// </summary>
    public const int PasosDeSeguridad = 50;

    public int MaxPasosPorObjetivo { get; init; } = PasosDeSeguridad;

    public Asistente(string claveTypeSafe)
    {
        Raton.AsegurarDpi();
        _jev = new ClienteJev(claveTypeSafe) { Umbral = Jev.UmbralPorDefecto };
    }

    public long Calentar() => _jev.Calentar();

    /// <summary>La herramienta «mirar»: qué ventana, qué dice y qué se puede pulsar. Un ciclo sin decidir: ~40 ms.</summary>
    public string Mirar()
    {
        var r = Stopwatch.StartNew();
        var aqui = Donde.Ahora();
        if (aqui == null) return "No hay ninguna ventana delante.";
        var l = _lector.Leer(aqui.Ventana);
        var sb = new StringBuilder();
        sb.Append("Ventana delante: ").Append(aqui.Pantalla).Append('\n');
        if (l.Textos.Count > 0) sb.Append("Dice: ").Append(string.Join(" · ", l.Textos)).Append('\n');
        if (l.Campos.Count > 0) sb.Append("Campos:\n").Append(Accionables.DescribirCampos(l.Campos)).Append('\n');
        sb.Append($"Se puede pulsar ({l.Accionables.Count}): ");
        sb.Append(string.Join(", ", l.Accionables.Select(a => $"{a.Nombre} ({a.Tipo})")));
        Log($"👁 mirar en {r.ElapsedMilliseconds} ms · {aqui.Pantalla} · {l.Accionables.Count} accionables");
        return sb.ToString();
    }

    /// <summary>La herramienta «hacer»: el plan de Luna, ejecutado. Devuelve el relato para Luna.</summary>
    public string Hacer(IReadOnlyList<string> pasos)
    {
        Log($"📋 plan de {pasos.Count} paso(s): {string.Join(" → ", pasos)}");
        var motor = new Motor(Donde.Ahora, () => _lector.Leer(Donde.Ahora()?.Ventana ?? IntPtr.Zero), c => _jev.Decidir(c), Raton.Clic, HayQueParar)
        {
            AlTerminarVuelta = v => Log($"   ⏱ {v.Tiempos.Linea()} · {(v.Elegida.Length > 0 ? "pulsé " + v.Elegida : v.Resultado)}"),
        };
        var ejecutor = new Ejecutor(
            AbrirYEsperarQueSeLea,
            EscribirYEsperar,
            PulsarTeclaYEsperar,
            (objetivo, hecho) => motor.Objetivo(objetivo, MaxPasosPorObjetivo, hecho),
            HayQueParar)
        { AlTerminarPaso = l => Log("   " + l), Desplazar = DesplazarYEsperar, EsperarQuieta = EsperarQuieta };
        var r = ejecutor.Ejecutar(pasos);
        Log("↩ " + r.Resultado.Resumen);
        return r.Relato() + "\n\nAhora:\n" + Mirar();
    }

    /// <summary>
    /// ABRIR INCLUYE QUE SE PUEDA LEER. La primera lectura de una app recién abierta costó 351-469 ms en la
    /// batería del 2026-09-24 (23:10): UIA en frío mientras la app aún pinta. Contada dentro del primer ciclo lo
    /// sacaba del presupuesto; es tiempo de la app abriéndose, como el que espera una persona antes de mirar.
    /// </summary>
    private bool AbrirYEsperarQueSeLea(string app)
    {
        var (llego, ms) = Apps.Abrir(app);
        if (!llego) { Log($"   abrir «{app}»: no llegó delante en {ms} ms"); return false; }
        var r = Stopwatch.StartNew();
        int n = 0;
        var q = Asentado.Quieta(() => { var l = _lector.Leer(Donde.Ahora()?.Ventana ?? IntPtr.Zero); n = l.Accionables.Count; return l; },
            3000, () => r.ElapsedMilliseconds);
        Log($"   abrir «{app}»: delante en {ms} ms, {(q.Cambio ? "quieta" : "todavía moviéndose")} en {q.Ms} ms más ({n} accionables, {q.Lecturas} lecturas)");
        return true;
    }

    private void EscribirYEsperar(string texto)
    {
        Raton.Escribir(texto);
        var reloj = Stopwatch.StartNew();
        var q = Asentado.Quieta(() => _lector.Leer(Donde.Ahora()?.Ventana ?? IntPtr.Zero), Ejecutor.EsperaTrasEscribir(texto), () => reloj.ElapsedMilliseconds);
        Log($"   escribir {texto.Length} caracteres: {(q.Cambio ? "quieta" : "todavía tecleando")} en {q.Ms} ms");
    }

    private bool PulsarTeclaYEsperar(string tecla)
    {
        IntPtr Ventana() => Donde.Ahora()?.Ventana ?? IntPtr.Zero;
        string antes = _lector.Leer(Ventana()).Huella;
        if (!Raton.Tecla(tecla)) return false;
        var reloj = Stopwatch.StartNew();
        var a = Asentado.Esperar(() => _lector.Leer(Ventana()).Huella, antes, Ejecutor.EsperaTrasTecla(tecla), () => reloj.ElapsedMilliseconds);
        Log($"   tecla «{tecla}»: {(a.Cambio ? "la pantalla cambió" : "la pantalla no cambió")} en {a.Ms} ms");
        return true;
    }

    [System.Runtime.InteropServices.DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr h, out Rect r);
    [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)] private struct Rect { public int L, T, R, B; }

    /// <summary>
    /// La rueda sobre el centro de la ventana de delante (promesa 462): es donde está el contenido que se lee, y no
    /// una barra lateral. Después, la misma espera que tras un clic: sale en cuanto la pantalla cambia.
    /// </summary>
    private bool DesplazarYEsperar(int muescas)
    {
        var v = Donde.Ahora()?.Ventana ?? IntPtr.Zero;
        if (v == IntPtr.Zero || !GetWindowRect(v, out var r)) return false;
        string antes = _lector.Leer(v).Huella;
        var reloj = Stopwatch.StartNew();
        Raton.Desplazar((r.L + r.R) / 2, (r.T + r.B) / 2, muescas);
        var a = Asentado.Esperar(() => _lector.Leer(v).Huella, antes, Asentado.TechoMs, () => reloj.ElapsedMilliseconds);
        Log($"   desplazar {muescas}: {(a.Cambio ? "la pantalla cambió" : "la pantalla no cambió")} en {a.Ms} ms");
        return true;
    }

    /// <summary>«esperar…» (promesa 467): hasta que dos lecturas seguidas sean iguales, con techo de 3 s. No pulsa nada.</summary>
    private bool EsperarQuieta()
    {
        var reloj = Stopwatch.StartNew();
        var q = Asentado.Quieta(() => _lector.Leer(Donde.Ahora()?.Ventana ?? IntPtr.Zero), 3000, () => reloj.ElapsedMilliseconds);
        Log($"   esperar: {(q.Cambio ? "quieta" : "todavía moviéndose")} en {q.Ms} ms ({q.Lecturas} lecturas)");
        return true;
    }

    /// <summary>Atiende una llamada de Luna por su nombre. Lo desconocido se dice, no se ignora.</summary>
    public string Atender(string nombre, string argumentos)
    {
        try
        {
            switch (nombre)
            {
                case "mirar": return Mirar();
                case "hacer":
                    using (var d = JsonDocument.Parse(string.IsNullOrWhiteSpace(argumentos) ? "{}" : argumentos))
                    {
                        if (!d.RootElement.TryGetProperty("pasos", out var p) || p.ValueKind != JsonValueKind.Array)
                            return "«hacer» necesita «pasos»: una lista de pasos.";
                        var pasos = p.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String)
                            .Select(x => x.GetString() ?? "").Where(x => x.Trim().Length > 0).ToList();
                        return pasos.Count == 0 ? "El plan llegó vacío: no hice nada." : Hacer(pasos);
                    }
                default: return $"No conozco la herramienta «{nombre}». Tengo «hacer» y «mirar».";
            }
        }
        catch (Exception e)
        {
            string causa = "";
            for (var x = e; x != null; x = x.InnerException) causa += (causa.Length > 0 ? " ← " : "") + $"{x.GetType().Name}: {x.Message}";
            Log("✘ " + causa);
            return "Falló al ejecutar: " + causa;
        }
    }

    public void Dispose() { _lector.Dispose(); _jev.Dispose(); }
}

/// <summary>
/// LUNA POR TEXTO, sin voz: la Responses API con las mismas dos herramientas. Sirve para probar el camino
/// entero —pedido → Luna → Jev— sin micrófono, y como respaldo cuando la voz no está.
/// </summary>
public sealed class LunaPorTexto : IDisposable
{
    private readonly HttpClient _http;
    public Action<string> Log { get; set; } = _ => { };

    public LunaPorTexto(string claveOpenAI) : this(claveOpenAI, new HttpClientHandler()) { }

    /// <summary>Con el manejador HTTP que se le dé: el contrato le pone una Luna de mentira (promesa 463).</summary>
    public LunaPorTexto(string claveOpenAI, HttpMessageHandler manejador)
    {
        _http = new HttpClient(manejador) { Timeout = TimeSpan.FromSeconds(90) };
        _http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", claveOpenAI);
    }

    /// <summary>
    /// EL PEDIDO Y LO QUE HAY DELANTE, juntos (promesa 454). En la batería del 2026-09-24 (23:24) Luna gastó un
    /// turno entero —1,1-2,2 s— en llamar a «mirar» antes de planear cada pedido que hablaba de algo ya abierto.
    /// Mirar cuesta ~40 ms aquí; se le da hecho.
    /// </summary>
    public static string PrimeraEntrada(string pedido, string loQueHayDelante) =>
        string.IsNullOrWhiteSpace(loQueHayDelante)
            ? pedido
            : pedido + Environment.NewLine + Environment.NewLine + "(Lo que hay delante ahora mismo:" + Environment.NewLine + loQueHayDelante + ")";

    public string Pedir(string pedido, Asistente ü)
    {
        var reloj = Stopwatch.StartNew();
        return Pedir(pedido, ü.Mirar, ü.Atender, ü.HayQueParar, () => reloj.Elapsed);
    }

    /// <summary>
    /// HASTA QUE LUNA CONTESTE (promesa 463). Hasta el 2026-09-26 esto era un «for» de 8 turnos: cortó la investigación
    /// de las almejas con los papers ya abiertos, y la de Copilot→Neon a la mitad, sin entregar nada ninguna de las dos.
    /// Ahora no hay número: solo para Escape o el tope de 10 minutos (<see cref="Marcha"/>), y al parar Luna cuenta lo
    /// que logró.
    /// </summary>
    public string Pedir(string pedido, Func<string> mirar, Func<string, string, string> atender, Func<bool> hayQueParar, Func<TimeSpan> transcurrido)
    {
        string? anterior = null;
        object entrada = PrimeraEntrada(pedido, mirar());
        for (int turno = 1; ; turno++)
        {
            var (json, falla) = Turno(entrada, anterior, conHerramientas: true);
            if (falla != null) return falla;
            using var doc = JsonDocument.Parse(json!);
            anterior = doc.RootElement.GetProperty("id").GetString();

            var salidas = new List<object>();
            string texto = "";
            foreach (var item in doc.RootElement.GetProperty("output").EnumerateArray())
            {
                string tipo = ProtocoloVivo.Texto(item, "type");
                if (tipo == "function_call")
                {
                    string nombre = ProtocoloVivo.Texto(item, "name"), args = ProtocoloVivo.Texto(item, "arguments");
                    Log($"🌙 Luna ({_ultimoMs} ms) → {nombre} {args}");
                    string salida = atender(nombre, args);
                    salidas.Add(new { type = "function_call_output", call_id = ProtocoloVivo.Texto(item, "call_id"),
                        output = ParaLuna.Recortar(salida) + $"\n\n(Llevas {Marcha.Dicho(transcurrido())} en este pedido.)" });
                }
                else if (tipo == "message")
                    foreach (var c in item.GetProperty("content").EnumerateArray())
                        texto += ProtocoloVivo.Texto(c, "text");
            }
            if (salidas.Count == 0) { Log($"🌙 Luna ({_ultimoMs} ms): {texto}"); return texto; }

            string? porQue = Marcha.PorQueParar(transcurrido(), hayQueParar());
            if (porQue != null) return Cerrar(salidas, anterior, porQue, turno);
            entrada = salidas;
        }
    }

    private long _ultimoMs;

    /// <summary>Un turno de Luna. Devuelve el JSON, o por qué no lo hay, ya dicho para la persona.</summary>
    private (string? Json, string? Falla) Turno(object entrada, string? anterior, bool conHerramientas)
    {
        var cuerpo = new Dictionary<string, object?>
        {
            ["model"] = ProtocoloVivo.Luna,
            ["instructions"] = ProtocoloVivo.InstruccionesDeLuna,
            ["input"] = entrada,
            ["tools"] = ProtocoloVivo.Herramientas(),
            ["reasoning"] = new { effort = "low" },
        };
        if (!conHerramientas) cuerpo["tool_choice"] = "none";
        if (anterior != null) cuerpo["previous_response_id"] = anterior;
        var r = Stopwatch.StartNew();
        string serializado = JsonSerializer.Serialize(cuerpo);
        var envio = Enviar(() => _http.PostAsync("https://api.openai.com/v1/responses",
            new StringContent(serializado, Encoding.UTF8, "application/json")).GetAwaiter().GetResult(), Thread.Sleep);
        if (envio.Respuesta == null) { Log($"✘ Luna sin conexión tras {envio.Intentos} intento(s): {envio.Falla}"); return (null, "No pude hablar con Luna: " + envio.Falla); }
        using var res = envio.Respuesta;
        string json = res.Content.ReadAsStringAsync().GetAwaiter().GetResult();
        _ultimoMs = r.ElapsedMilliseconds;
        if (!res.IsSuccessStatusCode) return (null, $"Luna contestó HTTP {(int)res.StatusCode}: {(json.Length > 300 ? json[..300] : json)}");
        return (json, null);
    }

    /// <summary>
    /// AL PARAR, LO QUE SE LOGRÓ. Un último turno sin herramientas —con el resultado del último «hacer», que la API
    /// exige de vuelta— donde Luna cuenta qué consiguió y qué falta. Lo que se entrega empieza por el motivo.
    /// </summary>
    private string Cerrar(List<object> salidas, string? anterior, string porQue, int turnos)
    {
        Log($"⏹ paro tras {turnos} turno(s): {porQue}");
        var entrada = new List<object>(salidas)
        {
            new { role = "user", content = $"Paramos aquí ({porQue}). Sin usar herramientas, cuéntale a la persona en pocas frases lo que lograste y lo que quedó por hacer." },
        };
        var (json, falla) = Turno(entrada, anterior, conHerramientas: false);
        string resumen = "";
        if (json != null)
        {
            using var doc = JsonDocument.Parse(json);
            foreach (var item in doc.RootElement.GetProperty("output").EnumerateArray())
                if (ProtocoloVivo.Texto(item, "type") == "message")
                    foreach (var c in item.GetProperty("content").EnumerateArray()) resumen += ProtocoloVivo.Texto(c, "text");
            Log($"🌙 Luna ({_ultimoMs} ms): {resumen}");
        }
        return $"Paré: {porQue}. " + (resumen.Length > 0 ? resumen : falla ?? "");
    }

    /// <summary>
    /// UN CORTE DE RED NO TUMBA A Ü (promesa 461). El 2026-09-25 (20:45 y 21:09) un «Host desconocido» de
    /// api.openai.com subió sin capturar y cerró el proceso sin dejar una línea en el log. Solo se reintenta lo
    /// que no llegó a salir —DNS o conexión rechazada—: un plazo agotado pudo llegar a Luna y hacer algo, y
    /// repetirlo sería pedírselo dos veces.
    /// </summary>
    public static Envio Enviar(Func<HttpResponseMessage> enviar, Action<int> esperarMs)
    {
        int[] pausas = { 300, 1000 };
        for (int intento = 1; ; intento++)
        {
            try { return new Envio(enviar(), "", intento); }
            catch (HttpRequestException e) when (e.InnerException is System.Net.Sockets.SocketException && intento <= pausas.Length)
            {
                esperarMs(pausas[intento - 1]);
            }
            catch (Exception e)
            {
                string causa = "";
                for (var x = e; x != null; x = x.InnerException) causa += (causa.Length > 0 ? " ← " : "") + $"{x.GetType().Name}: {x.Message}";
                return new Envio(null, causa, intento);
            }
        }
    }

    public void Dispose() => _http.Dispose();
}

/// <summary>
/// CUÁNDO PARA LUNA (promesa 463): cuando la persona pulsa Escape, o a los 10 minutos como red de seguridad. Nada
/// más. Hubo un «3 turnos sin que la pantalla cambie» y se quitó el 2026-09-26: la pantalla que ve Luna es la lista de
/// lo pulsable, y en Chrome esa lista es el documento entero, así que desplazar o saltar a una sección de la misma
/// página la deja igual. En la web de Safix cortó una tarea que avanzaba.
/// </summary>
public static class Marcha
{
    /// <summary>La red de seguridad. Eran 10 minutos, y «haz pruebas durante media hora» se habría cortado (promesa 468).</summary>
    public static readonly TimeSpan Tope = TimeSpan.FromMinutes(60);

    public static string? PorQueParar(TimeSpan transcurrido, bool escape) =>
        escape ? "pulsaste Escape"
        : transcurrido >= Tope ? "llevo 60 minutos"
        : null;

    /// <summary>El tiempo, dicho para Luna: «1 min 35 s».</summary>
    public static string Dicho(TimeSpan t) => t.TotalMinutes >= 1 ? $"{(int)t.TotalMinutes} min {t.Seconds} s" : $"{t.Seconds} s";
}

/// <summary>Lo que dejó mandarle algo a Luna: la respuesta, o por qué no hubo, y cuántas veces se intentó.</summary>
public sealed record Envio(HttpResponseMessage? Respuesta, string Falla, int Intentos);
