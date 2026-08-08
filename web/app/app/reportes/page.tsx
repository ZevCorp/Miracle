import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { fetchHospitalDashboard } from "@/lib/hospital/dashboard";
import { resolverRango } from "@/lib/superadmin/rango";
import { ReportesView } from "@/components/app/ReportesView";

export const metadata = { title: "Reportes" };

/**
 * Reportes de gerencia. Server component a propósito: las cifras salen de la
 * RPC `hospital_dashboard` con el rango que venga en la URL, así que la página
 * llega renderizada con los números correctos y sin parpadeo de carga.
 *
 * Antes esta pantalla calculaba sus totales en el navegador sobre el store
 * (capado a 300 consultas) y sin excluir las consultas de demostración, así que
 * daba cifras distintas a las del panel de inicio para el mismo dato.
 */
export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; desde?: string; hasta?: string }>;
}) {
  await requireRole("admin", "supervisor");

  const sp = await searchParams;
  const rango = resolverRango(sp);
  const supabase = await createClient();
  const { data, error } = await fetchHospitalDashboard(supabase, rango);

  return <ReportesView data={data} rango={rango} error={error} />;
}
