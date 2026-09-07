import { PatientsWorkspace, type PatientRow } from "./PatientsWorkspace";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/app/EmptyState";
import { NewPatientButton } from "@/components/app/NewPatientButton";
import { Pager } from "@/components/app/Pager";
import { QueryErrorBanner } from "@/components/app/QueryErrorBanner";
import { PacientesSearch } from "./PacientesSearch";
import { AppPage, AppPageHeader } from "@/components/app/AppPage";

const PAGE_SIZE = 20;



export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; nuevo?: string }>;
}) {
  const { q, page, nuevo } = await searchParams;
  const term = (q ?? "").trim();
  const pageNum = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const from = (pageNum - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("patients")
    .select("id, nombre, edad, sexo, documento, eps", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (term) {
    // Se limpian caracteres que rompen la sintaxis del filtro PostgREST.
    const safe = term.replace(/[%,()*\\]/g, " ").trim();
    if (safe) query = query.or(`nombre.ilike.%${safe}%,documento.ilike.%${safe}%`);
  }

  const { data, count, error: queryError } = await query;
  const patients = (data ?? []) as PatientRow[];
  const total = count ?? 0;

  // Conteo de consultas por paciente (agregado en la base, no N+1 en cliente).
  const { data: countsData } = await supabase.rpc("patient_consultation_counts");
  // Objeto y no Map: los props de un componente de cliente tienen que ser
  // serializables, y un Map no lo es.
  const counts: Record<string, number> = {};
  for (const row of (countsData ?? []) as { patient_id: string; n: number }[]) {
    counts[row.patient_id] = Number(row.n);
  }

  return (
    <AppPage>
      <AppPageHeader
        title="Pacientes"
        description={
          queryError
            ? "No se pudieron cargar los pacientes"
            : `${total} ${total === 1 ? "paciente registrado" : "pacientes registrados"}`
        }
        action={
          <NewPatientButton className="w-full sm:w-auto" autoOpen={nuevo === "1"} />
        }
      />

      <PacientesSearch initialQuery={term} />

      {/* Un fallo de lectura no es un directorio vacío. */}
      {queryError ? (
        <div className="mt-5">
          <QueryErrorBanner
            titulo="No se pudieron cargar los pacientes"
            detalle="No es que no haya pacientes: no fue posible leerlos."
            reintentarHref={term ? `/app/pacientes?q=${encodeURIComponent(term)}` : "/app/pacientes"}
          />
        </div>
      ) : null}

      <PatientsWorkspace rows={patients} counts={counts} />

      {/* El vacío va FUERA de la lista: un EmptyState dentro del marco dejaba
          un borde vacío alrededor de otro borde. */}
      {patients.length === 0 && !queryError ? (
        <div className="mt-5">
          {/* El vacío no es un cartel: es el sitio donde se registra al primer
              paciente. Si se venía buscando, el nombre buscado entra ya escrito
              en el formulario. */}
          <EmptyState
            icon={<Users size={22} />}
            title={term ? "Sin coincidencias" : "Aún no hay pacientes"}
            description={
              term
                ? "Prueba con otro nombre u otro número de documento, o regístralo ahora."
                : "Registra a quien atiendes y su historia quedará junta: consultas, notas y antecedentes."
            }
            action={
              <NewPatientButton
                label={
                  term
                    ? `Crear «${term.length > 28 ? `${term.slice(0, 28)}…` : term}»`
                    : "Registrar el primer paciente"
                }
                initialNombre={term || undefined}
              />
            }
          />
        </div>
      ) : null}

      <Pager
        basePath="/app/pacientes"
        page={pageNum}
        pageSize={PAGE_SIZE}
        total={total}
        params={{ q: term || undefined }}
      />
    </AppPage>
  );
}
