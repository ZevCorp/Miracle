import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { formatFechaRelativa } from "@/lib/dates";
import { ETIQUETA_FASE, FASES } from "@/lib/superadmin/medicion";
import { fijarFase, generarCodigo, guardarRoster } from "./actions";

/**
 * Configuración de la medición: roster de médicos (los nombres del selector de
 * turno), calendario de fases, códigos de enrolamiento, y la salud de los
 * dispositivos (badge de silencio calculado al vuelo, sin esperar al cron).
 */
export default async function ConfigMedicionPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const db = await createClient();

  const orgsRes = await db.from("organizations").select("id, name").eq("kind", "institution").order("name");
  const orgs = (orgsRes.data ?? []) as { id: string; name: string }[];
  const org = sp.org && sp.org !== "todas" ? sp.org : orgs[0]?.id ?? null;

  const [rosterRes, phasesRes, devicesRes] = org
    ? await Promise.all([
        db.from("metrics_roster").select("id, display_name, active, sort_order").eq("organization_id", org).order("sort_order"),
        db.from("metrics_study_phases").select("phase, starts_on, ends_on").eq("organization_id", org).order("starts_on"),
        db.from("metrics_devices").select("id, machine_name, os_version, app_version, last_seen_at, last_sample_at, status").eq("organization_id", org).order("last_seen_at", { ascending: false }),
      ])
    : [null, null, null];

  const roster = (rosterRes?.data ?? []) as { id: string; display_name: string; active: boolean; sort_order: number }[];
  const phases = (phasesRes?.data ?? []) as { phase: string; starts_on: string; ends_on: string | null }[];
  const devices = (devicesRes?.data ?? []) as { id: string; machine_name: string; os_version: string; app_version: string; last_seen_at: string; last_sample_at: string | null; status: string }[];

  // Silencio: un device que no reporta hace más de 20 min está callado. El
  // heartbeat late cada 5 min aun con el PC bloqueado, así que 20 min es muerte
  // probable, no "PC quieto". Se calcula aquí, sin esperar al correo del cron.
  const ahora = Date.now();
  const estaCallado = (d: { last_seen_at: string; status: string }) =>
    d.status === "active" && ahora - new Date(d.last_seen_at).getTime() > 20 * 60 * 1000;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/superadmin/medicion" className="text-sm text-accent hover:underline">← Volver a medición</Link>
        <h1 className="mt-1 text-xl font-semibold text-ink">Configuración de la medición</h1>
      </div>

      {sp.ok && <p className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{sp.ok}</p>}
      {sp.error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800">{sp.error}</p>}

      <div className="flex flex-wrap gap-2">
        {orgs.map((o) => (
          <Link
            key={o.id}
            href={`/superadmin/medicion/config?org=${o.id}`}
            className={`rounded-lg border px-3 py-1.5 text-sm ${o.id === org ? "border-accent bg-accent/10 font-medium text-accent" : "border-line text-ink hover:bg-pearl"}`}
          >
            {o.name}
          </Link>
        ))}
      </div>

      {!org ? (
        <Card className="p-6 text-sm text-muted">No hay ninguna institución. Crea una en Organizaciones.</Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Roster */}
          <Card className="p-4">
            <p className="mb-1 text-sm font-semibold text-ink">Médicos del turno</p>
            <p className="mb-3 text-xs text-muted">Los nombres que el médico elige al empezar su turno. Un nombre por línea.</p>
            <form action={guardarRoster} className="space-y-2">
              <input type="hidden" name="org" value={org} />
              <textarea
                name="nombres"
                rows={8}
                defaultValue={roster.map((r) => r.display_name).join("\n")}
                placeholder={"Dra. Ana Gómez\nDr. Luis Pérez\n…"}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
                Guardar roster ({roster.length})
              </button>
            </form>
          </Card>

          {/* Enrolamiento */}
          <Card className="p-4">
            <p className="mb-1 text-sm font-semibold text-ink">Código de instalación</p>
            <p className="mb-3 text-xs text-muted">Se teclea una vez en cada PC al abrir el medidor por primera vez. Válido 72 h.</p>
            <form action={generarCodigo} className="flex items-end gap-2">
              <input type="hidden" name="org" value={org} />
              <label className="text-sm">
                Instalaciones
                <input name="max_usos" type="number" defaultValue={20} min={1} className="ml-2 w-20 rounded-lg border border-line px-2 py-1 text-sm" />
              </label>
              <button type="submit" className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
                Generar código
              </button>
            </form>
          </Card>

          {/* Fases */}
          <Card className="p-4">
            <p className="mb-1 text-sm font-semibold text-ink">Fases del estudio</p>
            <p className="mb-3 text-xs text-muted">La fase de cada turno se deriva de este calendario por fecha.</p>
            <ul className="mb-3 space-y-1 text-sm">
              {phases.length === 0 ? (
                <li className="text-muted">Sin fases. La primera define el baseline.</li>
              ) : (
                phases.map((p, i) => (
                  <li key={i} className="flex justify-between rounded-lg border border-line px-3 py-1.5">
                    <span className="font-medium text-ink">{ETIQUETA_FASE[p.phase] ?? p.phase}</span>
                    <span className="text-muted">desde {p.starts_on}</span>
                  </li>
                ))
              )}
            </ul>
            <form action={fijarFase} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="org" value={org} />
              <select name="phase" className="rounded-lg border border-line px-2 py-1.5 text-sm">
                {FASES.map((f) => (
                  <option key={f} value={f}>{ETIQUETA_FASE[f]}</option>
                ))}
              </select>
              <input name="starts" type="date" required className="rounded-lg border border-line px-2 py-1.5 text-sm" />
              <button type="submit" className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-pearl">
                Fijar fase
              </button>
            </form>
          </Card>

          {/* Dispositivos */}
          <Card className="p-4">
            <p className="mb-3 text-sm font-semibold text-ink">Dispositivos ({devices.length})</p>
            {devices.length === 0 ? (
              <p className="text-sm text-muted">Ningún PC enrolado todavía.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {devices.map((d) => (
                  <li key={d.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                    <div>
                      <p className="font-medium text-ink">{d.machine_name || "sin nombre"}</p>
                      <p className="text-xs text-muted">v{d.app_version} · visto {formatFechaRelativa(d.last_seen_at)}</p>
                    </div>
                    {d.status !== "active" ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{d.status}</span>
                    ) : estaCallado(d) ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">callado</span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">activo</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
