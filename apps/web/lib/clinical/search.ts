// Búsqueda de texto para los buscadores clínicos (plantillas y atajos).
//
// POR QUÉ EXISTE. El médico busca con una mano mientras el paciente habla, y
// escribe "pediatria", "Pediatría" o "pedriatria" indistintamente. Un filtro de
// subcadena literal falla en los tres casos menos uno y responde "no
// encontramos nada" teniendo 202 plantillas cargadas, que es peor que no tener
// buscador: parece que el catálogo está vacío.
//
// La estrategia es en dos pasos, y el orden importa:
//   1. Coincidencia normalizada de subcadena. Cubre lo normal y es la que manda:
//      quien escribe bien nunca ve resultados raros colados por parecido.
//   2. Solo si el paso 1 no encontró NADA, coincidencia aproximada por palabra.
//      Así el rescate por error de tecleo no ensucia una búsqueda que ya iba
//      bien.

/** Marcas combinantes de normalize("NFD"). Ver el porqué en lib/clinical/snippets.ts. */
const DIACRITICS = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  "g",
);

/** Minúsculas y sin tildes: "Pediatría" y "pediatria" son la misma búsqueda. */
export function normalizeForSearch(value: string): string {
  return value
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .trim();
}

/** Palabras significativas del texto ya normalizado (descarta "de", "y", "la"...). */
function words(normalized: string): string[] {
  return normalized.split(/[^a-z0-9]+/).filter((word) => word.length > 2);
}

/**
 * Distancia de edición con transposiciones (Damerau-Levenshtein, alineación
 * óptima). Cuenta inserciones, borrados, sustituciones y el intercambio de dos
 * letras contiguas — que es el error de tecleo más común y el que una
 * Levenshtein normal cobra doble.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  // Dos filas bastan salvo por las transposiciones, que necesitan mirar dos
  // atrás: se conservan tres.
  let dosAtras: number[] = [];
  let anterior: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  let actual: number[] = [];

  for (let i = 1; i <= a.length; i++) {
    actual = [i];
    for (let j = 1; j <= b.length; j++) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1;
      let valor = Math.min(
        anterior[j] + 1, // borrado
        actual[j - 1] + 1, // inserción
        anterior[j - 1] + coste, // sustitución
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        valor = Math.min(valor, dosAtras[j - 2] + 1); // transposición
      }
      actual[j] = valor;
    }
    dosAtras = anterior;
    anterior = actual;
  }
  return anterior[b.length];
}

/**
 * Cuántos errores se le perdonan a una palabra según su longitud. Corto = sin
 * margen: con 4 letras, una distancia de 2 ya casa con media lista y el
 * buscador empieza a devolver cualquier cosa.
 */
function tolerancia(longitud: number): number {
  if (longitud <= 4) return 0;
  if (longitud <= 7) return 1;
  return 2;
}

/** ¿Se parecen lo bastante como para dar por buena una palabra mal tecleada? */
export function fuzzyWordMatch(candidata: string, buscada: string): boolean {
  const margen = tolerancia(buscada.length);
  if (margen === 0) return candidata === buscada;
  // Una diferencia de longitud mayor que el margen no puede salvarse con
  // ediciones, y calcular la distancia entera sería tiempo tirado.
  if (Math.abs(candidata.length - buscada.length) > margen) return false;
  return editDistance(candidata, buscada) <= margen;
}

/**
 * ¿Coincide `texto` con lo que se escribió? `exigirTodas` pide que TODAS las
 * palabras de la búsqueda aparezcan (buscar "control niño" no debe traer todo
 * lo que diga solo "control").
 */
export function matchesQuery(texto: string, query: string): boolean {
  const term = normalizeForSearch(query);
  if (!term) return true;

  const heno = normalizeForSearch(texto);
  if (heno.includes(term)) return true;

  const buscadas = words(term);
  if (!buscadas.length) return false;

  const candidatas = words(heno);
  return buscadas.every(
    (buscada) =>
      heno.includes(buscada) ||
      candidatas.some((candidata) => fuzzyWordMatch(candidata, buscada)),
  );
}

/**
 * Filtra una lista en dos pasadas: primero lo que coincide de verdad y, solo si
 * eso queda vacío, lo que se le parece. Devolver ambas mezcladas haría que una
 * búsqueda correcta arrastrara ruido.
 */
export function searchList<T>(
  items: readonly T[],
  query: string,
  textoDe: (item: T) => string,
): T[] {
  const term = normalizeForSearch(query);
  if (!term) return [...items];

  const exactas = items.filter((item) =>
    normalizeForSearch(textoDe(item)).includes(term),
  );
  if (exactas.length) return exactas;

  return items.filter((item) => matchesQuery(textoDe(item), query));
}

/**
 * ¿La categoría de un atajo corresponde a esta sección de la nota?
 *
 * No puede ser igualdad exacta: el atajo se guarda como "Plan" y las plantillas
 * llaman a esa sección "Plan y dosis por peso", "Plan quirúrgico y preparación"
 * o "Plan y educación al cuidador". Con igualdad estricta, los atajos de un
 * pediatra no se priorizaban en ninguna de sus secciones.
 *
 * Basta con que una contenga a la otra, o que compartan una palabra con peso
 * ("diagnostica" en "Análisis e impresión diagnóstica").
 */
export function categoryMatchesSection(category: string, sectionTitle: string): boolean {
  const cat = normalizeForSearch(category);
  const sec = normalizeForSearch(sectionTitle);
  if (!cat || !sec) return false;
  if (cat === sec || sec.includes(cat) || cat.includes(sec)) return true;

  const palabrasSeccion = new Set(words(sec));
  return words(cat).some((palabra) => palabrasSeccion.has(palabra));
}
