"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Microscope,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { InstallAppButton } from "@/components/app/InstallAppButton";
import { visibleAppNav } from "@/lib/site";
import type { AppRole } from "@/lib/auth/roles";
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

/** Contenido de navegación de la app (sidebar oscuro). Reutilizado en el drawer móvil. */
export function AppSidebar({
  role,
  professionalType,
  onNavigate,
}: {
  role: AppRole;
  professionalType?: string | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { confirmLeave } = useNavigationGuard();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-text">
      <div className="flex h-16 items-center border-b border-white/10 px-5">
        <Logo onDark size={28} />
      </div>
      <nav aria-label="Navegación de la app" className="flex-1 space-y-1 px-3 py-5">
        {visibleAppNav(role, professionalType).map((item) => {
          const Icon = icons[item.icon] ?? LayoutDashboard;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={(e) => {
                if (!confirmLeave()) {
                  e.preventDefault();
                  return;
                }
                onNavigate?.();
              }}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? "bg-sidebar-active text-sidebar-text before:absolute before:-left-3 before:h-6 before:w-[3px] before:rounded-r-full before:bg-white"
                  : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text"
              }`}
            >
              <Icon
                size={18}
                className={active ? "text-sidebar-text" : "text-sidebar-muted"}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 border-t border-white/10 p-3">
        {/* Solo aparece cuando el navegador ofrece instalar la app (PWA). */}
        <InstallAppButton onNavigate={onNavigate} />
        {/* Siempre visible (también en el drawer móvil): en equipos compartidos
            debe poderse cerrar sesión desde cualquier tamaño de pantalla. */}
        <form action={signOut}>
          <button
            type="submit"
            className="flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-semibold text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
