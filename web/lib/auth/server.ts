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

  // `is_demo` y `disabled_at` se piden aparte y de forma tolerante: si el
  // despliegue del código llega antes que la migración que crea la columna,
  // pedirla dentro del select principal haría fallar la consulta y sacaría a
  // TODOS los usuarios al login. Sin la columna, simplemente no hay cuentas
  // demo ni bajas.
  const [{ data: profile, error: profileError }, { data: extraRow }] = await Promise.all([
    supabase.from("profiles").select(columns).eq("id", userId).maybeSingle(),
    supabase
      .from("profiles")
      // El embed a organizations resuelve por la clave foránea
      // profiles.organization_id: sale en la misma consulta, sin viaje extra.
      .select("is_demo, disabled_at, organizations(archived_at)")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  if (profileError || !profile || !isAppRole(profile.role)) return null;

  // Cuenta dada de baja desde /superadmin/mantenimiento. La RPC también fija
  // `banned_until` en auth.users, que impide renovar el token; esta comprobación
  // es la que cierra la ventana de hasta una hora del token ya emitido.
  if (extraRow?.disabled_at) return null;

  // Organización archivada: sus miembros dejan de entrar. El super-admin queda
  // exento por seguridad — es la cuenta que tiene que poder restaurarla, y
  // dejarla fuera convertiría un archivado en un bloqueo de la plataforma.
  const orgEmbed = extraRow?.organizations;
  const orgArchivada = Array.isArray(orgEmbed) ? orgEmbed[0] : orgEmbed;
  if (orgArchivada?.archived_at && profile.role !== "superadmin") return null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    avatarUrl: profile.avatar_url,
    role: profile.role,
    isDemo: extraRow?.is_demo === true,
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

/**
 * Rol con el que se resuelven los permisos de interfaz.
 *
 * La cuenta de demostración comercial tiene rol `admin` en la base (lo necesita
 * para que la RLS le deje leer las consultas de su organización demo), pero se
 * presenta y se limita como médico: no entra a las secciones de administración
 * y sí entra a crear y grabar consultas. Ver DEMO_SECTIONS en lib/auth/roles.ts.
 */
export function effectiveRole(profile: AuthenticatedProfile): AppRole {
  return profile.isDemo ? "medico" : profile.role;
}

export async function requireRole(...allowedRoles: AppRole[]) {
  const profile = await getCurrentProfile();
  if (!profile || !allowedRoles.includes(effectiveRole(profile))) {
    redirect("/app/dashboard?error=forbidden");
  }

  return profile;
}
