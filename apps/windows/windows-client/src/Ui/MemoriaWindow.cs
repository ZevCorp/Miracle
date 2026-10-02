using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using U.WindowsClient.Diagnostics;
using U.WindowsClient.Memoria;

namespace U.WindowsClient.Ui;

/// <summary>
/// LA MEMORIA: todo lo que Ü guarda de la persona, para leerlo. La abre la pastilla «Memoria» del
/// óvalo (spec 071).
/// </summary>
/// <remarks>
/// ESTA VENTANA NO DECIDE NADA. Qué almacenes hay, qué se cuenta de cada uno, cómo se dice una fecha
/// y qué no se enseña nunca viven en <see cref="LoQueUSabe"/>, donde el contrato lo juzga sin
/// pantalla (promesas 622-626). Aquí solo se pinta lo que esa lectura devuelve.
///
/// SE VUELVE A LEER CADA VEZ QUE SE ABRE. Ü sigue guardando mientras tanto, y una memoria que
/// enseñara lo de hace una hora sería una foto vieja con título de «todo lo que sé».
///
/// UNA TARJETA POR APARTADO, Y LAS TRES FORMAS DE ESTAR SE VEN DISTINTAS: con datos lleva su cuenta,
/// vacío lo dice en gris, y «no pude leerlo» va en rojo con su motivo. Pintar igual un apartado vacío
/// y uno ilegible sería la caja que miente (aprendizaje nº4).
///
/// CUATRO FILAS Y UN «VER TODO». El álbum de este PC tenía 106 sitios y la web 153 el día que se
/// midió: desplegado entero, lo primero que se vería de la memoria es una lista de dominios.
///
/// ESC Y ✕ LA ESCONDEN, igual que el panel de estudios: volver a abrirla es instantáneo y conserva lo
/// que estaba desplegado.
/// </remarks>
public sealed class MemoriaWindow : Window
{
    private static MemoriaWindow? _unica;

    /// <summary>La de la app. Una sola: dos ventanas sobre los mismos datos no enseñan nada más.</summary>
    public static MemoriaWindow Unica => _unica ??= new MemoriaWindow();

    /// <summary>La que ya existe, o null si nadie la ha abierto. Preguntar no la crea.</summary>
    public static MemoriaWindow? LaQueHay => _unica;

    private const double AnchoTarjeta = 460;
    private const double AltoTarjeta = 680;

    /// <summary>Cuántas filas enseña un apartado antes de pedir «ver todo».</summary>
    private const int Primeras = 4;

    private readonly Thickness _holgura = Estudio.HolguraDe(Estudio.Sombra3);
    private readonly StackPanel _cuerpo = new() { Margin = new Thickness(6, 2, 14, 8) };
    private readonly TextBlock _pie;

    /// <summary>Los apartados que la persona desplegó. Se recuerdan entre lecturas: releer no pliega.</summary>
    private readonly HashSet<string> _desplegados = new();

    private Fuentes? _fuentes;

    /// <summary>Cuál es la lectura vigente. Una lectura que vuelve tarde no pinta encima de la nueva.</summary>
    private int _turno;

    private MemoriaWindow()
    {
        Title = "Memoria · Ü";
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        SizeToContent = SizeToContent.WidthAndHeight;
        ShowInTaskbar = true;
        this.PonerLaBarraDeScroll();

        var tarjeta = new Border
        {
            Width = AnchoTarjeta,
            Height = AltoTarjeta,
            CornerRadius = new CornerRadius(30),
            Background = Estudio.Fondo,
            BorderBrush = Estudio.Borde,
            BorderThickness = new Thickness(1),
        };

        var raiz = new Grid { Margin = new Thickness(16, 18, 8, 16) };
        raiz.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        raiz.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        raiz.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

        // ── la cabecera ──────────────────────────────────────────────────────
        var cabecera = new DockPanel { Margin = new Thickness(8, 0, 14, 12), Background = Brushes.Transparent };
        var cerrar = BotonDeMarco("", "Cerrar (Esc)");
        cerrar.Click += (_, _) => Hide();
        DockPanel.SetDock(cerrar, Dock.Right);
        cabecera.Children.Add(cerrar);
        var releer = BotonDeMarco("", "Volver a leer");
        releer.Click += (_, _) => Leer();
        DockPanel.SetDock(releer, Dock.Right);
        cabecera.Children.Add(releer);

        var titulos = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        titulos.Children.Add(new TextBlock
        {
            Text = "Memoria",
            Foreground = Estudio.Tinta,
            FontSize = 15.5,
            FontWeight = FontWeights.SemiBold,
        });
        titulos.Children.Add(new TextBlock
        {
            Text = "Todo lo que guardo de ti",
            Foreground = Estudio.TintaMedia,
            FontSize = 11.5,
            Margin = new Thickness(0, 1, 0, 0),
        });
        cabecera.Children.Add(titulos);
        // Sin barra de título, arrastrar es cosa nuestra: por la cabecera, que no tiene nada que pulsar.
        cabecera.MouseLeftButtonDown += (_, e) => { if (e.ButtonState == MouseButtonState.Pressed) DragMove(); };
        Grid.SetRow(cabecera, 0);
        raiz.Children.Add(cabecera);

        // ── el cuerpo, con scroll ────────────────────────────────────────────
        var scroll = new ScrollViewer
        {
            Content = _cuerpo,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
        };
        Grid.SetRow(scroll, 1);
        raiz.Children.Add(scroll);

        // ── el pie ───────────────────────────────────────────────────────────
        _pie = new TextBlock
        {
            Foreground = Estudio.TintaTenue,
            FontSize = 11.5,
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(8, 10, 14, 0),
        };
        Grid.SetRow(_pie, 2);
        raiz.Children.Add(_pie);

        tarjeta.Child = raiz;
        Content = Estudio.Elevar(tarjeta, Estudio.Sombra3);
        this.Nitida();

        PreviewKeyDown += (_, e) => { if (e.Key == Key.Escape) { e.Handled = true; Hide(); } };
        Deactivated += (_, _) => _perdioElFoco = Environment.TickCount64;
        Closed += (_, _) => { if (ReferenceEquals(_unica, this)) _unica = null; };
    }

    /// <summary>Cuándo dejó de ser la ventana activa (TickCount64). Negativo: todavía no lo ha dejado nunca.</summary>
    private long _perdioElFoco = -1;

    // ── su botón ──────────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Lo que pasa al tocar «Memoria» en el óvalo: abrir, traer al frente o quitar.
    /// </summary>
    /// <remarks>
    /// LO DECIDE LA MISMA REGLA QUE EL BOTÓN DEL COLLAR (promesa 627), y vive aquí y no en la carita
    /// porque a la regla hay que decirle si la ventana estaba al frente, y eso depende de CUÁNDO perdió
    /// el foco, que solo lo sabe la ventana (promesa 628). Preguntar <c>IsActive</c> desde el manejador
    /// del botón contesta siempre que no: el toque en el óvalo ya se lo quitó.
    /// </remarks>
    /// <param name="cuandoSeToco">TickCount64 del instante en que se apoyó el ratón en el botón.</param>
    public static void AlTocarSuBoton(FrameworkElement ancla, Fuentes fuentes, long cuandoSeToco)
    {
        var ventana = _unica;
        bool existe = ventana?.IsVisible == true;
        bool alFrente = ventana != null && ReglaDeLaVentana.EstabaAlFrente(
            seVe: existe && ventana.WindowState != WindowState.Minimized,
            activa: ventana.IsActive,
            msEntrePerderElFocoYElToque: ventana._perdioElFoco < 0 ? -1 : cuandoSeToco - ventana._perdioElFoco);

        switch (ReglaDeLaVentana.AlPulsarSuBoton(existe, alFrente))
        {
            case QueHacerConLaVentana.Abrir:
            case QueHacerConLaVentana.TraerAlFrente:
                LogBus.Log("la-memoria", existe ? "la ventana se trae al frente" : "la ventana se abre");
                Unica.MostrarJuntoA(ancla, fuentes);
                break;

            case QueHacerConLaVentana.Ocultar:
                ventana!.Hide();
                LogBus.Log("la-memoria", "la ventana se quita de en medio");
                break;
        }
    }

    // ── abrir y colocar ───────────────────────────────────────────────────────────────────────────

    /// <summary>Se muestra pegada a la izquierda del óvalo (o a su derecha, si a la izquierda no cabe), y lee.</summary>
    public void MostrarJuntoA(FrameworkElement ancla, Fuentes fuentes)
    {
        _fuentes = fuentes;
        if (!IsVisible) Show();
        UpdateLayout();
        Colocar(ancla);
        if (WindowState == WindowState.Minimized) WindowState = WindowState.Normal;
        Activate();
        Leer();
    }

    private void Colocar(FrameworkElement ancla)
    {
        var area = SystemParameters.WorkArea;
        double w = ActualWidth, h = ActualHeight;
        var fuente = PresentationSource.FromVisual(ancla);
        if (fuente?.CompositionTarget == null || !ancla.IsVisible)
        {
            Left = area.Right - w - 200;
            Top = area.Bottom - h;
            return;
        }
        // PointToScreen da píxeles FÍSICOS; la ventana se coloca en DIPs. Con escalado al 150 % la
        // diferencia es de un tercio de pantalla.
        var aDips = fuente.CompositionTarget.TransformFromDevice;
        var arriba = aDips.Transform(ancla.PointToScreen(new Point(0, 0)));
        var abajo = aDips.Transform(ancla.PointToScreen(new Point(ancla.ActualWidth, ancla.ActualHeight)));

        const double Hueco = 12;
        // La holgura es el aire transparente que la sombra necesita: se descuenta para que el hueco
        // se mida entre lo que se VE, no entre los bordes invisibles de las dos ventanas.
        double izquierda = arriba.X - Hueco - (w - _holgura.Right);
        if (izquierda + _holgura.Left < area.Left) izquierda = abajo.X + Hueco - _holgura.Left;
        double arribaDelPanel = abajo.Y - h + _holgura.Bottom;
        Left = Math.Max(area.Left - _holgura.Left, Math.Min(izquierda, area.Right - w + _holgura.Right));
        Top = Math.Max(area.Top - _holgura.Top, Math.Min(arribaDelPanel, area.Bottom - h + _holgura.Bottom));
    }

    // ── leer y pintar ─────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Lee FUERA del hilo de la interfaz: el álbum comprueba que cada foto siga en disco, y con mil
    /// seiscientas fichas eso no puede congelar la ventana mientras se abre.
    /// </summary>
    private async void Leer()
    {
        if (_fuentes is not { } fuentes) return;
        int turno = ++_turno;
        _pie.Text = "Leyendo…";

        IReadOnlyList<Apartado> apartados;
        var reloj = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            apartados = await Task.Run(() => LoQueUSabe.Leer(fuentes, DateTimeOffset.Now));
        }
        catch (Exception e)
        {
            // LA CADENA ENTERA al diario (patrón nº3), y a la persona la verdad corta: que no se pudo,
            // no una memoria en blanco que parezca que no se sabe nada de ella.
            for (var x = e; x != null; x = x.InnerException)
                LogBus.Log("la-memoria", $"no pude leer la memoria · {x.GetType().Name}: {x.Message}");
            if (turno == _turno) _pie.Text = "No pude leer la memoria. El motivo quedó apuntado en el diario.";
            return;
        }
        if (turno != _turno) return;

        Pintar(apartados);
        _pie.Text = $"Leído {Fechas.Dicha(DateTimeOffset.Now, DateTimeOffset.Now)}. Aquí solo se mira: nada se borra ni se cambia.";
        LogBus.Log("la-memoria", $"leída en {reloj.ElapsedMilliseconds} ms · {apartados.Count} apartados · "
            + $"{apartados.Count(a => a.Estado == EstadoDelApartado.ConDatos)} con datos · "
            + $"{apartados.Count(a => a.Estado == EstadoDelApartado.Vacio)} vacíos · "
            + $"{apartados.Count(a => a.Estado == EstadoDelApartado.NoSePudoLeer)} sin poder leer");
    }

    private void Pintar(IReadOnlyList<Apartado> apartados)
    {
        _cuerpo.Children.Clear();
        _cuerpo.Children.Add(new TextBlock
        {
            Text = "Esto es lo que guardo sobre ti. Casi todo vive solo en este computador; lo que sale de aquí está al final.",
            Foreground = Estudio.TintaMedia,
            FontSize = 12.5,
            LineHeight = 12.5 * 1.5,
            TextWrapping = TextWrapping.Wrap,
            // El mismo margen que la holgura que Estudio.Elevar le da a cada tarjeta, para que el
            // párrafo y las tarjetas compartan filo izquierdo.
            Margin = new Thickness(Estudio.HolguraDe(Estudio.Sombra1).Left, 0, Estudio.HolguraDe(Estudio.Sombra1).Right, 4),
        });
        // UNA SOLA TARJETA DICE QUIÉN ERES. El apartado «quien» lee el nombre de config.json, que es
        // donde lo dejaba la ventana de correo y contraseña; quien se presentó hablando no tiene nada
        // ahí, y la Memoria enseñaba «Jose · Estudiante» y, justo debajo, «Todavía no sé cómo te
        // llamas» (visto en pantalla el 2026-10-01). La del perfil se queda con lo que ese apartado
        // trae —el correo, si lo hay— y él no se pinta aparte. Si NO SE PUDO LEER sí se pinta: eso
        // es un fallo, y un fallo no se tapa con una tarjeta bonita.
        var quien = apartados.FirstOrDefault(a => a.Clave == "quien");
        _cuerpo.Children.Add(TarjetaDeQuienEres(quien));
        foreach (var apartado in apartados)
            if (apartado.Clave != "quien" || apartado.Estado == EstadoDelApartado.NoSePudoLeer)
                _cuerpo.Children.Add(TarjetaDe(apartado));
    }

    /// <summary>La persona pidió repetir el primer encuentro. Lo atiende la carita, que es quien lo lleva.</summary>
    public static event Action? PidioVolverAPresentarse;

    /// <summary>
    /// QUIÉN ERES PARA Ü: lo que contó al presentarse —nombre, para qué la usa, cómo quiere que le hablen,
    /// qué le gusta—, y la forma de corregirlo (spec 080).
    /// </summary>
    /// <remarks>
    /// VA AQUÍ PORQUE AQUÍ ES DONDE SE MIRA QUÉ SABE Ü DE UNO. Sin esto, lo que se dijo en el primer
    /// encuentro no se veía en ningún sitio, y quien se hubiera equivocado de rol —o a quien Ü le
    /// entendió mal el nombre— no tenía cómo arreglarlo salvo borrando un archivo. Se lee del perfil;
    /// abrir la Memoria sigue sin escribir nada.
    /// </remarks>
    private FrameworkElement TarjetaDeQuienEres(Apartado? deLaCuenta)
    {
        var perfil = new Persona.PerfilDeLaPersona().Leer();
        var tarjeta = Estudio.Tarjeta(18);
        tarjeta.Padding = new Thickness(16, 14, 16, 12);
        tarjeta.Margin = new Thickness(0, 6, 0, 0);
        System.Windows.Automation.AutomationProperties.SetName(tarjeta, "Quién eres");

        // Lo que trae el apartado de la cuenta (config.json): el nombre con que entró y su correo. El
        // correo es lo que tiene un médico con cuenta; un estudiante no tiene ninguno.
        var cuenta = deLaCuenta is { Estado: EstadoDelApartado.ConDatos } ? deLaCuenta.Entradas : Array.Empty<Entrada>();
        string nombreDeLaCuenta = cuenta.FirstOrDefault(e => !e.Texto.Contains('@'))?.Texto ?? "";
        string correo = cuenta.FirstOrDefault(e => e.Texto.Contains('@'))?.Texto ?? "";
        string nombre = perfil.Conocido && !string.IsNullOrWhiteSpace(perfil.Nombre) ? perfil.Nombre : nombreDeLaCuenta;

        var pila = new StackPanel();
        pila.Children.Add(new TextBlock
        {
            Text = "Quién eres", Foreground = Estudio.Tinta, FontSize = 14, FontWeight = FontWeights.SemiBold,
        });
        pila.Children.Add(new TextBlock
        {
            Text = nombre.Length > 0 ? nombre : "Todavía no nos hemos presentado.",
            Foreground = nombre.Length > 0 ? Estudio.Tinta : Estudio.TintaTenue,
            FontSize = nombre.Length > 0 ? 15 : 12.5,
            TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 5, 0, 0),
        });

        var lineas = new List<string>();
        if (perfil.Conocido)
        {
            if (perfil.Rol != Persona.Rol.SinElegir) lineas.Add(perfil.Rol == Persona.Rol.Estudiante ? "Estudiante" : "Médico");
            if (perfil.Trato.Length > 0) lineas.Add("Te hablo: " + perfil.Trato);
            if (perfil.Gustos.Count > 0) lineas.Add("Te gusta: " + string.Join(", ", perfil.Gustos));
        }
        if (correo.Length > 0) lineas.Add("Tu correo: " + correo);
        if (lineas.Count > 0)
            pila.Children.Add(new TextBlock
            {
                Text = string.Join("\n", lineas), Foreground = Estudio.TintaMedia, FontSize = 12.5, LineHeight = 19,
                TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 4, 0, 0),
            });

        var otraVez = new Button
        {
            Content = new TextBlock { Text = perfil.Conocido ? "Volver a presentarnos" : "Presentarnos", Margin = new Thickness(12, 6, 12, 7) },
            FontSize = 12.5,
            Foreground = Estudio.Acento,
            Background = Estudio.AcentoSuave,
            BorderThickness = new Thickness(0),
            HorizontalAlignment = HorizontalAlignment.Left,
            Margin = new Thickness(0, 10, 0, 0),
            Cursor = Cursors.Hand,
            Template = Estudio.Pastilla(14),
        };
        System.Windows.Automation.AutomationProperties.SetName(otraVez, perfil.Conocido ? "Volver a presentarnos" : "Presentarnos");
        otraVez.Click += (_, _) => PidioVolverAPresentarse?.Invoke();
        pila.Children.Add(otraVez);

        tarjeta.Child = pila;
        return Estudio.Elevar(tarjeta, Estudio.Sombra1);
    }

    private FrameworkElement TarjetaDe(Apartado apartado)
    {
        var tarjeta = Estudio.Tarjeta(18);
        tarjeta.Padding = new Thickness(16, 14, 16, 14);
        tarjeta.Margin = new Thickness(0, 6, 0, 0);
        System.Windows.Automation.AutomationProperties.SetName(tarjeta, apartado.Titulo);

        var pila = new StackPanel();

        var cabecera = new DockPanel();
        if (Chip(apartado) is { } chip)
        {
            DockPanel.SetDock(chip, Dock.Right);
            cabecera.Children.Add(chip);
        }
        cabecera.Children.Add(new TextBlock
        {
            Text = apartado.Titulo,
            Foreground = Estudio.Tinta,
            FontSize = 14,
            FontWeight = FontWeights.SemiBold,
            TextWrapping = TextWrapping.Wrap,
            VerticalAlignment = VerticalAlignment.Center,
        });
        pila.Children.Add(cabecera);

        pila.Children.Add(new TextBlock
        {
            Text = apartado.Resumen,
            Foreground = apartado.Estado switch
            {
                EstadoDelApartado.NoSePudoLeer => Estudio.Alerta,
                EstadoDelApartado.Vacio => Estudio.TintaTenue,
                _ => Estudio.TintaMedia,
            },
            FontSize = 12.5,
            LineHeight = 12.5 * 1.5,
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 5, 0, 0),
        });

        if (apartado.Entradas.Count > 0)
        {
            var filas = new StackPanel();
            pila.Children.Add(filas);
            PintarFilas(filas, apartado);
        }

        tarjeta.Child = pila;
        return Estudio.Elevar(tarjeta, Estudio.Sombra1);
    }

    /// <summary>La cuenta a la derecha del título; en rojo y con palabras cuando no se pudo leer.</summary>
    private static Border? Chip(Apartado apartado)
    {
        if (apartado.Estado == EstadoDelApartado.Vacio) return null;
        bool sinLeer = apartado.Estado == EstadoDelApartado.NoSePudoLeer;
        return new Border
        {
            CornerRadius = new CornerRadius(Estudio.RadioChico),
            Background = sinLeer ? Estudio.AlertaSuave : Estudio.SuperficieSuave,
            Padding = new Thickness(9, 2, 9, 3),
            Margin = new Thickness(10, 0, 0, 0),
            VerticalAlignment = VerticalAlignment.Top,
            Child = new TextBlock
            {
                Text = sinLeer ? "Sin leer" : apartado.Cuenta.ToString("N0", CultureInfo.GetCultureInfo("es-CO")),
                Foreground = sinLeer ? Estudio.Alerta : Estudio.TintaMedia,
                FontSize = 11.5,
                FontWeight = FontWeights.SemiBold,
            },
        };
    }

    private void PintarFilas(StackPanel filas, Apartado apartado)
    {
        filas.Children.Clear();
        bool todo = _desplegados.Contains(apartado.Clave);
        int cuantas = todo ? apartado.Entradas.Count : Math.Min(Primeras, apartado.Entradas.Count);

        for (int i = 0; i < cuantas; i++)
        {
            var entrada = apartado.Entradas[i];
            filas.Children.Add(new Border { Height = 1, Background = Estudio.Borde, Margin = new Thickness(0, 10, 0, 9) });
            filas.Children.Add(new TextBlock
            {
                Text = entrada.Texto,
                Foreground = Estudio.Tinta,
                FontSize = 13,
                LineHeight = 13 * 1.45,
                TextWrapping = TextWrapping.Wrap,
                TextTrimming = TextTrimming.CharacterEllipsis,
                // Plegado, un párrafo largo —un turno de conversación— se queda en cuatro líneas;
                // desplegado se lee entero, que es para lo que se despliega.
                MaxHeight = todo ? double.PositiveInfinity : 13 * 1.45 * 4,
            });
            if (entrada.Detalle.Length > 0)
                filas.Children.Add(new TextBlock
                {
                    Text = entrada.Detalle,
                    Foreground = Estudio.TintaTenue,
                    FontSize = 11.5,
                    LineHeight = 11.5 * 1.45,
                    TextWrapping = TextWrapping.Wrap,
                    TextTrimming = TextTrimming.CharacterEllipsis,
                    MaxHeight = todo ? double.PositiveInfinity : 11.5 * 1.45 * 3,
                    Margin = new Thickness(0, 2, 0, 0),
                });
        }

        if (apartado.Entradas.Count <= Primeras) return;
        var alternar = new Button
        {
            Content = todo ? "Ver menos" : $"Ver las {apartado.Entradas.Count.ToString("N0", CultureInfo.GetCultureInfo("es-CO"))}",
            Padding = new Thickness(12, 5, 12, 5),
            Margin = new Thickness(-12, 8, 0, -4),
            HorizontalAlignment = HorizontalAlignment.Left,
            Background = Brushes.Transparent,
            BorderThickness = new Thickness(0),
            Foreground = Estudio.Acento,
            FontSize = 12,
            FontWeight = FontWeights.SemiBold,
            Cursor = Cursors.Hand,
            Template = Estudio.Pastilla(Estudio.RadioChico),
        };
        System.Windows.Automation.AutomationProperties.SetName(alternar,
            (todo ? "Ver menos de: " : "Ver todo de: ") + apartado.Titulo);
        alternar.MouseEnter += (_, _) => alternar.Background = Estudio.AcentoSuave;
        alternar.MouseLeave += (_, _) => alternar.Background = Brushes.Transparent;
        alternar.Click += (_, _) =>
        {
            if (!_desplegados.Add(apartado.Clave)) _desplegados.Remove(apartado.Clave);
            PintarFilas(filas, apartado);
        };
        filas.Children.Add(alternar);
    }

    /// <summary>
    /// Un botón del marco: glifo de Segoe MDL2 sin fondo, que se realza al acercar la mano. Es el mismo
    /// que el del panel de estudios, que lo tiene privado; mudarlo a <see cref="Estudio"/> es de otra rama.
    /// </summary>
    private static Button BotonDeMarco(string glifo, string queHace)
    {
        var b = new Button
        {
            Content = new TextBlock
            {
                Text = glifo,
                FontFamily = new FontFamily("Segoe MDL2 Assets"),
                FontSize = 9.5,
                Foreground = Estudio.TintaMedia,
            },
            Width = 30,
            Height = 30,
            Background = Brushes.Transparent,
            BorderThickness = new Thickness(0),
            Cursor = Cursors.Hand,
            Template = Estudio.Pastilla(15),
        };
        System.Windows.Automation.AutomationProperties.SetName(b, queHace);
        b.MouseEnter += (_, _) => b.Background = Estudio.SuperficieSuave;
        b.MouseLeave += (_, _) => b.Background = Brushes.Transparent;
        return b;
    }
}
