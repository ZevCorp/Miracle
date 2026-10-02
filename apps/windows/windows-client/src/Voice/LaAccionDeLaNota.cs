using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace U.WindowsClient.Voice;

/// <summary>
/// EL ✓ DE UNA SECCIÓN ES UN GATILLO (spec 084): Ü se pregunta «¿qué acción quiere que yo ejecute con esta
/// información?», la contrasta con las habilidades que le enseñaron, PROPONE una en una frase, y solo la hace
/// cuando la persona la aprueba.
/// </summary>
/// <remarks>
/// <para>LO QUE SE ACABÓ (decisión del dueño, 2026-10-02: «todo ese funcionamiento actual de los checks es viejo y
/// no funcionó»): el ✓ llevaba la sección a SAP por el piloto y sus skills grabadas. Ahora lo único que cuenta es
/// lo aprendido hablando (spec 074): el ✓ no sabe de SAP ni de ningún sistema, sabe de habilidades.</para>
/// <para>EL MODELO PROPONE, EL CÓDIGO COMPRUEBA, LA PERSONA APRUEBA. Una propuesta que nombra una habilidad que no
/// existe no llega al botón de aprobar: se dice que no hay con qué (promesa 822). Y sin ninguna habilidad no se
/// llama al modelo: no hay con qué contrastar (promesa 821).</para>
/// <para>EL PROMPT VIVE AQUÍ, la misma deuda dicha que en <see cref="ElRepaso"/>.</para>
/// </remarks>
public static class LaAccionDeLaNota
{
    /// <summary>El mismo que repasa: rápido, y lo que decide es corto.</summary>
    public const string Modelo = "gpt-6-luna";

    /// <param name="Hay">Hay una acción que proponer, y su habilidad existe.</param>
    /// <param name="Accion">El mensaje de acción, como se le enseña a la persona: «Registrar los signos vitales en…».</param>
    /// <param name="Habilidad">El nombre de la habilidad, tal como está guardada.</param>
    /// <param name="Porque">Si no hay: qué falta, dicho para la persona.</param>
    public sealed record Propuesta(bool Hay, string Accion, string Habilidad, string Porque);

    public const string SinHabilidades = "Todavía no me has enseñado ninguna tarea. Enséñame una hablando —«te voy a enseñar a…»— y vuelve a pulsar ✓.";

    /// <summary>La propuesta cuando no hay nada aprendido: se contesta sin llamar a nadie.</summary>
    public static Propuesta? SinNadaAprendido(IReadOnlyList<LoAprendido.Habilidad> habilidades)
        => habilidades.Count == 0 ? new Propuesta(false, "", "", SinHabilidades) : null;

    /// <summary>El cuerpo de la petición a la Responses API.</summary>
    /// <param name="deVarias">La información son varias secciones juntas («Ejecutar todo»): se busca UNA acción en común.</param>
    public static string Peticion(IReadOnlyList<LoAprendido.Habilidad> habilidades, string informacion, bool deVarias)
    {
        var sb = new StringBuilder("LAS HABILIDADES QUE ESTA PERSONA TE ENSEÑÓ\n");
        foreach (var h in habilidades)
        {
            sb.Append("\n· «").Append(h.Nombre).Append('»');
            if (h.Cuando.Length > 0) sb.Append(" — cuándo: ").Append(h.Cuando);
            sb.Append('\n');
            for (int i = 0; i < h.Pasos.Count; i++) sb.Append("    ").Append(i + 1).Append(". ").Append(h.Pasos[i]).Append('\n');
        }
        sb.Append(deVarias ? "\n\nLA INFORMACIÓN QUE ACABA DE APROBAR CON ✓ (varias secciones de su nota, todas juntas)\n\n"
                           : "\n\nLA INFORMACIÓN QUE ACABA DE APROBAR CON ✓ (una sección de su nota)\n\n");
        sb.Append(informacion.Trim());

        var cadena = new JsonObject { ["type"] = "string" };
        var esquema = new JsonObject
        {
            ["type"] = "object",
            ["additionalProperties"] = false,
            ["required"] = new JsonArray("hay", "accion", "habilidad", "porque"),
            ["properties"] = new JsonObject
            {
                ["hay"] = new JsonObject { ["type"] = "boolean", ["description"] = "true si una de las habilidades sirve para hacer algo con esta información." },
                ["accion"] = new JsonObject { ["type"] = "string", ["description"] = "La acción en UNA frase corta que empieza por un verbo en infinitivo y nombra el sistema: «Registrar los signos vitales en el sistema de pacientes que me enseñaste». Vacío si no hay." },
                ["habilidad"] = new JsonObject { ["type"] = "string", ["description"] = "El nombre EXACTO de la habilidad que vas a usar, copiado de la lista. Vacío si no hay." },
                ["porque"] = cadena.DeepClone(),
            },
        };
        esquema["properties"]!["porque"]!["description"] = "Si no hay: qué te falta que te enseñen, en una frase para la persona. Si hay: vacío.";
        var peticion = new JsonObject
        {
            ["model"] = Modelo,
            ["instructions"] = deVarias ? Instrucciones + "\n\n" + DeVarias : Instrucciones,
            ["input"] = sb.ToString(),
            ["reasoning"] = new JsonObject { ["effort"] = "low" },
            ["text"] = new JsonObject
            {
                ["format"] = new JsonObject { ["type"] = "json_schema", ["name"] = "accion_de_la_nota", ["strict"] = true, ["schema"] = esquema },
            },
        };
        return peticion.ToJsonString();
    }

    /// <summary>
    /// La propuesta del modelo, COMPROBADA: la habilidad que nombra tiene que existir. Lanza si la respuesta no se
    /// puede leer —«no propuso nada» y «no pude leer lo que propuso» no son lo mismo (patrón nº2)—.
    /// </summary>
    public static Propuesta Leer(string respuesta, IReadOnlyList<LoAprendido.Habilidad> habilidades)
    {
        using var doc = JsonDocument.Parse(respuesta);
        string? texto = null;
        if (doc.RootElement.TryGetProperty("output", out var salida) && salida.ValueKind == JsonValueKind.Array)
            foreach (var item in salida.EnumerateArray())
                if (Cadena(item, "type") == "message" && item.TryGetProperty("content", out var partes) && partes.ValueKind == JsonValueKind.Array)
                    foreach (var parte in partes.EnumerateArray())
                        if (Cadena(parte, "type") == "output_text" && Cadena(parte, "text") is { Length: > 0 } t) texto = t;
        if (string.IsNullOrWhiteSpace(texto))
            throw new InvalidDataException("la respuesta del modelo no trae texto: " + (respuesta.Length <= 300 ? respuesta : respuesta[..300] + "…"));

        using var p = JsonDocument.Parse(texto);
        var o = p.RootElement;
        bool hay = o.ValueKind == JsonValueKind.Object && o.TryGetProperty("hay", out var h) && h.ValueKind == JsonValueKind.True;
        string accion = Cadena(o, "accion").Trim(), habilidad = Cadena(o, "habilidad").Trim(), porque = Cadena(o, "porque").Trim();
        if (!hay)
            return new Propuesta(false, "", "", porque.Length > 0 ? porque : "Con lo que me has enseñado no sé qué hacer con esto. Enséñame la tarea hablando y vuelve a pulsar ✓.");

        // LA HABILIDAD TIENE QUE EXISTIR (822). Un nombre inventado llegaría a quien actúa como una orden de usar algo
        // que no tiene, y lo improvisaría sobre el sistema de la persona.
        // El modelo copia el nombre casi exacto: con comillas, con un punto al final. Eso no es otra habilidad.
        string clave = LoAprendido.Clave(habilidad.Trim(' ', '.', '«', '»', '"'));
        var laSuya = habilidades.FirstOrDefault(x => LoAprendido.Clave(x.Nombre) == clave);
        if (laSuya == null)
            return new Propuesta(false, "", "", habilidad.Length == 0
                ? "Pensé una acción pero sin decir con qué habilidad hacerla: no la propongo. Vuelve a pulsar ✓."
                : $"Pensé en usar «{habilidad}», que no es una habilidad que me hayas enseñado: no la propongo. Enséñamela hablando y vuelve a pulsar ✓.");
        if (accion.Length == 0) accion = $"Usar «{laSuya.Nombre}» con esta información";
        return new Propuesta(true, accion, laSuya.Nombre, "");
    }

    /// <summary>
    /// LA ORDEN PARA QUIEN ACTÚA, una vez aprobada: la acción, la habilidad por su nombre y la información tal cual.
    /// Entra por el mismo camino que lo escrito en el chat.
    /// </summary>
    public static string Orden(Propuesta propuesta, string informacion)
        => $"Aprobé con ✓ esta acción: «{propuesta.Accion}». Hazla AHORA, sin preguntarme nada, con la habilidad "
         + $"«{propuesta.Habilidad}» —léela con habilidad_leer si no tienes sus pasos delante— y con esta información "
         + "de mi nota, tal cual:\n\n" + informacion.Trim() + "\n\n"
         + "Usa solo los datos que están en esa información: si la habilidad pide un dato que no está, deja ese campo "
         + "sin tocar y dímelo al terminar. Al terminar, dime en una frase qué quedó hecho.";

    private static string Cadena(JsonElement o, string campo)
        => o.ValueKind == JsonValueKind.Object && o.TryGetProperty(campo, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";

    internal const string Instrucciones = """
        Eres Ü, un asistente que maneja el ordenador de una persona. La persona tiene delante una nota con secciones
        transcritas y acaba de pulsar el ✓ de una. Ese ✓ es un gatillo: quiere que HAGAS algo con esa información.

        Hazte esta pregunta: ¿QUÉ ACCIÓN QUIERE QUE YO EJECUTE CON ESTA INFORMACIÓN? Y contéstala contrastando la
        información con LAS HABILIDADES QUE TE ENSEÑÓ: cada una tiene un nombre, cuándo usarla y sus pasos.

        · Si una habilidad sirve para llevar esa información a donde tiene que ir —sus pasos piden datos que la
          información trae—, propón UNA acción: una frase corta, que empieza por un verbo en infinitivo, dice qué
          se va a hacer con qué y en qué sistema, y termina recordando que te lo enseñó. Ejemplo: «Registrar los
          signos vitales en el sistema de pacientes que me enseñaste».
        · Si varias sirven, elige la que más datos de la información aprovecha.
        · Si ninguna sirve, di que no hay y, en «porque», qué te falta que te enseñen, en una frase para la persona.
          No inventes una habilidad ni propongas hacerlo «a ojo»: lo que no te enseñaron, no lo sabes hacer.
        · El nombre de la habilidad se copia EXACTO de la lista.
        """;

    internal const string DeVarias = """
        ESTA VEZ LA INFORMACIÓN SON VARIAS SECCIONES JUNTAS: la persona pulsó «Ejecutar todo». Busca UNA acción en
        común que aproveche toda la información que se pueda con una sola habilidad, y dila en una frase que lo
        abarque: «Registrar al paciente con sus datos y su triage en el sistema que me enseñaste».
        """;
}
