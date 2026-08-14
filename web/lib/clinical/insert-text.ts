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
