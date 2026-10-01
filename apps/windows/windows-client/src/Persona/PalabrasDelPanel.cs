namespace U.WindowsClient.Persona;

/// <summary>
/// LO QUE DICE EL PANEL DE GRABAR, según quién lo use (promesa 756). El mismo panel, el mismo botón y
/// el mismo dibujo; lo que cambia es de qué habla.
/// </summary>
/// <remarks>
/// EN UN SOLO SITIO Y NO REPARTIDAS POR LA VENTANA. El dueño (2026-10-01): «donde dice consultas será
/// clases». Con las frases escritas dentro de la ventana, cambiar una dejaba otra sin cambiar, y a un
/// estudiante le acababa saliendo «ya se ve en el portal». Aquí el contrato las lee todas y falla si a
/// un estudiante le asoma una palabra clínica o a un médico una de clase.
///
/// UNA PROPIEDAD NUEVA TIENE QUE TENER TEXTO PARA LOS DOS: el contrato no admite una vacía.
/// </remarks>
public sealed record PalabrasDelPanel(
    string PestanaDeLaLista,
    string PestanaDeLoGrabado,
    string VacioTitulo,
    string VacioCuerpo,
    string ListaVaciaTitulo,
    string ListaVaciaCuerpo,
    string Abriendo,
    string Guardando,
    string Organizando,
    string Listo,
    string VolvioVacio,
    string FilaSinTitulo)
{
    public static PalabrasDelPanel Para(Rol rol) => rol == Rol.Estudiante ? DeClase : DeConsulta;

    private static readonly PalabrasDelPanel DeConsulta = new(
        PestanaDeLaLista: "Consultas",
        PestanaDeLoGrabado: "Nota",
        VacioTitulo: "Pulsa grabar y habla con normalidad.",
        VacioCuerpo: "Verás aquí lo que se va oyendo. Al parar, la nota queda organizada y guardada "
                   + "en tu cuenta — la misma que ves en el portal.",
        ListaVaciaTitulo: "Todavía no hay consultas.",
        ListaVaciaCuerpo: "La primera que grabes aparece aquí y en el portal.",
        Abriendo: "Abriendo la consulta…",
        Guardando: "Guardando y organizando la nota…",
        Organizando: "Organizando la nota…",
        Listo: "Nota lista. Ya se ve en el portal.",
        VolvioVacio: "La nota volvió vacía.",
        FilaSinTitulo: "Consulta sin motivo anotado");

    private static readonly PalabrasDelPanel DeClase = new(
        PestanaDeLaLista: "Clases",
        PestanaDeLoGrabado: "Apuntes",
        VacioTitulo: "Pulsa grabar cuando empiece la clase.",
        VacioCuerpo: "Verás aquí lo que se va oyendo. Al parar, los apuntes quedan organizados y guardados "
                   + "en tu equipo, y Ü los tiene a mano para ayudarte con tus trabajos.",
        ListaVaciaTitulo: "Todavía no hay clases.",
        ListaVaciaCuerpo: "La primera que grabes aparece aquí, con sus apuntes.",
        Abriendo: "Abriendo el micrófono…",
        Guardando: "Guardando la clase y organizando los apuntes…",
        Organizando: "Organizando los apuntes…",
        Listo: "Apuntes listos. Ü ya puede ayudarte con esta clase.",
        VolvioVacio: "Los apuntes volvieron vacíos.",
        FilaSinTitulo: "Clase sin título");
}
