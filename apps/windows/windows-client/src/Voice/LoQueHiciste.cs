using U.WindowsClient.Navigation;

namespace U.WindowsClient.Voice;

/// <summary>
/// LO QUE LA PERSONA HA TOCADO desde la última vez que se preguntó (spec 074, de la 046), Y CÓMO SE VEÍA LA
/// PANTALLA AL TOCARLO (spec 078). Es lo que hace que «mira, se hace así» sirva: quien actúa pregunta, y le
/// llegan los clics con el mismo nombre con que <c>map_take</c> los encuentra, y la foto de cada uno.
/// </summary>
/// <remarks>
/// <para>SE ENTREGA UNA SOLA VEZ (promesa 706). Tomar vacía el rastro: si la siguiente consulta repitiera lo
/// ya entregado, el mismo paso entraría dos veces en la habilidad.</para>
/// <para>LA FOTO ES DEL INSTANTE DE PULSAR, no del de resolver (promesa 742). Entre el clic y saber qué era
/// pasan decenas de milisegundos de UIA, y para entonces la pantalla ya enseña el efecto del clic: el menú
/// abierto, la ventana siguiente. Lo que explica «pulsé ESTO» es lo que había debajo del cursor al pulsar, y
/// la captura ya dibuja el cursor encima.</para>
/// <para>POR QUÉ HACE FALTA LA FOTO. Dentro de SAP GUI, UIA ve un panel opaco: cuatro clics eran cuatro líneas
/// sin nombre, y sin nombre ni se contaban. Con su foto, un clic sin nombre se puede explicar.</para>
/// <para>SOLO MIENTRAS HAY SESIÓN (<see cref="ConFotos"/>). La pantalla de la persona no se retiene porque sí:
/// sin una conversación abierta que pueda usarla, no se toma ninguna.</para>
/// <para>SOLO ANOTA. Los avisos del vigía de clics llegan desde su gancho o justo detrás: aquí un candado, una
/// línea, y la captura lanzada a otro hilo. Nada que haga esperar al ratón.</para>
/// </remarks>
public sealed class LoQueHiciste
{
    /// <summary>Los últimos clics que se guardan. Nadie enseña 60 clics sin que se le pregunte; sin tope, crecería toda la sesión.</summary>
    public const int Tope = 60;

    /// <summary>De cuántos clics se guarda la foto: los últimos. Cada foto que viaja a quien actúa son ~1,1 s de
    /// subida y unos 30 ms más en cada vuelta suya durante el resto de la sesión.</summary>
    public const int TopeDeFotos = 4;

    /// <summary>Un clic de la persona, dicho para leerlo, con la pantalla del instante en que pulsó si se tomó.</summary>
    public sealed record Tocado(string Linea, byte[]? Foto);

    private sealed class Apunte
    {
        public string Linea = "";
        public Task<byte[]?>? Foto;
    }

    private readonly object _candado = new();
    private readonly Queue<Apunte> _hecho = new();
    /// <summary>Lo pulsado cuya identidad todavía no se ha resuelto: el punto y la foto que se está tomando.</summary>
    private readonly List<(int X, int Y, Task<byte[]?> Foto)> _alPulsar = new();

    /// <summary>Si se guardan fotos. La enciende la conversación al abrir y la apaga al cerrar.</summary>
    public bool ConFotos { get; set; }

    /// <summary>Se avisa de cada clic anotado, con su línea.</summary>
    public event Action<string>? Anotado;

    /// <summary>Lo mismo, con la foto que se está tomando (o null): es por donde el clic entra al diario de la sesión.</summary>
    public event Action<string, Task<byte[]?>?>? AnotadoConFoto;

    /// <summary>El rastro de la máquina, enganchado al vigía de clics desde que alguien lo pide por primera vez.</summary>
    public static LoQueHiciste DeLaPersona => Unico.Value;

    private static readonly Lazy<LoQueHiciste> Unico = new(() =>
    {
        var r = new LoQueHiciste();
        // AL PULSAR, la foto: fuera del gancho —capturar son decenas de milisegundos—, y solo si hay sesión.
        ClickWatcher.AlPulsar += (x, y, _) =>
        {
            if (r.ConFotos) r.AlPulsar(x, y, Task.Run(() => CapturaDePantalla.Capturar()));
        };
        ClickWatcher.AlResolver += (x, y, selector, etiqueta, tipo, proceso) => r.AnotarEn(x, y, selector, etiqueta, tipo, proceso);
        return r;
    });

    /// <summary>La persona acaba de pulsar en ese punto, y esta es la foto que se está tomando de ese instante.</summary>
    public void AlPulsar(int x, int y, Task<byte[]?>? foto)
    {
        if (!ConFotos || foto == null) return;
        lock (_candado)
        {
            _alPulsar.Add((x, y, foto));
            // Un clic que nunca se resuelve —la ventana cambió, era de la propia Ü— no deja su foto aquí para siempre.
            while (_alPulsar.Count > 8) _alPulsar.RemoveAt(0);
        }
    }

    /// <summary>Un clic resuelto sin saber dónde fue: como hasta la spec 078, sin foto.</summary>
    public void Anotar(string selector, string etiqueta, string tipo, string proceso)
        => Apuntar(null, -1, -1, selector, etiqueta, tipo, proceso);

    /// <summary>Un clic resuelto, con el punto donde fue: se le junta la foto que se tomó al pulsar ahí.</summary>
    public void AnotarEn(int x, int y, string selector, string etiqueta, string tipo, string proceso)
    {
        Task<byte[]?>? foto = null;
        lock (_candado)
        {
            int i = _alPulsar.FindLastIndex(p => p.X == x && p.Y == y);
            if (i >= 0) { foto = _alPulsar[i].Foto; _alPulsar.RemoveAt(i); }
        }
        Apuntar(ConFotos ? foto : null, x, y, selector, etiqueta, tipo, proceso);
    }

    private void Apuntar(Task<byte[]?>? foto, int x, int y, string selector, string etiqueta, string tipo, string proceso)
    {
        // Tocar la carita no es algo que la persona haga en su app; ClickWatcher lo avisa como «propio» y sin identidad.
        if (proceso == "propio") return;
        string nombre = string.IsNullOrWhiteSpace(etiqueta) ? (selector ?? "").Trim() : etiqueta.Trim();
        // SIN NOMBRE Y SIN FOTO no hay con qué volver a pulsarlo ni con qué explicarlo. Con foto sí: es el caso
        // de SAP, donde UIA no nombra nada y lo que se tocó solo se sabe viéndolo.
        if (nombre.Length == 0 && foto == null) return;

        string linea = (nombre.Length > 0 ? $"pulsó «{nombre}»" : "pulsó algo sin nombre para Ü")
                     + (string.IsNullOrWhiteSpace(tipo) ? "" : $" ({tipo.Trim()})")
                     + (string.IsNullOrWhiteSpace(proceso) ? "" : $" en {proceso.Trim()}")
                     + (nombre.Length == 0 ? $", en el punto ({x}, {y}): qué es se ve en su foto, bajo el cursor" : "");
        lock (_candado)
        {
            _hecho.Enqueue(new Apunte { Linea = linea, Foto = foto });
            while (_hecho.Count > Tope) _hecho.Dequeue();
            // LAS FOTOS, SOLO DE LOS ÚLTIMOS: las líneas se quedan todas, que no pesan.
            int conFoto = 0;
            foreach (var a in _hecho.Reverse())
                if (a.Foto != null && ++conFoto > TopeDeFotos) a.Foto = null;
        }
        try { Anotado?.Invoke(linea); } catch { /* quien escucha no puede tumbar al vigía de clics */ }
        try { AnotadoConFoto?.Invoke(linea, foto); } catch { }
    }

    /// <summary>Lo anotado desde la última vez, en orden. La siguiente llamada no lo repite.</summary>
    public IReadOnlyList<string> Tomar()
    {
        lock (_candado)
        {
            var todo = _hecho.Select(a => a.Linea).ToList();
            _hecho.Clear();
            return todo;
        }
    }

    /// <summary>Lo mismo, cada clic con su foto si la tiene. Tampoco se repite.</summary>
    public IReadOnlyList<Tocado> TomarConFotos()
    {
        List<Apunte> todo;
        lock (_candado)
        {
            todo = _hecho.ToList();
            _hecho.Clear();
        }
        return todo.Select(a => new Tocado(a.Linea, YaTomada(a.Foto))).ToList();
    }

    /// <summary>La foto, si la captura terminó o termina enseguida. Una captura que no llega no retiene la respuesta.</summary>
    internal static byte[]? YaTomada(Task<byte[]?>? foto)
    {
        if (foto == null) return null;
        try { return foto.Wait(TimeSpan.FromMilliseconds(800)) ? foto.Result : null; }
        catch { return null; }   // la captura falló: el clic se cuenta igual, sin foto
    }
}
