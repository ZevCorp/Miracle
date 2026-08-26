"use client";

// El motor de dictado vendorizado (lib/stt/deepgram-dictation.js — NO EDITAR
// a mano) siempre abre el micrófono real vía getUserMedia(). En vez de tocar
// ese archivo, interceptamos getUserMedia desde afuera: mientras el shim está
// instalado, cualquier pedido de audio recibe el MediaStream sintético del
// Omi en vez del hardware. Así el resto del pipeline (WebSocket, reconexión,
// mic-health.ts) no se entera de que la fuente cambió.

type GetUserMedia = typeof navigator.mediaDevices.getUserMedia;

let originalGetUserMedia: GetUserMedia | null = null;
let installCount = 0;

/** Devuelve la función para desinstalar el shim (restaura getUserMedia real). */
export function installOmiMicrophoneShim(stream: MediaStream): () => void {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    return () => {};
  }
  if (installCount === 0) {
    originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  }
  installCount += 1;

  navigator.mediaDevices.getUserMedia = (async (constraints?: MediaStreamConstraints) => {
    if (constraints && constraints.audio) {
      return stream;
    }
    return originalGetUserMedia!(constraints);
  }) as GetUserMedia;

  let uninstalled = false;
  return function uninstall() {
    if (uninstalled) return;
    uninstalled = true;
    installCount = Math.max(0, installCount - 1);
    if (installCount === 0 && originalGetUserMedia && navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = originalGetUserMedia;
    }
  };
}
