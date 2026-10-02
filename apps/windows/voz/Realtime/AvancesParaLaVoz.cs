namespace Voz.Realtime;

/// <summary>
/// CUÁNDO SE LE CUENTA A LA VOZ LO QUE VA PASANDO, y cuánto de una vez. Sin socket y sin reloj propio:
/// se le dice qué terminó y contesta qué hay que mandar ahora, si hay algo.
/// </summary>
/// <remarks>
/// POR QUÉ NO SE MANDA TODO SEGÚN LLEGA. Un plan de cuatro pasos de 600 ms son cuatro avances en 2,4 s, y
/// la voz tarda 0,6–0,8 s en empezar a contar cada uno: todavía decía «ya está escrita la operación»
/// cuando el trabajo entero había acabado (sonda del 2026-10-01, pasos de 600 ms). Una voz que va por
/// detrás de las manos es el «voy a abrirlo» que se oía con la app ya abierta, con otro tiempo verbal.
///
/// POR QUÉ TAMPOCO SE TIRA LO QUE LLEGA PEGADO. Lo que no se le cuenta, la voz no lo sabe: a «¿cómo
/// vas?» contestaría con menos de lo hecho. Se guarda y sale junto con el siguiente (promesa 64).
///
/// Y UN FALLO NO ESPERA (65): «ya abrí la calculadora» y tres segundos sin decir que el paso siguiente
/// no se pudo es, para quien escucha, una voz que no sabe que falló.
/// </remarks>
public sealed class AvancesParaLaVoz
{
    /// <summary>
    /// Lo mínimo entre dos avisos. Con pasos de 2,5 s y un aviso por paso la voz dijo tres frases en 11 s
    /// y el silencio más largo fue de 3,2 s (sonda del 2026-10-01): menos espacio es una frase por clic,
    /// que es el balbuceo de la 161; más, y vuelve el silencio que el dueño pidió quitar.
    /// </summary>
    public const int EspacioMs = 2_500;

    /// <summary>Lo que cabe en un aviso, en caracteres: por debajo de <see cref="ProtocoloGptLive.TopeDeUnAppend"/>,
    /// que es lo que el servidor acepta en un append.</summary>
    public const int Tope = 1_200;

    private const string Cabecera = "AVANCE DEL TRABAJO EN CURSO (todavía no ha terminado). ";

    private readonly Func<long> _relojMs;
    private readonly object _candado = new();
    private readonly List<string> _guardado = new();
    private long? _ultimo;

    /// <param name="relojMs">Milisegundos monótonos. Se inyecta para que el contrato juzgue sin esperar.</param>
    public AvancesParaLaVoz(Func<long> relojMs) => _relojMs = relojMs;

    /// <summary>Algo terminó bien. Devuelve el aviso que hay que mandar AHORA, o null si se guarda para el siguiente.</summary>
    /// <remarks>
    /// SIN ETIQUETA DELANTE. Con «Hecho: abrí la calculadora» la voz acabó leyendo la etiqueta —«Hecho: ya abrí
    /// la calculadora», 3 de 14 corridas de la sonda del 2026-10-01—. Lo que llega ya está en pasado.
    /// </remarks>
    public string? Hecho(string que) => Anotar(Limpio(que) + ".", urgente: false, vacio: string.IsNullOrWhiteSpace(que));

    /// <summary>Algo no se pudo. Sale siempre al momento, con lo guardado delante.</summary>
    public string? Fallo(string que) => Anotar("No se pudo: " + Limpio(que) + ".", urgente: true, vacio: string.IsNullOrWhiteSpace(que));

    /// <summary>La tanda terminó: lo guardado sale, para que la voz no se quede sin el último paso.</summary>
    public string? AlTerminar()
    {
        lock (_candado) return _guardado.Count == 0 ? null : Soltar();
    }

    /// <summary>Empieza otra petición: lo guardado era de la anterior y no se cuenta como si fuera de esta.</summary>
    public void Olvidar()
    {
        lock (_candado) { _guardado.Clear(); _ultimo = null; }
    }

    private string? Anotar(string frase, bool urgente, bool vacio)
    {
        if (vacio) return null;
        lock (_candado)
        {
            _guardado.Add(frase);
            bool cumplido = _ultimo is not long u || _relojMs() - u >= EspacioMs;
            return urgente || cumplido ? Soltar() : null;
        }
    }

    /// <summary>Todo lo guardado en un aviso, en orden; lo que no quepa se quita del principio y se dice.</summary>
    private string Soltar()
    {
        var frases = _guardado.ToList();
        _guardado.Clear();
        _ultimo = _relojMs();

        // SE RECORTA POR DELANTE Y SE DICE (patrón nº10): lo más viejo es lo que menos falta hace, y un
        // append que pasa del tope el servidor lo rechaza entero — con él se perdería también lo nuevo.
        int quitados = 0;
        string Texto() => Cabecera + (quitados > 0 ? $"[recortado: {quitados} avance(s) anteriores no caben] " : "") + string.Join(" ", frases);
        while (frases.Count > 1 && Texto().Length > Tope) { frases.RemoveAt(0); quitados++; }
        string texto = Texto();
        if (texto.Length <= Tope) return texto;

        const string cola = "… [recortado]";
        return texto[..(Tope - cola.Length)] + cola;
    }

    /// <summary>Una línea, sin el punto final que ya pone quien la envuelve.</summary>
    private static string Limpio(string que) => (que ?? "").ReplaceLineEndings(" ").Trim().TrimEnd('.', ' ');
}
