// Utilidades compartidas por las listas filtrables de la consola.

/**
 * Sanitiza un término de búsqueda antes de meterlo en un filtro `or(...)` de
 * PostgREST.
 *
 * PostgREST parsea el argumento de `or` como una lista separada por comas con
 * paréntesis, y `%`, `*` y `\` son metacaracteres del patrón `ilike`. Sin esto,
 * escribir "(hola" o "a,b" en el buscador no da "sin resultados": rompe el
 * parser y la consulta entera falla con un 400.
 *
 * Vivía duplicado en app/superadmin/consultas/page.tsx. Se centraliza aquí
 * porque es un regex relevante para la seguridad de la consulta: si algún día
 * hay que endurecerlo, debe endurecerse en un solo sitio.
 */
export function sanitizarTermino(termino: string): string {
  return termino.replace(/[%,()*\\]/g, " ").trim();
}

/**
 * Construye un filtro `or` de PostgREST buscando el término en varias columnas.
 * Devuelve null cuando el término queda vacío tras sanitizar, para que quien
 * llama simplemente no aplique filtro.
 */
export function filtroBusqueda(termino: string, columnas: string[]): string | null {
  const limpio = sanitizarTermino(termino);
  if (!limpio) return null;
  return columnas.map((columna) => `${columna}.ilike.%${limpio}%`).join(",");
}
