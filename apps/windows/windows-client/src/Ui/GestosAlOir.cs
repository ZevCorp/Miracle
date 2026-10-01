using System;

namespace U.WindowsClient.Ui;

/// <summary>
/// LO QUE HACE LA CARITA MIENTRAS LE HABLAS (spec 078, promesa 695). Pura.
/// </summary>
/// <remarks>
/// «Que mientras le estoy hablando a veces ponga la cara de esperando, que se sienta que me está
/// entendiendo, que me está escuchando» (el dueño, 2026-10-01). El servidor de voz avisa de que la
/// persona EMPEZÓ a hablar (<c>speech_started</c>) y no de que acabó, así que esto va por reloj — pero
/// uno que solo corre mientras se le habla, y que se para en cuanto Ü contesta o ejecuta. No es el reloj
/// de reposo que se quitó en la spec 052: nace de algo que la persona está haciendo.
/// </remarks>
public static class GestosAlOir
{
    /// <summary>Como mucho este rato: pasado, se da por hecho que la persona terminó de hablar.</summary>
    public const int TopeSeg = 30;

    /// <summary>Milisegundos hasta el próximo gesto, para un dado en [0, 1): de 3,5 a 5,5 segundos.</summary>
    public static double ProximoMs(double dado) => 3500 + 2000 * Math.Clamp(dado, 0, 1);

    /// <summary>El gesto número <paramref name="n"/> de esta vez: empieza atendiendo, y alterna con entender.</summary>
    public static ExpresionDeLaCarita Cual(int n) =>
        Math.Abs(n) % 2 == 0 ? ExpresionDeLaCarita.Atenta : ExpresionDeLaCarita.Entiende;

    /// <summary>¿Sigue gesticulando? Mientras no pase el tope y Ü no haya contestado ni se haya puesto a ejecutar.</summary>
    public static bool Sigue(double segundosOyendo, bool uContestaOEjecuta) =>
        !uContestaOEjecuta && segundosOyendo < TopeSeg;
}
