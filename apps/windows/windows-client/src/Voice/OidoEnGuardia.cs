namespace U.WindowsClient.Voice;

/// <summary>
/// EL MICRÓFONO DEL COMPUTADOR, EN GUARDIA: abierto desde antes del clic, sin entregar nada hasta el clic.
/// </summary>
/// <remarks>
/// EL DISPOSITIVO TARDA EN ABRIR 320–550 ms ÉL SOLO. Medido el 2026-09-30 con una sonda sobre «Varios
/// micrófonos (Realtek)»: WaveIn, 319–512 ms hasta grabar y 546 tras quince segundos de reposo; WASAPI,
/// 333–584 y 526. No es la API: es el dispositivo. Con ese precio dentro del clic no hay forma de estar
/// captando a los 500 ms que pidió el dueño, así que se paga ANTES: al acercar el ratón a la carita el
/// dispositivo empieza a abrirse, y cuando llega el clic ya está grabando.
///
/// LO QUE COMPRA ESO Y LO QUE CUESTA. Compra que lo dicho justo después del clic se capte. Cuesta que
/// el indicador de micrófono de Windows se encienda al acercarse, aunque no se llegue a pulsar. Por eso
/// las tres reglas de abajo no son detalles: <see cref="Entrega"/> es falso en guardia —lo captado
/// antes del clic no llega a nadie, ni a la conversación ni a un archivo—, alejarse la suelta, y si el
/// ratón se queda aparcado encima caduca sola.
///
/// Pura: no abre ni cierra nada. Dice qué hay que hacer con el dispositivo (<see cref="Orden"/>) y si
/// lo captado se entrega; quien tiene el dispositivo es <see cref="LiveAudio"/>. El contrato la juzga
/// con un reloj de mentira (promesa 665).
/// </remarks>
public sealed class OidoEnGuardia
{
    public enum Orden { Nada, AbrirDispositivo, CerrarDispositivo }

    /// <summary>Cuánto aguanta la guardia sin clic desde el último acercamiento.</summary>
    public const int CaducaPorDefectoMs = 4000;

    private readonly int _caducaMs;
    private long _desdeMs;

    public OidoEnGuardia(int caducaMs = CaducaPorDefectoMs) => _caducaMs = Math.Max(1, caducaMs);

    /// <summary>La conversación pidió oír por aquí: lo captado se entrega.</summary>
    public bool Entrega { get; private set; }

    /// <summary>Abierto por si acaso. Lo captado así no se entrega a nadie.</summary>
    public bool EnGuardia { get; private set; }

    /// <summary>Si el dispositivo tiene que estar abierto, sea para oír o para estar listo.</summary>
    public bool QuiereDispositivo => Entrega || EnGuardia;

    /// <summary>El ratón se acercó a la carita. Cada acercamiento renueva la guardia.</summary>
    public Orden Acercarse(long ahoraMs)
    {
        if (Entrega) return Orden.Nada;
        bool estaba = EnGuardia;
        EnGuardia = true;
        _desdeMs = ahoraMs;
        return estaba ? Orden.Nada : Orden.AbrirDispositivo;
    }

    /// <summary>El ratón se fue sin pulsar.</summary>
    public Orden Alejarse()
    {
        if (!EnGuardia) return Orden.Nada;
        EnGuardia = false;
        return Entrega ? Orden.Nada : Orden.CerrarDispositivo;
    }

    /// <summary>La voz se encendió: desde ahora se entrega. Con la guardia puesta, el dispositivo ya estaba.</summary>
    public Orden Abrir()
    {
        bool estaba = QuiereDispositivo;
        Entrega = true;
        EnGuardia = false;
        return estaba ? Orden.Nada : Orden.AbrirDispositivo;
    }

    /// <summary>La voz se apagó, o dejó de oír por este micrófono.</summary>
    public Orden Cerrar()
    {
        bool estaba = QuiereDispositivo;
        Entrega = false;
        EnGuardia = false;
        return estaba ? Orden.CerrarDispositivo : Orden.Nada;
    }

    /// <summary>El paso del tiempo: una guardia sin clic no dura para siempre.</summary>
    public Orden Tic(long ahoraMs)
    {
        if (!EnGuardia || ahoraMs - _desdeMs < _caducaMs) return Orden.Nada;
        EnGuardia = false;
        return Entrega ? Orden.Nada : Orden.CerrarDispositivo;
    }
}
