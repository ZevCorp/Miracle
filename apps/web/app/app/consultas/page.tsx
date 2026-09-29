import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { STATUS_LABEL, type ConsultationStatus, type ConsultationType } from "@/lib/mock";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/server";
import {
  ORG_SETTINGS_COLUMNS,
  rowToOrgSettings,
  serviciosDe,
  type OrgSettingsRow,
} from "@/lib/hospital/org";
import { ConsultationCard } from "@/components/app/ConsultationCard";
import { STATUS_CHIP_ACTIVE } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { QueryErrorBanner } from "@/components/app/QueryErrorBanner";
import { Pager } from "@/components/app/Pager";
import { ConsultasFilters, type DoctorOption } from "./ConsultasFilters";
import { AppPage, AppPageHeader } from "@/components/app/AppPage";

const PAGE_SIZE = 18;
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
  patient_id: string | null;
  especialidad: string | null;
  tipo: string | null;
  estado: ConsultationStatus;
  motivo: string | null;
  fecha: string;
  servicio: string | null;
  rotulo: string | null;
  // Solo alimentan la vista rápida al pasar el cursor sobre la tarjeta.
  resumen: string | null;
  duracion_min: number | null;
  // Copias que la base extrae de la nota (migración consultation_patient_identity).
  paciente_nombre: string | null;
  paciente_documento: string | null;
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

  // El rótulo es el número de caso de un laboratorio: existe en una institución
  // (B2B) y no en un consultorio personal (B2C). Ante un orgKind desconocido se
  // asume institución, como ya hace visibleAppNav en lib/site.ts.
  const muestraRotulo = (profile?.orgKind ?? "institution") === "institution";

  // Servicios de la institución (Configuración institucional). Sin configurar,
  // `serviciosDe` cae a la lista por defecto de la app.
  const { data: orgRow } = await supabase
    .from("organizations")
    .select(ORG_SETTINGS_COLUMNS)
    .maybeSingle();
  const servicios = serviciosDe(rowToOrgSettings((orgRow ?? null) as OrgSettingsRow | null));

  // Lista de médicos para el filtro. Quién puede aparecer depende del rol:
  //
  //  · secretaría → solo los médicos que le asignaron en
  //    secretary_doctor_access (acotado también por RLS del lado del servidor).
  //  · admin / supervisor → todo el equipo que documenta en su organización.
  //    Es lo que hace navegable la tabla de adopción del panel institucional:
  //    "este médico acumula 25 notas sin firmar" → ver exactamente cuáles.
  //
  // Un médico no recibe lista: por RLS solo ve sus propias consultas, así que
  // el selector no tendría nada que filtrar.
  let doctors: DoctorOption[] = [];
  let medicoFilter = "todos";
  // `uiRole`: la demo tiene rol `admin` en la base, pero se le enseña el
  // producto del médico. Con el rol crudo le salía el selector de "filtrar por
  // médico" del equipo —que un médico nunca ve— y se quedaba sin el botón
  // "Nueva consulta".
  const uiRole = profile?.uiRole;
  // La comparación va contra `profile?.uiRole` y no contra la variable de
  // arriba: así TypeScript sigue sabiendo que dentro del if `profile` no es
  // null, que es lo que permite usar `profile.id` sin comprobarlo otra vez.
  const esSecretaria = profile?.uiRole === "secretaria";

  if (esSecretaria) {
    const { data: accesos } = await supabase
      .from("secretary_doctor_access")
      .select("medico_id, profiles!secretary_doctor_access_medico_id_fkey(full_name, email)")
      .eq("secretary_id", profile.id);
    doctors = ((accesos ?? []) as AccessRow[]).map((a) => {
      const p = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
      return { id: a.medico_id, label: p?.full_name || p?.email || "Médico" };
    });
  } else if (uiRole === "admin" || uiRole === "supervisor") {
    const { data: equipo } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("role", ["medico", "supervisor"])
      .order("full_name", { ascending: true });
    doctors = (equipo ?? []).map((p) => ({
      id: p.id,
      label: p.full_name || p.email || "Médico",
    }));
  }

  // El id llega por URL: se valida contra la lista permitida en vez de pasarlo
  // al `.eq()` tal cual. La RLS ya impediría leer fuera de la organización,
  // pero así un id ajeno devuelve "todas" en vez de una lista vacía inexplicable.
  if (medico && doctors.some((d) => d.id === medico)) medicoFilter = medico;

  let query = supabase
    .from("consultations")
    .select(
      "id, patient_id, especialidad, tipo, estado, motivo, fecha, servicio, rotulo, resumen, duracion_min, paciente_nombre, paciente_documento, patients(nombre)",
      { count: "exact" },
    )
    .order("fecha", { ascending: false })
    .range(from, to);
  if (estadoFilter !== "todas") query = query.eq("estado", estadoFilter);
  if (servicioFilter !== "todos") query = query.eq("servicio", servicioFilter);
  if (medicoFilter !== "todos") query = query.eq("medico_id", medicoFilter);
  if (term) {
    const safe = term.replace(/[%,()*\\]/g, " ").trim();
    // Transversal a cualquier especialidad: `rotulo`, `paciente_nombre` y
    // `paciente_documento` vienen de columnas sincronizadas por trigger desde la
    // nota, null cuando la plantilla no trae esa sección. Buscar por el nombre o
    // la cédula del paciente es lo que de verdad pide una secretaría, y ahora
    // que las columnas existen sale gratis.
    if (safe) {
      query = query.or(
        `motivo.ilike.%${safe}%,rotulo.ilike.%${safe}%,paciente_nombre.ilike.%${safe}%,paciente_documento.ilike.%${safe}%`,
      );
    }
  }

  const { data, count, error: queryError } = await query;
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
        title="Consultas"
        description={
          queryError
            ? "No se pudieron cargar las consultas"
            : `${total} ${total === 1 ? "consulta registrada" : "consultas registradas"}`
        }
        action={
          uiRole === "medico" ? (
            <Link href="/app/consultas/nueva" className="clinical-primary w-full sm:w-auto">
              <Plus size={16} /> Iniciar consulta
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
        showServicio={!esSecretaria}
        servicios={servicios}
      />

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Filtrar por estado">
        {ESTADOS.map((e) => (
          <Link
            key={e}
            href={chipHref(e)}
            className={`inline-flex min-h-10 items-center rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
              estadoFilter === e
                ? STATUS_CHIP_ACTIVE[e]
                : "border-line bg-surface text-ink-soft hover:border-mist"
            }`}
          >
            {e === "todas" ? "Todas" : STATUS_LABEL[e]}
          </Link>
        ))}
      </div>

      {/* Un fallo de lectura NO puede verse como "no hay consultas": son dos
          respuestas distintas y el médico necesita distinguirlas. */}
      {queryError ? (
        <div className="mt-6">
          <QueryErrorBanner
            titulo="No se pudieron cargar las consultas"
            detalle="No es que no tengas consultas: no fue posible leerlas."
            reintentarHref={chipHref(estadoFilter)}
          />
        </div>
      ) : null}

      {rows.length ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <ConsultationCard
              key={r.id}
              patientName={patientName(r.patients)}
              rotulo={r.rotulo}
              showRotulo={muestraRotulo}
              peekIds={rows.map((x) => x.id)}
              consultation={{
                id: r.id,
                pacienteId: r.patient_id ?? "",
                especialidad: r.especialidad ?? "",
                tipo: (r.tipo as ConsultationType) ?? "presencial",
                estado: r.estado,
                motivo: r.motivo ?? "",
                fecha: r.fecha,
                servicio: r.servicio,
                resumen: r.resumen,
                duracionMin: r.duracion_min,
                pacienteNombre: r.paciente_nombre,
                pacienteDocumento: r.paciente_documento,
              }}
            />
          ))}
        </div>
      ) : queryError ? null : (
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
