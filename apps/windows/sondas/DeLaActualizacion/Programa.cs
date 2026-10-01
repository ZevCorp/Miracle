using System.Diagnostics;
using U.WindowsClient.Diagnostics;
using U.WindowsClient.Update;
using Velopack;

namespace U.WindowsClient.Diagnostics
{
    /// <summary>
    /// El LogBus de la carita, reducido a lo que el módulo de actualización usa: una línea por hecho, en
    /// el registro del banco. Lleva el pid porque en un escenario intervienen cuatro procesos.
    /// </summary>
    public static class LogBus
    {
        public static readonly string Banco = Environment.GetEnvironmentVariable("U_BANCO") is { Length: > 0 } b ? b : @"C:\U-banco";
        private static readonly object Candado = new();

        public static void Log(string etiqueta, string texto)
        {
            string linea = $"[{DateTime.Now:HH:mm:ss.fff}] [pid {Environment.ProcessId}] {etiqueta}: {texto}";
            lock (Candado)
            {
                // Otro proceso del mismo escenario puede tener el archivo abierto un instante.
                for (int i = 0; i < 20; i++)
                {
                    try { File.AppendAllText(Path.Combine(Banco, "registro.log"), linea + Environment.NewLine); return; }
                    catch (IOException) { Thread.Sleep(25); }
                }
            }
        }
    }
}

namespace Sonda
{
    internal static class Programa
    {
        [STAThread]
        private static int Main(string[] args)
        {
            // IGUAL QUE App.Main, LÍNEA POR LÍNEA. Si aquello cambia y esto no, el banco aprueba otra app.
            //
            // «viejo» en el modo deja la sonda como la 1.3.6 —el auto-aplicar de Velopack, sin soltar la
            // carpeta, sin juzgar el intento—: es el sabotaje del banco, con el mismo binario. Con él tienen
            // que ponerse MAL cinco de los ocho escenarios; si no, el banco no está midiendo nada.
            var control = LeerControl();
            string feed = control.GetValueOrDefault("feed", "");
            string modo = control.GetValueOrDefault("modo", "quieto");
            bool viejo = modo.Contains("viejo");
            string datos = Path.Combine(LogBus.Banco, "datos");

            VelopackApp.Build()
                .SetAutoApplyOnStartup(viejo)
                .OnAfterInstallFastCallback(v => LogBus.Log("hook", $"instalada {v}"))
                .OnAfterUpdateFastCallback(v => LogBus.Log("hook", $"actualizada a {v}"))
                .OnBeforeUpdateFastCallback(v => LogBus.Log("hook", $"obsoleta {v}"))
                .Run();

            if (!viejo)
            {
                CarpetaDeTrabajo.Soltar(AppContext.BaseDirectory);
                ArranqueDeActualizacion.Correr(datos,
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "velopack"), args);
            }

            var updater = new Updater(feed, datos);
            LogBus.Log("arranque", $"version={updater.CurrentVersion} instalada={updater.Enabled} modo={modo} "
                                   + $"cwd={Environment.CurrentDirectory} args=[{string.Join(' ', args)}]");

            if (modo.Contains("hijo"))
            {
                // Lo que hace la carita al abrirle un programa a la persona: ShellExecute sin carpeta de
                // trabajo. El hijo hereda la del proceso, y vive mucho más que el escenario.
                var hijo = Process.Start(new ProcessStartInfo
                { FileName = "ping.exe", Arguments = "-n 900 127.0.0.1", UseShellExecute = true, WindowStyle = ProcessWindowStyle.Hidden });
                LogBus.Log("hijo", $"lanzado pid={hijo?.Id} sin carpeta de trabajo propia");
            }

            bool lista = false;
            updater.UpdateReady += info =>
            {
                lista = true;
                LogBus.Log("lista", $"UpdateReady {info.Version}");
                if (modo.Contains("pastilla"))
                {
                    Thread.Sleep(500);
                    updater.ApplyAndRestart();
                }
            };
            updater.Start();

            // Las órdenes del guion llegan por un archivo que se consume: es el dedo de la persona.
            string orden = Path.Combine(LogBus.Banco, "orden.txt");
            while (true)
            {
                Thread.Sleep(300);
                if (!File.Exists(orden)) continue;
                string que;
                try { que = File.ReadAllText(orden).Trim(); File.Delete(orden); }
                catch (IOException) { continue; }
                LogBus.Log("orden", que);
                switch (que)
                {
                    case "salir":
                        updater.ApplyOnExit();
                        LogBus.Log("salida", $"cierre ordenado (lista={lista})");
                        return 0;
                    case "aplicar":
                        updater.ApplyAndRestart();
                        break;
                    case "buscar":
                        var (resultado, detalle) = updater.BuscarAhoraAsync().GetAwaiter().GetResult();
                        LogBus.Log("buscar", $"{resultado} · {detalle}");
                        break;
                }
            }
        }

        private static Dictionary<string, string> LeerControl()
        {
            var d = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            string ruta = Path.Combine(LogBus.Banco, "control.txt");
            if (!File.Exists(ruta)) return d;
            foreach (string l in File.ReadAllLines(ruta))
            {
                int i = l.IndexOf('=');
                if (i > 0) d[l[..i].Trim()] = l[(i + 1)..].Trim();
            }
            return d;
        }
    }
}
