"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { assignableRolesFor } from "@/lib/superadmin/roles";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Quién puede repartir qué rol vive en lib/superadmin/roles.ts
 * (`assignableRolesFor`), porque lo lee también la UI.
 *
 * 'superadmin' es de plataforma y jamás se otorga desde aquí (la base lo refuerza
 * con private.prevent_role_escalation). 'secretaria' existe como rol pero no se
 * otorga por UI. La pantalla no ofrece un selector para las cuentas con un rol
 * que no está en la lista, precisamente para que nadie lo cambie sin querer.
 *
 * Un jefe de área (`admin_area`) solo reparte médico y supervisor, y solo dentro
 * de su servicio. Lo segundo NO se comprueba aquí: lo impone la política
 * profiles_update_admin, que para él exige private.supervises(id). Si intenta
 * tocar a alguien de otro servicio el UPDATE afecta a cero filas y cae en la
 * rama de abajo que lo explica.
 */

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
  if (profile?.role !== "admin" && profile?.role !== "admin_area") {
    back("error", "No tienes permiso para cambiar roles.");
  }
  if (typeof userId !== "string" || !UUID_RE.test(userId)) {
    back("error", "No fue posible identificar la cuenta.");
  }
  const repartibles = assignableRolesFor(profile.role) as readonly string[];
  if (typeof role !== "string" || !repartibles.includes(role)) {
    back("error", "Ese rol no se puede asignar desde esta pantalla.");
  }
  if (userId === profile.id) {
    // Quitarse el propio rol de admin deja a la institución sin quien administre
    // (la base lo bloquea además con prevent_last_admin_removal, ya por
    // organización, pero con un error crudo). Mejor explicarlo antes.
    back("error", "No puedes cambiar tu propio rol.");
  }

  const supabase = await createClient();

  // El administrador principal solo se toca desde la consola de plataforma.
  //
  // La regla la impone la base (private.protect_org_owner): sin ella, cualquier
  // admin podía degradar a otro admin de su organización con un PATCH directo a
  // PostgREST y quedarse solo con la institución — la UI nunca fue la defensa.
  // Esta comprobación existe solo para fallar con una frase entendible en vez de
  // con la excepción de Postgres. Se ignora el error a propósito: si el código
  // llega a producción antes que la migración, `owner_id` todavía no existe y
  // esto no debe tumbar la pantalla — la base sigue siendo la que manda.
  if (profile.organizationId) {
    const { data: org } = await supabase
      .from("organizations")
      .select("owner_id")
      .eq("id", profile.organizationId)
      .maybeSingle();

    if (org && (org as { owner_id: string | null }).owner_id === userId) {
      back(
        "error",
        "Esa cuenta es la del administrador principal de la institución: su rol solo se cambia desde Miracle.",
      );
    }
  }

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
    back(
      "error",
      profile.role === "admin_area"
        ? "No fue posible actualizar el rol: esa cuenta no está en tu área."
        : "No fue posible actualizar el rol: usuario fuera de tu organización.",
    );
  }

  revalidatePath("/app/usuarios");
  revalidatePath("/app", "layout");
  back("ok", `Rol actualizado para ${data[0].email}.`);
}

/**
 * Mueve a alguien de área, o lo saca de la suya (área vacía = sin servicio).
 *
 * Los dos roles que llegan aquí hacen cosas distintas, y la diferencia la
 * impone la base, no este archivo:
 *
 *   · Un admin de la institución reparte a cualquiera entre cualquier área.
 *   · Un jefe de área solo alcanza a los suyos (USING de la política exige
 *     private.supervises) y solo puede dejarlos sin área o en la suya (WITH
 *     CHECK). En la práctica eso es exactamente "sacar a alguien de mi área":
 *     dejarlo donde está es un no-op, y meter a alguien de otro servicio le
 *     está vedado, que es lo que impide ver el historial ajeno con un cambio
 *     de área.
 *
 * Sacar a alguien de un área NO da de baja su cuenta ni toca sus consultas: la
 * persona sigue entrando y sigue siendo dueña de sus notas. Simplemente deja de
 * estar bajo el mando de ese servicio.
 */
export async function setUserArea(formData: FormData) {
  const profile = await getCurrentProfile();
  const userId = formData.get("userId");
  const areaRaw = formData.get("areaId");

  if (profile?.role !== "admin" && profile?.role !== "admin_area") {
    back("error", "No tienes permiso para cambiar áreas.");
  }
  if (typeof userId !== "string" || !UUID_RE.test(userId)) {
    back("error", "No fue posible identificar la cuenta.");
  }

  const areaId =
    typeof areaRaw === "string" && UUID_RE.test(areaRaw) ? areaRaw : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ area_id: areaId })
    .eq("id", userId)
    .select("id, email");

  if (error) {
    back("error", error.message);
  }
  if (!data || data.length === 0) {
    back(
      "error",
      profile.role === "admin_area"
        ? "No fue posible cambiar el área: esa cuenta no está en la tuya."
        : "No fue posible cambiar el área: usuario fuera de tu organización.",
    );
  }

  revalidatePath("/app/usuarios");
  revalidatePath("/app", "layout");
  back("ok", areaId ? `Área actualizada para ${data[0].email}.` : `${data[0].email} quedó sin área.`);
}
