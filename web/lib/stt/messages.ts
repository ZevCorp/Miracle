// Textos clínicos en español para los estados/errores de la dictación.
// Los strings crudos del motor NUNCA se muestran (dicen "Deepgram" hardcodeado
// y vienen sin tildes); aquí se mapean a mensajes propios.

export const DICTATION_MESSAGES = {
  micDenied:
    "No pudimos acceder al micrófono. Habilita el permiso en tu navegador e inténtalo de nuevo.",
  micMissing: "No encontramos un micrófono en este dispositivo.",
  micBusy:
    "El micrófono está en uso por otra aplicación. Ciérrala e inténtalo de nuevo.",
  micSilent:
    "El micrófono está conectado pero no está entregando audio. Comprueba en la configuración de sonido del sistema que el micrófono seleccionado sea el correcto, o desconéctalo y vuelve a conectarlo.",
  micLost:
    "Se perdió la señal del micrófono durante la grabación. Lo transcrito hasta ahora se conserva; revisa la conexión del micrófono y reanuda.",
  serviceUnavailable:
    "La transcripción en vivo no está disponible en este momento. Puedes escribir la transcripción manualmente.",
  connectionLost:
    "Se perdió la conexión con el servicio de transcripción. Lo transcrito hasta ahora se conserva; puedes reanudar la grabación.",
  generic:
    "No fue posible iniciar la transcripción en vivo. Puedes escribir la transcripción manualmente.",
} as const;

/**
 * Traduce un error de getUserMedia / del motor a un mensaje clínico.
 * `error` puede ser un DOMException (permisos) o un Error/string del motor.
 */
export function dictationErrorMessage(error: unknown): string {
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return DICTATION_MESSAGES.micDenied;
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return DICTATION_MESSAGES.micMissing;
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return DICTATION_MESSAGES.micBusy;
  }
  // El micrófono abre pero no entrega muestras (driver mudo, USB colgado).
  // Va antes del emparejado por texto: su mensaje lleva "micrófono" y "audio".
  if (name === "MicSilentError") {
    return DICTATION_MESSAGES.micSilent;
  }

  const text =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "";
  // Fallos de sesión (proxy 4xx/5xx) → servicio no disponible.
  if (/sesi[oó]n|session|configurad|disponible|autorizado/i.test(text)) {
    return DICTATION_MESSAGES.serviceUnavailable;
  }
  // Cierres/fallos de stream del motor ("...stream en Deepgram", "se cerro antes").
  if (/stream|socket|cerro|conexi/i.test(text)) {
    return DICTATION_MESSAGES.connectionLost;
  }
  return DICTATION_MESSAGES.generic;
}
