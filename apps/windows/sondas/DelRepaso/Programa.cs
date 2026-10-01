using System.Diagnostics;
using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using U.WindowsClient.Diagnostics;
using U.WindowsClient.Voice;

// LA SONDA DEL REPASO (spec 074): ¿decide bien el modelo de verdad qué se aprende de una sesión?
//
//   sonda-del-repaso [--veces 2] [--solo "scholar"] [--a-la-vez 6] [--verboso] [--sin-fotos] [--salida <carpeta>]
//
// QUÉ HACE. Por cada sesión etiquetada de la batería: siembra lo que Ü ya sabía, escribe el diario de la
// sesión, y la repasa con ElRepaso —el de la app— contra gpt-6-luna. Después mira EL ALMACÉN, no lo que el
// modelo dijo que hizo: qué habilidades, preferencias, datos y observaciones quedaron. Cada caso trae sus
// decisiones esperadas, y el resultado es cuántas se acertaron sobre cuántas había (el denominador es la
// batería, no lo que el modelo quiso proponer).
//
// QUÉ MIDE, además: cuántas propuestas paró la compuerta de la cita —un modelo que parafrasea en vez de
// citar pierde la enseñanza aunque la haya entendido— y cuánto tarda un repaso.
//
// QUÉ NO HACE. No abre la voz, no toca la pantalla y no escribe en los datos de nadie: cada caso trabaja
// sobre un archivo temporal propio.
//
// LA CLAVE sale de OPENAI_API_KEY y no se escribe en ningún sitio.

internal sealed record Estado(
    IReadOnlyList<LoAprendido.Habilidad> Habilidades, IReadOnlyList<LoAprendido.Preferencia> Preferencias,
    IReadOnlyList<LoAprendido.Observacion> Observaciones, IReadOnlyList<string> Datos, ElRepaso.Informe Informe)
{
    /// <summary>Si alguna habilidad dice todo eso, en su nombre, su cuándo o sus pasos.</summary>
    public bool Habilidad(params string[] dice) => Habilidades.Any(h => Programa.Dice(h.Nombre + " " + h.Cuando + " " + string.Join(" ", h.Pasos), dice));
    public bool Preferencia(params string[] dice) => Preferencias.Any(p => Programa.Dice(p.Texto, dice));
    public bool Dato(params string[] dice) => Datos.Any(d => Programa.Dice(d, dice));
}

/// <param name="DatosYa">Lo que la memoria personal ya tenía guardado de la persona, como se lo da la app al repaso.</param>
internal sealed record Caso(string Nombre, bool Explicita, Action<LoAprendido> Antes, Action<DiarioDeLaSesion> Sesion,
    (string Que, Func<Estado, bool> Vale)[] Decisiones, string DatosYa = "");

internal static class Programa
{
    private static readonly HttpClient Red = new() { Timeout = TimeSpan.FromSeconds(120) };
    private static string _clave = "";

    /// <summary>El control del caso con fotos (spec 078): el mismo repaso, a ciegas. Dice cuánto de lo acertado es de VER.</summary>
    private static bool _sinFotos;

    /// <summary>Sin mayúsculas ni tildes: «Scholar» y «schólar» son lo mismo para juzgar.</summary>
    internal static bool Dice(string texto, params string[] trozos)
    {
        string t = Llano(texto);
        return trozos.All(x => t.Contains(Llano(x), StringComparison.Ordinal));
    }

    private static string Llano(string s)
        => new(s.ToLowerInvariant().Normalize(NormalizationForm.FormD)
            .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray());

    private static void Nada(LoAprendido _) { }

    private static readonly Caso[] Bateria =
    {
        new("enseña hablando: buscar artículos", true, Nada, d =>
        {
            d.Persona("te voy a enseñar a buscar artículos: abres Google Scholar, escribes el tema que te diga y pulsas Enter");
            d.U("Entendido.");
        }, new (string, Func<Estado, bool>)[]
        {
            ("queda UNA habilidad", e => e.Habilidades.Count == 1),
            ("que habla de Scholar", e => e.Habilidad("scholar")),
            ("con sus tres pasos", e => e.Habilidades.Any(h => h.Pasos.Count >= 3)),
            ("y ninguna preferencia", e => e.Preferencias.Count == 0),
        }),

        new("enseña hablando: «cuando te pida X, haz Y»", true, Nada, d =>
        {
            d.Persona("cuando te pida el reporte de ventas, abre Excel, abre el archivo ventas que está en Documentos y ve a la hoja Resumen");
            d.U("Vale.");
        }, new (string, Func<Estado, bool>)[]
        {
            ("queda UNA habilidad", e => e.Habilidades.Count == 1),
            ("que habla del reporte de ventas", e => e.Habilidad("ventas")),
            ("y de la hoja Resumen", e => e.Habilidad("resumen")),
            ("y ninguna preferencia", e => e.Preferencias.Count == 0),
        }),

        new("enseña MOSTRANDO: radicar una cuenta", true, Nada, d =>
        {
            d.Persona("mira, te voy a mostrar cómo se radica una cuenta, fíjate bien");
            d.U("Te sigo.");
            d.Toco("pulsó «Facturación» (TreeItem) en saplogon");
            d.Toco("pulsó «Radicar cuenta» (Button) en saplogon");
            d.Toco("pulsó «Urgencias Adultos» (ListItem) en saplogon");
            d.Toco("pulsó «Guardar» (Button) en saplogon");
            d.Persona("así es como se radica una cuenta, ¿viste?");
            d.U("Sí.");
        }, new (string, Func<Estado, bool>)[]
        {
            ("queda UNA habilidad", e => e.Habilidades.Count == 1),
            ("que habla de radicar", e => e.Habilidad("radic")),
            ("con lo que la persona pulsó: Urgencias Adultos", e => e.Habilidad("urgencias adultos")),
            ("y Guardar", e => e.Habilidad("guardar")),
        }),

        new("corrige una habilidad que ya tenía", false, a => a.EscribirHabilidad("radicar una cuenta", "cuando pida radicar una cuenta",
            "abre SAP\nescribe NWP1 y pulsa Enter\npulsa Radicar cuenta"), d =>
        {
            d.Persona("radica la cuenta del paciente");
            d.Hizo("map_hacer", "pasos=abre: sap · escribe: NWP1 · tecla: Enter · pulsa: Radicar cuenta", "hice 4 de 4", false);
            d.U("Radiqué la cuenta.");
            d.Persona("no, así no: después de NWP1 primero tienes que abrir Urgencias Adultos, y ya después pulsas Radicar cuenta");
            d.U("Entendido.");
        }, new (string, Func<Estado, bool>)[]
        {
            ("sigue habiendo UNA: no la duplica", e => e.Habilidades.Count == 1),
            ("con el paso corregido", e => e.Habilidad("urgencias adultos")),
            ("y los pasos que seguían valiendo", e => e.Habilidad("nwp1")),
            ("y ninguna preferencia", e => e.Preferencias.Count == 0),
        }),

        new("preferencia de cómo le hablan", false, Nada, d =>
        {
            d.Persona("abre la calculadora");
            d.Hizo("map_open_app", "app=calc", "abrí Calculadora", false);
            d.U("Ya abrí la calculadora. Está lista para que la uses cuando quieras, y si necesitas puedo hacer la cuenta por ti o explicarte cómo usar el modo científico.");
            d.Persona("háblame más corto, no me expliques tanto");
        }, new (string, Func<Estado, bool>)[]
        {
            ("queda la preferencia", e => e.Preferencias.Count == 1),
            ("y ninguna habilidad", e => e.Habilidades.Count == 0),
        }),

        new("preferencia de cómo trabaja", false, Nada, d =>
        {
            d.Persona("guarda el documento");
            d.U("¿Quieres que lo guarde en Documentos?");
            d.Persona("sí, y no me preguntes antes de guardar, guarda y ya");
            d.Hizo("map_hacer", "pasos=tecla: Ctrl+S · tecla: Enter", "hice 2 de 2", false);
        }, new (string, Func<Estado, bool>)[]
        {
            ("queda la preferencia de no preguntar", e => e.Preferencia("pregunt")),
            ("y ninguna habilidad", e => e.Habilidades.Count == 0),
        }),

        new("valor por defecto: siempre Chrome", false, Nada, d =>
        {
            d.Persona("abre YouTube");
            d.Hizo("map_go_to", "surface=web://youtube.com", "abrí youtube.com en Edge", false);
            d.Persona("no, siempre que abras una página usa Chrome, no Edge");
            d.U("Vale.");
        }, new (string, Func<Estado, bool>)[]
        {
            ("queda la preferencia de Chrome", e => e.Preferencia("chrome")),
            ("y ninguna habilidad", e => e.Habilidades.Count == 0),
        }),

        new("un dato de la persona", false, Nada, d =>
        {
            d.Persona("por cierto, soy cardióloga y trabajo en el Hospital General de Medellín");
            d.U("Anotado.");
        }, new (string, Func<Estado, bool>)[]
        {
            ("el dato va a la memoria personal", e => e.Dato("cardi")),
            ("ninguna habilidad", e => e.Habilidades.Count == 0),
            ("ninguna preferencia", e => e.Preferencias.Count == 0),
        }),

        new("una orden suelta de un paso", false, Nada, d =>
        {
            d.Persona("abre la calculadora, por favor");
            d.Hizo("map_open_app", "app=calc", "abrí Calculadora", false);
            d.U("Abierta.");
        }, new (string, Func<Estado, bool>)[]
        {
            ("ninguna habilidad", e => e.Habilidades.Count == 0),
            ("ninguna preferencia", e => e.Preferencias.Count == 0),
            ("ningún dato", e => e.Datos.Count == 0),
        }),

        new("un procedimiento sin enseñar, la primera vez", false, Nada, d =>
        {
            d.Persona("abre mi correo y busca los correos de Sara");
            d.Hizo("map_hacer", "pasos=abre: https://mail.google.com · pulsa: Buscar correo · escribe: from:Sara · tecla: Enter", "hice 4 de 4", false);
            d.U("Aquí están los correos de Sara.");
        }, new (string, Func<Estado, bool>)[]
        {
            ("todavía NO es una habilidad", e => e.Habilidades.Count == 0),
            ("queda apuntado en el cuaderno", e => e.Observaciones.Count == 1),
            ("y ninguna preferencia", e => e.Preferencias.Count == 0),
        }),

        new("ese mismo procedimiento, otra sesión", false, a => a.Observar("buscar los correos de Sara",
            "abre Gmail\npulsa Buscar correo\nescribe from:Sara\npulsa Enter", "sesion-de-ayer"), d =>
        {
            d.Persona("abre mi correo y busca los correos de Sara");
            d.Hizo("map_hacer", "pasos=abre: https://mail.google.com · pulsa: Buscar correo · escribe: from:Sara · tecla: Enter", "hice 4 de 4", false);
            d.U("Aquí están los correos de Sara.");
        }, new (string, Func<Estado, bool>)[]
        {
            ("ahora sí es una habilidad", e => e.Habilidades.Count == 1),
            ("y sale del cuaderno", e => e.Observaciones.Count == 0),
        }),

        new("olvidar una preferencia", false, a => a.GuardarPreferencia("confirma antes de enviar un correo"), d =>
        {
            d.Persona("manda el correo a Juan");
            d.U("¿Lo envío?");
            d.Persona("sí. Y lo de confirmar antes de enviar un correo ya no hace falta, olvídalo");
            d.Hizo("map_take", "exit=Enviar", "pulsé «Enviar»", false);
        }, new (string, Func<Estado, bool>)[]
        {
            ("la preferencia vieja ya no está", e => !e.Preferencia("confirma antes de enviar")),
            ("y ninguna habilidad", e => e.Habilidades.Count == 0),
        }),

        new("una pregunta suelta", false, Nada, d =>
        {
            d.Persona("¿qué hora es en Madrid ahora mismo?");
            d.U("Son las nueve y cuarto de la noche.");
            d.Persona("gracias, eso era todo");
        }, new (string, Func<Estado, bool>)[]
        {
            ("ninguna habilidad", e => e.Habilidades.Count == 0),
            ("ninguna preferencia", e => e.Preferencias.Count == 0),
            ("ningún dato", e => e.Datos.Count == 0),
            ("nada en el cuaderno", e => e.Observaciones.Count == 0),
        }),

        new("lo que dice Ü no es de la persona", false, Nada, d =>
        {
            d.Persona("abre la carpeta de descargas");
            d.Hizo("file_open", "path=descargas", "estás en C:\\Users\\ana\\Downloads: 41 elementos", false);
            d.U("Te recomiendo guardar siempre los adjuntos en Descargas para encontrarlos rápido.");
            d.Persona("vale, gracias");
        }, new (string, Func<Estado, bool>)[]
        {
            ("ninguna preferencia", e => e.Preferencias.Count == 0),
            ("ninguna habilidad", e => e.Habilidades.Count == 0),
        }),

        new("de todo en una sesión", true, Nada, d =>
        {
            d.Persona("soy contador y uso SAP todo el día");
            d.U("Anotado.");
            d.Persona("te voy a enseñar a sacar el balance: entras a la transacción F.01, pones la sociedad 1000 y le das a Ejecutar");
            d.U("Entendido.");
            d.Persona("y háblame de tú, no de usted");
        }, new (string, Func<Estado, bool>)[]
        {
            ("queda UNA habilidad", e => e.Habilidades.Count == 1),
            ("la del balance", e => e.Habilidad("balance")),
            ("la preferencia del tuteo", e => e.Preferencia("tú")),
            ("y el dato de que es contador", e => e.Dato("contador")),
        }),

        new("algo que solo vale hoy", false, Nada, d =>
        {
            d.Persona("guarda este archivo como informe octubre en el escritorio");
            d.Hizo("map_hacer", "pasos=tecla: F12 · escribe: informe octubre · pulsa: Escritorio · tecla: Enter", "hice 4 de 4", false);
            d.U("Guardado en el escritorio.");
        }, new (string, Func<Estado, bool>)[]
        {
            ("ninguna habilidad", e => e.Habilidades.Count == 0),
            ("ninguna preferencia", e => e.Preferencias.Count == 0),
            ("ningún dato", e => e.Datos.Count == 0),
        }),

        new("enseña con la transcripción sucia", true, Nada, d =>
        {
            d.Persona("eh te voy a enseñar a a mandar el el reporte semanal vale abres Gmail le das a redactar pones a Sara en el para y adjuntas el último archivo de de Descargas");
            d.U("Listo.");
        }, new (string, Func<Estado, bool>)[]
        {
            ("queda UNA habilidad", e => e.Habilidades.Count == 1),
            ("que habla del reporte", e => e.Habilidad("reporte")),
            ("y de Gmail", e => e.Habilidad("gmail")),
            ("con al menos tres pasos", e => e.Habilidades.Any(h => h.Pasos.Count >= 3)),
        }),

        new("corrige el estilo, no los pasos", false, Nada, d =>
        {
            d.Persona("léeme el último correo");
            d.Hizo("map_hacer", "pasos=abre: https://mail.google.com · pulsa: el primer correo", "hice 2 de 2", false);
            d.U("El correo es de Sara y dice que la reunión del jueves se pasa al viernes a las diez y que lleves el informe impreso.");
            d.Persona("más despacio, me hablas muy rápido");
        }, new (string, Func<Estado, bool>)[]
        {
            ("queda la preferencia", e => e.Preferencias.Count == 1),
            ("y ninguna habilidad", e => e.Habilidades.Count == 0),
        }),

        new("ya la guardó quien actúa, en el momento", false, a => a.EscribirHabilidad("buscar artículos", "cuando pida buscar artículos",
            "abre Google Scholar\nescribe el tema\npulsa Enter"), d =>
        {
            d.Persona("te voy a enseñar a buscar artículos: abres Google Scholar, escribes el tema y pulsas Enter");
            d.Hizo("habilidad_escribir", "nombre=buscar artículos · cuando=cuando pida buscar artículos · pasos=abre Google Scholar escribe el tema pulsa Enter",
                "Guardé «buscar artículos» con 3 paso(s). Ya la puedo usar.", false);
            d.U("Guardada.");
        }, new (string, Func<Estado, bool>)[]
        {
            ("sigue habiendo UNA: no la duplica", e => e.Habilidades.Count == 1),
            ("y sigue siendo la de Scholar", e => e.Habilidad("scholar")),
        }),

        new("falla, y la persona le enseña cómo es", true, Nada, d =>
        {
            d.Persona("exporta el informe a PDF");
            d.Hizo("map_take", "exit=Exportar", "«Exportar» no está a la vista: no pulsé nada.", true);
            d.U("No encontré Exportar.");
            d.Persona("se hace así: vas a Archivo, luego Guardar como, y en tipo eliges PDF");
            d.Hizo("map_hacer", "pasos=pulsa: Archivo · pulsa: Guardar como · pulsa: Tipo · pulsa: PDF · tecla: Enter", "hice 5 de 5", false);
            d.U("Exportado.");
        }, new (string, Func<Estado, bool>)[]
        {
            ("queda UNA habilidad", e => e.Habilidades.Count == 1),
            ("la de exportar a PDF", e => e.Habilidad("pdf")),
            ("con Guardar como", e => e.Habilidad("guardar como")),
        }),

        new("«apréndete esto»", true, Nada, d =>
        {
            d.Persona("apréndete esto: para pedir una cita se entra a la página de la EPS, se pulsa Citas, se elige Medicina general y se confirma");
            d.U("Aprendido.");
        }, new (string, Func<Estado, bool>)[]
        {
            ("queda UNA habilidad", e => e.Habilidades.Count == 1),
            ("la de pedir una cita", e => e.Habilidad("cita")),
            ("con Medicina general", e => e.Habilidad("medicina general")),
        }),

        new("corrige cómo se hace algo que no tenía guardado", false, Nada, d =>
        {
            d.Persona("pon música");
            d.Hizo("map_open_app", "app=spotify", "No encontré un programa que se llame «spotify».", true);
            d.U("No encontré Spotify.");
            d.Persona("no, para poner música abres YouTube Music en Chrome, buscas la lista Favoritos y le das a reproducir");
            d.Hizo("map_hacer", "pasos=abre: https://music.youtube.com · pulsa: Favoritos · pulsa: Reproducir", "hice 3 de 3", false);
        }, new (string, Func<Estado, bool>)[]
        {
            ("queda UNA habilidad", e => e.Habilidades.Count == 1),
            ("la de poner música, con YouTube Music", e => e.Habilidad("youtube music")),
        }),

        // Medido el 2026-10-01 sobre la Ü de pruebas: quien actúa guardó la preferencia como un DATO, y el
        // repaso, que la vio ya guardada, no propuso nada. Un dato no le llega a quien habla.
        new("la preferencia quedó guardada como un dato", false, Nada, d =>
        {
            d.Persona("de ahora en adelante, cuando termines algo dime solo el resultado, sin explicaciones");
            d.Hizo("memory_remember", "text=De ahora en adelante, cuando termines algo, dime solo el resultado, sin explicaciones.",
                "Lo recordaré para nuestras próximas conversaciones.", false);
            d.U("Hecho.");
        }, new (string, Func<Estado, bool>)[]
        {
            ("queda como preferencia, que es donde se cumple", e => e.Preferencias.Count == 1),
            ("y no se guarda otra vez como dato", e => e.Datos.Count == 0),
            ("ni se inventa una habilidad", e => e.Habilidades.Count == 0),
        }, "- [fact] De ahora en adelante, cuando termines algo, dime solo el resultado, sin explicaciones."),

        new("la preferencia ya la guardó quien actúa, en su sitio", false, a => a.GuardarPreferencia("di solo el resultado, sin explicaciones"), d =>
        {
            d.Persona("de ahora en adelante, cuando termines algo dime solo el resultado, sin explicaciones");
            d.Hizo("preferencia_guardar", "texto=di solo el resultado, sin explicaciones", "Guardé la preferencia: «di solo el resultado, sin explicaciones».", false);
            d.U("Hecho.");
        }, new (string, Func<Estado, bool>)[]
        {
            ("sigue habiendo UNA: no la duplica", e => e.Preferencias.Count == 1),
            ("y no la guarda como dato", e => e.Datos.Count == 0),
        }),

        // LA VISTA (spec 078). En SAP, UIA no nombra nada: el clic llega como «algo sin nombre» en un punto.
        // Lo que se pulsó solo está en la foto, bajo el cursor. Las fotos son pantallas de mentira (fotos\).
        new("enseña MOSTRANDO donde nada tiene nombre: solo lo dicen las fotos", true, Nada, d =>
        {
            d.Persona("mira, te voy a mostrar cómo se radica una cuenta, fíjate bien");
            d.U("Te sigo.");
            MostroSinNombre(d, 1, 342, 236);
            MostroSinNombre(d, 2, 342, 356);
            MostroSinNombre(d, 3, 342, 476);
            MostroSinNombre(d, 4, 1162, 636);
            d.Persona("así es como se radica una cuenta, ¿viste?");
            d.U("Sí.");
        }, new (string, Func<Estado, bool>)[]
        {
            ("queda UNA habilidad", e => e.Habilidades.Count == 1),
            ("que habla de radicar", e => e.Habilidad("radic")),
            ("con lo que se VE bajo el cursor: Facturación", e => e.Habilidad("facturaci")),
            ("y Urgencias Adultos", e => e.Habilidad("urgencias adultos")),
            ("y Guardar", e => e.Habilidad("guardar")),
            ("y ningún paso dice «sin nombre»: la foto lo nombró", e => !e.Habilidad("sin nombre")),
        }),
    };

    /// <summary>
    /// Un clic de la persona que UIA no supo nombrar, con la foto de ese momento. La línea es la que escribe
    /// <c>LoQueHiciste.AnotarEn</c> en la app: si allí cambia, aquí también.
    /// </summary>
    private static void MostroSinNombre(DiarioDeLaSesion d, int foto, int x, int y)
    {
        int id = d.Toco($"pulsó algo sin nombre para Ü en saplogon, en el punto ({x}, {y}): qué es se ve en su foto, bajo el cursor");
        d.PonerFoto(id, File.ReadAllBytes(Path.Combine(AppContext.BaseDirectory, "fotos", $"clic-{foto}.jpg")));
    }

    private static async Task<int> Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;
        string Arg(string nombre, string porDefecto)
        {
            int i = Array.IndexOf(args, nombre);
            return i >= 0 && i + 1 < args.Length ? args[i + 1] : porDefecto;
        }
        int veces = int.Parse(Arg("--veces", "1"), CultureInfo.InvariantCulture);
        int aLaVez = int.Parse(Arg("--a-la-vez", "6"), CultureInfo.InvariantCulture);
        string solo = Arg("--solo", "");
        string salida = Arg("--salida", "");
        LogBus.Verboso = args.Contains("--verboso");
        _sinFotos = args.Contains("--sin-fotos");

        _clave = Environment.GetEnvironmentVariable("OPENAI_API_KEY") ?? "";
        if (string.IsNullOrWhiteSpace(_clave)) _clave = Environment.GetEnvironmentVariable("OPENAI_API_KEY", EnvironmentVariableTarget.User) ?? "";
        if (string.IsNullOrWhiteSpace(_clave)) { Console.Error.WriteLine("falta OPENAI_API_KEY"); return 2; }

        var casos = Bateria.Where(c => solo.Length == 0 || Dice(c.Nombre, solo)).ToList();
        string raiz = Path.Combine(Path.GetTempPath(), "sonda-del-repaso", DateTime.Now.ToString("yyyyMMdd-HHmmss", CultureInfo.InvariantCulture));
        Directory.CreateDirectory(raiz);

        var corridas = new List<Corrida>();
        var puerta = new SemaphoreSlim(aLaVez);
        var tareas = new List<Task>();
        for (int v = 0; v < veces; v++)
            foreach (var (caso, n) in casos.Select((c, n) => (c, n)))
            {
                int vez = v, numero = n;
                tareas.Add(Task.Run(async () =>
                {
                    await puerta.WaitAsync();
                    try
                    {
                        var corrida = await CorrerAsync(caso, Path.Combine(raiz, $"caso-{numero:00}-{vez}.json"), $"sonda-{numero:00}-{vez}");
                        lock (corridas) corridas.Add(corrida with { Vez = vez, Orden = numero });
                    }
                    finally { puerta.Release(); }
                }));
            }
        await Task.WhenAll(tareas);

        int decisiones = 0, acertadas = 0, explicitas = 0, explicitasBien = 0, propuestas = 0, paradas = 0, fallos = 0;
        foreach (var c in corridas.OrderBy(c => c.Orden).ThenBy(c => c.Vez))
        {
            int bien = c.Decisiones.Count(d => d.Vale);
            decisiones += c.Decisiones.Count; acertadas += bien;
            if (c.Caso.Explicita) { explicitas++; if (bien == c.Decisiones.Count) explicitasBien++; }
            propuestas += c.Propuestas; paradas += c.ParadasPorLaCita;
            if (c.Error.Length > 0) fallos++;
            Console.WriteLine($"{(bien == c.Decisiones.Count ? "✔" : "✘")} {c.Caso.Nombre}  [{bien}/{c.Decisiones.Count}]  {c.Ms} ms"
                + (c.Error.Length > 0 ? $"  NO SE REPASÓ: {c.Error}" : ""));
            foreach (var d in c.Decisiones.Where(d => !d.Vale)) Console.WriteLine($"     ✘ {d.Que}");
            if (bien != c.Decisiones.Count || LogBus.Verboso)
            {
                foreach (string a in c.Aplicadas) Console.WriteLine($"     · aplicada: {a}");
                foreach (string x in c.Descartadas) Console.WriteLine($"     · descartada: {x}");
                foreach (string h in c.Quedo) Console.WriteLine($"     = {h}");
            }
        }

        var tiempos = corridas.Where(c => c.Error.Length == 0).Select(c => c.Ms).OrderBy(x => x).ToList();
        long mediana = tiempos.Count == 0 ? 0 : tiempos[tiempos.Count / 2];
        double pct = decisiones == 0 ? 0 : 100.0 * acertadas / decisiones;
        Console.WriteLine();
        Console.WriteLine($"DECISIONES: {acertadas} de {decisiones} ({pct.ToString("0.0", CultureInfo.InvariantCulture)} %) en {corridas.Count} repaso(s) de {casos.Count} caso(s)");
        Console.WriteLine($"ENSEÑANZA EXPLÍCITA: {explicitasBien} de {explicitas} repasos con todas sus decisiones bien");
        Console.WriteLine($"LA COMPUERTA DE LA CITA paró {paradas} de {propuestas} propuestas");
        Console.WriteLine($"TIEMPO: mediana {mediana} ms, máximo {(tiempos.Count == 0 ? 0 : tiempos[^1])} ms" + (fallos > 0 ? $" · {fallos} repaso(s) NO terminaron" : ""));

        if (salida.Length > 0)
        {
            Directory.CreateDirectory(salida);
            string archivo = Path.Combine(salida, "repaso-" + DateTime.Now.ToString("yyyyMMdd-HHmmss", CultureInfo.InvariantCulture) + ".json");
            File.WriteAllText(archivo, JsonSerializer.Serialize(new
            {
                modelo = ElRepaso.Modelo, decisiones, acertadas, porcentaje = pct, explicitas, explicitasBien, propuestas, paradasPorLaCita = paradas,
                medianaMs = mediana, fallos,
                corridas = corridas.OrderBy(c => c.Orden).ThenBy(c => c.Vez).Select(c => new
                {
                    caso = c.Caso.Nombre, c.Vez, c.Ms, c.Error, c.Propuestas, c.ParadasPorLaCita, c.Aplicadas, c.Descartadas, c.Quedo,
                    decisiones = c.Decisiones.Select(d => new { d.Que, d.Vale }),
                }),
            }, new JsonSerializerOptions { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping }));
            Console.WriteLine("escrito: " + archivo);
        }
        return 0;
    }

    private sealed record Corrida(Caso Caso, long Ms, string Error, int Propuestas, int ParadasPorLaCita,
        IReadOnlyList<string> Aplicadas, IReadOnlyList<string> Descartadas, IReadOnlyList<string> Quedo,
        IReadOnlyList<(string Que, bool Vale)> Decisiones, int Vez = 0, int Orden = 0);

    private static async Task<Corrida> CorrerAsync(Caso caso, string archivo, string sesion)
    {
        var aprendido = new LoAprendido(archivo);
        caso.Antes(aprendido);
        var diario = new DiarioDeLaSesion(sesion);
        caso.Sesion(diario);

        var datos = new List<string>();
        var repaso = new ElRepaso(aprendido, LlamarAsync, (dato, _) => { lock (datos) datos.Add(dato); return Task.CompletedTask; },
            linea => LogBus.Log("repaso", linea));
        if (caso.DatosYa.Length > 0) repaso.DatosQueYaSabe = _ => Task.FromResult(caso.DatosYa);
        repaso.ConFotos = !_sinFotos;
        var reloj = Stopwatch.StartNew();
        var informe = await repaso.RepasarAsync(diario, CancellationToken.None);
        reloj.Stop();

        var estado = new Estado(aprendido.Habilidades(), aprendido.Preferencias(), aprendido.Observaciones(), datos, informe);
        var quedo = estado.Habilidades.Select(h => $"habilidad «{h.Nombre}» ({h.Origen}) — {h.Cuando}: {string.Join(" | ", h.Pasos)}")
            .Concat(estado.Preferencias.Select(p => $"preferencia «{p.Texto}»"))
            .Concat(estado.Observaciones.Select(o => $"observación «{o.Nombre}»: {string.Join(" | ", o.Pasos)}"))
            .Concat(datos.Select(d => $"dato «{d}»")).ToList();
        return new Corrida(caso, reloj.ElapsedMilliseconds, informe.Error, informe.Propuestas,
            informe.Descartadas.Count(x => x.Contains("cita", StringComparison.Ordinal)), informe.Aplicadas, informe.Descartadas, quedo,
            caso.Decisiones.Select(d => (d.Que, d.Vale(estado))).ToList());
    }

    private static async Task<string> LlamarAsync(string cuerpo, CancellationToken ct)
    {
        using var peticion = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/responses")
        {
            Content = new StringContent(cuerpo, Encoding.UTF8, "application/json"),
        };
        peticion.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _clave);
        using var r = await Red.SendAsync(peticion, ct);
        string texto = await r.Content.ReadAsStringAsync(ct);
        if (!r.IsSuccessStatusCode)
            throw new HttpRequestException($"OpenAI contestó {(int)r.StatusCode}: {(texto.Length > 400 ? texto[..400] : texto)}");
        return texto;
    }
}
