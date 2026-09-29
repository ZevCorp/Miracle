import { MonitorSmartphone, MonitorX, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AutoRefresh } from "@/components/superadmin/AutoRefresh";
import { StatTile } from "@/components/superadmin/charts/StatTile";
import { DeviceTable, type DeviceRow } from "@/components/superadmin/DeviceTable";
import { estaDesactualizada, versionMasReciente } from "@/lib/superadmin/versiones";

// Bloque de `superadmin_dashboard` que consume esta página.
type DashboardDispositivos = {
  generated_at: string;
  dispositivos: {
    windows_total: number;
    moviles_total: number;
    windows_versiones: string[];
    moviles_versiones: string[];
    windows: {
      email: string;
      display_name: string | null;
      app_version: string | null;
      machine_name: string | null;
      os_version: string | null;
      last_seen_at: string | null;
    }[];
    moviles: {
      display_name: string | null;
      device_model: string | null;
      app_version: string | null;
      last_seen_at: string | null;
    }[];
  };
};

/**
 * Inventario de las apps instaladas (Windows y móvil).
 *
 * Vivía dentro de "Salud", pero un inventario no es una alerta: la pregunta de
 * Salud es "¿algo está roto AHORA?" y la de aquí es "¿quién tiene qué versión?".
 * Separarlas deja a Salud corta y escaneable, y a esta página crecer (filtros,
 * historial de versiones) sin estorbar.
 */
export default async function SuperadminDispositivosPage() {
  const db = await createClient();
  const { data, error } = await db.rpc("superadmin_dashboard");
  const dash = (data ?? null) as DashboardDispositivos | null;

  if (error || !dash) {
    return (
      <div className="space-y-6">
        <Encabezado />
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          No fue posible cargar los dispositivos. Verifica que la migración{" "}
          <code>superadmin_dashboard</code> esté aplicada en la base.
        </div>
      </div>
    );
  }

  const { dispositivos } = dash;

  // La versión de referencia sale del conjunto COMPLETO que devuelve la RPC,
  // no de las filas visibles (ver el mismo cálculo que hacía Salud).
  const versionWindows = versionMasReciente(dispositivos.windows_versiones ?? []);
  const filasWindows: DeviceRow[] = dispositivos.windows.map((d) => ({
    primary: d.display_name || d.email,
    secondary: [d.machine_name, d.os_version].filter(Boolean).join(" · ") || d.email,
    version: d.app_version,
    versionOutdated: estaDesactualizada(d.app_version, versionWindows),
    lastSeenAt: d.last_seen_at,
    href: d.email ? `/superadmin/usuarios?q=${encodeURIComponent(d.email)}` : undefined,
  }));

  const versionMovil = versionMasReciente(dispositivos.moviles_versiones ?? []);
  const filasMoviles: DeviceRow[] = dispositivos.moviles.map((d) => ({
    primary: d.display_name || "Dispositivo sin nombre",
    secondary: d.device_model,
    version: d.app_version,
    versionOutdated: estaDesactualizada(d.app_version, versionMovil),
    lastSeenAt: d.last_seen_at,
  }));

  const equiposViejos =
    filasWindows.filter((f) => f.versionOutdated).length +
    filasMoviles.filter((f) => f.versionOutdated).length;

  return (
    <div className="space-y-6">
      <Encabezado generadoEn={dash.generated_at} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Equipos Windows"
          value={dispositivos.windows_total}
          footnote={versionWindows ? `versión más reciente: ${versionWindows}` : undefined}
          icon={MonitorSmartphone}
        />
        <StatTile
          label="Dispositivos móviles"
          value={dispositivos.moviles_total}
          footnote={versionMovil ? `versión más reciente: ${versionMovil}` : undefined}
          icon={Smartphone}
        />
        <StatTile
          label="En versión vieja"
          value={equiposViejos}
          footnote="respecto a la versión más reciente vista"
          icon={MonitorX}
          invertido
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DeviceTable
          title="App de escritorio (Windows)"
          icon={MonitorSmartphone}
          emptyLabel="Nadie ha conectado la app de Windows todavía."
          rows={filasWindows}
          total={dispositivos.windows_total}
          versionActual={versionWindows}
        />
        <DeviceTable
          title="App móvil"
          icon={Smartphone}
          emptyLabel="Ningún dispositivo móvil registrado."
          rows={filasMoviles}
          total={dispositivos.moviles_total}
          versionActual={versionMovil}
        />
      </div>

      {filasWindows.length === 0 && filasMoviles.length === 0 ? (
        <p className="flex items-center gap-2 text-xs text-muted">
          <MonitorX size={13} />
          Las flotas se llenan solas cuando alguien instala y abre las apps.
        </p>
      ) : null}
    </div>
  );
}

function Encabezado({ generadoEn }: { generadoEn?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-deep">
          <MonitorSmartphone size={22} className="text-accent" /> Dispositivos
        </h1>
        <p className="text-sm text-muted">
          Inventario de las apps instaladas: quién tiene qué versión y cuándo se conectó por
          última vez.
        </p>
      </div>
      {generadoEn ? <AutoRefresh generadoEn={generadoEn} /> : null}
    </div>
  );
}
