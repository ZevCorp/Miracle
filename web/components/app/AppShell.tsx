"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CloudUpload, Menu, Moon, Search, Sun } from "lucide-react";
import { useStore } from "@/app/app/providers";
import { AppSidebar } from "./AppSidebar";
import { MedicalChat } from "./MedicalChat";
import { CommandPalette } from "./CommandPalette";
import { NotificationsBell } from "./NotificationsBell";
import type { AuthenticatedProfile } from "@/lib/auth/server";
import { APP_ROLE_LABEL } from "@/lib/auth/roles";
import { signOut } from "@/app/login/actions";

function initials(profile: AuthenticatedProfile) {
  const words = (profile.fullName ?? profile.email).trim().split(/\s+/);
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

export function AppShell({
  children,
  profile,
}: {
  children: ReactNode;
  profile: AuthenticatedProfile;
}) {
  const [drawer, setDrawer] = useState(false);
  const [cmdk, setCmdk] = useState(false);
  const [dark, setDark] = useState(false);
  const { syncing } = useStore();

  // El script anti-flash del layout ya aplicó la clase en <html>; aquí solo
  // sincronizamos el ícono del botón con ese estado.
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("miracle-theme", next ? "dark" : "light");
    } catch {
      /* almacenamiento no disponible */
    }
  }

  return (
    <div className="app-shell flex min-h-screen bg-pearl">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 md:block">
        <AppSidebar role={profile.role} />
      </aside>

      {drawer ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-night/50"
            onClick={() => setDrawer(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 shadow-[var(--shadow-xl)]">
            <AppSidebar role={profile.role} onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur-md md:px-6">
          <button
            type="button"
            aria-label="Abrir menú"
            onClick={() => setDrawer(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-deep hover:bg-ice-soft md:hidden"
          >
            <Menu size={20} />
          </button>

          <button
            type="button"
            onClick={() => setCmdk(true)}
            className="hidden items-center gap-2 rounded-full border border-line bg-pearl px-3 py-1.5 text-sm text-muted transition-colors hover:border-mist sm:flex"
          >
            <Search size={15} />
            <span>Buscar paciente o consulta</span>
            <kbd className="ml-2 rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium">
              ⌘K
            </kbd>
          </button>

          {/* En móvil no hay ⌘K: la lupa abre el mismo buscador. */}
          <button
            type="button"
            aria-label="Buscar paciente o consulta"
            onClick={() => setCmdk(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-deep hover:bg-ice-soft sm:hidden"
          >
            <Search size={19} />
          </button>

          <div className="ml-auto flex items-center gap-3">
            {syncing ? (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1.5 text-xs font-semibold text-warning"
              >
                <CloudUpload size={13} className="animate-pulse" />
                <span className="hidden sm:inline">Guardando cambios…</span>
              </span>
            ) : null}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-ice-soft hover:text-deep"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="hidden rounded-full bg-ice px-3 py-1.5 text-xs font-semibold text-deep sm:inline-flex">
              {APP_ROLE_LABEL[profile.role]}
            </span>
            <NotificationsBell />
            <form action={signOut} className="flex items-center gap-2">
              <span
                title={profile.fullName ?? profile.email}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-night text-sm font-semibold text-white"
              >
                {initials(profile)}
              </span>
              <button type="submit" className="hidden text-sm font-medium text-muted hover:text-deep lg:inline">
                Salir
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 p-5 md:p-8">{children}</main>
      </div>

      <MedicalChat />
      <CommandPalette open={cmdk} onOpenChange={setCmdk} />
    </div>
  );
}
