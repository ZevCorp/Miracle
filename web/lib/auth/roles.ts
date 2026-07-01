// "superadmin" es el rol de plataforma (Miracle), por encima de un hospital.
// Vive en su propia consola (/superadmin); no usa el panel /app.
export const APP_ROLES = ["superadmin", "admin", "supervisor", "medico"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const APP_ROLE_LABEL: Record<AppRole, string> = {
  superadmin: "Super-admin",
  admin: "Administrador",
  supervisor: "Supervisor",
  medico: "Médico",
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

  if (pathname.startsWith("/app/consultas/nueva")) {
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
