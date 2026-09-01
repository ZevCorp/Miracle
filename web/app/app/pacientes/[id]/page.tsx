"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Loader2, Mic, Pencil, Phone } from "lucide-react";
import { useStore } from "@/app/app/providers";
import { PatientFormDialog } from "@/components/app/PatientFormDialog";
import { formatFechaRelativa } from "@/lib/dates";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { AppPage, SectionRule } from "@/components/app/AppPage";

export default function PacienteDetallePage() {
  const params = useParams();
  const id = String(params.id);
  const { consultations, getPatient, loading, role } = useStore();
  const patient = getPatient(id);
  const [editando, setEditando] = useState(false);

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
          <Link href="/app/pacientes" className="clinical-secondary">
            Ver pacientes
          </Link>
        }
      />
    );
  }

  const encuentros = consultations
    .filter((c) => c.pacienteId === id)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  return (
    <AppPage className="max-w-4xl">
      <Link
        href="/app/pacientes"
        className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-deep"
      >
        <ArrowLeft size={15} /> Pacientes
      </Link>

      {/* La ficha de identidad es el panel principal: a quién estás
          atendiendo, con sus datos duros en monoespaciada (se comparan y se
          transcriben) y la acción que sigue —iniciar una consulta con esta
          persona— sin pasos intermedios. */}
      <section className="clinical-panel mt-3 p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar
              name={patient.nombre}
              className="h-14 w-14 text-lg shadow-[var(--neu-out)]"
            />
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-[650] tracking-[-0.03em] text-deep">
                {patient.nombre}
              </h1>
              {/* Sin edad registrada NO se escribe "0 años": un dato que no se
                  tomó no es un dato con valor cero. */}
              <p className="data mt-1 text-[13px] text-muted">
                {patient.documento}
                <span className="font-sans">
                  {patient.edad > 0 ? ` · ${patient.edad} años` : ""}
                  {patient.sexo
                    ? ` · ${patient.sexo === "F" ? "Femenino" : "Masculino"}`
                    : ""}
                </span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center rounded-full bg-ice px-2.5 py-0.5 text-xs font-semibold text-accent-ink">
                  {patient.eps}
                </span>
                {patient.telefono ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-pearl px-2.5 py-0.5 text-xs font-medium text-ink-soft ring-1 ring-inset ring-line">
                    <Phone size={11} /> {patient.telefono}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="clinical-secondary min-h-11 px-4"
            >
              <Pencil size={15} /> Editar
            </button>
            {role === "medico" ? (
              <Link
                href={`/app/consultas/nueva?paciente=${encodeURIComponent(patient.id)}`}
                className="clinical-primary min-h-11 px-5"
              >
                <Mic size={16} /> Iniciar consulta
              </Link>
            ) : null}
          </div>
        </div>

        {/* Las alergias no son un campo más: son lo primero que un médico
            necesita ver antes de formular. Con alguna registrada, salen del
            formulario y se vuelven aviso. */}
        {patient.alergias.length ? (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-line pt-4">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning">
              <AlertTriangle size={13} /> Alergias:
            </span>
            {patient.alergias.map((a) => (
              <span
                key={a}
                className="inline-flex items-center rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-ink ring-1 ring-inset ring-warning/30"
              >
                {a}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div>
          {/* La acción va en el encabezado del bloque: es donde se mira cuando
              se descubre que las alergias están vacías. */}
          <SectionRule
            title="Historia clínica"
            action={
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="shrink-0 text-[12px] font-semibold text-accent hover:underline"
              >
                Editar
              </button>
            }
          />
          <dl className="clinical-panel space-y-4 p-5 text-sm">
            <Field label="Antecedentes" values={patient.antecedentes} />
            <Field
              label="Alergias"
              values={patient.alergias}
              vacio="Sin alergias registradas"
            />
            <Field label="Medicamentos" values={patient.medicamentos} />
          </dl>
        </div>

        <div>
          <SectionRule
            title="Encuentros"
            count={encuentros.length || undefined}
          />
          {encuentros.length ? (
            <div className="clinical-list">
              {encuentros.map((c) => (
                <Link
                  key={c.id}
                  href={`/app/consultas/${c.id}`}
                  className="clinical-list-row flex items-start justify-between gap-3 px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-deep">
                      {c.motivo}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted">
                      {c.especialidad} · {c.servicio} ·{" "}
                      {formatFechaRelativa(c.fecha)}
                    </div>
                  </div>
                  <StatusBadge estado={c.estado} />
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

      {editando ? (
        <PatientFormDialog
          patient={patient}
          onClose={() => setEditando(false)}
          onSaved={() => setEditando(false)}
        />
      ) : null}
    </AppPage>
  );
}

function Field({
  label,
  values,
  vacio = "—",
}: {
  label: string;
  values: string[];
  vacio?: string;
}) {
  return (
    <div>
      <dt className="doc-label">{label}</dt>
      <dd className="mt-1 text-ink-soft">
        {values.length ? values.join(", ") : vacio}
      </dd>
    </div>
  );
}
