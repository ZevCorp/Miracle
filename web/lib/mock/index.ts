import type {
  Consultation,
  ConsultationStatus,
  ClinicalCode,
} from "./types";
import { MOCK_TODAY } from "./consultations";

export * from "./types";
export * from "./people";
export * from "./consultations";
export * from "./templates";
export * from "./metrics";

/** Hora "HH:mm" de una fecha ISO. */
export function formatHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Etiqueta relativa: "Hoy · 14:30", "Ayer · 10:20" o "18/06 · 22:38". */
export function formatFechaRelativa(iso: string): string {
  const fecha = iso.slice(0, 10);
  const today = new Date(MOCK_TODAY + "T00:00:00");
  const target = new Date(fecha + "T00:00:00");
  const diffDias = Math.round(
    (today.getTime() - target.getTime()) / 86_400_000,
  );
  const hora = formatHora(iso);
  if (diffDias === 0) return `Hoy · ${hora}`;
  if (diffDias === 1) return `Ayer · ${hora}`;
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm} · ${hora}`;
}

export function esDeHoy(iso: string): boolean {
  return iso.slice(0, 10) === MOCK_TODAY;
}

/** Tono semántico de un estado de consulta (para badges). */
export function statusTone(
  estado: ConsultationStatus,
): "neutral" | "warning" | "accent" | "success" | "mint" {
  switch (estado) {
    case "en_curso":
      return "warning";
    case "borrador":
      return "neutral";
    case "revisada":
      return "accent";
    case "aprobada":
      return "success";
    case "exportada":
      // Antes usaba "mint" (mismo verde que "success"/aprobada, casi
      // indistinguible a simple vista). "warning" no lo usa ningún otro
      // estado visible hoy (en_curso nunca se persiste), así que resalta.
      return "warning";
  }
}

export function acceptedCodes(c: Consultation, sistema?: "CIE-10" | "CUPS") {
  return c.codigos.filter(
    (k) => k.estado === "aceptado" && (!sistema || k.sistema === sistema),
  );
}

export function suggestedCodes(c: Consultation) {
  return c.codigos.filter((k) => k.estado === "sugerido");
}

export interface RipsItem {
  label: string;
  done: boolean;
}

/** Estado de preparación para RIPS de una consulta. */
export function ripsChecklist(c: Consultation): RipsItem[] {
  const hasDx = acceptedCodes(c, "CIE-10").length > 0;
  const hasProc = acceptedCodes(c, "CUPS").length > 0;
  const aprobada = c.estado === "aprobada" || c.estado === "exportada";
  return [
    { label: "Identificación del paciente", done: true },
    { label: "Finalidad de la consulta", done: true },
    { label: "Diagnóstico principal (CIE-10)", done: hasDx },
    { label: "Procedimiento (CUPS)", done: hasProc },
    { label: "Nota revisada y aprobada", done: aprobada },
  ];
}

export function ripsListo(c: Consultation): boolean {
  return ripsChecklist(c).every((i) => i.done);
}

/** Porcentaje de completitud de una consulta (para auditoría/calidad). */
export function completitud(c: Consultation): number {
  const items = ripsChecklist(c);
  const done = items.filter((i) => i.done).length;
  return Math.round((done / items.length) * 100);
}

export function codeTone(k: ClinicalCode) {
  if (k.estado === "aceptado") return "success" as const;
  if (k.estado === "descartado") return "neutral" as const;
  return "accent" as const;
}
