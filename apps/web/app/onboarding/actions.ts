"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getClinicalSpecialty } from "@/lib/clinical/specialties";
import { getCurrentProfile } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error?: string };

export async function completeClinicalOnboarding(
  _: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "medico") {
    return { error: "Esta cuenta no puede completar un perfil clínico." };
  }

  const professionalType = String(formData.get("professionalType") ?? "").trim();
  const specialtyCode = String(formData.get("specialtyCode") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const specialty = getClinicalSpecialty(specialtyCode);

  if (
    professionalType !== "medico_general" &&
    professionalType !== "medico_especialista" &&
    professionalType !== "patologo"
  ) {
    return { error: "Escoge tu tipo de práctica." };
  }

  if (!specialty) {
    return { error: "Escoge una especialidad válida del menú." };
  }

  if (professionalType === "medico_general" && specialty.code !== "medicina-general") {
    return { error: "Para médico general usa Medicina general." };
  }

  if (professionalType === "medico_especialista" && specialty.code === "medicina-general") {
    return { error: "Si eliges médico especialista, escoge una especialidad del menú." };
  }

  if (professionalType === "patologo" && specialty.code !== "patologia") {
    return { error: "Para patólogo la especialidad es Patología." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_clinical_onboarding", {
    p_professional_type: professionalType,
    p_specialty_code: specialty.code,
    p_specialty_name: specialty.name,
    p_practice_country: country || null,
    p_practice_city: city || null,
  });

  if (error) {
    console.error("[onboarding] complete_clinical_onboarding failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { error: "No se pudieron guardar los datos. Inténtalo de nuevo." };
  }

  revalidatePath("/app", "layout");
  redirect("/app/dashboard");
}
