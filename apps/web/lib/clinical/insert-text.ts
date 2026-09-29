// Inserción de texto en el editor de la nota.
//
// Regla del producto: insertar SIEMPRE SUMA. Nunca reemplaza lo que el médico
// ya escribió, salvo que él mismo tenga texto seleccionado (que es lo que una
// selección significa en cualquier editor).

export interface InsertResult {
  /** Contenido resultante del campo. */
  next: string;
  /** Inicio del texto insertado (sin contar el salto de línea de cortesía). */
  selStart: number;
  /** Fin del texto insertado. */
  selEnd: number;
}

/**
 * Inserta `text` reemplazando el rango [start, end) del campo.
 *
 * Si justo antes del punto de inserción hay un carácter que no es espacio, se
 * antepone un salto de línea: un diagnóstico de varias líneas pegado al final
 * de una frase a medio escribir no es lo que nadie quiere, y es el caso más
 * frecuente (el médico toca el campo, el cursor cae donde caiga, y pulsa el
 * atajo). Con el cursor ya en una línea vacía no se toca nada.
 */
export function insertSnippetText(
  value: string,
  start: number,
  end: number,
  text: string,
): InsertResult {
  const from = Math.max(0, Math.min(start, value.length));
  const to = Math.max(from, Math.min(end, value.length));
  const before = value.slice(0, from);
  const after = value.slice(to);
  const separator = before && !/\s$/.test(before) ? "\n" : "";
  const inserted = separator + text;
  return {
    next: before + inserted + after,
    selStart: from + separator.length,
    selEnd: from + inserted.length,
  };
}

/** Añade al final del campo. Es el caso de la sección en modo lectura. */
export function appendSnippetText(value: string, text: string): InsertResult {
  return insertSnippetText(value, value.length, value.length, text);
}

// Viñetas y numeración al principio de una línea: "-", "*", "•", "1.", "2)".
const BULLET = /^\s*(?:[-*•·]|\d+[.)])\s+/;

/**
 * Convierte un atajo en puntos sueltos, para las secciones que se editan como
 * lista (Recomendaciones, Signos de alarma). Cada línea es un punto y se le
 * quita la viñeta: la lista ya pinta la suya.
 */
export function snippetToListItems(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.replace(BULLET, "").trim())
    .filter(Boolean);
}

/**
 * ¿Dónde debe quedar el cursor cuando entra un segmento dictado?
 *
 * El médico puede corregir la transcripción mientras sigue dictando, y el
 * dictado siempre agrega AL FINAL. Pero el textarea es controlado: cada vez que
 * cambia `value`, el navegador manda el cursor al final, y al médico se le
 * salta de donde estaba escribiendo. Por eso el campo estaba bloqueado durante
 * la grabación.
 *
 * La regla tiene dos casos, y la diferencia importa:
 *
 * - El cursor estaba AL FINAL → devuelve `null`: que siga al final, pegado a lo
 *   que se acaba de dictar. Es lo que espera quien va escribiendo a la par.
 * - El cursor estaba ANTES del final → devuelve los mismos desplazamientos.
 *   Como lo dictado entra después, esos desplazamientos siguen apuntando al
 *   mismo carácter y el médico no se entera de que algo se agregó abajo.
 *
 * `lengthBefore` es el largo del texto ANTES de agregar el segmento.
 */
export function caretAfterDictation(
  caret: { start: number; end: number },
  lengthBefore: number,
): { start: number; end: number } | null {
  if (caret.start >= lengthBefore && caret.end >= lengthBefore) return null;
  return { start: Math.max(0, caret.start), end: Math.max(0, caret.end) };
}

/**
 * Margen, en pixeles, para dar por bueno que el cuadro esta mirando el final.
 *
 * Una linea de holgura, por dos razones. La primera es humana: el medico no
 * deja el scroll clavado al pixel. La segunda es que NO PUEDE SER 0 aunque se
 * quisiera: el navegador trabaja en subpixeles y, con el cuadro pegado al
 * fondo, la distancia medida da valores fraccionarios (-0,33 px en la prueba
 * sobre Chrome), no un cero exacto.
 */
export const MARGEN_FONDO_PX = 28;

/**
 * ¿Debe el cuadro de la transcripcion bajar solo cuando entra un segmento?
 *
 * Un cuadro que se escribe solo y no baja obliga a arrastrar la barra cada pocos
 * segundos para ver lo ultimo, que es justo lo que el dictado venia a evitar.
 * Pero bajar SIEMPRE es peor de otra forma:
 *
 * - Si el medico se subio a releer algo, arrastrarlo al fondo cada dos segundos
 *   hace imposible leer.
 * - Si esta corrigiendo a mitad del texto, moverle la vista le esconde lo que
 *   esta escribiendo.
 *
 * Asi que sigue el final solo mientras ya lo estuviera mirando. Es la misma
 * regla de cualquier consola o chat que se autodesplaza.
 */
export function shouldFollowDictation(
  view: { scrollTop: number; scrollHeight: number; clientHeight: number },
  corrigiendoAtras: boolean,
): boolean {
  if (corrigiendoAtras) return false;
  const distanciaAlFondo = view.scrollHeight - view.scrollTop - view.clientHeight;
  return distanciaAlFondo <= MARGEN_FONDO_PX;
}
