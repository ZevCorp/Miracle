using U.WindowsClient.Navigation;

namespace U.WindowsClient.Voice;

/// <summary>
/// LO QUE LA PERSONA HA TOCADO desde la última vez que se preguntó (spec 074, de la 046). Es lo que hace que
/// «mira, se hace así» sirva: quien actúa pregunta, y le llegan los clics con el mismo nombre con que
/// <c>map_take</c> los encuentra.
/// </summary>
/// <remarks>
/// <para>SE ENTREGA UNA SOLA VEZ (promesa 706). Tomar vacía el rastro: si la siguiente consulta repitiera lo
/// ya entregado, el mismo paso entraría dos veces en la habilidad.</para>
/// <para>SOLO ANOTA. <see cref="ClickWatcher.AlResolver"/> se dispara fuera del gancho, pero cada clic de la
/// máquina pasa por aquí: un candado y una línea, nada más.</para>
/// <para>NO ES EL GRABADOR DEL LEARN. Aquel emitía un paso por tecla y decidía la superficie una sola vez; esto
/// es una lista de «pulsó «X» en tal app» que un modelo lee y convierte en pasos con sus palabras.</para>
/// </remarks>
public sealed class LoQueHiciste
{
    /// <summary>Los últimos clics que se guardan. Nadie enseña 60 clics sin que se le pregunte; sin tope, crecería toda la sesión.</summary>
    public const int Tope = 60;

    private readonly object _candado = new();
    private readonly Queue<string> _hecho = new();

    /// <summary>Se avisa de cada clic anotado, con su línea: es por donde entra al diario de la sesión.</summary>
    public event Action<string>? Anotado;

    /// <summary>El rastro de la máquina, enganchado al vigía de clics desde que alguien lo pide por primera vez.</summary>
    public static LoQueHiciste DeLaPersona => Unico.Value;

    private static readonly Lazy<LoQueHiciste> Unico = new(() =>
    {
        var r = new LoQueHiciste();
        ClickWatcher.AlResolver += (_, _, selector, etiqueta, tipo, proceso) => r.Anotar(selector, etiqueta, tipo, proceso);
        return r;
    });

    public void Anotar(string selector, string etiqueta, string tipo, string proceso)
    {
        // Tocar la carita no es algo que la persona haga en su app; ClickWatcher lo avisa como «propio» y sin identidad.
        if (proceso == "propio") return;
        string nombre = string.IsNullOrWhiteSpace(etiqueta) ? (selector ?? "").Trim() : etiqueta.Trim();
        if (nombre.Length == 0) return;   // sin etiqueta ni selector no hay con qué volver a pulsarlo

        string linea = $"pulsó «{nombre}»"
                     + (string.IsNullOrWhiteSpace(tipo) ? "" : $" ({tipo.Trim()})")
                     + (string.IsNullOrWhiteSpace(proceso) ? "" : $" en {proceso.Trim()}");
        lock (_candado)
        {
            _hecho.Enqueue(linea);
            while (_hecho.Count > Tope) _hecho.Dequeue();
        }
        try { Anotado?.Invoke(linea); } catch { /* quien escucha no puede tumbar al vigía de clics */ }
    }

    /// <summary>Lo anotado desde la última vez, en orden. La siguiente llamada no lo repite.</summary>
    public IReadOnlyList<string> Tomar()
    {
        lock (_candado)
        {
            var todo = _hecho.ToList();
            _hecho.Clear();
            return todo;
        }
    }
}
