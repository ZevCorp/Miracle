"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CloudUpload, Moon, Search, Sun } from "lucide-react";
import { useStore } from "@/app/app/providers";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNavigation } from "./MobileBottomNavigation";
import { MedicalChat } from "./MedicalChat";
import { QuickConsultationLauncher } from "./QuickConsultationLauncher";
import { CommandPalette } from "./CommandPalette";
import { NotificationsBell } from "./NotificationsBell";
import { HoverHint } from "@/components/ui/HoverHint";
import type { AuthenticatedProfile } from "@/lib/auth/server";
import { signOut } from "@/app/login/actions";
import { Logo } from "@/components/brand/Logo";

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
  const [cmdk, setCmdk] = useState(false);
  const { syncing } = useStore();

  // Si aún no hay una elección explícita, el tema sigue los cambios del SO.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncWithSystem = (event: MediaQueryListEvent) => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("miracle-theme");
      } catch {
        /* almacenamiento no disponible */
      }
      if (saved === "dark" || saved === "light") return;
      document.documentElement.classList.toggle("dark", event.matches);
      document.documentElement.dataset.theme = event.matches ? "dark" : "light";
      document.documentElement.style.colorScheme = event.matches ? "dark" : "light";
    };
    media.addEventListener("change", syncWithSystem);
    return () => media.removeEventListener("change", syncWithSystem);
  }, []);

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    try {
      localStorage.setItem("miracle-theme", next ? "dark" : "light");
    } catch {
      /* almacenamiento no disponible */
    }
  }

  return (
    <div className="app-shell flex min-h-screen bg-pearl">
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 md:block">
        <AppSidebar role={profile.role} professionalType={profile.professionalType} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-mobile-header sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface px-3 md:h-16 md:gap-3 md:px-6">
          <Logo href="/app/dashboard" size={25} className="md:hidden [&>span]:hidden" />

          <button
            type="button"
            onClick={() => setCmdk(true)}
            className="clinical-control hidden w-[min(24rem,38vw)] items-center gap-2 px-3 text-sm text-muted sm:flex"
          >
            <Search size={15} />
            <span>Buscar paciente o consulta</span>
            <kbd className="ml-auto rounded border border-line bg-surface px-1.5 py-0.5 text-[11px] font-medium">
              ⌘K
            </kbd>
          </button>

          {/* En móvil no hay ⌘K: la lupa abre el mismo buscador. */}
          <HoverHint label="Buscar paciente o consulta">
            <button
              type="button"
              aria-label="Buscar paciente o consulta"
              onClick={() => setCmdk(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-deep hover:bg-ice-soft sm:hidden"
            >
              <Search size={19} />
            </button>
          </HoverHint>

          <div className="ml-auto flex items-center gap-1 sm:gap-3">
            {syncing ? (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1.5 text-xs font-semibold text-warning"
              >
                <CloudUpload size={13} className="animate-pulse" />
                <span className="hidden sm:inline">Guardando cambios…</span>
              </span>
            ) : null}
            <HoverHint label="Cambiar entre modo claro y oscuro">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Cambiar entre modo claro y oscuro"
                className="hidden h-10 w-10 items-center justify-center rounded-[10px] text-muted hover:bg-ice-soft hover:text-deep sm:inline-flex"
              >
                <Moon size={18} className="theme-icon-light" />
                <Sun size={18} className="theme-icon-dark" />
              </button>
            </HoverHint>
            <NotificationsBell />
            <form action={signOut} className="flex items-center gap-2">
              <span
                title={profile.fullName ?? profile.email}
                className="hidden h-9 w-9 items-center justify-center rounded-full bg-night text-sm font-semibold text-white sm:inline-flex"
              >
                {initials(profile)}
              </span>
              <button type="submit" className="hidden text-sm font-semibold text-muted hover:text-deep lg:inline">
                Salir
              </button>
            </form>
          </div>
        </header>

        <main className="app-main min-w-0 flex-1 px-3 py-5 sm:px-5 sm:py-6 md:px-8 md:py-9">{children}</main>
      </div>

      <MobileBottomNavigation profile={profile} onToggleTheme={toggleTheme} />
      <QuickConsultationLauncher />
      <MedicalChat />
      <CommandPalette open={cmdk} onOpenChange={setCmdk} />
    </div>
  );
}
