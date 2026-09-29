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
import { AreasPanel, type AreaRow } from "./AreasPanel";

export const metadata = { title: "Configuración institucional" };

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const profile = await requireRole("admin");
  const { ok, error } = await searchParams;

  const supabase = await createClient();
  const orgId = profile.organizationId ?? "";

  // Las áreas se piden de forma TOLERANTE, en su propia consulta: si el código
  // llega antes que la migración 20260901140000_areas_medicas.sql, la tabla no
  // existe, `areasError` viene con recado y la pantalla se dibuja sin el panel
  // en vez de reventar entera y dejar al admin sin poder tocar el membrete.
  const [{ data }, { data: areasData, error: areasError }, { data: miembros }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select(ORG_SETTINGS_COLUMNS)
        .eq("id", orgId)
        .maybeSingle(),
      supabase.from("org_areas").select("id, name").eq("organization_id", orgId).order("name"),
      supabase.from("profiles").select("area_id, role").eq("organization_id", orgId),
    ]);

  // El recuento se hace aquí y no con una vista: son decenas de filas, ya están
  // pedidas, y una vista más sería otra cosa que mantener sincronizada.
  const porArea = new Map<string, { miembros: number; jefes: number }>();
  for (const m of (miembros ?? []) as { area_id: string | null; role: string }[]) {
    if (!m.area_id) continue;
    const acc = porArea.get(m.area_id) ?? { miembros: 0, jefes: 0 };
    acc.miembros += 1;
    if (m.role === "admin_area") acc.jefes += 1;
    porArea.set(m.area_id, acc);
  }

  const areas: AreaRow[] = ((areasData ?? []) as { id: string; name: string }[]).map((a) => ({
    id: a.id,
    name: a.name,
    miembros: porArea.get(a.id)?.miembros ?? 0,
    jefes: porArea.get(a.id)?.jefes ?? 0,
  }));

  return (
    <AppPage className="mx-auto max-w-3xl">
      <AppPageHeader
        title="Configuración institucional"
        description="Los datos que encabezan los documentos de tus médicos y los valores que la institución rellena por ellos."
      />

      <div className="mt-6 space-y-5">
        <FlashBanner ok={ok} error={error} />
        <ConfiguracionForm
          initial={rowToOrgSettings((data ?? null) as OrgSettingsRow | null)}
        />
        {areasError ? null : <AreasPanel areas={areas} />}
      </div>
    </AppPage>
  );
}
