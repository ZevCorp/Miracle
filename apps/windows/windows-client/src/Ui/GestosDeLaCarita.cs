using System;

namespace U.WindowsClient.Ui;

/// <summary>
/// La cadencia de la carita: qué hace SOLA y cada cuánto, y cuánto tarda en cambiar de cara
/// (spec 052, promesas 444 y 448).
///
/// SOLA, SOLO PARPADEA. La primera vuelta de la spec copió de la referencia (Coucou) la costumbre de
/// gesticular: cada 8-18 s giraba la cabeza, saludaba o daba un pulso. El dueño, al verlo
/// (2026-10-01): «el repo de inspiración es de un diseñador que lo hizo para que esté todo el tiempo
/// haciendo gestos; prefiero que nuestra interacción sea mucho más basada en acciones reales». Girar
/// la cabeza es ahora mirar lo que Ü toca, y el pulso es la respuesta a un toque. El dado que elegía un
/// gesto grande y su reloj se borraron: dejarlos sin usar es la forma en que vuelven.
///
/// El parpadeo va a la cadencia de la carita de siempre —un gesto cada 8-18 s, que «no se siente
/// invasivo»—, con la forma nueva: cierra en 70 ms y abre en 130, como en Coucou (<c>blink</c>). La
/// onda simétrica de 340 ms que había antes se leía como un párpado mecánico.
///
/// El saludo es lo único grande que sale solo, y «como cada dos horas, con rangos aleatorios pero
/// largos: que sea raro de ver».
///
/// Pura: recibe el dado y devuelve el plazo, para que la cadencia se juzgue sin esperar ni azar.
/// </summary>
public static class GestosDeLaCarita
{
    public const int CierraMs = 70;
    public const int AbreMs = 130;
    /// <summary>Entre los dos parpadeos de uno doble.</summary>
    public const int EntreDobleMs = 90;

    /// <summary>Segundos hasta el próximo parpadeo, para un dado en [0, 1): de 8 a 18.</summary>
    public static double ProximoParpadeo(double dado) => 8 + 10 * Math.Clamp(dado, 0, 1);

    /// <summary>Uno de cada cinco parpadeos, más o menos, es doble (Coucou: el 22 %).</summary>
    public static bool EsDoble(double dado) => dado < 0.22;

    /// <summary>Segundos hasta el próximo saludo espontáneo: de hora y media a tres horas.</summary>
    public static double ProximoSaludo(double dado) => (90 + 90 * Math.Clamp(dado, 0, 1)) * 60;

    // ── Cambiar de cara ───────────────────────────────────────────────────────────────────────
    //
    // La carita no salta de una expresión a otra: llega. Y hablar es el caso que manda, porque la boca
    // no se abre (promesa 448): lo que se ve es la sonrisa ensanchándose mientras dice una frase y
    // relajándose al callar. Los tiempos son los de la envolvente que el dueño eligió para el halo el
    // 2026-09-06 —«a ritmo de sílaba da la sensación de una persona ansiosa»—: va a ritmo de frase.

    public const int EnsancharMs = 260;
    public const int RelajarMs = 900;
    public const int CambiarMs = 320;

    /// <summary>Milisegundos que tarda en llegar a la cara de <paramref name="hasta"/> viniendo de <paramref name="desde"/>.</summary>
    public static int CuantoTardaEnLlegar(FaceMood desde, FaceMood hasta) =>
        hasta == FaceMood.Hablando ? EnsancharMs
        : desde == FaceMood.Hablando ? RelajarMs
        : CambiarMs;

    /// <summary>
    /// ¿Parpadea al cambiar de estado? Sí —cambiar de estado es un pensamiento nuevo—, salvo entre
    /// hablar y callar: en una conversación eso pasa cada pocos segundos, y parpadear en cada frase es
    /// justo el tic que la cadencia de arriba evita.
    /// </summary>
    public static bool ParpadeaAlCambiar(FaceMood desde, FaceMood hasta) => !(DeLaConversacion(desde) && DeLaConversacion(hasta));

    private static bool DeLaConversacion(FaceMood m) => m is FaceMood.Hablando or FaceMood.Conversando;
}
