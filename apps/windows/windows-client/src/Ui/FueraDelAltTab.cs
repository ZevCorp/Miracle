using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using U.WindowsClient.Diagnostics;

namespace U.WindowsClient.Ui;

/// <summary>
/// LAS PIEZAS FLOTANTES DE Ü NO SALEN EN ALT+TAB. Se decide aquí, en un solo sitio y para todo el
/// proceso (promesa 531, spec 064).
/// </summary>
/// <remarks>
/// POR QUÉ EXISTE (2026-09-30, lo pidió el dueño con dos fotos de su Alt+Tab). Salían dos «Ü» en
/// cada cambio de ventana —la carita y la pestaña del muelle—, entre lo que la persona de verdad
/// quería alcanzar. <c>ShowInTaskbar = false</c> las quita de la barra de tareas, NO de Alt+Tab:
/// Windows lista ahí toda ventana visible que no sea de herramienta.
///
/// LA CLASE DE ERROR ERA «CADA VENTANA SE ACUERDA, O NO». De las 9 piezas flotantes, 5 se ponían
/// <c>WS_EX_TOOLWINDOW</c> por su cuenta en su <c>OnSourceInitialized</c> y 4 no: la carita, el
/// muelle, el carrusel y las tarjetas de recuerdo. Arreglar esas cuatro a mano dejaba a la décima
/// igual de expuesta. Por eso es el mismo patrón que <see cref="SinCarteles"/>: se instala una vez
/// al arrancar y alcanza a las ventanas que todavía no existen.
///
/// Y TODA VENTANA DICE DE QUÉ CLASE ES. Flotante —vive encima del trabajo de la persona, no es un
/// sitio al que se va— o de trabajo —la consulta, los estudios, el inicio de sesión: ahí SÍ se
/// vuelve con Alt+Tab, y sacarlas sería perderlas—. El contrato recorre todas las clases que
/// heredan de <see cref="Window"/> y falla si una no está en ninguna lista: una ventana nueva no
/// puede colarse sin decirlo.
///
/// SE PONE AL CARGAR LA VENTANA, y basta: Alt+Tab lee el estilo vivo cada vez que se abre, así que
/// no hace falta llegar antes de que se pinte. Los dos <c>new Window</c> sueltos que hay (un aviso
/// y el panel de desarrollo) no son subclases y se quedan como están: ventanas de trabajo.
/// </remarks>
public static class FueraDelAltTab
{
    [DllImport("user32.dll")] private static extern int GetWindowLong(IntPtr h, int i);
    [DllImport("user32.dll")] private static extern int SetWindowLong(IntPtr h, int i, int v);

    private const int GWL_EXSTYLE = -20, WS_EX_TOOLWINDOW = 0x80, WS_EX_APPWINDOW = 0x40000;

    private static readonly HashSet<Type> Flotantes = new()
    {
        typeof(FaceWindow),          // la carita
        typeof(Muelle),              // la pestaña del borde y su panel
        typeof(PanelDeAcciones),     // el notch
        typeof(CarruselDeApps),
        typeof(TarjetaDeRecuerdo),
        typeof(AuraDeAprendizaje),
        typeof(HighlightOverlay),
        typeof(InspectorOverlay),
        typeof(LocatorBadge),
    };

    private static readonly HashSet<Type> DeTrabajo = new()
    {
        typeof(ConsultaWindow),
        typeof(EstudiosWindow),
        typeof(LoginWindow),
        typeof(OnboardingWindow),
        typeof(LogWindow),
        typeof(VideoLibraryWindow),
        typeof(WorkflowLibraryWindow),
    };

    /// <summary>Vive encima del trabajo de la persona: no sale en Alt+Tab.</summary>
    public static bool EsFlotante(Type ventana) => Flotantes.Contains(ventana);

    /// <summary>Es un sitio al que se va y se vuelve: sigue saliendo en Alt+Tab.</summary>
    public static bool EsDeTrabajo(Type ventana) => DeTrabajo.Contains(ventana);

    /// <summary>
    /// El estilo extendido que saca una ventana de Alt+Tab, sin tocar nada más de lo que traía.
    /// </summary>
    /// <remarks>
    /// LAS DOS COSAS: poner TOOLWINDOW y quitar APPWINDOW. Con APPWINDOW puesto, Windows la lista
    /// aunque sea de herramienta. Lo demás se respeta bit a bit: la carita fantasma (promesa 505)
    /// vive de <c>WS_EX_TRANSPARENT</c> sobre este mismo estilo.
    /// </remarks>
    public static int Estilo(int exstyle) => (exstyle | WS_EX_TOOLWINDOW) & ~WS_EX_APPWINDOW;

    private static bool _puesto;

    /// <summary>
    /// Lo instala para todo el proceso. Idempotente, y se llama al arrancar, antes de que exista
    /// la primera ventana, para que ninguna se cargue sin pasar por aquí.
    /// </summary>
    public static void Aplicar()
    {
        if (_puesto) return;
        _puesto = true;
        EventManager.RegisterClassHandler(typeof(Window), FrameworkElement.LoadedEvent,
            new RoutedEventHandler((s, _) => { if (s is Window v && EsFlotante(v.GetType())) Sacar(v); }),
            handledEventsToo: true);
    }

    /// <summary>Le pone el estilo a la ventana viva y dice lo que quedó, releyéndolo de ella.</summary>
    private static void Sacar(Window ventana)
    {
        IntPtr h = new WindowInteropHelper(ventana).Handle;
        if (h == IntPtr.Zero)
        {
            LogBus.Log("alt-tab", $"«{ventana.GetType().Name}» se cargó sin ventana de Windows detrás: no se pudo sacar de Alt+Tab");
            return;
        }
        int antes = GetWindowLong(h, GWL_EXSTYLE);
        int quiere = Estilo(antes);
        if (quiere != antes) SetWindowLong(h, GWL_EXSTYLE, quiere);
        int quedo = GetWindowLong(h, GWL_EXSTYLE);
        if (quedo != Estilo(quedo))
            LogBus.Log("alt-tab", $"«{ventana.GetType().Name}» SIGUE en Alt+Tab: se pidió 0x{quiere:X} y quedó 0x{quedo:X}");
        else if (quiere != antes)
            LogBus.Log("alt-tab", $"«{ventana.GetType().Name}» fuera de Alt+Tab · exstyle 0x{antes:X} → 0x{quedo:X}");
    }
}
