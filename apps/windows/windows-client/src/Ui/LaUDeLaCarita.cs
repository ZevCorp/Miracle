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
        double f = Forma(laU);
        if (f <= 0) return LaU;
        if (f >= 1) return cara;
        Point L(Point a, Point b) => new(a.X + (b.X - a.X) * f, a.Y + (b.Y - a.Y) * f);
        return LaU.Zip(cara, (u, c) => new Trazo(L(u.A, c.A), L(u.B, c.B), L(u.C, c.C), L(u.D, c.D))).ToArray();
    }

    /// <summary>
    /// Cuánto se deshizo la letra, de 0 a 1. Llega al 70 % de la intro: los rasgos se colocan primero y el cuerpo
    /// crece después por detrás, porque si crecieran a la vez el cuerpo taparía una letra a medio deshacer.
    /// </summary>
    public static double Forma(double laU) => Suave(Math.Clamp((1 - laU) / 0.7, 0, 1));

    /// <summary>
    /// El cuerpo, de 0 (no está) a 1 (entero), crece desde el centro en la segunda mitad de la intro. Donde ya
    /// cubre, el trazo es de tinta; fuera sigue blanco sobre el negro.
    /// </summary>
    public static double Cuerpo(double laU) => Suave(Math.Clamp((0.5 - laU) / 0.5, 0, 1));

    /// <summary>El grosor del trazo, del de la letra al de la carita, al paso de los rasgos.</summary>
    public static double Grosor(double laU) => GrosorDeLaLetra + (GrosorDeLaCara - GrosorDeLaLetra) * Forma(laU);

    /// <summary>El giro del lienzo: la letra va derecha y la carita lleva sus −2° de siempre.</summary>
    public static double Lienzo(double laU) => -2 * Forma(laU);

    private static double Suave(double x) => x * x * (3 - 2 * x);

    private static Trazo Recta(Point a, Point b) =>
        new(a, new Point(a.X + (b.X - a.X) / 3, a.Y + (b.Y - a.Y) / 3), new Point(a.X + (b.X - a.X) * 2 / 3, a.Y + (b.Y - a.Y) * 2 / 3), b);

    private static Trazo Punto(double x, double y) => Recta(new Point(x - 0.25, y), new Point(x + 0.25, y));

    /// <summary>La cuadrática de las cejas, escrita como cúbica: los controles a dos tercios del suyo.</summary>
    private static Trazo Cuadratica(Point a, Point q, Point b) =>
        new(a, new Point(a.X + (q.X - a.X) * 2 / 3, a.Y + (q.Y - a.Y) * 2 / 3), new Point(b.X + (q.X - b.X) * 2 / 3, b.Y + (q.Y - b.Y) * 2 / 3), b);
}
