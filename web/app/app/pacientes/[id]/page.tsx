"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useStore } from "@/app/app/providers";
import { formatFechaRelativa } from "@/lib/dates";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/Button";

export default function PacienteDetallePage() {
  const params = useParams();
  const id = String(params.id);
  const { consultations, getPatient, loading } = useStore();
  const patient = getPatient(id);

  if (!patient) {
    // Mientras el store carga, aún no se sabe si el paciente existe.
    if (loading) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 size={28} className="animate-spin text-accent" />
        </div>
      );
    }
    return (
      <EmptyState
        title="Paciente no encontrado"
        action={
          <Button href="/app/pacientes" variant="secondary">
            Ver pacientes
          </Button>
        }
      />
    );
  }

  const encuentros = consultations
    .filter((c) => c.pacienteId === id)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/app/pacientes"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-deep"
      >
        <ArrowLeft size={15} /> Pacientes
      </Link>

      <div className="mt-3 flex items-center gap-4">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-night text-lg font-semibold text-white">
          {patient.nombre.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-deep">{patient.nombre}</h1>
          <p className="text-sm text-muted">
            {patient.edad} años
            {patient.sexo ? ` · ${patient.sexo === "F" ? "Femenino" : "Masculino"}` : ""} ·{" "}
            {patient.documento} · {patient.eps}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card className="h-fit">
          <h2 className="font-display text-base font-semibold text-deep">
            Historia clínica
          </h2>
          <dl className="mt-4 space-y-4 text-sm">
            <Field label="Antecedentes" values={patient.antecedentes} />
            <Field label="Alergias" values={patient.alergias} />
            <Field label="Medicamentos" values={patient.medicamentos} />
            <Field label="Teléfono" values={[patient.telefono]} />
          </dl>
        </Card>

        <div>
          <h2 className="mb-3 font-display text-base font-semibold text-deep">
            Línea de tiempo de encuentros
          </h2>
          {encuentros.length ? (
            <div className="space-y-3">
              {encuentros.map((c) => (
                <Link
                  key={c.id}
                  href={`/app/consultas/${c.id}`}
                  className="block rounded-lg border border-line bg-surface p-4 hover:border-mist"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-deep">{c.motivo}</div>
                      <div className="text-xs text-muted">
                        {c.especialidad} · {c.servicio} ·{" "}
                        {formatFechaRelativa(c.fecha)}
                      </div>
                    </div>
                    <StatusBadge estado={c.estado} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Sin encuentros registrados"
              description="Las consultas de este paciente aparecerán aquí."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-0.5 text-ink-soft">
        {values.length ? values.join(", ") : "—"}
      </dd>
    </div>
  );
}
