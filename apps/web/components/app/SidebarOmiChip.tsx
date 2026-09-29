"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Bluetooth, Loader2 } from "lucide-react";
import { useOmiMicrophone } from "@/lib/omi/useOmiMicrophone";

/**
 * Estado del Omi en el pie del menú lateral. Sustituye al botón flotante que
 * vivía encima de la pantalla clínica: el estado de un accesorio es
 * información de fondo, no una acción de primer plano.
 *
 * El punto dice el estado por color —verde conectado, rojo sin conectar,
 * ámbar mientras conecta— y el rótulo lo repite en palabras: el color nunca
 * es el único canal. Con el menú contraído el rótulo se vuelve globo flotante
 * (globals.css) y el punto se muda encima del ícono para no desaparecer.
 *
 * Sin conectar, el chip CONECTA —que es justo lo que promete su rótulo—:
 * Web Bluetooth exige un gesto del usuario y este clic lo es. Ya conectado,
 * lleva al emparejamiento, que es donde se resuelve cualquier problema.
 *
 * En un navegador sin Web Bluetooth no se pinta nada: un chip permanentemente
 * "sin soporte" solo enseñaría un problema sin salida.
 */

/* Verdes, rojos y ámbares propios, no los tokens semánticos de la app:
   aquellos están calibrados como texto oscuro sobre fondo claro y sobre el
   navy del menú se ven apagados. Estos son puntos de luz sobre superficie
   oscura, con su halo. */
const ESTADO = {
  conectado: {
    punto: "#34d977",
    halo: "0 0 0 3px rgb(52 217 119 / 0.18), 0 0 10px rgb(52 217 119 / 0.85)",
  },
  conectando: {
    punto: "#f6b93b",
    halo: "0 0 0 3px rgb(246 185 59 / 0.18), 0 0 10px rgb(246 185 59 / 0.8)",
  },
  sinConectar: {
    punto: "#f2564d",
    halo: "0 0 0 3px rgb(242 86 77 / 0.16), 0 0 9px rgb(242 86 77 / 0.7)",
  },
} as const;

export function SidebarOmiChip() {
  const omi = useOmiMicrophone();
  const [fallo, setFallo] = useState<string | null>(null);

  // `supported` mira navigator.bluetooth: en el servidor siempre es false y en
  // Chrome true, así que pintarlo directo rompía la hidratación. Mismo patrón
  // que dictSupported en NoteSectionView: el servidor (y el primer render de
  // hidratación) dicen false, y el chip aparece un frame después.
  const montado = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  if (!montado || !omi.supported) return null;

  const conectando = omi.status === "connecting" || omi.status === "reconnecting";
  const estado = conectando
    ? ESTADO.conectando
    : omi.isConnected
      ? ESTADO.conectado
      : ESTADO.sinConectar;

  const texto = conectando
    ? omi.status === "reconnecting"
      ? "Reconectando Omi…"
      : "Conectando Omi…"
    : omi.isConnected
      ? "Omi conectado"
      : "Conectar Omi";

  const clases =
    "sidebar-item relative flex min-h-11 w-full items-center gap-2.5 rounded-[12px] border border-white/10 bg-white/[0.06] px-3 py-2 text-[13px] font-semibold text-sidebar-muted transition-colors hover:border-white/20 hover:bg-white/[0.1] hover:text-sidebar-text";

  const contenido = (
    <>
      <span className="relative inline-flex shrink-0">
        {conectando ? (
          <Loader2 size={15} className="animate-spin" aria-hidden />
        ) : (
          <Bluetooth size={15} aria-hidden />
        )}
        {/* Contraído no queda sitio a la derecha: el punto se posa en el ícono. */}
        <span
          aria-hidden
          className={`sidebar-collapsed-only absolute -right-1.5 -top-1 h-2 w-2 rounded-full ${
            conectando ? "animate-pulse" : ""
          }`}
          style={{ background: estado.punto, boxShadow: estado.halo }}
        />
      </span>

      <span className="sidebar-label min-w-0 flex-1 truncate text-left">
        {texto}
      </span>

      <span
        aria-hidden
        className={`sidebar-expanded-only h-2 w-2 shrink-0 rounded-full ${
          conectando ? "animate-pulse" : ""
        }`}
        style={{ background: estado.punto, boxShadow: estado.halo }}
      />
    </>
  );

  return (
    <>
      {omi.isConnected || conectando ? (
        <Link href="/app/configuracion/audio" className={clases} title={texto}>
          {contenido}
        </Link>
      ) : (
        <button
          type="button"
          title="Emparejar el collar Omi"
          onClick={() => {
            setFallo(null);
            void omi.connect().catch((reason) => {
              setFallo(
                reason instanceof Error
                  ? reason.message
                  : "No se pudo conectar el Omi.",
              );
            });
          }}
          className={clases}
        >
          {contenido}
        </button>
      )}

      {/* Un fallo de emparejamiento no puede quedarse solo en el color del
          punto: se dice, y con salida a la pantalla que lo resuelve. */}
      {fallo && !omi.isConnected ? (
        <p className="sidebar-expanded-only px-3 pt-1 text-[11px] leading-snug text-sidebar-muted">
          {fallo}{" "}
          <Link
            href="/app/configuracion/audio"
            className="font-semibold text-white underline underline-offset-2"
          >
            Ver ayuda
          </Link>
        </p>
      ) : null}
    </>
  );
}
