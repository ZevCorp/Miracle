"use client";

// Conexión Web Bluetooth directa al Omi. Solo Chrome/Edge de escritorio y
// Android exponen `navigator.bluetooth`; en cualquier otro navegador
// `isWebBluetoothSupported()` da false y la UI debe ocultar esta vía.

import { OMI_AUDIO_CHARACTERISTIC_UUID, OMI_SERVICE_UUID } from "./constants";

export type OmiBleStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

export interface OmiBleHandle {
  disconnect(): void;
  isConnected(): boolean;
}

export interface OmiBleCallbacks {
  onPacket: (data: DataView) => void;
  onStatusChange: (status: OmiBleStatus) => void;
  onError: (message: string) => void;
}

// Reconexión GATT encadenada: mismo patrón de backoff que useDictation.ts usa
// para el WebSocket de transcripción.
const RECONNECT_DELAYS_MS = [500, 1500, 3000];

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export async function connectOmi(callbacks: OmiBleCallbacks): Promise<OmiBleHandle> {
  if (!isWebBluetoothSupported()) {
    throw new Error("Este navegador no soporta Web Bluetooth. Usa Chrome o Edge de escritorio.");
  }

  callbacks.onStatusChange("connecting");
  // requestDevice exige un gesto directo del usuario (click): no se puede
  // disparar automáticamente al montar un componente.
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [OMI_SERVICE_UUID] }],
  });

  let userDisconnected = false;
  let reconnectAttempt = 0;
  let characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  function handleNotify(event: Event) {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (target.value) callbacks.onPacket(target.value);
  }

  async function subscribe() {
    if (!device.gatt) throw new Error("El dispositivo Omi no expone GATT server.");
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(OMI_SERVICE_UUID);
    characteristic = await service.getCharacteristic(OMI_AUDIO_CHARACTERISTIC_UUID);
    await characteristic.startNotifications();
    characteristic.addEventListener("characteristicvaluechanged", handleNotify);
    reconnectAttempt = 0;
    callbacks.onStatusChange("connected");
  }

  function scheduleReconnect() {
    if (userDisconnected) return;
    if (reconnectAttempt >= RECONNECT_DELAYS_MS.length) {
      callbacks.onError("Se perdió la conexión con el Omi y no fue posible reconectar.");
      callbacks.onStatusChange("disconnected");
      return;
    }
    callbacks.onStatusChange("reconnecting");
    const delay = RECONNECT_DELAYS_MS[reconnectAttempt];
    reconnectAttempt += 1;
    setTimeout(() => {
      subscribe().catch(() => scheduleReconnect());
    }, delay);
  }

  device.addEventListener("gattserverdisconnected", () => {
    characteristic?.removeEventListener("characteristicvaluechanged", handleNotify);
    if (!userDisconnected) scheduleReconnect();
  });

  await subscribe();

  return {
    disconnect() {
      userDisconnected = true;
      characteristic?.removeEventListener("characteristicvaluechanged", handleNotify);
      characteristic?.stopNotifications().catch(() => {});
      device.gatt?.disconnect();
      callbacks.onStatusChange("disconnected");
    },
    isConnected() {
      return Boolean(device.gatt?.connected);
    },
  };
}
