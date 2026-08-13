// Plantilla sugerida personal del médico ("mi sugerida").
//
// La sugerida institucional (is_default) es una por especialidad y la fija la
// plataforma; este módulo guarda el pin PERSONAL de cada médico en
// public.user_template_preferences (RLS: cada usuario solo ve las suyas) y
// decide qué plantilla queda preseleccionada al iniciar una consulta.
//
// Va en lib/clinical/ y habla directo con Supabase (patrón appointments):
// lib/api/clinical.ts es solo para el contrato con el backend Graph, que no
// conoce esta tabla.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeSpecialtyCode, type ClinicalTemplate } from "@/lib/api/clinical";

export interface TemplatePreference {
  specialtyCode: string;
  templateId: string;
  updatedAt: string;
}

interface PreferenceRow {
  specialty_code: string;
  template_id: string;
  updated_at: string;
}

export function rowToPreference(row: PreferenceRow): TemplatePreference {
  return {
    specialtyCode: row.specialty_code,
    templateId: row.template_id,
    updatedAt: row.updated_at,
  };
}

/** Pines del médico autenticado, el más reciente primero (RLS filtra al usuario). */
export async function getTemplatePreferences(
  supabase: SupabaseClient,
): Promise<TemplatePreference[]> {
  const { data, error } = await supabase
    .from("user_template_preferences")
    .select("specialty_code, template_id, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToPreference);
}

/** Fija (o reemplaza) la sugerida personal para la especialidad de la plantilla. */
export async function setTemplatePreference(
  supabase: SupabaseClient,
  { specialtyCode, templateId }: { specialtyCode: string; templateId: string },
): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (userError || !userId) throw userError ?? new Error("Sesión no disponible");
  const { error } = await supabase.from("user_template_preferences").upsert(
    {
      user_id: userId,
      specialty_code: normalizeSpecialtyCode(specialtyCode),
      template_id: templateId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,specialty_code" },
  );
  if (error) throw error;
}

/** Quita la sugerida personal de una especialidad. */
export async function clearTemplatePreference(
  supabase: SupabaseClient,
  specialtyCode: string,
): Promise<void> {
  const { error } = await supabase
    .from("user_template_preferences")
    .delete()
    .eq("specialty_code", normalizeSpecialtyCode(specialtyCode));
  if (error) throw error;
}

/** Ids fijados, para pintar el badge "Tu sugerida" sin recorrer la lista. */
export function pinnedTemplateIds(
  preferences: readonly TemplatePreference[],
): Set<string> {
  return new Set(preferences.map((preference) => preference.templateId));
}

export function isPinned(
  preferences: readonly TemplatePreference[],
  template: Pick<ClinicalTemplate, "id">,
): boolean {
  return preferences.some((preference) => preference.templateId === template.id);
}

/**
 * Plantilla preseleccionada al iniciar una consulta. Orden de prioridad:
 *  1. Pin personal más reciente cuya plantilla siga activa — es una decisión
 *     explícita del médico y gana a cualquier heurística.
 *  2. Última usada (localStorage; solo la pasa el lanzador rápido). Conserva su
 *     lugar sobre la institucional: es la señal implícita más honesta.
 *  3. Sugerida institucional (is_default) dentro de la lista "preferida"
 *     (personales + institucionales de su especialidad, con fallback a todas).
 *  4. Primera de esa lista.
 */
export function pickPreselectedTemplate({
  templates,
  preferences,
  lastUsedId,
  specialtyCode,
}: {
  templates: readonly ClinicalTemplate[];
  preferences: readonly TemplatePreference[];
  lastUsedId?: string | null;
  specialtyCode?: string | null;
}): string {
  const active = templates.filter((template) => template.status !== "archived");

  const byRecency = [...preferences].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  for (const preference of byRecency) {
    if (active.some((template) => template.id === preference.templateId)) {
      return preference.templateId;
    }
  }

  if (lastUsedId && active.some((template) => template.id === lastUsedId)) {
    return lastUsedId;
  }

  // Mismo criterio previo de /consultas/nueva y el lanzador rápido: las suyas
  // primero, para que un pediatra no arranque con la plantilla de otra
  // especialidad.
  const personal = active.filter((template) => template.scope === "personal");
  const institutional = active.filter((template) => template.scope !== "personal");
  const wanted = specialtyCode ? normalizeSpecialtyCode(specialtyCode) : null;
  const matching = wanted
    ? institutional.filter(
        (template) => normalizeSpecialtyCode(template.specialty) === wanted,
      )
    : [];
  const preferred = wanted && matching.length
    ? [...personal, ...matching]
    : [...personal, ...institutional];
  return (
    preferred.find((template) => template.is_default)?.id ?? preferred[0]?.id ?? ""
  );
}
