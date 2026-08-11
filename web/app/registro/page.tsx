import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { BrandSphere } from "@/components/brand/BrandSphere";
import { signInWithGoogle } from "@/app/login/actions";
import { SubmitButton } from "@/app/login/SubmitButton";
import { TRIAL_DIAS } from "@/lib/billing/plans";
import { signUpWithEmail } from "./actions";

export const metadata: Metadata = {
  title: "Crea tu cuenta",
  description: `Prueba Miracle Notes gratis por ${TRIAL_DIAS} días. Sin tarjeta.`,
};

const messages: Record<string, string> = {
  "missing-configuration": "El registro aún no está configurado para esta instalación.",
  "missing-fields": "Escribe tu nombre y tu correo.",
  "weak-password": "La contraseña debe tener al menos 8 caracteres.",
  "signup-failed":
    "No pudimos crear la cuenta con ese correo. Si ya tienes una, inicia sesión.",
};

const inputClass =
  "w-full rounded-md border border-line bg-field px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent";

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
  const message = error ? messages[error] : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" aria-label="Miracle — inicio">
            <BrandSphere size={64} />
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-deep">Crea tu cuenta</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Prueba Miracle Notes <strong className="text-deep">gratis por {TRIAL_DIAS} días</strong>.
            Sin tarjeta, sin permanencia.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface/90 p-6 shadow-[var(--shadow-lg)] backdrop-blur-sm">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <MailCheck size={34} className="text-accent" />
              <h2 className="text-lg font-semibold text-deep">Revisa tu correo</h2>
              <p className="text-sm text-ink-soft">
                Te enviamos un enlace para confirmar tu cuenta. Al confirmarla entrarás directo a
                tu consultorio en Miracle.
              </p>
              <Link href="/login" className="mt-2 text-sm font-semibold text-accent hover:underline">
                Volver a ingresar
              </Link>
            </div>
          ) : (
            <>
              {message ? (
                <p
                  role="alert"
                  className="mb-4 rounded-md border border-warning/30 bg-warning-soft px-3.5 py-3 text-sm text-warning"
                >
                  {message}
                </p>
              ) : null}

              <form action={signInWithGoogle}>
                <SubmitButton
                  pendingLabel="Conectando con Google…"
                  className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-line bg-surface px-5 py-3 text-sm font-semibold text-deep shadow-[var(--shadow-sm)] transition-colors hover:bg-ice-soft disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <GoogleIcon />
                  Continuar con Google
                </SubmitButton>
              </form>

              <div className="my-5 flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-line" />
                o con tu correo
                <span className="h-px flex-1 bg-line" />
              </div>

              <form action={signUpWithEmail} className="space-y-3">
                <div>
                  <label htmlFor="full_name" className="mb-1.5 block text-sm font-medium text-deep">
                    Nombre completo
                  </label>
                  <input
                    id="full_name"
                    name="full_name"
                    type="text"
                    autoComplete="name"
                    required
                    placeholder="Dra. Ana María Gómez"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-deep">
                    Correo
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="nombre@correo.com"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-deep">
                    Contraseña
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    className={inputClass}
                  />
                </div>
                <SubmitButton
                  pendingLabel="Creando tu cuenta…"
                  className="inline-flex w-full items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Empezar prueba gratuita
                </SubmitButton>
              </form>

              <p className="mt-5 border-t border-line pt-5 text-center text-sm text-ink-soft">
                ¿Ya tienes cuenta?{" "}
                <Link href="/login" className="font-semibold text-accent hover:underline">
                  Ingresar
                </Link>
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/" className="hover:text-deep">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.5h3.2c1.9-1.8 3.1-4.4 3.1-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2 .9-3.5.9-2.7 0-5-1.8-5.8-4.3H2.9v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.2 13.7A6 6 0 0 1 5.9 12c0-.6.1-1.2.3-1.7V7.7H2.9A10 10 0 0 0 2 12c0 1.6.4 3.1.9 4.3l3.3-2.6Z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8C17 3.1 14.7 2 12 2a10 10 0 0 0-9.1 5.7l3.3 2.6C7 7.7 9.3 5.9 12 5.9Z" />
    </svg>
  );
}
