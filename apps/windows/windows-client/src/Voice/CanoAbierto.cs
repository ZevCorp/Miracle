namespace U.WindowsClient.Voice;

/// <summary>
/// EL CAÑO, ABIERTO AUNQUE NADIE HABLE (spec 081, promesa 790): cuándo toca mandar silencio, y cuánto.
/// </summary>
/// <remarks>
/// POR QUÉ. Medido el 2026-10-01 contra el servidor con la sonda de la voz: una sesión de GPT-Live a la que no le
/// llega ni un trozo de audio —una orden escrita— contesta «session.closed: expired» a los 30.975 ms, con el
/// delegado a mitad del trabajo, y lo que se le iba contando a la voz acaba en «context_injection_incomplete». En
/// la Ü de pruebas, la investigación en Google murió a los 30 s exactos de abrir, con nueve llamadas hechas. Con
/// silencio por el caño —trozos de 100 ms, a su ritmo— la misma sesión vivió 47 s, el trabajo terminó y los
/// cuatro avances se aceptaron.
///
/// AL RITMO DE UN MICRÓFONO, y no «un trozo cada tanto»: lo que el servidor necesita no está documentado, y lo
/// único medido es que con el caño abierto como lo deja un micrófono, vive. Cuesta lo mismo que un micrófono
/// abierto al que nadie le habla.
///
/// Y SOLO SI NO SALE AUDIO DE VERDAD: el silencio no pisa a la persona. Un micrófono manda un trozo cada 100 ms;
/// pasado un cuarto de segundo sin ninguno —lo escrito, el micrófono apagado, el aparato que se desconectó—, toca.
/// </remarks>
public static class CanoAbierto
{
    /// <summary>Sin audio saliendo este rato, toca silencio.</summary>
    public const int TrasMs = 250;

    /// <summary>Lo que dura un trozo de silencio: lo mismo que uno de micrófono.</summary>
    public const int TrozoMs = 100;

    public static bool Toca(bool caducaSinAudio, long msDesdeElUltimoAudio) => caducaSinAudio && msDesdeElUltimoAudio >= TrasMs;

    /// <summary>Un trozo de silencio en PCM16 mono a ese ritmo: todo ceros.</summary>
    public static byte[] Silencio(int ritmo) => new byte[Math.Max(0, ritmo) * 2 * TrozoMs / 1000];
}
