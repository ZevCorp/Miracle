import { requireRole } from "@/lib/auth/server";

export default async function NuevaConsultaLayout({ children }: { children: React.ReactNode }) {
  // La cuenta demo también entra: su rol efectivo es `medico` (ver
  // effectiveRole), y crear y grabar una consulta es el centro de la
  // presentación comercial.
  await requireRole("medico");
  return children;
}
