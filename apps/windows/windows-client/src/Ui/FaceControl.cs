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
    /// <summary>
    /// La respiración de «escuchando». Aparte del pulso (<see cref="_scale"/>) a propósito: tocarla la hace rebotar y
    /// prenderle la voz la pone a respirar, las dos cosas a la vez, y en la misma transform el rebote, al acabar, se
    /// llevaba la respiración (spec 085).
    /// </summary>
    private readonly ScaleTransform _respiro = new(1, 1);
    /// <summary>El ladeo de un gesto pasajero. Aparte del balanceo de «trabajando», para que entender no lo pare.</summary>
    private readonly RotateTransform _ladeoDelGesto = new(0);

    public FaceControl()
    {
        RenderTransformOrigin = new Point(0.5, 0.5);
        // Grupo y no una sola transform: el pulso escala, el balanceo de «trabajando» rota y el salto
        // traslada, y las tres tienen que poder convivir sin pisarse.
        var group = new TransformGroup();
        group.Children.Add(_scale);
        group.Children.Add(_respiro);
        group.Children.Add(_tilt);
        group.Children.Add(_ladeoDelGesto);
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
        HasAnimatedProperties || _scale.HasAnimatedProperties || _respiro.HasAnimatedProperties
        || _tilt.HasAnimatedProperties || _ladeoDelGesto.HasAnimatedProperties || _salto.HasAnimatedProperties;

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

    /// <summary>
    /// El instante de la presión en curso, en segundos y CON EL SIGNO DEL LADO: positivo, la mano
    /// derecha; negativo, la izquierda; 0, no presiona (spec 052, promesa 446). Lo anima
    /// <see cref="Presionar"/>; dónde está la mano en cada instante lo dice <see cref="ManosDeLaCarita.Presion"/>.
    /// Lado y tiempo en un solo número para que no puedan desacompasarse.
    /// </summary>
    public double Presion
    {
        get => (double)GetValue(PresionProperty);
        set => SetValue(PresionProperty, value);
    }

    public static readonly DependencyProperty PresionProperty = DependencyProperty.Register(
        nameof(Presion), typeof(double), typeof(FaceControl),
        new FrameworkPropertyMetadata(0.0, FrameworkPropertyMetadataOptions.AffectsRender));

    /// <summary>
    /// El instante del desliz en curso, en segundos y con el signo del lado, como <see cref="Presion"/> (spec 085,
    /// promesa 697). Lo anima <see cref="Deslizar"/>; la mano la pone <see cref="ManosDeLaCarita.Desliz"/>.
    /// </summary>
    public double Desliz
    {
        get => (double)GetValue(DeslizProperty);
        set => SetValue(DeslizProperty, value);
    }

    public static readonly DependencyProperty DeslizProperty = DependencyProperty.Register(
        nameof(Desliz), typeof(double), typeof(FaceControl),
        new FrameworkPropertyMetadata(0.0, FrameworkPropertyMetadataOptions.AffectsRender));

    /// <summary>Lo que aguanta apoyada la mano en el desliz en curso, en segundos.</summary>
    private double _cuantoDesliza = 0.42;

    /// <summary>
    /// El instante del tecleo en curso, en segundos; 0 = no teclea (spec 085, promesa 698). Lo anima
    /// <see cref="Teclear"/>; las dos manos las pone <see cref="ManosDeLaCarita.Tecleo"/>.
    /// </summary>
    public double Tecleo
    {
        get => (double)GetValue(TecleoProperty);
        set => SetValue(TecleoProperty, value);
    }

    public static readonly DependencyProperty TecleoProperty = DependencyProperty.Register(
        nameof(Tecleo), typeof(double), typeof(FaceControl),
        new FrameworkPropertyMetadata(0.0, FrameworkPropertyMetadataOptions.AffectsRender));

    /// <summary>Lo que dura el tecleo en curso, en segundos.</summary>
    private double _duraElTecleo = 1.5;

    /// <summary>El gesto pasajero que lleva puesto (spec 085, promesa 694). Cuánto, lo dice <see cref="Expresion"/>.</summary>
    public ExpresionDeLaCarita Gesto
    {
        get => (ExpresionDeLaCarita)GetValue(GestoProperty);
        set => SetValue(GestoProperty, value);
    }

    public static readonly DependencyProperty GestoProperty = DependencyProperty.Register(
        nameof(Gesto), typeof(ExpresionDeLaCarita), typeof(FaceControl),
        new FrameworkPropertyMetadata(ExpresionDeLaCarita.Ninguna, FrameworkPropertyMetadataOptions.AffectsRender));

    /// <summary>
    /// Cuánto del <see cref="Gesto"/> se ve: 0, la cara de su estado; 1, el gesto entero. Lo anima
    /// <see cref="Expresar"/>: entra, se sostiene y sale. Un gesto no es un estado — «que entre y salga, que no se quede
    /// pegado» (el dueño, 2026-10-01).
    /// </summary>
    public double Expresion
    {
        get => (double)GetValue(ExpresionProperty);
        set => SetValue(ExpresionProperty, value);
    }

    public static readonly DependencyProperty ExpresionProperty = DependencyProperty.Register(
        nameof(Expresion), typeof(double), typeof(FaceControl),
        new FrameworkPropertyMetadata(0.0, FrameworkPropertyMetadataOptions.AffectsRender));

    /// <summary>
    /// Cuánto ha LLEGADO a la cara de su estado: 0, sigue con la que tenía; 1, ya es la nueva. La carita
    /// no salta de una expresión a otra (promesa 448): al cambiar de estado esto va de 0 a 1 en lo que
    /// diga <see cref="GestosDeLaCarita.CuantoTardaEnLlegar"/>, y lo pintado es la mezcla.
    /// </summary>
    public double Llegada
    {
        get => (double)GetValue(LlegadaProperty);
        set => SetValue(LlegadaProperty, value);
    }

    public static readonly DependencyProperty LlegadaProperty = DependencyProperty.Register(
        nameof(Llegada), typeof(double), typeof(FaceControl),
        new FrameworkPropertyMetadata(1.0, FrameworkPropertyMetadataOptions.AffectsRender));

    /// <summary>Qué está haciendo Ü. Cambia la pose y la animación continua.</summary>
    public FaceMood Mood
    {
        get => (FaceMood)GetValue(MoodProperty);
        set => SetValue(MoodProperty, value);
    }

    public static readonly DependencyProperty MoodProperty = DependencyProperty.Register(
        nameof(Mood), typeof(FaceMood), typeof(FaceControl),
        new FrameworkPropertyMetadata(FaceMood.Reposo, FrameworkPropertyMetadataOptions.AffectsRender,
            (d, e) => ((FaceControl)d).OnMoodChanged((FaceMood)e.OldValue, (FaceMood)e.NewValue)));

    /// <summary>0 = ojos abiertos, 1 = cerrados. Lo anima <see cref="Blink"/>.</summary>
    public double BlinkClosed
    {
        get => (double)GetValue(BlinkClosedProperty);
        set => SetValue(BlinkClosedProperty, value);
    }

    public static readonly DependencyProperty BlinkClosedProperty = DependencyProperty.Register(
        nameof(BlinkClosed), typeof(double), typeof(FaceControl),
        new FrameworkPropertyMetadata(0.0, FrameworkPropertyMetadataOptions.AffectsRender));

    // LA BOCA NO SE ABRE (promesa 448). Aquí vivían MouthOpen y MouthRound: una boca rellena, con
    // lengua, que cambiaba de forma 16 veces por segundo siguiendo el volumen de la voz. El dueño la
    // juzgó tres veces mirándola («horrible», y su variante hueca «parece que tuviera labios negros»).
    // A 66 px y con un trazo de 1,8 era una mancha que tiembla. Se borró entera: hablar se ve en la
    // sonrisa de la pose Hablando, a la que ahora se LLEGA (ver Llegada), y en el halo.

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

    /// <summary>La sonrisa de siempre: la del reposo, la de conversar y la de hablar.</summary>
    private static readonly FacePose Sonrie = new(2, 2.5, 0.3, 0.4, 0.85, 0.15, 0.7, 34 * 1.1, 0.3, 0.5);

    /// <summary>
    /// La cara de ATENDER: quieta y mirando de frente, «te estoy viendo» y «te estoy oyendo». La quietud
    /// es la señal, y sin el rojo que tuvo la boca se encoge para que se distinga del reposo de un
    /// vistazo. Una sola pose para grabar y para conversar, a propósito: que no puedan separarse sin
    /// querer. Declarada ANTES que la tabla: los estáticos se inicializan en el orden en que están escritos.
    /// </summary>
    private static readonly FacePose Atenta = new(2, 2, 0.3, 0.3, 0.95, 0.10, 0.4, 34 * 0.7, 0.2, 0.2);

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
        [FaceMood.Reposo] = Sonrie,
        // Escuchar y trabajar son los estados en los que más rato pasa la carita —con la conversación
        // en vivo, «escuchando» es casi toda la sesión—. Su gesto los distingue: cejas altas y ojos
        // abiertos para escuchar, ceja torcida para trabajar.
        [FaceMood.Trabajando] = new(-1, 4, 0.1, 0.5, 0.75, 0.20, 0.7, 34 * 0.95, 0.2, 0.1),
        // Cejas altas y ojos bien abiertos: la cara de estar prestando atención.
        [FaceMood.Escuchando] = new(6, 6, 0.35, 0.35, 1.00, 0.05, 0.6, 34 * 1.05, 0.35, 0.35),
        // CONVERSANDO SONRÍE, como en reposo. Por la mañana del 2026-10-01 se puso aquí la cara de atender, fija (spec
        // 077), y por la tarde el dueño: «me gusta, pero que entre y salga, que no se quede pegado». Atender es ahora
        // un gesto (ExpresionDeLaCarita.Atenta): un momento, y de vuelta a la sonrisa (spec 085, promesa 691).
        [FaceMood.Conversando] = Sonrie,
        [FaceMood.Grabando] = Atenta,
        // Asimetría interrogativa: una ceja sube, la otra baja. Y además ladea la cabeza (OnMoodChanged).
        [FaceMood.Esperando] = new(6, -1, 0.45, 0.15, 0.9, 0.10, 0.2, 34 * 0.95, 0.4, 0.1),
        // AL HABLAR, LA MISMA CARA. Aquí estaba la sonrisa ancha a la que se llegaba en 260 ms; el dueño la vio y no le
        // gustó: «por ahora que no haga nada cuando hable» (spec 085, promesa 448). El halo ya dice que habla.
        [FaceMood.Hablando] = Sonrie,
        // Boca recta y ojos entornados: ni contenta ni enfadada, parada.
        [FaceMood.Detenido] = new(0, 0, 0.2, 0.2, 0.6, 0.25, 0.0, 34 * 0.9, 0.0, 0.0),
        [FaceMood.Fallo] = new(-3, -3, 0.15, 0.15, 0.8, 0.15, -0.5, 34 * 0.9, 0.1, 0.1),
    };

    private static FacePose PoseDe(FaceMood m) => Poses.TryGetValue(m, out var p) ? p : Poses[FaceMood.Reposo];

    /// <summary>La cara entre dos poses: 0 es <paramref name="a"/>, 1 es <paramref name="b"/>.</summary>
    private static FacePose Mezclar(FacePose a, FacePose b, double t)
    {
        t = Math.Clamp(t, 0, 1);
        double M(double x, double y) => x + (y - x) * t;
        return new(M(a.BrowL, b.BrowL), M(a.BrowR, b.BrowR), M(a.CurveL, b.CurveL), M(a.CurveR, b.CurveR),
            M(a.EyeOpen, b.EyeOpen), M(a.Squint, b.Squint), M(a.MouthCurve, b.MouthCurve), M(a.MouthWidth, b.MouthWidth),
            M(a.CornerL, b.CornerL), M(a.CornerR, b.CornerR));
    }

    /// <summary>La cara de la que viene. No es la del estado anterior: es la que se VEÍA, que podía ir a medio camino.</summary>
    private FacePose _poseDesde = Poses[FaceMood.Reposo];

    /// <summary>
    /// Las caras de los gestos (spec 085, promesa 694). Atender es la de grabar y entender la de esperar, tal cual: son
    /// las dos que el dueño señaló en la ventana de prueba. Alegrarse es la sonrisa grande con los ojos entornados, y
    /// sorprenderse, las cejas arriba del todo con la boca encogida.
    /// </summary>
    private static readonly Dictionary<ExpresionDeLaCarita, FacePose> Gestos = new()
    {
        [ExpresionDeLaCarita.Atenta] = Atenta,
        [ExpresionDeLaCarita.Entiende] = new(6, -1, 0.45, 0.15, 0.9, 0.10, 0.2, 34 * 0.95, 0.4, 0.1),
        [ExpresionDeLaCarita.Contenta] = new(5, 5.5, 0.45, 0.5, 0.7, 0.35, 1.0, 34 * 1.3, 0.5, 0.5),
        [ExpresionDeLaCarita.Sorprendida] = new(9, 9, 0.5, 0.5, 1.0, 0.0, 0.15, 34 * 0.5, 0.1, 0.1),
    };

    /// <summary>Lo que se pinta: de la cara que tenía a la de su estado, lo que haya llegado; y encima, lo que se vea del gesto.</summary>
    private FacePose CurrentPose
    {
        get
        {
            var delEstado = Mezclar(_poseDesde, PoseDe(Mood), Llegada);
            return Expresion > 0 && Gestos.TryGetValue(Gesto, out var gesto) ? Mezclar(delEstado, gesto, Expresion) : delEstado;
        }
    }

    /// <summary>
    /// Coreografía del estado: llega a la cara nueva, para lo continuo del anterior y arranca lo suyo.
    ///
    /// LA CABEZA NO SE TOCA. Hasta el 2026-10-01 cada cambio de estado la devolvía al frente de un
    /// salto. Con los ojos corridos 3,5 unidades casi no se veía; con la cabeza girada hacia lo que Ü
    /// acaba de pulsar, sí — y mientras Ü trabaja y narra, el estado cambia cada pocos segundos
    /// (promesa 447). Hacia dónde mira no depende de qué está haciendo.
    ///
    /// Y PARPADEA: cambiar de estado es un pensamiento nuevo, y es lo que hace la referencia (Coucou,
    /// <c>setState</c>). Salvo entre hablar y callar, que en una conversación es cada frase.
    /// </summary>
    private void OnMoodChanged(FaceMood antes, FaceMood ahora)
    {
        _poseDesde = Mezclar(_poseDesde, PoseDe(antes), Llegada);
        Soltar(this, LlegadaProperty);
        if (IsLoaded)
        {
            Llegada = 0;
            Animar(this, LlegadaProperty, Claves((0, 0, null), (1, GestosDeLaCarita.CuantoTardaEnLlegar(antes, ahora), Suave)));
        }
        // Sin pantalla no hay camino que ver: quien la pinta suelta (el contrato) quiere la cara del estado.
        else Llegada = 1;

        StopContinuous();

        switch (ahora)
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

        if (GestosDeLaCarita.ParpadeaAlCambiar(antes, ahora))
        {
            // Mientras un valor está animado WPF ignora cualquier asignación: se suelta antes, o una
            // carita que venía parpadeando se quedaría con los ojos a medio cerrar.
            Soltar(this, BlinkClosedProperty);
            BlinkClosed = 0;
            Blink(1);
        }
    }

    // Lo continuo del estado: la respiración de Escuchando y la inclinación de Trabajando y Esperando.
    private bool _respira, _inclinada;

    /// <summary>
    /// Para lo CONTINUO del estado anterior, y solo eso. Antes soltaba también el pulso y el salto, que
    /// son de un golpe: un toque rebota 420 ms, y si en ese rato cambiaba el estado —tocarla abre la
    /// voz— el rebote se cortaba en seco. Y vuelve a su sitio andando, no de un salto.
    /// </summary>
    private void StopContinuous()
    {
        if (_respira)
        {
            _respira = false;
            Volver(_respiro, ScaleTransform.ScaleXProperty, _respiro.ScaleX, 1);
            Volver(_respiro, ScaleTransform.ScaleYProperty, _respiro.ScaleY, 1);
        }
        if (_inclinada)
        {
            _inclinada = false;
            Volver(_tilt, RotateTransform.AngleProperty, _tilt.Angle, 0);
        }
    }

    private void Volver(IAnimatable dueno, DependencyProperty p, double desde, double a)
    {
        if (IsLoaded) { Animar(dueno, p, Claves((desde, 0, null), (a, 280, Suave))); return; }
        Soltar(dueno, p);
        ((DependencyObject)dueno).SetValue(p, a);
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
        _respira = true;
        var a = new DoubleAnimation(from, to, TimeSpan.FromMilliseconds(ms))
        {
            AutoReverse = true,
            RepeatBehavior = RepeatBehavior.Forever,
            EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut },
        };
        _respiro.BeginAnimation(ScaleTransform.ScaleXProperty, a);
        _respiro.BeginAnimation(ScaleTransform.ScaleYProperty, a);
    }

    private void Sway(double degrees, int ms)
    {
        _inclinada = true;
        var a = new DoubleAnimation(-degrees, degrees, TimeSpan.FromMilliseconds(ms))
        {
            AutoReverse = true,
            RepeatBehavior = RepeatBehavior.Forever,
            EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut },
        };
        _tilt.BeginAnimation(RotateTransform.AngleProperty, a);
    }

    private void Ladear(double grados)
    {
        _inclinada = true;
        Animar(_tilt, RotateTransform.AngleProperty, Claves((_tilt.Angle, 0, null), (grados, 340, Rebota)));
    }

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

    /// <summary>
    /// Saca la mano de un lado, EMPUJA hacia fuera y la esconde (spec 052, promesa 446): el gesto de
    /// pulsar lo que Ü acaba de pulsar. <paramref name="tras"/> es lo que tarda en llegar junto al
    /// elemento: la mano sale al posarse, no por el camino.
    /// </summary>
    public void Presionar(bool izquierda, TimeSpan tras)
    {
        double d = ManosDeLaCarita.DuracionDePresionar * (izquierda ? -1 : 1);
        var a = new DoubleAnimationUsingKeyFrames { BeginTime = tras > TimeSpan.Zero ? tras : TimeSpan.Zero };
        a.KeyFrames.Add(new LinearDoubleKeyFrame(0, KeyTime.FromTimeSpan(TimeSpan.Zero)));
        a.KeyFrames.Add(new LinearDoubleKeyFrame(d, KeyTime.FromTimeSpan(TimeSpan.FromSeconds(Math.Abs(d)))));
        Animar(this, PresionProperty, a, final: 0);
    }

    /// <summary>
    /// Apoya la mano de un lado y la AGUANTA <paramref name="cuanto"/> mientras la ventana de la carita se mueve con lo
    /// que Ü desplaza (spec 085, promesa 697). <paramref name="tras"/>: lo que tarda en llegar al sitio.
    /// </summary>
    public void Deslizar(bool izquierda, TimeSpan tras, TimeSpan cuanto)
    {
        _cuantoDesliza = Math.Max(0, cuanto.TotalSeconds);
        double d = ManosDeLaCarita.DuracionDelDesliz(_cuantoDesliza);
        var a = new DoubleAnimationUsingKeyFrames { BeginTime = tras > TimeSpan.Zero ? tras : TimeSpan.Zero };
        a.KeyFrames.Add(new LinearDoubleKeyFrame(0, KeyTime.FromTimeSpan(TimeSpan.Zero)));
        a.KeyFrames.Add(new LinearDoubleKeyFrame(izquierda ? -d : d, KeyTime.FromTimeSpan(TimeSpan.FromSeconds(d))));
        Animar(this, DeslizProperty, a, final: 0);
    }

    /// <summary>
    /// Saca las dos manos y TECLEA durante <paramref name="cuanto"/> (spec 085, promesa 698): «como moviendo las dos
    /// manitos, taca taca taca». <paramref name="tras"/>: lo que tarda en llegar junto al campo.
    /// </summary>
    public void Teclear(TimeSpan cuanto, TimeSpan tras)
    {
        _duraElTecleo = Math.Max(0.3, cuanto.TotalSeconds);
        var a = new DoubleAnimationUsingKeyFrames { BeginTime = tras > TimeSpan.Zero ? tras : TimeSpan.Zero };
        a.KeyFrames.Add(new LinearDoubleKeyFrame(0, KeyTime.FromTimeSpan(TimeSpan.Zero)));
        a.KeyFrames.Add(new LinearDoubleKeyFrame(_duraElTecleo, KeyTime.FromTimeSpan(TimeSpan.FromSeconds(_duraElTecleo))));
        Animar(this, TecleoProperty, a, final: 0);
    }

    /// <summary>
    /// Pone un GESTO: entra, se sostiene un momento y sale solo, de vuelta a la cara de su estado (spec 085, promesa
    /// 694). Los tiempos y el ladeo de cada uno los dice <see cref="ExpresionesDeLaCarita.Tiempos"/>.
    /// </summary>
    public void Expresar(ExpresionDeLaCarita cual)
    {
        if (!Gestos.ContainsKey(cual)) return;
        var t = ExpresionesDeLaCarita.Tiempos(cual);
        // Si ya llevaba otro puesto, sigue desde lo que se veía: cambiar de gesto tampoco salta.
        double desde = Gesto == cual ? Expresion : 0;
        Gesto = cual;
        Animar(this, ExpresionProperty, Claves(
            (desde, 0, null), (1, t.EntraMs, Sale), (1, t.EntraMs + t.SostieneMs, null), (0, t.EntraMs + t.SostieneMs + t.SaleMs, Suave)));
        if (t.Ladeo != 0 || _ladeoDelGesto.Angle != 0)
            Animar(_ladeoDelGesto, RotateTransform.AngleProperty, Claves(
                (_ladeoDelGesto.Angle, 0, null), (t.Ladeo, t.EntraMs + 60, Rebota), (t.Ladeo, t.EntraMs + t.SostieneMs, null), (0, t.EntraMs + t.SostieneMs + t.SaleMs, Suave)));
        if (cual == ExpresionDeLaCarita.Contenta) Saltito();
    }

    /* ---------- Lo que hace sola: parpadear ---------- */

    private readonly Random _rng = new();
    private DispatcherTimer? _blinkTimer;

    /// <summary>
    /// Arranca lo que la carita hace SOLA (<see cref="GestosDeLaCarita"/>, promesa 444): parpadear cada
    /// 8-18 s, a veces doble. Nada más: girar la cabeza y el pulso responden a algo que pasó, y cuándo
    /// saluda lo decide la ventana con <see cref="ReglaDelSaludo"/> — había un reloj de saludo aquí, uno
    /// por cada dibujo de la carita, y ninguno sabía del otro (spec 077, promesa 692).
    /// </summary>
    public void StartIdle()
    {
        if (_blinkTimer != null) return;
        _blinkTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(GestosDeLaCarita.ProximoParpadeo(_rng.NextDouble())) };
        _blinkTimer.Tick += (_, _) =>
        {
            Blink(GestosDeLaCarita.EsDoble(_rng.NextDouble()) ? 2 : 1);
            _blinkTimer!.Interval = TimeSpan.FromSeconds(GestosDeLaCarita.ProximoParpadeo(_rng.NextDouble()));
        };
        _blinkTimer.Start();
    }

    /// <summary>
    /// Girar la cabeza hacia un lado y QUEDARSE mirando, hasta que se suelte.
    ///
    /// Es lo que hace creíble que la carita esté señalando algo: ponerse al lado del elemento y
    /// seguir mirando al frente es raro, casi desatento (2026-08-05, pedido por el usuario). Hasta el
    /// 2026-09-30 corría solo los ojos; ahora gira la cabeza entera (spec 052).
    ///
    /// </summary>
    public void MirarHacia(bool izquierda)
    {
        _mirandoFijo = true;
        Girar((izquierda ? -1 : 1) * 0.75);
    }

    /// <summary>Vuelve a mirar al frente y deja que los gestos de reposo sigan su curso.</summary>
    public void DejarDeMirar()
    {
        if (!_mirandoFijo) return;
        _mirandoFijo = false;
        Animar(this, GiroProperty, Claves((Giro, 0, null), (0, 460, Suave)));
    }

    private bool _mirandoFijo;

    /// <summary>
    /// El giro con sus tres tiempos de animación: una ANTICIPACIÓN mínima hacia el otro lado, el
    /// viaje con un pelo de sobrepaso, y el asentarse. Sin la anticipación el giro parece arrastrado;
    /// sin el sobrepaso, se clava como un servo.
    /// </summary>
    private void Girar(double objetivo) =>
        Animar(this, GiroProperty, Claves(
            (Giro, 0, null),
            (Giro - (objetivo - Giro) * 0.08, 90, Sale),
            (objetivo + (objetivo - Giro) * 0.06, 430, Suave),
            (objetivo, 580, Suave)));

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

        // UNA LÍNEA, SIEMPRE (promesa 448). No se abre ni al hablar: lo que cambia es la pose —más
        // ancha y más curva mientras dice una frase—, y a ella se llega mezclando, no saltando.
        var boca = new StreamGeometry();
        using (var g = boca.Open())
        {
            g.BeginFigure(new Point(X(-half), Y(leftY)), false, false);
            g.BezierTo(new Point(X(-half * 0.3 + shift), Y(midY)), new Point(X(half * 0.3 + shift), Y(midY)), new Point(X(half), Y(rightY)), true, false);
        }
        boca.Freeze();
        dc.DrawGeometry(null, stroke, boca);

        dc.Pop();
    }

    private static Pen Pluma(Brush tinta, double grosor)
    {
        var p = new Pen(tinta, grosor) { StartLineCap = PenLineCap.Round, EndLineCap = PenLineCap.Round, LineJoin = PenLineJoin.Round };
        p.Freeze();
        return p;
    }

    /// <summary>
    /// Las manos, detrás del cuerpo. Fuera se ven si <see cref="Manos"/> lo pide, si hay un saludo en
    /// curso o si está presionando; dónde está cada una lo dice <see cref="ManosDeLaCarita"/>.
    /// Pintadas con el mismo degradado del cuerpo: son de la misma pieza, no un añadido.
    /// </summary>
    private void PintarManos(DrawingContext dc, PaletaDeLaCarita paleta, double cx, double cy, double r, double s)
    {
        var contorno = new Pen(new SolidColorBrush(paleta.Filete), Math.Max(0.75, 1.2 * s));
        contorno.Freeze();

        void Pintar(double x, double y, double angulo, double asomo)
        {
            if (asomo <= 0.01) return;
            double hx = cx + x * r, hy = cy + y * r;
            var mano = new EllipseGeometry(new Point(hx, hy), ManosDeLaCarita.Ancho * r * asomo, ManosDeLaCarita.Alto * r * asomo);
            mano.Freeze();
            dc.PushTransform(new RotateTransform(angulo * 180 / Math.PI, hx, hy));
            dc.DrawGeometry(paleta.Cuerpo, contorno, mano);
            dc.Pop();
        }

        // DESLIZAR Y PRESIONAR MANDAN, Y SON UNA SOLA MANO: la del lado de lo que Ü desplaza o pulsa (promesas 697 y 446).
        double d = Desliz;
        if (d != 0 && Math.Abs(d) < ManosDeLaCarita.DuracionDelDesliz(_cuantoDesliza))
        {
            var (x, y, angulo, asomo) = ManosDeLaCarita.Desliz(Math.Abs(d), Math.Sign(d), _cuantoDesliza);
            Pintar(x, y, angulo, asomo);
            return;
        }
        double p = Presion;
        if (p != 0 && Math.Abs(p) < ManosDeLaCarita.DuracionDePresionar)
        {
            var (x, y, angulo, asomo) = ManosDeLaCarita.Presion(Math.Abs(p), Math.Sign(p));
            Pintar(x, y, angulo, asomo);
            return;
        }

        // TECLEAR: las dos, golpeando por turnos (promesa 698).
        double tecla = Tecleo;
        if (tecla > 0 && tecla < _duraElTecleo)
        {
            foreach (int lado in new[] { -1, 1 })
            {
                var (x, y, angulo, asomo) = ManosDeLaCarita.Tecleo(tecla, lado, _duraElTecleo);
                Pintar(x, y, angulo, asomo);
            }
            return;
        }

        double t = Saludo;
        bool saludando = t > 0 && t < ManosDeLaCarita.Duracion;
        double enReposo = Math.Clamp(Manos, 0, 1);
        double delSaludo = saludando ? ManosDeLaCarita.Asomo(t) : 0;
        double fuera = Math.Max(enReposo, delSaludo);
        foreach (int lado in new[] { -1, 1 })
        {
            var (x, y, angulo) = saludando && delSaludo >= enReposo
                ? ManosDeLaCarita.Mano(t, lado)
                : ManosDeLaCarita.Reposo(fuera, lado);
            Pintar(x, y, angulo, fuera);
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
