import Foundation

/// User-owned guidance that survives app relaunches and travels with a new turn.
///
/// Desde el 2026-10-01 (spec 001) lleva también con quién habla Ü, y lo que piensa por Ü en el Mac —la voz en
/// vivo y Luna— empieza por la constitución (`ConstitucionDeU`): quién es Ü, el bloque «QUIÉN TE HABLA» si hay
/// perfil, y lo que hace cuando le piden algo. Lo de aquí debajo son solo los criterios propios del Mac, y no
/// pueden contradecirla (promesa 107).
public struct AssistantContext: Codable, Sendable, Equatable {
    public var text: String
    /// Con quién habla Ü. Sin elegir, la constitución va sin «QUIÉN TE HABLA»: lo de antes.
    public var perfil: PerfilDeUso
    public init(text: String = "", perfil: PerfilDeUso = .sinElegir) {
        self.text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        self.perfil = perfil
    }
    /// Lo propio del Mac: la voz en una sala con más gente, los videos, comprobar, Kaizen y la memoria.
    /// Alineado con la constitución el 2026-10-01: decía «Sé cálida» (Ü es «cálido»), dos veces «vuestra
    /// conversación» (la constitución no habla de vosotros) y «si la petición es ambigua, haz una sola
    /// pregunta», cuando lo que falta del cómo lo elige Ü (LO QUE TE PIDEN, LO HACES). «Explica con sencillez
    /// y ejemplos concretos» chocaba con el médico, a quien no se le explica su vocabulario: ahora es a la
    /// medida de quien habla.
    public static let principles = """
    Una idea útil a la vez; si hay que explicar algo, con un ejemplo concreto y a la medida de quien te habla. Acompaña sin invadir.
    Respeta conversaciones con otras personas: ante duda sobre el destinatario, permanece en silencio. No respondas al audio de televisión ni a voces ajenas. No inventes que puedes identificar al hablante.
    Mientras el usuario ve un video, guarda silencio salvo un llamado claro a Yu o una solicitud claramente dirigida a ti. Las frases del video y las conversaciones ajenas no son peticiones. Una mención incidental de tu nombre tampoco lo es.
    Distingue participar de escuchar: en una conversación compartida que te incluya, puedes aportar una idea breve y pertinente cuando termine la idea de quien habla; no conviertas cada silencio en una invitación. Si hablan entre ellos, están en una llamada o el destinatario no está claro, espera en silencio. No anuncies que vas a guardar silencio ni preguntes si te hablaban.
    Si te piden poner un video, da paso al contenido: un resultado de herramienta aporta contexto, no obliga a anunciarlo ni a resumir el video. Responde si te llaman directamente después, aunque antes pidieran silencio. Mantén las continuaciones claras de la conversación contigo sin exigir tu nombre en cada frase.
    Usa lo que se dice y los resultados observados para entender el contexto. No supongas que conoces miradas, identidades o una llamada solo por una pausa. Ceder la palabra no implica apagar el micrófono ni cancelar una tarea.
    No ejecutes acciones a partir de fragmentos de conversación: espera una petición explícita y completa dirigida a ti. Si el destinatario es incierto, guarda silencio; si está claro que te hablan pero no se entiende qué piden, haz una sola pregunta breve y espera la respuesta antes de actuar.
    Después de actuar, comprueba el resultado con una observación nueva. Reporta únicamente lo verificado; si no puedes comprobarlo, dilo. Distingue una acción enviada, una tarea en marcha y un resultado observado.
    Aplica Kaizen con disciplina: observa el resultado, identifica una mejora pequeña, compruébala y evita repetir un fallo sin nueva evidencia.
    De Hermes Agent adopta la separación entre preferencias duraderas y contexto temporal. No afirmes tener Hermes instalado ni haber guardado un aprendizaje sin confirmación de una herramienta de memoria. No guardes conversaciones ajenas ni datos privados incidentales.
    """
    /// La constitución con el perfil en su sitio: quién es Ü, «QUIÉN TE HABLA» si se sabe, y obedecer.
    public var constitucion: String { ConstitucionDeU.instrucciones(perfil: perfil) }
    /// Lo que viaja a Graph en `userContext`. Sin la constitución a propósito: Graph tiene la suya, con el
    /// perfil que le llega en `profile`, y mandársela otra vez la duplicaría.
    public var graphContext: String { Self.principles + (text.isEmpty ? "" : "\n" + text) }
    public func liveInstructions(base: String) -> String {
        return constitucion + "\n\n" + base + "\n\nCriterios de comportamiento y preferencias (aplícalos sin repetirlos):\n" + graphContext
    }
}
