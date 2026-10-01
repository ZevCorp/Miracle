using System.Globalization;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace U.WindowsClient.Voice;

/// <summary>
/// EL REPASO DE UNA SESIÓN (spec 074): al cerrar la voz, un modelo lee el diario y PROPONE qué quedarse —una
/// habilidad, una preferencia, un dato, una observación, algo que olvidar—, y este código APLICA solo lo que
/// trae una cita literal de la persona.
/// </summary>
/// <remarks>
/// <para>DE DÓNDE SALE. Es el diseño de memoria de Codex, de código abierto (<c>openai/codex</c>,
/// <c>codex-rs/memories</c>): al quedar quieta una sesión, un modelo extrae y otro consolida en preferencias
/// y <c>skills/</c>. Aquí las sesiones son cortas y el almacén pequeño, así que es UNA llamada: lee lo que ya
/// se sabe y el diario, y devuelve operaciones.</para>
/// <para>LO QUE CAMBIA RESPECTO A CODEX, por decisión del dueño (2026-10-01): allí una skill exige que el
/// procedimiento se repita; aquí la intención de enseñar va directo a habilidad, y la repetición es el otro
/// camino, no un requisito.</para>
/// <para>EL MODELO PROPONE, EL CÓDIGO APLICA (768). Ofrecidos «decir» y «recuerdo» a la voz, el modelo escribió
/// 79 recuerdos que nadie enseñó y pisó 17 (logs del 18 al 30 de septiembre de 2026). La compuerta es de
/// código: sin palabras que la persona dijo EN ESA SESIÓN, la propuesta se descarta y queda dicho por qué.</para>
/// <para>LA REPETICIÓN SE COMPRUEBA (770). Que algo se repitió es un hecho, y un hecho no se le pregunta a un
/// modelo: se mira en el cuaderno.</para>
/// <para>EL PROMPT VIVE AQUÍ, y es deuda dicha: la regla es que el cliente no lleva prompts, y este lo lleva,
/// como ya los llevan la voz y la lectura cardiológica. En Graph no se podría probar desde una rama.</para>
/// </remarks>
public sealed class ElRepaso
{
    /// <summary>Quien repasa. Barato y rápido: corre en segundo plano una vez por sesión.</summary>
    public const string Modelo = "gpt-6-luna";

    /// <summary>Una cita de menos palabras casaría con cualquier cosa: «por favor» está en media conversación.</summary>
    public const int MinimoDePalabrasDeLaCita = 3;

    private readonly LoAprendido _aprendido;
    private readonly Func<string, CancellationToken, Task<string>> _modelo;
    private readonly Func<string, CancellationToken, Task>? _guardarDato;
    private readonly Action<string> _log;

    /// <param name="modelo">Recibe el cuerpo de la petición a la Responses API y devuelve su respuesta cruda.
    /// Se inyecta para que el contrato lo juzgue sin red.</param>
    /// <param name="guardarDato">Dónde va un dato de la persona: la memoria personal.</param>
    public ElRepaso(LoAprendido aprendido, Func<string, CancellationToken, Task<string>> modelo,
        Func<string, CancellationToken, Task>? guardarDato = null, Action<string>? log = null)
    {
        _aprendido = aprendido ?? throw new ArgumentNullException(nameof(aprendido));
        _modelo = modelo ?? throw new ArgumentNullException(nameof(modelo));
        _guardarDato = guardarDato;
        _log = log ?? (_ => { });
    }

    /// <summary>
    /// Los datos de la persona que ya hay en la memoria personal, para que el repaso no proponga otra vez lo
    /// que quien actúa ya guardó en el momento con memory_remember. Sin esto se repasa igual, sin ese dato.
    /// </summary>
    public Func<CancellationToken, Task<string>>? DatosQueYaSabe { get; set; }

    /// <summary>
    /// Si el repaso VE (spec 079, promesa 784): las fotos del diario —lo que la persona tocó, lo que a Ü no le
    /// salió— viajan como imágenes. Se puede apagar sin apagar el repaso: entonces lee, y no mira.
    /// </summary>
    public bool ConFotos { get; set; } = true;

    /// <summary>
    /// SI QUIEN HABLA ES UN MÉDICO EN SU TRABAJO (promesa 778, y la 740 de «una sola Ü»). Entonces el repaso no
    /// guarda datos de la persona por su cuenta, y se le dice al modelo que nada de un paciente entra en lo que se
    /// aprende.
    /// </summary>
    /// <remarks>
    /// EN CONSULTA, «tengo un paciente de 54 años con dolor torácico» es lo más normal del mundo, y un dato guardado
    /// vuelve en cada sesión siguiente, también delante de otro paciente. La constitución de Ü dice que los datos de
    /// un paciente no van a la memoria; con un médico, lo que va a ella lo decide quien actúa con memory_remember,
    /// en el momento y a la vista. Cómo se hace una tarea y cómo quiere las cosas sí se aprende: no son de nadie más.
    /// </remarks>
    public Func<bool>? ConUnMedico { get; set; }

    /// <summary>UN REPASO A LA VEZ en todo el proceso: cerrar y volver a abrir en seguida lanza dos sobre la
    /// misma carpeta, y el mismo diario repasado a la par guardaría dos veces cada dato.</summary>
    private static readonly SemaphoreSlim UnoALaVez = new(1, 1);

    public sealed record Operacion(string Tipo, string Motivo, string Nombre, string Cuando, IReadOnlyList<string> Pasos, string Texto, string Cita);

    /// <summary>Cómo quedó un repaso. <see cref="Propuestas"/> es el denominador: lo aplicado y lo descartado suman eso.</summary>
    public sealed record Informe(int Propuestas, IReadOnlyList<string> Aplicadas, IReadOnlyList<string> Descartadas, bool LlamoAlModelo, string Error);

    /// <summary>Repasa un diario. No lanza: un repaso que falla devuelve su motivo en <see cref="Informe.Error"/>.</summary>
    public async Task<Informe> RepasarAsync(DiarioDeLaSesion diario, CancellationToken ct)
    {
        var nada = Array.Empty<string>();
        if (!diario.TieneQueRepasar) return new Informe(0, nada, nada, LlamoAlModelo: false, Error: "");

        var reloj = System.Diagnostics.Stopwatch.StartNew();
        IReadOnlyList<Operacion> propuestas;
        try
        {
            string yaSabe = _aprendido.ParaElRepaso();
            if (DatosQueYaSabe != null && await DatosQueYaSabe(ct) is { Length: > 0 } datos)
                yaSabe += "\n\nDATOS DE LA PERSONA YA GUARDADOS:\n" + datos;
            var fotos = ConFotos ? diario.FotosParaElRepaso() : Array.Empty<DiarioDeLaSesion.FotoDelDiario>();
            string respuesta = await _modelo(Peticion(yaSabe, diario.Texto(), fotos, ConUnMedico?.Invoke() == true), ct);
            propuestas = Leer(respuesta);
        }
        catch (Exception e) when (e is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            // LA CADENA ENTERA (patrón nº3): «no pude repasar» sin el motivo no distingue la red de la respuesta rota.
            var motivo = new StringBuilder();
            for (var x = e; x != null; x = x.InnerException) motivo.Append(motivo.Length > 0 ? " ← " : "").Append(x.GetType().Name).Append(": ").Append(x.Message);
            _log($"la sesión {diario.Sesion} NO se repasó, y sigue pendiente: {motivo}");
            return new Informe(0, nada, nada, LlamoAlModelo: true, Error: motivo.ToString());
        }

        var aplicadas = new List<string>();
        var descartadas = new List<string>();
        foreach (var op in propuestas)
        {
            string que = Describir(op);
            string? porQueNo = LaCitaNoVale(op.Cita, diario);
            if (porQueNo != null) { descartadas.Add($"{que}: {porQueNo}"); continue; }
            try
            {
                var (ok, como) = await AplicarAsync(op, diario.Sesion, ct);
                (ok ? aplicadas : descartadas).Add($"{que}: {como}");
            }
            catch (Exception e) when (e is not OperationCanceledException) { descartadas.Add($"{que}: no se pudo guardar ({e.GetType().Name}: {e.Message})"); }
        }

        _log($"sesión {diario.Sesion} repasada en {reloj.ElapsedMilliseconds} ms: {propuestas.Count} propuesta(s), {aplicadas.Count} aplicada(s), {descartadas.Count} descartada(s)");
        foreach (string a in aplicadas) _log("  ✓ " + a);
        foreach (string d in descartadas) _log("  ✋ " + d);
        return new Informe(propuestas.Count, aplicadas, descartadas, LlamoAlModelo: true, Error: "");
    }

    /// <summary>
    /// Repasa los diarios que esperan en <paramref name="carpeta"/>, del más viejo al más nuevo. El que se repasa
    /// se retira; el que falla se queda para la próxima vez (771). Devuelve cuántos se retiraron.
    /// </summary>
    public async Task<int> PendientesAsync(string carpeta, CancellationToken ct)
    {
        if (!Directory.Exists(carpeta)) return 0;
        await UnoALaVez.WaitAsync(ct);
        try
        {
            int retirados = 0;
            foreach (string archivo in Directory.GetFiles(carpeta, "*.json").OrderBy(File.GetLastWriteTimeUtc))
            {
                if (ct.IsCancellationRequested) break;
                if (!File.Exists(archivo)) continue;
                var diario = DiarioDeLaSesion.Leer(archivo);
                if (diario == null)
                {
                    // UN DIARIO ILEGIBLE NO ATASCA LA COLA PARA SIEMPRE, y tampoco se borra: se aparta con otro nombre.
                    string apartado = archivo + "." + DateTime.Now.ToString("yyyyMMdd-HHmmss-fff") + ".ilegible";
                    try { File.Move(archivo, apartado); _log($"un diario no se pudo leer y quedó apartado en «{apartado}»"); }
                    catch (IOException e) { _log($"un diario no se pudo leer ni apartar ({archivo}): {e.Message}"); }
                    continue;
                }
                var informe = await RepasarAsync(diario, ct);
                if (informe.Error.Length > 0) continue;   // sigue pendiente
                // CON SUS FOTOS (783): un diario repasado no deja en disco fotos de la pantalla de nadie.
                try { DiarioDeLaSesion.Retirar(archivo); retirados++; }
                catch (Exception e) when (e is IOException or UnauthorizedAccessException) { _log($"no pude retirar el diario repasado ({archivo}): {e.Message}"); }
            }
            return retirados;
        }
        finally { UnoALaVez.Release(); }
    }

    // ── Aplicar ──────────────────────────────────────────────────────────────

    private async Task<(bool Ok, string Como)> AplicarAsync(Operacion op, string sesion, CancellationToken ct)
    {
        string pasos = string.Join("\n", op.Pasos);
        switch (op.Tipo)
        {
            case "habilidad":
                // «REPETIDA» SE COMPRUEBA EN EL CUADERNO (770): si no estaba desde otra sesión, es la primera vez
                // que se ve, y la primera vez es una observación diga lo que diga el modelo.
                if (op.Motivo == "repetida" && !_aprendido.EstabaObservada(op.Nombre, sesion))
                    return Observar(op, sesion, "dijo «repetida» y no estaba en el cuaderno desde otra sesión");
                var escrita = _aprendido.EscribirHabilidad(op.Nombre, op.Cuando, pasos, op.Cita, op.Motivo.Length > 0 ? op.Motivo : "ensenada");
                return (escrita.Ok, escrita.Mensaje);

            case "observacion":
                return Observar(op, sesion, "");

            case "preferencia":
                var guardada = _aprendido.GuardarPreferencia(op.Texto, op.Cita);
                return (guardada.Ok, guardada.Mensaje);

            case "dato":
                if (string.IsNullOrWhiteSpace(op.Texto)) return (false, "el dato viene vacío");
                // AUNQUE EL MODELO LO PROPONGA (778): el esquema ya no se lo ofrece, y esto es lo que no depende de él.
                if (ConUnMedico?.Invoke() == true)
                    return (false, "con un médico el repaso no guarda datos por su cuenta: lo dicho en consulta puede ser de un paciente");
                if (_guardarDato == null) return (false, "no hay memoria personal conectada donde guardarlo");
                await _guardarDato(op.Texto.Trim(), ct);
                return (true, "guardado en la memoria personal");

            case "olvidar":
                // Lo que se olvida puede ser una habilidad o una preferencia; se prueba por su nombre y por su texto.
                foreach (string cual in new[] { op.Nombre, op.Texto }.Where(x => !string.IsNullOrWhiteSpace(x)))
                {
                    var h = _aprendido.OlvidarHabilidad(cual);
                    if (h.Ok) return (true, h.Mensaje);
                    var p = _aprendido.OlvidarPreferencia(cual);
                    if (p.Ok) return (true, p.Mensaje);
                }
                return (false, "no encontré nada guardado que se llame o diga eso");

            default:
                return (false, $"no sé qué es una operación «{op.Tipo}»");
        }
    }

    private (bool Ok, string Como) Observar(Operacion op, string sesion, string aviso)
    {
        string pasos = string.Join("\n", op.Pasos);
        int sesiones = _aprendido.Observar(op.Nombre, pasos, sesion);
        if (sesiones == 0) return (false, "una observación necesita nombre y pasos");
        // VISTA EN DOS SESIONES DISTINTAS ES UNA HABILIDAD, lo diga el modelo o no (770).
        if (sesiones >= 2)
        {
            var ascendida = _aprendido.EscribirHabilidad(op.Nombre, op.Cuando.Length > 0 ? op.Cuando : $"cuando pida {op.Nombre}", pasos, op.Cita, "repetida");
            return (ascendida.Ok, ascendida.Ok ? $"vista en {sesiones} sesiones: pasa del cuaderno a habilidad" : ascendida.Mensaje);
        }
        return (true, "apuntada en el cuaderno" + (aviso.Length > 0 ? $" ({aviso})" : ""));
    }

    private static string Describir(Operacion op)
        => op.Tipo is "preferencia" or "dato" || (op.Tipo == "olvidar" && op.Nombre.Length == 0)
            ? $"{op.Tipo} «{op.Texto}»"
            : $"{op.Tipo} «{op.Nombre}»";

    // ── La cita ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Por qué una cita no vale, o null si vale. Vale si es un trozo de lo que LA PERSONA dijo en este diario,
    /// sin contar mayúsculas, tildes ni puntuación: una transcripción llega con comas donde no las hay.
    /// </summary>
    internal static string? LaCitaNoVale(string cita, DiarioDeLaSesion diario)
    {
        string c = SoloLetras(cita);
        if (c.Length == 0) return "sin cita: no trae las palabras de la persona que la justifican";
        int palabras = c.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
        if (palabras < MinimoDePalabrasDeLaCita) return $"la cita es demasiado corta ({palabras} palabra(s)): casaría con cualquier cosa";
        return diario.DichoPorLaPersona.Any(d => SoloLetras(d).Contains(c, StringComparison.Ordinal))
            ? null
            : $"la cita no la dijo la persona en esta sesión («{cita.Trim()}»)";
    }

    /// <summary>Minúsculas, sin tildes, y todo lo que no es letra o número, un espacio.</summary>
    private static string SoloLetras(string texto)
    {
        var sb = new StringBuilder();
        bool hueco = false;
        foreach (char ch in (texto ?? "").ToLowerInvariant().Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue;
            if (char.IsLetterOrDigit(ch)) { if (hueco && sb.Length > 0) sb.Append(' '); sb.Append(ch); hueco = false; }
            else hueco = true;
        }
        return sb.ToString();
    }

    // ── Lo que se le pide al modelo, y lo que contesta ───────────────────────

    /// <summary>El cuerpo de la petición a la Responses API (promesa 773).</summary>
    internal static string Peticion(string loQueYaSabe, string diario, IReadOnlyList<DiarioDeLaSesion.FotoDelDiario>? fotos = null, bool conUnMedico = false)
    {
        // CON UN MÉDICO, «dato» NI SE OFRECE (778): lo que el esquema no admite, el modelo no lo puede proponer.
        var tipos = conUnMedico ? new JsonArray("habilidad", "preferencia", "observacion", "olvidar")
                                : new JsonArray("habilidad", "preferencia", "dato", "observacion", "olvidar");
        var cadena = new JsonObject { ["type"] = "string" };
        var esquema = new JsonObject
        {
            ["type"] = "object",
            ["additionalProperties"] = false,
            ["required"] = new JsonArray("operaciones"),
            ["properties"] = new JsonObject
            {
                ["operaciones"] = new JsonObject
                {
                    ["type"] = "array",
                    ["items"] = new JsonObject
                    {
                        ["type"] = "object",
                        ["additionalProperties"] = false,
                        ["required"] = new JsonArray("tipo", "motivo", "nombre", "cuando", "pasos", "texto", "cita"),
                        ["properties"] = new JsonObject
                        {
                            ["tipo"] = new JsonObject { ["type"] = "string", ["enum"] = tipos },
                            ["motivo"] = new JsonObject { ["type"] = "string", ["enum"] = new JsonArray("ensenada", "corregida", "repetida", ""), ["description"] = "Solo para una habilidad: por qué lo es. Vacío en lo demás." },
                            ["nombre"] = new JsonObject { ["type"] = "string", ["description"] = "Nombre corto de la habilidad u observación, como lo diría la persona. Vacío en preferencia y dato." },
                            ["cuando"] = new JsonObject { ["type"] = "string", ["description"] = "Cuándo usar la habilidad: qué pedirá la persona. Vacío en lo demás." },
                            ["pasos"] = new JsonObject { ["type"] = "array", ["items"] = cadena.DeepClone(), ["description"] = "Los pasos, en orden, uno por elemento. Vacío en preferencia, dato y olvidar." },
                            ["texto"] = new JsonObject { ["type"] = "string", ["description"] = "La preferencia o el dato, en una frase. En olvidar, lo que hay que olvidar. Vacío en habilidad y observación." },
                            ["cita"] = new JsonObject { ["type"] = "string", ["description"] = "Las palabras EXACTAS de la persona en el diario que justifican esta operación." },
                        },
                    },
                },
            },
        };
        var peticion = new JsonObject
        {
            ["model"] = Modelo,
            ["instructions"] = conUnMedico ? Instrucciones + "\n\n" + ConUnMedicoDelante : Instrucciones,
            ["input"] = Entrada("LO QUE Ü YA SABE DE ESTA PERSONA\n\n" + loQueYaSabe + "\n\n\nEL DIARIO DE LA SESIÓN QUE ACABA DE TERMINAR\n\n" + diario, fotos),
            ["reasoning"] = new JsonObject { ["effort"] = "medium" },
            ["text"] = new JsonObject
            {
                ["format"] = new JsonObject { ["type"] = "json_schema", ["name"] = "repaso_de_la_sesion", ["strict"] = true, ["schema"] = esquema },
            },
        };
        return peticion.ToJsonString();
    }

    /// <summary>
    /// La entrada de la petición: el texto solo, como siempre, o —si el diario trae fotos— el texto y detrás cada
    /// foto con su rótulo delante, para que el modelo sepa de qué momento es cada una.
    /// </summary>
    private static JsonNode Entrada(string texto, IReadOnlyList<DiarioDeLaSesion.FotoDelDiario>? fotos)
    {
        if (fotos == null || fotos.Count == 0) return JsonValue.Create(texto)!;
        var partes = new JsonArray { new JsonObject { ["type"] = "input_text", ["text"] = texto } };
        foreach (var foto in fotos)
        {
            partes.Add(new JsonObject { ["type"] = "input_text", ["text"] = foto.Rotulo });
            // DETALLE ALTO: las fotos están para leer el nombre de un botón o de un campo, y en bajo no se lee.
            partes.Add(new JsonObject { ["type"] = "input_image", ["image_url"] = "data:image/jpeg;base64," + Convert.ToBase64String(foto.Jpeg), ["detail"] = "high" });
        }
        return new JsonArray { new JsonObject { ["role"] = "user", ["content"] = partes } };
    }

    /// <summary>
    /// Las operaciones que propone el modelo, leídas de la respuesta de la Responses API. Lanza si la respuesta
    /// no trae una propuesta legible: «no propuso nada» y «no pude leer lo que propuso» no son lo mismo, y con
    /// lo segundo la sesión tiene que seguir pendiente.
    /// </summary>
    internal static IReadOnlyList<Operacion> Leer(string respuesta)
    {
        using var doc = JsonDocument.Parse(respuesta);
        string? texto = null;
        if (doc.RootElement.TryGetProperty("output", out var salida) && salida.ValueKind == JsonValueKind.Array)
            foreach (var item in salida.EnumerateArray())
                if (Cadena(item, "type") == "message" && item.TryGetProperty("content", out var partes) && partes.ValueKind == JsonValueKind.Array)
                    foreach (var parte in partes.EnumerateArray())
                        if (Cadena(parte, "type") == "output_text" && Cadena(parte, "text") is { Length: > 0 } t) texto = t;
        if (string.IsNullOrWhiteSpace(texto))
            throw new InvalidDataException("la respuesta del modelo no trae texto: " + (respuesta.Length <= 300 ? respuesta : respuesta[..300] + "…"));

        using var propuesta = JsonDocument.Parse(texto);
        if (!propuesta.RootElement.TryGetProperty("operaciones", out var ops) || ops.ValueKind != JsonValueKind.Array)
            throw new InvalidDataException("la propuesta del modelo no trae «operaciones»");
        var lista = new List<Operacion>();
        foreach (var o in ops.EnumerateArray())
        {
            var pasos = o.ValueKind == JsonValueKind.Object && o.TryGetProperty("pasos", out var p) && p.ValueKind == JsonValueKind.Array
                ? p.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => (x.GetString() ?? "").Trim()).Where(x => x.Length > 0).ToList()
                : new List<string>();
            lista.Add(new Operacion(Cadena(o, "tipo").Trim().ToLowerInvariant(), Cadena(o, "motivo").Trim().ToLowerInvariant(),
                Cadena(o, "nombre").Trim(), Cadena(o, "cuando").Trim(), pasos, Cadena(o, "texto").Trim(), Cadena(o, "cita").Trim()));
        }
        return lista;
    }

    private static string Cadena(JsonElement o, string campo)
        => o.ValueKind == JsonValueKind.Object && o.TryGetProperty(campo, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";

    /// <summary>Lo que se añade a las reglas cuando quien habla es un médico en su trabajo (778).</summary>
    internal const string ConUnMedicoDelante = """
        QUIEN HABLA ES UN MÉDICO EN SU TRABAJO. Lo que diga de un paciente —su nombre, su edad, su cama, lo que
        tiene, lo que toma— NO es un dato suyo y no entra en nada de lo que propongas: ni en una habilidad, ni en una
        preferencia, ni en una observación. Una habilidad dice CÓMO se hace la tarea («abre la historia, busca por
        documento»), nunca con QUIÉN se hizo. En esta sesión no existe el tipo «dato»: no lo propongas.
        """;

    /// <summary>Las reglas de quien repasa. Lo que decide el caso —qué es habilidad y qué preferencia— es criterio
    /// suyo; lo que no puede decidir —si hay cita, si se repitió— lo comprueba el código.</summary>
    internal const string Instrucciones = """
        Eres la memoria de Ü, un asistente de voz que maneja el ordenador de una persona. Acaba de terminar una
        sesión. Tu trabajo es leer lo que pasó y decidir qué merece quedarse, para que la próxima vez Ü lo haga a
        la manera de esta persona sin que tenga que repetírselo.

        Recibes dos cosas: LO QUE Ü YA SABE (preferencias, habilidades y un cuaderno de observaciones) y EL DIARIO
        DE LA SESIÓN (lo que dijo la PERSONA, lo que dijo Ü, lo que Ü HIZO con sus herramientas y cómo salió, y lo
        que la persona TOCÓ en pantalla).

        La evidencia que más vale es lo que dijo la PERSONA: lo que pidió, lo que corrigió, donde tuvo que parar a
        Ü o repetirle algo. Lo que dijo o hizo Ü solo sirve para entender qué funcionó y qué no. Una transcripción
        de voz trae errores, frases a medias y correcciones: manda lo último que dijo.

        QUÉ PUEDES PROPONER

        1. habilidad — CÓMO SE HACE ALGO: un procedimiento con pasos. Hay tres motivos, y con uno basta:
           · "ensenada": la persona mostró intención de enseñar —«te voy a enseñar a…», «se hace así», «cuando te
             pida X, haz Y», «mira cómo se hace», «apréndete esto»—. Va directo a habilidad, a la primera,
             sin esperar a que se repita.
           · "corregida": la persona corrigió CÓMO se hace una tarea —«no, así no: primero…», «te faltó…»—. Si ya
             hay una habilidad de esa tarea, reconstrúyela ENTERA con la corrección, con el MISMO nombre que tiene.
             Si no la hay y la corrección describe un procedimiento, créala.
           · "repetida": ese procedimiento ya está en el cuaderno de observaciones, de una sesión anterior, y hoy se
             volvió a hacer. Usa el MISMO nombre que tiene en el cuaderno.
           Una habilidad se escribe ENTERA: un nombre corto, como lo diría la persona; cuándo usarla; y todos los
           pasos en orden, uno por elemento, con el nombre exacto de cada botón o campo cuando el diario lo traiga.
           Lo que cambia cada vez se nombra («el destinatario», «el tema») y no se copia.

        2. preferencia — CÓMO QUIERE LAS COSAS: un valor por defecto que vale más allá de una tarea. Cómo quiere
           que le hablen, qué elegir cuando hay duda, qué no hacer nunca. Con que lo diga una vez, claro, basta.
           Guárdala corta y con sus palabras.

        3. dato — algo sobre la persona que conviene saber: a qué se dedica, con qué herramientas trabaja, cómo
           se llama. Solo si lo dijo ella. Escríbelo en tercera persona, en una frase limpia.

        4. observacion — un procedimiento de dos o más pasos que hoy se hizo y salió bien, sin que la persona lo
           enseñara ni lo corrigiera. Todavía no es una habilidad: va al cuaderno, por si se repite. Proponla
           SIEMPRE que la persona pidió una tarea y Ü la hizo en dos o más pasos sin fallar: el cuaderno es lo
           único que permite reconocer después que algo se repitió. La cita es la frase con que la pidió.

        5. olvidar — la persona dijo que algo guardado ya no vale, o pidió dejar de hacer algo. Pon en «texto» la
           preferencia tal como está guardada, o en «nombre» la habilidad.

        CÓMO DECIDIR

        · ¿Son pasos, un orden, una forma de hacer una tarea? Es habilidad u observación. ¿Es una manera de ser o
          un valor por defecto? Es preferencia.
        · La intención de enseñar manda sobre todo lo demás.
        · Una corrección sobre el estilo —«más corto», «no me preguntes tanto»— es preferencia; sobre los pasos de
          una tarea, habilidad.
        · Lo que solo sirve para hoy —un archivo concreto, un número de esta tarea— no se guarda.
        · No repitas lo que ya está guardado igual. Si mejora algo guardado, reconstrúyelo con su mismo nombre.
        · Una preferencia que solo está entre los DATOS ya guardados se propone igual, como preferencia: es en
          PREFERENCIAS donde se cumple, y un dato no le llega a quien habla.
        · Si la sesión no enseñó nada y no hubo ninguna tarea de varios pasos que apuntar, devuelve la lista vacía.
          En una sesión corta es lo normal, y es mejor que inventar.

        LAS FOTOS

        Algunas líneas del diario terminan en «[FOTO n]», y detrás del diario viene esa FOTO: la pantalla de ese
        momento, con el cursor dibujado donde la persona pulsó o donde estaba cuando a Ü algo no le salió. Úsalas
        para escribir bien los pasos: el nombre exacto del botón, del campo o de la ventana que se ve bajo el
        cursor, sobre todo cuando la línea dice que lo pulsado no tiene nombre. Una foto enseña QUÉ se tocó; no
        prueba que la persona quisiera enseñarlo. Lo que decide qué se guarda sigue siendo lo que ella DIJO.

        LA CITA

        Cada operación lleva «cita»: las palabras EXACTAS de la PERSONA en el diario que la justifican, copiadas
        tal cual, entre 4 y 25 palabras seguidas de una misma frase suya. Nunca cites a Ü. Una operación sin una
        cita literal de la persona se descarta: si no encuentras con qué citarla, no la propongas.
        """;
}
