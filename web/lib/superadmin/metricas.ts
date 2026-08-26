// Contrato de las RPC `superadmin_encounter_metrics` / `superadmin_encounter_detail`
// (migración 20260827000000) y el formato de sus cifras.
//
// La regla de esta pantalla es la misma que la de Consumo IA: los números
// vienen incompletos POR CONSTRUCCIÓN — las consultas anteriores a la
// telemetría no tienen fila, el interrogatorio necesita diarización y los
// tokens solo se atribuyen desde que Graph manda session_id = encounter_id.
// Por eso el payload trae siempre `cobertura`, y la UI nunca presenta un
// promedio sin decir sobre qué porción se calculó. NULL significa "no medido"
// y se pinta como no disponible; jamás se convierte en un 0.

export type MetricasConsultas = {
  generated_at: string;
  rango: { desde: string; hasta: string; dias: number };
  kpis: {
    consultas: number;
    completadas: number;
    active_ms_total: number;
    active_ms_prom: number;
    active_ms_p50: number;
    recording_ms_total: number;
    recording_ms_prom: number;
    tokens_total: number;
    tokens_por_minuto: number | null;
    interrogation_ms_prom: number | null;
    interrogation_pct_prom: number | null;
    silence_ms_prom: number | null;
    silence_pct_prom: number | null;
  };
  /** Qué tan completos son los números de esta ventana. */
  cobertura: {
    consultas_medidas: number;
    encounters_periodo: number;
    con_tokens: number;
    sin_denominador: number;
    con_interrogatorio: number;
    con_silencios: number;
    tokens_no_atribuibles: number;
  };
  serie_diaria: {
    date: string;
    consultas: number;
    active_ms_prom: number;
    recording_ms_prom: number;
    tokens: number;
    tokens_por_minuto: number | null;
  }[];
  por_hora: { hora: number; consultas: number }[];
  por_usuario: {
    id: string;
    nombre: string;
    organizacion: string | null;
    consultas: number;
    active_ms_prom: number;
    recording_ms_prom: number;
    tokens: number;
    tokens_por_minuto: number | null;
  }[];
  por_organizacion: {
    id: string | null;
    nombre: string;
    consultas: number;
    active_ms_prom: number;
    tokens: number;
    tokens_por_minuto: number | null;
  }[];
  por_modelo: {
    provider: string;
    model: string;
    feature: string;
    eventos: number;
    tokens: number;
    costo_usd: number;
    sin_tarifa: number;
  }[];
  consultas: {
    total: number;
    page: number;
    page_size: number;
    rows: FilaConsulta[];
  };
};

export type FilaConsulta = {
  encounter_id: string;
  fecha: string;
  finalizada: boolean;
  medico: string;
  organizacion: string | null;
  active_ms: number;
  recording_ms: number;
  interrogation_ms: number | null;
  silence_ms: number | null;
  tokens: number;
  tokens_por_minuto: number | null;
};

export type DetalleConsulta = {
  generated_at: string;
  encounter: {
    id: string;
    status: string;
    consultation_type: string;
    template_id: string | null;
    template_name: string | null;
    created_at: string;
    updated_at: string | null;
    note_generated_at: string | null;
    generation_attempts: number | null;
    transcript_chars: number;
    doctor: { id: string; nombre: string; organizacion: string | null } | null;
  } | null;
  metrics: {
    encounter_id: string;
    first_used_at: string;
    last_used_at: string;
    finished_at: string | null;
    active_ms: number;
    recording_ms: number;
    flush_count: number;
    session_count: number;
    diarization: boolean;
    speaker_timeline_truncated: boolean;
    talk_ms_by_speaker: Record<string, number> | null;
    interrogation_ms: number | null;
    silence_ms: number | null;
    longest_silence_ms: number | null;
    timeline_segments: number;
    metrics_schema: number;
    algo_version: number | null;
  } | null;
  ai_usage: {
    totales: {
      eventos: number;
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      audio_seconds: number;
      costo_usd: number;
      sin_tarifa: number;
    };
    operaciones: {
      feature: string;
      provider: string;
      model: string;
      eventos: number;
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      audio_seconds: number;
      costo_usd: number;
      sin_tarifa: number;
      errores: number;
      latencia_p95: number | null;
    }[];
  };
};

/** Franja horaria pedida por la URL (?hdesde=8&hhasta=12). */
export type FranjaHoraria = {
  desde: number | null;
  hasta: number | null;
  /** "8:00 – 12:00" o null si no hay franja. */
  etiqueta: string | null;
};

/**
 * Interpreta ?hdesde/?hhasta. La franja es [desde, hasta) en hora Bogotá y
 * solo existe si AMBOS extremos son horas válidas distintas; cualquier otra
 * cosa cae a "sin franja" sin explotar (misma regla de oro que resolverRango).
 * `desde > hasta` es válido: cruza la medianoche (22 → 6).
 */
export function resolverFranjaHoraria(sp: {
  hdesde?: string;
  hhasta?: string;
}): FranjaHoraria {
  const parse = (v: string | undefined): number | null => {
    if (v === undefined || !/^\d{1,2}$/.test(v)) return null;
    const n = Number(v);
    return n >= 0 && n <= 23 ? n : null;
  };
  const desde = parse(sp.hdesde);
  const hasta = parse(sp.hhasta);
  if (desde === null || hasta === null || desde === hasta) {
    return { desde: null, hasta: null, etiqueta: null };
  }
  return { desde, hasta, etiqueta: `${desde}:00 – ${hasta}:00` };
}

/**
 * Milisegundos en forma legible: "18m 32s", "1h 04m", "45s", "—" si no hay
 * dato. Un dashboard compara órdenes de magnitud; los ms exactos no aportan.
 */
export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "—";
  if (ms <= 0) return "0s";
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

/** Porcentaje entero o "—". El NULL de "no medido" nunca se disfraza de 0 %. */
export function formatPct(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return "—";
  return `${Math.round(pct)}%`;
}
