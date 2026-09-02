/**
 * Qué quiso decir el médico al dictarle a una sección de la nota.
 *
 * DOS COSAS MUY DISTINTAS SE DICEN POR EL MISMO MICRÓFONO:
 *
 *   1. Una INSTRUCCIÓN sobre la sección: "hazla más corta", "ordena esto por
 *      fechas", "quita la parte del examen físico". Eso lo resuelve el modelo,
 *      que reescribe la sección respetando lo que ya había.
 *
 *   2. Un DICTADO LITERAL: "quiero que diga esto: control en ocho días". Aquí
 *      el médico no pide una reescritura, está diciendo el texto. Va tal cual,
 *      sin que nadie lo interprete ni lo mejore.
 *
 * POR QUÉ IMPORTA LA DIFERENCIA (y no es solo comodidad)
 * El endpoint de ajuste de nota lleva en su prompt "PROHIBIDO agregar datos
 * clínicos nuevos (síntomas, hallazgos, medicamentos, diagnósticos, valores)" y
 * "si la instrucción exige inventar información, no lo hagas". Esa guarda es
 * buena —protege contra un modelo que se inventa cosas—, pero convierte en
 * imposible lo más útil del micrófono: que el médico AÑADA algo que no se dijo
 * en voz alta. Pedirle "agrega que el paciente niega fiebre" devolvía la
 * sección intacta.
 *
 * El modo literal esquiva eso por la vía correcta: no es el modelo quien añade
 * el dato, es el médico quien lo escribe. No hay nada que inventar, así que no
 * hay nada que prohibir. Y de paso es instantáneo y no cuesta una llamada.
 *
 * Y HAY UNA TERCERA COSA, a medio camino: "agrega que el paciente niega
 * fiebre". No es una instrucción sobre lo que ya había (no hay nada que
 * reescribir) ni un texto para copiar tal cual ("el paciente niega fiebre"
 * colgando de la nada queda mal). Es un DICTADO: el médico aporta un dato y
 * quiere que quede redactado dentro de la sección. Va al modelo en modo
 * `dictation`, donde el backend lo integra exactamente y lo marca con
 * evidencia «[dictado del médico]»: el modelo redacta, no inventa.
 *
 * CÓMO SE ELIGE EL MODO: lo elige el médico al hablar. Si anuncia el texto
 * ("quiero que diga…", "textualmente…", "anota esto…"), es literal. Si aporta
 * un dato ("agrega que…", "anota que…"), es dictado. Cualquier otra cosa es
 * una instrucción. La regla se aprende sola.
 */

export type VoiceInstruction =
  | { modo: "literal"; texto: string }
  | { modo: "dictado"; texto: string }
  | { modo: "ajuste"; instruccion: string };

/**
 * "Quiero que diga X", "que quede X", "agrega que diga X".
 *
 * El verbo tiene que ser de DECIR ("diga", "quede", "se lea"). Así
 * "agrega que el paciente niega fiebre" NO cae aquí —después de "que" viene
 * "el", no un verbo de decir— y se va al modelo, que es donde debe ir.
 */
const ANUNCIA_TEXTO =
  /^\s*(?:quiero|necesito|quisiera|agrega|agregue|a[ñn]ade|escribe|escriba|anota|anote|pon|ponga|coloca|coloque)?\s*que\s+(?:diga|digas|diga\s+as[ií]|quede|quede\s+as[ií]|se\s+lea)\s*(?:esto|lo\s+siguiente|as[ií])?\s*[:,]?\s+(.+)$/i;

/** "Textualmente X", "escribe literal X", "tal cual X". */
const MARCA_LITERAL =
  /^\s*(?:escribe|escriba|anota|anote|pon|ponga|coloca|coloque|agrega|agregue|a[ñn]ade|dicta|dicte)?\s*(?:esto\s+)?(?:textualmente|textual|literalmente|literal|tal\s+cual)\s*[:,]?\s+(.+)$/i;

/** "Escribe esto: X", "anota lo siguiente: X". */
const ANUNCIA_ESTO =
  /^\s*(?:escribe|escriba|anota|anote|pon|ponga|coloca|coloque|agrega|agregue|a[ñn]ade)\s+(?:esto|lo\s+siguiente)\s*[:,]?\s+(.+)$/i;

const PATRONES_LITERALES = [ANUNCIA_TEXTO, MARCA_LITERAL, ANUNCIA_ESTO];

/**
 * "Agrega que el paciente niega fiebre", "anota que trae exámenes".
 *
 * Verbo de añadir + "que" + un dato (no un verbo de decir: eso ya lo atrapó
 * ANUNCIA_TEXTO antes). Se evalúa DESPUÉS de los patrones literales para que
 * "agrega que diga: X" siga siendo literal.
 */
const DICTA_DATO =
  /^\s*(?:agrega|agregue|a[ñn]ade|a[ñn]ada|anota|anote|pon|ponga|escribe|escriba|incluye|incluya|registra|registre|consigna|consigne)\s+que\s+(?!diga|digas|quede|se\s+lea)(.+)$/i;

/**
 * Lee el dictado y decide qué hacer con él.
 *
 * Devuelve `null` cuando no hay nada utilizable: el micrófono a veces entrega
 * cadena vacía o solo espacios, y eso no debe disparar ni una llamada al
 * modelo ni una escritura en la nota.
 */
export function parseVoiceInstruction(dictado: string | null | undefined): VoiceInstruction | null {
  const limpio = (dictado ?? "").trim();
  if (!limpio) return null;

  for (const patron of PATRONES_LITERALES) {
    const texto = patron.exec(limpio)?.[1]?.trim();
    // Un anuncio sin texto detrás ("quiero que diga…" y nada más) no es un
    // dictado literal vacío: es una frase a medias. Se trata como instrucción
    // y que el modelo diga que no entendió, en vez de borrar la sección.
    if (texto) return { modo: "literal", texto };
  }

  const dato = DICTA_DATO.exec(limpio)?.[1]?.trim();
  if (dato) return { modo: "dictado", texto: dato };

  return { modo: "ajuste", instruccion: limpio };
}

/**
 * Frases con las que el generador rellena una sección de la que no se habló.
 * Cuentan como vacío: si el médico dicta encima, sustituyen en vez de sumarse
 * ("No referido en la consulta. Control en ocho días." no lo quiere nadie).
 *
 * Se compara por prefijo y sin tildes, que es como se comparan los rellenos en
 * lib/clinical/patient-identity.ts: el modelo varía la frase ("No referido.",
 * "No mencionado en la consulta.") y una lista exacta nunca acierta con todas.
 */
const RELLENO_DE_SECCION =
  /^(?:no\s+(?:referid|mencionad|document|registrad|consignad|explorad|interrogad|evaluad|realizad)|sin\s+(?:dato|informaci|hallazg)|no\s+se\s+(?:menciona|refiere|document|registra|interrog)|pendiente)/;

/** `true` si lo que hay en la sección es una frase de relleno, no contenido. */
export function esRellenoDeSeccion(contenido: string | null | undefined): boolean {
  const limpio = (contenido ?? "").trim();
  if (!limpio) return true;
  const llave = limpio
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return RELLENO_DE_SECCION.test(llave);
}

/**
 * Contenido de la sección después de un dictado literal.
 *
 * Sustituye cuando lo que había era relleno —una sección "vacía" de verdad— y
 * añade al final cuando ya había contenido clínico. Nunca borra lo que el
 * médico o el generador ya habían puesto: si dictó de más, lo edita a mano;
 * si le hubiéramos borrado la sección, no habría vuelta atrás.
 */
export function aplicarDictadoLiteral(
  contenidoActual: string | null | undefined,
  dictado: string,
): string {
  const texto = dictado.trim();
  if (!texto) return contenidoActual ?? "";
  if (esRellenoDeSeccion(contenidoActual)) return texto;
  const actual = (contenidoActual ?? "").trimEnd();
  // Se respeta la puntuación que traiga: solo se garantiza la separación.
  const separador = /[.:;!?]$/.test(actual) ? " " : ". ";
  return `${actual}${separador}${texto}`;
}
