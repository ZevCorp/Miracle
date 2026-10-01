using System.Runtime.InteropServices;
using NAudio.CoreAudioApi;
using NAudio.Wave;

namespace U.WindowsClient.Voice;

/// <summary>
/// EL MICRÓFONO DEL COMPUTADOR, PREPARADO DE ANTEMANO: inicializado cuando no se usa, para que
/// encender la voz solo tenga que arrancarlo.
/// </summary>
/// <remarks>
/// ABRIR EL MICRÓFONO COSTABA MEDIO SEGUNDO Y CASI TODO ERA PREPARARLO. Medido el 2026-10-01 sobre
/// «Varios micrófonos (Realtek)»: inicializar el cliente de captura, 449 ms; arrancarlo ya
/// inicializado, 240–257 ms, también tras veinte segundos parado; pararlo, 0–1 ms. Con la API vieja
/// (WaveIn) las dos cosas iban juntas dentro del clic: 319–512 ms, 546 tras quince segundos de reposo.
/// Con WASAPI a secas, lo mismo (333–584): no era la API, era inicializar.
///
/// PREPARADO NO ES OYENDO. Un cliente inicializado y sin arrancar no capta nada, y Windows no lo cuenta
/// como micrófono en uso: el registro que enciende su indicador
/// (<c>CapabilityAccessManager\ConsentStore\microphone</c>) solo marca la app entre arrancar y parar
/// (medido ese día: «no consta» inicializado, «en uso» arrancado, «no en uso» al parar). Por eso se
/// puede tener preparado desde que la app nace sin que nadie esté siendo oído.
///
/// LO QUE CUESTA: entrega el formato de la mezcla del equipo y no el del protocolo; la conversión es
/// de <see cref="DeLaMezclaAPcm16"/>. Y sigue al dispositivo con el que se preparó: si el micrófono
/// por defecto cambia, hay que preparar otro (<see cref="EsElDeAhora"/>).
///
/// Los objetos COM de aquí se crean y se usan en hilos sin apartamento de interfaz: se prepara desde
/// una tarea, nunca desde el hilo de la ventana.
/// </remarks>
internal sealed class MicrofonoPreparado : IDisposable
{
    private readonly MMDevice _dispositivo;
    private readonly AudioClient _cliente;
    private readonly AudioCaptureClient _captura;
    private readonly EventWaitHandle _aviso;
    private readonly WaveFormat _mezcla;
    private readonly int _ritmoDestino;
    private Thread? _hilo;
    private volatile bool _captando;

    /// <summary>KSDATAFORMAT_SUBTYPE_IEEE_FLOAT: lo que dice una mezcla «extensible» cuando es coma flotante.</summary>
    private static readonly Guid ComaFlotante = new("00000003-0000-0010-8000-00aa00389b71");

    /// <summary>El identificador del dispositivo con el que se preparó.</summary>
    public string Id { get; }
    public string Nombre { get; }

    private MicrofonoPreparado(MMDevice dispositivo, AudioClient cliente, AudioCaptureClient captura,
        EventWaitHandle aviso, WaveFormat mezcla, int ritmoDestino)
    {
        _dispositivo = dispositivo; _cliente = cliente; _captura = captura; _aviso = aviso;
        _mezcla = mezcla; _ritmoDestino = ritmoDestino;
        Id = dispositivo.ID;
        Nombre = dispositivo.FriendlyName;
    }

    /// <summary>
    /// Inicializa el micrófono por defecto y lo deja parado. Tarda lo que tarda inicializar (~450 ms
    /// medidos). Lanza si Windows no lo permite o el formato no es el esperado: quien llama decide
    /// con qué se queda.
    /// </summary>
    public static MicrofonoPreparado Preparar(int ritmoDestino)
    {
        using var enumerador = new MMDeviceEnumerator();
        var dispositivo = enumerador.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Console);
        AudioClient? cliente = null;
        EventWaitHandle? aviso = null;
        try
        {
            cliente = dispositivo.AudioClient;
            var mezcla = cliente.MixFormat;
            bool flotante = mezcla.BitsPerSample == 32
                && (mezcla.Encoding == WaveFormatEncoding.IeeeFloat
                    || (mezcla is WaveFormatExtensible ext && ext.SubFormat == ComaFlotante));
            if (!flotante)
                throw new NotSupportedException($"la mezcla de «{dispositivo.FriendlyName}» no es coma flotante de 32 bits ({mezcla})");

            // 100 ms de buffer (en unidades de 100 ns): de sobra para un hilo que recoge cada 10 ms.
            cliente.Initialize(AudioClientShareMode.Shared, AudioClientStreamFlags.EventCallback, 1_000_000, 0, mezcla, Guid.Empty);
            aviso = new EventWaitHandle(false, EventResetMode.AutoReset);
            cliente.SetEventHandle(aviso.SafeWaitHandle.DangerousGetHandle());
            var captura = cliente.AudioCaptureClient;
            return new MicrofonoPreparado(dispositivo, cliente, captura, aviso, mezcla, ritmoDestino);
        }
        catch
        {
            try { cliente?.Dispose(); } catch { }
            try { aviso?.Dispose(); } catch { }
            try { dispositivo.Dispose(); } catch { }
            throw;
        }
    }

    /// <summary>
    /// Si el micrófono por defecto de Windows sigue siendo el que se preparó. Enchufar unos audífonos lo
    /// cambia, y un cliente preparado para el de antes seguiría oyendo por el de antes.
    /// </summary>
    public bool EsElDeAhora()
    {
        try
        {
            using var enumerador = new MMDeviceEnumerator();
            using var ahora = enumerador.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Console);
            return ahora.ID == Id;
        }
        catch { return false; }
    }

    /// <summary>
    /// Arranca la captación. Vuelve cuando el dispositivo ya graba (~250 ms medidos). Cada
    /// <paramref name="msPorTrozo"/> de audio llega a <paramref name="alTrozo"/> ya convertido; si la
    /// captación se cae sola —el dispositivo desaparece—, se avisa por <paramref name="alPerderse"/>.
    /// </summary>
    public void Arrancar(Action<byte[]> alTrozo, Action<string> alPerderse, int msPorTrozo = 100)
    {
        if (_captando) return;
        var conversor = new DeLaMezclaAPcm16(_mezcla.SampleRate, _mezcla.Channels, _ritmoDestino);
        _aviso.Reset();
        _cliente.Start();
        _captando = true;
        _hilo = new Thread(() => Captar(conversor, alTrozo, alPerderse, msPorTrozo)) { IsBackground = true, Name = "el micrófono de Ü" };
        _hilo.Start();
    }

    private void Captar(DeLaMezclaAPcm16 conversor, Action<byte[]> alTrozo, Action<string> alPerderse, int msPorTrozo)
    {
        int bytesPorCuadro = _mezcla.Channels * 4;
        int bytesPorTrozo = _ritmoDestino * 2 * msPorTrozo / 1000;
        var crudo = new byte[bytesPorCuadro * 4800];
        var pendiente = new byte[bytesPorTrozo * 4];
        int hay = 0;
        try
        {
            while (_captando)
            {
                _aviso.WaitOne(100);
                while (_captando && _captura.GetNextPacketSize() > 0)
                {
                    IntPtr p = _captura.GetBuffer(out int cuadros, out AudioClientBufferFlags banderas);
                    int bytes = cuadros * bytesPorCuadro;
                    if (crudo.Length < bytes) crudo = new byte[bytes];
                    // Un paquete marcado como silencio trae basura en el buffer: se pone a cero, no se copia.
                    if ((banderas & AudioClientBufferFlags.Silent) != 0) Array.Clear(crudo, 0, bytes);
                    else Marshal.Copy(p, crudo, 0, bytes);
                    _captura.ReleaseBuffer(cuadros);

                    byte[] pcm = conversor.Convertir(crudo, bytes);
                    if (hay + pcm.Length > pendiente.Length) Array.Resize(ref pendiente, (hay + pcm.Length) * 2);
                    Buffer.BlockCopy(pcm, 0, pendiente, hay, pcm.Length);
                    hay += pcm.Length;

                    // TROZOS DEL TAMAÑO DE SIEMPRE (100 ms): quien los recibe —la compuerta de eco, el
                    // cancelador, el servidor— se midió con ese tamaño, y aquí solo cambia de dónde vienen.
                    int desde = 0;
                    while (hay - desde >= bytesPorTrozo)
                    {
                        var trozo = new byte[bytesPorTrozo];
                        Buffer.BlockCopy(pendiente, desde, trozo, 0, bytesPorTrozo);
                        desde += bytesPorTrozo;
                        alTrozo(trozo);
                    }
                    if (desde > 0) { Buffer.BlockCopy(pendiente, desde, pendiente, 0, hay - desde); hay -= desde; }
                }
            }
        }
        catch (Exception e)
        {
            if (!_captando) return;   // se estaba parando: el fallo es el de pararlo a mitad de una lectura
            _captando = false;
            string causa = "";
            for (Exception? x = e; x != null; x = x.InnerException)
                causa += (causa.Length > 0 ? " ← " : "") + $"{x.GetType().Name}: {x.Message}";
            alPerderse(causa);
        }
    }

    /// <summary>Deja de captar y lo deja listo para volver a arrancar. Parar tarda 0–1 ms (medido).</summary>
    public void Parar()
    {
        bool captaba = _captando;
        _captando = false;
        try { _aviso.Set(); } catch { }
        try { _cliente.Stop(); } catch { }
        if (_hilo != null && _hilo != Thread.CurrentThread) _hilo.Join(600);
        _hilo = null;
        // Lo que quedara en el buffer es de la conversación que se acaba: la siguiente no empieza con audio viejo.
        if (captaba) { try { _cliente.Reset(); } catch { } }
    }

    public void Dispose()
    {
        Parar();
        try { _cliente.Dispose(); } catch { }
        try { _dispositivo.Dispose(); } catch { }
        try { _aviso.Dispose(); } catch { }
    }
}
