using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Effects;
using System.Windows.Shapes;
using System.Windows.Threading;
using U.WindowsClient.Persona;

namespace U.WindowsClient.Ui;

/// <summary>
/// LA PRIMERA VEZ: la carita en el centro de la pantalla, hablando. Lo que se ve del primer encuentro
/// (spec 080).
/// </summary>
/// <remarks>
/// QUÉ SUSTITUYE. Recién instalada, Ü abría un popup oscuro con dos campos —nombre y correo—, sin
/// botón de cerrar, y hasta que se rellenaba no existía nada más. El dueño (2026-10-01): «una cosa
/// así como horrible… que sea la carita flotante que se ponga al centro, te hable».
///
/// TE LLEVA, POR PASOS. La primera versión no tenía pasos «porque la conversación es la interfaz», y
/// el dueño la probó hablando: «se podía interrumpir demasiado fácil; quiero sentirme bastante guiado,
/// que sean como pasos». Arriba se ve en cuál vas de los tres; en el centro, la carita y la pregunta de
/// ese paso; debajo, lo que se te va oyendo.
///
/// EN PANTALLA, LO CORTO; EN LA VOZ, LO LARGO. «El texto que se escribe debe ser cortico y lo que hable
/// el asistente sí debe ser largo»: la pregunta escrita es «¿Cómo te llamas?», y el saludo entero lo
/// dice Ü. Lo que se lee no es la transcripción de lo que dice; es el título del paso.
///
/// UN SOLO CAJÓN PARA HABLAR, ESCRIBIR Y GUARDAR. La Memoria es un cajón con un campo que dice «Habla o
/// escribe aquí». Lo que se dice aparece sobre él; cuando Ü saca de ahí la respuesta —solo el nombre,
/// no «me llamo…»—, la respuesta BAJA hasta el campo y se queda guardada encima, a la vista. Quien
/// prefiera escribir escribe en el mismo campo: ya no hay otra pantalla para eso.
///
/// NADIE TIENE QUE PULSAR NADA. Al terminar aparece «Empezar», y lo pulsa Ü: baja hasta el botón y lo
/// presiona con la mano. La única salida que se pulsa es la de irse: «Ahora no», que al acercar el
/// ratón dice lo que hace de verdad —«Personalizar después»—.
///
/// BLANCO Y NEGRO. «Quiero que todo sea muy monocromático, tipo Apple»: ningún color pintado aquí tiene
/// sus tres canales distintos. Y el fondo de la tarjeta es un gris muy claro, no blanco: sobre blanco
/// puro la carita —que es casi blanca, a propósito— se veía «muy gris, como sucia».
///
/// NADA SALTA. Cada zona tiene su alto reservado: el contenido cambia y la carita no se mueve.
///
/// ESTA VENTANA NO DECIDE NADA. Cuándo cuenta como hecho, qué falta y qué se guarda es de
/// <see cref="PrimerEncuentro"/>, que el contrato juzga sin pantalla. Aquí solo se pinta y se avisa
/// de lo que la persona tocó.
///
/// EL TELÓN ES UNA VENTANA APARTE, y no un fondo de esta: así lo que se anima es una tarjeta y no la
/// pantalla entera, que en una ventana transparente se repinta por software a cada cuadro.
/// </remarks>
public sealed class EscenaDeBienvenida : Window
{
    private const double AnchoDeLaTarjeta = 640;
    private const double AltoDeLaTarjeta = 704;
    private const double LadoDeLaCara = 124;

    // La paleta de la escena: grises de tres canales iguales, y nada más.
    private static readonly Brush Tinta = Gris(0x11);
    private static readonly Brush TintaMedia = Gris(0x6B);
    private static readonly Brush TintaTenue = Gris(0xA0);
    private static readonly Brush Lienzo = Gris(0xF4);
    private static readonly Brush Hueco = Gris(0xF1);
    private static readonly Brush Linea = Gris(0xE4);
    private static readonly Brush Blanco = Gris(0xFF);

    private readonly Window _telon;
    private readonly Grid _marco;
    private readonly ScaleTransform _escalaDelMarco = new(0.96, 0.96);
    private readonly TranslateTransform _caidaDelMarco = new(0, 14);
    private readonly Ellipse _halo;
    private readonly ScaleTransform _escalaDelHalo = new(1, 1);
    private readonly ScaleTransform _escalaDeLaCara = new(1, 1);
    private readonly TranslateTransform _viajeDeLaCara = new(0, 0);
    private readonly Grid _cunaDeLaCara;

    private readonly TextBlock _pregunta;
    private readonly TextBlock _pista;
    private readonly TextBlock _oido;
    private readonly StackPanel _puntos;

    private readonly StackPanel _pasos;
    private readonly TextBlock _rotuloDelPaso;
    private readonly List<Border> _tramos = new();

    private readonly Border _cajon;
    private readonly Border _filoDelCajon;
    private readonly Panel _piezas;
    private readonly TextBlock _guardado;
    private readonly Border _campo;
    private readonly TextBox _escribe;
    private readonly TextBlock _marcaDelCampo;
    private readonly Button _enviar;
    private readonly StackPanel _opciones;

    private readonly Button _ahoraNo;
    private readonly TextBlock _textoDeAhoraNo;
    private readonly Button _empezar;
    private readonly ScaleTransform _escalaDeEmpezar = new(1, 1);
    private readonly Canvas _vuelo;
    private readonly Grid _raiz;

    private PasoDelEncuentro _paso = PasoDelEncuentro.Nombre;
    private string _nombre = "";
    private bool _hayAlgoOido;
    private bool _saliendo;
    private bool _terminado;
    private readonly Dictionary<string, FrameworkElement> _piezasPuestas = new();
    private readonly DispatcherTimer _mirada;
    private double _giro;

    /// <summary>La carita de la escena. Quien tiene la voz le pone el ánimo.</summary>
    public FaceControl Cara { get; }

    /// <summary>
    /// Hay un micrófono abierto. Sin él no se dice «Te escucho»: sería prometer un oído que no hay.
    /// </summary>
    public bool ConMicrofono { get; set; } = true;

    /// <summary>Escribió algo en el campo y lo entregó: contesta al paso que está en pantalla.</summary>
    public event Action<string>? Escribio;

    /// <summary>Lo dejó para después: «Ahora no» o Escape.</summary>
    public event Action? LoDejo;

    public EscenaDeBienvenida(FaceTheme tema)
    {
        Title = "Ü";
        Width = AnchoDeLaTarjeta + 60;
        Height = AltoDeLaTarjeta + 70;
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        WindowStartupLocation = WindowStartupLocation.Manual;
        ShowInTaskbar = true;
        Topmost = true;
        FontFamily = new FontFamily("Segoe UI Variable Text, Segoe UI");
        ToquesDeU.Proteger(this);   // lo que se pulse aquí lo pulsa la persona, no Ü (promesa 508)

        _telon = new Window
        {
            Title = "Ü",
            WindowStyle = WindowStyle.None,
            ResizeMode = ResizeMode.NoResize,
            AllowsTransparency = true,
            ShowInTaskbar = false,
            ShowActivated = false,
            Focusable = false,
            Topmost = true,
            Left = 0,
            Top = 0,
            Width = SystemParameters.PrimaryScreenWidth,
            Height = SystemParameters.PrimaryScreenHeight,
            Opacity = 0,
            // Más oscuro hacia los bordes: la mirada se va sola al centro, que es donde está la carita.
            Background = new RadialGradientBrush
            {
                GradientOrigin = new Point(0.5, 0.46),
                Center = new Point(0.5, 0.46),
                RadiusX = 0.75,
                RadiusY = 0.85,
                GradientStops =
                {
                    new GradientStop(Color.FromArgb(0x78, 0x08, 0x08, 0x08), 0),
                    new GradientStop(Color.FromArgb(0xC0, 0x04, 0x04, 0x04), 1),
                },
            },
        };
        // Un clic en lo oscuro no activa el telón ni lo sube: si lo hiciera, quedaría por encima de la tarjeta.
        _telon.SourceInitialized += (_, __) => FueraDelAltTab.Sacar(_telon, sinActivar: true);
        // Tampoco cierra nada: devuelve el foco a la escena, que es lo que se quería tocar.
        _telon.MouseLeftButtonDown += (_, __) => Activate();

        // ── la tarjeta ───────────────────────────────────────────────────────
        var tarjeta = new Border
        {
            CornerRadius = new CornerRadius(44),
            Background = Lienzo,
            BorderBrush = Blanco,
            BorderThickness = new Thickness(1),
        };

        _raiz = new Grid { Margin = new Thickness(34, 22, 34, 20) };
        _raiz.RowDefinitions.Add(new RowDefinition { Height = new GridLength(34) });                     // los pasos y «Ahora no»
        _raiz.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });   // la carita y la pregunta
        _raiz.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });                        // la Memoria
        _raiz.RowDefinitions.Add(new RowDefinition { Height = new GridLength(62) });                     // «Empezar»

        // ── «Ahora no», que al acercarse dice lo que hace ────────────────────
        _textoDeAhoraNo = new TextBlock { Text = "Ahora no", Margin = new Thickness(14, 6, 14, 7) };
        _ahoraNo = new Button
        {
            Content = _textoDeAhoraNo,
            FontSize = 13,
            Foreground = TintaTenue,
            Background = Brushes.Transparent,
            BorderThickness = new Thickness(0),
            Cursor = Cursors.Hand,
            HorizontalAlignment = HorizontalAlignment.Right,
            VerticalAlignment = VerticalAlignment.Center,
            Template = Estudio.Pastilla(16),
        };
        // Quieto, es lo que era: dos palabras en gris. Con el ratón encima es un botón negro que dice qué
        // pasa si se pulsa —no se pierde nada: se personaliza después—.
        _ahoraNo.MouseEnter += (_, __) => { _textoDeAhoraNo.Text = "Personalizar después"; _ahoraNo.Background = Tinta; _ahoraNo.Foreground = Blanco; _ahoraNo.FontWeight = FontWeights.SemiBold; };
        _ahoraNo.MouseLeave += (_, __) => { _textoDeAhoraNo.Text = "Ahora no"; _ahoraNo.Background = Brushes.Transparent; _ahoraNo.Foreground = TintaTenue; _ahoraNo.FontWeight = FontWeights.Normal; };
        _ahoraNo.Click += (_, __) => Dejarlo();
        AutomationName(_ahoraNo, "Ahora no");
        Grid.SetRow(_ahoraNo, 0);
        _raiz.Children.Add(_ahoraNo);

        // ── los pasos: en cuál vas de los tres ───────────────────────────────
        // Tres tramos y un rótulo. No son botones: no se elige el paso, se va por ellos.
        var tramos = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center };
        for (int i = 0; i < 3; i++)
        {
            var tramo = new Border { Width = 30, Height = 10, CornerRadius = new CornerRadius(5), Margin = new Thickness(0, 0, 6, 0) };
            _tramos.Add(tramo);
            tramos.Children.Add(tramo);
        }
        _rotuloDelPaso = new TextBlock
        {
            FontSize = 13, FontWeight = FontWeights.SemiBold, Foreground = Tinta,
            VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(8, 0, 0, 1),
        };
        _pasos = new StackPanel
        {
            Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Left,
            VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(4, 0, 0, 0),
        };
        _pasos.Children.Add(tramos);
        _pasos.Children.Add(_rotuloDelPaso);
        AutomationName(_pasos, "Paso");
        Grid.SetRow(_pasos, 0);
        _raiz.Children.Add(_pasos);

        // ── la carita ────────────────────────────────────────────────────────
        // SOBRE GRIS CLARO Y CON SU SOMBRA. La carita es casi blanca a propósito (el blanco puro «lastima los
        // ojos»); sobre una tarjeta blanca eso se leía como gris sucio. Aquí lo de alrededor es más oscuro
        // que ella, y lo que oscurece su borde es una sombra que cae, no un cerco.
        _halo = new Ellipse
        {
            Width = 250,
            Height = 250,
            Opacity = 0.0,
            RenderTransformOrigin = new Point(0.5, 0.5),
            RenderTransform = _escalaDelHalo,
            Fill = new RadialGradientBrush
            {
                GradientStops =
                {
                    new GradientStop(Color.FromArgb(0xFF, 0xFF, 0xFF, 0xFF), 0.0),
                    new GradientStop(Color.FromArgb(0xB0, 0xFF, 0xFF, 0xFF), 0.5),
                    new GradientStop(Color.FromArgb(0x00, 0xFF, 0xFF, 0xFF), 1.0),
                },
            },
        };
        Cara = new FaceControl { Width = LadoDeLaCara, Height = LadoDeLaCara, Theme = tema };
        var sombraDeLaCara = new Border
        {
            Width = LadoDeLaCara - 18, Height = LadoDeLaCara - 18, CornerRadius = new CornerRadius(34),
            Background = Gris(0x00), Opacity = 0.16, Margin = new Thickness(0, 22, 0, 0),
            Effect = new BlurEffect { Radius = 34, RenderingBias = RenderingBias.Performance },
        };
        _cunaDeLaCara = new Grid
        {
            Width = LadoDeLaCara,
            Height = LadoDeLaCara,
            RenderTransformOrigin = new Point(0.5, 0.5),
            RenderTransform = new TransformGroup { Children = { _escalaDeLaCara, _viajeDeLaCara } },
        };
        _cunaDeLaCara.Children.Add(sombraDeLaCara);
        _cunaDeLaCara.Children.Add(Cara);

        var escenario = new Grid { Height = 172 };
        escenario.Children.Add(_halo);
        escenario.Children.Add(_cunaDeLaCara);

        // ── la pregunta del paso, y lo que se te va oyendo ───────────────────
        _pregunta = new TextBlock
        {
            FontFamily = new FontFamily("Segoe UI Variable Display, Segoe UI"),
            FontSize = 30,
            FontWeight = FontWeights.SemiBold,
            Foreground = Tinta,
            TextAlignment = TextAlignment.Center,
            TextWrapping = TextWrapping.Wrap,
            MaxWidth = 520,
            Margin = new Thickness(0, 2, 0, 0),
        };
        _pista = new TextBlock
        {
            FontSize = 15,
            Foreground = TintaMedia,
            TextAlignment = TextAlignment.Center,
            TextWrapping = TextWrapping.Wrap,
            LineHeight = 22,
            MaxWidth = 440,
            MinHeight = 44,   // dos renglones reservados: la despedida los usa, y nada se mueve
            Margin = new Thickness(0, 7, 0, 0),
        };

        _puntos = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(0, 1, 9, 0),
            Visibility = Visibility.Collapsed,
        };
        for (int i = 0; i < 3; i++)
        {
            var punto = new Ellipse { Width = 5, Height = 5, Fill = Tinta, Margin = new Thickness(2, 0, 2, 0), Opacity = 0.2 };
            punto.BeginAnimation(OpacityProperty, new DoubleAnimation(0.2, 0.9, TimeSpan.FromMilliseconds(520))
            {
                AutoReverse = true,
                RepeatBehavior = RepeatBehavior.Forever,
                BeginTime = TimeSpan.FromMilliseconds(i * 170),
                EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut },
            });
            _puntos.Children.Add(punto);
        }
        // LO QUE SE TE OYE, SIN COMILLAS Y EN SU TINTA: es tu frase mientras la dices, no una cita. Las
        // comillas angulares en gris pequeño eran lo que el dueño señaló como «no realmente estético».
        _oido = new TextBlock
        {
            FontFamily = new FontFamily("Segoe UI Variable Display, Segoe UI"),
            FontSize = 17,
            Foreground = Tinta,
            TextTrimming = TextTrimming.CharacterEllipsis,
            MaxWidth = 460,
            VerticalAlignment = VerticalAlignment.Center,
        };
        var lineaDeLoOido = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Center,
            Height = 28,
            Margin = new Thickness(0, 10, 0, 0),
        };
        lineaDeLoOido.Children.Add(_puntos);
        lineaDeLoOido.Children.Add(_oido);

        // ARRIBA, Y NO CENTRADO EN EL HUECO: el cajón de abajo crece cuando se van guardando cosas, y centrada
        // la carita bajaba y subía con él (visto en las capturas del 2026-10-01). Lo que crece es el cajón,
        // hacia arriba; la carita y su pregunta no se mueven.
        var centro = new StackPanel { VerticalAlignment = VerticalAlignment.Top, Margin = new Thickness(0, 8, 0, 0) };
        centro.Children.Add(escenario);
        centro.Children.Add(_pregunta);
        centro.Children.Add(_pista);
        centro.Children.Add(lineaDeLoOido);
        Grid.SetRow(centro, 1);
        _raiz.Children.Add(centro);

        // ── la Memoria: el cajón donde se habla, se escribe y queda guardado ──
        _piezas = new FilasDeIzquierda { MinHeight = 38 };
        _guardado = new TextBlock
        {
            Text = "Guardado",
            FontSize = 12, FontWeight = FontWeights.SemiBold, Foreground = Tinta,
            HorizontalAlignment = HorizontalAlignment.Right, VerticalAlignment = VerticalAlignment.Center, Opacity = 0,
        };
        var cabecera = new Grid { Margin = new Thickness(2, 0, 2, 10) };
        var titulo = new StackPanel { Orientation = Orientation.Horizontal };
        titulo.Children.Add(IconoDeMemoria());
        titulo.Children.Add(new TextBlock
        {
            Text = "Memoria", FontSize = 13, FontWeight = FontWeights.SemiBold, Foreground = Tinta,
            VerticalAlignment = VerticalAlignment.Center,
        });
        titulo.Children.Add(new TextBlock
        {
            Text = "Lo que sé de ti", FontSize = 12.5, Foreground = TintaTenue,
            VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(9, 1, 0, 0),
        });
        cabecera.Children.Add(titulo);
        cabecera.Children.Add(_guardado);

        // Estudiante o médico, a un toque: solo en el paso que lo pregunta, y para quien escribe.
        _opciones = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 0, 10), Visibility = Visibility.Collapsed };
        foreach (string opcion in new[] { "Estudiante", "Médico" })
        {
            var b = new Button
            {
                Content = new TextBlock { Text = opcion, Margin = new Thickness(14, 6, 14, 7) },
                FontSize = 13.5, Foreground = Tinta, Background = Hueco, BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand, Margin = new Thickness(0, 0, 8, 0), Template = Estudio.Pastilla(16),
            };
            b.MouseEnter += (_, __) => { b.Background = Tinta; b.Foreground = Blanco; };
            b.MouseLeave += (_, __) => { b.Background = Hueco; b.Foreground = Tinta; };
            b.Click += (_, __) => Entregar(opcion);
            AutomationName(b, opcion);
            _opciones.Children.Add(b);
        }

        _escribe = new TextBox
        {
            FontSize = 15,
            Background = Brushes.Transparent,
            Foreground = Tinta,
            CaretBrush = Tinta,
            SelectionBrush = Gris(0xC8),
            BorderThickness = new Thickness(0),
            VerticalContentAlignment = VerticalAlignment.Center,
            MaxLength = 300,
        };
        AutomationName(_escribe, "Habla o escribe aquí");
        _marcaDelCampo = new TextBlock
        {
            Text = "Habla o escribe aquí", FontSize = 15, Foreground = TintaTenue,
            VerticalAlignment = VerticalAlignment.Center, IsHitTestVisible = false, Margin = new Thickness(2, 0, 0, 1),
        };
        _enviar = new Button
        {
            Width = 30, Height = 30, Background = Tinta, BorderThickness = new Thickness(0), Cursor = Cursors.Hand,
            Template = Estudio.Pastilla(15), Visibility = Visibility.Collapsed, VerticalAlignment = VerticalAlignment.Center,
            Content = new System.Windows.Shapes.Path
            {
                Data = Geometry.Parse("M3,8 H12 M8.5,4 L12.5,8 L8.5,12"), Stroke = Blanco, StrokeThickness = 1.8,
                StrokeStartLineCap = PenLineCap.Round, StrokeEndLineCap = PenLineCap.Round, StrokeLineJoin = PenLineJoin.Round,
                Width = 16, Height = 16,
            },
        };
        AutomationName(_enviar, "Enviar");
        _enviar.Click += (_, __) => Entregar(_escribe.Text);
        var dentroDelCampo = new Grid();
        dentroDelCampo.ColumnDefinitions.Add(new ColumnDefinition());
        dentroDelCampo.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        dentroDelCampo.Children.Add(_marcaDelCampo);
        dentroDelCampo.Children.Add(_escribe);
        Grid.SetColumn(_enviar, 1);
        dentroDelCampo.Children.Add(_enviar);
        _campo = new Border
        {
            CornerRadius = new CornerRadius(16), Background = Hueco, Height = 48,
            Padding = new Thickness(16, 0, 9, 0), Child = dentroDelCampo,
        };
        _escribe.TextChanged += (_, __) =>
        {
            bool hay = _escribe.Text.Length > 0;
            _marcaDelCampo.Visibility = hay ? Visibility.Collapsed : Visibility.Visible;
            _enviar.Visibility = hay && !_escribe.IsReadOnly ? Visibility.Visible : Visibility.Collapsed;
        };

        var dentroDelCajon = new StackPanel();
        dentroDelCajon.Children.Add(cabecera);
        dentroDelCajon.Children.Add(_piezas);
        dentroDelCajon.Children.Add(new Border { Height = 10 });
        dentroDelCajon.Children.Add(_opciones);
        dentroDelCajon.Children.Add(_campo);
        // El filo es un borde encima, y no el del propio cajón: se anima su opacidad, que no repinta lo de dentro.
        _filoDelCajon = new Border
        {
            CornerRadius = new CornerRadius(28), BorderBrush = Tinta, BorderThickness = new Thickness(1.6),
            Opacity = 0, IsHitTestVisible = false,
        };
        var cajonConFilo = new Grid();
        cajonConFilo.Children.Add(new Border { CornerRadius = new CornerRadius(28), Background = Blanco });
        cajonConFilo.Children.Add(new Border { Padding = new Thickness(18, 16, 18, 18), Child = dentroDelCajon });
        cajonConFilo.Children.Add(_filoDelCajon);
        _cajon = new Border { Child = cajonConFilo, MinHeight = 172 };
        AutomationName(_cajon, "Memoria");
        Grid.SetRow(_cajon, 2);
        _raiz.Children.Add(_cajon);

        // ── «Empezar»: aparece al final, y lo pulsa Ü ────────────────────────
        _empezar = new Button
        {
            Content = new TextBlock { Text = "Empezar", Margin = new Thickness(34, 11, 34, 12) },
            FontSize = 15, FontWeight = FontWeights.SemiBold, Foreground = Blanco, Background = Tinta,
            BorderThickness = new Thickness(0), Cursor = Cursors.Hand, Template = Estudio.Pastilla(23),
            HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Bottom,
            Opacity = 0, IsHitTestVisible = false, RenderTransformOrigin = new Point(0.5, 0.5), RenderTransform = _escalaDeEmpezar,
        };
        AutomationName(_empezar, "Empezar");
        Grid.SetRow(_empezar, 3);
        _raiz.Children.Add(_empezar);

        // Por donde vuela lo que se anota, encima de todo y sin estorbar al ratón.
        _vuelo = new Canvas { IsHitTestVisible = false };
        Grid.SetRowSpan(_vuelo, 4);
        Panel.SetZIndex(_vuelo, 20);
        _raiz.Children.Add(_vuelo);

        tarjeta.Child = _raiz;
        // La sombra la echa una placa detrás, nunca el borde que lleva el texto (ver Estudio.Elevar).
        _marco = Estudio.Elevar(tarjeta, Estudio.Sombra3);
        _marco.Width = AnchoDeLaTarjeta;
        _marco.Height = AltoDeLaTarjeta;
        _marco.HorizontalAlignment = HorizontalAlignment.Center;
        _marco.VerticalAlignment = VerticalAlignment.Center;
        _marco.Opacity = 0;
        _marco.RenderTransformOrigin = new Point(0.5, 0.5);
        _marco.RenderTransform = new TransformGroup { Children = { _escalaDelMarco, _caidaDelMarco } };
        Content = _marco;
        this.Nitida();

        MouseLeftButtonDown += (_, e) => { if (e.ButtonState == MouseButtonState.Pressed && e.OriginalSource is not TextBox) DragMove(); };
        PreviewKeyDown += (_, e) =>
        {
            if (e.Key == Key.Escape) { e.Handled = true; Dejarlo(); }
            else if (e.Key == Key.Enter && _escribe.IsKeyboardFocusWithin) { e.Handled = true; Entregar(_escribe.Text); }
        };
        Closed += (_, __) => { _mirada?.Stop(); try { _telon.Close(); } catch { } };

        // LA CABEZA SIGUE AL RATÓN, un poco: es el giro en 3D que ya tiene la carita (spec 052), usado para
        // mirar a quien tiene delante. Poco y despacio: es atención, no un juguete.
        _mirada = new DispatcherTimer(DispatcherPriority.Background) { Interval = TimeSpan.FromMilliseconds(50) };
        _mirada.Tick += (_, __) => SeguirAlRaton();

        Paso(PasoDelEncuentro.Nombre, "");
    }

    // ── entrar y salir ───────────────────────────────────────────────────────

    /// <summary>
    /// Pone la escena en su sitio, todavía sin verse, para que se pueda preguntar dónde va a quedar
    /// la carita antes de que aparezca. Después, <see cref="BajarElTelon"/> y <see cref="Entrar"/>.
    /// </summary>
    public void Preparar()
    {
        var area = SystemParameters.WorkArea;
        // EN UNA PANTALLA BAJA, ENTERA Y MÁS PEQUEÑA. La tarjeta mide 704 de alto y un portátil de 1366×768
        // deja 728: sin esto «Empezar» quedaba fuera, que es justo el botón que cierra el encuentro. Se
        // encoge todo a la vez; no se recorta nada.
        double cabe = Math.Min(1, Math.Min((area.Height - 12) / Height, (area.Width - 12) / Width));
        if (cabe < 1)
        {
            _marco.LayoutTransform = new ScaleTransform(cabe, cabe);
            Width *= cabe;
            Height *= cabe;
        }
        Left = area.Left + (area.Width - Width) / 2;
        Top = area.Top + (area.Height - Height) / 2;
        _telon.Show();
        // LA TARJETA ES DEL TELÓN, y no solo va después: una ventana con dueño queda SIEMPRE por encima de
        // él. Mostrarla la segunda no bastaba — otro programa que tomara el foco reordenaba las dos, y la
        // tarjeta acababa apagada debajo de su propio telón (capturado el 2026-10-01).
        Owner = _telon;
        Show();
        UpdateLayout();
    }

    /// <summary>El telón baja: la pantalla se apaga alrededor de lo que viene.</summary>
    public void BajarElTelon() => _telon.BeginAnimation(OpacityProperty, Suave(0, 1, 460));

    /// <summary>
    /// La tarjeta aparece, y la carita crece desde el tamaño con el que llegó volando.
    /// </summary>
    /// <param name="ladoDeLlegada">El lado de la carita de verdad, que acaba de posarse justo aquí.</param>
    public void Entrar(double ladoDeLlegada)
    {
        Activate();
        var entrada = new CubicEase { EasingMode = EasingMode.EaseOut };
        _marco.BeginAnimation(OpacityProperty, Suave(0, 1, 340));
        _escalaDelMarco.BeginAnimation(ScaleTransform.ScaleXProperty, new DoubleAnimation(0.96, 1, TimeSpan.FromMilliseconds(520)) { EasingFunction = entrada });
        _escalaDelMarco.BeginAnimation(ScaleTransform.ScaleYProperty, new DoubleAnimation(0.96, 1, TimeSpan.FromMilliseconds(520)) { EasingFunction = entrada });
        _caidaDelMarco.BeginAnimation(TranslateTransform.YProperty, new DoubleAnimation(14, 0, TimeSpan.FromMilliseconds(520)) { EasingFunction = entrada });

        double desde = Math.Clamp(ladoDeLlegada / LadoDeLaCara, 0.3, 1);
        var crecer = new BackEase { EasingMode = EasingMode.EaseOut, Amplitude = 0.45 };
        _escalaDeLaCara.BeginAnimation(ScaleTransform.ScaleXProperty, new DoubleAnimation(desde, 1, TimeSpan.FromMilliseconds(640)) { EasingFunction = crecer });
        _escalaDeLaCara.BeginAnimation(ScaleTransform.ScaleYProperty, new DoubleAnimation(desde, 1, TimeSpan.FromMilliseconds(640)) { EasingFunction = crecer });
        _halo.BeginAnimation(OpacityProperty, new DoubleAnimation(0, 0.7, TimeSpan.FromMilliseconds(900)) { BeginTime = TimeSpan.FromMilliseconds(260) });
        Cara.StartIdle();
        Cara.Blink(2);
        _mirada.Start();
    }

    /// <summary>
    /// Dónde está el centro de la carita, en puntos de pantalla. Lo pide quien va a poner la carita
    /// de verdad justo ahí: al llegar, antes de que la escena aparezca, y al irse.
    /// </summary>
    public Point CentroDeLaCara()
    {
        var enVentana = Cara.TranslatePoint(new Point(LadoDeLaCara / 2, LadoDeLaCara / 2), this);
        return new Point(Left + enVentana.X, Top + enVentana.Y);
    }

    /// <summary>
    /// La despedida: la carita se encoge hasta su tamaño de siempre mientras todo lo demás se apaga.
    /// Al terminar, quien llama pone la carita de verdad en ese punto y cierra la escena.
    /// </summary>
    public async Task EncogerLaCaraAsync(double ladoFinal)
    {
        _saliendo = true;
        _mirada.Stop();
        double a = Math.Clamp(ladoFinal / LadoDeLaCara, 0.3, 1);
        var suave = new CubicEase { EasingMode = EasingMode.EaseInOut };
        _escalaDeLaCara.BeginAnimation(ScaleTransform.ScaleXProperty, new DoubleAnimation(_escalaDeLaCara.ScaleX, a, TimeSpan.FromMilliseconds(420)) { EasingFunction = suave });
        _escalaDeLaCara.BeginAnimation(ScaleTransform.ScaleYProperty, new DoubleAnimation(_escalaDeLaCara.ScaleY, a, TimeSpan.FromMilliseconds(420)) { EasingFunction = suave });
        _halo.BeginAnimation(OpacityProperty, Suave(_halo.Opacity, 0, 300));
        foreach (var pieza in new FrameworkElement[] { _pregunta, _pista, _oido, _puntos, _cajon, _pasos, _ahoraNo, _empezar })
            pieza.BeginAnimation(OpacityProperty, Suave(pieza.Opacity, 0, 280));
        await Task.Delay(440);
    }

    /// <summary>Se va: la tarjeta y el telón se apagan, y la ventana se cierra.</summary>
    /// <param name="laDeVerdadYaEsta">La carita de verdad ya está puesta en el sitio de la de la escena.</param>
    public async Task SalirAsync(bool laDeVerdadYaEsta)
    {
        _saliendo = true;
        _mirada.Stop();
        if (laDeVerdadYaEsta) _cunaDeLaCara.Opacity = 0;   // dos caritas a la vez serían dos
        _marco.BeginAnimation(OpacityProperty, Suave(_marco.Opacity, 0, 300));
        _telon.BeginAnimation(OpacityProperty, Suave(_telon.Opacity, 0, 420));
        await Task.Delay(440);
        try { Close(); } catch { }
    }

    private void Dejarlo()
    {
        if (_saliendo) return;
        LoDejo?.Invoke();
    }

    // ── los pasos ────────────────────────────────────────────────────────────

    /// <summary>
    /// En qué paso va el encuentro: lo que se ve arriba, la pregunta del centro y lo que el cajón ofrece.
    /// </summary>
    /// <param name="nombre">Cómo se llama, si ya se sabe: la despedida lo usa.</param>
    public void Paso(PasoDelEncuentro paso, string nombre)
    {
        if (_saliendo) return;
        bool cambia = paso != _paso || _pregunta.Text.Length == 0;
        _paso = paso;
        if (!string.IsNullOrWhiteSpace(nombre)) _nombre = nombre.Trim();

        int hechos = paso switch { PasoDelEncuentro.Nombre => 0, PasoDelEncuentro.Rol => 1, PasoDelEncuentro.SobreTi => 2, _ => 3 };
        for (int i = 0; i < _tramos.Count; i++)
        {
            // Lo hecho, negro lleno. El de ahora, blanco con su filo negro ancho. Lo que falta, gris.
            _tramos[i].Background = i < hechos ? Tinta : i == hechos ? Blanco : Linea;
            _tramos[i].BorderBrush = Tinta;
            _tramos[i].BorderThickness = new Thickness(i == hechos ? 2.5 : 0);
        }

        var (rotulo, pregunta, pista) = paso switch
        {
            PasoDelEncuentro.Nombre => ("Tu nombre", "¿Cómo te llamas?", "Dímelo como quieres que te llame."),
            PasoDelEncuentro.Rol => ("A qué te dedicas", "¿Estudias o eres médico?", "Así te muestro solo lo que es para ti."),
            PasoDelEncuentro.SobreTi => ("Cuéntame de ti", "Cuéntame de ti", "Qué te gusta, en qué andas, cómo quieres que te hable."),
            _ => ("Todo listo", _nombre.Length > 0 ? $"Listo, {_nombre}" : "Listo",
                  "Todo lo que sé de ti está en tu Memoria. No guardo nada que no esté ahí, y puedes abrirla cuando quieras."),
        };
        _rotuloDelPaso.Text = rotulo;
        if (!cambia) return;

        _pregunta.Text = pregunta;
        _pista.Text = pista;
        _pregunta.BeginAnimation(OpacityProperty, Suave(0.15, 1, 360));
        _pista.BeginAnimation(OpacityProperty, Suave(0.15, 1, 480));
        _rotuloDelPaso.BeginAnimation(OpacityProperty, Suave(0.2, 1, 320));
        _opciones.Visibility = paso == PasoDelEncuentro.Rol ? Visibility.Visible : Visibility.Collapsed;
        // Paso nuevo, pregunta nueva: lo que se oyó contestaba a la anterior.
        _hayAlgoOido = false;
        _oido.Text = "";
        _puntos.Visibility = Visibility.Collapsed;
    }

    // ── lo que se oye y lo que se anota ──────────────────────────────────────

    /// <summary>Lo que se le va oyendo a la persona, mientras lo dice.</summary>
    public void SeOyo(string texto)
    {
        if (_saliendo || _terminado) return;
        texto = (texto ?? "").Trim();
        if (texto.Length == 0) return;
        _hayAlgoOido = true;
        // Los puntos siguen: ya no es «te escucho», es «lo estoy anotando». Entre que la persona calla y Ü
        // contesta pasan de cuatro a seis segundos (medido), y sin nada que se mueva parecen un cuelgue.
        _puntos.Visibility = Visibility.Visible;
        _oido.Foreground = Tinta;
        _oido.Text = texto;
        _oido.BeginAnimation(OpacityProperty, null);
        _oido.Opacity = 1;
    }

    /// <summary>Una línea de estado, donde va lo oído: «Un momento…».</summary>
    public void Estado(string texto)
    {
        if (_saliendo || _terminado) return;
        _hayAlgoOido = false;
        _puntos.Visibility = Visibility.Collapsed;
        _oido.Foreground = TintaTenue;
        _oido.Text = texto ?? "";
    }

    /// <summary>El ánimo de la carita, y con él su luz: late cuando habla, se queda quieta cuando escucha.</summary>
    public void Animo(FaceMood animo)
    {
        if (_saliendo) return;
        Cara.Mood = animo;
        if (animo == FaceMood.Hablando)
        {
            var latido = new DoubleAnimation(1.0, 1.08, TimeSpan.FromMilliseconds(900))
            {
                AutoReverse = true,
                RepeatBehavior = RepeatBehavior.Forever,
                EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut },
            };
            _escalaDelHalo.BeginAnimation(ScaleTransform.ScaleXProperty, latido);
            _escalaDelHalo.BeginAnimation(ScaleTransform.ScaleYProperty, latido);
            _halo.BeginAnimation(OpacityProperty, Suave(_halo.Opacity, 1, 260));
            return;
        }

        _escalaDelHalo.BeginAnimation(ScaleTransform.ScaleXProperty, Suave(_escalaDelHalo.ScaleX, 1, 300));
        _escalaDelHalo.BeginAnimation(ScaleTransform.ScaleYProperty, Suave(_escalaDelHalo.ScaleY, 1, 300));
        _halo.BeginAnimation(OpacityProperty, Suave(_halo.Opacity, 0.7, 420));

        // CALLÓ, Y ES TU TURNO: se dice, pero solo si de verdad hay un micrófono abierto y todavía no
        // se ha oído nada. «Te escucho» con el oído cerrado es la mentira que más cuesta en una voz.
        bool escucha = animo is FaceMood.Escuchando or FaceMood.Conversando;
        if (escucha && ConMicrofono && !_terminado && !_hayAlgoOido)
        {
            _oido.Foreground = TintaTenue;
            _oido.Text = "Te escucho";
            _puntos.Visibility = Visibility.Visible;
        }
    }

    /// <summary>
    /// Lo que Ü lleva anotado. Lo NUEVO baja desde lo que se dijo hasta el campo del cajón —ya resumido:
    /// «Felipe», no «me llamo Felipe»— y queda guardado encima; lo que ya estaba no se mueve (promesa 767).
    /// </summary>
    public void Anotado(IReadOnlyList<PiezaDeMemoria> piezas)
    {
        if (_saliendo) return;
        var nuevas = new List<(string Clave, string Texto, bool Fuerte)>();
        foreach (var p in piezas)
        {
            string texto = Recorte(p.Texto, p.Fuerte ? 30 : 38);
            if (_piezasPuestas.TryGetValue(p.Clave, out var ya))
            {
                // El nombre puede corregirse a media conversación: la pieza se queda y cambia lo que dice.
                if (ya is Border { Child: TextBlock t } && t.Text != texto) t.Text = texto;
                continue;
            }
            nuevas.Add((p.Clave, texto, p.Fuerte));
        }
        if (nuevas.Count == 0) return;

        // Reservadas ya, aunque todavía no se vean: una segunda anotación que llegue mientras vuelan no las repite.
        var bordes = nuevas.Select(n => Pieza(n.Clave, n.Texto, n.Fuerte)).ToList();
        _ = VolarAlCampoAsync(string.Join(" · ", nuevas.Select(n => n.Texto)), bordes);
    }

    /// <summary>Lo anotado, a partir de un perfil: para quien no trae piezas sueltas.</summary>
    public void Sabe(Perfil perfil)
    {
        var piezas = new List<PiezaDeMemoria>();
        if (perfil.Nombre.Length > 0) piezas.Add(new("nombre", perfil.Nombre, true));
        if (perfil.Rol != Rol.SinElegir) piezas.Add(new("rol", perfil.Rol == Rol.Estudiante ? "Estudiante" : "Médico", true));
        if (perfil.Trato.Length > 0) piezas.Add(new("trato", perfil.Trato, false));
        for (int i = 0; i < perfil.Gustos.Count; i++) piezas.Add(new("gusto-" + i, perfil.Gustos[i], false));
        Anotado(piezas);
    }

    /// <summary>Una pieza guardada, puesta en el cajón todavía sin verse.</summary>
    private Border Pieza(string clave, string texto, bool fuerte)
    {
        var pieza = new Border
        {
            CornerRadius = new CornerRadius(15),
            // El nombre y el rol, en negro: son lo que decide qué eres para Ü. Lo demás, en su gris.
            Background = fuerte ? Tinta : Hueco,
            Padding = new Thickness(13, 6, 13, 7),
            Margin = new Thickness(0, 0, 7, 7),
            Opacity = 0,
            RenderTransformOrigin = new Point(0.5, 0.5),
            RenderTransform = new ScaleTransform(0.8, 0.8),
            Child = new TextBlock
            {
                Text = texto,
                FontSize = 13.5,
                FontWeight = fuerte ? FontWeights.SemiBold : FontWeights.Normal,
                Foreground = fuerte ? Blanco : Tinta,
            },
        };
        AutomationName(pieza, "Anotado: " + texto);
        _piezasPuestas[clave] = pieza;
        _piezas.Children.Add(pieza);
        return pieza;
    }

    /// <summary>
    /// EL VIAJE DE LO ANOTADO: sale de la línea de lo que se dijo, baja hasta el campo, se lee ahí un
    /// instante, y sube a quedarse guardado.
    /// </summary>
    private async Task VolarAlCampoAsync(string resumen, List<Border> piezas)
    {
        try
        {
            resumen = Recorte(resumen, 44);
            bool escribiendo = _escribe.IsKeyboardFocusWithin && _escribe.Text.Length > 0;
            if (IsLoaded && !escribiendo)
            {
                UpdateLayout();
                var desde = _oido.TranslatePoint(new Point(_oido.ActualWidth / 2, _oido.ActualHeight / 2), _vuelo);
                var hasta = _campo.TranslatePoint(new Point(18, _campo.ActualHeight / 2), _vuelo);
                var viajero = new TextBlock
                {
                    Text = resumen, FontSize = 17, FontWeight = FontWeights.SemiBold, Foreground = Tinta,
                    FontFamily = new FontFamily("Segoe UI Variable Display, Segoe UI"),
                };
                viajero.Measure(new Size(double.PositiveInfinity, double.PositiveInfinity));
                var mueve = new TranslateTransform(desde.X - viajero.DesiredSize.Width / 2, desde.Y - viajero.DesiredSize.Height / 2);
                var encoge = new ScaleTransform(1, 1);
                viajero.RenderTransform = new TransformGroup { Children = { encoge, mueve } };
                _vuelo.Children.Add(viajero);

                // Lo dicho se apaga mientras su resumen sale de él.
                _puntos.Visibility = Visibility.Collapsed;
                _oido.BeginAnimation(OpacityProperty, Suave(_oido.Opacity, 0, 260));

                var curva = new CubicEase { EasingMode = EasingMode.EaseInOut };
                var dura = TimeSpan.FromMilliseconds(560);
                mueve.BeginAnimation(TranslateTransform.XProperty, new DoubleAnimation(hasta.X, dura) { EasingFunction = curva });
                mueve.BeginAnimation(TranslateTransform.YProperty, new DoubleAnimation(hasta.Y - viajero.DesiredSize.Height * 0.44, dura) { EasingFunction = curva });
                encoge.BeginAnimation(ScaleTransform.ScaleXProperty, new DoubleAnimation(15.0 / 17, dura) { EasingFunction = curva });
                encoge.BeginAnimation(ScaleTransform.ScaleYProperty, new DoubleAnimation(15.0 / 17, dura) { EasingFunction = curva });
                await Task.Delay(580);

                // Ya está en el campo: se lee ahí, como si lo hubiera escrito la persona.
                _vuelo.Children.Remove(viajero);
                _marcaDelCampo.Visibility = Visibility.Collapsed;
                _escribe.IsReadOnly = true;
                _escribe.Text = resumen;
                await Task.Delay(520);
                _escribe.Text = "";
                _escribe.IsReadOnly = false;
                _marcaDelCampo.Visibility = Visibility.Visible;
                _oido.Text = "";
                _oido.BeginAnimation(OpacityProperty, null);
                _oido.Opacity = 1;
                _hayAlgoOido = false;
            }

            // Y queda guardado: las piezas aparecen una detrás de otra, el cajón se enciende y lo dice.
            var rebote = new BackEase { EasingMode = EasingMode.EaseOut, Amplitude = 0.5 };
            for (int i = 0; i < piezas.Count; i++)
            {
                var inicio = TimeSpan.FromMilliseconds(i * 110);
                piezas[i].BeginAnimation(OpacityProperty, new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(220)) { BeginTime = inicio });
                var escala = (ScaleTransform)piezas[i].RenderTransform;
                foreach (var eje in new[] { ScaleTransform.ScaleXProperty, ScaleTransform.ScaleYProperty })
                    escala.BeginAnimation(eje, new DoubleAnimation(0.8, 1, TimeSpan.FromMilliseconds(360)) { BeginTime = inicio, EasingFunction = rebote });
            }
            var aviso = new DoubleAnimationUsingKeyFrames { Duration = TimeSpan.FromMilliseconds(2200) };
            aviso.KeyFrames.Add(new LinearDoubleKeyFrame(0, KeyTime.FromPercent(0)));
            aviso.KeyFrames.Add(new LinearDoubleKeyFrame(1, KeyTime.FromPercent(0.12)));
            aviso.KeyFrames.Add(new LinearDoubleKeyFrame(1, KeyTime.FromPercent(0.75)));
            aviso.KeyFrames.Add(new LinearDoubleKeyFrame(0, KeyTime.FromPercent(1)));
            _guardado.BeginAnimation(OpacityProperty, aviso);
            var filo = new DoubleAnimationUsingKeyFrames { Duration = TimeSpan.FromMilliseconds(1300) };
            filo.KeyFrames.Add(new LinearDoubleKeyFrame(0, KeyTime.FromPercent(0)));
            filo.KeyFrames.Add(new LinearDoubleKeyFrame(1, KeyTime.FromPercent(0.18)));
            filo.KeyFrames.Add(new LinearDoubleKeyFrame(_terminado ? 1 : 0, KeyTime.FromPercent(1)));
            _filoDelCajon.BeginAnimation(OpacityProperty, filo);
        }
        catch
        {
            // Una animación que tropieza no puede dejar lo anotado sin verse.
            foreach (var p in piezas) { p.BeginAnimation(OpacityProperty, null); p.Opacity = 1; p.RenderTransform = null; }
        }
    }

    // ── el final ─────────────────────────────────────────────────────────────

    /// <summary>
    /// El encuentro terminó. Ya no se pregunta nada: el campo se retira, la salida también, y el cajón
    /// se queda encendido —es de lo que Ü está hablando al despedirse—.
    /// </summary>
    public void Terminado(Perfil perfil)
    {
        if (_saliendo) return;
        _terminado = true;
        _ahoraNo.Visibility = Visibility.Hidden;
        _opciones.Visibility = Visibility.Collapsed;
        _campo.BeginAnimation(OpacityProperty, Suave(_campo.Opacity, 0, 240));
        _campo.IsHitTestVisible = false;
        _puntos.Visibility = Visibility.Collapsed;
        _oido.Text = "";
        Paso(PasoDelEncuentro.Cierre, perfil.Nombre);
        _filoDelCajon.BeginAnimation(OpacityProperty, Suave(_filoDelCajon.Opacity, 1, 520));
    }

    /// <summary>
    /// «EMPEZAR», Y LO PULSA Ü. El botón aparece, la carita baja hasta ponerse a su lado, saca la mano y lo
    /// presiona: la persona no tuvo que pulsar nada en todo el encuentro, y tampoco para salir de él.
    /// </summary>
    public async Task PulsarElFinalAsync()
    {
        if (_saliendo || !IsLoaded) return;
        try
        {
            _mirada.Stop();
            _empezar.BeginAnimation(OpacityProperty, Suave(0, 1, 320));
            await Task.Delay(420);

            UpdateLayout();
            // A la izquierda del botón y a su altura: se posa al lado, nunca encima (como hace con lo que pulsa).
            var caraAhora = Cara.TranslatePoint(new Point(LadoDeLaCara / 2, LadoDeLaCara / 2), _raiz);
            var boton = _empezar.TranslatePoint(new Point(0, _empezar.ActualHeight / 2), _raiz);
            const double escalaFinal = 0.5;
            double dx = boton.X - LadoDeLaCara * escalaFinal / 2 - 16 - caraAhora.X;
            double dy = boton.Y - caraAhora.Y;
            var curva = new CubicEase { EasingMode = EasingMode.EaseInOut };
            var dura = TimeSpan.FromMilliseconds(720);
            _viajeDeLaCara.BeginAnimation(TranslateTransform.XProperty, new DoubleAnimation(dx, dura) { EasingFunction = curva });
            _viajeDeLaCara.BeginAnimation(TranslateTransform.YProperty, new DoubleAnimation(dy, dura) { EasingFunction = curva });
            _escalaDeLaCara.BeginAnimation(ScaleTransform.ScaleXProperty, new DoubleAnimation(escalaFinal, dura) { EasingFunction = curva });
            _escalaDeLaCara.BeginAnimation(ScaleTransform.ScaleYProperty, new DoubleAnimation(escalaFinal, dura) { EasingFunction = curva });
            _halo.BeginAnimation(OpacityProperty, Suave(_halo.Opacity, 0, 360));
            Cara.Giro = 0;
            Cara.MirarHacia(izquierda: false);
            await Task.Delay(760);

            Cara.Presionar(izquierda: false, TimeSpan.Zero);
            await Task.Delay(260);
            // El botón cede bajo la mano.
            var cede = new DoubleAnimationUsingKeyFrames { Duration = TimeSpan.FromMilliseconds(420) };
            cede.KeyFrames.Add(new LinearDoubleKeyFrame(1, KeyTime.FromPercent(0)));
            cede.KeyFrames.Add(new LinearDoubleKeyFrame(0.93, KeyTime.FromPercent(0.35)));
            cede.KeyFrames.Add(new LinearDoubleKeyFrame(1, KeyTime.FromPercent(1)));
            _escalaDeEmpezar.BeginAnimation(ScaleTransform.ScaleXProperty, cede);
            _escalaDeEmpezar.BeginAnimation(ScaleTransform.ScaleYProperty, cede);
            await Task.Delay(620);
            Cara.DejarDeMirar();
        }
        catch { /* el botón es un gesto: si tropieza, la escena se va igual */ }
    }

    // ── escribir ─────────────────────────────────────────────────────────────

    /// <summary>
    /// No hay voz: se escribe. No cambia la pantalla —el campo ya estaba—; se dice por qué y se le da el foco.
    /// </summary>
    public void SinVoz(string porque)
    {
        if (_saliendo) return;
        ConMicrofono = false;
        _marcaDelCampo.Text = "Escribe aquí";
        Estado(porque);
        Activate();
        _escribe.Focus();
        Keyboard.Focus(_escribe);
    }

    /// <summary>Dice algo donde va lo oído: qué falta, o qué no se entendió.</summary>
    public void Aviso(string texto) => Estado(texto);

    private void Entregar(string texto)
    {
        texto = (texto ?? "").Trim();
        if (texto.Length == 0 || _saliendo || _terminado) return;
        _escribe.Text = "";
        // Lo escrito se ve arriba, donde se ve lo dicho: desde ahí baja su resumen cuando se anote.
        SeOyo(texto);
        Escribio?.Invoke(texto);
    }

    // ── la mirada ────────────────────────────────────────────────────────────

    [DllImport("user32.dll")]
    private static extern bool GetCursorPos(out PuntoDePantalla punto);

    [StructLayout(LayoutKind.Sequential)]
    private struct PuntoDePantalla { public int X, Y; }

    /// <summary>
    /// Gira la cabeza hacia donde está el ratón: poco —un tercio de lo que puede—, y persiguiendo el sitio
    /// en vez de saltar a él. Solo se repinta mientras el giro cambia.
    /// </summary>
    private void SeguirAlRaton()
    {
        if (_saliendo || !IsVisible) return;
        try
        {
            if (!GetCursorPos(out var p)) return;
            var enVentana = PointFromScreen(new Point(p.X, p.Y));
            var cara = Cara.TranslatePoint(new Point(LadoDeLaCara / 2, LadoDeLaCara / 2), this);
            double objetivo = Math.Clamp((enVentana.X - cara.X) / 900.0, -0.34, 0.34);
            _giro += (objetivo - _giro) * 0.16;
            if (Math.Abs(Cara.Giro - _giro) > 0.004) Cara.Giro = Math.Round(_giro, 3);
        }
        catch { }
    }

    // ── piezas ───────────────────────────────────────────────────────────────

    /// <summary>
    /// El icono de la Memoria: una ficha con su pestaña y dos renglones. Trazo fino y esquinas redondas,
    /// del mismo peso que el texto que tiene al lado.
    /// </summary>
    private static FrameworkElement IconoDeMemoria() => new System.Windows.Shapes.Path
    {
        Data = Geometry.Parse("M3.2,5.2 A2,2 0 0 1 5.2,3.2 H8 L9.6,5 H12.8 A2,2 0 0 1 14.8,7 V12.8 A2,2 0 0 1 12.8,14.8 H5.2 A2,2 0 0 1 3.2,12.8 Z M6.2,8.6 H11.8 M6.2,11.4 H9.8"),
        Stroke = Tinta, StrokeThickness = 1.35,
        StrokeStartLineCap = PenLineCap.Round, StrokeEndLineCap = PenLineCap.Round, StrokeLineJoin = PenLineJoin.Round,
        Width = 18, Height = 18, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 8, 0),
    };

    private static void AutomationName(DependencyObject que, string nombre) =>
        System.Windows.Automation.AutomationProperties.SetName(que, nombre);

    private static DoubleAnimation Suave(double desde, double hasta, int ms) =>
        new(desde, hasta, TimeSpan.FromMilliseconds(ms)) { EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } };

    private static string Recorte(string t, int n) => t.Length <= n ? t : t[..n].TrimEnd() + "…";

    private static Brush Gris(byte v)
    {
        var b = new SolidColorBrush(Color.FromRgb(v, v, v));
        b.Freeze();
        return b;
    }

    /// <summary>
    /// Como un <see cref="WrapPanel"/> que no deja hueco al final: las piezas guardadas van una tras otra,
    /// desde la izquierda, y bajan de fila cuando no caben. Es una lista de lo que se sabe, no un adorno
    /// centrado.
    /// </summary>
    private sealed class FilasDeIzquierda : Panel
    {
        protected override Size MeasureOverride(Size disponible)
        {
            double ancho = 0, alto = 0, filaAncho = 0, filaAlto = 0;
            foreach (UIElement hijo in InternalChildren)
            {
                hijo.Measure(new Size(disponible.Width, double.PositiveInfinity));
                var d = hijo.DesiredSize;
                if (filaAncho > 0 && filaAncho + d.Width > disponible.Width)
                {
                    ancho = Math.Max(ancho, filaAncho); alto += filaAlto;
                    filaAncho = 0; filaAlto = 0;
                }
                filaAncho += d.Width; filaAlto = Math.Max(filaAlto, d.Height);
            }
            return new Size(double.IsInfinity(disponible.Width) ? Math.Max(ancho, filaAncho) : disponible.Width, alto + filaAlto);
        }

        protected override Size ArrangeOverride(Size final)
        {
            double x = 0, y = 0, filaAlto = 0;
            foreach (UIElement hijo in InternalChildren)
            {
                var d = hijo.DesiredSize;
                if (x > 0 && x + d.Width > final.Width) { x = 0; y += filaAlto; filaAlto = 0; }
                hijo.Arrange(new Rect(x, y, d.Width, d.Height));
                x += d.Width; filaAlto = Math.Max(filaAlto, d.Height);
            }
            return final;
        }
    }
}
