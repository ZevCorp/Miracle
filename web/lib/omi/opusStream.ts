"use client";

// Decodificación Opus → PCM delegada al paquete de terceros `opus-decoder`
// (WASM, github.com/eshaz/wasm-audio-decoders). No reimplementamos el codec:
// solo le sacamos la cabecera propietaria de Omi a cada paquete BLE antes de
// pasárselo.

import { OpusDecoder } from "opus-decoder";
import { OMI_CHANNELS, OMI_PACKET_HEADER_BYTES, OMI_SAMPLE_RATE_HZ } from "./constants";

export interface OmiOpusDecoderHandle {
  /** Devuelve el PCM del frame o null si el paquete es inválido/corto. */
  decodePacket(raw: DataView): Float32Array | null;
  free(): void;
}

export async function createOmiOpusDecoder(): Promise<OmiOpusDecoderHandle> {
  const decoder = new OpusDecoder({ sampleRate: OMI_SAMPLE_RATE_HZ, channels: OMI_CHANNELS });
  await decoder.ready;

  return {
    decodePacket(raw) {
      if (raw.byteLength <= OMI_PACKET_HEADER_BYTES) return null;
      const opusFrame = new Uint8Array(
        raw.buffer,
        raw.byteOffset + OMI_PACKET_HEADER_BYTES,
        raw.byteLength - OMI_PACKET_HEADER_BYTES,
      );
      try {
        const { channelData } = decoder.decodeFrame(opusFrame);
        const pcm = channelData[0];
        // Copia defensiva: el decoder puede reusar el buffer interno en la
        // siguiente llamada, y este Float32Array cruza a un AudioWorklet por
        // postMessage con transferencia de owner.
        return pcm ? new Float32Array(pcm) : null;
      } catch {
        return null;
      }
    },
    free() {
      decoder.free();
    },
  };
}
