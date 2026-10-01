using System.Globalization;
using System.Text;

namespace U.WindowsClient.Cuenta;

/// <summary>
/// EL CATÁLOGO DE ESPECIALIDADES, el mismo del portal: código en kebab-case (el formato de
/// <c>profiles.specialty_code</c>) y nombre con tildes.
/// </summary>
/// <remarks>
/// ES UNA COPIA de <c>apps/web/lib/clinical/specialties.ts</c> (los 49 pares código/nombre, en su
/// orden), hecha el 2026-10-01 para la spec 071. Copia y no import porque la regla 2 del monorepo
/// prohíbe leer archivos de otro proyecto con <c>../</c> y <c>packages/</c> todavía no existe. Si el
/// portal añade una especialidad, se añade aquí también; Graph tiene la suya en
/// <c>src/domain/clinical/specialtyNames.js</c> (en snake_case: la normaliza por su cuenta).
///
/// LO QUE NO ESTÁ EN LA LISTA VALE IGUAL. Enfermería, fisioterapia o nutrición no están en el
/// portal y quien las ejerce también trabaja en salud: <see cref="Buscar"/> le da un código en
/// kebab-case sacado de lo que escribió, y el nombre es el que escribió.
/// </remarks>
public static class Especialidades
{
    /// <summary>Lo más largo que se acepta como nombre escrito a mano: va dentro de un prompt.</summary>
    public const int NombreMaximo = 60;

    /// <summary>Todas, en el orden del portal: «Medicina general» primero.</summary>
    public static readonly (string Codigo, string Nombre)[] Todas =
    {
        ("medicina-general", "Medicina general"),
        ("medicina-familiar", "Medicina familiar"),
        ("medicina-interna", "Medicina interna"),
        ("pediatria", "Pediatría"),
        ("neonatologia", "Neonatología"),
        ("ginecologia-obstetricia", "Ginecología y obstetricia"),
        ("urgencias", "Medicina de urgencias"),
        ("cardiologia", "Cardiología"),
        ("dermatologia", "Dermatología"),
        ("endocrinologia", "Endocrinología"),
        ("gastroenterologia", "Gastroenterología"),
        ("geriatria", "Geriatría"),
        ("hematologia", "Hematología"),
        ("infectologia", "Infectología"),
        ("nefrologia", "Nefrología"),
        ("neumologia", "Neumología"),
        ("neurologia", "Neurología"),
        ("oncologia", "Oncología clínica"),
        ("psiquiatria", "Psiquiatría"),
        ("psicologia", "Psicología clínica"),
        ("reumatologia", "Reumatología"),
        ("alergologia", "Alergología e inmunología"),
        ("dolor-paliativos", "Dolor y cuidados paliativos"),
        ("rehabilitacion", "Medicina física y rehabilitación"),
        ("medicina-laboral", "Medicina laboral"),
        ("medicina-legal", "Medicina legal"),
        ("anestesiologia", "Anestesiología"),
        ("cirugia-general", "Cirugía general"),
        ("cirugia-cardiovascular", "Cirugía cardiovascular"),
        ("cirugia-torax", "Cirugía de tórax"),
        ("cirugia-vascular", "Cirugía vascular"),
        ("neurocirugia", "Neurocirugía"),
        ("cirugia-plastica", "Cirugía plástica"),
        ("cirugia-pediatrica", "Cirugía pediátrica"),
        ("coloproctologia", "Coloproctología"),
        ("ortopedia", "Ortopedia y traumatología"),
        ("oftalmologia", "Oftalmología"),
        ("otorrinolaringologia", "Otorrinolaringología"),
        ("urologia", "Urología"),
        ("cirugia-maxilofacial", "Cirugía oral y maxilofacial"),
        ("radiologia", "Radiología e imágenes diagnósticas"),
        ("patologia", "Patología"),
        ("medicina-nuclear", "Medicina nuclear"),
        ("genetica", "Genética médica"),
        ("odontologia-general", "Odontología general"),
        ("endodoncia", "Endodoncia"),
        ("periodoncia", "Periodoncia"),
        ("ortodoncia", "Ortodoncia"),
        ("rehabilitacion-oral", "Rehabilitación oral"),
    };

    /// <summary>
    /// La especialidad que corresponde a lo escrito o elegido: por nombre o por código, sin
    /// distinguir mayúsculas ni tildes. Si no está en el catálogo, código en kebab-case y el nombre
    /// tal cual (limpio). Vacío → ("", "").
    /// </summary>
    public static (string Codigo, string Nombre) Buscar(string? texto)
    {
        string nombre = Limpiar(texto);
        if (nombre.Length == 0) return ("", "");
        string clave = Clave(nombre);
        foreach (var e in Todas)
        {
            if (Clave(e.Nombre) == clave || e.Codigo == NormalizarCodigo(nombre)) return e;
        }
        return (NormalizarCodigo(nombre), nombre);
    }

    /// <summary>
    /// El nombre de un código: el del catálogo si lo tiene, y si no, el código legible
    /// («terapia-respiratoria» → «Terapia respiratoria»). Vacío si el código es vacío.
    /// </summary>
    public static string NombreDe(string? codigo)
    {
        string c = NormalizarCodigo(codigo);
        if (c.Length == 0) return "";
        foreach (var e in Todas)
            if (e.Codigo == c) return e.Nombre;
        string palabras = c.Replace('-', ' ');
        return char.ToUpperInvariant(palabras[0]) + palabras[1..];
    }

    /// <summary>
    /// Un código en el formato de <c>profiles.specialty_code</c>: minúsculas, sin tildes, y lo que no
    /// sea letra o número pasa a ser un guion («Medicina_General» → «medicina-general»).
    /// </summary>
    public static string NormalizarCodigo(string? texto)
    {
        string sinTildes = SinTildes((texto ?? "").Trim().ToLowerInvariant());
        var sb = new StringBuilder(sinTildes.Length);
        bool guion = false;
        foreach (char ch in sinTildes)
        {
            if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) { sb.Append(ch); guion = false; }
            else if (!guion && sb.Length > 0) { sb.Append('-'); guion = true; }
        }
        return sb.ToString().TrimEnd('-');
    }

    /// <summary>
    /// Un nombre escrito a mano, listo para viajar: sin saltos de línea ni caracteres de control, los
    /// espacios de más juntados en uno y como mucho <see cref="NombreMaximo"/> caracteres.
    /// </summary>
    public static string Limpiar(string? texto)
    {
        var sb = new StringBuilder();
        bool espacio = false;
        foreach (char ch in (texto ?? "").Trim())
        {
            if (char.IsWhiteSpace(ch) || char.IsControl(ch))
            {
                if (!espacio && sb.Length > 0) sb.Append(' ');
                espacio = true;
                continue;
            }
            sb.Append(ch);
            espacio = false;
        }
        string limpio = sb.ToString().Trim();
        return limpio.Length <= NombreMaximo ? limpio : limpio[..NombreMaximo].TrimEnd();
    }

    private static string Clave(string texto) => SinTildes(texto.Trim().ToLowerInvariant());

    private static string SinTildes(string texto)
    {
        var sb = new StringBuilder(texto.Length);
        foreach (char ch in texto.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark) sb.Append(ch);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }
}
