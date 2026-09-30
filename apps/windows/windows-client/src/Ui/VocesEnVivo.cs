using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using U.WindowsClient.Clinical.Transcripcion;

namespace U.WindowsClient.Ui;

/// <summary>
/// LO OÍDO, POR VOCES (spec 070). Mientras se graba, en vez del texto corrido: una pastilla por voz
/// con su parte de lo dicho, y una fila por turno con el avatar y el nombre de la voz en su color.
/// </summary>
/// <remarks>
/// Solo se enseña si lo oído trae voces —Soniox con diarización—; sin ellas manda el texto corrido
/// de siempre, y <see cref="HayVoces"/> es lo que la ventana mira para elegir. Los colores son los de
/// la web (<c>--color-voz-1…6</c> en apps/web/app/globals.css), en el mismo orden: la misma
/// consulta vista en los dos sitios pinta a «Hablante 2» del mismo verde.
/// </remarks>
public sealed class VocesEnVivo
{
    private static readonly Color[] Colores =
    {
        Color.FromRgb(0x2F, 0x6F, 0xE0),
        Color.FromRgb(0x0F, 0x9B, 0x6C),
        Color.FromRgb(0x7C, 0x4D, 0xDB),
        Color.FromRgb(0xC2, 0x62, 0x0A),
        Color.FromRgb(0xC2, 0x3A, 0x7B),
        Color.FromRgb(0x0E, 0x8A, 0x99),
    };

    private readonly StackPanel _pila = new() { Margin = new Thickness(2, 0, 2, 8) };
    private readonly WrapPanel _pastillas = new() { Margin = new Thickness(0, 0, 0, 10) };
    private readonly StackPanel _turnos = new();
    private string _pintado = "";

    public VocesEnVivo()
    {
        _pila.Children.Add(_pastillas);
        _pila.Children.Add(_turnos);
        _pila.Visibility = Visibility.Collapsed;
    }

    public UIElement Vista => _pila;

    /// <summary>¿Lo último pintado traía voces? Si no, la ventana enseña el texto corrido.</summary>
    public bool HayVoces { get; private set; }

    public void Pintar(string texto)
    {
        texto ??= "";
        if (texto == _pintado) return;
        _pintado = texto;

        var turnos = TurnosDeVoz.Partir(texto);
        var partes = TurnosDeVoz.Partes(turnos);
        HayVoces = partes.Count > 0;
        _pila.Visibility = HayVoces ? Visibility.Visible : Visibility.Collapsed;
        _pastillas.Children.Clear();
        _turnos.Children.Clear();
        if (!HayVoces) return;

        int? hablando = turnos.LastOrDefault(t => t.Voz != null)?.Voz;
        _pastillas.Children.Add(new TextBlock
        {
            Text = "QUIÉN HABLA",
            Foreground = Estudio.TintaTenue,
            FontSize = 11,
            FontWeight = FontWeights.SemiBold,
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(0, 0, 8, 6),
        });
        foreach (var parte in partes) _pastillas.Children.Add(Pastilla(parte, parte.Voz == hablando));

        foreach (var turno in turnos) _turnos.Children.Add(Fila(turno));
    }

    private static Color ColorDe(int voz) => Colores[(voz - 1) % Colores.Length];

    private static Brush Pincel(Color c, byte alfa = 0xFF)
    {
        var b = new SolidColorBrush(Color.FromArgb(alfa, c.R, c.G, c.B));
        b.Freeze();
        return b;
    }

    private static UIElement Pastilla(ParteDeVoz parte, bool hablando)
    {
        var color = ColorDe(parte.Voz);
        var fila = new StackPanel { Orientation = Orientation.Horizontal };
        fila.Children.Add(new Border
        {
            Width = 8, Height = 8, CornerRadius = new CornerRadius(4),
            Background = Pincel(color),
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(0, 0, 6, 0),
        });
        fila.Children.Add(new TextBlock
        {
            Text = $"Hablante {parte.Voz}",
            Foreground = Estudio.Tinta, FontSize = 12, FontWeight = FontWeights.SemiBold,
        });
        fila.Children.Add(new TextBlock
        {
            // «del texto» y no «del tiempo»: la parte se mide en caracteres transcritos.
            Text = $"  ·  {parte.Porcentaje} % del texto" + (hablando ? "  ·  hablando" : ""),
            Foreground = Estudio.TintaMedia, FontSize = 12,
        });
        return new Border
        {
            Child = fila,
            Background = Pincel(color, 0x1A),
            BorderBrush = Pincel(color, hablando ? (byte)0xCC : (byte)0x66),
            BorderThickness = new Thickness(hablando ? 1.5 : 1),
            CornerRadius = new CornerRadius(11),
            Padding = new Thickness(10, 3, 10, 3),
            Margin = new Thickness(0, 0, 6, 6),
        };
    }

    private static UIElement Fila(TurnoDeVoz turno)
    {
        var grid = new Grid { Margin = new Thickness(0, 0, 0, 12) };
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(38) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

        bool conVoz = turno.Voz is int;
        var color = conVoz ? ColorDe(turno.Voz!.Value) : Colors.Transparent;
        var avatar = new Border
        {
            Width = 28, Height = 28, CornerRadius = new CornerRadius(14),
            Background = conVoz ? Pincel(color) : Brushes.Transparent,
            BorderBrush = conVoz ? Brushes.Transparent : Estudio.Borde,
            BorderThickness = new Thickness(1),
            VerticalAlignment = VerticalAlignment.Top,
            HorizontalAlignment = HorizontalAlignment.Left,
            Child = new TextBlock
            {
                Text = conVoz ? $"H{turno.Voz}" : "—",
                Foreground = conVoz ? Brushes.White : Estudio.TintaTenue,
                FontSize = 11, FontWeight = FontWeights.SemiBold,
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
            },
        };
        grid.Children.Add(avatar);

        var texto = new StackPanel();
        texto.Children.Add(new TextBlock
        {
            Text = conVoz ? $"Hablante {turno.Voz}" : "Sin voz asignada",
            Foreground = conVoz ? Pincel(color) : Estudio.TintaMedia,
            FontSize = 12, FontWeight = FontWeights.SemiBold,
            Margin = new Thickness(0, 0, 0, 2),
        });
        texto.Children.Add(new TextBlock
        {
            Text = turno.Texto,
            Foreground = Estudio.Tinta, FontSize = 15, LineHeight = 24,
            TextWrapping = TextWrapping.Wrap,
        });
        Grid.SetColumn(texto, 1);
        grid.Children.Add(texto);
        return grid;
    }
}
