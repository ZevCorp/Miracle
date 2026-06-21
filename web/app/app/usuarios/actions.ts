"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/server";
import { isAppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export async function updateUserRole(formData: FormData) {
  const profile = await getCurrentProfile();
  const userId = formData.get("userId");
  const role = formData.get("role");

  if (
    profile?.role !== "admin" ||
    typeof userId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId) ||
    !isAppRole(role)
  ) {
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (error) {
    throw new Error("No fue posible actualizar el rol.");
  }

  revalidatePath("/app/usuarios");
  revalidatePath("/app", "layout");
}
