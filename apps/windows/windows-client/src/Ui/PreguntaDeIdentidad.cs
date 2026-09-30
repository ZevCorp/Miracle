using System;
using System.Windows;

namespace U.WindowsClient.Ui;

/// <summary>
/// Pregunta quién eres SIN detener a quien pregunta (spec 053, promesa 450).
///
/// Hasta el 2026-09-30 la bienvenida era un <c>ShowDialog()</c> dentro de <c>FaceWindow.Loaded</c>, y
/// su comentario decía «nunca bloquea el uso del asistente». Bloqueaba todo lo que venía detrás: el
/// MCP, el núcleo, hasta el log. Se midió con el CI del terreno, que arranca sin sesión y no contesta
/// nunca — a los 15 s había una sola ventana, «Te damos la bienvenida», y el 8790 cerrado. Lo mismo le
/// pasa a un equipo nuevo cuyo dueño no ve el popup detrás de otra ventana.
///
/// La pregunta no se quitó (la rama <c>experimento/reemplazo-jeff</c> lo hizo, y sin correo no hay
/// telemetría ni workflows con dueño): se abre con <c>Show()</c> y la respuesta se recoge al cerrar.
/// </summary>
public static class PreguntaDeIdentidad
{
    /// <summary>
    /// Abre <paramref name="ventana"/> y vuelve en el acto. Al cerrarse, si
    /// <paramref name="respuesta"/> trae nombre y correo, se los pasa a <paramref name="guardar"/>
    /// una vez; si no —cerrada con la X—, no se guarda nada y se volverá a preguntar al arrancar.
    /// </summary>
    public static void Abrir(Window ventana, Func<(string Nombre, string Correo)?> respuesta, Action<string, string> guardar)
    {
        ventana.Closed += (_, _) =>
        {
            var r = respuesta();
            // Vacío no es ausente (patrón nº9): una ventana que dejara el correo en "" no ha contestado.
            if (r is { } dicho && !string.IsNullOrWhiteSpace(dicho.Correo))
                guardar(dicho.Nombre ?? "", dicho.Correo);
        };
        ventana.Show();
    }
}
