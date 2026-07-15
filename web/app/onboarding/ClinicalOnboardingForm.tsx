"use client";

import { useActionState, useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, Stethoscope } from "lucide-react";
import { clinicalSpecialties } from "@/lib/clinical/specialties";
import {
  completeClinicalOnboarding,
  type OnboardingState,
} from "./actions";

const initialState: OnboardingState = {};
const inputClass =
  "mt-1.5 w-full rounded-md border border-line bg-field px-3.5 py-2.5 text-sm text-deep outline-none transition-colors focus:border-accent";

export function ClinicalOnboardingForm({ fullName }: { fullName: string }) {
  const [professionalType, setProfessionalType] = useState<
    "medico_general" | "medico_especialista"
  >("medico_general");
  const [specialtyCode, setSpecialtyCode] = useState("medicina-general");
  const [state, action, pending] = useActionState(
    completeClinicalOnboarding,
    initialState,
  );
  const specialistOptions = useMemo(
    () => clinicalSpecialties.filter((specialty) => specialty.code !== "medicina-general"),
    [],
  );

  return (
    <form action={action} className="mt-8 space-y-6">
      <input type="hidden" name="specialtyCode" value={specialtyCode} />

      {state.error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="rounded-lg border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ice text-accent">
            <Stethoscope size={20} />
          </span>
          <div>
            <h2 className="font-semibold text-deep">Tu práctica clínica</h2>
            <p className="mt-1 text-sm text-muted">
              Esto personaliza las plantillas iniciales y se puede actualizar más adelante.
            </p>
          </div>
        </div>

        <fieldset className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className={`cursor-pointer rounded-md border p-4 transition-colors ${professionalType === "medico_general" ? "border-accent bg-ice-soft ring-1 ring-accent/20" : "border-line hover:border-mist"}`}>
            <input
              className="sr-only"
              type="radio"
              name="professionalType"
              value="medico_general"
              checked={professionalType === "medico_general"}
              onChange={() => {
                setProfessionalType("medico_general");
                setSpecialtyCode("medicina-general");
              }}
            />
            <span className="block text-sm font-semibold text-deep">Médico general</span>
            <span className="mt-1 block text-xs text-muted">Atención integral y primer contacto.</span>
          </label>
          <label className={`cursor-pointer rounded-md border p-4 transition-colors ${professionalType === "medico_especialista" ? "border-accent bg-ice-soft ring-1 ring-accent/20" : "border-line hover:border-mist"}`}>
            <input
              className="sr-only"
              type="radio"
              name="professionalType"
              value="medico_especialista"
              checked={professionalType === "medico_especialista"}
              onChange={() => {
                setProfessionalType("medico_especialista");
                setSpecialtyCode("");
              }}
            />
            <span className="block text-sm font-semibold text-deep">Médico especialista</span>
            <span className="mt-1 block text-xs text-muted">Plantillas dirigidas a tu especialidad.</span>
          </label>
        </fieldset>

        {professionalType === "medico_especialista" ? (
          <label className="mt-5 block text-sm font-medium text-deep">
            Especialidad
            <select
              required
              className={inputClass}
              value={specialtyCode}
              onChange={(event) => setSpecialtyCode(event.target.value)}
            >
              <option value="" disabled>Selecciona tu especialidad</option>
              {specialistOptions.map((specialty) => (
                <option key={specialty.code} value={specialty.code}>
                  {specialty.name} · {specialty.group}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="rounded-lg border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2">
          <BadgeCheck size={18} className="text-accent" />
          <h2 className="font-semibold text-deep">Datos profesionales</h2>
        </div>
        <p className="mt-1 text-sm text-muted">Opcionales; ayudan a preparar tu perfil institucional.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-deep">
            País de atención
            <input name="country" className={inputClass} placeholder="Ej. Colombia" defaultValue="Colombia" />
          </label>
          <label className="block text-sm font-medium text-deep">
            Ciudad de atención
            <input name="city" className={inputClass} placeholder="Ej. Bogotá" />
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Guardando perfil..." : `Continuar como ${fullName}`} <ArrowRight size={16} />
      </button>
    </form>
  );
}
