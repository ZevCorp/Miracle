"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  ClipboardList,
  Cpu,
  HeartPulse,
  LayoutDashboard,
  ScrollText,
  ShieldAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { SidebarToggle } from "@/components/app/SidebarToggle";

export type NavCounts = {
  organizaciones?: number;
  usuarios?: number;
  consultas?: number;
  alertas_salud?: number;
};

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Clave de NavCounts que alimenta el badge del ítem. */
  countKey?: keyof NavCounts;
  /** El badge de salud es de alerta: solo aparece si hay algo y va en warning. */
  alertBadge?: boolean;
};

const nav: NavItem[] = [
  { label: "Resumen", href: "/superadmin", icon: LayoutDashboard },
  { label: "Analítica", href: "/superadmin/analitica", icon: BarChart3 },
  { label: "Consumo IA", href: "/superadmin/consumo", icon: Cpu },
  { label: "Salud", href: "/superadmin/salud", icon: HeartPulse, countKey: "alertas_salud", alertBadge: true },
  { label: "Organizaciones", href: "/superadmin/organizaciones", icon: Building2, countKey: "organizaciones" },
  { label: "Usuarios", href: "/superadmin/usuarios", icon: Users, countKey: "usuarios" },
  { label: "Consultas", href: "/superadmin/consultas", icon: ClipboardList, countKey: "consultas" },
  { label: "Actividad", href: "/superadmin/actividad", icon: ScrollText },
  { label: "Mantenimiento", href: "/superadmin/mantenimiento", icon: ShieldAlert },
];

/** Navegación de la consola de plataforma (Miracle). */
export function SuperadminSidebar({
  onNavigate,
  counts,
}: {
  onNavigate?: () => void;
  counts?: NavCounts;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-text">
      <div className="sidebar-header flex h-16 items-center gap-2 border-b border-white/10 px-5">
        <span className="sidebar-expanded-only min-w-0 flex-1">
          <Logo onDark size={26} />
          <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-wide text-sidebar-muted">
            Consola de plataforma
          </span>
        </span>
        <SidebarToggle />
      </div>
      <nav aria-label="Navegación de la consola" className="flex-1 space-y-1 p-3">
        {nav.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/superadmin"
              ? pathname === "/superadmin"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          const count = item.countKey ? counts?.[item.countKey] : undefined;
          const showBadge =
            typeof count === "number" && (item.alertBadge ? count > 0 : true);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`sidebar-item relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-sidebar-active text-sidebar-text"
                  : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text"
              }`}
            >
              <Icon size={18} className={`shrink-0 ${active ? "text-sidebar-text" : "text-sidebar-muted"}`} />
              <span className="sidebar-label flex-1">{item.label}</span>
              {showBadge ? (
                <>
                  <span
                    className={`sidebar-expanded-only rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                      item.alertBadge
                        ? "bg-warning-soft text-warning"
                        : "bg-white/10 text-sidebar-muted"
                    }`}
                  >
                    {count}
                  </span>
                  {/* Contraído no cabe el número: queda un punto que avisa que
                      ahí hay algo, y la cifra vuelve al expandir. */}
                  <span
                    aria-hidden
                    className={`sidebar-collapsed-only absolute right-2.5 top-2 h-2 w-2 rounded-full ${
                      item.alertBadge ? "bg-warning" : "bg-white/40"
                    }`}
                  />
                </>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="sidebar-item relative flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text"
        >
          <ArrowLeft size={16} className="shrink-0" />
          <span className="sidebar-label">Volver al sitio</span>
        </Link>
      </div>
    </div>
  );
}
