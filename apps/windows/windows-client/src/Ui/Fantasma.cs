using System.Runtime.InteropServices;

namespace U.WindowsClient.Ui;

/// <summary>
/// LA CARITA FANTASMA (promesa 505, spec 061): con WS_EX_TRANSPARENT sobre su ventana en capas, el ratón la atraviesa y
/// el clic cae en lo que hay debajo. Es lo ÚNICO que toca el estilo de la carita.
/// </summary>
/// <remarks>
/// MEDIDO ANTES DE ESCRIBIRLO (sonda 0, 2026-09-28, en este PC al 125 %): con el bit, un clic real sobre el centro opaco
/// cae en la ventana de abajo; sin él, en la carita. El bit sobrevive a Topmost, mover, cambiar de tamaño, opacidad,
/// Hide/Show, Visibility, cambiar el contenido y Activate: WPF relee el estilo vivo antes de escribirlo. No hace falta
/// SetWindowPos(FRAMECHANGED): WindowFromPoint lo respeta en el acto.
/// </remarks>
internal static class Fantasma
{
    [DllImport("user32.dll")] private static extern int GetWindowLong(IntPtr h, int i);
    [DllImport("user32.dll")] private static extern int SetWindowLong(IntPtr h, int i, int v);

    private const int GWL_EXSTYLE = -20, WS_EX_TRANSPARENT = 0x20;

    /// <summary>Pone o quita el fantasma y devuelve el estilo RELEÍDO de la ventana, para que el log diga lo que quedó.</summary>
    public static int Poner(IntPtr ventana, bool fantasma)
    {
        if (ventana == IntPtr.Zero) return 0;
        int ex = GetWindowLong(ventana, GWL_EXSTYLE);
        SetWindowLong(ventana, GWL_EXSTYLE, fantasma ? ex | WS_EX_TRANSPARENT : ex & ~WS_EX_TRANSPARENT);
        return GetWindowLong(ventana, GWL_EXSTYLE);
    }
}
