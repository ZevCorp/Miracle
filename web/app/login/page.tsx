import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, AuthSeparator, AuthField } from "@/components/brand/AuthShell";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { signInWithGoogle, signInWithPassword } from "./actions";
import { SubmitButton } from "./SubmitButton";

export const metadata: Metadata = {
  title: "Ingresar",
  description: "Acceso a la plataforma Miracle para médicos e instituciones.",
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
    <AuthShell
      title="Ingresa a tu cuenta"
      description="Con tu cuenta personal o con la que te asignó tu institución."
      footer={
        <>
          <p>
            ¿Primera vez en Miracle?{" "}
            <Link href="/registro" className="font-semibold text-accent hover:underline">
              Crea tu cuenta gratis
            </Link>
          </p>
          <p className="mt-1.5">
            <Link href="/piloto" className="font-medium text-muted hover:text-deep">
              Solicitar acceso institucional
            </Link>
          </p>
        </>
      }
    >
      {/* Credenciales incorrectas es un fallo de ACCIÓN, no de lectura: rojo,
          según la regla de AlertBanner. El resto son avisos de estado. */}
      {message ? (
        <AlertBanner
          tone={error === "invalid-credentials" ? "danger" : "warning"}
          className="mb-4"
        >
          {message}
        </AlertBanner>
      ) : null}

      <form action={signInWithGoogle}>
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
        <SubmitButton
          pendingLabel="Conectando con Google…"
          className="clinical-secondary w-full gap-3 px-5 py-3"
        >
          <GoogleIcon />
          Continuar con Google
        </SubmitButton>
      </form>

      <AuthSeparator>o con tu correo</AuthSeparator>

      <form action={signInWithPassword} className="space-y-3.5">
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
        <AuthField
          id="email"
          label="Correo"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="nombre@institucion.com"
        />
        <AuthField
          id="password"
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          hint={
            <Link
              href="/login/recuperar"
              className="text-[12px] font-medium text-accent hover:underline"
            >
              ¿La olvidaste?
            </Link>
          }
        />
        <SubmitButton
          pendingLabel="Ingresando…"
          className="clinical-primary mt-1 w-full px-5 py-3"
        >
          Ingresar
        </SubmitButton>
      </form>
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
