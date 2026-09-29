import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  describePrivacySummary,
  describePrivacyTokens,
  privacyFromLedgerEvents,
} from "@/lib/clinical/privacy-summary";
import type { PrivacyLedgerEvent, PrivacyShieldSummary } from "@/lib/api/clinical";

/**
 * La pantalla no puede afirmar una protección que no midió.
 *
 * Hasta el 2026-09-07 la insignia «Datos del paciente protegidos antes de
 * enviar a la IA» salía de un redactor del navegador apagado desde julio. La
 * regla ahora: el único origen de esa afirmación es lo que el servidor
 * certificó para la consulta (`privacy` en la respuesta de generación o el
 * ledger). Estos tests fijan esa regla y vigilan que el redactor viejo no
 * vuelva a entrar por la puerta de atrás.
 */

const enforce: PrivacyShieldSummary = {
  mode: "enforce",
  shielded: true,
  tokens: { PACIENTE_NOMBRE: 2, DOCUMENTO: 1, TELEFONO: 1 },
  leak_scan: "ok",
  rehydration: "complete",
  posthoc_leak: false,
  image_parts: 0,
};

describe("describePrivacySummary", () => {
  it("sin dato del servidor no afirma protección", () => {
    const out = describePrivacySummary(null);
    expect(out.tone).toBe("muted");
    expect(out.label.toLowerCase()).not.toContain("protegido");
    expect(out.detail.toLowerCase()).not.toContain("se taparon");
  });

  it("en modo sombra dice que NO hubo protección", () => {
    const out = describePrivacySummary({ ...enforce, mode: "shadow", shielded: false });
    expect(out.tone).toBe("warning");
    expect(out.label).toContain("Sin protección activa");
  });

  it("en enforce afirma la protección con los conteos del servidor", () => {
    const out = describePrivacySummary(enforce);
    expect(out.tone).toBe("success");
    expect(out.label).toBe("Protegido antes de enviar a la IA: 2 nombres, 1 documento, 1 teléfono");
    expect(out.detail).toContain("2 nombres, 1 documento, 1 teléfono");
  });

  it("una rehidratación incompleta o una fuga post-hoc bajan el tono a advertencia", () => {
    expect(describePrivacySummary({ ...enforce, rehydration: "incomplete" }).tone).toBe("warning");
    expect(describePrivacySummary({ ...enforce, posthoc_leak: true }).detail).toContain("dato real");
  });

  it("sin identificadores que tapar lo dice sin inventar conteos", () => {
    const out = describePrivacySummary({ ...enforce, tokens: {} });
    expect(out.label).toBe("Enviado a la IA sin identificadores que tapar");
    expect(describePrivacyTokens(undefined)).toBe("");
  });
});

describe("privacyFromLedgerEvents", () => {
  const base = { at: "", provider: "openai", model: "x", api_family: "chat_completions", status: "ok" };
  it("prefiere el último envío de generación", () => {
    const events: PrivacyLedgerEvent[] = [
      { ...base, feature: "asistente", privacy: { ...enforce, tokens: { PACIENTE_NOMBRE: 9 } } },
      { ...base, feature: "note_generation", privacy: enforce },
    ];
    expect(privacyFromLedgerEvents(events)?.tokens.PACIENTE_NOMBRE).toBe(2);
  });
  it("sin envíos con dato devuelve null (y la insignia no afirma nada)", () => {
    expect(privacyFromLedgerEvents([{ ...base, feature: "asistente", privacy: null }])).toBeNull();
    expect(privacyFromLedgerEvents(undefined)).toBeNull();
  });
});

describe("el redactor del navegador no vuelve", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
    }
  };
  for (const dir of ["app", "components", "lib"]) walk(join(root, dir));

  it("lib/privacy/redact.ts ya no existe y nadie lo importa", () => {
    expect(existsSync(join(root, "lib", "privacy", "redact.ts"))).toBe(false);
    const importers = files.filter((file) => /buildRedactor|lib\/privacy\/redact/.test(readFileSync(file, "utf8")));
    expect(importers).toEqual([]);
  });

  it("ninguna pantalla afirma protección con un texto fijo", () => {
    const fixed = files.filter((file) =>
      /protegidos antes de enviar a la IA|se taparon antes de enviar/i.test(readFileSync(file, "utf8")),
    );
    expect(fixed).toEqual([]);
  });
});
