import { ClipboardList } from "lucide-react";
import { formatFechaRelativa } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { FlashBanner } from "@/components/superadmin/FlashBanner";
import { DeleteConsultationButton } from "@/components/superadmin/DeleteConsultationButton";
import { StatusBadge } from "@/components/app/StatusBadge";
import type { ConsultationStatus } from "@/lib/mock";

const LIMIT = 100;

type OneOrMany<T> = T | T[] | null;

type ConsultaRow = {
  id: string;
  motivo: string | null;
  fecha: string;
  estado: ConsultationStatus;
  especialidad: string | null;
  organizations: OneOrMany<{ name: string }>;
  patients: OneOrMany<{ nombre: string | null }>;
};

// Supabase tipa los embeds anidados como arrays; en runtime (relación to-one)
// llegan como objeto. Mismo patrón que app/app/auditoria/page.tsx.
function uno<T>(value: OneOrMany<T>): T | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function SuperadminConsultasPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const db = await createClient();

  const { data, error: queryError } = await db
    .from("consultations")
    .select("id, motivo, fecha, estado, especialidad, organizations(name), patients(nombre)")
    .order("fecha", { ascending: false })
    .limit(LIMIT);

  const consultas = (data ?? []) as unknown as ConsultaRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-deep">Consultas</h1>
        <p className="text-sm text-muted">
          Vista global de todas las organizaciones. Eliminar una consulta la quita de toda la
          plataforma; es exclusivo de esta consola.
        </p>
      </div>

      <FlashBanner ok={ok} error={error} />

      {queryError ? (
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          No fue posible cargar las consultas. Verifica que la migración de borrado esté aplicada
          (columna <code>deleted_at</code> y políticas RLS).
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="hidden grid-cols-[1fr_1.6fr_auto_auto_auto] gap-4 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted sm:grid">
          <span>Organización</span>
          <span>Motivo</span>
          <span>Estado</span>
          <span>Fecha</span>
          <span className="text-right">Acción</span>
        </div>
        {consultas.map((c, index) => {
          const org = uno(c.organizations);
          const patient = uno(c.patients);
          const label = `${patient?.nombre ?? "Paciente sin identificar"} · ${org?.name ?? "—"}`;
          return (
            <div
              key={c.id}
              className={`grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[1fr_1.6fr_auto_auto_auto] sm:items-center sm:gap-4 ${
                index ? "border-t border-line" : ""
              }`}
            >
              <div className="min-w-0 truncate text-sm font-medium text-deep">
                {org?.name ?? "—"}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm text-deep">
                  {patient?.nombre ?? "Paciente sin identificar"}
                  {c.motivo ? ` · ${c.motivo}` : ""}
                </div>
                {c.especialidad ? (
                  <div className="truncate text-xs text-muted">{c.especialidad}</div>
                ) : null}
              </div>
              <div>
                <StatusBadge estado={c.estado} />
              </div>
              <div className="text-sm text-muted">{formatFechaRelativa(c.fecha)}</div>
              <div className="sm:text-right">
                <DeleteConsultationButton consultationId={c.id} label={label} />
              </div>
            </div>
          );
        })}
        {consultas.length === 0 && !queryError ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center text-sm text-muted">
            <ClipboardList size={22} className="text-muted" />
            No hay consultas registradas.
          </div>
        ) : null}
      </div>
    </div>
  );
}
