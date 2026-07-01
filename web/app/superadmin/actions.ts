"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

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
 * Necesita SUPABASE_SERVICE_ROLE_KEY (Admin API). El trigger deja el perfil en
 * la organización correcta; además lo confirmamos con el service-role.
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

  // La organización: el admin de hospital queda atado a la suya.
  const organizationId = isSuper
    ? String(formData.get("organizationId") ?? "").trim()
    : (profile.organizationId ?? "");

  if (!EMAIL_RE.test(email)) back(base, "error", "Correo inválido.");
  if (password.length < 8) back(base, "error", "La contraseña debe tener al menos 8 caracteres.");
  if (!fullName) back(base, "error", "Escribe el nombre del profesional.");
  if (!UUID_RE.test(organizationId)) back(base, "error", "Selecciona una organización válida.");

  if (!hasServiceRole()) {
    back(
      base,
      "error",
      "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor para crear cuentas.",
    );
  }

  let errorMsg: string | null = null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      // app_metadata SOLO lo puede escribir el service-role → el trigger confía
      // en él para ubicar el perfil en la organización correcta.
      app_metadata: { organization_id: organizationId, role },
    });

    if (error || !data.user) {
      errorMsg = error?.message ?? "No fue posible crear la cuenta.";
    } else {
      // Confirmación explícita: garantiza organización + rol aunque el trigger
      // no estuviera actualizado todavía.
      const { error: profileError } = await admin
        .from("profiles")
        .update({ organization_id: organizationId, role, full_name: fullName })
        .eq("id", data.user.id);
      if (profileError) errorMsg = profileError.message;
    }
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Error inesperado al crear la cuenta.";
  }

  if (errorMsg) back(base, "error", errorMsg);

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

  // Con service-role si está disponible (a prueba de RLS); si no, cliente
  // servidor apoyado en la política RLS del superadmin.
  const db = hasServiceRole() ? createAdminClient() : await createClient();
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

  const db = hasServiceRole() ? createAdminClient() : await createClient();
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
