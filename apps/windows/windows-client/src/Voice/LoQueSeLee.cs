using System.Text;
using System.Text.RegularExpressions;

namespace U.WindowsClient.Voice;

/// <summary>
/// LO QUE SE LEE DE Ü MIENTRAS HABLA: lo que suena, una sola vez (promesa 768, spec 080).
/// </summary>
/// <remarks>
/// POR QUÉ HACE FALTA. Con GPT-Live la misma frase llega dos veces: primero ENTERA, cuando el delegado
/// la escribe (<c>response.output_text.done</c>), y después a trozos, cuando la voz la va diciendo
/// (<c>session.output_transcript.delta</c>). Las dos son un <c>Hecho.DiceU</c>, y sumadas daban lo que
/// quedó en el log del dueño el 2026-10-01: «Ü dijo: ¿Cómo te llamas?¿Cómo te llamas?». En una línea de
/// log se lee; en letras grandes bajo la carita, la primera vez que alguien la ve, no.
///
/// CON AUDIO MANDA LO QUE SUENA: es lo que la persona está oyendo, palabra por palabra, incluida la
/// coletilla que la voz pone delante («Bien, Felipe.»). SIN AUDIO —una respuesta pedida en texto— no
/// hay nada que transcribir, y lo que escribe el delegado es lo único que hay.
///
/// LAS MARCAS NO SE LEEN. La transcripción trae <c>[laugh]</c> o <c>[breath]</c> donde la voz rió o
/// tomó aire (visto con la sonda, 2026-10-01). Son del audio, no del texto.
///
/// No sustituye al acumulado de siempre de <see cref="ConversacionEnVivo"/>, que alimenta el log, el
/// hilo guardado y el paso de abajo: eso es de <c>main</c> y cambiarlo pide su propia promesa.
/// </remarks>
public sealed class LoQueSeLee
{
    private static readonly Regex Marca = new(@"\[[^\[\]]{1,24}\]", RegexOptions.Compiled);
    private static readonly Regex Huecos = new(@"\s{2,}", RegexOptions.Compiled);

    private readonly StringBuilder _texto = new();
    private readonly object _candado = new();

    /// <summary>Recibe un trozo de lo que dice Ü y devuelve lo que se lee hasta ahora.</summary>
    /// <param name="delDelegado">El trozo es la frase escrita por el delegado, no la transcripción de la voz.</param>
    /// <param name="respuestaDeTexto">Esta respuesta no suena: se pidió en texto.</param>
    public string Recibir(string trozo, bool delDelegado, bool respuestaDeTexto)
    {
        lock (_candado)
        {
            if (!string.IsNullOrEmpty(trozo) && delDelegado == respuestaDeTexto) _texto.Append(trozo);
            return Limpio(_texto.ToString());
        }
    }

    /// <summary>El turno se cerró: lo siguiente es otra frase.</summary>
    public void Cerrar()
    {
        lock (_candado) _texto.Clear();
    }

    /// <summary>Sin marcas de audio, sin los huecos que dejan, y con su espacio entre frase y frase.</summary>
    /// <remarks>
    /// La coletilla de la voz y la frase del delegado llegan pegadas: «Vale.¡Hola! ¿Cómo te llamas?»
    /// (medido con la sonda, 2026-10-01). Son dos frases; en pantalla llevan un espacio.
    /// </remarks>
    public static string Limpio(string texto) =>
        Huecos.Replace(Pegadas.Replace(Marca.Replace(texto ?? "", " "), "$1 $2"), " ").Trim();

    private static readonly Regex Pegadas = new(@"([.!?…])([¡¿\p{Lu}])", RegexOptions.Compiled);
}
