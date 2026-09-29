import { describe, it, expect } from "vitest";
import { isAppRole, canAccessPath, APP_ROLES, APP_ROLE_LABEL } from "@/lib/auth/roles";
import { assignableRolesFor, canAssignRole } from "@/lib/superadmin/roles";

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

  it("usuarios y la configuración institucional solo para admin", () => {
    expect(canAccessPath("admin", "/app/usuarios")).toBe(true);
    expect(canAccessPath("admin", "/app/institucion")).toBe(true);
    expect(canAccessPath("medico", "/app/usuarios")).toBe(false);
    expect(canAccessPath("supervisor", "/app/institucion")).toBe(false);
  });

  // /app/configuracion son los ajustes PERSONALES y se parece demasiado de
  // nombre a /app/institucion: este test es el que avisa si alguien vuelve a
  // meterlos en la misma cláusula y deja a los médicos sin su propia pantalla.
  it("la configuración personal la alcanza cualquier rol clínico", () => {
    expect(canAccessPath("medico", "/app/configuracion")).toBe(true);
    expect(canAccessPath("supervisor", "/app/configuracion")).toBe(true);
    expect(canAccessPath("admin", "/app/configuracion")).toBe(true);
    expect(canAccessPath("secretaria", "/app/configuracion")).toBe(false);
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

  it("la demo ve la superficie del médico", () => {
    for (const path of [
      "/app/dashboard",
      "/app/consultas",
      "/app/consultas/abc-123",
      "/app/pacientes",
      "/app/notas",
      "/app/plantillas",
    ]) {
      expect(canAccessPath("admin", path, true)).toBe(true);
    }
  });

  it("la demo NO ve las secciones de administración ni patología", () => {
    // El flag acota: aunque el rol admin las alcance, la demo se enseña a
    // médicos y esas secciones son de un administrador de hospital.
    for (const path of [
      "/app/usuarios",
      "/app/institucion",
      "/app/configuracion",
      "/app/auditoria",
      "/app/reportes",
      "/app/laboratorio",
    ]) {
      expect(canAccessPath("admin", path, true)).toBe(false);
      expect(canAccessPath("medico", path, true)).toBe(false);
    }
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

// ============================================================================
// Jefe de área (admin_area)
// ============================================================================
//
// El rol nació para que la jefa de urgencias del Hospital General dejara de ver
// las consultas de patología. Lo que sigue es la cara de interfaz de esa regla;
// el alcance REAL sobre los datos lo impone private.supervises en la RLS
// (supabase/migrations/20260901140000_areas_medicas.sql) y no se puede
// comprobar desde aquí. Estos tests custodian la parte que sí vive en código:
// qué pantallas alcanza y qué roles puede repartir.

describe("admin_area: pantallas", () => {
  it("gestiona usuarios, pero NO la configuración institucional", () => {
    expect(canAccessPath("admin_area", "/app/usuarios")).toBe(true);
    // El organigrama de áreas vive en /app/institucion a propósito: si un jefe
    // de servicio pudiera entrar, podría crearse áreas o renombrar la suya, que
    // es decidir el organigrama del hospital desde un servicio.
    expect(canAccessPath("admin_area", "/app/institucion")).toBe(false);
  });

  it("ve auditoría y reportes (la RLS se los recorta a su área)", () => {
    expect(canAccessPath("admin_area", "/app/auditoria")).toBe(true);
    expect(canAccessPath("admin_area", "/app/reportes")).toBe(true);
  });

  // El jefe de un servicio médico ejerce: es médico y además administra. Es la
  // diferencia con `admin`, que es gerencia y no atiende pacientes. Si alguien
  // vuelve a meter los dos roles en la misma cláusula, este test avisa.
  it("SÍ graba y firma notas, a diferencia del admin de la institución", () => {
    expect(canAccessPath("admin_area", "/app/consultas/nueva")).toBe(true);
    expect(canAccessPath("admin_area", "/app/consultas/en-vivo")).toBe(true);
    expect(canAccessPath("admin", "/app/consultas/nueva")).toBe(false);
    expect(canAccessPath("supervisor", "/app/consultas/en-vivo")).toBe(false);
  });

  it("nunca alcanza la consola de plataforma", () => {
    expect(canAccessPath("admin_area", "/superadmin")).toBe(false);
    expect(canAccessPath("admin_area", "/superadmin/usuarios")).toBe(false);
  });

  it("tiene sus ajustes personales, como cualquier rol clínico", () => {
    expect(canAccessPath("admin_area", "/app/configuracion")).toBe(true);
  });
});

describe("admin_area: qué roles puede repartir", () => {
  it("solo médico y supervisor", () => {
    expect(assignableRolesFor("admin_area")).toEqual(["medico", "supervisor"]);
  });

  // Nombrar a un par es la vía obvia para saltarse el alcance: dos jefes de
  // servicio que se nombren mutuamente en áreas distintas se ven todo.
  it("no nombra administradores ni otros jefes de área", () => {
    expect(canAssignRole("admin_area", "admin")).toBe(false);
    expect(canAssignRole("admin_area", "admin_area")).toBe(false);
    expect(canAssignRole("admin_area", "superadmin")).toBe(false);
    expect(canAssignRole("admin_area", "secretaria")).toBe(false);
  });

  it("el admin de la institución sí nombra jefes de área", () => {
    expect(canAssignRole("admin", "admin_area")).toBe(true);
    expect(canAssignRole("admin", "admin")).toBe(true);
  });

  it("quien no gestiona cuentas no reparte nada", () => {
    expect(assignableRolesFor("medico")).toEqual([]);
    expect(assignableRolesFor("supervisor")).toEqual([]);
    expect(assignableRolesFor("secretaria")).toEqual([]);
    expect(canAssignRole("medico", "admin")).toBe(false);
  });

  it("ningún rol reparte superadmin", () => {
    for (const r of APP_ROLES) expect(canAssignRole(r, "superadmin")).toBe(false);
  });
});
