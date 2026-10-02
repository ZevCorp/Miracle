namespace U.WindowsClient.Voice;

/// <summary>
/// CUÁNDO VIAJA LA PANTALLA CON EL PEDIDO (spec 079, promesa 780): la regla, sin pantalla y sin red.
/// </summary>
/// <remarks>
/// <para>POR QUÉ VIAJA. Medido el 2026-10-01 con la sonda: una foto metida en la conversación antes de que la
/// persona hable le llega al delegado, que contesta en una vuelta lo que antes le costaba dos —pedir mirar,
/// esperar a que la foto suba, y entonces contestar—. En los logs del dueño, el 24 % de los pedidos empieza
/// mirando y el 31 % pide una foto.</para>
/// <para>POR QUÉ NO SIEMPRE. Una foto en la conversación no se puede quitar después —crear un ítem no devuelve
/// su identificador— y frena cada vuelta del delegado unos 30 ms: 0,9–1,6 s con una, 2,3–2,8 s con cuarenta.
/// Por eso viaja solo si la pantalla CAMBIÓ desde la última, con un respiro entre fotos, y hasta un tope por
/// conexión. Pasado el tope quien actúa sigue pudiendo mirar cuando quiera, con map_look.</para>
/// </remarks>
public static class PantallaAlPedir
{
    /// <summary>Cuántas viajan como mucho en una conexión. Doce son unos 0,35 s más por vuelta al final de una sesión larga.</summary>
    public const int Tope = 12;

    /// <summary>El respiro entre dos. Un carraspeo detrás de otro no son dos pedidos.</summary>
    public const int EspacioMs = 1_500;

    /// <summary>La huella es una rejilla de luminancias medias: 24×14 celdas, unas 80×77 px en una pantalla de 1080p.</summary>
    public const int Columnas = 24, Filas = 14;

    /// <summary>Cuántas muestras por lado se toman dentro de cada celda.</summary>
    private const int Muestras = 6;

    /// <summary>Cuánto tiene que moverse la media de una celda para contar como distinta, de 0 a 255.</summary>
    private const int Umbral = 16;

    /// <summary>Cuántas celdas distintas hacen otra pantalla: el 2 %. El reloj de la barra toca dos; el cursor de texto, ninguna.</summary>
    private static int CeldasQueCuentan => Math.Max(1, Columnas * Filas * 2 / 100);

    public const string Variable = "U_FOTO_AL_PEDIR";

    /// <summary>Viene encendida; <c>U_FOTO_AL_PEDIR=0</c> la apaga sin recompilar.</summary>
    public static bool Encendida(Func<string, string?> variable) => (variable(Variable) ?? "").Trim() != "0";

    /// <summary>La huella de una pantalla, dada su luminancia (0–255) en cada punto.</summary>
    public static int[] Huella(Func<int, int, int> luminancia, int ancho, int alto)
    {
        var celdas = new int[Columnas * Filas];
        if (ancho <= 0 || alto <= 0) return celdas;
        for (int fila = 0; fila < Filas; fila++)
            for (int col = 0; col < Columnas; col++)
            {
                int suma = 0;
                for (int j = 0; j < Muestras; j++)
                    for (int i = 0; i < Muestras; i++)
                    {
                        int x = Math.Min(ancho - 1, (int)((col + (i + 0.5) / Muestras) * ancho / Columnas));
                        int y = Math.Min(alto - 1, (int)((fila + (j + 0.5) / Muestras) * alto / Filas));
                        suma += luminancia(x, y);
                    }
                celdas[fila * Columnas + col] = suma / (Muestras * Muestras);
            }
        return celdas;
    }

    /// <summary>Si es otra pantalla. Sin huella anterior, cualquiera lo es.</summary>
    public static bool Cambio(int[]? antes, int[] ahora)
    {
        if (antes == null || antes.Length != ahora.Length) return true;
        int distintas = 0;
        for (int i = 0; i < ahora.Length; i++)
            if (Math.Abs(ahora[i] - antes[i]) > Umbral && ++distintas >= CeldasQueCuentan) return true;
        return false;
    }

    /// <summary>Si la pantalla de ahora tiene que viajar con este pedido.</summary>
    /// <param name="huellaDeLaUltima">La de la última que viajó en ESTA conexión; null si no ha viajado ninguna.</param>
    public static bool Toca(int[]? huellaDeLaUltima, int[] huellaDeAhora, long msDesdeLaUltima, int cuantasVan, bool encendida)
        => encendida
        && cuantasVan < Tope
        && (huellaDeLaUltima == null || msDesdeLaUltima >= EspacioMs)
        && Cambio(huellaDeLaUltima, huellaDeAhora);
}
