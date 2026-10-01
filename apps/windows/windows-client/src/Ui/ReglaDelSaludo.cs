using System;

namespace U.WindowsClient.Ui;

/// <summary>Por qué saluda la carita: los cuatro momentos en que la persona vuelve, y el rato.</summary>
public enum MotivoDelSaludo
{
    /// <summary>Se abrió Ü.</summary>
    Arranque,
    /// <summary>Se desbloqueó el computador.</summary>
    Desbloqueo,
    /// <summary>Volvió a tocar el PC tras un rato sin hacerlo.</summary>
    Vuelta,
    /// <summary>Le acercó el ratón a la carita.</summary>
    Acercarse,
    /// <summary>Sola, pasado el rato.</summary>
    Rato,
}

/// <summary>
/// CUÁNDO SALUDA LA CARITA (spec 077, promesa 690). Pura: el reloj se le da, y cuánto lleva el PC sin
/// tocarse también.
/// </summary>
/// <remarks>
/// El saludo se movió dos veces en dos días, y las dos por gusto. Salía cada 8-18 segundos con los demás
/// gestos («todo el tiempo haciendo gestos»), se mandó a cada dos horas («que sea raro de ver») y al
/// día siguiente el dueño: «creo que exageramos con lo de tres horas […] que salude apenas abres el
/// app, o apenas interactúas como que la estás viendo por primera vez en el día o en el rato, o
/// desbloqueas el computador […] y luego que vuelva a saludar espontáneamente cada media hora». No
/// pedía un número intermedio: pedía que salude CUANDO HAY A QUIÉN SALUDAR.
///
/// Dos guardas, y las dos salen de cómo llegan los avisos y no de un gusto:
///  · volver de un bloqueo avisa dos veces a la vez —el desbloqueo y la primera tecla tras la ausencia—,
///    y un saludo doble se lee como un tic: nunca dos en menos de <see cref="EntreSaludosSeg"/>;
///  · en mitad de una conversación o de un trabajo no saluda, y ese momento se PIERDE, no se aplaza:
///    saludar tres minutos tarde no es saludar.
/// </remarks>
public sealed class ReglaDelSaludo
{
    /// <summary>Sin tocar el PC este rato, la persona se fue: un café, una llamada. Menos es estar leyendo.</summary>
    public const int AusenciaSeg = 5 * 60;

    /// <summary>Acercarle el ratón solo saluda si hacía este rato que no la trataba.</summary>
    public const int RatoSinTratarlaSeg = 10 * 60;

    /// <summary>Nunca dos saludos más juntos que esto.</summary>
    public const int EntreSaludosSeg = 90;

    private readonly Func<long> _relojMs;
    private long? _ultimoSaludo, _ultimoTrato;
    private bool _ausente;

    public ReglaDelSaludo(Func<long> relojMs) => _relojMs = relojMs;

    /// <summary>Segundos hasta el próximo saludo espontáneo, para un dado en [0, 1): de 20 a 40 minutos.</summary>
    public static double ProximoEspontaneo(double dado) => (20 + 20 * Math.Clamp(dado, 0, 1)) * 60;

    /// <summary>
    /// ¿Saluda ahora, por este motivo? <paramref name="libre"/>: la carita está a la vista, en reposo y
    /// en casa. Si contesta que sí, queda anotado como saludo.
    /// </summary>
    public bool Toca(MotivoDelSaludo motivo, bool libre)
    {
        long ahora = _relojMs();
        if (motivo == MotivoDelSaludo.Acercarse)
        {
            // ACERCÁRSELO YA ES TRATARLA, salude o no: si no, pasar por encima cada pocos minutos nunca
            // dejaría correr el rato.
            bool haciaUnRato = _ultimoTrato is not long t || ahora - t >= RatoSinTratarlaSeg * 1000L;
            _ultimoTrato = ahora;
            if (!haciaUnRato) return false;
        }
        // Sola no saluda a una silla vacía: cuando la persona vuelva, la saluda la vuelta.
        if (motivo == MotivoDelSaludo.Rato && _ausente) return false;
        if (!libre) return false;
        if (_ultimoSaludo is long u && ahora - u < EntreSaludosSeg * 1000L) return false;
        _ultimoSaludo = _ultimoTrato = ahora;
        return true;
    }

    /// <summary>La persona la tocó o le prendió la voz: desde ahora corre el rato de acercarle el ratón.</summary>
    public void Tratada() => _ultimoTrato = _relojMs();

    /// <summary>
    /// Se le dice cada pocos segundos cuánto lleva el PC sin una tecla ni un movimiento de ratón, y
    /// contesta si la persona ACABA DE VOLVER: llevaba <see cref="AusenciaSeg"/> o más sin tocarlo y lo
    /// acaba de tocar. Vuelve una vez, no en cada tecla.
    /// </summary>
    public bool Volvio(double segundosSinTocarElPc)
    {
        if (segundosSinTocarElPc >= AusenciaSeg) { _ausente = true; return false; }
        if (!_ausente) return false;
        _ausente = false;
        return true;
    }
}
