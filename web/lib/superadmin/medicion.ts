// Tipos y formateo para la consola de medición de impacto. Espejo del jsonb que
// devuelven las RPCs superadmin_medicion_* (Graph escribe metrics_*, estas RPCs
// leen). "No medido" se muestra como no disponible, JAMÁS como cero — la regla
// heredada de Métricas de consultas: un cero inventado miente.

export const FASES = ["baseline", "notes", "notes_ops"] as const;
export type Fase = (typeof FASES)[number];

export const ETIQUETA_FASE: Record<string, string> = {
  baseline: "Sin Miracle (baseline)",
  notes: "Miracle Notes",
  notes_ops: "Notes + Operations",
};

export type ResumenMedicion = {
  rango: { from: string; to: string; phase: string | null };
  kpis: {
    turnos: number;
    activo_min_prom: number;
    his_min_prom: number;
    escritura_min_prom: number;
    clics_prom: number;
    context_switches_prom: number;
    post_atencion_min_prom: number;
    cola_post_turno_min_prom: number;
    sap_espera_seg_prom: number;
    ready_ms_p95: number;
    encounters_prom: number;
  };
  serie: { fecha: string; turnos: number; activo_min: number; his_min: number }[];
  por_medico: {
    doctor_id: string | null;
    nombre: string;
    turnos: number;
    activo_min: number;
    his_min: number;
    post_min: number;
  }[];
  por_app: Record<string, number>;
  cobertura: {
    turnos_totales: number;
    turnos_medidos: number;
    turnos_excluidos: number;
    cobertura_media_pct: number;
  };
  turnos: TurnoFila[];
  page: number;
  page_size: number;
};

export type TurnoFila = {
  shift_id: string;
  fecha: string;
  phase: string;
  doctor_id: string | null;
  activo_min: number;
  his_min: number;
  clics: number;
  encounters: number;
  post_min: number;
  calidad_ok: boolean;
  cobertura_pct: number | null;
};

export type ComparacionFases = {
  rango: { from: string; to: string };
  por_fase: Record<
    string,
    {
      n: number;
      activo_min_mediana: number | null;
      his_min_mediana: number | null;
      escritura_min_mediana: number | null;
      clics_mediana: number | null;
      context_switches_mediana: number | null;
      post_min_mediana: number | null;
      sap_espera_seg_mediana: number | null;
    }
  >;
  por_medico: {
    doctor_id: string | null;
    nombre: string;
    phase: string;
    activo_min_mediana: number | null;
    his_min_mediana: number | null;
    n: number;
  }[];
};

/** Minutos con un decimal, o «—» si no hay dato (nunca «0.0» inventado). */
export function fmtMin(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${Number(v).toFixed(1)} min`;
}

export function fmtSeg(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${Number(v).toFixed(1)} s`;
}

export function fmtNum(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return Math.round(Number(v)).toLocaleString("es-CO");
}

export function fmtMsSeg(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return "—";
  return `${(Number(ms) / 1000).toFixed(1)} s`;
}

/** La reducción de una métrica entre dos fases, en %. Positivo = bajó (bueno para
 * tiempo/clics). «—» si falta alguna de las dos. */
export function reduccionPct(antes: number | null | undefined, despues: number | null | undefined): string {
  if (antes == null || despues == null || antes === 0) return "—";
  const pct = ((antes - despues) / antes) * 100;
  const signo = pct >= 0 ? "−" : "+";
  return `${signo}${Math.abs(pct).toFixed(0)}%`;
}

/** Tiempo en Miracle sale de la app 'miracle_web' del reparto por app; a minutos. */
export function minutosApp(porApp: Record<string, number>, app: string): number | null {
  const ms = porApp?.[app];
  return ms == null ? null : ms / 60000;
}
