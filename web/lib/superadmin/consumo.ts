// Contrato de la RPC `superadmin_ai_usage` (migración 20260819120000) y el
// formato de sus cifras.
//
// El dinero de esta tabla está incompleto por construcción: un modelo sin fila
// en `ai_model_prices` produce eventos con `cost_usd` nulo. Por eso cada bloque
// que lleva un costo lleva también `sin_tarifa`, y la pantalla nunca presenta un
// total en dólares sin decir sobre qué porción del volumen se calculó.

export type Kpi = { value: number; previous?: number; delta_pct: number | null };

export type ConsumoIa = {
  generated_at: string;
  rango: { desde: string; hasta: string; dias: number };
  kpis: {
    tokens: Kpi;
    costo_usd: Kpi;
    eventos: Kpi;
    errores: { value: number; total: number };
  };
  /** Qué tan completos son los números de esta ventana. */
  cobertura: {
    tokens: number;
    tokens_sin_tarifa: number;
    pct_sin_tarifa: number;
    eventos: number;
    eventos_sin_atribucion: number;
    pct_sin_atribucion: number;
  };
  serie_diaria: { date: string; tokens: number; costo_usd: number; eventos: number }[];
  por_feature: {
    app: string;
    feature: string;
    provider: string;
    model: string;
    eventos: number;
    tokens: number;
    costo_usd: number;
    /** Llamadas cuyo costo no se pudo calcular. > 0 ⇒ el costo es un mínimo. */
    sin_tarifa: number;
  }[];
  modelos_sin_tarifa: { provider: string; model: string; eventos: number; tokens: number }[];
  por_organizacion: {
    id: string | null;
    nombre: string;
    eventos: number;
    tokens: number;
    costo_usd: number;
    sin_tarifa: number;
    usuarios: number;
  }[];
  por_usuario: {
    id: string;
    nombre: string;
    organizacion: string | null;
    eventos: number;
    tokens: number;
    costo_usd: number;
    sin_tarifa: number;
  }[];
  fiabilidad: {
    feature: string;
    eventos: number;
    errores: number;
    pct_error: number;
    latencia_p95: number | null;
  }[];
};

/**
 * Nombres legibles de las funciones que consumen modelos.
 *
 * El ledger guarda el identificador técnico que emite cada app
 * (`note_generation`, `conscious_bridge`…). Se traduce aquí y no en la base
 * porque es vocabulario de producto: si mañana cambia cómo se llama algo de cara
 * al equipo, no hay que tocar una migración. Lo que no esté en el mapa se
 * muestra tal cual, que es mejor que esconder una función nueva.
 */
export const ETIQUETA_FEATURE: Record<string, string> = {
  note_generation: "Generación de notas",
  clinical_structuring: "Estructuración clínica",
  conscious_bridge: "Puente del asistente",
  live_voice: "Dictado en vivo",
  field_matching: "Relleno de campos",
  organizer_setup: "Configuración del organizador",
  parse_schedule: "Agenda desde foto",
  snippet_categorization: "Categorización de atajos",
  note_from_photo: "Nota desde foto",
  live_transcription: "Transcripción en vivo",
};

/**
 * Tokens en forma corta. Un dashboard de consumo maneja millones, y
 * "4.952.080" ocupa una columna entera para una precisión que nadie usa: lo que
 * se compara es el orden de magnitud entre funciones.
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return tokens.toLocaleString("es-CO");
}

/**
 * Dólares con los decimales que hagan falta para no imprimir "$0.00".
 *
 * Con el volumen actual una función entera cuesta centavos: redondear a dos
 * decimales convertiría casi toda la tabla en ceros y haría parecer que no se
 * gasta nada. Por debajo de un dólar se muestran cuatro decimales.
 */
export function formatUsd(usd: number | null): string {
  if (usd === null || Number.isNaN(usd)) return "—";
  if (usd === 0) return "$0";
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
