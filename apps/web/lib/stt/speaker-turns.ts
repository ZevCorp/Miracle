// Quién dijo qué (spec 070). Soniox marca cada token con su hablante; aquí se
// convierte en una línea «[Hablante N] …» dentro del mismo texto que el médico
// ve, corrige y guarda. Graph la lee al armar la nota
// (services/graph/src/domain/clinical/speakerLabels.js): si cambias la forma de
// la etiqueta, cámbiala allí también, y en Windows (Verbatim.cs).

/** Un tramo de una frase final dicho por una sola voz. Lo entrega el motor de dictado. */
export interface SpeakerTurn {
  speaker: string;
  text: string;
}

/**
 * Suma el texto de un token final a los turnos: sigue el último si es la misma
 * voz, abre uno nuevo si no. Es lo que hace el motor de dictado por dentro
 * (deepgram-dictation.js, que no puede importar esto porque es vendido).
 */
export function appendTurn(turns: SpeakerTurn[], speaker: unknown, text: string): void {
  const voice = speaker == null ? "" : `${speaker}`;
  const last = turns[turns.length - 1];
  if (last && last.speaker === voice) last.text += text;
  else turns.push({ speaker: voice, text });
}

/**
 * Etiquetador de una consulta: recuerda qué voz habló la última vez, para
 * etiquetar solo los cambios, y numera las voces por orden de aparición.
 *
 * La voz se identifica por socket y número (`s{stream}:{speaker}`), igual que
 * encounter_metrics: Soniox renumera en cada reconexión, así que el «1» de un
 * socket y el «1» del siguiente pueden ser personas distintas. Se prefiere un
 * hablante de más a uno mal unido; el modelo de la nota sabe que una persona
 * puede salir con dos etiquetas.
 */
export function createSpeakerLabeler() {
  const numbers = new Map<string, number>();
  let lastKey: string | null = null;

  return (turns: SpeakerTurn[] | undefined, stream: number, fallback: string): string => {
    const voiced = (turns ?? []).filter((turn) => turn.speaker && turn.text.trim());
    // Sin hablante (Deepgram, diarización apagada): el texto de siempre.
    if (voiced.length === 0) return fallback;

    let out = "";
    for (const turn of voiced) {
      const key = `s${stream}:${turn.speaker}`;
      if (!numbers.has(key)) numbers.set(key, numbers.size + 1);
      const text = turn.text.trim();
      if (key === lastKey) {
        out = out ? `${out} ${text}` : text;
      } else {
        out = `${out}\n[Hablante ${numbers.get(key)}] ${text}`;
        lastKey = key;
      }
    }
    return out;
  };
}

/** Un turno de la transcripción ya etiquetada. `speaker` es null antes de la primera voz. */
export interface LabeledTurn {
  speaker: number | null;
  text: string;
}

const LABEL_LINE = /^\[Hablante (\d+)\][ \t]*(.*)$/;

/**
 * Parte la transcripción en turnos para la vista de voces. Una línea sin
 * etiqueta es de la voz que venía hablando (el médico puede haber partido una
 * frase al corregir); lo de antes de la primera voz no se le atribuye a nadie.
 */
export function parseSpeakerTurns(transcript: string): LabeledTurn[] {
  const turns: LabeledTurn[] = [];
  for (const line of transcript.split(/\r?\n/)) {
    const labeled = LABEL_LINE.exec(line);
    if (labeled) {
      turns.push({ speaker: Number(labeled[1]), text: labeled[2].trim() });
    } else if (line.trim()) {
      const last = turns[turns.length - 1];
      if (last) last.text = last.text ? `${last.text}\n${line.trim()}` : line.trim();
      else turns.push({ speaker: null, text: line.trim() });
    }
  }
  return turns.filter((turn) => turn.text);
}

/**
 * Qué parte de lo transcrito dijo cada voz, en caracteres (no en tiempo: el
 * tiempo por voz vive en encounter_metrics). Ordenado por número de voz y
 * redondeado por mayor resto para que siempre sume 100.
 */
export function speakerShare(turns: LabeledTurn[]): { speaker: number; percent: number }[] {
  const chars = new Map<number, number>();
  for (const turn of turns) {
    if (turn.speaker === null) continue;
    chars.set(turn.speaker, (chars.get(turn.speaker) ?? 0) + turn.text.length);
  }
  const total = [...chars.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  const rows = [...chars.entries()]
    .sort(([a], [b]) => a - b)
    .map(([speaker, n]) => ({ speaker, exact: (n * 100) / total }));
  const floors = rows.map((row) => Math.floor(row.exact));
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  rows
    .map((row, i) => ({ i, rest: row.exact - floors[i] }))
    .sort((a, b) => b.rest - a.rest)
    .forEach(({ i }) => {
      if (left > 0) {
        floors[i] += 1;
        left -= 1;
      }
    });
  return rows.map((row, i) => ({ speaker: row.speaker, percent: floors[i] }));
}

/**
 * Pega una frase nueva al texto acumulado. Una frase que abre voz nueva empieza
 * con salto de línea y se pega tal cual; las demás, con un espacio.
 */
export function joinDictation(prev: string, next: string): string {
  const base = prev.replace(/\s+$/, "");
  if (!base.trim()) return next.replace(/^\s+/, "");
  return next.startsWith("\n") ? `${base}${next}` : `${base} ${next}`;
}
