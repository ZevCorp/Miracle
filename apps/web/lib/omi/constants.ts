// Protocolo BLE de Omi (DevKit), confirmado contra el código fuente del SDK
// oficial en Python: github.com/BasedHardware/omi/blob/main/sdks/python/omi/
// (constants.py, bluetooth.py, decoder.py). No hay SDK oficial ni comunitario
// para navegador — este módulo es la capa de transporte mínima; el codec
// Opus lo resuelve el paquete de terceros `opus-decoder`.

/** Servicio BLE principal del dispositivo Omi. */
export const OMI_SERVICE_UUID = "19b10000-e8f2-537e-4f6c-d104768a1214";

/** Característica de audio (notify): entrega paquetes Opus con cabecera. */
export const OMI_AUDIO_CHARACTERISTIC_UUID = "19b10001-e8f2-537e-4f6c-d104768a1214";

/**
 * Cada notificación trae 3 bytes de cabecera (índice de paquete) antes del
 * frame Opus. Se descartan antes de decodificar. Verificar con hardware real
 * en el spike inicial: la doc pública no publica el layout exacto de esos 3
 * bytes, solo que hay que saltarlos.
 */
export const OMI_PACKET_HEADER_BYTES = 3;

/** El firmware codifica a 16 kHz mono. */
export const OMI_SAMPLE_RATE_HZ = 16000;
export const OMI_CHANNELS = 1;
