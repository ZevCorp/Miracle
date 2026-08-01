import "server-only";

import { redirect } from "next/navigation";
import { isAppRole, type AppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export interface AuthenticatedProfile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: AppRole;
  /** Cuenta de demostración comercial: ver canAccessPath en lib/auth/roles.ts. */
  isDemo: boolean;
  organizationId: string | null;
  professionalType: "medico_general" | "medico_especialista" | "patologo" | null;
  specialtyCode: string | null;
  specialtyName: string | null;
  professionalRegistration: string | null;
  practiceCountry: string | null;
  practiceCity: string | null;
  onboardingCompletedAt: string | null;
}

export async function getCurrentProfile(): Promise<AuthenticatedProfile | null> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) return null;

  const columns =
    "id, email, full_name, avatar_url, role, organization_id, professional_type, specialty_code, specialty_name, professional_registration, practice_country, practice_city, onboarding_completed_at";

  // `is_demo` se pide aparte y de forma tolerante: si el despliegue del código
  // llega antes que la migración que crea la columna, pedirla dentro del select
  // principal haría fallar la consulta y sacaría a TODOS los usuarios al login.
  // Sin la columna, simplemente no hay cuentas demo.
  const [{ data: profile, error: profileError }, { data: demoRow }] = await Promise.all([
    supabase.from("profiles").select(columns).eq("id", userId).maybeSingle(),
    supabase.from("profiles").select("is_demo").eq("id", userId).maybeSingle(),
  ]);

  if (profileError || !profile || !isAppRole(profile.role)) return null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    avatarUrl: profile.avatar_url,
    role: profile.role,
    isDemo: demoRow?.is_demo === true,
    organizationId: profile.organization_id ?? null,
    professionalType:
      profile.professional_type === "medico_general" ||
      profile.professional_type === "medico_especialista" ||
      profile.professional_type === "patologo"
        ? profile.professional_type
        : null,
    specialtyCode: profile.specialty_code,
    specialtyName: profile.specialty_name,
    professionalRegistration: profile.professional_registration,
    practiceCountry: profile.practice_country,
    practiceCity: profile.practice_city,
    onboardingCompletedAt: profile.onboarding_completed_at,
  };
}

export async function requireRole(...allowedRoles: AppRole[]) {
  const profile = await getCurrentProfile();
  if (!profile || !allowedRoles.includes(profile.role)) {
    redirect("/app/dashboard?error=forbidden");
  }

  return profile;
}

/**
 * Como requireRole, pero deja pasar también a la cuenta de demostración.
 * Se usa donde la demo debe entrar aunque su rol no corresponda (crear consulta
 * y grabarla en vivo, que son de `medico`). La RLS no cambia: la demo sigue
 * viendo solo su propia organización.
 */
export async function requireRoleOrDemo(...allowedRoles: AppRole[]) {
  const profile = await getCurrentProfile();
  if (!profile || (!allowedRoles.includes(profile.role) && !profile.isDemo)) {
    redirect("/app/dashboard?error=forbidden");
  }

  return profile;
}
