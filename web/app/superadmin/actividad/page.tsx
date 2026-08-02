import { redirect } from "next/navigation";

// La sección se renombró a Analítica (y su bloque de salud se mudó a /salud).
// Este stub conserva la URL vieja para marcadores y enlaces guardados.
export default function ActividadRedirect() {
  redirect("/superadmin/analitica");
}
