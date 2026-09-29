"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const BASE = "/superadmin/medicion/config";

function volver(kind: "ok" | "error", message: string): never {
  redirect(`${BASE}?${kind}=${encodeURIComponent(message)}`);
}

/** Genera un código de enrolamiento para una org. Lo teclea el técnico UNA vez
 * por PC en el primer arranque del medidor. */
export async function generarCodigo(formData: FormData): Promise<void> {
  const org = `${formData.get("org") ?? ""}`;
  const maxUsos = Number(formData.get("max_usos") ?? 20);
  if (!org) volver("error", "Falta la organización.");

  const db = await createClient();
  const { data, error } = await db.rpc("superadmin_metrics_generar_codigo", {
    p_org: org,
    p_max_uses: Number.isFinite(maxUsos) ? maxUsos : 20,
  });
  if (error) volver("error", error.message);
  revalidatePath(BASE);
  volver("ok", `Código generado: ${data}. Válido 72 h, ${maxUsos} instalaciones.`);
}

/** Guarda el roster de médicos de una org (nombres para el selector de turno).
 * Un nombre por línea. NO borra: desactivar mantiene la referencia de turnos ya
 * medidos con ese médico. */
export async function guardarRoster(formData: FormData): Promise<void> {
  const org = `${formData.get("org") ?? ""}`;
  const nombres = `${formData.get("nombres") ?? ""}`
    .split("\n")
    .map((n) => n.trim())
    .filter(Boolean);
  if (!org) volver("error", "Falta la organización.");
  if (nombres.length === 0) volver("error", "Escribe al menos un nombre.");

  const db = await createClient();
  const medicos = nombres.map((display_name, i) => ({ display_name, sort_order: i + 1, active: true }));
  const { error } = await db.rpc("superadmin_metrics_guardar_roster", { p_org: org, p_medicos: medicos });
  if (error) volver("error", error.message);
  revalidatePath(BASE);
  volver("ok", `Roster guardado: ${nombres.length} médicos.`);
}

/** Fija una fase del estudio para una org, desde una fecha. La fase de cada turno
 * se deriva de este calendario. */
export async function fijarFase(formData: FormData): Promise<void> {
  const org = `${formData.get("org") ?? ""}`;
  const phase = `${formData.get("phase") ?? ""}`;
  const starts = `${formData.get("starts") ?? ""}`;
  if (!org || !phase || !starts) volver("error", "Faltan datos de la fase.");

  const db = await createClient();
  const { error } = await db.rpc("superadmin_metrics_fijar_fase", {
    p_org: org,
    p_phase: phase,
    p_starts: starts,
    p_ends: null,
  });
  if (error) volver("error", error.message);
  revalidatePath(BASE);
  volver("ok", `Fase «${phase}» fijada desde ${starts}.`);
}
