import { getCurrentProfile } from "@/lib/auth/server";
import { TemplateCatalog } from "./TemplateCatalog";

// Las plantillas viven en el backend clínico (GET /api/clinical/templates);
// aquí solo se resuelve la especialidad del perfil para el filtro inicial.
export default async function PlantillasPage() {
  const profile = await getCurrentProfile();

  return <TemplateCatalog initialSpecialtyCode={profile?.specialtyCode} />;
}
