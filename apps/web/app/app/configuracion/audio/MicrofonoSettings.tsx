"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, Mic } from "lucide-react";
import {
  createMicLevelMeter,
  probeMicrophoneSignal,
  type MicProbeResult,
} from "@/lib/stt/mic-health";
import {
  readPreferredMic,
  writePreferredMic,
  type PreferredMic,
} from "@/lib/stt/microphone-source";
import { SettingCard, inputClass } from "../ui";

/** Sentinela: dejar que el sistema operativo decida. */
const DEL_SISTEMA = "__sistema__";

/** Cuánto dura la prueba. Suficiente para decir una frase entera. */
const DURACION_PRUEBA_MS = 4000;

type Permiso = "desconocido" | "concedido" | "denegado";

/** El veredicto de mic-health, en el idioma del médico. */
function veredicto(resultado: MicProbeResult): { ok: boolean; texto: string } {
  if (resultado.ok && resultado.reason === "ok") {
    return { ok: true, texto: "Se escucha bien. Este micrófono está entregando audio." };
  }
  if (resultado.ok) {
    // "inconclusive": la sonda no pudo correr (sin WebAudio, contexto suspendido).
    // No se acusa al micrófono de algo que no se pudo comprobar.
    return {
      ok: true,
      texto:
        "No se pudo medir la señal en este navegador, pero el micrófono abrió sin problemas.",
    };
  }
  switch (resultado.reason) {
    case "no_signal":
      return {
        ok: false,
        texto:
          "El micrófono abre pero no entrega ni una muestra de audio. Suele pasar con algunos USB: prueba otro puerto, u otra entrada de la lista.",
      };
    case "track_muted":
      return { ok: false, texto: "El micrófono está silenciado. Revisa si tiene un botón de mute." };
    case "track_ended":
      return { ok: false, texto: "El micrófono se desconectó durante la prueba." };
    default:
      return { ok: false, texto: "No se pudo usar este micrófono." };
  }
}

export function MicrofonoSettings() {
  const [dispositivos, setDispositivos] = useState<MediaDeviceInfo[]>([]);
  const [elegido, setElegido] = useState<PreferredMic | null>(null);
  const [permiso, setPermiso] = useState<Permiso>("desconocido");
  const [pidiendoPermiso, setPidiendoPermiso] = useState(false);
  const [probando, setProbando] = useState(false);
  const [nivel, setNivel] = useState(0);
  const [resultado, setResultado] = useState<MicProbeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const limpiezaRef = useRef<(() => void) | null>(null);

  useEffect(() => setElegido(readPreferredMic()), []);

  const listar = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }
    const todos = await navigator.mediaDevices.enumerateDevices();
    const entradas = todos.filter((d) => d.kind === "audioinput");
    setDispositivos(entradas);
    // El navegador oculta las ETIQUETAS hasta que se concede permiso: una lista
    // con nombres es la señal fiable de que ya lo tenemos. Sin permiso devuelve
    // entradas con label vacío, y enseñar "Dispositivo 1, Dispositivo 2" sería
    // ofrecer una elección que el médico no puede tomar.
    setPermiso(entradas.some((d) => d.label) ? "concedido" : "desconocido");
  }, []);

  useEffect(() => {
    void listar();
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    // Enchufar o quitar un USB cambia la lista sin recargar la página.
    const alCambiar = () => void listar();
    navigator.mediaDevices.addEventListener("devicechange", alCambiar);
    return () => navigator.mediaDevices.removeEventListener("devicechange", alCambiar);
  }, [listar]);

  // Al salir de la pantalla se cierra cualquier prueba en curso: dejar un
  // micrófono abierto detrás es encender el led de la cámara del portátil sin
  // motivo, y peor, en mitad de una consulta.
  useEffect(() => () => limpiezaRef.current?.(), []);

  async function pedirPermiso() {
    setPidiendoPermiso(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermiso("concedido");
      await listar();
    } catch {
      setPermiso("denegado");
    } finally {
      setPidiendoPermiso(false);
    }
  }

  function cambiar(deviceId: string) {
    if (deviceId === DEL_SISTEMA) {
      writePreferredMic(null);
      setElegido(null);
    } else {
      const info = dispositivos.find((d) => d.deviceId === deviceId);
      const mic = { deviceId, label: info?.label ?? "" };
      writePreferredMic(mic);
      setElegido(mic);
    }
    setResultado(null);
  }

  async function probar() {
    if (probando) return;
    limpiezaRef.current?.();
    setProbando(true);
    setResultado(null);
    setError(null);
    setNivel(0);

    let stream: MediaStream | null = null;
    let pararMedidor: (() => void) | null = null;
    const cerrar = () => {
      pararMedidor?.();
      stream?.getTracks().forEach((t) => t.stop());
      limpiezaRef.current = null;
    };
    limpiezaRef.current = cerrar;

    try {
      // Sin deviceId explícito: el desvío global (lib/stt/microphone-source) ya
      // inyecta el preferido, así que se prueba EXACTAMENTE la misma fuente que
      // va a usar la grabación. Probar por un camino distinto al real sería una
      // prueba que no prueba nada.
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermiso("concedido");
      void listar();

      pararMedidor = createMicLevelMeter(stream, setNivel);
      const salida = await probeMicrophoneSignal(stream, DURACION_PRUEBA_MS);
      setResultado(salida);
    } catch {
      setPermiso("denegado");
      setError("No se pudo abrir el micrófono. Revisa el permiso del navegador.");
    } finally {
      cerrar();
      setProbando(false);
      setNivel(0);
    }
  }

  const sinSoporte =
    typeof navigator !== "undefined" && !navigator.mediaDevices?.enumerateDevices;

  const dictamen = resultado ? veredicto(resultado) : null;
  // El pico crudo va de 0 a 1 y una voz normal se queda por debajo de 0.3: sin
  // escalar, la barra apenas se movería y parecería un micrófono roto.
  const anchoBarra = Math.min(100, Math.round(nivel * 320));

  return (
    <SettingCard
      title="Micrófono"
      description="Con cuál te graba Miracle. Es una preferencia de este computador."
    >
      {sinSoporte ? (
        <p className="text-sm text-muted">
          Este navegador no permite elegir el micrófono. Se usará el que tenga
          configurado el sistema.
        </p>
      ) : (
        <>
          <select
            aria-label="Micrófono de entrada"
            className={inputClass}
            value={elegido?.deviceId ?? DEL_SISTEMA}
            onChange={(e) => cambiar(e.target.value)}
            disabled={probando}
          >
            <option value={DEL_SISTEMA}>El que use el sistema</option>
            {dispositivos.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Entrada de audio ${i + 1}`}
              </option>
            ))}
          </select>

          {permiso !== "concedido" ? (
            <div className="mt-3 rounded-md border border-line bg-pearl px-3 py-2.5">
              <p className="text-sm text-ink-soft">
                {permiso === "denegado"
                  ? "El navegador tiene bloqueado el micrófono para este sitio. Habilítalo desde el candado de la barra de direcciones."
                  : "Para ver los nombres de tus micrófonos hace falta dar permiso una vez."}
              </p>
              {permiso !== "denegado" ? (
                <button
                  type="button"
                  onClick={() => void pedirPermiso()}
                  disabled={pidiendoPermiso}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline disabled:opacity-60"
                >
                  {pidiendoPermiso ? <Loader2 size={14} className="animate-spin" /> : null}
                  Dar permiso
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Un micrófono guardado que ya no está conectado no desaparece en
              silencio: el desvío usa `ideal`, así que la grabación funciona con
              el que haya, pero el médico tiene que saber que no es el suyo. */}
          {elegido && dispositivos.length > 0 &&
          !dispositivos.some((d) => d.deviceId === elegido.deviceId) ? (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              No encuentro {elegido.label || "el micrófono que elegiste"} en este
              equipo. Mientras tanto se graba con el del sistema.
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => void probar()}
              disabled={probando}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-deep hover:bg-ice-soft disabled:opacity-60"
            >
              {probando ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Mic size={16} />
              )}
              {probando ? "Escuchando…" : "Probar micrófono"}
            </button>
            {probando ? (
              <span className="text-xs text-muted">Di algo en voz alta.</span>
            ) : null}
          </div>

          {probando ? (
            <div
              className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-ice"
              role="progressbar"
              aria-label="Nivel de entrada del micrófono"
              aria-valuenow={anchoBarra}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-75"
                style={{ width: `${anchoBarra}%` }}
              />
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-warning">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              {error}
            </p>
          ) : dictamen ? (
            <p
              role="status"
              className={`mt-3 flex items-start gap-2 rounded-md px-3 py-2.5 text-sm ${
                dictamen.ok
                  ? "bg-success-soft text-success"
                  : "bg-warning-soft text-warning"
              }`}
            >
              {dictamen.ok ? (
                <Check size={15} className="mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              )}
              {dictamen.texto}
            </p>
          ) : null}
        </>
      )}
    </SettingCard>
  );
}
