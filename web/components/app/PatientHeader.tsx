import type { Patient } from "@/lib/mock";

export function PatientHeader({
  patient,
  compact = false,
}: {
  patient: Patient;
  compact?: boolean;
}) {
  const initials = patient.nombre
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-night text-sm font-semibold text-white">
        {initials}
      </span>
      <div className="min-w-0">
        <div className="truncate font-semibold text-deep">{patient.nombre}</div>
        <div className="truncate text-xs text-muted">
          {patient.edad > 0
            ? `${patient.edad} años · ${patient.sexo === "F" ? "Femenino" : "Masculino"}${compact ? "" : ` · ${patient.documento} · ${patient.eps}`}`
            : "Datos demográficos por completar"}
        </div>
      </div>
    </div>
  );
}
