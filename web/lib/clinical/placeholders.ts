// Huecos por rellenar dentro de un atajo.
//
// Un atajo casi nunca está listo del todo: "Amoxicilina [dosis] cada
// [frecuencia] por ___ días". Al insertarlo se selecciona el primer hueco y
// con Tab se salta al siguiente, para que el médico solo teclee lo que cambia.
//
// Se reconocen dos formas, que son las que la gente ya usa en sus documentos:
//   ___   tres o más guiones bajos seguidos
//   [algo]  un texto corto entre corchetes
//
// Deliberadamente NO se reconoce "..." ni "XXX": aparecen en texto clínico
// normal y convertirlos en huecos sería peor que no tener la función.

export interface Placeholder {
  start: number;
  end: number;
}

const PATTERN = /_{3,}|\[[^[\]\n]{1,40}\]/g;

export function findPlaceholders(text: string): Placeholder[] {
  const found: Placeholder[] = [];
  // El regex es global y con estado: se usa una copia por llamada.
  const scanner = new RegExp(PATTERN.source, "g");
  let match = scanner.exec(text);
  while (match) {
    found.push({ start: match.index, end: match.index + match[0].length });
    match = scanner.exec(text);
  }
  return found;
}

/** Primer hueco que empieza en `from` o después. */
export function nextPlaceholderAfter(text: string, from: number): Placeholder | null {
  return findPlaceholders(text).find((hueco) => hueco.start >= from) ?? null;
}

/**
 * Primer hueco contenido en el rango [start, end). Sirve para saltar al primer
 * hueco de lo que se acaba de insertar, sin tocar los que ya hubiera antes en
 * el campo.
 */
export function firstPlaceholderIn(
  text: string,
  start: number,
  end: number,
): Placeholder | null {
  return (
    findPlaceholders(text).find(
      (hueco) => hueco.start >= start && hueco.end <= end,
    ) ?? null
  );
}
