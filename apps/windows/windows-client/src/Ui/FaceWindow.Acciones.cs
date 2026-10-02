using System.Windows;
using U.WindowsClient.Diagnostics;
using U.WindowsClient.Voice;

namespace U.WindowsClient.Ui;

/// <summary>
/// EL ✓ COMO GATILLO, Y LO QUE SE VE CUANDO Ü APRENDE (spec 084). Archivo parcial aparte: es lo que la carita
/// cuelga en <see cref="Clinical.PuenteDeAcciones"/> y la tarjetita de «esto aprendí».
/// </summary>
public partial class FaceWindow
{
    private readonly LoQueAprendi _loQueAprendi = new();
    private AprendiendoWindow? _aprendiendo;
    private bool _ejecutandoAccion;

    /// <summary>Cuánto se espera a que quien actúa termine una acción aprobada. Registrar un paciente tarda 30–40 s medidos.</summary>
    private static readonly TimeSpan PlazoDeUnaAccion = TimeSpan.FromMinutes(5);

    /// <summary>
    /// Conecta lo aprendido con su indicador y cuelga el puente de las acciones. Se llama una vez, cuando la voz y
    /// su almacén ya existen.
    /// </summary>
    private void ConectarLoAprendido(LoAprendido aprendido)
    {
        if (_vivo == null) return;
        aprendido.Aprendio += _loQueAprendi.Anotar;
        _vivo.RepasoEmpieza += _loQueAprendi.Empieza;
        _vivo.RepasoTermina += _loQueAprendi.Termina;
        // BeginInvoke: quien avisa es el hilo del repaso o el de una herramienta, y pintar es cosa de la interfaz.
        _loQueAprendi.Cambio += vista => Dispatcher.BeginInvoke(() =>
        {
            try
            {
                _aprendiendo ??= new AprendiendoWindow();
                _aprendiendo.Mostrar(vista);
            }
            catch (Exception e) { LogBus.Log("aprendido", $"no pude pintar el indicador de lo aprendido: {e.GetType().Name}: {e.Message}"); }
        });
        Closed += (_, __) => _aprendiendo?.Close();

        Clinical.PuenteDeAcciones.Proponer = ProponerAccionAsync;
        Clinical.PuenteDeAcciones.Ejecutar = EjecutarAccionAsync;
    }

    /// <summary>
    /// LA CARITA SE ACERCA A LA SECCIÓN Y PIENSA: «¿qué acción quiere que yo ejecute con esta información?»,
    /// contrastada con lo que le enseñaron. No toca nada: devuelve la propuesta para que la persona la apruebe.
    /// </summary>
    private async Task<LaAccionDeLaNota.Propuesta> ProponerAccionAsync(string informacion, bool deVarias, Rect? donde, CancellationToken ct)
    {
        var habilidades = _vivo?.Aprendido?.Habilidades() ?? Array.Empty<LoAprendido.Habilidad>();
        if (donde is { } caja)
        {
            // Sentada en la nota no puede acercarse a nada: sale, y va junto a la sección.
            SacandoLaCaritaDelAnfitrion();
            Visitar(caja);
        }
        if (LaAccionDeLaNota.SinNadaAprendido(habilidades) is { } nada)
        {
            LogBus.Log("accion", "✓ pulsado y no hay ninguna habilidad aprendida: no se llama al modelo");
            return nada;
        }

        var reloj = System.Diagnostics.Stopwatch.StartNew();
        SetWorking(true);
        try
        {
            string respuesta = await Cardio.ClienteCardio.EnviarAOpenAIAsync(LaAccionDeLaNota.Peticion(habilidades, informacion, deVarias), ct);
            var propuesta = LaAccionDeLaNota.Leer(respuesta, habilidades);
            // La información de la nota NO va al log: puede ser de un paciente. Va cuánta era y qué se propuso.
            LogBus.Log("accion", propuesta.Hay
                ? $"pensada en {reloj.ElapsedMilliseconds} ms sobre {informacion.Length} caracteres y {habilidades.Count} habilidad(es): «{propuesta.Accion}» con «{propuesta.Habilidad}»"
                : $"pensada en {reloj.ElapsedMilliseconds} ms sobre {informacion.Length} caracteres y {habilidades.Count} habilidad(es): no hay acción — {propuesta.Porque}");
            return propuesta;
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            // LA CADENA ENTERA (patrón nº3): «no pude pensarlo» sin el motivo no distingue la red de una respuesta rota.
            var motivo = new System.Text.StringBuilder();
            for (var x = e; x != null; x = x.InnerException) motivo.Append(motivo.Length > 0 ? " ← " : "").Append(x.GetType().Name).Append(": ").Append(x.Message);
            LogBus.Log("accion", $"no se pudo pensar la acción: {motivo}");
            return new LaAccionDeLaNota.Propuesta(false, "", "", $"No pude pensarlo ({e.Message}). Vuelve a pulsar ✓.");
        }
        finally { SetWorking(false); }
    }

    /// <summary>
    /// LA ACCIÓN APROBADA, EJECUTADA: la orden entra por el mismo camino que lo escrito en el chat —a quien actúa, con
    /// sus manos y sus habilidades—, y se espera a que devuelva su turno para contar cómo quedó.
    /// </summary>
    private async Task<string> EjecutarAccionAsync(LaAccionDeLaNota.Propuesta propuesta, string informacion, IProgress<string> progreso, CancellationToken ct)
    {
        if (!propuesta.Hay) return "no hay ninguna acción aprobada que ejecutar.";
        if (_vivo == null) return "la voz no está lista todavía: sin ella no hay quien ejecute.";
        if (_ejecutandoAccion) return "ya hay una acción en marcha; espera a que termine.";
        _ejecutandoAccion = true;

        var vivo = _vivo;
        var reloj = System.Diagnostics.Stopwatch.StartNew();
        string devuelto = "", dicho = "";
        long senal = 0;
        void AlDevolver(string texto) { devuelto = texto; Interlocked.Exchange(ref senal, Environment.TickCount64); }
        void AlTranscribir(string texto, bool esDeU) { if (esDeU) dicho = texto; }
        // Sin delegado (GPT Realtime), quien actúa es la misma sesión: su turno cerrado con algo dicho es el final.
        void AlCerrar() { if (!vivo.ActuaUnDelegado && dicho.Length > 0) { devuelto = dicho; Interlocked.Exchange(ref senal, Environment.TickCount64); } }
        void AlHacer(string texto, bool listo) { if (!listo && texto.Length > 0) progreso.Report(texto.Length > 140 ? texto[..140] + "…" : texto); }

        vivo.DevolvioQuienActua += AlDevolver;
        vivo.Transcribe += AlTranscribir;
        vivo.TurnoCerrado += AlCerrar;
        vivo.Accion += AlHacer;
        try
        {
            LogBus.Log("accion", $"aprobada: «{propuesta.Accion}» con «{propuesta.Habilidad}» ({informacion.Length} caracteres de información)");
            SacandoLaCaritaDelAnfitrion();   // va a trabajar: sentada en la nota no puede ir a ningún sitio
            progreso.Report("Voy a hacerlo…");
            await EnviarTextoDesdeElNotchAsync(LaAccionDeLaNota.Orden(propuesta, informacion));
            if (!vivo.Viva) { LogBus.Log("accion", "terminó: la voz no abrió, la orden no salió"); return "no pude abrir la conversación con quien ejecuta: la orden no salió."; }

            while (true)
            {
                await Task.Delay(400, ct);
                long s = Interlocked.Read(ref senal);
                // DEVOLVIÓ, Y PASARON 2,5 s SIN QUE VUELVA A TRABAJAR NI QUEDE UNA META ABIERTA: con una meta activa
                // quien actúa devuelve un turno y sigue (spec 082), y contarlo como terminado sería mentir.
                if (s != 0 && Environment.TickCount64 - s > 2500 && !vivo.MetaActiva) break;
                if (!vivo.Viva)
                {
                    LogBus.Log("accion", $"terminó: la conversación se cerró a los {reloj.ElapsedMilliseconds} ms sin que quien actúa devolviera nada");
                    return "la conversación se cerró antes de terminar: no sé cómo quedó. Mira la pantalla.";
                }
                if (reloj.Elapsed > PlazoDeUnaAccion)
                {
                    LogBus.Log("accion", $"terminó: pasaron {PlazoDeUnaAccion.TotalMinutes:0} min sin que quien actúa devolviera su turno");
                    return $"pasaron {PlazoDeUnaAccion.TotalMinutes:0} minutos y no terminó: no sé cómo quedó. Mira la pantalla.";
                }
            }
            LogBus.Log("accion", $"terminó: quien actúa devolvió su turno a los {reloj.ElapsedMilliseconds} ms ({devuelto.Length} caracteres)");
            return devuelto.Trim().Length > 0 ? devuelto.Trim() : "terminó sin contar nada.";
        }
        catch (OperationCanceledException) { LogBus.Log("accion", "terminó: cancelada"); return "cancelada."; }
        catch (Exception e)
        {
            LogBus.Log("accion", $"terminó: reventó: {e.GetType().Name}: {e.Message}");
            return $"se detuvo: {e.Message}";
        }
        finally
        {
            vivo.DevolvioQuienActua -= AlDevolver;
            vivo.Transcribe -= AlTranscribir;
            vivo.TurnoCerrado -= AlCerrar;
            vivo.Accion -= AlHacer;
            _ejecutandoAccion = false;
        }
    }

    // ── las órdenes de prueba del ✓ ──────────────────────────────────────────

    private LaAccionDeLaNota.Propuesta? _propuestaDePrueba;
    private string _informacionDePrueba = "";

    /// <summary>u_nota y u_aprobar (promesa 825): el ✓ y el botón de aprobar, sin ventana, por el mismo puente.</summary>
    private string AtenderElCheckDePrueba(string tool, IReadOnlyDictionary<string, string> args)
    {
        if (tool == Mcp.OrdenesDePrueba.Nota)
        {
            string texto = args.TryGetValue("texto", out var t) ? t.Trim() : "";
            if (texto.Length == 0) return "falta «texto»: la información de la sección.";
            bool todo = args.TryGetValue("todo", out var v) && v.Trim() == "1";
            var tarea = Dispatcher.Invoke(() => ProponerAccionAsync(texto, todo, null, CancellationToken.None));
            if (!tarea.Wait(TimeSpan.FromSeconds(90))) return "no terminó de pensar en 90 s.";
            _propuestaDePrueba = tarea.Result;
            _informacionDePrueba = texto;
            var p = tarea.Result;
            return $"hay={(p.Hay ? "si" : "no")}\naccion={p.Accion}\nhabilidad={p.Habilidad}\nporque={p.Porque}";
        }
        var propuesta = _propuestaDePrueba;
        if (propuesta is not { Hay: true }) return "no hay ninguna propuesta que aprobar: llama antes a u_nota.";
        string informacion = _informacionDePrueba;
        Dispatcher.BeginInvoke(() => _ = EjecutarAccionAsync(propuesta, informacion, new Progress<string>(_ => { }), CancellationToken.None));
        return $"aprobada: «{propuesta.Accion}»";
    }
}
