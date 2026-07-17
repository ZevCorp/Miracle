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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Roles asignables desde la consola. 'superadmin' NUNCA se otorga por la UI
// (solo a mano en la base), para que no se pueda escalar por accidente.
const ASSIGNABLE_ROLES = ["medico", "supervisor", "admin"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

function isAssignableRole(value: unknown): value is AssignableRole {
  return typeof value === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

function back(base: string, kind: "ok" | "error", message: string): never {
  redirect(`${base}?${kind}=${encodeURIComponent(message)}`);
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

/** Mueve un usuario a otra organización y/o le cambia el rol. Solo superadmin. */
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
  const role: AssignableRole = isAssignableRole(roleRaw) ? roleRaw : "medico";

  if (!UUID_RE.test(userId)) back(base, "error", "Usuario inválido.");
  if (!UUID_RE.test(organizationId)) back(base, "error", "Organización inválida.");

  // Cliente servidor: la política RLS del superadmin permite el update cross-org.
  const db = await createClient();
  const { data, error } = await db
    .from("profiles")
    .update({ organization_id: organizationId, role })
    .eq("id", userId)
    .select("id");

  if (error) back(base, "error", error.message);
  if (!data || data.length === 0) {
    back(
      base,
      "error",
      "No se aplicó el cambio. Verifica que la migración de super-admin esté aplicada (políticas RLS).",
    );
  }

  revalidatePath(base);
  revalidatePath("/superadmin");
  revalidatePath("/superadmin/organizaciones");
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
