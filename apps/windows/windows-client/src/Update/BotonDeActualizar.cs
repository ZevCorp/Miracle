namespace U.WindowsClient.Update;

public enum EstadoDelBoton { EnReposo, Trabajando, HayVersionLista }

public enum GestoDelBoton { Nada, BuscarYAplicar, Aplicar }

/// <summary>
/// La regla del botón de actualizar del panel: qué estado enseña, qué hace un toque y qué se le dice
/// a la persona. La ventana solo pinta y obedece.
///
/// POR QUÉ UN SOLO BOTÓN (2026-10-01). Actualizar eran dos puertas en dos sitios: 🔄 en el panel de
/// desarrollo buscaba y descargaba, y ⬇ —una pastilla que solo existía cuando ya había algo
/// descargado— aplicaba. Quien quería actualizar no tenía nada que pulsar hasta que la pastilla
/// aparecía sola, y si el intento fallaba volvía a aparecer sin decir por qué. El dueño lo dijo así:
/// «no hay un botón confiable para actualizar la app una vez la tengo instalada».
///
/// Ahora hay uno, siempre en el mismo sitio, y un toque hace el trabajo entero.
/// </summary>
public static class BotonDeActualizar
{
    public static EstadoDelBoton Estado(bool hayVersionLista, bool trabajando) =>
        trabajando ? EstadoDelBoton.Trabajando
        : hayVersionLista ? EstadoDelBoton.HayVersionLista
        : EstadoDelBoton.EnReposo;

    /// <summary>Mientras trabaja, un segundo toque no hace nada: lanzar otra búsqueda encima no la acelera.</summary>
    public static GestoDelBoton AlPulsar(EstadoDelBoton estado) => estado switch
    {
        EstadoDelBoton.HayVersionLista => GestoDelBoton.Aplicar,
        EstadoDelBoton.EnReposo => GestoDelBoton.BuscarYAplicar,
        _ => GestoDelBoton.Nada,
    };

    /// <summary>Lo que lee un lector de pantalla: el dibujo dice el estado, y esto lo dice con palabras.</summary>
    public static string Nombre(EstadoDelBoton estado, string? versionLista) => estado switch
    {
        EstadoDelBoton.HayVersionLista => $"Actualizar Ü: la versión {versionLista} está lista",
        EstadoDelBoton.Trabajando => "Actualizando Ü",
        _ => "Buscar una versión nueva de Ü",
    };

    /// <summary>
    /// Lo que se le dice a la persona cuando la búsqueda no acaba en una versión que aplicar. El detalle
    /// técnico —la dirección, el error de red— se queda en el log: aquí no le sirve a nadie.
    /// </summary>
    public static string FraseDeLaBusqueda(Updater.Busqueda que, string detalle) => que switch
    {
        Updater.Busqueda.AlDia => $"Ya tienes la última versión ({detalle}).",
        Updater.Busqueda.NoAplica => "Esta copia de Ü no vino del instalador, así que no puede actualizarse sola.",
        Updater.Busqueda.Fallo => "No pude buscar la versión nueva. Revisa la conexión y vuelve a intentarlo.",
        _ => $"La versión {detalle} está lista.",
    };

    /// <summary>
    /// Lo que Ü cuenta al volver de un intento. Que la carpeta estaba abierta por otro programa solo se
    /// afirma si el actualizador lo escribió: es la causa que se arregla cerrando ese programa, y
    /// decirla sin saberlo mandaría a la persona a buscar algo que no hay.
    /// </summary>
    public static string FraseDelIntento(VeredictoDelIntento intento) => intento.Que switch
    {
        ResultadoDelIntento.Aplicada => $"Ya estoy en la versión {intento.Hacia}.",
        ResultadoDelIntento.NoAplicada when intento.Causa.Contains("running processes prevented", StringComparison.OrdinalIgnoreCase) =>
            $"No pude instalar la versión {intento.Hacia}: otro programa tiene abierta mi carpeta. Ciérralo y pulsa otra vez, o reinicia el equipo.",
        ResultadoDelIntento.NoAplicada =>
            $"No pude instalar la versión {intento.Hacia}. Pulsa otra vez; si se repite, reinicia el equipo.",
        _ => "",
    };
}
