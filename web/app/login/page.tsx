import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Ingresar",
  description: "Acceso a la plataforma Miracle para instituciones en piloto.",
};

const inputClass =
  "w-full rounded-md border border-line bg-white px-3.5 py-2.5 text-sm text-ink shadow-[var(--shadow-sm)] outline-none transition-colors focus:border-accent";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" aria-label="Miracle — inicio">
            <BrandMark size={44} />
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-deep">
            Acceso a la plataforma
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            El acceso está disponible para instituciones en piloto.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-white/90 p-6 shadow-[var(--shadow-lg)] backdrop-blur-sm">
          <form className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-deep">
                Correo institucional
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="nombre@institucion.com"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-deep">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className={inputClass}
              />
            </div>
            <Button href="/app/dashboard" variant="primary" size="lg" className="w-full">
              Ingresar
            </Button>
          </form>

          <div className="mt-5 border-t border-line pt-5 text-center">
            <p className="text-sm text-ink-soft">
              ¿Su institución aún no usa Miracle?
            </p>
            <Link
              href="/piloto"
              className="mt-1 inline-block text-sm font-semibold text-accent hover:underline"
            >
              Solicitar acceso institucional
            </Link>
          </div>
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
