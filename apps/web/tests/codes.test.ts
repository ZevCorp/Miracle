import { describe, it, expect } from "vitest";
import { searchCodes, CODE_CATALOG } from "@/lib/clinical/codes";

describe("searchCodes", () => {
  it("filtra por sistema", () => {
    const res = searchCodes("CIE-10", "", 100);
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((c) => c.sistema === "CIE-10")).toBe(true);
  });

  it("busca por código y por descripción, sin distinguir mayúsculas", () => {
    expect(searchCodes("CIE-10", "i10").some((c) => c.codigo === "I10")).toBe(true);
    expect(searchCodes("CIE-10", "hipertensión").some((c) => c.codigo === "I10")).toBe(true);
    expect(searchCodes("CIE-10", "HIPERT").some((c) => c.codigo === "I10")).toBe(true);
  });

  it("respeta el límite", () => {
    expect(searchCodes("CUPS", "", 3)).toHaveLength(3);
  });

  it("no cruza sistemas", () => {
    // 890205 es un CUPS: no debe aparecer buscando en CIE-10.
    expect(searchCodes("CIE-10", "890205")).toHaveLength(0);
  });

  it("con query vacío devuelve la base del sistema recortada", () => {
    const cups = CODE_CATALOG.filter((c) => c.sistema === "CUPS");
    expect(searchCodes("CUPS", "   ", 100)).toHaveLength(cups.length);
  });
});
