import Link from "next/link";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL, type ConsultationStatus } from "@/lib/mock";
import { formatFechaRelativa } from "@/lib/dates";
import { StatusBadge, STATUS_CHIP_ACTIVE } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { Pager } from "@/components/app/Pager";
import { AppPage, AppPageHeader } from "@/components/app/AppPage";

const PAGE_SIZE = 20;
const ESTADOS: (ConsultationStatus | "todas")[] = [
  "todas",
  "borrador",
  "revisada",
  "aprobada",
  "exportada",
];

type Row = {
  id: string;
  motivo: string | null;
  especialidad: string | null;
  fecha: string;
  estado: ConsultationStatus;
  paciente_nombre: string | null;
  paciente_documento: string | null;
  patients: { nombre: string | null } | { nombre: string | null }[] | null;
};

/**
 * Un paciente registrado y asociado a mano manda sobre el nombre copiado de la
 * nota; el de la nota es mejor que rendirse con "Paciente sin identificar".
 */
function patientName(row: Row): string {
  const p = row.patients;
  const asociado = (Array.isArray(p) ? p[0] : p)?.nombre?.trim();
  return asociado || row.paciente_nombre?.trim() || "Paciente sin identificar";
}

export default async function NotasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; page?: string }>;
}) {
  const { estado, page } = await searchParams;
  const estadoFilter = (ESTADOS as string[]).includes(estado ?? "")
    ? (estado as ConsultationStatus | "todas")
    : "todas";
  const pageNum = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const from = (pageNum - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("consultations")
    .select(
      "id, motivo, especialidad, fecha, estado, paciente_nombre, paciente_documento, patients(nombre)",
      { count: "exact" },
    )
    .order("fecha", { ascending: false })
    .range(from, to);
  if (estadoFilter !== "todas") query = query.eq("estado", estadoFilter);

  const { data, count } = await query;
  const rows = (data ?? []) as Row[];
  const total = count ?? 0;

  // Conteos por estado (para los chips), agregados en la base.
  const { data: countsData } = await supabase.rpc("consultation_status_counts");
  const counts = new Map<string, number>();
  let all = 0;
  for (const r of (countsData ?? []) as { estado: string; n: number }[]) {
    counts.set(r.estado, Number(r.n));
    all += Number(r.n);
  }
  const chipCount = (e: ConsultationStatus | "todas") =>
    e === "todas" ? all : (counts.get(e) ?? 0);

  return (
    <AppPage>
      <AppPageHeader
        kicker="Revisión médica"
        title="Notas clínicas"
        description={`${total} ${total === 1 ? "nota en la bandeja" : "notas en la bandeja"}`}
      />

      <div className="flex flex-wrap gap-2" aria-label="Filtrar notas por estado">
        {ESTADOS.map((e) => {
          const active = estadoFilter === e;
          const href = e === "todas" ? "/app/notas" : `/app/notas?estado=${e}`;
          return (
            <Link
              key={e}
              href={href}
              className={`inline-flex items-center gap-2 rounded-[9px] border px-3.5 py-2 text-sm font-semibold transition-colors ${
                active
                  ? STATUS_CHIP_ACTIVE[e]
                  : "border-line bg-surface text-ink-soft hover:border-mist"
              }`}
            >
              {e === "todas" ? "Todas" : STATUS_LABEL[e]}
              {/* Activo: el contador hereda el color del chip (si no, el azul
                  fijo peleaba con el ámbar/verde del estado seleccionado). */}
              <span
                className={`rounded-full px-1.5 text-[12px] tabular-nums ${
                  active ? "bg-surface/70 text-current" : "bg-ice text-muted"
                }`}
              >
                {chipCount(e)}
              </span>
            </Link>
          );
        })}
      </div>

      {rows.length ? (
        <div className="clinical-list mt-5">
          {rows.map((c) => (
            <Link
              key={c.id}
              href={`/app/consultas/${c.id}`}
              className="clinical-list-row flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ice text-accent">
                <FileText size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-deep">
                  {patientName(c)}
                </div>
                <div className="mt-0.5 truncate text-[13px] text-muted">
                  {c.motivo || "Motivo sin registrar"} · {c.especialidad} · {formatFechaRelativa(c.fecha)}
                </div>
              </div>
              <StatusBadge estado={c.estado} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState title="Sin notas en este estado" />
        </div>
      )}

      <Pager
        basePath="/app/notas"
        page={pageNum}
        pageSize={PAGE_SIZE}
        total={total}
        params={{ estado: estadoFilter !== "todas" ? estadoFilter : undefined }}
      />
    </AppPage>
  );
}
