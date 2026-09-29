// Importación masiva de atajos desde los archivos que el médico ya tiene.
//
// La IA solo PROPONE título y categoría; nada se guarda hasta que el médico
// revisa la lista y pulsa guardar. Si la IA no está disponible, la importación
// sigue funcionando con el nombre del archivo como título: perder las
// sugerencias no puede costarle la importación entera.

/** Una fila de la pantalla de revisión previa a guardar. */
export interface ImportRow {
  tempId: string;
  filename: string;
  title: string;
  category: string;
  content: string;
  /** Archivo que no se pudo leer: se muestra y no se guarda. */
  error?: string;
  include: boolean;
}

/** Lo que devuelve /api/snippets/categorize por cada archivo. */
export interface SnippetSuggestion {
  id: string;
  titulo: string;
  categoria: string;
}

/** Ítems por llamada al modelo. Ver el tope de la ruta. */
export const CATEGORIZE_CHUNK = 25;
/** Recorte del texto que se manda a la IA: para titular sobra con el principio. */
export const CATEGORIZE_TEXT_CHARS = 1500;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) return [items.slice()];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Aplica las sugerencias sobre las filas.
 *
 * Solo toca las filas que existen y que no traen error, e ignora cualquier id
 * que no se haya enviado: la respuesta del modelo no manda sobre la lista.
 */
export function applySuggestions(
  rows: readonly ImportRow[],
  suggestions: readonly SnippetSuggestion[],
): ImportRow[] {
  const byId = new Map(suggestions.map((s) => [s.id, s]));
  return rows.map((row) => {
    const suggestion = byId.get(row.tempId);
    if (!suggestion || row.error) return row;
    const titulo = suggestion.titulo?.trim();
    const categoria = suggestion.categoria?.trim();
    return {
      ...row,
      title: titulo ? titulo : row.title,
      category: categoria ? categoria : row.category,
    };
  });
}

/** Filas listas para guardar: marcadas, sin error y con contenido. */
export function rowsToSave(rows: readonly ImportRow[]) {
  return rows
    .filter((row) => row.include && !row.error && row.content.trim() && row.title.trim())
    .map((row) => ({
      title: row.title,
      content: row.content,
      category: row.category,
    }));
}
