import { describe, it, expect } from "vitest";
import { isAppRole, canAccessPath, APP_ROLES, APP_ROLE_LABEL } from "@/lib/auth/roles";

describe("isAppRole", () => {
  it("acepta los roles válidos", () => {
    for (const r of APP_ROLES) expect(isAppRole(r)).toBe(true);
  });
  it("rechaza valores inválidos", () => {
    expect(isAppRole("root")).toBe(false);
    expect(isAppRole("")).toBe(false);
    expect(isAppRole(null)).toBe(false);
    expect(isAppRole(undefined)).toBe(false);
    expect(isAppRole(123)).toBe(false);
  });
});

describe("APP_ROLE_LABEL", () => {
  it("tiene etiqueta para cada rol", () => {
    for (const r of APP_ROLES) expect(APP_ROLE_LABEL[r]).toBeTruthy();
  });
});

describe("canAccessPath", () => {
  it("la consola /superadmin es exclusiva del superadmin", () => {
    expect(canAccessPath("superadmin", "/superadmin")).toBe(true);
    expect(canAccessPath("superadmin", "/superadmin/usuarios")).toBe(true);
    expect(canAccessPath("admin", "/superadmin")).toBe(false);
    expect(canAccessPath("medico", "/superadmin/usuarios")).toBe(false);
    expect(canAccessPath("supervisor", "/superadmin")).toBe(false);
  });

  it("/app/consultas/nueva solo para médico", () => {
    expect(canAccessPath("medico", "/app/consultas/nueva")).toBe(true);
    expect(canAccessPath("admin", "/app/consultas/nueva")).toBe(false);
    expect(canAccessPath("supervisor", "/app/consultas/nueva")).toBe(false);
  });

  it("usuarios y configuración solo para admin", () => {
    expect(canAccessPath("admin", "/app/usuarios")).toBe(true);
    expect(canAccessPath("admin", "/app/configuracion")).toBe(true);
    expect(canAccessPath("medico", "/app/usuarios")).toBe(false);
    expect(canAccessPath("supervisor", "/app/configuracion")).toBe(false);
  });

  it("auditoría y reportes para admin o supervisor", () => {
    expect(canAccessPath("admin", "/app/auditoria")).toBe(true);
    expect(canAccessPath("supervisor", "/app/reportes")).toBe(true);
    expect(canAccessPath("medico", "/app/auditoria")).toBe(false);
    expect(canAccessPath("medico", "/app/reportes")).toBe(false);
  });

  it("rutas comunes accesibles para todos los roles del panel", () => {
    for (const r of ["admin", "supervisor", "medico"] as const) {
      expect(canAccessPath(r, "/app/dashboard")).toBe(true);
      expect(canAccessPath(r, "/app/pacientes")).toBe(true);
      expect(canAccessPath(r, "/app/notas")).toBe(true);
    }
  });
});

describe("canAccessPath · cuenta demo comercial", () => {
  it("la cuenta demo (rol admin) sí puede crear y grabar una consulta", () => {
    expect(canAccessPath("admin", "/app/consultas/nueva", true)).toBe(true);
    expect(canAccessPath("admin", "/app/consultas/en-vivo", true)).toBe(true);
  });

  it("el flag demo NUNCA abre la consola de plataforma", () => {
    for (const r of ["admin", "supervisor", "medico", "secretaria"] as const) {
      expect(canAccessPath(r, "/superadmin", true)).toBe(false);
      expect(canAccessPath(r, "/superadmin/organizaciones", true)).toBe(false);
    }
  });

  it("el flag demo no asciende a un médico a usuarios ni configuración", () => {
    // La demo llega a esas secciones por su rol admin, no por el flag: un
    // médico marcado como demo sigue sin poder administrar la organización.
    expect(canAccessPath("medico", "/app/usuarios", true)).toBe(false);
    expect(canAccessPath("medico", "/app/configuracion", true)).toBe(false);
    expect(canAccessPath("medico", "/app/auditoria", true)).toBe(false);
    expect(canAccessPath("medico", "/app/reportes", true)).toBe(false);
  });

  it("sin el flag, el comportamiento no cambia", () => {
    expect(canAccessPath("admin", "/app/consultas/nueva")).toBe(false);
    expect(canAccessPath("admin", "/app/consultas/nueva", false)).toBe(false);
  });

  it("la secretaría sigue con su lista blanca aunque la marquen como demo", () => {
    expect(canAccessPath("secretaria", "/app/consultas/nueva", true)).toBe(false);
    expect(canAccessPath("secretaria", "/app/pacientes", true)).toBe(false);
    expect(canAccessPath("secretaria", "/app/consultas", true)).toBe(true);
  });
});
