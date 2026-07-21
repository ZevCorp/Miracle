"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Mic, X } from "lucide-react";
import {
  createClinicalEncounter,
  friendlyClinicalMessage,
  getClinicalTemplates,
  normalizeSpecialtyCode,
  type ClinicalTemplate,
} from "@/lib/api/clinical";
import { ClinicalTemplatePicker } from "./ClinicalTemplatePicker";
import { useNavigationGuard } from "@/components/app/UnsavedChangesProvider";

// Recuerda, por médico, la última plantilla con la que de verdad inició una
// grabación (no solo la que miró en el selector). Es la señal más honesta de
// "la que más usa" — más confiable que asumir la de su especialidad, que no
// siempre coincide con lo que realmente elige día a día.
function lastTemplateKey(userId: string) {
  return `miracle-last-template:${userId}`;
}

function readLastTemplateId(userId?: string | null): string | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(lastTemplateKey(userId));
  } catch {
    return null;
  }
}

function rememberTemplateId(userId: string | null | undefined, templateId: string) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(lastTemplateKey(userId), templateId);
  } catch {
    /* almacenamiento no disponible: sin memoria, no rompe el flujo */
  }
}

/**
 * Entrada corta para una captura espontánea: crea el encounter real y abre el
 * micrófono sin pedir datos administrativos antes de atender.
 */
export function QuickConsultationLauncher({
  userId,
  specialtyCode,
}: {
  userId?: string | null;
  specialtyCode?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { guardedNavigate } = useNavigationGuard();
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<ClinicalTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openLauncher() {
    setOpen(true);
    if (templates.length || loadingTemplates) return;
    setLoadingTemplates(true);
    setError(null);

    void getClinicalTemplates()
      .then((items) => {
        const activeAll = items.filter((template) => template.status !== "archived");
        // Mismo criterio que /consultas/nueva: institucionales de la especialidad
        // del médico primero (con fallback a todas si no hay match), personales
        // siempre disponibles. Así un patólogo no ve/recibe por defecto la
        // plantilla de otra especialidad en el inicio rápido.
        const personal = activeAll.filter((template) => template.scope === "personal");
        const institutional = activeAll.filter((template) => template.scope !== "personal");
        const wanted = specialtyCode ? normalizeSpecialtyCode(specialtyCode) : null;
        const matching = wanted
          ? institutional.filter(
              (template) => normalizeSpecialtyCode(template.specialty) === wanted,
            )
          : [];
        const active = wanted
          ? [...personal, ...(matching.length ? matching : institutional)]
          : activeAll;
        setTemplates(active);
        // Prioridad del preseleccionado: 1) la última que el médico usó de
        // verdad, si sigue disponible; 2) la predeterminada de su
        // especialidad; 3) la primera de la lista.
        const lastUsedId = readLastTemplateId(userId);
        const lastUsed = lastUsedId && active.find((template) => template.id === lastUsedId);
        setSelectedTemplateId(
          (lastUsed ? lastUsed.id : undefined) ??
            active.find((template) => template.is_default)?.id ??
            active[0]?.id ??
            "",
        );
      })
      .catch((reason) => {
        setError(friendlyClinicalMessage(reason));
      })
      .finally(() => {
        setLoadingTemplates(false);
      });
  }

  function close() {
    if (starting) return;
    setOpen(false);
    setError(null);
  }

  async function startRecording() {
    if (!selectedTemplateId || starting) return;
    setStarting(true);
    setError(null);
    try {
      const result = await createClinicalEncounter({
        patient_id: null,
        consultation_type: "presencial",
        template_id: selectedTemplateId,
      });
      rememberTemplateId(userId, selectedTemplateId);
      const params = new URLSearchParams({
        encounter: result.encounter_id,
        record: "1",
      });
      guardedNavigate(() =>
        router.push(`/app/consultas/en-vivo?${params.toString()}`),
      );
    } catch (reason) {
      setError(friendlyClinicalMessage(reason));
      setStarting(false);
    }
  }

  if (
    pathname === "/app/consultas/en-vivo" ||
    pathname === "/app/consultas/nueva" ||
    pathname === "/app/plantillas"
  ) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={openLauncher}
        aria-label="Grabar una consulta nueva"
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] right-3 z-50 inline-flex min-h-12 items-center gap-2 rounded-[12px] bg-accent px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-md)] transition-colors active:scale-[0.98] md:bottom-5 md:right-44 md:hover:bg-accent-hover"
      >
        <span className="relative inline-flex h-5 w-5 items-center justify-center">
          <Mic size={16} />
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full border border-accent bg-danger" aria-hidden />
        </span>
        <span className="hidden sm:inline">Grabar consulta</span>
        <span className="sm:hidden">Grabar</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-overlay p-0 backdrop-blur-[2px] sm:items-end sm:justify-end sm:p-5">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Cerrar inicio rápido"
            onClick={close}
            className="absolute inset-0 cursor-default"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-recording-title"
            className="mobile-bottom-sheet relative max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-t-3xl border border-b-0 border-line bg-surface shadow-[var(--shadow-lg)] sm:rounded-[16px] sm:border-b"
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] bg-accent-soft text-accent">
                  <Mic size={19} />
                </span>
                <div>
                  <h2 id="quick-recording-title" className="text-base font-semibold text-deep">
                    Iniciar grabación
                  </h2>
                  <p className="mt-0.5 text-[13px] text-muted">Presencial · paciente opcional</p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar"
                title="Cerrar inicio rápido"
                className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-ice-soft hover:text-deep"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {loadingTemplates ? (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 size={16} className="animate-spin text-accent" /> Cargando plantilla...
                </p>
              ) : templates.length ? (
                <div className="text-sm font-semibold text-deep">
                  Plantilla de nota
                  <ClinicalTemplatePicker templates={templates} value={selectedTemplateId} onChange={setSelectedTemplateId} disabled={starting} />
                </div>
              ) : !error ? (
                <p className="rounded-md border border-line bg-pearl px-3 py-2.5 text-sm text-muted">
                  No hay plantillas disponibles para iniciar una consulta.
                </p>
              ) : null}

              {error ? (
                <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
                  {error}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void startRecording()}
                disabled={!selectedTemplateId || starting || loadingTemplates}
                className="clinical-primary w-full min-h-12 px-5 py-3"
              >
                {starting ? <Loader2 size={17} className="animate-spin" /> : <Mic size={17} />}
                {starting ? "Preparando grabación..." : "Iniciar y grabar"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
