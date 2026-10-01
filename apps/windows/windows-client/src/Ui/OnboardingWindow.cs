using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using U.WindowsClient.Cuenta;

namespace U.WindowsClient.Ui;

/// <summary>Qué pregunta la bienvenida. Ver <see cref="Identidad.QueBienvenida"/>.</summary>
public enum ModoDeBienvenida
{
    /// <summary>Equipo nuevo: cómo vas a usar Ü, y nombre y correo.</summary>
    Completa,

    /// <summary>El equipo ya tenía nombre y correo: solo cómo lo usa (o cambiarlo desde el menú).</summary>
    SoloPerfil,
}

/// <summary>
/// LA BIENVENIDA: quién eres y para qué vas a usar Ü. Dos tarjetas —«Trabajo en salud» y «Uso
/// personal»—, la especialidad si es salud, y en un equipo nuevo también nombre y correo (el correo
/// es la identidad canónica del usuario en «Windows Live»).
/// </summary>
/// <remarks>
/// UNA VENTANA CON DOS MODOS Y NO DOS VENTANAS (spec 071). La promesa 531 exige que toda ventana de
/// Ü esté declarada como flotante o de trabajo, y esta ya lo estaba; una segunda habría sido una
/// forma más de olvidarlo.
///
/// LA PIEL ES LA DEL ESTUDIO CLARO (<see cref="Estudio"/>), como <see cref="LoginWindow"/>: la misma
/// tarjeta única con la marca arriba y un botón ancho. Los carteles al pasar el ratón están
/// apagados en toda la app (promesa 164), así que todo lo que hay que saber va en texto visible.
///
/// NUNCA BLOQUEA. Cerrarla sin contestar deja el perfil sin elegir —la Ü de antes— y se vuelve a
/// preguntar en el próximo arranque. La regla de cuándo sale vive en
/// <see cref="Identidad.QueBienvenida"/>, que el contrato juzga (promesa 652); la ventana es nivel 4.
/// </remarks>
public sealed class OnboardingWindow : Window
{
    private static readonly Regex EmailRe = new(@"^[^\s@]+@[^\s@]+\.[^\s@]+$", RegexOptions.Compiled);

    private readonly ModoDeBienvenida _modo;
    private readonly TextBox _name;
    private readonly TextBox _email;
    private readonly Button _salud;
    private readonly Button _personal;
    private readonly StackPanel _zonaEspecialidad;
    private readonly ComboBox _especialidad;
    private readonly Button _continue;

    /// <summary><c>""</c> hasta que se elige una tarjeta; luego <see cref="PerfilDeUso.Medico"/> o <see cref="PerfilDeUso.Persona"/>.</summary>
    private string _perfil = "";

    public string EnteredName { get; private set; } = "";
    public string EnteredEmail { get; private set; } = "";

    /// <summary>«medico» o «persona», el valor de <c>Config.Perfil</c>.</summary>
    public string PerfilElegido { get; private set; } = "";

    /// <summary>En el formato de <c>profiles.specialty_code</c>. Vacío para uso personal.</summary>
    public string EspecialidadCodigo { get; private set; } = "";

    public string EspecialidadNombre { get; private set; } = "";

    /// <summary>La de siempre: un equipo nuevo.</summary>
    public OnboardingWindow() : this(ModoDeBienvenida.Completa, "") { }

    /// <param name="modo">Qué se pregunta.</param>
    /// <param name="nombreConocido">Para saludar en <see cref="ModoDeBienvenida.SoloPerfil"/>; puede ir vacío.</param>
    /// <param name="perfilActual">Lo que ya estaba elegido, para cambiarlo desde el menú. Vacío si nada.</param>
    /// <param name="especialidadActual">El nombre de la especialidad que ya estaba elegida.</param>
    public OnboardingWindow(ModoDeBienvenida modo, string nombreConocido,
        string perfilActual = "", string especialidadActual = "")
    {
        _modo = modo;
        bool completa = modo == ModoDeBienvenida.Completa;

        Title = "Miracle";
        Width = 452;
        SizeToContent = SizeToContent.Height;
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        ShowInTaskbar = true;
        Topmost = true;

        var tarjeta = new Border
        {
            CornerRadius = new CornerRadius(34),
            Background = Estudio.Fondo,
            BorderBrush = Estudio.Borde,
            BorderThickness = new Thickness(1),
        };

        var pila = new StackPanel { Margin = new Thickness(32, 26, 32, 28) };

        // ── el marco: solo cerrar. Cerrar sin contestar es «todavía no»: se pregunta otro día ──
        var cerrar = new Button
        {
            Content = new TextBlock
            {
                Text = "",
                FontFamily = new FontFamily("Segoe MDL2 Assets"),
                FontSize = 9.5,
                Foreground = Estudio.TintaMedia,
            },
            Width = 30, Height = 30,
            HorizontalAlignment = HorizontalAlignment.Right,
            Background = Brushes.Transparent,
            BorderThickness = new Thickness(0),
            Cursor = Cursors.Hand,
            Template = Estudio.Pastilla(15),
            Margin = new Thickness(0, -6, -6, 2),
        };
        AutomationProperties.SetName(cerrar, "Cerrar");
        cerrar.Click += (_, __) => { DialogResult = false; Close(); };
        cerrar.MouseEnter += (_, __) => cerrar.Background = Estudio.SuperficieSuave;
        cerrar.MouseLeave += (_, __) => cerrar.Background = Brushes.Transparent;
        pila.Children.Add(cerrar);

        // ── marca ────────────────────────────────────────────────────────────
        pila.Children.Add(new System.Windows.Shapes.Polygon
        {
            Points = new PointCollection { new Point(15, 2), new Point(28, 25), new Point(2, 25) },
            Stroke = Estudio.Acento,
            StrokeThickness = 1.8,
            Fill = Estudio.AcentoSuave,
            Width = 30, Height = 27,
            HorizontalAlignment = HorizontalAlignment.Left,
            Margin = new Thickness(0, 0, 0, 18),
        });

        // ── saludo ───────────────────────────────────────────────────────────
        string primerNombre = (nombreConocido ?? "").Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .FirstOrDefault() ?? "";
        pila.Children.Add(new TextBlock
        {
            Text = completa ? "¡Hola! Soy Ü"
                : primerNombre.Length > 0 ? $"¡Hola de nuevo, {primerNombre}!" : "¡Hola de nuevo!",
            Foreground = Estudio.Tinta,
            FontSize = 22,
            FontWeight = FontWeights.Bold,
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 0, 0, 7),
        });
        pila.Children.Add(new TextBlock
        {
            Text = completa
                ? "Antes de empezar, cuéntame quién eres para hablarte como te sirve."
                : "Ahora también acompaño a personas en su día a día. Dime cómo me usas y me ajusto a ti.",
            Foreground = Estudio.TintaMedia,
            FontSize = 13,
            LineHeight = 19,
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 0, 0, 22),
        });

        // ── para qué me vas a usar ──────────────────────────────────────────
        pila.Children.Add(Estudio.Rotulo("¿Para qué me vas a usar?"));
        _salud = Tarjeta("Trabajo en salud",
            "Soy médico u otro profesional de la salud: consultas, historias clínicas, SAP.");
        _personal = Tarjeta("Uso personal",
            "Para mi día a día: archivos, internet, correos, documentos y lo que se me ocurra.");
        _salud.Click += (_, __) => Elegir(PerfilDeUso.Medico, mover: true);
        _personal.Click += (_, __) => Elegir(PerfilDeUso.Persona, mover: true);
        foreach (var t in new[] { _salud, _personal })
        {
            t.GotKeyboardFocus += (_, __) => PintarTarjetas();
            t.LostKeyboardFocus += (_, __) => PintarTarjetas();
            pila.Children.Add(t);
        }

        // ── la especialidad, solo si es salud ───────────────────────────────
        //
        // EDITABLE A PROPÓSITO: el catálogo es el del portal (Especialidades), que no tiene
        // enfermería, fisioterapia ni nutrición. Lo que se escribe y no está en la lista vale igual.
        _especialidad = new ComboBox
        {
            IsEditable = true,
            IsTextSearchEnabled = true,
            ItemsSource = Especialidades.Todas.Select(e => e.Nombre).ToList(),
            Height = 42,
            FontSize = 14,
            Foreground = Estudio.Tinta,
            VerticalContentAlignment = VerticalAlignment.Center,
            Margin = new Thickness(0, 0, 0, 16),
            Text = especialidadActual ?? "",
        };
        AutomationProperties.SetName(_especialidad, "Tu especialidad");
        _especialidad.AddHandler(TextBoxBase.TextChangedEvent, new TextChangedEventHandler((_, __) => Validar()));
        _especialidad.SelectionChanged += (_, __) => Dispatcher.BeginInvoke(new Action(Validar));

        _zonaEspecialidad = new StackPanel { Visibility = Visibility.Collapsed, Margin = new Thickness(0, 6, 0, 0) };
        _zonaEspecialidad.Children.Add(Estudio.Rotulo("Tu especialidad"));
        _zonaEspecialidad.Children.Add(_especialidad);
        pila.Children.Add(_zonaEspecialidad);

        // ── nombre y correo, solo en un equipo nuevo ────────────────────────
        _name = Campo();
        _email = Campo();
        _name.TextChanged += (_, __) => Validar();
        _email.TextChanged += (_, __) => Validar();
        if (completa)
        {
            var separacion = new Border { Height = 6 };
            pila.Children.Add(separacion);
            pila.Children.Add(Estudio.Rotulo("Nombre"));
            pila.Children.Add(Caja(_name));
            pila.Children.Add(Estudio.Rotulo("Correo"));
            pila.Children.Add(Caja(_email));
            AutomationProperties.SetName(_name, "Nombre");
            AutomationProperties.SetName(_email, "Correo");
        }

        // ── confirmar ────────────────────────────────────────────────────────
        _continue = new Button
        {
            Content = completa ? "Empezar" : "Listo",
            Height = 48,
            Margin = new Thickness(0, 10, 0, 0),
            Foreground = Brushes.White,
            Background = Estudio.Acento,
            BorderThickness = new Thickness(0),
            FontSize = 14.5,
            FontWeight = FontWeights.SemiBold,
            Cursor = Cursors.Hand,
            IsEnabled = false,
            Opacity = 0.45,
            Template = Estudio.Pastilla(24),
        };
        _continue.ConRelieve(Estudio.Sombra1);
        _continue.Click += (_, __) => Confirmar();
        pila.Children.Add(_continue);

        pila.Children.Add(new TextBlock
        {
            Text = "Lo puedes cambiar cuando quieras desde el menú de Ü.",
            Foreground = Estudio.TintaTenue,
            FontSize = 12,
            TextWrapping = TextWrapping.Wrap,
            HorizontalAlignment = HorizontalAlignment.Center,
            Margin = new Thickness(0, 12, 0, 0),
        });

        tarjeta.Child = pila;
        var marco = Estudio.Elevar(tarjeta, Estudio.Sombra3);
        marco.Margin = new Thickness(22, 18, 22, 26);   // sitio para la sombra
        Content = marco;
        this.Nitida();

        MouseLeftButtonDown += (_, e) => { if (e.ButtonState == MouseButtonState.Pressed) DragMove(); };
        KeyDown += (_, e) =>
        {
            if (e.Key == Key.Enter && _continue.IsEnabled) Confirmar();
            else if (e.Key == Key.Escape) { DialogResult = false; Close(); }
        };

        // Lo que ya estaba elegido (cambiar desde el menú) se enseña marcado; si no, nada marcado.
        string actual = PerfilDeUso.Normalizar(perfilActual);
        if (actual.Length > 0) Elegir(actual, mover: false);
        else PintarTarjetas();

        // El foco va a la tarjeta elegida, o a la primera: se contesta con Tab y Enter.
        Loaded += (_, __) => (_perfil == PerfilDeUso.Persona ? _personal : _salud).Focus();
    }

    // ── elegir ───────────────────────────────────────────────────────────────

    private void Elegir(string perfil, bool mover)
    {
        _perfil = perfil;
        _zonaEspecialidad.Visibility = perfil == PerfilDeUso.Medico ? Visibility.Visible : Visibility.Collapsed;
        PintarTarjetas();
        Validar();
        // Con salud elegida y sin especialidad, lo siguiente que hay que contestar es ella.
        if (mover && perfil == PerfilDeUso.Medico && TextoDeEspecialidad().Length == 0)
            _especialidad.Focus();
    }

    /// <summary>
    /// La elegida va en el acento; la que tiene el foco del teclado lleva el filete del acento
    /// aunque no esté elegida, para que con Tab se vea dónde se está.
    /// </summary>
    private void PintarTarjetas()
    {
        foreach (var (tarjeta, perfil) in new[] { (_salud, PerfilDeUso.Medico), (_personal, PerfilDeUso.Persona) })
        {
            bool elegida = _perfil == perfil;
            tarjeta.Background = elegida ? Estudio.AcentoSuave : Estudio.Superficie;
            tarjeta.BorderBrush = elegida || tarjeta.IsKeyboardFocused ? Estudio.Acento : Estudio.Borde;
            tarjeta.BorderThickness = new Thickness(elegida ? 2 : 1);
        }
    }

    private string TextoDeEspecialidad()
    {
        string texto = (_especialidad.Text ?? "").Trim();
        if (texto.Length == 0 && _especialidad.SelectedItem is string elegido) texto = elegido.Trim();
        return texto;
    }

    private bool Listo()
    {
        if (_perfil.Length == 0) return false;
        if (_perfil == PerfilDeUso.Medico && TextoDeEspecialidad().Length == 0) return false;
        if (_modo == ModoDeBienvenida.Completa)
            return !string.IsNullOrWhiteSpace(_name.Text) && EmailRe.IsMatch(_email.Text.Trim());
        return true;
    }

    private void Validar()
    {
        bool ok = Listo();
        _continue.IsEnabled = ok;
        _continue.Opacity = ok ? 1.0 : 0.45;
    }

    private void Confirmar()
    {
        if (!Listo()) return;
        PerfilElegido = _perfil;
        if (_perfil == PerfilDeUso.Medico)
        {
            var (codigo, nombre) = Especialidades.Buscar(TextoDeEspecialidad());
            EspecialidadCodigo = codigo;
            EspecialidadNombre = nombre;
        }
        if (_modo == ModoDeBienvenida.Completa)
        {
            EnteredName = _name.Text.Trim();
            EnteredEmail = _email.Text.Trim().ToLowerInvariant();
        }
        DialogResult = true;
        Close();
    }

    // ── piezas ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Una tarjeta elegible: título y una línea que dice para quién es. Es un botón, así que se
    /// llega con Tab y se elige con Enter o Espacio, y el lector de pantalla la lee entera.
    /// </summary>
    private static Button Tarjeta(string titulo, string detalle)
    {
        var contenido = new StackPanel { Margin = new Thickness(16, 12, 16, 13) };
        contenido.Children.Add(new TextBlock
        {
            Text = titulo,
            Foreground = Estudio.Tinta,
            FontSize = 14.5,
            FontWeight = FontWeights.SemiBold,
        });
        contenido.Children.Add(new TextBlock
        {
            Text = detalle,
            Foreground = Estudio.TintaMedia,
            FontSize = 12.5,
            LineHeight = 18,
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 3, 0, 0),
        });

        var boton = new Button
        {
            Content = contenido,
            HorizontalContentAlignment = HorizontalAlignment.Stretch,
            Margin = new Thickness(0, 0, 0, 10),
            Background = Estudio.Superficie,
            BorderBrush = Estudio.Borde,
            BorderThickness = new Thickness(1),
            Cursor = Cursors.Hand,
            Template = Estudio.Pastilla(16, estirado: true),
        };
        boton.ConRelieve(Estudio.Sombra1);
        AutomationProperties.SetName(boton, $"{titulo}. {detalle}");
        return boton;
    }

    private static TextBox Campo() => new()
    {
        Height = 42,
        Background = Brushes.Transparent,
        Foreground = Estudio.Tinta,
        CaretBrush = Estudio.Acento,
        SelectionBrush = Estudio.Acento,
        BorderThickness = new Thickness(0),
        FontSize = 14,
        VerticalContentAlignment = VerticalAlignment.Center,
    };

    /// <summary>La caja de un campo, hundida y no elevada, como en <see cref="LoginWindow"/>.</summary>
    private static Border Caja(UIElement dentro) => new()
    {
        CornerRadius = new CornerRadius(14),
        Background = Estudio.Superficie,
        BorderBrush = Estudio.Borde,
        BorderThickness = new Thickness(1),
        Padding = new Thickness(14, 1, 14, 1),
        Margin = new Thickness(0, 0, 0, 16),
        Child = dentro,
    };
}
