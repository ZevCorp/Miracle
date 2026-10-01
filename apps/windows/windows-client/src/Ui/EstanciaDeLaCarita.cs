using System.Windows;
using U.Graph.Surfaces;

namespace U.WindowsClient.Ui;

/// <summary>
/// DÓNDE ESTÁ LA CARITA —en casa o de visita— Y SI SE DEJA TOCAR. Promesas 505 y 507 (spec 061). Pura: el estilo de la
/// ventana, el vuelo y el reloj se le dan.
/// </summary>
/// <remarks>
/// LO QUE PASÓ EL 2026-09-27: la carita se posaba junto al clic y el clic siguiente de Ü —la tecla de al lado— caía en
/// ella, que abre la voz de pago. Cinco sesiones en un día. Posarse al lado (506) no basta: al lado de A está B. Lo que
/// lo evita es esto: desde que Ü la saca de casa hasta que se posa otra vez en casa es TRANSPARENTE al ratón
/// (WS_EX_TRANSPARENT; la sonda 0 midió que un clic real la atraviesa). Solo la casa la vuelve tocable, y la casa la pone
/// la persona: una visita nunca la escribe.
///
/// UN VUELO CORTADO NO ES UNA LLEGADA: la vuelta avisa al posarse, y aquí se comprueba que se posó EN CASA. Si otro
/// vuelo la cortó, el latido siguiente la manda otra vez.
/// </remarks>
public sealed class EstanciaDeLaCarita
{
    /// <summary>El rato sin visitas tras el que vuelve sola. Propuesto, no medido: se ajusta con el dueño.</summary>
    public const int QuietudMs = 2000;

    private readonly Action<bool> _traspasable;
    private readonly Action<Point, TimeSpan, Action<Point>?> _volar;
    private readonly Func<long> _reloj;
    private long _ultimaSalida;

    /// <param name="traspasable">true: que el ratón la atraviese; false: que vuelva a dejarse tocar.</param>
    /// <param name="volar">Lleva la carita a ese punto en ese tiempo (cero = al momento); el aviso, si lo hay, al posarse.</param>
    /// <param name="relojMs">El reloj, en ms.</param>
    public EstanciaDeLaCarita(Action<bool> traspasable, Action<Point, TimeSpan, Action<Point>?> volar, Func<long> relojMs)
    {
        _traspasable = traspasable; _volar = volar; _reloj = relojMs;
    }

    /// <summary>La casa: donde la dejó la persona. La escriben quien la coloca al arrancar y quien la mueve a mano.</summary>
    public Point? Casa { get; set; }

    /// <summary>¿Se deja tocar? Solo en casa.</summary>
    public bool Tocable { get; private set; } = true;

    /// <summary>
    /// Visita el elemento: se vuelve transparente y DESPUÉS vuela a su lado. false, y nada se toca, si no hay casa a la que
    /// volver o si no cabe junto al elemento. Todo en DIP.
    /// </summary>
    public bool Visitar(Rect elemento, Point desde, Size carita, Rect area)
    {
        if (Casa == null) return false;
        if (ReglaDeLaVisita.Junto(elemento, carita, area) is not { } destino) return false;
        Salir();
        _volar(destino, CuantoTarda(desde, destino), null);
        return true;
    }

    /// <summary>Sale de casa sin vuelo propio (el recorrido de varias lo pone quien lo dibuja): transparente, y el rato empieza.</summary>
    public void Salir()
    {
        if (Tocable) { _traspasable(true); Tocable = false; }
        _ultimaSalida = _reloj();
    }

    /// <summary>Cada poco, con dónde está y si vuela: pasado el rato sin visitas, la manda a casa.</summary>
    public void Latido(Point dondeEsta, bool enVuelo)
    {
        if (Tocable || enVuelo || Casa is not { } casa) return;
        if (_reloj() - _ultimaSalida < QuietudMs) return;
        if (Distancia(dondeEsta, casa) <= 1) { Aterrizo(dondeEsta); return; }
        _volar(casa, CuantoTarda(dondeEsta, casa), Aterrizo);
    }

    /// <summary>Se posó ahí. Solo si es la casa vuelve a dejarse tocar.</summary>
    public void Aterrizo(Point donde)
    {
        if (Tocable || Casa is not { } casa || Distancia(donde, casa) > 1) return;
        _traspasable(false);
        Tocable = true;
    }

    /// <summary>A casa al momento, y tocable: para cuando se esconde, porque el estilo sobrevive a ocultarla.</summary>
    public void VolverYa()
    {
        if (Tocable || Casa is not { } casa) return;
        _volar(casa, TimeSpan.Zero, null);
        _traspasable(false);
        Tocable = true;
    }

    /// <summary>
    /// Cuánto tarda el vuelo de <paramref name="a"/> a <paramref name="b"/>; cero si queda tan cerca que no vuela. Lo
    /// pregunta también quien quiere hacer algo AL POSARSE: la mano que presiona sale entonces, no por el camino.
    /// </summary>
    public static TimeSpan CuantoTarda(Point a, Point b)
    {
        double d = Distancia(a, b);
        return ComoViajaLaCarita.MereceViaje(d) ? ComoViajaLaCarita.Cuanto(d) : TimeSpan.Zero;
    }

    private static double Distancia(Point a, Point b) => (a - b).Length;
}
