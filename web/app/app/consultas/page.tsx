import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { STATUS_LABEL, type ConsultationStatus, type ConsultationType } from "@/lib/mock";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { ConsultationCard } from "@/components/app/ConsultationCard";
import { EmptyState } from "@/components/app/EmptyState";
import { Pager } from "@/components/app/Pager";
import { ConsultasFilters, type DoctorOption } from "./ConsultasFilters";
import { AppPage, AppPageHeader } from "@/components/app/AppPage";

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

type AccessRow = {
  medico_id: string;
  profiles:
    | { full_name: string | null; email: string | null }
    | { full_name: string | null; email: string | null }[]
    | null;
};

export default async function ConsultasPage({
  searchParams,
}: {
  searchParams: Promise<{
    estado?: string;
    servicio?: string;
    q?: string;
    page?: string;
    medico?: string;
  }>;
}) {
  const { estado, servicio, q, page, medico } = await searchParams;
  const estadoFilter = (ESTADOS as string[]).includes(estado ?? "")
    ? (estado as ConsultationStatus | "todas")
    : "todas";
  const servicioFilter = (servicio ?? "todos").trim() || "todos";
  const term = (q ?? "").trim();
  const pageNum = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const from = (pageNum - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const profile = await getCurrentProfile();

  // La secretaría solo ve a los médicos que le hayan asignado en
  // secretary_doctor_access (acotado también por RLS del lado del servidor).
  let doctors: DoctorOption[] = [];
  let medicoFilter = "todos";
  if (profile?.role === "secretaria") {
    const { data: accesos } = await supabase
      .from("secretary_doctor_access")
      .select("medico_id, profiles!secretary_doctor_access_medico_id_fkey(full_name, email)")
      .eq("secretary_id", profile.id);
    doctors = ((accesos ?? []) as AccessRow[]).map((a) => {
      const p = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
      return { id: a.medico_id, label: p?.full_name || p?.email || "Médico" };
    });
    if (medico && doctors.some((d) => d.id === medico)) medicoFilter = medico;
  }

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
  if (medicoFilter !== "todos") query = query.eq("medico_id", medicoFilter);
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
    if (medicoFilter !== "todos") sp.set("medico", medicoFilter);
    if (term) sp.set("q", term);
    const qs = sp.toString();
    return `/app/consultas${qs ? `?${qs}` : ""}`;
  };

  return (
    <AppPage>
      <AppPageHeader
        kicker="Documentación clínica"
        title="Consultas"
        description={`${total} ${total === 1 ? "consulta registrada" : "consultas registradas"}`}
        action={
          profile?.role === "medico" ? (
            <Link href="/app/consultas/nueva" className="clinical-primary w-full sm:w-auto">
              <Plus size={16} /> Nueva consulta
            </Link>
          ) : undefined
        }
      />

      <ConsultasFilters
        initialQuery={term}
        initialServicio={servicioFilter}
        estado={estadoFilter}
        doctors={doctors}
        initialMedico={medicoFilter}
      />

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Filtrar por estado">
        {ESTADOS.map((e) => (
          <Link
            key={e}
            href={chipHref(e)}
            className={`rounded-[9px] border px-3.5 py-2 text-sm font-semibold transition-colors ${
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
            description="Cambia los filtros o inicia una consulta."
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
          medico: medicoFilter !== "todos" ? medicoFilter : undefined,
          q: term || undefined,
        }}
      />
    </AppPage>
  );
}
