using U.WindowsClient.Diagnostics;

namespace U.WindowsClient.Clases;

/// <summary>En qué punto va la grabación de una clase.</summary>
public enum EstadoDeGrabacion
{
    SinEmpezar,
    Grabando,
    /// <summary>Se paró de grabar y lo dicho ya está en el cuaderno.</summary>
    Transcrita,
    Organizando,
    /// <summary>Los apuntes están hechos y guardados con la clase.</summary>
    Lista,
    /// <summary>Algo falló. El porqué está en <see cref="GrabacionDeClase.Motivo"/>.</summary>
    Fallida,
}

/// <summary>
/// UNA CLASE, de empezar a grabar a tener los apuntes. La misma forma que <see cref="Clinical.Consulta"/>
/// —abrir el micrófono, parar, organizar— con otro destino: el cuaderno del estudiante, no el
/// backend clínico.
/// </summary>
/// <remarks>
/// LO DICHO SE GUARDA ANTES DE PEDIR LOS APUNTES, y es la promesa 757. Una clase dura dos horas y no
/// se repite. Si organizar falla —sin red al salir del aula, el modelo caído— la clase tiene que
/// seguir ahí con su transcripción, y reintentar tiene que trabajar sobre ESA clase, no crear otra.
///
/// FALLAR NO ES TERMINAR (la misma regla que la promesa 91 de la consulta): el motivo queda nombrado
/// y el estado es <see cref="EstadoDeGrabacion.Fallida"/>, nunca «lista» con unos apuntes vacíos.
///
/// EL MICRÓFONO, EL DICTADO Y EL ORGANIZADOR SE INYECTAN como funciones, para que el contrato juzgue
/// esta máquina sin audio, sin red y sin pantalla.
///
/// LO QUE SE DIJO EN CLASE NO VA AL LOG: tamaños y estados, nunca texto.
/// </remarks>
public sealed class GrabacionDeClase
{
    private readonly CuadernoDeClases _cuaderno;
    private readonly Func<CancellationToken, Task<bool>> _abrirMicrofono;
    private readonly Func<Task<string>> _pararYRecogerLoDicho;
    private readonly Func<string, CancellationToken, Task<string>> _enviar;
    private readonly string _modelo;
    private readonly Func<DateTimeOffset> _reloj;
    private readonly Func<string>? _loDichoHastaAhora;
    private readonly object _candadoDeGuardado = new();
    private Timer? _guardado;
    private DateTimeOffset _empezo;

    /// <summary>Cada cuánto se guarda lo que va de clase mientras se graba.</summary>
    public static readonly TimeSpan CadaCuantoSeGuarda = TimeSpan.FromSeconds(20);

    /// <param name="enviar">Manda un cuerpo al modelo y devuelve su respuesta tal cual.</param>
    /// <param name="loDichoHastaAhora">
    /// Lo que se lleva oído en la grabación en curso. Con esto, la clase se va guardando mientras se
    /// graba (promesa 761); sin esto, solo se guarda al parar.
    /// </param>
    public GrabacionDeClase(CuadernoDeClases cuaderno,
        Func<CancellationToken, Task<bool>> abrirMicrofono,
        Func<Task<string>> pararYRecogerLoDicho,
        Func<string, CancellationToken, Task<string>> enviar,
        string? modelo = null,
        Func<DateTimeOffset>? reloj = null,
        Func<string>? loDichoHastaAhora = null)
    {
        _cuaderno = cuaderno;
        _abrirMicrofono = abrirMicrofono;
        _pararYRecogerLoDicho = pararYRecogerLoDicho;
        _enviar = enviar;
        _modelo = string.IsNullOrWhiteSpace(modelo) ? OrganizadorDeClases.ModeloDeLaApp() : modelo.Trim();
        _reloj = reloj ?? (() => DateTimeOffset.Now);
        _loDichoHastaAhora = loDichoHastaAhora;
    }

    public EstadoDeGrabacion Estado { get; private set; } = EstadoDeGrabacion.SinEmpezar;

    /// <summary>Por qué está donde está, cuando falló. Vacío mientras todo va bien.</summary>
    public string Motivo { get; private set; } = "";

    /// <summary>La clase en curso. Existe desde que se para de grabar, aunque organizar falle.</summary>
    public Clase? Clase { get; private set; }

    public event Action<EstadoDeGrabacion>? Cambio;

    /// <summary>Abre el micrófono y empieza. Devuelve si empezó; si no, el porqué queda en <see cref="Motivo"/>.</summary>
    public async Task<bool> EmpezarAsync(CancellationToken ct = default)
    {
        if (Estado is EstadoDeGrabacion.Grabando or EstadoDeGrabacion.Organizando)
        {
            Motivo = "ya hay una clase grabándose";
            return false;
        }

        try
        {
            // SE MIRA SI ABRIÓ. Declarar «grabando» con el dictado sin conectar es dejar a alguien dos
            // horas hablándole a una app que no escucha (le pasó a la consulta el 2026-09-01).
            if (!await _abrirMicrofono(ct))
            {
                Fallar("no se pudo abrir el dictado: no hubo conexión con el servicio de transcripción. "
                     + "Comprueba la red y vuelve a pulsar grabar");
                return false;
            }
        }
        catch (Exception e)
        {
            Fallar($"no se pudo empezar: {Cadena(e)}");
            return false;
        }

        _empezo = _reloj();
        Clase = null;
        Motivo = "";
        Pasar(EstadoDeGrabacion.Grabando);
        LogBus.Log("clase", "grabando");
        if (_loDichoHastaAhora != null)
            _guardado = new Timer(_ => GuardarLoQueVa(), null, CadaCuantoSeGuarda, CadaCuantoSeGuarda);
        return true;
    }

    /// <summary>
    /// Guarda en el cuaderno lo que se lleva oído. Lo llama un reloj cada veinte segundos mientras se
    /// graba; al parar, es esta misma clase la que se completa.
    /// </summary>
    /// <remarks>
    /// POR QUÉ (2026-10-01, al probarlo). Una clase dura dos horas y lo dicho solo se guardaba al
    /// parar: un portátil que se queda sin batería a la hora y media, o una Ü que se cierra, se
    /// llevaba la clase entera. «Una clase grabada no se pierde» (707) solo valía para las que
    /// llegaban a terminar. Ahora lo peor que se pierde son los últimos veinte segundos.
    /// </remarks>
    public void GuardarLoQueVa()
    {
        if (Estado != EstadoDeGrabacion.Grabando || _loDichoHastaAhora == null) return;
        try
        {
            string dicho = _loDichoHastaAhora() ?? "";
            if (string.IsNullOrWhiteSpace(dicho)) return;   // sin una palabra no se crea una clase vacía
            lock (_candadoDeGuardado)
            {
                if (Estado != EstadoDeGrabacion.Grabando) return;   // se paró mientras se esperaba el candado
                int segundos = (int)Math.Max(0, (_reloj() - _empezo).TotalSeconds);
                if (Clase == null) Clase = _cuaderno.Abrir(dicho, _empezo, segundos);
                else
                {
                    if (Clase.Transcripcion == dicho) return;
                    Clase.Transcripcion = dicho;
                    Clase.DuracionSegundos = segundos;
                    _cuaderno.Guardar(Clase);
                }
            }
        }
        catch (Exception e)
        {
            // Que no se pueda guardar ahora no para la grabación: se dice, y se intenta en el siguiente.
            LogBus.Log("clase", $"no pude guardar lo que va de clase: {e.GetType().Name}: {e.Message}");
        }
    }

    private void SoltarElReloj()
    {
        try { _guardado?.Dispose(); } catch { }
        _guardado = null;
    }

    /// <summary>Para, guarda lo dicho en el cuaderno y pide los apuntes.</summary>
    public async Task TerminarAsync(CancellationToken ct = default)
    {
        if (Estado != EstadoDeGrabacion.Grabando)
        {
            Motivo = "no hay ninguna clase grabándose";
            return;
        }

        SoltarElReloj();
        string dicho;
        try { dicho = await _pararYRecogerLoDicho() ?? ""; }
        catch (Exception e)
        {
            // Lo que ya se había ido guardando sigue en el cuaderno: no se pierde por no poder recoger el final.
            Fallar($"no se pudo recoger lo dicho: {Cadena(e)}"
                 + (Clase != null ? ". Lo que se había guardado hasta ese momento sigue en el cuaderno" : ""));
            return;
        }

        // Si el final llega vacío pero ya había algo guardado, la clase es lo guardado.
        if (string.IsNullOrWhiteSpace(dicho) && Clase != null) dicho = Clase.Transcripcion;
        if (string.IsNullOrWhiteSpace(dicho))
        {
            // Sin una palabra no hay clase que guardar, y se dice de qué lado está el problema.
            Fallar("el dictado estaba conectado pero no llegó ni una palabra: revisa que el micrófono "
                 + "correcto esté elegido y que esté cerca de quien habla");
            return;
        }

        try
        {
            lock (_candadoDeGuardado)
            {
                int segundos = (int)Math.Max(0, (_reloj() - _empezo).TotalSeconds);
                // LA MISMA CLASE que se iba guardando, completa: nunca una segunda (promesa 761).
                if (Clase == null) Clase = _cuaderno.Abrir(dicho, _empezo, segundos);
                else
                {
                    Clase.Transcripcion = dicho;
                    Clase.DuracionSegundos = segundos;
                    _cuaderno.Guardar(Clase);
                }
            }
        }
        catch (Exception e)
        {
            Fallar($"no se pudo guardar la clase en el disco: {Cadena(e)}");
            return;
        }
        LogBus.Log("clase", $"guardada · {Clase.Id} · {dicho.Length} caracteres · {Clase.DuracionSegundos} s");
        Pasar(EstadoDeGrabacion.Transcrita);

        await OrganizarAsync(ct);
    }

    /// <summary>
    /// Vuelve a pedir los apuntes sobre la MISMA clase. Solo tiene sentido tras un fallo con la clase
    /// ya guardada; en cualquier otro punto contesta que no, con su porqué.
    /// </summary>
    public async Task<bool> ReintentarAsync(CancellationToken ct = default)
    {
        if (Estado != EstadoDeGrabacion.Fallida || Clase == null)
        {
            Motivo = "no hay ninguna clase guardada a la que le falten los apuntes";
            return false;
        }
        await OrganizarAsync(ct);
        return Estado == EstadoDeGrabacion.Lista;
    }

    /// <summary>
    /// Pide los apuntes de una clase que ya está en el cuaderno y se quedó sin ellos: la que se cortó a
    /// mitad, o una en la que organizar falló y no se reintentó ese día.
    /// </summary>
    public async Task<bool> OrganizarEstaAsync(Clase clase, CancellationToken ct = default)
    {
        if (Estado is EstadoDeGrabacion.Grabando or EstadoDeGrabacion.Organizando)
        {
            Motivo = "hay una clase grabándose u organizándose: termina esa primero";
            return false;
        }
        if (string.IsNullOrWhiteSpace(clase.Transcripcion))
        {
            Motivo = "esa clase no tiene nada dicho que organizar";
            return false;
        }
        Clase = clase;
        await OrganizarAsync(ct);
        return Estado == EstadoDeGrabacion.Lista;
    }

    /// <summary>Archiva esta grabación para poder empezar otra. La del cuaderno no se toca.</summary>
    public void Cerrar()
    {
        SoltarElReloj();
        Clase = null;
        Motivo = "";
        Pasar(EstadoDeGrabacion.SinEmpezar);
    }

    private async Task OrganizarAsync(CancellationToken ct)
    {
        var clase = Clase!;
        Motivo = "";
        Pasar(EstadoDeGrabacion.Organizando);
        try
        {
            string respuesta = await _enviar(OrganizadorDeClases.Cuerpo(_modelo, clase.Transcripcion), ct);
            var apuntes = OrganizadorDeClases.Leer(respuesta);
            clase.Apuntes = apuntes;
            if (apuntes.Titulo.Length > 0) clase.Titulo = apuntes.Titulo;
            _cuaderno.Guardar(clase);
            LogBus.Log("clase", $"apuntes listos · {clase.Id} · {apuntes.Secciones.Count} sección(es)");
            Pasar(EstadoDeGrabacion.Lista);
        }
        catch (Exception e)
        {
            Fallar("la clase quedó guardada, pero no se pudieron organizar los apuntes: " + Cadena(e));
        }
    }

    private void Fallar(string motivo)
    {
        SoltarElReloj();
        Motivo = motivo;
        LogBus.Log("clase", $"falló · {motivo}");
        Pasar(EstadoDeGrabacion.Fallida);
    }

    private void Pasar(EstadoDeGrabacion nuevo)
    {
        Estado = nuevo;
        Cambio?.Invoke(nuevo);
    }

    /// <summary>La cadena entera, no solo el mensaje de fuera (patrón nº3).</summary>
    private static string Cadena(Exception e)
    {
        var partes = new List<string>();
        for (var x = e; x != null; x = x.InnerException) partes.Add(x.Message);
        return string.Join(" ← ", partes.Distinct());
    }
}
