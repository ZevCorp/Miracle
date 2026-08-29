import { AppPage, AppPageHeader } from "@/components/app/AppPage";
import { SettingsNav } from "./SettingsNav";

/**
 * Configuración PERSONAL del médico.
 *
 * No lleva `requireRole`: la alcanza cualquier rol clínico (un supervisor
 * también tiene nombre, cédula y micrófono). El gating vive donde vive el del
 * resto de la app —canAccessPath en lib/auth/roles.ts, que aplica el proxy—, y
 * cada sección comprueba por su cuenta lo que necesite.
 *
 * La configuración de la INSTITUCIÓN es otra ruta (/app/institucion) y sigue
 * siendo solo de admin: son dos cosas distintas y se mantienen separadas.
 */
export default function ConfiguracionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppPage className="mx-auto max-w-4xl">
      <AppPageHeader
        title="Configuración"
        description="Tus preferencias. Solo tuyas: nada de lo que cambies aquí afecta a nadie más de tu equipo."
      />
      <div className="mt-6 flex flex-col gap-5 md:flex-row md:gap-7">
        <SettingsNav />
        <div className="min-w-0 flex-1 space-y-5">{children}</div>
      </div>
    </AppPage>
  );
}
