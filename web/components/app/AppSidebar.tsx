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
import {
  APP_NAV_GROUPS,
  APP_NAV_GROUP_LABEL,
  visibleAppNav,
  type AppNavItem,
} from "@/lib/site";
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

/** Una entrada del menú. Extraída para no anidar el bloque dentro del map de grupos. */
function NavLink({
  item,
  active,
  onClick,
}: {
  item: AppNavItem;
  active: boolean;
  onClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const Icon = icons[item.icon] ?? LayoutDashboard;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? "bg-sidebar-active text-sidebar-text before:absolute before:-left-3 before:h-6 before:w-[3px] before:rounded-r-full before:bg-white"
          : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text"
      }`}
    >
      <Icon size={18} className={active ? "text-sidebar-text" : "text-sidebar-muted"} />
      {item.label}
    </Link>
  );
}

/** Contenido de navegación de la app (sidebar oscuro). Reutilizado en el drawer móvil. */
export function AppSidebar({
  role,
  professionalType,
  isDemo,
  onNavigate,
}: {
  role: AppRole;
  professionalType?: string | null;
  isDemo?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { confirmLeave } = useNavigationGuard();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-text">
      <div className="flex h-16 items-center border-b border-white/10 px-5">
        <Logo onDark size={28} />
      </div>
      <nav aria-label="Navegación de la app" className="flex-1 px-3 py-5">
        {(() => {
          const items = visibleAppNav(role, professionalType, isDemo);
          const bloques = APP_NAV_GROUPS.map((group) => ({
            group,
            items: items.filter((item) => item.group === group),
          })).filter((bloque) => bloque.items.length > 0);

          // Con un solo bloque no se dibuja encabezado: a un médico, que solo ve
          // secciones clínicas, un título "Atención" no le aporta nada y solo
          // roba espacio vertical.
          const conTitulo = bloques.length > 1;

          return bloques.map((bloque, i) => (
            <div key={bloque.group} className={i ? "mt-6" : ""}>
              {conTitulo ? (
                <h2 className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted/70">
                  {APP_NAV_GROUP_LABEL[bloque.group]}
                </h2>
              ) : null}
              <ul className="space-y-1">
                {bloque.items.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      item={item}
                      active={
                        pathname === item.href || pathname.startsWith(item.href + "/")
                      }
                      onClick={(e) => {
                        if (!confirmLeave()) {
                          e.preventDefault();
                          return;
                        }
                        onNavigate?.();
                      }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ));
        })()}
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
