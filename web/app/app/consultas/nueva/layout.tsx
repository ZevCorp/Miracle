import { requireRoleOrDemo } from "@/lib/auth/server";

export default async function NuevaConsultaLayout({ children }: { children: React.ReactNode }) {
  // La cuenta demo también entra: crear y grabar una consulta es el centro de
  // la presentación comercial.
  await requireRoleOrDemo("medico");
  return children;
}
