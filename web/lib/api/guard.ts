import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Guardas compartidas de las rutas /api/*. El proxy solo protege las páginas
 * (/app, /superadmin, /onboarding); estas rutas deben validar la sesión por
 * su cuenta antes de tocar servicios externos que cuestan dinero.
 */

/** Devuelve el id del usuario autenticado, o null si no hay sesión válida. */
export async function requireApiUser(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string" || !userId) return null;
  return userId;
}

// Límite simple por usuario y ruta, en memoria de la instancia. No sustituye
// un rate limit distribuido, pero corta el abuso básico sin infraestructura.
const WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number): boolean {
  const now = Date.now();

  if (buckets.size > 5_000) {
    for (const [k, b] of buckets) {
      if (now > b.reset) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.reset) {
    buckets.set(key, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}
