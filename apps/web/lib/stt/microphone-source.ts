"use client";

// De dónde sale el audio de una grabación.
//
// El motor de dictado está vendorizado (lib/stt/deepgram-dictation.js, NO EDITAR
// a mano) y siempre abre el micrófono con un getUserMedia({audio:{...}}) propio,
// sin deviceId. Para cambiarle la fuente sin tocarlo se intercepta getUserMedia
// desde afuera. Ese truco ya existía para el Omi; aquí se generaliza, porque
// ahora hay DOS cosas que quieren decidir la fuente:
//
//   1. el collar Omi conectado por Bluetooth (máxima prioridad), y
//   2. el micrófono que el médico eligió en Configuración.
//
// Tener dos parches independientes sobre el mismo método global era la vía
// rápida y también la vía a un fallo imposible de depurar: cada uno guarda el
// getUserMedia "original" al instalarse, así que el segundo capturaría al
// primero y desinstalarlos en distinto orden dejaría el navegador con un
// getUserMedia que devuelve el Omi para siempre. Por eso el parche es UNO y
// tiene un solo dueño: este módulo. Los consumidores solo mueven perillas.

type GetUserMedia = typeof navigator.mediaDevices.getUserMedia;

/** El getUserMedia de verdad del navegador. Se captura una sola vez. */
let originalGetUserMedia: GetUserMedia | null = null;
let instalado = false;

/** Stream sintético del Omi mientras esté conectado. */
let omiStream: MediaStream | null = null;
/** deviceId elegido en Configuración, o null para el del sistema. */
let preferredDeviceId: string | null = null;

function disponible(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices;
}

/**
 * Mezcla el deviceId preferido en los constraints que pidió quien llama.
 *
 * `ideal` y no `exact` a propósito: si el médico dejó elegido un micrófono USB y
 * llega a la consulta sin él, `exact` haría fallar getUserMedia con
 * OverconstrainedError y no podría grabar. Con `ideal` el navegador usa el que
 * haya y la consulta sigue — que es lo que importa a esa hora.
 */
function conDispositivo(constraints?: MediaStreamConstraints): MediaStreamConstraints {
  const base = constraints ?? { audio: true };
  if (!preferredDeviceId || !base.audio) return base;
  const audio = base.audio === true ? {} : base.audio;
  return { ...base, audio: { ...audio, deviceId: { ideal: preferredDeviceId } } };
}

function instalar() {
  if (instalado || !disponible()) return;
  originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (async (constraints?: MediaStreamConstraints) => {
    // Solo se interviene el audio: una petición de cámara pasa intacta.
    if (constraints && constraints.audio) {
      if (omiStream) return omiStream;
      return originalGetUserMedia!(conDispositivo(constraints));
    }
    return originalGetUserMedia!(constraints);
  }) as GetUserMedia;
  instalado = true;
}

function desinstalarSiSobra() {
  // Sin Omi y sin micrófono elegido no hay nada que interceptar: se devuelve el
  // método original para no dejar un parche vivo sin motivo.
  if (omiStream || preferredDeviceId) return;
  if (!instalado || !originalGetUserMedia || !disponible()) return;
  navigator.mediaDevices.getUserMedia = originalGetUserMedia;
  originalGetUserMedia = null;
  instalado = false;
}

/** Lo llama la conexión del Omi. `null` al desconectar. */
export function setOmiStream(stream: MediaStream | null) {
  omiStream = stream;
  if (stream) instalar();
  else desinstalarSiSobra();
}

/** Lo llama la preferencia de micrófono. `null` = el que decida el sistema. */
export function setPreferredDeviceId(deviceId: string | null) {
  preferredDeviceId = deviceId || null;
  if (preferredDeviceId) instalar();
  else desinstalarSiSobra();
}

// ---- Preferencia de micrófono (por computador) -----------------------------
// Va en localStorage y NO en la base de datos: un deviceId solo tiene sentido en
// el navegador que lo emitió. Guardarlo en el perfil sería prometer que el
// médico encuentra su micrófono de consultorio al abrir Miracle en el portátil
// de la casa, y ahí ese identificador no existe.
//
// Se guarda también la etiqueta para poder decir "ya no encuentro «Yeti Nano»"
// en vez de enseñar un hash de 64 caracteres.

const CLAVE_MIC = "miracle-mic-device";

export interface PreferredMic {
  deviceId: string;
  label: string;
}

export function readPreferredMic(): PreferredMic | null {
  if (typeof window === "undefined") return null;
  try {
    const crudo = window.localStorage.getItem(CLAVE_MIC);
    if (!crudo) return null;
    const dato = JSON.parse(crudo) as Partial<PreferredMic>;
    if (!dato?.deviceId) return null;
    return { deviceId: dato.deviceId, label: dato.label ?? "" };
  } catch {
    return null;
  }
}

export function writePreferredMic(mic: PreferredMic | null) {
  setPreferredDeviceId(mic?.deviceId ?? null);
  if (typeof window === "undefined") return;
  try {
    if (mic) window.localStorage.setItem(CLAVE_MIC, JSON.stringify(mic));
    else window.localStorage.removeItem(CLAVE_MIC);
  } catch {
    /* almacenamiento no disponible: aplica en esta sesión, no se recuerda */
  }
}

/**
 * Reaplica la preferencia guardada al arrancar la app.
 *
 * Hace falta porque el parche vive en memoria: sin esto, el micrófono elegido
 * solo valdría hasta recargar la página, y el médico creería que se guardó.
 */
export function restorePreferredMic() {
  const guardado = readPreferredMic();
  if (guardado) setPreferredDeviceId(guardado.deviceId);
}
