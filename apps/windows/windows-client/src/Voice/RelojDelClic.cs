using System.Diagnostics;
using System.Globalization;

namespace U.WindowsClient.Voice;

/// <summary>
/// CUÁNTO TARDÓ CADA TRAMO DESDE EL GESTO: el clic que enciende o apaga la voz, y lo que vino detrás.
/// </summary>
/// <remarks>
/// EL LOG NO PODÍA CONTESTAR LA PREGUNTA. El dueño dijo «se demora varios segundos en aparecer la estela y
/// muchos más en que me escuche» (2026-09-30), y en el log no había con qué medirlo: sus horas van al
/// segundo y el clic no dejaba línea. Hubo que montar un juez de fuera que pulsara la carita y mirara la
/// pantalla. Desde aquí cada gesto deja una línea <c>voz-clic</c> con sus milisegundos.
///
/// TODOS LOS TRAMOS, LLEGARAN O NO (patrón nº10). Una línea que solo trae lo cumplido se lee igual con la
/// sesión confirmada que sin confirmar: el tramo que no llegó sale como «sin llegar», no se omite.
///
/// Pura a propósito: el reloj se le da, y el contrato la juzga con uno de mentira (promesa 666).
/// </remarks>
public sealed class RelojDelClic
{
    /// <summary>Lo que pasa tras el clic que enciende, en el orden en que se espera que pase.</summary>
    public static readonly IReadOnlyList<string> AlEncender =
        new[] { "estela", "micrófono", "primer audio", "socket", "confirmada" };

    /// <summary>Y tras el que apaga.</summary>
    public static readonly IReadOnlyList<string> AlApagar =
        new[] { "estela", "micrófono", "socket" };

    private readonly string _gesto;
    private readonly IReadOnlyList<string> _tramos;
    private readonly Func<long> _ahoraMs;
    private readonly long _desde;
    private readonly Dictionary<string, (long Ms, string Nota)> _marcas = new();
    private readonly object _candado = new();

    /// <param name="gesto">Qué fue: «encender» o «apagar». Es lo primero que dice la línea.</param>
    /// <param name="tramos">Los tramos que se esperan, en su orden. La línea los trae todos.</param>
    /// <param name="ahoraMs">El reloj, en milisegundos. El gesto es el instante en que se construye.</param>
    public RelojDelClic(string gesto, IReadOnlyList<string> tramos, Func<long> ahoraMs)
    {
        _gesto = gesto;
        _tramos = tramos;
        _ahoraMs = ahoraMs;
        _desde = ahoraMs();
    }

    /// <summary>
    /// El de la app. <paramref name="gesto"/> es la marca de <see cref="Stopwatch.GetTimestamp"/> tomada al
    /// recibir el clic; con cero, el gesto es ahora.
    /// </summary>
    public static RelojDelClic DeVerdad(string que, IReadOnlyList<string> tramos, long gesto = 0)
    {
        long origen = gesto > 0 ? gesto : Stopwatch.GetTimestamp();
        return new RelojDelClic(que, tramos, () => (Stopwatch.GetTimestamp() - origen) * 1000 / Stopwatch.Frequency);
    }

    /// <summary>Este tramo llegó ahora. La primera marca de cada tramo es la que vale.</summary>
    public void Marca(string tramo, string nota = "")
    {
        long ms = _ahoraMs() - _desde;
        lock (_candado) _marcas.TryAdd(tramo, (ms, nota ?? ""));
    }

    public bool Tiene(string tramo) { lock (_candado) return _marcas.ContainsKey(tramo); }

    private int _reclamada;

    /// <summary>
    /// QUIÉN ESCRIBE LA LÍNEA: el primero que la reclama, y nadie más. Cada gesto deja UNA, y hay más de un
    /// sitio que puede llegar a escribirla —el que confirma, el que apaga antes de tiempo, el que pinta—, en
    /// hilos distintos. Verdadero solo la primera vez.
    /// </summary>
    public bool Reclamar() => Interlocked.Exchange(ref _reclamada, 1) == 0;

    /// <summary>La línea entera. <paramref name="cola"/> es lo que haya que añadir que no es un tramo.</summary>
    public string Linea(string cola = "")
    {
        var partes = new List<string> { _gesto };
        lock (_candado)
        {
            foreach (string tramo in _tramos)
            {
                if (!_marcas.TryGetValue(tramo, out var m)) { partes.Add($"{tramo}: sin llegar"); continue; }
                string ms = m.Ms.ToString(CultureInfo.InvariantCulture);
                partes.Add(m.Nota.Length > 0 ? $"{tramo} +{ms} ms ({m.Nota})" : $"{tramo} +{ms} ms");
            }
        }
        if (!string.IsNullOrWhiteSpace(cola)) partes.Add(cola);
        return string.Join(" · ", partes);
    }
}
