using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using U.WindowsClient.Diagnostics;
using U.WindowsClient.Ui;
using U.Graph.Surfaces;
using Velopack;

namespace U.WindowsClient;

public partial class App : Application
{
    internal static GuardiaDeInstancia? Guardia { get; private set; }
    /// <summary>
    /// Entry point manual (ver StartupObject en WindowsClient.csproj). Existe por Velopack: cuando el
    /// updater instala o desinstala una versión relanza este mismo .exe con argumentos de hook y espera
    /// que el proceso los atienda y termine. <c>VelopackApp.Run()</c> hace eso y NO retorna en ese caso
    /// — por eso corre antes de levantar WPF, o cada actualización abriría una carita fantasma.
    /// </summary>
    [STAThread]
    private static void Main(string[] args)
    {
        try
        {
            // EL ACCESO DIRECTO DE LA CONSULTA, CREADO POR EL INSTALADOR, y no a mano (2026-09-02,
            // encontrado instalando en una máquina real): Velopack 1.2.0 ya crea solo el acceso
            // directo GENÉRICO al instalar —sin argumentos—, así que abre la carita. Sin este hook,
            // la única forma de llegar a la ventana de consulta era un script aparte
            // (`scripts\atajo-consulta.ps1`) que nadie ejecuta en la máquina de un médico.
            //
            // Los tres momentos cubiertos, y por qué los tres: `OnAfterInstallFastCallback` para la
            // instalación en limpio (el caso de hoy); `OnAfterUpdateFastCallback` para las máquinas
            // que YA tienen una versión sin este acceso directo y sólo reciben la actualización;
            // `OnFirstRun`, sin límite de tiempo, como red de seguridad si alguno de los dos
            // «FastCallback» no llegara a dispararse. Los tres llaman al mismo método idempotente:
            // repetirlo sólo vuelve a escribir el mismo archivo.
            //
            // SIN EL AUTO-APLICAR DE VELOPACK (spec 072, 2026-09-30): lo hace `ArranqueDeActualizacion`,
            // tres líneas más abajo, que sabe si hay otra Ü trabajando y deja rastro del intento. El de
            // Velopack corre aquí dentro, antes que la guardia de instancia, y mataba a la carita que ya
            // estaba abierta cuando alguien pulsaba el icono de la consulta.
            //
            // Y EL ACCESO DIRECTO ES DE MÉDICOS (spec 080, promesa 755). Los tres ganchos lo creaban
            // sin mirar quién usa la instalación: un estudiante recién instalado se encontraba un
            // icono «Miracle Consulta» en el escritorio. Ahora preguntan el rol: una instalación que
            // ya tenía identidad lo conserva, y una nueva lo recibe cuando alguien dice que es médico.
            VelopackApp.Build()
                .SetAutoApplyOnStartup(false)
                .OnAfterInstallFastCallback(_ => AccesoDirectoSegunElRol(RolDeLaInstalacion()))
                .OnAfterUpdateFastCallback(_ => AccesoDirectoSegunElRol(RolDeLaInstalacion()))
                .OnFirstRun(_ => AccesoDirectoSegunElRol(RolDeLaInstalacion()))
                .Run();

            // LA INTRO ES UNA PIEZA PARA PRESENTAR (spec 086, promesa 883): abre su ventana negra y nada más. Va antes
            // de la actualización, que podría cambiar la carpeta debajo, y del candado de instancia, para poder abrirla
            // con otra Ü viva al lado.
            if (args.Any(a => string.Equals(a, "--intro", StringComparison.OrdinalIgnoreCase)))
            {
                new Application { ShutdownMode = ShutdownMode.OnMainWindowClose }.Run(new IntroWindow());
                return;
            }

            // Antes de lanzar nada: lo que Ü abra desde aquí hereda la carpeta de trabajo, y si es la de
            // instalación Update.exe no puede renombrarla mientras ese programa siga abierto.
            Update.CarpetaDeTrabajo.Soltar(AppContext.BaseDirectory);
            Update.ArranqueDeActualizacion.Correr(CarpetaDelRastroDeActualizacion,
                Path.Combine(U.Graph.UserPaths.LocalDeWindows, "velopack"), args);

            string identidad = GuardiaDeInstancia.IdentidadDelProceso();
            Guid escritorio = EscritorioVirtual.Actual();
            if (escritorio == Guid.Empty)
                escritorio = EscritorioVirtual.EscritorioDe(GetForegroundWindow());
            if (!GuardiaDeInstancia.IntentarIniciar(identidad, escritorio, out var guardia)) return;
            Guardia = guardia;

            var app = new App();
            app.InitializeComponent();
            app.Run();
            Guardia?.Dispose();
        }
        catch (Exception ex)
        {
            LogBus.Log("fatal", ex.ToString());
            MessageBox.Show($"Ü no pudo arrancar: {ex.Message}", "Ü", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    /// <summary>
    /// Dónde se anota cada intento de actualizar: con los demás datos de la persona, que respetan
    /// <c>U_DATA_DIR</c> y quedan fuera de la carpeta <c>current</c> que Velopack reemplaza.
    /// </summary>
    internal static string CarpetaDelRastroDeActualizacion => Path.Combine(U.Graph.UserPaths.Local, "U");

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        // LO PRIMERO, y el sitio no es negociable: apaga los textos que asomaban al pasar el ratón
        // (promesa 164). La metadata de una propiedad se sella para un tipo en cuanto se lee sobre
        // una instancia suya, así que esto tiene que correr antes de que exista la primera ventana.
        Ui.SinCarteles.Aplicar();
        // UN CLIC DE Ü NO ES UN TOQUE DE LA PERSONA (promesa 508): se instala antes de que exista la primera ventana, para
        // que ninguna —la carita, el muelle, el notch— tome por suyo un clic que mandó Ü.
        Ui.ToquesDeU.Instalar();
        // LAS PIEZAS FLOTANTES NO SALEN EN ALT+TAB (promesa 531): también antes de la primera ventana, para que la
        // carita y el muelle —que nacen enseguida— se carguen ya pasando por aquí.
        Ui.FueraDelAltTab.Aplicar();
        // Nunca dejar caer la carita por una excepción no capturada: es un overlay permanente.
        DispatcherUnhandledException += (_, ex) =>
        {
            LogBus.Log("fatal", ex.Exception.ToString());
            MessageBox.Show($"Ü tropezó: {ex.Exception.Message}", "Ü", MessageBoxButton.OK, MessageBoxImage.Warning);
            ex.Handled = true;
        };

        // Una tarea "fire-and-forget" (p.ej. `_ = algo.EmpezarAsync()`) que revienta NO pasa por
        // DispatcherUnhandledException: se pierde en silencio salvo que se observe aquí. Esto fue
        // exactamente lo que ocultó el primer error real de la enseñanza por video.
        TaskScheduler.UnobservedTaskException += (_, ex) =>
        {
            LogBus.Log("unobserved-task", ex.Exception.ToString());
            ex.SetObserved();
        };

        // EL ICONO DE LA CONSULTA (spec 004, fase 8). `U.exe --consulta` abre la ventana de la
        // consulta clínica delante; la carita arranca igual por StartupUri — mismo proceso, no se
        // le quita nada. La sesión se RESTAURA antes de pedir login: cerrar el portátil una noche
        // no puede costar la contraseña otra vez.
        if (e.Args.Any(a => string.Equals(a, "--consulta", StringComparison.OrdinalIgnoreCase)))
        {
            AbrirLaConsulta();
        }
    }

    /// <summary>
    /// El camino de <c>--consulta</c>, con la aplicación sostenida mientras dura.
    /// </summary>
    /// <remarks>
    /// EL <c>ShutdownMode</c> NO ES UN DETALLE: es lo que mató a esta app en silencio el
    /// 2026-09-01. `OnStartup` corre ANTES de que `StartupUri` cree la carita, así que mientras el
    /// login está abierto es la ÚNICA ventana del proceso. Al cerrarse —con el login YA
    /// resuelto— `ShutdownMode.OnLastWindowClose`, que es el de fábrica, dio la aplicación por
    /// terminada: `ConsultaWindow.Show()` no pintó nada, `app.Run()` retornó y U.exe se cerró.
    ///
    /// El síntoma fue perfecto en su inutilidad: ni excepción, ni ventana, ni mensaje. El log lo
    /// dijo todo con un silencio — «cuenta: médico dentro · 67530d77…» y ni una línea más.
    ///
    /// `OnExplicitShutdown` mientras dura el arranque, y se devuelve el modo anterior en cuanto hay
    /// ventana. No se deja puesto: con él, cerrar todas las ventanas dejaría el proceso vivo e
    /// invisible, que es la avería opuesta y peor.
    /// </remarks>
    /// <remarks>Internal y no private desde el 2026-09-05: el boton «Live» del panel abre esto
    /// mismo. Un segundo camino que replicara el arranque tendria su propia forma de fallar en
    /// silencio, que es justo de lo que este metodo nacio (ver arriba).</remarks>
    internal void AbrirLaConsulta()
    {
        // EL MISMO ICONO ABRE LO DE CADA UNO (spec 080). Para un estudiante, el panel graba clases: sin
        // cuenta, sin contraseña y sin backend clínico. Y quien todavía no ha dicho qué es no abre
        // ninguno de los dos: se lo pregunta la carita, que es quien llama aquí cuando ya lo sabe.
        var rol = RolDeLaInstalacion();
        if (rol == Persona.Rol.Estudiante)
        {
            try
            {
                new Ui.ConsultaWindow(new Persona.PerfilDeLaPersona().Leer(), U.Graph.GraphConfig.Load()).Show();
                LogBus.Log("arranque", "panel de clases abierto");
            }
            catch (Exception e)
            {
                for (var x = e; x != null; x = x.InnerException)
                    LogBus.Log("arranque", $"FALLÓ al abrir el panel de clases: {x.GetType().Name}: {x.Message}");
                Ui.Aviso.Fallo("abrir el panel de clases", e.Message);
            }
            return;
        }
        if (rol == Persona.Rol.SinElegir)
        {
            LogBus.Log("arranque", "se pidió el panel de grabar sin haber elegido rol: no se abre; el primer encuentro lo pregunta");
            return;
        }

        var modoPrevio = ShutdownMode;
        ShutdownMode = ShutdownMode.OnExplicitShutdown;
        try
        {
            var sesion = new U.WindowsClient.Cuenta.SesionMiracle(
                U.WindowsClient.Cuenta.Nube.SupabaseUrl, U.WindowsClient.Cuenta.Nube.ClavePublicable);

            var arranque = new U.WindowsClient.Clinical.ArranqueDeConsulta(
                restaurarSesion: sesion.Restaurar,
                pedirCredenciales: () => new Ui.LoginWindow(sesion).ShowDialog() == true,
                abrirLaVentana: () => new Ui.ConsultaWindow(sesion, U.Graph.GraphConfig.Load()).Show(),
                avisarDelFallo: Ui.Aviso.Fallo);

            arranque.Correr();
        }
        finally { ShutdownMode = modoPrevio; }
    }

    /// <summary>
    /// El rol con el que arranca esta instalación, leído del disco. Lo usan los ganchos del
    /// instalador y <c>--consulta</c>, que corren antes de que exista la carita.
    /// </summary>
    internal static Persona.Rol RolDeLaInstalacion()
    {
        try
        {
            var perfil = new Persona.PerfilDeLaPersona().Leer();
            bool previa = !string.IsNullOrWhiteSpace(Config.Load().Email);
            if (!perfil.Conocido && !previa)
                previa = new Cuenta.SesionMiracle(Cuenta.Nube.SupabaseUrl, Cuenta.Nube.ClavePublicable).Restaurar();
            return Persona.ReglaDelRol.Efectivo(perfil, previa);
        }
        catch (Exception e)
        {
            LogBus.Log("persona", $"no pude leer el rol de la instalación ({e.GetType().Name}: {e.Message}): sin elegir");
            return Persona.Rol.SinElegir;
        }
    }

    /// <summary>
    /// Esta copia la puso el instalador: Velopack deja <c>sq.version</c> junto al ejecutable. Un build
    /// suelto no lo tiene.
    /// </summary>
    internal static bool EsUnaInstalacion => File.Exists(Path.Combine(AppContext.BaseDirectory, "sq.version"));

    private static string RutaDelAccesoDirectoDeConsulta =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Miracle Consulta.lnk");

    /// <summary>
    /// Deja el acceso directo de la consulta como le toca al rol: lo crea si es de médico y no está, y
    /// lo quita si quien usa esta instalación resultó ser estudiante. Sin rol elegido no toca nada.
    /// </summary>
    internal static void AccesoDirectoSegunElRol(Persona.Rol rol)
    {
        try
        {
            // SOLO UNA COPIA INSTALADA TOCA EL ESCRITORIO. Esto se llama también al arrancar y al terminar el
            // primer encuentro, y una Ü de desarrollo —un build suelto, una de pruebas con sus datos
            // aparte— dejaría en el escritorio de quien la corre un icono apuntando a ella.
            if (!EsUnaInstalacion)
            {
                LogBus.Log("instalador", "no es una copia instalada: el acceso directo del escritorio no se toca");
                return;
            }
            string lnk = RutaDelAccesoDirectoDeConsulta;
            if (Persona.ReglaDelRol.Puede(rol, Persona.Capacidad.AccesoDirectoDeConsulta))
            {
                if (!File.Exists(lnk)) CrearAccesoDirectoDeConsulta();
            }
            else if (rol == Persona.Rol.Estudiante && File.Exists(lnk))
            {
                File.Delete(lnk);
                LogBus.Log("instalador", "acceso directo de consulta retirado: esta instalación es de un estudiante");
            }
        }
        catch (Exception e)
        {
            LogBus.Log("instalador", $"no pude dejar el acceso directo como toca: {e.GetType().Name}: {e.Message}");
        }
    }

    /// <summary>
    /// El acceso directo «Miracle Consulta.lnk» en el escritorio, apuntando a ESTE .exe con
    /// <c>--consulta</c>. Idempotente: se puede llamar tantas veces como haga falta.
    ///
    /// SE HABLA COM POR REFLEXIÓN Y NO CON <c>dynamic</c> A PROPÓSITO: evita que el proyecto tenga
    /// que referenciar <c>Microsoft.CSharp</c> por una sola llamada. Es exactamente el mismo objeto
    /// —<c>WScript.Shell</c>— que ya usa <c>scripts\atajo-consulta.ps1</c>, que sigue viviendo como
    /// la vía manual para desarrollo.
    ///
    /// SE LLAMA DESDE HOOKS «FastCallback» (30 s de margen antes de que Velopack mate el proceso),
    /// así que cualquier fallo se traga y se anota: colgar la instalación por no poder dibujar un
    /// icono sería un daño mucho mayor que el que arregla.
    /// </summary>
    private static void CrearAccesoDirectoDeConsulta()
    {
        try
        {
            string exe = Process.GetCurrentProcess().MainModule?.FileName ?? "";
            if (string.IsNullOrEmpty(exe)) { LogBus.Log("instalador", "sin ruta del .exe: no se crea el acceso directo"); return; }

            string escritorio = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            string lnk = Path.Combine(escritorio, "Miracle Consulta.lnk");

            var tipoShell = Type.GetTypeFromProgID("WScript.Shell");
            if (tipoShell == null) { LogBus.Log("instalador", "WScript.Shell no está disponible: no se crea el acceso directo"); return; }

            object shell = Activator.CreateInstance(tipoShell)!;
            object atajo = shell.GetType().InvokeMember("CreateShortcut",
                BindingFlags.InvokeMethod, null, shell, new object[] { lnk })!;
            var tipoAtajo = atajo.GetType();

            tipoAtajo.InvokeMember("TargetPath", BindingFlags.SetProperty, null, atajo, new object[] { exe });
            tipoAtajo.InvokeMember("Arguments", BindingFlags.SetProperty, null, atajo, new object[] { "--consulta" });
            tipoAtajo.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, atajo,
                new object[] { Path.GetDirectoryName(exe) ?? "" });
            tipoAtajo.InvokeMember("IconLocation", BindingFlags.SetProperty, null, atajo, new object[] { exe + ",0" });
            tipoAtajo.InvokeMember("Description", BindingFlags.SetProperty, null, atajo,
                new object[] { "Grabar una consulta médico-paciente con Miracle" });
            tipoAtajo.InvokeMember("Save", BindingFlags.InvokeMethod, null, atajo, null);

            LogBus.Log("instalador", "acceso directo de consulta creado: " + lnk);
        }
        catch (Exception e)
        {
            LogBus.Log("instalador", $"no se pudo crear el acceso directo de consulta: {e.GetType().Name}: {e.Message}");
        }
    }
}
