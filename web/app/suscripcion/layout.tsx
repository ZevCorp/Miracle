import type { Metadata } from "next";
import { Logo } from "@/components/brand/Logo";
import { signOut } from "@/app/login/actions";

export const metadata: Metadata = {
  title: "Suscripción",
  robots: { index: false, follow: false },
};

/**
 * Cáscara mínima y deliberadamente independiente del shell clínico: esta
 * página es también el paywall de una cuenta bloqueada, y una cuenta bloqueada
 * no puede montar el store (la RLS le negaría cada consulta). Solo marca,
 * contenido y salir.
 */
export default function SuscripcionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-pearl">
      <header className="flex h-16 items-center justify-between border-b border-line bg-surface px-4 md:px-8">
        <Logo href="/" size={26} />
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm font-semibold text-muted hover:text-deep"
          >
            Cerrar sesión
          </button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 md:py-14">{children}</main>
    </div>
  );
}
