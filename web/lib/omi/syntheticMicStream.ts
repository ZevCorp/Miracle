"use client";

// Convierte el PCM decodificado del Omi en un MediaStream real (con una
// MediaStreamTrack de audio "live"), usando un AudioWorklet como buffer de
// reproducción continua. Este stream se comporta igual que el que devuelve
// getUserMedia() — es lo que permite reusar el motor de dictado y
// mic-health.ts sin tocarlos.

import { OMI_SAMPLE_RATE_HZ } from "./constants";

export interface SyntheticMicStream {
  stream: MediaStream;
  pushSamples(samples: Float32Array): void;
  close(): void;
}

export async function createSyntheticMicStream(): Promise<SyntheticMicStream> {
  // AudioContext al sample rate nativo del Omi (16 kHz): evita tener que
  // resamplear a mano. El navegador puede clamparlo en hardware raro; a
  // verificar en el spike con el dispositivo real.
  const ctx = new AudioContext({ sampleRate: OMI_SAMPLE_RATE_HZ });
  await ctx.audioWorklet.addModule("/omi-audio-worklet.js");

  const node = new AudioWorkletNode(ctx, "omi-pcm-stream-processor", {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  const destination = ctx.createMediaStreamDestination();
  node.connect(destination);

  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  return {
    stream: destination.stream,
    pushSamples(samples) {
      node.port.postMessage(samples, [samples.buffer]);
    },
    close() {
      node.disconnect();
      void ctx.close();
    },
  };
}
