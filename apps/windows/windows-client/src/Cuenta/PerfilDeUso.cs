using U.WindowsClient.Domain;
using U.WindowsClient.Voice;

namespace U.WindowsClient.Cuenta;

/// <summary>
/// CON QUIÉN HABLA Ü EN ESTE EQUIPO: un médico (con su especialidad), una persona en su día a día,
/// o todavía nadie lo dijo. Es puro: no lee disco ni red, y por eso el contrato lo juzga entero
/// (spec 078, promesas 700, 701 y 709).
/// </summary>
/// <remarks>
/// NACE DE LO QUE PIDIÓ EL DUEÑO el 2026-10-01: que Ü pregunte al empezar si quien lo usa es médico
/// o lo usa para su día a día, y que cada uno tenga sus prompts. Hasta hoy Ü le hablaba a todo el
/// mundo como a un médico de SAP.
///
/// LA REGLA ES LA DE LA PROMESA 98: SI HAY MÉDICO, MANDA EL MÉDICO. Quien entró con su cuenta
/// Miracle es médico aunque en este equipo se haya elegido otra cosa, y su especialidad es la de su
/// cuenta (<c>profiles.specialty_code</c>). Sin cuenta, manda lo que la persona eligió en la
/// bienvenida. Y lo que nunca se eligió es <see cref="SinElegir"/>, que se comporta EXACTAMENTE como
/// la Ü de antes: no viaja nada a Graph y la voz no cambia. Esa es la red para desplegar por partes.
///
/// Lo que sale de aquí son textos y un registro para el cable, nunca decisiones de la ventana: la
/// ventana es nivel 4 y esto no.
/// </remarks>
public sealed record PerfilDeUso(
    string Tipo,
    string Especialidad,
    string EspecialidadNombre,
    string Nombre,
    string Origen)
{
    /// <summary>El valor de <c>Config.Perfil</c> y de <c>profile.kind</c> para un médico.</summary>
    public const string Medico = "medico";

    /// <summary>El valor de <c>Config.Perfil</c> y de <c>profile.kind</c> para el uso personal.</summary>
    public const string Persona = "persona";

    /// <summary>Nadie lo dijo todavía: lo de antes, byte a byte.</summary>
    public static readonly PerfilDeUso SinElegir = new("", "", "", "", "sin elegir");

    public bool EsMedico => Tipo == Medico;
    public bool EsPersona => Tipo == Persona;

    /// <summary>
    /// Lo que la persona dijo, en su forma canónica: «Médico», «médica » y «MEDICO» son
    /// <see cref="Medico"/>; «Persona» es <see cref="Persona"/>; cualquier otra cosa —también un
    /// valor de una versión futura que esta no conoce— es <c>""</c>, «sin elegir», y no un perfil
    /// por defecto: adivinar le hablaría a un médico como a un paciente, o al revés.
    /// </summary>
    public static string Normalizar(string? tipo) => Especialidades.NormalizarCodigo(tipo) switch
    {
        "medico" or "medica" => Medico,
        "persona" => Persona,
        _ => "",
    };

    /// <summary>
    /// El perfil de esta sesión de Ü, de lo que dice la cuenta y lo que se eligió en el equipo.
    /// </summary>
    /// <param name="hayMedico">Si <see cref="SesionMiracle.HayMedico"/> es cierto.</param>
    /// <param name="espCuenta">El <c>specialty_code</c> de la cuenta (vacío si no tiene).</param>
    /// <param name="nomEspCuenta">El <c>specialty_name</c> de la cuenta.</param>
    /// <param name="elegido">El <c>Config.Perfil</c>, tal cual se guardó.</param>
    /// <param name="espElegida">El <c>Config.Especialidad</c>.</param>
    /// <param name="nomEspElegida">El <c>Config.EspecialidadNombre</c>.</param>
    /// <param name="nombre">Cómo se llama la persona, para el saludo. Puede ir vacío.</param>
    public static PerfilDeUso Resolver(bool hayMedico, string? espCuenta, string? nomEspCuenta,
        string? elegido, string? espElegida, string? nomEspElegida, string? nombre)
    {
        string tipo = Normalizar(elegido);
        string quien = Especialidades.Limpiar(nombre);

        // 1. Con médico dentro manda la cuenta. Su especialidad, si la tiene; si no, la que se
        //    eligió aquí como médico; y si tampoco, sin especialidad. Nunca la de una persona: una
        //    especialidad guardada de cuando el equipo era «persona» no es de este médico.
        if (hayMedico)
        {
            var esp = LaEspecialidad(espCuenta, nomEspCuenta);
            if (esp.Codigo.Length == 0 && tipo == Medico) esp = LaEspecialidad(espElegida, nomEspElegida);
            return new PerfilDeUso(Medico, esp.Codigo, esp.Nombre, quien, "cuenta Miracle");
        }

        // 2. Sin cuenta, lo elegido.
        if (tipo == Medico)
        {
            var esp = LaEspecialidad(espElegida, nomEspElegida);
            return new PerfilDeUso(Medico, esp.Codigo, esp.Nombre, quien, "elegido");
        }

        // 3. Una persona no tiene especialidad, aunque quede una vieja guardada en config.json.
        if (tipo == Persona) return new PerfilDeUso(Persona, "", "", quien, "elegido");

        // 4. Nadie lo dijo: lo de antes.
        return SinElegir;
    }

    /// <summary>
    /// Lo que viaja a Graph en <c>profile</c> (<c>/api/v1/agent/turn</c>, <c>/teach/process-video</c>,
    /// <c>/teach/interpret-steps</c>). <c>null</c> sin elegir: el campo no viaja y Graph se porta
    /// como siempre.
    /// </summary>
    public PerfilEnElCable? ParaElCable() => Tipo.Length == 0
        ? null
        : new PerfilEnElCable(Tipo, EsMedico ? Especialidad : "", EsMedico ? EspecialidadNombre : "");

    /// <summary>
    /// El bloque «QUIÉN TE HABLA» para el delegado de la voz, con el salto de párrafo delante para ir
    /// pegado detrás de las instrucciones: <c>"\n\nQUIÉN TE HABLA: …"</c>. Sale de la constitución
    /// (<see cref="ConstitucionDeU.PerfilMedico"/>, <see cref="ConstitucionDeU.PerfilPersona"/>), la
    /// misma que lee Graph. Vacío sin elegir, para que la apertura sea la de siempre.
    /// </summary>
    public string ParaElDelegado()
    {
        if (EsMedico)
            return "\n\n" + ConstitucionDeU.PerfilMedico.Replace("{ESPECIALIDAD}",
                EspecialidadNombre.Length > 0 ? ", especialista en " + EspecialidadNombre : "");
        if (EsPersona) return "\n\n" + ConstitucionDeU.PerfilPersona;
        return "";
    }

    /// <summary>
    /// La frase que se suma a la persona corta de la voz (GPT-Live), que es la que se oye. Empieza
    /// con un espacio porque va pegada detrás de la base. Vacía sin elegir.
    /// </summary>
    public string ParaLaVoz()
    {
        if (EsMedico)
            return ConstitucionDeU.VozMedico.Replace("{ESPECIALIDAD_CORTA}",
                EspecialidadNombre.Length > 0 ? " de " + EspecialidadNombre : "");
        if (EsPersona) return ConstitucionDeU.VozPersona;
        return "";
    }

    /// <summary>Cómo se ve en el menú de la carita: «Médico · Cardiología», «Uso personal», «Sin elegir».</summary>
    public string ParaElMenu() => EsMedico
        ? (EspecialidadNombre.Length > 0 ? "Médico · " + EspecialidadNombre : "Médico")
        : EsPersona ? "Uso personal" : "Sin elegir";

    /// <summary>Para el log: «médico · Cardiología (cardiologia) · cuenta Miracle».</summary>
    public string Describir()
    {
        if (Tipo.Length == 0) return "sin elegir";
        string quien = EsMedico ? "médico" : "persona";
        string esp = EspecialidadNombre.Length > 0 ? $" · {EspecialidadNombre} ({Especialidad})" : "";
        return $"{quien}{esp} · {Origen}";
    }

    /// <summary>Código y nombre limpios; si solo hay nombre, se busca en el catálogo.</summary>
    private static (string Codigo, string Nombre) LaEspecialidad(string? codigo, string? nombre)
    {
        string c = Especialidades.NormalizarCodigo(codigo);
        string n = Especialidades.Limpiar(nombre);
        if (c.Length > 0) return (c, n.Length > 0 ? n : Especialidades.NombreDe(c));
        if (n.Length > 0) return Especialidades.Buscar(n);
        return ("", "");
    }
}
