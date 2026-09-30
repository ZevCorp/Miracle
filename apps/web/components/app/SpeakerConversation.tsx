"use client";

import { useEffect, useMemo, useRef } from "react";
import { parseSpeakerTurns, speakerShare } from "@/lib/stt/speaker-turns";

// Quién dijo qué (spec 070): la transcripción partida por voces, como la separa
// Soniox. Lee las líneas «[Hablante N]» del mismo texto que el médico corrige,
// así que lo que se ve aquí es exactamente lo que recibe la nota.

const VOICES = 6;

function voiceColor(speaker: number): string {
  return `var(--color-voz-${((speaker - 1) % VOICES) + 1})`;
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
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium text-ink"
              style={{
                borderColor: `color-mix(in srgb, ${voiceColor(speaker)} 45%, transparent)`,
                background: `color-mix(in srgb, ${voiceColor(speaker)} 10%, transparent)`,
              }}
            >
              <span className="relative inline-flex h-2 w-2">
                {speaking ? (
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                    style={{ background: voiceColor(speaker) }}
                  />
                ) : null}
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: voiceColor(speaker) }} />
              </span>
              Hablante {speaker}
              <span className="tabular-nums text-muted">· {percent} %</span>
              {speaking ? <span className="sr-only">(hablando)</span> : null}
            </span>
          );
        })}
      </header>

      <ol ref={listRef} className="max-h-80 space-y-3 overflow-y-auto px-3.5 py-3">
        {turns.map((turn, index) => (
          <li key={index} className="flex gap-2.5">
            {turn.speaker === null ? (
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-[11px] text-muted">
                —
              </span>
            ) : (
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-surface"
                style={{ background: voiceColor(turn.speaker) }}
              >
                H{turn.speaker}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p
                className="text-[12px] font-semibold"
                style={turn.speaker === null ? undefined : { color: voiceColor(turn.speaker) }}
              >
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
