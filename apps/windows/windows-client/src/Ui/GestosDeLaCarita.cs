using System;

namespace U.WindowsClient.Ui;

/// <summary>Los gestos grandes que la carita hace sola, en reposo.</summary>
public enum GestoDeLaCarita
{
    /// <summary>Girar la cabeza a un lado, quedarse mirando y volver.</summary>
    Mirar,
    /// <summary>Sacar las manos y saludar.</summary>
    Manos,
    /// <summary>Aplastarse y estirarse, un latido.</summary>
    Pulso,
}

/// <summary>
/// La cadencia de la carita: cuándo parpadea y cuándo hace algo más (spec 052, promesa 444).
///
/// Dos relojes y no uno, y es la decisión de fondo. En agosto la carita «se veía ansiosa» y los gestos
/// se espaciaron a 8-18 s; el parpadeo iba en el mismo reloj, así que parpadeaba cada ~20 s — menos
/// que una estatua. Una cara real parpadea cada pocos segundos y NADIE lo lee como ansiedad: lo que
/// cansa son los gestos grandes. Así que el parpadeo va aparte, cada 3-7 s, y los gestos grandes se
/// quedan donde el dueño los puso.
///
/// El parpadeo, como en Coucou (<c>blink</c>): cierra en 70 ms y abre en 130. La onda simétrica de
/// 340 ms que había antes se leía como un párpado mecánico.
///
/// Pura: recibe el dado y devuelve el plazo, para que la cadencia se juzgue sin esperar ni azar.
/// </summary>
public static class GestosDeLaCarita
{
    public const int CierraMs = 70;
    public const int AbreMs = 130;
    /// <summary>Entre los dos parpadeos de uno doble.</summary>
    public const int EntreDobleMs = 90;

    /// <summary>Segundos hasta el próximo parpadeo, para un dado en [0, 1).</summary>
    public static double ProximoParpadeo(double dado) => 3 + 4 * Math.Clamp(dado, 0, 1);

    /// <summary>Segundos hasta el próximo gesto grande: 8-18, lo que el dueño fijó en agosto.</summary>
    public static double ProximoGesto(double dado) => 8 + 10 * Math.Clamp(dado, 0, 1);

    /// <summary>Uno de cada cinco parpadeos, más o menos, es doble (Coucou: el 22 %).</summary>
    public static bool EsDoble(double dado) => dado < 0.22;

    /// <summary>
    /// Qué gesto grande toca. Mirar es el más frecuente porque es el más callado; las manos, el que más
    /// se nota, van una de cada tres veces para que sigan siendo «de vez en cuando».
    /// </summary>
    public static GestoDeLaCarita Elegir(double dado) =>
        dado < 0.5 ? GestoDeLaCarita.Mirar
        : dado < 0.8 ? GestoDeLaCarita.Manos
        : GestoDeLaCarita.Pulso;
}
