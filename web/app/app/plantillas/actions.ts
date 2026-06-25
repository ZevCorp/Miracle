"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/server";
import { getClinicalSpecialty } from "@/lib/clinical/specialties";
import { createClient } from "@/lib/supabase/server";
import { normalizeTemplateSections } from "@/lib/templates/custom";

export type TemplateFormState = {
  status?: "success" | "error";
  message?: string;
};

const emptyState: TemplateFormState = {};

export async function createCustomTemplate(
  state: TemplateFormState = emptyState,
  formData: FormData,
): Promise<TemplateFormState> {
  void state;

  const profile = await getCurrentProfile();
  if (!profile) {
    return { status: "error", message: "Debes iniciar sesión para crear plantillas." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const specialtyCode = String(formData.get("specialtyCode") ?? "").trim();
  const sections = normalizeTemplateSections(String(formData.get("sections") ?? ""));
  const specialty = getClinicalSpecialty(specialtyCode);

  if (name.length < 3 || name.length > 120) {
    return { status: "error", message: "El nombre debe tener entre 3 y 120 caracteres." };
  }

  if (!specialty) {
    return { status: "error", message: "Selecciona una especialidad válida." };
  }

  if (description.length > 400) {
    return { status: "error", message: "La descripción no puede superar 400 caracteres." };
  }

  if (sections.length < 2) {
    return { status: "error", message: "Agrega mínimo 2 secciones, una por línea." };
  }

  if (sections.some((section) => section.length > 90)) {
    return { status: "error", message: "Cada sección debe tener máximo 90 caracteres." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("clinical_templates").insert({
    owner_id: profile.id,
    name,
    description: description || null,
    specialty_code: specialty.code,
    specialty_name: specialty.name,
    sections,
  });

  if (error) {
    console.error("[templates] create failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { status: "error", message: "No se pudo crear la plantilla. Inténtalo de nuevo." };
  }

  revalidatePath("/app/plantillas");
  revalidatePath("/app/consultas/nueva");

  return { status: "success", message: "Plantilla creada y guardada en tus plantillas." };
}

export async function deleteCustomTemplate(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const id = String(formData.get("id") ?? "").replace(/^custom:/, "").trim();
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinical_templates")
    .delete()
    .eq("id", id)
    .eq("owner_id", profile.id);

  if (error) {
    console.error("[templates] delete failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return;
  }

  revalidatePath("/app/plantillas");
  revalidatePath("/app/consultas/nueva");
}
