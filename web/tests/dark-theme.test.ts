import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function variablesFrom(block: string) {
  return Object.fromEntries(
    [...block.matchAll(/--color-([\w-]+):\s*(#[\da-f]{6})/gi)].map(
      ([, name, value]) => [name, value.toLowerCase()],
    ),
  );
}

function cssBlock(pattern: RegExp) {
  const match = css.match(pattern);
  if (!match?.[1]) throw new Error(`No se encontró el bloque ${pattern.source}`);
  return variablesFrom(match[1]);
}

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : Math.pow((channel + 0.055) / 1.055, 2.4),
    );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground: string, background: string) {
  const [bright, dark] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (bright + 0.05) / (dark + 0.05);
}

const light = cssBlock(/@theme\s*\{([\s\S]*?)\n\}/);
const dark = cssBlock(/:root\.dark\s*\{([\s\S]*?)\n\}/);

describe("tokens de tema Miracle", () => {
  it.each([
    ["texto principal claro", light.ink, light.surface],
    ["texto secundario claro", light.muted, light.surface],
    ["botón primario claro", "#ffffff", light["accent-solid"]],
    ["navegación lateral clara", light["sidebar-muted"], light.sidebar],
    ["texto principal oscuro", dark.ink, dark.surface],
    ["texto secundario oscuro", dark.muted, dark.surface],
    ["enlace oscuro", dark.accent, dark.surface],
    ["botón primario oscuro", "#ffffff", dark["accent-solid"]],
    ["navegación lateral oscura", dark["sidebar-muted"], dark.sidebar],
    ["control deshabilitado oscuro", dark["disabled-ink"], dark.disabled],
  ])("mantiene contraste AA para %s", (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it("define superficies semánticas distintas para contenido, campos y navegación", () => {
    expect(dark.surface).not.toBe(dark.field);
    expect(dark.sidebar).not.toBe(dark.surface);
    expect(dark.deep).not.toBe(dark.statement);
    expect(dark.accent).not.toBe(dark["accent-solid"]);
  });
});
