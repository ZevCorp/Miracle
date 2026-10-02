using Voz.Realtime;

namespace U.WindowsClient.Mcp;

/// <summary>
/// ÓRDENES DE PRUEBA POR EL MCP (promesa 513, spec 062): `u_orden` mete un texto como si la persona lo hubiera escrito en
/// el chat —y de ahí a la voz, a Luna y a las manos, el mismo camino que su voz—, y `u_colgar` cierra la voz.
/// </summary>
/// <remarks>
/// PROBAR COMO EL DUEÑO (2026-09-28): una sonda que llama a las herramientas directo se salta justo lo que se quiere
/// medir, que es cuánto piensa Luna. Solo existen con <c>U_ORDENES_DE_PRUEBA=1</c>: sin la variable, cualquier proceso
/// de este PC podría gastar la voz de pago del dueño con una petición al 127.0.0.1. Luna no las ve nunca.
/// </remarks>
public static class OrdenesDePrueba
{
    public const string Orden = "u_orden";
    public const string Colgar = "u_colgar";
    public const string Decir = "u_decir";

    public static bool Es(string herramienta) => herramienta is Orden or Colgar or Decir;

    /// <summary>El catálogo del MCP, y detrás las dos órdenes de prueba solo si la variable dice «1».</summary>
    public static IReadOnlyList<Utensilio> ConElMcp(IReadOnlyList<Utensilio> catalogo, string? variable)
    {
        if ((variable ?? "").Trim() != "1") return catalogo;
        return catalogo.Append(new Utensilio(Orden,
                "PRUEBA: dile a Ü esta orden como si la persona la escribiera en el chat. Abre la voz en modo texto si "
                + "está cerrada y contesta al instante; lo que haga Ü se ve en su log. Cuesta lo que cueste la voz: "
                + "ciérrala con u_colgar al terminar.",
                new[] { new Argumento("texto", "La orden, en las palabras de la persona.") }))
            .Append(new Utensilio(Colgar, "PRUEBA: cierra la voz de Ü. Deja en el log la medida del último pedido.",
                Array.Empty<Argumento>()))
            .Append(new Utensilio(Decir, "PRUEBA: dile a Ü este audio como si la persona lo HABLARA: la voz lo oye, decide y "
                + "delega, que es el camino que u_orden se salta. PCM de 16 bits mono al ritmo de entrada de la voz. No suena.",
                new[] { new Argumento("archivo", "La ruta del archivo .pcm con lo que se dice.") }))
            .ToList();
    }
}
