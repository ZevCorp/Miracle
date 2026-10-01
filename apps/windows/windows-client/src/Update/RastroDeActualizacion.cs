using System.IO;
using System.Text;
using System.Text.Json;
using U.WindowsClient.Diagnostics;

namespace U.WindowsClient.Update;

public enum ResultadoDelIntento { SinIntento, Aplicada, NoAplicada }

/// <summary>Cómo salió el último intento de aplicar una actualización, juzgado en el arranque siguiente.</summary>
public sealed record VeredictoDelIntento(
    ResultadoDelIntento Que, string Desde, string Hacia, string Via, string Causa, DateTimeOffset Cuando)
{
    public static readonly VeredictoDelIntento Ninguno =
        new(ResultadoDelIntento.SinIntento, "", "", "", "", DateTimeOffset.MinValue);
}

/// <summary>
/// El rastro que deja un intento de aplicar, para que el arranque siguiente pueda decir cómo salió.
///
/// POR QUÉ EXISTE (spec 072, 2026-09-30). Aplicar una actualización mata el proceso: su última línea era
/// «aplicando actualización y reiniciando», y si <c>Update.exe</c> fallaba, la versión vieja volvía a
/// arrancar sin saber que venía de un intento. El fallo solo quedaba en
/// <c>%LOCALAPPDATA%\velopack\velopack_U.log</c>, que no viaja al panel: desde fuera se veía la misma
/// versión descargada tres veces y ningún error. Un paso que no se ejecutó tiene que dejar rastro
/// (aprendizaje nº10), y éste no lo dejaba.
/// </summary>
public static class RastroDeActualizacion
{
    private const string Archivo = "actualizacion-en-curso.json";

    /// <summary>El log de Update.exe de esta app. Lo fija el arranque, que es quien sabe el id del paquete.</summary>
    public static string RutaDelLog { get; set; } = "";

    private sealed class Intento
    {
        public string Desde { get; set; } = "";
        public string Hacia { get; set; } = "";
        public string Via { get; set; } = "";
        public DateTimeOffset Cuando { get; set; }
        /// <summary>Cuánto medía el log de Velopack al empezar: lo de antes es de intentos anteriores.</summary>
        public long LogDesde { get; set; }
    }

    /// <summary>Se llama ANTES de pedirle a Velopack que aplique. No lanza: sin rastro se pierde el veredicto, no la actualización.</summary>
    public static void Anotar(string carpeta, string desde, string hacia, string via)
    {
        try
        {
            Directory.CreateDirectory(carpeta);
            var intento = new Intento { Desde = desde, Hacia = hacia, Via = via, Cuando = DateTimeOffset.Now, LogDesde = TamañoDelLog() };
            File.WriteAllText(Path.Combine(carpeta, Archivo), JsonSerializer.Serialize(intento));
        }
        catch (Exception e)
        {
            LogBus.Log("update", $"no pude anotar el intento de actualizar a {hacia}: {e.GetType().Name}: {e.Message}");
        }
    }

    /// <summary>
    /// El veredicto del intento anotado, con la versión que arrancó y lo que Update.exe escribió. Consume
    /// el rastro: el mismo intento no se juzga dos veces.
    /// </summary>
    public static VeredictoDelIntento Juzgar(string carpeta, string versionActual, string? logDeVelopack)
    {
        Intento? intento = Leer(carpeta);
        if (intento == null) return VeredictoDelIntento.Ninguno;
        Borrar(carpeta);

        bool sigueEnLaDeAntes = string.Equals(intento.Desde.Trim(), (versionActual ?? "").Trim(), StringComparison.OrdinalIgnoreCase);
        return sigueEnLaDeAntes
            ? new VeredictoDelIntento(ResultadoDelIntento.NoAplicada, intento.Desde, intento.Hacia, intento.Via, CausaEnElLog(logDeVelopack), intento.Cuando)
            : new VeredictoDelIntento(ResultadoDelIntento.Aplicada, intento.Desde, intento.Hacia, intento.Via, "", intento.Cuando);
    }

    /// <summary>Lo mismo, leyendo del disco lo que Update.exe escribió desde que empezó el intento.</summary>
    public static VeredictoDelIntento JuzgarElArranque(string carpeta, string versionActual)
    {
        Intento? intento = Leer(carpeta);
        return intento == null ? VeredictoDelIntento.Ninguno : Juzgar(carpeta, versionActual, LogDesde(intento.LogDesde));
    }

    /// <summary>
    /// Por qué no se aplicó, según el log de Update.exe. Cuatro situaciones y cuatro frases: un mensaje
    /// que no distingue sus causas manda la investigación al sitio equivocado (aprendizaje nº2).
    /// </summary>
    public static string CausaEnElLog(string? log)
    {
        if (string.IsNullOrWhiteSpace(log))
            return "no hay log de Velopack que leer" + (RutaDelLog == "" ? "" : $" en {RutaDelLog}");

        string[] lineas = log.Split('\n');
        // SOLO EL ÚLTIMO INTENTO: el log no se borra nunca, y colgarle a hoy el error de ayer es una causa que miente.
        int inicio = Array.FindLastIndex(lineas, l => l.Contains("Command: Apply"));
        if (inicio < 0)
            return "Update.exe no dejó ningún intento en su log: no llegó a arrancar, o lo cerraron antes de empezar";

        var intento = lineas.Skip(inicio).ToList();
        int reintentos = intento.Count(l => l.Contains("Retrying operation"));
        string? error = intento.FirstOrDefault(l => l.Contains("[ERROR]"));
        string tras = reintentos > 0 ? $" tras {reintentos} reintentos" : "";
        if (error == null)
            return $"Update.exe empezó a aplicar y su log se corta sin línea de error{tras}";

        int corte = error.IndexOf("[ERROR]", StringComparison.Ordinal);
        return $"Update.exe{tras}: «{error[(corte + "[ERROR]".Length)..].Trim()}»";
    }

    private static Intento? Leer(string carpeta)
    {
        string ruta = Path.Combine(carpeta, Archivo);
        if (!File.Exists(ruta)) return null;
        try
        {
            var intento = JsonSerializer.Deserialize<Intento>(File.ReadAllText(ruta));
            if (intento != null && !string.IsNullOrWhiteSpace(intento.Desde) && !string.IsNullOrWhiteSpace(intento.Hacia)) return intento;
            LogBus.Log("update", "el rastro del intento de actualizar está incompleto: se descarta");
        }
        catch (Exception e)
        {
            LogBus.Log("update", $"el rastro del intento de actualizar no se pudo leer ({e.GetType().Name}: {e.Message}): se descarta");
        }
        Borrar(carpeta);
        return null;
    }

    private static void Borrar(string carpeta)
    {
        try { File.Delete(Path.Combine(carpeta, Archivo)); }
        catch (Exception e) { LogBus.Log("update", $"no pude borrar el rastro del intento: {e.GetType().Name}: {e.Message}"); }
    }

    private static long TamañoDelLog()
    {
        try { return RutaDelLog != "" && File.Exists(RutaDelLog) ? new FileInfo(RutaDelLog).Length : 0; }
        catch (Exception e) { LogBus.Log("update", $"no pude medir el log de Velopack: {e.GetType().Name}: {e.Message}"); return 0; }
    }

    private static string? LogDesde(long desde)
    {
        if (RutaDelLog == "" || !File.Exists(RutaDelLog)) return null;
        try
        {
            // Update.exe puede tenerlo abierto todavía: se lee compartiendo, no en exclusiva.
            using var fs = new FileStream(RutaDelLog, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            if (desde > 0 && desde <= fs.Length) fs.Seek(desde, SeekOrigin.Begin);
            using var lector = new StreamReader(fs, Encoding.UTF8);
            return lector.ReadToEnd();
        }
        catch (Exception e)
        {
            LogBus.Log("update", $"no pude leer el log de Velopack ({e.GetType().Name}: {e.Message})");
            return null;
        }
    }
}
