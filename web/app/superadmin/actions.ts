"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/server";
import {
  PATOLOGIA_SPECIALTY_CODE,
  PATOLOGIA_SPECIALTY_NAME,
  PATOLOGO_TYPE,
} from "@/lib/clinical/pathology";
import { createClient } from "@/lib/supabase/server";
import { isAssignableRole, type AssignableRole } from "@/lib/superadmin/roles";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Roles asignables: la lista vive en lib/superadmin/roles.ts para que también
// la pueda leer la UI sin importar este módulo "use server".

function back(base: string, kind: "ok" | "error", message: string): never {
  // La base puede traer ya sus propios filtros (?estado=…&page=…): el flash se
  // añade con & en ese caso para no producir una URL con dos signos de pregunta.
  const joiner = base.includes("?") ? "&" : "?";
  redirect(`${base}${joiner}${kind}=${encodeURIComponent(message)}`);
}

/**
 * Traduce el error de una RPC a algo que se pueda leer.
 *
 * Las funciones de mantenimiento ya lanzan frases en español pensadas para
 * quien las va a leer ("No se puede eliminar: la cuenta tiene 12 consultas…"),
 * así que se dejan pasar tal cual. Solo se sustituyen los errores crudos de
 * Postgres, que no le dicen nada a nadie.
 */
function mensajeDeError(mensaje: string): string {
  if (/violates foreign key constraint/i.test(mensaje)) {
    return "No se pudo completar: quedan registros que dependen de esta cuenta u organización.";
  }
  if (/function .* does not exist/i.test(mensaje)) {
    return "Falta aplicar la migración de mantenimiento en la base de datos.";
  }
  return mensaje;
}

/**
 * Crea una cuenta (médico/supervisor/admin) dentro de una organización.
 *  · superadmin  → puede elegir cualquier organización.
 *  · admin       → se fuerza a SU propia organización.
 * Usa la función SECURITY DEFINER public.create_org_member (no requiere la
 * service-role key): la función revalida el rol del que llama y crea el usuario.
 */
export async function createDoctorAccount(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const isSuper = profile.role === "superadmin";
  const isAdmin = profile.role === "admin";
  const base = isSuper ? "/superadmin/usuarios" : "/app/usuarios";

  if (!isSuper && !isAdmin) {
    back("/app/dashboard", "error", "No tienes permiso para crear cuentas.");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "medico");
  const role: AssignableRole = isAssignableRole(roleRaw) ? roleRaw : "medico";

  // Tipo profesional opcional al crear. Hoy la única división que se marca desde la consola
  // es "patólogo" (habilita los informes desde foto); el resto se define en el onboarding.
  const professionalType =
    String(formData.get("professionalType") ?? "").trim() === PATOLOGO_TYPE
      ? PATOLOGO_TYPE
      : null;

  // La organización: el admin de hospital queda atado a la suya.
  const organizationId = isSuper
    ? String(formData.get("organizationId") ?? "").trim()
    : (profile.organizationId ?? "");

  if (!EMAIL_RE.test(email)) back(base, "error", "Correo inválido.");
  // Debe coincidir con la RPC create_org_member (exige ≥ 8), o el form valida
  // 6-7 y luego la RPC falla con un error confuso.
  if (password.length < 8) back(base, "error", "La contraseña debe tener al menos 8 caracteres.");
  if (!fullName) back(base, "error", "Escribe el nombre del profesional.");
  if (!UUID_RE.test(organizationId)) back(base, "error", "Selecciona una organización válida.");

  // Crea la cuenta vía función SECURITY DEFINER (sin service-role key). La función
  // reverifica el rol del que llama y ata al admin a su propia organización.
  const supabase = await createClient();
  const { data: newUserId, error } = await supabase.rpc("create_org_member", {
    p_email: email,
    p_password: password,
    p_full_name: fullName,
    p_role: role,
    p_organization_id: organizationId,
  });

  if (error) back(base, "error", error.message);

  // Marcar patólogo con un UPDATE posterior (la RLS de superadmin/admin lo permite): la RPC
  // de alta no fija el tipo profesional. Deja el onboarding como completado para que el
  // patólogo entre directo a su flujo de patología (informes desde foto).
  if (professionalType === PATOLOGO_TYPE && typeof newUserId === "string") {
    const { error: typeError } = await supabase
      .from("profiles")
      .update({
        professional_type: PATOLOGO_TYPE,
        specialty_code: PATOLOGIA_SPECIALTY_CODE,
        specialty_name: PATOLOGIA_SPECIALTY_NAME,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", newUserId);
    if (typeError) {
      back(base, "error", `Cuenta creada, pero no se marcó como patólogo: ${typeError.message}`);
    }
  }

  revalidatePath(base);
  revalidatePath("/superadmin");
  revalidatePath("/app", "layout");
  back(base, "ok", `Cuenta creada: ${email}`);
}

/**
 * Mueve un usuario a otra organización y/o le cambia el rol. Solo superadmin.
 *
 * Pasa por la RPC superadmin_move_user en vez de un UPDATE directo por dos
 * motivos: deja rastro en auditoría con la organización correcta, y CONSERVA el
 * rol cuando el formulario no manda uno. Ese segundo punto arregla un fallo
 * real: para una secretaria el desplegable de rol no tenía su opción, el
 * navegador seleccionaba la primera (médico), y guardar solo el cambio de
 * organización le quitaba el rol en silencio.
 */
export async function assignUserToOrg(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "superadmin") {
    back("/app/dashboard", "error", "Solo el super-admin puede reasignar usuarios.");
  }

  const base = "/superadmin/usuarios";
  const userId = String(formData.get("userId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "");
  // null = conservar el rol actual. Solo se manda un rol si es asignable.
  const role: AssignableRole | null = isAssignableRole(roleRaw) ? roleRaw : null;

  if (!UUID_RE.test(userId)) back(base, "error", "Usuario inválido.");
  if (!UUID_RE.test(organizationId)) back(base, "error", "Organización inválida.");

  const db = await createClient();
  const { error } = await db.rpc("superadmin_move_user", {
    p_user_id: userId,
    p_org_id: organizationId,
    p_role: role,
  });

  if (error) back(base, "error", mensajeDeError(error.message));

  revalidatePath(base);
  revalidatePath("/superadmin");
  revalidatePath("/superadmin/organizaciones");
  revalidatePath("/superadmin/mantenimiento");
  revalidatePath("/app", "layout");
  back(base, "ok", "Usuario actualizado.");
}

/** Crea una organización (hospital o consultorio). Solo superadmin. */
export async function createOrganization(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "superadmin") {
    back("/app/dashboard", "error", "Solo el super-admin puede crear organizaciones.");
  }

  const base = "/superadmin/organizaciones";
  const name = String(formData.get("name") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "institution");
  const kind = kindRaw === "personal" ? "personal" : "institution";
  const nit = String(formData.get("nit") ?? "").trim() || null;

  if (name.length < 2) back(base, "error", "El nombre es muy corto.");

  // Cliente servidor: la política RLS del superadmin permite el insert.
  const db = await createClient();
  const { data, error } = await db
    .from("organizations")
    .insert({ name, kind, nit })
    .select("id");

  if (error) back(base, "error", error.message);
  if (!data || data.length === 0) {
    back(
      base,
      "error",
      "No se creó la organización. Verifica que la migración de super-admin esté aplicada (políticas RLS).",
    );
  }

  revalidatePath(base);
  revalidatePath("/superadmin");
  back(base, "ok", `Organización creada: ${name}`);
}

/**
 * Elimina una consulta (borrado suave, exclusivo de superadmin). No es un
 * DELETE físico: la RPC public.superadmin_delete_consultation marca
 * deleted_at, así que desaparece de toda la app pero el registro sigue en la
 * base (retención de historia clínica). Ver
 * supabase/migrations/20260722000000_superadmin_delete_consultation.sql.
 */
export async function deleteConsultationAsSuperadmin(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "superadmin") {
    back("/app/dashboard", "error", "Solo el super-admin puede eliminar consultas.");
  }

  // returnTo conserva los filtros/página desde donde se eliminó. Se valida el
  // prefijo para que el hidden input no pueda redirigir fuera de la consola.
  const returnToRaw = String(formData.get("returnTo") ?? "");
  const base = returnToRaw.startsWith("/superadmin/consultas")
    ? returnToRaw
    : "/superadmin/consultas";
  const consultationId = String(formData.get("consultationId") ?? "").trim();
  if (!UUID_RE.test(consultationId)) back(base, "error", "Consulta inválida.");

  const db = await createClient();
  const { error } = await db.rpc("superadmin_delete_consultation", {
    p_consultation_id: consultationId,
  });

  if (error) {
    back(
      base,
      "error",
      error.message.includes("No autorizado")
        ? "No tienes permiso para eliminar consultas."
        : `No se pudo eliminar: ${error.message}`,
    );
  }

  revalidatePath(base);
  revalidatePath("/superadmin");
  back(base, "ok", "Consulta eliminada.");
}

// ===========================================================================
// Mantenimiento: dar de baja, archivar y eliminar.
//
// Todas viven en /superadmin/mantenimiento y TODAS piden la contraseña del
// super-admin. La contraseña viaja en el cuerpo del POST de la server action y
// nunca toca la URL — por eso esto no son route handlers: `back()` solo pone el
// mensaje de resultado en el query string.
//
// La verificación real ocurre dentro de la RPC (private.verify_own_password),
// en la misma transacción que el cambio: aquí no se compara nada.
// ===========================================================================

const BASE_MANTENIMIENTO = "/superadmin/mantenimiento";

type AccionCritica = {
  /** Nombre de la RPC. */
  rpc: string;
  /** Argumentos, ya validados. */
  args: Record<string, unknown>;
  /** Mensaje de éxito. */
  exito: string;
};

/**
 * Esqueleto común: rol, contraseña presente, RPC, revalidación y flash.
 * Devolver la construcción de argumentos al llamante mantiene cada acción
 * legible y deja la validación de UUID donde se puede dar un mensaje concreto.
 */
async function ejecutarAccionCritica(
  formData: FormData,
  construir: (password: string) => AccionCritica,
): Promise<never> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "superadmin") {
    back("/app/dashboard", "error", "Solo el super-admin puede hacer esto.");
  }

  const password = String(formData.get("password") ?? "");
  if (!password) back(BASE_MANTENIMIENTO, "error", "Escribe tu contraseña para confirmar.");

  const { rpc, args, exito } = construir(password);

  const db = await createClient();
  const { error } = await db.rpc(rpc, args);
  if (error) back(BASE_MANTENIMIENTO, "error", mensajeDeError(error.message));

  // Amplio a propósito: una baja cambia los conteos del menú, el resumen, las
  // listas de usuarios y organizaciones y el propio mantenimiento.
  revalidatePath(BASE_MANTENIMIENTO);
  revalidatePath("/superadmin");
  revalidatePath("/superadmin/usuarios");
  revalidatePath("/superadmin/organizaciones");
  revalidatePath("/superadmin", "layout");
  revalidatePath("/app", "layout");
  back(BASE_MANTENIMIENTO, "ok", exito);
}

function uuidObligatorio(formData: FormData, campo: string, mensaje: string): string {
  const valor = String(formData.get(campo) ?? "").trim();
  if (!UUID_RE.test(valor)) back(BASE_MANTENIMIENTO, "error", mensaje);
  return valor;
}

/** Da de baja una cuenta: bloquea el acceso y conserva toda su historia. */
export async function deactivateUser(formData: FormData) {
  const userId = uuidObligatorio(formData, "userId", "Cuenta inválida.");
  const etiqueta = String(formData.get("etiqueta") ?? "la cuenta");
  const motivo = String(formData.get("motivo") ?? "").trim();

  return ejecutarAccionCritica(formData, (password) => ({
    rpc: "superadmin_deactivate_user",
    args: { p_user_id: userId, p_password: password, p_reason: motivo || null },
    exito: `${etiqueta} quedó dada de baja. Su historia clínica se conserva.`,
  }));
}

/** Devuelve el acceso a una cuenta dada de baja. */
export async function reactivateUser(formData: FormData) {
  const userId = uuidObligatorio(formData, "userId", "Cuenta inválida.");
  const etiqueta = String(formData.get("etiqueta") ?? "la cuenta");

  return ejecutarAccionCritica(formData, (password) => ({
    rpc: "superadmin_reactivate_user",
    args: { p_user_id: userId, p_password: password },
    exito: `${etiqueta} vuelve a tener acceso.`,
  }));
}

/**
 * Borra una cuenta de forma definitiva. La RPC solo lo permite si NO tiene
 * historia clínica: si tiene, devuelve un mensaje que dice cuánta y remite a
 * dar de baja.
 */
export async function deleteUserPermanently(formData: FormData) {
  const userId = uuidObligatorio(formData, "userId", "Cuenta inválida.");
  const etiqueta = String(formData.get("etiqueta") ?? "la cuenta");

  return ejecutarAccionCritica(formData, (password) => ({
    rpc: "superadmin_delete_user",
    args: { p_user_id: userId, p_password: password },
    exito: `${etiqueta} se eliminó definitivamente.`,
  }));
}

/** Archiva una organización: sale de todas las listas, no se pierde nada. */
export async function archiveOrganization(formData: FormData) {
  const orgId = uuidObligatorio(formData, "orgId", "Organización inválida.");
  const etiqueta = String(formData.get("etiqueta") ?? "la organización");

  return ejecutarAccionCritica(formData, (password) => ({
    rpc: "superadmin_archive_organization",
    args: { p_org_id: orgId, p_password: password, p_archived: true },
    exito: `«${etiqueta}» quedó archivada. Sus datos siguen ahí y se puede restaurar.`,
  }));
}

/** Restaura una organización archivada. */
export async function restoreOrganization(formData: FormData) {
  const orgId = uuidObligatorio(formData, "orgId", "Organización inválida.");
  const etiqueta = String(formData.get("etiqueta") ?? "la organización");

  return ejecutarAccionCritica(formData, (password) => ({
    rpc: "superadmin_archive_organization",
    args: { p_org_id: orgId, p_password: password, p_archived: false },
    exito: `«${etiqueta}» vuelve a estar activa.`,
  }));
}

/**
 * Borra una organización de forma definitiva. La RPC lo rechaza salvo que esté
 * COMPLETAMENTE vacía: todas sus tablas dependientes están en cascade, así que
 * borrarla con datos destruiría historia clínica y su auditoría.
 */
export async function deleteOrganization(formData: FormData) {
  const orgId = uuidObligatorio(formData, "orgId", "Organización inválida.");
  const etiqueta = String(formData.get("etiqueta") ?? "la organización");

  return ejecutarAccionCritica(formData, (password) => ({
    rpc: "superadmin_delete_organization",
    args: { p_org_id: orgId, p_password: password },
    exito: `«${etiqueta}» se eliminó definitivamente.`,
  }));
}
