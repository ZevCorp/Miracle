"use client";

import { useEffect, useRef, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { formatHora } from "@/lib/dates";

const INTERVALO_MS = 60_000;
const CLAVE = "miracle:sa-autorefresh";

// La preferencia se modela como un store externo (localStorage) y no como
// estado de React. Cada refresco vuelve a montar este componente, así que el
// interruptor tiene que vivir fuera del ciclo de vida o se apagaría solo cada
// minuto. useSyncExternalStore es la API pensada para esto: da un snapshot
// distinto en servidor (false) y en cliente, sin escribir estado dentro de un
// efecto. De regalo, el evento `storage` mantiene el interruptor sincronizado
// entre pestañas abiertas.
const oyentes = new Set<() => void>();

function suscribir(alCambiar: () => void) {
  oyentes.add(alCambiar);
  window.addEventListener("storage", alCambiar);
  return () => {
    oyentes.delete(alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

/** Snapshot booleano: primitivo, así que es estable entre renders. */
function leerPreferencia(): boolean {
  return window.localStorage.getItem(CLAVE) === "1";
}

/** En el servidor no hay preferencia: apagado, que es el valor por defecto. */
function leerEnServidor(): boolean {
  return false;
}

function fijarPreferencia(valor: boolean) {
  window.localStorage.setItem(CLAVE, valor ? "1" : "0");
  // `storage` solo se dispara en las OTRAS pestañas: esta se avisa a mano.
  for (const oyente of oyentes) oyente();
}

/**
 * Sello de actualización + refresco automático opcional.
 *
 * POR QUÉ EXISTE
 * La consola no se actualizaba sola: cada número era el de la última
 * navegación. Y el sello de la página de Salud imprimía `new Date()`, así que
 * siempre decía "ahora" aunque los datos llevaran media hora — justo al revés
 * de lo que necesita una pantalla que responde "¿algo está roto ahora mismo?".
 * `generadoEn` es el `generated_at` de la RPC: mide la edad del DATO.
 *
 * POR QUÉ APAGADO POR DEFECTO
 * Cada refresco vuelve a ejecutar las RPC completas del panel. Encenderlo es
 * barato cuando estás vigilando; dejarlo encendido por omisión en una pestaña
 * olvidada serían cientos de ejecuciones al día sin que nadie mire.
 *
 * Se monta solo en Resumen y Salud, NUNCA en el layout: refrescar Usuarios o
 * Consultas a media edición borraría lo que hay escrito en un formulario.
 */
export function AutoRefresh({ generadoEn }: { generadoEn: string }) {
  const router = useRouter();
  const activo = useSyncExternalStore(suscribir, leerPreferencia, leerEnServidor);
  const [pendiente, startTransition] = useTransition();
  const temporizador = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!activo) return;
    temporizador.current = setInterval(() => {
      // Una pestaña que nadie está mirando no vuelve a lanzar las RPC. Esto es
      // lo que hace que sea seguro dejarlo encendido toda la tarde.
      if (document.visibilityState !== "visible") return;
      startTransition(() => router.refresh());
    }, INTERVALO_MS);
    return () => {
      if (temporizador.current) clearInterval(temporizador.current);
    };
  }, [activo, router]);

  const alternar = () => fijarPreferencia(!activo);

  const boton =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors";

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      <span>Datos de las {formatHora(generadoEn)}</span>

      <button
        type="button"
        onClick={alternar}
        aria-pressed={activo}
        title={
          activo
            ? "Se actualiza cada minuto mientras la pestaña esté visible"
            : "Actualizar automáticamente cada minuto"
        }
        className={`${boton} ${
          activo ? "border-accent text-accent" : "border-line text-muted hover:text-deep"
        }`}
      >
        <RefreshCw size={12} className={pendiente ? "animate-spin" : undefined} />
        {activo ? "Auto · 1 min" : "Auto"}
      </button>

      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        disabled={pendiente}
        className={`${boton} border-line text-muted hover:text-deep disabled:opacity-50`}
      >
        Actualizar
      </button>
    </div>
  );
}
