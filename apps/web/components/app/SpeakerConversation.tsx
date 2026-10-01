"use client";

import { useEffect, useMemo, useRef } from "react";
import { parseSpeakerTurns, speakerShare } from "@/lib/stt/speaker-turns";

// Quién dijo qué (spec 070): la transcripción partida por voces, como la separa
// Soniox. Lee las líneas «[Hablante N]» del mismo texto que el médico corrige,
// así que lo que se ve aquí es exactamente lo que recibe la nota.
//
// Monocromática a propósito: la primera versión daba un color a cada voz y se
// devolvió el 2026-09-30 — seis colores compiten con el texto, que es lo único
// que importa. Las voces se distinguen por el número y por el relleno del
// círculo (tinta, papel con borde de tinta, gris), igual que en Windows
// (apps/windows/windows-client/src/Ui/VocesEnVivo.cs).

const FILLS = [
  "border-ink bg-ink text-surface",
  "border-ink bg-surface text-ink",
  "border-muted bg-pearl text-ink",
];

function Circle({ speaker, small = false }: { speaker: number | null; small?: boolean }) {
  const fill = speaker === null ? "border-line bg-transparent text-muted" : FILLS[(speaker - 1) % FILLS.length];
  const size = small ? "h-4 w-4 text-[9.5px]" : "h-[26px] w-[26px] text-[12px]";
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full border font-semibold tabular-nums ${size} ${fill}`}
    >
      {speaker ?? "—"}
    </span>
  );
}

export function SpeakerConversation({ transcript, live }: { transcript: string; live: boolean }) {
  const turns = useMemo(() => parseSpeakerTurns(transcript), [transcript]);
  const shares = useMemo(() => speakerShare(turns), [turns]);
  const listRef = useRef<HTMLOListElement>(null);
  const lastVoice = [...turns].reverse().find((turn) => turn.speaker !== null)?.speaker ?? null;

  // Mientras se graba, lo último dicho a la vista.
  useEffect(() => {
    if (live && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [live, turns.length, transcript]);

  if (shares.length === 0) return null;

  return (
    <section aria-label="Quién habla" className="mt-4 rounded-md border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-3.5 py-2.5">
        <span className="mr-1 text-[12px] font-semibold uppercase tracking-wide text-muted">
          Quién habla
        </span>
        {shares.map(({ speaker, percent }) => {
          const speaking = live && speaker === lastVoice;
          return (
            <span
              key={speaker}
              title="Parte del texto transcrito que dijo esta voz"
              className={`inline-flex items-center gap-1.5 rounded-full border bg-surface py-0.5 pl-1.5 pr-2.5 text-[12px] font-semibold text-ink ${
                speaking ? "border-ink" : "border-line"
              }`}
            >
              <Circle speaker={speaker} small />
              Hablante {speaker}
              <span className="font-normal tabular-nums text-muted">
                · {percent} %{speaking ? " · hablando" : ""}
              </span>
            </span>
          );
        })}
      </header>

      <ol ref={listRef} className="max-h-80 space-y-3.5 overflow-y-auto px-3.5 py-3">
        {turns.map((turn, index) => (
          <li key={index} className="flex gap-3">
            <span className="mt-0.5">
              <Circle speaker={turn.speaker} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-muted">
                {turn.speaker === null ? "Sin voz asignada" : `Hablante ${turn.speaker}`}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{turn.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="border-t border-line px-3.5 py-2 text-xs text-muted">
        Las voces las separa el reconocimiento de voz; no saben quién es quién. Al generar la nota,
        Miracle deduce por el contexto quién es el médico, y lo que dice el médico manda.
      </p>
    </section>
  );
}
