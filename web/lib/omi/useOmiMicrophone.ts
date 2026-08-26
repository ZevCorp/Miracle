"use client";

// Orquesta BLE + decodificación Opus + stream sintético + shim de
// getUserMedia detrás de una API simple: connect()/disconnect(). Mientras
// está "connected", cualquier `useDictation().start()` posterior grabará del
// Omi en vez del micrófono del navegador.

import { useCallback, useRef, useState } from "react";
import {
  connectOmi,
  isWebBluetoothSupported,
  type OmiBleHandle,
  type OmiBleStatus,
} from "./bleClient";
import { createOmiOpusDecoder, type OmiOpusDecoderHandle } from "./opusStream";
import { createSyntheticMicStream, type SyntheticMicStream } from "./syntheticMicStream";
import { installOmiMicrophoneShim } from "./getUserMediaShim";

export function useOmiMicrophone() {
  const [status, setStatus] = useState<OmiBleStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const bleRef = useRef<OmiBleHandle | null>(null);
  const decoderRef = useRef<OmiOpusDecoderHandle | null>(null);
  const micRef = useRef<SyntheticMicStream | null>(null);
  const uninstallShimRef = useRef<(() => void) | null>(null);

  const supported = isWebBluetoothSupported();

  const teardown = useCallback(() => {
    bleRef.current?.disconnect();
    bleRef.current = null;
    uninstallShimRef.current?.();
    uninstallShimRef.current = null;
    micRef.current?.close();
    micRef.current = null;
    decoderRef.current?.free();
    decoderRef.current = null;
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const mic = await createSyntheticMicStream();
      micRef.current = mic;
      const decoder = await createOmiOpusDecoder();
      decoderRef.current = decoder;

      const handle = await connectOmi({
        onPacket: (raw) => {
          const pcm = decoder.decodePacket(raw);
          if (pcm) mic.pushSamples(pcm);
        },
        onStatusChange: setStatus,
        onError: (message) => setError(message),
      });
      bleRef.current = handle;
      uninstallShimRef.current = installOmiMicrophoneShim(mic.stream);
    } catch (e) {
      teardown();
      setStatus("disconnected");
      setError(e instanceof Error ? e.message : "No fue posible conectar con el Omi.");
      throw e;
    } finally {
      setConnecting(false);
    }
  }, [teardown]);

  const disconnect = useCallback(() => {
    teardown();
    setStatus("disconnected");
    setError(null);
  }, [teardown]);

  return {
    supported,
    status,
    connecting,
    error,
    isConnected: status === "connected" || status === "reconnecting",
    connect,
    disconnect,
  };
}
