using System.Windows;

namespace U.WindowsClient.Ui;

/// <summary>
/// CUÁNDO asoma el notch al acercar el cursor al borde de arriba. <see cref="ReglaDeLaBandeja"/>
/// dice DÓNDE se pide (promesa 260); esto dice cuánto hay que quedarse para haberlo pedido
/// (promesa 530, spec 063).
/// </summary>
/// <remarks>
/// POR QUÉ EXISTE (2026-09-30, pedido del dueño). Asomaba en el primer sondeo que veía el cursor en
/// la franja, y la franja son los 6 px de arriba del centro de la pantalla: justo la tira de
/// pestañas de un navegador maximizado. Subir a una pestaña tropezaba con el borde y el notch caía
/// encima de lo que se iba a pulsar — «uno lo sube e instantáneamente se abre eso y estorba».
///
/// TRES COSAS DICEN «NO TE ESTOY LLAMANDO», y las tres las hace quien busca una pestaña:
///
///   · pasar de largo: tocar el borde menos de <see cref="EsperaMs"/> y seguir;
///   · recorrerlo de lado: el cursor a ras del borde pero moviéndose más de <see cref="Holgura"/>
///     — cada tramo empieza la espera de cero, así que nunca se cumple;
///   · hacer clic ahí: es usar lo de debajo. La franja queda muda hasta que el cursor salga, por
///     mucho que después se quede quieto eligiendo la siguiente pestaña.
///
/// DISPARA UNA VEZ POR VISITA, no mientras dure: si algo retira el notch con el cursor todavía
/// arriba (caduca, se apaga la voz), no reaparece en bucle a cada sondeo.
///
/// CON ESTADO PERO SIN PANTALLA: recibe las muestras que toma el sondeo de
/// <see cref="PanelDeAcciones"/> —dónde está el cursor, si hay botón apretado, qué hora es— y el
/// contrato le da relojes inventados. Lo juzgado y lo que corre no pueden discrepar.
/// </remarks>
public sealed class EsperaDelAsomo
{
    /// <summary>Cuánto hay que quedarse quieto en la franja. «0,5 segs o algo así».</summary>
    public const int EsperaMs = 500;

    /// <summary>
    /// Cuánto puede moverse el cursor y seguir siendo «quieto». Una mano parada tiembla unos
    /// píxeles; una que recorre pestañas pasa de aquí en un instante.
    /// </summary>
    public const double Holgura = 30;

    private DateTime? _desde;
    private Point _ancla;
    private bool _gastada;

    /// <summary>¿Toca asomar el notch AHORA? Verdadero una sola vez por visita a la franja.</summary>
    /// <param name="enLaFranja">Lo que contesta <see cref="ReglaDeLaBandeja.Asoma"/> para este cursor.</param>
    /// <param name="cursor">Dónde está, en las mismas unidades que la franja.</param>
    /// <param name="botonApretado">Si hay un botón del ratón apretado en esta muestra.</param>
    /// <param name="ahora">La hora de la muestra.</param>
    public bool Dispara(bool enLaFranja, Point cursor, bool botonApretado, DateTime ahora)
    {
        if (!enLaFranja)
        {
            _desde = null;
            _gastada = false;
            return false;
        }
        if (_gastada) return false;
        if (botonApretado)
        {
            _gastada = true;
            _desde = null;
            return false;
        }
        if (_desde is not DateTime desde || (cursor - _ancla).Length > Holgura)
        {
            _desde = ahora;
            _ancla = cursor;
            return false;
        }
        if ((ahora - desde).TotalMilliseconds < EsperaMs) return false;
        _gastada = true;
        return true;
    }
}
