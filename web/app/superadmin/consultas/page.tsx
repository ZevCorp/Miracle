import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { formatFechaRelativa } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { FlashBanner } from "@/components/superadmin/FlashBanner";
import { DeleteConsultationButton } from "@/components/superadmin/DeleteConsultationButton";
import { FilterBar } from "@/components/superadmin/FilterBar";
import { Pager } from "@/components/app/Pager";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge } from "@/components/app/StatusBadge";
import type { ConsultationStatus } from "@/lib/mock";

const PAGE_SIZE = 25;
const ESTADOS: { value: ConsultationStatus; label: string }[] = [
  { value: "borrador", label: "Borrador" },
  { value: "revisada", label: "Revisada" },
  { value: "aprobada", label: "Aprobada" },
  { value: "exportada", label: "Exportada" },
];

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
  searchParams: Promise<{
    ok?: string;
    error?: string;
    estado?: string;
    org?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const db = await createClient();

  const estadoFilter = ESTADOS.some((e) => e.value === sp.estado)
    ? (sp.estado as ConsultationStatus)
    : "todas";
  const term = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [orgsRes, countsRes] = await Promise.all([
    db.from("organizations").select("id, name").order("name"),
    db.rpc("consultation_status_counts"),
  ]);
  const orgs = (orgsRes.data ?? []) as { id: string; name: string }[];
  const orgFilter = orgs.some((o) => o.id === sp.org) ? (sp.org as string) : "todos";

  const counts = new Map(
    ((countsRes.data ?? []) as { estado: string; n: number }[]).map((c) => [c.estado, c.n]),
  );
  const totalGlobal = [...counts.values()].reduce((sum, n) => sum + Number(n), 0);

  let query = db
    .from("consultations")
    .select(
      "id, motivo, fecha, estado, especialidad, organizations(name), patients(nombre)",
      { count: "exact" },
    )
    .order("fecha", { ascending: false })
    .range(from, to);
  if (estadoFilter !== "todas") query = query.eq("estado", estadoFilter);
  if (orgFilter !== "todos") query = query.eq("organization_id", orgFilter);
  if (term) {
    // Misma sanitización que app/app/consultas: los metacaracteres de PostgREST
    // se sustituyen para que el término no rompa el filtro `or`.
    const safe = term.replace(/[%,()*\\]/g, " ").trim();
    if (safe) query = query.or(`motivo.ilike.%${safe}%,especialidad.ilike.%${safe}%`);
  }

  const { data, count, error: queryError } = await query;
  const consultas = (data ?? []) as unknown as ConsultaRow[];
  const total = count ?? 0;

  // La URL actual completa: el delete la lleva como returnTo para que eliminar
  // una consulta no borre también los filtros que el usuario tenía puestos.
  const currentParams = new URLSearchParams();
  if (estadoFilter !== "todas") currentParams.set("estado", estadoFilter);
  if (orgFilter !== "todos") currentParams.set("org", orgFilter);
  if (term) currentParams.set("q", term);
  if (page > 1) currentParams.set("page", String(page));
  const currentUrl = `/superadmin/consultas${currentParams.size ? `?${currentParams.toString()}` : ""}`;

  const chipHref = (estado: string) => {
    const chip = new URLSearchParams();
    if (estado !== "todas") chip.set("estado", estado);
    if (orgFilter !== "todos") chip.set("org", orgFilter);
    if (term) chip.set("q", term);
    const qs = chip.toString();
    return `/superadmin/consultas${qs ? `?${qs}` : ""}`;
  };

  const chipClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "border-accent bg-accent-soft text-accent-ink"
        : "border-line bg-surface text-ink-soft hover:border-mist"
    }`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-deep">Consultas</h1>
        <p className="text-sm text-muted">
          Vista global de todas las organizaciones. Eliminar una consulta la quita de toda la
          plataforma; es exclusivo de esta consola.
        </p>
      </div>

      <FlashBanner ok={sp.ok} error={sp.error} />

      {queryError ? (
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          No fue posible cargar las consultas. Verifica que la migración de borrado esté aplicada
          (columna <code>deleted_at</code> y políticas RLS).
        </div>
      ) : null}

      {/* --- Chips de estado con conteo ------------------------------------ */}
      <div className="flex flex-wrap gap-2">
        <Link href={chipHref("todas")} className={chipClass(estadoFilter === "todas")}>
          Todas
          <span className="text-xs text-muted">{totalGlobal}</span>
        </Link>
        {ESTADOS.map((estado) => (
          <Link
            key={estado.value}
            href={chipHref(estado.value)}
            className={chipClass(estadoFilter === estado.value)}
          >
            {estado.label}
            <span className="text-xs text-muted">{Number(counts.get(estado.value) ?? 0)}</span>
          </Link>
        ))}
      </div>

      <FilterBar
        basePath="/superadmin/consultas"
        searchPlaceholder="Buscar por motivo o especialidad"
        initialQuery={term}
        selects={[
          {
            name: "org",
            value: orgFilter,
            allLabel: "Todas las organizaciones",
            options: orgs.map((o) => ({ value: o.id, label: o.name })),
          },
        ]}
        preserved={{ estado: estadoFilter === "todas" ? undefined : estadoFilter }}
      />

      {/* --- Tabla ---------------------------------------------------------- */}
      <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-xs)]">
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
                <DeleteConsultationButton consultationId={c.id} label={label} returnTo={currentUrl} />
              </div>
            </div>
          );
        })}
        {consultas.length === 0 && !queryError ? (
          <div className="p-5">
            <EmptyState
              icon={<ClipboardList size={20} />}
              title={
                term || estadoFilter !== "todas" || orgFilter !== "todos"
                  ? "Nada coincide con el filtro"
                  : "No hay consultas registradas"
              }
              description={
                term
                  ? `Sin resultados para «${term}». Prueba con otro término o quita los filtros.`
                  : undefined
              }
            />
          </div>
        ) : null}
      </div>

      <Pager
        basePath="/superadmin/consultas"
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        params={{
          estado: estadoFilter === "todas" ? undefined : estadoFilter,
          org: orgFilter === "todos" ? undefined : orgFilter,
          q: term || undefined,
        }}
      />
    </div>
  );
}
