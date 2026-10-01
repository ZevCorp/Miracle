using NAudio.Dsp;

namespace U.WindowsClient.Voice;

/// <summary>
/// DE LO QUE ENTREGA WINDOWS A LO QUE PIDE EL PROTOCOLO: coma flotante de 32 bits, los canales que
/// sean y al ritmo de la mezcla del equipo → PCM de 16 bits, mono, al ritmo pedido.
/// </summary>
/// <remarks>
/// Hasta el 2026-10-01 esta conversión la hacía Windows por nosotros: se le pedía «24 kHz, 16 bits,
/// mono» a la API vieja y la entregaba así. El micrófono preparado (<see cref="MicrofonoPreparado"/>)
/// se inicializa con el formato de la mezcla —es lo único que un cliente compartido acepta sin
/// condiciones—, que en este equipo es 48 kHz estéreo en coma flotante y con el micrófono de unos
/// audífonos es 16 kHz mono. Lo que antes era de Windows ahora es de aquí, y por eso tiene su
/// promesa (la 665).
///
/// A MONO POR LA MEDIA de los canales: sumar saturaría una voz que entra igual por los dos.
///
/// UNA INSTANCIA POR CAPTACIÓN, y se conserva entre trozos: el remuestreador guarda el estado de su
/// filtro, y crearlo de cero en cada paquete de 10 ms se oiría como un clic en cada corte. Es el
/// remuestreador de WDL que trae NAudio, en C# puro: sin COM, así que el contrato lo juzga en
/// cualquier máquina.
/// </remarks>
public sealed class DeLaMezclaAPcm16
{
    private readonly int _canales;
    private readonly int _ritmoOrigen, _ritmoDestino;
    private readonly WdlResampler? _remuestreador;
    private float[] _mono = Array.Empty<float>();
    private float[] _salida = Array.Empty<float>();

    /// <param name="ritmoOrigen">Muestras por segundo de lo que entra.</param>
    /// <param name="canales">Canales intercalados de lo que entra.</param>
    /// <param name="ritmoDestino">Muestras por segundo de lo que tiene que salir.</param>
    public DeLaMezclaAPcm16(int ritmoOrigen, int canales, int ritmoDestino)
    {
        if (ritmoOrigen <= 0 || ritmoDestino <= 0 || canales <= 0)
            throw new ArgumentException($"formato imposible: {ritmoOrigen} Hz, {canales} canal(es) → {ritmoDestino} Hz");
        _canales = canales;
        _ritmoOrigen = ritmoOrigen;
        _ritmoDestino = ritmoDestino;
        if (ritmoOrigen == ritmoDestino) return;   // un remuestreador trabajando para no cambiar nada sobra

        _remuestreador = new WdlResampler();
        _remuestreador.SetMode(true, 2, false);
        _remuestreador.SetFilterParms();
        _remuestreador.SetFeedMode(true);   // manda lo que entra: se le da lo que hay y devuelve lo que ya esté listo
        _remuestreador.SetRates(ritmoOrigen, ritmoDestino);
    }

    /// <summary>
    /// Entran <paramref name="cuantos"/> bytes de coma flotante intercalada; sale el PCM16 mono que ya
    /// esté listo. Un trozo corto da menos muestras, nunca silencio inventado.
    /// </summary>
    public byte[] Convertir(byte[] datos, int cuantos)
    {
        int cuadros = cuantos / (4 * _canales);
        if (cuadros <= 0) return Array.Empty<byte>();

        if (_mono.Length < cuadros) _mono = new float[cuadros];
        for (int i = 0; i < cuadros; i++)
        {
            float suma = 0;
            for (int c = 0; c < _canales; c++) suma += BitConverter.ToSingle(datos, (i * _canales + c) * 4);
            _mono[i] = suma / _canales;
        }

        float[] listo = _mono;
        int listos = cuadros;
        if (_remuestreador != null)
        {
            int pide = _remuestreador.ResamplePrepare(cuadros, 1, out float[] entrada, out int desde);
            Array.Copy(_mono, 0, entrada, desde, pide);
            int caben = (int)((long)cuadros * _ritmoDestino / _ritmoOrigen) + 64;
            if (_salida.Length < caben) _salida = new float[caben];
            listos = _remuestreador.ResampleOut(_salida, 0, pide, caben, 1);
            listo = _salida;
        }

        var pcm = new byte[listos * 2];
        for (int i = 0; i < listos; i++)
        {
            // LO QUE SATURA SE RECORTA EN EL TOPE. Convertir sin recortar da la vuelta: +1,2 pasa a ser un
            // valor negativo, y eso no suena a fuerte, suena a chasquido.
            int v = (int)MathF.Round(listo[i] * 32767f);
            short m = (short)Math.Clamp(v, short.MinValue, short.MaxValue);
            pcm[i * 2] = (byte)(m & 0xFF);
            pcm[i * 2 + 1] = (byte)((m >> 8) & 0xFF);
        }
        return pcm;
    }
}
