// Contrato de la RPC `hospital_dashboard` (migración 20260808120000).
//
// Es la ÚNICA fuente de las cifras del panel institucional: el dashboard del
// administrador y /app/reportes leen de aquí. Antes cada pantalla calculaba sus
// propios totales sobre el store del cliente —capado a 300 consultas— y con
// criterios distintos sobre qué contar, así que mostraban números diferentes
// del mismo dato. Si hace falta una métrica nueva, se agrega a la RPC y a este
// tipo; no se vuelve a calcular en una pantalla.

import {
  STATUS_LABEL,
  TYPE_LABEL,
  type ConsultationStatus,
  type ConsultationType,
} from "@/lib/mock";

/** Valor con comparación contra la ventana inmediatamente anterior. */
export type Kpi = {
  value: number;
  previous?: number;
  /** null cuando la ventana anterior está en cero (no hay base para un %). */
  delta_pct: number | null;
};

export type HospitalDashboard = {
  generated_at: string;
  rango: { desde: string; hasta: string; dias: number };
  kpis: {
    consultas: Kpi;
    medicos_activos: Kpi;
    pacientes: Kpi;
    completitud: Kpi;
    /** Notas aprobadas o exportadas dentro del rango. */
    firmadas: { value: number };
    /** Notas con diagnóstico CIE-10 aceptado dentro del rango. */
    con_dx: { value: number };
    /** Cola de firma sobre TODO el histórico, no sobre el rango. */
    por_firmar: { value: number };
    total_historico: { value: number };
  };
  serie_diaria: { fecha: string; consultas: number }[];
  por_estado: { estado: string; value: number }[];
  por_servicio: { servicio: string; value: number; completitud: number }[];
  por_tipo: { tipo: string; value: number }[];
  por_medico: MedicoActividad[];
};

export type MedicoActividad = {
  medico_id: string;
  nombre: string;
  consultas: number;
  sin_firmar: number;
  completitud: number;
  /** Última nota en todo el histórico. null = nunca ha documentado. */
  ultima: string | null;
};

/** Dashboard vacío: permite renderizar la página sin ramas condicionales. */
export const DASHBOARD_VACIO: HospitalDashboard = {
  generated_at: "",
  rango: { desde: "", hasta: "", dias: 0 },
  kpis: {
    consultas: { value: 0, delta_pct: null },
    medicos_activos: { value: 0, delta_pct: null },
    pacientes: { value: 0, delta_pct: null },
    completitud: { value: 0, delta_pct: null },
    firmadas: { value: 0 },
    con_dx: { value: 0 },
    por_firmar: { value: 0 },
    total_historico: { value: 0 },
  },
  serie_diaria: [],
  por_estado: [],
  por_servicio: [],
  por_tipo: [],
  por_medico: [],
};

/**
 * Cliente mínimo que sirve tanto al servidor como al navegador: ambos exponen
 * `rpc`. Se tipa así en vez de importar SupabaseClient para no arrastrar el
 * genérico de Database a un módulo que solo necesita una llamada.
 */
type ClienteRpc = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/**
 * Trae las métricas de la organización del usuario autenticado.
 *
 * Nunca lanza: un fallo de red o una RPC que todavía no existe en la base
 * devuelven el dashboard vacío y un mensaje. El panel de un administrador no
 * debe convertirse en una pantalla de error porque una cifra no cargó — el
 * resto de la página (accesos, cola de firma) sigue siendo útil.
 */
export async function fetchHospitalDashboard(
  db: ClienteRpc,
  rango: { desde: string; hasta: string },
): Promise<{ data: HospitalDashboard; error: string | null }> {
  const { data, error } = await db.rpc("hospital_dashboard", {
    p_from: rango.desde,
    p_to: rango.hasta,
  });

  if (error || !data) {
    return {
      data: DASHBOARD_VACIO,
      error: error?.message ?? "No fue posible calcular las métricas.",
    };
  }

  return { data: data as HospitalDashboard, error: null };
}

/**
 * Base mínima de la ventana anterior para que un porcentaje de variación
 * signifique algo.
 */
const BASE_MINIMA_COMPARACION = 5;

/**
 * Props de comparación para un StatTile de conteo.
 *
 * Un porcentaje sobre una base diminuta desinforma: una institución que pasó de
 * 2 a 322 notas al arrancar el piloto tiene un "+16000%", una cifra que se lee
 * como un error de cálculo y no como un buen mes. Por debajo de la base mínima
 * se muestra la comparación en crudo, que sí se entiende.
 */
export function comparacion(
  kpi: Kpi,
  etiquetaPrevio: string,
): { deltaPct?: number | null; previousLabel?: string; footnote?: string } {
  if (kpi.delta_pct === null || (kpi.previous ?? 0) < BASE_MINIMA_COMPARACION) {
    return kpi.previous === undefined
      ? {}
      : { footnote: `antes: ${kpi.previous.toLocaleString("es-CO")}` };
  }
  return { deltaPct: kpi.delta_pct, previousLabel: etiquetaPrevio };
}

/**
 * Comparación de una métrica que YA es un porcentaje (completitud).
 *
 * Nunca como variación relativa: "bajó 34%" cuando la completitud pasó de 89% a
 * 59% invita a restar 34 de 89. La diferencia se expresa en puntos, que es la
 * única lectura correcta entre dos porcentajes.
 */
export function comparacionPorcentaje(kpi: Kpi): { footnote?: string } {
  if (kpi.previous === undefined || kpi.previous === 0) return {};
  const puntos = kpi.value - kpi.previous;
  const signo = puntos > 0 ? "+" : puntos < 0 ? "−" : "";
  return {
    footnote: `antes: ${kpi.previous}%${puntos === 0 ? "" : ` (${signo}${Math.abs(puntos)} pts)`}`,
  };
}

/** Etiqueta legible de un estado, tolerante a valores que no conozcamos. */
export function etiquetaEstado(estado: string): string {
  return STATUS_LABEL[estado as ConsultationStatus] ?? estado;
}

/** Etiqueta legible del tipo de atención (presencial, telemedicina…). */
export function etiquetaTipo(tipo: string): string {
  return TYPE_LABEL[tipo as ConsultationType] ?? tipo;
}

/**
 * Reparto de la cola de firma por antigüedad, para la tabla de adopción.
 * Se deja aquí (y no en la RPC) porque es presentación, no conteo.
 */
export function tonoSinFirmar(sinFirmar: number): "neutral" | "warning" | "danger" {
  if (sinFirmar === 0) return "neutral";
  return sinFirmar >= 10 ? "danger" : "warning";
}

/**
 * Suelo real de la completitud RIPS. NO es 0.
 *
 * `private.completitud_rips` reparte 5 puntos y dos de ellos —identificación y
 * finalidad— los tiene toda nota por construcción. Así que una nota literalmente
 * vacía puntúa 40, y el rango que de verdad se mueve es 40–100, no 0–100.
 *
 * Esto importa porque se lee mal por defecto: sobre los datos reales del piloto
 * (322 notas en 30 días) el 90 % de las notas puntúa exactamente 60 y solo 5
 * tienen un CIE-10 aceptado y 2 un CUPS. Es decir, hoy la completitud es casi
 * una forma cara de decir "¿está firmada?", comprimida en la franja 40–100. Un
 * "45 %" suelto se lee como "no documenta nada" cuando lo que dice es "casi
 * ninguna de sus notas está firmada".
 */
export const COMPLETITUD_MINIMA = 40;

/**
 * Muestra mínima para que el promedio de un profesional signifique algo.
 *
 * Mismo criterio que BASE_MINIMA_COMPARACION y por la misma razón: con una o
 * dos notas, un 100 % no dice que documente mejor que quien lleva 200 al 88 %,
 * dice que hizo dos. El dato se sigue mostrando, pero atenuado y con el tamaño
 * de la muestra a la vista, en vez de ordenar a la gente por ruido.
 */
export const MUESTRA_MINIMA_COMPLETITUD = 5;

/**
 * Clasifica a un profesional según su actividad en el rango.
 *
 * Es el juicio que un administrador hace de un vistazo y la razón de ser de la
 * tabla: no "cuántas notas hubo" sino "de quién tengo que ocuparme".
 */
export type EstadoAdopcion = "activo" | "rezagado" | "sin_uso" | "nunca";

export function estadoAdopcion(m: MedicoActividad): EstadoAdopcion {
  if (m.consultas === 0) return m.ultima ? "sin_uso" : "nunca";
  return m.sin_firmar > 0 && m.sin_firmar >= m.consultas / 2 ? "rezagado" : "activo";
}

export const ETIQUETA_ADOPCION: Record<EstadoAdopcion, string> = {
  activo: "Al día",
  rezagado: "Acumula sin firmar",
  sin_uso: "Sin actividad en el periodo",
  nunca: "Nunca ha documentado",
};
