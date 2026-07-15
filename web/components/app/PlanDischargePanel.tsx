"use client";

import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ClipboardCopy,
  Mic,
  Pill,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type {
  ClinicalAlarmSign,
  ClinicalDischarge,
  ClinicalDischargeItem,
  ClinicalMedicationPlanItem,
} from "@/lib/api/clinical";

type ListKind =
  "recommendations" | "alarm_signs" | "non_pharmacological" | "follow_up";

export function PlanDischargePanel({
  discharge,
  editable,
  onChange,
  onCopy,
}: {
  discharge: ClinicalDischarge;
  editable: boolean;
  onChange: (next: ClinicalDischarge) => void;
  onCopy: (text: string, label: string) => void;
}) {
  function updatePlan(patch: Partial<ClinicalDischarge["plan"]>) {
    onChange({ ...discharge, plan: { ...discharge.plan, ...patch } });
  }

  function updateList(
    kind: ListKind,
    next: ClinicalDischargeItem[] | ClinicalAlarmSign[],
  ) {
    if (kind === "non_pharmacological" || kind === "follow_up") {
      updatePlan({ [kind]: next });
      return;
    }
    onChange({ ...discharge, [kind]: next });
  }

  const allPlanText = [
    ...discharge.plan.medications.map(medicationLine),
    ...discharge.plan.non_pharmacological.map((item) => item.text),
    ...discharge.plan.follow_up.map((item) => item.text),
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-sm)]">
      <header className="border-b border-line bg-[linear-gradient(110deg,rgba(47,111,224,0.11),rgba(255,255,255,0)_58%)] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-white shadow-sm">
              <ShieldCheck size={19} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-ink">
                Cierre clínico universal
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold text-deep">
                Plan y egreso
              </h2>
              <p className="mt-1 text-sm text-muted">
                Borrador estructurado por IA. Revísalo, edítalo y guárdalo antes
                de aprobar.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onCopy(allPlanText, "Plan terapéutico")}
            className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-surface px-3.5 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-soft"
          >
            <ClipboardCopy size={14} /> Copiar plan
          </button>
        </div>
      </header>

      <div className="divide-y divide-line">
        <section className="px-5 py-5 sm:px-6">
          <SectionHeading
            icon={<Pill size={17} />}
            title="Plan terapéutico"
            helper="Medicamentos extraídos y conductas registradas en la cita."
            onCopy={() => onCopy(allPlanText, "Plan terapéutico")}
          />
          <MedicationEditor
            medications={discharge.plan.medications}
            editable={editable}
            onChange={(medications) => updatePlan({ medications })}
          />
          <ListEditor
            title="Medidas no farmacológicas"
            items={discharge.plan.non_pharmacological}
            editable={editable}
            onChange={(items) => updateList("non_pharmacological", items)}
            onCopy={() =>
              onCopy(
                discharge.plan.non_pharmacological
                  .map((item) => item.text)
                  .join("\n"),
                "Medidas no farmacológicas",
              )
            }
          />
          <ListEditor
            title="Seguimiento"
            items={discharge.plan.follow_up}
            editable={editable}
            onChange={(items) => updateList("follow_up", items)}
            onCopy={() =>
              onCopy(
                discharge.plan.follow_up.map((item) => item.text).join("\n"),
                "Seguimiento",
              )
            }
          />
        </section>

        <section className="px-5 py-5 sm:px-6">
          <SectionHeading
            icon={<ShieldCheck size={17} />}
            title="Recomendaciones"
            helper="Orientaciones personalizadas generadas para revisión médica."
            onCopy={() =>
              onCopy(
                discharge.recommendations.map((item) => item.text).join("\n"),
                "Recomendaciones",
              )
            }
          />
          <ListEditor
            items={discharge.recommendations}
            editable={editable}
            onChange={(items) => updateList("recommendations", items)}
          />
        </section>

        <section className="bg-danger/5 px-5 py-5 sm:px-6">
          <SectionHeading
            icon={<AlertTriangle size={17} />}
            title="Signos de alarma"
            helper="Jerarquizados para comprobar antes de entregar el egreso."
            tone="danger"
            onCopy={() =>
              onCopy(
                discharge.alarm_signs.map((item) => item.text).join("\n"),
                "Signos de alarma",
              )
            }
          />
          <ListEditor
            items={discharge.alarm_signs}
            editable={editable}
            alarm
            onChange={(items) =>
              updateList("alarm_signs", items as ClinicalAlarmSign[])
            }
          />
        </section>
      </div>
    </section>
  );
}

function SectionHeading({
  icon,
  title,
  helper,
  onCopy,
  tone = "accent",
}: {
  icon: ReactNode;
  title: string;
  helper: string;
  onCopy: () => void;
  tone?: "accent" | "danger";
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full ${tone === "danger" ? "bg-danger/10 text-danger" : "bg-accent-soft text-accent"}`}
        >
          {icon}
        </span>
        <div>
          <h3 className="font-display text-base font-semibold text-deep">
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-muted">{helper}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-accent"
        aria-label={`Copiar ${title}`}
        title="Copiar sección"
      >
        <ClipboardCopy size={14} />
      </button>
    </div>
  );
}

function MedicationEditor({
  medications,
  editable,
  onChange,
}: {
  medications: ClinicalMedicationPlanItem[];
  editable: boolean;
  onChange: (items: ClinicalMedicationPlanItem[]) => void;
}) {
  function update(index: number, patch: Partial<ClinicalMedicationPlanItem>) {
    onChange(
      medications.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }
  return (
    <div>
      {medications.length ? (
        <div className="space-y-3 sm:divide-y sm:divide-line sm:space-y-0 sm:rounded-lg sm:border sm:border-line">
            {medications.map((medication, index) => (
              <div
                key={`${medication.name}-${index}`}
                className="relative grid gap-3 rounded-xl border border-line bg-pearl p-4 pr-12 text-sm sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:rounded-none sm:border-0 sm:bg-transparent sm:px-3 sm:py-3 sm:pr-3"
              >
                <Field
                  label="Medicamento"
                  value={medication.name}
                  editable={editable}
                  onChange={(name) => update(index, { name })}
                />
                <Field
                  label="Dosis y vía"
                  value={[medication.dose, medication.route]
                    .filter(Boolean)
                    .join(" · ")}
                  editable={editable}
                  onChange={(value) =>
                    update(index, { dose: value, route: "" })
                  }
                />
                <Field
                  label="Frecuencia y duración"
                  value={[medication.frequency, medication.duration]
                    .filter(Boolean)
                    .join(" · ")}
                  editable={editable}
                  onChange={(value) =>
                    update(index, { frequency: value, duration: "" })
                  }
                />
                {editable ? (
                  <button
                    type="button"
                    onClick={() =>
                      onChange(
                        medications.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      )
                    }
                    className="absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger sm:static sm:self-end"
                    aria-label="Eliminar medicamento"
                    title="Eliminar medicamento"
                  >
                    <Trash2 size={15} />
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
      ) : (
        <EmptyState label="No se documentaron medicamentos en la transcripción." />
      )}
      {editable ? (
        <button
          type="button"
          onClick={() => onChange([...medications, { name: "" }])}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-hover"
        >
          <Plus size={14} /> Agregar medicamento
        </button>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  editable,
  onChange,
}: {
  label: string;
  value?: string;
  editable: boolean;
  onChange: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  if (editable && editing)
    return (
      <label className="block text-[12px] font-semibold uppercase tracking-wide text-muted">
        {label}
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            onChange(draft.trim());
            setEditing(false);
          }}
          className="mt-1 w-full border-b border-accent bg-transparent pb-1 text-sm font-medium normal-case tracking-normal text-deep outline-none"
        />
      </label>
    );
  return (
    <button
      type="button"
      disabled={!editable}
      onClick={() => {
        setDraft(value ?? "");
        setEditing(true);
      }}
      className="min-w-0 text-left disabled:cursor-default"
    >
      <span className="block text-[12px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="mt-1 block break-words font-medium text-deep sm:truncate">
        {value || "No especificado"}
      </span>
    </button>
  );
}

function ListEditor({
  title,
  items,
  editable,
  onChange,
  onCopy,
  alarm = false,
}: {
  title?: string;
  items: ClinicalDischargeItem[] | ClinicalAlarmSign[];
  editable: boolean;
  onChange: (items: ClinicalDischargeItem[] | ClinicalAlarmSign[]) => void;
  onCopy?: () => void;
  alarm?: boolean;
}) {
  function update(index: number, text: string) {
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, text } : item,
      ),
    );
  }
  function add(transcript = "") {
    onChange([
      ...items,
      alarm ? { text: transcript, urgency: "monitor" } : { text: transcript },
    ]);
  }
  return (
    <div className={title ? "mt-5 border-t border-line pt-4" : ""}>
      {title ? (
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-deep">{title}</h4>
          {onCopy ? (
            <button
              type="button"
              onClick={onCopy}
              className="text-xs font-semibold text-accent hover:underline"
            >
              Copiar
            </button>
          ) : null}
        </div>
      ) : null}
      {items.length ? (
        <ul className="space-y-2.5">
          {items.map((item, index) => (
            <li
              key={index}
              className={`group flex gap-3 rounded-lg border px-3 py-2.5 ${alarm ? "border-danger/20 bg-surface" : "border-line bg-pearl/40"}`}
            >
              {alarm ? (
                <UrgencyDot urgency={(item as ClinicalAlarmSign).urgency} />
              ) : (
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              )}
              {editable ? (
                <textarea
                  value={item.text}
                  onChange={(event) => update(index, event.target.value)}
                  rows={Math.max(2, Math.ceil((item.text.length || 1) / 70))}
                  className="min-h-9 flex-1 resize-y bg-transparent text-sm leading-relaxed text-ink outline-none focus:ring-0"
                  aria-label={`Editar ${title ?? "ítem"} ${index + 1}`}
                />
              ) : (
                <span className="flex-1 text-sm leading-relaxed text-ink">
                  {item.text}
                </span>
              )}
              {editable ? (
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      items.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  className="h-7 w-7 shrink-0 text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus:opacity-100"
                  aria-label="Eliminar ítem"
                  title="Eliminar ítem"
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState label="Sin información suficiente en la consulta. Completa solo si corresponde." />
      )}
      {editable ? (
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => add()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-hover"
          >
            <Plus size={14} /> Agregar ítem
          </button>
          <VoiceAdd onResult={add} />
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-dashed border-line bg-surface px-3 py-3 text-sm text-muted">
      {label}
    </p>
  );
}
function UrgencyDot({ urgency }: { urgency?: ClinicalAlarmSign["urgency"] }) {
  return (
    <span
      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${urgency === "emergency" ? "bg-danger" : urgency === "priority" ? "bg-warning" : "bg-accent"}`}
      aria-label={
        urgency === "emergency"
          ? "Urgencia"
          : urgency === "priority"
            ? "Prioritario"
            : "Vigilar"
      }
    />
  );
}
function medicationLine(medication: ClinicalMedicationPlanItem) {
  return [
    medication.name,
    medication.dose,
    medication.route,
    medication.frequency,
    medication.duration,
    medication.instructions,
  ]
    .filter(Boolean)
    .join(" · ");
}

function VoiceAdd({ onResult }: { onResult: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  function start() {
    const Recognition =
      typeof window === "undefined"
        ? undefined
        : ((
            window as typeof window & {
              SpeechRecognition?: SpeechRecognitionConstructor;
              webkitSpeechRecognition?: SpeechRecognitionConstructor;
            }
          ).SpeechRecognition ??
          (
            window as typeof window & {
              webkitSpeechRecognition?: SpeechRecognitionConstructor;
            }
          ).webkitSpeechRecognition);
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = "es-CO";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) onResult(text);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    setListening(true);
    recognition.start();
  }
  return (
    <button
      type="button"
      onClick={start}
      disabled={listening}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-accent disabled:opacity-50"
    >
      <Mic size={14} className={listening ? "animate-pulse text-danger" : ""} />{" "}
      {listening ? "Escuchando…" : "Dictar ítem"}
    </button>
  );
}

type SpeechRecognitionResultLike = { 0?: { transcript?: string } };
type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
