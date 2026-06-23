import { getCurrentProfile } from "@/lib/auth/server";
import { TemplateCatalog } from "./TemplateCatalog";

export default async function PlantillasPage() {
  const profile = await getCurrentProfile();
  return <TemplateCatalog initialSpecialtyCode={profile?.specialtyCode} />;
}
