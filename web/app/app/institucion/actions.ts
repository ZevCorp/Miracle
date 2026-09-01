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

// ============================================================================
// Áreas médicas (el organigrama del hospital)
// ============================================================================
//
// Crear, renombrar y borrar áreas es EXCLUSIVO del admin de la institución, no
// de los jefes de servicio: el organigrama lo decide el hospital. La base lo
// refuerza con la política "admin manages areas", que exige private.is_admin()
// —estrictamente rol 'admin', no 'admin_area'—, así que esto es solo la cara
// visible de esa regla.

/** Tope del nombre de un área. Cabe en un selector sin partirse. */
const MAX_AREA = 60;
/** Tope de áreas por institución: más que esto ya no es un organigrama. */
const MAX_AREAS = 40;

export async function createArea(formData: FormData) {
  const profile = await requireRole("admin");
  if (!profile.organizationId) back("error", "No se encontró tu organización.");

  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2) back("error", "El nombre del área es muy corto.");
  if (name.length > MAX_AREA) {
    back("error", `El nombre del área no puede pasar de ${MAX_AREA} caracteres.`);
  }

  const supabase = await createClient();

  const { count } = await supabase
    .from("org_areas")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", profile.organizationId);
  if ((count ?? 0) >= MAX_AREAS) {
    back("error", `Ya tienes ${MAX_AREAS} áreas, que es el máximo.`);
  }

  const { error } = await supabase
    .from("org_areas")
    .insert({ organization_id: profile.organizationId, name });

  if (error) {
    // 23505 = el índice único (organization_id, name).
    back(
      "error",
      error.code === "23505"
        ? `Ya existe un área que se llama «${name}».`
        : error.message,
    );
  }

  revalidatePath("/app/institucion");
  revalidatePath("/app/usuarios");
  back("ok", `Área «${name}» creada.`);
}

export async function renameArea(formData: FormData) {
  // El guardia redirige si no es admin. No hace falta su retorno: que el área
  // sea de SU institución lo impone la política "admin manages areas", y por
  // eso el update de abajo devuelve cero filas si es de otra.
  await requireRole("admin");
  const areaId = String(formData.get("areaId") ?? "");
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");

  if (!areaId) back("error", "No fue posible identificar el área.");
  if (name.length < 2) back("error", "El nombre del área es muy corto.");
  if (name.length > MAX_AREA) {
    back("error", `El nombre del área no puede pasar de ${MAX_AREA} caracteres.`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("org_areas")
    .update({ name })
    .eq("id", areaId)
    .select("id");

  if (error) {
    back(
      "error",
      error.code === "23505" ? `Ya existe un área que se llama «${name}».` : error.message,
    );
  }
  if (!data || data.length === 0) back("error", "Esa área no es de tu institución.");

  revalidatePath("/app/institucion");
  revalidatePath("/app/usuarios");
  back("ok", `Área renombrada a «${name}».`);
}

/**
 * Borra un área. No borra a nadie: la clave foránea es
 * ON DELETE SET NULL (area_id), así que su gente queda sin servicio asignado y
 * sigue entrando con sus consultas intactas.
 *
 * Lo que sí desaparece es el alcance de su jefe: un `admin_area` sin área no
 * alcanza a nadie (private.supervises falla cerrado). Por eso se avisa con la
 * cuenta de personas antes de dejarlo caer.
 */
export async function deleteArea(formData: FormData) {
  await requireRole("admin");
  const areaId = String(formData.get("areaId") ?? "");
  if (!areaId) back("error", "No fue posible identificar el área.");

  const supabase = await createClient();

  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("area_id", areaId);

  const { data, error } = await supabase
    .from("org_areas")
    .delete()
    .eq("id", areaId)
    .select("id, name");

  if (error) back("error", error.message);
  if (!data || data.length === 0) back("error", "Esa área no es de tu institución.");

  revalidatePath("/app/institucion");
  revalidatePath("/app/usuarios");
  back(
    "ok",
    (count ?? 0) > 0
      ? `Área «${data[0].name}» borrada. ${count} ${count === 1 ? "cuenta quedó" : "cuentas quedaron"} sin área.`
      : `Área «${data[0].name}» borrada.`,
  );
}
