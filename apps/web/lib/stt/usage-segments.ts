// Reducción de tokens del proveedor STT a la línea de tiempo de telemetría.
//
// El motor (DIVERGENCIA 5 de deepgram-dictation.js) entrega, por cada segmento
// final, los tokens con {speaker, start_ms, end_ms} RELATIVOS AL SOCKET en
// curso. Aquí se convierten a segmentos compactos [spk, start, end, stream]
// sobre el eje de grabación acumulada de la consulta:
//
// * `offsetMs` es cuánta grabación llevaba la consulta cuando ese socket
//   arrancó. Sumarlo pone todos los streams en un solo eje y deja las pausas
//   manuales descontadas por construcción.
// * `stream` es el ordinal del socket: las etiquetas de hablante del proveedor
//   NO son estables entre reconexiones, y la base necesita saberlo para no
//   cruzar hablantes de sockets distintos (ver compute_conversation_metrics).
// * Tokens consecutivos del mismo hablante con hueco ≤ MERGE_GAP_MS se funden:
//   un stream palabra-a-palabra generaría miles de entradas sin información
//   extra (la base vuelve a fusionar con umbral de 1 s de todos modos).
//
// SIN TEXTO: por este canal solo viajan números. La transcripción tiene su
// propio camino y este módulo no debe tocarla jamás.

export interface TokenTiming {
  speaker?: number;
  start_ms: number;
  end_ms: number;
}

/** [hablante, inicio_ms, fin_ms, stream] — el formato que guarda la base. */
export type TimelineSegment = [number, number, number, number];

/** Huecos menores a esto entre tokens del mismo hablante se consideran la
    misma locución al compactar. */
export const MERGE_GAP_MS = 300;

/**
 * Convierte los tokens de UN segmento final en segmentos de línea de tiempo y
 * los anexa a `into` (que puede traer los de segmentos anteriores). Devuelve
 * `into` para encadenar. Si el último segmento acumulado es contiguo (mismo
 * hablante y stream, hueco ≤ MERGE_GAP_MS) se extiende en vez de duplicar.
 */
export function appendTokenSegments(
  into: TimelineSegment[],
  tokens: readonly TokenTiming[] | undefined,
  offsetMs: number,
  stream: number,
): TimelineSegment[] {
  if (!Array.isArray(tokens)) return into;
  for (const token of tokens) {
    const start = Math.round(offsetMs + Number(token?.start_ms));
    const end = Math.round(offsetMs + Number(token?.end_ms));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const speaker = Number(token?.speaker) || 0;

    const last = into[into.length - 1];
    if (
      last &&
      last[0] === speaker &&
      last[3] === stream &&
      start - last[2] <= MERGE_GAP_MS &&
      start >= last[1]
    ) {
      last[2] = Math.max(last[2], end);
    } else {
      into.push([speaker, start, end, stream]);
    }
  }
  return into;
}

/** true si algún segmento trae etiqueta de hablante (diarización activa). */
export function hasDiarization(segments: readonly TimelineSegment[]): boolean {
  return segments.some((s) => s[0] !== 0);
}
