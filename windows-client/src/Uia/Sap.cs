namespace U.WindowsClient.Uia;

/// <summary>
/// ¿ES SAP? UNA sola regla (spec 054, promesa 498): el proceso de la ventana empieza por «sap» (saplogon, SAPGUI…).
/// </summary>
/// <remarks>
/// Eran tres criterios en tres sitios: pulsar miraba el proceso, mirar miraba el proceso O el título, y esperar tras
/// escribir solo el proceso. Por el título, una pestaña del navegador llamada «SAP Fiori…» —que UIA sí lee— se trataba
/// como SAP GUI. Dentro de SAP GUI, UIA solo ve un panel opaco: lo que es SAP va por la mano de SAP, por su Scripting API.
/// </remarks>
public static class Sap
{
    public static bool EsProceso(string proceso) =>
        (proceso ?? "").Trim().StartsWith("sap", StringComparison.OrdinalIgnoreCase);

    public static bool EsVentana(IntPtr ventana) => ventana != IntPtr.Zero && EsProceso(AppAligner.ProcesoDe(ventana));
}
