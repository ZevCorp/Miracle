using U.Ciclo;

namespace U.WindowsClient.Navigation;

/// <summary>
/// LA MANO DE Ü DESDE CERO, DENTRO DE MAIN (spec 053, fase 2, promesas 477-479).
/// </summary>
/// <remarks>
/// LÍNEA BASE DEL 2026-09-27: «la mano» de main costaba 263-875 ms por clic. Resolve busca el elemento con un FindAll
/// sobre la ventana, lo trae a la vista (120 ms), y sube la escalera patrón → mensaje → físico con sus esperas fijas
/// (el físico típico, ~560 ms; el peor, más de 1,8 s). La lectura rápida de u/ ya tiene la caja de cada elemento
/// visible: si lo pedido es UNO solo de ellos, el clic es el ratón real en su centro y nada más.
///
/// LO QUE NO SE PIERDE: el pulso se avisa (UiaSurface.Pulso; desde la 492 no lo escucha nadie), el cursor se cuenta, el freno manda
/// (promesa 27). Y la escalera no se tira: lo MISMO pedido otra vez en menos de 3 s —el ensayo del doble o la
/// repetición de PulsarSegunElNucleo, que solo ocurren cuando el primer clic no cambió nada— va por la mano de
/// siempre. Es el aprendizaje nº19 al pie de la letra: actuar con el clic real primero y, si no agarró, el patrón.
/// Por eso las promesas 234, 237 y 265 (la escalera) siguen verdes y con sentido: pasan a ser el respaldo.
/// </remarks>
public sealed class ManoRapida
{
    private readonly Func<IReadOnlyList<Accionable>> _leer;
    private readonly Action<int, int> _clic;
    private readonly Func<bool> _freno;
    private readonly Func<long> _relojMs;
    private string _ultimo = "";
    private long _ultimoEn = long.MinValue / 2;

    /// <summary>Lo mismo pedido otra vez antes de esto va por la escalera (promesa 479).</summary>
    public const int VentanaDeRepeticionMs = 3000;

    public ManoRapida(Func<IReadOnlyList<Accionable>> leer, Action<int, int> clic, Func<bool> freno, Func<long> relojMs)
    {
        _leer = leer; _clic = clic; _freno = freno; _relojMs = relojMs;
    }

    /// <summary>
    /// ¿Lo hace la mano rápida? true = se encargó (pulsó, o el freno lo impidió y <paramref name="motivo"/> lo dice);
    /// false = no es suyo —SAP, sin coincidencia única, o repetido— y va a la mano de siempre.
    /// </summary>
    public bool Intentar(string selector, string etiqueta, out string? motivo)
    {
        motivo = null;
        if (string.IsNullOrWhiteSpace(selector) || !selector.StartsWith(U.Graph.Surfaces.UiaSelector.Prefix, StringComparison.OrdinalIgnoreCase))
            return false;
        long ahora = _relojMs();
        bool repetido = selector == _ultimo && ahora - _ultimoEn < VentanaDeRepeticionMs;
        _ultimo = selector; _ultimoEn = ahora;
        if (repetido) return false;

        var hallada = Buscar(_leer(), selector, etiqueta);
        if (hallada is not { } caja) return false;
        if (_freno()) { motivo = "el freno está echado: no pulso"; return true; }
        var (x, y) = Raton.Centro(caja);
        _clic(x, y);
        U.Graph.Surfaces.UiaSurface.AvisarDelCursor(x, y);
        U.Graph.Surfaces.UiaSurface.AvisarDelPulso(caja.X, caja.Y, caja.Ancho, caja.Alto);
        return true;
    }

    /// <summary>
    /// La caja de lo pedido si es UN solo elemento visible con ese nombre y ese tipo (promesa 477). El nombre sale del
    /// selector; si el selector va por AutomationId —que la lectura rápida no trae—, de la etiqueta. Dos iguales o
    /// ninguno: null, y decide la mano de siempre, que sabe de homónimos.
    /// </summary>
    public static Caja? Buscar(IReadOnlyList<Accionable> vista, string selector, string etiqueta)
    {
        var claves = U.Graph.Surfaces.UiaSelector.Parse(selector);
        string nombre = (claves.TryGetValue("name", out var n) && !string.IsNullOrWhiteSpace(n) ? n : etiqueta ?? "").Trim();
        claves.TryGetValue("ct", out var tipo);
        if (nombre.Length == 0) return null;
        var iguales = vista.Where(a => string.Equals(a.Nombre.Trim(), nombre, StringComparison.Ordinal)
                                     && (string.IsNullOrEmpty(tipo) || string.Equals(a.Tipo, tipo, StringComparison.Ordinal))).Take(2).ToList();
        return iguales.Count == 1 ? iguales[0].Caja : null;
    }
}
