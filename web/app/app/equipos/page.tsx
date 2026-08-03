import { AppPage, AppPageHeader } from "@/components/app/AppPage";
import { DevicePairPanel } from "@/components/app/DevicePairPanel";

// Vinculación de equipos de Operations. La autorización de /app la hace el
// layout (sesión + rol); aquí no hay requireRole porque quien vincula es el
// propio médico dueño del equipo — no un admin. La secretaria no llega: su
// lista blanca de rutas (lib/auth/roles.ts) no incluye /app/equipos.
export default function EquiposPage() {
  return (
    <AppPage className="mx-auto max-w-3xl">
      <AppPageHeader
        title="Equipos"
        description="Vincula el computador del consultorio para que trabaje tus consultas mientras atiendes: crea la consulta, guarda el dictado y deja la nota lista como borrador. Revisar, firmar y enviar a la historia clínica siguen siendo tuyos."
      />
      <div className="mt-6">
        <DevicePairPanel />
      </div>
    </AppPage>
  );
}
