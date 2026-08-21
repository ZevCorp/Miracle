import {
  BarChart3,
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
 * Vive aparte porque lo usan dos pantallas: el menú lateral y el buscador
 * (⌘K), que ofrece esas mismas entradas como acciones de navegación. Tenerlo
 * duplicado significaba que añadir una sección al menú la dejaba sin ícono en
 * el buscador, o al revés.
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
  configuracion: Settings,
  usuarios: UserCog,
  suscripcion: CreditCard,
};

/** El de reserva cuando una entrada nueva aún no tiene ícono asignado. */
export const NAV_ICON_FALLBACK = LayoutDashboard;
