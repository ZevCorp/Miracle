import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, AuthField } from "@/components/brand/AuthShell";
import { AlertBanner } from "@/components/ui/AlertBanner";
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
    <AuthShell
      title="Recuperar contraseña"
      description="Te enviamos un enlace para crear una contraseña nueva."
      back={{ href: "/login", label: "← Volver al ingreso" }}
    >
      {sent ? (
        <div role="status" className="space-y-4 text-center">
          <AlertBanner tone="success">
            Si el correo está registrado, recibirás un enlace en los próximos
            minutos. Revisa también la carpeta de spam.
          </AlertBanner>
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
            <AlertBanner tone="warning" className="mb-4">
              {message}
            </AlertBanner>
          ) : null}

          <form action={requestPasswordReset} className="space-y-3.5">
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
            <SubmitButton
              pendingLabel="Enviando enlace…"
              className="clinical-primary mt-1 w-full px-5 py-3"
            >
              Enviar enlace de recuperación
            </SubmitButton>
          </form>
        </>
      )}
    </AuthShell>
  );
}
