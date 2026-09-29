import { requireRole } from "@/lib/auth/server";

export default async function NuevaConsultaLayout({ children }: { children: React.ReactNode }) {
  // La cuenta demo también entra: su rol efectivo es `medico` (ver
  // effectiveRole), y crear y grabar una consulta es el centro de la
  // presentación comercial.
  //
  // `admin_area` también: el jefe de un servicio médico ejerce. Esta lista
  // tiene que decir lo mismo que canAccessPath (lib/auth/roles.ts) o la
  // pantalla se vuelve inalcanzable por un lado aunque el otro la permita —
  // que es exactamente lo que pasó al añadir el rol: canAccessPath ya lo
  // dejaba pasar y este guardia lo devolvía a /app/dashboard?error=forbidden.
  await requireRole("medico", "admin_area");
  return children;
}
