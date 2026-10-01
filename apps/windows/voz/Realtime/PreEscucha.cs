namespace Voz.Realtime;

/// <summary>
/// LO QUE SE DICE MIENTRAS LA SESIÓN ABRE: se guarda, y sale entero cuando el servidor confirma.
/// </summary>
/// <remarks>
/// EL SERVIDOR TIRA LO QUE LE LLEGA ANTES DE CONFIRMAR. Medido el 2026-09-30 con una sonda contra
/// /v1/live/sessions: la frase «Manzana. Repite solamente la primera palabra que dije», mandada justo
/// detrás de session.start y antes de session.started, no se transcribió y la voz contestó «Repite.»;
/// la misma frase, guardada y mandada en ráfaga después de session.started, se transcribió
/// («Manzana. Re…») y la voz contestó «Manzana.». Mandar más deprisa que el reloj, pues, vale; mandar
/// antes de tiempo, no.
///
/// Y entre el clic y esa confirmación pasan de 1,5 a 1,9 s en el mejor caso medido (2026-10-01). Sin
/// esto, quien pulsa y habla pierde el principio de la frase, que es exactamente «no me escucha».
///
/// EL ORDEN LO GARANTIZA <see cref="Siguiente"/>: mientras quede algo guardado, lo nuevo se pone a la
/// cola en vez de salir directo, y solo en el instante en que la cola se vacía deja de guardarse. Así
/// un trozo captado durante el vaciado no puede adelantar a uno guardado.
///
/// EL TOPE existe porque el servidor puede no contestar nunca, y la memoria no puede crecer con él. Se
/// tira lo más viejo y se cuenta: lo perdido deja rastro (patrón nº10).
/// </remarks>
public sealed class PreEscucha
{
    /// <summary>Medio minuto: más que cualquier apertura con sus tres intentos de conexión.</summary>
    public const int TopePorDefectoMs = 30_000;

    private readonly int _bytesPorMs;
    private readonly int _topeMs;
    private readonly Queue<byte[]> _cola = new();
    private readonly object _candado = new();
    private bool _guardando;
    private long _bytesGuardados, _bytesPerdidos;

    /// <param name="ritmoHz">El ritmo del PCM de 16 bits mono que se guarda, para contarlo en milisegundos.</param>
    public PreEscucha(int ritmoHz, int topeMs = TopePorDefectoMs)
    {
        _bytesPorMs = Math.Max(1, ritmoHz * 2 / 1000);
        _topeMs = Math.Max(1, topeMs);
    }

    /// <summary>Desde ahora se guarda. Si ya se estaba guardando, lo guardado se conserva.</summary>
    public void Empezar()
    {
        lock (_candado)
        {
            if (_guardando) return;
            _guardando = true;
            _bytesPerdidos = 0;
        }
    }

    public bool Guardando { get { lock (_candado) return _guardando; } }

    /// <summary>
    /// Guarda el trozo si se está guardando. Devuelve si lo guardó: con falso, el trozo sigue siendo de
    /// quien lo trae, que lo manda por su camino de siempre.
    /// </summary>
    public bool Guardar(byte[] pcm)
    {
        lock (_candado)
        {
            if (!_guardando) return false;
            _cola.Enqueue(pcm);
            _bytesGuardados += pcm.Length;
            long tope = (long)_topeMs * _bytesPorMs;
            while (_bytesGuardados > tope && _cola.Count > 1)
            {
                int viejo = _cola.Dequeue().Length;
                _bytesGuardados -= viejo;
                _bytesPerdidos += viejo;
            }
            return true;
        }
    }

    /// <summary>
    /// El siguiente trozo guardado, del más viejo al más nuevo. Con la cola vacía devuelve null y EN ESE
    /// MISMO INSTANTE deja de guardar: lo que llegue después ya va directo.
    /// </summary>
    public byte[]? Siguiente()
    {
        lock (_candado)
        {
            if (_cola.Count == 0) { _guardando = false; return null; }
            byte[] trozo = _cola.Dequeue();
            _bytesGuardados -= trozo.Length;
            return trozo;
        }
    }

    /// <summary>Deja de guardar y tira lo guardado. Devuelve cuántos milisegundos se tiraron.</summary>
    public int Tirar()
    {
        lock (_candado)
        {
            int ms = (int)(_bytesGuardados / _bytesPorMs);
            _cola.Clear();
            _bytesGuardados = 0;
            _guardando = false;
            return ms;
        }
    }

    /// <summary>Lo que hay guardado ahora mismo, en milisegundos de audio.</summary>
    public int MsGuardados { get { lock (_candado) return (int)(_bytesGuardados / _bytesPorMs); } }

    /// <summary>Lo que el tope tiró por lo más viejo desde que se empezó a guardar.</summary>
    public int MsPerdidos { get { lock (_candado) return (int)(_bytesPerdidos / _bytesPorMs); } }
}
