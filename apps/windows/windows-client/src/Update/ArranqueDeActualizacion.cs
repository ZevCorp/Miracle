using System.Diagnostics;
using System.IO;
using U.WindowsClient.Diagnostics;
using Velopack;

namespace U.WindowsClient.Update;

/// <summary>
/// Lo que la actualización hace al arrancar: juzgar el intento anterior y aplicar la que quedó descargada.
///
/// POR QUÉ NO SE LE DEJA A VELOPACK (spec 072, 2026-09-30). <c>VelopackApp.Run()</c> ya aplica sola una
/// versión descargada, pero lo hace ANTES de que exista <see cref="Ui.GuardiaDeInstancia"/> y mata todo
/// proceso de la instalación: abrir Ü por segunda vez —el icono de la consulta, con la carita ya
/// trabajando— mataba a la primera para actualizarla (banco, escenario S6: «Killing process»). Y si el
/// intento fallaba, no quedaba dicho en ningún sitio nuestro. Haciéndolo aquí se decide con quién más
/// hay vivo y queda rastro.
/// </summary>
public static class ArranqueDeActualizacion
{
    /// <summary>Un intento se da por «recién fallado» si nos relanzó él: Update.exe tarda unos doce segundos en rendirse.</summary>
    private static readonly TimeSpan Reciente = TimeSpan.FromMinutes(2);

    /// <summary>Cómo salió el último intento. Lo lee <see cref="Updater.Start"/> para decirlo cuando el log ya viaja al panel.</summary>
    public static VeredictoDelIntento UltimoVeredicto { get; private set; } = VeredictoDelIntento.Ninguno;

    /// <summary>La versión que Velopack tiene instalada, o null si esta copia no viene de un instalador.</summary>
    public static string? VersionInstalada { get; private set; }

    /// <summary>La identidad de un ejecutable, en un solo sitio: ruta completa, sin barra final y en mayúsculas.</summary>
    public static string Identidad(string ruta) =>
        Path.GetFullPath(ruta).TrimEnd(Path.DirectorySeparatorChar).ToUpperInvariant();

    /// <summary>¿Hay otro proceso vivo de este mismo ejecutable? Una Ü de otra carpeta no cuenta.</summary>
    public static bool HayOtraViva(string miEjecutable, int miPid, IEnumerable<(int Pid, string? Ruta)> procesos)
    {
        string yo = Identidad(miEjecutable);
        foreach (var (pid, ruta) in procesos)
        {
            if (pid == miPid || string.IsNullOrWhiteSpace(ruta)) continue;
            if (Identidad(ruta) == yo) return true;
        }
        return false;
    }

    public static bool AplicaAlArrancar(bool hayPendiente, bool acabaDeFallar, bool hayOtraViva) =>
        hayPendiente && !acabaDeFallar && !hayOtraViva;

    /// <summary>
    /// Se llama en <c>Main</c>, después de <c>VelopackApp.Run()</c> y antes de la guardia de instancia.
    /// Si aplica, no retorna: Velopack cierra este proceso y lo relanza.
    /// </summary>
    /// <param name="carpetaDelRastro">Dónde se anota cada intento: con los datos de la persona.</param>
    /// <param name="logsDeVelopack">Dónde escribe <c>Update.exe</c> su log: <c>%LOCALAPPDATA%\velopack</c>, que no es nuestro.</param>
    public static void Correr(string carpetaDelRastro, string logsDeVelopack, string[] args)
    {
        try
        {
            // El feed no importa: de este gestor solo se usa lo que hay en el disco.
            var gestor = new UpdateManager(Updater.RepoDeHoy);
            if (!gestor.IsInstalled || gestor.CurrentVersion == null) return;

            RastroDeActualizacion.RutaDelLog = Path.Combine(logsDeVelopack, $"velopack_{gestor.AppId}.log");
            string actual = gestor.CurrentVersion.ToString();
            VersionInstalada = actual;
            UltimoVeredicto = RastroDeActualizacion.JuzgarElArranque(carpetaDelRastro, actual);
            // Al archivo ya, por si el proceso no llega a levantar la ventana; al panel lo manda Updater.Start.
            if (UltimoVeredicto.Que != ResultadoDelIntento.SinIntento) LogBus.Log("update", Frase(UltimoVeredicto));

            VelopackAsset? pendiente = gestor.UpdatePendingRestart;
            if (pendiente == null) return;

            bool acabaDeFallar = UltimoVeredicto.Que == ResultadoDelIntento.NoAplicada
                                 && DateTimeOffset.Now - UltimoVeredicto.Cuando < Reciente;
            bool otra = HayOtraViva();
            if (!AplicaAlArrancar(true, acabaDeFallar, otra))
            {
                LogBus.Log("update", $"la {pendiente.Version} está descargada y no se aplica en este arranque: "
                    + (otra ? "hay otra Ü de esta instalación trabajando y aplicar la cerraría"
                            : "el intento de hace un momento acaba de fallar"));
                return;
            }

            LogBus.Log("update", $"al arrancar: la {pendiente.Version} está descargada y no hay otra Ü trabajando; se aplica");
            RastroDeActualizacion.Anotar(carpetaDelRastro, actual, pendiente.Version.ToString(), "al arrancar");
            gestor.ApplyUpdatesAndRestart(pendiente, args);
        }
        catch (Exception e)
        {
            // Nunca tumba el arranque: en el peor caso Ü abre en la versión que tiene.
            for (Exception? x = e; x != null; x = x.InnerException)
                LogBus.Log("update", $"el arranque de la actualización falló — {x.GetType().Name}: {x.Message}");
        }
    }

    /// <summary>La línea que cuenta cómo salió el intento. Es la que faltaba en el log cuando volvía la versión vieja.</summary>
    public static string Frase(VeredictoDelIntento v) => v.Que switch
    {
        ResultadoDelIntento.Aplicada => $"actualización aplicada: {v.Desde} → {v.Hacia} ({v.Via})",
        ResultadoDelIntento.NoAplicada => $"la actualización NO se aplicó: sigo en {v.Desde}, quería {v.Hacia} ({v.Via}). {v.Causa}",
        _ => "",
    };

    private static bool HayOtraViva()
    {
        string yo = Environment.ProcessPath ?? "";
        if (yo == "") return false;
        var vivos = new List<(int, string?)>();
        foreach (var proceso in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(yo)))
        {
            using (proceso)
            {
                string? ruta = null;
                // Un proceso de otro usuario o elevado no deja leer su ruta: no se sabe que sea de aquí, y no cuenta.
                try { ruta = proceso.MainModule?.FileName; } catch (Exception) { }
                vivos.Add((proceso.Id, ruta));
            }
        }
        return HayOtraViva(yo, Environment.ProcessId, vivos);
    }
}
