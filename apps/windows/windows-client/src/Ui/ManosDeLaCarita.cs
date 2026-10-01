using System;

namespace U.WindowsClient.Ui;

/// <summary>
/// Las manos de la carita: dónde están en cada instante de un saludo (spec 052, promesa 442) y al
/// presionar lo que Ü pulsa (promesa 446).
///
/// Pedidas por el dueño el 2026-09-30: «que pueda tener esas manitos […] que las pueda sacar de vez en
/// cuando, meterlas». El movimiento sigue a Coucou (<c>greet</c> y <c>drawHandsBehind</c>): viven
/// DETRÁS del cuerpo, abajo a los lados; asoman creciendo desde dentro, la derecha sube y saluda
/// oscilando a 13 rad/s con la muñeca girando, y la izquierda solo se mece. Las proporciones y los
/// tiempos son nuestros: el personaje de Coucou está reservado por su autor (LICENSE-ASSETS.md).
///
/// Todo en radios de la cara (1 = del centro al borde), con y hacia abajo. Pura: el tiempo entra como
/// número, así que el contrato recorre el saludo entero sin esperar.
/// </summary>
public static class ManosDeLaCarita
{
    /// <summary>Lo que dura un saludo entero, de esconderse a esconderse, en segundos.</summary>
    public const double Duracion = 1.8;

    private const double Sale = 0.28;        // lo que tarda en asomar
    private const double Entra = 0.26;       // y en volver a esconderse
    private const double EmpiezaOla = 0.30;
    private const double AcabaOla = Duracion - 0.36;
    private const double Frecuencia = 13;    // rad/s, la de la referencia: más lenta parece un adiós

    /// <summary>Tamaño de una mano fuera del todo, en radios de la cara (semiejes x, y).</summary>
    public const double Ancho = 0.25, Alto = 0.21;

    /// <summary>Cuánto se ven las manos en el instante <paramref name="t"/> del saludo: 0 dentro, 1 fuera.</summary>
    public static double Asomo(double t)
    {
        if (t <= 0 || t >= Duracion) return 0;
        if (t < Sale) { double p = t / Sale; return 1 - Math.Pow(1 - p, 3); }            // sale con prisa y frena
        if (t > Duracion - Entra) { double p = (Duracion - t) / Entra; return p * p; }  // entra acelerando
        return 1;
    }

    /// <summary>
    /// La mano en reposo, asomada <paramref name="asomo"/>: sale desde dentro del cuerpo hacia fuera
    /// mientras crece, que es lo que la hace salir «por detrás» y no aparecer encima.
    /// </summary>
    public static (double X, double Y, double Angulo) Reposo(double asomo, int lado)
        => (Math.Sign(lado) * (0.80 + 0.24 * Math.Clamp(asomo, 0, 1)), 0.62, 0);

    /// <summary>Dónde está la mano <paramref name="lado"/> (1 derecha, −1 izquierda) en el instante <paramref name="t"/>.</summary>
    public static (double X, double Y, double Angulo) Mano(double t, int lado)
    {
        var (x, y, _) = Reposo(Asomo(t), lado);
        if (t <= EmpiezaOla || t >= AcabaOla) return (x, y, 0);

        double w = t - EmpiezaOla;
        // La ola sube y baja con su propia envolvente, para que no arranque ni pare de golpe.
        double env = Math.Min(1, w / 0.18) * Math.Min(1, (AcabaOla - t) / 0.18);
        env = 1 - Math.Pow(1 - env, 3);

        if (lado > 0)
            return (x + (0.03 + Math.Cos(Frecuencia * w) * 0.05) * env,
                    y + (-0.72 - Math.Sin(Frecuencia * w) * 0.12) * env,
                    (Math.Sin(Frecuencia * w) * 0.45 - 0.10) * env);

        // La otra se queda: se mece al compás, con la mitad de frecuencia y casi nada de recorrido.
        return (x, y + Math.Sin(Frecuencia / 2 * w) * 0.03 * env, 0);
    }

    // ── Presionar ─────────────────────────────────────────────────────────────────────────────
    //
    // «Cuando haga clic, que saque las manos y haga el clic» (el dueño, 2026-10-01; promesa 446). La
    // carita ya iba junto a lo que Ü pulsa (spec 061); al posarse saca la mano de ese lado, EMPUJA hacia
    // fuera —más lejos de donde descansa una mano que solo asoma— y la esconde. Una sola mano: dos
    // empujando a la vez se leen como un aplauso, no como un clic.

    /// <summary>Lo que dura presionar, de esconderse a esconderse, en segundos.</summary>
    public const double DuracionDePresionar = 0.7;

    private const double Asoma = 0.16;       // sale por el costado, a media altura
    private const double Empuja = 0.27;      // y de ahí, el empujón: corto y con decisión
    private const double Aguanta = 0.40;     // se queda apretando un instante, que es lo que lo hace un clic

    private const double Dentro = 0.80;      // escondida detrás del cuerpo
    private const double Asomada = 1.02;
    /// <summary>
    /// Hasta dónde llega el centro de la mano al empujar, en radios de la cara. LO LIMITA LA VENTANA: la
    /// carita suelta mide 66 con 17 de aire (<see cref="ReglaDelHalo"/>), o sea 1,53 radios hasta el
    /// canto; 1,20 más el medio ancho de la mano y lo que el cuerpo se corre al girar son 1,48.
    /// </summary>
    private const double Alcance = 1.20;
    private const double Altura = 0.18;      // un poco por debajo del centro: a la altura de un brazo

    /// <summary>
    /// La mano que presiona en el instante <paramref name="t"/>, por el lado <paramref name="lado"/>
    /// (1 derecha, −1 izquierda): dónde está y cuánto asoma (0 dentro, 1 fuera). La otra mano no sale.
    /// </summary>
    public static (double X, double Y, double Angulo, double Asomo) Presion(double t, int lado)
    {
        int s = Math.Sign(lado);
        if (t <= 0 || t >= DuracionDePresionar) return (s * Dentro, Altura, 0, 0);

        double x, asomo;
        if (t < Asoma)
        {
            double p = Frenando(t / Asoma);
            (x, asomo) = (Dentro + (Asomada - Dentro) * p, p);
        }
        else if (t < Empuja) (x, asomo) = (Asomada + (Alcance - Asomada) * Frenando((t - Asoma) / (Empuja - Asoma)), 1);
        else if (t < Aguanta) (x, asomo) = (Alcance, 1);
        else
        {
            // Vuelve acelerando, encogiéndose mientras se mete: por detrás, igual que salió.
            double p = (DuracionDePresionar - t) / (DuracionDePresionar - Aguanta);
            (x, asomo) = (Dentro + (Alcance - Dentro) * p * p, p * p);
        }
        return (s * x, Altura, 0, asomo);
    }

    // ── Deslizar ──────────────────────────────────────────────────────────────────────────────
    //
    // «Cuando haga scroll, que saque la mano, como que presione la pantalla y se mueva con la pantalla» (el dueño,
    // 2026-10-01; promesa 697). Es la mano que presiona, que en vez de soltar enseguida AGUANTA apoyada mientras la
    // carita se mueve con el contenido.

    /// <summary>Lo que tarda la mano en quedar apoyada desde que empieza a salir, en segundos.</summary>
    public const double TardaEnApoyarse = Empuja;

    /// <summary>Lo que dura el gesto entero para un desliz de <paramref name="cuanto"/> segundos: apoyar, aguantar y esconder.</summary>
    public static double DuracionDelDesliz(double cuanto) => Empuja + Math.Max(0, cuanto) + (DuracionDePresionar - Aguanta);

    /// <summary>La mano que desliza en el instante <paramref name="t"/>: como la que presiona, pero apoyada <paramref name="cuanto"/> segundos.</summary>
    public static (double X, double Y, double Angulo, double Asomo) Desliz(double t, int lado, double cuanto)
    {
        cuanto = Math.Max(0, cuanto);
        int s = Math.Sign(lado);
        if (t <= 0 || t >= DuracionDelDesliz(cuanto)) return (s * Dentro, Altura, 0, 0);
        if (t < Empuja) return Presion(t, lado);
        if (t < Empuja + cuanto) return (s * Alcance, Altura, 0, 1);
        return Presion(Aguanta + (t - Empuja - cuanto), lado);
    }

    // ── Teclear ───────────────────────────────────────────────────────────────────────────────
    //
    // «Cuando esté escribiendo, como moviendo las dos manitos, taca taca taca» (el dueño, 2026-10-01; promesa 698).
    // Las dos manos fuera, abajo a los lados, golpeando por turnos: cuando una sube la otra cae.

    /// <summary>Golpes por segundo de cada mano; entre las dos, el doble.</summary>
    private const double Golpes = 4.5;

    /// <summary>
    /// Cuánto teclea para <paramref name="caracteres"/> caracteres, en segundos: más cuanto más largo, entre uno y tres.
    /// No es lo que tarda Ü en escribir —que casi siempre es un instante—: es lo que hace falta para que se VEA.
    /// </summary>
    public static double CuantoTeclea(int caracteres) => Math.Clamp(0.8 + 0.03 * Math.Max(0, caracteres), 1.0, 3.0);

    /// <summary>Dónde está la mano <paramref name="lado"/> en el instante <paramref name="t"/> de un tecleo que dura <paramref name="duracion"/>.</summary>
    public static (double X, double Y, double Angulo, double Asomo) Tecleo(double t, int lado, double duracion)
    {
        int s = Math.Sign(lado);
        if (t <= 0 || t >= duracion) return (s * Dentro, 0.62, 0, 0);
        double asomo = t < Sale ? Frenando(t / Sale)
            : t > duracion - Entra ? Math.Pow((duracion - t) / Entra, 2)
            : 1;
        // La izquierda va medio golpe detrás de la derecha: se relevan.
        double fase = 2 * Math.PI * Golpes * t + (s > 0 ? 0 : Math.PI);
        double golpe = Math.Max(0, Math.Sin(fase));
        return (s * (Dentro + 0.22 * asomo + 0.04 * Math.Sin(fase)), 0.66 - 0.16 * golpe * asomo, s * 0.18 * golpe, asomo);
    }

    /// <summary>Sale con prisa y frena al llegar.</summary>
    private static double Frenando(double p) => 1 - Math.Pow(1 - Math.Clamp(p, 0, 1), 3);
}
