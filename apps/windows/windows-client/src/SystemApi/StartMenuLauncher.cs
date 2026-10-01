using System.Diagnostics;
using System.IO;
using System.Linq;

namespace U.WindowsClient.SystemApi;

/// <summary>
/// Lanza apps por su ACCESO DIRECTO del menú Inicio. Resuelve NOMBRES VISIBLES ("Google Chrome",
/// "SAP Logon") que el shell no encuentra como comando —el ejecutable real es <c>chrome.exe</c>,
/// <c>saplogon.exe</c>—: casi toda app instalada deja un <c>.lnk</c> en el menú Inicio, y lanzarlo la
/// abre. Casar por NOMBRE normalizado del acceso directo, sin COM.
///
/// Es la lógica que ya tenía el SurfaceNavigator; se extrajo aquí para que <see cref="WindowsSystemApi"/>
/// (y por ende <c>launch_app</c> del cerebro) sea igual de robusta. Un solo lugar que mantener.
/// </summary>
public static class StartMenuLauncher
{
    /// <summary>Encuentra el .lnk y lo lanza. Devuelve false si no hay acceso directo que case.</summary>
    public static bool TryLaunch(string appName)
    {
        string? lnk = FindShortcut(appName);
        if (lnk == null) return false;
        try
        {
            Process.Start(new ProcessStartInfo { FileName = lnk, UseShellExecute = true });
            return true;
        }
        catch { return false; }
    }

    /// <summary>Primer <c>.lnk</c> de los menús Inicio (usuario + máquina) cuyo nombre casa con la app.</summary>
    public static string? FindShortcut(string appName)
    {
        string target = Norm(appName);
        if (target.Length == 0) return null;

        foreach (string root in StartMenuRoots())
        {
            if (!Directory.Exists(root)) continue;
            IEnumerable<string> lnks;
            // IgnoreInaccessible: sin esto, una subcarpeta protegida del menú Inicio lanza
            // UnauthorizedAccessException a mitad del recorrido (es perezoso) y mata toda la búsqueda.
            try
            {
                lnks = Directory.EnumerateFiles(root, "*.lnk",
                    new EnumerationOptions { RecurseSubdirectories = true, IgnoreInaccessible = true });
            }
            catch { continue; }

            var porNombre = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (string f in lnks) porNombre.TryAdd(Path.GetFileNameWithoutExtension(f), f);
            if (Elegir(appName, porNombre.Keys.ToList()) is { } elegido) return porNombre[elegido];
        }
        return null;
    }

    /// <summary>Los accesos directos que son la propia Ü: abrir una app nunca la lanza a ella (promesa 521).</summary>
    private static readonly HashSet<string> LosDeU = new(StringComparer.Ordinal) { "u", "ü", "miracle", "miracleconsulta" };

    /// <summary>
    /// QUÉ ACCESO CASA CON LO PEDIDO (promesa 521): el exacto primero —que «Notepad++» no gane a «Notepad»—; después uno
    /// cuyo nombre CONTIENE lo pedido («chrome» → «Google Chrome»); y solo si su nombre tiene 4 letras o más, uno que está
    /// DENTRO de lo pedido («sap logon 760» → «SAP Logon»). Nunca los de Ü.
    /// </summary>
    /// <remarks>
    /// EL 2026-09-28 (22:54) «calculator» lanzó «U.lnk»: «calculator» contiene «u». La Ü nueva heredó el entorno de la
    /// prueba y desplazó a la del dueño. Con esa regla «outlook», «youtube» o «cursor» abrían otra Ü.
    /// </remarks>
    public static string? Elegir(string pedido, IReadOnlyList<string> nombres)
    {
        string target = Norm(pedido);
        if (target.Length == 0) return null;
        var candidatos = nombres.Where(n => Norm(n).Length > 0 && !LosDeU.Contains(Norm(n))).ToList();
        // Literal antes que normalizado: «Notepad++» y «Notepad» se normalizan igual (los símbolos se van).
        return candidatos.FirstOrDefault(n => string.Equals(n.Trim(), (pedido ?? "").Trim(), StringComparison.OrdinalIgnoreCase))
            ?? candidatos.FirstOrDefault(n => Norm(n) == target)
            ?? candidatos.FirstOrDefault(n => target.Length >= 3 && Norm(n).Contains(target))
            ?? candidatos.FirstOrDefault(n => Norm(n).Length >= 4 && target.Contains(Norm(n)));
    }

    /// <summary>Dónde vive el menú Inicio. Público porque el carrusel de apps lo recorre entero, y
    /// «dónde están los accesos directos» no puede tener dos respuestas.</summary>
    public static IEnumerable<string> StartMenuRoots()
    {
        yield return Environment.GetFolderPath(Environment.SpecialFolder.StartMenu);       // menú del usuario
        yield return Environment.GetFolderPath(Environment.SpecialFolder.CommonStartMenu);  // menú de la máquina
    }

    /// <summary>Minúsculas y solo alfanumérico: "SAP Logon" → "saplogon", "Google Chrome" → "googlechrome".</summary>
    private static string Norm(string s) =>
        new string((s ?? "").ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());
}
