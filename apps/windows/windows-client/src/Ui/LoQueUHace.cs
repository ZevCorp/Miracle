using System;
using U.WindowsClient.Diagnostics;

namespace U.WindowsClient.Ui;

/// <summary>
/// LO QUE Ü ACABA DE HACER, para quien quiera gesticularlo (spec 085, promesas 697 y 698).
/// </summary>
/// <remarks>
/// El pulso ya avisaba (<c>UiaSurface.Pulso</c>, promesa 504); desplazar y escribir no avisaban a nadie.
/// Como el del pulso, estos avisos salen DESPUÉS de la acción y no se les espera: la carita cuenta lo
/// que pasó, y ni la rueda ni el teclado dependen de ella. Y como el del pulso, si quien escucha revienta
/// se devuelve POR QUÉ en vez de tragárselo (patrón nº3).
/// </remarks>
public static class LoQueUHace
{
    /// <summary>Ü desplazó la ventana de delante: muescas de rueda, positivas hacia arriba y negativas hacia abajo.</summary>
    public static event Action<int>? Desplaza;

    /// <summary>Ü escribió, o está escribiendo, tantos caracteres en el campo que tiene el foco.</summary>
    public static event Action<int>? Escribe;

    /// <summary>Ü empezó a hacer algo sobre la pantalla: el nombre de la herramienta.</summary>
    public static event Action<string>? Empieza;

    /// <summary>Lo terminó, saliera como saliera.</summary>
    public static event Action<string>? Termina;

    /// <summary>
    /// ¿Esta herramienta HACE algo sobre la pantalla? Los actos de siempre (<see cref="U.WindowsClient.Mcp.ComoSeContesta.EsActo"/>:
    /// pulsar, escribir, ir, abrir, desplazar, desbloquear, decidir) y las que cumplen varios de una vez. Mirar,
    /// preguntar dónde está o recordar no es trabajar.
    /// </summary>
    public static bool EsUnActo(string herramienta) =>
        U.WindowsClient.Mcp.ComoSeContesta.EsActo(herramienta)
        || herramienta is "map_hacer" or "map_tramo" or "map_batch" or "map_skill_run";

    /// <summary>
    /// MIENTRAS DURA UN ACTO: avisa de que empieza ahora y de que termina al soltarlo, aunque reviente por el camino.
    /// Con <c>using</c>, para que no pueda quedarse «trabajando» para siempre una herramienta que lanzó.
    /// </summary>
    public static IDisposable Mientras(string herramienta) => EsUnActo(herramienta) ? new Acto(herramienta) : Nada.Unico;

    private sealed class Acto : IDisposable
    {
        private readonly string _herramienta;
        private bool _terminado;
        public Acto(string herramienta) { _herramienta = herramienta; Avisar(Empieza, herramienta, "empieza"); }
        public void Dispose() { if (_terminado) return; _terminado = true; Avisar(Termina, _herramienta, "termina"); }
    }

    private sealed class Nada : IDisposable
    {
        public static readonly Nada Unico = new();
        public void Dispose() { }
    }

    private static void Avisar(Action<string>? aQuien, string herramienta, string que)
    {
        try { aQuien?.Invoke(herramienta); }
        catch (Exception e) { LogBus.Log("ui-anim", $"el aviso de que {herramienta} {que} reventó: {e.GetType().Name}: {e.Message}"); }
    }

    /// <returns>null si se avisó (o no había a quién); si quien escucha revienta, por qué.</returns>
    public static string? AvisarDeQueDesplaza(int muescas)
    {
        try { if (muescas != 0) Desplaza?.Invoke(muescas); return null; }
        catch (Exception e) { return $"{e.GetType().Name}: {e.Message}"; }
    }

    /// <returns>null si se avisó (o no había a quién); si quien escucha revienta, por qué.</returns>
    public static string? AvisarDeQueEscribe(int caracteres)
    {
        try { if (caracteres > 0) Escribe?.Invoke(caracteres); return null; }
        catch (Exception e) { return $"{e.GetType().Name}: {e.Message}"; }
    }
}
