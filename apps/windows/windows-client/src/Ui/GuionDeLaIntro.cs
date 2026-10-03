namespace U.WindowsClient.Ui;

/// <summary>Lo que hace la carita en la intro, en orden.</summary>
public enum PasoDeLaIntro { Transformarse, MirarAUnLado, VolverAlCentro, Preguntar, Colgar }

/// <summary>
/// LA HISTORIA DE LA INTRO (spec 086, promesas 881 y 882). Pura: cuándo arranca y qué pasa a qué milisegundo.
/// </summary>
/// <remarks>
/// La pidió el dueño así: la Ü se vuelve la carita, «luego mira hacia un lado, al centro de nuevo, y hace la
/// transición de gestos de “Ü te pregunta” – “cuelgas”» —los dos botones de la vitrina con esos nombres—. Los
/// silencios entre paso y paso son para que cada gesto se vea entero: mirar tarda 580 ms en llegar y volver 460.
/// </remarks>
public static class GuionDeLaIntro
{
    public readonly record struct Momento(int EnMs, PasoDeLaIntro Paso);

    /// <summary>
    /// Lo que hay que mantener la U para que empiece. Tres segundos, como pidió el dueño: nadie la dispara sin
    /// querer, y quien presenta puede tenerla apretada mientras habla y soltarla cuando quiera, sin que pase nada.
    /// </summary>
    public const int MantenerLaUMs = 3000;

    /// <summary>Lo que tarda la Ü en ser la carita: tres resortes escalonados y el cuerpo (<see cref="LaUDeLaCarita"/>).</summary>
    public const int TransformarseMs = 3000;

    public static bool Arranca(long msApretada) => msApretada >= MantenerLaUMs;

    public static IReadOnlyList<Momento> Pasos { get; } = new[]
    {
        new Momento(0, PasoDeLaIntro.Transformarse),
        new Momento(TransformarseMs + 700, PasoDeLaIntro.MirarAUnLado),
        new Momento(TransformarseMs + 2300, PasoDeLaIntro.VolverAlCentro),
        new Momento(TransformarseMs + 3300, PasoDeLaIntro.Preguntar),
        new Momento(TransformarseMs + 5500, PasoDeLaIntro.Colgar),
    };
}
