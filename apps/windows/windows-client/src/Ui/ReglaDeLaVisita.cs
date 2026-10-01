using System.Windows;

namespace U.WindowsClient.Ui;

/// <summary>
/// DÓNDE SE POSA LA CARITA AL VISITAR LO QUE Ü TOCÓ (promesa 506) y SI EL PUNTO DE UN CLIC ESTÁ LIBRE (promesa 510).
/// Puras. Spec 061.
/// </summary>
/// <remarks>
/// AL LADO, NUNCA ENCIMA. La colocación de antes (JuntoA) probaba la derecha y la izquierda y, si no cabía, SUJETABA la
/// carita dentro del área: podía dejarla encima del elemento, y sin decirlo. Aquí se prueba cada lado entero —derecha,
/// izquierda, abajo, arriba— y solo vale si cabe en el área sin cortar la caja del elemento; si ninguno vale, no se
/// viaja. La caja de la carita es la VENTANA entera (128 DIP con su sombra), no los 72 de la cara: la sombra también
/// recoge clics en una ventana con alfa por píxel.
/// </remarks>
public static class ReglaDeLaVisita
{
    /// <summary>El aire entre la carita y el elemento, en DIP.</summary>
    public const double Aire = 12;

    /// <summary>Dónde se posa la esquina de la carita junto al elemento, o null si no cabe en ningún lado. Todo en DIP.</summary>
    public static Point? Junto(Rect elemento, Size carita, Rect area)
    {
        if (elemento.IsEmpty || area.IsEmpty || carita.IsEmpty) return null;
        double enMedioY = Entre(elemento.Top + elemento.Height / 2 - carita.Height / 2, area.Top, area.Bottom - carita.Height);
        double enMedioX = Entre(elemento.Left + elemento.Width / 2 - carita.Width / 2, area.Left, area.Right - carita.Width);
        var lados = new[]
        {
            new Point(elemento.Right + Aire, enMedioY),                  // derecha
            new Point(elemento.Left - Aire - carita.Width, enMedioY),    // izquierda
            new Point(enMedioX, elemento.Bottom + Aire),                 // abajo
            new Point(enMedioX, elemento.Top - Aire - carita.Height),    // arriba
        };
        foreach (var p in lados)
        {
            var donde = new Rect(p, carita);
            if (area.Contains(donde) && !donde.IntersectsWith(elemento)) return p;
        }
        return null;
    }

    private static double Entre(double v, double min, double max) => max < min ? min : Math.Clamp(v, min, max);

    /// <summary>Lo que recorre la carita por cada muesca de rueda, y entre qué topes, en DIP.</summary>
    public const double DeslizPorMuesca = 34, DeslizMinimo = 48, DeslizMaximo = 132;

    /// <summary>Lo que se mete dentro de la ventana o del campo, desde su borde.</summary>
    public const double DentroDelBorde = 24;

    /// <summary>
    /// POR DÓNDE DESLIZA la carita cuando Ü desplaza una ventana (spec 078, promesa 697): dentro de la ventana, junto a su
    /// borde derecho, y a media altura; de ahí se mueve CON el contenido. Rueda abajo (muescas &lt; 0): el contenido sube
    /// y la carita sube; rueda arriba, baja. Todo en DIP. null si no hay desplazamiento o no hay sitio.
    /// </summary>
    /// <remarks>
    /// Dentro y no al lado, al revés que al pulsar (promesa 506): lo que se desplaza es casi siempre la ventana entera y
    /// al lado no hay nada. Fuera de casa la carita es fantasma (505), así que estar encima no le quita un clic a nadie.
    /// </remarks>
    public static (Point Desde, Point Hasta)? Desliz(Rect ventana, Size carita, Rect area, int muescas)
    {
        if (muescas == 0 || ventana.IsEmpty || area.IsEmpty || carita.IsEmpty) return null;
        var visible = Rect.Intersect(ventana, area);
        if (visible.IsEmpty) return null;
        double tramo = Math.Clamp(Math.Abs(muescas) * DeslizPorMuesca, DeslizMinimo, DeslizMaximo) * Math.Sign(muescas);
        double x = Entre(visible.Right - DentroDelBorde - carita.Width, area.Left, area.Right - carita.Width);
        double medio = visible.Top + visible.Height / 2 - carita.Height / 2;
        double desde = Entre(medio - tramo / 2, area.Top, area.Bottom - carita.Height);
        double hasta = Entre(medio + tramo / 2, area.Top, area.Bottom - carita.Height);
        if (Math.Abs(hasta - desde) < 1) return null;   // sin sitio para moverse no hay nada que deslizar
        return (new Point(x, desde), new Point(x, hasta));
    }

    /// <summary>
    /// DENTRO DE UN CAMPO GRANDE, en su esquina de arriba a la derecha: para cuando no cabe al lado porque el campo ES la
    /// ventana —un documento, el cuerpo de un correo— (promesa 698). null si el campo es más pequeño que la carita.
    /// </summary>
    public static Point? Dentro(Rect elemento, Size carita, Rect area)
    {
        if (elemento.IsEmpty || area.IsEmpty || carita.IsEmpty) return null;
        var visible = Rect.Intersect(elemento, area);
        if (visible.IsEmpty || visible.Width < carita.Width || visible.Height < carita.Height) return null;
        return new Point(
            Entre(visible.Right - DentroDelBorde - carita.Width, area.Left, area.Right - carita.Width),
            Entre(visible.Top + DentroDelBorde, area.Top, area.Bottom - carita.Height));
    }

    /// <summary>
    /// ¿Está libre el punto donde Ü va a pulsar? null = sí. Si la persona tiene el ratón, no. Si el punto cae en la carita
    /// —tocable, o ya fantasma pero de vuelta a casa por encima—, se aparta y se vuelve a mirar; si es otra ventana de Ü,
    /// no está libre y se dice cuál.
    /// </summary>
    /// <remarks>
    /// EXISTE PORQUE LA FIRMA NO BASTA (sonda 0, 2026-09-28): un clic firmado que cae en una ventana de Ü se tira, pero la
    /// ventana se activa igual —le quita el foco a SAP— y el clic no llega a lo que había debajo. Mirar antes de pulsar
    /// cuesta dos llamadas de microsegundos.
    ///
    /// LA CARITA SE APARTA AUNQUE YA SEA FANTASMA si el punto cae en ella: apartarla le empieza otra vez el rato fuera. Sin
    /// eso, la coreografía de lección —que tarda hasta 4 s en pulsar por la tarjeta de lectura— la veía volver a casa y
    /// posarse tocable justo antes del clic (segunda crítica del plan, 2026-09-28). Y SI LA PERSONA TIENE EL RATÓN
    /// —pulsando o arrastrando la carita— no se pulsa: la captura se llevaría el clic de Ü a la carita, estuviera donde
    /// estuviera, y el arrastre la dejaría encima de lo que Ü iba a pulsar.
    /// </remarks>
    /// <summary>
    /// EL NOTCH SE APARTA COMO LA CARITA (promesa 527): si lo que hay bajo el punto es el notch, se vuelve transparente al
    /// ratón y se deja decidir al resto (la regla de la carita, que vuelve a mirar). Cualquier otra ventana de Ü sigue en manos
    /// del resto, que no la pulsa y dice cuál. En Paint maximizado, «Rojo» quedaba bajo el notch y Ü no podía pulsarlo
    /// (2026-09-29): toda la franja de arriba al centro de una app maximizada era suya.
    /// </summary>
    public static string? LibrarElPuntoConElNotch(Func<IntPtr> bajo, Func<IntPtr, bool> esElNotch, Action<IntPtr> apartarElNotch, Func<string?> resto)
    {
        IntPtr h = bajo();
        if (h != IntPtr.Zero && esElNotch(h)) apartarElNotch(h);
        return resto();
    }

    public static string? LibrarElPunto(Func<IntPtr> bajo, Func<IntPtr, bool> esDeU, IntPtr carita, Action apartar,
                                        Func<IntPtr, string> nombre, Func<bool> enLaCarita, Func<string?> ocupado)
    {
        if (ocupado() is { Length: > 0 } porQue) return porQue;
        IntPtr h = bajo();
        if (h != carita && !enLaCarita())
            return h == IntPtr.Zero || !esDeU(h) ? null : $"lo tapa «{nombre(h)}», una ventana de Ü";
        apartar();
        IntPtr ahora = bajo();
        if (ahora == IntPtr.Zero || !esDeU(ahora)) return null;
        return $"lo tapa «{nombre(ahora)}», una ventana de Ü, aun después de apartar la carita";
    }
}
