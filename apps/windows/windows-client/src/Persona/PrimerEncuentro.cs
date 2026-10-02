using U.WindowsClient.Diagnostics;
using Voz.Realtime;

namespace U.WindowsClient.Persona;

/// <summary>Por dónde va el encuentro: hablando, o escribiendo porque la voz no abrió.</summary>
public enum ModoDelEncuentro { PorVoz, PorEscrito }

/// <summary>
/// En qué paso va el encuentro. Uno solo a la vez y siempre en este orden (promesa 763): es lo que la
/// escena enseña arriba, y lo que hace que la persona se sienta llevada y no interrogada.
/// </summary>
public enum PasoDelEncuentro { Nombre, Rol, SobreTi, Cierre }

/// <summary>
/// Una cosa que Ü anotó de la persona, tal como se ve caer en la Memoria (promesa 767).
/// </summary>
/// <param name="Clave">Qué es: «nombre», «rol», «trato», «gusto-0», «recuerdo-1». Estable entre anotaciones.</param>
/// <param name="Fuerte">El nombre y el rol: lo que decide qué se enciende.</param>
public sealed record PiezaDeMemoria(string Clave, string Texto, bool Fuerte);

/// <summary>
/// EL PRIMER ENCUENTRO: Ü se presenta, pregunta el nombre y si es estudiante o médico, escucha qué le
/// gusta, y lo guarda. Es lo único que se le pide a alguien que acaba de instalar.
/// </summary>
/// <remarks>
/// NACE DE UN POPUP (2026-10-01, el dueño: «me aparece una cosa para meter como correo y contraseña,
/// una cosa así como horrible»). Recién instalada, Ü abría una ventana oscura, modal y sin botón de
/// cerrar que pedía nombre y correo, y mientras estaba abierta el resto del arranque no había
/// ocurrido. Después se «presentaba» por voz, pero se marcaba como presentada ANTES de hablar: si la
/// voz no abría en diez segundos, no volvía a intentarlo nunca.
///
/// AQUÍ SE DECIDE CUÁNDO CUENTA COMO HECHO, y es lo que el contrato juzga (promesa 752): cuando hay
/// nombre y hay rol. Ni antes de hablar, ni cuando el modelo dice que terminó. Lo que se va sabiendo
/// se escribe en disco al momento —un cierre a medias no obliga a repetir el nombre—, pero
/// <see cref="Perfil.Conocido"/> solo pasa a cierto en <see cref="Terminar"/>.
///
/// LA VOZ ES LA FORMA, NO EL REQUISITO (promesa 753). Sin red, sin micrófono o sin clave, el mismo
/// encuentro se escribe: dos campos y termina igual. Lo que no puede pasar es que alguien se quede sin
/// poder entrar porque no le funcionó el micrófono.
///
/// ESTA CLASE NO ABRE VENTANAS NI SOCKETS. Recibe lo que el modelo manda por sus dos herramientas y
/// contesta lo que el modelo tiene que hacer después. La escena que se ve es de <c>Ui</c>.
/// </remarks>
public sealed class PrimerEncuentro
{
    public const string HerramientaGuardar = "conocer_guardar";
    public const string HerramientaTerminar = "conocer_terminar";

    private readonly PerfilDeLaPersona _guarda;
    private readonly Func<string, bool>? _recordar;
    private readonly Action<string> _log;
    private readonly List<string> _porRecordar = new();

    /// <param name="guarda">Dónde se escribe el perfil.</param>
    /// <param name="recordar">Cómo se guarda un recuerdo en la memoria personal. Devuelve si quedó.</param>
    /// <param name="log">Dónde contar lo que pasa. Nunca recibe lo que la persona contó: solo qué campos llegaron.</param>
    public PrimerEncuentro(PerfilDeLaPersona guarda, Func<string, bool>? recordar = null, Action<string>? log = null)
        : this(guarda, recordar, log, deNuevo: false) { }

    private PrimerEncuentro(PerfilDeLaPersona guarda, Func<string, bool>? recordar, Action<string>? log, bool deNuevo)
    {
        _guarda = guarda ?? throw new ArgumentNullException(nameof(guarda));
        _recordar = recordar;
        _log = log ?? (_ => { });
        _deNuevo = deNuevo;
        if (deNuevo) { Perfil = new Perfil(); return; }
        // Se sigue desde donde quedó: un encuentro a medias ya trae el nombre.
        Perfil = _guarda.Leer();
        Perfil.Conocido = false;
    }

    /// <summary>
    /// VOLVER A PRESENTARSE (promesa 762): quien se equivocó de rol, o a quien Ü le entendió mal el
    /// nombre, repite el encuentro desde cero.
    /// </summary>
    /// <remarks>
    /// EL PERFIL DE ANTES NO SE TOCA HASTA QUE EL NUEVO TERMINA. El primer encuentro va escribiendo en
    /// disco lo que sabe, sin marcarlo, para no repetir preguntas tras un cierre; aquí eso sería borrar
    /// a alguien que ya se conocía por haber abierto una ventana. Lo que se va anotando vive en memoria,
    /// y dejarlo a medias deja todo como estaba.
    /// </remarks>
    public static PrimerEncuentro DeNuevo(PerfilDeLaPersona guarda, Func<string, bool>? recordar = null, Action<string>? log = null)
        => new(guarda, recordar, log, deNuevo: true);

    private readonly bool _deNuevo;

    /// <summary>Lo que se lleva sabido. Se va llenando con cada <see cref="Guardar"/>.</summary>
    public Perfil Perfil { get; }

    /// <summary>El encuentro terminó, con nombre y con rol.</summary>
    public bool Hecho { get; private set; }

    /// <summary>
    /// Ya se preguntó todo lo que había que preguntar: hay nombre, hay rol, y contestó a la tercera
    /// pregunta. Solo falta despedirse.
    /// </summary>
    /// <remarks>
    /// Es lo que permite que el encuentro NO SE QUEDE COLGADO si la voz se corta justo ahí o el modelo
    /// no llega a llamar a <c>conocer_terminar</c> (pasó el 2026-10-01: el servidor cerró la sesión un
    /// segundo después de la última anotación, y la que volvió se quedó callada). Quien tiene la voz le
    /// da un empujón con <see cref="PieParaCerrar"/> y, si tampoco, lo cierra él con <see cref="Terminar"/>.
    /// Con solo el nombre y el rol no se empuja: la persona puede estar pensando qué contestar.
    /// </remarks>
    public bool ListoParaCerrar => !Hecho && Paso == PasoDelEncuentro.Cierre;

    /// <summary>El paso en que está AHORA: el primero al que le falta su respuesta (promesa 763).</summary>
    public PasoDelEncuentro Paso => PasoDe(Perfil, _contoDeSi);

    /// <summary>
    /// Contestó a «cuéntame de ti» con algo que no es un gusto ni un trato: dónde vive, qué estudia.
    /// </summary>
    /// <remarks>
    /// SOLO CUENTA SI LLEGÓ CUANDO YA SE LE HABÍA PREGUNTADO. Medido con la sonda el 2026-10-01: a «soy
    /// estudiante de ingeniería» el modelo anotó el rol Y el recuerdo «estudia ingeniería» en la misma
    /// llamada; contar ese recuerdo como la respuesta al paso siguiente se lo saltaba, y Ü se despedía sin
    /// haber preguntado nada de la persona.
    /// </remarks>
    private bool _contoDeSi;

    private static PasoDelEncuentro PasoDe(Perfil p, bool contoDeSi = false)
    {
        if (p.Nombre.Length == 0) return PasoDelEncuentro.Nombre;
        if (p.Rol == Rol.SinElegir) return PasoDelEncuentro.Rol;
        if (p.Trato.Length == 0 && p.Gustos.Count == 0 && !contoDeSi) return PasoDelEncuentro.SobreTi;
        return PasoDelEncuentro.Cierre;
    }

    /// <summary>
    /// Lo anotado, como piezas para la Memoria: cada cosa una vez y en el orden en que se cuenta de
    /// alguien (promesa 767). La escena pinta las que todavía no puso.
    /// </summary>
    public IReadOnlyList<PiezaDeMemoria> Piezas()
    {
        var piezas = new List<PiezaDeMemoria>();
        if (Perfil.Nombre.Length > 0) piezas.Add(new("nombre", Perfil.Nombre, true));
        if (Perfil.Rol != Rol.SinElegir) piezas.Add(new("rol", Perfil.Rol == Rol.Estudiante ? "Estudiante" : "Médico", true));
        if (Perfil.Trato.Length > 0) piezas.Add(new("trato", Perfil.Trato, false));
        for (int i = 0; i < Perfil.Gustos.Count; i++) piezas.Add(new("gusto-" + i, Perfil.Gustos[i], false));
        for (int i = 0; i < _porRecordar.Count; i++) piezas.Add(new("recuerdo-" + i, _porRecordar[i], false));
        return piezas;
    }

    public ModoDelEncuentro Modo { get; private set; } = ModoDelEncuentro.PorVoz;

    /// <summary>Se supo algo nuevo. La escena lo pinta.</summary>
    public event Action<Perfil>? Cambio;

    /// <summary>Terminó. A partir de aquí el rol decide qué se enciende.</summary>
    public event Action<Perfil>? Termino;

    // ── cuándo hace falta ────────────────────────────────────────────────────

    /// <summary>
    /// ¿Hay que ofrecerlo? Solo cuando nadie conoce a esta persona (promesa 751).
    /// </summary>
    /// <param name="hayIdentidadPrevia">
    /// La instalación ya tenía un correo o una sesión de médico. Quien llevaba meses trabajando no
    /// recibe una bienvenida al actualizar: sería no haber mirado.
    /// </param>
    public static bool HaceFalta(Perfil perfil, bool hayIdentidadPrevia) =>
        !perfil.Conocido && !hayIdentidadPrevia;

    /// <summary>El perfil de una instalación que ya existía: médico conocido, con el nombre que tuviera.</summary>
    public static Perfil DeIdentidadPrevia(string nombre) => new()
    {
        Nombre = (nombre ?? "").Trim(),
        Rol = Rol.Medico,
        Conocido = true,
        Desde = DateTimeOffset.Now,
        Origen = "identidad-previa",
    };

    // ── lo que manda el modelo ───────────────────────────────────────────────

    /// <summary>
    /// <c>conocer_guardar</c>: anota lo que se acaba de saber. Se puede llamar varias veces. Devuelve
    /// lo que el modelo tiene que hacer a continuación.
    /// </summary>
    public string Guardar(IReadOnlyDictionary<string, string> args)
    {
        string V(string k) => args.TryGetValue(k, out var v) ? (v ?? "").Trim() : "";
        var llegaron = new List<string>();
        string aviso = "";
        bool yaSeLePreguntoPorElla = Paso == PasoDelEncuentro.SobreTi;

        string nombre = LimpiarNombre(V("nombre"));
        if (nombre.Length > 0) { Perfil.Nombre = nombre; llegaron.Add("nombre"); }

        string rolDicho = V("rol");
        if (rolDicho.Length > 0)
        {
            var rol = Roles.Leer(rolDicho);
            if (rol == Rol.SinElegir)
                aviso = "No entendí si es estudiante o médico: pregúntaselo con esas dos palabras. ";
            else { Perfil.Rol = rol; llegaron.Add("rol"); }
        }

        string trato = V("trato");
        if (trato.Length > 0) { Perfil.Trato = trato; llegaron.Add("trato"); }

        foreach (string gusto in Partir(V("gustos")))
        {
            if (Perfil.Gustos.Any(g => string.Equals(g, gusto, StringComparison.OrdinalIgnoreCase))) continue;
            Perfil.Gustos.Add(gusto);
            if (!llegaron.Contains("gustos")) llegaron.Add("gustos");
        }

        foreach (string recuerdo in Partir(V("recuerdos")))
        {
            if (_porRecordar.Any(r => string.Equals(r, recuerdo, StringComparison.OrdinalIgnoreCase))) continue;
            _porRecordar.Add(recuerdo);
            if (!llegaron.Contains("recuerdos")) llegaron.Add("recuerdos");
            if (yaSeLePreguntoPorElla) _contoDeSi = true;
        }

        // SE ESCRIBE YA, SIN MARCAR: si Ü se cierra ahora, lo sabido no se vuelve a preguntar. Al volver a
        // presentarse NO: ahí en el disco sigue quien ya se conocía, hasta que este termine (promesa 762).
        Perfil.Conocido = false;
        if (!_deNuevo)
        {
            try { _guarda.Guardar(Perfil); }
            catch (Exception e) { _log($"no pude escribir el perfil a medias: {e.GetType().Name}: {e.Message}"); }
        }

        _log($"anotado: {(llegaron.Count > 0 ? string.Join(", ", llegaron) : "nada nuevo")}");
        Cambio?.Invoke(Perfil);
        return aviso + "Anotado. " + QueSigue();
    }

    /// <summary>
    /// <c>conocer_terminar</c>: cierra el encuentro si hay nombre y rol. Si falta algo, NO lo cierra y
    /// dice qué falta (promesa 752).
    /// </summary>
    public string Terminar()
    {
        if (Hecho) return DiEsto(Despedida(Perfil)) + " Después calla.";

        if (Perfil.Nombre.Length == 0)
            return "Todavía no puedo cerrar: falta su nombre. Pregúntale cómo se llama y llama a conocer_guardar.";
        if (Perfil.Rol == Rol.SinElegir)
            return $"Todavía no puedo cerrar: falta saber si {Perfil.Nombre} es estudiante o médico. "
                 + "Pregúntaselo y llama a conocer_guardar.";

        Perfil.Conocido = true;
        Perfil.Desde = DateTimeOffset.Now;
        Perfil.Origen = Modo == ModoDelEncuentro.PorVoz ? "voz" : "escrito";
        try { _guarda.Guardar(Perfil); }
        catch (Exception e)
        {
            // NO SE DA POR HECHO LO QUE NO SE ESCRIBIÓ: al siguiente arranque no habría perfil y se
            // volvería a preguntar, que es justo lo que «terminado» promete que no pasa.
            Perfil.Conocido = false;
            _log($"no pude guardar el perfil: {e.GetType().Name}: {e.Message}");
            return "No se pudo guardar en el disco, así que todavía no está terminado. Dile que hubo un problema "
                 + "al guardar y que lo intentaréis otra vez en un momento.";
        }

        int quedaron = 0;
        foreach (string recuerdo in _porRecordar)
        {
            try { if (_recordar?.Invoke(recuerdo) == true) quedaron++; }
            catch (Exception e) { _log($"un recuerdo no se pudo guardar: {e.GetType().Name}: {e.Message}"); }
        }

        Hecho = true;
        _log($"ENCUENTRO TERMINADO · {Roles.Nombre(Perfil.Rol)} · por {Perfil.Origen} · {Perfil.Gustos.Count} gusto(s) · "
           + $"{quedaron} de {_porRecordar.Count} recuerdo(s) guardados");
        Termino?.Invoke(Perfil);
        return "Quedó guardado. " + DiEsto(Despedida(Perfil)) + " Después calla.";
    }

    /// <summary>
    /// ATIENDE una herramienta del encuentro por su nombre y devuelve lo que el modelo tiene que hacer
    /// después. Es por donde entra la voz (promesa 770).
    /// </summary>
    /// <remarks>
    /// LA ANOTACIÓN QUE COMPLETA LOS PASOS CIERRA, EN ESA MISMA RESPUESTA. Antes contestaba «llama ahora a
    /// conocer_terminar», y el modelo tenía que hacer una segunda llamada para recibir la despedida. Medido
    /// con la sonda hablada el 2026-10-01: en una de tres corridas no la hizo, y a los doce segundos la
    /// persona seguía delante de una carita callada que ya lo sabía todo. Una llamada menos es un sitio
    /// menos donde quedarse, y dos segundos menos de silencio.
    ///
    /// <see cref="Guardar"/> y <see cref="Terminar"/> siguen siendo dos cosas —anotar no es cerrar, y lo
    /// escrito a mano las llama por separado—; lo que se junta es lo que oye el modelo.
    /// </remarks>
    public string Atender(string herramienta, IReadOnlyDictionary<string, string> args)
    {
        switch (herramienta)
        {
            case HerramientaGuardar:
                if (Hecho) return "El primer encuentro ya terminó: no hay nada más que anotar. No digas nada.";
                string anotado = Guardar(args);
                return Paso == PasoDelEncuentro.Cierre ? Terminar() : anotado;
            case HerramientaTerminar:
                return Hecho
                    ? "El primer encuentro ya está cerrado y la despedida ya está dicha. No digas nada más."
                    : Terminar();
            default:
                return $"«{herramienta}» no es una herramienta del primer encuentro.";
        }
    }

    // ── cuando la voz no puede ───────────────────────────────────────────────

    /// <summary>La voz no abrió. El encuentro sigue, escrito; nada se marca (promesa 753).</summary>
    public void LaVozNoAbrio(string porque)
    {
        Modo = ModoDelEncuentro.PorEscrito;
        _log($"la voz no abrió ({porque}): el encuentro pasa a escribirse");
    }

    /// <summary>El encuentro escrito a mano: el nombre y el rol, y termina igual que hablado.</summary>
    public string AMano(string nombre, string rol)
    {
        Modo = ModoDelEncuentro.PorEscrito;
        Guardar(new Dictionary<string, string> { ["nombre"] = nombre ?? "", ["rol"] = rol ?? "" });
        return Terminar();
    }

    /// <summary>
    /// LO ESCRITO CONTESTA AL PASO EN QUE SE ESTÁ, igual que lo dicho (promesa 769). Devuelve lo mismo que
    /// <see cref="Guardar"/>: la frase del paso siguiente, o que ya toca cerrar.
    /// </summary>
    /// <remarks>
    /// «PREFIERO ESCRIBIR» ERA OTRA PANTALLA —dos campos y un botón—, y el dueño la quitó el 2026-10-01: se
    /// escribe en el mismo cajón donde cae lo que se dice, contestando a la pregunta que está en pantalla.
    /// Por eso aquí no hay campos: hay un paso, y el texto es su respuesta.
    ///
    /// EL TERCERO SE GUARDA CON SUS PALABRAS. Sin modelo delante no hay quien separe «me gusta el fútbol»
    /// de «háblame relajado», y adivinarlo con reglas sería anotar mal lo que alguien contó de sí. Va
    /// entero a la memoria, que es donde Ü lo va a leer. Con la voz abierta quien llama no pasa por aquí:
    /// le manda lo escrito al delegado, que sí sabe separarlo.
    /// </remarks>
    public string Escrito(string? texto)
    {
        string t = (texto ?? "").Trim();
        if (t.Length == 0 || Hecho) return QueSigue();
        return Paso switch
        {
            PasoDelEncuentro.Nombre => Guardar(new Dictionary<string, string> { ["nombre"] = t }),
            PasoDelEncuentro.Rol => Guardar(new Dictionary<string, string> { ["rol"] = t }),
            _ => Guardar(new Dictionary<string, string> { ["recuerdos"] = EnUnaLinea(t) }),
        };
    }

    /// <summary>Lo escrito, en una sola línea y sin los separadores con que se parten los recuerdos: es UNO.</summary>
    private static string EnUnaLinea(string t) =>
        string.Join(" ", t.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)).Replace(';', ',');

    /// <summary>Se cerró sin terminar. Queda pendiente: al siguiente arranque se vuelve a ofrecer.</summary>
    public void Dejarlo()
    {
        if (Hecho) return;
        _log($"se dejó a medias (nombre: {(Perfil.Nombre.Length > 0 ? "sí" : "no")}, rol: {(Perfil.Rol != Rol.SinElegir ? "sí" : "no")}): queda pendiente");
    }

    // ── lo que se le dice al modelo ──────────────────────────────────────────

    /// <summary>
    /// Qué tiene que hacer el modelo AHORA: decir la frase del paso que toca, tal cual, o cerrar.
    /// </summary>
    /// <remarks>
    /// LA FRASE VIENE ESCRITA, y no «pregúntale cómo se llama» (promesa 763). El dueño lo probó hablando
    /// el 2026-10-01 y lo que sintió fue que «se podía interrumpir demasiado fácil»: quería que lo
    /// llevaran. Un modelo al que se le dice qué averiguar elige cada vez cómo preguntarlo, y a veces
    /// elige «¿en qué te puedo ayudar?». Uno al que se le da la frase la dice. Medido con la sonda contra
    /// el servidor: la despedida, que ya venía escrita, salió casi letra por letra las dos veces.
    /// </remarks>
    private string QueSigue() => Paso == PasoDelEncuentro.Cierre
        ? "Ya tienes todo: llama AHORA a conocer_terminar, sin decir nada antes."
        : DiEsto(FraseDelPaso(Perfil));

    private static string DiEsto(string frase) => $"AHORA DI EXACTAMENTE ESTO, sin añadir nada delante ni detrás: «{frase}»";

    /// <summary>
    /// La frase del paso en que está quien tenga este perfil: la que Ü dice para abrirlo (promesa 763).
    /// </summary>
    public static string FraseDelPaso(Perfil perfil) => PasoDe(perfil) switch
    {
        PasoDelEncuentro.Nombre => "Hola, soy Ü. Antes de empezar quiero conocerte; es un minuto. ¿Cómo te llamas?",
        PasoDelEncuentro.Rol => $"Mucho gusto, {perfil.Nombre}. Ya quedó en tu Memoria. ¿Eres estudiante o médico?",
        PasoDelEncuentro.SobreTi => "Ahora cuéntame de ti: qué te gusta, en qué andas, y cómo prefieres que te hable. "
                                  + "Entre más me cuentes, mejor te voy a ayudar.",
        _ => Despedida(perfil),
    };

    /// <summary>
    /// Lo último que dice Ü, PALABRA POR PALABRA: dónde queda lo que aprendió, y para qué está. Cada rol
    /// oye solo lo suyo (promesas 752 y 714).
    /// </summary>
    /// <remarks>
    /// LO PIDIÓ EL DUEÑO, casi con estas palabras (2026-10-01): «que me explique: en memoria está todo
    /// lo que aprendo sobre ti; no capturo nada que no esté aquí; si quieres saber todo lo que sé sobre
    /// ti, puedes entrar a la memoria en cualquier momento». Y sobre para qué sirve: «que no sea como
    /// controlar; que me va a ayudar con todo el trabajo tedioso que a mí no me gusta hacer».
    ///
    /// ES LO QUE SE DICE, NO UNA ORDEN SOBRE QUÉ DECIR. Antes era «despídete en dos frases, con tus
    /// palabras»; lo que se promete sobre los datos de alguien no se deja a las palabras de un modelo.
    /// </remarks>
    public static string Despedida(Perfil perfil)
    {
        string nombre = perfil.Nombre.Length > 0 ? ", " + perfil.Nombre : "";
        string paraQue = perfil.Rol == Rol.Estudiante
            ? "grabo tus clases, te organizo los apuntes y te ayudo con los trabajos de la universidad"
            : "escribo la nota de la consulta mientras atiendes y la paso a la historia clínica por ti";
        return $"Listo{nombre}. Todo lo que aprendo de ti queda en tu Memoria: no guardo nada que no esté ahí, "
             + "y puedes abrirla cuando quieras para ver todo lo que sé de ti. "
             + $"Estoy para quitarte el trabajo tedioso del computador: {paraQue}. "
             + "Cuando me necesites, tócame.";
    }

    /// <summary>
    /// LA PERSONA DE LA VOZ MIENTRAS DURA EL ENCUENTRO (promesa 765). Con GPT-Live quien suena no es
    /// quien lleva el guion: la voz conversa por su cuenta y le pasa el trabajo al delegado cuando
    /// quiere, y con su persona de siempre —«ayudas a operar las aplicaciones, sobre todo SAP»— no
    /// quiso nunca.
    /// </summary>
    /// <remarks>
    /// MEDIDO, Y CON AUDIO (2026-10-01). El dueño habló dos minutos con ella y no se anotó ni su nombre:
    /// contestó «Mhm.», «¿En qué te puedo ayudar?», «Dime.». Reproducido con la sonda (frases
    /// sintetizadas, por donde entra el micrófono): con la persona de siempre, 0 delegaciones en 5
    /// frases y 0 anotaciones; con esta, 5 de 5 y el encuentro terminado en 67 s, y 7 de 8 con las
    /// frases torcidas que dijo el dueño («Quiero que controles mi computador», «Bueno, avancemos»).
    /// La que se le escapa la recoge <see cref="LoQueLaVozNoDelego"/>.
    ///
    /// SE LE DEJA UNA PALABRA, Y ES A PROPÓSITO. Con «mientras el delegado trabaja, calla» no callaba: decía
    /// «[tongue click] eh... dame un segundito» delante de cada frase (medido). Con permiso para UNA palabra
    /// —«Vale.», «Perfecto.»— dice esa y nada más, 5 de 5. Prohibirle hablar no se respeta (ver
    /// ProtocoloGptLive: «no sabe callar»); darle qué decir, sí.
    ///
    /// LAS PRUEBAS EN TEXTO NO PODÍAN VERLO: lo escrito va directo al delegado. Por eso toda la noche
    /// salió bien y a la primera frase hablada salió mal.
    /// </remarks>
    public const string PersonaDeLaVoz =
        "Eres Ü. Es la PRIMERA VEZ que hablas con esta persona: acabas de aparecer delante de ella y la estás "
        + "conociendo, paso a paso. Hablas en español, cálida, con frases cortas. En esta conversación tú no decides "
        + "qué preguntar ni anotas nada: eso lo hace el delegado, que es quien lleva los pasos y quien puede guardar "
        + "lo que la persona cuenta. Por eso TODO lo que la persona diga —un saludo, su nombre, si estudia o es "
        + "médico, lo que le gusta, una pregunta, cualquier cosa— lo delegas SIEMPRE y de inmediato. No contestes tú "
        + "por tu cuenta, no ofrezcas ayuda, no preguntes «¿en qué te puedo ayudar?» ni «¿qué necesitas?». Mientras "
        + "el delegado trabaja di, como mucho, UNA sola palabra amable —«Vale.» o «Perfecto.»— y nada más: ni «dame "
        + "un segundo», ni «eh», ni «un momento», ni repetir lo que oíste. Cuando el delegado conteste, di "
        + "exactamente lo que él diga, entero y sin cambiarlo, sin añadir nada delante ni detrás.";

    /// <summary>
    /// LA RED (promesa 766): lo que la persona dijo y la voz no le pasó al delegado, para pasárselo por
    /// escrito. Null si no hay nada que pasar.
    /// </summary>
    /// <param name="delegacionesAntes">Cuántas veces había delegado la voz cuando la persona empezó a hablar.</param>
    /// <param name="delegacionesAhora">Cuántas lleva al cerrarse el turno.</param>
    /// <remarks>
    /// Lo escrito SÍ llega siempre al delegado: es el camino por el que se probó todo en texto. Va entre
    /// corchetes y dicho como lo que es —algo que nadie pronunció— para que el modelo no lo lea en voz
    /// alta ni lo confunda con la persona, igual que <see cref="Pie"/>.
    /// </remarks>
    public static string? LoQueLaVozNoDelego(int delegacionesAntes, int delegacionesAhora, string? loOido)
    {
        if (delegacionesAhora > delegacionesAntes) return null;
        string oido = (loOido ?? "").Trim();
        if (oido.Length == 0) return null;
        return $"[Nadie ha dicho esto en voz alta: la persona acaba de decir «{oido}» y todavía no lo has atendido. "
             + "Anota lo que sirva con conocer_guardar y sigue con el paso que toque.]";
    }

    /// <summary>
    /// El guion, que va en las INSTRUCCIONES de la sesión mientras dura el encuentro y se quita al
    /// terminar.
    /// </summary>
    /// <remarks>
    /// EN LAS INSTRUCCIONES Y NO COMO UN MENSAJE, y hay un motivo: lo que entra como mensaje queda en
    /// el hilo que se guarda entre sesiones. La presentación de antes se mandaba así, y «no hagas nada
    /// más en este primer turno» seguía en la historia semanas después. Un guion que dice «no uses
    /// ninguna otra herramienta» no puede sobrevivir a la conversación para la que se escribió.
    /// </remarks>
    public static string Guion(Perfil loQueYaSeSabe)
    {
        // LO QUE YA SE SABE VA EN EL GUION, y no es cortesía: la sesión puede caerse y volver a mitad del
        // encuentro (medido el 2026-10-01: el servidor la cerró dos veces por inactividad en dos minutos), y
        // la que vuelve empieza de cero. Sin esto, preguntaría el nombre otra vez.
        var sabido = new List<string>();
        if (loQueYaSeSabe.Nombre.Length > 0) sabido.Add($"se llama {loQueYaSeSabe.Nombre}");
        if (loQueYaSeSabe.Rol != Rol.SinElegir) sabido.Add($"es {Roles.Nombre(loQueYaSeSabe.Rol)}");
        if (loQueYaSeSabe.Trato.Length > 0) sabido.Add($"quiere que le hables así: {loQueYaSeSabe.Trato}");
        if (loQueYaSeSabe.Gustos.Count > 0) sabido.Add($"le gusta {string.Join(" y ", loQueYaSeSabe.Gustos)}");
        string yaSabido = sabido.Count > 0
            ? $" YA SABES ESTO de ella, y no se lo vuelves a preguntar: {string.Join("; ", sabido)}."
            : "";
        // POR PASOS, Y CON LA FRASE ESCRITA (promesa 763). Las herramientas contestan con la frase exacta
        // del paso siguiente: el modelo no elige cómo preguntar, la dice. Lo que se le deja a él es entender
        // lo que la persona contó y qué de eso merece anotarse.
        return "AHORA MISMO, Y POR ENCIMA DE TODO LO ANTERIOR: ES LA PRIMERA VEZ que esta persona te abre. Acabas "
             + "de aparecer en el centro de su pantalla y te está mirando. Tu única tarea en esta conversación es "
             + "LLEVARLA, paso a paso, por cuatro pasos que no se saltan ni se cambian de orden: su nombre, si es "
             + "estudiante o médico, que te cuente de ella, y el cierre." + yaSabido + "\n"
             + $"EL PASO DE AHORA empieza con esta frase, que dices TAL CUAL: «{FraseDelPaso(loQueYaSeSabe)}»\n"
             + "CÓMO SE AVANZA: cada vez que la persona conteste, llama a conocer_guardar con lo que dijo —solo los "
             + "campos que conozcas—. En el tercer paso ANOTA CON GENEROSIDAD, que es para conocerla de verdad: sus "
             + "gustos uno por uno, cómo quiere que le hables, y en recuerdos todo lo demás que cuente —qué estudia o "
             + "en qué trabaja, dónde vive, qué le cuesta, qué quiere lograr—, cada cosa en su línea y con pocas palabras.\n"
             + "LO QUE DICES DESPUÉS: conocer_guardar te devuelve, entre «», la frase del paso siguiente; dila "
             + "EXACTAMENTE, sin añadir nada delante ni detrás. Cuando ya esté todo, lo que te devuelve es la "
             + "despedida: dila EXACTAMENTE, entera, y calla. Solo si te lo pide, llama a conocer_terminar.\n"
             + "SI LA PERSONA SOLO SALUDA, devuélvele el saludo en una o dos palabras y repite la pregunta del paso. "
             + "SI DICE OTRA COSA —pregunta algo, pide que hagas algo, o no contesta a lo que preguntaste—, no lo "
             + "atiendas ahora: dile en UNA frase corta y amable que eso lo veis en cuanto os conozcáis, y repite la "
             + "pregunta del paso en que estás. Si no entiendes el nombre, pídele que lo repita. Si de verdad no "
             + "quiere contestar algo, guarda lo que tengas y sigue.\n"
             + "REGLAS: una sola pregunta por turno. No expliques funciones ni ofrezcas ayuda antes del cierre. No "
             + "pidas correo ni contraseña. No uses ninguna herramienta que no sea conocer_guardar o conocer_terminar.";
    }

    /// <summary>
    /// Lo que hace que Ü empiece ELLA. Un turno mínimo, porque el modelo no arranca hablando si nadie
    /// le dice nada; no se guarda en el hilo ni se lee en voz alta.
    /// </summary>
    public const string Pie =
        "[Nadie ha dicho esto en voz alta: la persona acaba de abrirte por primera vez y te mira. Empieza tú.]";

    /// <summary>El empujón cuando ya se sabe todo y falta cerrar. Tampoco lo dijo nadie.</summary>
    public const string PieParaCerrar =
        "[Nadie ha dicho esto en voz alta: ya tienes su nombre, su rol y lo que te contó. Llama a conocer_terminar "
        + "ahora y despídete como te diga.]";

    /// <summary>Las dos herramientas que solo existen durante el encuentro (promesa 759).</summary>
    public static IReadOnlyList<Utensilio> Herramientas { get; } = new[]
    {
        new Utensilio(HerramientaGuardar,
            "ANOTA lo que acabas de saber de la persona en el primer encuentro. Llámala cada vez que sepas algo "
            + "nuevo; solo manda los campos que conozcas. Te contesta, entre «», la frase EXACTA que tienes que decir después.",
            new[]
            {
                new Argumento("nombre", "Cómo se llama, tal como lo dijo. Solo el nombre, sin «me llamo»."),
                new Argumento("rol", "«estudiante» o «medico». Ninguna otra palabra."),
                new Argumento("trato", "Cómo prefiere que le hables, con sus palabras: «directo», «con humor», «con calma»."),
                new Argumento("gustos", "Lo que dijo que le gusta, separado por punto y coma: «el fútbol; programar»."),
                new Argumento("recuerdos", "OTRAS cosas que contó de sí misma y conviene recordar, una por línea: dónde vive, "
                                         + "qué estudia o en qué trabaja. No repitas aquí el nombre, el rol, el trato ni los gustos."),
            }),
        new Utensilio(HerramientaTerminar,
            "CIERRA el primer encuentro. Llámala cuando conocer_guardar te lo diga. Si falta algo te lo dice y NO "
            + "cierra; si cierra, te da entre «» la despedida, para decirla tal cual.",
            Array.Empty<Argumento>()),
    };

    // ── menudencias ──────────────────────────────────────────────────────────

    /// <summary>
    /// El nombre, sin lo que el modelo a veces arrastra: comillas, un punto final, «me llamo».
    /// </summary>
    private static string LimpiarNombre(string crudo)
    {
        string n = crudo.Trim().Trim('"', '«', '»', '\'', '.', ',', ' ');
        foreach (string prefijo in new[] { "me llamo ", "mi nombre es ", "soy " })
            if (n.StartsWith(prefijo, StringComparison.OrdinalIgnoreCase)) { n = n[prefijo.Length..].Trim(); break; }
        if (n.Length > 60) n = n[..60].Trim();
        return n.Length > 0 ? char.ToUpper(n[0]) + n[1..] : "";
    }

    private static IEnumerable<string> Partir(string lista) =>
        lista.Split(new[] { ';', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
             .Select(x => x.Trim().Trim('-', '·', '•', ' ').TrimEnd('.'))
             .Where(x => x.Length > 0);
}
