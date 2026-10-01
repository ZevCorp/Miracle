using System.IO;
using U.WindowsClient.Diagnostics;

namespace U.WindowsClient.Update;

/// <summary>
/// Saca la carpeta de trabajo del proceso de su carpeta de instalación.
///
/// POR QUÉ EXISTE (spec 072, 2026-09-30). El acceso directo que crea el instalador arranca a Ü con la
/// carpeta de trabajo en <c>…\U\current</c>, y todo lo que Ü abre sin decir carpeta —el navegador, una
/// app del menú Inicio, el explorador: 8 sitios con <c>UseShellExecute</c>— la hereda. Windows no deja
/// renombrar una carpeta que es la de trabajo de un proceso vivo, y Velopack actualiza justo así:
/// renombrando <c>current</c>. Con el navegador que abrió Ü todavía abierto, <c>Update.exe</c>
/// reintentaba diez segundos, se rendía y relanzaba la versión VIEJA, sin una línea en nuestro log.
///
/// Medido en el banco con Velopack de verdad: fallaban los tres caminos —la pastilla, aplicar al
/// cerrar y aplicar al arrancar—, y en los equipos reales se veía como la misma versión descargada
/// dos y tres veces (<c>cquintero</c>, <c>paula.barbosa</c>).
///
/// SE ARREGLA EN EL PROCESO Y NO EN CADA LANZAMIENTO. Poner <c>WorkingDirectory</c> en los ocho sitios
/// deja la clase de error intacta: el noveno volvería a sujetar la carpeta y nadie se enteraría.
/// </summary>
public static class CarpetaDeTrabajo
{
    /// <summary>
    /// Si la carpeta de trabajo está dentro de <paramref name="instalacion"/>, la pasa a la primera
    /// candidata que existe y queda fuera. Devuelve en cuál quedó.
    /// </summary>
    public static string Soltar(string instalacion, params string[] candidatas)
    {
        string actual;
        try { actual = Environment.CurrentDirectory; }
        catch (Exception e)
        {
            // Pasa si la carpeta de trabajo ya no existe. No es para parar el arranque: se elige otra.
            LogBus.Log("update", $"no pude leer la carpeta de trabajo ({e.GetType().Name}: {e.Message}): elijo otra");
            actual = "";
        }
        if (actual != "" && !EstaDentro(actual, instalacion)) return actual;

        foreach (string candidata in candidatas.Length > 0 ? candidatas : PorDefecto())
        {
            if (string.IsNullOrWhiteSpace(candidata) || !Directory.Exists(candidata) || EstaDentro(candidata, instalacion)) continue;
            try
            {
                Environment.CurrentDirectory = candidata;
                LogBus.Log("update", $"carpeta de trabajo: de «{actual}» a «{candidata}», para no sujetarle la instalación a Update.exe");
                return candidata;
            }
            catch (Exception e)
            {
                LogBus.Log("update", $"no pude pasar la carpeta de trabajo a «{candidata}»: {e.GetType().Name}: {e.Message}");
            }
        }

        LogBus.Log("update", $"la carpeta de trabajo sigue en «{actual}», dentro de la instalación: ninguna candidata existe fuera. "
                             + "Lo que Ü abra desde aquí impedirá actualizar mientras siga abierto.");
        return actual;
    }

    /// <summary>
    /// ¿Es <paramref name="carpeta"/> la carpeta <paramref name="de"/> o cuelga de ella? Se compara por
    /// tramos y sin mirar mayúsculas: «current-vieja» empieza igual que «current» y no está dentro.
    /// </summary>
    public static bool EstaDentro(string carpeta, string de)
    {
        if (string.IsNullOrWhiteSpace(carpeta) || string.IsNullOrWhiteSpace(de)) return false;
        string a = Normal(carpeta), b = Normal(de);
        return a.Equals(b, StringComparison.OrdinalIgnoreCase)
            || a.StartsWith(b + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
    }

    private static string Normal(string ruta) =>
        Path.GetFullPath(ruta).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);

    // El perfil es donde nace un programa abierto desde el menú Inicio; las otras dos existen siempre.
    private static string[] PorDefecto() => new[]
    {
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
        Environment.SystemDirectory,
        Path.GetTempPath(),
    };
}
