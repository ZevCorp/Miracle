"use client";

import { UserPlus } from "lucide-react";
import { doctors, ROLE_LABEL } from "@/lib/mock";
import { useStore } from "@/app/app/providers";
import { Badge } from "@/components/ui/Badge";

const roleTone = {
  medico: "accent",
  auditor: "mint",
  gerencia: "neutral",
} as const;

export default function UsuariosPage() {
  const { showToast } = useStore();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-deep">Usuarios y roles</h1>
          <p className="text-sm text-muted">
            Gestión del equipo: médico, auditoría y administración.
          </p>
        </div>
        <button
          type="button"
          onClick={() => showToast("La invitación de usuarios se habilita en la versión conectada.", "info")}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          <UserPlus size={16} /> Invitar usuario
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-line bg-white">
        <div className="hidden grid-cols-[1.5fr_1fr_1fr_auto] gap-4 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted sm:grid">
          <span>Usuario</span>
          <span>Especialidad</span>
          <span>Rol</span>
          <span>Estado</span>
        </div>
        {doctors.map((d, i) => (
          <div
            key={d.id}
            className={`grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[1.5fr_1fr_1fr_auto] sm:items-center sm:gap-4 ${
              i !== 0 ? "border-t border-line" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-deep text-xs font-semibold text-white">
                {d.iniciales}
              </span>
              <span className="font-medium text-deep">{d.nombre}</span>
            </div>
            <span className="text-sm text-ink-soft">{d.especialidad}</span>
            <span>
              <Badge tone={roleTone[d.rol]}>{ROLE_LABEL[d.rol]}</Badge>
            </span>
            <span className="text-sm font-medium text-success">Activo</span>
          </div>
        ))}
      </div>
    </div>
  );
}
