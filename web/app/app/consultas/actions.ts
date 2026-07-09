"use server";

import { createHash } from "node:crypto";
import { getCurrentProfile } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export interface SignNoteResult {
  ok: boolean;
  error?: string;
  firma?: { por: string; fecha: string };
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
  const firma = { por, fecha };

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
