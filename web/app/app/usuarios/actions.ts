"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

// Un admin de hospital solo puede asignar estos roles dentro de su organización.
// 'superadmin' es de plataforma y jamás se otorga desde aquí (evita auto-ascenso).
const ADMIN_ASSIGNABLE = ["medico", "supervisor", "admin"] as const;

export async function updateUserRole(formData: FormData) {
  const profile = await getCurrentProfile();
  const userId = formData.get("userId");
  const role = formData.get("role");

  if (
    profile?.role !== "admin" ||
    typeof userId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId) ||
    typeof role !== "string" ||
    !(ADMIN_ASSIGNABLE as readonly string[]).includes(role)
  ) {
    return;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select("id");

  if (error) {
    throw new Error("No fue posible actualizar el rol.");
  }
  // RLS puede bloquear en silencio (0 filas) si el usuario es de otra
  // organización: no lo demos por exitoso.
  if (!data || data.length === 0) {
    throw new Error("No fue posible actualizar el rol: usuario fuera de tu organización.");
  }

  revalidatePath("/app/usuarios");
  revalidatePath("/app", "layout");
}
