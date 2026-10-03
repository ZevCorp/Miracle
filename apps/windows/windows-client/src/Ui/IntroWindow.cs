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

    private readonly FaceControl _cara;
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
        Content = new Border { CornerRadius = new CornerRadius(46), Background = Brushes.Black, Child = _cara };

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
            if (e.Key == Key.Escape) { Close(); return; }
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
            try { DragMove(); }
            catch (InvalidOperationException) { }   // DragMove con el botón ya suelto: no hay nada que mover
        };
        Closed += (_, _) => { _reloj.Stop(); foreach (var t in _pasos) t.Stop(); };
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
