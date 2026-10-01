using System.Windows;
using U.WindowsClient.Clases;
using U.WindowsClient.Diagnostics;
using U.WindowsClient.Persona;
using U.WindowsClient.Voice;

namespace U.WindowsClient.Ui;

/// <summary>
/// QUIÉN USA Ü, Y EL PRIMER ENCUENTRO (spec 080).
/// </summary>
/// <remarks>
/// Archivo parcial aparte, como <c>FaceWindow.Escritorio.cs</c>: <c>FaceWindow.xaml.cs</c> es la zona de
/// choque alta del repo, y todo lo de la persona cabe aquí sin rozar el resto.
///
/// AQUÍ SOLO SE CABLEA. Cuándo hace falta el encuentro, cuándo cuenta como hecho, qué puede cada rol y
/// qué lleva la voz son de <see cref="PrimerEncuentro"/>, <see cref="ReglaDelRol"/>, <see cref="Alma"/>
/// y <see cref="ClasesParaLaVoz"/>, que el contrato juzga sin pantalla (promesas 750–710). Esta parte
/// es la que no se puede juzgar ahí: abrir la escena, abrir la voz, y volver a dejarlo todo en su sitio.
/// </remarks>
public partial class FaceWindow
{
    private readonly PerfilDeLaPersona _perfiles = new();
    private readonly CuadernoDeClases _cuaderno = new();
    private Perfil _perfil = new();
    private Rol _rol = Rol.SinElegir;
    private bool _hayIdentidadPrevia;

    private PrimerEncuentro? _encuentro;
    private EscenaDeBienvenida? _escena;
    private bool _despidiendo;
    private (double Left, double Top)? _casaDeLaCarita;
    private bool _vigiaEncendido, _exportadorEncendido;

    private bool Puede(Capacidad capacidad) => ReglaDelRol.Puede(_rol, capacidad);

    // ── la identidad, sin preguntar nada ─────────────────────────────────────

    /// <summary>
    /// Deja resuelto quién usa esta instalación ANTES de montar el resto: su id, su perfil y su rol.
    /// No abre ninguna ventana y no espera a nadie.
    /// </summary>
    /// <remarks>
    /// AQUÍ ESTABA EL POPUP. Hasta el 2026-10-01 esta era la primera línea de <c>OnLoaded</c> y, sin
    /// correo, abría una ventana modal que pedía nombre y correo; mientras estuvo abierta no había
    /// MCP, ni localizador, ni voz, ni una línea de log. Lo que se necesitaba de ella era saber quién
    /// es la persona, y eso ahora se pregunta hablando, con la app ya entera arrancada.
    ///
    /// UNA INSTALACIÓN QUE YA TRABAJABA NO RECIBE UNA BIENVENIDA (promesa 751): con un correo o una
    /// sesión de médico de antes, pasa a médico conocido en silencio. Eran las únicas que había.
    /// </remarks>
    private void PrepararLaIdentidad()
    {
        try
        {
            if (string.IsNullOrWhiteSpace(_config.InstallId))
            {
                _config.InstallId = Guid.NewGuid().ToString("N");
                _config.Save();
            }

            // La sesión se restaura de disco, sin red: es leer un archivo cifrado.
            var sesion = new Cuenta.SesionMiracle(Cuenta.Nube.SupabaseUrl, Cuenta.Nube.ClavePublicable);
            bool hayMedico = sesion.Restaurar();
            if (hayMedico)
            {
                // Si hay médico, manda el médico (promesa 98): su correo es la identidad de la máquina.
                string correo = Cuenta.Identidad.CorreoQueMandaEnLaMaquina(sesion.MedicoEmail, _config.Email);
                if (!string.IsNullOrWhiteSpace(correo) && correo != _config.Email)
                {
                    _config.Email = correo;
                    _config.UserId = correo;
                    if (sesion.MedicoNombre.Length > 0) _config.DisplayName = sesion.MedicoNombre;
                    _config.Save();
                    LogBus.Log("persona", $"identidad tomada de la sesión del médico · {sesion.MedicoId}");
                }
            }

            _hayIdentidadPrevia = hayMedico || !string.IsNullOrWhiteSpace(_config.Email);
            _perfil = _perfiles.Leer();
            if (!_perfil.Conocido && _hayIdentidadPrevia)
            {
                _perfil = PrimerEncuentro.DeIdentidadPrevia(_config.DisplayName);
                _perfiles.Guardar(_perfil);
                LogBus.Log("persona", "esta instalación ya tenía identidad: pasa a médico conocido, sin preguntar nada");
            }
            _rol = ReglaDelRol.Efectivo(_perfil, _hayIdentidadPrevia);
            LogBus.Log("persona", _perfil.Conocido
                ? $"conocida · {Roles.Nombre(_rol)} · {_perfil.Gustos.Count} gusto(s) · por {_perfil.Origen}"
                : "todavía no conozco a quien me usa: el primer encuentro está pendiente");
        }
        catch (Exception ex)
        {
            for (var x = ex; x != null; x = x.InnerException)
                LogBus.Log("persona", $"no pude preparar la identidad: {x.GetType().Name}: {x.Message}");
        }
    }

    // ── lo que cada rol enciende ─────────────────────────────────────────────

    /// <summary>
    /// Enciende lo que le toca al rol de ahora, y nada más. Se llama al arrancar y otra vez cuando el
    /// primer encuentro termina; lo ya encendido no se enciende dos veces.
    /// </summary>
    /// <remarks>
    /// LOS OCHO SITIOS, EN UNO (promesa 755). Cada cosa que solo es de médicos pregunta aquí antes de
    /// arrancar: el vigía de cardiología, el sondeo de exportaciones, los dos puentes a SAP, el botón
    /// de subir estudios y el acceso directo del escritorio. A un estudiante no se le esconde un
    /// botón: no se le enciende nada de eso.
    /// </remarks>
    private void EncenderLoDelRol()
    {
        try
        {
            if (Puede(Capacidad.EstudiosDeCardiologia) && !_vigiaEncendido)
            {
                Cardio.VigiaCardio.Arrancar();
                _vigiaEncendido = true;
            }
            if (Puede(Capacidad.ExportarAHistoriaClinica) && !_exportadorEncendido && _exportador != null)
            {
                _exportador.Arrancar();
                _exportadorEncendido = true;
            }
            else if (!Puede(Capacidad.ExportarAHistoriaClinica) && _exportadorEncendido)
            {
                // Quien volvió a presentarse y ya no es médico deja de sondear en el acto, no al reiniciar.
                _exportador?.Parar();
                _exportadorEncendido = false;
            }

            bool sap = Puede(Capacidad.EscribirEnSap);
            Clinical.PuenteASap.Enviar = sap ? EnviarEncargoAsync : null;
            Clinical.PuenteDeAprendizajes.Mostrar = sap ? MostrarAprendizajeAsync : null;

            if (SubirBtn != null)
                SubirBtn.Visibility = Puede(Capacidad.EstudiosDeCardiologia) ? Visibility.Visible : Visibility.Collapsed;

            ConversacionEnVivo.HerramientasDeLaPersona = HerramientasDelRol.Para(_rol, enEncuentro: _encuentro is { Hecho: false });
            App.AccesoDirectoSegunElRol(_rol);

            LogBus.Log("persona", $"encendido lo de «{(_rol == Rol.SinElegir ? "sin elegir" : Roles.Nombre(_rol))}»: "
                + $"exportaciones={(_exportadorEncendido ? "sí" : "no")} · cardiología={(_vigiaEncendido ? "sí" : "no")} · "
                + $"SAP={(sap ? "sí" : "no")} · herramientas propias={ConversacionEnVivo.HerramientasDeLaPersona.Count}");
        }
        catch (Exception e) { LogBus.Log("persona", $"no pude encender lo del rol: {e.GetType().Name}: {e.Message}"); }
    }

    // ── lo que la voz lleva de la persona ────────────────────────────────────

    /// <summary>
    /// El contexto de la persona para las instrucciones de la sesión que se abre AHORA. Durante el
    /// encuentro es su guion; después, el alma y, si es estudiante, sus clases.
    /// </summary>
    private string ContextoDeLaPersona()
    {
        var encuentro = _encuentro;
        if (encuentro is { Hecho: false }) return PrimerEncuentro.Guion(encuentro.Perfil);

        string alma = Alma.Componer(_perfil);
        string clases = _rol == Rol.Estudiante ? ClasesParaLaVoz.Contexto(_rol, _cuaderno.Todas()) : "";
        return string.Join("\n\n", new[] { alma, clases }.Where(x => x.Length > 0));
    }

    /// <summary>Las herramientas de la persona. Llega desde el hilo de la voz: aquí no se toca la interfaz.</summary>
    private string AtenderLoDeLaPersona(string herramienta, IReadOnlyDictionary<string, string> args)
    {
        switch (herramienta)
        {
            // La anotación que completa los pasos cierra en esa misma respuesta (promesa 770).
            case PrimerEncuentro.HerramientaGuardar:
            case PrimerEncuentro.HerramientaTerminar:
                return _encuentro?.Atender(herramienta, args) ?? "El primer encuentro ya terminó: no digas nada más.";
            case ClasesParaLaVoz.HerramientaLeer:
                return Puede(Capacidad.GrabarClases)
                    ? ClasesParaLaVoz.Leer(_cuaderno, args)
                    : "Esta persona no graba clases.";
            default:
                return $"«{herramienta}» no es una herramienta de la persona conocida";
        }
    }

    /// <summary>Guarda en la memoria personal algo que la persona contó al conocerse.</summary>
    private bool RecordarDeLaPersona(string texto)
    {
        var memoria = _vivo?.Memoria;
        if (memoria == null) return false;
        return memoria.EjecutarAsync(texto, CancellationToken.None).GetAwaiter().GetResult().Ok;
    }

    // ── el primer encuentro ──────────────────────────────────────────────────

    /// <summary>
    /// Que la primera vez se presente ELLA, en el centro de la pantalla, y pregunte quién eres.
    /// </summary>
    /// <remarks>
    /// YA NO SE MARCA ANTES DE HABLAR. La versión anterior ponía «presentación hecha» y guardaba, y
    /// después intentaba abrir la voz: si no abría en diez segundos, no volvía a presentarse nunca. Lo
    /// que la justificaba era no repetir el saludo en cada arranque; eso lo resuelve ahora que el
    /// encuentro tenga un final de verdad —nombre y rol— y que sin él siga pendiente (promesa 752).
    ///
    /// SE DICE SIEMPRE POR QUÉ, también cuando no pasa nada: un camino que solo escribe en el log
    /// cuando funciona es indistinguible de uno que no existe.
    /// </remarks>
    private void OfrecerElPrimerEncuentro()
    {
        if (!PrimerEncuentro.HaceFalta(_perfil, _hayIdentidadPrevia))
        {
            LogBus.Log("encuentro", _perfil.Conocido
                ? $"no hace falta: ya nos conocemos ({Roles.Nombre(_perfil.Rol)}, por {_perfil.Origen}). "
                  + @"Para volver a verlo: cierra Ü, borra %APPDATA%\U\perfil.json y vuelve a abrir."
                : "no hace falta: esta instalación ya tenía identidad");
            return;
        }

        // Se espera a que la carita esté puesta y se la haya visto llegar: una escena que tapa la
        // pantalla en el mismo instante en que arranca la app no se entiende de dónde sale.
        var arranque = new System.Windows.Threading.DispatcherTimer { Interval = TimeSpan.FromMilliseconds(1400) };
        arranque.Tick += (_, __) => { arranque.Stop(); _ = EmpezarElEncuentroAsync("primer arranque"); };
        arranque.Start();
    }

    /// <summary>
    /// «Volver a presentarnos», desde la Memoria: el mismo encuentro, empezando de cero. Quien ya se
    /// conocía sigue en el disco hasta que este termine (promesa 762).
    /// </summary>
    private void VolverAPresentarse()
    {
        try { MemoriaWindow.LaQueHay?.Hide(); } catch { }
        _ = EmpezarElEncuentroAsync("la persona pidió volver a presentarse", deNuevo: true);
    }

    private async Task EmpezarElEncuentroAsync(string porque, bool deNuevo = false)
    {
        if (_encuentro != null || _escena != null) return;
        try
        {
            LogBus.Log("encuentro", $"{(deNuevo ? "ENCUENTRO DE NUEVO" : "PRIMER ENCUENTRO")} · {porque}");
            // Si había una conversación abierta, se cierra: la del encuentro abre con su propio guion.
            if (_vivo?.Viva == true) await _vivo.TerminarAsync();
            Action<string> log = m => LogBus.Log("encuentro", m);
            var encuentro = deNuevo
                ? PrimerEncuentro.DeNuevo(_perfiles, RecordarDeLaPersona, log)
                : new PrimerEncuentro(_perfiles, RecordarDeLaPersona, log);
            encuentro.Cambio += _ => Dispatcher.BeginInvoke(() =>
            {
                // Lo anotado cae en la Memoria de la escena y el paso de arriba avanza (promesas 763 y 717).
                _escena?.Anotado(encuentro.Piezas());
                if (!encuentro.Hecho) _escena?.Paso(encuentro.Paso, encuentro.Perfil.Nombre);
                VigilarQueCierre(encuentro);
            });
            encuentro.Termino += p => Dispatcher.BeginInvoke(() => AlTerminarElEncuentro(p));
            _encuentro = encuentro;
            ConversacionEnVivo.HerramientasDeLaPersona = HerramientasDelRol.Para(_rol, enEncuentro: true);
            // LA VOZ QUE SUENA TAMBIÉN ES DEL ENCUENTRO (promesa 765): con la de siempre no le pasa al delegado
            // lo que la persona dice, y el delegado es el único que puede anotarlo.
            ConversacionEnVivo.PersonaDeLaVozDeAhora = () => _encuentro is { Hecho: false } ? PrimerEncuentro.PersonaDeLaVoz : "";

            var escena = new EscenaDeBienvenida(Enum.TryParse(_config.FaceTheme, out FaceTheme tema) ? tema : FaceTheme.Light);
            escena.LoDejo += () => _ = DejarElEncuentroAsync("la persona lo dejó para después");
            escena.Escribio += texto => _ = AlEscribirEnLaEscenaAsync(texto);
            _escena = escena;

            await LlevarLaCaritaAlCentroAsync(escena);
            if (_escena != escena) return;   // se dejó mientras volaba

            escena.Anotado(encuentro.Piezas());   // un encuentro que se dejó a medias ya trae lo suyo
            escena.Paso(encuentro.Paso, encuentro.Perfil.Nombre);
            escena.Estado("Un momento…");
            await AbrirLaVozDelEncuentroAsync();
        }
        catch (Exception e)
        {
            for (var x = e; x != null; x = x.InnerException)
                LogBus.Log("encuentro", $"no pude empezar: {x.GetType().Name}: {x.Message}");
            await DejarElEncuentroAsync("falló al empezar");
        }
    }

    /// <summary>
    /// «La carita flotante que se ponga al centro»: vuela desde su esquina hasta donde va a estar la de
    /// la escena, el telón baja mientras viaja, y al posarse la escena aparece a su alrededor con ella
    /// creciendo. Es UNA carita que cambia de sitio y de tamaño, no una ventana que sustituye a otra.
    /// </summary>
    private async Task LlevarLaCaritaAlCentroAsync(EscenaDeBienvenida escena)
    {
        double lado = CollapsedFace.ActualWidth > 0 ? CollapsedFace.ActualWidth : 66;
        _casaDeLaCarita = (Left, Top);   // a donde vuelve cuando la escena se vaya
        escena.Preparar();
        var centro = escena.CentroDeLaCara();
        escena.BajarElTelon();

        // Guardada en el muelle, u oculta, no hay carita que volar: la escena entra sin el viaje.
        if (IsVisible && !_silla.Ocupada)
        {
            _visita.VolverYa();
            // Por encima del telón, que acaba de mostrarse y por eso quedó encima de todo.
            Topmost = false; Topmost = true;
            var enVentana = CollapsedFace.TranslatePoint(new Point(lado / 2, lado / 2), this);
            double x = centro.X - enVentana.X, y = centro.Y - enVentana.Y;
            double distancia = Math.Sqrt(Math.Pow(x - Left, 2) + Math.Pow(y - Top, 2));
            MoverConMuelle(x, y);
            await Task.Delay(TimeSpan.FromMilliseconds(Math.Clamp(260 + distancia * 0.45, 260, 720) + 90));
            Vuelo.Termina();
        }

        // LA DE VERDAD SE APARTA en el mismo instante en que la grande aparece en su sitio.
        Hide();
        _muelle?.Hide();
        escena.Entrar(lado);
    }

    /// <summary>
    /// Abre la voz y hace que Ü empiece. Si no se puede, el encuentro pasa a escribirse (promesa 753).
    /// </summary>
    private async Task AbrirLaVozDelEncuentroAsync()
    {
        var crono = System.Diagnostics.Stopwatch.StartNew();
        string porQueNo = "";
        // CON LAS ÓRDENES DE PRUEBA, EN TEXTO: es la forma de recorrer el encuentro entero sin micrófono ni
        // altavoz (promesa 513). El camino es el mismo —instrucciones, herramientas, escena—; cambia por
        // dónde entra y sale la frase.
        bool soloTexto = (Environment.GetEnvironmentVariable("U_ORDENES_DE_PRUEBA") ?? "").Trim() == "1";

        if (_vivo == null) porQueNo = "no hay capa de voz montada";
        else
        {
            try
            {
                // LAS CLAVES, ESPERADAS (promesa 760). En una copia instalada la de la voz se le pide a
                // Graph; abrir la voz antes de que llegue era «no hay voz» en el primer minuto de vida.
                if (Credenciales.ClavesDelBackend.Viva is { } claves)
                    await claves.TraerSiFaltaAlgunaAsync().WaitAsync(TimeSpan.FromSeconds(8));
            }
            catch (TimeoutException) { LogBus.Log("encuentro", "las claves no llegaron en 8 s: se intenta la voz con lo que haya"); }
            catch (Exception e) { LogBus.Log("encuentro", $"no pude pedir las claves: {e.GetType().Name}: {e.Message}"); }

            if (_escena == null || _encuentro == null) return;   // se dejó mientras se esperaba
            _escena.ConMicrofono = !soloTexto;

            _abriendoLaVoz = true;
            // Mientras Ü dice la frase del paso, no oye: una palabra dicha encima no le corta la pregunta.
            _vivo.NoSeDejaInterrumpir = true;
            _vivo.LaAbrioLaApp = true;   // nadie dijo nada «desde el gesto»: no hubo gesto
            try
            {
                if (!_vivo.Viva)
                {
                    if (soloTexto) await _vivo.ArrancarSoloTextoAsync();
                    else StartMicByFace();
                }
                if (!await _vivo.EsperarAbiertaAsync(TimeSpan.FromSeconds(12)))
                    porQueNo = $"la sesión no confirmó en {crono.ElapsedMilliseconds} ms";
                else if (soloTexto)
                {
                    // En texto no hay voz a la que dictarle: la frase se le pide al delegado, como siempre.
                    if (!await _vivo.EmpezarTuAsync(PrimerEncuentro.Pie, soloTexto))
                        porQueNo = "la sesión abrió y se cerró antes de poder empezar";
                }
                else
                {
                    // LA FRASE DEL PASO, DICTADA: suena al segundo, y es la que está escrita. En pantalla va
                    // la pregunta corta del paso, que ya está puesta: lo largo es para oírlo.
                    string frase = PrimerEncuentro.FraseDelPaso(_encuentro.Perfil);
                    if (!await _vivo.DecirTalCualAsync(frase))
                        porQueNo = "la sesión abrió y se cerró antes de poder empezar";
                    else { _fraseDictada = frase; _ultimoDichoEnLaEscena = frase; }
                }
            }
            catch (Exception e) { porQueNo = $"{e.GetType().Name}: {e.Message}"; }
            finally { _abriendoLaVoz = false; }
        }

        if (_escena == null || _encuentro == null) return;
        if (porQueNo.Length == 0)
        {
            LogBus.Log("encuentro", $"voz lista en {crono.ElapsedMilliseconds} ms{(soloTexto ? " (en texto: órdenes de prueba)" : "")} · Ü empieza");
            _escena.Estado("");
            return;
        }

        // LA OTRA VÍA, Y SE DICE POR QUÉ. Nada queda marcado: el encuentro sigue, escrito.
        LogBus.Log("encuentro", $"SIN VOZ: {porQueNo}. Mira las líneas «voz-viva» de justo antes. El encuentro pasa a escribirse.");
        _encuentro.LaVozNoAbrio(porQueNo);
        _escena.SinVoz("No pude abrir la voz. Escríbeme aquí abajo.");
        await CerrarLaVozDelEncuentroAsync();
    }

    private bool _abriendoLaVoz;
    private int _vueltaDeLaVigilancia;

    /// <summary>
    /// QUE EL ENCUENTRO NO SE QUEDE COLGADO CUANDO YA ESTÁ TODO DICHO. Con nombre, rol y la tercera
    /// respuesta, solo falta que el modelo cierre y se despida; si no lo hace, primero se le empuja y
    /// después se cierra aquí. Nadie se queda mirando una carita que ya lo sabe todo y no termina.
    /// </summary>
    /// <remarks>
    /// MEDIDO, NO SUPUESTO (2026-10-01): el servidor cerró la sesión un segundo después de la tercera
    /// anotación; la sesión que volvió traía en su guion todo lo sabido, pero nadie le había dicho nada
    /// y se quedó esperando. La escena siguió abierta minuto y medio hasta que se cerró la prueba.
    /// </remarks>
    private async void VigilarQueCierre(PrimerEncuentro encuentro)
    {
        if (!encuentro.ListoParaCerrar) return;
        int vuelta = ++_vueltaDeLaVigilancia;   // cada anotación reinicia la espera: solo cuenta la última
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(9));
            await EsperarAQueUCalleAsync();
            if (vuelta != _vueltaDeLaVigilancia || _encuentro != encuentro || !encuentro.ListoParaCerrar) return;
            if (encuentro.Modo == ModoDelEncuentro.PorVoz && _vivo?.Viva == true)
            {
                LogBus.Log("encuentro", "ya se sabe todo y no ha cerrado en 9 s: se le empuja");
                bool soloTexto = _escena?.ConMicrofono == false;
                await _vivo.EmpezarTuAsync(PrimerEncuentro.PieParaCerrar, soloTexto);
                await Task.Delay(TimeSpan.FromSeconds(12));
                await EsperarAQueUCalleAsync();
                if (vuelta != _vueltaDeLaVigilancia || _encuentro != encuentro || !encuentro.ListoParaCerrar) return;
            }
            LogBus.Log("encuentro", "sigue sin cerrar: lo cierro yo con lo que se sabe");
            _cerradoSinVoz = true;
            encuentro.Terminar();
        }
        catch (Exception e) { LogBus.Log("encuentro", $"la vigilancia del cierre tropezó: {e.GetType().Name}: {e.Message}"); }
    }

    /// <summary>
    /// Espera a que Ü lleve cuatro segundos callada, con un tope de medio minuto.
    /// </summary>
    /// <remarks>
    /// EL RELOJ DEL VIGÍA SE MIDIÓ EN TEXTO, donde una frase llega de golpe. Dicha en voz alta dura lo
    /// que dura: nueve segundos después de la última anotación Ü puede ir por la mitad de «qué bien,
    /// Jose…», y empujarla ahí —o cerrar la escena— sería cortarla a media frase. Sin audio el último
    /// sonido no existe y esto no espera nada, que es como se probó (2026-10-01). **Con micrófono no
    /// está probado**: es la precaución, no la medida.
    /// </remarks>
    private async Task EsperarAQueUCalleAsync()
    {
        var tope = DateTime.UtcNow.AddSeconds(30);
        while (DateTime.UtcNow < tope
               && (_vivo?.SigueSonando == true || (DateTime.UtcNow - _ultimoSonido).TotalSeconds < 4))
            await Task.Delay(400);
    }

    /// <summary>
    /// La voz se apagó a mitad del encuentro —se cayó la red, o alguien la colgó—. El encuentro sigue,
    /// escrito, con lo que ya se sabía puesto en los campos (promesa 753).
    /// </summary>
    private void SiLaVozSeFueDelEncuentro(bool viva)
    {
        // Mientras se está ABRIENDO no es «se fue»: de ese fallo se ocupa quien la abre, con su porqué.
        if (viva || _abriendoLaVoz || _encuentro is not { Hecho: false } encuentro || _escena == null || _despidiendo || _dejando) return;
        if (encuentro.Modo == ModoDelEncuentro.PorEscrito) return;   // ya estaba escribiendo: la cerró él
        if (encuentro.ListoParaCerrar)
        {
            LogBus.Log("encuentro", "la voz se fue con todo ya dicho: se cierra con lo que se sabe");
            _cerradoSinVoz = true;
            encuentro.Terminar();
            return;
        }
        LogBus.Log("encuentro", "la voz se fue a mitad del encuentro: sigue escrito, con lo ya sabido");
        encuentro.LaVozNoAbrio("la voz se cerró a mitad");
        _escena.SinVoz("Se cortó la voz. Sigamos por escrito.");
    }

    private async Task CerrarLaVozDelEncuentroAsync()
    {
        try { if (_vivo?.Viva == true) await _vivo.TerminarAsync(); }
        catch (Exception e) { LogBus.Log("encuentro", $"no pude cerrar la voz: {e.Message}"); }
    }

    /// <summary>
    /// El encuentro terminó de verdad: hay nombre y hay rol. A partir de aquí manda el rol.
    /// </summary>
    private void AlTerminarElEncuentro(Perfil perfil)
    {
        bool cambioDeRol = _rol != Rol.SinElegir && _rol != perfil.Rol;
        _perfil = perfil;
        _rol = perfil.Rol;
        _hayIdentidadPrevia = false;
        if (cambioDeRol)
        {
            // El panel de grabar que estuviera abierto era del rol de antes: se cierra. El siguiente toque
            // en el collar abre el que toca ahora.
            foreach (var panel in Application.Current.Windows.OfType<ConsultaWindow>().ToList())
                try { panel.Close(); } catch { }
            LogBus.Log("persona", $"cambió de rol al volver a presentarse: ahora es {Roles.Nombre(_rol)}");
        }
        if (perfil.Nombre.Length > 0 && _config.DisplayName != perfil.Nombre)
        {
            _config.DisplayName = perfil.Nombre;
            _config.Save();
        }
        if (_encuentro is { } terminado) _escena?.Anotado(terminado.Piezas()); else _escena?.Sabe(perfil);
        _escena?.Terminado(perfil);
        _dichoAlTerminar = _ultimoDichoEnLaEscena;
        EncenderLoDelRol();

        // Hablando, la despedida la dice Ü y la escena se va cuando termina de decirla (ver AlCerrarUnTurno).
        // Si no hay quien la diga —se escribió, la voz se fue, o lo cerró la vigilancia— la dice la escena,
        // escrita, y se queda lo justo para leerla: un final que desaparece sin decir nada parece un fallo.
        bool nadieLaDira = _cerradoSinVoz || _encuentro?.Modo == ModoDelEncuentro.PorEscrito || _vivo?.Viva != true;
        if (nadieLaDira)
        {
            _despedidaEnCurso = true;
            // Sin voz que la diga, la despedida es la que la escena ya tiene escrita al terminar: dónde queda lo
            // que aprendió, y que se puede abrir cuando se quiera. Se deja el tiempo de leerla.
            _ = DespedirTrasLeerAsync(120);
        }
        else
            _ = DespedirSiNadieHablaAsync();
    }

    /// <summary>La despedida escrita se queda lo que se tarda en leerla, y la escena se va.</summary>
    private async Task DespedirTrasLeerAsync(int letras)
    {
        await Task.Delay(Math.Clamp(letras * 55, 3200, 15000));
        await DespedirLaEscenaAsync();
    }

    /// <summary>El encuentro se cerró sin que el modelo llegara a despedirse: la despedida va escrita.</summary>
    private bool _cerradoSinVoz;
    /// <summary>Se está dejando a propósito: que la voz se apague ahora no es «se cortó».</summary>
    private bool _dejando;

    /// <summary>Red de seguridad: si la despedida hablada no llega a cerrarse, la escena se va igual.</summary>
    private async Task DespedirSiNadieHablaAsync()
    {
        await Task.Delay(TimeSpan.FromSeconds(14));
        // Si sigue hablando, no se le quita la escena de debajo: se espera a que calle.
        await EsperarAQueUCalleAsync();
        if (_escena != null && !_despidiendo && !_despedidaEnCurso)
        {
            LogBus.Log("encuentro", "la despedida no cerró su turno en 14 s: la escena se va igual");
            await DespedirLaEscenaAsync();
        }
    }

    /// <summary>
    /// La escena se va y la carita de verdad queda donde estaba la grande, y vuela a su sitio.
    /// </summary>
    private async Task DespedirLaEscenaAsync()
    {
        var escena = _escena;
        if (escena == null || _despidiendo) return;
        _despidiendo = true;
        try
        {
            double lado = CollapsedFace.ActualWidth > 0 ? CollapsedFace.ActualWidth : 66;
            // «EMPEZAR» LO PULSA Ü: nadie tuvo que pulsar nada en todo el encuentro, y tampoco para salir.
            if (_encuentro is { Hecho: true }) await escena.PulsarElFinalAsync();
            await escena.EncogerLaCaraAsync(lado);

            // La de verdad aparece EXACTAMENTE donde está la de la escena, y entonces la escena se apaga.
            var casa = _casaDeLaCarita ?? (Left, Top);
            var centro = escena.CentroDeLaCara();
            var enVentana = CollapsedFace.TranslatePoint(new Point(lado / 2, lado / 2), this);
            if (double.IsNaN(enVentana.X) || enVentana == default) enVentana = new Point(ActualWidth / 2, ActualHeight / 2);
            Vuelo.Termina();
            Left = centro.X - enVentana.X;
            Top = centro.Y - enVentana.Y;
            Show();
            Topmost = false; Topmost = true;   // por encima del telón, que se está apagando
            await escena.SalirAsync(laDeVerdadYaEsta: true);
            MoverConMuelle(casa.Left, casa.Top);
            _muelle?.Show();
        }
        catch (Exception e)
        {
            LogBus.Log("encuentro", $"la despedida tropezó: {e.GetType().Name}: {e.Message}");
            try { escena.Close(); } catch { }
            ColocarVentana();
            Show();
            _muelle?.Show();
        }
        finally
        {
            _escena = null;
            _despidiendo = false;
            _despedidaEnCurso = false;
            _ultimoDichoEnLaEscena = "";
            _dichoAlTerminar = null;
            _cerradoSinVoz = false;
            _dejando = false;
            bool hecho = _encuentro?.Hecho == true;
            _encuentro = null;
            // El guion y las herramientas de conocerse se van; entran el alma y lo del rol.
            ConversacionEnVivo.HerramientasDeLaPersona = HerramientasDelRol.Para(_rol, enEncuentro: false);
            // LA VOZ SE CIERRA CON LA ESCENA, y no se le cambia el modo en caliente. Se probó: con GPT-Live el
            // cambio de instrucciones a media sesión admite 500 tokens y el servidor lo rechaza («Context
            // append text must not exceed 500 tokens», 2026-10-01), así que la sesión se quedaba con el guion
            // del encuentro —«no uses ninguna otra herramienta»— hasta que alguien la cerrara. La despedida
            // dice «para hablarme basta con tocarme»: la siguiente sesión abre ya con el alma y lo del rol,
            // y nadie se queda con un micrófono abierto que no pidió.
            await CerrarLaVozDelEncuentroAsync();
            if (_vivo != null) { _vivo.NoSeDejaInterrumpir = false; _vivo.LaAbrioLaApp = false; }   // en una charla normal, cortar a Ü es lo que se quiere
            _fraseDictada = null;
            _oidoEnEsteTurno = "";
            RefreshMood();
            LogBus.Log("encuentro", hecho ? "la escena se fue: la carita vuelve a su sitio" : "la escena se cerró sin terminar el encuentro");
        }
    }

    /// <summary>Se dejó a medias. Nada queda marcado: al siguiente arranque se vuelve a ofrecer.</summary>
    private async Task DejarElEncuentroAsync(string porque)
    {
        if (_encuentro is { Hecho: true }) { await DespedirLaEscenaAsync(); return; }
        LogBus.Log("encuentro", $"se deja: {porque}");
        _dejando = true;
        _encuentro?.Dejarlo();
        await CerrarLaVozDelEncuentroAsync();
        if (_escena != null) await DespedirLaEscenaAsync();
        else { _encuentro = null; ConversacionEnVivo.HerramientasDeLaPersona = HerramientasDelRol.Para(_rol, enEncuentro: false); }
    }

    // ── lo que la escena necesita ver de la voz ──────────────────────────────

    /// <summary>La conversación del encuentro va a la escena y no al notch. Devuelve si se la quedó.</summary>
    private bool LaEscenaOye(string texto, bool esDeU)
    {
        var escena = _escena;
        if (escena == null) return false;
        // LO QUE DICE Ü NO ENTRA POR AQUÍ: este acumulado trae la frase dos veces cuando hay audio —la que
        // escribe el delegado y la que dice la voz—. La escena la lee limpia en LaEscenaLee (promesa 768).
        if (esDeU) return true;
        // Lo primero que se oye de un turno: se apunta cuánto había delegado la voz hasta aquí (promesa 766).
        if (_oidoEnEsteTurno.Length == 0) _delegacionesAlHablar = _vivo?.Delegaciones ?? 0;
        _fraseDictada = null;   // ya le contestan: lo siguiente que diga Ü se lee de su voz
        _oidoEnEsteTurno = texto ?? "";
        escena.SeOyo(texto);
        return true;
    }

    /// <summary>Lo que Ü dice, una sola vez y sin marcas: es lo que se lee bajo la carita.</summary>
    private void LaEscenaLee(string texto)
    {
        var escena = _escena;
        if (escena == null || string.IsNullOrWhiteSpace(texto)) return;
        // EN PANTALLA NO SE TRANSCRIBE A Ü: va la pregunta corta del paso («el texto que se escribe debe ser
        // cortico y lo que hable el asistente sí debe ser largo», el dueño, 2026-10-01). Lo que dice se
        // apunta solo para saber cuándo terminó de despedirse.
        if (_fraseDictada != null) return;
        _ultimoDichoEnLaEscena = texto;
        _uDijoEnEsteTurno = true;
    }

    /// <summary>Ü dijo algo desde el último cierre de turno: sirve para saber si contestó ella sola (promesa 766).</summary>
    private bool _uDijoEnEsteTurno;

    /// <summary>
    /// Escribió en el cajón. Contesta al paso que está en pantalla, igual que si lo hubiera dicho
    /// (promesa 769).
    /// </summary>
    /// <remarks>
    /// EL NOMBRE Y EL ROL SE ANOTAN AQUÍ MISMO: no hay nada que interpretar, y así la respuesta se ve caer en
    /// la Memoria en el acto. Lo que cuenta de sí, con la voz abierta, se le pasa al delegado —por escrito,
    /// que es el camino que llega siempre—: él sabe separar un gusto de cómo quiere que le hablen. Sin voz se
    /// guarda con sus palabras.
    /// </remarks>
    private async Task AlEscribirEnLaEscenaAsync(string texto)
    {
        var encuentro = _encuentro;
        var escena = _escena;
        if (encuentro == null || escena == null || encuentro.Hecho) return;
        try
        {
            bool hayVoz = _vivo?.Viva == true && encuentro.Modo == ModoDelEncuentro.PorVoz;
            LogBus.Log("encuentro", $"escrito en el paso «{encuentro.Paso}» ({texto.Length} car.) · {(hayVoz ? "con voz" : "sin voz")}");
            if (hayVoz && encuentro.Paso == PasoDelEncuentro.SobreTi)
            {
                await _vivo!.EnviarTextoAsync(texto);
                return;
            }

            var antes = encuentro.Paso;
            encuentro.Escrito(texto);
            if (encuentro.Paso == antes && !encuentro.Hecho)
            {
                escena.Aviso(antes == PasoDelEncuentro.Rol ? "No te entendí: ¿estudiante o médico?" : "No te entendí. ¿Me lo repites?");
                return;
            }
            if (encuentro.Paso == PasoDelEncuentro.Cierre)
            {
                if (hayVoz) await _vivo!.EmpezarTuAsync(PrimerEncuentro.PieParaCerrar, soloTexto: escena.ConMicrofono == false);
                else encuentro.Terminar();
                return;
            }
            // La pregunta del paso siguiente: ya está en pantalla, y con voz además se dice.
            if (hayVoz && escena.ConMicrofono) await _vivo!.DecirTalCualAsync(PrimerEncuentro.FraseDelPaso(encuentro.Perfil));
        }
        catch (Exception e) { LogBus.Log("encuentro", $"lo escrito tropezó: {e.GetType().Name}: {e.Message}"); }
    }

    /// <summary>La frase que la app le dictó a la voz y todavía está sonando. Nulo si no hay ninguna.</summary>
    private string? _fraseDictada;

    private string _oidoEnEsteTurno = "";
    private int _delegacionesAlHablar;

    /// <summary>
    /// LA RED (promesa 766). La persona dijo algo, el turno se cerró, y la voz no se lo pasó al delegado:
    /// se lo pasa la app, por escrito, que es el camino que llega siempre.
    /// </summary>
    /// <remarks>
    /// SE ESPERA ANTES DE DARLO POR NO DELEGADO. El turno se cierra a los dos segundos de silencio, y la voz
    /// delega entre 3,1 y 3,9 s después de que la persona calle (medido con la sonda en cuatro frases,
    /// 2026-10-01). Adelantarse es pasarle dos veces lo mismo, y dos encargos son dos respuestas: con una
    /// red que esperaba 2,7 s Ü dijo «Ahora cuéntame de ti…» dos veces seguidas.
    ///
    /// DOS ESPERAS, SEGÚN LO QUE HIZO LA VOZ. Si CONTESTÓ ELLA SOLA —que es el fallo que vivió el dueño:
    /// «¿En qué te puedo ayudar?»— ya decidió no delegar, y se le pasa pronto. Si todavía NO HA DICHO NADA
    /// puede estar a punto de delegar, y se le da más tiempo: adelantarse ahí es lo que duplica.
    /// </remarks>
    private async Task PasarAlDelegadoSiNadieLoHizoAsync(PrimerEncuentro encuentro, int delegacionesAntes, string oido, bool laVozContestoSola)
    {
        try
        {
            await Task.Delay(laVozContestoSola ? 2500 : 6500);
            if (_encuentro != encuentro || encuentro.Hecho || _vivo?.Viva != true) return;
            string? recado = PrimerEncuentro.LoQueLaVozNoDelego(delegacionesAntes, _vivo.Delegaciones, oido);
            if (recado == null) return;
            await EsperarAQueUCalleAsync();
            if (_encuentro != encuentro || encuentro.Hecho || _vivo?.Viva != true) return;
            if (_vivo.Delegaciones > delegacionesAntes) return;   // llegó mientras se esperaba
            LogBus.Log("encuentro", $"la voz no le pasó al delegado lo que dijo la persona ({oido.Length} car.): se lo paso por escrito");
            await _vivo.EmpezarTuAsync(recado, soloTexto: false);
        }
        catch (Exception e) { LogBus.Log("encuentro", $"la red de lo dicho tropezó: {e.GetType().Name}: {e.Message}"); }
    }

    /// <summary>Un turno se cerró. Si era la despedida del encuentro, la escena se va.</summary>
    private bool AlCerrarUnTurnoEnLaEscena()
    {
        if (_escena == null) return false;
        _fraseDictada = null;   // lo siguiente que diga ya se lee de su voz
        string oido = _oidoEnEsteTurno;
        _oidoEnEsteTurno = "";
        bool uDijoAlgo = _uDijoEnEsteTurno;
        _uDijoEnEsteTurno = false;
        if (oido.Trim().Length > 0 && _encuentro is { Hecho: false, Modo: ModoDelEncuentro.PorVoz } enCurso && _escena.ConMicrofono)
            _ = PasarAlDelegadoSiNadieLoHizoAsync(enCurso, _delegacionesAlHablar, oido,
                laVozContestoSola: uDijoAlgo && (_vivo?.Delegaciones ?? 0) == _delegacionesAlHablar);
        // SOLO SI DESPUÉS DE TERMINAR DIJO ALGO: el turno que se cierra justo tras conocer_terminar puede ser
        // el de la herramienta, y la despedida viene en el siguiente. Irse ahí sería cortarla antes de empezar.
        bool yaSeDespidio = _dichoAlTerminar != null && _ultimoDichoEnLaEscena != _dichoAlTerminar;
        if (_encuentro is { Hecho: true } && yaSeDespidio && !_despidiendo && !_despedidaEnCurso)
            _ = DespedirTrasLaDespedidaAsync();
        return true;
    }

    /// <summary>Lo último que había dicho Ü cuando el encuentro terminó. Nulo mientras no haya terminado.</summary>
    private string? _dichoAlTerminar;

    private async Task DespedirTrasLaDespedidaAsync()
    {
        _despedidaEnCurso = true;
        // LO ÚLTIMO QUE DIJO TIENE QUE PODER OÍRSE Y LEERSE. El turno se cierra con el texto y el audio va
        // detrás: se espera a que deje de sonar. Y si no suena nada —la sesión va en texto— el tiempo lo
        // pone lo que hay que leer, no un número fijo: en la primera prueba la despedida duró un segundo
        // en pantalla (2026-10-01).
        bool sono = false;
        // Hasta 30 s: una despedida de tres frases dicha en voz alta pasa de los doce que había aquí.
        for (int i = 0; i < 200 && _vivo?.SigueSonando == true; i++) { sono = true; await Task.Delay(150); }
        int letras = _ultimoDichoEnLaEscena.Length;
        await Task.Delay(sono ? 900 : Math.Clamp(letras * 55, 2600, 8000));
        await DespedirLaEscenaAsync();
    }

    private bool _despedidaEnCurso;
    private string _ultimoDichoEnLaEscena = "";

    // ── el panel de grabar, según quién sea ──────────────────────────────────

    /// <summary>
    /// El icono del collar. Para un médico, la consulta; para un estudiante, sus clases; y para quien
    /// todavía no ha dicho qué es, el encuentro que lo pregunta.
    /// </summary>
    private bool AbrirElPanelDeGrabarSiNoEsDeMedico()
    {
        if (_rol == Rol.Medico) return false;
        if (_rol == Rol.SinElegir)
        {
            PlayTick();
            _ = EmpezarElEncuentroAsync("se tocó el collar sin haber elegido rol");
            return true;
        }
        return false;
    }
}
