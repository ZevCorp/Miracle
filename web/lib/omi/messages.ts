"use client";

// Traduce los errores crudos de Web Bluetooth (DOMException en inglés, sin
// contexto) a algo que un médico pueda accionar. `requestDevice()` tira
// `NotFoundError` tanto si no hay adaptador/permiso como si el usuario
// simplemente cerró el selector sin elegir nada — hay que mirar el texto del
// mensaje, no alcanza con el `name`.

import { isAndroid, isIOS } from "./platform";
import { OmiWorkletLoadError } from "./syntheticMicStream";

export const ANDROID_PERMISO =
  "Chrome no tiene permiso para usar Bluetooth en este teléfono. Ve a Ajustes del sistema → Apps → Chrome → Permisos → Dispositivos cercanos, y actívalo. Revisa también que el Bluetooth esté encendido.";

export function omiConnectErrorMessage(error: unknown): string | null {
  // Va primero, antes de mirar nombres de DOMException: el fallo no es de
  // Bluetooth y decirle al médico que revise el adaptador lo mandaría a buscar
  // en el sitio equivocado. Es el único error de Omi que se arregla con la red.
  if (error instanceof OmiWorkletLoadError) {
    return "No hay conexión para cargar el módulo de audio del Omi. El emparejamiento es Bluetooth, pero esa pieza se descarga una vez: revisa tu conexión y vuelve a intentar.";
  }

  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  // El médico cerró el selector de dispositivos sin elegir ninguno: no es un
  // error, es una cancelación. No hay nada que mostrarle.
  if (/chooser|cancelled|cancel/i.test(message)) return null;

  if (name === "NotFoundError" || /adapter not available/i.test(message)) {
    if (isAndroid()) return ANDROID_PERMISO;
    return "No se encontró un adaptador Bluetooth activo. Revisa que el Bluetooth esté encendido en este equipo.";
  }

  if (name === "SecurityError" || name === "NotAllowedError") {
    if (isAndroid()) return ANDROID_PERMISO;
    return "El navegador bloqueó el acceso a Bluetooth. Revisa los permisos del sitio (el candado de la barra de direcciones).";
  }

  if (isIOS()) {
    return "Omi no está disponible en iPhone/iPad: Apple no permite Bluetooth Web en ningún navegador de iOS.";
  }

  return message || "No fue posible conectar con el Omi.";
}
