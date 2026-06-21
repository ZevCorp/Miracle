export const APP_ROLES = ["admin", "supervisor", "medico"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const APP_ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  medico: "Médico",
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}

export function canAccessPath(role: AppRole, pathname: string): boolean {
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
