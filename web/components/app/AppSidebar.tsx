"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LayoutTemplate,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { appNav } from "@/lib/site";

const icons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  consultas: ClipboardList,
  pacientes: Users,
  notas: FileText,
  auditoria: ShieldCheck,
  reportes: BarChart3,
  plantillas: LayoutTemplate,
  configuracion: Settings,
  usuarios: UserCog,
};

/** Contenido de navegación de la app (sidebar oscuro). Reutilizado en el drawer móvil. */
export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-deep text-white">
      <div className="flex h-16 items-center border-b border-white/10 px-5">
        <Logo onDark size={28} />
      </div>
      <nav aria-label="Navegación de la app" className="flex-1 space-y-1 p-3">
        {appNav.map((item) => {
          const Icon = icons[item.icon] ?? LayoutDashboard;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-white/12 text-white"
                  : "text-mist hover:bg-white/8 hover:text-white"
              }`}
            >
              <Icon
                size={18}
                className={active ? "text-white" : "text-mist/80"}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-mist hover:bg-white/8 hover:text-white"
        >
          ← Volver al sitio
        </Link>
      </div>
    </div>
  );
}
