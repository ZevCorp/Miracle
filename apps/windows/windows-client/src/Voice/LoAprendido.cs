using System.Globalization;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using U.WindowsClient.Diagnostics;

namespace U.WindowsClient.Voice;

/// <summary>
/// LO QUE LA PERSONA LE HA ENSEÑADO A Ü (spec 074): cómo se hace algo —habilidades—, cómo quiere las cosas
/// —preferencias— y un cuaderno de lo que se hizo una vez sin enseñarlo —observaciones—.
/// </summary>
/// <remarks>
/// <para>TEXTO, Y NADA MÁS. Una habilidad es un nombre, cuándo usarla y sus pasos en lenguaje natural. El
/// Learn por demostración guardaba selectores y un paso por tecla: su skill de Gmail tenía 117 pasos para 6
/// acciones, exigía «Comprobar» antes de usarse (3 de 16 pasaron, 312 s de mediana) y la voz no la podía
/// pedir. En el respaldo del 2026-09-30 quedaban 2 skills, ninguna usada.</para>
/// <para>RECONSTRUIR ES LA ÚNICA OPERACIÓN (761). Quien la escribe la escribe entera, y el almacén la
/// sustituye por su nombre. No hay «editar el paso 3»: esa operación exige que el modelo y el archivo estén
/// de acuerdo en qué es el paso 3, y cuando no lo están se corrige el paso equivocado sin que nadie se
/// entere.</para>
/// <para>EL CUADERNO NO VIAJA A LA VOZ (763). Lo visto una vez sin enseñarlo no es todavía algo que seguir:
/// es lo que permite COMPROBAR que algo se repitió, en vez de creérselo a un modelo (770).</para>
/// <para>UN ARCHIVO ILEGIBLE SE APARTA, NO SE PISA (762). <c>MemoriaPersonal.Leer</c> devuelve un documento
/// vacío ante un JSON roto y la siguiente escritura lo pisa con él: todo lo enseñado, perdido por un archivo
/// a medio escribir.</para>
/// </remarks>
public sealed class LoAprendido
{
    private static readonly object Candado = new();
    private static readonly JsonSerializerOptions Json = new()
    {
        WriteIndented = true,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,   // «háblame», no «háblame»: el archivo se lee
    };

    /// <summary>Cuánto ocupa lo aprendido en las instrucciones de apertura, en caracteres. Las instrucciones de
    /// quien actúa tienen tope (16.384 fichas, y con más la sesión no abre): lo aprendido no puede crecer hasta
    /// dejar a Ü sin voz. Pasado esto, las habilidades viajan como índice (764).</summary>
    public const int PresupuestoDeApertura = 6_000;

    /// <summary>Cuántas observaciones caben en el cuaderno: lo que no se repitió en las últimas 40 no se va a repetir.</summary>
    public const int TopeDelCuaderno = 40;

    /// <summary>Cuántas preferencias se guardan. Más que estas no son preferencias: son ruido.</summary>
    public const int TopeDePreferencias = 40;

    private readonly string _archivo;

    public LoAprendido(string? archivo = null) => _archivo = archivo ?? ArchivoPorDefecto;

    /// <summary>Dónde guarda la app. Junto a la memoria personal, y siguiendo a U_DATA_DIR como ella.</summary>
    public static string ArchivoPorDefecto => Path.Combine(U.Graph.UserPaths.Roaming, "U", "aprendido.json");

    public sealed class Habilidad
    {
        [JsonPropertyName("nombre")] public string Nombre { get; set; } = "";
        [JsonPropertyName("cuando")] public string Cuando { get; set; } = "";
        [JsonPropertyName("pasos")] public List<string> Pasos { get; set; } = new();
        /// <summary>Las palabras de la persona que la justifican. Vacío si la guardó quien actúa, en el momento.</summary>
        [JsonPropertyName("cita")] public string Cita { get; set; } = "";
        /// <summary>De dónde salió: enseñada, corregida o repetida.</summary>
        [JsonPropertyName("origen")] public string Origen { get; set; } = "";
        [JsonPropertyName("actualizada")] public DateTimeOffset Actualizada { get; set; }
    }

    public sealed class Preferencia
    {
        [JsonPropertyName("texto")] public string Texto { get; set; } = "";
        [JsonPropertyName("cita")] public string Cita { get; set; } = "";
        [JsonPropertyName("actualizada")] public DateTimeOffset Actualizada { get; set; }
    }

    public sealed class Observacion
    {
        [JsonPropertyName("nombre")] public string Nombre { get; set; } = "";
        [JsonPropertyName("pasos")] public List<string> Pasos { get; set; } = new();
        /// <summary>En qué sesiones se vio. Dos sesiones distintas es una repetición; la misma dos veces, no.</summary>
        [JsonPropertyName("sesiones")] public List<string> Sesiones { get; set; } = new();
        [JsonPropertyName("vista")] public DateTimeOffset Vista { get; set; }
    }

    public sealed record Resultado(bool Ok, string Mensaje);

    private sealed class Documento
    {
        [JsonPropertyName("habilidades")] public List<Habilidad> Habilidades { get; set; } = new();
        [JsonPropertyName("preferencias")] public List<Preferencia> Preferencias { get; set; } = new();
        [JsonPropertyName("observaciones")] public List<Observacion> Observaciones { get; set; } = new();
    }

    // ── Habilidades ──────────────────────────────────────────────────────────

    /// <summary>Crea la habilidad, o la RECONSTRUYE entera si ya había una con ese nombre.</summary>
    /// <param name="pasos">Un paso por línea. La numeración que traiga («1.», «2)», «-») se quita.</param>
    public Resultado EscribirHabilidad(string nombre, string cuando, string pasos, string cita = "", string origen = "ensenada")
    {
        string limpio = Espacios(nombre);
        var lista = Pasos(pasos);
        // DICE CUÁL FALTA (patrón nº2): un «no se pudo guardar» manda al modelo a reintentar lo mismo.
        if (limpio.Length == 0) return new Resultado(false, "No la guardé: le falta el nombre.");
        if (lista.Count == 0) return new Resultado(false, $"No guardé «{limpio}»: no trae ningún paso.");

        lock (Candado)
        {
            var doc = Leer();
            string clave = Clave(limpio);
            bool habia = doc.Habilidades.RemoveAll(h => Clave(h.Nombre) == clave) > 0;
            doc.Habilidades.Add(new Habilidad
            {
                Nombre = limpio, Cuando = Espacios(cuando), Pasos = lista, Cita = Espacios(cita),
                Origen = Espacios(origen), Actualizada = DateTimeOffset.Now,
            });
            // Lo que ya es una habilidad no sigue en el cuaderno: no puede estar en los dos sitios.
            doc.Observaciones.RemoveAll(o => Clave(o.Nombre) == clave);
            Guardar(doc);
            LogBus.Log("aprendido", $"habilidad {(habia ? "reconstruida" : "nueva")}: «{limpio}» con {lista.Count} paso(s)");
            return new Resultado(true, habia
                ? $"Reconstruí «{limpio}»: ahora tiene {lista.Count} paso(s)."
                : $"Guardé «{limpio}» con {lista.Count} paso(s). Ya la puedo usar.");
        }
    }

    /// <summary>Los pasos de una habilidad, pedida como la diría una persona.</summary>
    public Resultado LeerHabilidad(string nombre)
    {
        lock (Candado)
        {
            var doc = Leer();
            var h = Buscar(doc.Habilidades, nombre);
            if (h == null)
                return new Resultado(false, doc.Habilidades.Count == 0
                    ? "Todavía no me han enseñado ninguna habilidad."
                    : $"No tengo una habilidad que se llame «{Espacios(nombre)}». Las que tengo: "
                      + string.Join(", ", doc.Habilidades.Select(x => $"«{x.Nombre}»")) + ".");
            return new Resultado(true, Entera(h));
        }
    }

    public Resultado OlvidarHabilidad(string nombre)
    {
        lock (Candado)
        {
            var doc = Leer();
            var h = Buscar(doc.Habilidades, nombre);
            if (h == null) return new Resultado(false, $"No tengo una habilidad que se llame «{Espacios(nombre)}».");
            doc.Habilidades.Remove(h);
            Guardar(doc);
            LogBus.Log("aprendido", $"habilidad olvidada: «{h.Nombre}»");
            return new Resultado(true, $"Olvidé «{h.Nombre}».");
        }
    }

    public IReadOnlyList<Habilidad> Habilidades()
    {
        lock (Candado) return Leer().Habilidades.OrderBy(h => h.Nombre, StringComparer.CurrentCultureIgnoreCase).ToList();
    }

    // ── Preferencias ─────────────────────────────────────────────────────────

    public Resultado GuardarPreferencia(string texto, string cita = "")
    {
        string limpio = Espacios(texto);
        if (limpio.Length == 0) return new Resultado(false, "No la guardé: la preferencia viene vacía.");
        lock (Candado)
        {
            var doc = Leer();
            string clave = Clave(limpio);
            if (doc.Preferencias.Any(p => Clave(p.Texto) == clave)) return new Resultado(true, $"Ya la tenía: «{limpio}».");
            doc.Preferencias.Add(new Preferencia { Texto = limpio, Cita = Espacios(cita), Actualizada = DateTimeOffset.Now });
            // LAS MÁS VIEJAS SALEN, y se dice: lo que no cabe no desaparece en silencio (patrón nº10).
            while (doc.Preferencias.Count > TopeDePreferencias)
            {
                LogBus.Log("aprendido", $"preferencia retirada por el tope de {TopeDePreferencias}: «{doc.Preferencias[0].Texto}»");
                doc.Preferencias.RemoveAt(0);
            }
            Guardar(doc);
            LogBus.Log("aprendido", $"preferencia nueva: «{limpio}»");
            return new Resultado(true, $"Guardé la preferencia: «{limpio}».");
        }
    }

    /// <summary>Quita la preferencia que diga eso. Vale el texto entero o un trozo que solo case con una.</summary>
    public Resultado OlvidarPreferencia(string texto)
    {
        string clave = Clave(Espacios(texto));
        if (clave.Length == 0) return new Resultado(false, "No sé qué preferencia olvidar: viene vacía.");
        lock (Candado)
        {
            var doc = Leer();
            var casan = doc.Preferencias.Where(p => Clave(p.Texto) == clave).ToList();
            if (casan.Count == 0) casan = doc.Preferencias.Where(p => Clave(p.Texto).Contains(clave, StringComparison.Ordinal) || clave.Contains(Clave(p.Texto), StringComparison.Ordinal)).ToList();
            if (casan.Count != 1)
                return new Resultado(false, casan.Count == 0 ? $"No tengo una preferencia que diga «{Espacios(texto)}»." : $"«{Espacios(texto)}» casa con {casan.Count} preferencias: no sé cuál.");
            doc.Preferencias.Remove(casan[0]);
            Guardar(doc);
            LogBus.Log("aprendido", $"preferencia olvidada: «{casan[0].Texto}»");
            return new Resultado(true, $"Olvidé la preferencia «{casan[0].Texto}».");
        }
    }

    public IReadOnlyList<Preferencia> Preferencias()
    {
        lock (Candado) return Leer().Preferencias.ToList();
    }

    // ── El cuaderno ──────────────────────────────────────────────────────────

    /// <summary>
    /// Apunta en el cuaderno que este procedimiento se hizo en esta sesión. Devuelve en cuántas sesiones
    /// DISTINTAS se ha visto ya: 2 o más es una repetición (770).
    /// </summary>
    public int Observar(string nombre, string pasos, string sesion)
    {
        string limpio = Espacios(nombre);
        var lista = Pasos(pasos);
        if (limpio.Length == 0 || lista.Count == 0) return 0;
        lock (Candado)
        {
            var doc = Leer();
            string clave = Clave(limpio);
            var o = doc.Observaciones.FirstOrDefault(x => Clave(x.Nombre) == clave);
            if (o == null)
            {
                o = new Observacion { Nombre = limpio };
                doc.Observaciones.Add(o);
            }
            o.Pasos = lista;
            o.Vista = DateTimeOffset.Now;
            string s = Espacios(sesion);
            if (s.Length > 0 && !o.Sesiones.Contains(s, StringComparer.Ordinal)) o.Sesiones.Add(s);
            // EL CUADERNO NO CRECE SIN FIN: se quedan las vistas más recientemente.
            doc.Observaciones = doc.Observaciones.OrderByDescending(x => x.Vista).Take(TopeDelCuaderno).OrderBy(x => x.Vista).ToList();
            Guardar(doc);
            return o.Sesiones.Count;
        }
    }

    /// <summary>Si este procedimiento ya estaba en el cuaderno, visto en una sesión que no es <paramref name="sesionDeAhora"/>.</summary>
    public bool EstabaObservada(string nombre, string sesionDeAhora)
    {
        string clave = Clave(Espacios(nombre));
        lock (Candado)
            return Leer().Observaciones.Any(o => Clave(o.Nombre) == clave && o.Sesiones.Any(s => s != Espacios(sesionDeAhora)));
    }

    public IReadOnlyList<Observacion> Observaciones()
    {
        lock (Candado) return Leer().Observaciones.ToList();
    }

    // ── Lo que viaja ─────────────────────────────────────────────────────────

    /// <summary>
    /// Lo aprendido como se le da a quien actúa al abrir la sesión: las preferencias y las habilidades. Vacío
    /// si no hay nada. Nunca pasa de <paramref name="presupuesto"/> (764).
    /// </summary>
    public string Contexto(int presupuesto = PresupuestoDeApertura)
    {
        Documento doc;
        lock (Candado) doc = Leer();
        if (doc.Habilidades.Count == 0 && doc.Preferencias.Count == 0) return "";

        var sb = new StringBuilder();
        if (doc.Preferencias.Count > 0)
        {
            sb.Append("PREFERENCIAS DE ESTA PERSONA (así quiere las cosas; cúmplelas sin que te las repita):\n");
            foreach (var p in doc.Preferencias) sb.Append("- ").Append(p.Texto).Append('\n');
        }
        var habilidades = doc.Habilidades.OrderBy(h => h.Nombre, StringComparer.CurrentCultureIgnoreCase).ToList();
        if (habilidades.Count == 0) return Recortado(sb.ToString().TrimEnd(), presupuesto);

        if (sb.Length > 0) sb.Append('\n');
        string cabecera = sb.ToString();
        const string titulo = "HABILIDADES APRENDIDAS (cuando te pidan algo que describe una, SIGUE SUS PASOS en orden):\n";
        string enteras = cabecera + titulo + string.Join("\n", habilidades.Select(Entera));
        if (enteras.Length <= presupuesto) return enteras;

        // NO CABEN ENTERAS: viaja el índice, y los pasos se leen cuando hagan falta. Ninguna desaparece —una
        // habilidad que no se nombra es una que no se usa, que es de lo que venimos—.
        string indice = cabecera
            + "HABILIDADES APRENDIDAS (son muchas: aquí va su nombre y cuándo usarla; ANTES de hacer una, lee sus pasos con habilidad_leer y síguelos en orden):\n"
            + string.Join("\n", habilidades.Select(h => $"• «{h.Nombre}»" + (h.Cuando.Length > 0 ? $" — {h.Cuando}" : "")));
        return Recortado(indice, presupuesto);
    }

    /// <summary>
    /// Las preferencias como se le dicen a QUIEN HABLA cuando no es quien actúa (promesa 776). Vacío si no hay
    /// ninguna. Solo las preferencias: las habilidades son de quien actúa, y no caben.
    /// </summary>
    /// <param name="tope">Lo que cabe en un mensaje a la voz. Si no caben todas, se quedan las más recientes:
    /// lo último que pidió es lo que más pesa, y una preferencia a medias no es una preferencia.</param>
    public string ParaLaVoz(int tope)
    {
        List<Preferencia> todas;
        lock (Candado) todas = Leer().Preferencias;
        if (todas.Count == 0) return "";
        const string titulo = "LO QUE ESTA PERSONA TE HA PEDIDO SOBRE CÓMO QUIERE LAS COSAS (cúmplelo siempre, también al hablar, sin que te lo repita):";
        var caben = new List<string>();
        int largo = titulo.Length;
        for (int i = todas.Count - 1; i >= 0; i--)
        {
            string linea = "\n- " + todas[i].Texto;
            if (largo + linea.Length > tope) break;
            caben.Add(linea);
            largo += linea.Length;
        }
        if (caben.Count == 0) return "";
        if (caben.Count < todas.Count)
            LogBus.Log("aprendido", $"a la voz le llegan las {caben.Count} preferencias más recientes de {todas.Count}: no caben más en un mensaje");
        return titulo + string.Concat(caben);
    }

    /// <summary>Todo lo que hay, cuaderno incluido, para quien repasa la sesión: tiene que ver qué existe ya
    /// para reconstruirlo en vez de duplicarlo, y qué se observó antes para reconocer una repetición.</summary>
    public string ParaElRepaso()
    {
        Documento doc;
        lock (Candado) doc = Leer();
        var sb = new StringBuilder();
        sb.Append("PREFERENCIAS GUARDADAS:\n");
        sb.Append(doc.Preferencias.Count == 0 ? "(ninguna)\n" : string.Join("\n", doc.Preferencias.Select(p => "- " + p.Texto)) + "\n");
        sb.Append("\nHABILIDADES GUARDADAS:\n");
        sb.Append(doc.Habilidades.Count == 0 ? "(ninguna)\n" : string.Join("\n", doc.Habilidades.Select(Entera)) + "\n");
        sb.Append("\nCUADERNO DE OBSERVACIONES (procedimientos vistos en sesiones anteriores, sin enseñar):\n");
        sb.Append(doc.Observaciones.Count == 0
            ? "(vacío)\n"
            : string.Join("\n", doc.Observaciones.Select(o => $"• «{o.Nombre}» — vista en: {string.Join(", ", o.Sesiones)}\n"
                + string.Join("\n", o.Pasos.Select((p, i) => $"   {i + 1}. {p}")))) + "\n");
        return sb.ToString().TrimEnd();
    }

    private static string Entera(Habilidad h)
    {
        var sb = new StringBuilder();
        sb.Append("• «").Append(h.Nombre).Append('»');
        if (h.Cuando.Length > 0) sb.Append(" — ").Append(h.Cuando);
        for (int i = 0; i < h.Pasos.Count; i++) sb.Append("\n   ").Append(i + 1).Append(". ").Append(h.Pasos[i]);
        return sb.ToString();
    }

    private static string Recortado(string texto, int presupuesto)
    {
        if (texto.Length <= presupuesto) return texto;
        const string cola = "\n… [recortado: no cabe todo lo aprendido; pide lo que falte con habilidad_leer]";
        return texto[..Math.Max(0, presupuesto - cola.Length)] + cola;
    }

    private static Habilidad? Buscar(List<Habilidad> todas, string nombre)
    {
        string clave = Clave(Espacios(nombre));
        if (clave.Length == 0) return null;
        return todas.FirstOrDefault(h => Clave(h.Nombre) == clave)
            ?? (todas.Where(h => Clave(h.Nombre).Contains(clave, StringComparison.Ordinal) || clave.Contains(Clave(h.Nombre), StringComparison.Ordinal)).ToList() is { Count: 1 } unica ? unica[0] : null);
    }

    // ── Piezas ───────────────────────────────────────────────────────────────

    private static List<string> Pasos(string? texto)
        => (texto ?? "").Split('\n')
            .Select(l => Regex.Replace(l, @"^\s*(\d+\s*[\.\)\-:]|[\-•\*·])\s*", "").Trim())
            .Where(l => l.Length > 0)
            .ToList();

    private static string Espacios(string? texto) => Regex.Replace(texto ?? "", @"\s+", " ").Trim();

    /// <summary>La identidad de un nombre: sin mayúsculas, sin tildes y sin espacios de más. En UN sitio
    /// (aprendizaje nº16): quien escribe, quien lee y quien olvida comparan por aquí.</summary>
    internal static string Clave(string nombre)
    {
        string d = Regex.Replace(nombre ?? "", @"\s+", " ").Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        return new string(d.Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray());
    }

    private Documento Leer()
    {
        if (!File.Exists(_archivo)) return new Documento();
        try
        {
            return JsonSerializer.Deserialize<Documento>(File.ReadAllText(_archivo), Json) ?? new Documento();
        }
        catch (JsonException e)
        {
            // NO SE LEE COMO VACÍO EN SILENCIO: la siguiente escritura pisaría todo lo enseñado. Se aparta el
            // archivo con otro nombre, se dice dónde quedó, y se empieza de cero sin perder nada.
            string apartado = _archivo + "." + DateTime.Now.ToString("yyyyMMdd-HHmmss-fff") + ".ilegible";
            try { File.Move(_archivo, apartado); }
            catch (IOException mover) { LogBus.Log("aprendido", $"no pude apartar el archivo ilegible: {mover.Message}"); return new Documento(); }
            LogBus.Log("aprendido", $"el archivo de lo aprendido no se pudo leer ({e.Message}); quedó apartado en «{apartado}»");
            return new Documento();
        }
    }

    private void Guardar(Documento doc)
    {
        string? carpeta = Path.GetDirectoryName(_archivo);
        if (!string.IsNullOrWhiteSpace(carpeta)) Directory.CreateDirectory(carpeta);
        string temporal = _archivo + "." + Guid.NewGuid().ToString("N") + ".tmp";
        File.WriteAllText(temporal, JsonSerializer.Serialize(doc, Json));
        File.Move(temporal, _archivo, overwrite: true);
    }
}
