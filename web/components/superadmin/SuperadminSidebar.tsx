"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, Users, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const nav: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: "Resumen", href: "/superadmin", icon: LayoutDashboard },
  { label: "Organizaciones", href: "/superadmin/organizaciones", icon: Building2 },
  { label: "Usuarios", href: "/superadmin/usuarios", icon: Users },
];

/** Navegación de la consola de plataforma (Miracle). */
export function SuperadminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-night text-white">
      <div className="flex h-16 flex-col justify-center border-b border-white/10 px-5">
        <Logo onDark size={26} />
        <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-mist/70">
          Consola de plataforma
        </span>
      </div>
      <nav aria-label="Navegación de la consola" className="flex-1 space-y-1 p-3">
        {nav.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/superadmin"
              ? pathname === "/superadmin"
              : pathname === item.href || pathname.startsWith(item.href + "/");
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
              <Icon size={18} className={active ? "text-white" : "text-mist/80"} />
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
