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

import type { AppRole } from "@/lib/auth/roles";

export const ASSIGNABLE_ROLES = ["medico", "supervisor", "admin_area", "admin"] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isAssignableRole(value: unknown): value is AssignableRole {
  return typeof value === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

/**
 * Lo que un jefe de área puede repartir dentro de su servicio: médico y
 * supervisor, nada más.
 *
 * Un jefe de área NO nombra a otro jefe de área ni a un administrador de la
 * institución — nombrar pares es la vía obvia para saltarse el alcance, y en un
 * hospital el organigrama lo decide la institución, no el servicio.
 *
 * Esto es la cara visible de la regla; la barrera real es el WITH CHECK de la
 * política profiles_update_admin y el recorte de rol de create_org_member
 * (supabase/migrations/20260901140000_areas_medicas.sql). Cambiar solo esta
 * lista no abre ni cierra nada en la base.
 */
export const AREA_ASSIGNABLE_ROLES = ["medico", "supervisor"] as const;

/** Los roles que este rol puede repartir. Vacío = no reparte ninguno. */
export function assignableRolesFor(role: AppRole): readonly AssignableRole[] {
  if (role === "superadmin" || role === "admin") return ASSIGNABLE_ROLES;
  if (role === "admin_area") return AREA_ASSIGNABLE_ROLES;
  return [];
}

/** ¿Puede `actor` dejar a alguien en el rol `target`? */
export function canAssignRole(actor: AppRole, target: unknown): target is AssignableRole {
  return (
    typeof target === "string" &&
    (assignableRolesFor(actor) as readonly string[]).includes(target)
  );
}
