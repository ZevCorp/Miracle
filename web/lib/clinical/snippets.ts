// Atajos: los textos que el médico guarda para no volver a escribirlos.
//
// Un atajo es texto plano con un título y una categoría libre (en la práctica,
// el nombre de una sección de la nota: "Diagnóstico", "Plan de manejo"). Se
// insertan desde el editor de la nota con un botón o escribiendo "/".
//
// Va en lib/clinical/ y habla directo con Supabase (patrón
// template-preferences): lib/api/clinical.ts es solo para el contrato con el
// backend Graph, que no conoce esta tabla. La RLS de public.user_snippets ya
// filtra por usuario, así que ninguna consulta de aquí necesita un .eq("user_id").

import type { SupabaseClient } from "@supabase/supabase-js";

export interface Snippet {
  id: string;
  title: string;
  content: string;
  category: string;
  updatedAt: string;
}

export interface SnippetDraft {
  title: string;
  content: string;
  category: string;
}

interface SnippetRow {
  id: string;
  title: string;
  content: string;
  category: string | null;
  updated_at: string;
}

/** Límites del contrato, en un solo sitio: SQL, formularios y validación. */
export const SNIPPET_LIMITS = {
  title: 120,
  content: 20_000,
  category: 60,
  /** Tope por médico. Se valida aquí, no en la base (ver la migración). */
  perUser: 1000,
} as const;

const COLUMNS = "id, title, content, category, updated_at";
const TABLE = "user_snippets";
/** Supabase rechaza inserciones enormes en una sola llamada; se parte. */
const INSERT_CHUNK = 50;

export function rowToSnippet(row: SnippetRow): Snippet {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category ?? "",
    updatedAt: row.updated_at,
  };
}

/* ------------------------------------------------------------------ */
/* Validación                                                          */
/* ------------------------------------------------------------------ */

/** Mensaje de error en español, o null si el borrador es guardable. */
export function validateSnippetDraft(draft: SnippetDraft): string | null {
  const title = draft.title.trim();
  const content = draft.content.trim();
  const category = draft.category.trim();
  if (!title) return "Ponle un título al atajo para poder encontrarlo.";
  if (title.length > SNIPPET_LIMITS.title) {
    return `El título no puede pasar de ${SNIPPET_LIMITS.title} caracteres.`;
  }
  if (!content) return "El atajo está vacío. Escribe el texto que quieres insertar.";
  if (content.length > SNIPPET_LIMITS.content) {
    return `El texto no puede pasar de ${SNIPPET_LIMITS.content.toLocaleString("es-CO")} caracteres.`;
  }
  if (category.length > SNIPPET_LIMITS.category) {
    return `La categoría no puede pasar de ${SNIPPET_LIMITS.category} caracteres.`;
  }
  return null;
}

/** Recorta a los límites en vez de rechazar. Para lo que propone la IA. */
export function clampSnippetDraft(draft: SnippetDraft): SnippetDraft {
  return {
    title: draft.title.trim().slice(0, SNIPPET_LIMITS.title),
    content: draft.content.trim().slice(0, SNIPPET_LIMITS.content),
    category: draft.category.trim().slice(0, SNIPPET_LIMITS.category),
  };
}

/* ------------------------------------------------------------------ */
/* Lectura y escritura                                                 */
/* ------------------------------------------------------------------ */

/** Atajos del médico autenticado, el más reciente primero (RLS filtra). */
export async function getSnippets(supabase: SupabaseClient): Promise<Snippet[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToSnippet);
}

export async function countSnippets(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function createSnippet(
  supabase: SupabaseClient,
  draft: SnippetDraft,
): Promise<Snippet> {
  // user_id lo pone el default auth.uid() de la tabla.
  const { data, error } = await supabase
    .from(TABLE)
    .insert(clampSnippetDraft(draft))
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return rowToSnippet(data as SnippetRow);
}

export async function updateSnippet(
  supabase: SupabaseClient,
  id: string,
  draft: SnippetDraft,
): Promise<Snippet> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(clampSnippetDraft(draft))
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return rowToSnippet(data as SnippetRow);
}

export async function deleteSnippet(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

/**
 * Alta masiva (importación de archivos). Se inserta por tandas: si una falla,
 * las anteriores ya quedaron guardadas y el error dice cuántas alcanzaron a
 * entrar — mejor que perder 200 atajos por un fallo en el último.
 */
export async function createSnippets(
  supabase: SupabaseClient,
  drafts: readonly SnippetDraft[],
): Promise<number> {
  let saved = 0;
  for (let i = 0; i < drafts.length; i += INSERT_CHUNK) {
    const chunk = drafts.slice(i, i + INSERT_CHUNK).map(clampSnippetDraft);
    const { error } = await supabase.from(TABLE).insert(chunk);
    if (error) {
      if (saved > 0) {
        throw new Error(
          `Se guardaron ${saved} atajos y el resto falló. Vuelve a intentar con los que faltan.`,
        );
      }
      throw error;
    }
    saved += chunk.length;
  }
  return saved;
}

/* ------------------------------------------------------------------ */
/* Búsqueda y orden (puro, testeable)                                  */
/* ------------------------------------------------------------------ */

/**
 * Normaliza para comparar: minúsculas y sin tildes. Un médico que busca
 * "diagnostico" tiene que encontrar "Diagnóstico".
 */
// Marcas combinantes que deja normalize("NFD") (bloque U+0300–U+036F: el tilde
// de la "ó", la diéresis de la "ü"...). Se construye con fromCharCode en vez de
// escribirlas en un literal: el target es ES2017, que no admite \p{Diacritic},
// y los caracteres combinantes sueltos en el fuente son invisibles y frágiles.
const DIACRITICS = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  "g",
);

export function normalizeForSearch(value: string): string {
  return value
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .trim();
}

function sameText(a: string, b: string): boolean {
  return Boolean(a) && normalizeForSearch(a) === normalizeForSearch(b);
}

/** Categorías existentes, ordenadas alfabéticamente (para chips y datalist). */
export function categoriesFrom(snippets: readonly Snippet[]): string[] {
  const seen = new Map<string, string>();
  for (const snippet of snippets) {
    const category = snippet.category.trim();
    if (!category) continue;
    const key = normalizeForSearch(category);
    if (!seen.has(key)) seen.set(key, category);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Calidad de la coincidencia con el término buscado. Menor es mejor.
 * Sin término todos empatan en 0, y entonces manda el desempate por sección.
 */
function textScore(snippet: Snippet, term: string): number {
  if (!term) return 0;
  const title = normalizeForSearch(snippet.title);
  if (title.startsWith(term)) return 0;
  if (title.includes(term)) return 1;
  if (normalizeForSearch(snippet.category).includes(term)) return 2;
  if (normalizeForSearch(snippet.content).includes(term)) return 3;
  return -1; // no coincide
}

/**
 * Lista visible del popup y del gestor.
 *
 * Orden: primero la calidad de la coincidencia (título por prefijo > título >
 * categoría > contenido) y, a igualdad, los atajos cuya categoría es la sección
 * donde el médico está escribiendo. Así, al abrir el popup sin escribir nada,
 * arriba quedan los de esa sección; y al buscar, manda lo que se parece al
 * término, que es lo que el médico espera.
 */
export function filterSnippets(
  snippets: readonly Snippet[],
  {
    query = "",
    category = null,
    sectionTitle = "",
  }: { query?: string; category?: string | null; sectionTitle?: string } = {},
): Snippet[] {
  const term = normalizeForSearch(query);
  const scored: { snippet: Snippet; score: number }[] = [];

  for (const snippet of snippets) {
    if (category && !sameText(snippet.category, category)) continue;
    const text = textScore(snippet, term);
    if (text < 0) continue;
    const sameSection = sectionTitle
      ? sameText(snippet.category, sectionTitle)
      : false;
    scored.push({ snippet, score: text * 2 + (sameSection ? 0 : 1) });
  }

  return scored
    .sort(
      (a, b) =>
        a.score - b.score ||
        b.snippet.updatedAt.localeCompare(a.snippet.updatedAt) ||
        a.snippet.title.localeCompare(b.snippet.title, "es"),
    )
    .map((entry) => entry.snippet);
}
