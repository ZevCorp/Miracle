"use client";

// Vincular un equipo de Operations al médico actual.
//
// El equipo Windows muestra un código de 8 caracteres en SU pantalla (dura 10
// minutos, un solo uso); el médico lo teclea aquí con su sesión. Desde entonces
// ese equipo puede trabajarle las consultas por API —crear, dictar, generar la
// nota— y lo que produzca aparece como borrador en su historial. Firmar y
// exportar siguen siendo del médico: el equipo no puede, por construcción.
//
// A diferencia de AgentPairPanel (donde el código lo genera la web y se teclea
// en Ü), aquí es al revés: el código nace en el equipo porque lo que se
// identifica ES el equipo, y verlo en su pantalla física prueba que estás
// delante de él.
//
// Todo va por el API clínico de Graph (lib/api/clinical.ts) con el JWT del
// médico: las tablas de dispositivos son de Graph y este repo no las toca.

import { useCallback, useEffect, useState } from "react";
import { Laptop, Unlink } from "lucide-react";
import {
  claimDevicePairing,
  getLinkedDevices,
  revokeDeviceLink,
  friendlyClinicalMessage,
  type LinkedDevice,
} from "@/lib/api/clinical";
import { formatFechaRelativa } from "@/lib/dates";

export function DevicePairPanel() {
  const [devices, setDevices] = useState<LinkedDevice[] | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setDevices(await getLinkedDevices());
      setError(null);
    } catch (err) {
      // Los errores se muestran, no se tragan (regla de AgentPairPanel).
      setError(friendlyClinicalMessage(err));
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function vincular() {
    const clean = code.trim().toUpperCase();
    if (clean.length !== 8) {
      setError("El código tiene 8 caracteres, tal como lo muestra el equipo.");
      return;
    }
    setBusy(true);
    setError(null);
    setOkMessage(null);
    try {
      const result = await claimDevicePairing(clean);
      setOkMessage(
        `Equipo «${result.device.label || result.device.device_id}» vinculado. Ya puede trabajar tus consultas; firmar y exportar siguen siendo tuyos.`,
      );
      setCode("");
      await cargar();
    } catch (err) {
      setError(friendlyClinicalMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function desvincular(device: LinkedDevice) {
    setBusy(true);
    setError(null);
    setOkMessage(null);
    try {
      await revokeDeviceLink(device.link_id);
      setOkMessage(
        `Equipo «${device.label || device.device_id}» desvinculado: ya no puede actuar a tu nombre.`,
      );
      await cargar();
    } catch (err) {
      setError(friendlyClinicalMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-line bg-surface p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <Laptop size={14} aria-hidden />
          Vincular un equipo
        </div>
        <p className="mt-2 text-sm text-muted">
          En el equipo con Ü, pide un código de vinculación y tecléalo aquí. El
          código dura 10 minutos y sirve una sola vez.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={8}
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !busy) void vincular();
            }}
            placeholder="ABCD2345"
            aria-label="Código de vinculación que muestra el equipo"
            className="w-44 rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-lg tracking-[0.2em] text-deep placeholder:text-muted/60"
          />
          <button
            type="button"
            onClick={() => void vincular()}
            disabled={busy || code.trim().length !== 8}
            className="inline-flex items-center gap-2 rounded-lg border border-accent/25 bg-accent-soft/45 px-3 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-soft disabled:opacity-50"
          >
            {busy ? "Vinculando…" : "Vincular equipo"}
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        {okMessage ? <p className="mt-2 text-sm text-accent-ink">{okMessage}</p> : null}
      </div>

      <div className="rounded-lg border border-line bg-surface p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">
          Equipos vinculados
        </div>
        {devices === null ? (
          <p className="mt-2 text-sm text-muted">Cargando…</p>
        ) : devices.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No tienes equipos vinculados. Lo que un equipo haga a tu nombre
            aparecerá aquí y en la auditoría.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {devices.map((device) => (
              <li key={device.link_id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-deep">
                    {device.label || device.device_id}
                  </p>
                  <p className="text-xs text-muted">
                    Vinculado {formatFechaRelativa(device.approved_at)}
                    {device.last_seen
                      ? ` · visto ${formatFechaRelativa(device.last_seen)}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void desvincular(device)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted hover:border-danger/40 hover:text-danger disabled:opacity-50"
                >
                  <Unlink size={13} aria-hidden />
                  Desvincular
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
