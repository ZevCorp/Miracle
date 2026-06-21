import { requireRole } from "@/lib/auth/server";

export default async function NuevaConsultaLayout({ children }: { children: React.ReactNode }) {
  await requireRole("medico");
  return children;
}
