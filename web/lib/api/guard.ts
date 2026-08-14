import "server-only";

import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability";

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

export type EntitledApiUser =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 402; error: string };

/**
 * Sesión + derecho comercial. Las rutas de IA cuestan dinero por llamada, así
 * que además de la sesión se comprueba `current_org_has_access()` en la base
 * (trial vigente, suscripción activa, institución no archivada — ver
 * private.org_has_access). 402 = autenticado pero sin acceso comercial: la
 * interfaz manda a /suscripcion.
 *
 * Fail-open si la RPC falla, con el mismo criterio que rateLimit: el flujo
 * clínico no debe caerse porque el billing tenga un problema. La RLS de las
 * tablas clínicas sigue siendo la autoridad detrás de esta cortesía.
 */
export async function requireEntitledApiUser(): Promise<EntitledApiUser> {
  const userId = await requireApiUser();
  if (!userId) {
    return { ok: false, status: 401, error: "No autorizado." };
  }

  try {
    const supabase = await createClient();
    const { data: allowed, error } = await supabase.rpc("current_org_has_access");
    if (error) {
      reportError(error, { where: "requireEntitledApiUser" });
      return { ok: true, userId };
    }
    if (allowed !== true) {
      return {
        ok: false,
        status: 402,
        error: "Tu suscripción no está activa. Reactívala para seguir usando Miracle.",
      };
    }
  } catch (e) {
    reportError(e, { where: "requireEntitledApiUser" });
  }

  return { ok: true, userId };
}

// Primera barrera: contador en memoria de la instancia. Es gratis y corta el
// abuso local; si ya excede aquí, ni se consulta la BD.
const WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; reset: number }>();

function memoryAllow(key: string, limit: number): boolean {
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

/**
 * Rate limit durable por usuario y ruta. Doble barrera: el Map en memoria
 * (rápido, por instancia) y un contador en Postgres compartido entre todas las
 * lambdas serverless (el Map solo no sirve en Vercel: cada cold start lo pierde
 * y el tope real se multiplica por el número de instancias).
 *
 * Fail-open: si la RPC falla, se permite el request y se reporta el error. El
 * flujo clínico no debe caerse porque el limitador tenga un problema.
 */
export async function rateLimit(key: string, limit: number): Promise<boolean> {
  if (!memoryAllow(key, limit)) return false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: 60,
    });
    if (error) {
      reportError(error, { where: "rateLimit" });
      return true;
    }
    return data === true;
  } catch (e) {
    reportError(e, { where: "rateLimit" });
    return true;
  }
}
