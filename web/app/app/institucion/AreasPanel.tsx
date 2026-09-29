import { Layers, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { createArea, deleteArea, renameArea } from "./actions";

export type AreaRow = {
  id: string;
  name: string;
  /** Cuántas cuentas tiene asignadas hoy. */
  miembros: number;
  /** Cuántas de esas cuentas son jefes de servicio. */
  jefes: number;
};

const inputClass =
  "w-full rounded-md border border-line bg-field px-3 py-2 text-sm text-deep outline-none focus:border-accent";

/**
 * El organigrama del hospital: los servicios en los que se reparte la gente.
 *
 * Solo lo ve y lo toca el admin de la institución. Un jefe de servicio no se
 * inventa áreas ni renombra la suya — la política "admin manages areas" de la
 * base exige rol 'admin' estricto, y canAccessPath deja /app/institucion fuera
 * del alcance de 'admin_area'.
 */
export function AreasPanel({ areas }: { areas: AreaRow[] }) {
  const sinJefe = areas.filter((a) => a.jefes === 0);

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-deep">
        <Layers size={16} /> Áreas médicas
      </h2>
      <p className="mt-1 text-sm text-muted">
        Los servicios de la institución. Cada persona pertenece a uno, y un jefe de
        área ve y gestiona únicamente al suyo.
      </p>

      <form action={createArea} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1 text-sm">
          <span className="mb-1 block font-medium text-deep">Nueva área</span>
          <input
            name="name"
            required
            minLength={2}
            maxLength={60}
            placeholder="Urgencias"
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          <Plus size={15} /> Crear
        </button>
      </form>

      {areas.length === 0 ? (
        <p className="mt-5 rounded-[10px] border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          Todavía no hay áreas. Mientras no las haya, todo sigue igual que antes:
          el administrador ve la institución entera.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-line rounded-[10px] border border-line">
          {areas.map((area) => (
            <li key={area.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <form
                action={renameArea}
                className="flex min-w-[220px] flex-1 items-center gap-2"
              >
                <input type="hidden" name="areaId" value={area.id} />
                <input
                  name="name"
                  defaultValue={area.name}
                  required
                  minLength={2}
                  maxLength={60}
                  aria-label={`Nombre del área ${area.name}`}
                  className={inputClass}
                />
                <button
                  type="submit"
                  className="rounded-full border border-line px-3 py-2 text-sm font-medium text-deep hover:border-accent"
                >
                  Guardar
                </button>
              </form>

              <span className="text-sm text-muted">
                {area.miembros} {area.miembros === 1 ? "cuenta" : "cuentas"}
                {area.jefes > 0
                  ? ` · ${area.jefes} ${area.jefes === 1 ? "jefe" : "jefes"}`
                  : " · sin jefe"}
              </span>

              {/* Borrar un área no borra a nadie: la clave foránea es
                  ON DELETE SET NULL (area_id), su gente solo queda sin
                  servicio. Se dice en el título para que nadie lo dude. */}
              <form action={deleteArea}>
                <input type="hidden" name="areaId" value={area.id} />
                <button
                  type="submit"
                  title={
                    area.miembros > 0
                      ? `Borra el área. Las ${area.miembros} cuentas siguen activas, pero quedan sin servicio asignado.`
                      : "Borra el área."
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-sm font-medium text-muted hover:border-danger hover:text-danger"
                >
                  <Trash2 size={14} /> Borrar
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {sinJefe.length > 0 ? (
        <p className="mt-3 text-xs text-muted">
          Sin jefe asignado:{" "}
          <span className="font-medium text-deep">
            {sinJefe.map((a) => a.name).join(", ")}
          </span>
          . Un área sin jefe funciona igual; simplemente la sigue supervisando la
          administración de la institución. El jefe se nombra en Usuarios y roles.
        </p>
      ) : null}
    </Card>
  );
}
