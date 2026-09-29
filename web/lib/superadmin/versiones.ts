// Comparación de versiones de las apps instaladas (escritorio y móvil).
//
// Vivía embebido en app/superadmin/salud/page.tsx sin pruebas. Se saca aquí
// porque son funciones puras, y porque su resultado decide qué equipo se marca
// como "vieja" — un falso positivo ahí manda a alguien a actualizar algo que ya
// estaba al día.
//
// Deliberadamente SIN una librería de semver: las versiones que llegan de las
// apps son "1.0.0.0", "0.40", "0.1" y "0.0.0-local", que no son semver válido.
// Una librería estricta las rechazaría; esto las ordena como espera un humano.

/** Separa "1.2.3-beta.4" en segmentos numéricos y el sufijo de pre-release. */
function partes(version: string): { numeros: number[]; prerelease: string | null } {
  const limpia = version.trim().replace(/^v/i, "");
  const guion = limpia.indexOf("-");
  const base = guion === -1 ? limpia : limpia.slice(0, guion);
  const prerelease = guion === -1 ? null : limpia.slice(guion + 1);
  const numeros = base.split(".").map((s) => {
    const n = Number.parseInt(s, 10);
    return Number.isNaN(n) ? 0 : n;
  });
  return { numeros, prerelease };
}

/**
 * true si `a` es anterior a `b`.
 *
 * Compara por segmentos numéricos (así 1.10 > 1.9, que un compare de textos
 * fallaría) y trata una pre-release como ANTERIOR a su release: "1.0.0-beta" es
 * más vieja que "1.0.0". La versión anterior de esta función mapeaba cualquier
 * segmento no numérico a 0, así que "1.2.0-beta.3" y "1.2.0" salían iguales y
 * una beta nunca se marcaba como desactualizada.
 */
export function versionEsAnterior(a: string, b: string): boolean {
  const pa = partes(a);
  const pb = partes(b);

  const largo = Math.max(pa.numeros.length, pb.numeros.length);
  for (let i = 0; i < largo; i += 1) {
    const da = pa.numeros[i] ?? 0;
    const db = pb.numeros[i] ?? 0;
    if (da !== db) return da < db;
  }

  // Mismos números: la que tiene sufijo va antes.
  if (pa.prerelease && !pb.prerelease) return true;
  if (!pa.prerelease && pb.prerelease) return false;
  if (pa.prerelease && pb.prerelease) return pa.prerelease < pb.prerelease;
  return false;
}

/**
 * La versión más alta de un conjunto.
 *
 * Importa MUCHO con qué conjunto se llama: antes recibía solo las 20 filas que
 * se mostraban (las de last_seen más reciente), así que si el equipo con el
 * build más nuevo llevaba días apagado, "la última versión" retrocedía sola y
 * todos los demás perdían su distintivo de "vieja". Ahora la RPC devuelve el
 * conjunto de versiones de TODA la tabla en `dispositivos.*_versiones`.
 */
export function versionMasReciente(versiones: (string | null | undefined)[]): string | null {
  let max: string | null = null;
  for (const v of versiones) {
    if (!v) continue;
    if (max === null || versionEsAnterior(max, v)) max = v;
  }
  return max;
}

/** true si `version` está por debajo de la más reciente conocida. */
export function estaDesactualizada(
  version: string | null | undefined,
  masReciente: string | null,
): boolean {
  if (!version || !masReciente) return false;
  return versionEsAnterior(version, masReciente);
}

// --- Estado de conexión de un equipo ---------------------------------------

export type EstadoDispositivo = "en_linea" | "hoy" | "reciente" | "inactivo" | "nunca";

const MIN = 60_000;

/**
 * Cuatro estados en vez del binario verde/gris anterior.
 *
 * "Visto hoy" solo no distingue entre un equipo que está trabajando ahora mismo
 * y uno que se conectó a las 7 de la mañana; y a las 00:01 todo el parque se
 * apaga de golpe aunque no haya pasado nada.
 */
export function estadoDispositivo(
  lastSeenAt: string | null | undefined,
  esDeHoy: (iso: string) => boolean,
): EstadoDispositivo {
  if (!lastSeenAt) return "nunca";
  const transcurrido = Date.now() - new Date(lastSeenAt).getTime();
  if (transcurrido < 15 * MIN) return "en_linea";
  if (esDeHoy(lastSeenAt)) return "hoy";
  if (transcurrido < 7 * 24 * 60 * MIN) return "reciente";
  return "inactivo";
}

export const ESTADO_DISPOSITIVO: Record<
  EstadoDispositivo,
  { punto: string; etiqueta: string }
> = {
  en_linea: { punto: "bg-success animate-pulse", etiqueta: "En línea ahora" },
  hoy: { punto: "bg-success", etiqueta: "Visto hoy" },
  reciente: { punto: "bg-warning", etiqueta: "Visto esta semana" },
  inactivo: { punto: "bg-mist", etiqueta: "Sin conectarse hace más de una semana" },
  nunca: { punto: "bg-mist", etiqueta: "Nunca se ha conectado" },
};
