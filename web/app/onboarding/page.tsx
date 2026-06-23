import { redirect } from "next/navigation";
import { BrandSphere } from "@/components/brand/BrandSphere";
import { getCurrentProfile } from "@/lib/auth/server";
import { ClinicalOnboardingForm } from "./ClinicalOnboardingForm";

export default async function OnboardingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "medico" || profile.onboardingCompletedAt) {
    redirect("/app/dashboard");
  }

  const fullName = profile.fullName ?? profile.email;

  return (
    <main className="min-h-screen bg-pearl px-5 py-10 md:py-16">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center gap-3">
          <BrandSphere size={44} />
          <span className="text-sm font-semibold tracking-wide text-accent">MIRACLE · PERFIL CLÍNICO</span>
        </div>
        <div className="mt-8">
          <span className="text-sm font-medium text-accent">Primer ingreso · menos de 1 minuto</span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-deep md:text-4xl">
            Personalicemos tu espacio de trabajo.
          </h1>
          <p className="mt-3 max-w-xl text-base text-ink-soft">
            Hola, {fullName}. Selecciona tu tipo de práctica y habilitaremos las plantillas clínicas que mejor se ajustan a tu atención.
          </p>
        </div>
        <ClinicalOnboardingForm fullName={fullName} />
      </div>
    </main>
  );
}
