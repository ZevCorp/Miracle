using System.Text;
using U.WindowsClient.Persona;
using Voz.Realtime;

namespace U.WindowsClient.Clases;

/// <summary>
/// LO GRABADO EN CLASE, AL ALCANCE DE LA VOZ (promesa 759). Es para lo que se graba: «que eso sea
/// contexto para que Ü les ayude con sus trabajos» (el dueño, 2026-10-01).
/// </summary>
/// <remarks>
/// DOS PIEZAS, POR TAMAÑO. En las instrucciones de cada sesión va una LISTA corta —las clases más
/// recientes con su fecha y su resumen— para que Ü sepa que existen sin que nadie se lo diga. El
/// contenido entero —apuntes y lo dicho— se pide con <c>clase_leer</c>, porque una clase de dos horas
/// no cabe en unas instrucciones y veinte clases menos.
///
/// SOLO PARA EL ESTUDIANTE. A un médico no le llega ni la lista ni la herramienta, tenga o no clases
/// en el disco.
/// </remarks>
public static class ClasesParaLaVoz
{
    public const string HerramientaLeer = "clase_leer";

    private static readonly string[] Meses =
    {
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    };

    /// <summary>El día de la clase como se dice: «30 de septiembre». No depende del idioma de Windows.</summary>
    public static string Dia(DateTimeOffset fecha) => $"{fecha.Day} de {Meses[fecha.Month - 1]}";

    /// <summary>
    /// La lista para las instrucciones: las más recientes primero, hasta donde quepa.
    /// </summary>
    /// <param name="clases">Ya ordenadas, la más reciente primero (como las da el cuaderno).</param>
    public static string Contexto(Rol rol, IReadOnlyList<Clase> clases, int presupuesto = 2400)
    {
        if (rol != Rol.Estudiante || clases.Count == 0 || presupuesto <= 0) return "";

        string cabecera = $"SUS CLASES GRABADAS (tiene {clases.Count} {(clases.Count == 1 ? "clase" : "clases")}; estas son las más "
                        + $"recientes). Para ayudarle con un trabajo, lee la que toque con {HerramientaLeer} antes de contestar:";
        var sb = new StringBuilder(cabecera);
        for (int i = 0; i < clases.Count; i++)
        {
            string linea = "\n" + Linea(i + 1, clases[i]);
            if (sb.Length + linea.Length > presupuesto) break;
            sb.Append(linea);
        }
        // Si ni la cabecera cabe, no se manda media frase: se manda lo que quepa de ella y nada más.
        return sb.Length <= presupuesto ? sb.ToString() : sb.ToString(0, presupuesto);
    }

    private static string Linea(int n, Clase c)
    {
        string resumen = c.Apuntes?.Resumen.Trim() ?? "";
        if (resumen.Length == 0) resumen = "todavía sin apuntes; está lo que se dijo";
        if (resumen.Length > 220) resumen = resumen[..220].TrimEnd() + "…";
        return $"{n}. {Dia(c.Fecha)} · {TituloVisible(c)}: {resumen}";
    }

    private static string TituloVisible(Clase c) => c.Titulo.Length > 0 ? c.Titulo : "Clase sin título";

    /// <summary>
    /// <c>clase_leer</c>: los apuntes y lo dicho de una clase. Se pide por su número en la lista, por
    /// una palabra de su título, o vacío para la más reciente.
    /// </summary>
    public static string Leer(CuadernoDeClases cuaderno, IReadOnlyDictionary<string, string> args)
    {
        // Lo que cabe de una clase en una respuesta de herramienta: los apuntes enteros y, de lo dicho, lo que quede.
        const int presupuesto = 14000;
        var clases = cuaderno.Todas();
        if (clases.Count == 0) return "Todavía no hay ninguna clase grabada. Se graban con el collar del panel.";

        string cual = args.TryGetValue("cual", out var v) ? (v ?? "").Trim() : "";
        Clase? clase = Elegir(clases, cual);
        if (clase == null)
            return $"No hay ninguna clase que se llame «{cual}». Las que hay: "
                 + string.Join(" · ", clases.Take(10).Select((c, i) => $"{i + 1}. {TituloVisible(c)} ({Dia(c.Fecha)})"))
                 + (clases.Count > 10 ? $" · y {clases.Count - 10} más." : ".");

        var sb = new StringBuilder();
        sb.Append("CLASE: ").Append(TituloVisible(clase)).Append(" · ").Append(Dia(clase.Fecha));
        if (clase.DuracionSegundos >= 60) sb.Append(" · ").Append(clase.DuracionSegundos / 60).Append(" min");
        sb.Append('\n');
        if (clase.Apuntes is { } a)
        {
            sb.Append("RESUMEN: ").Append(a.Resumen).Append('\n');
            foreach (var s in a.Secciones) sb.Append(s.Titulo.ToUpperInvariant()).Append(":\n").Append(s.Contenido).Append('\n');
        }
        else sb.Append("(Esta clase todavía no tiene apuntes organizados: abajo está lo que se dijo.)\n");

        int queda = Math.Max(600, presupuesto - sb.Length);
        string dicho = clase.Transcripcion.Trim();
        bool recortada = dicho.Length > queda;
        sb.Append(recortada ? $"LO QUE SE DIJO (los primeros {queda} caracteres de {dicho.Length}):\n" : "LO QUE SE DIJO:\n");
        sb.Append(recortada ? dicho[..queda] : dicho);
        return sb.ToString();
    }

    private static Clase? Elegir(IReadOnlyList<Clase> clases, string cual)
    {
        string llano = Roles.Llano(cual);
        if (llano.Length == 0 || llano is "ultima" or "la ultima" or "reciente" or "la mas reciente") return clases[0];
        if (int.TryParse(llano, out int n)) return n >= 1 && n <= clases.Count ? clases[n - 1] : null;
        return clases.FirstOrDefault(c => Roles.Llano(TituloVisible(c)).Contains(llano))
            ?? clases.FirstOrDefault(c => Roles.Llano(c.Apuntes?.Resumen).Contains(llano));
    }

    public static IReadOnlyList<Utensilio> Herramientas { get; } = new[]
    {
        new Utensilio(HerramientaLeer,
            "LEE UNA CLASE GRABADA: sus apuntes y lo que se dijo. Úsala antes de ayudar con un trabajo, un "
            + "repaso o una duda que venga de una clase, en vez de contestar de memoria: lo que dijo quien "
            + "enseña manda sobre lo que tú sabes del tema. La lista de clases ya la tienes en tus instrucciones.",
            new[]
            {
                new Argumento("cual", "El número de la clase en tu lista («1» es la más reciente), o una palabra de "
                                    + "su título («newton»). Vacío = la más reciente."),
            }),
    };
}
