import { describe, expect, it } from "vitest";
import { omiConnectErrorMessage } from "@/lib/omi/messages";
import { OmiWorkletLoadError } from "@/lib/omi/syntheticMicStream";

describe("omiConnectErrorMessage", () => {
  it("cerrar el selector de dispositivos no es un error: no dice nada", () => {
    const cancelado = new Error("User cancelled the requestDevice() chooser.");
    expect(omiConnectErrorMessage(cancelado)).toBeNull();
  });

  it("sin adaptador Bluetooth manda a revisar el Bluetooth", () => {
    const sinAdaptador = Object.assign(new Error("Bluetooth adapter not available."), {
      name: "NotFoundError",
    });
    expect(omiConnectErrorMessage(sinAdaptador)).toMatch(/Bluetooth esté encendido/);
  });

  it("el fallo de red al cargar el worklet NO se confunde con uno de Bluetooth", () => {
    /* Es el fallo menos intuitivo del Omi: emparejar es local, pero el módulo
       de audio se descarga del servidor y el service worker no cachea nada.
       Mandar al médico a revisar el adaptador Bluetooth con el wifi caído lo
       pone a buscar donde no es. Este test fija el orden de las ramas. */
    const mensaje = omiConnectErrorMessage(
      new OmiWorkletLoadError(new Error("Unable to load a worklet's module.")),
    );
    expect(mensaje).toMatch(/conexión/);
    expect(mensaje).not.toMatch(/adaptador/);
  });

  it("un error que ya trae una DOMException de Bluetooth dentro sigue leyéndose como red", () => {
    // La causa se conserva para depurar, pero no debe cambiar el mensaje.
    const dom = Object.assign(new Error("NotFoundError"), { name: "NotFoundError" });
    expect(omiConnectErrorMessage(new OmiWorkletLoadError(dom))).toMatch(/conexión/);
  });
});
