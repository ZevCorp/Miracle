// Única puerta de entrada tipada al motor de dictado vendoreado.
// El motor es multi-proveedor: la sesión del backend decide Deepgram o Soniox.

import { MiracleDeepgramDictation } from "./deepgram-dictation.js";

/** Respuesta de POST /api/stt/session (passthrough del backend Miracle). */
export interface VoiceStreamSession {
  provider: string;
  access_token: string;
  auth_scheme: string;
  expires_in: number;
  websocket_url: string;
  model: string;
  language: string;
  timeslice_ms: number;
  endpointing_ms: number;
  start_message: Record<string, unknown> | null;
}

export interface DictationHandle {
  start(): Promise<void>;
  stop(): Promise<void>;
  dispose(): void;
  reset(): void;
  ensureMicrophone(): Promise<MediaStream>;
  isRecording(): boolean;
}

export interface DictationOptions {
  /** Debe devolver la sesión STT (nuestro proxy /api/stt/session). */
  createStreamSession: () => Promise<VoiceStreamSession>;
  onPartialTranscript?: (text: string) => void;
  onFinalTranscript?: (segment: {
    segmentId: string;
    transcript: string;
    language: string | null;
  }) => void;
  onError?: (message: string) => void;
  onDebug?: (event: string, data: unknown) => void;
  onUnexpectedClose?: () => void;
}

export const createDictation = MiracleDeepgramDictation.create as (
  options: DictationOptions,
) => DictationHandle;
