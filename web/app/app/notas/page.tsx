import Link from "next/link";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatFechaRelativa, STATUS_LABEL, type ConsultationStatus } from "@/lib/mock";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { Pager } from "@/components/app/Pager";

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
  patients: { nombre: string | null } | { nombre: string | null }[] | null;
};

function patientName(p: Row["patients"]): string {
  if (!p) return "Paciente sin identificar";
  const row = Array.isArray(p) ? p[0] : p;
  return row?.nombre || "Paciente sin identificar";
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
    .select("id, motivo, especialidad, fecha, estado, patients(nombre)", { count: "exact" })
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
    <div>
      <h1 className="text-2xl font-semibold text-deep">Notas clínicas</h1>
      <p className="text-sm text-muted">Bandeja de notas por estado de revisión.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {ESTADOS.map((e) => {
          const active = estadoFilter === e;
          const href = e === "todas" ? "/app/notas" : `/app/notas?estado=${e}`;
          return (
            <Link
              key={e}
              href={href}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "border-line bg-surface text-ink-soft hover:border-mist"
              }`}
            >
              {e === "todas" ? "Todas" : STATUS_LABEL[e]}
              <span className="rounded-full bg-ice px-1.5 text-xs text-muted">
                {chipCount(e)}
              </span>
            </Link>
          );
        })}
      </div>

      {rows.length ? (
        <div className="mt-5 overflow-hidden rounded-lg border border-line bg-surface">
          {rows.map((c, i) => (
            <Link
              key={c.id}
              href={`/app/consultas/${c.id}`}
              className={`flex items-center gap-4 px-5 py-4 hover:bg-ice-soft ${
                i !== 0 ? "border-t border-line" : ""
              }`}
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ice text-accent">
                <FileText size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-deep">
                  {patientName(c.patients)} · {c.motivo}
                </div>
                <div className="truncate text-xs text-muted">
                  {c.especialidad} · {formatFechaRelativa(c.fecha)}
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
    </div>
  );
}
