// Resolución del rango de fechas de la consola.
//
// Todo el estado de la consola vive en la URL (?rango=30, ?rango=custom&desde=…)
// para que las páginas sigan siendo server components y los enlaces se puedan
// compartir. Este módulo es la única fuente de verdad sobre qué significa esa
// URL: lo usan el Resumen, la Analítica, el explorador de actividad y sus
// exportaciones, y todos deben interpretarla igual.
//
// Regla de oro: una URL inválida NUNCA lanza. Cae al rango por defecto. Un
// enlace mal copiado no puede tumbar la consola de plataforma.

import { claveDiaZona } from "@/lib/dates";

export const RANGOS_PRESET = ["7", "30", "90", "365"] as const;
export type ClavePreset = (typeof RANGOS_PRESET)[number];
export type ClaveRango = ClavePreset | "custom";

const DIAS_POR_DEFECTO = 30;
/** Tope duro: 366 puntos es lo máximo que la gráfica diaria puede dibujar. */
const MAX_DIAS = 366;

const ETIQUETA_PRESET: Record<ClavePreset, string> = {
  "7": "Últimos 7 días",
  "30": "Últimos 30 días",
  "90": "Últimos 90 días",
  "365": "Último año",
};

export type RangoResuelto = {
  clave: ClaveRango;
  /** Largo en días de calendario, ambos extremos incluidos. */
  dias: number;
  /** "YYYY-MM-DD" en zona clínica. */
  desde: string;
  hasta: string;
  /** Ventana inmediatamente anterior, del mismo largo (para comparar). */
  desdePrevio: string;
  hastaPrevio: string;
  /** "Últimos 30 días" o "18/06/2026 – 03/08/2026". */
  etiqueta: string;
  /** Argumentos para las RPC del dashboard. */
  rpcArgs: { p_from: string; p_to: string };
  /** Parámetros a preservar en enlaces (paginador, chips, exportación). */
  params: Record<string, string | undefined>;
};

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Milisegundos UTC de una clave "YYYY-MM-DD", o null si no es una fecha real. */
function msDeClave(clave: string): number | null {
  if (!RE_FECHA.test(clave)) return null;
  const [anio, mes, dia] = clave.split("-").map(Number);
  const ms = Date.UTC(anio, mes - 1, dia);
  const d = new Date(ms);
  // Rechaza "2026-02-31": Date.UTC lo desborda a marzo en silencio.
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return null;
  }
  return ms;
}

function claveDeMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function sumarDias(clave: string, dias: number): string {
  return claveDeMs((msDeClave(clave) ?? 0) + dias * 86_400_000);
}

function diasEntre(desde: string, hasta: string): number {
  return ((msDeClave(hasta) ?? 0) - (msDeClave(desde) ?? 0)) / 86_400_000 + 1;
}

function ddmmaaaa(clave: string): string {
  const [anio, mes, dia] = clave.split("-");
  return `${dia}/${mes}/${anio}`;
}

/**
 * Interpreta ?rango/?desde/?hasta y devuelve una ventana concreta.
 *
 * Siempre resuelve a fechas explícitas (nunca "los últimos N días" a secas):
 * así la etiqueta que ve el usuario, el SQL que se ejecuta y el CSV que se
 * descarga hablan exactamente del mismo periodo.
 */
export function resolverRango(sp: {
  rango?: string;
  desde?: string;
  hasta?: string;
}): RangoResuelto {
  const hoy = claveDiaZona(new Date());

  const pedido = (RANGOS_PRESET as readonly string[]).includes(sp.rango ?? "")
    ? (sp.rango as ClavePreset)
    : sp.rango === "custom"
      ? "custom"
      : null;

  if (pedido === "custom") {
    const desdeMs = msDeClave(sp.desde ?? "");
    const hastaMs = msDeClave(sp.hasta ?? "");

    if (desdeMs !== null && hastaMs !== null && desdeMs <= hastaMs) {
      // El futuro se recorta a hoy: pedir hasta 2030 no es un error del usuario,
      // es una franja vacía que haría parecer que la plataforma dejó de usarse.
      const hasta = claveDeMs(Math.min(hastaMs, msDeClave(hoy) ?? hastaMs));
      let desde = claveDeMs(Math.min(desdeMs, msDeClave(hasta) ?? desdeMs));
      if (diasEntre(desde, hasta) > MAX_DIAS) desde = sumarDias(hasta, -(MAX_DIAS - 1));
      return construir("custom", desde, hasta);
    }
    // Custom mal formado → por defecto, sin explotar.
  }

  const dias = pedido && pedido !== "custom" ? Number(pedido) : DIAS_POR_DEFECTO;
  const clave = (pedido && pedido !== "custom" ? pedido : String(DIAS_POR_DEFECTO)) as ClavePreset;
  return construir(clave, sumarDias(hoy, -(dias - 1)), hoy);
}

function construir(clave: ClaveRango, desde: string, hasta: string): RangoResuelto {
  const dias = diasEntre(desde, hasta);
  return {
    clave,
    dias,
    desde,
    hasta,
    desdePrevio: sumarDias(desde, -dias),
    hastaPrevio: sumarDias(desde, -1),
    etiqueta:
      clave === "custom"
        ? `${ddmmaaaa(desde)} – ${ddmmaaaa(hasta)}`
        : ETIQUETA_PRESET[clave as ClavePreset],
    rpcArgs: { p_from: desde, p_to: hasta },
    params:
      clave === "custom"
        ? { rango: "custom", desde, hasta }
        : clave === String(DIAS_POR_DEFECTO)
          ? {} // el rango por defecto no ensucia la URL
          : { rango: clave },
  };
}

/**
 * Límites medio-abiertos [inicio, fin) en ISO con offset explícito, para
 * filtrar columnas `timestamptz` desde PostgREST.
 *
 * Se escribe el offset -05:00 literal en vez de convertir con Intl: Colombia no
 * tiene horario de verano y no ha cambiado de offset desde 1993, así que es
 * exacto y evita una conversión con más superficie de error. Si algún día hay
 * operación en otra zona, esto se deriva de ZONA_CLINICA.
 */
export function limitesIso(rango: Pick<RangoResuelto, "desde" | "hasta">): {
  desdeIso: string;
  hastaIso: string;
} {
  return {
    desdeIso: `${rango.desde}T00:00:00-05:00`,
    hastaIso: `${sumarDias(rango.hasta, 1)}T00:00:00-05:00`,
  };
}

/** Etiqueta para comparaciones: "vs. los 30 días anteriores". */
export function etiquetaPeriodoAnterior(rango: RangoResuelto): string {
  return rango.dias === 1 ? "vs. el día anterior" : `vs. los ${rango.dias} días anteriores`;
}
