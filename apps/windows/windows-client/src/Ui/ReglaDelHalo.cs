using System;

namespace U.WindowsClient.Ui;

/// <summary>
/// CUÁNTO CRECE Y DE QUÉ COLOR es el halo de la voz que rodea a la carita suelta. Separada de la
/// ventana para que el contrato la juzgue sin abrir una pantalla (promesa 163, spec 011).
/// </summary>
/// <remarks>
/// Hasta el 2026-09-02 este halo vivía DENTRO de la pastilla del micrófono y medía 26×26. Al morir
/// las pastillas (promesa 162) la señal de «te estoy oyendo» pasa a ser la carita misma, y con eso
/// el halo hereda un límite que antes no tenía: la ventana de la carita suelta mide exactamente
/// <see cref="CaritaPx"/> + 2·<see cref="AirePx"/>, y no hay un píxel más. Un halo que se pase de
/// ahí no se ve grande — se ve CORTADO contra un borde que es un círculo con una esquina, que es la
/// misma clase de fallo que la sombra recortada de la promesa 154.
///
/// Por eso el tope está calculado y no elegido a ojo, y por eso lo comprueba el contrato barriendo
/// el rango entero de voz: una constante que hoy cabe deja de caber en cuanto alguien toque el
/// tamaño de la carita, y el día que eso pase el juez lo dice antes que la pantalla.
/// </remarks>
public static class ReglaDelHalo
{
    /// <summary>El diámetro de la carita suelta (<c>CollapsedFace</c> en el XAML).</summary>
    public const double CaritaPx = 66;

    /// <summary>El aire alrededor (el <c>Margin</c> de <c>CollapsedGroup</c>): todo lo que hay.</summary>
    /// <remarks>
    /// Es TAMBIÉN la distancia de la carita al canto de la pantalla, porque la ventana se pega al
    /// borde y el aire va dentro. Bajó de 28 a 17 el 2026-09-30, en tres pasos y mirando la
    /// pantalla con el dueño: a 21 (el 20–30 % que pidió) no se notó, a 14 «te pasaste un poco», y
    /// pidió el punto medio, alineado con la pestaña del muelle.
    ///
    /// 17 NO ES UN PUNTO MEDIO A OJO: es el EJE DE LA PESTAÑA del muelle —se aparta 10 del borde y
    /// mide 14 de blanco (Muelle.SeparacionDelBorde + AnchoPestana / 2)—, así que el canto de la
    /// carita cae sobre la línea gris que tiene debajo. Si la pestaña se mueve, esto va con ella.
    ///
    /// LO QUE LO LIMITA POR ABAJO ES EL HALO: el aire tiene que caber su pico (ver
    /// <see cref="Escala"/>). La sombra (Sombra1: 7 por lado, 10 por abajo) cabe sin apuros.
    /// </remarks>
    public const double AirePx = 17;

    /// <summary>Lo que mide la ventana de la carita suelta, y por tanto el techo del halo.</summary>
    public static double VentanaPx => CaritaPx + 2 * AirePx;

    /// <summary>
    /// Cuánto se agranda el halo. Al hablar late con la voz; callada, un latido lento que solo dice
    /// «sigo aquí» — porque un halo quieto y un micrófono cerrado se ven igual.
    /// </summary>
    /// <param name="nivelVoz">El nivel que mueve la boca, para que lo que se ve pulsar sea
    /// exactamente lo que se está oyendo y no una animación con vida propia.</param>
    /// <param name="pasoDeLaBoca">El contador de la boca, que da la fase del latido en reposo.</param>
    public static double Escala(double nivelVoz, int pasoDeLaBoca)
    {
        // 1,12 + 0,38 topa en 1,50: 66·1,50 = 99 y la ventana mide 100. Era 0,43 (pico 1,55) con
        // 28 px de aire; al bajar el aire a 17 (2026-09-30) el pico baja con él, o el halo se corta
        // contra la ventana. El reposo no se toca: el latido lento de «sigo aquí» es el mismo.
        return 1.12 + Fuerza(nivelVoz, pasoDeLaBoca) * 0.38;
    }

    /// <summary>
    /// Lo opaco que queda: se ve que hay voz sin taparla.
    /// </summary>
    /// <remarks>
    /// SUBIDO DOS VECES el 2026-09-06, y las dos a petición del dueño mirando la pantalla: primero
    /// de 0,12–0,38 a 0,26–0,68 («que sea más claro para poder verlo»), y esa subida siguió sin
    /// bastar («todavía no es lo suficientemente claro»). Ahora va de 0,50 a 0,92 — «que se sienta
    /// casi blanco», dicho así. Sigue siendo translúcido en su punto más bajo: el halo dice que hay
    /// voz, no tapa a quien la pone; pero en el pico casi no queda escritorio detrás.
    /// </remarks>
    public static double Opacidad(double nivelVoz, int pasoDeLaBoca)
        => 0.50 + Fuerza(nivelVoz, pasoDeLaBoca) * 0.42;

    /// <summary>
    /// De qué color: azul si te oye el collar, gris si te oye el micrófono del computador. No es
    /// decoración — es la promesa 157 dicha en un sitio donde se ve sin abrir nada: lo que la
    /// interfaz dice que te oye tiene que ser lo que te oye.
    /// </summary>
    public static System.Windows.Media.Color Color(bool porElCollar)
        => porElCollar
            ? System.Windows.Media.Color.FromRgb(0x3E, 0x9B, 0xFF)
            : System.Windows.Media.Color.FromRgb(0xA8, 0xA8, 0xAE);

    /// <summary>Morado reservado para una actualización en curso: estado global, no fuente de voz.</summary>
    public static System.Windows.Media.Color ColorParaEstado(bool porElCollar, bool actualizando)
        => actualizando
            ? System.Windows.Media.Color.FromRgb(0xA9, 0x6B, 0xF6)
            : Color(porElCollar);

    /// <summary>
    /// Cuánta señal hay ahora, entre 0 y 1. El umbral de 0,004 separa «hay voz» de «hay sala»: por
    /// debajo, el ruido de fondo haría latir el halo como si alguien estuviera hablando.
    /// </summary>
    private static double Fuerza(double nivelVoz, int pasoDeLaBoca)
        => nivelVoz > 0.004
            ? Math.Min(1, Math.Pow(nivelVoz, 0.55) * 1.45)
            : 0.18 + 0.10 * Math.Sin(pasoDeLaBoca * 0.16);
}
