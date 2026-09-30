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

/**
 * Pega una frase nueva al texto acumulado. Una frase que abre voz nueva empieza
 * con salto de línea y se pega tal cual; las demás, con un espacio.
 */
export function joinDictation(prev: string, next: string): string {
  const base = prev.replace(/\s+$/, "");
  if (!base.trim()) return next.replace(/^\s+/, "");
  return next.startsWith("\n") ? `${base}${next}` : `${base} ${next}`;
}
