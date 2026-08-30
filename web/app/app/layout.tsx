import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { MiracleProvider } from "./providers";
import { UnsavedChangesProvider } from "@/components/app/UnsavedChangesProvider";
import { OmiProvider } from "@/lib/omi/useOmiMicrophone";
import { SnippetsProvider } from "@/components/app/SnippetsProvider";
import { PreferencesProvider } from "@/lib/preferences/client";
import { getUserPreferences } from "@/lib/preferences/server";
import { getCurrentProfile } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Plataforma",
  robots: { index: false, follow: false },
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This is a second, server-side authorization check. proxy.ts improves the
  // navigation experience, but must never be the only protection for /app.
  //
  // Las preferencias van en el mismo Promise.all: las dos consultas solo
  // necesitan la cookie de sesión, así que encadenarlas sería un viaje de ida y
  // vuelta de más en la carga de TODA pantalla de /app. getUserPreferences
  // nunca lanza (cae a los valores por defecto), así que no puede tumbar el
  // layout ni dejar a nadie fuera si la migración aún no está aplicada.
  const [profile, preferences] = await Promise.all([
    getCurrentProfile(),
    getUserPreferences(),
  ]);
  if (!profile) redirect("/login?error=account-not-ready");
  // El superadmin no usa el panel del hospital; tiene su consola de plataforma.
  if (profile.role === "superadmin") redirect("/superadmin");
  // Sin acceso comercial (trial vencido, pago fallido, cancelada) no se monta
  // nada clínico: el letrero de pago vive en /suscripcion, fuera de este shell.
  // La RLS ("billing access gate") es la barrera real; esto es la experiencia.
  if (profile.billing.level === "blocked") redirect("/suscripcion");
  if (profile.role === "medico" && !profile.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  return (
    // `uiRole`, no `role`: el store solo alimenta la interfaz, y la demo debe
    // verse como un médico. Los permisos reales los aplican la RLS y las
    // comprobaciones de servidor, que sí miran el rol de la base.
    <MiracleProvider
      role={profile.uiRole}
      userName={profile.fullName ?? profile.email}
      isDemo={profile.isDemo}
      orgKind={profile.orgKind}
      professionalType={profile.professionalType}
    >
      <UnsavedChangesProvider>
        <PreferencesProvider
          initial={preferences}
          fullName={profile.fullName}
          specialtyCode={profile.specialtyCode}
        >
          <OmiProvider>
            {/* Los atajos se cargan una vez por sesión, y solo cuando alguien
                los pide: montar el provider no consulta nada. */}
            <SnippetsProvider>
              <AppShell profile={profile}>{children}</AppShell>
            </SnippetsProvider>
          </OmiProvider>
        </PreferencesProvider>
      </UnsavedChangesProvider>
    </MiracleProvider>
  );
}
