"use server";

import { createHash } from "node:crypto";
import { getCurrentProfile } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { DEMO_AUDIT_ACCION } from "@/lib/demo";

export interface SignNoteResult {
  ok: boolean;
  error?: string;
  firma?: { por: string; fecha: string; hash?: string };
}

/**
 * Firma la nota en el servidor: valida la sesión y el estado, registra quién
 * firma (id real del usuario) y deja en auditoría un hash SHA-256 del
 * contenido firmado, para que la firma quede atada a una versión concreta
 * de la nota y no dependa del cliente.
 */
export async function signConsultationNote(
  consultationId: string,
): Promise<SignNoteResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Tu sesión no es válida. Ingresa de nuevo." };

  const supabase = await createClient();
  const { data: consultation, error } = await supabase
    .from("consultations")
    .select("id, estado, note, resumen, codigos")
    .eq("id", consultationId)
    .maybeSingle();

  if (error || !consultation) {
    return { ok: false, error: "No se encontró la consulta." };
  }
  if (consultation.estado !== "borrador" && consultation.estado !== "revisada") {
    return { ok: false, error: "Esta nota ya fue aprobada." };
  }

  // Re-verificación server-side: una nota de demostración nunca se firma como
  // historia clínica real (el bloqueo en la UI no es suficiente por sí solo).
  const { count: demoCount } = await supabase
    .from("audit_events")
    .select("id", { count: "exact", head: true })
    .eq("consultation_id", consultationId)
    .eq("accion", DEMO_AUDIT_ACCION);
  if (demoCount && demoCount > 0) {
    return {
      ok: false,
      error: "Esta es una consulta de demostración y no puede firmarse.",
    };
  }

  const por = profile.fullName ?? profile.email;
  const fecha = new Date().toISOString();
  const contentHash = createHash("sha256")
    .update(
      JSON.stringify({
        note: consultation.note,
        resumen: consultation.resumen,
        codigos: consultation.codigos,
      }),
    )
    .digest("hex");
  // El hash completo queda en la firma (atadura contenido↔firma), no solo un
  // prefijo en auditoría.
  const firma = { por, fecha, hash: contentHash };

  const { error: updateError } = await supabase
    .from("consultations")
    .update({ estado: "aprobada", firma })
    .eq("id", consultationId);

  if (updateError) {
    return { ok: false, error: "No se pudo guardar la firma. Intenta de nuevo." };
  }

  await supabase.from("audit_events").insert({
    consultation_id: consultationId,
    actor_name: por,
    accion: "Nota aprobada y firmada",
    detalle: `Firmada por ${por} (usuario ${profile.id}) · SHA-256 ${contentHash.slice(0, 16)}…`,
  });

  return { ok: true, firma };
}
