"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useStore } from "@/app/app/providers";
import { usePeek } from "@/components/app/PeekProvider";
import { PatientDossier } from "@/components/app/PatientDossier";

/**
 * El panel lateral de un paciente en pantallas angostas: el mismo dossier del
 * expediente (PatientDossier), envuelto en el overlay del peek. En lg+ el
 * expediente de /app/pacientes lo muestra fijo y este panel no hace falta.
 *
 * Fuera del store (búsquedas profundas) se cede el paso a la ficha completa
 * en vez de abrir un panel vacío.
 */
export function PatientPeek() {
  const { target, closePeek } = usePeek();
  const { getPatient, consultations } = useStore();

  const abierto = target?.kind === "patient" ? target.id : null;
  const patient = abierto ? getPatient(abierto) : undefined;

  const panelRef = useRef<HTMLDivElement>(null);
  const focoPrevio = useRef<HTMLElement | null>(null);

  // Fuera del store (búsquedas muy profundas): no hay ficha que enseñar aquí;
  // se cede el paso a la página completa en vez de abrir un panel vacío.
  useEffect(() => {
    if (abierto && !patient) {
      closePeek();
      window.location.assign(`/app/pacientes/${abierto}`);
    }
  }, [abierto, patient, closePeek]);

  useEffect(() => {
    if (!abierto) return;
    focoPrevio.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closePeek();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      focoPrevio.current?.focus?.();
    };
  }, [abierto, closePeek]);

  if (!abierto || !patient) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar panel"
        onClick={closePeek}
        className="absolute inset-0 cursor-default bg-overlay/70 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Paciente ${patient.nombre}`}
        tabIndex={-1}
        className="peek-enter glass-panel absolute inset-y-0 right-0 flex w-[min(460px,100vw)] flex-col outline-none sm:inset-y-2 sm:right-2 sm:rounded-[24px]"
      >
        <div className="flex items-center justify-end px-3 pt-3">
          <button
            type="button"
            onClick={closePeek}
            aria-label="Cerrar panel"
            className="icon-btn h-9 w-9"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <PatientDossier patient={patient} onBeforeNavigate={closePeek} />
        </div>
      </div>
    </div>
  );
}
