"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  FileCheck2,
  Info,
  Loader2,
  Mic,
  Plus,
  Printer,
  Send,
  Sparkles,
} from "lucide-react";
import { isDemoConsultation } from "@/lib/demo";
import {
  adjustNoteWithAssistant,
  saveEditedClinicalNote,
  friendlyClinicalMessage,
  ClinicalApiError,
} from "@/lib/api/clinical";
import { noteJsonToSections } from "@/lib/clinical/encounter-to-consultation";
import {
  completitud,
  formatFechaRelativa,
  ripsChecklist,
  ripsListo,
  suggestedCodes,
  TYPE_LABEL,
  type ClinicalCode,
  type Consultation,
  type NoteSection,
} from "@/lib/mock";
import { searchCodes } from "@/lib/clinical/codes";
import { auditConsultation } from "@/lib/clinical/note-audit";
import { useStore } from "@/app/app/providers";
import { Tabs } from "@/components/app/Tabs";
import { StatusBadge } from "@/components/app/StatusBadge";
import { NoteSectionView } from "@/components/app/NoteSectionView";
import { AuditFindingList } from "@/components/app/AuditFindings";
import { CodeSuggestion } from "@/components/app/CodeSuggestion";
import { Timeline } from "@/components/app/Timeline";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/Button";
import { HoverHint } from "@/components/ui/HoverHint";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function ConsultaDetallePage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const {
    getConsultation,
    getPatient,
    getMedicoName,
    approveNote,
    exportNote,
    markReviewed,
    setCodeStatus,
    addCode,
    updateNote,
    upsertConsultation,
    showToast,
    loading,
    ensureTranscript,
  } = useStore();
  const [tab, setTab] = useState("historia");
  const [aiEditing, setAiEditing] = useState(false);

  const c = getConsultation(id);

  if (!c) {
    // Mientras el store carga, aún no se sabe si la consulta existe.
    if (loading) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 size={28} className="animate-spin text-accent" />
        </div>
      );
    }
    return (
      <EmptyState
        title="Consulta no encontrada"
        description="Es posible que la consulta haya sido eliminada."
        action={
          <Button href="/app/consultas" variant="secondary">
            Ver consultas
          </Button>
        }
      />
    );
  }

  const patient = getPatient(c.pacienteId);
  const medicoNombre = getMedicoName(c.medicoId);
  const sugeridos = suggestedCodes(c);
  const demo = isDemoConsultation(c);

  function copyResumen() {
    navigator.clipboard?.writeText(c!.resumen);
    showToast("Resumen copiado al portapapeles.", "info");
  }

  // Edición asistida real: el backend calcula el ajuste sobre el encounter
  // (mismo id que esta consulta, por el puente), lo persiste allí y aquí se
  // refleja en el historial local.
  async function aiEdit(instruction: string) {
    const texto = instruction.trim();
    if (!texto || aiEditing || !c) return;
    setAiEditing(true);
    showToast("Miracle está ajustando la nota…", "info");
    try {
      const proposal = await adjustNoteWithAssistant({
        encounter_id: c.id,
        instruction: texto,
      });
      const saved = await saveEditedClinicalNote(c.id, proposal.proposed_note_json);
      upsertConsultation({
        ...c,
        note: noteJsonToSections(saved.note_json),
        resumen: saved.note_json.summary || c.resumen,
      });
      showToast("Nota ajustada por Miracle. Revisa los cambios.", "success");
    } catch (error) {
      if (
        error instanceof ClinicalApiError &&
        error.code === "ENCOUNTER_NOT_FOUND"
      ) {
        showToast(
          "La edición asistida está disponible solo para consultas creadas con el flujo nuevo.",
          "info",
        );
      } else {
        showToast(friendlyClinicalMessage(error), "warning");
      }
    } finally {
      setAiEditing(false);
    }
  }

  function descargarPDF() {
    const w = window.open("", "_blank", "width=820,height=1000");
    if (!w) {
      showToast("Permita las ventanas emergentes para generar el PDF.", "warning");
      return;
    }
    const aceptados = c!.codigos.filter((k) => k.estado === "aceptado");
    const secciones = c!.note
      .map((s) => {
        const cuerpo =
          s.kind === "lista" && s.items?.length
            ? `<ul>${s.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`
            : `<p>${esc(s.texto ?? "")}</p>`;
        return `<section><h2>${esc(s.titulo)}</h2>${cuerpo}</section>`;
      })
      .join("");
    const codigos = aceptados.length
      ? `<table><thead><tr><th>Sistema</th><th>Código</th><th>Descripción</th></tr></thead><tbody>${aceptados
          .map(
            (k) =>
              `<tr><td>${esc(k.sistema)}</td><td>${esc(k.codigo)}</td><td>${esc(k.descripcion)}</td></tr>`,
          )
          .join("")}</tbody></table>`
      : `<p class="muted">Sin códigos aceptados.</p>`;
    const fecha = new Date(c!.fecha).toLocaleString("es-CO");
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Nota clínica · ${esc(
      patient?.nombre ?? "Paciente",
    )}</title><style>
      *{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0e1726;margin:40px;line-height:1.5}
      h1{font-size:20px;margin:0 0 2px}h2{font-size:14px;margin:18px 0 4px;color:#0c1424}
      .muted{color:#64748b;font-size:12px}.head{border-bottom:2px solid #0c1424;padding-bottom:10px;margin-bottom:8px}
      .grid{display:flex;flex-wrap:wrap;gap:4px 24px;font-size:13px;margin-top:6px}
      section p,section ul{font-size:13px;margin:2px 0}ul{padding-left:18px}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
      th,td{border:1px solid #cbd5e1;padding:5px 8px;text-align:left}th{background:#f1f5f9}
      .foot{margin-top:28px;border-top:1px solid #cbd5e1;padding-top:10px;font-size:11px;color:#64748b}
      @media print{body{margin:18mm}}
    </style></head><body>
      ${
        demo
          ? `<div style="border:2px solid #a34a06;background:#fdeecf;color:#7c3a05;padding:8px 12px;margin-bottom:14px;font-weight:700;font-size:13px">DOCUMENTO DE DEMOSTRACIÓN — generado a partir de una conversación simulada. No válido como historia clínica.</div>`
          : ""
      }
      <div class="head">
        <h1>${esc(patient?.nombre ?? "Paciente sin identificar")}</h1>
        <div class="grid">
          ${
            patient && patient.edad > 0
              ? `<span>${patient.edad} años${patient.sexo ? ` · ${patient.sexo === "F" ? "Femenino" : "Masculino"}` : ""}</span>`
              : ""
          }
          ${patient?.documento ? `<span>Doc: ${esc(patient.documento)}</span>` : ""}
          <span>${esc(c!.especialidad)} · ${esc(c!.servicio)}</span>
          <span>${esc(medicoNombre ?? "")}</span>
          <span>${esc(fecha)}</span>
        </div>
      </div>
      <h2>Resumen</h2><p>${esc(c!.resumen)}</p>
      ${secciones}
      <h2>Codificación</h2>${codigos}
      <p class="foot">Documento generado con asistencia de IA y revisado por el profesional de salud. Miracle · Inteligencia clínica-operativa.</p>
    </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className="app-page max-w-4xl pb-24 sm:pb-0">
      <Link
        href="/app/consultas"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-deep"
      >
        <ArrowLeft size={15} /> Consultas
      </Link>

      {/* Header */}
      <div className="mt-3 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-night text-sm font-semibold text-white">
            {patient
              ? patient.nombre.split(" ").map((p) => p[0]).slice(0, 2).join("")
              : "?"}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-deep">
                {patient?.nombre ?? "Paciente sin identificar"}
              </h1>
              <StatusBadge estado={c.estado} />
            </div>
            <p className="mt-0.5 text-sm text-muted">
              {patient && patient.edad > 0 ? `${patient.edad} años · ` : ""}
              {c.especialidad} · {TYPE_LABEL[c.tipo]} ·{" "}
              {formatFechaRelativa(c.fecha)}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {c.servicio} · {medicoNombre ?? "—"} · {c.duracionMin} min
            </p>
            {c.firma ? (
              <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-2.5 py-1 text-xs font-semibold text-success">
                <CheckCircle2 size={13} /> Firmada por {c.firma.por} ·{" "}
                {new Date(c.firma.fecha).toLocaleDateString("es-CO")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <HoverHint label="Copiar el resumen clínico">
            <button
              type="button"
              onClick={copyResumen}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-muted hover:text-deep"
              aria-label="Copiar resumen"
            >
              <Copy size={16} />
            </button>
          </HoverHint>
          <button
            type="button"
            onClick={descargarPDF}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium text-deep hover:border-mist"
          >
            <Printer size={16} /> PDF
          </button>
          <button
            type="button"
            onClick={() => {
              // La consulta activa exige un encounter del backend, así que una
              // nueva captura siempre arranca desde "Nueva consulta".
              const sp = new URLSearchParams();
              if (patient?.nombre) sp.set("nombre", patient.nombre);
              const qs = sp.toString();
              router.push(`/app/consultas/nueva${qs ? `?${qs}` : ""}`);
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-muted hover:text-deep"
            aria-label="Regrabar"
            title="Iniciar una nueva grabación para este paciente"
          >
            <Mic size={16} />
          </button>

          {/* Las consultas de demostración no se firman ni se exportan. */}
          {!demo && c.estado === "borrador" ? (
            <Button variant="secondary" onClick={() => markReviewed(c.id)} className="hidden sm:inline-flex">
              Marcar revisada
            </Button>
          ) : null}
          {!demo && (c.estado === "borrador" || c.estado === "revisada") ? (
            <Button onClick={() => approveNote(c.id)} className="hidden sm:inline-flex">
              <CheckCircle2 size={16} /> Aprobar
            </Button>
          ) : null}
          {!demo && c.estado === "aprobada" ? (
            <Button onClick={() => exportNote(c.id)} className="hidden sm:inline-flex">
              <FileCheck2 size={16} /> Exportar a HC
            </Button>
          ) : null}
          {!demo && c.estado === "exportada" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-3 py-2 text-sm font-semibold text-success">
              <CheckCircle2 size={16} /> Exportada a HC
            </span>
          ) : null}
        </div>
      </div>

      {demo ? (
        <div
          role="alert"
          className="mt-5 flex items-start gap-3 rounded-lg border-2 border-warning/50 bg-warning-soft px-4 py-3.5"
        >
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-bold text-warning">
              Consulta de demostración
            </p>
            <p className="mt-0.5 text-sm text-warning">
              Esta nota proviene de una conversación simulada y no corresponde a
              una atención real, por eso no puede firmarse ni exportarse.
            </p>
          </div>
        </div>
      ) : null}

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
          <HistoriaTab
            consultation={c}
            editable={c.estado !== "aprobada" && c.estado !== "exportada"}
            onSectionChange={(sectionId, next) => updateNote(c.id, sectionId, next)}
            onAiEdit={(instruction) => void aiEdit(instruction)}
            aiBusy={aiEditing}
          />
        ) : null}
        {tab === "codificacion" ? (
          <CodificacionTab
            consultation={c}
            onAccept={(codeId) => setCodeStatus(c.id, codeId, "aceptado")}
            onDiscard={(codeId) => setCodeStatus(c.id, codeId, "descartado")}
            onAddCode={(code) => addCode(c.id, code)}
          />
        ) : null}
        {tab === "resumen" ? (
          <ResumenTab texto={c.resumen} onCopy={copyResumen} />
        ) : null}
        {tab === "transcripcion" ? (
          <TranscripcionTab consultation={c} ensureTranscript={ensureTranscript} />
        ) : null}
        {tab === "auditoria" ? <AuditoriaTab consultation={c} /> : null}
      </div>

      {!demo && c.estado !== "exportada" ? (
        <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-30 grid gap-2 rounded-[14px] border border-line bg-surface p-2.5 shadow-[var(--shadow-lg)] sm:hidden">
          {c.estado === "borrador" ? (
            <button type="button" onClick={() => markReviewed(c.id)} className="clinical-secondary">Marcar revisada</button>
          ) : null}
          {c.estado === "borrador" || c.estado === "revisada" ? (
            <button type="button" onClick={() => approveNote(c.id)} className="clinical-primary min-h-12"><CheckCircle2 size={17} /> Aprobar y firmar nota</button>
          ) : null}
          {c.estado === "aprobada" ? (
            <button type="button" onClick={() => exportNote(c.id)} className="clinical-primary min-h-12"><FileCheck2 size={17} /> Exportar a historia clínica</button>
          ) : null}
        </div>
      ) : null}
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
  editable,
  onSectionChange,
  onAiEdit,
  aiBusy,
}: {
  consultation: Consultation;
  editable: boolean;
  onSectionChange: (sectionId: string, next: Partial<NoteSection>) => void;
  onAiEdit: (instruction: string) => void;
  aiBusy: boolean;
}) {
  return (
    <div>
      <AiDisclaimer />
      <div className="rounded-lg border border-line bg-surface px-3 py-2 sm:px-5">
        {consultation.note.map((s) => (
          <NoteSectionView
            key={s.id}
            section={s}
            editable={editable}
            onChange={(next) => onSectionChange(s.id, next)}
          />
        ))}
      </div>

      {/* Solo mientras la nota sigue editable (no aprobada/exportada). */}
      {editable ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem("ai") as HTMLInputElement;
            const value = input.value.trim();
            if (!value) return;
            onAiEdit(value);
            input.value = "";
          }}
          className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-[var(--shadow-sm)] sm:rounded-full sm:px-4"
        >
          <Sparkles size={16} className="text-accent" />
          <input
            name="ai"
            placeholder="Pídale a Miracle un ajuste de la nota…"
            disabled={aiBusy}
            maxLength={2000}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={aiBusy}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
            aria-label="Enviar"
          >
            {aiBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function CodificacionTab({
  consultation,
  onAccept,
  onDiscard,
  onAddCode,
}: {
  consultation: Consultation;
  onAccept: (codeId: string) => void;
  onDiscard: (codeId: string) => void;
  onAddCode: (code: Omit<ClinicalCode, "id" | "estado">) => void;
}) {
  const sugeridos = suggestedCodes(consultation);
  const aceptados = consultation.codigos.filter((k) => k.estado === "aceptado");
  const descartados = consultation.codigos.filter((k) => k.estado === "descartado");
  const rips = ripsChecklist(consultation);
  const listo = ripsListo(consultation);

  const [showForm, setShowForm] = useState(false);
  const [sistema, setSistema] = useState<ClinicalCode["sistema"]>("CIE-10");
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");

  function submitCode() {
    const cod = codigo.trim().toUpperCase();
    const desc = descripcion.trim();
    if (!cod || !desc) return;
    onAddCode({ sistema, codigo: cod, descripcion: desc, confianza: 100 });
    setCodigo("");
    setDescripcion("");
    setSistema("CIE-10");
    setShowForm(false);
  }

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
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
            >
              <Plus size={15} /> Agregar
            </button>
          </div>

          {showForm ? (
            <div className="mb-3 rounded-md border border-line bg-surface p-3">
              <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
                <select
                  value={sistema}
                  onChange={(e) =>
                    setSistema(e.target.value as ClinicalCode["sistema"])
                  }
                  aria-label="Sistema de codificación"
                  className="rounded-md border border-line bg-field px-2.5 py-2 text-sm outline-none focus:border-accent"
                >
                  <option value="CIE-10">CIE-10</option>
                  <option value="CUPS">CUPS</option>
                </select>
                <input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Código (ej. I10)"
                  className="w-full rounded-md border border-line bg-field px-3 py-2 text-sm uppercase outline-none focus:border-accent sm:w-32"
                />
                <input
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Descripción del diagnóstico o procedimiento"
                  className="min-w-0 flex-1 rounded-md border border-line bg-field px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>

              {(codigo.trim() || descripcion.trim()) &&
              searchCodes(sistema, codigo || descripcion).length ? (
                <div className="mt-2 max-h-44 overflow-auto rounded-md border border-line">
                  {searchCodes(sistema, codigo || descripcion).map((s) => (
                    <button
                      key={s.codigo}
                      type="button"
                      onClick={() => {
                        setCodigo(s.codigo);
                        setDescripcion(s.descripcion);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-ice-soft"
                    >
                      <span className="shrink-0 font-mono font-semibold text-deep">
                        {s.codigo}
                      </span>
                      <span className="truncate text-muted">{s.descripcion}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={submitCode}
                  disabled={!codigo.trim() || !descripcion.trim()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  <Plus size={15} /> Agregar código
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-full border border-line px-4 py-1.5 text-sm font-medium text-deep hover:border-mist"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

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
            <p className="rounded-md border border-line bg-surface px-4 py-3 text-sm text-muted">
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
      <aside className="h-fit rounded-lg border border-line bg-surface p-5">
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
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-deep hover:border-mist"
        >
          <Copy size={14} /> Copiar
        </button>
      </div>
      <div className="rounded-lg border border-line bg-surface p-6 text-[0.97rem] leading-relaxed text-ink">
        {texto}
      </div>
    </div>
  );
}

function TranscripcionTab({
  consultation,
  ensureTranscript,
}: {
  consultation: Consultation;
  ensureTranscript: (id: string) => Promise<void>;
}) {
  // La transcripción no viene en la carga inicial (es el campo más pesado);
  // se trae al abrir esta pestaña.
  const [fetching, setFetching] = useState(consultation.transcript.length === 0);

  useEffect(() => {
    if (consultation.transcript.length !== 0) return;
    let ignore = false;
    ensureTranscript(consultation.id).finally(() => {
      if (!ignore) setFetching(false);
    });
    return () => {
      ignore = true;
    };
  }, [consultation.id, consultation.transcript.length, ensureTranscript]);

  if (fetching && consultation.transcript.length === 0) {
    return (
      <div className="flex justify-center rounded-lg border border-line bg-surface p-10">
        <Loader2 size={22} className="animate-spin text-accent" />
      </div>
    );
  }

  if (!consultation.transcript.length) {
    return (
      <p className="rounded-lg border border-line bg-surface p-6 text-sm text-muted">
        Esta consulta no tiene transcripción registrada.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-6">
      <div className="space-y-4">
        {consultation.transcript.map((turn, i) =>
          turn.hablante ? (
            // Transcripción con diarización (Médico/Paciente).
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
          ) : (
            // Transcripción verbatim (tal cual como se dijo): bloque de texto plano.
            <p
              key={i}
              className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-ink"
            >
              {turn.texto}
            </p>
          ),
        )}
      </div>
      <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
        El audio no se conserva tras generar la nota. La transcripción queda
        disponible para trazabilidad.
      </p>
    </div>
  );
}

function AuditoriaTab({ consultation }: { consultation: Consultation }) {
  const report = auditConsultation(consultation);
  const pct = completitud(consultation);
  const scoreColor =
    report.puntaje >= 85
      ? "text-success"
      : report.puntaje >= 60
        ? "text-warning"
        : "text-danger";
  const barColor =
    report.puntaje >= 85
      ? "bg-success"
      : report.puntaje >= 60
        ? "bg-warning"
        : "bg-danger";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-5">
        {/* Calidad documental + completitud RIPS */}
        <div className="rounded-lg border border-line bg-surface p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-sm text-muted">Calidad documental</div>
              <div className={`font-display text-4xl font-bold ${scoreColor}`}>
                {report.puntaje}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted">Completitud RIPS</div>
              <div className="text-lg font-semibold text-deep">{pct}%</div>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-ice">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${report.puntaje}%` }}
            />
          </div>
        </div>

        {/* Qué se puede mejorar */}
        <div className="rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-4 font-display text-base font-semibold text-deep">
            Qué se puede mejorar
          </h2>
          <AuditFindingList
            hallazgos={report.hallazgos}
            emptyLabel="Sin observaciones — la nota está completa y lista para firmar."
          />
        </div>
      </div>

      <div className="h-fit rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-4 font-display text-base font-semibold text-deep">
          Trazabilidad
        </h2>
        <Timeline events={consultation.auditoria} />
      </div>
    </div>
  );
}
