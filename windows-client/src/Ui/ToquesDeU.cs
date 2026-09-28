using System.Runtime.InteropServices;
using System.Windows.Interop;
using U.WindowsClient.Diagnostics;

namespace U.WindowsClient.Ui;

/// <summary>
/// UN CLIC DE Ü NO ES UN TOQUE DE LA PERSONA (promesa 508, spec 061): los botones y la rueda que llevan la firma de Ü se
/// tiran antes de que WPF los vea, en TODAS las ventanas del hilo de la interfaz —la carita, el muelle, el notch, las
/// tarjetas, la consulta, los globos—, y el log lo dice.
/// </summary>
/// <remarks>
/// LO QUE PASÓ: el 2026-09-27 la carita se posaba sobre el clic siguiente de Ü, y ese clic abría la voz de pago. Cinco
/// sesiones en un día. La sonda 0 (2026-09-28) midió que el filtro de hilo ve la firma y que, marcado como manejado, WPF
/// no ve el clic. Y midió su límite: la ventana se ACTIVA igual, porque la activación ocurre antes y ahí la firma no se
/// ve. Por eso esto es la red de debajo; lo que evita el clic es que la carita sea fantasma fuera de casa (505) y que
/// el ciclo no pulse sobre una ventana de Ü (510).
///
/// El movimiento no se tira: el paso del ratón no se puede firmar (SetCursorPos) y tirarlo rompería el hover.
/// </remarks>
public static class ToquesDeU
{
    [DllImport("user32.dll")] private static extern IntPtr GetMessageExtraInfo();

    /// <summary>¿Se tira? Solo botones y rueda —de cliente y de borde— que lleven la firma de Ü.</summary>
    public static bool Descartar(int msg, IntPtr extra) =>
        U.Ciclo.Raton.EsDeU(extra) && (msg is >= 0x201 and <= 0x20E || msg is >= 0xA1 and <= 0xAD);

    /// <summary>Juzga un mensaje y, si se tira, lo dice una vez. Devuelve si se tiró.</summary>
    public static bool AlMensaje(IntPtr hwnd, int msg, Func<IntPtr> extra, Action<string> anotar)
    {
        if (!Descartar(msg, extra())) return false;
        anotar($"toque de Ü sobre 0x{hwnd.ToInt64():X} (msg 0x{msg:X}): descartado, no es la persona");
        return true;
    }

    private static bool _instalado;

    /// <summary>Se engancha al hilo de la interfaz una sola vez. Idempotente, como SinCarteles.</summary>
    /// <param name="firma">Quién lee la firma del mensaje. Solo el contrato lo cambia: fuera, GetMessageExtraInfo.</param>
    public static void Instalar(Func<IntPtr>? firma = null)
    {
        if (_instalado) return;
        _instalado = true;
        var leer = firma ?? GetMessageExtraInfo;
        ComponentDispatcher.ThreadFilterMessage += (ref MSG m, ref bool manejado) =>
        {
            if (!manejado && AlMensaje(m.hwnd, m.message, leer, s => LogBus.Log("toque", s))) manejado = true;
        };
    }
}
