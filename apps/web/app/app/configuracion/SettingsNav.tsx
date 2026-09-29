"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic, Palette, SlidersHorizontal, Sparkles, UserRound } from "lucide-react";

/**
 * Riel de secciones de Configuración.
 *
 * Son rutas y no pestañas de cliente por dos motivos: el punto de estado del
 * Omi enlaza directo a /app/configuracion/audio desde la consulta, y así cada
 * sección carga en el servidor solo lo suyo (Cuenta necesita el perfil, General
 * necesita los servicios de la organización; ninguna debe pagar por la otra).
 */
const SECCIONES = [
  { href: "/app/configuracion", label: "General", icon: SlidersHorizontal },
  { href: "/app/configuracion/audio", label: "Audio y dispositivos", icon: Mic },
  { href: "/app/configuracion/asistente", label: "Asistente", icon: Sparkles },
  { href: "/app/configuracion/apariencia", label: "Apariencia", icon: Palette },
  { href: "/app/configuracion/cuenta", label: "Cuenta", icon: UserRound },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones de configuración"
      // En móvil es una tira horizontal que se desplaza; desde `md` un riel
      // vertical fijo al lado del contenido.
      className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 md:mx-0 md:w-56 md:shrink-0 md:flex-col md:overflow-visible md:px-0 md:pb-0"
    >
      {SECCIONES.map((seccion) => {
        // "General" vive en la raíz, así que solo coincide exacto: si no, se
        // quedaría activa en todas las subsecciones.
        const activa =
          seccion.href === "/app/configuracion"
            ? pathname === seccion.href
            : pathname === seccion.href || pathname.startsWith(`${seccion.href}/`);
        const Icon = seccion.icon;
        return (
          <Link
            key={seccion.href}
            href={seccion.href}
            aria-current={activa ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors md:w-full ${
              activa
                ? "border-accent bg-accent-soft text-accent-ink"
                : "border-line bg-surface text-ink-soft hover:border-mist hover:text-deep"
            }`}
          >
            <Icon size={16} className="shrink-0" />
            <span className="whitespace-nowrap md:whitespace-normal">{seccion.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
