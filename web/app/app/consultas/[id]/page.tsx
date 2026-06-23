"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  FileCheck2,
  Info,
  Mic,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";
import {
  completitud,
  doctorById,
  formatFechaRelativa,
  ripsChecklist,
  ripsListo,
  suggestedCodes,
  TYPE_LABEL,
  type Consultation,
} from "@/lib/mock";
import { useStore } from "@/app/app/providers";
import { Tabs } from "@/components/app/Tabs";
import { StatusBadge } from "@/components/app/StatusBadge";
import { NoteSectionView } from "@/components/app/NoteSectionView";
import { CodeSuggestion } from "@/components/app/CodeSuggestion";
import { Timeline } from "@/components/app/Timeline";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/Button";

export default function ConsultaDetallePage() {
  const params = useParams();
  const id = String(params.id);
  const {
    getConsultation,
    getPatient,
    approveNote,
    exportNote,
    markReviewed,
    setCodeStatus,
    showToast,
  } = useStore();
  const [tab, setTab] = useState("historia");

  const c = getConsultation(id);

  if (!c) {
    return (
      <EmptyState
        title="Consulta no encontrada"
        description="Es posible que la consulta haya sido reiniciada en la demo."
        action={
          <Button href="/app/consultas" variant="secondary">
            Ver consultas
          </Button>
        }
      />
    );
  }

  const patient = getPatient(c.pacienteId);
  const doctor = doctorById(c.medicoId);
  const sugeridos = suggestedCodes(c);

  function copyResumen() {
    navigator.clipboard?.writeText(c!.resumen);
    showToast("Resumen copiado al portapapeles.", "info");
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/app/consultas"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-deep"
      >
        <ArrowLeft size={15} /> Consultas
      </Link>

      {/* Header */}
      <div className="mt-3 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-deep text-sm font-semibold text-white">
            {patient
              ? patient.nombre.split(" ").map((p) => p[0]).slice(0, 2).join("")
              : "?"}
          </span>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold text-deep">
                {patient?.nombre ?? "Paciente sin identificar"}
              </h1>
              <StatusBadge estado={c.estado} />
            </div>
            <p className="mt-0.5 text-sm text-muted">
              {patient && patient.edad > 0 ? `${patient.edad} años · ` : ""}
              {c.especialidad} · {TYPE_LABEL[c.tipo]} ·{" "}
              {formatFechaRelativa(c.fecha)}
            </p>
            <p className="text-sm text-muted">
              {c.servicio} · {doctor?.nombre} · {c.duracionMin} min
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyResumen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-muted hover:text-deep"
            aria-label="Copiar resumen"
          >
            <Copy size={16} />
          </button>
          <button
            type="button"
            onClick={() => showToast("La regrabación estará disponible en la versión conectada.", "info")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-muted hover:text-deep"
            aria-label="Regrabar"
          >
            <Mic size={16} />
          </button>

          {c.estado === "borrador" ? (
            <Button variant="secondary" onClick={() => markReviewed(c.id)}>
              Marcar revisada
            </Button>
          ) : null}
          {c.estado === "borrador" || c.estado === "revisada" ? (
            <Button onClick={() => approveNote(c.id)}>
              <CheckCircle2 size={16} /> Aprobar
            </Button>
          ) : null}
          {c.estado === "aprobada" ? (
            <Button onClick={() => exportNote(c.id)}>
              <FileCheck2 size={16} /> Exportar a HC
            </Button>
          ) : null}
          {c.estado === "exportada" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-3 py-2 text-sm font-semibold text-success">
              <CheckCircle2 size={16} /> Exportada a HC
            </span>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-5">
        <Tabs
          tabs={[
            { id: "historia", label: "Historia clínica" },
            { id: "codificacion", label: "Codificación", count: sugeridos.length || undefined },
            { id: "resumen", label: "Resumen" },
            { id: "transcripcion", label: "Transcripción" },
            { id: "auditoria", label: "Auditoría" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      <div className="mt-6">
        {tab === "historia" ? (
          <HistoriaTab consultation={c} onAiEdit={() => showToast("La edición asistida estará disponible en la versión conectada.", "info")} />
        ) : null}
        {tab === "codificacion" ? (
          <CodificacionTab
            consultation={c}
            onAccept={(codeId) => setCodeStatus(c.id, codeId, "aceptado")}
            onDiscard={(codeId) => setCodeStatus(c.id, codeId, "descartado")}
            onAddInfo={() => showToast("Agregar códigos manualmente estará disponible en la versión conectada.", "info")}
          />
        ) : null}
        {tab === "resumen" ? (
          <ResumenTab texto={c.resumen} onCopy={copyResumen} />
        ) : null}
        {tab === "transcripcion" ? <TranscripcionTab consultation={c} /> : null}
        {tab === "auditoria" ? <AuditoriaTab consultation={c} /> : null}
      </div>
    </div>
  );
}

/* ---------- Tabs ---------- */

function AiDisclaimer() {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-md border border-accent/20 bg-accent-soft/50 px-3.5 py-2.5 text-sm text-accent-ink">
      <Info size={16} className="mt-0.5 shrink-0" />
      <span>
        Contenido generado con IA. Verifique la información; la nota requiere
        revisión y aprobación médica.
      </span>
    </div>
  );
}

function HistoriaTab({
  consultation,
  onAiEdit,
}: {
  consultation: Consultation;
  onAiEdit: () => void;
}) {
  return (
    <div>
      <AiDisclaimer />
      <div className="rounded-lg border border-line bg-white px-5 py-2">
        {consultation.note.map((s) => (
          <NoteSectionView key={s.id} section={s} />
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAiEdit();
          (e.currentTarget.elements.namedItem("ai") as HTMLInputElement).value = "";
        }}
        className="mt-3 flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 shadow-[var(--shadow-sm)]"
      >
        <Sparkles size={16} className="text-accent" />
        <input
          name="ai"
          placeholder="Pídale a Miracle un ajuste de la nota…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover"
          aria-label="Enviar"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}

function CodificacionTab({
  consultation,
  onAccept,
  onDiscard,
  onAddInfo,
}: {
  consultation: Consultation;
  onAccept: (codeId: string) => void;
  onDiscard: (codeId: string) => void;
  onAddInfo: () => void;
}) {
  const sugeridos = suggestedCodes(consultation);
  const aceptados = consultation.codigos.filter((k) => k.estado === "aceptado");
  const descartados = consultation.codigos.filter((k) => k.estado === "descartado");
  const rips = ripsChecklist(consultation);
  const listo = ripsListo(consultation);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-5">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-deep">
              Códigos sugeridos
            </h2>
            <button
              type="button"
              onClick={onAddInfo}
              className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
            >
              <Plus size={15} /> Agregar
            </button>
          </div>
          {sugeridos.length ? (
            <div className="space-y-2.5">
              {sugeridos.map((k) => (
                <CodeSuggestion
                  key={k.id}
                  code={k}
                  onAccept={() => onAccept(k.id)}
                  onDiscard={() => onDiscard(k.id)}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-line bg-white px-4 py-3 text-sm text-muted">
              No hay códigos sugeridos pendientes. Revise los aceptados.
            </p>
          )}
        </section>

        {aceptados.length ? (
          <section>
            <h2 className="mb-2 font-display text-base font-semibold text-deep">
              Aceptados
            </h2>
            <div className="space-y-2.5">
              {aceptados.map((k) => (
                <CodeSuggestion key={k.id} code={k} />
              ))}
            </div>
          </section>
        ) : null}

        {descartados.length ? (
          <section>
            <h2 className="mb-2 font-display text-base font-semibold text-muted">
              Descartados
            </h2>
            <div className="space-y-2.5">
              {descartados.map((k) => (
                <CodeSuggestion key={k.id} code={k} onAccept={() => onAccept(k.id)} />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {/* RIPS */}
      <aside className="h-fit rounded-lg border border-line bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-deep">
            Preparación para RIPS
          </h2>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              listo ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
            }`}
          >
            {listo ? "Listo" : "Incompleto"}
          </span>
        </div>
        <ul className="mt-4 space-y-2.5">
          {rips.map((item) => (
            <li key={item.label} className="flex items-center gap-2.5 text-sm">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
                  item.done ? "bg-success text-white" : "bg-ice text-muted"
                }`}
              >
                {item.done ? <CheckCircle2 size={13} /> : null}
              </span>
              <span className={item.done ? "text-ink" : "text-muted"}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">
          Miracle prepara la información; el reporte RIPS se valida en la
          versión conectada al sistema de la institución.
        </p>
      </aside>
    </div>
  );
}

function ResumenTab({ texto, onCopy }: { texto: string; onCopy: () => void }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-deep">
          Resumen clínico
        </h2>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-sm font-medium text-deep hover:border-mist"
        >
          <Copy size={14} /> Copiar
        </button>
      </div>
      <div className="rounded-lg border border-line bg-white p-6 text-[0.97rem] leading-relaxed text-ink">
        {texto}
      </div>
    </div>
  );
}

function TranscripcionTab({ consultation }: { consultation: Consultation }) {
  return (
    <div className="rounded-lg border border-line bg-white p-6">
      <div className="space-y-4">
        {consultation.transcript.map((turn, i) => (
          <div key={i} className="flex gap-3">
            <span className="w-12 shrink-0 pt-0.5 font-mono text-xs text-muted">
              {turn.t}
            </span>
            <div>
              <span
                className={`mr-2 text-xs font-semibold ${
                  turn.hablante === "Médico" ? "text-accent" : "text-success"
                }`}
              >
                {turn.hablante}
              </span>
              <span className="text-[0.95rem] text-ink">{turn.texto}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
        El audio no se conserva tras generar la nota. La transcripción queda
        disponible para trazabilidad.
      </p>
    </div>
  );
}

function AuditoriaTab({ consultation }: { consultation: Consultation }) {
  const pct = completitud(consultation);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <div className="h-fit rounded-lg border border-line bg-white p-5 text-center">
        <div className="font-display text-4xl font-bold text-deep">{pct}%</div>
        <div className="mt-1 text-sm text-muted">Completitud documental</div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ice">
          <div
            className="h-full rounded-full bg-success"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="rounded-lg border border-line bg-white p-5">
        <h2 className="mb-4 font-display text-base font-semibold text-deep">
          Trazabilidad
        </h2>
        <Timeline events={consultation.auditoria} />
      </div>
    </div>
  );
}
