// GATE del contrato de exportación a historia clínica.
//
// Miracle Notes firma la nota calculando un hash del contenido; Graph re-verifica
// ese mismo hash antes de mandar la nota al HIS. Si las dos serializaciones se
// separan (orden de claves, unicode, undefined vs null), o todas las
// exportaciones se rechazan, o —peor— se acepta contenido distinto al firmado.
//
// Este test y su gemelo en Graph (`scripts/verify-note-signature-hash.js`) leen
// EL MISMO vector, byte a byte idéntico en los dos repos:
//   tests/fixtures/signature-hash-vector.json
//
// Si este test falla tras un cambio de serialización: los hashes de las notas ya
// firmadas dejan de verificar. No es un test que se "arregle" actualizando el
// vector — eso requiere migración de datos.
import { describe, expect, it } from "vitest";
import {
  canonicalSignaturePayload,
  computeSignatureHash,
  signatureHashMatches,
  type SignedConsultationContent,
} from "@/lib/clinical/signature-hash";
import vector from "./fixtures/signature-hash-vector.json";

interface VectorCase {
  name: string;
  consultation: SignedConsultationContent;
  expected_hash: string;
}

const cases = vector.cases as unknown as VectorCase[];

describe("vector compartido del hash de la firma (Notes ↔ Graph)", () => {
  it("el vector trae casos y declara el algoritmo del contrato", () => {
    expect(cases.length).toBeGreaterThan(0);
    expect(vector.algorithm).toBe("sha256");
    expect(vector.serialization).toBe("JSON.stringify({ note, resumen, codigos })");
  });

  it.each(cases.map((c) => [c.name, c] as const))(
    "reproduce el hash esperado — %s",
    (_name, testCase) => {
      expect(computeSignatureHash(testCase.consultation)).toBe(testCase.expected_hash);
    },
  );

  it("todos los hashes del vector son sha256 hex minúsculas y distintos entre sí", () => {
    const hashes = cases.map((c) => c.expected_hash);
    for (const hash of hashes) expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});

describe("serialización canónica", () => {
  it("fija el orden de claves del contrato: note, resumen, codigos", () => {
    expect(canonicalSignaturePayload({ note: 1, resumen: 2, codigos: 3 })).toBe(
      '{"note":1,"resumen":2,"codigos":3}',
    );
  });

  it("es insensible al orden en que llegan las claves del objeto de entrada", () => {
    const alReves = { codigos: [], resumen: "x", note: [] } as SignedConsultationContent;
    const enOrden = { note: [], resumen: "x", codigos: [] } as SignedConsultationContent;
    expect(computeSignatureHash(alReves)).toBe(computeSignatureHash(enOrden));
  });

  it("normaliza undefined a null (columna ausente == NULL de Postgres)", () => {
    // Sin esta normalización JSON.stringify borraría la clave y el hash
    // cambiaría en silencio respecto al que calculó la firma.
    expect(canonicalSignaturePayload({ note: [], resumen: undefined, codigos: [] })).toBe(
      '{"note":[],"resumen":null,"codigos":[]}',
    );
    expect(computeSignatureHash({ note: [], resumen: undefined, codigos: [] })).toBe(
      computeSignatureHash({ note: [], resumen: null, codigos: [] }),
    );
  });

  it("distingue resumen null de cadena vacía", () => {
    expect(computeSignatureHash({ note: [], resumen: null, codigos: [] })).not.toBe(
      computeSignatureHash({ note: [], resumen: "", codigos: [] }),
    );
  });

  it("cambia si cambia cualquiera de los tres campos firmados", () => {
    const base: SignedConsultationContent = {
      note: [{ key: "plan", content: "reposo" }],
      resumen: "r",
      codigos: [{ code: "I10" }],
    };
    const original = computeSignatureHash(base);
    expect(computeSignatureHash({ ...base, note: [{ key: "plan", content: "reposo " }] })).not.toBe(original);
    expect(computeSignatureHash({ ...base, resumen: "r2" })).not.toBe(original);
    expect(computeSignatureHash({ ...base, codigos: [{ code: "I11" }] })).not.toBe(original);
  });
});

describe("signatureHashMatches", () => {
  const content: SignedConsultationContent = { note: [], resumen: "x", codigos: [] };
  const hash = computeSignatureHash(content);

  it("acepta el hash correcto, incluso en mayúsculas o con espacios", () => {
    expect(signatureHashMatches(content, hash)).toBe(true);
    expect(signatureHashMatches(content, hash.toUpperCase())).toBe(true);
    expect(signatureHashMatches(content, `  ${hash}  `)).toBe(true);
  });

  it("rechaza contenido alterado", () => {
    expect(signatureHashMatches({ ...content, resumen: "y" }, hash)).toBe(false);
  });

  it('"sin hash" nunca cuenta como verificado', () => {
    expect(signatureHashMatches(content, "")).toBe(false);
    expect(signatureHashMatches(content, null)).toBe(false);
    expect(signatureHashMatches(content, undefined)).toBe(false);
    expect(signatureHashMatches(content, 12345)).toBe(false);
  });
});
