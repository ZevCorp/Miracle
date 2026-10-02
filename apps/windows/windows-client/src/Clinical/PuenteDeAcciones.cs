using System.Windows;
using U.WindowsClient.Voice;

namespace U.WindowsClient.Clinical;

/// <summary>
/// EL PUENTE ENTRE EL ✓ DE UNA SECCIÓN Y LO QUE Ü APRENDIÓ (spec 084). Mismo patrón y misma razón que
/// <see cref="PuenteASap"/>: la ventana de la nota nace antes que la carita, así que la carita cuelga aquí sus dos
/// funciones cuando está lista.
/// </summary>
/// <remarks>
/// SON DOS PASOS Y NO UNO, a propósito: pensar no toca nada, y ejecutar solo pasa tras el botón de aprobar. Quien
/// llama a <see cref="Ejecutar"/> sin haber enseñado la propuesta a la persona se salta lo único que el ✓ promete.
/// </remarks>
public static class PuenteDeAcciones
{
    /// <summary>
    /// Ü se acerca a la sección y piensa qué acción quiere la persona con esa información. Recibe la información, si
    /// son varias secciones juntas, y dónde está la sección en pantalla (píxeles físicos) para ir junto a ella.
    /// </summary>
    public static Func<string, bool, Rect?, CancellationToken, Task<LaAccionDeLaNota.Propuesta>>? Proponer { get; set; }

    /// <summary>Ü ejecuta la acción aprobada. Devuelve lo que cuenta al terminar; el progreso, lo que va haciendo.</summary>
    public static Func<LaAccionDeLaNota.Propuesta, string, IProgress<string>, CancellationToken, Task<string>>? Ejecutar { get; set; }

    public static bool Disponible => Proponer != null && Ejecutar != null;
}
