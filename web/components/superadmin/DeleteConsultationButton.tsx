"use client";

import { Trash2 } from "lucide-react";
import { deleteConsultationAsSuperadmin } from "@/app/superadmin/actions";

/**
 * Botón de eliminar de la consola de superadmin, con confirmación (mismo
 * patrón window.confirm que el resto de la app). El borrado en sí es suave
 * (deleted_at, ver la migración de la RPC): desaparece de toda la app pero
 * el registro sigue en la base.
 */
export function DeleteConsultationButton({
  consultationId,
  label,
}: {
  consultationId: string;
  label: string;
}) {
  return (
    <form
      action={deleteConsultationAsSuperadmin}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `¿Eliminar esta consulta (${label})? Dejará de verse en toda la plataforma.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="consultationId" value={consultationId} />
      <button
        type="submit"
        aria-label={`Eliminar ${label}`}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger-soft"
      >
        <Trash2 size={14} /> Eliminar
      </button>
    </form>
  );
}
