"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { ASSIGNABLE_ROLES } from "@/lib/superadmin/roles";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Un admin de hospital solo puede asignar estos roles dentro de su organización.
 *
 * 'superadmin' es de plataforma y jamás se otorga desde aquí (la base lo refuerza
 * con private.prevent_role_escalation). 'secretaria' existe como rol pero no se
 * otorga por UI — es la misma regla que la consola de plataforma, ver
 * lib/superadmin/roles.ts. La pantalla no ofrece un selector para las cuentas con
 * un rol que no está en esta lista, precisamente para que nadie lo cambie sin
 * querer.
 */
const ADMIN_ASSIGNABLE = ASSIGNABLE_ROLES;

/** Vuelve a la bandeja con un mensaje visible en vez de fallar en silencio. */
function back(kind: "ok" | "error", message: string): never {
  redirect(`/app/usuarios?${kind}=${encodeURIComponent(message)}`);
}

export async function updateUserRole(formData: FormData) {
  const profile = await getCurrentProfile();
  const userId = formData.get("userId");
  const role = formData.get("role");

  // Antes, cualquiera de estos casos hacía `return` sin más: el formulario se
  // enviaba, la página se recargaba igual y el rol simplemente no cambiaba. Sin
  // mensaje, la única lectura posible era "ya quedó guardado".
  if (profile?.role !== "admin") {
    back("error", "No tienes permiso para cambiar roles.");
  }
  if (typeof userId !== "string" || !UUID_RE.test(userId)) {
    back("error", "No fue posible identificar la cuenta.");
  }
  if (typeof role !== "string" || !(ADMIN_ASSIGNABLE as readonly string[]).includes(role)) {
    back("error", "Ese rol no se puede asignar desde esta pantalla.");
  }
  if (userId === profile.id) {
    // Quitarse el propio rol de admin deja a la institución sin quien administre
    // (y la base lo bloquea con prevent_last_admin_removal, pero con un error
    // crudo). Mejor explicarlo antes de intentarlo.
    back("error", "No puedes cambiar tu propio rol.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select("id, email");

  if (error) {
    back("error", error.message);
  }
  // RLS puede bloquear en silencio (0 filas) si el usuario es de otra
  // organización: no lo demos por exitoso.
  if (!data || data.length === 0) {
    back("error", "No fue posible actualizar el rol: usuario fuera de tu organización.");
  }

  revalidatePath("/app/usuarios");
  revalidatePath("/app", "layout");
  back("ok", `Rol actualizado para ${data[0].email}.`);
}
