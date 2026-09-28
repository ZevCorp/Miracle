namespace U.WindowsClient.Piloto;

/// <summary>
/// EL RECORRIDO DE UN PLAN DE COMPROBACIÓN (promesa 501): da los pasos en orden, para en el primero que no se da o en
/// cuanto se pide parar, y los que faltan cuentan como no dados sobre el total del plan.
/// </summary>
/// <remarks>
/// HASTA EL 2026-09-28 EL BUCLE VIVÍA DENTRO DE FaceWindow Y NO MIRABA EL FRENO: con la comprobación cancelada, el plan
/// seguía pulsando hasta el final, porque corre en el hilo del servidor MCP y el botón de parar solo cancelaba al
/// piloto. Aquí es puro, para que el contrato lo juzgue sin pantalla.
/// </remarks>
public static class ElRecorridoDelPlan
{
    /// <summary>
    /// Dados de Total. ParoEn es el paso (1..Total) donde paró, o 0 si los dio todos; Motivo, por qué paró.
    /// </summary>
    public sealed record Resultado(int Dados, int Total, int ParoEn, string Motivo)
    {
        /// <summary>Los que no se dieron, sobre el plan entero (patrón nº10): el denominador es el plan, no lo ejecutado.</summary>
        public int Omitidos => Total - Dados;
    }

    /// <param name="total">Cuántos pasos tiene el plan.</param>
    /// <param name="darUnPaso">Da el paso i (0..total-1). Vacío si se dio; si no, por qué no.</param>
    /// <param name="parar">Antes de cada paso: por qué no se da —se canceló, se acabó el tiempo— o vacío para seguir.</param>
    public static Resultado Recorrer(int total, Func<int, string> darUnPaso, Func<int, string> parar)
    {
        for (int i = 0; i < total; i++)
        {
            string alto = parar(i) ?? "";
            if (alto.Length > 0) return new Resultado(i, total, i + 1, alto);
            string fallo = darUnPaso(i) ?? "";
            if (fallo.Length > 0) return new Resultado(i, total, i + 1, fallo);
        }
        return new Resultado(total, total, 0, "");
    }
}
