using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Threading;
using U.WindowsClient.Diagnostics;

namespace U.WindowsClient.Ui;

/// <summary>
/// LA INTRO (spec 086): una ventana negra del tamaño y la forma de la de la consulta, con una Ü blanca gigante.
/// Mantener la U tres segundos la vuelve la carita y le hace contar su historia (<see cref="GuionDeLaIntro"/>).
/// </summary>
/// <remarks>
/// Es una pieza para presentar, y por eso la abre solo <c>U.exe --intro</c> y no arranca nada más: ni la carita de
/// siempre, ni la voz, ni la actualización (promesa 883). Esc la cierra; arrastrarla con el ratón la mueve.
/// </remarks>
public sealed class IntroWindow : Window
{
    /// <summary>El lado de la carita cuando ya lo es. La Ü, casi una vez y media más alta, llena dos tercios de la ventana.</summary>
    private const double LadoDeLaCarita = 280;

    /// <summary>El radio de la tarjeta de la consulta, el que la hace casi una pastilla.</summary>
    private const double RadioDeLaConsulta = 46;

    private readonly FaceControl _cara;
    private readonly Border _tarjeta;
    private double _ladoNormal;
    private readonly Stopwatch _apretada = new();
    private readonly DispatcherTimer _reloj = new() { Interval = TimeSpan.FromMilliseconds(50) };
    private readonly List<DispatcherTimer> _pasos = new();

    /// <summary>Ya arrancó con esta pulsación: hasta soltar la U no se vuelve a contar, o mantenerla la repetiría sola.</summary>
    private bool _esperaQueLaSuelte;

    public IntroWindow()
    {
        Title = "Ü";
        Width = ConsultaWindow.TamanoInicial.Width;
        Height = ConsultaWindow.TamanoInicial.Height;
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;

        _cara = new FaceControl
        {
            Width = LadoDeLaCarita,
            Height = LadoDeLaCarita,
            Theme = FaceTheme.Light,
            LaU = 1.0,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
        };
        // El radio de la tarjeta de la consulta, sin filete: «totalmente negra».
        _tarjeta = new Border { CornerRadius = new CornerRadius(RadioDeLaConsulta), Background = Brushes.Black };

        // UN BOTÓN GRIS EN LA ESQUINA alterna la pantalla completa (promesa 884). Sin foco: si lo tomara, la U dejaría de
        // llegar a la ventana justo después de pulsarlo, y la intro es de teclado.
        var boton = new Button
        {
            Content = "⤢",
            Width = 34,
            Height = 34,
            Margin = new Thickness(18),
            HorizontalAlignment = HorizontalAlignment.Right,
            VerticalAlignment = VerticalAlignment.Top,
            Background = new SolidColorBrush(Color.FromRgb(92, 92, 92)),
            Foreground = new SolidColorBrush(Color.FromRgb(225, 225, 225)),
            FontSize = 16,
            Cursor = Cursors.Hand,
            Focusable = false,
            Template = PlantillaDelBoton(),
        };
        boton.Click += (_, _) => AlternarPantallaCompleta();
        var fondo = new Grid();
        fondo.Children.Add(_cara);
        fondo.Children.Add(boton);
        _tarjeta.Child = fondo;
        Content = _tarjeta;

        _reloj.Tick += (_, _) =>
        {
            if (!GuionDeLaIntro.Arranca(_apretada.ElapsedMilliseconds)) return;
            _apretada.Reset();
            _reloj.Stop();
            _esperaQueLaSuelte = true;
            Empezar();
        };
        PreviewKeyDown += (_, e) =>
        {
            // Esc sale primero de la pantalla completa, y solo si no está en ella cierra.
            if (e.Key == Key.Escape) { if (WindowState == WindowState.Maximized) AlternarPantallaCompleta(); else Close(); return; }
            // La repetición del teclado manda KeyDown sin parar mientras se mantiene: solo cuenta la primera.
            if (e.Key == Key.U && !_apretada.IsRunning && !_esperaQueLaSuelte)
            {
                _apretada.Restart();
                _reloj.Start();
            }
        };
        PreviewKeyUp += (_, e) =>
        {
            if (e.Key != Key.U) return;
            _apretada.Reset();
            _reloj.Stop();
            _esperaQueLaSuelte = false;
        };
        MouseLeftButtonDown += (_, _) =>
        {
            if (WindowState == WindowState.Maximized) return;
            try { DragMove(); }
            catch (InvalidOperationException) { }   // DragMove con el botón ya suelto: no hay nada que mover
        };
        Closed += (_, _) => { _reloj.Stop(); foreach (var t in _pasos) t.Stop(); };
    }

    /// <summary>
    /// Llena la pantalla y vuelve (promesa 884). En pantalla completa la tarjeta pierde las esquinas redondas, que
    /// quedarían como cuatro muescas contra el borde, y la Ü crece con la ventana; de vuelta, todo como estaba.
    /// </summary>
    public void AlternarPantallaCompleta()
    {
        if (WindowState == WindowState.Maximized)
        {
            WindowState = WindowState.Normal;
            _tarjeta.CornerRadius = new CornerRadius(RadioDeLaConsulta);
            _cara.Width = _cara.Height = _ladoNormal;
        }
        else
        {
            _ladoNormal = _cara.Width;
            WindowState = WindowState.Maximized;
            _tarjeta.CornerRadius = new CornerRadius(0);
            _cara.Width = _cara.Height = Math.Max(_ladoNormal + 1, SystemParameters.PrimaryScreenHeight * 0.5);
        }
    }

    /// <summary>Un círculo gris que se aclara al pasar el ratón y se oscurece al pulsarlo; sin el cromo de Windows.</summary>
    private static ControlTemplate PlantillaDelBoton()
    {
        var borde = new FrameworkElementFactory(typeof(Border), "fondo");
        borde.SetValue(Border.CornerRadiusProperty, new CornerRadius(17));
        borde.SetValue(Border.BackgroundProperty, new TemplateBindingExtension(BackgroundProperty));
        var texto = new FrameworkElementFactory(typeof(ContentPresenter));
        texto.SetValue(HorizontalAlignmentProperty, HorizontalAlignment.Center);
        texto.SetValue(VerticalAlignmentProperty, VerticalAlignment.Center);
        borde.AppendChild(texto);
        var plantilla = new ControlTemplate(typeof(Button)) { VisualTree = borde };
        var encima = new Trigger { Property = UIElement.IsMouseOverProperty, Value = true };
        encima.Setters.Add(new Setter(Border.BackgroundProperty, new SolidColorBrush(Color.FromRgb(124, 124, 124)), "fondo"));
        var pulsado = new Trigger { Property = System.Windows.Controls.Primitives.ButtonBase.IsPressedProperty, Value = true };
        pulsado.Setters.Add(new Setter(Border.BackgroundProperty, new SolidColorBrush(Color.FromRgb(70, 70, 70)), "fondo"));
        plantilla.Triggers.Add(encima);
        plantilla.Triggers.Add(pulsado);
        return plantilla;
    }

    /// <summary>Cuenta la historia desde el principio: siempre desde la Ü (promesa 881).</summary>
    private void Empezar()
    {
        foreach (var t in _pasos) t.Stop();
        _pasos.Clear();
        _cara.BeginAnimation(FaceControl.LaUProperty, null);
        _cara.SetValue(FaceControl.LaUProperty, 1.0);
        _cara.DejarDeMirar();
        _cara.Mood = FaceMood.Reposo;
        LogBus.Log("intro", "la U se mantuvo tres segundos: empieza");

        foreach (var m in GuionDeLaIntro.Pasos)
        {
            var paso = m.Paso;
            if (m.EnMs == 0) { Hacer(paso); continue; }
            var t = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(m.EnMs) };
            t.Tick += (_, _) => { t.Stop(); Hacer(paso); };
            _pasos.Add(t);
            t.Start();
        }
    }

    private void Hacer(PasoDeLaIntro paso)
    {
        LogBus.Log("intro", paso.ToString());
        switch (paso)
        {
            case PasoDeLaIntro.Transformarse:
                // El tiempo corre parejo: el ritmo —rasgos primero, cuerpo después— lo pone LaUDeLaCarita.
                var a = new DoubleAnimation(1.0, 0.0, TimeSpan.FromMilliseconds(GuionDeLaIntro.TransformarseMs));
                a.Completed += (_, _) =>
                {
                    // Primero el valor base y después se suelta la animación: al revés asomaría la Ü un fotograma.
                    _cara.SetValue(FaceControl.LaUProperty, 0.0);
                    _cara.BeginAnimation(FaceControl.LaUProperty, null);
                    _cara.StartIdle();
                };
                _cara.BeginAnimation(FaceControl.LaUProperty, a);
                break;
            case PasoDeLaIntro.MirarAUnLado:
                _cara.MirarHacia(izquierda: true);
                break;
            case PasoDeLaIntro.VolverAlCentro:
                _cara.DejarDeMirar();
                break;
            case PasoDeLaIntro.Preguntar:
                _cara.Mood = FaceMood.Esperando;
                break;
            case PasoDeLaIntro.Colgar:
                // Lo que hace la carita al colgar una conversación: vuelve a su cara y se despide con la mano.
                _cara.Mood = FaceMood.Reposo;
                _cara.Saludar();
                break;
        }
    }
}
