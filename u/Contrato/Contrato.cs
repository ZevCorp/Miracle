using System.Diagnostics;
using System.Reflection;
using System.Text.Json;

// EL CONTRATO DE Ü DESDE CERO — spec 052 (docs/specs/052-u-desde-cero.md), promesas 430-441.
//
// Cada enunciado es el de la spec, literal. Tres veredictos por promesa, y no se mezclan:
//   ✔ cumplida · ✘ incumplida · ⧗ PENDIENTE (la pieza todavía no existe: cuenta como incumplida)
// y uno más para el propio juez: ⚠ NO PUDE JUZGARLA (el arnés falló), que también rompe el contrato
// pero dice otra cosa (aprendizaje nº17: un juez que no puede correr no dice «culpable»).

internal static class Contrato
{
    private static Assembly _nucleo = null!;
    private static int _ok, _mal, _pendientes, _arnes;

    private static int Main()
    {
        try { _nucleo = Assembly.Load("U.Ciclo"); }
        catch (Exception e)
        {
            Console.WriteLine("⚠ NO PUDE CARGAR EL NÚCLEO (U.Ciclo): el contrato no juzgó nada.");
            for (var x = e; x != null; x = x.InnerException) Console.WriteLine($"   ✘ {x.GetType().Name}: {x.Message}");
            return 3;
        }

        Promesa(430, "«Dónde estoy» se contesta sin UIA: ventana, proceso y título salen de Win32, y la propia burbuja de Ü nunca es «dónde estoy».", P430);
        Promesa(431, "Un accionable se identifica por su número en la lista de ESTE ciclo; dos accionables con la misma etiqueta son dos números distintos.", P431);
        Promesa(432, "Lo que no se ve no se ofrece: fuera de pantalla, sin tamaño o deshabilitado no entra en la lista.", P432);
        Promesa(433, "El clic cae en el centro del accionable, en coordenadas de pantalla, y es un clic del ratón real (abajo + arriba, botón izquierdo).", P433);
        Promesa(434, "La respuesta de Jev se valida entera: un número que no se ofreció, una confianza bajo el umbral, «cumplido» alto o «peligro» alto = no se pulsa, y se dice cuál.", P434);
        Promesa(435, "El cuerpo que se le manda a Jev lleva la pantalla, el objetivo y las puertas numeradas, y nunca la clave.", P435);
        Promesa(436, "La espera tras el clic termina en cuanto cambia la huella de los accionables, y nunca pasa de su techo (150 ms).", P436);
        Promesa(437, "Cada ciclo deja sus cinco tiempos (dónde, ver, decidir, pulsar, asentar) y su total, y se marca FUERA DE PRESUPUESTO si pasa de 500 ms.", P437);
        Promesa(438, "Un plan de Luna se lee a objetivos ejecutables; un plan vacío o ilegible no ejecuta nada y lo dice.", P438);
        Promesa(439, "Un paso del plan que no se ejecutó deja rastro (Omitido); el denominador del resultado es el plan.", P439);
        Promesa(440, "El ciclo para al primer «cumplido», al tope de pasos, o cuando Jev repite la misma puerta tres veces sin cambio.", P440);
        Promesa(441, "Escape detiene todo en el ciclo siguiente, sin pulsar nada más.", P441);
        Promesa(442, "Jev sabe lo que ya se hizo: el estado lleva, en orden, lo que ya se pulsó para este objetivo.", P442);
        Promesa(443, "La huella ve los textos: si lo único que cambia es lo que dice la pantalla, la huella cambia.", P443);
        Promesa(444, "Solo cuentan como emergentes las ventanas que pertenecen a la de delante: la barra de tareas no es un menú del Explorador.", P444);
        Promesa(445, "Un paso con prefijo es un gesto directo y no le pregunta a Jev: «abre:», «escribe:» y «tecla:».", P445);
        Promesa(446, "El plan se ejecuta en orden y para en el primer paso que falla; los que quedan salen Omitidos, y cada objetivo sabe lo que hicieron los pasos anteriores.", P446);
        Promesa(447, "Lo que se le devuelve a Luna cabe en 30.000 bytes: si no cabe, se recorta y se dice cuánto se mandó de cuánto.", P447);
        Promesa(448, "La voz abre con session.start en gpt-live-1 y Luna como delegada con «hacer» y «mirar»; una llamada se atiende UNA vez aunque llegue tres, y su resultado vuelve con su call_id y pide turno.", P448);
        Promesa(449, "Una pantalla sin accionables se relee hasta 1 s antes de rendirse: una app que acaba de abrir todavía no pintó.", P449);
        Promesa(450, "El Escape que pulsa Ü no es el freno de la persona: solo frena un Escape que Ü no mandó.", P450);
        Promesa(451, "Si Jev dice que pulsar la elegida cumple el objetivo y la pantalla cambia al pulsarla, el objetivo termina sin otra llamada; si no cambia, se vuelve a preguntar.", P451);
        Promesa(452, "El micrófono se calla solo mientras Ü suena de verdad: el siseo que el servidor manda entre frases no lo calla.", P452);
        Promesa(453, "Tras una tecla que navega (Enter) se espera a que la pantalla cambie, hasta 1,5 s; tras cualquier otra, hasta 150 ms.", P453);
        Promesa(454, "La primera entrada a Luna lleva, además del pedido, lo que hay delante ahora: no gasta un turno en mirar.", P454);
        Promesa(455, "El foco es parte de la pantalla: pulsar un campo que lo toma cambia la huella, y Jev sabe dónde está.", P455);
        Promesa(456, "Abrir termina cuando la app está quieta —dos lecturas seguidas iguales y con accionables—, no con el primer botón que aparece; y nunca pasa de 3 s.", P456);
        Promesa(457, "Una combinación de teclas lleva el código de exploración de cada tecla y suelta lo que pulsó en orden inverso.", P457);
        Promesa(458, "Mirar dice lo que contienen los campos de texto, recortado a 80 caracteres: Luna comprueba lo que escribió en vez de adivinarlo por el título.", P458);
        Promesa(459, "Tras «escribe:» se espera a que la app termine de teclearlo —la pantalla quieta—, con un techo de 150 ms más 15 por carácter y nunca más de 1,5 s.", P459);
        Promesa(460, "Escribir manda las letras de una en una, con al menos 3 ms entre ellas: de un solo lote, el Bloc de notas cambiaba letras por otras.", P460);
        Promesa(474, "Leer la pantalla tiene plazo: UIA espera como mucho 1,5 s para conectar con una app y 3 s por lectura; una ventana que no contesta a tiempo se salta, queda dicho en el log, y la lectura sigue con lo demás.", P474);
        Promesa(473,"Con el navegador delante, abrir una dirección la carga en la pestaña de delante —escrita de una vez en su barra de direcciones—, no en una pestaña nueva; con otra app delante, o sin navegador, se abre como siempre.", P473);
        Promesa(472,"Si la app pedida se abrió pero Windows no la dejó pasar al frente, Ü busca su ventana —visible, de la app pedida— y la trae él; y leer la pantalla nunca tumba un pedido: si falla, Luna recibe por qué y sigue.", P472);
        Promesa(471,"Lo que cae fuera de su ventana no se ofrece a Jev ni se le cuenta a Luna: un enlace por debajo de lo visible de la página no está en la lista, y lo que asoma aunque sea un poco, sí.", P471);
        Promesa(470,"Abrir una app que ya está delante llega: si tras abrirla la ventana de delante es de la app pedida —por su proceso, y en las de la tienda también por su título—, cuenta como abierta; y si ya estaba delante antes de abrirla, se esperan 700 ms a que cambie, no 3 s.", P470);
        Promesa(469,"Abrir llega también cuando la ventana de delante es la misma pero cambia su título: una dirección abierta con el navegador delante abre una pestaña en esa misma ventana. Si no cambia ni la ventana ni el título, no llegó.", P469);
        Promesa(468,"Luna sabe cuánto lleva: cada resultado que recibe dice el tiempo que va del pedido, y sabe que si la persona pide una duración tiene que seguir hasta cumplirla.", P468);
        Promesa(467,"Lo que no es un clic no se le pide a Jev: un paso con una dirección web se abre como «abre:», un «objetivo:» delante sobra, «esperar…» espera a que la pantalla se quede quieta sin pulsar, y «escribir…» sin texto exacto falla al instante pidiendo «escribe:»; y Luna lo sabe.", P467);
        Promesa(466,"Jev reintenta la conexión igual que Luna: si no llega a abrirse lo intenta hasta 3 veces, y si no se abre falla diciendo la causa y cuántas veces lo intentó; lo que ya salió hacia Jev no se reintenta.", P466);
        Promesa(465,"Tras pulsar un enlace se espera a que la pantalla cambie hasta 1,5 s, saliendo en cuanto cambia: una página que tarda en cargar no es un clic que no agarró. Tras cualquier otro clic se sigue esperando como mucho 150 ms.", P465);
        Promesa(464,"Un objetivo no se corta por contar pasos: lo paran cumplirse, que Jev no se atreva, Escape, o que Jev elija lo mismo por tercera vez en la misma pantalla —aunque entre medias haya pasado por otras: un bucle—; la red de seguridad es de 50 pasos.", P464);
        Promesa(463,"Luna no tiene tope de turnos ni se da por atascada: sigue hasta contestar, y solo para con Escape o a los 60 minutos; al parar, un último turno sin herramientas le pide contar lo que logró, y eso es lo que se entrega, empezando por «Paré:» y el motivo.", P463);
        Promesa(462,"«desplaza: abajo|arriba [N]» es un gesto directo con la rueda del ratón real sobre la ventana de delante: N muescas —5 si no se dice, nunca más de 20—, sin preguntarle a Jev; una dirección que no entiende hace fallar el paso diciéndolo, y Luna sabe que existe.", P462);
        Promesa(461,"Un corte de red no tumba a Ü: si la conexión con Luna no llega a abrirse se reintenta hasta 3 veces, y si no se abre, el pedido termina diciendo la causa; lo que ya salió hacia Luna no se reintenta.", P461);

        Console.WriteLine();
        int incumplidas = _mal + _pendientes + _arnes;
        Console.WriteLine($"{_ok} cumplida(s) · {_mal} incumplida(s) · {_pendientes} pendiente(s) · {_arnes} sin juzgar");
        Console.WriteLine(incumplidas == 0
            ? "CONTRATO INTACTO: Ü desde cero cumple lo que promete."
            : $"CONTRATO ROTO: {incumplidas} promesa(s) incumplida(s). El cambio no puede entrar así.");
        return incumplidas == 0 ? 0 : 1;
    }

    // ── El arnés ────────────────────────────────────────────────────────────────────────────────

    private sealed class Pendiente : Exception { public Pendiente(string que) : base(que) { } }
    private sealed class Incumplida : Exception { public Incumplida(string que) : base(que) { } }

    private static void Promesa(int n, string enunciado, Action juicio)
    {
        try { juicio(); _ok++; Console.WriteLine($"✔ {n}  {enunciado}"); }
        catch (Pendiente p) { _pendientes++; Console.WriteLine($"⧗ {n}  PENDIENTE: «{p.Message}» todavía no existe.\n       {enunciado}"); }
        catch (Incumplida i) { _mal++; Console.WriteLine($"✘ {n}  {enunciado}\n       {i.Message}"); }
        catch (Exception e)
        {
            var raiz = e is TargetInvocationException { InnerException: { } ie } ? ie : e;
            _mal++;
            Console.WriteLine($"✘ {n}  {enunciado}");
            for (var x = raiz; x != null; x = x.InnerException) Console.WriteLine($"       ✘ {x.GetType().Name}: {x.Message}");
        }
    }

    private static void Exige(bool cierto, string que) { if (!cierto) throw new Incumplida(que); }

    private static Type T(string nombre) =>
        _nucleo.GetType("U.Ciclo." + nombre) ?? throw new Pendiente("U.Ciclo." + nombre);

    private static object? S(string tipo, string metodo, params object?[] args)
    {
        var t = T(tipo);
        var m = t.GetMethods(BindingFlags.Public | BindingFlags.Static)
                    .FirstOrDefault(x => x.Name == metodo && x.GetParameters().Length == args.Length)
                ?? throw new Pendiente($"{tipo}.{metodo}/{args.Length}");
        try { return m.Invoke(null, args); }
        catch (TargetInvocationException e) when (e.InnerException != null) { throw e.InnerException; }
    }

    private static object N(string tipo, params object?[] args)
    {
        var t = T(tipo);
        try { return Activator.CreateInstance(t, args) ?? throw new Pendiente($"new {tipo}"); }
        catch (MissingMethodException) { throw new Pendiente($"new {tipo}({args.Length} argumentos)"); }
        catch (TargetInvocationException e) when (e.InnerException != null) { throw e.InnerException; }
    }

    private static object? P(object o, string propiedad) =>
        (o.GetType().GetProperty(propiedad) ?? throw new Pendiente($"{o.GetType().Name}.{propiedad}")).GetValue(o);

    private static object? I(object o, string metodo, params object?[] args)
    {
        var m = o.GetType().GetMethods().FirstOrDefault(x => x.Name == metodo && x.GetParameters().Length == args.Length)
                ?? throw new Pendiente($"{o.GetType().Name}.{metodo}/{args.Length}");
        try { return m.Invoke(o, args); }
        catch (TargetInvocationException e) when (e.InnerException != null) { throw e.InnerException; }
    }

    private static List<object> L(object? lista) => ((System.Collections.IEnumerable)lista!).Cast<object>().ToList();

    private static object Caja(int x, int y, int w, int h) => N("Caja", x, y, w, h);
    private static object Crudo(string nombre, string tipo, object caja, bool habilitado = true, bool fuera = false) =>
        N("Crudo", nombre, tipo, caja, habilitado, fuera);

    /// <summary>Una lista de accionables de verdad, construida por el mismo camino que usa el núcleo.</summary>
    private static object Lista(params (string Nombre, string Tipo)[] cosas)
    {
        var crudoT = T("Crudo");
        var arr = Array.CreateInstance(crudoT, cosas.Length);
        for (int i = 0; i < cosas.Length; i++) arr.SetValue(Crudo(cosas[i].Nombre, cosas[i].Tipo, Caja(10 * i, 10, 40, 20)), i);
        return S("Accionables", "Numerar", arr)!;
    }

    private static object Ubicacion(int pid, string proceso) => N("Ubicacion", new IntPtr(pid * 10), pid, proceso, proceso + " — título");

    // ── Las promesas ────────────────────────────────────────────────────────────────────────────

    private static void P430()
    {
        // SIN UIA: medido, no supuesto. Si «dónde estoy» tocara UIA, el ensamblado de interop se cargaría.
        bool uiaAntes = AppDomain.CurrentDomain.GetAssemblies().Any(a => a.GetName().Name == "Interop.UIAutomationClient");
        var tiempos = new List<double>();
        object? ultima = null;
        for (int i = 0; i < 50; i++)
        {
            var r = Stopwatch.StartNew();
            ultima = S("Donde", "Leer");
            tiempos.Add(r.Elapsed.TotalMilliseconds);
        }
        bool uiaDespues = AppDomain.CurrentDomain.GetAssemblies().Any(a => a.GetName().Name == "Interop.UIAutomationClient");
        Exige(!uiaAntes && !uiaDespues, "leer «dónde estoy» cargó el interop de UIA");
        double med = tiempos.OrderBy(x => x).ElementAt(tiempos.Count / 2);
        Exige(med < 2.0, $"«dónde estoy» tarda {med:0.00} ms de mediana; una llamada a Win32 cabe en menos de 2 ms");

        // LA PROPIA BURBUJA NUNCA ES «DÓNDE ESTOY»: si delante está Ü, se contesta la última ventana ajena.
        var propia = Ubicacion(42, "U");
        var ajena = Ubicacion(7, "notepad");
        var r1 = S("Donde", "Elegir", propia, 42, ajena);
        Exige(r1 != null && (int)P(r1, "Pid")! == 7, "con Ü delante, «dónde estoy» no contestó la última ventana ajena");
        var r2 = S("Donde", "Elegir", ajena, 42, null);
        Exige(r2 != null && (int)P(r2, "Pid")! == 7, "con otra app delante, «dónde estoy» no la contestó a ella");
        var r3 = S("Donde", "Elegir", propia, 42, null);
        Exige(r3 == null, "con Ü delante y ninguna ajena conocida, «dónde estoy» se contestó a sí mismo");
    }

    private static void P431()
    {
        var l = L(Lista(("Sistema", "Button"), ("Sistema", "ListItem"), ("Sistema", "ListItem")));
        Exige(l.Count == 3, $"se esperaban 3 accionables y hay {l.Count}: los homónimos se fundieron");
        var numeros = l.Select(a => (int)P(a, "Numero")!).ToList();
        Exige(numeros.SequenceEqual(new[] { 1, 2, 3 }), $"los números no son 1,2,3 en orden de lectura: {string.Join(",", numeros)}");
        var ids = l.Select(a => (string)P(a, "Id")!).ToList();
        Exige(ids[0] == "1) Sistema (Button)" && ids[1] == "2) Sistema (ListItem)" && ids[2] == "3) Sistema (ListItem)",
            $"los ids no llevan su número: {string.Join(" | ", ids)}");
        Exige(ids.Distinct().Count() == 3, "dos accionables con la misma etiqueta comparten id");
    }

    private static void P432()
    {
        var crudoT = T("Crudo");
        var cosas = new[]
        {
            Crudo("Visible", "Button", Caja(0, 0, 40, 20)),
            Crudo("Fuera", "Button", Caja(0, 0, 40, 20), fuera: true),
            Crudo("Plano", "Button", Caja(0, 0, 0, 20)),
            Crudo("Apagado", "Button", Caja(0, 0, 40, 20), habilitado: false),
            Crudo("   ", "Button", Caja(0, 0, 40, 20)),
        };
        var arr = Array.CreateInstance(crudoT, cosas.Length);
        for (int i = 0; i < cosas.Length; i++) arr.SetValue(cosas[i], i);
        var l = L(S("Accionables", "Numerar", arr));
        var nombres = l.Select(a => (string)P(a, "Nombre")!).ToList();
        Exige(nombres.SequenceEqual(new[] { "Visible" }), $"se ofreció lo que no se ve: {string.Join(", ", nombres)}");
    }

    private static void P433()
    {
        var c = S("Raton", "Centro", Caja(100, 200, 50, 20))!;
        int x = (int)c.GetType().GetField("Item1")!.GetValue(c)!, y = (int)c.GetType().GetField("Item2")!.GetValue(c)!;
        Exige(x == 125 && y == 210, $"el centro de (100,200,50×20) es (125,210) y salió ({x},{y})");
        var g = L(S("Raton", "Gesto", 125, 210)).Select(o => o.ToString()).ToList();
        Exige(g.SequenceEqual(new[] { "mover 125,210", "izquierdo abajo", "izquierdo arriba" }),
            $"el gesto no es mover + abajo + arriba del botón izquierdo: {string.Join(" · ", g)}");
    }

    private static string Respuesta(string choice, double conf, double cumplido = 0, double peligro = 0) =>
        JsonSerializer.Serialize(new
        {
            answers = new Dictionary<string, object>
            {
                ["puerta"] = new { choice, confidence = conf },
                ["cumplido"] = new { noul = cumplido },
                ["peligro"] = new { noul = peligro },
            },
        });

    private static void P434()
    {
        var ofrecidas = Lista(("Abrir", "Button"), ("Cerrar", "Button"));
        object E(string json) => S("Jev", "Interpretar", json, ofrecidas, 0.70)!;
        bool Pulsa(object e) => (bool)P(e, "Pulsar")!;
        string Porque(object e) => ((string)P(e, "Porque")!).ToLowerInvariant();

        var bien = E(Respuesta("1) Abrir (Button)", 0.93));
        Exige(Pulsa(bien) && (int)P(bien, "Numero")! == 1, "una elección buena y ofrecida no se pulsó, o no con su número");

        var fuera = E(Respuesta("3) Grabar (Button)", 0.99));
        Exige(!Pulsa(fuera) && Porque(fuera).Contains("no se ofreció"), $"un número que no se ofreció: {Porque(fuera)}");

        var tibia = E(Respuesta("2) Cerrar (Button)", 0.50));
        Exige(!Pulsa(tibia) && Porque(tibia).Contains("confianza"), $"confianza bajo el umbral: {Porque(tibia)}");

        var hecho = E(Respuesta("1) Abrir (Button)", 0.95, cumplido: 0.9));
        Exige(!Pulsa(hecho) && Porque(hecho).Contains("cumplido"), $"«cumplido» alto: {Porque(hecho)}");

        var peligro = E(Respuesta("2) Cerrar (Button)", 0.95, peligro: 0.8));
        Exige(!Pulsa(peligro) && Porque(peligro).Contains("peligro"), $"«peligro» alto: {Porque(peligro)}");

        var basura = E("<html>502</html>");
        Exige(!Pulsa(basura) && Porque(basura).Length > 0, "una respuesta ilegible se pulsó o no dijo por qué");
    }

    private static void P435()
    {
        Environment.SetEnvironmentVariable("TYPESAFE_API_KEY", "sk-secreto-del-contrato");
        var ofrecidas = Lista(("Abrir", "Button"), ("Abrir", "MenuItem"));
        string cuerpo = (string)S("Jev", "Cuerpo", "notepad · Sin título", "abrir el menú Archivo", ofrecidas, "jev-latest")!;
        Exige(!cuerpo.Contains("sk-secreto-del-contrato"), "LA CLAVE VA EN EL CUERPO");
        using var doc = JsonDocument.Parse(cuerpo);
        string estado = doc.RootElement.GetProperty("state").GetString() ?? "";
        Exige(estado.Contains("notepad · Sin título") && estado.Contains("abrir el menú Archivo"), "el estado no lleva la pantalla y el objetivo");
        var criterios = doc.RootElement.GetProperty("questions").GetProperty("puerta").GetProperty("criteria")
            .EnumerateObject().Select(p => p.Name).ToList();
        Exige(criterios.SequenceEqual(new[] { "1) Abrir (Button)", "2) Abrir (MenuItem)" }),
            $"las puertas no van numeradas y únicas: {string.Join(" | ", criterios)}");
        Exige(doc.RootElement.GetProperty("questions").TryGetProperty("cumplido", out _), "no se pregunta si ya está cumplido");
    }

    private static void P436()
    {
        long reloj = 0;
        Func<long> Reloj = () => reloj;
        // Cambia a la tercera lectura: se sale ahí, sin esperar al techo.
        int lecturas = 0;
        Func<string> cambiaALaTercera = () => { lecturas++; reloj += 10; return lecturas >= 3 ? "B" : "A"; };
        var a = S("Asentado", "Esperar", cambiaALaTercera, "A", 150, Reloj)!;
        Exige((bool)P(a, "Cambio")! && (int)P(a, "Lecturas")! == 3, $"no salió en cuanto cambió: {a}");

        // Nunca cambia: se rinde en el techo, no después.
        reloj = 0; lecturas = 0;
        Func<string> nuncaCambia = () => { lecturas++; reloj += 10; return "A"; };
        var b = S("Asentado", "Esperar", nuncaCambia, "A", 150, Reloj)!;
        Exige(!(bool)P(b, "Cambio")! && (long)P(b, "Ms")! <= 160, $"pasó del techo de 150 ms: {b}");

        // Ya cambió al llegar: una sola lectura.
        reloj = 0; lecturas = 0;
        var c = S("Asentado", "Esperar", (Func<string>)(() => { lecturas++; return "B"; }), "A", 150, Reloj)!;
        Exige((bool)P(c, "Cambio")! && (int)P(c, "Lecturas")! == 1, $"leyó de más con la pantalla ya cambiada: {c}");
    }

    private static void P437()
    {
        Exige((double)(T("Ciclo").GetField("Presupuesto")?.GetValue(null) ?? throw new Pendiente("Ciclo.Presupuesto")) == 500,
            "el presupuesto no es 500 ms");
        var dentro = N("Tiempos", 0.3, 80.0, 220.0, 0.5, 100.0);
        Exige(Math.Abs((double)P(dentro, "Total")! - 400.8) < 0.01, $"el total no es la suma de las cinco fases: {P(dentro, "Total")}");
        Exige(!(bool)P(dentro, "FueraDePresupuesto")!, "un ciclo de 400 ms se marcó fuera de presupuesto");
        string linea = ((string)I(dentro, "Linea")!).ToLowerInvariant();
        foreach (var f in new[] { "dónde", "ver", "decidir", "pulsar", "asentar", "total" })
            Exige(linea.Contains(f), $"la línea del ciclo no dice «{f}»: {linea}");

        var fuera = N("Tiempos", 0.3, 80.0, 220.0, 0.5, 250.0);
        Exige((bool)P(fuera, "FueraDePresupuesto")!, "un ciclo de 550 ms no se marcó fuera de presupuesto");
        Exige(((string)I(fuera, "Linea")!).Contains("FUERA DE PRESUPUESTO"), "la línea de un ciclo lento no lo dice");
    }

    private static void P438()
    {
        var bueno = S("Plan", "Leer", "{\"pasos\":[\"abrir el Bloc de notas\",\"abrir el menú Archivo\"]}")!;
        var pasos = L(P(bueno, "Pasos")).Select(o => (string)o).ToList();
        Exige(pasos.SequenceEqual(new[] { "abrir el Bloc de notas", "abrir el menú Archivo" }), $"no se leyeron los pasos: {string.Join(" | ", pasos)}");

        var cercado = S("Plan", "Leer", "```json\n{\"pasos\":[\"ir a Sistema\"]}\n```")!;
        Exige(L(P(cercado, "Pasos")).Count == 1, "un plan dentro de ```json no se leyó");

        foreach (var malo in new[] { "no sé", "{\"pasos\":[]}", "{\"pasos\":[\"  \"]}", "" })
        {
            var r = S("Plan", "Leer", malo)!;
            Exige(L(P(r, "Pasos")).Count == 0, $"«{malo}» produjo pasos");
            Exige(((string)P(r, "Porque")!).Trim().Length > 0, $"«{malo}» no ejecutó nada pero no dijo por qué");
        }
    }

    private static void P439()
    {
        var plan = new List<string> { "abrir", "ir a Sistema", "ir a Pantalla" };
        var hechos = new List<bool> { true, false };
        var r = S("Plan", "Resultado", plan, hechos)!;
        var estados = L(P(r, "Pasos")).Select(p => (string)P(p, "Estado")!).ToList();
        Exige(estados.SequenceEqual(new[] { "Hecho", "Fallido", "Omitido" }), $"estados: {string.Join(", ", estados)}");
        string resumen = (string)P(r, "Resumen")!;
        Exige(resumen.Contains("1 de 3"), $"el denominador no es el plan: «{resumen}»");
    }

    // Un motor de mentira: pantallas que cambian (o no) y un decisor guionizado.
    private static (object Motor, List<int> Pulsados) Motor(Func<int, object> decidirEnLaVuelta, bool pantallaCambia, Func<int, bool>? parar = null, Func<int, string>? pantalla = null)
    {
        var pulsados = new List<int>();
        int vuelta = 0;
        var accionablesT = typeof(IReadOnlyList<>).MakeGenericType(T("Accionable"));
        Func<object?> donde = () => Ubicacion(7, "notepad");
        var dondeT = typeof(Func<>).MakeGenericType(T("Ubicacion"));
        var verT = typeof(Func<>).MakeGenericType(accionablesT);
        var decidirT = typeof(Func<,,,>).MakeGenericType(typeof(string), typeof(string), accionablesT, T("Eleccion"));
        var pulsarT = typeof(Action<>).MakeGenericType(T("Accionable"));

        object Ver() => pantalla != null ? Lista((pantalla(pulsados.Count), "Text"), ("Siguiente", "Button"))
            : pantallaCambia ? Lista(("Pantalla " + pulsados.Count, "Text"), ("Siguiente", "Button")) : Lista(("Igual", "Text"), ("Siguiente", "Button"));
        object Decidir(string p, string o, object l) { vuelta++; return decidirEnLaVuelta(vuelta); }
        void Pulsar(object a) => pulsados.Add((int)P(a, "Numero")!);

        var dDonde = Delegado(dondeT, () => donde());
        var dVer = Delegado(verT, () => Ver());
        var dDecidir = DelegadoDe3(decidirT, (a, b, c) => Decidir((string)a!, (string)b!, c!));
        var dPulsar = DelegadoAccion(pulsarT, a => Pulsar(a!));
        var dParar = (Func<bool>)(() => parar?.Invoke(pulsados.Count) ?? false);
        return (N("Motor", dDonde, dVer, dDecidir, dPulsar, dParar), pulsados);
    }

    private static object Eleccion(bool pulsar, int numero, double conf = 0.9, double cumplido = 0, string porque = "") =>
        N("Eleccion", pulsar, numero, conf, cumplido, porque);

    private static void P440()
    {
        // Cumplido a la segunda vuelta.
        var (m1, p1) = Motor(v => v >= 2 ? Eleccion(false, 0, cumplido: 0.9, porque: "cumplido") : Eleccion(true, 2), true);
        var r1 = I(m1, "Objetivo", "llegar", 10)!;
        Exige(p1.Count == 1 && ((string)P(r1, "PorQueParo")!).Contains("cumplido"), $"no paró al primer «cumplido»: {p1.Count} pulsos · {P(r1, "PorQueParo")}");

        // Tope de pasos.
        var (m2, p2) = Motor(_ => Eleccion(true, 2), true);
        var r2 = I(m2, "Objetivo", "seguir", 3)!;
        Exige(p2.Count == 3 && ((string)P(r2, "PorQueParo")!).Contains("tope"), $"no paró en el tope: {p2.Count} pulsos · {P(r2, "PorQueParo")}");
        Exige(L(P(r2, "Vueltas")).Count == 3, "las vueltas no dejaron rastro");

        // La misma puerta tres veces sin que nada cambie.
        var (m3, p3) = Motor(_ => Eleccion(true, 2), false);
        var r3 = I(m3, "Objetivo", "insistir", 10)!;
        Exige(p3.Count == 3 && ((string)P(r3, "PorQueParo")!).Contains("repite"), $"no paró al repetir sin cambio: {p3.Count} pulsos · {P(r3, "PorQueParo")}");
    }

    private static void P441()
    {
        var (m, p) = Motor(_ => Eleccion(true, 2), true, parar: pulsos => pulsos >= 1);
        var r = I(m, "Objetivo", "seguir", 10)!;
        Exige(p.Count == 1 && ((string)P(r, "PorQueParo")!).Contains("Escape"), $"Escape no detuvo: {p.Count} pulsos · {P(r, "PorQueParo")}");
    }

    private static void P442()
    {
        // El cuerpo lleva lo ya hecho, en orden, bajo su propio encabezado.
        var ofrecidas = Lista(("Archivo", "MenuItem"), ("Nuevo", "MenuItem"));
        var hecho = new List<string> { "pulsé «4) Archivo (MenuItem)»", "escribí «hola»" };
        var ctx = N("Contexto", "notepad · Sin título", "abrir el menú Archivo", ofrecidas, new List<string> { "Ln 1, Col 1" }, hecho);
        string cuerpo = (string)S("Jev", "Cuerpo", ctx, "jev-latest")!;
        using var doc = JsonDocument.Parse(cuerpo);
        string estado = doc.RootElement.GetProperty("state").GetString() ?? "";
        int a = estado.IndexOf("pulsé «4) Archivo (MenuItem)»", StringComparison.Ordinal), b = estado.IndexOf("escribí «hola»", StringComparison.Ordinal);
        Exige(estado.Contains("Ya hecho") && a >= 0 && b > a, $"el estado no lleva lo ya hecho en orden:\n{estado}");
        Exige(estado.Contains("Ln 1, Col 1"), "el estado no lleva lo que dice la pantalla");

        // Y el motor se lo pasa: en la segunda vuelta, lo pulsado en la primera.
        var vistos = new List<List<string>>();
        var contextoT = T("Contexto");
        var decidirT = typeof(Func<,>).MakeGenericType(contextoT, T("Eleccion"));
        int vuelta = 0;
        var p = System.Linq.Expressions.Expression.Parameter(contextoT, "c");
        var dDecidir = System.Linq.Expressions.Expression.Lambda(decidirT,
            System.Linq.Expressions.Expression.Convert(System.Linq.Expressions.Expression.Invoke(
                System.Linq.Expressions.Expression.Constant((Func<object, object>)(c =>
                {
                    vistos.Add(L(P(c, "Hecho")).Select(o => (string)o).ToList());
                    return ++vuelta >= 2 ? Eleccion(false, 0, cumplido: 0.9) : Eleccion(true, 2);
                })),
                System.Linq.Expressions.Expression.Convert(p, typeof(object))), T("Eleccion")), p).Compile();

        int pantalla = 0;
        var lecturaT = T("Lectura");
        Func<object> leer = () => N("Lectura", Lista(("Pantalla " + pantalla, "Text"), ("Siguiente", "Button")), new List<string> { "texto " + pantalla });
        var dLeer = Delegado(typeof(Func<>).MakeGenericType(lecturaT), () => leer());
        var dDonde = Delegado(typeof(Func<>).MakeGenericType(T("Ubicacion")), () => Ubicacion(7, "notepad"));
        var dPulsar = DelegadoAccion(typeof(Action<>).MakeGenericType(T("Accionable")), _ => pantalla++);
        var motor = N("Motor", dDonde, dLeer, dDecidir, dPulsar, (Func<bool>)(() => false));
        I(motor, "Objetivo", "llegar", 5);
        Exige(vistos.Count == 2 && vistos[0].Count == 0, $"la primera vuelta no empezó sin historia: {vistos.Count} vueltas");
        Exige(vistos[1].Count == 1 && vistos[1][0].Contains("2) Siguiente (Button)"), $"la segunda vuelta no supo lo pulsado: {string.Join(" | ", vistos.ElementAtOrDefault(1) ?? new())}");
    }

    private static void P443()
    {
        var lista = Lista(("Siete", "Button"), ("Ocho", "Button"));
        string h1 = (string)S("Accionables", "Huella", lista, new List<string> { "La pantalla muestra 0" })!;
        string h2 = (string)S("Accionables", "Huella", lista, new List<string> { "La pantalla muestra 7" })!;
        string h3 = (string)S("Accionables", "Huella", lista, new List<string> { "La pantalla muestra 7" })!;
        Exige(h1 != h2, "la huella no cambió cuando solo cambió el texto de la pantalla");
        Exige(h2 == h3, "la huella cambió sin que cambiara nada");
    }

    private static void P444()
    {
        var delante = new IntPtr(100);
        // (ventana, dueño, clase, proceso igual)
        var encima = new List<(IntPtr, IntPtr, string, bool)>
        {
            (new IntPtr(1), IntPtr.Zero, "Shell_TrayWnd", true),        // la barra de tareas: mismo proceso, de nadie
            (new IntPtr(2), delante, "Xaml_WindowedPopupClass", true),   // el menú de la ventana de delante
            (new IntPtr(3), IntPtr.Zero, "#32768", true),               // un menú clásico: es de quien lo abrió
            (new IntPtr(4), new IntPtr(999), "#32770", true),           // un diálogo de OTRA ventana del mismo proceso
            (new IntPtr(5), delante, "Chrome_WidgetWin_1", false),       // de delante pero de otro proceso: tampoco
        };
        var r = L(S("Emergentes", "Elegir", delante, encima)).Select(o => (IntPtr)o).ToList();
        Exige(r.SequenceEqual(new[] { new IntPtr(2), new IntPtr(3) }), $"emergentes elegidas: {string.Join(",", r)} (se esperaban 2 y 3)");
    }

    // Un ejecutor de mentira que anota todo lo que se le pide.
    private static (object Ejecutor, List<string> Anotado) Ejecutor(Func<string, bool> cumpleObjetivo)
    {
        var anotado = new List<string>();
        var recorridoT = T("Recorrido");
        Func<string, bool> abrir = a => { anotado.Add("abrir " + a); return true; };
        Action<string> escribir = t => anotado.Add("escribir " + t);
        Func<string, bool> tecla = t => { anotado.Add("tecla " + t); return true; };
        Func<string, IReadOnlyList<string>, object> objetivo = (o, hecho) =>
        {
            anotado.Add($"jev {o} | antes: {string.Join(" ; ", hecho)}");
            var vueltas = Array.CreateInstance(T("Vuelta"), 0);
            return N("Recorrido", vueltas, cumpleObjetivo(o) ? "cumplido" : "no pulso", cumpleObjetivo(o));
        };
        var objetivoT = typeof(Func<,,>).MakeGenericType(typeof(string), typeof(IReadOnlyList<string>), recorridoT);
        var po = System.Linq.Expressions.Expression.Parameter(typeof(string));
        var ph = System.Linq.Expressions.Expression.Parameter(typeof(IReadOnlyList<string>));
        var dObjetivo = System.Linq.Expressions.Expression.Lambda(objetivoT,
            System.Linq.Expressions.Expression.Convert(System.Linq.Expressions.Expression.Invoke(
                System.Linq.Expressions.Expression.Constant(objetivo), po, ph), recorridoT), po, ph).Compile();
        return (N("Ejecutor", abrir, escribir, tecla, dObjetivo, (Func<bool>)(() => false)), anotado);
    }

    private static void P445()
    {
        var (e, anotado) = Ejecutor(_ => true);
        var r = I(e, "Ejecutar", new List<string> { "abre: notepad", "escribe: hola, ¿qué tal?", "tecla: Ctrl+S" })!;
        Exige(anotado.SequenceEqual(new[] { "abrir notepad", "escribir hola, ¿qué tal?", "tecla Ctrl+S" }),
            $"los gestos directos no se hicieron tal cual: {string.Join(" | ", anotado)}");
        Exige(!anotado.Any(a => a.StartsWith("jev")), "un gesto directo le preguntó a Jev");
        var estados = L(P(P(r, "Resultado")!, "Pasos")).Select(p => (string)P(p, "Estado")!).ToList();
        Exige(estados.All(s => s == "Hecho"), $"estados: {string.Join(",", estados)}");
    }

    private static void P446()
    {
        var (e, anotado) = Ejecutor(o => o != "ir a Pantalla");
        var r = I(e, "Ejecutar", new List<string> { "abre: configuración", "ir a Sistema", "ir a Pantalla", "subir el brillo" })!;
        var estados = L(P(P(r, "Resultado")!, "Pasos")).Select(p => (string)P(p, "Estado")!).ToList();
        Exige(estados.SequenceEqual(new[] { "Hecho", "Hecho", "Fallido", "Omitido" }), $"estados: {string.Join(",", estados)}");
        Exige(!anotado.Any(a => a.Contains("subir el brillo")), "se ejecutó un paso después del que falló");
        var segundo = anotado.FirstOrDefault(a => a.StartsWith("jev ir a Pantalla")) ?? "";
        Exige(segundo.Contains("abrí «configuración»") && segundo.Contains("ir a Sistema"),
            $"el objetivo no supo lo que hicieron los pasos anteriores: {segundo}");
        Exige(((string)P(P(r, "Resultado")!, "Resumen")!).Contains("2 de 4"), "el resumen no se cuenta sobre el plan");
    }

    private static void P447()
    {
        string corto = "abrí el Bloc de notas";
        Exige((string)S("ParaLuna", "Recortar", corto)! == corto, "un resultado corto se tocó");
        string largo = string.Concat(Enumerable.Repeat("á accionable 🙂 ", 5000));
        string r = (string)S("ParaLuna", "Recortar", largo)!;
        int bytes = System.Text.Encoding.UTF8.GetByteCount(r);
        Exige(bytes <= 30_000, $"el recorte ocupa {bytes} bytes");
        Exige(r.Contains("recortado") && r.Contains(System.Text.Encoding.UTF8.GetByteCount(largo).ToString()), "el recorte no dice cuánto se mandó de cuánto");
        Exige(!r.Contains('�'), "el recorte partió un carácter");
    }

    private static void P448()
    {
        string apertura = (string)S("ProtocoloVivo", "Apertura", "instrucciones de Luna")!;
        using (var d = JsonDocument.Parse(apertura))
        {
            var s = d.RootElement.GetProperty("session");
            Exige(d.RootElement.GetProperty("type").GetString() == "session.start", "no abre con session.start");
            Exige(s.GetProperty("model").GetString() == "gpt-live-1", "la voz no es gpt-live-1");
            var resp = s.GetProperty("delegation").GetProperty("responses");
            Exige(resp.GetProperty("model").GetString() == "gpt-5.6-luna", "la delegada no es Luna");
            var nombres = resp.GetProperty("tools").EnumerateArray().Select(t => t.GetProperty("name").GetString()).ToList();
            Exige(nombres.Contains("hacer") && nombres.Contains("mirar"), $"herramientas de Luna: {string.Join(",", nombres)}");
        }
        Exige(((string)S("ProtocoloVivo", "Direccion")!.ToString()!).Contains("/v1/live/sessions"), "no va por /v1/live/sessions");

        // La MISMA llamada llega tres veces (medido en main el 2026-09-12): solo la terminada cuenta.
        string Ev(string tipo, string args) => JsonSerializer.Serialize(new
        {
            type = "response.event",
            @event = new { type = tipo, item = new { type = "function_call", call_id = "call_1", name = "hacer", arguments = args } },
        });
        var llamadas = new[] { Ev("response.output_item.added", ""), Ev("response.function_call_arguments.done", "{\"pasos\":[\"x\"]}"), Ev("response.output_item.done", "{\"pasos\":[\"x\"]}") }
            .Select(j => S("ProtocoloVivo", "Llamada", j)).Where(x => x != null).ToList();
        Exige(llamadas.Count == 1, $"la llamada se atendió {llamadas.Count} veces");
        Exige((string)P(llamadas[0]!, "CallId")! == "call_1" && ((string)P(llamadas[0]!, "Argumentos")!).Contains("pasos"), "la llamada no trae su id y sus argumentos");

        var salida = L(S("ProtocoloVivo", "Resultado", "call_1", "hecho")).Select(o => (string)o).ToList();
        Exige(salida.Count == 2, $"el resultado no son dos mensajes: {salida.Count}");
        using (var d = JsonDocument.Parse(salida[0]))
            Exige(d.RootElement.GetProperty("item").GetProperty("call_id").GetString() == "call_1"
                && d.RootElement.GetProperty("item").GetProperty("type").GetString() == "function_call_output", "el resultado no lleva su call_id");
        using (var d = JsonDocument.Parse(salida[1]))
            Exige(d.RootElement.GetProperty("type").GetString() == "response.create", "después del resultado no se pide turno");
    }

    private static void P449()
    {
        // Vacía las tres primeras lecturas, con botones a la cuarta: se espera y se pulsa.
        int lecturas = 0, pulsos = 0;
        var accionablesT = typeof(IReadOnlyList<>).MakeGenericType(T("Accionable"));
        object Ver() => ++lecturas <= 3 ? Lista() : Lista(("Siete", "Button"));
        var dDonde = Delegado(typeof(Func<>).MakeGenericType(T("Ubicacion")), () => Ubicacion(7, "calc"));
        var dVer = Delegado(typeof(Func<>).MakeGenericType(accionablesT), () => Ver());
        var decidirT = typeof(Func<,,,>).MakeGenericType(typeof(string), typeof(string), accionablesT, T("Eleccion"));
        var dDecidir = DelegadoDe3(decidirT, (_, _, l) => L(l).Count == 0 ? Eleccion(false, 0, porque: "vacía") : (pulsos > 0 ? Eleccion(false, 0, cumplido: 0.9) : Eleccion(true, 1)));
        var dPulsar = DelegadoAccion(typeof(Action<>).MakeGenericType(T("Accionable")), _ => pulsos++);
        var m = N("Motor", dDonde, dVer, dDecidir, dPulsar, (Func<bool>)(() => false));
        var r = I(m, "Objetivo", "pulsar siete", 3)!;
        Exige(pulsos == 1 && (bool)P(r, "Cumplido")!, $"no esperó a que la app pintara: {pulsos} pulsos · {P(r, "PorQueParo")}");

        // Vacía siempre: se rinde, y no antes de ~1 s ni mucho después.
        lecturas = -1000; pulsos = 0;
        var reloj = Stopwatch.StartNew();
        var m2 = N("Motor", dDonde, Delegado(typeof(Func<>).MakeGenericType(accionablesT), () => Lista()), dDecidir, dPulsar, (Func<bool>)(() => false));
        I(m2, "Objetivo", "pulsar siete", 3);
        Exige(reloj.ElapsedMilliseconds is >= 900 and <= 1600, $"con la pantalla siempre vacía tardó {reloj.ElapsedMilliseconds} ms en rendirse");
    }

    private static void P450()
    {
        var ahora = new DateTime(2026, 9, 24, 23, 10, 0);
        bool Freno(bool abajo, DateTime? propia) => (bool)S("Raton", "EsFrenoDeLaPersona", abajo, ahora, propia)!;
        Exige(Freno(true, null), "un Escape de la persona, sin ninguno de Ü, no frenó");
        Exige(!Freno(true, ahora.AddMilliseconds(-80)), "el Escape que Ü mandó hace 80 ms frenó a Ü");
        Exige(Freno(true, ahora.AddSeconds(-3)), "un Escape de la persona 3 s después del de Ü no frenó");
        Exige(!Freno(false, null), "sin Escape, frenó");
    }

    private static void P451()
    {
        // La pregunta viaja en la misma llamada, y la respuesta se lee.
        var ofrecidas = Lista(("Igual", "Button"));
        string cuerpo = (string)S("Jev", "Cuerpo", "calc", "calcular", ofrecidas, "jev-latest")!;
        using (var d = JsonDocument.Parse(cuerpo))
            Exige(d.RootElement.GetProperty("questions").TryGetProperty("cumple_al_pulsar", out _), "no se pregunta si pulsar la elegida cumple el objetivo");
        string resp = JsonSerializer.Serialize(new { answers = new Dictionary<string, object>
            { ["puerta"] = new { choice = "1) Igual (Button)", confidence = 0.9 }, ["cumple_al_pulsar"] = new { noul = 0.92 } } });
        var e = S("Jev", "Interpretar", resp, ofrecidas, 0.45)!;
        Exige(Math.Abs((double)P(e, "CumpleAlPulsar")! - 0.92) < 1e-9, "la respuesta «cumple al pulsar» no se leyó");

        // En el motor: con cambio, una sola llamada; sin cambio, otra.
        foreach (var cambia in new[] { true, false })
        {
            int llamadas = 0, pulsos = 0;
            var accionablesT = typeof(IReadOnlyList<>).MakeGenericType(T("Accionable"));
            var dDonde = Delegado(typeof(Func<>).MakeGenericType(T("Ubicacion")), () => Ubicacion(7, "calc"));
            var dVer = Delegado(typeof(Func<>).MakeGenericType(accionablesT), () => Lista(("Pantalla " + (cambia ? pulsos : 0), "Text"), ("Igual", "Button")));
            var decidirT = typeof(Func<,,,>).MakeGenericType(typeof(string), typeof(string), accionablesT, T("Eleccion"));
            var dDecidir = DelegadoDe3(decidirT, (_, _, _) =>
            {
                llamadas++;
                if (llamadas >= 2) return Eleccion(false, 0, cumplido: 0.9);
                var el = Eleccion(true, 2);
                (el.GetType().GetProperty("CumpleAlPulsar") ?? throw new Pendiente("Eleccion.CumpleAlPulsar")).SetValue(el, 0.9);
                return el;
            });
            var dPulsar = DelegadoAccion(typeof(Action<>).MakeGenericType(T("Accionable")), _ => pulsos++);
            var m = N("Motor", dDonde, dVer, dDecidir, dPulsar, (Func<bool>)(() => false));
            var r = I(m, "Objetivo", "calcular", 5)!;
            Exige((bool)P(r, "Cumplido")!, $"cambia={cambia}: no terminó cumplido ({P(r, "PorQueParo")})");
            Exige(llamadas == (cambia ? 1 : 2), $"cambia={cambia}: {llamadas} llamadas a Jev (se esperaban {(cambia ? 1 : 2)})");
        }
    }

    private static byte[] Pcm(params short[] muestras) { var b = new byte[muestras.Length * 2]; Buffer.BlockCopy(muestras, 0, b, 0, b.Length); return b; }

    private static void P452()
    {
        bool Suena(byte[] pcm) => (bool)S("Eco", "Suena", pcm)!;
        Exige(!Suena(Pcm(0, 0, 0, 0)), "los ceros sonaron");
        // Lo medido el 2026-09-24 (23:17): deltas de −17 a −12 con la voz callada.
        Exige(!Suena(Pcm(-17, -16, -12, -14, -17, -13)), "el siseo de −17..−12 que manda el servidor contó como voz");
        Exige(Suena(Pcm(0, 2800, -3100, 1500)), "una frase a −20 dBFS no contó como voz");
        Exige(!Suena(Array.Empty<byte>()), "un delta vacío sonó");
    }

    private static void P453()
    {
        int Espera(string t) => (int)S("Ejecutor", "EsperaTrasTecla", t)!;
        Exige(Espera("Enter") == 1500 && Espera("intro") == 1500, $"tras Enter se espera {Espera("Enter")} ms");
        Exige(Espera("Ctrl+L") == 150 && Espera("Escape") == 150 && Espera("Tab") == 150, "tras otra tecla no se esperan 150 ms");
        Exige(Espera("Ctrl+Enter") == 1500, "Ctrl+Enter también navega");
    }

    private static void P454()
    {
        string e = (string)S("LunaPorTexto", "PrimeraEntrada", "calcula 9 por 7", "Ventana delante: Calculadora" + Environment.NewLine + "Se puede pulsar (36): Nueve (Button)")!;
        Exige(e.StartsWith("calcula 9 por 7"), "la entrada no empieza por el pedido");
        Exige(e.Contains("Ventana delante: Calculadora") && e.Contains("Nueve (Button)"), "la entrada no lleva lo que hay delante");
        Exige((string)S("LunaPorTexto", "PrimeraEntrada", "hola", "")! == "hola", "sin nada delante, la entrada no es el pedido tal cual");
    }

    private static void P455()
    {
        var lista = Lista(("Cuadro de búsqueda", "Edit"), ("Sistema", "ListItem"));
        var textos = new List<string> { "Inicio" };
        string sin = (string)S("Accionables", "Huella", lista, textos, "")!;
        string con = (string)S("Accionables", "Huella", lista, textos, "Cuadro de búsqueda")!;
        Exige(sin != con, "pulsar un campo que toma el foco no cambia la huella");

        var ctx = N("Contexto", "Configuración", "buscar fondo", lista, textos, new List<string>());
        (ctx.GetType().GetProperty("Foco") ?? throw new Pendiente("Contexto.Foco")).SetValue(ctx, "Cuadro de búsqueda");
        string cuerpo = (string)S("Jev", "Cuerpo", ctx, "jev-latest")!;
        using var d = JsonDocument.Parse(cuerpo);
        Exige((d.RootElement.GetProperty("state").GetString() ?? "").Contains("El foco está en: «Cuadro de búsqueda»"), "Jev no sabe dónde está el foco");

        // Y el motor se lo pasa, leído de la pantalla.
        string? visto = null;
        var lecturaT = T("Lectura"); var contextoT = T("Contexto");
        Func<object> leer = () =>
        {
            var l = N("Lectura", Lista(("Cuadro de búsqueda", "Edit")), new List<string>());
            (lecturaT.GetProperty("Foco") ?? throw new Pendiente("Lectura.Foco")).SetValue(l, "Cuadro de búsqueda");
            return l;
        };
        var p = System.Linq.Expressions.Expression.Parameter(contextoT, "c");
        var dDecidir = System.Linq.Expressions.Expression.Lambda(typeof(Func<,>).MakeGenericType(contextoT, T("Eleccion")),
            System.Linq.Expressions.Expression.Convert(System.Linq.Expressions.Expression.Invoke(
                System.Linq.Expressions.Expression.Constant((Func<object, object>)(c => { visto = (string?)P(c, "Foco"); return Eleccion(false, 0, cumplido: 0.9); })),
                System.Linq.Expressions.Expression.Convert(p, typeof(object))), T("Eleccion")), p).Compile();
        var motor = N("Motor", Delegado(typeof(Func<>).MakeGenericType(T("Ubicacion")), () => Ubicacion(7, "settings")),
            Delegado(typeof(Func<>).MakeGenericType(lecturaT), () => leer()), dDecidir,
            DelegadoAccion(typeof(Action<>).MakeGenericType(T("Accionable")), _ => { }), (Func<bool>)(() => false));
        I(motor, "Objetivo", "buscar", 2);
        Exige(visto == "Cuadro de búsqueda", $"el motor no le pasó el foco a Jev: «{visto}»");
    }

    private static void P456()
    {
        // Lo que se vio en el Explorador (2026-09-25, 01:17): vacío, 4 botones a medio pintar, y luego 59 y 59.
        long reloj = 0; int n = 0;
        var secuencia = new Func<object>[]
        {
            () => Lista(),
            () => Lista(("Atrás", "Button"), ("Adelante", "Button"), ("Subir", "Button"), ("Actualizar", "Button")),
            () => Lista(("Atrás", "Button"), ("Documentos", "TreeItem"), ("Descargas", "TreeItem")),
            () => Lista(("Atrás", "Button"), ("Documentos", "TreeItem"), ("Descargas", "TreeItem")),
        };
        var lecturaT = T("Lectura");
        Func<object> leer = () => { reloj += 40; var l = secuencia[Math.Min(n++, secuencia.Length - 1)](); return N("Lectura", l, new List<string>()); };
        var dLeer = Delegado(typeof(Func<>).MakeGenericType(lecturaT), () => leer());
        var r = S("Asentado", "Quieta", dLeer, 3000, (Func<long>)(() => reloj))!;
        Exige((bool)P(r, "Cambio")! && (int)P(r, "Lecturas")! == 4, $"no esperó a dos lecturas iguales con accionables: {r}");

        // Una app que nunca se queda quieta: se rinde a los 3 s.
        reloj = 0; int k = 0;
        Func<object> inquieta = () => { reloj += 100; k++; return N("Lectura", Lista(("Reloj " + k, "Button")), new List<string>()); };
        var r2 = S("Asentado", "Quieta", Delegado(typeof(Func<>).MakeGenericType(lecturaT), () => inquieta()), 3000, (Func<long>)(() => reloj))!;
        Exige(!(bool)P(r2, "Cambio")! && (long)P(r2, "Ms")! is >= 3000 and <= 3100, $"con una app que no para se esperó {P(r2, "Ms")} ms");
    }

    private static void P457()
    {
        // Cada evento: «vk scan abajo|arriba [ext]». Lo que se manda, dicho; Raton.Tecla lo ejecuta tal cual.
        var e = L(S("Raton", "EventosDeTecla", "Ctrl+A")).Select(o => o.ToString()!).ToList();
        Exige(e.Count == 4, $"Ctrl+A no son 4 eventos: {string.Join(" | ", e)}");
        Exige(e[0].StartsWith("11 ") && e[0].Contains("abajo") && e[1].StartsWith("41 ") && e[1].Contains("abajo")
            && e[2].StartsWith("41 ") && e[2].Contains("arriba") && e[3].StartsWith("11 ") && e[3].Contains("arriba"),
            $"no se suelta en orden inverso: {string.Join(" | ", e)}");
        Exige(e.All(x => x.Split(' ')[1] != "0"), $"un evento va sin código de exploración: {string.Join(" | ", e)}");
        var flecha = L(S("Raton", "EventosDeTecla", "Abajo")).Select(o => o.ToString()!).ToList();
        Exige(flecha.All(x => x.Contains("ext")), $"una flecha va sin la marca de tecla extendida: {string.Join(" | ", flecha)}");
    }

    private static void P458()
    {
        var campos = new List<(string, string)> { ("Editor de texto", "prueba nocturna de Ü"), ("Buscar", ""), ("Largo", new string('x', 200)) };
        string r = (string)S("Accionables", "DescribirCampos", campos)!;
        Exige(r.Contains("«Editor de texto» contiene «prueba nocturna de Ü»"), $"no dice lo que contiene el campo: {r}");
        Exige(r.Contains("«Buscar» está vacío"), $"un campo vacío no se dice vacío: {r}");
        Exige(r.Contains(new string('x', 80) + "…") && !r.Contains(new string('x', 81)), $"no se recorta a 80: {r}");
    }

    private static void P459()
    {
        int Techo(string t) => (int)S("Ejecutor", "EsperaTrasEscribir", t)!;
        Exige(Techo("hola") == 150 + 4 * 15, $"«hola» espera {Techo("hola")} ms");
        Exige(Techo("prueba nocturna de Ü") == 150 + 20 * 15, $"20 caracteres esperan {Techo("prueba nocturna de Ü")} ms");
        Exige(Techo(new string('x', 500)) == 1500, $"un texto largo espera {Techo(new string('x', 500))} ms, más de 1,5 s");
        Exige(Techo("") == 150, "un texto vacío no espera el mínimo");
    }

    private static void P460()
    {
        var prop = T("Raton").GetProperty("PausaEntreLetrasMs") ?? throw new Pendiente("Raton.PausaEntreLetrasMs");
        int pausa = (int)prop.GetValue(null)!;
        Exige(pausa >= 3, $"la pausa entre letras por defecto es {pausa} ms; sin pausa se corrompía 1 de cada 4 veces");
    }

    private static void P474()
    {
        // Ronda libre L5 (2026-09-26, 21:00:55 → 21:02:08): 72 s entre el plan de Luna y la primera tecla, leyendo una
        // página de YouTube con Chrome a 137 procesos. Sin plazo, una app que no contesta congela a Ü entero.
        var lectorT = T("LectorUia");
        using var lector = (IDisposable)(Activator.CreateInstance(lectorT) ?? throw new Pendiente("LectorUia()"));
        var plazos = lectorT.GetProperty("Plazos")?.GetValue(lector) ?? throw new Pendiente("LectorUia.Plazos");
        int conectar = (int)plazos.GetType().GetField("Item1")!.GetValue(plazos)!, leer = (int)plazos.GetType().GetField("Item2")!.GetValue(plazos)!;
        Exige(conectar is > 0 and <= 1500 && leer is > 0 and <= 3000, $"los plazos de UIA son {conectar} ms para conectar y {leer} ms por lectura");
    }

    private static void P473()
    {
        // Rondas del 2026-09-26: cada «abre: https://…» abría una pestaña nueva y ninguna se cerraba. Al final del día
        // Chrome tenía 133 procesos y 15 GB, y leer una página de Wikipedia pasó de 1,6 a 4-7 s.
        bool Misma(string pedida, string proceso) => (bool)S("Apps", "EnLaMismaPestana", pedida, proceso)!;
        Exige(Misma("https://es.wikipedia.org/wiki/Marte", "chrome") && Misma("https://www.google.com/search?q=x", "msedge"), "con el navegador delante una dirección no va a la misma pestaña");
        Exige(!Misma("https://es.wikipedia.org/wiki/Marte", "Notepad"), "con otra app delante una dirección se quiso escribir en su barra");
        Exige(!Misma("chrome", "chrome") && !Misma("notepad", "chrome"), "abrir una app con el navegador delante se tomó por una dirección");
        var nombres = (string[]?)T("LectorUia").GetField("NombresDeLaBarra")?.GetValue(null) ?? throw new Pendiente("LectorUia.NombresDeLaBarra");
        Exige(nombres.Contains("Barra de direcciones y de búsqueda") && nombres.Contains("Address and search bar"), $"la barra de direcciones no se reconoce en español y en inglés: {string.Join(" | ", nombres)}");
        // Chrome la llama «Barra de direcciones y de búsqueda » —con un espacio al final— (sonda del 2026-09-26, 20:55):
        // buscada por el nombre exacto no aparecía, y cada dirección seguía abriendo una pestaña nueva.
        bool EsBarra(string n) => (bool)S("LectorUia", "EsLaBarra", n)!;
        Exige(EsBarra("Barra de direcciones y de búsqueda ") && EsBarra("Address and search bar"), "la barra con un espacio al final no se reconoce");
        Exige(!EsBarra("Buscar en Wikipedia"), "otro campo se tomó por la barra de direcciones");
    }

    private static void P472()
    {
        // Ronda libre L3 (2026-09-26, 20:45-20:48): 9 «no pude abrir» —Paint, Configuración, el Bloc de notas…—. Se
        // abrían detrás: el panel le devuelve el foco a la app de la persona, y Windows no deja que quien no está
        // delante le robe el primer plano. Y un «COMException: Operation timed out» al mirar tumbó un pedido entero.
        var ventanaT = typeof(ValueTuple<IntPtr, string, string, bool>);
        object V(long h, string p, string t, bool vis) => (IntPtr: new IntPtr(h), p, t, vis);
        var lista = new List<(IntPtr, string, string, bool)>
        {
            (new IntPtr(1), "chrome", "Medellín - Wikipedia", true),
            (new IntPtr(2), "mspaint", "Sin título - Paint", false),
            (new IntPtr(3), "mspaint", "Sin título - Paint", true),
        };
        var c = S("Apps", "Candidata", lista, "paint");
        Exige(c is IntPtr h && h == new IntPtr(3), $"la ventana de Paint escondida o la de Chrome se tomaron por candidata: {c}");
        Exige(S("Apps", "Candidata", lista, "calculadora") is IntPtr z && z == IntPtr.Zero, "sin ventana de la app pedida se inventó una candidata");

        // Mirar lanza (UIA sin contestar): el pedido sigue, y Luna recibe por qué.
        var lunaT = T("LunaPorTexto");
        var ctor = lunaT.GetConstructor(new[] { typeof(string), typeof(HttpMessageHandler) }) ?? throw new Pendiente("LunaPorTexto(clave, manejador)");
        var pedir = lunaT.GetMethods().First(m => m.Name == "Pedir" && m.GetParameters().Length == 5);
        var luna = new LunaDeMentira(n => LunaDeMentira.Dice(n, "no pude ver la pantalla"));
        string r;
        using (var l = (IDisposable)ctor.Invoke(new object[] { "sk-de-mentira", luna }))
        {
            try
            {
                r = (string)pedir.Invoke(l, new object[] { "busca en Wikipedia", (Func<string>)(() => throw new System.Runtime.InteropServices.COMException("Operation timed out.", unchecked((int)0x80131505))),
                    (Func<string, string, string>)((_, _) => "✔"), (Func<bool>)(() => false), (Func<TimeSpan>)(() => TimeSpan.Zero) })!;
            }
            catch (TargetInvocationException e) { throw new Incumplida($"mirar tumbó el pedido: {e.InnerException?.GetType().Name}: {e.InnerException?.Message}"); }
        }
        Exige(r == "no pude ver la pantalla" && luna.Cuerpos.Count == 1 && luna.Cuerpos[0].Contains("Operation timed out"),
            $"Luna no recibió por qué no se pudo mirar: «{r}» · {luna.Cuerpos.Count} petición(es)");
    }

    private static void P471()
    {
        // Ronda libre L2 (2026-09-26, 20:30): Jev dudó 7 veces con enlaces de Wikipedia (confianza 0,22-0,42). Chrome no
        // marca lo que está fuera de pantalla: de 229 accionables ofrecidos, 81 estaban por debajo de lo visible
        // (sonda del 2026-09-26, 10:40), y elegir uno de esos es un clic en el borde de la pantalla.
        var ventana = N("Caja", 0, 0, 1000, 800);
        bool Ve(int x, int y, int w, int h) => (bool)S("Accionables", "SeVe", N("Caja", x, y, w, h), ventana)!;
        Exige(!Ve(100, 900, 80, 20), "un enlace por debajo de la ventana se ofrece");
        Exige(!Ve(-300, 100, 200, 20), "un enlace a la izquierda de la ventana se ofrece");
        Exige(Ve(100, 790, 80, 30), "un enlace que asoma por abajo no se ofrece");
        Exige(Ve(100, 100, 80, 20), "un enlace dentro de la ventana no se ofrece");
    }

    private static void P470()
    {
        // Ronda libre L2 (2026-09-26, 20:30-20:32): «no pude abrir notepad», «no pude abrir ms-settings:bluetooth»,
        // «…configuración», «…ms-settings:»: la app ya estaba delante, abrirla no cambió ni la ventana ni el título, y
        // cada intento costó 3 s y un turno de Luna.
        bool Es(string pedida, string proceso, string titulo) => (bool)S("Apps", "EsLaPedida", pedida, proceso, titulo)!;
        Exige(Es("notepad", "Notepad", "Sin título - Bloc de notas") && Es("bloc de notas", "notepad", "frutas.txt - Bloc de notas"), "el Bloc de notas delante no se reconoce como el pedido");
        Exige(Es("ms-settings:bluetooth", "ApplicationFrameHost", "Configuración") && Es("configuración", "SystemSettings", "Configuración"), "Configuración delante no se reconoce como la pedida");
        Exige(!Es("calculadora", "ApplicationFrameHost", "Configuración"), "Configuración se tomó por la Calculadora: las dos viven en ApplicationFrameHost");
        Exige(Es("calculadora", "ApplicationFrameHost", "Calculadora"), "la Calculadora delante no se reconoce");
        Exige(Es("https://es.wikipedia.org/wiki/Marte", "chrome", "Marte - Wikipedia") && Es("chrome", "chrome", "Nueva pestaña"), "el navegador delante no se reconoce para una dirección");
        Exige(!Es("notepad", "chrome", "Bloc de notas - Google Chrome"), "Chrome con «Bloc de notas» en el título se tomó por el Bloc de notas");
        Exige(!Es("paint", "Notepad", "Sin título"), "una app que no es la pedida contó como abierta");
        Exige((int)S("Apps", "Techo", true)! == 700 && (int)S("Apps", "Techo", false)! == 3000, "no se esperan 700 ms cuando ya estaba delante y 3 s cuando no");
    }

    private static void P469()
    {
        // Ronda libre L1 (2026-09-26, 20:24): «no pude abrir https://…» 13 veces en un pedido, ~5 s cada una. Con Chrome
        // delante la dirección se abre en una pestaña de la MISMA ventana, y abrir esperaba a que cambiara la ventana.
        bool Llego(long a, string ta, long b, string tb) => (bool)S("Apps", "Llego", new IntPtr(a), ta, new IntPtr(b), tb)!;
        Exige(Llego(100, "Wikipedia - Google Chrome", 100, "Isaac Newton - Wikipedia - Google Chrome"), "una pestaña nueva en la misma ventana no cuenta como llegar");
        Exige(Llego(100, "Claude", 200, "Calculadora"), "una ventana nueva no cuenta como llegar");
        Exige(!Llego(100, "Wikipedia - Google Chrome", 100, "Wikipedia - Google Chrome"), "sin cambiar ni ventana ni título se dio por llegado");
        Exige(!Llego(100, "Chrome", 0, ""), "sin ventana delante se dio por llegado");
    }

    private static void P468()
    {
        // La prueba libre del dueño (2026-09-26, 19:15): «haz muchas pruebas durante media hora» terminó a los 28 s.
        var lunaT = T("LunaPorTexto");
        var ctor = lunaT.GetConstructor(new[] { typeof(string), typeof(HttpMessageHandler) }) ?? throw new Pendiente("LunaPorTexto(clave, manejador)");
        var pedir = lunaT.GetMethods().First(m => m.Name == "Pedir" && m.GetParameters().Length == 5);
        var luna = new LunaDeMentira(n => n <= 2 ? LunaDeMentira.Hacer(n) : LunaDeMentira.Dice(n, "listo"));
        var t = TimeSpan.Zero;
        using (var l = (IDisposable)ctor.Invoke(new object[] { "sk-de-mentira", luna }))
            pedir.Invoke(l, new object[] { "haz pruebas durante media hora", (Func<string>)(() => "pantalla"),
                (Func<string, string, string>)((_, _) => "✔ hecho"), (Func<bool>)(() => false), (Func<TimeSpan>)(() => t += TimeSpan.FromSeconds(95)) });
        using (var d = JsonDocument.Parse(luna.Cuerpos[1]))
        {
            string salida = d.RootElement.GetProperty("input").GetRawText();
            Exige(salida.Contains("Llevas") && salida.Contains("min"), $"el resultado que recibe Luna no dice cuánto lleva: {salida}");
        }
        string instr = (string)(T("ProtocoloVivo").GetField("InstruccionesDeLuna")?.GetValue(null) ?? "");
        Exige(instr.Contains("sigue hasta cumplirla"), "Luna no sabe que una duración pedida se cumple");
    }

    private static void P467()
    {
        // Rondas del 2026-09-26 y la prueba libre del dueño (19:15): «abre https://…» y «objetivo: poner el foco en la
        // barra» como objetivos (la barra de direcciones pulsada 3 veces, dos veces), «escribir una nota de prueba»
        // (el editor pulsado 3 veces) y «esperar a que aparezcan los resultados» («Navegador» pulsado 6 veces).
        string N(string paso) => (string)S("Ejecutor", "Normalizar", paso)!;
        Exige(N("ir a https://scholar.google.com") == "abre: https://scholar.google.com", $"«ir a https://…» quedó «{N("ir a https://scholar.google.com")}»");
        Exige(N("abre https://xenco.com.co/safix-2/") == "abre: https://xenco.com.co/safix-2/", $"«abre https://…» sin dos puntos quedó «{N("abre https://xenco.com.co/safix-2/")}»");
        Exige(N("entrar a www.wikipedia.org") == "abre: https://www.wikipedia.org", $"«entrar a www.…» quedó «{N("entrar a www.wikipedia.org")}»");
        Exige(N("objetivo: pulsar Buscar") == "pulsar Buscar", $"«objetivo:» no se quitó: «{N("objetivo: pulsar Buscar")}»");
        Exige(N("abrir el menú Archivo") == "abrir el menú Archivo" && N("escribe: hola") == "escribe: hola", "se tocó un paso que estaba bien");
        Exige(N("pulsar el enlace «Ver en https://ejemplo.com»") == "pulsar el enlace «Ver en https://ejemplo.com»", "un objetivo que solo NOMBRA una dirección se convirtió en abrirla");

        var (e, anotado) = Ejecutor(_ => true);
        (e.GetType().GetProperty("EsperarQuieta") ?? throw new Pendiente("Ejecutor.EsperarQuieta")).SetValue(e, (Func<bool>)(() => { anotado.Add("esperar"); return true; }));
        var r = I(e, "Ejecutar", new List<string> { "ir a https://scholar.google.com", "objetivo: pulsar Buscar", "esperar a que aparezcan los resultados" })!;
        Exige(anotado.Count == 3 && anotado[0] == "abrir https://scholar.google.com" && anotado[1].StartsWith("jev pulsar Buscar") && anotado[2] == "esperar",
            $"los pasos no se hicieron como gestos: {string.Join(" | ", anotado)}");

        anotado.Clear();
        var r2 = I(e, "Ejecutar", new List<string> { "escribir una nota de prueba sin guardar", "tecla: Ctrl+S" })!;
        var est = L(P(P(r2, "Resultado")!, "Pasos")).Select(p => (string)P(p, "Estado")!).ToList();
        string relato = (string)I(r2, "Relato")!;
        Exige(anotado.Count == 0 && est.SequenceEqual(new[] { "Fallido", "Omitido" }) && relato.Contains("escribe:"),
            $"«escribir…» sin texto no falló al instante pidiendo «escribe:»: {string.Join(" | ", anotado)} · {string.Join(",", est)} · {relato}");

        string luna = (string)(T("ProtocoloVivo").GetField("InstruccionesDeLuna")?.GetValue(null) ?? "");
        Exige(luna.Contains("nunca como objetivo"), "Luna no sabe que las direcciones y los textos no son objetivos");
    }

    /// <summary>Un TypeSafe de mentira: corta la conexión las primeras veces que diga «cortes», y luego contesta.</summary>
    private sealed class JevDeMentira : HttpMessageHandler
    {
        public int Peticiones;
        private readonly Func<int, Exception?> _falla;
        public JevDeMentira(Func<int, Exception?> falla) => _falla = falla;
        protected override HttpResponseMessage Send(HttpRequestMessage req, CancellationToken ct)
        {
            Peticiones++;
            var e = _falla(Peticiones);
            if (e != null) throw e;
            return new HttpResponseMessage(System.Net.HttpStatusCode.OK) { Content = new StringContent("{\"ok\":1}") };
        }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct) => Task.FromResult(Send(req, ct));
    }

    private static void P466()
    {
        // Rondas del 2026-09-26: «Jev no contestó: Host desconocido (api.typesafe.ai:443)» en casi todas —la batería
        // de topes contó 4 en una sola tarea, la web de Safix perdió 2 de sus 3 turnos—. Luna ya reintentaba (461).
        var ctor = T("ClienteJev").GetConstructor(new[] { typeof(string), typeof(HttpMessageHandler) }) ?? throw new Pendiente("ClienteJev(clave, manejador)");
        static Exception SinConexion() => new HttpRequestException("Host desconocido. (api.typesafe.ai:443)", new System.Net.Sockets.SocketException(11001));
        string Preguntar(JevDeMentira j)
        {
            using var c = (IDisposable)ctor.Invoke(new object[] { "sk-de-mentira", j });
            try { return (string)c.GetType().GetMethod("Preguntar")!.Invoke(c, new object[] { "{}" })!; }
            catch (TargetInvocationException e) when (e.InnerException != null) { throw e.InnerException; }
        }

        var dos = new JevDeMentira(n => n <= 2 ? SinConexion() : null);
        Exige(Preguntar(dos) == "{\"ok\":1}" && dos.Peticiones == 3, $"con dos cortes Jev no contestó al tercer intento ({dos.Peticiones} peticiones)");

        var nunca = new JevDeMentira(_ => SinConexion());
        string falla = "";
        try { Preguntar(nunca); } catch (HttpRequestException e) { falla = e.Message; }
        Exige(nunca.Peticiones == 3 && falla.Contains("Host desconocido") && falla.Contains("3"), $"sin red: {nunca.Peticiones} peticiones · «{falla}»");

        var plazo = new JevDeMentira(_ => new TaskCanceledException("The request was canceled due to the configured HttpClient.Timeout"));
        try { Preguntar(plazo); } catch (Exception) { }
        Exige(plazo.Peticiones == 1, $"un plazo agotado se reintentó ({plazo.Peticiones} peticiones)");
    }

    private static void P465()
    {
        // Ronda 1 de la batería de topes (2026-09-26, 19:57): el enlace del PDF, pulsado tres veces porque a los 150 ms
        // la página aún no había cambiado. Cada clic de más puede abrir otra pestaña.
        int Techo(string tipo) => (int)S("Asentado", "TechoTras", tipo)!;
        Exige(Techo("Hyperlink") == 1500, $"tras un enlace se espera {Techo("Hyperlink")} ms");
        Exige(Techo("Button") == 150 && Techo("ListItem") == 150 && Techo("TabItem") == 150, "tras otro clic no se esperan 150 ms");

        // Y el motor la usa: una página que cambia a los ~300 ms se ve cambiar tras un enlace, y no tras un botón.
        string Resultado(string tipo)
        {
            int pulsos = 0; var reloj = Stopwatch.StartNew(); long pulsadoEn = long.MaxValue;
            var lecturaT = T("Lectura");
            Func<object> leer = () =>
            {
                Thread.Sleep(40);
                bool cargo = reloj.ElapsedMilliseconds - pulsadoEn > 300;
                return N("Lectura", Lista((cargo ? "Página nueva" : "Página vieja", "Text"), ("Paper", tipo)), new List<string>());
            };
            var p = System.Linq.Expressions.Expression.Parameter(T("Contexto"), "c");
            var dDecidir = System.Linq.Expressions.Expression.Lambda(typeof(Func<,>).MakeGenericType(T("Contexto"), T("Eleccion")),
                System.Linq.Expressions.Expression.Convert(System.Linq.Expressions.Expression.Invoke(
                    System.Linq.Expressions.Expression.Constant((Func<object, object>)(_ => pulsos == 0 ? Eleccion(true, 2) : Eleccion(false, 0, cumplido: 0.9))),
                    System.Linq.Expressions.Expression.Convert(p, typeof(object))), T("Eleccion")), p).Compile();
            var motor = N("Motor", Delegado(typeof(Func<>).MakeGenericType(T("Ubicacion")), () => Ubicacion(7, "chrome")),
                Delegado(typeof(Func<>).MakeGenericType(lecturaT), () => leer()), dDecidir,
                DelegadoAccion(typeof(Action<>).MakeGenericType(T("Accionable")), _ => { pulsos++; pulsadoEn = reloj.ElapsedMilliseconds; }), (Func<bool>)(() => false));
            var r = I(motor, "Objetivo", "abrir el paper", 5)!;
            return (string)P(L(P(r, "Vueltas"))[0], "Resultado")!;
        }
        Exige(Resultado("Hyperlink") == "cambió", $"tras un enlace que tarda 300 ms, el motor dijo «{Resultado("Hyperlink")}»");
        Exige(Resultado("Button") == "no cambió", "tras un botón se esperó más de 150 ms");
    }

    private static void P464()
    {
        // Almejas (2026-09-26, 08:53): «ir a https://…» agotó los 8 pasos pulsando la barra de direcciones; y un
        // objetivo que de verdad necesita más de 8 clics —123456 por 789 con los botones— moría igual.
        var campo = T("Asistente").GetField("PasosDeSeguridad") ?? throw new Pendiente("Asistente.PasosDeSeguridad");
        int seguridad = (int)campo.GetValue(null)!;
        Exige(seguridad >= 50, $"la red de seguridad es de {seguridad} pasos: un objetivo largo se corta");

        // 20 clics que avanzan, y cumplido: no se corta.
        var (largo, pl) = Motor(v => v > 20 ? Eleccion(false, 0, cumplido: 0.9, porque: "cumplido") : Eleccion(true, 2), true);
        var rl = I(largo, "Objetivo", "calcular 123456 por 789", seguridad)!;
        Exige(pl.Count == 20 && (bool)P(rl, "Cumplido")!, $"un objetivo de 20 clics que avanza no llegó: {pl.Count} pulsos · {P(rl, "PorQueParo")}");

        // Un bucle entre dos pantallas —pestaña A, pestaña B, A, B…—: la hondura del cambio no lo salva.
        var (bucle, pb) = Motor(_ => Eleccion(true, 2), true, pantalla: n => n % 2 == 0 ? "Pestaña A" : "Pestaña B");
        var rb = I(bucle, "Objetivo", "ir a los resultados", seguridad)!;
        Exige(pb.Count == 5 && ((string)P(rb, "PorQueParo")!).Contains("bucle"), $"un bucle A→B→A no se detuvo a la tercera en A: {pb.Count} pulsos · {P(rb, "PorQueParo")}");

        // Pulsar lo mismo en pantallas distintas no es bucle: el «0» de la calculadora, tres veces seguidas.
        var (ceros, pc) = Motor(v => v > 3 ? Eleccion(false, 0, cumplido: 0.9, porque: "cumplido") : Eleccion(true, 2), true, pantalla: n => "Pantalla: 1" + new string('0', n));
        var rc = I(ceros, "Objetivo", "escribir 1000", seguridad)!;
        Exige(pc.Count == 3 && (bool)P(rc, "Cumplido")!, $"el mismo botón en pantallas distintas se tomó por bucle: {pc.Count} pulsos · {P(rc, "PorQueParo")}");
    }

    /// <summary>Una Luna de mentira: contesta lo que diga «guion» para cada petición, y anota los cuerpos que recibe.</summary>
    private sealed class LunaDeMentira : HttpMessageHandler
    {
        public readonly List<string> Cuerpos = new();
        private readonly Func<int, string> _guion;
        public LunaDeMentira(Func<int, string> guion) => _guion = guion;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct)
        {
            Cuerpos.Add(req.Content!.ReadAsStringAsync(ct).GetAwaiter().GetResult());
            return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK)
                { Content = new StringContent(_guion(Cuerpos.Count), System.Text.Encoding.UTF8, "application/json") });
        }
        public static string Hacer(int n) => $"{{\"id\":\"r{n}\",\"output\":[{{\"type\":\"function_call\",\"name\":\"hacer\",\"arguments\":\"{{\\\"pasos\\\":[\\\"x\\\"]}}\",\"call_id\":\"c{n}\"}}]}}";
        public static string Dice(int n, string texto) => $"{{\"id\":\"r{n}\",\"output\":[{{\"type\":\"message\",\"content\":[{{\"type\":\"output_text\",\"text\":\"{texto}\"}}]}}]}}";
    }

    private static void P463()
    {
        // Almejas (2026-09-26, 08:53) y Copilot→Neon (10:00): «Luna usó 8 turnos de herramientas sin terminar: paro»,
        // la primera con los papers ya abiertos. Un tope fijo corta igual una tarea que avanza que una atascada.
        var lunaT = T("LunaPorTexto");
        var ctor = lunaT.GetConstructor(new[] { typeof(string), typeof(HttpMessageHandler) }) ?? throw new Pendiente("LunaPorTexto(clave, manejador)");
        var pedir = lunaT.GetMethods().FirstOrDefault(m => m.Name == "Pedir" && m.GetParameters().Length == 5) ?? throw new Pendiente("LunaPorTexto.Pedir/5");
        string Correr(LunaDeMentira luna, Func<string> pantalla, Func<bool> parar, Func<TimeSpan> reloj)
        {
            using var l = (IDisposable)ctor.Invoke(new object[] { "sk-de-mentira", luna });
            Func<string, string, string> atender = (_, _) => "✔ hecho\n\nAhora:\n" + pantalla();
            try { return (string)pedir.Invoke(l, new object[] { "haz algo largo", pantalla, atender, parar, reloj })!; }
            catch (System.Reflection.TargetInvocationException e) when (e.InnerException != null) { throw e.InnerException; }
        }
        var cero = TimeSpan.Zero;

        // 12 turnos que avanzan: la pantalla cambia cada vez. Ninguno se corta; al 13 Luna contesta.
        int paso = 0;
        var avanza = new LunaDeMentira(n => n <= 12 ? LunaDeMentira.Hacer(n) : LunaDeMentira.Dice(n, "listo: 12 pantallas"));
        string r1 = Correr(avanza, () => "Ventana delante: pantalla " + paso++, () => false, () => cero);
        Exige(r1 == "listo: 12 pantallas" && avanza.Cuerpos.Count == 13, $"una tarea que avanza se cortó: {avanza.Cuerpos.Count} peticiones · «{r1}»");

        // La misma pantalla 12 turnos seguidos no es estar atascada: en la web de Safix (2026-09-26, 15:46) desplazar y
        // saltar a una sección dejó la misma lista —Chrome da el documento entero— y la regla de «3 turnos sin cambio»
        // cortó una tarea que avanzaba. Sigue hasta que Luna conteste.
        var igual = new LunaDeMentira(n => n <= 12 ? LunaDeMentira.Hacer(n) : LunaDeMentira.Dice(n, "recorrí las cinco secciones"));
        string r2 = Correr(igual, () => "Ventana delante: siempre la misma", () => false, () => cero);
        Exige(igual.Cuerpos.Count == 13 && r2 == "recorrí las cinco secciones", $"con la pantalla igual se cortó: {igual.Cuerpos.Count} peticiones · «{r2}»");

        // Escape pulsado durante el primer turno: para al terminarlo, y el cierre no deja usar herramientas.
        int llamadas = 0;
        var conEscape = new LunaDeMentira(n => n == 1 ? LunaDeMentira.Hacer(n) : LunaDeMentira.Dice(n, "iba por la mitad"));
        string r3 = Correr(conEscape, () => "pantalla " + llamadas++, () => true, () => cero);
        Exige(conEscape.Cuerpos.Count == 2 && r3.StartsWith("Paré:") && r3.Contains("Escape") && r3.Contains("iba por la mitad"),
            $"Escape no paró contando lo logrado: {conEscape.Cuerpos.Count} peticiones · «{r3}»");
        using (var d = JsonDocument.Parse(conEscape.Cuerpos[^1]))
        {
            bool sinHerramientas = d.RootElement.TryGetProperty("tool_choice", out var tc) && tc.GetString() == "none";
            Exige(sinHerramientas, "el cierre deja a Luna usar herramientas");
            Exige(d.RootElement.GetProperty("input").GetRawText().Contains("function_call_output"), "el cierre no devuelve el resultado del último turno");
        }

        // Sesenta minutos: la red de seguridad, aunque avance. Eran 10, y una «media hora» pedida se habría cortado. El reloj va a 15 min por turno: a los 60 son 4 turnos y el cierre, 5 peticiones.
        int q = 0; var t = TimeSpan.Zero;
        var larga = new LunaDeMentira(n => n <= 50 ? LunaDeMentira.Hacer(n) : LunaDeMentira.Dice(n, "no terminé"));
        string r4 = Correr(larga, () => "pantalla " + q++, () => false, () => TimeSpan.FromMinutes(15 * larga.Cuerpos.Count));
        Exige(r4.StartsWith("Paré:") && r4.Contains("60 minutos") && larga.Cuerpos.Count == 5, $"el tope de 60 minutos no paró: {larga.Cuerpos.Count} peticiones · «{r4}»");
    }

    private static void P462()
    {
        // La prueba de las almejas (2026-09-26, 08:53): Luna pidió «desplazarse por los resultados» como objetivo,
        // Jev solo sabe pulsar, y eligió la barra de direcciones con confianza 0,30. Un turno de Luna perdido.
        int? Muescas(string s) => (int?)S("Ejecutor", "LeerDesplazamiento", s);
        Exige(Muescas("abajo") == -5 && Muescas("arriba") == 5, $"sin número no son 5 muescas: abajo {Muescas("abajo")}, arriba {Muescas("arriba")}");
        Exige(Muescas("abajo 3") == -3 && Muescas("arriba 2") == 2 && Muescas("down 4") == -4, "el número de muescas no se respeta");
        Exige(Muescas("abajo 50") == -20, $"«abajo 50» son {Muescas("abajo 50")} muescas: el tope es 20");
        Exige(Muescas("a la izquierda") == null && Muescas("") == null, "una dirección que no se entiende se tomó por buena");

        var rueda = L(S("Raton", "EventosDeRueda", -2)).Select(o => o.ToString()!).ToList();
        Exige(rueda.SequenceEqual(new[] { "rueda -120", "rueda -120" }), $"dos muescas abajo no son dos eventos de -120: {string.Join(" | ", rueda)}");
        Exige(L(S("Raton", "EventosDeRueda", 1)).Select(o => o.ToString()).SequenceEqual(new[] { "rueda 120" }), "una muesca arriba no es +120");

        var (e, anotado) = Ejecutor(_ => true);
        var prop = e.GetType().GetProperty("Desplazar") ?? throw new Pendiente("Ejecutor.Desplazar");
        prop.SetValue(e, (Func<int, bool>)(n => { anotado.Add("desplazar " + n); return true; }));
        var r = I(e, "Ejecutar", new List<string> { "desplaza: abajo 3", "desplaza: arriba" })!;
        Exige(anotado.SequenceEqual(new[] { "desplazar -3", "desplazar 5" }), $"el desplazamiento no se hizo tal cual: {string.Join(" | ", anotado)}");
        Exige(!anotado.Any(a => a.StartsWith("jev")), "desplazar le preguntó a Jev");
        var estados = L(P(P(r, "Resultado")!, "Pasos")).Select(p => (string)P(p, "Estado")!).ToList();
        Exige(estados.All(s => s == "Hecho"), $"estados: {string.Join(",", estados)}");

        anotado.Clear();
        var r2 = I(e, "Ejecutar", new List<string> { "desplaza: en diagonal", "tecla: Enter" })!;
        var est2 = L(P(P(r2, "Resultado")!, "Pasos")).Select(p => (string)P(p, "Estado")!).ToList();
        string relato = (string)I(r2, "Relato")!;
        Exige(est2.SequenceEqual(new[] { "Fallido", "Omitido" }) && anotado.Count == 0, $"una dirección desconocida no hizo fallar el paso: {string.Join(",", est2)} · {string.Join(" | ", anotado)}");
        Exige(relato.Contains("en diagonal"), $"el fallo no dice qué dirección no entendió: {relato}");

        string luna = (string)(T("ProtocoloVivo").GetField("InstruccionesDeLuna")?.GetValue(null) ?? "");
        Exige(luna.Contains("«desplaza:"), "Luna no sabe que puede desplazar");
    }

    private static void P461()
    {
        // Lo que pasó el 2026-09-25 (20:45 y 21:09): «Host desconocido (api.openai.com:443)» sin capturar, el
        // proceso se cerró y el log se quedó en «Jev caliente», sin una línea que dijera por qué.
        static Exception SinConexion() => new HttpRequestException("Host desconocido. (api.openai.com:443)",
            new System.Net.Sockets.SocketException(11001));
        var esperas = new List<int>();
        Action<int> esperar = ms => esperas.Add(ms);

        // Dos cortes y luego contesta: llega, al tercer intento.
        int n = 0;
        Func<HttpResponseMessage> dosCortes = () => ++n <= 2 ? throw SinConexion() : new HttpResponseMessage(System.Net.HttpStatusCode.OK);
        var r1 = S("LunaPorTexto", "Enviar", dosCortes, esperar)!;
        Exige(P(r1, "Respuesta") != null && (int)P(r1, "Intentos")! == 3, $"con dos cortes y luego respuesta no llegó al tercer intento: {r1}");
        Exige(esperas.Count == 2 && esperas.All(ms => ms > 0), $"entre intentos no se esperó: {string.Join(",", esperas)}");

        // La red no vuelve: no lanza, dice la causa entera, y no pasa de 3 intentos.
        n = 0; esperas.Clear();
        Func<HttpResponseMessage> sinRed = () => { n++; throw SinConexion(); };
        object r2;
        try { r2 = S("LunaPorTexto", "Enviar", sinRed, esperar)!; }
        catch (Exception e) when (e is not Pendiente) { throw new Incumplida($"un corte de red salió como excepción: {e.GetType().Name}: {e.Message}"); }
        string falla = (string)(P(r2, "Falla") ?? "");
        Exige(P(r2, "Respuesta") == null && n == 3, $"sin red se intentó {n} veces");
        Exige(falla.Contains("Host desconocido") && falla.Contains("SocketException"), $"la falla no dice la causa entera: «{falla}»");

        // Lo que ya salió no se repite: un plazo agotado puede haber llegado a Luna y hecho algo.
        n = 0;
        Func<HttpResponseMessage> plazo = () => { n++; throw new TaskCanceledException("The request was canceled due to the configured HttpClient.Timeout"); };
        var r3 = S("LunaPorTexto", "Enviar", plazo, esperar)!;
        Exige(n == 1 && P(r3, "Respuesta") == null, $"un plazo agotado se reintentó ({n} intentos)");
        Exige(((string)(P(r3, "Falla") ?? "")).Contains("TaskCanceledException"), $"el plazo agotado no se dice: «{P(r3, "Falla")}»");
    }

    // ── Delegados tipados sobre tipos que el contrato solo conoce por nombre ───────────────────

    private static Delegate Delegado(Type t, Func<object?> f) =>
        System.Linq.Expressions.Expression.Lambda(t,
            System.Linq.Expressions.Expression.Convert(
                System.Linq.Expressions.Expression.Invoke(System.Linq.Expressions.Expression.Constant(f)),
                t.GetGenericArguments()[0])).Compile();

    private static Delegate DelegadoDe3(Type t, Func<object?, object?, object?, object?> f)
    {
        var g = t.GetGenericArguments();
        var ps = g.Take(3).Select(System.Linq.Expressions.Expression.Parameter).ToArray();
        var cuerpo = System.Linq.Expressions.Expression.Convert(
            System.Linq.Expressions.Expression.Invoke(System.Linq.Expressions.Expression.Constant(f),
                ps.Select(p => System.Linq.Expressions.Expression.Convert(p, typeof(object)))),
            g[3]);
        return System.Linq.Expressions.Expression.Lambda(t, cuerpo, ps).Compile();
    }

    private static Delegate DelegadoAccion(Type t, Action<object?> f)
    {
        var p = System.Linq.Expressions.Expression.Parameter(t.GetGenericArguments()[0]);
        return System.Linq.Expressions.Expression.Lambda(t,
            System.Linq.Expressions.Expression.Invoke(System.Linq.Expressions.Expression.Constant(f),
                System.Linq.Expressions.Expression.Convert(p, typeof(object))), p).Compile();
    }
}
