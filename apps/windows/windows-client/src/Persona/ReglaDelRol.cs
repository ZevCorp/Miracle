using Voz.Realtime;

namespace U.WindowsClient.Persona;

/// <summary>
/// Lo que Ü puede hacer por alguien y que NO es de todos. Cada una es de un solo rol.
/// </summary>
/// <remarks>
/// Añadir una aquí obliga a decir de quién es en <see cref="ReglaDelRol.Puede"/>: el contrato recorre
/// el enum entero y falla si alguna queda para los dos o para ninguno (promesa 755).
/// </remarks>
public enum Capacidad
{
    /// <summary>Grabar una consulta médico-paciente y organizar su nota.</summary>
    GrabarConsultas,
    /// <summary>La cuenta de Miracle con correo y contraseña, la misma del portal.</summary>
    CuentaClinica,
    /// <summary>Subir fotos de estudios de cardiología y leerlas.</summary>
    EstudiosDeCardiologia,
    /// <summary>Preguntar al backend si hay una nota que exportar a la historia clínica.</summary>
    ExportarAHistoriaClinica,
    /// <summary>Escribir en los campos de SAP.</summary>
    EscribirEnSap,
    /// <summary>El icono «Miracle Consulta» en el escritorio.</summary>
    AccesoDirectoDeConsulta,
    /// <summary>Grabar una clase y organizar sus apuntes.</summary>
    GrabarClases,
}

/// <summary>
/// QUIÉN VE QUÉ, en un solo sitio (promesa 755).
/// </summary>
/// <remarks>
/// POR QUÉ EXISTE. Hasta el 2026-10-01 el cliente no sabía quién lo usaba: ocho sitios encendían cosas
/// de médico sin mirarlo —el acceso directo de la consulta en tres ganchos del instalador, el vigía de
/// cardiología, el rellenador de SAP con sus dos puentes y el sondeo de exportaciones cada tres
/// segundos—. Con un segundo tipo de persona, «esconder el botón» no separa nada: el sondeo seguiría
/// corriendo en el computador de un estudiante. Lo que separa es que cada uno de esos sitios pregunte
/// aquí antes de encenderse.
///
/// SIN ELEGIR NO HAY NADA DE NINGUNO, y no es un descuido: quien todavía no dijo qué es no recibe ni
/// lo clínico ni las clases. Médico no es el valor por defecto.
/// </remarks>
public static class ReglaDelRol
{
    public static bool Puede(Rol rol, Capacidad capacidad) => capacidad switch
    {
        Capacidad.GrabarConsultas
            or Capacidad.CuentaClinica
            or Capacidad.EstudiosDeCardiologia
            or Capacidad.ExportarAHistoriaClinica
            or Capacidad.EscribirEnSap
            or Capacidad.AccesoDirectoDeConsulta => rol == Rol.Medico,
        Capacidad.GrabarClases => rol == Rol.Estudiante,
        _ => false,
    };

    /// <summary>
    /// El rol con el que arranca esta instalación. El perfil conocido manda; sin él, una instalación
    /// que ya tenía correo o sesión de médico sigue siendo de médico — eran las únicas que había.
    /// </summary>
    public static Rol Efectivo(Perfil perfil, bool hayIdentidadPrevia)
    {
        if (perfil is { Conocido: true } && perfil.Rol != Rol.SinElegir) return perfil.Rol;
        return hayIdentidadPrevia ? Rol.Medico : Rol.SinElegir;
    }
}

/// <summary>
/// Las herramientas de la voz que son de la persona y no de todos (promesa 759). El catálogo de
/// siempre no se toca: estas van detrás.
/// </summary>
public static class HerramientasDelRol
{
    /// <param name="enEncuentro">Mientras dura el primer encuentro solo existen las de conocerse.</param>
    public static IReadOnlyList<Utensilio> Para(Rol rol, bool enEncuentro)
    {
        if (enEncuentro) return PrimerEncuentro.Herramientas;
        return rol == Rol.Estudiante ? Clases.ClasesParaLaVoz.Herramientas : Array.Empty<Utensilio>();
    }

    /// <summary>¿Es una de las de la persona? Para despacharla fuera del mapa de pantallas.</summary>
    public static bool Es(string nombre) =>
        nombre is PrimerEncuentro.HerramientaGuardar or PrimerEncuentro.HerramientaTerminar
            or Clases.ClasesParaLaVoz.HerramientaLeer;
}
