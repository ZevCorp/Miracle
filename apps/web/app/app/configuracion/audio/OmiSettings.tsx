"use client";

import { AlertTriangle, Bluetooth, Loader2 } from "lucide-react";
import { ANDROID_PERMISO } from "@/lib/omi/messages";
import { isAndroid, isIOS } from "@/lib/omi/platform";
import { useOmiMicrophone } from "@/lib/omi/useOmiMicrophone";
import { SettingCard } from "../ui";

/**
 * Conexión del collar Omi.
 *
 * Este es el sitio donde se empareja. Antes vivía en un botón flotante pegado
 * al de "Grabar consulta", encima de la pantalla clínica en todo momento; lo
 * que queda en la consulta es solo un punto de estado (OmiStatusDot).
 *
 * Lo que NO se dibuja aquí, y no es un olvido: batería, calidad de señal y
 * nombre del dispositivo emparejado. El transporte BLE que tenemos
 * (lib/omi/bleClient.ts) solo se suscribe a la característica de audio; ninguno
 * de esos datos existe todavía, y una fila "Batería: —" es peor que ninguna.
 */
export function OmiSettings() {
  const omi = useOmiMicrophone();

  const estado = omi.connecting
    ? { texto: "Conectando…", clase: "bg-warning", ink: "text-warning" }
    : omi.status === "reconnecting"
      ? { texto: "Reconectando…", clase: "bg-warning", ink: "text-warning" }
      : omi.isConnected
        ? { texto: "Conectado", clase: "bg-success", ink: "text-success" }
        : { texto: "Sin conectar", clase: "bg-mist", ink: "text-muted" };

  if (!omi.supported) {
    return (
      <SettingCard title="Omi" description="El collar que graba la consulta por ti.">
        <p className="text-sm text-ink-soft">
          {isIOS()
            ? "Omi no funciona en iPhone ni iPad: Apple no permite Bluetooth desde el navegador en ningún navegador de iOS."
            : "Este navegador no puede conectarse por Bluetooth. Omi funciona en Chrome y Edge de escritorio, y en Chrome de Android."}
        </p>
        <p className="mt-2 text-sm text-muted">
          Mientras tanto puedes grabar con el micrófono normal, sin perder nada.
        </p>
      </SettingCard>
    );
  }

  return (
    <SettingCard title="Omi" description="El collar que graba la consulta por ti.">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2.5">
          <span
            aria-hidden
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${estado.clase} ${
              omi.connecting || omi.status === "reconnecting" ? "animate-pulse" : ""
            }`}
          />
          <span className={`text-sm font-semibold ${estado.ink}`}>{estado.texto}</span>
        </span>

        <button
          type="button"
          onClick={() =>
            omi.isConnected ? omi.disconnect() : void omi.connect().catch(() => {})
          }
          disabled={omi.connecting}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${
            omi.isConnected
              ? "border-line bg-surface text-deep hover:bg-ice-soft"
              : "border-transparent bg-accent text-white hover:bg-accent-hover"
          }`}
        >
          {omi.connecting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Bluetooth size={16} />
          )}
          {omi.connecting ? "Conectando…" : omi.isConnected ? "Desconectar" : "Conectar Omi"}
        </button>
      </div>

      {/* El error se muestra AQUÍ, en la pantalla donde se empareja. Antes salía
          como aviso flotante desde el widget que se retiró; sin esto, un fallo
          de emparejamiento se volvería mudo. */}
      {omi.error ? (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2.5 text-sm text-warning"
        >
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {omi.error}
        </p>
      ) : null}

      {isAndroid() && !omi.isConnected ? (
        <p className="mt-3 rounded-md border border-line bg-pearl px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
          {ANDROID_PERMISO}
        </p>
      ) : null}

      <p className="mt-3 text-xs leading-relaxed text-muted">
        {omi.isConnected
          ? "Mientras esté conectado, todo lo que grabes entra por el Omi en vez de por el micrófono. La conexión aguanta si navegas entre pantallas."
          : "Al conectar, el navegador te pedirá elegir el dispositivo. Por seguridad hay que hacerlo una vez por sesión: si recargas la página, hay que volver a conectarlo."}
      </p>
    </SettingCard>
  );
}
