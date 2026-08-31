"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { SidebarToggle } from "@/components/app/SidebarToggle";
import { SidebarOmiChip } from "@/components/app/SidebarOmiChip";
import { SidebarProfileCard } from "@/components/app/SidebarProfileCard";
import { NAV_ICONS, NAV_ICON_FALLBACK } from "@/components/app/nav-icons";
import {
  APP_NAV_GROUPS,
  APP_NAV_GROUP_LABEL,
  visibleAppNav,
  type AppNavItem,
} from "@/lib/site";
import type { AppRole } from "@/lib/auth/roles";
import { useNavigationGuard } from "@/components/app/UnsavedChangesProvider";

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
  const Icon = NAV_ICONS[item.icon] ?? NAV_ICON_FALLBACK;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`sidebar-item relative flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? "sidebar-item-active text-sidebar-text before:absolute before:-left-3 before:h-6 before:w-[3px] before:rounded-r-full before:bg-white"
          : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text"
      }`}
    >
      <Icon size={18} className={`shrink-0 ${active ? "text-sidebar-text" : "text-sidebar-muted"}`} />
      {/* Contraído, esta etiqueta se convierte en la pista flotante (globals.css). */}
      <span className="sidebar-label">{item.label}</span>
    </Link>
  );
}

/** Contenido de navegación de la app (sidebar oscuro). Reutilizado en el drawer móvil. */
export function AppSidebar({
  role,
  professionalType,
  isDemo,
  orgKind,
  onNavigate,
  profileName,
  specialtyName,
  canOpenSettings = false,
}: {
  role: AppRole;
  professionalType?: string | null;
  isDemo?: boolean;
  orgKind?: "personal" | "institution" | null;
  onNavigate?: () => void;
  /** Pie del sidebar: quien esta adentro. Sin nombre no se pinta el pie. */
  profileName?: string | null;
  specialtyName?: string | null;
  canOpenSettings?: boolean;
}) {
  const pathname = usePathname();
  const { hasGuard, guardedNavigate } = useNavigationGuard();
  const router = useRouter();

  const items = visibleAppNav(role, professionalType, isDemo, orgKind);

  // El logo lleva al inicio DE LA APP, no a la portada comercial: quien ya
  // entro no quiere volver a la pagina de ventas. Se toma la primera entrada
  // visible en vez de fijar /app/dashboard porque una secretaria no tiene
  // acceso a esa ruta (su unica seccion es Consultas) y caeria en un rebote.
  const homeItem = items[0];

  /** Misma cortesia que el menu: con cambios sin guardar se confirma antes de salir. */
  function navegar(href: string) {
    return (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (!hasGuard()) {
        onNavigate?.();
        return;
      }
      e.preventDefault();
      guardedNavigate(() => {
        onNavigate?.();
        router.push(href);
      });
    };
  }

  return (
    // EXPERIMENTO: el fondo ya no vive aquí sino en .aside-float::before (vidrio
    // navy translúcido). Este div solo aporta la columna y el color de texto.
    <div className="flex h-full flex-col text-sidebar-text">
      <div className="sidebar-header flex h-16 items-center gap-2 border-b border-white/10 px-5">
        {/* Contraído desaparece el logotipo y el botón queda solo, centrado. */}
        <span className="sidebar-expanded-only min-w-0 flex-1">
          {homeItem ? (
            <Logo onDark size={34} href={homeItem.href} onClick={navegar(homeItem.href)} />
          ) : (
            <Logo onDark size={34} />
          )}
        </span>
        <SidebarToggle />
      </div>
      <nav aria-label="Navegación de la app" className="flex-1 px-3 py-5">
        {(() => {
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
                <h2 className="sidebar-expanded-only mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted/70">
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
                      // Con cambios sin guardar se frena el enlace y se
                      // navega a mano tras confirmar: el diálogo es asíncrono
                      // y el <Link> no sabe esperarlo.
                      onClick={navegar(item.href)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ));
        })()}
      </nav>
      {/* Pie: estado del Omi + quien esta adentro. Cerrar sesion NO vive aqui
          (cabecera y hoja «Mas» del movil, desde el arreglo del hueco
          768-1024px); este pie es informacion, no acciones de cuenta. */}
      <div className="relative border-t border-white/10 px-3 pb-3 pt-2">
        {/* Ondas de fondo: profundidad ambiental, nunca compiten con el texto. */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full text-white opacity-[0.035]"
          viewBox="0 0 240 96"
          preserveAspectRatio="none"
        >
          <path
            d="M0 64 C 40 44, 80 84, 120 64 S 200 44, 240 64 L 240 96 L 0 96 Z"
            fill="currentColor"
          />
          <path
            d="M0 80 C 48 62, 96 96, 144 80 S 216 62, 240 78 L 240 96 L 0 96 Z"
            fill="currentColor"
          />
        </svg>
        <div className="relative space-y-1">
          <SidebarOmiChip />
          {profileName ? (
            <SidebarProfileCard
              name={profileName}
              specialtyName={specialtyName}
              canOpenSettings={canOpenSettings}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
