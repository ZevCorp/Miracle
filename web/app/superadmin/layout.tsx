import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { SuperadminSidebar, type NavCounts } from "@/components/superadmin/SuperadminSidebar";
import { MobileSidebar } from "@/components/superadmin/MobileSidebar";

export const metadata: Metadata = {
  title: "Consola · Miracle",
  robots: { index: false, follow: false },
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Segunda barrera de autorización en el servidor (el proxy es solo UX).
  const profile = await requireRole("superadmin");
  const display = profile.fullName ?? profile.email;

  // Conteos de los badges del menú. RPC mínima (cuatro counts) porque corre en
  // cada navegación; si falla o no está aplicada, el menú carga sin badges.
  const db = await createClient();
  const { data: countsData } = await db.rpc("superadmin_nav_counts");
  const counts = (countsData ?? undefined) as NavCounts | undefined;

  return (
    <div className="flex min-h-screen bg-pearl">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 md:block">
        <SuperadminSidebar counts={counts} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur-md md:px-6">
          <MobileSidebar counts={counts} />
          <div>
            <p className="text-sm font-semibold text-deep">Miracle · Consola de plataforma</p>
            <p className="text-xs text-muted">Gestión de organizaciones y usuarios</p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden rounded-full bg-ice px-3 py-1.5 text-xs font-semibold text-deep sm:inline-flex">
              Super-admin
            </span>
            <form action={signOut} className="flex items-center gap-2">
              <span
                title={display}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-night text-sm font-semibold text-white"
              >
                {initials(display)}
              </span>
              <button
                type="submit"
                className="hidden text-sm font-medium text-muted hover:text-deep lg:inline"
              >
                Salir
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
