import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { FlashBanner } from "@/components/superadmin/FlashBanner";
import { ConfiguracionForm } from "./ConfiguracionForm";

type OrgRow = {
  name: string | null;
  nit: string | null;
  use_hospital_templates: boolean | null;
};

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const profile = await requireRole("admin");
  const { ok, error } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("name, nit, use_hospital_templates")
    .eq("id", profile.organizationId ?? "")
    .maybeSingle();
  const org = (data ?? null) as OrgRow | null;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-deep">Configuración institucional</h1>
      <p className="text-sm text-muted">
        Ajustes de la institución, consentimiento, formatos e integraciones.
      </p>

      <div className="mt-6 space-y-5">
        <FlashBanner ok={ok} error={error} />
        <ConfiguracionForm
          initial={{
            name: org?.name ?? "",
            nit: org?.nit ?? "",
            useHospitalTemplates: org?.use_hospital_templates ?? true,
          }}
        />
      </div>
    </div>
  );
}
