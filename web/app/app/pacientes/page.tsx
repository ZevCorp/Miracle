import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Pager } from "@/components/app/Pager";
import { PacientesSearch } from "./PacientesSearch";
import { AppPage, AppPageHeader } from "@/components/app/AppPage";

const PAGE_SIZE = 20;

type PatientRow = {
  id: string;
  nombre: string;
  edad: number | null;
  sexo: string | null;
  documento: string | null;
  eps: string | null;
};

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
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

  const { data, count } = await query;
  const patients = (data ?? []) as PatientRow[];
  const total = count ?? 0;

  // Conteo de consultas por paciente (agregado en la base, no N+1 en cliente).
  const { data: countsData } = await supabase.rpc("patient_consultation_counts");
  const counts = new Map<string, number>();
  for (const row of (countsData ?? []) as { patient_id: string; n: number }[]) {
    counts.set(row.patient_id, Number(row.n));
  }

  return (
    <AppPage>
      <AppPageHeader
        kicker="Directorio clínico"
        title="Pacientes"
        description={`${total} ${total === 1 ? "paciente registrado" : "pacientes registrados"}`}
      />

      <PacientesSearch initialQuery={term} />

      <div className="clinical-list mt-5">
        {patients.map((p) => (
          <Link
            key={p.id}
            href={`/app/pacientes/${p.id}`}
            className="clinical-list-row flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-night text-sm font-semibold text-white">
              {p.nombre.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-deep">{p.nombre}</div>
              <div className="mt-0.5 truncate text-[13px] text-muted">
                {p.documento || "Documento pendiente"} · {p.eps || "EPS pendiente"}
              </div>
            </div>
            <span className="hidden text-right text-[13px] text-muted sm:block">
              <span className="block font-medium text-ink-soft">
                {p.edad ?? "—"} años{p.sexo ? ` · ${p.sexo}` : ""}
              </span>
              <span>{counts.get(p.id) ?? 0} consultas</span>
            </span>
            <ChevronRight size={18} className="text-muted" />
          </Link>
        ))}
        {patients.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted">
            {term ? "Sin coincidencias." : "Aún no hay pacientes."}
          </div>
        ) : null}
      </div>

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
