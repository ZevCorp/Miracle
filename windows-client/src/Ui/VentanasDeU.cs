using System.Runtime.InteropServices;
using System.Text;

namespace U.WindowsClient.Ui;

/// <summary>
/// ¿QUÉ VENTANA HAY BAJO UN PUNTO, Y ES DE Ü? Para que un clic de Ü no caiga en una ventana de Ü (promesa 510, spec 061).
/// Solo Win32, sin WPF: se llama desde el hilo que pulsa, no desde el de la interfaz.
/// </summary>
/// <remarks>
/// WindowFromPoint se salta las ventanas en capas con WS_EX_TRANSPARENT y los píxeles con alfa cero, igual que el ratón
/// de verdad (sonda 0, 2026-09-28): lo que devuelve es lo que recibiría el clic.
/// </remarks>
internal static class VentanasDeU
{
    [StructLayout(LayoutKind.Sequential)] private struct PUNTO { public int X, Y; }
    [DllImport("user32.dll")] private static extern IntPtr WindowFromPoint(PUNTO p);
    [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr h, uint cual);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr h, StringBuilder texto, int max);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr h, StringBuilder texto, int max);
    [StructLayout(LayoutKind.Sequential)] private struct RECT { public int L, T, R, B; }
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int tecla);
    [StructLayout(LayoutKind.Sequential)]
    private struct GUITHREADINFO { public int cbSize, flags; public IntPtr hwndActive, hwndFocus, hwndCapture, hwndMenuOwner, hwndMoveSize, hwndCaret; public RECT rcCaret; }
    [DllImport("user32.dll")] private static extern bool GetGUIThreadInfo(uint hilo, ref GUITHREADINFO info);

    /// <summary>La ventana de arriba del todo que recibiría un clic en ese punto (en píxeles físicos).</summary>
    public static IntPtr Bajo(int x, int y) => GetAncestor(WindowFromPoint(new PUNTO { X = x, Y = y }), 2 /* GA_ROOT */);

    /// <summary>¿Es de este mismo proceso?</summary>
    public static bool EsDeU(IntPtr ventana)
    {
        if (ventana == IntPtr.Zero) return false;
        GetWindowThreadProcessId(ventana, out uint pid);
        return pid == (uint)Environment.ProcessId;
    }

    /// <summary>¿Cae el punto dentro de esa ventana, sea transparente o no?</summary>
    public static bool Dentro(IntPtr ventana, int x, int y) =>
        ventana != IntPtr.Zero && GetWindowRect(ventana, out var r) && x >= r.L && x < r.R && y >= r.T && y < r.B;

    /// <summary>
    /// ¿La persona tiene el ratón? El botón izquierdo abajo, o una ventana del hilo de Ü con la captura (pulsando o
    /// arrastrando la carita): mientras tanto, cualquier clic va a quien tiene la captura.
    /// </summary>
    public static bool LaPersonaTieneElRaton(IntPtr ventanaDeU)
    {
        if ((GetAsyncKeyState(0x01 /* VK_LBUTTON */) & 0x8000) != 0) return true;
        if (ventanaDeU == IntPtr.Zero) return false;
        uint hilo = GetWindowThreadProcessId(ventanaDeU, out _);
        var info = new GUITHREADINFO { cbSize = Marshal.SizeOf<GUITHREADINFO>() };
        return GetGUIThreadInfo(hilo, ref info) && info.hwndCapture != IntPtr.Zero;
    }

    /// <summary>Cómo se llama, para decirlo: su título, o su clase si no tiene.</summary>
    public static string Nombre(IntPtr ventana)
    {
        var sb = new StringBuilder(128);
        if (GetWindowText(ventana, sb, sb.Capacity) > 0) return sb.ToString();
        sb.Clear();
        return GetClassName(ventana, sb, sb.Capacity) > 0 ? sb.ToString() : $"0x{ventana.ToInt64():X}";
    }
}
