using System.Globalization;
using System.IO;
using System.Text.Json;
using U.Graph;
using U.WindowsClient.Diagnostics;
using U.WindowsClient.Navigation;
using U.WindowsClient.Teach;
using U.WindowsClient.Uia;
using U.WindowsClient.Voice;

namespace U.WindowsClient.Memoria;

/// <summary>Cómo quedó la lectura de un almacén. Las tres se pintan distinto, y esa es la gracia.</summary>
public enum EstadoDelApartado
{
    /// <summary>Hay algo guardado y se pudo leer.</summary>
    ConDatos,

    /// <summary>Se miró y no hay nada: Ü todavía no ha guardado nada de esto.</summary>
    Vacio,

    /// <summary>Hay algo guardado y NO se pudo leer. No es «vacío», y no se enseña como vacío.</summary>
    NoSePudoLeer,
}

/// <summary>Una cosa guardada, dicha para leerla: lo que es, y debajo de quién o de cuándo.</summary>
public sealed record Entrada(string Texto, string Detalle = "");

/// <summary>Un apartado de la Memoria: un almacén, contado.</summary>
/// <param name="Cuenta">Cuántas cosas hay guardadas, aunque <paramref name="Entradas"/> las agrupe.</param>
public sealed record Apartado(string Clave, string Titulo, string Resumen, EstadoDelApartado Estado,
    int Cuenta, IReadOnlyList<Entrada> Entradas);

/// <summary>Dónde está en disco cada cosa que Ü guarda de la persona.</summary>
public sealed record Fuentes(string UserId, string Config, string Memoria, string Conversacion, string Aprendido, string Skills,
    string Lecciones, string Fotos, string TitulosWeb, string Collar, string NombresDeDispositivos,
    string Logs, bool ElRegistroSeCopia)
{
    /// <summary>
    /// Las de ESTA app, preguntándole a cada almacén dónde escribe en vez de recomponer su ruta aquí.
    /// </summary>
    /// <remarks>
    /// Recomponer las rutas aquí sería tener dos opiniones sobre el mismo hecho (aprendizaje nº16), y
    /// ya se vio moverse: el 2026-09-30, mientras esta ventana se escribía, la memoria, la
    /// conversación, el álbum y el collar pasaron de escribir siempre en el perfil real a seguir a
    /// <see cref="UserPaths"/>. Preguntándole a cada almacén, la Memoria se mudó con ellos sin tocarse.
    /// </remarks>
    public static Fuentes DeLaApp(string userId, bool elRegistroSeCopia) => new(
        Limpio(userId), U.WindowsClient.Config.Archivo, MemoriaPersonal.ArchivoPorDefecto,
        ConversacionPersonal.ArchivoPorDefecto, LoAprendido.ArchivoPorDefecto, SkillEnsenada.CarpetaPorDefecto, LeccionEnDisco.CarpetaRaiz,
        FotosDeLosRecuerdos.Carpeta, PestanasAbiertas.Archivo,
        CollarPermanente.Archivo, U.WindowsClient.Voice.NombresDeDispositivos.Archivo, LogBus.Carpeta, elRegistroSeCopia);

    /// <summary>Las mismas, colgando de dos carpetas dadas. Es por donde el contrato las juzga.</summary>
    public static Fuentes EnCarpetas(string roaming, string local, string userId)
    {
        string r = Path.Combine(roaming, "U"), l = Path.Combine(local, "U");
        return new(Limpio(userId), Path.Combine(r, "config.json"), Path.Combine(r, "memoria-personal.json"),
            Path.Combine(r, "conversacion-personal.json"), Path.Combine(r, "aprendido.json"), Path.Combine(l, "skills"),
            Path.Combine(l, "lecciones"),
            Path.Combine(l, "recuerdos", "fotos"),
            Path.Combine(l, "titulos-web.json"), Path.Combine(l, "collar.json"),
            Path.Combine(l, "nombres-de-dispositivos.json"), Path.Combine(l, "logs"), ElRegistroSeCopia: true);
    }

    /// <summary>La misma regla que usan los almacenes: sin identidad, la persona es «anon».</summary>
    private static string Limpio(string userId) => string.IsNullOrWhiteSpace(userId) ? "anon" : userId.Trim();
}

/// <summary>
/// TODO LO QUE Ü GUARDA DE LA PERSONA, contado para leerlo. Es lo que pinta la ventana de la Memoria
/// (spec 071), y no decide nada más: no escribe, no borra, no corrige.
/// </summary>
/// <remarks>
/// EL PLAN ES EL DENOMINADOR (promesa 622). Los doce apartados salen siempre, haya algo o no: uno que
/// desapareciera al estar vacío no se distinguiría de uno que nadie escribió, y «esto es todo lo que
/// sé de ti» pasaría a ser cierto solo de lo que se acordó de enseñar (aprendizaje nº10).
///
/// LEE LOS ARCHIVOS ELLA MISMA, y no por las clases que los escriben, por dos razones medidas:
///
///   · Esas clases convierten «no pude leerlo» en «vacío»: <c>MemoriaPersonal.Leer</c> y
///     <c>ConversacionPersonal.Leer</c> devuelven un documento nuevo ante un JSON roto. Aquí eso es
///     justo lo que no puede pasar (promesa 623): un archivo dañado se enseñaría como «todavía no
///     sé nada de ti».
///   · Leer por la puerta de la voz ESCRIBE: <c>ContextoAsync</c> y <c>Pendientes</c> convierten en
///     recordatorio un dato viejo que dice una hora y reescriben el archivo. Mirar no puede cambiar
///     lo mirado (promesa 626).
///
/// El precio es que el formato de cada almacén vive en dos sitios. Lo que impide que se separen es
/// el contrato, que escribe por las clases dueñas y lee por aquí.
///
/// NADA DE AQUÍ ENSEÑA LO SECRETO (promesa 625): de <c>config.json</c> salen el nombre y el correo, y
/// la clave del cliente y el id de instalación, que viven en el mismo archivo, no se leen.
/// </remarks>
public static class LoQueUSabe
{
    /// <summary>Los apartados, en el orden en que se leen: de la persona hacia fuera.</summary>
    public static readonly IReadOnlyList<string> Plan = new[]
    {
        "quien", "datos", "preferencias", "recordatorios", "conversacion", "habilidades", "lecciones",
        "sitios", "explicado", "aparatos", "registro", "fuera",
    };

    public static IReadOnlyList<Apartado> Leer(Fuentes f, DateTimeOffset ahora)
    {
        // El archivo de la memoria alimenta dos apartados: se lee UNA vez, para que los dos digan lo
        // mismo de él aunque alguien lo esté reescribiendo en ese instante.
        using var memoria = Json(f.Memoria);
        // Y el de lo aprendido (spec 074), otros dos: las preferencias y las habilidades enseñadas hablando.
        using var aprendido = Json(f.Aprendido);
        return new[]
        {
            Quien(f),
            Datos(memoria, f.UserId, ahora),
            Preferencias(aprendido, ahora),
            Recordatorios(memoria, f.UserId, ahora),
            Conversacion(f, ahora),
            Habilidades(f, aprendido),
            Lecciones(f, ahora),
            Sitios(f),
            Explicado(f, ahora),
            Aparatos(f),
            Registro(f, ahora),
            Fuera(f),
        };
    }

    // ── los apartados ────────────────────────────────────────────────────────────────────────────

    private static Apartado Quien(Fuentes f)
    {
        const string clave = "quien", titulo = "Quién eres";
        using var leido = Json(f.Config);
        if (leido.Como == Como.NoHay) return Vacio(clave, titulo, "Todavía no sé cómo te llamas.");
        if (leido.Doc == null) return NoPude(clave, titulo, leido.Como);
        if (leido.Doc.RootElement.ValueKind != JsonValueKind.Object) return NoPude(clave, titulo, Como.Danado);

        var entradas = new List<Entrada>();
        string nombre = Texto(leido.Doc.RootElement, "DisplayName"), correo = Texto(leido.Doc.RootElement, "Email");
        if (nombre.Length > 0) entradas.Add(new Entrada(nombre, "Así te llamo"));
        if (correo.Length > 0) entradas.Add(new Entrada(correo, "Tu correo. Con él te reconozco en este computador y en el servidor"));
        return entradas.Count == 0
            ? Vacio(clave, titulo, "Todavía no sé cómo te llamas.")
            : new Apartado(clave, titulo, "Tu nombre y tu correo, que me diste al empezar.", EstadoDelApartado.ConDatos,
                entradas.Count, entradas);
    }

    private static Apartado Datos(Lectura memoria, string userId, DateTimeOffset ahora)
    {
        const string clave = "datos", titulo = "Lo que me has contado";
        const string nada = "Todavía no me has pedido recordar nada.";
        if (memoria.Como == Como.NoHay) return Vacio(clave, titulo, nada);
        if (!Items(memoria, userId, out var items)) return NoPude(clave, titulo, memoria.Doc == null ? memoria.Como : Como.Danado);

        var entradas = items.Where(i => i.Avisa == null)
            .OrderByDescending(i => i.Creado)
            .Select(i => new Entrada(i.Texto, "Me lo dijiste " + Fechas.Dicha(i.Creado, ahora)))
            .ToList();
        return entradas.Count == 0
            ? Vacio(clave, titulo, nada)
            : new Apartado(clave, titulo, Cuantas(entradas.Count, "cosa que me pediste recordar", "cosas que me pediste recordar")
                + " Las tengo presentes cada vez que hablamos.", EstadoDelApartado.ConDatos, entradas.Count, entradas);
    }

    /// <summary>
    /// Cómo quiere las cosas (spec 074, promesa 715). Lo escribe <c>LoAprendido</c>; aquí se lee el archivo
    /// sin pasar por él, porque él APARTA un archivo ilegible —lo mueve—, y mirar no puede cambiar lo mirado (626).
    /// </summary>
    private static Apartado Preferencias(Lectura aprendido, DateTimeOffset ahora)
    {
        const string clave = "preferencias", titulo = "Cómo quieres las cosas";
        const string nada = "Todavía no me has dicho cómo prefieres las cosas.";
        if (aprendido.Como == Como.NoHay) return Vacio(clave, titulo, nada);
        if (aprendido.Doc == null) return NoPude(clave, titulo, aprendido.Como);
        if (aprendido.Doc.RootElement.ValueKind != JsonValueKind.Object) return NoPude(clave, titulo, Como.Danado);
        // Un archivo que solo tiene habilidades no trae la lista, y eso no es estar dañado.
        Lista(aprendido.Doc.RootElement, "preferencias", out var guardadas);

        var entradas = guardadas.Where(p => Texto(p, "texto").Length > 0)
            .OrderByDescending(p => Fecha(p, "actualizada"))
            .Select(p => new Entrada(Texto(p, "texto"), "Me lo dijiste " + Fechas.Dicha(Fecha(p, "actualizada"), ahora)))
            .ToList();
        return entradas.Count == 0
            ? Vacio(clave, titulo, nada)
            : new Apartado(clave, titulo, Cuantas(entradas.Count, "preferencia tuya", "preferencias tuyas")
                + " Las cumplo sin que me las repitas, al hablar y al trabajar.", EstadoDelApartado.ConDatos, entradas.Count, entradas);
    }

    private static Apartado Recordatorios(Lectura memoria, string userId, DateTimeOffset ahora)
    {
        const string clave = "recordatorios", titulo = "Recordatorios";
        const string nada = "Todavía no me has pedido que te avise de nada.";
        if (memoria.Como == Como.NoHay) return Vacio(clave, titulo, nada);
        if (!Items(memoria, userId, out var items)) return NoPude(clave, titulo, memoria.Doc == null ? memoria.Como : Como.Danado);

        var avisos = items.Where(i => i.Avisa != null).ToList();
        if (avisos.Count == 0) return Vacio(clave, titulo, nada);

        // Primero lo que falta por avisar, por orden de llegada; después lo ya avisado, de lo último a lo primero.
        var pendientes = avisos.Where(i => !i.Avisado).OrderBy(i => i.Avisa).ToList();
        var hechos = avisos.Where(i => i.Avisado).OrderByDescending(i => i.Avisa).ToList();
        var entradas = pendientes.Select(i => new Entrada(i.Texto,
                (i.Avisa <= ahora ? "Tenía que avisarte " : "Te aviso ") + Fechas.Dicha(i.Avisa!.Value, ahora)))
            .Concat(hechos.Select(i => new Entrada(i.Texto, "Ya te avisé " + Fechas.Dicha(i.Avisa!.Value, ahora))))
            .ToList();
        string resumen = Cuantas(avisos.Count, "recordatorio", "recordatorios") + (
            pendientes.Count == 0 ? " Ya te avisé de todos."
            : hechos.Count == 0 ? " Todavía no te he avisado de ninguno."
            : $" {Numero(pendientes.Count)} por avisar y {Numero(hechos.Count)} ya avisados.");
        return new Apartado(clave, titulo, resumen, EstadoDelApartado.ConDatos, avisos.Count, entradas);
    }

    private static Apartado Conversacion(Fuentes f, DateTimeOffset ahora)
    {
        const string clave = "conversacion", titulo = "Lo que hemos hablado";
        const string nada = "Todavía no hemos hablado.";
        using var leido = Json(f.Conversacion);
        if (leido.Como == Como.NoHay) return Vacio(clave, titulo, nada);
        if (leido.Doc == null) return NoPude(clave, titulo, leido.Como);
        if (!Lista(leido.Doc.RootElement, "turnos", out var turnos)) return NoPude(clave, titulo, Como.Danado);

        var mios = turnos.Where(t => Texto(t, "userId") == f.UserId)
            .Select(t => (Rol: Texto(t, "role"), Dicho: Texto(t, "text"), Cuando: Fecha(t, "createdAt")))
            .Where(t => t.Dicho.Length > 0)
            .OrderByDescending(t => t.Cuando)
            .ToList();
        if (mios.Count == 0) return Vacio(clave, titulo, nada);

        var entradas = mios.Select(t => new Entrada(t.Dicho,
            (t.Rol == "usuario" ? "Tú" : "Ü") + " · " + Fechas.Dicha(t.Cuando, ahora))).ToList();
        string resumen = Cuantas(mios.Count, "mensaje entre tú y yo", "mensajes entre tú y yo")
            + " Los uso para seguir la conversación donde la dejamos, y solo guardo los últimos.";
        return new Apartado(clave, titulo, resumen, EstadoDelApartado.ConDatos, mios.Count, entradas);
    }

    private static Apartado Habilidades(Fuentes f, Lectura aprendido)
    {
        const string clave = "habilidades", titulo = "Lo que me has enseñado a hacer";
        const string nada = "Todavía no me has enseñado ninguna tarea.";
        if (!Archivos(f.Skills, "*.skill.json", SearchOption.TopDirectoryOnly, out var archivos, out var como))
            return NoPude(clave, titulo, como);

        var entradas = new List<Entrada>();
        int rotas = 0;

        // LAS ENSEÑADAS HABLANDO (spec 074), con las demás: para la persona son lo mismo —algo que Ü sabe hacer
        // porque ella se lo enseñó—, vengan de una demostración o de una frase.
        // Y si ese archivo no se pudo leer, se dice POR QUÉ, aparte: «ocupado» no es «dañado» (aprendizaje nº2).
        Como? noHabladas = null;
        if (aprendido.Como != Como.NoHay)
        {
            if (aprendido.Doc?.RootElement.ValueKind != JsonValueKind.Object)
                noHabladas = aprendido.Doc == null ? aprendido.Como : Como.Danado;
            else if (Lista(aprendido.Doc.RootElement, "habilidades", out var habladas))
                foreach (var h in habladas)
                {
                    string nombre = Texto(h, "nombre");
                    if (nombre.Length == 0) { rotas++; continue; }
                    string cuando = Texto(h, "cuando");
                    int pasos = Lista(h, "pasos", out var lista) ? lista.Count : 0;
                    entradas.Add(new Entrada(nombre, (cuando.Length > 0 ? Mayuscula(cuando).TrimEnd('.') + ". " : "")
                        + $"{Numero(pasos)} {(pasos == 1 ? "paso" : "pasos")}. Me la enseñaste hablando."));
                }
        }

        foreach (string archivo in archivos)
        {
            using var leido = Json(archivo);
            string nombre = leido.Doc?.RootElement.ValueKind == JsonValueKind.Object ? Texto(leido.Doc.RootElement, "Nombre") : "";
            if (nombre.Length == 0) { rotas++; continue; }
            string paraQue = Texto(leido.Doc!.RootElement, "Description");
            bool repasada = leido.Doc.RootElement.TryGetProperty("Comprobada", out var c) && c.ValueKind == JsonValueKind.True;
            entradas.Add(new Entrada(nombre, (paraQue.Length > 0 ? paraQue.TrimEnd('.') + ". " : "")
                + (repasada ? "Ya la repasamos juntos." : "Falta repasarla contigo antes de usarla por mi cuenta.")));
        }
        string noLeidas = (rotas == 0 ? "" : $" No pude leer {Numero(rotas)} más: lo guardado está dañado.")
            + (noHabladas is { } porQue ? $" No pude leer las que me enseñaste hablando: {Motivo(porQue)}." : "");
        if (entradas.Count == 0)
            return noHabladas is { } motivo ? NoPude(clave, titulo, motivo)
                : rotas == 0 ? Vacio(clave, titulo, nada) : NoPude(clave, titulo, Como.Danado);
        entradas.Sort((a, b) => string.Compare(a.Texto, b.Texto, StringComparison.CurrentCultureIgnoreCase));
        return new Apartado(clave, titulo, Cuantas(entradas.Count, "tarea que sé hacer porque me la enseñaste",
            "tareas que sé hacer porque me las enseñaste") + noLeidas, EstadoDelApartado.ConDatos, entradas.Count, entradas);
    }

    private static Apartado Lecciones(Fuentes f, DateTimeOffset ahora)
    {
        const string clave = "lecciones", titulo = "Las veces que me enseñaste";
        const string nada = "Todavía no me has enseñado nada haciéndolo en pantalla.";
        if (!Archivos(f.Lecciones, "leccion.json", SearchOption.AllDirectories, out var archivos, out var como))
            return NoPude(clave, titulo, como);

        var lecciones = new List<(DateTimeOffset Cuando, Entrada Entrada)>();
        int rotas = 0;
        foreach (string archivo in archivos)
        {
            using var leido = Json(archivo);
            if (leido.Doc?.RootElement.ValueKind != JsonValueKind.Object) { rotas++; continue; }
            var raiz = leido.Doc.RootElement;
            long ms = raiz.TryGetProperty("DuracionMs", out var d) && d.TryGetInt64(out long v) ? v : 0;
            string donde = NombresDeSitios.De(Texto(raiz, "Empezo"));
            var cuando = new DateTimeOffset(File.GetLastWriteTimeUtc(archivo), TimeSpan.Zero);
            lecciones.Add((cuando, new Entrada(
                "Una demostración" + (ms > 0 ? " de " + Duracion(ms) : "") + (donde.Length > 0 ? " en " + donde : ""),
                Mayuscula(Fechas.Dicha(cuando, ahora)))));
        }
        string noLeidas = rotas == 0 ? "" : $" No pude leer {Numero(rotas)} más: lo guardado está dañado.";
        if (lecciones.Count == 0)
            return rotas == 0 ? Vacio(clave, titulo, nada) : NoPude(clave, titulo, Como.Danado);
        var entradas = lecciones.OrderByDescending(l => l.Cuando).Select(l => l.Entrada).ToList();
        return new Apartado(clave, titulo, Cuantas(entradas.Count, "demostración tuya", "demostraciones tuyas")
            + " De cada una guardo el video de tu pantalla, lo que tocaste y lo que dijiste mientras tanto." + noLeidas,
            EstadoDelApartado.ConDatos, entradas.Count, entradas);
    }

    // AQUÍ ESTABA EL APARTADO «Lo que he visto en tu pantalla», que contaba las fotos del álbum de miradas. El álbum
    // se fue con la spec 078 (promesa 746): Ü ya no guarda una foto de cada sitio por el que pasa.

    private static Apartado Sitios(Fuentes f)
    {
        const string clave = "sitios", titulo = "Las páginas web que has abierto";
        const string nada = "Todavía no he apuntado ninguna página web.";
        using var leido = Json(f.TitulosWeb);
        if (leido.Como == Como.NoHay) return Vacio(clave, titulo, nada);
        if (leido.Doc == null) return NoPude(clave, titulo, leido.Como);
        if (leido.Doc.RootElement.ValueKind != JsonValueKind.Object) return NoPude(clave, titulo, Como.Danado);

        var entradas = leido.Doc.RootElement.EnumerateObject()
            .Select(d => (Sitio: d.Name, Titulos: Lista(d.Value, "Titulos", out var t)
                ? t.Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString() ?? "").Where(x => x.Length > 0).ToList()
                : new List<string>()))
            .OrderByDescending(d => d.Titulos.Count).ThenBy(d => d.Sitio, StringComparer.OrdinalIgnoreCase)
            // Los últimos títulos son los más recientes: se enseñan tres, del más nuevo al más viejo.
            .Select(d => new Entrada(d.Sitio, string.Join(" · ", d.Titulos.AsEnumerable().Reverse().Take(3))))
            .ToList();
        return entradas.Count == 0
            ? Vacio(clave, titulo, nada)
            : new Apartado(clave, titulo, Cuantas(entradas.Count, "sitio web", "sitios web").TrimEnd('.')
                + ", con los títulos de sus últimas páginas. Los apunto para poder volver a una pestaña cuando me la pidas por su nombre.",
                EstadoDelApartado.ConDatos, entradas.Count, entradas);
    }

    private static Apartado Explicado(Fuentes f, DateTimeOffset ahora)
    {
        const string clave = "explicado", titulo = "Lo que sé de las cosas de tu pantalla";
        const string nada = "Todavía no tengo apuntado para qué sirve nada de tu pantalla.";
        if (!Archivos(f.Fotos, "*.jpg", SearchOption.TopDirectoryOnly, out var archivos, out var como))
            return NoPude(clave, titulo, como);
        if (archivos.Count == 0) return Vacio(clave, titulo, nada);

        var entradas = archivos
            .Select(a => (Nombre: Path.GetFileNameWithoutExtension(a), Archivo: a))
            .Select(a =>
            {
                // El nombre lo pone FotosDeLosRecuerdos: «AAAAMMDD-HHmmss-lo-que-era». La fecha sale de ahí,
                // y si un archivo no la trae, de cuándo se escribió.
                var cuando = new DateTimeOffset(File.GetLastWriteTimeUtc(a.Archivo), TimeSpan.Zero);
                string que = a.Nombre;
                if (a.Nombre.Length > 16 && DateTime.TryParseExact(a.Nombre[..15], "yyyyMMdd-HHmmss",
                        CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var dia))
                {
                    cuando = new DateTimeOffset(dia);
                    que = a.Nombre[16..];
                }
                que = que.Replace('-', ' ').Trim();
                return (Cuando: cuando, Que: que.Length > 0 ? Mayuscula(que) : "Algo de la pantalla");
            })
            .OrderByDescending(x => x.Cuando)
            .Select(x => new Entrada(x.Que, Mayuscula(Fechas.Dicha(x.Cuando, ahora))))
            .ToList();
        // QUIÉN LO APUNTÓ NO SE DICE, porque no se sabe: la foto se guarda cuando «esto es…» prospera, y eso
        // lo pide la persona señalando y también Ü mientras trabaja. Decir «me lo explicaste» de las 118
        // sería afirmar una causa que este archivo no distingue (aprendizaje nº2).
        return new Apartado(clave, titulo, Cuantas(entradas.Count, "botón, campo o enlace del que tengo apuntado para qué sirve",
            "botones, campos y enlaces de los que tengo apuntado para qué sirven").TrimEnd('.')
            + ", porque me lo explicaste o porque lo aprendí trabajando. De cada uno guardo una foto de la ventana donde estaba.",
            EstadoDelApartado.ConDatos, entradas.Count, entradas);
    }

    private static Apartado Aparatos(Fuentes f)
    {
        const string clave = "aparatos", titulo = "Tus aparatos";
        var entradas = new List<Entrada>();
        var noLeidos = new List<string>();

        using (var collar = Json(f.Collar))
        {
            if (collar.Doc?.RootElement.ValueKind == JsonValueKind.Object)
            {
                bool enlazado = Verdad(collar.Doc.RootElement, "enlazado"), permanente = Verdad(collar.Doc.RootElement, "permanente");
                if (enlazado)
                    entradas.Add(new Entrada("El collar Omi", permanente
                        ? "Lo conozco y me conecto a él por mi cuenta cada vez que lo encuentro"
                        : "Lo conozco, pero no me conecto a él hasta que me lo pidas"));
                else if (permanente)
                    entradas.Add(new Entrada("El collar Omi", "Me pediste usarlo y lo sigo buscando: todavía no se ha conectado nunca"));
            }
            else if (collar.Como != Como.NoHay) noLeidos.Add("lo del collar: " + Motivo(collar.Doc == null ? collar.Como : Como.Danado));
        }

        using (var nombres = Json(f.NombresDeDispositivos))
        {
            if (nombres.Doc?.RootElement.ValueKind == JsonValueKind.Object)
                entradas.AddRange(nombres.Doc.RootElement.EnumerateObject()
                    .Where(n => n.Value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(n.Value.GetString()))
                    .Select(n => new Entrada(n.Value.GetString()!.Trim(), "Un micrófono al que le pusiste ese nombre")));
            else if (nombres.Como != Como.NoHay)
                noLeidos.Add("los nombres de tus micrófonos: " + Motivo(nombres.Doc == null ? nombres.Como : Como.Danado));
        }

        string aviso = noLeidos.Count == 0 ? "" : " No pude leer " + string.Join(", ni ", noLeidos) + ".";
        if (entradas.Count > 0)
            return new Apartado(clave, titulo, Cuantas(entradas.Count, "aparato que reconozco", "aparatos que reconozco") + aviso,
                EstadoDelApartado.ConDatos, entradas.Count, entradas);
        return noLeidos.Count > 0
            ? new Apartado(clave, titulo, aviso.Trim(), EstadoDelApartado.NoSePudoLeer, 0, Array.Empty<Entrada>())
            : Vacio(clave, titulo, "Todavía no conozco ningún aparato tuyo.");
    }

    private static Apartado Registro(Fuentes f, DateTimeOffset ahora)
    {
        const string clave = "registro", titulo = "El diario de lo que hago";
        const string nada = "Todavía no he apuntado nada.";
        if (!Archivos(f.Logs, "u-*.log", SearchOption.TopDirectoryOnly, out var archivos, out var como))
            return NoPude(clave, titulo, como);

        // Los archivos se llaman «u-AAAAMMDD…»: de ahí salen los DÍAS, que es lo que una persona cuenta.
        var dias = archivos.Select(a => Path.GetFileName(a))
            .Where(n => n.Length >= 10)
            .Select(n => DateTime.TryParseExact(n.Substring(2, 8), "yyyyMMdd", CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeLocal, out var d) ? d : (DateTime?)null)
            .Where(d => d != null).Select(d => d!.Value).Distinct().OrderBy(d => d).ToList();
        if (dias.Count == 0) return Vacio(clave, titulo, nada);

        var entradas = new List<Entrada>
        {
            new("Qué apunto", "Cada cosa que hago y a qué hora: qué abrí, qué pulsé, qué escribí, lo que hablamos y qué falló"),
            new("Para qué", "Para poder averiguar qué pasó cuando algo sale mal"),
            new("Desde cuándo", Mayuscula(Fechas.Dia(new DateTimeOffset(dias[0]), ahora))
                + (dias.Count > 1 ? " hasta " + Fechas.Dia(new DateTimeOffset(dias[^1]), ahora) : "")),
        };
        return new Apartado(clave, titulo, Cuantas(dias.Count, "día apuntado", "días apuntados"),
            EstadoDelApartado.ConDatos, dias.Count, entradas);
    }

    /// <summary>
    /// Lo que NO está en este computador. No se lee de ningún sitio: es lo que el código hace, dicho.
    /// </summary>
    /// <remarks>
    /// Cada frase tiene detrás una línea que se puede ir a mirar (2026-09-30): el diario lo copia
    /// <c>Telemetry.EspejoDelLog</c> y el registro manda correo, nombre, equipo y versión de Windows
    /// (<c>TelemetryClient.RegisterAsync</c>); los workflows se piden a Graph
    /// (<c>GraphClient.ListWorkflowsAsync</c>); y la voz abre un socket con el servicio de voz
    /// (<c>ProtocoloGptLive.Direccion</c>). Si alguna de esas cambia, esta frase cambia con ella.
    /// No se enumera lo que hay allí: hoy ninguna puerta lo devuelve por persona.
    /// </remarks>
    private static Apartado Fuera(Fuentes f)
    {
        var entradas = new List<Entrada>
        {
            new("El diario de lo que hago", f.ElRegistroSeCopia
                ? "Se copia al servidor de Ü mientras trabajo, junto con tu nombre, tu correo, el nombre de este computador y su versión de Windows. Sirve para darte soporte sin estar delante"
                : "Ahora mismo no se está copiando al servidor de Ü: todavía no me has dado tu correo"),
            new("Las tareas paso a paso que me enseñaste", "Se guardan en el servidor de Ü, no aquí. Por eso las tienes en cualquier computador donde entres"),
            new("Tu voz y mis respuestas", "Mientras hablamos pasan por un servicio de voz en la nube, que es quien me deja oírte y contestarte"),
        };
        return new Apartado("fuera", "Lo que sale de este computador",
            "Casi todo lo de arriba vive solo aquí. Esto es lo que no.", EstadoDelApartado.ConDatos, entradas.Count, entradas);
    }

    // ── leer sin tocar ───────────────────────────────────────────────────────────────────────────

    /// <summary>Qué pasó al leer un archivo. Cada causa se dice distinto (aprendizaje nº2).</summary>
    private enum Como { NoHay, Leido, Danado, Ocupado, SinPermiso }

    private sealed record Lectura(Como Como, JsonDocument? Doc) : IDisposable
    {
        public void Dispose() => Doc?.Dispose();
    }

    /// <summary>
    /// Abre SOLO PARA LEER y dejando escribir a los demás: la app sigue guardando mientras la Memoria
    /// está abierta, y una ventana de consulta no puede ser quien le niegue el archivo a la voz.
    /// </summary>
    private static Lectura Json(string archivo)
    {
        if (!File.Exists(archivo)) return new Lectura(Como.NoHay, null);
        try
        {
            using var flujo = new FileStream(archivo, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            return new Lectura(Como.Leido, JsonDocument.Parse(flujo));
        }
        catch (JsonException) { return new Lectura(Como.Danado, null); }
        catch (UnauthorizedAccessException) { return new Lectura(Como.SinPermiso, null); }
        catch (IOException) { return new Lectura(Como.Ocupado, null); }
    }

    private static bool Archivos(string carpeta, string patron, SearchOption donde, out List<string> archivos, out Como como)
    {
        archivos = new List<string>();
        como = Como.NoHay;
        if (!Directory.Exists(carpeta)) return true;
        try
        {
            archivos = Directory.EnumerateFiles(carpeta, patron, donde).ToList();
            return true;
        }
        catch (UnauthorizedAccessException) { como = Como.SinPermiso; return false; }
        catch (IOException) { como = Como.Ocupado; return false; }
    }

    private readonly record struct Item(string Texto, DateTimeOffset Creado, DateTimeOffset? Avisa, bool Avisado);

    /// <summary>Lo que la memoria guarda de ESTA persona. Falso si el archivo no tiene la forma esperada.</summary>
    private static bool Items(Lectura memoria, string userId, out List<Item> items)
    {
        items = new List<Item>();
        if (memoria.Doc == null || !Lista(memoria.Doc.RootElement, "items", out var todos)) return false;
        foreach (var x in todos)
        {
            if (x.ValueKind != JsonValueKind.Object || Texto(x, "userId") != userId) continue;
            string texto = Texto(x, "text");
            if (texto.Length == 0) continue;
            DateTimeOffset? avisa = x.TryGetProperty("dueAt", out var d) && d.ValueKind == JsonValueKind.String
                && d.TryGetDateTimeOffset(out var cuando) ? cuando : null;
            items.Add(new Item(texto, Fecha(x, "createdAt"), avisa, Verdad(x, "delivered")));
        }
        return true;
    }

    private static bool Lista(JsonElement padre, string nombre, out List<JsonElement> lista)
    {
        lista = new List<JsonElement>();
        if (padre.ValueKind != JsonValueKind.Object || !padre.TryGetProperty(nombre, out var x) || x.ValueKind != JsonValueKind.Array)
            return false;
        lista = x.EnumerateArray().ToList();
        return true;
    }

    /// <summary>Vacío no es ausente (patrón nº9): un campo que falta, uno nulo y uno en blanco dan lo mismo.</summary>
    private static string Texto(JsonElement padre, string nombre) =>
        padre.ValueKind == JsonValueKind.Object && padre.TryGetProperty(nombre, out var x) && x.ValueKind == JsonValueKind.String
            ? (x.GetString() ?? "").Trim() : "";

    private static bool Verdad(JsonElement padre, string nombre) =>
        padre.TryGetProperty(nombre, out var x) && x.ValueKind == JsonValueKind.True;

    private static DateTimeOffset Fecha(JsonElement padre, string nombre) =>
        padre.TryGetProperty(nombre, out var x) && x.ValueKind == JsonValueKind.String && x.TryGetDateTimeOffset(out var d)
            ? d : DateTimeOffset.MinValue;

    // ── decirlo ──────────────────────────────────────────────────────────────────────────────────

    private static Apartado Vacio(string clave, string titulo, string nada) =>
        new(clave, titulo, nada, EstadoDelApartado.Vacio, 0, Array.Empty<Entrada>());

    private static Apartado NoPude(string clave, string titulo, Como como) =>
        new(clave, titulo, "No pude leer esto: " + Motivo(como) + ".", EstadoDelApartado.NoSePudoLeer, 0, Array.Empty<Entrada>());

    private static string Motivo(Como como) => como switch
    {
        Como.Ocupado => "otro programa lo tiene ocupado ahora mismo; vuelve a abrir la Memoria en un momento",
        Como.SinPermiso => "Windows no me dejó abrirlo",
        _ => "lo guardado está dañado",
    };

    private static readonly CultureInfo Castellano = CultureInfo.GetCultureInfo("es-CO");

    private static string Numero(int n) => n.ToString("N0", Castellano);

    /// <summary>«1 cosa…» o «12 cosas…», con su punto.</summary>
    private static string Cuantas(int n, string una, string varias) => $"{Numero(n)} {(n == 1 ? una : varias)}.";

    private static string Mayuscula(string s) => s.Length == 0 ? s : char.ToUpper(s[0], Castellano) + s[1..];

    private static string Duracion(long ms)
    {
        long segundos = Math.Max(1, ms / 1000);
        if (segundos < 60) return segundos == 1 ? "un segundo" : $"{segundos} segundos";
        long minutos = (segundos + 30) / 60;
        return minutos == 1 ? "un minuto" : $"{minutos} minutos";
    }
}

/// <summary>Una fecha dicha como la diría alguien: «hoy a las 9:05», «ayer», «el 24 de septiembre».</summary>
public static class Fechas
{
    private static readonly string[] Meses =
    {
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    };

    /// <summary>Con la hora cuando el día está cerca, que es cuando la hora importa.</summary>
    public static string Dicha(DateTimeOffset cuando, DateTimeOffset ahora)
    {
        if (cuando == DateTimeOffset.MinValue) return "no sé cuándo";
        var local = cuando.ToOffset(ahora.Offset);
        string hora = $"{(local.Hour == 1 ? "a la" : "a las")} {local.Hour}:{local.Minute:00}";
        return (local.Date - ahora.Date).Days switch
        {
            0 => "hoy " + hora,
            -1 => "ayer " + hora,
            1 => "mañana " + hora,
            _ => Dia(cuando, ahora),
        };
    }

    /// <summary>Solo el día. El año se dice cuando no es el de ahora.</summary>
    public static string Dia(DateTimeOffset cuando, DateTimeOffset ahora)
    {
        if (cuando == DateTimeOffset.MinValue) return "no sé cuándo";
        var local = cuando.ToOffset(ahora.Offset);
        return (local.Date - ahora.Date).Days switch
        {
            0 => "hoy",
            -1 => "ayer",
            1 => "mañana",
            _ => $"el {local.Day} de {Meses[local.Month - 1]}" + (local.Year == ahora.Year ? "" : $" de {local.Year}"),
        };
    }
}

/// <summary>
/// CÓMO SE LLAMA UN SITIO PARA UNA PERSONA. Ü los guarda como direcciones internas
/// («uia://Notepad.exe/sin-título», «web://google.com/search»); aquí se dicen «Bloc de notas» y
/// «google.com» (promesa 624).
/// </summary>
internal static class NombresDeSitios
{
    /// <summary>Los que tienen un nombre que no se deduce del de su proceso. El resto se deduce.</summary>
    private static readonly Dictionary<string, string> Programas = new(StringComparer.OrdinalIgnoreCase)
    {
        ["notepad"] = "Bloc de notas", ["explorer"] = "Explorador de archivos", ["chrome"] = "Chrome",
        ["msedge"] = "Edge", ["firefox"] = "Firefox", ["systemsettings"] = "Configuración de Windows",
        ["applicationframehost"] = "Aplicaciones de Windows", ["calculatorapp"] = "Calculadora",
        ["saplogon"] = "SAP", ["winword"] = "Word", ["excel"] = "Excel", ["powerpnt"] = "PowerPoint",
        ["outlook"] = "Outlook", ["olk"] = "Outlook", ["code"] = "Visual Studio Code", ["chatgpt"] = "ChatGPT",
        ["u"] = "Ü", ["windowsterminal"] = "Terminal", ["searchhost"] = "Búsqueda de Windows",
        ["shellexperiencehost"] = "Windows", ["startmenuexperiencehost"] = "Menú Inicio", ["mspaint"] = "Paint",
        ["acrord32"] = "Adobe Reader", ["acrobat"] = "Adobe Acrobat", ["ms-teams"] = "Teams", ["teams"] = "Teams",
        ["whatsapp"] = "WhatsApp", ["whatsapp.root"] = "WhatsApp", ["omi-windows"] = "Omi", ["snippingtool"] = "Recortes",
    };

    public static string De(string ubicacion)
    {
        string u = (ubicacion ?? "").Trim();
        if (u.Length == 0) return "";
        int corte = u.IndexOf("://", StringComparison.Ordinal);
        string esquema = corte > 0 ? u[..corte].ToLowerInvariant() : "";
        string resto = corte > 0 ? u[(corte + 3)..] : u;
        int barra = resto.IndexOfAny(new[] { '/', '\\', '#', '?' });
        string anfitrion = (barra >= 0 ? resto[..barra] : resto).Trim();
        if (anfitrion.Length == 0) return "";

        if (esquema == "web")
            return anfitrion.StartsWith("www.", StringComparison.OrdinalIgnoreCase) ? anfitrion[4..] : anfitrion;
        if (esquema == "sap") return "SAP";

        string proceso = anfitrion.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) ? anfitrion[..^4] : anfitrion;
        if (Programas.TryGetValue(proceso, out var conocido)) return conocido;
        string limpio = proceso.Replace('-', ' ').Replace('_', ' ').Replace('.', ' ').Trim();
        return limpio.Length == 0 ? "" : char.ToUpperInvariant(limpio[0]) + limpio[1..];
    }
}
