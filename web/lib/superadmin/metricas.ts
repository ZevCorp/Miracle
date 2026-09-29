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
    active_ms_p90: number;
    recording_ms_total: number;
    recording_ms_prom: number;
    recording_ms_p50: number;
    recording_ms_p90: number;
    /** Suelo, no total, mientras `consultas_sin_tarifa` sea > 0. */
    costo_usd_total: number;
    costo_usd_prom: number | null;
    costo_usd_por_minuto: number | null;
    consultas_sin_tarifa: number;
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
  /** Tiempo activo repartido por etapa. La suma equivale a active_ms_total. */
  fases: Record<string, number>;
  por_version: {
    version: string;
    consultas: number;
    active_ms_prom: number;
    recording_ms_prom: number;
    revision_ms_prom: number;
  }[];
  por_fuente: {
    fuente: string;
    consultas: number;
    recording_ms_prom: number;
    silence_pct: number;
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
  /** null cuando ninguna llamada de la consulta tenía tarifa. */
  costo_usd: number | null;
  sin_tarifa: number;
  app_version: string | null;
  audio_source: string | null;
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

/* ------------------------------------------------------------------ */
/* Calidad de la nota — contrato de `superadmin_note_quality`          */
/* ------------------------------------------------------------------ */

/**
 * Cuánto trabajo le queda al médico DESPUÉS de que la IA escribió.
 *
 * Sale de comparar las dos notas que el backend ya guardaba y nadie leía:
 * `note_json_ai` (lo que produjo la IA, congelado) contra `note_json` (lo que
 * el médico firmó). Es retroactivo y es la única métrica que dice si el
 * producto mejora: el tiempo y los tokens miden cuánto se usa, no si sirve.
 */
export type CalidadNota = {
  generated_at: string;
  rango: { desde: string; hasta: string };
  /** Una consulta sin `note_json_ai` no es perfecta: es no medible. */
  cobertura: { encuentros: number; medibles: number; pct_medible: number };
  kpis: {
    consultas: number;
    secciones_prom: number;
    editadas_prom: number;
    pct_secciones_editadas: number;
    sin_tocar: number;
    pct_sin_tocar: number;
    /** Caracteres netos que añade el médico. Negativo = recorta. */
    delta_chars_prom: number;
    /** La IA las dejó vacías y el médico las escribió. */
    secciones_rellenadas: number;
    /** La IA escribió algo que el médico borró entero. */
    secciones_vaciadas: number;
  };
  espera_nota: {
    consultas: number;
    p50_s: number | null;
    p90_s: number | null;
    prom_s: number | null;
    max_s: number | null;
  };
  embudo: {
    creadas: number;
    con_transcripcion: number;
    con_nota: number;
    completadas: number;
    fallidas: number;
    abandonadas: number;
    con_reintento: number;
  };
  por_seccion: {
    seccion: string;
    especialidad: string;
    total: number;
    editadas: number;
    pct: number;
    rellenadas: number;
    delta_chars_prom: number;
  }[];
  /**
   * Uso y calidad de cada plantilla EN LA MISMA FILA.
   *
   * `usos` cuenta todas las consultas; `pct_corregida` solo las `comparables`.
   * Los dos números van juntos para que no se lea el porcentaje como calculado
   * sobre el total de usos cuando se calculó sobre menos.
   */
  por_plantilla: {
    plantilla: string;
    especialidad: string;
    alcance: string;
    usos: number;
    medicos: number;
    comparables: number;
    secciones: number | null;
    pct_corregida: number | null;
    sin_tocar: number;
  }[];
  /** Cuánto del catálogo se usa de verdad. */
  catalogo: {
    activas: number;
    archivadas: number;
    institucionales: number;
    personales: number;
    usadas_alguna_vez: number;
    usadas_en_periodo: number;
  };
  por_especialidad: {
    especialidad: string;
    consultas: number;
    pct_editadas: number;
    sin_tocar: number;
    delta_chars_prom: number;
  }[];
  por_medico: {
    id: string;
    nombre: string;
    consultas: number;
    pct_editadas: number;
    delta_chars_prom: number;
  }[];
  serie_diaria: { date: string; consultas: number; pct_editadas: number | null }[];
};

/**
 * Segundos en forma corta ("1m 35s"). Se usa para el tiempo de espera, que se
 * mide en minutos y no en horas: reutilizar `formatMs` obligaría a multiplicar
 * en cada punto de uso y es justo donde se cuelan los errores de factor 1000.
 */
export function formatSeg(seg: number | null | undefined): string {
  if (seg === null || seg === undefined || Number.isNaN(seg)) return "—";
  return formatMs(seg * 1000);
}

/**
 * Caracteres netos con signo explícito: "+148" se lee como "el médico AÑADE",
 * que es lo que significa. Sin el "+", 148 parece un total y no un saldo.
 */
export function formatDelta(chars: number | null | undefined): string {
  if (chars === null || chars === undefined || Number.isNaN(chars)) return "—";
  const n = Math.round(chars);
  if (n === 0) return "0";
  return `${n > 0 ? "+" : ""}${n.toLocaleString("es-CO")}`;
}

/**
 * Nombre legible de la etapa. El vocabulario técnico lo fija la base
 * (`active_ms_by_phase`); traducirlo aquí evita tocar una migración cuando
 * cambie cómo le decimos a algo de cara al equipo.
 */
export const ETIQUETA_FASE: Record<string, string> = {
  captura: "Captura",
  generacion: "Generación",
  revision: "Revisión",
  otro: "Sin clasificar",
};

/** Igual para la fuente de audio. */
export const ETIQUETA_FUENTE: Record<string, string> = {
  browser_microphone: "Micrófono",
  omi: "Omi",
  mixto: "Mixto",
  "sin declarar": "Sin declarar",
};

/** Alcance de una plantilla, en el vocabulario del catálogo. */
export const ETIQUETA_ALCANCE: Record<string, string> = {
  institutional: "Institucional",
  personal: "Personal",
  desconocido: "Sin catálogo",
};
