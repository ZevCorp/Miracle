using System;
using System.Collections.Generic;
using System.Linq;

namespace U.WindowsClient.Voice;

/// <summary>
/// LA MEDIDA DE UN TURNO DEL USUARIO (promesa 205, spec 017): cuántas llamadas pidió el cerebro,
/// cuántas herramientas distintas, el máximo de intentos a un mismo destino, y los milisegundos desde
/// la primera llamada hasta la primera acción que actuó y hasta la última. Una línea por turno.
/// </summary>
/// <remarks>
/// No existía la unidad «petición». «usuario dijo» se escribe al cerrar el turno y «mapa-mcp: →» no
/// dice quién llamó, así que para saber si algo se hizo «a la primera» había que reconstruirlo sumando
/// líneas sueltas con un script — que es como se midió el 2026-09-10, y como no se debería tener que
/// medir. Esta línea es lo que lee el nivel 4 de la spec 017.
///
/// EL DENOMINADOR ES LO PEDIDO (patrón nº10). Lo que el tope rechazó y lo que el modelo retiró
/// también cuentan como llamadas: una cuenta que solo sumara lo ejecutado encogería justo cuando el
/// turno se enredó, y describiría con exactitud un turno que no pasó.
///
/// «ACTUÓ» ES LO QUE SE SABE, NO LO QUE SE SUPONE. Quien llama decide si un resultado actuó; una
/// acción cuyo resultado no trae si lo logró no cuenta como actuada. Mejor un «primera=—» honesto que
/// un tiempo que mide una respuesta y la llama acción.
/// </remarks>
public sealed class CuentaDelTurno
{
    private readonly Func<long> _relojMs;
    private readonly object _candado = new();

    private long? _t0, _primera, _ultima, _peticion, _finTrabajo, _habloTras;
    private long _ejecutar;
    private int _llamadas, _rechazadas, _retiradas;
    private readonly HashSet<string> _distintas = new(StringComparer.Ordinal);
    private readonly Dictionary<string, int> _intentos = new(StringComparer.Ordinal);

    /// <param name="relojMs">Milisegundos monótonos. Se inyecta para que el contrato juzgue sin esperar.</param>
    public CuentaDelTurno(Func<long> relojMs) => _relojMs = relojMs;

    /// <summary>El cerebro pidió una herramienta. Cuenta aunque luego se rechace o se retire.</summary>
    public void Llamada(string herramienta, string destino)
    {
        lock (_candado)
        {
            _t0 ??= _relojMs();
            _llamadas++;
            _distintas.Add(herramienta ?? "");
            if (!TopeDeIntentos.Acciones.Contains(herramienta ?? "")) return;
            string d = TopeDeIntentos.Destino(destino);
            if (d.Length > 0) _intentos[d] = _intentos.GetValueOrDefault(d) + 1;
        }
    }

    /// <summary>Una herramienta devolvió su resultado; <paramref name="actuo"/> lo decide quien sabe leerlo.</summary>
    public void Resultado(string herramienta, string destino, bool actuo)
    {
        if (!actuo) return;
        lock (_candado)
        {
            if (_t0 == null) return;   // un resultado de un turno anterior no cuenta en este, ni da tiempos negativos
            long t = _relojMs();
            _primera ??= t;
            _ultima = t;
        }
    }

    /// <summary>
    /// Una tanda de herramientas terminó y tardó <paramref name="ms"/>, desde que se pidió hasta que su resultado salió
    /// hacia Luna (promesa 512). Es lo que se ejecutó; todo lo demás del turno es pensar.
    /// </summary>
    public void Trabajo(long ms)
    {
        lock (_candado)
        {
            if (_t0 == null) return;   // una tanda del turno anterior no se cuenta en este
            _ejecutar += Math.Max(0, ms);
            _finTrabajo = _relojMs();
        }
    }

    /// <summary>
    /// Ü dijo algo (promesa 512). Lo primero que dice tras la última tanda es el final del pedido: lo de antes de
    /// cualquier herramienta no lo es, y lo que sigue diciendo después tampoco lo alarga.
    /// </summary>
    public void Hablo()
    {
        lock (_candado)
        {
            long t = _relojMs();
            if (_finTrabajo is long f && (_habloTras == null || _habloTras < f)) _habloTras = t;
            // UNA FRASE, NO UN TROZO (promesa 753): la voz llega a trozos de pocas sílabas, y contar trozos
            // diría «habló doce veces» de una sola frase. Un trozo tras más de una pausa de frase abre otra.
            if (_ultimoTrozo is not long u || t - u > PausaDeFraseMs) _frases.Add(t);
            _ultimoTrozo = t;
        }
    }

    /// <summary>Cuánto silencio separa dos frases de la voz. Dentro de una frase los trozos llegan cada 100–400 ms
    /// y las pausas entre oraciones bajan a 1,4 s (medido el 2026-09-12); más que eso es otra frase.</summary>
    private const int PausaDeFraseMs = 1_500;
    private readonly List<long> _frases = new();
    private long? _ultimoTrozo;

    public void Rechazada(string herramienta, string destino)
    {
        lock (_candado) _rechazadas++;
    }

    public void Retirada(string herramienta)
    {
        lock (_candado) _retiradas++;
    }

    /// <summary>El usuario acaba de pedir algo: desde aquí se miden los «dos segundos» del audio, que
    /// incluyen lo que tarda el modelo en decidir — no solo lo que tardan las manos.</summary>
    public void Peticion()
    {
        lock (_candado) _peticion = _relojMs();
    }

    /// <summary>A cero SIEMPRE, también cuando el turno no pidió nada: si no, lo que quedara del
    /// anterior se colaba en el siguiente (crítico de la rama, 2026-09-11).</summary>
    private void Reiniciar()
    {
        _t0 = _primera = _ultima = _peticion = _finTrabajo = _habloTras = _ultimoTrozo = null;
        _frases.Clear();
        _ejecutar = 0;
        _llamadas = _rechazadas = _retiradas = 0;
        _distintas.Clear();
        _intentos.Clear();
    }

    /// <summary>
    /// La línea del turno, y la cuenta vuelve a cero. null si en el turno no se pidió nada: un turno
    /// de pura conversación no deja una medida vacía que haya que descartar al leer.
    /// </summary>
    public string? Cerrar()
    {
        lock (_candado)
        {
            if (_llamadas == 0) { Reiniciar(); return null; }
            string intentos = _intentos.Count == 0
                ? "intentos_max=0"
                : _intentos.OrderByDescending(kv => kv.Value).ThenBy(kv => kv.Key, StringComparer.Ordinal)
                    .Select(kv => $"intentos_max={kv.Value} «{kv.Key}»").First();
            string Desde(long? t) => t is long v && _t0 is long a ? $"{v - a} ms" : "—";
            string linea = $"llamadas={_llamadas} distintas={_distintas.Count} {intentos} "
                         + $"primera={Desde(_primera)} ultima={Desde(_ultima)} "
                         + $"desde_peticion={(_primera is long p && _peticion is long q ? (p - q) + " ms" : "—")} "
                         + $"rechazadas={_rechazadas} retiradas={_retiradas}"
                         + PensarYEjecutar()
                         + HabloDurante();

            Reiniciar();
            return linea;
        }
    }

    /// <summary>
    /// SI ALGUIEN LE HABLABA A LA PERSONA MIENTRAS SE TRABAJABA (promesa 753, spec 073): las frases que la voz
    /// dijo entre la primera llamada y el final de la última tanda, y el hueco más largo sin ninguna.
    /// </summary>
    /// <remarks>
    /// Antes solo se podía sacar con un guion sobre los logs, y a medias: «Ü dijo» se escribe al cerrar el turno,
    /// no cuando suena. Así se midió el 2026-10-01 que en 22 de 54 pedidos largos la voz no dijo nada en medio.
    /// Lo que dice antes de la primera herramienta («claro») y lo que dice con el resultado no cuentan: no es
    /// acompañar el trabajo.
    /// </remarks>
    private string HabloDurante()
    {
        if (_t0 is not long inicio) return "";
        long fin = _finTrabajo ?? _ultima ?? inicio;
        var durante = _frases.Where(t => t > inicio && t < fin).ToList();
        long hueco = 0, previo = inicio;
        foreach (long t in durante) { hueco = Math.Max(hueco, t - previo); previo = t; }
        hueco = Math.Max(hueco, fin - previo);
        return $" hablo_durante={durante.Count} silencio_max={hueco} ms";
    }

    /// <summary>
    /// LO QUE PIENSA LUNA Y LO QUE EJECUTA JEFF (promesa 512, spec 062). La sesión del dueño del 2026-09-28 fue ~77 %
    /// pensar, y se sacó a mano restando huecos de un log con resolución de un segundo; la meta es ≤ 20 %.
    /// Pensar incluye a la voz decidiendo delegar y a Luna contando el resultado: todo lo que no es ejecutar.
    /// </summary>
    private string PensarYEjecutar()
    {
        if (_peticion is not long q) return $" pensar=— ejecutar={_ejecutar} ms luna=—";
        long fin = _habloTras is long h && _finTrabajo is long f && h >= f ? h : _finTrabajo ?? _ultima ?? q;
        long total = Math.Max(1, fin - q);
        long ejecutar = Math.Min(_ejecutar, total);
        long pensar = total - ejecutar;
        return $" pensar={pensar} ms ejecutar={ejecutar} ms luna={(int)Math.Round(100.0 * pensar / total)}%";
    }
}
