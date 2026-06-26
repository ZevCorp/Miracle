import { requireRole } from "@/lib/auth/server";
import { ReportesView } from "@/components/app/ReportesView";

export const metadata = { title: "Reportes" };

export default async function ReportesPage() {
  await requireRole("admin", "supervisor");
  return <ReportesView />;
}
