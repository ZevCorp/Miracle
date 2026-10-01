"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  FileEdit,
  Loader2,
  ShieldAlert,
  X,
} from "lucide-react";
import type { AssistantSupport } from "@/lib/api/clinical";
import { sourceLabel, type AssistantTurnData } from "@/lib/assistant/normalize";

export type ProposalState = "pendiente" | "aplicada" | "descartada";

/**
 * Lo que acompaña a una respuesta del asistente además del texto: con qué se
 * respalda, la tarjeta de abstención, signos de alarma, fuentes citadas y la
 * propuesta de nota con «Aplicar». Nada de esto es una burbuja: una
 * abstención o una propuesta con la forma de una respuesta clínica se leería
 * como si la IA hubiera afirmado eso.
 */
const SUPPORT_BADGE: Record<AssistantSupport, { label: string; className: string }> = {
  consulta: { label: "Según esta consulta", className: "bg-accent-soft text-accent-ink" },
  guia: { label: "Con guía clínica", className: "bg-mint-soft text-success" },
  general: { label: "Conocimiento general · verificar", className: "bg-pearl text-muted border border-line" },
  insuficiente: { label: "Sin respaldo suficiente", className: "bg-warning-soft text-warning" },
};

const PREVIEW_CHARS = 220;

function SectionPreview({ label, content }: { label: string; content: string }) {
  const [open, setOpen] = useState(false);
  const long = content.length > PREVIEW_CHARS;
  const shown = open || !long ? content : `${content.slice(0, PREVIEW_CHARS)}…`;
  return (
    <div className="rounded-[10px] border border-line bg-surface px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-deep">{label}</span>
        {long ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent"
          >
            {open ? "Menos" : "Ver completo"}
            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        ) : null}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{shown}</p>
    </div>
  );
}

export function AssistantTurnCard({
  data,
  proposalState,
  canApply,
  applyHint,
  applying,
  onApply,
  onDiscard,
}: {
  data: AssistantTurnData;
  proposalState: ProposalState;
  /** true cuando la página de la consulta puede recibir la propuesta. */
  canApply: boolean;
  /** Por qué no se puede aplicar (nota firmada, sin consulta abierta). */
  applyHint?: string;
  applying: boolean;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const badge = data.support ? SUPPORT_BADGE[data.support] : null;
  const abstained = data.support === "insuficiente";
  const proposal = data.proposal;

  return (
    <div className="max-w-[92%] space-y-2 text-[13px]">
      {badge ? (
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}>
          {badge.label}
        </span>
      ) : null}

      {abstained ? (
        <div role="status" className="rounded-2xl border border-warning/40 bg-warning-soft px-3.5 py-2.5 text-warning">
          <p className="flex items-start gap-1.5 font-semibold">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>El asistente prefirió no responder sin respaldo.</span>
          </p>
          {data.missing.length ? (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[12px] leading-relaxed">
              {data.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : data.missing.length ? (
        <div className="rounded-[12px] border border-line bg-pearl px-3 py-2 text-ink">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Falta por confirmar</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[12px] leading-relaxed">
            {data.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.alerts.length ? (
        <div className="rounded-[12px] border border-warning/40 bg-warning-soft px-3 py-2 text-warning">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
            <ShieldAlert size={13} /> Signos de alarma
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[12px] leading-relaxed">
            {data.alerts.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.sources.length ? (
        <div className="rounded-[12px] border border-line bg-surface px-3 py-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            <BookOpen size={13} /> Fuentes
          </p>
          <ul className="mt-1 space-y-1 text-[12px] leading-snug text-ink">
            {data.sources.map((source) => (
              <li key={source.ref} title={source.source || source.title}>
                <span className="mr-1.5 rounded bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent-ink">
                  {source.ref}
                </span>
                <span className="font-medium">{source.title}</span>
                <span className="text-muted"> · {sourceLabel(source)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-muted">Resumen orientativo de cada guía; verifique en la fuente.</p>
        </div>
      ) : null}

      {proposal ? (
        <div className="rounded-2xl border border-accent/30 bg-accent-soft/40 p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-accent-ink">
            <FileEdit size={14} /> Propuesta para la nota
          </p>
          {proposal.explanation ? (
            <p className="mt-1 text-[12px] leading-relaxed text-ink">{proposal.explanation}</p>
          ) : null}
          <div className="mt-2 space-y-2">
            {proposal.summary ? <SectionPreview label="Resumen" content={proposal.summary} /> : null}
            {proposal.changed_sections.map((section) => (
              <SectionPreview key={section.key} label={section.label} content={section.content} />
            ))}
          </div>

          {proposalState === "aplicada" ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-3 py-1.5 text-[12px] font-semibold text-success">
              <Check size={13} /> Aplicada a la nota · revisa y guarda
            </p>
          ) : proposalState === "descartada" ? (
            <p className="mt-2 text-[12px] text-muted">Propuesta descartada.</p>
          ) : canApply ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onApply}
                disabled={applying}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
              >
                {applying ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Aplicar a la nota
              </button>
              <button
                type="button"
                onClick={onDiscard}
                disabled={applying}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[12px] font-semibold text-deep hover:border-mist disabled:opacity-60"
              >
                <X size={13} /> Descartar
              </button>
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-muted">{applyHint || "Abre la consulta para aplicarla a la nota."}</p>
          )}
          <p className="mt-2 text-[11px] text-muted">No se guarda sola: revisa y guarda la nota como siempre.</p>
        </div>
      ) : null}
    </div>
  );
}
