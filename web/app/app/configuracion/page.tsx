import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { FlashBanner } from "@/components/superadmin/FlashBanner";
import { AppPage, AppPageHeader } from "@/components/app/AppPage";
import {
  ORG_SETTINGS_COLUMNS,
  rowToOrgSettings,
  type OrgSettingsRow,
} from "@/lib/hospital/org";
import { ConfiguracionForm } from "./ConfiguracionForm";

export const metadata = { title: "Configuración institucional" };

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
    .select(ORG_SETTINGS_COLUMNS)
    .eq("id", profile.organizationId ?? "")
    .maybeSingle();

  return (
    <AppPage className="mx-auto max-w-3xl">
      <AppPageHeader
        kicker="Institución"
        title="Configuración institucional"
        description="Los datos que encabezan los documentos de tus médicos y los valores que la institución rellena por ellos."
      />

      <div className="mt-6 space-y-5">
        <FlashBanner ok={ok} error={error} />
        <ConfiguracionForm
          initial={rowToOrgSettings((data ?? null) as OrgSettingsRow | null)}
        />
      </div>
    </AppPage>
  );
}
