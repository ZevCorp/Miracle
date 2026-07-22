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

export function canAccessPath(role: AppRole, pathname: string): boolean {
  // La consola de plataforma es exclusiva del superadmin.
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
    return role === "medico";
  }

  if (pathname.startsWith("/app/usuarios") || pathname.startsWith("/app/configuracion")) {
    return role === "admin";
  }

  if (pathname.startsWith("/app/auditoria") || pathname.startsWith("/app/reportes")) {
    return role === "admin" || role === "supervisor";
  }

  return true;
}
