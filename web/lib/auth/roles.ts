// "superadmin" es el rol de plataforma (Miracle), por encima de un hospital.
// Vive en su propia consola (/superadmin); no usa el panel /app.
//
// "secretaria": cuenta de solo lectura acotada a médicos específicos (ver
// supabase/migrations/20260722010000_secretaria_role.sql). A diferencia de
// "supervisor" (que ve TODA la organización), una secretaria solo ve las
// consultas de los médicos que tenga asignados en secretary_doctor_access.
export const APP_ROLES = ["superadmin", "admin", "supervisor", "medico", "secretaria"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const APP_ROLE_LABEL: Record<AppRole, string> = {
  superadmin: "Super-admin",
  admin: "Administrador",
  supervisor: "Supervisor",
  medico: "Médico",
  secretaria: "Secretaría",
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}

/**
 * Cuenta de demostración comercial: un solo login que recorre TODO el producto
 * en una presentación de venta.
 *
 * La cuenta demo tiene rol `admin` (por RLS ya lee toda su organización:
 * reportes, auditoría, usuarios, configuración). Este flag abre además las
 * secciones que ese rol no alcanza y que son el corazón de la demo: crear una
 * consulta, grabarla en vivo y el workspace de patología.
 *
 * Lo que NO hace, a propósito:
 *   · No abre /superadmin — la consola de plataforma se decide por rol.
 *   · No otorga acceso a datos: la RLS sigue acotando todo a la organización
 *     del usuario, así que una cuenta demo jamás ve datos de otra organización.
 * Solo un superadmin puede activar el flag (trigger en la migración
 * 20260731000000_demo_account_flag.sql).
 */
export function canAccessPath(
  role: AppRole,
  pathname: string,
  isDemo = false,
): boolean {
  // La consola de plataforma es exclusiva del superadmin. Se evalúa antes que
  // el flag demo: `is_demo` nunca abre esta puerta.
  if (pathname.startsWith("/superadmin")) {
    return role === "superadmin";
  }

  // El superadmin no usa /app (el proxy lo redirige a su consola). Devolvemos
  // true para no marcar "forbidden" en chequeos secundarios.
  if (role === "superadmin") {
    return true;
  }

  // Lista blanca estricta (al revés del resto de reglas, que son permisivas
  // por defecto): una secretaria solo puede ver el listado de consultas y el
  // detalle de una consulta (de solo lectura por rol, ver [id]/page.tsx).
  // Nunca /nueva ni /en-vivo, aunque intente navegar ahí directo por URL.
  if (role === "secretaria") {
    return (
      pathname === "/app/dashboard" ||
      pathname === "/app/consultas" ||
      (pathname.startsWith("/app/consultas/") &&
        !pathname.startsWith("/app/consultas/nueva") &&
        !pathname.startsWith("/app/consultas/en-vivo"))
    );
  }

  if (
    pathname.startsWith("/app/consultas/nueva") ||
    pathname.startsWith("/app/consultas/en-vivo")
  ) {
    return role === "medico" || isDemo;
  }

  // /app/laboratorio no se decide aquí: lo gobierna el professional_type en la
  // propia página (canUsePhotoNotes), que ya contempla la cuenta demo.
  if (pathname.startsWith("/app/usuarios") || pathname.startsWith("/app/configuracion")) {
    return role === "admin";
  }

  if (pathname.startsWith("/app/auditoria") || pathname.startsWith("/app/reportes")) {
    return role === "admin" || role === "supervisor";
  }

  return true;
}
