import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { STATUS_LABEL, type ConsultationStatus, type ConsultationType } from "@/lib/mock";
import { createClient } from "@/lib/supabase/server";
import { ConsultationCard } from "@/components/app/ConsultationCard";
import { EmptyState } from "@/components/app/EmptyState";
import { Pager } from "@/components/app/Pager";
import { ConsultasFilters } from "./ConsultasFilters";

const PAGE_SIZE = 18;
const ESTADOS: (ConsultationStatus | "todas")[] = [
  "todas",
  "borrador",
  "revisada",
  "aprobada",
  "exportada",
];

type Row = {
  id: string;
  patient_id: string | null;
  especialidad: string | null;
  tipo: string | null;
  estado: ConsultationStatus;
  motivo: string | null;
  fecha: string;
  servicio: string | null;
  patients: { nombre: string | null } | { nombre: string | null }[] | null;
};

function patientName(p: Row["patients"]): string | undefined {
  if (!p) return undefined;
  const row = Array.isArray(p) ? p[0] : p;
  return row?.nombre ?? undefined;
}

export default async function ConsultasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; servicio?: string; q?: string; page?: string }>;
}) {
  const { estado, servicio, q, page } = await searchParams;
  const estadoFilter = (ESTADOS as string[]).includes(estado ?? "")
    ? (estado as ConsultationStatus | "todas")
    : "todas";
  const servicioFilter = (servicio ?? "todos").trim() || "todos";
  const term = (q ?? "").trim();
  const pageNum = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const from = (pageNum - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  let query = supabase
    .from("consultations")
    .select(
      "id, patient_id, especialidad, tipo, estado, motivo, fecha, servicio, patients(nombre)",
      { count: "exact" },
    )
    .order("fecha", { ascending: false })
    .range(from, to);
  if (estadoFilter !== "todas") query = query.eq("estado", estadoFilter);
  if (servicioFilter !== "todos") query = query.eq("servicio", servicioFilter);
  if (term) {
    const safe = term.replace(/[%,()*\\]/g, " ").trim();
    if (safe) query = query.ilike("motivo", `%${safe}%`);
  }

  const { data, count } = await query;
  const rows = (data ?? []) as Row[];
  const total = count ?? 0;

  const chipHref = (e: ConsultationStatus | "todas") => {
    const sp = new URLSearchParams();
    if (e !== "todas") sp.set("estado", e);
    if (servicioFilter !== "todos") sp.set("servicio", servicioFilter);
    if (term) sp.set("q", term);
    const qs = sp.toString();
    return `/app/consultas${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-deep">Consultas</h1>
          <p className="text-sm text-muted">{total} consultas</p>
        </div>
        <Link
          href="/app/consultas/nueva"
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          <Plus size={16} /> Nueva consulta
        </Link>
      </div>

      <ConsultasFilters
        initialQuery={term}
        initialServicio={servicioFilter}
        estado={estadoFilter}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {ESTADOS.map((e) => (
          <Link
            key={e}
            href={chipHref(e)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              estadoFilter === e
                ? "border-accent bg-accent-soft text-accent-ink"
                : "border-line bg-surface text-ink-soft hover:border-mist"
            }`}
          >
            {e === "todas" ? "Todas" : STATUS_LABEL[e]}
          </Link>
        ))}
      </div>

      {rows.length ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <ConsultationCard
              key={r.id}
              patientName={patientName(r.patients)}
              consultation={{
                id: r.id,
                pacienteId: r.patient_id ?? "",
                especialidad: r.especialidad ?? "",
                tipo: (r.tipo as ConsultationType) ?? "presencial",
                estado: r.estado,
                motivo: r.motivo ?? "",
                fecha: r.fecha,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState
            icon={<ClipboardList size={22} />}
            title="Sin consultas para este filtro"
            description="Ajuste los filtros o inicie una nueva consulta."
          />
        </div>
      )}

      <Pager
        basePath="/app/consultas"
        page={pageNum}
        pageSize={PAGE_SIZE}
        total={total}
        params={{
          estado: estadoFilter !== "todas" ? estadoFilter : undefined,
          servicio: servicioFilter !== "todos" ? servicioFilter : undefined,
          q: term || undefined,
        }}
      />
    </div>
  );
}
