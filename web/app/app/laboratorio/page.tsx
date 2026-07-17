import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/server";
import { canUsePhotoNotes } from "@/lib/clinical/bacteriology";
import { createClient } from "@/lib/supabase/server";
import { LaboratorioWorkspace } from "@/components/app/LaboratorioWorkspace";

// Workspace exclusivo de cuentas bacteriólogo: generar notas de laboratorio desde una foto de
// la hoja manuscrita. Doble candado: la nav lo oculta al resto y aquí se bloquea el acceso
// directo por URL.
export default async function LaboratorioPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canUsePhotoNotes(profile.professionalType)) {
    redirect("/app/dashboard?error=forbidden");
  }

  let organizationName: string | null = null;
  if (profile.organizationId) {
    const db = await createClient();
    const { data } = await db
      .from("organizations")
      .select("name")
      .eq("id", profile.organizationId)
      .maybeSingle();
    organizationName = data?.name ?? null;
  }

  return (
    <LaboratorioWorkspace
      professional={{
        name: profile.fullName ?? profile.email,
        specialtyName: profile.specialtyName,
        registration: profile.professionalRegistration,
        city: profile.practiceCity,
      }}
      organizationName={organizationName}
    />
  );
}
