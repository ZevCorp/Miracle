import "server-only";

import { redirect } from "next/navigation";
import { isAppRole, type AppRole } from "@/lib/auth/roles";
import {
  deriveAccess,
  type BillingAccess,
  type BillingAccountRow,
} from "@/lib/billing/entitlements";
import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability";

export interface AuthenticatedProfile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: AppRole;
  /**
   * Rol con el que se DIBUJA la interfaz. Igual a `role`, salvo en la cuenta de
   * demostración comercial: tiene `admin` en la base para que la RLS le deje
   * leer las consultas de su organización, pero al comprador hay que enseñarle
   * el producto del médico, no el del administrador de hospital.
   *
   * LA REGLA, y el motivo de que este campo exista: para decidir QUÉ SE VE, se
   * usa `uiRole`. Para decidir QUÉ SE PUEDE HACER, `role`. Antes esto vivía
   * solo en `effectiveRole()`, que nadie llamaba fuera de `requireRole`, así que
   * la demo se veía como administrador: salía "Administrador" bajo su nombre,
   * el selector de "filtrar por médico" del equipo, y —lo peor— se quedaba sin
   * el botón "Nueva consulta", que es el centro de la demostración.
   *
   * Va resuelto aquí y no en cada pantalla para que un componente de cliente
   * pueda leerlo: `effectiveRole` vive en un módulo `server-only`.
   */
  uiRole: AppRole;
  /** Cuenta de demostración comercial: ver canAccessPath en lib/auth/roles.ts. */
  isDemo: boolean;
  organizationId: string | null;
  /** personal = B2C (consultorio de una persona); institution = hospital B2B. */
  orgKind: "personal" | "institution" | null;
  /**
   * Estado comercial derivado (lib/billing/entitlements.ts). Con level
   * "blocked", el layout de /app redirige a /suscripcion. La barrera que no se
   * puede evadir es la RLS ("billing access gate"); esto decide redirects y
   * banners sin viajes extra.
   */
  billing: BillingAccess;
  professionalType: "medico_general" | "medico_especialista" | "patologo" | null;
  specialtyCode: string | null;
  specialtyName: string | null;
  professionalRegistration: string | null;
  practiceCountry: string | null;
  practiceCity: string | null;
  onboardingCompletedAt: string | null;
  /**
   * Servicio del hospital al que pertenece (public.org_areas). Es lo que acota
   * a un `admin_area`: sin área, un jefe de servicio no alcanza a nadie.
   *
   * null tiene dos lecturas que aquí no se distinguen: "no tiene área" y "la
   * columna todavía no existe en la base". Ambas se comportan igual —como si
   * no hubiera áreas—, que es la degradación correcta.
   */
  areaId: string | null;
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
  const [
    { data: profile, error: profileError },
    { data: extraRow, error: extraError },
    { data: areaRow },
  ] = await Promise.all([
      supabase.from("profiles").select(columns).eq("id", userId).maybeSingle(),
      supabase
        .from("profiles")
        // El embed va SIEMPRE con el nombre de la clave foránea. Hoy hay tres
        // caminos de profiles a organizations —organization_id (este),
        // organizations.owner_id (el admin fundador) y org_memberships— y sin
        // nombrar cuál, PostgREST responde PGRST201 y NO devuelve nada.
        //
        // Eso ya pasó: al añadir owner_id y org_memberships esta consulta empezó
        // a fallar entera y, como su error se ignoraba, el fallo fue mudo. Con
        // extraRow en null la app daba por hecho que nadie es cuenta demo, que
        // ninguna organización es personal y que no hay datos de facturación:
        // la demo se veía como administrador de hospital.
        //
        // billing_accounts es 1:1 con la organización; PostgREST puede devolver
        // el embed como objeto o como arreglo de uno — se toleran ambos.
        .select(
          "is_demo, disabled_at, organizations!profiles_organization_id_fkey(archived_at, kind, billing_accounts(mode, stripe_status, current_period_end, cancel_at_period_end, trial_ends_at, comped_until))",
        )
        .eq("id", userId)
        .maybeSingle(),
      // El área va en SU PROPIA consulta, no dentro de la de arriba, y el
      // motivo es una avería que ya ocurrió: cuando el embed de organizations
      // se volvió ambiguo, esta consulta empezó a fallar ENTERA y con ella se
      // cayeron de golpe la cuenta demo, el tipo de organización y la
      // facturación. Meter aquí una columna que quizá todavía no exista
      // repetiría exactamente eso. Aislada, si falla solo se pierde el área.
      supabase.from("profiles").select("area_id").eq("id", userId).maybeSingle(),
    ]);

  // Se sigue tolerando el fallo —si el código se despliega antes que una
  // migración, nadie debe quedarse fuera del login— pero ya no en silencio:
  // este error degrada permisos y estado comercial sin romper nada visible, que
  // es justo el tipo de avería que se queda meses sin detectar.
  if (extraError) {
    reportError(extraError, { where: "getCurrentProfile.extraRow" });
  }

  if (profileError || !profile || !isAppRole(profile.role)) return null;

  // Cuenta dada de baja desde /superadmin/mantenimiento. La RPC también fija
  // `banned_until` en auth.users, que impide renovar el token; esta comprobación
  // es la que cierra la ventana de hasta una hora del token ya emitido.
  if (extraRow?.disabled_at) return null;

  // Organización archivada: sus miembros dejan de entrar. El super-admin queda
  // exento por seguridad — es la cuenta que tiene que poder restaurarla, y
  // dejarla fuera convertiría un archivado en un bloqueo de la plataforma.
  const orgEmbed = extraRow?.organizations;
  const org = Array.isArray(orgEmbed) ? orgEmbed[0] : orgEmbed;
  if (org?.archived_at && profile.role !== "superadmin") return null;

  const orgKind = org?.kind === "personal" || org?.kind === "institution" ? org.kind : null;
  const billingEmbed = org?.billing_accounts;
  const billingRow = (Array.isArray(billingEmbed) ? billingEmbed[0] : billingEmbed) ?? null;

  // El superadmin nunca queda bloqueado comercialmente: es quien reconcilia y
  // restaura. (El proxy además lo saca de /app hacia su consola.)
  const billing =
    profile.role === "superadmin"
      ? deriveAccess(null, orgKind, null)
      : deriveAccess(billingRow as BillingAccountRow | null, orgKind, org?.archived_at ?? null);

  const isDemo = extraRow?.is_demo === true;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    avatarUrl: profile.avatar_url,
    role: profile.role,
    uiRole: isDemo ? "medico" : profile.role,
    isDemo,
    organizationId: profile.organization_id ?? null,
    orgKind,
    billing,
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
    areaId: (areaRow as { area_id?: string | null } | null)?.area_id ?? null,
  };
}

/**
 * Rol con el que se resuelven los permisos de interfaz. Alias de `uiRole`, que
 * ya viene resuelto en el perfil; se conserva porque es el nombre con el que
 * `requireRole` y las páginas de servidor lo piden.
 */
export function effectiveRole(profile: AuthenticatedProfile): AppRole {
  return profile.uiRole;
}

export async function requireRole(...allowedRoles: AppRole[]) {
  const profile = await getCurrentProfile();
  if (!profile || !allowedRoles.includes(effectiveRole(profile))) {
    redirect("/app/dashboard?error=forbidden");
  }

  return profile;
}
