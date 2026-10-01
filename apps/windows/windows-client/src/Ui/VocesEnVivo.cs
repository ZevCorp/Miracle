using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using U.WindowsClient.Clinical.Transcripcion;

namespace U.WindowsClient.Ui;

/// <summary>
/// LO OÍDO, POR VOCES (spec 070). Mientras se graba, en vez del texto corrido: una pastilla por voz
/// con su parte de lo dicho, y una fila por turno con el círculo y el nombre de la voz.
/// </summary>
/// <remarks>
/// Solo se enseña si lo oído trae voces —Soniox con diarización—; sin ellas manda el texto corrido
/// de siempre, y <see cref="HayVoces"/> es lo que la ventana mira para elegir.
///
/// MONOCROMÁTICA, y no por gusto: la primera versión daba un color a cada voz (azul, verde, violeta)
/// y el dueño la devolvió el 2026-09-30 — en una ventana que es tinta sobre papel, seis colores
/// compiten con lo único que importa, que es el texto. Las voces se distinguen por el NÚMERO y por
/// el relleno del círculo, con la paleta de <see cref="Estudio"/>: la 1 en tinta, la 2 en blanco con
/// borde de tinta, la 3 en gris, y vuelve a empezar.
/// </remarks>
public sealed class VocesEnVivo
{
    private readonly StackPanel _pila = new() { Margin = new Thickness(4, 0, 4, 8) };
    private readonly WrapPanel _pastillas = new() { Margin = new Thickness(0, 0, 0, 12) };
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
            Margin = new Thickness(0, 0, 10, 6),
        });
        foreach (var parte in partes) _pastillas.Children.Add(Pastilla(parte, parte.Voz == hablando));

        foreach (var turno in turnos) _turnos.Children.Add(Fila(turno));
    }

    /// <summary>
    /// El círculo de una voz. Tres rellenos que se repiten: tinta, papel con borde de tinta, gris.
    /// El número va siempre dentro, que es lo que de verdad distingue a la cuarta de la primera.
    /// </summary>
    private static Border Circulo(int? voz, double lado, double letra)
    {
        Brush fondo = Brushes.Transparent, borde = Estudio.Borde, tinta = Estudio.TintaTenue;
        if (voz is int v)
        {
            (fondo, borde, tinta) = ((v - 1) % 3) switch
            {
                0 => (Estudio.Tinta, Estudio.Tinta, Estudio.Superficie),
                1 => (Estudio.Superficie, Estudio.Tinta, Estudio.Tinta),
                _ => (Estudio.SuperficieSuave, Estudio.TintaTenue, Estudio.Tinta),
            };
        }
        return new Border
        {
            Width = lado, Height = lado, CornerRadius = new CornerRadius(lado / 2),
            Background = fondo, BorderBrush = borde, BorderThickness = new Thickness(1.25),
            Child = new TextBlock
            {
                Text = voz?.ToString() ?? "—",
                Foreground = tinta, FontSize = letra, FontWeight = FontWeights.SemiBold,
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
            },
        };
    }

    private static UIElement Pastilla(ParteDeVoz parte, bool hablando)
    {
        var fila = new StackPanel { Orientation = Orientation.Horizontal };
        var circulo = Circulo(parte.Voz, 16, 9.5);
        circulo.VerticalAlignment = VerticalAlignment.Center;
        circulo.Margin = new Thickness(0, 0, 7, 0);
        fila.Children.Add(circulo);
        fila.Children.Add(new TextBlock
        {
            Text = $"Hablante {parte.Voz}",
            Foreground = Estudio.Tinta, FontSize = 12, FontWeight = FontWeights.SemiBold,
            VerticalAlignment = VerticalAlignment.Center,
        });
        fila.Children.Add(new TextBlock
        {
            // «del texto» y no «del tiempo»: la parte se mide en caracteres transcritos.
            Text = $"  ·  {parte.Porcentaje} % del texto" + (hablando ? "  ·  hablando" : ""),
            Foreground = Estudio.TintaMedia, FontSize = 12,
            VerticalAlignment = VerticalAlignment.Center,
        });
        return new Border
        {
            Child = fila,
            Background = Estudio.Superficie,
            // Quien habla ahora lleva el borde en tinta; los demás, el borde de cualquier tarjeta.
            BorderBrush = hablando ? Estudio.Tinta : Estudio.Borde,
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(13),
            Padding = new Thickness(8, 4, 12, 4),
            Margin = new Thickness(0, 0, 6, 6),
        };
    }

    private static UIElement Fila(TurnoDeVoz turno)
    {
        var grid = new Grid { Margin = new Thickness(0, 0, 0, 14) };
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(40) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

        var circulo = Circulo(turno.Voz, 26, 12);
        circulo.VerticalAlignment = VerticalAlignment.Top;
        circulo.HorizontalAlignment = HorizontalAlignment.Left;
        circulo.Margin = new Thickness(0, 1, 0, 0);
        grid.Children.Add(circulo);

        var texto = new StackPanel();
        texto.Children.Add(new TextBlock
        {
            Text = turno.Voz is int v ? $"Hablante {v}" : "Sin voz asignada",
            Foreground = Estudio.TintaMedia,
            FontSize = 12, FontWeight = FontWeights.SemiBold,
            Margin = new Thickness(0, 0, 0, 2),
        });
        texto.Children.Add(new TextBlock
        {
            // Igual que el texto corrido al que sustituye (_vivo): 15 sobre 25.
            Text = turno.Texto,
            Foreground = Estudio.Tinta, FontSize = 15, LineHeight = 25,
            TextWrapping = TextWrapping.Wrap,
        });
        Grid.SetColumn(texto, 1);
        grid.Children.Add(texto);
        return grid;
    }
}
