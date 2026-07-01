"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

function back(kind: "ok" | "error", message: string): never {
  redirect(`/app/configuracion?${kind}=${encodeURIComponent(message)}`);
}

/** Guarda los ajustes institucionales del admin en su propia organización. */
export async function updateOrgSettings(formData: FormData) {
  const profile = await requireRole("admin");
  if (!profile.organizationId) back("error", "No se encontró tu organización.");

  const name = String(formData.get("name") ?? "").trim();
  const nit = String(formData.get("nit") ?? "").trim() || null;
  const requireConsent = String(formData.get("require_consent") ?? "") === "true";
  const useHospitalTemplates = String(formData.get("use_hospital_templates") ?? "") === "true";

  if (name.length < 2) back("error", "El nombre de la institución es muy corto.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({
      name,
      nit,
      require_consent: requireConsent,
      use_hospital_templates: useHospitalTemplates,
    })
    .eq("id", profile.organizationId)
    .select("id");

  if (error) back("error", error.message);
  if (!data || data.length === 0) {
    back("error", "No se pudo guardar. Verifica que la migración esté aplicada (políticas RLS).");
  }

  revalidatePath("/app/configuracion");
  revalidatePath("/app/consultas/nueva");
  back("ok", "Configuración guardada.");
}
