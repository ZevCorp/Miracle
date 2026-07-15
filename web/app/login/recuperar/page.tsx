import type { Metadata } from "next";
import Link from "next/link";
import { BrandSphere } from "@/components/brand/BrandSphere";
import { requestPasswordReset } from "../actions";
import { SubmitButton } from "../SubmitButton";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
  description: "Solicita un enlace para restablecer tu contraseña de Miracle.",
};

const messages: Record<string, string> = {
  "missing-configuration":
    "El acceso aún no está configurado para esta instalación. Contacta a tu administrador.",
  "missing-email": "Escribe el correo con el que ingresas a la plataforma.",
};

export default async function RecuperarPage({
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
          <h1 className="mt-4 text-2xl font-semibold text-deep">
            Recuperar contraseña
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Te enviaremos un enlace para crear una contraseña nueva.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface/90 p-6 shadow-[var(--shadow-lg)] backdrop-blur-sm">
          {sent ? (
            <div role="status" className="space-y-4 text-center">
              <p className="rounded-md border border-success/30 bg-success-soft px-3.5 py-3 text-sm text-success">
                Si el correo está registrado, recibirás un enlace en los
                próximos minutos. Revisa también la carpeta de spam.
              </p>
              <Link
                href="/login"
                className="inline-block text-sm font-semibold text-accent hover:underline"
              >
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

              <form action={requestPasswordReset} className="space-y-3">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-sm font-medium text-deep"
                  >
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
                <SubmitButton
                  pendingLabel="Enviando enlace…"
                  className="inline-flex w-full items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Enviar enlace de recuperación
                </SubmitButton>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/login" className="hover:text-deep">
            ← Volver al ingreso
          </Link>
        </p>
      </div>
    </main>
  );
}
