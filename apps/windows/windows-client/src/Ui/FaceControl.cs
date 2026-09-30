using System;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Threading;

namespace U.WindowsClient.Ui;

/// <summary>Modos de la carita: claro (fondo blanco) u oscuro (línea blanca).</summary>
public enum FaceTheme { Light, Dark }

/// <summary>
/// Qué está haciendo Ü, dicho con la cara. Sustituye al viejo booleano <c>Thinking</c>: tener los dos
/// garantizaría que algún día alguien ponga uno sin tocar el otro y la carita diga dos cosas a la vez.
///
/// Ocho y no seis por dos separaciones que importan:
///   · <see cref="Detenido"/> ≠ <see cref="Fallo"/> — «yo lo paré» y «se rompió solo» son causas
///     distintas con acciones distintas; juntarlas es el vicio de los mensajes que no distinguen.
///   · <see cref="Hablando"/> existe porque hubo que crear la señal en VoiceIO, y una capacidad sin
///     quien la use se convierte en código muerto (le pasó a ManifestAsync durante meses).
/// </summary>
public enum FaceMood
{
    Reposo,
    Escuchando,
    /// <summary>
    /// Hay una conversación abierta y ahora mismo no está diciendo nada.
    ///
    /// No es <see cref="Escuchando"/> aunque lo parezca, y la diferencia es CUÁNTO DURA. Escuchando
    /// se hizo para el dictado: ocho segundos como mucho, con los ojos bien abiertos y respirando,
    /// porque en ocho segundos eso se lee como atención. Una conversación en vivo dura minutos, y
    /// ahí lo mismo pasa a ser una carita con los ojos como platos que jadea sin parar delante de
    /// alguien que está trabajando (2026-08-05, lo notó el usuario en cuanto se conectaron las dos
    /// cosas). Atender mucho rato se parece más a estar quieto que a moverse.
    /// </summary>
    Conversando,
    Trabajando,
    Grabando,
    Esperando,
    Hablando,
    Detenido,
    Fallo,
}

/// <summary>
/// La carita del asistente (misma que la app Android: <c>FaceView.kt</c>), portada a WPF:
/// cejas curvas + ojos de línea vertical + sonrisa bezier sobre un squircle. Coordenadas en el sistema
/// original del SVG (viewBox -75..75), escaladas al tamaño del control. Solo dibuja y anima; no decide
/// nada: quién está en cada momento lo decide FaceWindow y lo dice por <see cref="Mood"/>.
///
/// DOS REGLAS DE RENDIMIENTO que no son negociables, porque este control se dibuja a mano y hay dos
/// instancias vivas siempre:
///
///  1. **Los squircles se cachean.** Cada uno son 73 puntos con dos `Math.Pow`, y se dibujan dos por
///     render. Solo dependen del tamaño, así que recalcularlos en cada cuadro es tirar trabajo.
///  2. **Toda animación CONTINUA va en RenderTransform, nunca en una DependencyProperty con
///     AffectsRender.** Las transform las compone el sistema sin repintar; una DP animada en bucle
///     serían 60 repintados por segundo × 2 geometrías × 2 instancias, durante toda una corrida.
///     Las DP animadas quedan para lo puntual: <see cref="Blink"/> y la mirada.
/// </summary>
public sealed class FaceControl : FrameworkElement
{
    private readonly ScaleTransform _scale = new(1, 1);
    private readonly RotateTransform _tilt = new(0);
    /// <summary>El saltito de «te oí» al empezar a escuchar. Transform, como todo lo que mueve el cuerpo entero.</summary>
    private readonly TranslateTransform _salto = new(0, 0);

    public FaceControl()
    {
        RenderTransformOrigin = new Point(0.5, 0.5);
        // Grupo y no una sola transform: el pulso escala, el balanceo de «trabajando» rota y el salto
        // traslada, y las tres tienen que poder convivir sin pisarse.
        var group = new TransformGroup();
        group.Children.Add(_scale);
        group.Children.Add(_tilt);
        group.Children.Add(_salto);
        RenderTransform = group;
    }

    /// <summary>
    /// Si algo de la carita se está moviendo ahora mismo (promesa 444: quieta no pide cuadros).
    ///
    /// WPF solo pide cuadros mientras hay una animación viva, así que basta con preguntarle a él — a
    /// la carita y a sus tres transforms — en vez de llevar la cuenta a mano, que es justo la cuenta
    /// que un día se desincroniza.
    /// </summary>
    public bool Animando =>
        HasAnimatedProperties || _scale.HasAnimatedProperties || _tilt.HasAnimatedProperties || _salto.HasAnimatedProperties;

    /// <summary>Modo de color de la carita (claro/oscuro/transparente). Repinta al cambiar.</summary>
    public FaceTheme Theme
    {
        get => (FaceTheme)GetValue(ThemeProperty);
        set => SetValue(ThemeProperty, value);
    }

    public static readonly DependencyProperty ThemeProperty = DependencyProperty.Register(
        nameof(Theme), typeof(FaceTheme), typeof(FaceControl),
        new FrameworkPropertyMetadata(FaceTheme.Light, FrameworkPropertyMetadataOptions.AffectsRender));

    /// <summary>
    /// Cuánto tiene girada la cabeza: −1 del todo a la izquierda, 0 de frente, 1 a la derecha.
    ///
    /// Sustituye a <c>EyeShift</c>, que corría los dos ojos 3,5 unidades y nada más (spec 052,
    /// promesa 441). Ahora cada rasgo se proyecta sobre una cara curva con
    /// <see cref="CabezaDeLaCarita.Proyectar"/>: se van todos hacia donde mira y se estrechan los que
    /// se acercan al borde. Animada solo mientras gira — no hay repintado en reposo.
    /// </summary>
    public double Giro
    {
        get => (double)GetValue(GiroProperty);
        set => SetValue(GiroProperty, value);
    }

    public static readonly DependencyProperty GiroProperty = DependencyProperty.Register(
        nameof(Giro), typeof(double), typeof(FaceControl),
        new FrameworkPropertyMetadata(0.0, FrameworkPropertyMetadataOptions.AffectsRender));

    /// <summary>
    /// Cuánto están fuera las manos en reposo, de 0 (escondidas) a 1 (fuera del todo). El saludo no
    /// pasa por aquí: lo lleva <see cref="SaludoProperty"/>, que recorre su línea de tiempo entera.
    /// </summary>
    public double Manos
    {
        get => (double)GetValue(ManosProperty);
        set => SetValue(ManosProperty, value);
    }

    public static readonly DependencyProperty ManosProperty = DependencyProperty.Register(
        nameof(Manos), typeof(double), typeof(FaceControl),
        new FrameworkPropertyMetadata(0.0, FrameworkPropertyMetadataOptions.AffectsRender));

    /// <summary>
    /// El instante del saludo en curso, en segundos (0 = no hay saludo). Lo anima <see cref="Saludar"/>
    /// de 0 a <see cref="ManosDeLaCarita.Duracion"/>; dónde está cada mano lo dice ManosDeLaCarita.
    /// </summary>
    private static readonly DependencyProperty SaludoProperty = DependencyProperty.Register(
        "Saludo", typeof(double), typeof(FaceControl),
        new FrameworkPropertyMetadata(0.0, FrameworkPropertyMetadataOptions.AffectsRender));

    private double Saludo => (double)GetValue(SaludoProperty);

    /// <summary>Qué está haciendo Ü. Cambia la pose, el acento de color y la animación continua.</summary>
    public FaceMood Mood
    {
        get => (FaceMood)GetValue(MoodProperty);
        set => SetValue(MoodProperty, value);
    }

    public static readonly DependencyProperty MoodProperty = DependencyProperty.Register(
        nameof(Mood), typeof(FaceMood), typeof(FaceControl),
        new FrameworkPropertyMetadata(FaceMood.Reposo, FrameworkPropertyMetadataOptions.AffectsRender,
            (d, e) => ((FaceControl)d).OnMoodChanged((FaceMood)e.NewValue)));

    /// <summary>0 = ojos abiertos, 1 = cerrados. Lo anima <see cref="Blink"/>.</summary>
    public double BlinkClosed
    {
        get => (double)GetValue(BlinkClosedProperty);
        set => SetValue(BlinkClosedProperty, value);
    }

    public static readonly DependencyProperty BlinkClosedProperty = DependencyProperty.Register(
        nameof(BlinkClosed), typeof(double), typeof(FaceControl),
        new FrameworkPropertyMetadata(0.0, FrameworkPropertyMetadataOptions.AffectsRender));

    /// <summary>
    /// Cuánto está ABIERTA la boca, 0 (cerrada, la sonrisa de siempre) a 1 (bien abierta).
    /// </summary>
    /// <remarks>
    /// Va en una DependencyProperty con AffectsRender pese a la regla de esta clase —lo continuo va
    /// en RenderTransform— porque aquí no hay transform que valga: la boca no se mueve ni se escala,
    /// CAMBIA DE FORMA, y una geometría distinta hay que dibujarla. Lo que sí se respeta es el
    /// motivo de la regla: esto solo se anima mientras Ü habla (no en reposo, que es casi todo el
    /// tiempo), a ~16 cuadros por segundo y no a 60, y quien la mueve redondea el valor para no
    /// disparar un repintado por cada variación imperceptible.
    /// </remarks>
    public double MouthOpen
    {
        get => (double)GetValue(MouthOpenProperty);
        set => SetValue(MouthOpenProperty, value);
    }

    public static readonly DependencyProperty MouthOpenProperty = DependencyProperty.Register(
        nameof(MouthOpen), typeof(double), typeof(FaceControl),
        new FrameworkPropertyMetadata(0.0, FrameworkPropertyMetadataOptions.AffectsRender));

    /// <summary>
    /// La FORMA de la abertura: 0 = ancha y plana (como al decir «i» o «e»), 1 = redonda y estrecha
    /// (como al decir «o» o «u»). Con la altura, es lo que distingue las bocas del dibujo.
    ///
    /// Por el volumen no se puede saber qué vocal se está diciendo —eso exigiría analizar el sonido,
    /// que es otro problema entero— así que esto no pretende acertar la vocal: pretende que la boca
    /// no repita siempre el mismo gesto, que es lo que delata a un muñeco.
    /// </summary>
    public double MouthRound
    {
        get => (double)GetValue(MouthRoundProperty);
        set => SetValue(MouthRoundProperty, value);
    }

    public static readonly DependencyProperty MouthRoundProperty = DependencyProperty.Register(
        nameof(MouthRound), typeof(double), typeof(FaceControl),
        new FrameworkPropertyMetadata(0.0, FrameworkPropertyMetadataOptions.AffectsRender));

    // ── Las poses ─────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Los diez escalares que definen una expresión. Antes eran diez ternarios sobre un booleano
    /// dentro de OnRender; con ocho estados, una tabla.
    ///
    /// Hasta el 2026-09-30 llevaba además un ACENTO de color que teñía trazo y relleno al grabar, al
    /// esperar, al detenerse y al fallar. Se fue con la spec 052: «no me gusta que cambie de color,
    /// quiero que sea siempre blanco o negro». El estado lo dicen el gesto —esta tabla— y el cuerpo
    /// —la ladeada de Esperando, el pulso de Fallo—; la promesa 440 mira los píxeles de los ocho.
    /// </summary>
    private readonly record struct FacePose(
        double BrowL, double BrowR, double CurveL, double CurveR,
        double EyeOpen, double Squint, double MouthCurve, double MouthWidth,
        double CornerL, double CornerR);

    /// <summary>
    /// Reposo y Trabajando conservan EXACTAMENTE los valores que tenían como <c>thinking</c> false y
    /// true: el rediseño no debe cambiar cómo se ve lo que ya existía.
    ///
    /// <c>MouthCurve</c> negativo en <see cref="FaceMood.Fallo"/> no es un truco: con la bezier actual,
    /// un valor negativo pone el punto medio por debajo de las comisuras y sale un ceño, sin tocar el
    /// dibujo.
    /// </summary>
    private static readonly Dictionary<FaceMood, FacePose> Poses = new()
    {
        //                              browL browR curvL curvR  eyeOpen squint mouthCurve  width   cornL cornR
        [FaceMood.Reposo] = new(2, 2.5, 0.3, 0.4, 0.85, 0.15, 0.7, 34 * 1.1, 0.3, 0.5),
        // Escuchar y trabajar son los estados en los que más rato pasa la carita —con la conversación
        // en vivo, «escuchando» es casi toda la sesión—. Su gesto los distingue: cejas altas y ojos
        // abiertos para escuchar, ceja torcida para trabajar.
        [FaceMood.Trabajando] = new(-1, 4, 0.1, 0.5, 0.75, 0.20, 0.7, 34 * 0.95, 0.2, 0.1),
        // Cejas altas y ojos bien abiertos: la cara de estar prestando atención.
        [FaceMood.Escuchando] = new(6, 6, 0.35, 0.35, 1.00, 0.05, 0.6, 34 * 1.05, 0.35, 0.35),
        // Casi el reposo, con la ceja un pelo más alta. A propósito: es lo que se ve durante toda una
        // conversación —el rato en que no dice nada es la mayor parte— y tiene que poder mirarse sin
        // cansar. Quien quiera saber si el micrófono sigue abierto lo tiene en el botón, en rojo.
        [FaceMood.Conversando] = new(3, 3.5, 0.3, 0.4, 0.90, 0.12, 0.7, 34 * 1.1, 0.3, 0.45),
        // Quieta y mirando de frente: «te estoy viendo». La quietud es la señal — ahora sin el rojo,
        // así que la boca se encoge más que antes para que se distinga del reposo de un vistazo.
        [FaceMood.Grabando] = new(2, 2, 0.3, 0.3, 0.95, 0.10, 0.4, 34 * 0.7, 0.2, 0.2),
        // Asimetría interrogativa: una ceja sube, la otra baja. Y además ladea la cabeza (OnMoodChanged).
        [FaceMood.Esperando] = new(6, -1, 0.45, 0.15, 0.9, 0.10, 0.2, 34 * 0.95, 0.4, 0.1),
        [FaceMood.Hablando] = new(2, 2.5, 0.3, 0.4, 0.85, 0.15, 0.9, 34 * 1.25, 0.4, 0.4),
        // Boca recta y ojos entornados: ni contenta ni enfadada, parada.
        [FaceMood.Detenido] = new(0, 0, 0.2, 0.2, 0.6, 0.25, 0.0, 34 * 0.9, 0.0, 0.0),
        [FaceMood.Fallo] = new(-3, -3, 0.15, 0.15, 0.8, 0.15, -0.5, 34 * 0.9, 0.1, 0.1),
    };

    private FacePose CurrentPose => Poses.TryGetValue(Mood, out var p) ? p : Poses[FaceMood.Reposo];

    /// <summary>
    /// Coreografía del estado: limpia lo del anterior y arranca lo del nuevo.
    ///
    /// Lo primero que hace es soltar las animaciones de <c>BlinkClosed</c> y <c>Giro</c>: mientras un
    /// valor está animado WPF IGNORA cualquier asignación, y sin esta limpieza una carita que parpadeó
    /// justo antes de cambiar de estado se quedaría con los ojos a medio cerrar para siempre.
    ///
    /// Y al final PARPADEA: cambiar de estado es un pensamiento nuevo, y es lo que hace la referencia
    /// (Coucou, <c>setState</c>) — la microexpresión más barata que existe.
    /// </summary>
    private void OnMoodChanged(FaceMood mood)
    {
        Soltar(this, BlinkClosedProperty);
        Soltar(this, GiroProperty);
        BlinkClosed = 0;
        Giro = 0;

        StopContinuous();

        switch (mood)
        {
            case FaceMood.Escuchando:
                // Respiración: el único estado con movimiento propio permanente, porque «te escucho»
                // tiene que notarse mientras dura el micrófono (8 s como mucho). Y al entrar, un
                // saltito: «te oí».
                Breathe(from: 1.0, to: 1.05, ms: 1200);
                Saltito();
                break;

            case FaceMood.Trabajando:
                // Balanceo mínimo. Es una rotación, no un repintado: cuesta cero por cuadro.
                Sway(degrees: 3, ms: 2400);
                break;

            case FaceMood.Esperando:
                // La cabeza ladeada de quien pregunta. Sin el ámbar que tenía, es lo que separa
                // «espero algo de ti» de estar quieta.
                Ladear(grados: 8);
                break;

            case FaceMood.Fallo:
                Pulse();   // un solo golpe al entrar, no en bucle
                break;
        }

        Blink(1);
    }

    private void StopContinuous()
    {
        Soltar(_scale, ScaleTransform.ScaleXProperty);
        Soltar(_scale, ScaleTransform.ScaleYProperty);
        Soltar(_tilt, RotateTransform.AngleProperty);
        Soltar(_salto, TranslateTransform.YProperty);
        _scale.ScaleX = _scale.ScaleY = 1;
        _tilt.Angle = 0;
        _salto.Y = 0;
    }

    // ── Animar sin quedarse animando ──────────────────────────────────────────────────────────
    //
    // Una animación de WPF con el FillBehavior por defecto (HoldEnd) se queda RETENIDA al acabar: el
    // valor no se mueve, pero la propiedad sigue «animada» para siempre y no admite asignaciones. Así
    // que cada gesto, al terminar, suelta su animación y deja el valor final como valor de verdad.
    // Es lo que permite que Animando diga la verdad (promesa 444): quieta, nada animado.

    private readonly Dictionary<(IAnimatable, DependencyProperty), AnimationTimeline> _vigentes = new();

    private void Animar(IAnimatable dueno, DependencyProperty p, DoubleAnimationUsingKeyFrames a, double? final = null)
    {
        double valorFinal = final ?? a.KeyFrames[a.KeyFrames.Count - 1].Value;
        var clave = (dueno, p);
        a.Completed += (_, _) =>
        {
            // Solo si sigue siendo la vigente: otra pudo reemplazarla antes de acabar, y soltar esa
            // la cortaría a medias.
            if (!_vigentes.TryGetValue(clave, out var v) || !ReferenceEquals(v, a)) return;
            _vigentes.Remove(clave);
            dueno.BeginAnimation(p, null);
            ((DependencyObject)dueno).SetValue(p, valorFinal);
        };
        _vigentes[clave] = a;
        dueno.BeginAnimation(p, a);
    }

    private void Soltar(IAnimatable dueno, DependencyProperty p)
    {
        _vigentes.Remove((dueno, p));
        dueno.BeginAnimation(p, null);
    }

    private static DoubleAnimationUsingKeyFrames Claves(params (double Valor, double Ms, IEasingFunction? Curva)[] claves)
    {
        var a = new DoubleAnimationUsingKeyFrames();
        foreach (var (v, ms, curva) in claves)
            a.KeyFrames.Add(new EasingDoubleKeyFrame(v, KeyTime.FromTimeSpan(TimeSpan.FromMilliseconds(ms)), curva));
        return a;
    }

    private static readonly IEasingFunction Sale = new CubicEase { EasingMode = EasingMode.EaseOut };
    private static readonly IEasingFunction Entra = new QuadraticEase { EasingMode = EasingMode.EaseIn };
    private static readonly IEasingFunction Suave = new SineEase { EasingMode = EasingMode.EaseInOut };
    private static readonly IEasingFunction Rebota = new BackEase { EasingMode = EasingMode.EaseOut, Amplitude = 0.55 };

    private void Breathe(double from, double to, int ms)
    {
        var a = new DoubleAnimation(from, to, TimeSpan.FromMilliseconds(ms))
        {
            AutoReverse = true,
            RepeatBehavior = RepeatBehavior.Forever,
            EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut },
        };
        _scale.BeginAnimation(ScaleTransform.ScaleXProperty, a);
        _scale.BeginAnimation(ScaleTransform.ScaleYProperty, a);
    }

    private void Sway(double degrees, int ms)
    {
        var a = new DoubleAnimation(-degrees, degrees, TimeSpan.FromMilliseconds(ms))
        {
            AutoReverse = true,
            RepeatBehavior = RepeatBehavior.Forever,
            EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut },
        };
        _tilt.BeginAnimation(RotateTransform.AngleProperty, a);
    }

    private void Ladear(double grados) =>
        Animar(_tilt, RotateTransform.AngleProperty, Claves((0, 0, null), (grados, 340, Rebota)));

    /// <summary>Sube un poco y cae con rebote: «te oí».</summary>
    private void Saltito()
    {
        double alto = -Math.Max(2, ActualHeight * 0.06);
        Animar(_salto, TranslateTransform.YProperty, Claves((0, 0, null), (alto, 120, Sale), (0, 380, Rebota)));
    }

    /// <summary>
    /// Parpadea <paramref name="times"/> veces. Cierra en 70 ms acelerando y abre en 130 frenando
    /// (<see cref="GestosDeLaCarita"/>): el párpado cae y se levanta, no se desliza. La onda simétrica
    /// de 340 ms que había hasta el 2026-09-30 se leía como un párpado mecánico.
    /// </summary>
    public void Blink(int times)
    {
        if (times <= 0) return;
        var claves = new List<(double, double, IEasingFunction?)> { (0, 0, null) };
        double t = 0;
        for (int i = 0; i < times; i++)
        {
            if (i > 0) { t += GestosDeLaCarita.EntreDobleMs; claves.Add((0, t, null)); }
            t += GestosDeLaCarita.CierraMs; claves.Add((1, t, Entra));
            t += GestosDeLaCarita.AbreMs; claves.Add((0, t, Sale));
        }
        Animar(this, BlinkClosedProperty, Claves(claves.ToArray()));
    }

    /// <summary>
    /// Pulso de vida: se aplasta y se estira conservando el volumen —si baja el alto, sube el ancho—, y
    /// rebota. Hasta el 2026-09-30 encogía igual en los dos ejes, que se lee como un zoom, no como un
    /// cuerpo.
    /// </summary>
    public void Pulse()
    {
        Animar(_scale, ScaleTransform.ScaleYProperty, Claves((1, 0, null), (0.84, 90, Sale), (1.07, 230, Suave), (1, 420, Rebota)));
        Animar(_scale, ScaleTransform.ScaleXProperty, Claves((1, 0, null), (1.12, 90, Sale), (0.96, 230, Suave), (1, 420, Rebota)));
    }

    /// <summary>
    /// Saca las manos, saluda con la derecha y las vuelve a esconder (spec 052, promesa 442). Dónde
    /// está cada mano en cada instante lo dice <see cref="ManosDeLaCarita"/>; aquí solo corre el reloj.
    /// </summary>
    public void Saludar()
    {
        double d = ManosDeLaCarita.Duracion;
        var a = new DoubleAnimationUsingKeyFrames();
        a.KeyFrames.Add(new LinearDoubleKeyFrame(0, KeyTime.FromTimeSpan(TimeSpan.Zero)));
        a.KeyFrames.Add(new LinearDoubleKeyFrame(d, KeyTime.FromTimeSpan(TimeSpan.FromSeconds(d))));
        Animar(this, SaludoProperty, a, final: 0);
    }

    /* ---------- Lo que hace sola: parpadear cada pocos segundos y, más espaciado, un gesto grande ---------- */

    private readonly Random _rng = new();
    private DispatcherTimer? _idleTimer, _blinkTimer;

    /// <summary>
    /// Arranca la vida en reposo: dos relojes (<see cref="GestosDeLaCarita"/>). El parpadeo cada 3-7 s,
    /// a veces doble; y cada 8-18 s un gesto grande — girar la cabeza, saludar o un pulso.
    /// </summary>
    public void StartIdle()
    {
        if (_idleTimer != null) return;
        _idleTimer = new DispatcherTimer();
        _idleTimer.Tick += (_, _) => { DoIdleGesture(); ScheduleNextIdle(); };
        ScheduleNextIdle();
        _idleTimer.Start();

        _blinkTimer = new DispatcherTimer();
        _blinkTimer.Tick += (_, _) =>
        {
            Blink(GestosDeLaCarita.EsDoble(_rng.NextDouble()) ? 2 : 1);
            _blinkTimer!.Interval = TimeSpan.FromSeconds(GestosDeLaCarita.ProximoParpadeo(_rng.NextDouble()));
        };
        _blinkTimer.Interval = TimeSpan.FromSeconds(GestosDeLaCarita.ProximoParpadeo(_rng.NextDouble()));
        _blinkTimer.Start();
    }

    private void ScheduleNextIdle()
    {
        // Tranquila: los gestos grandes, cada 8-18 s (antes cambiaba demasiado seguido y se veía ansiosa).
        if (_idleTimer != null) _idleTimer.Interval = TimeSpan.FromSeconds(GestosDeLaCarita.ProximoGesto(_rng.NextDouble()));
    }

    private void DoIdleGesture()
    {
        switch (GestosDeLaCarita.Elegir(_rng.NextDouble()))
        {
            case GestoDeLaCarita.Mirar: LookAround(); break;
            case GestoDeLaCarita.Manos: if (!_mirandoFijo) Saludar(); break;
            case GestoDeLaCarita.Pulso: Pulse(); break;
        }
    }

    /// <summary>
    /// Girar la cabeza hacia un lado y QUEDARSE mirando, hasta que se suelte.
    ///
    /// Es lo que hace creíble que la carita esté señalando algo: ponerse al lado del elemento y
    /// seguir mirando al frente es raro, casi desatento (2026-08-05, pedido por el usuario). Hasta el
    /// 2026-09-30 corría solo los ojos; ahora gira la cabeza entera (spec 052).
    ///
    /// Mientras está fija, los gestos de reposo no la giran: no se puede estar mirando algo y
    /// distraerse cada ocho segundos.
    /// </summary>
    public void MirarHacia(bool izquierda)
    {
        _mirandoFijo = true;
        Girar(objetivo: (izquierda ? -1 : 1) * 0.75, volver: false);
    }

    /// <summary>Vuelve a mirar al frente y deja que los gestos de reposo sigan su curso.</summary>
    public void DejarDeMirar()
    {
        if (!_mirandoFijo) return;
        _mirandoFijo = false;
        Animar(this, GiroProperty, Claves((Giro, 0, null), (0, 460, Suave)));
    }

    private bool _mirandoFijo;

    private void LookAround()
    {
        if (_mirandoFijo) return;   // está mirando algo: no se distrae
        double lado = _rng.Next(2) == 0 ? -1 : 1;
        Girar(objetivo: lado * (0.5 + _rng.NextDouble() * 0.35), volver: true);
    }

    /// <summary>
    /// El giro con sus tres tiempos de animación: una ANTICIPACIÓN mínima hacia el otro lado, el
    /// viaje con un pelo de sobrepaso, y el asentarse. Sin la anticipación el giro parece arrastrado;
    /// sin el sobrepaso, se clava como un servo.
    /// </summary>
    private void Girar(double objetivo, bool volver)
    {
        var claves = new List<(double, double, IEasingFunction?)>
        {
            (Giro, 0, null),
            (Giro - objetivo * 0.08, 90, Sale),
            (objetivo * 1.06, 430, Suave),
            (objetivo, 580, Suave),
        };
        if (volver)
        {
            claves.Add((objetivo, 1400, null));
            claves.Add((0, 1950, Suave));
        }
        Animar(this, GiroProperty, Claves(claves.ToArray()));
    }

    protected override void OnRender(DrawingContext dc)
    {
        double w = ActualWidth, h = ActualHeight;
        if (w <= 0 || h <= 0) return;

        double s = Math.Min(w, h) / 150.0;   // unidades del viewBox → px
        double cx = w / 2, cy = h / 2;
        double Y(double v) => cy + v * s;

        double r = Math.Min(w, h) / 2 - s;
        double giro = Math.Clamp(Giro, -1, 1);

        // Fondo transparente sobre TODO el control: invisible pero sí recibe clics, así la carita
        // siempre se puede agarrar/arrastrar (nunca queda una zona muerta por donde el clic se cuele).
        dc.DrawRectangle(Brushes.Transparent, null, new Rect(0, 0, w, h));

        bool dark = Theme == FaceTheme.Dark;
        var paleta = PaletaDeLaCarita.Para(Theme);

        // AL GIRAR, EL CUERPO ACOMPAÑA UN POCO: dos unidades y media hacia donde mira. Solo los rasgos
        // no bastan — si el contorno se queda clavado, parece una pegatina que se desliza por la cara.
        double dx = giro * 2.5 * s;

        // LAS MANOS, ANTES QUE EL CUERPO: así quedan detrás, y asoman por sus lados (promesa 442).
        PintarManos(dc, paleta, cx + dx, cy, r, s);

        dc.PushTransform(new TranslateTransform(dx, 0));

        // EL VOLUMEN (promesa 443), en tres capas sobre la misma silueta: la luz de arriba, la viñeta
        // que oscurece el borde y el brillo. La luz no gira con la cabeza: es del cuarto, no de la cara,
        // y que los rasgos se muevan por debajo de un brillo quieto es media ilusión del giro.
        var cuerpo = OuterSquircle(cx, cy, r);
        dc.DrawGeometry(paleta.Cuerpo, null, cuerpo);
        dc.DrawGeometry(paleta.Vineta, null, cuerpo);
        dc.DrawGeometry(paleta.Reflejo, null, cuerpo);

        if (dark)
        {
            // Hairline blanca delgada, separada del borde hacia adentro lo mismo que su grosor.
            double hairline = 0.35 * s;
            var pen = new Pen(new SolidColorBrush(paleta.Filete), hairline);
            pen.Freeze();
            dc.DrawGeometry(null, pen, InnerSquircle(cx, cy, r - hairline * 1.5));
        }
        else
        {
            var pen = new Pen(new SolidColorBrush(paleta.Filete), 1.5 * s);
            pen.Freeze();
            dc.DrawGeometry(null, pen, cuerpo);
        }
        dc.Pop();

        // Rasgos: trazo grueso del color de la tinta, con el lienzo rotado -2° como en Android.
        var tinta = new SolidColorBrush(paleta.Tinta);
        tinta.Freeze();
        var stroke = Pluma(tinta, 4 * s);

        dc.PushTransform(new RotateTransform(-2, cx, cy));

        // TODO RASGO SE PROYECTA (promesa 441): X no suma, pasa por la cara curva. Con giro 0 la
        // proyección devuelve exactamente la x de entrada, así que la cara de frente es la de siempre.
        double X(double v) => cx + CabezaDeLaCarita.Proyectar(v, giro).X * s;

        FacePose pose = CurrentPose;
        double browL = pose.BrowL, browR = pose.BrowR;
        double curveL = pose.CurveL, curveR = pose.CurveR;
        double eyeOpen = pose.EyeOpen, squint = pose.Squint;
        double mouthCurve = pose.MouthCurve, mouthWidth = pose.MouthWidth;
        double cornerL = pose.CornerL, cornerR = pose.CornerR;

        // Cejas: bezier cuadrática sobre cada ojo. Sus tres puntos se proyectan por separado, así que
        // la del lado que se aleja se acorta sola.
        foreach (var (bx, bh, c) in new[] { (-30.0, browL, curveL), (30.0, browR, curveR) })
        {
            var brow = new StreamGeometry();
            using (var g = brow.Open())
            {
                g.BeginFigure(new Point(X(bx - 10), Y(-34 - bh)), false, false);
                g.QuadraticBezierTo(new Point(X(bx), Y(-34 - bh - c * 15)), new Point(X(bx + 10), Y(-34 - bh)), true, false);
            }
            brow.Freeze();
            dc.DrawGeometry(null, stroke, brow);
        }

        // Ojos: líneas verticales (el parpadeo los cierra casi del todo). De lado, además de moverse,
        // ADELGAZAN: el trazo se escala por el coseno de la proyección — es lo que se ve en el vídeo
        // de la referencia, y lo que ningún desplazamiento puede imitar.
        double eyeLen = 25 * eyeOpen * (1 - squint * 0.4) * (1 - BlinkClosed * 0.92);
        foreach (double ex in new[] { -30.0, 30.0 })
        {
            var (px, escala) = CabezaDeLaCarita.Proyectar(ex, giro);
            var pluma = escala == 1 ? stroke : Pluma(tinta, 4 * s * Math.Clamp(escala, 0.5, 1.15));
            double ojoX = cx + px * s;
            dc.DrawLine(pluma, new Point(ojoX, Y(-14 - eyeLen / 2)), new Point(ojoX, Y(-14 + eyeLen / 2)));
        }

        // Boca: bezier cúbica asimétrica (sonrisa).
        double @base = mouthCurve * 15;
        double leftY = 34 - @base - cornerL * 8;
        double rightY = 34 - @base - cornerR * 8;
        double midY = 34 - mouthCurve * 12;
        double shift = (cornerR - cornerL) * 10;
        double half = mouthWidth / 2;

        // ABIERTA O CERRADA. Cerrada es la sonrisa de siempre —una línea— y así se queda en reposo:
        // esto no puede cambiar la cara que ya existía. Abierta, la MISMA curva pasa a ser el labio
        // de arriba y se le añade otro por debajo, cerrando una figura que se rellena. Un solo
        // dibujo con dos estados, en vez de dos bocas distintas que habría que mantener a la par.
        double abierta = Math.Max(0, Math.Min(1, MouthOpen));
        if (abierta <= 0.02)
        {
            var linea = new StreamGeometry();
            using (var g = linea.Open())
            {
                g.BeginFigure(new Point(X(-half), Y(leftY)), false, false);
                g.BezierTo(new Point(X(-half * 0.3 + shift), Y(midY)), new Point(X(half * 0.3 + shift), Y(midY)), new Point(X(half), Y(rightY)), true, false);
            }
            linea.Freeze();
            dc.DrawGeometry(null, stroke, linea);
        }
        else
        {
            // Redonda estrecha la boca; ancha la deja como está. Es lo que separa una «o» de una «e».
            double redonda = Math.Max(0, Math.Min(1, MouthRound));
            double halfA = half * (1 - redonda * 0.58);
            double alto = 3 + abierta * 20 * (0.75 + redonda * 0.45);

            // La comisura sube un poco al abrir, como una boca de verdad: si las esquinas se quedan
            // clavadas mientras el centro baja, parece una bisagra y no una boca.
            double lY = leftY - abierta * 2, rY = rightY - abierta * 2;
            double mY = midY - abierta * 1.5;
            double centro = (lY + rY) / 2;

            // DE MEDIA LUNA A ÓVALO. Con la sonrisa de siempre arriba, estrechar la boca la cierra en
            // PUNTA y sale un colmillo, no una «o» (2026-08-05, visto al dibujarlas todas seguidas).
            // Así que al redondear no basta con estrechar: el labio de arriba tiene que dejar de
            // sonreír —se levanta hasta curvarse al revés— y los dos tiran hacia fuera, que es lo que
            // convierte la media luna en un óvalo.
            double Mezcla(double plano, double redondo) => plano + (redondo - plano) * redonda;
            double ctrlArribaY = Mezcla(mY, centro - alto * 0.45);
            double ctrlAbajoY = Mezcla(mY + alto, centro + alto * 0.55);
            double anchoArriba = halfA * Mezcla(0.30, 0.62);
            double anchoAbajo = halfA * Mezcla(0.45, 0.78);

            var boca = new StreamGeometry();
            using (var g = boca.Open())
            {
                g.BeginFigure(new Point(X(-halfA), Y(lY)), true, true);
                g.BezierTo(new Point(X(-anchoArriba + shift), Y(ctrlArribaY)), new Point(X(anchoArriba + shift), Y(ctrlArribaY)), new Point(X(halfA), Y(rY)), false, false);
                g.BezierTo(new Point(X(anchoAbajo), Y(ctrlAbajoY)), new Point(X(-anchoAbajo), Y(ctrlAbajoY)), new Point(X(-halfA), Y(lY)), false, false);
            }
            boca.Freeze();
            dc.DrawGeometry(tinta, null, boca);

            // La lengua. Solo cuando la boca está lo bastante abierta para que se vea algo dentro:
            // dibujarla siempre la convierte en una mancha pegada al labio. GRIS desde el 2026-09-30:
            // era rosa, y una lengua rosa en una cara blanca y negra es lo primero que ve el ojo.
            if (abierta > 0.35)
            {
                // DÓNDE ACABA LA BOCA NO ES DONDE ESTÁ SU PUNTO DE CONTROL. Una bezier cúbica no
                // llega hasta sus controles: con los dos a la misma altura se queda en tres cuartos
                // del camino. Colocar la lengua contando desde el control la dejaba POR DEBAJO del
                // labio, asomando fuera de la boca (2026-08-05). El punto más bajo de la curva sale
                // de evaluarla en la mitad: (P0 + 3·C1 + 3·C2 + P3) / 8.
                double fondo = (lY + rY) / 8 + ctrlAbajoY * 0.75;

                var (lx, le) = CabezaDeLaCarita.Proyectar(shift * 0.4, giro);
                double rx = halfA * 0.42 * le, ry = alto * 0.20;
                var lengua = new EllipseGeometry(new Point(cx + lx * s, Y(fondo - ry * 0.25)), rx * s, ry * s);
                lengua.Freeze();
                var pincel = new SolidColorBrush(paleta.Lengua);
                pincel.Freeze();

                // Y ADEMÁS se recorta contra la boca, que es lo que garantiza que no pueda salirse
                // aunque la cuenta de arriba falle en algún tamaño raro: la geometría manda sobre la
                // aritmética.
                dc.PushClip(boca);
                dc.DrawGeometry(pincel, null, lengua);
                dc.Pop();
            }
        }

        dc.Pop();
    }

    private static Pen Pluma(Brush tinta, double grosor)
    {
        var p = new Pen(tinta, grosor) { StartLineCap = PenLineCap.Round, EndLineCap = PenLineCap.Round, LineJoin = PenLineJoin.Round };
        p.Freeze();
        return p;
    }

    /// <summary>
    /// Las dos manos, detrás del cuerpo. Fuera se ven si <see cref="Manos"/> lo pide o si hay un
    /// saludo en curso; en el saludo manda la línea de tiempo de <see cref="ManosDeLaCarita"/>.
    /// Pintadas con el mismo degradado del cuerpo: son de la misma pieza, no un añadido.
    /// </summary>
    private void PintarManos(DrawingContext dc, PaletaDeLaCarita paleta, double cx, double cy, double r, double s)
    {
        double t = Saludo;
        bool saludando = t > 0 && t < ManosDeLaCarita.Duracion;
        double enReposo = Math.Clamp(Manos, 0, 1);
        double delSaludo = saludando ? ManosDeLaCarita.Asomo(t) : 0;
        double asomo = Math.Max(enReposo, delSaludo);
        if (asomo <= 0.01) return;

        var contorno = new Pen(new SolidColorBrush(paleta.Filete), Math.Max(0.75, 1.2 * s));
        contorno.Freeze();

        foreach (int lado in new[] { -1, 1 })
        {
            var (x, y, angulo) = saludando && delSaludo >= enReposo
                ? ManosDeLaCarita.Mano(t, lado)
                : ManosDeLaCarita.Reposo(asomo, lado);
            double hx = cx + x * r, hy = cy + y * r;
            var mano = new EllipseGeometry(new Point(hx, hy), ManosDeLaCarita.Ancho * r * asomo, ManosDeLaCarita.Alto * r * asomo);
            mano.Freeze();

            dc.PushTransform(new RotateTransform(angulo * 180 / Math.PI, hx, hy));
            dc.DrawGeometry(paleta.Cuerpo, contorno, mano);
            dc.Pop();
        }
    }

    // Caché de los dos squircles. Solo dependen de (cx, cy, r), que solo cambian si el control cambia
    // de tamaño — es decir, casi nunca. Sin caché se reconstruían 2 × 73 puntos con dos Math.Pow cada
    // uno EN CADA REPINTADO, y hay repintados de sobra: cada parpadeo anima BlinkClosed, que lleva
    // AffectsRender, así que ya hoy se repinta a la velocidad del cuadro varias veces por minuto.
    private Geometry? _outerCache, _innerCache;
    private double _cacheCx, _cacheCy, _cacheR, _cacheInnerR;

    private Geometry OuterSquircle(double cx, double cy, double r)
    {
        if (_outerCache == null || cx != _cacheCx || cy != _cacheCy || r != _cacheR)
        {
            _outerCache = Squircle(cx, cy, r);
            _cacheCx = cx; _cacheCy = cy; _cacheR = r;
        }
        return _outerCache;
    }

    private Geometry InnerSquircle(double cx, double cy, double r)
    {
        if (_innerCache == null || r != _cacheInnerR || cx != _cacheCx || cy != _cacheCy)
        {
            _innerCache = Squircle(cx, cy, r);
            _cacheInnerR = r;
        }
        return _innerCache;
    }

    /// <summary>Squircle (superelipse |x|^n+|y|^n=1, n≈4): el "cuadrado con curva de Euler" de Apple.</summary>
    private static Geometry Squircle(double cx, double cy, double r)
    {
        const double n = 4.0;
        const int steps = 72;
        var geo = new StreamGeometry();
        using (var g = geo.Open())
        {
            for (int i = 0; i <= steps; i++)
            {
                double t = 2.0 * Math.PI * i / steps;
                double ct = Math.Cos(t), st = Math.Sin(t);
                double px = cx + r * Math.Sign(ct) * Math.Pow(Math.Abs(ct), 2.0 / n);
                double py = cy + r * Math.Sign(st) * Math.Pow(Math.Abs(st), 2.0 / n);
                var p = new Point(px, py);
                if (i == 0) g.BeginFigure(p, true, true);
                else g.LineTo(p, true, false);
            }
        }
        geo.Freeze();
        return geo;
    }
}
