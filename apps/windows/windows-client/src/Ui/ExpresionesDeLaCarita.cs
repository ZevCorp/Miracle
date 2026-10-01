using System;

namespace U.WindowsClient.Ui;

/// <summary>Los gestos de la carita: caras que entran y salen encima de la de su estado.</summary>
public enum ExpresionDeLaCarita
{
    Ninguna,
    /// <summary>«Te escucho»: quieta, ojos abiertos, boca pequeña. La de cuando graba.</summary>
    Atenta,
    /// <summary>«Te sigo»: una ceja arriba y la cabeza ladeada. La de cuando espera.</summary>
    Entiende,
    /// <summary>«¡Listo!»: sonrisa grande y ojos entornados.</summary>
    Contenta,
    /// <summary>«¡Eh!»: cejas muy arriba, ojos como platos, boca pequeña.</summary>
    Sorprendida,
}

/// <summary>
/// CUÁNTO DURA CADA GESTO Y CUÁL TOCA (spec 078, promesas 694 y 696). Pura.
/// </summary>
/// <remarks>
/// Un gesto no es un estado. El dueño lo dijo dos veces el mismo día (2026-10-01): de la cara de atender,
/// «me gusta, pero que entre y salga, que no se quede pegado: hace el gesto un segundo y pasa de nuevo a
/// sonreír»; y de pulsar, «me gustó mucho la combinación entre grabando y que pulse algo, o esperando y
/// pulsa: ya no pulsa recto». Los cuatro entran rápido, se sostienen lo justo para leerse y salen
/// despacio: una cara que se va de golpe se lee como un tic.
/// </remarks>
public static class ExpresionesDeLaCarita
{
    /// <summary>Lo que tarda en entrar, lo que se sostiene, lo que tarda en salir (ms) y cuánto ladea la cabeza (grados).</summary>
    public static (int EntraMs, int SostieneMs, int SaleMs, double Ladeo) Tiempos(ExpresionDeLaCarita cual) => cual switch
    {
        ExpresionDeLaCarita.Atenta => (160, 700, 340, 0),
        ExpresionDeLaCarita.Entiende => (200, 800, 380, 7),
        ExpresionDeLaCarita.Contenta => (180, 900, 420, -4),
        ExpresionDeLaCarita.Sorprendida => (110, 520, 300, 0),
        _ => (0, 0, 0, 0),
    };

    /// <summary>De que empieza a entrar a que termina de salir.</summary>
    public static int DuracionMs(ExpresionDeLaCarita cual)
    {
        var t = Tiempos(cual);
        return t.EntraMs + t.SostieneMs + t.SaleMs;
    }

    /// <summary>
    /// Con qué cara pulsa el pulso número <paramref name="n"/>: alterna atender y entender, para que dos
    /// pulsos seguidos no sean el mismo gesto repetido.
    /// </summary>
    public static ExpresionDeLaCarita AlPulsar(int n) =>
        Math.Abs(n) % 2 == 0 ? ExpresionDeLaCarita.Atenta : ExpresionDeLaCarita.Entiende;
}
