"use client";

import { useState, type ReactNode } from "react";
import { Bell, Menu, Search } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { RoleSwitcher } from "./RoleSwitcher";

export function AppShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="flex min-h-screen bg-pearl">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 md:block">
        <AppSidebar />
      </aside>

      {/* Drawer móvil */}
      {drawer ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-deep/50"
            onClick={() => setDrawer(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 shadow-[var(--shadow-xl)]">
            <AppSidebar onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/80 px-4 backdrop-blur-md md:px-6">
          <button
            type="button"
            aria-label="Abrir menú"
            onClick={() => setDrawer(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-deep hover:bg-ice-soft md:hidden"
          >
            <Menu size={20} />
          </button>

          <div className="hidden items-center gap-2 rounded-full border border-line bg-pearl px-3 py-1.5 text-sm text-muted sm:flex">
            <Search size={15} />
            <span>Buscar paciente o consulta</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <RoleSwitcher />
            <button
              type="button"
              aria-label="Notificaciones"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-ice-soft hover:text-deep"
            >
              <Bell size={18} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" />
            </button>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-deep text-sm font-semibold text-white">
              DR
            </span>
          </div>
        </header>

        <main className="flex-1 p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
