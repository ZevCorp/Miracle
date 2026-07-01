import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase con la clave SERVICE ROLE. Ignora RLS, así que SOLO debe
 * usarse en el servidor (rutas/acciones) tras verificar el rol del que llama.
 * Nunca debe importarse en componentes cliente ni exponerse al navegador.
 *
 * Hace falta únicamente para CREAR cuentas (Admin API). Mover/asignar usuarios
 * y leer en la consola funcionan con el cliente servidor normal vía RLS.
 */
export function hasServiceRole(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY (o NEXT_PUBLIC_SUPABASE_URL) en el servidor. " +
        "Configúrala en .env.local y en Vercel para poder crear cuentas.",
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
