using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.Windows.Shapes;
using System.Windows.Threading;
using U.Ciclo;

namespace U.Nuevo;

/// <summary>
/// ÓRDENES ESCRITAS, junto a la burbuja (clic derecho → «Escribirle una orden…»). Se escribe, Enter, y el panel
/// cuenta lo que Ü hace mientras lo hace: el plan de Luna, cada clic con su tiempo, y la respuesta al final.
///
/// MIENTRAS Ü ACTÚA EL PANEL NO EXISTE PARA EL RATÓN NI PARA EL FOCO. Para escribir tiene que poder tomar el
/// teclado; en cuanto se envía se vuelve no activable y transparente al ratón, y el foco vuelve a la ventana
/// que estaba delante al abrirlo: un clic de Ü que caiga encima llega a la app de debajo, y «dónde estoy» es
/// la app de la persona y no este panel. Parar es Escape, que Ü ya escucha en todo el escritorio.
/// </summary>
public sealed class PanelDeOrdenes : Window
{
    private const double Ancho = 460;

    private readonly Asistente _ü;
    private readonly string? _claveOpenAI;
    private readonly Action<string> _estadoBurbuja;
    private readonly Func<Rect> _burbuja;

    private readonly TextBox _orden;
    private readonly TextBlock _pista;
    private readonly Button _hacer;
    private readonly Border _barraEstado;
    private readonly TextBlock _textoEstado;
    private readonly Ellipse _punto;
    private readonly StackPanel _relato;
    private readonly ScrollViewer _desplazar;
    private readonly Border _resultado;
    private readonly TextBox _textoResultado;
    private readonly TextBlock _pieResultado;
    private readonly DispatcherTimer _reloj = new() { Interval = TimeSpan.FromMilliseconds(250) };

    private IntPtr _hwnd, _ventanaDeLaPersona;
    private bool _trabajando;
    private System.Diagnostics.Stopwatch _cronometro = new();

    public PanelDeOrdenes(Asistente ü, string? claveOpenAI, Action<string> estadoBurbuja, Func<Rect> burbuja)
    {
        _ü = ü; _claveOpenAI = claveOpenAI; _estadoBurbuja = estadoBurbuja; _burbuja = burbuja;
        Title = "Ü · órdenes";
        WindowStyle = WindowStyle.None; AllowsTransparency = true; Background = Brushes.Transparent;
        Topmost = true; ShowInTaskbar = false; ResizeMode = ResizeMode.NoResize;
        Width = Ancho; SizeToContent = SizeToContent.Height;
        FontFamily = new FontFamily("Segoe UI Variable Text, Segoe UI");

        // ── Cabecera: se arrastra desde aquí ───────────────────────────────────────────────────
        var marca = new Grid { Width = 22, Height = 22, Margin = new Thickness(0, 0, 10, 0) };
        marca.Children.Add(new Ellipse { Fill = Pincel("#2F80ED") });
        marca.Children.Add(new TextBlock { Text = "Ü", FontSize = 12, FontWeight = FontWeights.Bold, Foreground = Brushes.White,
            HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center });
        var titulo = new TextBlock { Text = "¿Qué hago?", FontSize = 14, FontWeight = FontWeights.SemiBold, Foreground = Pincel("#F2F3F5"),
            VerticalAlignment = VerticalAlignment.Center };
        var cerrar = BotonPlano("✕", 12);
        cerrar.ToolTip = "Cerrar (Esc)";
        cerrar.Click += (_, _) => { if (!_trabajando) Hide(); };
        var cabecera = new DockPanel { Margin = new Thickness(16, 14, 10, 10), Background = Brushes.Transparent, LastChildFill = false };
        DockPanel.SetDock(cerrar, Dock.Right);
        cabecera.Children.Add(cerrar); cabecera.Children.Add(marca); cabecera.Children.Add(titulo);
        cabecera.MouseLeftButtonDown += (_, e) => { if (!_trabajando && e.ButtonState == MouseButtonState.Pressed) try { DragMove(); } catch (InvalidOperationException) { } };

        // ── La orden ──────────────────────────────────────────────────────────────────────────────
        _orden = new TextBox
        {
            AcceptsReturn = true, TextWrapping = TextWrapping.Wrap, MinHeight = 48, MaxHeight = 150,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto, FontSize = 14,
            Background = Brushes.Transparent, BorderThickness = new Thickness(0), Foreground = Pincel("#F2F3F5"),
            CaretBrush = Pincel("#F2F3F5"), SelectionBrush = Pincel("#2F80ED"), Padding = new Thickness(0),
        };
        _pista = new TextBlock
        {
            Text = "Ej.: abre Chrome, busca vuelos de Medellín a Bogotá para el viernes y dime el más barato",
            FontSize = 14, Foreground = Pincel("#6B6F78"), TextWrapping = TextWrapping.Wrap, IsHitTestVisible = false,
        };
        var campo = new Grid();
        campo.Children.Add(_pista); campo.Children.Add(_orden);
        var marcoCampo = new Border
        {
            Child = campo, Background = Pincel("#26272D"), CornerRadius = new CornerRadius(10),
            BorderBrush = Pincel("#3A3C44"), BorderThickness = new Thickness(1), Padding = new Thickness(12, 10, 12, 10),
            Margin = new Thickness(16, 0, 16, 0),
        };
        _orden.GotKeyboardFocus += (_, _) => marcoCampo.BorderBrush = Pincel("#2F80ED");
        _orden.LostKeyboardFocus += (_, _) => marcoCampo.BorderBrush = Pincel("#3A3C44");
        _orden.TextChanged += (_, _) => ActualizarBoton();
        _orden.PreviewKeyDown += (_, e) =>
        {
            if (e.Key == Key.Enter && (Keyboard.Modifiers & ModifierKeys.Shift) == 0) { e.Handled = true; Enviar(); }
        };

        _hacer = new Button
        {
            Content = "Hacer", Padding = new Thickness(18, 7, 18, 7), FontSize = 13, FontWeight = FontWeights.SemiBold,
            Foreground = Brushes.White, Cursor = Cursors.Hand, Template = PlantillaBoton("#2F80ED", "#1F6FDB", "#34363D"),
        };
        _hacer.Click += (_, _) => Enviar();
        var atajos = new TextBlock { Text = "Enter para enviar · Mayús+Enter, nueva línea", FontSize = 11, Foreground = Pincel("#7C808A"),
            VerticalAlignment = VerticalAlignment.Center };
        var filaEnviar = new DockPanel { Margin = new Thickness(16, 10, 16, 14), LastChildFill = false };
        DockPanel.SetDock(_hacer, Dock.Right);
        filaEnviar.Children.Add(_hacer); filaEnviar.Children.Add(atajos);

        // ── Estado mientras trabaja ───────────────────────────────────────────────────────────────
        _punto = new Ellipse { Width = 8, Height = 8, Fill = Pincel("#27AE60"), Margin = new Thickness(0, 0, 8, 0), VerticalAlignment = VerticalAlignment.Center };
        _textoEstado = new TextBlock { FontSize = 12, Foreground = Pincel("#C9CCD2"), VerticalAlignment = VerticalAlignment.Center };
        var esc = new Border
        {
            Child = new TextBlock { Text = "Esc para parar", FontSize = 11, Foreground = Pincel("#C9CCD2") },
            Background = Pincel("#33363E"), CornerRadius = new CornerRadius(5), Padding = new Thickness(7, 2, 7, 3),
        };
        var filaEstado = new DockPanel { LastChildFill = false };
        DockPanel.SetDock(esc, Dock.Right);
        filaEstado.Children.Add(esc); filaEstado.Children.Add(_punto); filaEstado.Children.Add(_textoEstado);
        _barraEstado = new Border { Child = filaEstado, Margin = new Thickness(16, 0, 16, 10), Visibility = Visibility.Collapsed };

        // ── El relato: lo que va haciendo ─────────────────────────────────────────────────────────
        _relato = new StackPanel();
        _desplazar = new ScrollViewer
        {
            Content = _relato, MaxHeight = 260, VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            Margin = new Thickness(16, 0, 10, 10), Padding = new Thickness(0, 0, 6, 0), Visibility = Visibility.Collapsed,
        };

        // ── La respuesta ─────────────────────────────────────────────────────────────────────────
        _textoResultado = new TextBox
        {
            IsReadOnly = true, TextWrapping = TextWrapping.Wrap, FontSize = 14, Background = Brushes.Transparent,
            BorderThickness = new Thickness(0), Foreground = Pincel("#F2F3F5"), Padding = new Thickness(0),
            MaxHeight = 220, VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
        };
        _pieResultado = new TextBlock { FontSize = 11, Foreground = Pincel("#9AA0AA"), Margin = new Thickness(0, 6, 0, 0) };
        var cuerpoResultado = new StackPanel();
        cuerpoResultado.Children.Add(_textoResultado); cuerpoResultado.Children.Add(_pieResultado);
        _resultado = new Border
        {
            Child = cuerpoResultado, CornerRadius = new CornerRadius(10), Padding = new Thickness(12, 10, 12, 10),
            Margin = new Thickness(16, 0, 16, 12), Visibility = Visibility.Collapsed, BorderThickness = new Thickness(1),
        };

        var todo = new StackPanel();
        todo.Children.Add(cabecera);
        todo.Children.Add(marcoCampo);
        todo.Children.Add(filaEnviar);
        todo.Children.Add(_barraEstado);
        todo.Children.Add(_desplazar);
        todo.Children.Add(_resultado);

        Content = new Border
        {
            Child = todo, Margin = new Thickness(14), CornerRadius = new CornerRadius(14),
            Background = Pincel("#F71C1D22"), BorderBrush = Pincel("#3A3C44"), BorderThickness = new Thickness(1),
            Effect = new DropShadowEffect { BlurRadius = 24, ShadowDepth = 4, Opacity = 0.45, Color = Colors.Black },
        };

        PreviewKeyDown += (_, e) => { if (e.Key == Key.Escape && !_trabajando) { e.Handled = true; Hide(); } };
        SizeChanged += (_, _) => Colocar();
        _reloj.Tick += (_, _) =>
        {
            _textoEstado.Text = $"Trabajando… {_cronometro.Elapsed.TotalSeconds:0} s";
            _punto.Opacity = _punto.Opacity > 0.6 ? 0.35 : 1;
        };
        Registro.Linea += l => { if (_trabajando) Dispatcher.BeginInvoke(() => Contar(l)); };
        ActualizarBoton();
    }

    /// <summary>Se abre junto a la burbuja, con el cursor en la caja, y recuerda qué ventana estaba delante.</summary>
    public void Abrir()
    {
        var delante = GetForegroundWindow();
        GetWindowThreadProcessId(delante, out uint pid);
        if (pid != Environment.ProcessId) _ventanaDeLaPersona = delante;
        Show();
        Colocar();
        if (!_trabajando) { Activate(); _orden.Focus(); _orden.SelectAll(); }
    }

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);
        _hwnd = new WindowInteropHelper(this).Handle;
        SetWindowLong(_hwnd, -20, GetWindowLong(_hwnd, -20) | 0x00000080 /* TOOLWINDOW: fuera de Alt+Tab */);
    }

    /// <summary>Encima de la burbuja, alineado a su borde derecho, y siempre dentro del área de trabajo.</summary>
    private void Colocar()
    {
        var b = _burbuja();
        var area = SystemParameters.WorkArea;
        double alto = ActualHeight > 0 ? ActualHeight : 260;
        double left = b.Right - Width + 14, top = b.Top - alto + 18;
        if (top < area.Top) top = Math.Min(b.Bottom - 10, area.Bottom - alto);
        Left = Math.Max(area.Left, Math.Min(left, area.Right - Width));
        Top = Math.Max(area.Top, top);
    }

    private void ActualizarBoton()
    {
        bool vacia = string.IsNullOrWhiteSpace(_orden.Text);
        _pista.Visibility = _orden.Text.Length == 0 ? Visibility.Visible : Visibility.Collapsed;
        _hacer.IsEnabled = !vacia && !_trabajando;
    }

    private void Enviar()
    {
        string pedido = _orden.Text.Trim();
        if (pedido.Length == 0 || _trabajando) return;
        if (_claveOpenAI == null)
        {
            MostrarResultado("No tengo clave de OpenAI: sin ella Luna no puede planear. Guárdala en OPENAI_API_KEY y vuelve a abrir Ü.", false, null);
            return;
        }

        _trabajando = true;
        _relato.Children.Clear();
        _resultado.Visibility = Visibility.Collapsed;
        _desplazar.Visibility = Visibility.Collapsed;
        _barraEstado.Visibility = Visibility.Visible;
        _orden.IsReadOnly = true; _orden.Opacity = 0.6;
        ActualizarBoton();
        _cronometro = System.Diagnostics.Stopwatch.StartNew();
        _textoEstado.Text = "Trabajando… 0 s";
        _reloj.Start();

        // Fuera del camino de Ü: sin foco y transparente al ratón, y el foco a la app de la persona.
        Fantasma(true);
        if (_ventanaDeLaPersona != IntPtr.Zero) SetForegroundWindow(_ventanaDeLaPersona);

        Registro.Log("✍ " + pedido);
        _ = Task.Run(() =>
        {
            _estadoBurbuja("actuando");
            string respuesta; bool bien;
            try
            {
                using var luna = new LunaPorTexto(_claveOpenAI) { Log = Registro.Log };
                respuesta = luna.Pedir(pedido, _ü);
                bien = !FalloDeLuna(respuesta);
            }
            catch (Exception e)
            {
                respuesta = "";
                for (var x = e; x != null; x = x.InnerException) respuesta += (respuesta.Length > 0 ? " ← " : "") + $"{x.GetType().Name}: {x.Message}";
                bien = false;
            }
            Registro.Log("Ü: " + respuesta);
            _estadoBurbuja(bien ? "quieta" : "error");
            Dispatcher.BeginInvoke(() => Terminar(respuesta, bien));
        });
    }

    private void Terminar(string respuesta, bool bien)
    {
        _trabajando = false;
        _reloj.Stop();
        _barraEstado.Visibility = Visibility.Collapsed;
        Fantasma(false);
        _orden.IsReadOnly = false; _orden.Opacity = 1;
        ActualizarBoton();
        MostrarResultado(respuesta, bien, _cronometro.Elapsed);
    }

    private void MostrarResultado(string texto, bool bien, TimeSpan? tardo)
    {
        _textoResultado.Text = Limpiar(texto);
        _resultado.Background = Pincel(bien ? "#1B2E24" : "#33201F");
        _resultado.BorderBrush = Pincel(bien ? "#2D5A40" : "#6B2E2B");
        int clics = _relato.Children.OfType<FrameworkElement>().Count(r => (r.Tag as string) == "clic");
        _pieResultado.Text = tardo is { } t
            ? $"{(bien ? "Listo" : "No terminó")} en {t.TotalSeconds:0.0} s · {clics} clic(s)"
            : "";
        _pieResultado.Visibility = tardo == null ? Visibility.Collapsed : Visibility.Visible;
        _resultado.Visibility = Visibility.Visible;
    }

    /// <summary>Lo que Pedir devuelve cuando Luna no llegó a terminar: se pinta en rojo, no en verde.</summary>
    private static bool FalloDeLuna(string r) =>
        r.StartsWith("Luna contestó HTTP") || r.StartsWith("No pude hablar con Luna") || r.StartsWith("Paré:");

    // ── El relato: cada línea del log que importa a la persona, en su idioma ─────────────────────

    private static readonly Regex Vuelta = new(@"⏱ .*?total (?<ms>[\d.]+) ms(?<fuera> · FUERA DE PRESUPUESTO)?(?: · pulsé \d+\) (?<que>.+?) \((?<tipo>\w+)\))?(?: · (?<resto>.+))?$");

    private void Contar(string l)
    {
        string s = l.Trim();
        if (s.StartsWith("🌙 Luna") && s.Contains("→ hacer "))
        {
            string pasos = s[(s.IndexOf("→ hacer ", StringComparison.Ordinal) + 8)..];
            try
            {
                using var d = JsonDocument.Parse(pasos);
                var lista = d.RootElement.GetProperty("pasos").EnumerateArray().Select(p => p.GetString() ?? "").ToList();
                Fila("◆", "Plan: " + string.Join(" → ", lista), "#B39DDB");
            }
            catch (JsonException) { Fila("◆", "Luna planea", "#B39DDB"); }
        }
        else if (s.StartsWith("🌙 Luna") && s.Contains("→ mirar")) Fila("◇", "Mira la pantalla", "#8E93A0");
        else if (s.StartsWith("⏱"))
        {
            var m = Vuelta.Match(s);
            if (!m.Success) return;
            string ms = double.TryParse(m.Groups["ms"].Value, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var v) ? $"{v:0} ms" : "";
            if (m.Groups["que"].Success)
                Fila("●", $"Pulsó «{Recortar(m.Groups["que"].Value, 70)}»", "#E6E7EA", ms, m.Groups["fuera"].Success ? "#E0A43B" : "#7C808A", "clic");
            else if (m.Groups["resto"].Success && m.Groups["resto"].Value != "cumplido")
                Fila("!", Recortar(m.Groups["resto"].Value, 110), "#E0A43B");
        }
        else if (s.StartsWith("✔ abrí «")) Fila("↗", "Abrió " + Entre(s), "#E6E7EA");
        else if (s.StartsWith("✔ escribí «")) Fila("⌨", $"Escribió «{Recortar(Entre(s), 60)}»", "#E6E7EA");
        else if (s.StartsWith("✔ «") && s.EndsWith("cumplido")) Fila("✓", Entre(s), "#6FCF97");
        else if (s.StartsWith("✘")) Fila("✕", Recortar(s[1..].Trim(), 140), "#EB7A74");
    }

    private void Fila(string icono, string texto, string color, string? ms = null, string? colorMs = null, string? tipo = null)
    {
        var g = new Grid { Margin = new Thickness(0, 3, 0, 3), Tag = tipo };
        g.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(22) });
        g.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        g.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        var i = new TextBlock { Text = icono, Foreground = Pincel(color), FontSize = 12, VerticalAlignment = VerticalAlignment.Top, Margin = new Thickness(0, 1, 0, 0) };
        var t = new TextBlock { Text = texto, Foreground = Pincel(color), FontSize = 13, TextWrapping = TextWrapping.Wrap };
        Grid.SetColumn(t, 1); g.Children.Add(i); g.Children.Add(t);
        if (ms != null)
        {
            var m = new TextBlock { Text = ms, Foreground = Pincel(colorMs ?? "#7C808A"), FontSize = 11, Margin = new Thickness(10, 2, 0, 0),
                FontFamily = new FontFamily("Cascadia Mono, Consolas") };
            Grid.SetColumn(m, 2); g.Children.Add(m);
        }
        _relato.Children.Add(g);
        _desplazar.Visibility = Visibility.Visible;
        _desplazar.ScrollToEnd();
    }

    private static string Entre(string s)
    {
        int a = s.IndexOf('«'), b = s.LastIndexOf('»');
        return a >= 0 && b > a ? s[(a + 1)..b] : s;
    }

    private static string Recortar(string s, int n) => s.Length > n ? s[..n] + "…" : s;
    private static string Limpiar(string s) => s.Replace("**", "").Trim();

    // ── Estilo ───────────────────────────────────────────────────────────────────────────────────

    private void Fantasma(bool si)
    {
        if (_hwnd == IntPtr.Zero) return;
        int ex = GetWindowLong(_hwnd, -20);
        const int NoActivar = 0x08000000, Transparente = 0x00000020;
        SetWindowLong(_hwnd, -20, si ? ex | NoActivar | Transparente : ex & ~(NoActivar | Transparente));
    }

    private static SolidColorBrush Pincel(string hex) => new((Color)ColorConverter.ConvertFromString(hex));

    private static Button BotonPlano(string texto, double tam) => new()
    {
        Content = texto, FontSize = tam, Width = 28, Height = 28, Foreground = Pincel("#9AA0AA"), Cursor = Cursors.Hand,
        Template = PlantillaBoton("#00000000", "#2C2E35", "#00000000"),
    };

    /// <summary>Un botón plano con esquinas redondeadas: color normal, al pasar por encima, y deshabilitado.</summary>
    private static ControlTemplate PlantillaBoton(string normal, string encima, string apagado)
    {
        var t = new ControlTemplate(typeof(Button));
        var borde = new FrameworkElementFactory(typeof(Border), "borde");
        borde.SetValue(Border.BackgroundProperty, Pincel(normal));
        borde.SetValue(Border.CornerRadiusProperty, new CornerRadius(8));
        borde.SetValue(Border.PaddingProperty, new TemplateBindingExtension(Control.PaddingProperty));
        var contenido = new FrameworkElementFactory(typeof(ContentPresenter));
        contenido.SetValue(HorizontalAlignmentProperty, HorizontalAlignment.Center);
        contenido.SetValue(VerticalAlignmentProperty, VerticalAlignment.Center);
        borde.AppendChild(contenido);
        t.VisualTree = borde;
        var sobre = new Trigger { Property = IsMouseOverProperty, Value = true };
        sobre.Setters.Add(new Setter(Border.BackgroundProperty, Pincel(encima), "borde"));
        var off = new Trigger { Property = IsEnabledProperty, Value = false };
        off.Setters.Add(new Setter(Border.BackgroundProperty, Pincel(apagado), "borde"));
        off.Setters.Add(new Setter(ForegroundProperty, Pincel("#7C808A")));
        t.Triggers.Add(sobre); t.Triggers.Add(off);
        return t;
    }

    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] private static extern int GetWindowLong(IntPtr h, int i);
    [DllImport("user32.dll")] private static extern int SetWindowLong(IntPtr h, int i, int v);
}
