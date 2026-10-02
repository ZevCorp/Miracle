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
///
///  · EL AUDIO QUE LLEGA ANTES DE session.started SE TIRA, y el que llega después en ráfaga se oye
///    entero. Medido el 2026-09-30: «Manzana. Repite solamente la primera palabra que dije», mandada
///    justo detrás de session.start, no se transcribió y la voz contestó «Repite.»; guardada y
///    mandada de golpe tras session.started —4,8 s de audio en 37 ms—, se transcribió y contestó
///    «Manzana.». Por eso la conversación guarda lo captado hasta la confirmación
///    (<see cref="PreEscucha"/>).
///
///  · CUÁNTO TARDA EN CONFIRMAR depende de lo que lleve session.start (2026-10-01, tres aperturas de
///    cada una): 293–395 ms con la mínima, 586–656 con la delegación entera y sin historia, 849–1.235
///    con la delegación y 11.450 caracteres de historia. Mandar la delegación aparte, detrás, no lo
///    baja: lo que pesa es la historia.
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
    /// ANTES LE ORDENABA CALLAR («mientras se hace el trabajo, calla», promesa 46), y callaba: «Claro.» y 12,5 s
    /// de silencio hasta el resultado (sonda del 2026-10-01); en septiembre, 22 de 54 pedidos de tres o más
    /// acciones sin una frase en medio. Con esta persona y los avances de <see cref="Avance"/>, el mismo pedido:
    /// tres frases durante el trabajo y 3,2 s de silencio como mucho. Con los avances y la persona de antes: cero
    /// frases — hacen falta las dos (spec 073, 61).
    ///
    /// LO QUE NO VUELVE es el «Dame un momento para revisarlo» de la sonda del 2026-09-12, dicho antes de que
    /// nadie hiciera nada: la regla de la 161 sigue aquí con sus palabras («NO ANUNCIES LO QUE VAS A HACER»,
    /// promesa 46), porque las instrucciones de Ü van al delegado y quien suena es la voz. Acompañar no es
    /// anunciar: la voz habla de lo que le llega, en pasado, no de lo que supone.
    ///
    /// Y DICE QUE VE. La de antes decía «tú no ves la pantalla», y el 2026-09-21 la voz lo repitió —«no puedo
    /// ver tu pantalla ni lo que señalas»— sin delegar, con la foto por referencia funcionando (62).
    ///
    /// AQUÍ VIVE LA PERSONALIDAD QUE SE OYE (spec 078 de main, 2026-10-01): cálida, clara y breve, en español de
    /// Colombia, humor ligero solo en la charla. Decía «este ordenador, sobre todo SAP»: le hablaba igual a un
    /// médico de un hospital que a quien ordena sus fotos. Lo que cambia por perfil va aparte, en
    /// <see cref="PersonaExtra"/>.
    ///
    /// LAS DOS SE JUNTARON EL 2026-10-01, al mezclar las ramas, y se volvió a medir: con este texto la voz dijo
    /// 2, 4 y 4 frases durante el trabajo en tres corridas de la sonda, todas en pasado. Mide 1.283 caracteres;
    /// con <see cref="AlVolver"/> y la frase de perfil más larga (300) cabe en 1.700 (promesa 59), que es el
    /// presupuesto de la vuelta.
    /// </remarks>
    public const string InstruccionesDeLaVoz =
        "Eres Ü, el asistente que maneja este computador por la persona. Hablas español de Colombia, cálido, "
        + "claro y breve, como alguien de confianza: una o dos frases (si te piden leer algo, entero), sin frases "
        + "de máquina («¡Claro!», «¿algo más?»). Si te conversan, conversas con gusto y humor ligero. Tú hablas; "
        + "tus manos y tus ojos son tu equipo: mirar, buscar, abrir, escribir, operar, recordar o aprender algo, "
        + "lo DELEGAS."
        + "\nPRIMERO SE EJECUTA: si te piden algo, delega ya, antes de comentar. NO ANUNCIES LO QUE VAS A HACER: "
        + "nada de «voy a…», «vamos a…», «dame un momento»."
        + "\nMIENTRAS SE TRABAJA te llegan avances: cuenta en una frase corta lo que aporte. HABLA EN PASADO, de "
        + "lo que YA pasó y con sus datos («quedó abierta Descargas: 34 archivos»); nunca digas que algo está "
        + "hecho si no te ha llegado, ni inventes lo que hay en pantalla ni la hora."
        + "\nSÍ VES LA PANTALLA, por tu equipo: si preguntan qué hay o qué señalan, delégalo; nunca digas que no "
        + "puedes ver."
        + "\nSi te hablan encima o dicen «espera», calla y escucha; si corrigen o cancelan, delégalo ya."
        + "\nSI LA PERSONA QUIERE QUE DEJES DE HABLAR, DEJES DE ESCUCHARLA O APAGUES LA VOZ, DELEGA ESA PETICIÓN "
        + "INMEDIATAMENTE: no respondas «me callo», solo tu equipo apaga el micrófono. Cuando confirme que la "
        + "apagó, di únicamente «Mmm.» y nada más.";

    /// <summary>
    /// LO QUE LA VOZ SABE DE CON QUIÉN HABLA: una frase que va pegada detrás de
    /// <see cref="InstruccionesDeLaVoz"/> («Le hablas a un médico…», «Le hablas a una persona…»), o nada.
    /// La pone la conversación según el perfil (spec 078). Propiedad y no parámetro del constructor: la
    /// promesa 208 construye este protocolo con dos parámetros, y el perfil puede cambiar con la voz creada.
    /// </summary>
    public string PersonaExtra
    {
        get => _personaExtra;
        set => _personaExtra = value ?? "";
    }

    private string _personaExtra = "";

    /// <summary>La persona entera de la voz: la base y, detrás, la frase de su perfil. Es lo que abre la sesión y lo que vuelve.</summary>
    public string Persona => InstruccionesDeLaVoz + PersonaExtra;

    /// <summary>
    /// EL APPEND MÁS LARGO QUE SE SABE QUE PASA: 1.756 caracteres, el del aprendiz con su prefijo, aceptado el
    /// 2026-09-12; el mismo texto repetido hasta 1.900 se rechazó («Context append text must not exceed 500
    /// tokens.»). Ningún append sale de aquí más largo (promesa 57 de la voz): uno rechazado deja la sesión viva y
    /// a la voz con las reglas que tenía, y solo una línea en el log lo cuenta.
    /// </summary>
    public const int TopeDelAppend = 1_756;

    /// <summary>
    /// LO QUE SE COMPONE AQUÍ —un avance del trabajo, las preferencias de la persona— DEJA MARGEN bajo
    /// <see cref="TopeDelAppend"/>: el servidor mide en fichas y aquí se cuentan caracteres, y un texto con más
    /// tildes o símbolos que el medido gasta más fichas por carácter. Lo que pasa de aquí se recorta diciéndolo.
    /// </summary>
    public const int TopeDeUnAppend = 1_700;

    /// <summary>
    /// LA PERSONA CON LA QUE ABRE LA VOZ en la próxima sesión. Null o vacío, la de siempre
    /// (<see cref="InstruccionesDeLaVoz"/>).
    /// </summary>
    /// <remarks>
    /// EXISTE POR EL PRIMER ENCUENTRO (spec 080, promesa 765 del grafo). La voz decide sola cuándo le pasa
    /// el trabajo al delegado, y con la persona de siempre —«ayudas a operar las aplicaciones»— a quien
    /// acaba de instalar y solo dice su nombre no se lo pasa nunca: medido el 2026-10-01 con audio, 0
    /// delegaciones en 5 frases; con una persona que dice «delega todo lo que la persona diga», 5 de 5.
    ///
    /// SOLO AL ABRIR. La sesión es inmutable salvo la delegación (ver arriba): cambiarla a mitad no cambia
    /// a quien ya está sonando. Vacío no es una persona (patrón nº9).
    /// </remarks>
    public string? PersonaDeLaVoz { get; set; }

    private string PersonaDeAhora => string.IsNullOrWhiteSpace(PersonaDeLaVoz) ? Persona : PersonaDeLaVoz!;

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
    /// SÍ: A LOS 30 SEGUNDOS. Medido el 2026-10-01 con la frase escrita y sin un solo trozo de audio:
    /// «session.closed: expired» a los 30.975 ms, con el delegado trabajando. Con silencio por el caño, 47 s y el
    /// trabajo terminado. Promesa 71.
    /// </summary>
    public bool CaducaSinAudio => true;

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
    /// quita con U_DELEGADO_PRISA=0 y se vuelve a Sol con U_DELEGADO=gpt-6.1-sol, sin recompilar (promesa 756).
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
                instructions = PersonaDeAhora,
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
                instructions = PersonaDeAhora,
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
    ///
    /// Y LO QUE NO CABE EN UN APPEND NO ES UN MODO (spec 078, promesa 57 de la voz): unas instrucciones que con
    /// el prefijo pasan de <see cref="TopeDelAppend"/> son las de operar —las de siempre con la memoria, que ya
    /// no son idénticas a las de la apertura—, y a la voz se le devuelve su persona. Hasta el 2026-10-01 se le
    /// mandaban enteras, 25.000 caracteres, el servidor las rechazaba y la voz se quedaba con las reglas del
    /// aprendiz el resto de la sesión. Volver de verdad es <see cref="VueltaDeModo"/>.
    /// </remarks>
    public IEnumerable<string> CambioDeModo(string instrucciones, IReadOnlyList<Utensilio> utensilios, bool soloCuandoSeLePide)
    {
        yield return JsonSerializer.Serialize(new
        {
            type = "session.update",
            session = new { delegation = Delegacion(instrucciones, utensilios) },
        });

        string reglas = AlCambiarDeModo + (instrucciones ?? "");
        bool vuelve = (_instruccionesDeApertura.Length > 0 && instrucciones == _instruccionesDeApertura)
                      || reglas.Length > TopeDelAppend;
        yield return JsonSerializer.Serialize(new
        {
            type = "session.instructions.append",
            delegation_id = (string?)null,
            content = vuelve ? PersonaDeVuelta() : reglas,
        });
    }

    /// <summary>
    /// VOLVER AL MODO DE SIEMPRE (D2 de la spec 078, promesa 56 de la voz): la delegación con las instrucciones
    /// que se le den, ÍNTEGRAS, y a la voz su persona detrás de <see cref="AlVolver"/>. Sin comparar con las de la
    /// apertura: al volver, las de siempre llevan la memoria y el hilo de ahora, y casi nunca son idénticas.
    /// </summary>
    public IEnumerable<string> VueltaDeModo(string instrucciones, IReadOnlyList<Utensilio> utensilios)
    {
        yield return JsonSerializer.Serialize(new
        {
            type = "session.update",
            session = new { delegation = Delegacion(instrucciones, utensilios) },
        });
        yield return JsonSerializer.Serialize(new
        {
            type = "session.instructions.append",
            delegation_id = (string?)null,
            content = PersonaDeVuelta(),
        });
    }

    /// <summary>La persona detrás del prefijo de la vuelta; si la frase del perfil la hiciera pasar del tope, la base sola.</summary>
    private string PersonaDeVuelta()
    {
        string conPerfil = AlVolver + Persona;
        return conPerfil.Length <= TopeDelAppend ? conPerfil : AlVolver + InstruccionesDeLaVoz;
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

    /// <summary>
    /// LA FOTO INCRUSTADA NO EXISTE EN GPT-LIVE (spec 079). Aquí había un mensaje con la imagen dentro, en data URL,
    /// y nunca cupo ninguna: 118.000 bytes en un buzón de 32.768 (response_input_buffer_full, 2026-09-12). Desde la
    /// 027 la foto entra por referencia (<see cref="FotogramaPorReferencia"/>) y esto no lo llamaba nadie. Vacío:
    /// quien llame no manda algo que deja la sesión sin poder contestar.
    /// </summary>
    public string Fotograma(byte[] jpeg) => "";

    /// <summary>
    /// LA PANTALLA DEL PEDIDO (spec 079, promesa 69): un solo mensaje con el texto delante y la foto detrás.
    /// </summary>
    /// <remarks>
    /// Medido el 2026-10-01 con la sonda: metida en la conversación ANTES de que la persona hable, la foto le
    /// llega al delegado —contestó «7421», que solo estaba en ella—; «pulsa el botón verde de abajo» salió en una
    /// vuelta de 0,86 s como `pulsa: Radicar`; la voz se quedó callada al recibirla y contestó «hola» sin delegar.
    /// El texto va en el mismo mensaje para que nadie lo tome por algo que dijo la persona, y dice dónde está
    /// según el mapa. No pide turno: acompaña al pedido que viene detrás.
    /// </remarks>
    public string PantallaAlPedir(string idDelArchivo, string donde)
    {
        if (string.IsNullOrWhiteSpace(idDelArchivo)) return "";
        // CON LAS PALABRAS DE LA HERRAMIENTA. Con «según el mapa» a secas, quien actúa preguntó igual dónde estaba y
        // volvió a mirar: 3 vueltas y 7,5 s para leer «144» (Ü de pruebas, 2026-10-01). Sus instrucciones dicen que
        // una foto nunca decide dónde se está y que eso solo lo dice map_where_am_i: se le da su respuesta, nombrada.
        string lugar = string.IsNullOrWhiteSpace(donde) ? ""
            : $" Dónde está la persona ya está comprobado: map_where_am_i contesta ahora mismo «{donde.Trim()}». No hace falta volver a preguntarlo.";
        return JsonSerializer.Serialize(new
        {
            type = "response.item.create",
            item = new
            {
                type = "message",
                role = "user",
                content = new object[]
                {
                    // PARA QUIÉN ES (promesa 73). La conversación la lee también quien habla: el 2026-10-01, con música en
                    // la pantalla de la persona, la voz contestó a «abre la Configuración…» con «¿Te pongo otra canción de
                    // las que tienes por acá?». Sin foto, la misma voz dijo «Sí.» y nada más (sonda, dos corridas).
                    new { type = "input_text", text = MarcaDeLaPantalla + " Foto de la pantalla en el momento de pedirlo, con el cursor dibujado donde apuntaba. "
                        + ParaQuienEsLaPantalla + lugar },
                    new { type = "input_image", file_id = idDelArchivo.Trim(), detail = "high" },
                },
            },
        });
    }

    /// <summary>
    /// LA META EN CURSO, PARA QUIEN ACTÚA (spec 082, promesa 72): un mensaje de usuario con el texto, sin pedir turno.
    /// Es el mismo camino por el que viaja la pantalla del pedido (69), que está medido: lo que se mete en la
    /// conversación antes del pedido le llega al delegado, y la voz no lo dice.
    /// </summary>
    public string ContextoParaQuienActua(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return "";
        return JsonSerializer.Serialize(new
        {
            type = "response.item.create",
            item = new { type = "message", role = "user", content = new object[] { new { type = "input_text", text = texto.Trim() } } },
        });
    }

    /// <summary>Con qué empieza el texto que acompaña a la pantalla del pedido. Las instrucciones del delegado la nombran.</summary>
    public const string MarcaDeLaPantalla = "[PANTALLA: esto no lo dijo la persona]";

    /// <summary>Lo que la foto del pedido dice de sí misma a quien la lea (promesa 73 de la voz).</summary>
    public const string ParaQuienEsLaPantalla = "ES PARA QUIEN ACTÚA: quien habla no la comenta ni ofrece nada por lo que se ve en ella; contesta solo a lo que la persona pida.";

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

    /// <summary>
    /// LO QUE LA PERSONA PREFIERE, PARA QUIEN HABLA: <c>session.instructions.append</c> (spec 074, promesa 68).
    /// </summary>
    /// <remarks>
    /// La persona de la voz es fija y lo aprendido viaja en las instrucciones del delegado, que no habla:
    /// «háblame más corto» se guardaba y nadie lo cumplía. Va como instrucción y no como avance —un avance
    /// es algo que pasó, esto es cómo hablar—, por el mismo evento con que ya se le cambia el modo.
    /// NUNCA PASA DEL TOPE: un append de más de 500 fichas se rechaza y la sesión sigue viva, con solo una
    /// línea en el log (ver <see cref="TopeDeUnAppend"/>); lo que no cabe se recorta y se dice.
    /// </remarks>
    public string ParaLaVoz(string texto)
    {
        string t = (texto ?? "").Trim();
        if (t.Length == 0) return "";
        const string cola = "\n[recortado: no cabe todo]";
        if (t.Length > TopeDeUnAppend) t = t[..(TopeDeUnAppend - cola.Length)] + cola;
        return JsonSerializer.Serialize(new
        {
            type = "session.instructions.append",
            delegation_id = (string?)null,
            content = t,
        });
    }

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
                        hechos.Add(new Hecho.DiceU(texto, DelDelegado: true));   // lo devuelve quien actúa: la voz lo dirá después (70)
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
