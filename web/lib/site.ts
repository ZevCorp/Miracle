/**
 * Constantes compartidas del sitio Miracle.
 * Centraliza navegación, contacto y CTAs para mantener consistencia.
 */

import type { AppRole } from "@/lib/auth/roles";

export const SITE = {
  name: "Miracle",
  tagline: "Para que el médico mire al paciente, no la pantalla",
  // Número usado en el sitio previo para conversión (WhatsApp).
  whatsappNumber: "573172550953",
  email: "hola@miracle.health",
} as const;

export const WHATSAPP_BASE = `https://wa.me/${SITE.whatsappNumber}`;

/** Genera un enlace de WhatsApp con mensaje prellenado. */
export function whatsappLink(message: string): string {
  return `${WHATSAPP_BASE}?text=${encodeURIComponent(message)}`;
}

export const CTA = {
  primary: { label: "Solicitar piloto", href: "/piloto" },
  secondary: { label: "Ver demo", href: "/demo" },
} as const;

/** Navegación del sitio público. */
export const marketingNav = [
  { label: "Cómo funciona", href: "/como-funciona" },
  { label: "Seguridad", href: "/seguridad" },
  { label: "Casos de uso", href: "/casos-de-uso" },
  { label: "Piloto", href: "/piloto" },
  { label: "Recursos", href: "/recursos" },
] as const;

/** Navegación de la app privada (futura). Iconos resueltos en AppSidebar. */
const allRoles: AppRole[] = ["admin", "supervisor", "medico"];

export type AppNavItem = {
  label: string;
  href: string;
  icon: string;
  roles: AppRole[];
  /**
   * Si está presente, además del rol el ítem exige que el professional_type del usuario esté
   * en la lista. Sirve para funcionalidades exclusivas de una división de cuenta (p. ej.
   * "Laboratorio" solo para bacteriólogos). Ausente = solo importa el rol.
   */
  professionalTypes?: string[];
};

export const appNav: AppNavItem[] = [
  { label: "Inicio", href: "/app/dashboard", icon: "dashboard", roles: allRoles },
  { label: "Consultas", href: "/app/consultas", icon: "consultas", roles: allRoles },
  { label: "Laboratorio", href: "/app/laboratorio", icon: "laboratorio", roles: allRoles, professionalTypes: ["bacteriologo"] },
  { label: "Pacientes", href: "/app/pacientes", icon: "pacientes", roles: allRoles },
  { label: "Notas", href: "/app/notas", icon: "notas", roles: allRoles },
  { label: "Auditoría", href: "/app/auditoria", icon: "auditoria", roles: ["admin", "supervisor"] },
  { label: "Reportes", href: "/app/reportes", icon: "reportes", roles: ["admin", "supervisor"] },
  { label: "Plantillas", href: "/app/plantillas", icon: "plantillas", roles: allRoles },
  { label: "Configuración", href: "/app/configuracion", icon: "configuracion", roles: ["admin"] },
  { label: "Usuarios", href: "/app/usuarios", icon: "usuarios", roles: ["admin"] },
];

/**
 * Ítems de navegación visibles para un usuario, según su rol y tipo profesional.
 * Punto único de verdad del gating de nav (sidebar + barra móvil).
 */
export function visibleAppNav(
  role: AppRole,
  professionalType?: string | null,
): AppNavItem[] {
  return appNav.filter((item) => {
    if (!item.roles.includes(role)) return false;
    if (item.professionalTypes && !item.professionalTypes.includes(professionalType ?? "")) {
      return false;
    }
    return true;
  });
}
