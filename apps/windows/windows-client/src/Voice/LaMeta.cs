using System.Text;

namespace U.WindowsClient.Voice;

/// <summary>
/// LA META DE UNA TAREA LARGA (spec 082, promesas 795 a 799): vive fuera del turno de quien actúa, lleva la bitácora
/// de todo lo ejecutado y no se da por cerrada hasta que alguien lo afirma con evidencia.
/// </summary>
/// <remarks>
/// DE DÓNDE SALE. Es la meta del harness de Codex (`openai/codex`, `codex-rs/ext/goal`), que es el que sirve la Agents
/// API de OpenAI, leída el 2026-10-01: `create_goal`, `get_goal`, `update_goal` con `complete`, `blocked` y `paused`;
/// al acabar un turno con la meta activa arranca otro solo (`continue_if_idle`) con una plantilla
/// (`templates/goals/continuation.md`) que lleva el objetivo íntegro, un chequeo de progreso y una auditoría de
/// terminado; y `blocked` solo tras tres turnos con el mismo bloqueo. El dueño pidió copiar lo que ya está validado
/// en producción antes que su propia hipótesis —un planificador que entra cada diez segundos—, y esto es lo que hay:
/// el lento entra por eventos (fin de turno, falta de progreso, algo que dice la persona), no por reloj.
///
/// POR QUÉ HACÍA FALTA. Con GPT-Live el trabajo de quien actúa termina cuando deja de pedir herramientas y contesta:
/// «terminé» era una opinión suya. El 2026-09-26 dio por acabada a los 28 s una media hora pedida, y el dueño, el
/// 2026-10-01: «no siento la confianza como usuario todavía para entregarle tareas complejas largas».
///
/// LO QUE ES DE Ü Y NO DE CODEX. Allí el presupuesto es de fichas; aquí, de continuaciones y de minutos. Y dos cosas
/// que allí se le piden al modelo aquí las comprueba el código, porque una instrucción se puede ignorar: «bloqueada»
/// no se acepta antes del tercer turno, y dos turnos seguidos sin ejecutar nada pausan la meta en vez de seguir
/// devolviéndole el trabajo a quien no lo hace.
///
/// ESTA CLASE NO HABLA CON NADIE: es estado y texto, con el reloj inyectado, y el contrato la juzga entera.
/// </remarks>
public sealed class LaMeta
{
    /// <summary>«Bloqueada» no se acepta antes de este turno de la meta, contando el primero.</summary>
    public const int TurnosParaBloquear = 3;

    /// <summary>Cuántas veces, como mucho, Ü le devuelve el trabajo a quien actúa.</summary>
    public const int TopeDeContinuaciones = 12;

    /// <summary>Cuánto dura una meta si al crearla no se dice otra cosa, en minutos.</summary>
    public const int MinutosPorDefecto = 30;

    /// <summary>Cuánto puede pedirse, como mucho: una meta no es una tarea programada.</summary>
    public const int MinutosComoMucho = 180;

    /// <summary>Cuánto ocupa la bitácora cuando viaja, en caracteres. Lo viejo se cuenta en vez de listarse.</summary>
    public const int TopeDeLaBitacora = 5_000;

    /// <summary>Con qué empieza todo lo que Ü le manda a quien actúa sobre la meta. La persona no lo dijo.</summary>
    public const string Marca = "[META ACTIVA: esto no lo dijo la persona]";

    public const string SinMeta = "sin meta", EnCurso = "activa", Cumplida = "cumplida", Bloqueada = "bloqueada", Pausada = "pausada";

    private readonly Func<long> _relojMs;
    private readonly object _candado = new();
    private readonly List<string> _bitacora = new();
    private string _objetivo = "", _estado = SinMeta, _evidencia = "", _porQueSeDetuvo = "";
    private long _desdeMs;
    private int _minutos, _turnos, _continuaciones, _acciones, _accionesAlContinuar, _turnosSinAccion;

    public LaMeta(Func<long> relojMs) => _relojMs = relojMs ?? throw new ArgumentNullException(nameof(relojMs));

    public bool Activa { get { lock (_candado) return _estado == EnCurso; } }
    public string Estado { get { lock (_candado) return _estado; } }
    public string Objetivo { get { lock (_candado) return _objetivo; } }

    /// <summary>El turno de la meta: 1 al crearla, y uno más por cada vez que Ü devuelve el trabajo.</summary>
    public int Turnos { get { lock (_candado) return _turnos; } }
    public int Continuaciones { get { lock (_candado) return _continuaciones; } }

    /// <summary>Todo lo anotado en la bitácora desde que nació la meta, quepa o no en lo que viaja.</summary>
    public int Acciones { get { lock (_candado) return _acciones; } }

    /// <summary>Por qué la pausó Ü por su cuenta —el techo, o dos turnos sin ejecutar nada—; vacío si no fue ella.</summary>
    public string PorQueSeDetuvo { get { lock (_candado) return _porQueSeDetuvo; } }

    /// <summary>Crea la meta. Solo puede haber una sin cerrar: la que hay se cierra antes, con su estado.</summary>
    public (bool Ok, string Mensaje) Crear(string objetivo, int minutos = 0)
    {
        string o = (objetivo ?? "").Trim();
        lock (_candado)
        {
            if (o.Length == 0) return (false, "falta `objetivo`: la meta entera, dicha como la pidió la persona. No creé nada.");
            if (_estado == EnCurso)
                return (false, $"ya hay una meta sin cerrar: «{_objetivo}». No creé otra: sigue con esa, o ciérrala antes con meta_actualizar "
                             + "(«cumplida» con su evidencia, o «pausada» si la persona pidió dejarla).");
            _objetivo = o;
            _estado = EnCurso;
            _evidencia = _porQueSeDetuvo = "";
            _desdeMs = _relojMs();
            _minutos = minutos <= 0 ? MinutosPorDefecto : Math.Min(minutos, MinutosComoMucho);
            _turnos = 1;
            _continuaciones = _acciones = _accionesAlContinuar = _turnosSinAccion = 0;
            _bitacora.Clear();
            return (true, $"Meta creada, con hasta {_minutos} minutos. Desde ahora el trabajo no se suelta hasta cerrarla: si terminas tu turno "
                        + "sin cerrarla, te la devuelvo con lo que llevas hecho. Empieza ya.");
        }
    }

    /// <summary>El objetivo, el estado y la cuenta. Sin meta, lo dice.</summary>
    public string Ver()
    {
        lock (_candado)
        {
            if (_estado == SinMeta) return "no hay ninguna meta: ni activa ni cerrada.";
            return $"META {_estado.ToUpperInvariant()}: {_objetivo}\n{CuentaSinCandado()}"
                 + (_evidencia.Length > 0 ? $"\nevidencia al cerrar: {_evidencia}" : "")
                 + (_porQueSeDetuvo.Length > 0 ? $"\nla pausé yo: {_porQueSeDetuvo}" : "")
                 + (_bitacora.Count > 0 ? "\n\nLO YA HECHO:\n" + BitacoraSinCandado(TopeDeLaBitacora) : "");
        }
    }

    /// <summary>Los turnos, las acciones y el tiempo que lleva. Lo que el final le cuenta a la persona.</summary>
    public string Cuenta() { lock (_candado) return CuentaSinCandado(); }

    private string CuentaSinCandado()
    {
        long s = Math.Max(0, (_relojMs() - _desdeMs) / 1000);
        return $"turno {_turnos} · {_acciones} acción(es) ejecutada(s) · {(s >= 120 ? $"{s / 60} min" : $"{s} s")} de hasta {_minutos} min";
    }

    /// <summary>
    /// Cierra la meta. «cumplida» pide la evidencia; «bloqueada», haber llegado al tercer turno; «pausada», nada.
    /// </summary>
    public (bool Ok, string Mensaje) Actualizar(string estado, string evidencia)
    {
        string e = (estado ?? "").Trim().ToLowerInvariant();
        string prueba = (evidencia ?? "").Trim();
        lock (_candado)
        {
            if (_estado != EnCurso) return (false, _estado == SinMeta ? "no hay ninguna meta que cerrar." : $"la meta ya está cerrada ({_estado}): no hay nada que actualizar.");
            switch (e)
            {
                case Cumplida:
                    // AFIRMAR NO ES PROBAR (la auditoría de terminado de Codex): sin lo que se ve ahora que lo prueba, no se cierra.
                    if (prueba.Length < 12)
                        return (false, "no la cierro como cumplida sin `evidencia`: qué se ve AHORA —en la pantalla o en el disco— que prueba cada cosa pedida. "
                                     + "Si no lo has comprobado, compruébalo; si falta algo, sigue trabajando.");
                    break;
                case Bloqueada:
                    if (_turnos < TurnosParaBloquear)
                        return (false, $"todavía no: «bloqueada» es para cuando el MISMO bloqueo se repite {TurnosParaBloquear} turnos seguidos, y este es el turno {_turnos}. "
                                     + "Prueba otra vía —mira la pantalla, otro camino, otra herramienta— y sigue.");
                    if (prueba.Length < 12) return (false, "di en `evidencia` qué es lo que bloquea y qué necesitas de la persona para seguir.");
                    break;
                case Pausada:
                    break;
                default:
                    return (false, $"«{estado}» no es un estado: cumplida, bloqueada o pausada.");
            }
            _estado = e;
            _evidencia = prueba;
            return (true, $"Meta {e}. {CuentaSinCandado()}." + (prueba.Length > 0 ? $" Evidencia: {prueba}" : "")
                        + " Cuéntale a la persona el resultado en una o dos frases, con sus datos.");
        }
    }

    /// <summary>Una línea de la bitácora: una llamada, un paso de un plan, o lo que las manos pulsaron en un objetivo.</summary>
    public void Anotar(string linea, bool fallo = false)
    {
        string l = (linea ?? "").Replace("\r", " ").Replace("\n", " ").Trim();
        if (l.Length == 0) return;
        if (l.Length > 300) l = l[..300] + "…";
        lock (_candado)
        {
            if (_estado != EnCurso) return;
            _acciones++;
            // SI YA TRAE SU MARCA —los pasos de un plan llegan con «✔» o «✘»— no se le pone otra.
            bool marcada = l.StartsWith("✔", StringComparison.Ordinal) || l.StartsWith("✘", StringComparison.Ordinal);
            _bitacora.Add($"{_acciones}. " + (marcada ? l : (fallo ? "✘ " : "✔ ") + l));
        }
    }

    /// <summary>Lo ya hecho, en orden. Si no cabe, van las más recientes y se dice cuántas hubo antes (patrón nº10).</summary>
    public string Bitacora(int tope = TopeDeLaBitacora) { lock (_candado) return BitacoraSinCandado(tope); }

    private string BitacoraSinCandado(int tope)
    {
        if (_bitacora.Count == 0) return "(todavía no se ha ejecutado nada)";
        int desde = _bitacora.Count, largo = 0;
        while (desde > 0 && largo + _bitacora[desde - 1].Length + 1 <= Math.Max(200, tope)) { largo += _bitacora[desde - 1].Length + 1; desde--; }
        var sb = new StringBuilder();
        if (desde > 0) sb.Append($"(antes de esto, {desde} acción(es) más que ya no se listan)\n");
        for (int i = desde; i < _bitacora.Count; i++) sb.Append(_bitacora[i]).Append('\n');
        return sb.ToString().TrimEnd();
    }

    /// <summary>
    /// QUIEN ACTÚA TERMINÓ SU TURNO: si la meta sigue activa, lo que hay que devolverle para que siga. null si no
    /// toca —no hay meta activa— o si Ü la pausó aquí mismo: pasó el techo, o van dos turnos sin ejecutar nada.
    /// </summary>
    public string? Continuacion()
    {
        lock (_candado)
        {
            if (_estado != EnCurso) return null;
            long minutos = (_relojMs() - _desdeMs) / 60_000;
            _turnosSinAccion = _acciones == _accionesAlContinuar ? _turnosSinAccion + 1 : 0;
            string? techo = _continuaciones >= TopeDeContinuaciones ? $"le devolví el trabajo {TopeDeContinuaciones} veces y la meta sigue sin cerrarse"
                          : minutos >= _minutos ? $"pasaron los {_minutos} minutos que tenía"
                          : _turnosSinAccion >= 2 ? "dos turnos seguidos terminaron sin ejecutar nada: devolverle el trabajo otra vez no lo va a mover"
                          : null;
            if (techo != null)
            {
                _estado = Pausada;
                _porQueSeDetuvo = techo;
                return null;
            }
            _accionesAlContinuar = _acciones;
            _continuaciones++;
            _turnos++;
            return $"""
                {Marca} Sigue trabajando en la meta: terminaste tu turno sin cerrarla, y no está cerrada.

                <objetivo>
                {_objetivo}
                </objetivo>

                {CuentaSinCandado()}.

                LO YA HECHO, en orden:
                {BitacoraSinCandado(TopeDeLaBitacora)}

                CÓMO SEGUIR:
                - La meta sigue ENTERA. No la encojas a lo que cabe ahora ni la des por buena con una parte: si no se puede terminar ya, avanza hacia el estado final que se pidió.
                - Trabaja con lo que HAY: la pantalla y el disco de ahora mandan sobre lo que recuerdes. Mira antes de fiarte de lo anterior.
                - ¿HUBO PROGRESO en el turno que acabas de cerrar? Progreso es que algo cambió en la pantalla o en el disco, o que obtuviste un dato que cambia el siguiente paso. Repetir el estado o planear sin ejecutar no lo es: si no lo hubo, cambia de vía en vez de repetir.
                - ANTES DE DARLA POR CUMPLIDA, AUDÍTALA: saca del objetivo cada cosa pedida y, para cada una, di qué se ve AHORA que la prueba. Lo que no puedas probar no está hecho: sigue trabajando.
                - CIÉRRALA con meta_actualizar: «cumplida» con esa evidencia; «bloqueada» solo si el mismo bloqueo se repite {TurnosParaBloquear} turnos y no puedes avanzar sin la persona; «pausada» solo si ella lo pide. No termines tu turno sin cerrarla o sin haber avanzado.
                """.ReplaceLineEndings("\n");
        }
    }

    /// <summary>
    /// LO QUE VIAJA CON LO QUE DICE LA PERSONA mientras la meta está activa (el «steer» de Codex): quien actúa recibe
    /// el objetivo y lo hecho junto al pedido, y decide si es una corrección, otra cosa, o parar. Vacío sin meta activa.
    /// </summary>
    public string ParaElPedido()
    {
        lock (_candado)
        {
            if (_estado != EnCurso) return "";
            return $"""
                {Marca} Hay una meta en curso, y lo que la persona diga ahora llega con ella delante.

                <objetivo>
                {_objetivo}
                </objetivo>

                {CuentaSinCandado()}.

                LO YA HECHO, en orden:
                {BitacoraSinCandado(TopeDeLaBitacora / 2)}

                QUÉ HACER CON LO QUE DIGA: si es una corrección de la meta, sigue la meta con la corrección, sin empezar de cero; si pide parar o dejarlo, meta_actualizar «pausada»; si es otra cosa, atiéndela y vuelve a la meta. Si solo pregunta cómo va, contesta con lo ya hecho y sigue.
                """.ReplaceLineEndings("\n");
        }
    }

    /// <summary>Apagar la voz deja la meta pausada: nadie va a seguirla, y la sesión siguiente no hereda un trabajo a medias sin saberlo.</summary>
    public void PausarPorque(string motivo)
    {
        lock (_candado)
        {
            if (_estado != EnCurso) return;
            _estado = Pausada;
            _porQueSeDetuvo = (motivo ?? "").Trim();
        }
    }
}
