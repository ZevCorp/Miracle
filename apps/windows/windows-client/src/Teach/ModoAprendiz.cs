using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using U.WindowsClient.Diagnostics;
using U.WindowsClient.Mcp;
using Voz.Realtime;

namespace U.WindowsClient.Teach;

/// <summary>
/// CÓMO ES Ü MIENTRAS LE ENSEÑAN. Promesa 138 (spec 009, fase 9).
/// </summary>
/// <remarks>
/// LO QUE PASÓ, 2026-09-03 19:51:47: «voz-viva: llamada recibida: map_scroll». El dueño narraba «vas a
/// hacer scroll hacia abajo» PARA LA GRABACIÓN, y Ü lo tomó por una orden y scrolleó. Antes había
/// intentado tres batches sobre lo que oía. La voz seguía en modo asistente mientras se le enseñaba:
/// la narración se leía como órdenes, y lo que Ü hizo con sus manos no es un paso del humano.
///
/// LA IMAGEN QUE PIDIÓ EL DUEÑO: una persona aprendiendo de otra. Habla muy poco, asiente para que
/// se note que sigue, y solo contesta cuando le hablan a ella. Todo por prompt, sin una regla de
/// código que decida qué frase es orden y cuál es narración — ese juicio es del modelo.
///
/// Y SIN MANOS, que es lo que el prompt solo no garantiza: se le quitan del catálogo las
/// herramientas que mueven la pantalla. Un modelo al que se le dice «no toques» pero se le dejan las
/// manos acaba tocando cuando la frase se parece bastante a una orden — pasó tres veces en dos
/// minutos. Sin la herramienta no hay tentación, y el «no toques» del prompt es para que no lo
/// intente y se frustre, no para impedirlo.
///
/// Lo que SÍ conserva son los ojos: señalar, dónde estoy, qué veo. Un aprendiz mira lo que le
/// señalan, y eso es contexto para la skill.
/// </remarks>
public static class ModoAprendiz
{
    /// <summary>
    /// LO ÚNICO QUE TIENE EL APRENDIZ: mirar, señalar lo que le muestran y callarse. Una LISTA BLANCA
    /// (spec 071, D1, promesa 676): lo que no está aquí no entra, tampoco una herramienta que nazca mañana.
    /// </summary>
    /// <remarks>
    /// ERA UNA LISTA NEGRA DE MANOS, escrita antes de la spec 062, y se le colaron cuatro: map_hacer —con
    /// él el delegado movía la pantalla mientras le enseñaban, aunque el texto le dijera que no tenía forma
    /// de hacerlo— y, con el decisor, map_decidir, map_tramo y map_alto. Es el patrón nº5: una lista de lo
    /// prohibido se queda atrás cada vez que crece el catálogo; una de lo permitido, no.
    ///
    /// Fuera también `map_esto_es`, y no es un descuido: los recuerdos se cuelgan al COMPROBAR, sobre el
    /// elemento que Ü usa de verdad para llegar (promesa 125); guardarlos mientras se enseña, con la voz
    /// decidiendo a qué elemento, es justo el «el modelo elige la identidad» que la 125 prohíbe. Y fuera
    /// `memory_remember`: lo que se narra para la grabación no es un dato de la persona.
    /// </remarks>
    private static readonly HashSet<string> Ojos = new(StringComparer.Ordinal)
    {
        "map_where_am_i", "map_pointing_at", "map_what_i_see", "map_look", "map_look_back", "map_show",
        "map_pointed_trail", "map_recuerdos", "file_where", "file_list", "file_find",
        "memory_recall", "self_mute", "self_hide", "self_close",
    };

    /// <summary>El catálogo del aprendiz: del normal, solo los ojos (y callarse, ocultarse o cerrarse).</summary>
    public static IReadOnlyList<Utensilio> Utensilios(IReadOnlyList<Utensilio> todos) =>
        (todos ?? Array.Empty<Utensilio>()).Where(u => Ojos.Contains(u.Nombre)).ToList();

    public const string Instrucciones = """
        Eres Ü, y ahora mismo te están ENSEÑANDO. Una persona comparte su pantalla contigo y hace una
        tarea delante de ti, contándote lo que hace. Tu trabajo en este rato es UNO: entender. No
        hacer.

        CÓMO TE COMPORTAS, y es exactamente como alguien que aprende de otra persona:

          · No toques nada. En este modo no tienes forma de mover la pantalla, y aunque la tuvieras no la usarías:
            lo que la persona dice —«ahora escribo NWP1», «haz scroll hasta el fondo», «aquí se
            pulsa Triage»— es una EXPLICACIÓN de lo que ella hace, no una orden para ti. No hagas
            nada, no lo intentes, no digas que lo vas a hacer.
          · Habla muy poco. Mientras te explican, asiente con algo corto para que se note que
            sigues: «ajá», «uhum», «entiendo», «sí». Una palabra, no una frase. No resumas lo que
            te acaban de decir, no lo repitas, no lo comentes.
          · Contesta solo cuando te hablen A TI: una pregunta directa («¿me escuchas?», «¿lo
            entiendes?», «¿ves esto?»), o algo que claramente espera respuesta. Ahí sí, corto y al
            grano. Si dudas de si te hablan a ti o están narrando, es narración: asiente y calla.
          · Cuando digan «esto», «aquí», «el que estoy señalando», mira con map_pointing_at para
            saber de qué elemento hablan. Solo mirar: no lo ilumines más de lo que la herramienta
            ilumine sola, y no expliques lo que viste salvo que te lo pregunten.
          · No pidas nada, no propongas nada, no corrijas nada. Si algo no lo entiendes, no
            interrumpas: al final podrás preguntar, ahora no.

        Todo lo que oigas y veas en este rato es lo que después vas a usar para hacer tú la tarea.
        Escuchar bien ahora es lo que hace que después salga bien.
        """;
}
