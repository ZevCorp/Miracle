"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/server";
import { getClinicalSpecialty } from "@/lib/clinical/specialties";
import { createClient } from "@/lib/supabase/server";

const MAX_TEXTO = 120;

function back(kind: "ok" | "error", message: string): never {
  redirect(`/app/configuracion/cuenta?${kind}=${encodeURIComponent(message)}`);
}

/** Campo libre: recortado y colapsado, o cadena vacía si no hay nada. */
function texto(formData: FormData, campo: string): string {
  return String(formData.get(campo) ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_TEXTO);
}

/**
 * Guarda el perfil profesional del propio médico.
 *
 * Pasa por la RPC `update_own_profile` (SECURITY DEFINER, lista blanca de
 * columnas) y no por un update directo. El motivo está en la migración
 * 20260829120100, pero en corto: la única política de auto-edición de `profiles`
 * exige `role = 'medico'`, así que un supervisor no podría tocar su propia fila
 * y un médico B2C —que nace con rol admin— tendría que entrar por la política
 * de administrador, que alcanza a TODA la organización. Ninguna de las dos
 * acota columnas; la RPC sí.
 *
 * Cédula y registro médico no son un dato decorativo: sin ellos el PDF firmado
 * sale sin identificar al responsable de la nota.
 */
export async function updateOwnProfile(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) back("error", "Tu sesión expiró. Vuelve a entrar.");

  const fullName = texto(formData, "full_name");
  if (fullName.length < 3) back("error", "Escribe tu nombre completo.");

  // La especialidad solo viaja si es especialista; para los demás la decide su
  // tipo de práctica y el formulario ni siquiera la ofrece. La RPC lo vuelve a
  // comprobar contra la base: esto es la primera puerta, no la única.
  let specialtyCode: string | null = null;
  let specialtyName: string | null = null;
  if (profile.professionalType === "medico_especialista") {
    const code = String(formData.get("specialty_code") ?? "").trim();
    const specialty = code ? getClinicalSpecialty(code) : undefined;
    if (!specialty) back("error", "Escoge una especialidad válida del menú.");
    specialtyCode = specialty.code;
    specialtyName = specialty.name;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_own_profile", {
    p_full_name: fullName,
    p_identification_number: texto(formData, "identification_number") || null,
    p_professional_registration: texto(formData, "professional_registration") || null,
    p_specialty_code: specialtyCode,
    p_specialty_name: specialtyName,
    p_practice_country: texto(formData, "practice_country") || null,
    p_practice_city: texto(formData, "practice_city") || null,
  });

  if (error) {
    console.error("[configuracion] update_own_profile", {
      code: error.code,
      message: error.message,
    });
    back("error", error.message || "No se pudo guardar. Intenta de nuevo.");
  }

  revalidatePath("/app/configuracion/cuenta");
  // El nombre encabeza el shell, firma las notas y alimenta al asistente; la
  // cédula y el registro salen impresos en el PDF. Sin refrescar el layout, el
  // médico seguiría viendo (y firmando con) los datos viejos hasta recargar.
  revalidatePath("/app", "layout");
  back("ok", "Datos guardados.");
}
