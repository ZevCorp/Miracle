import type { Metadata } from "next";
import Link from "next/link";
import { BrandSphere } from "@/components/brand/BrandSphere";
import { signInWithGoogle, signInWithPassword } from "./actions";
import { SubmitButton } from "./SubmitButton";

export const metadata: Metadata = {
  title: "Ingresar",
  description: "Acceso a la plataforma Miracle para instituciones en piloto.",
};

const messages: Record<string, string> = {
  "account-not-ready": "Tu cuenta no está lista todavía. Pide a un administrador que confirme tu acceso.",
  forbidden: "Tu cuenta no tiene permiso para abrir esa sección.",
  "missing-configuration": "El acceso con Google aún no está configurado para esta instalación.",
  "google-sign-in": "No fue posible iniciar sesión con Google. Inténtalo de nuevo.",
  "invalid-callback": "La respuesta de Google no es válida. Inténtalo de nuevo.",
  "callback-failed": "No se pudo completar tu inicio de sesión. Inténtalo de nuevo.",
  "invalid-credentials": "Correo o contraseña incorrectos.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const message = error ? messages[error] : undefined;
  // Se propaga a las actions para volver a la página que pidió el login.
  const nextPath = next?.startsWith("/") && !next.startsWith("//") ? next : "";

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" aria-label="Miracle — inicio">
            <BrandSphere size={64} />
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-deep">
            Acceso a la plataforma
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Ingresa con la cuenta institucional autorizada por tu organización.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface/90 p-6 shadow-[var(--shadow-lg)] backdrop-blur-sm">
          {message ? (
            <p role="alert" className="mb-4 rounded-md border border-warning/30 bg-warning-soft px-3.5 py-3 text-sm text-warning">
              {message}
            </p>
          ) : null}

          <form action={signInWithGoogle}>
            {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
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

          <form action={signInWithPassword} className="space-y-3">
            {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
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
                placeholder="nombre@institucion.com"
                className="w-full rounded-md border border-line bg-field px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent"
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
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="w-full rounded-md border border-line bg-field px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent"
              />
            </div>
            <SubmitButton
              pendingLabel="Ingresando…"
              className="inline-flex w-full items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              Ingresar
            </SubmitButton>
            <div className="text-right">
              <Link
                href="/login/recuperar"
                className="text-sm font-medium text-accent hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </form>

          <p className="mt-5 border-t border-line pt-5 text-center text-sm text-ink-soft">
            El acceso se asigna por rol: médico, supervisor o administrador.
          </p>

          <div className="mt-4 text-center">
            <Link href="/piloto" className="text-sm font-semibold text-accent hover:underline">
              Solicitar acceso institucional
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/" className="hover:text-deep">← Volver al inicio</Link>
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
