// Roles que la consola puede ASIGNAR, frente a los roles que existen.
//
// La distinción importa: `secretaria` es un rol válido (lib/auth/roles.ts lo
// incluye) pero no se otorga desde la consola, y `superadmin` no se otorga
// nunca por la UI para que no se pueda escalar por accidente — la base lo
// refuerza además con private.prevent_role_escalation().
//
// Vive aparte de app/superadmin/actions.ts porque ese archivo es "use server":
// importar una constante desde él a un componente arrastraría el módulo de
// server actions entero.

export const ASSIGNABLE_ROLES = ["medico", "supervisor", "admin"] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isAssignableRole(value: unknown): value is AssignableRole {
  return typeof value === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}
