"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

async function appUrl() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");

  if (origin) {
    return origin.replace(/\/$/, "");
  }

  const forwardedHost = requestHeaders.get("x-forwarded-host");
  if (forwardedHost) {
    const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
    return `${protocol}://${forwardedHost}`;
  }

  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

// Solo rutas internas: evita open redirects con ?next= manipulado.
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/app/dashboard";
}

// Conserva el destino al volver a /login con error, para no perder el deep link.
function loginErrorUrl(error: string, next: string): string {
  const keepNext =
    next !== "/app/dashboard" ? `&next=${encodeURIComponent(next)}` : "";
  return `/login?error=${error}${keepNext}`;
}

export async function signInWithGoogle(formData: FormData) {
  if (!configured()) {
    redirect("/login?error=missing-configuration");
  }

  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await appUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=google-sign-in");
  }

  redirect(data.url);
}

export async function signInWithPassword(formData: FormData) {
  if (!configured()) {
    redirect("/login?error=missing-configuration");
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) {
    redirect(loginErrorUrl("invalid-credentials", next));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(loginErrorUrl("invalid-credentials", next));
  }

  redirect(next);
}

export async function requestPasswordReset(formData: FormData) {
  if (!configured()) {
    redirect("/login/recuperar?error=missing-configuration");
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect("/login/recuperar?error=missing-email");
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await appUrl()}/auth/callback?next=/auth/reset`,
  });

  // Confirmación genérica siempre: no se revela si el correo existe o no.
  redirect("/login/recuperar?sent=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
