// Agenda del día del médico: tipos y utilidades compartidas entre la tarjeta
// del dashboard (AgendaHoy) y el endpoint de importación por foto.

export type AppointmentStatus = "programada" | "atendida" | "cancelada";

export interface Appointment {
  id: string;
  pacienteNombre: string;
  pacienteDocumento?: string;
  fecha: string; // YYYY-MM-DD (día local del consultorio)
  hora: string; // HH:MM
  motivo?: string;
  estado: AppointmentStatus;
  source: "manual" | "importada";
}

/** Cita extraída de la foto del horario, antes de que el médico la confirme. */
export interface ParsedCita {
  hora: string;
  paciente: string;
  motivo?: string | null;
  documento?: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToAppointment(r: any): Appointment {
  return {
    id: r.id,
    pacienteNombre: r.paciente_nombre ?? "",
    pacienteDocumento: r.paciente_documento ?? undefined,
    fecha: r.fecha,
    hora: typeof r.hora === "string" ? r.hora.slice(0, 5) : "",
    motivo: r.motivo ?? undefined,
    estado: (r.estado as AppointmentStatus) ?? "programada",
    source: r.source === "importada" ? "importada" : "manual",
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Fecha local (no UTC: a las 7 p. m. en Bogotá aún es "hoy"). */
export function todayLocalISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Normaliza "8:30", "08.30" o "08:30:00" a "HH:MM"; null si no es válida. */
export function normalizeHora(value: string): string | null {
  const m = value.trim().match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}
