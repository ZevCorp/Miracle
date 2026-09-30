using System.Windows;
using System.Windows.Media;

namespace U.WindowsClient.Ui;

/// <summary>
/// Todo lo que pinta la carita, y solo grises (spec 052, promesa 440).
///
/// Hasta el 2026-09-30 la carita se TEÑÍA: roja al grabar y al fallar, ámbar al esperar, gris al
/// detenerse, y la lengua era rosa. El dueño: «no me gusta que cambie de color, quiero que sea siempre
/// blanco o negro». Ya había pasado lo mismo con el notch (spec 023) y la carita siguió con su acento,
/// porque vivía en otra paleta: por eso esta es SUYA y no tira de <see cref="UiPalette"/>, que es de
/// la barra grande y tiene que seguir teniendo color.
///
/// El volumen (promesa 443) también sale de aquí, y en grises: la luz de arriba es un degradado de
/// claro a menos claro, el borde se oscurece con negro transparente y el brillo es blanco
/// transparente. Tres capas, como en Coucou (<c>mochi/engine.ts</c>), sin un solo tono.
/// </summary>
public sealed class PaletaDeLaCarita
{
    public Color Tinta { get; }
    public Color CuerpoArriba { get; }
    public Color CuerpoAbajo { get; }
    /// <summary>Negro al borde de la viñeta. Es lo que hace que el contorno «se curve hacia atrás».</summary>
    public Color Sombra { get; }
    /// <summary>El brillo especular, arriba a la derecha, donde da la luz.</summary>
    public Color Brillo { get; }
    public Color Filete { get; }
    public Color Lengua { get; }

    public Brush Cuerpo { get; }
    public Brush Vineta { get; }
    public Brush Reflejo { get; }
    public Pen Contorno { get; }

    private PaletaDeLaCarita(Color tinta, Color arriba, Color abajo, Color sombra, Color brillo, Color filete, Color lengua)
    {
        Tinta = tinta; CuerpoArriba = arriba; CuerpoAbajo = abajo;
        Sombra = sombra; Brillo = brillo; Filete = filete; Lengua = lengua;

        // La luz viene de arriba y un poco de la derecha: el degradado no es vertical puro, igual que
        // en la referencia, para que el brillo y la sombra cuenten la misma historia.
        Cuerpo = Congelar(new LinearGradientBrush(arriba, abajo, new Point(0.58, 0), new Point(0.42, 1)));

        // La viñeta no empieza hasta el 60 % del radio: el centro de la cara queda limpio, que es
        // donde están los rasgos, y todo el oscurecimiento se concentra en el borde.
        var v = new RadialGradientBrush { Center = new Point(0.5, 0.5), GradientOrigin = new Point(0.5, 0.5), RadiusX = 0.5, RadiusY = 0.5 };
        v.GradientStops.Add(new GradientStop(Color.FromArgb(0, sombra.R, sombra.G, sombra.B), 0));
        v.GradientStops.Add(new GradientStop(Color.FromArgb(0, sombra.R, sombra.G, sombra.B), 0.6));
        v.GradientStops.Add(new GradientStop(sombra, 1));
        Vineta = Congelar(v);

        var b = new RadialGradientBrush { Center = new Point(0.67, 0.27), GradientOrigin = new Point(0.67, 0.27), RadiusX = 0.21, RadiusY = 0.21 };
        b.GradientStops.Add(new GradientStop(brillo, 0));
        b.GradientStops.Add(new GradientStop(Color.FromArgb(0, brillo.R, brillo.G, brillo.B), 1));
        Reflejo = Congelar(b);

        var p = new Pen(new SolidColorBrush(filete), 1);
        p.Freeze();
        Contorno = p;
    }

    /// <summary>Blanco con tinta negra: la de siempre, ahora con volumen.</summary>
    public static readonly PaletaDeLaCarita Clara = new(
        tinta: Colors.Black,
        arriba: Color.FromRgb(0xFF, 0xFF, 0xFF),
        abajo: Color.FromRgb(0xD6, 0xD6, 0xD6),
        sombra: Color.FromArgb(0x33, 0, 0, 0),
        brillo: Color.FromArgb(0x8C, 0xFF, 0xFF, 0xFF),
        filete: Color.FromArgb(0x1F, 0, 0, 0),
        lengua: Color.FromRgb(0x8C, 0x8C, 0x8C));

    /// <summary>Negro con tinta blanca. El degradado sube a gris para que el negro no sea un agujero.</summary>
    public static readonly PaletaDeLaCarita Oscura = new(
        tinta: Colors.White,
        arriba: Color.FromRgb(0x3A, 0x3A, 0x3A),
        abajo: Color.FromRgb(0x0C, 0x0C, 0x0C),
        sombra: Color.FromArgb(0x66, 0, 0, 0),
        brillo: Color.FromArgb(0x2E, 0xFF, 0xFF, 0xFF),
        filete: Color.FromArgb(0x33, 0xFF, 0xFF, 0xFF),
        lengua: Color.FromRgb(0x9A, 0x9A, 0x9A));

    public static PaletaDeLaCarita Para(FaceTheme tema) => tema == FaceTheme.Dark ? Oscura : Clara;

    private static T Congelar<T>(T f) where T : Freezable { f.Freeze(); return f; }
}
