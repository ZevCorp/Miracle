using System.Text.Json;
using System.Text.Json.Nodes;
using U.WindowsClient.Cardio;

namespace U.WindowsClient.Clases;

/// <summary>
/// DE LO QUE SE DIJO EN CLASE A UNOS APUNTES: el encargo que se le hace al modelo, y cómo se lee lo
/// que contesta (promesa 758).
/// </summary>
/// <remarks>
/// EL ENCARGO VIVE EN EL CLIENTE, igual que el de cardiología (spec 046), y es una decisión con
/// fecha: así el instalador de la spec 080 graba clases sin esperar a un despliegue de Graph. Su
/// sitio natural es el backend, junto a los de la nota clínica; mudarlo está anotado en la spec.
///
/// SE PIDE JSON CON CINCO CAMPOS y se lee campo a campo. No se parte un texto libre buscando títulos:
/// eso es adivinar estructura, y unos apuntes mal partidos se parecen demasiado a unos bien hechos.
///
/// UNA RESPUESTA QUE NO SE ENTIENDE ES UN FALLO, no unos apuntes vacíos. La clase ya está guardada
/// con su transcripción; lo que no puede pasar es que quede marcada como lista sin nada dentro.
/// </remarks>
public static class OrganizadorDeClases
{
    public const string ModeloPorDefecto = ClienteCardio.ModeloPorDefecto;

    /// <summary>El modelo de la app: <c>U_CLASES_MODELO</c> lo cambia sin recompilar.</summary>
    public static string ModeloDeLaApp()
    {
        string? pedido = Environment.GetEnvironmentVariable("U_CLASES_MODELO");
        return string.IsNullOrWhiteSpace(pedido) ? ModeloPorDefecto : pedido.Trim();
    }

    public const string Instrucciones =
        "Eres quien toma los apuntes de un estudiante. Recibes la transcripción automática de una clase: "
        + "habla sobre todo quien enseña, a veces preguntan los estudiantes, y el reconocimiento de voz "
        + "comete errores con nombres propios, fórmulas y términos técnicos. Corrígelos cuando el contexto "
        + "deje claro qué se dijo; si no, deja el término como vino.\n\n"
        + "Devuelve SOLO un objeto JSON, sin texto antes ni después, con estos cinco campos de texto:\n"
        + "- \"titulo\": de qué fue la clase, en pocas palabras, como la llamaría el estudiante al buscarla "
        + "(«La segunda ley de Newton»). Sin la palabra «clase» y sin fecha.\n"
        + "- \"resumen\": tres a cinco frases que digan qué se enseñó y por qué importa. Es lo que se lee para "
        + "decidir si esta es la clase que se busca.\n"
        + "- \"conceptos\": los conceptos, definiciones, fórmulas y ejemplos que se explicaron, uno por línea, "
        + "cada uno con su explicación en una frase. Es el cuerpo de los apuntes: que sirva para estudiar.\n"
        + "- \"tareas\": lo que hay que entregar o preparar, con su fecha si se dijo, uno por línea. Cadena "
        + "vacía si no se dejó nada.\n"
        + "- \"dudas\": lo que quedó sin resolver o conviene repasar, uno por línea. Cadena vacía si no hay.\n\n"
        + "REGLAS. Escribe en el idioma de la clase. Usa solo lo que se dijo: no completes con lo que sabes "
        + "del tema, y no inventes fechas ni tareas. Si la transcripción es demasiado corta o no parece una "
        + "clase, resume igualmente lo que se dijo. Texto llano en cada campo: sin markdown, sin asteriscos.";

    /// <summary>El cuerpo de la petición: el encargo de arriba y la transcripción ENTERA.</summary>
    public static string Cuerpo(string modelo, string transcripcion) =>
        new JsonObject
        {
            ["model"] = modelo,
            ["store"] = false,
            ["instructions"] = Instrucciones,
            ["input"] = new JsonArray
            {
                new JsonObject
                {
                    ["role"] = "user",
                    ["content"] = new JsonArray
                    {
                        new JsonObject { ["type"] = "input_text", ["text"] = "TRANSCRIPCIÓN DE LA CLASE:\n" + (transcripcion ?? "").Trim() },
                    },
                },
            },
        }.ToJsonString();

    /// <summary>Lo que contestó el modelo, hecho apuntes. Lanza con el motivo si no se entiende.</summary>
    public static ApuntesDeClase Leer(string respuesta)
    {
        string texto;
        try { texto = LecturaCardio.TextoDeLaRespuesta(respuesta).Trim(); }
        catch (JsonException) { throw new InvalidOperationException("los apuntes no se pudieron leer: lo que contestó el modelo no es JSON"); }
        if (texto.Length == 0) throw new InvalidOperationException("el modelo devolvió los apuntes vacíos");

        texto = SinCerca(texto);
        JsonElement raiz;
        try
        {
            using var doc = JsonDocument.Parse(texto);
            raiz = doc.RootElement.Clone();
        }
        catch (JsonException)
        {
            throw new InvalidOperationException("los apuntes no se pudieron leer: el modelo contestó texto suelto en vez de los cinco campos");
        }
        if (raiz.ValueKind != JsonValueKind.Object)
            throw new InvalidOperationException("los apuntes no se pudieron leer: el modelo no devolvió un objeto con sus campos");

        string resumen = Campo(raiz, "resumen");
        if (resumen.Length == 0) throw new InvalidOperationException("el modelo devolvió unos apuntes sin resumen");

        var secciones = new List<SeccionDeApuntes>();
        foreach (var (clave, titulo) in new[] { ("conceptos", "Conceptos"), ("tareas", "Tareas"), ("dudas", "Para repasar") })
        {
            // Una sección vacía no es información: no se pinta una tarjeta para decir que no hay tareas.
            string contenido = Campo(raiz, clave);
            if (contenido.Length > 0) secciones.Add(new SeccionDeApuntes(clave, titulo, contenido));
        }
        return new ApuntesDeClase(Campo(raiz, "titulo"), resumen, secciones);
    }

    /// <summary>Un campo como texto. Si el modelo mandó una lista, sus elementos, uno por línea.</summary>
    private static string Campo(JsonElement raiz, string nombre)
    {
        // «titulo» o «título»: el encargo lo pide sin tilde, pero una tilde de más no puede costar el título.
        if (!raiz.TryGetProperty(nombre, out var v) && !(nombre == "titulo" && raiz.TryGetProperty("título", out v))) return "";
        return v.ValueKind switch
        {
            JsonValueKind.String => (v.GetString() ?? "").Trim(),
            JsonValueKind.Array => string.Join("\n", v.EnumerateArray()
                .Select(x => x.ValueKind == JsonValueKind.String ? (x.GetString() ?? "").Trim() : x.GetRawText())
                .Where(x => x.Length > 0)),
            _ => "",
        };
    }

    /// <summary>Quita la cerca de código (```json … ```) cuando el modelo envuelve en ella su respuesta.</summary>
    private static string SinCerca(string texto)
    {
        if (!texto.StartsWith("```", StringComparison.Ordinal)) return texto;
        int salto = texto.IndexOf('\n');
        int cierre = texto.LastIndexOf("```", StringComparison.Ordinal);
        return salto > 0 && cierre > salto ? texto[(salto + 1)..cierre].Trim() : texto;
    }
}
