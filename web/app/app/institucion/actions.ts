"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { parseServicios } from "@/lib/hospital/org";

/** Tope de caracteres de los campos libres del encabezado. */
const MAX_TEXTO = 120;
/** Tope de servicios: más de esto es una lista que nadie usa en un selector. */
const MAX_SERVICIOS = 20;

function back(kind: "ok" | "error", message: string): never {
  redirect(`/app/institucion?${kind}=${encodeURIComponent(message)}`);
}

/** Campo libre del encabezado: recortado, o null si queda vacío. */
function texto(formData: FormData, campo: string): string | null {
  const valor = String(formData.get(campo) ?? "").trim().replace(/\s+/g, " ");
  return valor === "" ? null : valor.slice(0, MAX_TEXTO);
}

/** Guarda los ajustes institucionales del admin en su propia organización. */
export async function updateOrgSettings(formData: FormData) {
  const profile = await requireRole("admin");
  if (!profile.organizationId) back("error", "No se encontró tu organización.");

  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const useHospitalTemplates = String(formData.get("use_hospital_templates") ?? "") === "true";

  if (name.length < 2) back("error", "El nombre de la institución es muy corto.");
  if (name.length > MAX_TEXTO) {
    back("error", `El nombre no puede pasar de ${MAX_TEXTO} caracteres.`);
  }

  const servicios = parseServicios(String(formData.get("servicios") ?? ""));
  if (servicios && servicios.length > MAX_SERVICIOS) {
    back("error", `Son demasiados servicios (máximo ${MAX_SERVICIOS}).`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({
      name,
      nit: texto(formData, "nit"),
      address: texto(formData, "address"),
      city: texto(formData, "city"),
      phone: texto(formData, "phone"),
      servicios,
      default_responsable_label: texto(formData, "default_responsable_label"),
      use_hospital_templates: useHospitalTemplates,
    })
    .eq("id", profile.organizationId)
    .select("id");

  if (error) back("error", error.message);
  if (!data || data.length === 0) {
    back("error", "No se pudo guardar. Verifica que la migración esté aplicada (políticas RLS).");
  }

  revalidatePath("/app/institucion");
  // El encabezado y el selector de servicios se arman con estos datos: sin esto
  // el médico seguiría imprimiendo con el membrete viejo hasta recargar.
  revalidatePath("/app/consultas");
  revalidatePath("/app/consultas/nueva");
  back("ok", "Configuración guardada.");
}
