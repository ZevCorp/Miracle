import {
  BarChart3,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  LayoutTemplate,
  Microscope,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Ícono de cada entrada del menú, por la clave `icon` de AppNavItem.
 *
 * Vive aparte porque lo usan tres pantallas: el menú lateral, el buscador (⌘K)
 * y la barra inferior del móvil, que ofrecen las mismas entradas. Tenerlo
 * duplicado significaba que añadir una sección al menú la dejaba sin ícono en
 * alguna de ellas: la barra móvil arrastró su propia copia hasta que se añadió
 * "Configuración" y ahí salió con el ícono de reserva.
 */
export const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  consultas: ClipboardList,
  laboratorio: Microscope,
  pacientes: Users,
  notas: FileText,
  auditoria: ShieldCheck,
  reportes: BarChart3,
  plantillas: LayoutTemplate,
  // "configuracion" son los ajustes PERSONALES del médico; la configuración de
  // la institución es "institucion" y lleva un edificio, no un engranaje.
  configuracion: Settings,
  institucion: Building2,
  usuarios: UserCog,
  suscripcion: CreditCard,
};

/** El de reserva cuando una entrada nueva aún no tiene ícono asignado. */
export const NAV_ICON_FALLBACK = LayoutDashboard;
