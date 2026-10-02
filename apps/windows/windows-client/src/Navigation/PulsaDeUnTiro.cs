using System.Diagnostics;
using System.Globalization;
using U.Ciclo;

namespace U.WindowsClient.Navigation;

/// <summary>
/// UN «pulsa:» CUYO NOMBRE NO ESTÁ, RESUELTO DE UN TIRO (spec 081, promesas 791 y 794): las manos eligen UNA vez
/// qué es eso en esta pantalla, sobre la lectura que ya se hizo, lo pulsan y el paso termina.
/// </summary>
/// <remarks>
/// LO QUE COSTABA NO TENERLO. Medido el 2026-10-01 con «calcula 123 por 45 pulsando los botones»: quien planea
/// escribió «pulsa: 1», «pulsa: 2»…, y ningún botón se llama así («Uno», «Dos», «Multiplicar por», «Es igual a»).
/// Cada paso buscó el nombre y volvió a leer, esperó a que la pantalla se quedara quieta (166–273 ms, dos lecturas
/// más), buscó otra vez, y se lo pasó a las manos como el objetivo «llegar a «1» y pulsarlo», con su propia
/// lectura, una vuelta de 408 a 813 ms y a veces otra para oír «cumplido»: 1.260 ms por clic, contra 357 por el
/// nombre exacto. Y una vez el objetivo pulsó «=» DOS veces —nadie le había dicho que era un solo clic—, el
/// resultado salió mal y la cuenta se repitió entera.
///
/// POR QUÉ NO HACE FALTA ESPERAR. La búsqueda que falla ya leyó la pantalla dos veces seguidas
/// (<see cref="CicloRapido.QuietaAlNoEncontrar"/>): si las dos lecturas son iguales, la pantalla está quieta, que
/// es justo lo que la espera de la 524 comprobaba con dos lecturas más. Si no lo son —la página carga—, aquí no se
/// elige nada y el paso sigue como hasta hoy: esperar, buscar otra vez y, si tampoco, llegar hasta él (525).
///
/// Y POR QUÉ ES UN SOLO CLIC. Un «pulsa:» es un gesto, no un objetivo: se pregunta una vez, se pulsa una vez, y no
/// hay vuelta de confirmación ni ocasión de pulsar lo mismo otra vez. Lo que no se debe pulsar lo siguen parando
/// las compuertas de siempre —la confianza y el peligro—, y entonces tampoco se elige nada.
///
/// ESTA CLASE NO LEE LA PANTALLA NI PULSA: todo le llega inyectado, y el contrato la juzga sin pantalla.
/// </remarks>
public sealed class PulsaDeUnTiro
{
    private readonly Func<(string Pantalla, Lectura Lectura)?> _loQueSeVe;
    private readonly Func<Contexto, Eleccion> _elegir;
    private readonly Func<Accionable, string?> _pulsar;
    private readonly Func<Lectura, Accionable, bool> _verDespues;

    /// <param name="loQueSeVe">La lectura con que la búsqueda acaba de fallar, y dónde; null si no la vio quieta.</param>
    /// <param name="elegir">Las manos eligen: una decisión.</param>
    /// <param name="pulsar">La mano de siempre, que mira bajo el punto (517): null si pulsó; si no, por qué no.</param>
    /// <param name="verDespues">Espera a que la pantalla cambie tras pulsar eso, y dice si cambió.</param>
    public PulsaDeUnTiro(Func<(string Pantalla, Lectura Lectura)?> loQueSeVe, Func<Contexto, Eleccion> elegir,
        Func<Accionable, string?> pulsar, Func<Lectura, Accionable, bool> verDespues)
    {
        _loQueSeVe = loQueSeVe; _elegir = elegir; _pulsar = pulsar; _verDespues = verDespues;
    }

    /// <summary>
    /// Por qué el último <see cref="Resolver"/> no resolvió (devolvió null), con el nombre que se buscaba. Tres
    /// causas, tres frases (aprendizaje nº2): no había lectura quieta, la pantalla no se dejó leer, o las manos no
    /// se atrevieron —y entonces, con su motivo—.
    /// </summary>
    public string PorQueNo { get; private set; } = "";

    /// <summary>A las manos se les pregunta por ESE nombre, y se les dice que es un solo clic.</summary>
    public static string Objetivo(string nombre) =>
        $"pulsar «{nombre}»: es UN clic en esta pantalla, sobre el accionable que es eso aunque se llame de otra forma "
        + "(un número o un símbolo escrito con letras, otro idioma, un nombre más largo)";

    /// <summary>
    /// El paso resuelto —cumplido, o fallido si la mano no pudo pulsar—; o null si aquí no se elige nada y el paso
    /// tiene que seguir por el camino de siempre. <see cref="PorQueNo"/> dice entonces por qué.
    /// </summary>
    public Recorrido? Resolver(string nombre, IReadOnlyList<string> hecho)
    {
        PorQueNo = "";
        var visto = _loQueSeVe();
        if (visto == null)
        {
            PorQueNo = $"no hay una lectura quieta de la pantalla donde buscar «{nombre}»: puede estar cargando";
            return null;
        }
        var (pantalla, lectura) = visto.Value;
        if (lectura.Accionables.Count == 0)
        {
            PorQueNo = $"la pantalla no se dejó leer: no hay accionables entre los que buscar «{nombre}»";
            return null;
        }

        var reloj = Stopwatch.StartNew();
        var e = _elegir(new Contexto(pantalla, Objetivo(nombre), lectura.Accionables, lectura.Textos, hecho ?? Array.Empty<string>()) { Foco = lectura.Foco });
        double msDecidir = reloj.Elapsed.TotalMilliseconds;
        var a = e.Pulsar ? lectura.Accionables.FirstOrDefault(x => x.Numero == e.Numero) : null;
        if (a == null)
        {
            PorQueNo = $"las manos no se atrevieron con «{nombre}» entre los {lectura.Accionables.Count} accionable(s) de «{pantalla}»: "
                     + (e.Pulsar ? $"eligieron el {e.Numero}, que no está en la lista" : e.Porque);
            return null;
        }

        reloj.Restart();
        string? laManoNo = _pulsar(a);
        double msPulsar = reloj.Elapsed.TotalMilliseconds;
        string conf = e.Confianza.ToString("0.00", CultureInfo.InvariantCulture);
        if (!string.IsNullOrWhiteSpace(laManoNo))
        {
            var sinPulsar = new Vuelta(1, new Tiempos(0, 0, msDecidir, msPulsar, 0), pantalla, lectura.Accionables.Count, "", laManoNo);
            return new Recorrido(new[] { sinPulsar }, $"«{nombre}» no estaba con ese nombre; las manos eligieron «{a.Nombre}» ({conf}), pero {laManoNo}", false);
        }

        reloj.Restart();
        bool cambio = _verDespues(lectura, a);
        double msAsentar = reloj.Elapsed.TotalMilliseconds;
        var vuelta = new Vuelta(1, new Tiempos(0, 0, msDecidir, msPulsar, msAsentar), pantalla, lectura.Accionables.Count, a.Id, cambio ? "cambió" : "no cambió");
        // LO QUE SE ELIGIÓ, CON SU NOMBRE DE VERDAD (794): al log le dice por qué este clic costó más que uno por nombre,
        // y a quien planea le da el nombre exacto para el plan siguiente.
        return new Recorrido(new[] { vuelta },
            $"cumplido: «{nombre}» no estaba con ese nombre entre los {lectura.Accionables.Count} accionable(s); las manos eligieron «{a.Nombre}» ({conf}) y lo pulsé"
            + (cambio ? "" : ", y la pantalla no cambió"), true);
    }
}
