import { getCurrentProfile } from "@/lib/auth/server";
import { GeneralSettings } from "./GeneralSettings";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionGeneralPage() {
  // El layout de /app ya garantizó que hay perfil; aquí solo hace falta la
  // especialidad, y solo para ORDENAR el catálogo de plantillas (las suyas
  // arriba). Nunca para filtrarlo: el selector alcanza a todas.
  const profile = await getCurrentProfile();
  return <GeneralSettings specialtyCode={profile?.specialtyCode ?? null} />;
}
