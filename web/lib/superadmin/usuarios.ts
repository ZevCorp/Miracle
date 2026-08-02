// Tipos y reglas compartidas de la consola de super-admin.
//
// Viven aquí porque los usan varias páginas (Analítica, Usuarios, Salud y el
// detalle de organización): duplicarlos en cada page.tsx fue el estado anterior
// y las copias ya habían empezado a divergir.

/** Fila de usuario tal como la devuelve la RPC `superadmin_activity`. */
export type ActivityUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  organization_id: string | null;
  created_at: string;
  onboarding_completed_at: string | null;
  last_sign_in_at: string | null;
  last_activity_at: string | null;
  consultations_total: number;
  consultations_7d: number;
  consultations_30d: number;
  encounters_total: number;
  encounters_7d: number;
  encounters_30d: number;
};

/** Payload completo de `superadmin_activity`. */
export type ActivityPayload = {
  generated_at: string;
  active: {
    total_users: number;
    total_doctors: number;
    signed_in_today: number;
    signed_in_7d: number;
    signed_in_30d: number;
    working_7d: number;
    working_30d: number;
    never_signed_in: number;
    never_worked: number;
    onboarding_pending: number;
  };
  users: ActivityUser[];
  adoption: {
    templates_total: number;
    templates_used: number;
    top_templates: { name: string; specialty: string; uses: number }[];
    weekly: { week: string; consultations: number; encounters: number; doctors: number }[];
  };
  health: {
    funnel: { status: string; count: number }[];
    failed_total: number;
    failed_7d: number;
    stuck_7d: number;
    consultations_7d: number;
    encounters_7d: number;
    audit_events_7d: number;
  };
};

/** Etiquetas legibles de los estados del asistente clínico, en orden de pipeline. */
export const ENCOUNTER_STATUS_LABEL: Record<string, string> = {
  created: "Creada",
  recording: "Grabando",
  transcript_ready: "Transcrita",
  note_generating: "Generando nota",
  note_generated: "Nota generada",
  completed: "Completada",
  failed: "Fallida",
};

/** Orden canónico del embudo: el pipeline real, no el conteo. */
export const ENCOUNTER_PIPELINE_ORDER = [
  "created",
  "recording",
  "transcript_ready",
  "note_generating",
  "note_generated",
  "completed",
  "failed",
];

export type UserStateResult = {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
  hint: string;
};

/**
 * Estado de uso de una persona. Solo los médicos dictan: para el resto de roles
 * "no ha dictado nunca" no es abandono, así que se mide únicamente el acceso.
 */
export function userState(user: ActivityUser): UserStateResult {
  const isDoctor = user.role === "medico";
  const work7 = user.consultations_7d + user.encounters_7d;
  const work30 = user.consultations_30d + user.encounters_30d;

  if (!user.last_sign_in_at) {
    return { label: "Nunca entró", tone: "danger", hint: "Cuenta creada, sin un solo ingreso." };
  }
  if (!isDoctor) {
    const signedRecently =
      new Date(user.last_sign_in_at).getTime() > Date.now() - 30 * 86_400_000;
    return signedRecently
      ? { label: "Activo", tone: "success", hint: "Ingresó en los últimos 30 días." }
      : { label: "Inactivo", tone: "neutral", hint: "Sin ingresos en 30 días." };
  }
  if (work7 > 0) {
    return { label: "Activo", tone: "success", hint: "Dictó esta semana." };
  }
  if (work30 > 0) {
    return { label: "Bajó el uso", tone: "warning", hint: "Dictó este mes, pero no esta semana." };
  }
  if (!user.last_activity_at) {
    return {
      label: "Entró sin usar",
      tone: "danger",
      hint: "Ingresó alguna vez pero nunca generó una consulta.",
    };
  }
  return { label: "Inactivo", tone: "neutral", hint: "Sin consultas en los últimos 30 días." };
}
