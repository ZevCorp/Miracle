import { describe, expect, it } from "vitest";

import type { ClinicalNoteJson } from "@/lib/api/clinical";
import {
  buildRedactor,
  transformNoteStrings,
  PLACEHOLDER_DOCUMENTO,
  PLACEHOLDER_NUMERO,
  PLACEHOLDER_PACIENTE,
} from "@/lib/privacy/redact";

const IDENTITY = {
  nombre: "José David Jaramillo Pérez",
  documento: "CC 1.023.456.789",
};

// Estos tests cubren el motor de redacción real: buildRedactor(identity) sin
// segundo argumento está desactivado en producción (ver REDACTION_ENABLED en
// lib/privacy/redact.ts, pedido explícito para que el médico verifique la
// nota contra el dictado real), pero la lógica se mantiene y se prueba aquí
// pasando `enabled: true` para reactivarla el día que haya una forma de
// mostrar el dato real sin perder la protección hacia el LLM.
function redactor(identity: Parameters<typeof buildRedactor>[0] = IDENTITY) {
  return buildRedactor(identity, true);
}

describe("redact: nombre del paciente", () => {
  it("tapa el nombre completo como un único placeholder", () => {
    const r = redactor();
    expect(r.redact("El paciente José David Jaramillo Pérez consulta por cefalea.")).toBe(
      `El paciente ${PLACEHOLDER_PACIENTE} consulta por cefalea.`,
    );
  });

  it("tapa tokens sueltos del nombre (don José, vino Jaramillo)", () => {
    const r = redactor();
    expect(r.redact("Bueno, don José, siga.")).toBe(
      `Bueno, don ${PLACEHOLDER_PACIENTE}, siga.`,
    );
    expect(r.redact("Ayer vino Jaramillo a control.")).toBe(
      `Ayer vino ${PLACEHOLDER_PACIENTE} a control.`,
    );
  });

  it("colapsa secuencias parciales del nombre en un solo placeholder", () => {
    const r = redactor();
    expect(r.redact("Entonces dime, José David, ¿cómo sigues?")).toBe(
      `Entonces dime, ${PLACEHOLDER_PACIENTE}, ¿cómo sigues?`,
    );
  });

  it("es insensible a mayúsculas y acentos en ambas direcciones", () => {
    const r = redactor();
    expect(r.redact("JOSE dice que le duele")).toBe(
      `${PLACEHOLDER_PACIENTE} dice que le duele`,
    );
    // "perez y JARAMILLO" colapsa: la "y" puentea placeholders contiguos
    // (cubre apellidos compuestos como "Ortega y Gasset").
    expect(r.redact("josé, perez y JARAMILLO")).toBe(
      `${PLACEHOLDER_PACIENTE}, ${PLACEHOLDER_PACIENTE}`,
    );
    // Registrado sin tilde debe tapar el texto con tilde.
    const sinTilde = buildRedactor({ nombre: "Jose Perez", documento: null }, true);
    expect(sinTilde.redact("El señor José Pérez llegó")).toBe(
      `El señor ${PLACEHOLDER_PACIENTE} llegó`,
    );
  });

  it("matchea el nombre al final de la frase (caso que rompe con \\b ASCII)", () => {
    const r = redactor();
    expect(r.redact("firmado por José")).toBe(
      `firmado por ${PLACEHOLDER_PACIENTE}`,
    );
    expect(r.redact("José")).toBe(PLACEHOLDER_PACIENTE);
  });

  it("no tapa el nombre dentro de otra palabra", () => {
    const r = redactor();
    expect(r.redact("El josefino perezoso")).toBe("El josefino perezoso");
  });

  it("no tapa partículas sueltas de nombres compuestos", () => {
    const maria = buildRedactor(
      {
        nombre: "María del Carmen García",
        documento: null,
      },
      true,
    );
    expect(maria.redact("salió del consultorio")).toBe("salió del consultorio");
    expect(maria.redact("La saludé: María del Carmen, siga.")).toBe(
      `La saludé: ${PLACEHOLDER_PACIENTE}, siga.`,
    );
    expect(maria.redact("vino María del Carmen García hoy")).toBe(
      `vino ${PLACEHOLDER_PACIENTE} hoy`,
    );
  });

  it("cubre nombres con tokens cortos solo como frase completa", () => {
    const ana = buildRedactor({ nombre: "Ana Li Gómez", documento: null }, true);
    expect(ana.redact("La paciente Ana Li Gómez consulta")).toBe(
      `La paciente ${PLACEHOLDER_PACIENTE} consulta`,
    );
    // Limitación documentada: el token corto suelto no se tapa.
    expect(ana.redact("la señora Li")).toBe("la señora Li");
  });
});

describe("redact: documento y números", () => {
  it("tapa el documento registrado en sus variantes", () => {
    const r = redactor();
    expect(r.redact("cédula 1023456789, listo")).toBe(
      `cédula ${PLACEHOLDER_DOCUMENTO}, listo`,
    );
    expect(r.redact("documento 1.023.456.789.")).toBe(
      `documento ${PLACEHOLDER_DOCUMENTO}.`,
    );
    expect(r.redact("es 1 023 456 789 señor")).toBe(
      `es ${PLACEHOLDER_DOCUMENTO} señor`,
    );
    expect(r.redact("registrado como CC 1.023.456.789 en el sistema")).toBe(
      `registrado como ${PLACEHOLDER_DOCUMENTO} en el sistema`,
    );
  });

  it("ignora documentos sin dígitos suficientes (Por registrar)", () => {
    const r = buildRedactor({ nombre: null, documento: "Por registrar" }, true);
    expect(r.hasIdentity).toBe(false);
    expect(r.redact("Por registrar")).toBe("Por registrar");
  });

  it("tapa secuencias genéricas de 7-10 dígitos como [NUMERO]", () => {
    const r = redactor();
    expect(r.redact("otro documento: 43285382")).toBe(
      `otro documento: ${PLACEHOLDER_NUMERO}`,
    );
    expect(r.redact("autorización 1.500.000 aprobada")).toBe(
      `autorización ${PLACEHOLDER_NUMERO} aprobada`,
    );
  });

  it("deja intactos los valores clínicos comunes", () => {
    const r = redactor();
    expect(r.redact("tensión 120/80, plaquetas 250.000, dosis 50 mg")).toBe(
      "tensión 120/80, plaquetas 250.000, dosis 50 mg",
    );
    expect(r.redact("123456 no alcanza a ser cédula")).toBe(
      "123456 no alcanza a ser cédula",
    );
    expect(r.redact("cita el 17/07/2026 a las 10:30")).toBe(
      "cita el 17/07/2026 a las 10:30",
    );
  });
});

describe("redact: idempotencia y estabilidad", () => {
  const SAMPLE =
    "José David Jaramillo, cédula 1023456789, teléfono 3001234567. " +
    "Dice don José que toma 50 mg. Ya había un [PACIENTE] y un [NUMERO] antes.";

  it("redactar dos veces no cambia el resultado", () => {
    const r = redactor();
    const once = r.redact(SAMPLE);
    expect(r.redact(once)).toBe(once);
  });

  it("no corrompe placeholders preexistentes", () => {
    const r = redactor();
    const out = r.redact("Ya estaba [PACIENTE] con doc [DOCUMENTO] y [NUMERO].");
    expect(out).toBe("Ya estaba [PACIENTE] con doc [DOCUMENTO] y [NUMERO].");
  });

  it("rehidratar y volver a redactar devuelve el mismo texto", () => {
    const r = redactor();
    const redacted = r.redact(SAMPLE);
    expect(r.redact(r.rehydrate(redacted))).toBe(redacted);
  });

  it("el ciclo es estable con nombres con partículas y tokens cortos", () => {
    for (const nombre of ["María del Carmen García", "Ana Li Gómez"]) {
      const r = buildRedactor({ nombre, documento: "1.023.456.789" }, true);
      const redacted = r.redact(
        `La paciente ${nombre}, cédula 1023456789, consulta por dolor.`,
      );
      expect(redacted).toBe(
        `La paciente ${PLACEHOLDER_PACIENTE}, cédula ${PLACEHOLDER_DOCUMENTO}, consulta por dolor.`,
      );
      expect(r.redact(r.rehydrate(redacted))).toBe(redacted);
    }
  });
});

describe("rehydrate", () => {
  it("restaura nombre y documento registrados; [NUMERO] queda intacto", () => {
    const r = redactor();
    expect(
      r.rehydrate(`${PLACEHOLDER_PACIENTE}, doc ${PLACEHOLDER_DOCUMENTO}, tel ${PLACEHOLDER_NUMERO}`),
    ).toBe(`${IDENTITY.nombre}, doc ${IDENTITY.documento}, tel ${PLACEHOLDER_NUMERO}`);
  });

  it("sin identidad es la función identidad", () => {
    const r = buildRedactor(null, true);
    expect(r.hasIdentity).toBe(false);
    const text = `${PLACEHOLDER_PACIENTE} y ${PLACEHOLDER_DOCUMENTO}`;
    expect(r.rehydrate(text)).toBe(text);
  });
});

describe("sin paciente asociado", () => {
  it("solo tapa números; el texto con nombres queda igual", () => {
    const r = buildRedactor(null, true);
    expect(r.redact("José Pérez, cédula 1023456789")).toBe(
      `José Pérez, cédula ${PLACEHOLDER_NUMERO}`,
    );
  });
});

describe("transformNoteStrings y notas", () => {
  function makeNote(): ClinicalNoteJson {
    return {
      summary: "José consulta por cefalea.",
      sections: [
        {
          key: "jose",
          label: "Motivo",
          content: "José refiere dolor desde ayer",
          confidence: 0.9,
          evidence: "dice José que le duele",
        },
      ],
      discharge: {
        plan: {
          medications: [
            { name: "Dolhex Forte 50 mg", instructions: "José debe tomarlo cada 8 horas" },
          ],
          non_pharmacological: [],
          follow_up: [{ text: "Control en 8 días" }],
        },
        recommendations: [{ text: "Reposo para José" }],
        alarm_signs: [{ text: "Fiebre persistente", urgency: "priority" }],
      },
      warnings: ["Verificar alergias de José"],
      missing_required_sections: ["jose"],
    };
  }

  it("redactNote tapa todos los strings menos los identificadores", () => {
    const r = redactor();
    const out = r.redactNote(makeNote());
    expect(out.summary).toBe(`${PLACEHOLDER_PACIENTE} consulta por cefalea.`);
    expect(out.sections[0].content).toBe(
      `${PLACEHOLDER_PACIENTE} refiere dolor desde ayer`,
    );
    expect(out.sections[0].evidence).toBe(
      `dice ${PLACEHOLDER_PACIENTE} que le duele`,
    );
    expect(out.discharge?.plan.medications[0].instructions).toBe(
      `${PLACEHOLDER_PACIENTE} debe tomarlo cada 8 horas`,
    );
    expect(out.discharge?.recommendations[0].text).toBe(
      `Reposo para ${PLACEHOLDER_PACIENTE}`,
    );
    expect(out.warnings[0]).toBe(`Verificar alergias de ${PLACEHOLDER_PACIENTE}`);
    // Identificadores estructurales intactos aunque contengan el token.
    expect(out.sections[0].key).toBe("jose");
    expect(out.missing_required_sections).toEqual(["jose"]);
    // Campos no-string intactos.
    expect(out.sections[0].confidence).toBe(0.9);
  });

  it("rehydrateNote invierte redactNote para la vista del médico", () => {
    const r = redactor();
    const round = r.rehydrateNote(r.redactNote(makeNote()));
    expect(round.summary).toBe(
      `${IDENTITY.nombre} consulta por cefalea.`,
    );
    expect(round.sections[0].key).toBe("jose");
  });

  it("devuelve la misma referencia si nada cambió", () => {
    const note = makeNote();
    const untouched = transformNoteStrings(note, (text) => text);
    expect(untouched).toBe(note);

    const clean: ClinicalNoteJson = {
      summary: "Paciente estable.",
      sections: [],
      warnings: [],
      missing_required_sections: [],
    };
    const r = redactor();
    expect(r.redactNote(clean)).toBe(clean);
    expect(r.rehydrateNote(clean)).toBe(clean);
  });
});
