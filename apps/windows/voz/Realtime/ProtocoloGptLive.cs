using System.Text.Json;

namespace Voz.Realtime;

/// <summary>
/// HABLAR CON GPT-LIVE. Medido contra el servidor de verdad el 2026-09-11 y el 2026-09-12 con la clave
/// de esta máquina — se abrió el socket, se mandó cada evento y se leyó lo que contestó —, no deducido
/// de la documentación.
/// </summary>
/// <remarks>
/// NO ES REALTIME CON OTRO NOMBRE. Las diferencias no dan error: dan «no me responde».
///
///  · SU PROPIA PUERTA. <c>gpt-live-1</c> en /v1/realtime contesta «not supported in realtime mode».
///    Va por /v1/live/sessions, sin ?model=, y se abre con <c>session.start</c>.
///
///  · LA VOZ NO LLEVA HERRAMIENTAS. Las lleva un modelo DELEGADO (<c>gpt-6-luna</c> desde la spec 073)
///    dentro de <c>session.delegation.responses</c>: él mira, llama y decide; la voz conversa y le pasa
///    el trabajo. Por eso las instrucciones de operar van al delegado y la voz lleva una persona corta.
///
///  · LA VOZ NO SE ENTERA SOLA DE LO QUE HACE EL DELEGADO. Lo que él va haciendo no se le cuenta: solo
///    recibe el resultado final. Lo que ocurre entretanto se le manda con <see cref="Avance"/>.
///
///  · LA SESIÓN ES INMUTABLE SALVO LA DELEGACIÓN. <c>session.update</c> con <c>session.instructions</c>
///    contesta «Unknown parameter: 'session.instructions'»; con <c>session.delegation</c> contesta
///    <c>session.updated</c>, y el delegado llamó a la herramienta NUEVA (map_where_am_i, con su
///    argumento nuevo) en la frase siguiente.
///
///  · NO HAY MARCAS DE TURNO. Ni speech_started ni response.done: hablarle encima no produce ningún
///    evento, y <c>response.completed</c> es del DELEGADO — la voz sigue hablando segundos después. No
///    se inventan aquí; se declara <see cref="MarcaLosTurnos"/> y las marca la conversación.
///
///  · NO SABE CALLAR. No hay turn_detection ni create_response:false, y «no hables por tu cuenta» en
///    las instrucciones no se respetó: la voz prestada (promesa 192) no se puede hacer con GPT-Live.
///
///  · NI PASE PARA VOLVER: una caída empieza de cero, y <see cref="SabeVolver"/> lo dice.
/// </remarks>
public sealed class ProtocoloGptLive : IProtocolo
{
    /// <summary>La misma voz que en Realtime: Ü sonando distinto al cambiar de servidor suena a otro.</summary>
    public const string Voz = "marin";

    /// <summary>
    /// LO QUE LLEVA LA VOZ: quién es, que delega, y que conversa mientras su equipo trabaja. Corta a
    /// propósito — la voz no tiene herramientas, y si llevara las instrucciones de operar prometería lo
    /// que no puede hacer ella y contestaría de memoria en vez de delegar.
    /// </summary>
    /// <remarks>
    /// ANTES LE ORDENABA CALLAR («mientras se hace el trabajo, calla», «nunca en futuro», promesa 46), y
    /// callaba: «Claro.» y 12,5 s de silencio hasta el resultado (sonda del 2026-10-01); en septiembre, 22
    /// de 54 pedidos de tres o más acciones sin una frase en medio. Con esta persona y los avances de
    /// <see cref="Avance"/>, el mismo pedido: tres frases durante el trabajo y 3,2 s de silencio como
    /// mucho. Con los avances y la persona de antes: cero frases — hacen falta las dos (spec 073, 61).
    ///
    /// LO QUE NO VUELVE es el «Dame un momento para revisarlo» de la sonda del 2026-09-12, dicho antes de
    /// que nadie hiciera nada: la voz habla de lo que le llega, no de lo que supone.
    ///
    /// Y DICE QUE VE. La de antes decía «tú no ves la pantalla», y el 2026-09-21 la voz lo repitió —«no
    /// puedo ver tu pantalla ni lo que señalas»— sin delegar, con la foto por referencia funcionando (62).
    ///
    /// CABE EN UN APPEND, y tiene que seguir cabiendo: al volver de un modo especial se le manda entera
    /// detrás de <see cref="AlVolver"/> (promesas 47 y 66).
    /// </remarks>
    public const string InstruccionesDeLaVoz =
        "Eres Ü, un asistente de voz que maneja el ordenador de quien te habla. Hablas en español, cercano y "
        + "natural, con frases cortas; conversas de verdad, sin discursos. Tú hablas; tus manos y tus ojos son tu "
        + "equipo de fondo: todo lo que sea mirar la pantalla, buscar, pulsar, escribir, abrir, recordar algo o "
        + "aprender cómo se hace una cosa se lo delegas."
        + "\nPRIMERO SE EJECUTA: cuando te pidan algo, delega en ese mismo momento, antes de comentar; acompáñalo "
        + "si quieres con una frase corta, pero no retrases la acción ni pidas permiso."
        + "\nMIENTRAS SE TRABAJA, ACOMPAÑA: te llegan avances del trabajo en curso. Cuenta en una frase corta lo "
        + "que aporte y contesta lo que te pregunten con lo que sabes por ellos. Habla de lo que YA pasó; nunca "
        + "digas que algo está hecho si no te ha llegado, ni adivines lo que hay en pantalla."
        + "\nSÍ VES LA PANTALLA, a través de tu equipo: si te piden mirar o preguntan qué hay o qué señalan, "
        + "delégalo; nunca digas que no puedes ver."
        + "\nSi te hablan encima, calla y escucha: lo nuevo manda, y si corrigen el pedido lo delegas otra vez. No "
        + "delegues para saludar, charlar o contestar lo que ya sabes."
        + "\nSI LA PERSONA QUIERE QUE DEJES DE HABLAR, DEJES DE ESCUCHARLA O APAGUES LA VOZ, DELEGA ESA PETICIÓN "
        + "INMEDIATAMENTE: la intención manda. No respondas «me callo»; solo tu equipo puede apagar el micrófono. "
        + "Cuando te confirme que apagó la voz, di únicamente «Mmm.» y nada más.";

    /// <summary>
    /// CUÁNTO CABE EN UN APPEND, en caracteres. El servidor lo mide en fichas —«Context append text must not
    /// exceed 500 tokens.»— y aquí no hay tokenizador: medido el 2026-09-12, un append de 1.756 caracteres
    /// pasó y el mismo texto repetido hasta 1.900 se rechazó. Rechazado no da error en la conversación: la
    /// voz se queda sin saber, o en el modo del que no volvió.
    /// </summary>
    public const int TopeDeUnAppend = 1_700;

    /// <summary>Desde cuántos caracteres un append se rechazó seguro (medido: 1.900). Entre los dos no se midió.</summary>
    internal const int RechazadoDesde = 1_900;

    public string Quien => "OpenAI GPT-Live";
    public string Modelo { get; }

    /// <summary>El modelo que lleva las herramientas. Clavado, como la voz: un alias se mueve solo.</summary>
    public string Delegado { get; }

    public int RitmoDeEntrada => 24000;
    public int RitmoDeSalida => 24000;

    /// <summary>
    /// SÍ MIRA, desde la spec 027. Lo que no cabe es la imagen metida dentro del mensaje —una captura pesa
    /// 118.000 bytes codificada y el buzón de la sesión admite 32.768 (medido el 2026-09-12:
    /// response_input_buffer_full)—; por referencia entra, y está medido contra el servidor real.
    /// </summary>
    public bool Mira => true;

    /// <summary>Con GPT-Live quien actúa es el delegado y quien habla es la voz: son dos modelos.</summary>
    public bool ActuaUnDelegado => true;
    public bool SabeVolver => false;

    /// <summary>
    /// SÍ: session.started. Hasta que llega, la sesión no está abierta, y un error antes de él es que no
    /// abrió: sin crédito, el servidor contestó credit_balance_exhausted en vez de session.started y a los
    /// ~2,0 s abortó el socket (medido el 2026-09-12, dos veces); con unas instrucciones de más de 16.384
    /// fichas, lo mismo. Promesa 49.
    /// </summary>
    public bool ConfirmaQueAbrio => true;
    public bool MarcaLosTurnos => false;
    public bool SabeEsperarTurno => false;

    /// <remarks>
    /// EL DELEGADO ES gpt-6-luna, PENSANDO EN MEDIO Y CON PRISA (spec 073, promesa 60). «Pasemos a luna 6» y
    /// «la velocidad es extremadamente importante para nosotros» (el dueño, 2026-09-30 y 2026-10-01). Medido
    /// el 2026-10-01 con la sonda de la voz, con las instrucciones y las 28 herramientas de la app, seis
    /// corridas por combinación — el primer plan, de mediana:
    ///
    ///     gpt-6.1-sol  low                3.191 ms     (lo que había: Sol entró el 2026-09-30 sin medir en vivo)
    ///     gpt-6-luna   low                1.250 ms
    ///     gpt-6-luna   medium             1.380 ms
    ///     gpt-6-luna   low  + priority      924 ms
    ///     gpt-6-luna   medium + priority    848 ms     ← lo que queda por defecto
    ///
    /// Y SOBRE LA Ü DE VERDAD, seis pedidos por combinación sobre el mismo binario (calculadora, Configuración,
    /// Descargas): Luna en low acertó 4 de 6 —no supo sacar una raíz ni listar los dispositivos—; en medium,
    /// 16 de 18 en tres pasadas; Sol en low, 6 de 6. En lo sencillo Luna contesta en 2–6 s y Sol en 6–9 s; en
    /// lo que hay que explorar (la RAM en Configuración) Luna da más vueltas: 12–20 s contra 11 s.
    ///
    /// LO QUE CUESTA. Con priority Luna vale el doble que sin ella y sigue costando la décima parte que Sol sin
    /// priority. El 2026-09-29 el dueño quitó priority por su precio, con Sol; con Luna la cuenta es otra. Se
    /// quita con U_DELEGADO_PRISA=0 y se vuelve a Sol con U_DELEGADO=gpt-6.1-sol, sin recompilar (promesa 686).
    /// </remarks>
    /// <param name="conPrioridad">Pide <c>service_tier: priority</c> para el delegado (promesa 67).</param>
    /// <param name="esfuerzo">Cuánto piensa el delegado antes de actuar (<c>reasoning.effort</c>).</param>
    public ProtocoloGptLive(string modelo = "gpt-live-1", string delegado = "gpt-6-luna", bool conPrioridad = true, string esfuerzo = EsfuerzoPorDefecto)
    {
        Modelo = modelo;
        Delegado = delegado;
        ConPrioridad = conPrioridad;
        Esfuerzo = string.IsNullOrWhiteSpace(esfuerzo) ? EsfuerzoPorDefecto : esfuerzo.Trim();
    }

    private const string EsfuerzoPorDefecto = "medium";

    /// <summary>
    /// CUÁNTO PIENSA EL DELEGADO: en medio. La 518 pedía «low» porque gpt-5.6-luna, sin pedirlo, pensaba 2 s por
    /// respuesta; con gpt-6-luna la diferencia son 130 ms (1.250 contra 1.380) y los aciertos pasan de 4 de 6 a
    /// 16 de 18. «none» da 910 ms sin pagar priority, y falló lo mismo que «low».
    /// </summary>
    public string Esfuerzo { get; }

    /// <summary>Si el delegado piensa con prisa pagada. Va en la delegación ENTERA, también al cambiar de modo.</summary>
    public bool ConPrioridad { get; }

    public Uri Direccion() => new("wss://api.openai.com/v1/live/sessions");

    /// <summary>La clave va en la cabecera, NO en la URL: una URL acaba en los logs.</summary>
    public IReadOnlyDictionary<string, string> Cabeceras(string clave)
        => new Dictionary<string, string> { ["Authorization"] = "Bearer " + clave };

    public IEnumerable<string> Apertura(string instrucciones, IReadOnlyList<Utensilio> utensilios, string pase)
        => Apertura(instrucciones, utensilios, pase, soloCuandoSeLePide: false);

    /// <summary>
    /// Las instrucciones con las que se ABRIÓ la sesión: volver a ellas es volver a la persona de
    /// siempre, y eso a la voz se le dice con su persona, no con las instrucciones de operar (promesa 47).
    /// </summary>
    private string _instruccionesDeApertura = "";

    /// <summary>
    /// Lo que va delante de las reglas que se le añaden a la voz. SON LOS TEXTOS MEDIDOS, letra por letra,
    /// el 2026-09-12: con estos dos, 3 de 3 asintió en modo aprendiz y 2 de 2 volvió a delegar al volver.
    /// Cambiarlos es volver a medir, y la 47 los compara letra por letra desde el 2026-09-13.
    /// </summary>
    /// <remarks>
    /// LO QUE CAMBIA LA VOZ SON LAS REGLAS, NO EL PREFIJO (2026-09-13, con la persona de hoy): sin
    /// AlCambiarDeModo también asintió 3 de 3, y con AlCambiarDeModo en lugar de AlVolver también volvió a
    /// delegar 2 de 2. Se quedan porque todo lo demás se midió con ellos, y porque ocupan parte del tope de abajo.
    ///
    /// Y EL TOPE ESTÁ CERCA: un append de más de 500 fichas se rechaza («Context append text must not exceed
    /// 500 tokens.»; la sesión sigue viva). El del aprendiz, con este prefijo, se aceptó con 1.756
    /// caracteres; el mismo texto repetido hasta 1.900 se rechazó. Le quedan menos de 150 caracteres a
    /// ModoAprendiz antes de que la voz deje de cambiar de persona, con solo una línea «el servidor dice» en
    /// el log. Un prefijo más corto daba margen y no se midió: el servidor se quedó sin crédito.
    /// </remarks>
    internal const string AlCambiarDeModo = "CAMBIO DE MODO. Desde ahora mandan estas reglas sobre cuándo y cómo hablas, por encima de las anteriores:\n";
    internal const string AlVolver = "VUELVES A TU MODO DE SIEMPRE. Lo anterior sobre el modo especial ya no manda; desde ahora mandan estas reglas:\n";

    public IEnumerable<string> Apertura(string instrucciones, IReadOnlyList<Utensilio> utensilios, string pase, bool soloCuandoSeLePide)
    {
        // El pase y el «solo cuando se le pide» se ignoran porque aquí no existen. No se disimula:
        // SabeVolver y SabeEsperarTurno ya lo dicen, y quien llama decide qué contar.
        _instruccionesDeApertura = instrucciones ?? "";
        yield return JsonSerializer.Serialize(new
        {
            type = "session.start",
            session = new
            {
                model = Modelo,
                instructions = InstruccionesDeLaVoz,
                audio = new
                {
                    format = new { type = "audio/pcm", rate = RitmoDeEntrada },
                    output = new { voice = Voz },
                },
                delegation = Delegacion(instrucciones, utensilios),
            },
        });
    }

    public IEnumerable<string> Apertura(string instrucciones, IReadOnlyList<Utensilio> utensilios, string pase,
        IReadOnlyList<(string Role, string Text)> historial, bool soloCuandoSeLePide)
    {
        _instruccionesDeApertura = instrucciones ?? "";
        var input = historial
            .Where(x => !string.IsNullOrWhiteSpace(x.Text))
            .Select(x => new
            {
                type = "message",
                role = x.Role.Equals("usuario", StringComparison.OrdinalIgnoreCase) ? "user" : "assistant",
                content = new[]
                {
                    new
                    {
                        type = x.Role.Equals("usuario", StringComparison.OrdinalIgnoreCase) ? "input_text" : "output_text",
                        text = x.Text.Trim(),
                    },
                },
            })
            .ToArray();
        yield return JsonSerializer.Serialize(new
        {
            type = "session.start",
            session = new
            {
                model = Modelo,
                input,
                instructions = InstruccionesDeLaVoz,
                audio = new
                {
                    format = new { type = "audio/pcm", rate = RitmoDeEntrada },
                    output = new { voice = Voz },
                },
                delegation = Delegacion(instrucciones, utensilios),
            },
        });
    }

    /// <summary>
    /// UN session.update CON LA DELEGACIÓN ENTERA, y detrás UN session.instructions.append A LA VOZ. La
    /// delegación es lo único que el servidor deja reemplazar a mitad de sesión; mandar otro session.start
    /// no cambiaría de modo, abriría otra conversación.
    /// </summary>
    /// <remarks>
    /// SIN EL APPEND, CAMBIABA EL QUE ACTÚA Y NO EL QUE HABLA. Medido el 2026-09-12 poniendo el modo aprendiz
    /// y narrando «Ahora escribo NWP1 en el campo de transacción y pulso Enter»: con solo el update, 3 de 3
    /// la voz afirmó lo que nadie hizo («Listo, ejecuté VP1 en el campo de transacción»); con el append de
    /// las reglas del aprendiz, 3 de 3 asintió con una palabra. Al volver al modo con el que abrió se le da
    /// su persona, no las instrucciones de operar: no las lleva (promesa 40) y no caben — un append de más
    /// de 500 fichas se rechaza. Promesa 47.
    /// </remarks>
    public IEnumerable<string> CambioDeModo(string instrucciones, IReadOnlyList<Utensilio> utensilios, bool soloCuandoSeLePide)
    {
        yield return JsonSerializer.Serialize(new
        {
            type = "session.update",
            session = new { delegation = Delegacion(instrucciones, utensilios) },
        });

        // Y LO QUE NO CABE EN UN APPEND TAMPOCO ES PARA LA VOZ (promesa 66). Unas instrucciones de operar que no
        // sean letra por letra las de apertura —el decisor cambió, la memoria creció— salían aquí como «CAMBIO
        // DE MODO» más 25.000 caracteres: el servidor rechaza el append y la voz se queda en el modo anterior,
        // con solo una línea «el servidor dice» en el log. Los modos especiales son cortos; lo largo es operar.
        bool vuelve = (_instruccionesDeApertura.Length > 0 && instrucciones == _instruccionesDeApertura)
                   || (AlCambiarDeModo + instrucciones).Length >= RechazadoDesde;
        yield return JsonSerializer.Serialize(new
        {
            type = "session.instructions.append",
            delegation_id = (string?)null,
            content = vuelve ? AlVolver + InstruccionesDeLaVoz : AlCambiarDeModo + instrucciones,
        });
    }

    private object Delegacion(string instrucciones, IReadOnlyList<Utensilio> utensilios)
    {
        // UN DICCIONARIO, para que service_tier NO VIAJE cuando no se pide: mandarlo vacío o nulo no es lo mismo
        // que no mandarlo, y sin él el servidor pone el suyo.
        var responses = new Dictionary<string, object>
        {
            ["model"] = Delegado,
            ["instructions"] = instrucciones,
            ["tools"] = ProtocoloOpenAI.ComoFunciones(utensilios),
            ["tool_choice"] = "auto",
            // El servidor acepta reasoning.effort en la delegación (medido con session.started el 2026-09-28). Un valor
            // que el modelo no admite NO impide abrir: la sesión abre, el servidor contesta «Unsupported value» y el
            // delegado no hace nada (gpt-6.1-sol con «none», 2026-10-01).
            ["reasoning"] = new { effort = Esfuerzo },
        };
        // LA PRISA (promesa 67). El 2026-09-29 priority bajaba el primer plan de Sol de 3.546 a 1.874 ms y el dueño
        // la quitó: «el costo nos puede salir muy caro». Con gpt-6-luna baja de 1.380 a 848 ms costando la décima
        // parte que Sol sin ella, y viene puesta; se quita con U_DELEGADO_PRISA=0.
        if (ConPrioridad) responses["service_tier"] = "priority";
        return new { type = "responses", responses };
    }

    public string Audio(byte[] pcm) => JsonSerializer.Serialize(new
    {
        type = "session.input_audio.append",
        audio = Convert.ToBase64String(pcm),
    });

    public string Fotograma(byte[] jpeg) => MensajeDelUsuario(new
    {
        type = "input_image",
        image_url = "data:image/jpeg;base64," + Convert.ToBase64String(jpeg),
    });

    /// <summary>
    /// LA FOTO POR REFERENCIA (promesa 54, spec 027): entra el identificador, no la imagen.
    /// </summary>
    /// <remarks>
    /// Aquí estaba la ceguera. El buzón admite «128 items and 32768 UTF-8 bytes» para la sesión entera
    /// y una captura pesa 118.000 codificada, así que la forma de arriba no cabía NUNCA: ni la primera.
    /// El campo se llama image_url y acepta una referencia, y eso cambia el problema entero — medido
    /// contra el servidor el 2026-09-16, con tres imágenes seguidas en la misma sesión descritas
    /// correctamente («un cachorro negro sobre un suelo de madera», «un pug envuelto en una manta»,
    /// «un paisaje montañoso con un río») y una cuarta por file_id.
    ///
    /// Se usa el identificador de la API de archivos y no una URL pública porque así la captura va SOLO
    /// a OpenAI, que es donde ya iba, sin publicarla en ninguna dirección abierta de internet.
    /// </remarks>
    /// <remarks>
    /// EL DETALLE VA DECLARADO (promesa 55, spec 027). Mandar la foto a resolución de pantalla no sirve de
    /// nada si el mensaje no dice con qué detalle hay que mirarla: por defecto el servidor decide, y con
    /// «low» la reduce a 512 al otro lado —el trabajo de subirla entera, tirado—. «high» es el nivel que
    /// la documentación de OpenAI pide para OCR, objetos pequeños y computer use, y su presupuesto de
    /// 2.500 parches deja pasar una pantalla de 1080p SIN tocarla, que es justo lo que se quiere.
    /// </remarks>
    public string FotogramaPorReferencia(string idDelArchivo) => string.IsNullOrWhiteSpace(idDelArchivo)
        ? ""
        : MensajeDelUsuario(new { type = "input_image", file_id = idDelArchivo, detail = "high" });

    public bool VePorReferencia => true;

    /// <summary>
    /// Una frase escrita. NO pide turno: sin un response.create detrás el servidor la acepta y no
    /// contesta (medido); pedirlo es <see cref="PedirRespuesta"/>, aparte, como en Realtime.
    /// </summary>
    public string Texto(string texto) => MensajeDelUsuario(new { type = "input_text", text = texto });

    private static string MensajeDelUsuario(object contenido) => JsonSerializer.Serialize(new
    {
        type = "response.item.create",
        item = new { type = "message", role = "user", content = new[] { contenido } },
    });

    /// <summary>
    /// CUÁNTO CABE EN UN RESULTADO: 32.768 bytes UTF-8, contados sobre el MENSAJE que viaja. Un resultado de
    /// 40 KB (un mensaje de 41.084 B) contestó response_input_buffer_full y, en el mismo milisegundo,
    /// function_call_outputs_required: la llamada quedó pendiente y cada response.create de la sesión falló,
    /// con la voz hablando y el delegado ya sin hacer nada (2026-09-12). Ocho de 17.741 B pasaron en la misma
    /// sesión. Que pase uno de 32.768 B exactos no se midió: el servidor se quedó sin crédito.
    /// </summary>
    /// <remarks>
    /// Se cuenta el mensaje y no el texto porque el serializador escribe «á» como un escape de 6 bytes y un emoji
    /// como 12, y no se midió si el servidor cuenta lo que viaja o lo que decodifica. Contar lo que viaja
    /// cumple las dos lecturas.
    /// </remarks>
    internal const int TopeDeUnResultado = 32_768;

    public IEnumerable<string> Resultados(IReadOnlyList<(string Id, string Nombre, string Resultado)> hechas)
    {
        foreach (var (id, _, resultado) in hechas)
            yield return Recortado(id, resultado ?? "");
    }

    private static string SalidaDeLaLlamada(string id, string salida) => JsonSerializer.Serialize(new
    {
        type = "response.item.create",
        item = new { type = "function_call_output", call_id = id, output = salida },
    });

    /// <summary>
    /// El resultado entero si cabe; si no, lo más largo de su principio que quepa, sin partir un carácter, y
    /// una cola que dice cuánto se mandó de cuánto. Recortar y decirlo es lo único que no deja la llamada
    /// pendiente: mandarlo entero la deja sin salida para el servidor, y el delegado lee la cola y sabe que
    /// falta algo (patrón nº10: lo no mandado deja rastro).
    /// </summary>
    private static string Recortado(string id, string resultado)
    {
        string entero = SalidaDeLaLlamada(id, resultado);
        if (System.Text.Encoding.UTF8.GetByteCount(entero) <= TopeDeUnResultado) return entero;

        int total = System.Text.Encoding.UTF8.GetByteCount(resultado);
        // Un emoji son DOS char: cortar entre los dos manda medio carácter, que el serializador cambia por U+FFFD.
        int SinPartir(int n) => n > 0 && char.IsHighSurrogate(resultado[n - 1]) ? n - 1 : n;
        string Con(int n)
        {
            string principio = resultado[..n];
            return SalidaDeLaLlamada(id, principio
                + $"…[recortado: {System.Text.Encoding.UTF8.GetByteCount(principio)} de {total} bytes]");
        }

        // Crece con n (más texto nunca ocupa menos), así que se busca por mitades el n más largo que cabe.
        int bajo = 0, alto = resultado.Length;
        while (bajo < alto)
        {
            int medio = bajo + (alto - bajo + 1) / 2;
            if (System.Text.Encoding.UTF8.GetByteCount(Con(SinPartir(medio))) <= TopeDeUnResultado) bajo = medio;
            else alto = medio - 1;
        }
        return Con(SinPartir(bajo));
    }

    /// <summary>
    /// Sin texto, pedir turno: <c>response.create</c>. Del resultado a la primera voz, 9–72 ms.
    /// </summary>
    /// <remarks>
    /// CON TEXTO, DICTAR: <c>session.commentary.append</c>. Es lo que hizo decir a la voz la frase
    /// literal «X» ante «Di exactamente esto, sin añadir nada: X» (2026-09-12). El response.create con
    /// instrucciones que usa Realtime aquí no existe, y session.instructions.append no provoca respuesta.
    /// </remarks>
    public string PedirRespuesta(string instrucciones = "") =>
        string.IsNullOrWhiteSpace(instrucciones)
            ? JsonSerializer.Serialize(new { type = "response.create" })
            : JsonSerializer.Serialize(new
            {
                type = "session.commentary.append",
                delegation_id = (string?)null,
                content = instrucciones,
            });

    /// <summary>
    /// LO QUE ESTÁ PASANDO, PARA QUE LA VOZ LO SEPA: <c>session.thinking.append</c>, contexto callado.
    /// </summary>
    /// <remarks>
    /// No es un dictado (<see cref="PedirRespuesta"/> con texto): un avance no se dice tal cual, la voz
    /// elige si lo cuenta y cómo. Medido el 2026-10-01 con la delegación por Responses en marcha: el
    /// servidor lo acepta con delegation_id nulo (session.thinking.appended, 16 de 16) y el delegado no se
    /// entera — sigue con su llamada. Con la persona de <see cref="InstruccionesDeLaVoz"/> la voz lo
    /// contó en una frase a los 0,6–0,8 s de recibirlo, y a «¿cómo vas?» contestó «ya vamos por el dos de
    /// cuatro» sin volver a delegar. Promesa 63.
    /// </remarks>
    public string Avance(string texto) => string.IsNullOrWhiteSpace(texto)
        ? ""
        : JsonSerializer.Serialize(new
        {
            type = "session.thinking.append",
            delegation_id = (string?)null,
            content = texto.Trim(),
        });

    public IReadOnlyList<Hecho> Leer(JsonElement m)
    {
        var hechos = new List<Hecho>();

        switch (Cadena(m, "type"))
        {
            // CONTINUO, también en silencio: el servidor manda un delta de 100 ms (4800 B) cada ~100–130 ms
            // aunque la voz calle, y ese silencio son CEROS EXACTOS (medido el 2026-09-12 en tres sesiones:
            // 43/47, 168/172 y 60/64 deltas; los otros cuatro, la cola que se apaga al abrir, picos 45·8·3·2).
            // Hecho.Suena lo encolaba en el altavoz y LiveAudio.Hablando parpadeaba sin que nadie hablara —
            // la mitad del tiempo, medido—, y con él los 6 sitios de ConversacionEnVivo que deciden con
            // Hablando o NivelSalida: la compuerta de eco no se reabría, map_recuerdos cual=2 se rechazaba
            // al azar, SeguirContandoSiQuedan salía antes, Interrumpir, el log de la retirada y la boca.
            // Ni un delta vacío ni uno de silencio son sonido. Sin estado: se decide delta a delta.
            case "session.output_audio.delta":
                if (Cadena(m, "delta") is { Length: > 0 } b64 && Convert.FromBase64String(b64) is var pcm
                    && !EsSilencio(pcm))
                    hechos.Add(new Hecho.Suena(pcm));
                break;

            case "session.output_transcript.delta":
                if (Cadena(m, "delta") is { Length: > 0 } suyo)
                    hechos.Add(new Hecho.DiceU(suyo));
                break;

            case "session.input_transcript.delta":
                if (Cadena(m, "delta") is { Length: > 0 } mio)
                    hechos.Add(new Hecho.DiceElUsuario(mio));
                break;

            // LO QUE HACE EL DELEGADO llega envuelto: response.event con un evento de la Responses API
            // dentro. De todos, solo UNO es una llamada: el item de tipo function_call TERMINADO. La misma
            // llamada llega TRES veces (capturado el 2026-09-12: output_item.added en curso, con call_id y
            // arguments vacío, a 1551 ms; function_call_arguments.done a 1788; output_item.done a 1822), y
            // atender más de una ejecutaría la herramienta dos o tres veces, la primera sin argumentos. Por
            // eso se compara el tipo entero y no un prefijo. response.completed tampoco se atiende: es el
            // fin del trabajo del delegado, no del turno — la voz sigue hablando después.
            case "response.event":
                if (m.TryGetProperty("event", out var ev))
                {
                    if (Cadena(ev, "type") == "response.output_text.done"
                        && Cadena(ev, "text") is { Length: > 0 } texto)
                        hechos.Add(new Hecho.DiceU(texto));
                    else if (Cadena(ev, "type") == "response.output_item.done"
                        && ev.TryGetProperty("item", out var item) && Cadena(item, "type") == "function_call")
                        hechos.Add(new Hecho.Pide(new[] { ProtocoloOpenAI.LaLlamada(item) }));
                }
                break;

            // LA SESIÓN ABRIÓ, dicho por el servidor y no por el socket: conectar y mandar session.start no es
            // abrir. Lo que llegue antes —un error— es que no abrió (promesa 49).
            case "session.started":
                hechos.Add(new Hecho.Abierta());
                break;

            case "error":
                hechos.Add(new Hecho.Falla(m.TryGetProperty("error", out var e) && e.ValueKind == JsonValueKind.Object
                    ? Cadena(e, "message") is { Length: > 0 } msg ? msg : e.GetRawText()
                    : "error sin detalle",
                    ProtocoloOpenAI.CodigoDelError(m)));   // credit_balance_exhausted, invalid_model: la 53
                break;

            // LO QUE DURA, no lo que cuesta en fichas: GPT-Live no manda fichas. Llega cada ~15 s con el
            // ACUMULADO (12.0 y luego 25.0, medido el 2026-09-12). Sin traducirlo, el panel de costos no
            // recibía nada de estas sesiones. Solo un número: un «seconds» vacío o en texto no es cero.
            // session.closed también trae usage, pero llega después de que la conversación reportó al
            // cerrar, y la 41 lo congela como UNA falla: no se traduce allí (promesa 48).
            case "session.usage.updated":
                if (m.TryGetProperty("usage", out var uso) && uso.ValueKind == JsonValueKind.Object
                    && uso.TryGetProperty("seconds", out var seg) && seg.ValueKind == JsonValueKind.Number)
                    hechos.Add(new Hecho.Duracion(seg.GetDouble()));
                break;

            // EL SERVIDOR CERRÓ: se cuenta con su motivo (close_requested, expiración…). Callarlo deja una
            // sesión muerta con el micrófono en rojo y ninguna pista de por qué no contesta.
            case "session.closed":
                hechos.Add(new Hecho.Falla("sesión cerrada: "
                    + (Cadena(m, "reason") is { Length: > 0 } motivo ? motivo : "sin motivo")));
                break;
        }

        return hechos;
    }

    /// <summary>
    /// EL PICO DEL SILENCIO ES CERO, medido y no elegido a ojo (2026-09-12, sonda-silencio-pico.ps1, tres
    /// sesiones): el silencio del servidor son ceros exactos, y DENTRO de una frase de Ü las pausas entre
    /// oraciones bajan a pico 1 (0, 14 y 11 deltas por frase: hasta 1,4 s de pausa). Un umbral de 64 —el
    /// que sugería el pico 45 de la cola al abrir— se comía 11, 27 y 21 deltas de pausa, y Ü diría
    /// «Uno.Dos.Tres.» de corrido. Con cero se pierde a lo sumo el único delta de pausa a cero exacto que
    /// se midió: 1 de 256, 100 ms.
    /// </summary>
    private const int PicoDelSilencio = 0;

    /// <summary>Todas las muestras PCM16 con |valor| ≤ <see cref="PicoDelSilencio"/>. Mira MUESTRAS, no
    /// bytes sueltos: 256 tiene el byte bajo a cero y es sonido.</summary>
    private static bool EsSilencio(byte[] pcm)
    {
        for (int i = 0; i + 1 < pcm.Length; i += 2)
            if (Math.Abs((int)BitConverter.ToInt16(pcm, i)) > PicoDelSilencio) return false;
        return pcm.Length % 2 == 0 || pcm[^1] == 0;
    }

    /// <summary>El campo si es texto; vacío si falta o es de otra forma. Lo que viene de la red se
    /// normaliza aquí y no se le pregunta dos veces.</summary>
    private static string Cadena(JsonElement o, string campo)
        => o.ValueKind == JsonValueKind.Object && o.TryGetProperty(campo, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() ?? ""
            : "";
}
