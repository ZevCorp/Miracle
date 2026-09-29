"use client";

// Estado del Omi durante la consulta: un punto de color en la esquina del panel
// de grabación.
//
// Sustituye al botón flotante "Conectar Omi" que vivía encima de la interfaz
// clínica en TODA pantalla. El emparejamiento se hace ahora en Configuración >
// Audio y dispositivos; lo que hace falta a mitad de una consulta no es un
// botón permanente, es saber de un vistazo si el collar sigue vivo — y poder
// reconectarlo sin salir de la consulta cuando no lo está.
//
// Solo se dibuja cuando la fuente de audio es el Omi. Si el médico graba con el
// micrófono del portátil no hay punto, porque no hay nada que vigilar.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bluetooth, Loader2, Settings } from "lucide-react";
import { useOmiMicrophone } from "@/lib/omi/useOmiMicrophone";

/** Lo que tarda el cursor posado antes de abrir la ficha. */
const RETARDO_HOVER_MS = 700;

export function OmiStatusDot() {
  const omi = useOmiMicrophone();
  const [abierto, setAbierto] = useState(false);
  const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contenedorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
    };
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const alPulsarTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    // Un clic fuera cierra: en táctil no hay "salir con el cursor".
    const alTocarFuera = (e: MouseEvent) => {
      if (!contenedorRef.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("keydown", alPulsarTecla);
    document.addEventListener("mousedown", alTocarFuera);
    return () => {
      document.removeEventListener("keydown", alPulsarTecla);
      document.removeEventListener("mousedown", alTocarFuera);
    };
  }, [abierto]);

  if (!omi.supported) return null;

  const reconectando = omi.status === "reconnecting" || omi.connecting;
  const caido = !omi.isConnected && !omi.connecting;

  // El color NUNCA es el único canal: va acompañado de texto en `aria-label`,
  // de un icono, y de la ficha con el estado escrito. Un punto rojo y uno verde
  // son el mismo punto para quien no distingue esos dos colores.
  const estado = reconectando
    ? {
        punto: "bg-warning",
        texto: omi.connecting ? "Conectando el Omi" : "Reconectando el Omi",
        detalle: "Se perdió la señal un momento. Estamos volviendo a engancharlo.",
      }
    : caido
      ? {
          punto: "bg-danger",
          texto: "Omi desconectado",
          detalle: "No está entrando audio del collar. Conéctalo para seguir con él.",
        }
      : {
          punto: "bg-success",
          texto: "Omi conectado",
          detalle: "El audio de la consulta está entrando por el collar.",
        };

  function abrirConRetardo() {
    if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
    temporizadorRef.current = setTimeout(() => setAbierto(true), RETARDO_HOVER_MS);
  }

  function cancelarApertura() {
    if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
    setAbierto(false);
  }

  return (
    <div
      ref={contenedorRef}
      className="relative shrink-0"
      onMouseEnter={abrirConRetardo}
      onMouseLeave={cancelarApertura}
    >
      <button
        type="button"
        aria-label={`${estado.texto}. Abrir opciones del Omi.`}
        aria-expanded={abierto}
        // Pulsar y enfocar con teclado también abren: un menú que solo responde
        // al cursor no existe ni en un teléfono ni para quien navega con TAB.
        onClick={() => setAbierto((v) => !v)}
        // `:focus-visible` y no `onFocus` a secas. Al hacer clic el navegador
        // ENFOCA el botón antes de disparar el clic, así que un onFocus abierto
        // a todo abría el menú y el onClick siguiente lo cerraba en el mismo
        // gesto: pulsar no abría nunca, y en un teléfono —donde no hay cursor
        // que posar— el menú quedaba sencillamente inalcanzable.
        onFocus={(e) => {
          if (e.target.matches(":focus-visible")) setAbierto(true);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-ice-soft hover:text-deep focus:outline-none focus:ring-2 focus:ring-accent/30"
      >
        <span className="relative inline-flex">
          <Bluetooth size={15} aria-hidden />
          <span
            aria-hidden
            className={`absolute -right-1 -top-0.5 h-2 w-2 rounded-full ring-2 ring-surface ${estado.punto} ${
              reconectando ? "animate-pulse" : ""
            }`}
          />
        </span>
      </button>

      {/* Lo que cambia se anuncia a los lectores de pantalla aunque la ficha
          esté cerrada: que el Omi se caiga en mitad de una consulta es
          exactamente lo que hay que enterarse sin mirar. */}
      <span role="status" aria-live="polite" className="sr-only">
        {estado.texto}
      </span>

      {abierto ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-line bg-surface p-3.5 text-left shadow-[var(--shadow-lg)]">
          <p className="flex items-center gap-2 text-sm font-semibold text-deep">
            <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${estado.punto}`} />
            {estado.texto}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{estado.detalle}</p>

          {omi.error ? (
            <p className="mt-2 flex items-start gap-1.5 rounded-md bg-warning-soft px-2 py-1.5 text-xs text-warning">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              {omi.error}
            </p>
          ) : null}

          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() =>
                omi.isConnected ? omi.disconnect() : void omi.connect().catch(() => {})
              }
              disabled={omi.connecting}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60 ${
                omi.isConnected
                  ? "border border-line bg-surface text-deep hover:bg-ice-soft"
                  : "bg-accent text-white hover:bg-accent-hover"
              }`}
            >
              {omi.connecting ? <Loader2 size={14} className="animate-spin" /> : null}
              {omi.connecting
                ? "Conectando…"
                : omi.isConnected
                  ? "Desconectar"
                  : "Conectar Omi"}
            </button>
            <Link
              href="/app/configuracion/audio"
              className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-muted hover:text-deep"
            >
              <Settings size={13} /> Ajustes de audio
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
