/**
 * Constantes compartidas del sitio Miracle.
 * Centraliza navegación, contacto y CTAs para mantener consistencia.
 */

import { isDemoSection, type AppRole } from "@/lib/auth/roles";

export const SITE = {
  name: "Miracle",
  tagline: "Para que el médico mire al paciente, no la pantalla",
  // Número usado en el sitio previo para conversión (WhatsApp).
  whatsappNumber: "573172550953",
  // Buzón real que recibe los correos del sitio.
  email: "dev@itsmiracleai.com",
  // Dominio de producción (para canonical/OG/metadataBase). En Vercel se
  // fija NEXT_PUBLIC_SITE_URL; el fallback es el dominio real, no un ejemplo.
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://itsmiracleai.com.co",
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

/**
 * Bloque del menú al que pertenece un ítem.
 *
 * Existe porque el menú de un administrador tenía nueve entradas planas que
 * mezclaban la atención de pacientes con la gestión de la institución. Un
 * administrador no atiende: su trabajo es el bloque "Institución", y con la
 * lista plana quedaba enterrado bajo cuatro secciones clínicas.
 *
 * Un solo grupo visible ⇒ el título no se dibuja (ver AppSidebar): a un médico,
 * que solo ve secciones clínicas, un encabezado "Clínico" no le dice nada.
 */
export type AppNavGroup = "clinico" | "institucion";

export const APP_NAV_GROUP_LABEL: Record<AppNavGroup, string> = {
  clinico: "Atención",
  institucion: "Institución",
};

/** Orden de los bloques en el menú. */
export const APP_NAV_GROUPS: AppNavGroup[] = ["clinico", "institucion"];

export type AppNavItem = {
  label: string;
  href: string;
  icon: string;
  roles: AppRole[];
  group: AppNavGroup;
  /**
   * Si está presente, además del rol el ítem exige que el professional_type del usuario esté
   * en la lista. Sirve para funcionalidades exclusivas de una división de cuenta (p. ej.
   * "Patología" solo para patólogos). Ausente = solo importa el rol.
   */
  professionalTypes?: string[];
};

export const appNav: AppNavItem[] = [
  { label: "Inicio", href: "/app/dashboard", icon: "dashboard", roles: allRoles, group: "clinico" },
  // "secretaria" solo ve este ítem: es su única sección permitida
  // (lista blanca en canAccessPath). El resto de ítems abajo no la incluyen,
  // así que desaparecen solos del menú.
  { label: "Consultas", href: "/app/consultas", icon: "consultas", roles: [...allRoles, "secretaria"], group: "clinico" },
  { label: "Patología", href: "/app/laboratorio", icon: "laboratorio", roles: allRoles, professionalTypes: ["patologo"], group: "clinico" },
  { label: "Pacientes", href: "/app/pacientes", icon: "pacientes", roles: allRoles, group: "clinico" },
  { label: "Notas", href: "/app/notas", icon: "notas", roles: allRoles, group: "clinico" },
  { label: "Plantillas", href: "/app/plantillas", icon: "plantillas", roles: allRoles, group: "clinico" },
  { label: "Auditoría", href: "/app/auditoria", icon: "auditoria", roles: ["admin", "supervisor"], group: "institucion" },
  { label: "Reportes", href: "/app/reportes", icon: "reportes", roles: ["admin", "supervisor"], group: "institucion" },
  { label: "Configuración", href: "/app/configuracion", icon: "configuracion", roles: ["admin"], group: "institucion" },
  { label: "Usuarios", href: "/app/usuarios", icon: "usuarios", roles: ["admin"], group: "institucion" },
];

/**
 * Ítems de navegación visibles para un usuario, según su rol y tipo profesional.
 * Punto único de verdad del gating de nav (sidebar + barra móvil).
 */
export function visibleAppNav(
  role: AppRole,
  professionalType?: string | null,
  isDemo = false,
): AppNavItem[] {
  // La cuenta de demostración comercial se enseña a médicos: ve el menú de un
  // médico, no el de un administrador de hospital (ver DEMO_SECTIONS). Su rol
  // `admin` alcanzaría auditoría, reportes, usuarios y configuración, pero esas
  // secciones no son lo que se vende y solo cargan la pantalla.
  if (isDemo) return appNav.filter((item) => isDemoSection(item.href));

  return appNav.filter((item) => {
    if (!item.roles.includes(role)) return false;
    if (item.professionalTypes && !item.professionalTypes.includes(professionalType ?? "")) {
      return false;
    }
    return true;
  });
}
