import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthShell, AuthSeparator, AuthField } from "@/components/brand/AuthShell";
import { AlertBanner } from "@/components/ui/AlertBanner";
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


export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
  const message = error ? messages[error] : undefined;

  return (
    <AuthShell
      title="Crea tu cuenta"
      description={
        <>
          Prueba Miracle Notes{" "}
          <strong className="font-semibold text-deep">
            gratis por {TRIAL_DIAS} días
          </strong>
          . Sin tarjeta, sin permanencia.
        </>
      }
      footer={
        sent ? null : (
          <p>
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="font-semibold text-accent hover:underline">
              Ingresar
            </Link>
          </p>
        )
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <MailCheck size={24} />
          </span>
          <h2 className="font-display text-lg font-semibold text-deep">
            Revisa tu correo
          </h2>
          <p className="text-sm leading-relaxed text-ink-soft">
            Te enviamos un enlace para confirmar tu cuenta. Al confirmarla
            entrarás directo a tu consultorio en Miracle.
          </p>
          <Link
            href="/login"
            className="mt-2 text-sm font-semibold text-accent hover:underline"
          >
            Volver a ingresar
          </Link>
        </div>
      ) : (
        <>
          {message ? (
            <AlertBanner tone="warning" className="mb-4">
              {message}
            </AlertBanner>
          ) : null}

          <form action={signInWithGoogle}>
            <SubmitButton
              pendingLabel="Conectando con Google…"
              className="clinical-secondary w-full gap-3 px-5 py-3"
            >
              <GoogleIcon />
              Continuar con Google
            </SubmitButton>
          </form>

          <AuthSeparator>o con tu correo</AuthSeparator>

          <form action={signUpWithEmail} className="space-y-3.5">
            <AuthField
              id="full_name"
              label="Nombre completo"
              name="full_name"
              type="text"
              autoComplete="name"
              required
              autoFocus
              placeholder="Dra. Ana María Gómez"
            />
            <AuthField
              id="email"
              label="Correo"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="nombre@correo.com"
            />
            <AuthField
              id="password"
              label="Contraseña"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
            />
            <SubmitButton
              pendingLabel="Creando tu cuenta…"
              className="clinical-primary mt-1 w-full px-5 py-3"
            >
              Empezar prueba gratuita
            </SubmitButton>
          </form>
        </>
      )}
    </AuthShell>
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
