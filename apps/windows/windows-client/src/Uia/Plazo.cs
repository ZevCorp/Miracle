using System.Runtime.ExceptionServices;

namespace U.WindowsClient.Uia;

/// <summary>
/// UNA LLAMADA A UIA CON PLAZO (spec 054, promesa 490).
/// </summary>
/// <remarks>
/// System.Windows.Automation no admite plazo: una app cuyo proveedor no contesta deja la llamada esperando para siempre.
/// El 2026-09-27 el Explorador tardó 252.579 ms en contestar una lectura, y U entero se quedó detrás: abrir la
/// Calculadora «tardó» 350 s. El lector de u/ usa el UIA de COM, que sí tiene plazo (1,5 s de conexión, 3 s de
/// transacción); el viejo se envuelve aquí. El hilo que se queda esperando a la app se abandona —no se puede
/// cancelar una llamada entre procesos—, pero U sigue.
/// </remarks>
public static class Plazo
{
    /// <summary>true y el resultado si llega antes de <paramref name="ms"/>; false si no. Un fallo dentro del plazo sube tal cual.</summary>
    public static bool Con<T>(Func<T> trabajo, int ms, out T? resultado)
    {
        var tarea = Task.Run(trabajo);
        try
        {
            if (tarea.Wait(ms)) { resultado = tarea.Result; return true; }
        }
        catch (AggregateException e) when (e.InnerException != null)
        {
            ExceptionDispatchInfo.Capture(e.InnerException).Throw();
        }
        resultado = default;
        return false;
    }
}
