import { Check, LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { FlashBanner } from "@/components/superadmin/FlashBanner";
import { signOut } from "@/app/login/actions";
import { getCurrentProfile } from "@/lib/auth/server";
import { APP_ROLE_LABEL } from "@/lib/auth/roles";
import { clinicalSpecialties } from "@/lib/clinical/specialties";
import { createClient } from "@/lib/supabase/server";
import { Campo, SettingCard, SettingRow, inputClass } from "../ui";
import { updateOwnProfile } from "./actions";

export const metadata = { title: "Cuenta" };

const TIPO_PROFESIONAL: Record<string, string> = {
  medico_general: "Médico general",
  medico_especialista: "Médico especialista",
  patologo: "Patólogo",
};

export default async function CuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?error=account-not-ready");
  const { ok, error } = await searchParams;

  // La cédula no viaja en AuthenticatedProfile (solo la usan el PDF y el bloque
  // de firma), así que se pide aquí en vez de engordar la consulta que corre en
  // TODA pantalla de /app.
  const supabase = await createClient();
  const { data: extra } = await supabase
    .from("profiles")
    .select("identification_number")
    .eq("id", profile.id)
    .maybeSingle();

  const { data: orgRow } = profile.organizationId
    ? await supabase
        .from("organizations")
        .select("name")
        .eq("id", profile.organizationId)
        .maybeSingle()
    : { data: null };

  const esEspecialista = profile.professionalType === "medico_especialista";
  const especialidadReconocida = clinicalSpecialties.some(
    (especialidad) => especialidad.code === profile.specialtyCode,
  );

  return (
    <>
      <FlashBanner ok={ok} error={error} />

      <form action={updateOwnProfile} className="space-y-5">
        <SettingCard
          title="Tus datos profesionales"
          description="Encabezan y firman las notas que imprimes. Si falta la cédula o el registro médico, el PDF firmado sale sin identificar al responsable."
          footer={
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
              >
                <Check size={16} /> Guardar cambios
              </button>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Campo
                label="Nombre completo"
                hint="Como debe aparecer en la nota firmada."
              >
                <input
                  name="full_name"
                  required
                  minLength={3}
                  maxLength={120}
                  defaultValue={profile.fullName ?? ""}
                  className={inputClass}
                />
              </Campo>
            </div>

            <Campo label="Cédula" hint="Documento de identidad.">
              <input
                name="identification_number"
                defaultValue={extra?.identification_number ?? ""}
                placeholder="1020304050"
                className={inputClass}
              />
            </Campo>

            <Campo label="Registro médico" hint="El que va en el bloque de firma.">
              <input
                name="professional_registration"
                defaultValue={profile.professionalRegistration ?? ""}
                placeholder="RM 12345"
                className={inputClass}
              />
            </Campo>

            {esEspecialista ? (
              <div className="sm:col-span-2">
                <Campo
                  label="Especialidad"
                  hint="Ordena tus plantillas y le dice al asistente desde dónde razonar."
                >
                  <select
                    name="specialty_code"
                    required
                    defaultValue={especialidadReconocida ? profile.specialtyCode! : ""}
                    className={inputClass}
                  >
                    {/* Un <select> cuyo value no case con ninguna opción PINTA la
                        primera y conserva el valor viejo: el médico vería
                        "Cardiología", guardaría sin tocar nada y se le cambiaría
                        la especialidad en silencio. Hoy los códigos de la base
                        coinciden con el catálogo, pero el precio de que un día
                        no coincidan es corromper un dato del perfil clínico sin
                        que nadie lo note. Con una opción vacía y `required`, el
                        peor caso es que tenga que elegir a conciencia. */}
                    {!especialidadReconocida ? (
                      <option value="">Elige tu especialidad</option>
                    ) : null}
                    {clinicalSpecialties.map((especialidad) => (
                      <option key={especialidad.code} value={especialidad.code}>
                        {especialidad.name}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
            ) : null}

            <Campo label="País">
              <input
                name="practice_country"
                defaultValue={profile.practiceCountry ?? ""}
                placeholder="Colombia"
                className={inputClass}
              />
            </Campo>

            <Campo label="Ciudad">
              <input
                name="practice_city"
                defaultValue={profile.practiceCity ?? ""}
                placeholder="Medellín"
                className={inputClass}
              />
            </Campo>
          </div>
        </SettingCard>
      </form>

      {/* Lo que NO se edita aquí, y por qué. Enseñarlo en gris sin explicación
          hace que parezca un campo roto; decir el motivo lo convierte en
          información. */}
      <SettingCard title="Tu cuenta">
        <SettingRow
          first
          title="Correo"
          desc="Es con el que entras. Cambiarlo toca el acceso a la cuenta, así que se hace por soporte."
        >
          <span className="text-sm text-muted">{profile.email}</span>
        </SettingRow>

        {!esEspecialista && profile.professionalType ? (
          <SettingRow
            title="Tipo de práctica"
            desc="Define qué secciones de Miracle existen para ti. Lo ajusta un administrador."
          >
            <span className="text-sm text-muted">
              {TIPO_PROFESIONAL[profile.professionalType] ?? profile.professionalType}
            </span>
          </SettingRow>
        ) : null}

        {orgRow?.name ? (
          <SettingRow title="Organización" desc={`Tu perfil aquí es de ${APP_ROLE_LABEL[profile.role].toLowerCase()}.`}>
            <span className="text-sm text-muted">{orgRow.name}</span>
          </SettingRow>
        ) : null}
      </SettingCard>

      <SettingCard title="Sesión">
        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-deep hover:bg-ice-soft"
          >
            <LogOut size={16} /> Cerrar sesión
          </button>
        </form>
      </SettingCard>
    </>
  );
}
