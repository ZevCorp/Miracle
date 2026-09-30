using System.Text.RegularExpressions;

namespace U.WindowsClient.Clinical.Transcripcion;

/// <summary>Un turno de lo oído: la voz que lo dijo (null antes de la primera) y su texto.</summary>
public sealed record TurnoDeVoz(int? Voz, string Texto);

/// <summary>Qué parte de lo transcrito dijo una voz, en porcentaje entero.</summary>
public sealed record ParteDeVoz(int Voz, int Porcentaje);

/// <summary>
/// PARTE LO OÍDO POR VOCES para pintarlo (spec 070, promesa 609). Lee las líneas «[Hablante N]»
/// que escribe el <see cref="Verbatim"/>, así que lo que se ve es exactamente lo que va a la nota.
/// </summary>
/// <remarks>
/// Es el mismo corte que hace la web (apps/web/lib/stt/speaker-turns.ts, <c>parseSpeakerTurns</c>):
/// una línea sin etiqueta es de la voz que venía hablando, y lo de antes de la primera voz no se le
/// atribuye a nadie — pegárselo a una voz sería decir que alguien dijo lo que no dijo.
///
/// LA PARTE SE MIDE EN CARACTERES, NO EN TIEMPO, y la vista lo dice: el tiempo por voz existe
/// (encounter_metrics, en la web) pero no llega hasta aquí.
/// </remarks>
public static class TurnosDeVoz
{
    private static readonly Regex Linea = new(@"^\[Hablante (\d+)\][ \t]*(.*)$", RegexOptions.Compiled);

    public static IReadOnlyList<TurnoDeVoz> Partir(string texto)
    {
        var turnos = new List<(int? voz, string texto)>();
        foreach (var cruda in (texto ?? "").Split('\n'))
        {
            string linea = cruda.TrimEnd('\r');
            var m = Linea.Match(linea);
            if (m.Success)
            {
                turnos.Add((int.Parse(m.Groups[1].Value), m.Groups[2].Value.Trim()));
            }
            else if (linea.Trim().Length > 0)
            {
                if (turnos.Count == 0) { turnos.Add((null, linea.Trim())); continue; }
                var (voz, previo) = turnos[^1];
                turnos[^1] = (voz, previo.Length > 0 ? previo + "\n" + linea.Trim() : linea.Trim());
            }
        }
        return turnos.Where(t => t.texto.Length > 0).Select(t => new TurnoDeVoz(t.voz, t.texto)).ToList();
    }

    /// <summary>Por número de voz, redondeado por mayor resto para que sume 100.</summary>
    public static IReadOnlyList<ParteDeVoz> Partes(IReadOnlyList<TurnoDeVoz> turnos)
    {
        var caracteres = new SortedDictionary<int, int>();
        foreach (var t in turnos)
            if (t.Voz is int v) caracteres[v] = caracteres.GetValueOrDefault(v) + t.Texto.Length;

        int total = caracteres.Values.Sum();
        if (total == 0) return Array.Empty<ParteDeVoz>();

        var filas = caracteres.Select(kv => (voz: kv.Key, exacto: kv.Value * 100.0 / total)).ToList();
        var enteros = filas.Select(f => (int)Math.Floor(f.exacto)).ToArray();
        int faltan = 100 - enteros.Sum();
        foreach (int i in Enumerable.Range(0, filas.Count).OrderByDescending(i => filas[i].exacto - enteros[i]))
        {
            if (faltan-- <= 0) break;
            enteros[i]++;
        }
        return filas.Select((f, i) => new ParteDeVoz(f.voz, enteros[i])).ToList();
    }
}
