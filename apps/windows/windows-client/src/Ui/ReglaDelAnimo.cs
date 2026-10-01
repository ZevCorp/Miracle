using System;

namespace U.WindowsClient.Ui;

/// <summary>Lo que está pasando ahora mismo, tal como lo ve la ventana de la carita. Todo apagado = reposo.</summary>
public sealed class LoQuePasa
{
    /// <summary>Hay una conversación de voz abierta.</summary>
    public bool VozViva { get; set; }
    /// <summary>Cuánto hace que se prendió, en segundos.</summary>
    public double SegundosConLaVoz { get; set; }
    /// <summary>Ü está sonando por el altavoz. No cambia la cara: está aquí para que conste que no la cambia.</summary>
    public bool UHabla { get; set; }
    /// <summary>Hay una herramienta en curso, o acaba de terminar (<see cref="ReglaDelAnimo.EjecutandoAhora"/>), o corre un trabajo.</summary>
    public bool Ejecutando { get; set; }
    /// <summary>Ü preguntó algo y espera (<see cref="ReglaDelAnimo.EsperaTuRespuesta"/>), o hay una pregunta escrita sin contestar.</summary>
    public bool EsperaRespuesta { get; set; }
    /// <summary>El micrófono del dictado viejo está abierto.</summary>
    public bool Dictando { get; set; }
    /// <summary>Se le está enseñando: graba lo que haces.</summary>
    public bool Ensenando { get; set; }
    /// <summary>Habla la voz de Windows (la de respaldo).</summary>
    public bool HablaPorWindows { get; set; }
    public bool Fallo { get; set; }
    public bool Detenido { get; set; }
}

/// <summary>
/// QUÉ CARA PONE LA CARITA, según lo que pasa (spec 078, promesa 693). Pura.
/// </summary>
/// <remarks>
/// POR QUÉ EXISTE. Hasta el 2026-10-01 esto era una escalera dentro de la ventana, y su primer peldaño
/// era «si hay conversación viva: hablando o conversando». Volvía ahí, antes de mirar si Ü estaba
/// ejecutando algo o esperando una respuesta — y casi todo lo que Ü ejecuta lo ejecuta en una
/// conversación. «Trabajando» y «esperando» llevaban meses dibujadas y el dueño no las había visto
/// nunca: «no veo la expresión de esperando en acción, tampoco la de trabajando».
///
/// El orden ES la prioridad:
///  1. espera tu respuesta — gana incluso a ejecutar, porque preguntar por voz ES una herramienta en curso;
///  2. ejecuta — trabaja, aunque haya conversación y aunque esté hablando;
///  3. recién prendida la voz, escucha: cejas arriba y respira. <see cref="EscuchaAlEncenderSeg"/> segundos
///     y se calma, porque respirar agrandándose medio minuto al lado del trabajo ya pesa («si se queda
///     escuchando mucho tiempo, que no esté expandiéndose así»);
///  4. conversa: la sonrisa de siempre.
/// Y cuando Ü habla NO cambia de cara («por ahora que no haga nada cuando hable»): el halo ya lo dice.
/// </remarks>
public static class ReglaDelAnimo
{
    /// <summary>Lo que dura la cara de escuchar al prender la voz. El dueño dijo «25 o 40»; es respirar agrandándose.</summary>
    public const int EscuchaAlEncenderSeg = 25;

    /// <summary>Tras la última herramienta sigue «trabajando» este rato: entre dos seguidas no va y viene.</summary>
    public const int TrabajoSeSostieneMs = 1200;

    /// <summary>Lo que espera una respuesta antes de volver a su cara.</summary>
    public const int EsperaLaRespuestaSeg = 20;

    public static FaceMood Cual(LoQuePasa p)
    {
        if (!p.VozViva && p.Dictando) return FaceMood.Escuchando;
        if (!p.VozViva && p.Ensenando) return FaceMood.Grabando;
        if (p.EsperaRespuesta) return FaceMood.Esperando;
        if (p.Ejecutando) return FaceMood.Trabajando;
        if (p.VozViva) return p.SegundosConLaVoz < EscuchaAlEncenderSeg ? FaceMood.Escuchando : FaceMood.Conversando;
        if (p.HablaPorWindows) return FaceMood.Hablando;
        if (p.Fallo) return FaceMood.Fallo;
        if (p.Detenido) return FaceMood.Detenido;
        return FaceMood.Reposo;
    }

    /// <summary>¿Está ejecutando? Con alguna herramienta en curso, o si la última acabó hace menos de <see cref="TrabajoSeSostieneMs"/>.</summary>
    public static bool EjecutandoAhora(int herramientasEnCurso, long msDesdeQueAcaboLaUltima) =>
        herramientasEnCurso > 0 || msDesdeQueAcaboLaUltima < TrabajoSeSostieneMs;

    /// <summary>
    /// ¿Espera tu respuesta? Si lo último que dijo Ü acaba en pregunta, nadie ha hablado ni hecho nada
    /// después, y no han pasado <see cref="EsperaLaRespuestaSeg"/> segundos. El signo de interrogación es
    /// la única señal que hay: la herramienta de preguntar y una pregunta dicha de palabra llegan igual.
    /// </summary>
    public static bool EsperaTuRespuesta(string loUltimoQueDijoU, double segundosDesdeQueCallo, bool alguienHizoAlgoDespues) =>
        !alguienHizoAlgoDespues
        && segundosDesdeQueCallo < EsperaLaRespuestaSeg
        && (loUltimoQueDijoU ?? "").TrimEnd().EndsWith('?');

    /// <summary>
    /// ¿Se alegra al cambiar de cara? Al salir de trabajar hacia algo que no sea un fallo, una parada o una
    /// pregunta: terminó bien (promesa 699).
    /// </summary>
    public static bool SeAlegra(FaceMood antes, FaceMood ahora) =>
        antes == FaceMood.Trabajando
        && ahora is not (FaceMood.Trabajando or FaceMood.Fallo or FaceMood.Detenido or FaceMood.Esperando);
}
