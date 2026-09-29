// El disparador "/" para insertar atajos mientras se escribe.
//
// La regla es una sola: la "/" cuenta como disparador solo si empieza palabra
// (está al principio del campo o después de un espacio o un salto de línea).
// Con eso, lo que un médico escribe de verdad no abre la lista por accidente:
// "120/80", "s/p", "mg/dl", una URL. Y cuando sí quiere el atajo, no tiene que
// aprender ninguna combinación rara: escribe "/" y sigue tecleando.

export interface SlashToken {
  /** Lo escrito tras la barra, que es la búsqueda. */
  query: string;
  /** Posición de la "/" — al insertar se reemplaza desde aquí. */
  start: number;
}

/**
 * Más allá de esto ya no es una búsqueda: es una ruta, una dosis o texto
 * normal que empezaba con barra.
 */
const MAX_QUERY = 40;

/**
 * Token de atajo activo bajo el cursor, o null si no lo hay.
 *
 * Puro a propósito: cada caso raro es un test y no hay que reproducirlo a mano
 * en el navegador.
 */
export function slashQueryAt(value: string, caret: number): SlashToken | null {
  if (caret < 0 || caret > value.length) return null;

  for (let i = caret; i > 0; i--) {
    const previous = value[i - 1];
    if (previous === "/") {
      // Debe empezar palabra: nada antes, o un espacio/salto.
      const beforeSlash = i >= 2 ? value[i - 2] : "";
      if (beforeSlash && !/\s/.test(beforeSlash)) return null;
      const query = value.slice(i, caret);
      if (query.length > MAX_QUERY) return null;
      return { query, start: i - 1 };
    }
    // Un espacio cierra el token: la "/" que hubiera más atrás ya no cuenta.
    if (/\s/.test(previous)) return null;
  }

  return null;
}
