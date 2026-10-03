using System.Windows;

namespace U.WindowsClient.Ui;

/// <summary>
/// LA Ü QUE SE VUELVE LA CARITA (spec 086, promesa 880). Pura: dónde está cada trazo en cada instante de la
/// intro, en unidades del dibujo de la carita (150 de lado, 0 en su centro, y hacia abajo crece la y).
/// </summary>
/// <remarks>
/// Cinco trazos cúbicos, en el mismo orden en la letra y en la cara: los dos puntos de la diéresis son las cejas,
/// los dos lados de la U los ojos y el fondo de la U la boca —lo que pidió el dueño, pieza por pieza—. Una recta
/// es una cúbica con los controles encima; un punto, una recta de medio trazo de largo, que con las puntas
/// redondas se ve redonda. Así los cinco se interpolan igual, punto con punto.
///
/// <see cref="Cara"/> repite las cuentas de <c>FaceControl.OnRender</c> para la carita de frente: al acabar, la
/// intro se entrega al camino de siempre, y si estas cuentas se separaran de aquellas el salto se vería. Lo
/// vigila la 880 por píxeles: un instante antes de acabar tiene que pintar ya la carita de siempre.
/// </remarks>
public static class LaUDeLaCarita
{
    public readonly record struct Trazo(Point A, Point B, Point C, Point D);

    /// <summary>El grosor de la letra: el de una fuente gruesa a ese tamaño.</summary>
    public const double GrosorDeLaLetra = 30;

    /// <summary>El de los rasgos de la carita (<c>FaceControl</c> pinta con 4 unidades).</summary>
    public const double GrosorDeLaCara = 4;

    // LA LETRA. Más alta que la carita entera (222 de 150 contando el trazo): la Ü llena la ventana negra y se
    // encoge hasta la cara. Los lados van por fuera de los ojos (52 contra 30) y la U baja hasta donde estará la
    // barbilla, para que deshacerse sea sobre todo encoger y aplanar, no viajar.
    private const double Lado = 52;
    private const double Arriba = -55;
    private const double Codo = 40;
    private const double PuntoX = 34;
    private const double PuntoY = -100;

    public static IReadOnlyList<Trazo> LaU { get; } = new[]
    {
        Punto(-PuntoX, PuntoY),
        Punto(PuntoX, PuntoY),
        Recta(new Point(-Lado, Arriba), new Point(-Lado, Codo)),
        Recta(new Point(Lado, Arriba), new Point(Lado, Codo)),
        // Medio círculo de radio Lado: con los controles a 4/3 del radio, la curva pasa justo por el fondo.
        new Trazo(new Point(-Lado, Codo), new Point(-Lado, Codo + Lado * 4 / 3), new Point(Lado, Codo + Lado * 4 / 3), new Point(Lado, Codo)),
    };

    /// <summary>
    /// La carita de frente con esta pose, en el orden de la letra: ceja izquierda, ceja derecha, ojo izquierdo,
    /// ojo derecho y boca. Las mismas cuentas que <c>FaceControl.OnRender</c> con el giro a cero.
    /// </summary>
    public static IReadOnlyList<Trazo> Cara(double browL, double browR, double curveL, double curveR,
        double eyeOpen, double squint, double mouthCurve, double mouthWidth, double cornerL, double cornerR, double parpadeo)
    {
        Trazo Ceja(double bx, double bh, double c) =>
            Cuadratica(new Point(bx - 10, -34 - bh), new Point(bx, -34 - bh - c * 15), new Point(bx + 10, -34 - bh));

        double largo = 25 * eyeOpen * (1 - squint * 0.4) * (1 - parpadeo * 0.92);
        Trazo Ojo(double ex) => Recta(new Point(ex, -14 - largo / 2), new Point(ex, -14 + largo / 2));

        double @base = mouthCurve * 15;
        double izquierda = 34 - @base - cornerL * 8, derecha = 34 - @base - cornerR * 8, medio = 34 - mouthCurve * 12;
        double corrida = (cornerR - cornerL) * 10, mitad = mouthWidth / 2;
        var boca = new Trazo(new Point(-mitad, izquierda), new Point(-mitad * 0.3 + corrida, medio),
                             new Point(mitad * 0.3 + corrida, medio), new Point(mitad, derecha));

        return new[] { Ceja(-30, browL, curveL), Ceja(30, browR, curveR), Ojo(-30), Ojo(30), boca };
    }

    /// <summary>
    /// Los trazos con la intro en <paramref name="laU"/>: 1 es la letra y 0 la <paramref name="cara"/>, exactas las
    /// dos. En medio, cada pieza va en línea recta hacia su rasgo, al paso de <see cref="Forma"/>.
    /// </summary>
    public static IReadOnlyList<Trazo> Entre(double laU, IReadOnlyList<Trazo> cara)
    {
        var salida = new Trazo[5];
        for (int i = 0; i < 5; i++)
        {
            double f = Avance(laU, i);
            Point L(Point a, Point b) => new(a.X + (b.X - a.X) * f, a.Y + (b.Y - a.Y) * f);
            Trazo u = LaU[i], c = cara[i];
            salida[i] = new Trazo(L(u.A, c.A), L(u.B, c.B), L(u.C, c.C), L(u.D, c.D));
        }
        return salida;
    }

    // COMO LO HARÍA APPLE (promesa 880). Pidió primero «fases duras» y al verlas: «que las transiciones sean tipo
    // Apple, no necesariamente como te las pedí». Apple no corta: cada pieza viaja con un resorte —llega suave, se
    // pasa un pelo y se asienta— y las fases se escalonan solapándose, así que cuando una va a medias la siguiente ya
    // arranca. El orden es el que pidió: cejas, ojos, boca. Cada fase es una ventana de la transformación (0 a 1).
    private static readonly (double Desde, double Hasta)[] Fases =
    {
        (0.04, 0.36),   // los puntos → las cejas
        (0.20, 0.52),   // los lados de la U → los ojos
        (0.36, 0.68),   // el fondo de la U → la boca
    };

    /// <summary>De qué fase es cada pieza: cejas, cejas, ojos, ojos, boca.</summary>
    private static int FaseDe(int pieza) => pieza switch { 0 or 1 => 0, 2 or 3 => 1, _ => 2 };

    /// <summary>
    /// Cuánto llegó la pieza a su rasgo, de 0 (es de la letra) a 1 (es de la cara): un resorte dentro de su ventana,
    /// y quieta fuera de ella.
    /// </summary>
    public static double Avance(double laU, int pieza)
    {
        var (desde, hasta) = Fases[FaseDe(pieza)];
        double x = ((1 - laU) - desde) / (hasta - desde);
        return x <= 0 ? 0 : x >= 1 ? 1 : Resorte(x);
    }

    /// <summary>
    /// Cuánto se ve el cuerpo, de 0 (no está) a 1 (del todo): aparece en la segunda mitad de la intro, cuando los
    /// rasgos ya casi llegaron, y en su primer 40 % ya es opaco. Donde cubre, el trazo pasa de blanco a tinta a
    /// la vez; fuera sigue blanco sobre el negro.
    /// </summary>
    public static double Cuerpo(double laU) => Suave(Math.Clamp(Crecido(laU) / 0.4, 0, 1));

    /// <summary>
    /// El tamaño del cuerpo, de 0,55 a 1, mientras aparece: asoma ya por detrás de los rasgos y crece desde el
    /// centro con un rebote de un 4 %. Nació creciendo desde cero, y en el PC real era un cuadradito blanco en
    /// mitad de la cara —una nariz— durante varios fotogramas (2026-10-03).
    /// </summary>
    public static double TamanoDelCuerpo(double laU)
    {
        double b = Crecido(laU);
        return b <= 0 ? 0 : 0.55 + 0.45 * Resorte(b);
    }

    /// <summary>Lo que va del último 40 % de la intro, de 0 a 1: el cuerpo asoma cuando la boca ya va casi puesta.</summary>
    private static double Crecido(double laU) => Math.Clamp(((1 - laU) - 0.60) / 0.40, 0, 1);

    /// <summary>
    /// El resorte de siempre en Apple: amortiguado al 70 %, que se pasa un 4,6 % y se asienta. Para x de 0 a 1 va de 0
    /// a 1; en 1 queda a un 0,4 % de distancia y se da por llegado, sin salto que se pueda ver.
    /// </summary>
    private static double Resorte(double x)
    {
        if (x >= 1) return 1;
        const double zeta = 0.7, decae = 5.5;
        double wn = decae / zeta, wd = wn * Math.Sqrt(1 - zeta * zeta);
        return 1 - Math.Exp(-decae * x) * (Math.Cos(wd * x) + decae / wd * Math.Sin(wd * x));
    }

    /// <summary>El grosor de cada pieza, del de la letra al de la carita, al paso de la suya.</summary>
    public static double Grosor(double laU, int pieza) =>
        GrosorDeLaLetra + (GrosorDeLaCara - GrosorDeLaLetra) * Math.Min(1, Avance(laU, pieza));

    /// <summary>El giro del lienzo: la letra va derecha y la carita lleva sus −2° de siempre, que toma con la boca.</summary>
    public static double Lienzo(double laU) => -2 * Math.Min(1, Avance(laU, 4));

    private static double Suave(double x) => x * x * (3 - 2 * x);

    private static Trazo Recta(Point a, Point b) =>
        new(a, new Point(a.X + (b.X - a.X) / 3, a.Y + (b.Y - a.Y) / 3), new Point(a.X + (b.X - a.X) * 2 / 3, a.Y + (b.Y - a.Y) * 2 / 3), b);

    private static Trazo Punto(double x, double y) => Recta(new Point(x - 0.25, y), new Point(x + 0.25, y));

    /// <summary>La cuadrática de las cejas, escrita como cúbica: los controles a dos tercios del suyo.</summary>
    private static Trazo Cuadratica(Point a, Point q, Point b) =>
        new(a, new Point(a.X + (q.X - a.X) * 2 / 3, a.Y + (q.Y - a.Y) * 2 / 3), new Point(b.X + (q.X - b.X) * 2 / 3, b.Y + (q.Y - b.Y) * 2 / 3), b);
}
