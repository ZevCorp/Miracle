import Link from "next/link";
import { PeekRowLink } from "@/components/app/PeekRowLink";
import { Avatar } from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL, type ConsultationStatus } from "@/lib/mock";
import { formatFechaRelativa } from "@/lib/dates";
import { StatusBadge, STATUS_CHIP_ACTIVE } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { QueryErrorBanner } from "@/components/app/QueryErrorBanner";
import { Pager } from "@/components/app/Pager";
import { AppPage, AppPageHeader } from "@/components/app/AppPage";

const PAGE_SIZE = 20;
// "revisada" no aparece como pestana: es un paso intermedio que el equipo no
// usa (0 notas), y una pestana que siempre marca cero solo gasta espacio. El
// estado sigue existiendo en la base y en el flujo, y esas notas se ven en
// "Todas"; esto es solo el filtro.
const ESTADOS: (ConsultationStatus | "todas")[] = [
  "todas",
  "borrador",
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
 * Devuelve null si no hay identidad: el avatar pinta la silueta gris y el
 * título cae al rótulo genérico.
 */
function patientName(row: Row): string | null {
  const p = row.patients;
  const asociado = (Array.isArray(p) ? p[0] : p)?.nombre?.trim();
  return asociado || row.paciente_nombre?.trim() || null;
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

  const { data, count, error: queryError } = await query;
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
        title="Notas clínicas"
        description={
          queryError
            ? "No se pudieron cargar las notas"
            : `${total} ${total === 1 ? "nota en la bandeja" : "notas en la bandeja"}`
        }
      />

      <div className="flex flex-wrap gap-2" aria-label="Filtrar notas por estado">
        {ESTADOS.map((e) => {
          const active = estadoFilter === e;
          const href = e === "todas" ? "/app/notas" : `/app/notas?estado=${e}`;
          return (
            <Link
              key={e}
              href={href}
              className={`inline-flex items-center gap-2 min-h-10 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
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

      {/* Que la lectura falle no significa que no haya notas. */}
      {queryError ? (
        <div className="mt-5">
          <QueryErrorBanner
            titulo="No se pudieron cargar las notas"
            detalle="No es que no tengas notas pendientes: no fue posible leerlas."
            reintentarHref={estadoFilter === "todas" ? "/app/notas" : `/app/notas?estado=${estadoFilter}`}
          />
        </div>
      ) : null}

      {rows.length ? (
        <div className="clinical-list stagger-in mt-5">
          {rows.map((c) => (
            <PeekRowLink
              key={c.id}
              target={{ kind: "consultation", id: c.id }}
              listIds={rows.map((x) => x.id)}
              href={`/app/consultas/${c.id}`}
              className="clinical-list-row flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5"
              dataLight
            >
              {/* Misma anatomía que la lista de pacientes: quién, no qué
                  documento. Sin identidad, la silueta gris ya lo dice. */}
              <Avatar name={patientName(c)} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-deep">
                  {patientName(c) ?? "Paciente sin identificar"}
                </div>
                <div className="mt-0.5 truncate text-[13px] text-muted">
                  {c.motivo || "Motivo sin registrar"} · {c.especialidad} · {formatFechaRelativa(c.fecha)}
                </div>
              </div>
              <StatusBadge estado={c.estado} />
            </PeekRowLink>
          ))}
        </div>
      ) : queryError ? null : (
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
