// LO ÚNICO DE MENTIRA EN LA SONDA: los dos nombres que los archivos de la app piden y que allí viven en
// ensamblados de WPF. Aquí el log sale por la consola si se pide, y las carpetas son una temporal.

namespace U.WindowsClient.Diagnostics
{
    public static class LogBus
    {
        public static bool Verboso { get; set; }
        public static void Log(string canal, string texto)
        {
            if (Verboso) Console.WriteLine($"      [{canal}] {texto}");
        }
    }
}

namespace U.Graph
{
    public static class UserPaths
    {
        private static readonly string Raiz = Path.Combine(Path.GetTempPath(), "sonda-del-repaso");
        public static string Roaming => Path.Combine(Raiz, "roaming");
        public static string Local => Path.Combine(Raiz, "local");
    }
}
