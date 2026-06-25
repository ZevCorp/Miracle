import { getCurrentProfile } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  customTemplateSelect,
  customTemplateToTemplate,
  type CustomClinicalTemplateRow,
} from "@/lib/templates/custom";
import { TemplateCatalog } from "./TemplateCatalog";

export default async function PlantillasPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("clinical_templates")
    .select(customTemplateSelect)
    .order("updated_at", { ascending: false });

  const customTemplates = ((data ?? []) as CustomClinicalTemplateRow[]).map(
    customTemplateToTemplate,
  );

  return (
    <TemplateCatalog
      initialSpecialtyCode={profile?.specialtyCode}
      customTemplates={customTemplates}
    />
  );
}
