"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Menu,
  Microscope,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { visibleAppNav } from "@/lib/site";
import type { AuthenticatedProfile } from "@/lib/auth/server";
import { APP_ROLE_LABEL } from "@/lib/auth/roles";
import { signOut } from "@/app/login/actions";
import { useNavigationGuard } from "@/components/app/UnsavedChangesProvider";

const icons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  consultas: ClipboardList,
  laboratorio: Microscope,
  pacientes: Users,
  notas: FileText,
  auditoria: ShieldCheck,
  reportes: BarChart3,
  plantillas: LayoutTemplate,
  configuracion: Settings,
  usuarios: UserCog,
};

const primaryHrefs = new Set([
  "/app/dashboard",
  "/app/consultas",
  "/app/pacientes",
  "/app/notas",
]);

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNavigation({
  profile,
  onToggleTheme,
}: {
  profile: AuthenticatedProfile;
  onToggleTheme: () => void;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { confirmLeave } = useNavigationGuard();

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moreOpen]);

  // La captura activa es deliberadamente inmersiva: ocultar la navegación
  // evita abandonar una grabación por un toque accidental.
  if (pathname === "/app/consultas/en-vivo" || pathname === "/app/consultas/nueva") return null;

  const allowed = visibleAppNav(profile.role, profile.professionalType);
  const primary = allowed.filter((item) => primaryHrefs.has(item.href));
  const secondary = allowed.filter((item) => !primaryHrefs.has(item.href));
  const secondaryActive = secondary.some((item) => isActive(pathname, item.href));

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface shadow-[0_-4px_18px_rgb(14_23_38_/_0.06)] md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 px-1.5 pt-1.5">
          {primary.map((item) => {
            const Icon = icons[item.icon] ?? LayoutDashboard;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  if (!confirmLeave()) e.preventDefault();
                }}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-xs font-semibold transition-colors ${
                  active ? "text-accent" : "text-muted active:bg-ice-soft"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.3 : 1.9} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-xs font-semibold transition-colors ${
               secondaryActive ? "text-accent" : "text-muted active:bg-ice-soft"
            }`}
          >
            <Menu size={20} />
            <span>Más</span>
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button type="button" aria-label="Cerrar menú" onClick={() => setMoreOpen(false)} className="absolute inset-0 bg-overlay" />
          <section role="dialog" aria-modal="true" aria-labelledby="mobile-more-title" className="mobile-bottom-sheet absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-3xl border border-b-0 border-line bg-surface px-4 pb-4 pt-3 shadow-[var(--shadow-xl)]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" />
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="min-w-0">
                <h2 id="mobile-more-title" className="font-semibold text-deep">Más opciones</h2>
                <p className="truncate text-xs text-muted">{profile.fullName ?? profile.email} · {APP_ROLE_LABEL[profile.role]}</p>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Cerrar menú" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-muted">
                <X size={19} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {secondary.map((item) => {
                const Icon = icons[item.icon] ?? LayoutDashboard;
                const active = isActive(pathname, item.href);
                return (
                  <Link key={item.href} href={item.href} onClick={(e) => { if (!confirmLeave()) { e.preventDefault(); return; } setMoreOpen(false); }} aria-current={active ? "page" : undefined} className={`flex min-h-16 items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm font-semibold ${active ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-pearl text-deep active:bg-ice-soft"}`}>
                    <Icon size={19} /> {item.label}
                  </Link>
                );
              })}
            </div>

            <div className="mt-4 space-y-2 border-t border-line pt-4">
              <button type="button" onClick={onToggleTheme} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-deep active:bg-ice-soft">
                <Moon size={18} className="theme-icon-light" />
                <Sun size={18} className="theme-icon-dark" />
                Cambiar modo claro u oscuro
              </button>
              <form action={signOut}>
                <button type="submit" className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-danger active:bg-danger-soft">
                  <LogOut size={18} /> Cerrar sesión
                </button>
              </form>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
