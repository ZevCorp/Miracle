using System.Text;

namespace U.WindowsClient.Persona;

/// <summary>
/// EL ALMA: lo que la voz sabe de la persona antes de que diga la primera palabra. Sale del perfil del
/// primer encuentro y se añade a las instrucciones de cada sesión (promesa 754).
/// </summary>
/// <remarks>
/// NO ES LA MEMORIA PERSONAL. La memoria es una lista que crece con lo que se va contando y se
/// consulta; esto es poco, fijo y va siempre: cómo se llama, para qué usa Ü, cómo quiere que le
/// hablen. Por eso vive en el perfil y no en la lista — no depende de con qué identidad se guardó, y
/// sigue ahí cuando un médico inicia sesión y su identidad pasa a ser su correo.
///
/// CADA ROL OYE SOLO LO SUYO. El alma de un estudiante no nombra consultas ni la de un médico clases:
/// si el modelo no lo lee, no lo ofrece.
/// </remarks>
public static class Alma
{
    /// <summary>El bloque para las instrucciones. Vacío mientras el encuentro no haya terminado.</summary>
    public static string Componer(Perfil perfil)
    {
        if (perfil is not { Conocido: true } || string.IsNullOrWhiteSpace(perfil.Nombre)) return "";

        var sb = new StringBuilder();
        sb.Append("QUIÉN ES LA PERSONA CON LA QUE HABLAS (te lo contó al conocerse; no se lo recites, úsalo):\n");
        sb.Append("- Se llama ").Append(perfil.Nombre.Trim())
          .Append(". Llámale por su nombre de vez en cuando, no en cada frase.\n");

        switch (perfil.Rol)
        {
            case Rol.Estudiante:
                sb.Append("- Es estudiante. Tu trabajo es ayudarle a aprender y a sacar adelante sus trabajos: explicar, "
                        + "repasar, ordenar ideas y apoyarte en lo que se grabó en sus clases. Explica como un buen "
                        + "compañero que ya entendió el tema, no como un manual.\n");
                break;
            case Rol.Medico:
                sb.Append("- Es médico. Tu trabajo es quitarle carga: sus consultas, sus notas y lo que hay que escribir "
                        + "en la historia clínica. Habla como a un colega ocupado: al grano y sin adornos.\n");
                break;
        }

        if (!string.IsNullOrWhiteSpace(perfil.Trato))
            sb.Append("- Cómo quiere que le hables: ").Append(perfil.Trato.Trim().TrimEnd('.')).Append(".\n");

        var gustos = perfil.Gustos.Where(g => !string.IsNullOrWhiteSpace(g)).Select(g => g.Trim()).ToList();
        if (gustos.Count > 0)
            sb.Append("- Lo que le gusta: ").Append(string.Join("; ", gustos))
              .Append(". Úsalo para poner ejemplos cercanos cuando venga a cuento, sin forzarlo.\n");

        return sb.ToString().TrimEnd();
    }
}
