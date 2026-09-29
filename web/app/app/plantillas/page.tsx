import { getCurrentProfile } from "@/lib/auth/server";
import { PlantillasTabs } from "./PlantillasTabs";

// Las plantillas viven en el backend clínico (GET /api/clinical/templates);
// aquí solo se resuelve la especialidad del perfil para el filtro inicial.
// Los atajos (segunda pestaña) sí son de Supabase y los carga el cliente.
export default async function PlantillasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [profile, params] = await Promise.all([
    getCurrentProfile(),
    searchParams,
  ]);

  return (
    <PlantillasTabs
      initialSpecialtyCode={profile?.specialtyCode}
      initialTab={params.tab === "atajos" ? "atajos" : "plantillas"}
    />
  );
}
