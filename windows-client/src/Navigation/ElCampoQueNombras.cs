namespace U.WindowsClient.Navigation;

/// <summary>
/// A QUÉ ELEMENTO SE REFIERE UN NOMBRE, preguntándole al TERRENO y no a Windows. Promesa 117
/// (spec 008).
/// </summary>
/// <remarks>
/// EXISTE PORQUE ENSEÑAR NO FUNCIONABA DENTRO DE SAP. «Esto es X» resuelve el elemento de dos
/// maneras: por el cursor (se señala) o por su nombre (<c>sobre</c>). La segunda pasaba siempre por
/// el lector de UIA (hoy <c>SurfaceMapTools.LoQueSePuedeNombrar</c>), y dentro de una sesión de SAP UIA ve
/// un Pane opaco: ni un campo, ni una etiqueta. Es la misma frontera que obligó a que el terreno
/// tuviera dos mundos (<see cref="SentidoPorMundo"/>) — solo que la enseñanza se quedó de un lado.
///
/// El terreno SÍ los ve: los campos del dynpro entran como puertas con su identidad
/// (<c>sap:wnd[0]/usr/...</c>) desde la tanda de T1. Así que cuando Windows no encuentra lo que se
/// nombra, se le pregunta al grafo por lo que hay VIVO aquí.
///
/// NO SE ADIVINA UN EMPATE, igual que al abrir (promesa 40) y al recorrer (promesa 64): dos campos
/// que se llaman igual devuelven null y quien llama pide que se señale. Colgar una enseñanza del
/// elemento equivocado es peor que no guardarla — quien enseña se queda tranquilo y el dato acabará
/// en otro sitio.
/// </remarks>
public static class ElCampoQueNombras
{
    public static (string Selector, string Etiqueta, string Tipo)? Resolver(
        string nombre, IReadOnlyList<(string Selector, string Etiqueta, string Tipo)> puertas)
    {
        string busco = Nombres.Aplanar(nombre ?? "");
        if (busco.Length == 0 || puertas == null || puertas.Count == 0) return null;

        // Lo exacto manda sobre lo parecido, que es la misma escalera del batch: sin ella, un
        // fragmento corto se traga a la puerta que de verdad se llama así (promesa 63).
        var exactas = puertas.Where(p => Nombres.Aplanar(p.Etiqueta) == busco).ToList();
        if (exactas.Count == 1) return exactas[0];
        if (exactas.Count > 1) return null;

        var parecidas = puertas
            .Where(p => Nombres.Aplanar(p.Etiqueta).Contains(busco, StringComparison.Ordinal))
            .ToList();
        return parecidas.Count == 1 ? parecidas[0] : null;
    }

    /// <summary>
    /// Los que empatan por ese nombre, para DECIRLOS (promesa 503): los exactos si hay varios, o los que lo contienen si
    /// no hay exacto y son varios. Vacío si hay uno solo o ninguno: entonces decide <see cref="Resolver"/>.
    /// </summary>
    /// <remarks>
    /// DESDE EL 2026-09-28 ESTA REGLA DECIDE TAMBIÉN EN UIA. Allí era «el primero que lo contenga», y «Search» se colgó
    /// de «Search by voice» en la sesión de voz real. Una regla para los dos mundos, no dos.
    /// </remarks>
    public static IReadOnlyList<string> Empatados(
        string nombre, IReadOnlyList<(string Selector, string Etiqueta, string Tipo)> puertas)
    {
        string busco = Nombres.Aplanar(nombre ?? "");
        if (busco.Length == 0 || puertas == null || puertas.Count == 0) return Array.Empty<string>();
        var exactas = puertas.Where(p => Nombres.Aplanar(p.Etiqueta) == busco).ToList();
        if (exactas.Count == 1) return Array.Empty<string>();
        var empate = exactas.Count > 1 ? exactas
            : puertas.Where(p => Nombres.Aplanar(p.Etiqueta).Contains(busco, StringComparison.Ordinal)).ToList();
        return empate.Count > 1
            ? empate.Select(p => p.Tipo.Length > 0 ? $"{p.Etiqueta} ({p.Tipo})" : p.Etiqueta).ToList()
            : Array.Empty<string>();
    }
}
