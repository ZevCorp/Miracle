import type { AuditEvent, SpeakerTurn } from "@/lib/mock";

/**
 * Mientras no exista grabación real, toda consulta creada desde
 * /app/consultas/en-vivo proviene del guion simulado. Estas utilidades
 * permiten marcarlas y reconocerlas para que no se puedan firmar ni
 * exportar como historia clínica real.
 */

export const DEMO_AUDIT_ACCION = "Nota de demostración generada por IA";
export const DEMO_MOTIVO = "Cefalea de 3 días";

export function isDemoConsultation(c: {
  motivo: string;
  transcript: SpeakerTurn[];
  auditoria: AuditEvent[];
}): boolean {
  if (c.auditoria.some((a) => a.accion === DEMO_AUDIT_ACCION)) return true;
  // Compatibilidad con consultas demo creadas antes del marcador de auditoría:
  // el guion simulado siempre fija este motivo.
  if (c.motivo === DEMO_MOTIVO) return true;
  return c.transcript.some((t) =>
    t.texto.includes("dolor de cabeza los últimos tres días"),
  );
}
