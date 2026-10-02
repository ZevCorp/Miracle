namespace U.Ciclo;

/// <summary>Cómo acabó un plan: el resultado sobre el plan entero, y una línea por paso para contárselo a Luna.</summary>
public sealed record EjecucionDelPlan(PlanResultado Resultado, IReadOnlyList<string> Detalle)
{
    public string Relato() => Resultado.Resumen + "\n" + string.Join("\n", Detalle);
}

/// <summary>
/// EJECUTA EL PLAN DE LUNA, paso a paso, y para en el primero que falla (promesas 445-446).
///
/// Un paso con prefijo es un gesto que no necesita decidir nada —«abre: notepad», «escribe: hola»,
/// «tecla: Enter»— y no gasta 200 ms de Jev. Un paso sin prefijo es un objetivo, y ese sí va al ciclo.
/// </summary>
public sealed class Ejecutor
{
    private readonly Func<string, bool> _abrir;
    private readonly Action<string> _escribir;
    private readonly Func<string, bool> _tecla;
    private readonly Func<string, IReadOnlyList<string>, Recorrido> _objetivo;
    private readonly Func<bool> _hayQueParar;

    /// <summary>Cada paso en cuanto termina, para la burbuja y el log.</summary>
    public Action<string>? AlTerminarPaso { get; set; }

    /// <summary>Esperar a que la pantalla se quede quieta, sin pulsar nada (promesa 467).</summary>
    public Func<bool>? EsperarQuieta { get; set; }

    private static readonly System.Text.RegularExpressions.Regex IrA = new(
        @"^(?:abre|abrir|ir a|ve a|navega a|navegar a|entra a|entrar a|entra en|entrar en|visita|visitar)\s+(?:la (?:página|web|dirección)\s+)?(?<url>(?:https?://|www\.)\S+)\s*$",
        System.Text.RegularExpressions.RegexOptions.IgnoreCase);
    private static readonly System.Text.RegularExpressions.Regex SoloDireccion = new(@"^(?<url>(?:https?://|www\.)\S+)$", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

    /// <summary>
    /// LO QUE NO ES UN CLIC, DICHO COMO GESTO (promesa 467). Luna a veces pide como objetivo lo que Jev no puede hacer
    /// pulsando: «ir a https://…», «abre https://…» sin los dos puntos, «objetivo: …». Cada uno costó 3-8 clics en la
    /// barra de direcciones (rondas del 2026-09-26). Una instrucción a Luna se puede ignorar; esto no. Solo se toca un
    /// paso cuyo QUÉ es la dirección: «pulsar el enlace “Ver en https://…”» sigue siendo un objetivo.
    /// </summary>
    public static string Normalizar(string paso)
    {
        var p = (paso ?? "").Trim();
        if (p.StartsWith("objetivo:", StringComparison.OrdinalIgnoreCase)) p = p[9..].Trim();
        var m = IrA.Match(p);
        if (!m.Success) m = SoloDireccion.Match(p);
        if (!m.Success) return p;
        string url = m.Groups["url"].Value.TrimEnd('.', ',', ';');
        return "abre: " + (url.StartsWith("www.", StringComparison.OrdinalIgnoreCase) ? "https://" + url : url);
    }

    private static readonly System.Text.RegularExpressions.Regex NombreDeLoElegido = new(@"^\d+\)\s*(?<nombre>.*?)\s*\([^()]*\)$");

    /// <summary>
    /// LO QUE LAS MANOS PULSARON DENTRO DE UN OBJETIVO, con su nombre (spec 082, promesa 800). El relato decía solo
    /// «cumplido»: quien planea no sabía qué se pulsó ni con qué nombre, y volvía a un trabajo que no había visto —lo que
    /// el dueño llamó «no tiene contexto suficiente de lo que pasó en la ejecución»—. Vale también cuando falla: lo que se
    /// alcanzó a pulsar antes de parar es justo lo que hay que saber para seguir desde ahí.
    /// </summary>
    public static string LoPulsado(Recorrido r)
    {
        var nombres = (r?.Vueltas ?? Array.Empty<Vuelta>()).Where(v => v.Elegida.Length > 0)
            .Select(v => NombreDeLoElegido.Match(v.Elegida) is { Success: true } m ? m.Groups["nombre"].Value : v.Elegida).ToList();
        if (nombres.Count == 0) return "";
        return " — pulsé " + string.Join(", ", nombres.Select(n => $"«{n}»")) + (nombres.Count > 1 ? $" ({nombres.Count} clics)" : "");
    }

    private static readonly System.Text.RegularExpressions.Regex EntreGestos =
        new(@"\s*(?:;|,|→|\n)\s*(?=(?:pulsa|escribe|tecla|abre|desplaza|elige)\s*:)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

    /// <summary>
    /// VARIOS GESTOS PEGADOS EN UN PASO SON VARIOS PASOS (spec 081, promesa 802). Medido el 2026-10-01: quien planea
    /// mandó UN paso, «pulsa: Más; pulsa: Dos; pulsa: Ocho; … pulsa: Es igual a». Se buscó un botón con ese nombre
    /// entero, no estaba, las manos eligieron uno «de un tiro» y el paso quedó CUMPLIDO con un clic de nueve: la
    /// cuenta salió mal, hubo que borrarla y repetirla, y la meta tardó 30 s en vez de 18. Solo se parte donde detrás
    /// del separador empieza otro gesto: lo que se escribe conserva sus puntos y comas.
    /// </summary>
    public static IReadOnlyList<string> Partir(IReadOnlyList<string> pasos)
    {
        var salida = new List<string>();
        foreach (string paso in pasos ?? Array.Empty<string>())
        {
            if (paso == null) continue;
            var trozos = EntreGestos.Split(paso).Select(t => t.Trim()).Where(t => t.Length > 0).ToList();
            if (trozos.Count <= 1) salida.Add(paso); else salida.AddRange(trozos);
        }
        return salida;
    }

    private static readonly string[] TeclasDeLaBarra = { "ctrl+l", "alt+d", "f6" };

    /// <summary>
    /// UNA DIRECCIÓN VA EN UN PASO (spec 081, promesa 792): la tecla de la barra de direcciones, una dirección escrita y
    /// Enter son «abre:» esa dirección. Lo demás queda como viene.
    /// </summary>
    /// <remarks>
    /// En la investigación en Google del 2026-10-01, 3 de los 7 planes eran «tecla: Ctrl+L», «escribe: https://…»,
    /// «tecla: Enter»: 1,6 a 2,2 s, porque cada gesto lee la página antes y después. «abre:» con el navegador delante
    /// ya escribe en la barra y espera a que cargue (473), en un paso. Decírselo a quien planea se puede ignorar; esto
    /// no (como <see cref="Normalizar"/>, 467). Solo se toca cuando lo escrito ES una dirección: buscar palabras en la
    /// barra es otra cosa, y escribir una dirección en un campo de la página, también.
    /// </remarks>
    public static IReadOnlyList<string> Compactar(IReadOnlyList<string> pasos)
    {
        var salida = new List<string>();
        pasos = Partir(pasos);
        for (int i = 0; i < pasos.Count; i++)
        {
            if (i + 2 < pasos.Count
                && Prefijo(pasos[i], "tecla:", out var barra) && TeclasDeLaBarra.Contains(barra.Replace(" ", "").ToLowerInvariant())
                && Prefijo(pasos[i + 1], "escribe:", out var escrito) && SoloDireccion.IsMatch(escrito)
                && Prefijo(pasos[i + 2], "tecla:", out var enter) && enter.Trim().ToLowerInvariant() is "enter" or "intro")
            {
                salida.Add(Normalizar(escrito));
                i += 2;
                continue;
            }
            // «pulsa: EPS» Y DETRÁS «elige: EPS = …»: SOBRA EL PRIMERO (promesa 816). Abrir la lista antes de elegir era
            // lo lento —4 s de leerla abierta, 6 de elegir con ella encima y 17 de volver a encontrar el campo siguiente,
            // medido el 2026-10-02—, y «elige:» no la necesita abierta.
            if (i + 1 < pasos.Count && Prefijo(pasos[i], "pulsa:", out var campoPulsado) && Prefijo(pasos[i + 1], "elige:", out var elegido)
                && LectorUia.EsElCampo(LeerEleccion(elegido).Campo, campoPulsado))
                continue;
            salida.Add(pasos[i]);
        }
        return salida;
    }

    /// <summary>
    /// ELEGIR EN UNA LISTA DESPLEGABLE SIN ABRIRLA (spec 083, promesa 816): el campo y la opción. Devuelve null si
    /// quedó elegida; si no, por qué. Sin ella, «elige:» falla y lo dice.
    /// </summary>
    public Func<string, string, string?>? Elegir { get; set; }

    /// <summary>«EPS = Nueva EPS» → (EPS, Nueva EPS). Lo que no trae las dos partes es (vacío, vacío).</summary>
    public static (string Campo, string Opcion) LeerEleccion(string texto)
    {
        int i = (texto ?? "").IndexOf('=');
        if (i <= 0) return ("", "");
        string campo = texto![..i].Trim().Trim('«', '»', '"').Trim(), opcion = texto[(i + 1)..].Trim().Trim('«', '»', '"').Trim();
        return campo.Length > 0 && opcion.Length > 0 ? (campo, opcion) : ("", "");
    }

    /// <summary>
    /// ¿QUEDÓ ELEGIDA? La lista dice lo que tiene; vale si es la opción pedida o EMPIEZA por ella: teclear «Triage 4»
    /// elige «Triage 4 - Urgencia menor», que es lo que se quería, y el 2026-10-02 eso se dio por fallo.
    /// </summary>
    public static bool QuedoElegida(string loQueTiene, string pedida)
    {
        string t = (loQueTiene ?? "").Trim(), p = (pedida ?? "").Trim();
        return p.Length > 0 && t.StartsWith(p, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>La rueda del ratón, en muescas: negativas hacia abajo (promesa 462). Sin ella, «desplaza:» falla y lo dice.</summary>
    public Func<int, bool>? Desplazar { get; set; }

    /// <summary>
    /// «abajo», «arriba 3», «down 4» → muescas con signo, como la rueda: negativas hacia abajo, 5 si no se dice,
    /// nunca más de 20. Lo que no se entiende es null, y el paso falla nombrándolo.
    /// </summary>
    public static int? LeerDesplazamiento(string texto)
    {
        var partes = (texto ?? "").Trim().ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (partes.Length is 0 or > 2) return null;
        int signo = partes[0] switch { "abajo" or "down" => -1, "arriba" or "up" => 1, _ => 0 };
        if (signo == 0) return null;
        int n = 5;
        if (partes.Length == 2 && (!int.TryParse(partes[1], out n) || n <= 0)) return null;
        return signo * Math.Min(n, 20);
    }

    public Ejecutor(Func<string, bool> abrir, Action<string> escribir, Func<string, bool> tecla,
        Func<string, IReadOnlyList<string>, Recorrido> objetivo, Func<bool> hayQueParar)
    {
        _abrir = abrir; _escribir = escribir; _tecla = tecla; _objetivo = objetivo; _hayQueParar = hayQueParar;
    }

    public EjecucionDelPlan Ejecutar(IReadOnlyList<string> pasos)
    {
        pasos = Compactar(pasos);   // el plan que se cuenta es el que se ejecuta (promesa 792, patrón nº10)
        var hechos = new List<bool>();
        var hecho = new List<string>();     // lo que se hizo, en la voz de quien lo cuenta: viaja a Jev
        var detalle = new List<string>();

        foreach (var pedido in pasos)
        {
            if (_hayQueParar()) { detalle.Add("Escape: paré antes de «" + pedido + "»"); break; }

            string paso = Normalizar(pedido);
            bool ok; string linea;
            if (Prefijo(paso, "abre:", out var app))
            {
                ok = _abrir(app);
                linea = ok ? $"abrí «{app}»" : $"no pude abrir «{app}»";
            }
            else if (Prefijo(paso, "escribe:", out var texto))
            {
                _escribir(texto);
                ok = true;
                linea = $"escribí «{texto}»";
            }
            else if (Prefijo(paso, "tecla:", out var tecla))
            {
                ok = _tecla(tecla);
                linea = ok ? $"pulsé la tecla «{tecla}»" : $"no conozco la tecla «{tecla}»";
            }
            else if (Prefijo(paso, "desplaza:", out var hacia))
            {
                int? muescas = LeerDesplazamiento(hacia);
                ok = muescas != null && Desplazar != null && Desplazar(muescas.Value);
                linea = muescas == null ? $"no entiendo hacia dónde desplazar: «{hacia}» (abajo o arriba, y cuántas muescas)"
                      : Desplazar == null ? "no sé desplazar aquí"
                      : ok ? $"desplacé {Math.Abs(muescas.Value)} muesca(s) hacia {(muescas < 0 ? "abajo" : "arriba")}"
                      : $"no pude desplazar «{hacia}»";
            }
            else if (Prefijo(paso, "elige:", out var eleccion))
            {
                var (campo, opcion) = LeerEleccion(eleccion);
                string? porQueNo = campo.Length == 0 ? "se escribe «elige: <el campo> = <la opción>»"
                                 : Elegir == null ? "no sé elegir en una lista aquí" : Elegir(campo, opcion);
                ok = porQueNo == null;
                linea = ok ? $"elegí «{opcion}» en «{campo}»" : $"no elegí «{eleccion}»: {porQueNo}";
            }
            else if (EmpiezaPor(paso, "esperar", "espera "))
            {
                // Esperar no se hace pulsando: «Navegador» pulsado 6 veces esperando a Google Scholar (2026-09-26).
                ok = EsperarQuieta != null && EsperarQuieta();
                linea = ok ? "esperé a que la pantalla se quedara quieta" : "no sé esperar aquí";
            }
            else if (EmpiezaPor(paso, "escribir", "escribe ", "teclear", "redactar"))
            {
                // Sin el texto exacto no hay nada que teclear, y Jev pulsaba el editor una y otra vez (19:15).
                ok = false;
                linea = $"«{paso}» no es un clic: para teclear, un paso «escribe: <el texto exacto>»";
            }
            else
            {
                var r = _objetivo(paso, hecho.ToArray());
                ok = r.Cumplido;
                linea = $"«{paso}»: " + (ok ? "cumplido" : r.PorQueParo) + LoPulsado(r);
            }

            hechos.Add(ok);
            detalle.Add((ok ? "✔ " : "✘ ") + linea);
            try { AlTerminarPaso?.Invoke(detalle[^1]); } catch { }
            if (!ok) break;
            hecho.Add(linea);
        }
        return new EjecucionDelPlan(Plan.Resultado(pasos, hechos), detalle);
    }

    /// <summary>
    /// Cuánto se espera a que la pantalla cambie tras una tecla (promesa 453). Enter navega —envía una búsqueda,
    /// abre una carpeta— y la página tarda: en Chrome, el «mirar» 25 ms después del Enter aún veía «Nueva
    /// pestaña», y Luna repitió la búsqueda entera creyendo que había fallado (2026-09-24, 23:22).
    /// Se sale en cuanto cambia (Asentado): una tecla que responde rápido no paga el techo.
    /// </summary>
    public static int EsperaTrasTecla(string tecla) =>
        (tecla ?? "").Split('+').Last().Trim().ToLowerInvariant() is "enter" or "intro" ? 1500 : 150;

    /// <summary>
    /// Cuánto se espera, como mucho, a que la app termine de teclear (promesa 459). SendInput vuelve en cuanto encola
    /// las teclas; el Bloc de notas las consume a ~12 ms por carácter, y el «mirar» de 200 ms después veía «*pru»,
    /// «*prue», «*prueb»: Luna creía que faltaba texto y lo volvía a escribir (rondas del 2026-09-25, 02:21 y 05:34).
    /// </summary>
    public static int EsperaTrasEscribir(string texto) => Math.Min(1500, 150 + 15 * (texto ?? "").Length);

    private static bool EmpiezaPor(string paso, params string[] inicios) =>
        inicios.Any(i => (paso ?? "").TrimStart().StartsWith(i, StringComparison.OrdinalIgnoreCase));

    private static bool Prefijo(string paso, string prefijo, out string resto)
    {
        var p = (paso ?? "").TrimStart();
        if (p.StartsWith(prefijo, StringComparison.OrdinalIgnoreCase)) { resto = p[prefijo.Length..].Trim(); return true; }
        resto = "";
        return false;
    }
}

/// <summary>
/// LO QUE SE LE DEVUELVE A LUNA CABE (promesa 447). Main midió el tope contra el servidor el 2026-09-12:
/// un resultado de 40 KB dejó la llamada pendiente y cada turno de la sesión falló después. Se deja margen
/// bajo los 32.768 del mensaje entero, y lo que se corta se dice.
/// </summary>
public static class ParaLuna
{
    public const int Tope = 30_000;

    public static string Recortar(string texto)
    {
        texto ??= "";
        var utf8 = System.Text.Encoding.UTF8;
        int total = utf8.GetByteCount(texto);
        if (total <= Tope) return texto;
        string cola(int n) => $"…[recortado: {n} de {total} bytes]";
        int bajo = 0, alto = texto.Length;
        while (bajo < alto)
        {
            int medio = bajo + (alto - bajo + 1) / 2;
            int m = medio > 0 && char.IsHighSurrogate(texto[medio - 1]) ? medio - 1 : medio;
            int bytes = utf8.GetByteCount(texto.AsSpan(0, m));
            if (bytes + utf8.GetByteCount(cola(bytes)) <= Tope) bajo = medio; else alto = medio - 1;
        }
        int corte = bajo > 0 && char.IsHighSurrogate(texto[bajo - 1]) ? bajo - 1 : bajo;
        string principio = texto[..corte];
        return principio + cola(utf8.GetByteCount(principio));
    }
}
