// Hash del contenido firmado de una nota clínica — ÚNICA definición en Notes.
//
// Ata la firma a una versión concreta de la nota: se calcula al firmar
// (`app/app/consultas/actions.ts`) y se re-verifica en Graph al exportar a la
// historia clínica, sobre la versión realmente firmada leída de `consultations`.
//
// CONTRATO COMPARTIDO CON GRAPH — no cambiar de un lado solamente.
//   sha256(JSON.stringify({ note, resumen, codigos }))
// Ese orden de claves es parte del contrato. La implementación espejo vive en
// `Graph/src/application/use-cases/NoteSignatureHash.js` y las dos se validan
// contra el mismo vector: `tests/fixtures/signature-hash-vector.json` (copia
// idéntica en los dos repos). Si esto cambia, los hashes de las notas ya
// firmadas dejan de verificar: cualquier cambio necesita migración de datos.
//
// Server-only (usa node:crypto): lo importan la server action de firma y los
// tests, nunca un componente de cliente.

import { createHash } from "node:crypto";

/**
 * Las tres columnas de `consultations` que cubre la firma, tal como las
 * devuelve PostgREST: `note` y `codigos` son jsonb ya parseado, `resumen` es
 * text (puede ser null).
 */
export interface SignedConsultationContent {
  note: unknown;
  resumen: unknown;
  codigos: unknown;
}

/**
 * Serialización canónica del contenido firmado.
 *
 * Una columna ausente se normaliza a `null` porque es lo que PostgREST devuelve
 * para un NULL de Postgres. Sin esta normalización un `undefined` desaparecería
 * del JSON (`JSON.stringify` omite las claves undefined) y el hash cambiaría
 * silenciosamente respecto al que calculó la firma.
 */
export function canonicalSignaturePayload(content: SignedConsultationContent): string {
  return JSON.stringify({
    note: content.note === undefined ? null : content.note,
    resumen: content.resumen === undefined ? null : content.resumen,
    codigos: content.codigos === undefined ? null : content.codigos,
  });
}

/** SHA-256 en hex minúsculas del contenido firmado. */
export function computeSignatureHash(content: SignedConsultationContent): string {
  return createHash("sha256").update(canonicalSignaturePayload(content)).digest("hex");
}

/**
 * Compara un hash guardado con el recalculado, tolerando mayúsculas/minúsculas
 * y espacios. Devuelve false si el hash guardado no existe: "sin hash" nunca
 * cuenta como "verificado".
 */
export function signatureHashMatches(
  content: SignedConsultationContent,
  storedHash: unknown,
): boolean {
  const stored = typeof storedHash === "string" ? storedHash.trim().toLowerCase() : "";
  if (!stored) return false;
  return stored === computeSignatureHash(content);
}
