import { describe, expect, it } from "vitest";
import {
  appendTokenSegments,
  hasDiarization,
  MERGE_GAP_MS,
  type TimelineSegment,
} from "@/lib/stt/usage-segments";

// La línea de tiempo que llega a encounter_metrics: tokens del proveedor →
// segmentos [spk, start, end, stream] sobre el eje de grabación acumulada.

describe("appendTokenSegments", () => {
  it("aplica el offset del tramo y el ordinal del stream", () => {
    const out = appendTokenSegments(
      [],
      [{ speaker: 1, start_ms: 100, end_ms: 600 }],
      10_000,
      2,
    );
    expect(out).toEqual([[1, 10_100, 10_600, 2]]);
  });

  it("funde tokens contiguos del mismo hablante y separa al cambiar de hablante", () => {
    const out = appendTokenSegments(
      [],
      [
        { speaker: 1, start_ms: 0, end_ms: 400 },
        { speaker: 1, start_ms: 400 + MERGE_GAP_MS, end_ms: 1200 }, // hueco = tope → funde
        { speaker: 2, start_ms: 1300, end_ms: 1900 },
        { speaker: 1, start_ms: 1900 + MERGE_GAP_MS + 1, end_ms: 2600 }, // hueco > tope
      ],
      0,
      0,
    );
    expect(out).toEqual([
      [1, 0, 1200, 0],
      [2, 1300, 1900, 0],
      [1, 1900 + MERGE_GAP_MS + 1, 2600, 0],
    ]);
  });

  it("no funde entre streams distintos aunque el hablante coincida", () => {
    const into: TimelineSegment[] = [[1, 0, 500, 0]];
    appendTokenSegments(into, [{ speaker: 1, start_ms: 0, end_ms: 400 }], 600, 1);
    expect(into).toEqual([
      [1, 0, 500, 0],
      [1, 600, 1000, 1],
    ]);
  });

  it("descarta tokens sin timing utilizable y tolera tokens ausentes", () => {
    const out = appendTokenSegments(
      [],
      [
        { start_ms: Number.NaN, end_ms: 100 },
        { start_ms: 200, end_ms: 200 }, // duración cero
        { speaker: 0, start_ms: 300, end_ms: 500 },
      ],
      0,
      0,
    );
    expect(out).toEqual([[0, 300, 500, 0]]);
    expect(appendTokenSegments([], undefined, 0, 0)).toEqual([]);
  });
});

describe("hasDiarization", () => {
  it("solo hay diarización si algún segmento trae hablante distinto de 0", () => {
    expect(hasDiarization([[0, 0, 100, 0]])).toBe(false);
    expect(hasDiarization([[0, 0, 100, 0], [2, 200, 400, 0]])).toBe(true);
    expect(hasDiarization([])).toBe(false);
  });
});
