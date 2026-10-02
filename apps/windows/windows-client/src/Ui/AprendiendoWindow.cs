using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Shapes;
using System.Windows.Threading;
using U.WindowsClient.Diagnostics;
using U.WindowsClient.Voice;

namespace U.WindowsClient.Ui;

/// <summary>
/// LA TARJETITA DE «ESTO APRENDÍ» (spec 084): flota abajo, en el centro. Mientras Ü repasa, un aro que gira; al
/// terminar, el aro se vuelve una estrella y se despliega la lista de lo que aprendió, línea a línea.
/// </summary>
/// <remarks>
/// NO ROBA NADA: no se activa, no sale en la barra de tareas y no pide foco (WS_EX_NOACTIVATE, que es lo que sí
/// funciona —ver la onda del notch, spec 066—). Un clic la despide. Se va sola: lo aprendido no es un diálogo.
/// Lo que pinta lo decide <see cref="LoQueAprendi"/>, que es lo que el contrato juzga; aquí solo hay dibujo.
/// </remarks>
public sealed class AprendiendoWindow : Window
{
    private readonly Grid _icono = new() { Width = 26, Height = 26, VerticalAlignment = VerticalAlignment.Center };
    private readonly TextBlock _titulo;
    private readonly StackPanel _lineas = new() { Margin = new Thickness(38, 0, 4, 0) };
    private readonly Border _tarjeta;
    private readonly DispatcherTimer _despedida = new();
    private bool _saliendo;

    public AprendiendoWindow()
    {
        WindowStyle = WindowStyle.None;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        ShowInTaskbar = false;
        ShowActivated = false;
        Topmost = true;
        ResizeMode = ResizeMode.NoResize;
        SizeToContent = SizeToContent.WidthAndHeight;
        Title = "Ü aprende";

        _titulo = new TextBlock
        {
            Foreground = Estudio.Tinta,
            FontSize = 14.5,
            FontWeight = FontWeights.SemiBold,
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(12, 0, 6, 0),
        };
        var cabecera = new StackPanel { Orientation = Orientation.Horizontal };
        cabecera.Children.Add(_icono);
        cabecera.Children.Add(_titulo);

        var pila = new StackPanel();
        pila.Children.Add(cabecera);
        pila.Children.Add(_lineas);

        _tarjeta = new Border
        {
            Background = Estudio.Superficie,
            BorderBrush = Estudio.Borde,
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(24),
            Padding = new Thickness(16, 13, 20, 13),
            MaxWidth = 460,
            Child = pila,
            RenderTransform = new TranslateTransform(0, 14),
            Opacity = 0,
            Cursor = Cursors.Hand,
        };
        // La sombra la echa una placa detrás, no el borde con el texto: dentro de un Effect el texto pierde ClearType.
        var marco = Estudio.Elevar(_tarjeta, Estudio.Sombra3);
        marco.Margin = new Thickness(26, 20, 26, 30);
        Content = marco;

        MouseLeftButtonDown += (_, __) => Despedir();
        SizeChanged += (_, __) => Colocar();
        SourceInitialized += (_, __) =>
        {
            var h = new WindowInteropHelper(this).Handle;
            SetWindowLong(h, GWL_EXSTYLE, GetWindowLong(h, GWL_EXSTYLE) | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW);
        };
        _despedida.Tick += (_, __) => Despedir();
    }

    /// <summary>Pinta lo que haya que pintar. Se llama en el hilo de la interfaz.</summary>
    public void Mostrar(LoQueAprendi.Vista vista)
    {
        _despedida.Stop();
        _saliendo = false;
        _titulo.Text = vista.Titulo;
        _lineas.Children.Clear();
        _icono.Children.Clear();

        if (vista.Cargando) PintarElAro();
        else PintarLaEstrella(conBrillo: vista.Lineas.Count > 0);

        for (int i = 0; i < vista.Lineas.Count; i++) _lineas.Children.Add(Linea(vista.Lineas[i], i));
        _lineas.Margin = new Thickness(38, vista.Lineas.Count > 0 ? 8 : 0, 4, vista.Lineas.Count > 0 ? 2 : 0);

        if (!IsVisible) Show();
        Colocar();
        Entrar();

        if (!vista.Cargando)
        {
            // CUANTO MÁS HAY QUE LEER, MÁS SE QUEDA; «nada nuevo» es un vistazo.
            _despedida.Interval = TimeSpan.FromSeconds(vista.Lineas.Count == 0 ? 4 : 8 + 2.5 * vista.Lineas.Count);
            _despedida.Start();
        }
        LogBus.Log("aprendido", vista.Cargando ? "indicador: cargando" : $"indicador: «{vista.Titulo}» con {vista.Lineas.Count} línea(s)");
    }

    // ── el dibujo ────────────────────────────────────────────────────────────

    /// <summary>Un aro tenue y, encima, un arco de color que da vueltas.</summary>
    private void PintarElAro()
    {
        _icono.Children.Add(new Ellipse { Stroke = Estudio.AcentoSuave, StrokeThickness = 3.2, Margin = new Thickness(2) });
        var arco = new Path
        {
            Stroke = Estudio.Acento,
            StrokeThickness = 3.2,
            StrokeStartLineCap = PenLineCap.Round,
            StrokeEndLineCap = PenLineCap.Round,
            // Un cuarto largo de círculo de radio 9,4 centrado en (13,13).
            Data = Geometry.Parse("M 13,3.6 A 9.4,9.4 0 0 1 22.4,13"),
            RenderTransformOrigin = new Point(0.5, 0.5),
            RenderTransform = new RotateTransform(0),
            Width = 26, Height = 26,
        };
        _icono.Children.Add(arco);
        arco.RenderTransform.BeginAnimation(RotateTransform.AngleProperty,
            new DoubleAnimation(0, 360, TimeSpan.FromMilliseconds(900)) { RepeatBehavior = RepeatBehavior.Forever });
    }

    /// <summary>La estrella que queda al terminar: entra con un rebote y, si hubo algo que aprender, parpadea una vez.</summary>
    private void PintarLaEstrella(bool conBrillo)
    {
        var fondo = new Ellipse { Fill = Estudio.AcentoSuave };
        var estrella = new TextBlock
        {
            Text = conBrillo ? "✦" : "·",
            Foreground = Estudio.Acento,
            FontSize = conBrillo ? 15 : 22,
            FontWeight = FontWeights.Bold,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            RenderTransformOrigin = new Point(0.5, 0.5),
            RenderTransform = new ScaleTransform(0.2, 0.2),
        };
        _icono.Children.Add(fondo);
        _icono.Children.Add(estrella);
        var rebote = new DoubleAnimation(0.2, 1, TimeSpan.FromMilliseconds(420)) { EasingFunction = new BackEase { Amplitude = 0.9, EasingMode = EasingMode.EaseOut } };
        estrella.RenderTransform.BeginAnimation(ScaleTransform.ScaleXProperty, rebote);
        estrella.RenderTransform.BeginAnimation(ScaleTransform.ScaleYProperty, rebote);
        if (conBrillo)
            fondo.BeginAnimation(OpacityProperty, new DoubleAnimation(1, 0.45, TimeSpan.FromMilliseconds(520)) { AutoReverse = true, BeginTime = TimeSpan.FromMilliseconds(380) });
    }

    /// <summary>Una cosa aprendida: entra deslizándose, cada una un poco después que la anterior.</summary>
    private static UIElement Linea(string texto, int orden)
    {
        var fila = new DockPanel { Margin = new Thickness(0, 3, 0, 3), Opacity = 0, RenderTransform = new TranslateTransform(0, 8) };
        var punto = new TextBlock { Text = "✦", Foreground = Estudio.Acento, FontSize = 9.5, Margin = new Thickness(0, 4, 8, 0), VerticalAlignment = VerticalAlignment.Top };
        DockPanel.SetDock(punto, Dock.Left);
        fila.Children.Add(punto);
        fila.Children.Add(new TextBlock { Text = texto, Foreground = Estudio.TintaMedia, FontSize = 13, LineHeight = 18, TextWrapping = TextWrapping.Wrap });
        var espera = TimeSpan.FromMilliseconds(260 + 140 * orden);
        fila.BeginAnimation(OpacityProperty, new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(320)) { BeginTime = espera });
        fila.RenderTransform.BeginAnimation(TranslateTransform.YProperty,
            new DoubleAnimation(8, 0, TimeSpan.FromMilliseconds(320)) { BeginTime = espera, EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } });
        return fila;
    }

    private void Entrar()
    {
        _tarjeta.BeginAnimation(OpacityProperty, new DoubleAnimation(_tarjeta.Opacity, 1, TimeSpan.FromMilliseconds(240)));
        _tarjeta.RenderTransform.BeginAnimation(TranslateTransform.YProperty,
            new DoubleAnimation(((TranslateTransform)_tarjeta.RenderTransform).Y, 0, TimeSpan.FromMilliseconds(300)) { EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } });
    }

    private void Despedir()
    {
        if (_saliendo || !IsVisible) return;
        _saliendo = true;
        _despedida.Stop();
        var fuera = new DoubleAnimation(_tarjeta.Opacity, 0, TimeSpan.FromMilliseconds(260));
        fuera.Completed += (_, __) => { if (_saliendo) { Hide(); _saliendo = false; } };
        _tarjeta.BeginAnimation(OpacityProperty, fuera);
        _tarjeta.RenderTransform.BeginAnimation(TranslateTransform.YProperty, new DoubleAnimation(0, 14, TimeSpan.FromMilliseconds(260)));
    }

    /// <summary>Abajo y al centro del área de trabajo: ni encima de la carita ni de la barra de tareas.</summary>
    private void Colocar()
    {
        var area = SystemParameters.WorkArea;
        Left = area.Left + (area.Width - ActualWidth) / 2;
        Top = area.Bottom - ActualHeight - 6;
    }

    private const int GWL_EXSTYLE = -20, WS_EX_NOACTIVATE = 0x08000000, WS_EX_TOOLWINDOW = 0x00000080;
    [DllImport("user32.dll")] private static extern int GetWindowLong(IntPtr h, int i);
    [DllImport("user32.dll")] private static extern int SetWindowLong(IntPtr h, int i, int v);
}
