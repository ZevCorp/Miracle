import { AppPage } from "@/components/app/AppPage";

/** Esqueleto de la lista mientras el servidor consulta. Mismo ritmo visual
 *  que la página cargada: título, barra de filtros y filas. */
export default function Loading() {
  return (
    <AppPage>
      <div aria-busy="true" aria-label="Cargando">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-ice-soft" />
        <div className="mt-2 h-4 w-40 animate-pulse rounded bg-ice-soft" />
        <div className="mt-6 h-12 animate-pulse rounded-[16px] bg-ice-soft" />
        <div className="clinical-list mt-5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-4">
              <div className="h-10 w-10 animate-pulse rounded-full bg-ice-soft" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-1/3 animate-pulse rounded bg-ice-soft" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-ice-soft" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppPage>
  );
}
