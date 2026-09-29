import { describe, expect, it } from "vitest";
import {
  deriveAccess,
  type BillingAccountRow,
} from "@/lib/billing/entitlements";
import { canAccessPath } from "@/lib/auth/roles";
import { visibleAppNav } from "@/lib/site";

/**
 * Matriz de acceso comercial. deriveAccess es el ESPEJO TS de
 * private.org_has_access() (migración 20260811100000): si un caso cambia aquí,
 * tiene que cambiar también en SQL — este archivo es el contrato.
 */

const AHORA = new Date("2026-08-11T12:00:00Z");

function dias(n: number): string {
  return new Date(AHORA.getTime() + n * 86_400_000).toISOString();
}

function fila(extra: Partial<BillingAccountRow> = {}): BillingAccountRow {
  return {
    mode: "self_serve",
    stripe_status: null,
    current_period_end: null,
    cancel_at_period_end: false,
    trial_ends_at: null,
    comped_until: null,
    ...extra,
  };
}

describe("deriveAccess — organizaciones B2B (institution)", () => {
  it("una institución con fila institutional siempre tiene acceso", () => {
    const acceso = deriveAccess(fila({ mode: "institutional" }), "institution", null, AHORA);
    expect(acceso).toMatchObject({ level: "full", status: "institucional" });
  });

  it("una institución SIN fila de billing tiene acceso (fail-open)", () => {
    const acceso = deriveAccess(null, "institution", null, AHORA);
    expect(acceso).toMatchObject({ level: "full", status: "institucional" });
  });

  it("una organización archivada queda bloqueada aunque su billing esté sano", () => {
    const acceso = deriveAccess(
      fila({ mode: "institutional" }),
      "institution",
      "2026-08-01T00:00:00Z",
      AHORA,
    );
    expect(acceso.level).toBe("blocked");
  });
});

describe("deriveAccess — cortesía (comped)", () => {
  it("cortesía indefinida (comped_until null) da acceso", () => {
    const acceso = deriveAccess(fila({ mode: "comped" }), "personal", null, AHORA);
    expect(acceso).toMatchObject({ level: "full", status: "cortesia" });
  });

  it("cortesía con fecha futura da acceso", () => {
    const acceso = deriveAccess(fila({ mode: "comped", comped_until: dias(30) }), "personal", null, AHORA);
    expect(acceso).toMatchObject({ level: "full", status: "cortesia" });
  });

  it("cortesía vencida cae a la evaluación self_serve: sin nada más, bloquea", () => {
    const acceso = deriveAccess(fila({ mode: "comped", comped_until: dias(-1) }), "personal", null, AHORA);
    expect(acceso).toMatchObject({ level: "blocked", status: "sin_plan" });
  });

  it("cortesía vencida con suscripción activa queda activa (la cortesía es un overlay)", () => {
    const acceso = deriveAccess(
      fila({ mode: "comped", comped_until: dias(-1), stripe_status: "active" }),
      "personal",
      null,
      AHORA,
    );
    expect(acceso).toMatchObject({ level: "full", status: "activa" });
  });
});

describe("deriveAccess — trial de Miracle (sin tarjeta)", () => {
  it("trial vigente: acceso completo y días restantes redondeados hacia arriba", () => {
    const acceso = deriveAccess(fila({ trial_ends_at: dias(4.5) }), "personal", null, AHORA);
    expect(acceso).toMatchObject({ level: "full", status: "trial", trialDaysLeft: 5 });
  });

  it("trial vencido: bloqueo total (decisión de producto)", () => {
    const acceso = deriveAccess(fila({ trial_ends_at: dias(-0.1) }), "personal", null, AHORA);
    expect(acceso).toMatchObject({ level: "blocked", status: "sin_plan" });
  });

  it("sin trial y sin suscripción: bloqueado", () => {
    const acceso = deriveAccess(fila(), "personal", null, AHORA);
    expect(acceso).toMatchObject({ level: "blocked", status: "sin_plan" });
  });

  it("una org personal SIN fila de billing no se bloquea (fail-open)", () => {
    const acceso = deriveAccess(null, "personal", null, AHORA);
    expect(acceso).toMatchObject({ level: "full", status: "sin_registro" });
  });
});

describe("deriveAccess — suscripción de Stripe", () => {
  it("active y trialing dan acceso", () => {
    for (const status of ["active", "trialing"] as const) {
      const acceso = deriveAccess(fila({ stripe_status: status }), "personal", null, AHORA);
      expect(acceso).toMatchObject({ level: "full", status: "activa" });
    }
  });

  it("el estado de la suscripción manda sobre un trial ya vencido", () => {
    const acceso = deriveAccess(
      fila({ stripe_status: "active", trial_ends_at: dias(-30) }),
      "personal",
      null,
      AHORA,
    );
    expect(acceso.level).toBe("full");
  });

  it("cancelación programada: sigue activa pero lo reporta", () => {
    const acceso = deriveAccess(
      fila({ stripe_status: "active", cancel_at_period_end: true, current_period_end: dias(10) }),
      "personal",
      null,
      AHORA,
    );
    expect(acceso).toMatchObject({ level: "full", status: "activa", cancelAtPeriodEnd: true });
  });

  it("past_due dentro del período ya pagado: acceso con aviso", () => {
    const acceso = deriveAccess(
      fila({ stripe_status: "past_due", current_period_end: dias(3) }),
      "personal",
      null,
      AHORA,
    );
    expect(acceso).toMatchObject({ level: "full", status: "pago_pendiente" });
  });

  it("past_due con el período vencido: bloqueo inmediato (gracia = 0)", () => {
    const acceso = deriveAccess(
      fila({ stripe_status: "past_due", current_period_end: dias(-1) }),
      "personal",
      null,
      AHORA,
    );
    expect(acceso).toMatchObject({ level: "blocked", status: "pago_pendiente" });
  });

  it("canceled bloquea con su propio estado (la página ofrece reactivar)", () => {
    const acceso = deriveAccess(fila({ stripe_status: "canceled" }), "personal", null, AHORA);
    expect(acceso).toMatchObject({ level: "blocked", status: "cancelada" });
  });

  it("unpaid, paused e incomplete* bloquean", () => {
    for (const status of ["unpaid", "paused", "incomplete", "incomplete_expired"] as const) {
      const acceso = deriveAccess(fila({ stripe_status: status }), "personal", null, AHORA);
      expect(acceso.level).toBe("blocked");
    }
  });
});

describe("acceso y navegación de /suscripcion", () => {
  it("médico y admin pueden abrir /suscripcion", () => {
    expect(canAccessPath("medico", "/suscripcion")).toBe(true);
    expect(canAccessPath("admin", "/suscripcion")).toBe(true);
  });

  it("la secretaría y la cuenta demo no (sus listas blancas no la incluyen)", () => {
    expect(canAccessPath("secretaria", "/suscripcion")).toBe(false);
    expect(canAccessPath("admin", "/suscripcion", true)).toBe(false);
  });

  it("el ítem Suscripción solo aparece en organizaciones personales", () => {
    const personal = visibleAppNav("medico", null, false, "personal");
    const hospital = visibleAppNav("medico", null, false, "institution");
    const sinDato = visibleAppNav("medico", null, false);
    expect(personal.some((item) => item.href === "/suscripcion")).toBe(true);
    expect(hospital.some((item) => item.href === "/suscripcion")).toBe(false);
    // Sin orgKind se asume institución: mejor ocultar que enseñar a un hospital.
    expect(sinDato.some((item) => item.href === "/suscripcion")).toBe(false);
  });

  it("la cuenta demo no ve el ítem de suscripción", () => {
    const demo = visibleAppNav("admin", null, true, "personal");
    expect(demo.some((item) => item.href === "/suscripcion")).toBe(false);
  });
});
