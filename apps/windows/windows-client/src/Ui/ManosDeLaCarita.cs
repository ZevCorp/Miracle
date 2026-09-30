using System;

namespace U.WindowsClient.Ui;

/// <summary>
/// Las manos de la carita: dónde están en cada instante de un saludo (spec 052, promesa 442).
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
}
