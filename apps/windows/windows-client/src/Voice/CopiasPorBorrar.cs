using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using U.WindowsClient.Diagnostics;

namespace U.WindowsClient.Voice;

/// <summary>
/// LAS COPIAS DE FOTOS QUE HAY EN OPENAI Y TODAVÍA NO SE HAN BORRADO, apuntadas en disco (spec 079, promesa 785).
/// </summary>
/// <remarks>
/// <para>«QUE NO DUREN MUCHO TIEMPO EN OPENAI» (el dueño, 2026-09-16). La copia de una foto se borra al cerrar la
/// conversación que puede leerla (promesa 250), pero la lista de lo subido vivía solo en memoria y el borrado
/// se intentaba una vez: 7 se quedaron allí en trece días por un fallo de red, y cerrar la app con la sesión
/// abierta las dejaba para siempre.</para>
/// <para>SE APUNTA AL SUBIR, NO AL FALLAR. Apuntar solo lo que falló no cubre el caso que más pesa: la app que
/// se cae —o que alguien cierra— con fotos subidas y sin haber llegado a intentar borrarlas.</para>
/// <para>NO SE LE BORRA LA FOTO A UNA SESIÓN VIVA. Borrar una copia cuya referencia sigue en una conversación
/// abierta la deja contestando «Files were not found» a cada respuesta (medido el 2026-09-16, promesa 254). Por
/// eso cada apunte lleva qué proceso la subió: lo de OTRA Ü que sigue abierta no se toca, y lo de este proceso
/// lo decide quien sabe qué sesiones tiene vivas (<see cref="MiradaSubida"/>).</para>
/// </remarks>
public sealed class CopiasPorBorrar
{
    private static readonly object Candado = new();
    private readonly string _archivo;

    public CopiasPorBorrar(string? archivo = null) => _archivo = archivo ?? ArchivoPorDefecto;

    public static string ArchivoPorDefecto => Path.Combine(global::U.Graph.UserPaths.Local, "U", "copias-por-borrar.json");

    private sealed class Apunte
    {
        [JsonPropertyName("id")] public string Id { get; set; } = "";
        /// <summary>El proceso que la subió. Si sigue vivo y no es este, su sesión puede estar leyéndola.</summary>
        [JsonPropertyName("pid")] public int Pid { get; set; }
    }

    /// <summary>Esta copia existe en OpenAI desde ahora.</summary>
    public void Apuntar(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) return;
        lock (Candado)
        {
            var apuntes = Leer();
            if (apuntes.Any(a => a.Id == id)) return;
            apuntes.Add(new Apunte { Id = id, Pid = Environment.ProcessId });
            Escribir(apuntes);
        }
    }

    /// <summary>Esta copia ya no existe allí.</summary>
    public void Quitar(string id)
    {
        lock (Candado)
        {
            var apuntes = Leer();
            if (apuntes.RemoveAll(a => a.Id == id) > 0) Escribir(apuntes);
        }
    }

    public IReadOnlyList<string> Pendientes()
    {
        lock (Candado) return Leer().Select(a => a.Id).ToList();
    }

    /// <summary>
    /// Vuelve a intentar borrar lo pendiente. <paramref name="borrar"/> contesta si esa copia ya no está —porque
    /// la borró o porque ya no existía—. Devuelve cuántas se quitaron; las que no, se quedan para la próxima.
    /// </summary>
    public async Task<int> ReintentarAsync(Func<string, Task<bool>> borrar)
    {
        List<Apunte> apuntes;
        lock (Candado) apuntes = Leer();
        int quitadas = 0;
        foreach (var apunte in apuntes)
        {
            if (apunte.Pid != Environment.ProcessId && SigueVivo(apunte.Pid)) continue;   // es de otra Ü que sigue abierta
            bool yaNoEsta;
            try { yaNoEsta = await borrar(apunte.Id); }
            catch (Exception e) { LogBus.Log("voz-viva", $"no pude reintentar el borrado de la copia {apunte.Id}: {e.GetType().Name}: {e.Message}"); continue; }
            if (!yaNoEsta) continue;
            Quitar(apunte.Id);
            quitadas++;
        }
        return quitadas;
    }

    private static bool SigueVivo(int pid)
    {
        if (pid <= 0) return false;
        try { using var p = System.Diagnostics.Process.GetProcessById(pid); return !p.HasExited; }
        catch (ArgumentException) { return false; }           // no hay tal proceso
        catch (InvalidOperationException) { return false; }
    }

    private List<Apunte> Leer()
    {
        if (!File.Exists(_archivo)) return new List<Apunte>();
        try { return JsonSerializer.Deserialize<List<Apunte>>(File.ReadAllText(_archivo))?.Where(a => !string.IsNullOrWhiteSpace(a.Id)).ToList() ?? new List<Apunte>(); }
        catch (Exception e) when (e is JsonException or IOException)
        {
            // Un apunte ilegible no puede tumbar la voz. Se dice, porque lo que había apuntado ya no se reintentará.
            LogBus.Log("voz-viva", $"no pude leer las copias pendientes de borrar ({_archivo}): {e.Message}");
            return new List<Apunte>();
        }
    }

    private void Escribir(List<Apunte> apuntes)
    {
        string? carpeta = Path.GetDirectoryName(_archivo);
        if (!string.IsNullOrWhiteSpace(carpeta)) Directory.CreateDirectory(carpeta);
        string temporal = _archivo + "." + Guid.NewGuid().ToString("N") + ".tmp";
        File.WriteAllText(temporal, JsonSerializer.Serialize(apuntes));
        File.Move(temporal, _archivo, overwrite: true);
    }
}
