import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { MiracleProvider } from "./providers";
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
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?error=account-not-ready");
  // El superadmin no usa el panel del hospital; tiene su consola de plataforma.
  if (profile.role === "superadmin") redirect("/superadmin");
  if (profile.role === "medico" && !profile.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  return (
    <MiracleProvider role={profile.role} userName={profile.fullName ?? profile.email}>
      <AppShell profile={profile}>{children}</AppShell>
    </MiracleProvider>
  );
}
