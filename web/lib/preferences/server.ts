import "server-only";

import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability";
import {
  PREFERENCIAS_POR_DEFECTO,
  rowToPreferences,
  USER_PREFERENCES_COLUMNS,
  type UserPreferences,
  type UserPreferencesRow,
} from "./types";

/**
 * Señales de control de flujo de Next, que viajan COMO excepciones.
 *
 * `cookies()` lanza un `DynamicServerError` durante el build: así es como Next
 * descubre que una ruta no se puede prerenderizar. `redirect()` y `notFound()`
 * hacen lo mismo con sus propios digests. Ninguna es un fallo, y atraparlas
 * rompe dos cosas a la vez: Next deja de recibir la señal que esperaba, y el
 * canal de errores se llena de ruido — que fue justo lo que pasó al estrenar
 * esta función: el build escupía un "error" por CADA ruta de /app.
 */
function esSenalDeNext(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) return false;
  const { digest } = error as { digest?: unknown };
  return (
    typeof digest === "string" &&
    (digest === "DYNAMIC_SERVER_USAGE" || digest.startsWith("NEXT_"))
  );
}

/**
 * Preferencias del usuario autenticado, leídas en el servidor para sembrar el
 * contexto de cliente sin un viaje extra ni un parpadeo de valores por defecto.
 *
 * Ante un fallo real entrega los valores por defecto en vez de lanzar. Es la
 * misma tolerancia que ya practica getCurrentProfile con las columnas nuevas
 * —si el código se despliega antes que la migración, nadie se queda fuera de la
 * app por un ajuste— pero con el error reportado en vez de tragado: una
 * preferencia que no se lee se manifiesta como "no me guardó nada", que es
 * justo el fallo que se queda meses sin diagnosticar.
 */
export async function getUserPreferences(): Promise<UserPreferences> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_preferences")
      .select(USER_PREFERENCES_COLUMNS)
      .maybeSingle();

    if (error) {
      reportError(error, { where: "getUserPreferences" });
      return PREFERENCIAS_POR_DEFECTO;
    }

    // Sin fila = usuario que nunca entró a Configuración, no es un error.
    return rowToPreferences((data ?? null) as UserPreferencesRow | null);
  } catch (e) {
    if (esSenalDeNext(e)) throw e;
    reportError(e, { where: "getUserPreferences" });
    return PREFERENCIAS_POR_DEFECTO;
  }
}
