"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Registro self-service (B2C). Al crear el usuario, el trigger de la base
 * (private.handle_new_user) crea su organización personal con rol médico y el
 * trial de 14 días nace solo (trigger ensure_billing_account). Aquí no hay
 * nada de billing: solo la cuenta.
 */

async function appUrl() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  const forwardedHost = requestHeaders.get("x-forwarded-host");
  if (forwardedHost) {
    const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
    return `${protocol}://${forwardedHost}`;
  }

  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100").replace(/\/$/, "");
}

function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export async function signUpWithEmail(formData: FormData) {
  if (!configured()) {
    redirect("/registro?error=missing-configuration");
  }

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !fullName) {
    redirect("/registro?error=missing-fields");
  }
  // Mismo mínimo que el cambio de contraseña en /auth/reset.
  if (password.length < 8) {
    redirect("/registro?error=weak-password");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await appUrl()}/auth/callback?next=/app/dashboard`,
      data: { full_name: fullName },
    },
  });

  if (error) {
    // "Ya registrado" no se distingue del resto a la primera: con la
    // confirmación de correo activa Supabase tampoco lo revela (devuelve un
    // usuario sin identities). El mensaje genérico apunta al login.
    redirect("/registro?error=signup-failed");
  }

  // Correo ya registrado con confirmación activa: Supabase responde "ok" con
  // un usuario sin identities para no revelar cuentas. Mostramos el mismo
  // "revisa tu correo" — quien ya tenga cuenta recibirá el aviso de Supabase.
  const needsConfirmation = !data.session;
  if (needsConfirmation) {
    redirect("/registro?sent=1");
  }

  // Confirmación desactivada: la sesión ya existe, directo al producto
  // (el layout de /app lo llevará primero al onboarding clínico).
  redirect("/app/dashboard");
}
