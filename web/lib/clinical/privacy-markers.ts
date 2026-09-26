/**
 * Marcadores de privacidad que quedaron SIN resolver dentro de una nota.
 *
 * Antes de enviar texto a la IA, Graph reemplaza los identificadores del
 * paciente por marcadores («[PACIENTE_NOMBRE_1]», «[DOCUMENTO_1]») y los
 * devuelve al volver la respuesta. Si el modelo deforma un marcador o inventa
 * uno que la llamada no emitió, Graph lo deja visible, lo cuenta y la nota
 * trae un aviso — pero hasta el 2026-09-26 nada impedía FIRMARLA así, y una
 * historia clínica firmada con «[PACIENTE_NOMBRE_1]» en lugar del nombre es
 * un documento roto que además viaja al sistema del hospital.
 *
 * La gramática es la misma que acepta Graph (src/domain/privacy/tokens.js):
 * con corchetes, tolerante (mayúsculas o no, formas cortas y sinónimos); sin
 * corchetes, solo la forma exacta en mayúsculas con guion bajo, para que la
 * prosa «el documento 1 dice» nunca cuente como marcador.
 */

const TIPOS = [
  "PACIENTE[ _-]?NOMBRE",
  "NOMBRE[ _-]?(?:DEL[ _-]?)?PACIENTE",
  "PATIENT[ _-]?NAME",
  "PACIENTE",
  "PATIENT",
  "NOMBRE",
  "NAME",
  "DOCUMENTO",
  "DOCUMENT(?:[ _-]?NUMBER)?",
  "ID[ _-]?DOCUMENT",
  "C[ÉE]DULA",
  "DOC",
  "TEL[ÉE]FONO",
  "PHONE(?:[ _-]?NUMBER)?",
  "TELEPHONE",
  "CELULAR",
  "CEL",
  "M[ÓO]VIL",
  "TEL",
  "CORREO",
  "E[ _-]?MAIL",
  "DIRECCI[ÓO]N",
  "ADDRESS",
  "DIR",
  "N[ÚU]MERO",
  "NUMBER",
  "NUM",
].join("|");

const CON_CORCHETES = new RegExp(
  `\\[\\s*(?:${TIPOS})[ _-]?0*\\d{1,4}(?:[ _.-]0*\\d{1,3})?\\s*\\]`,
  "giu",
);

const SIN_CORCHETES =
  /(?<![\p{L}\p{N}_[])(?:PACIENTE_NOMBRE|DOCUMENTO|TELEFONO|CORREO|DIRECCION|NUMERO)_\d{1,4}(?:_\d{1,3})?(?![\p{L}\p{N}_\]])/gu;

/** Los marcadores de un texto, tal como aparecen, en orden. */
export function findPrivacyMarkers(text: string | null | undefined): string[] {
  const input = `${text ?? ""}`;
  if (!input) return [];
  const encontrados: { at: number; raw: string }[] = [];
  for (const re of [CON_CORCHETES, SIN_CORCHETES]) {
    re.lastIndex = 0;
    for (const match of input.matchAll(re)) {
      encontrados.push({ at: match.index ?? 0, raw: match[0] });
    }
  }
  return encontrados.sort((a, b) => a.at - b.at).map((m) => m.raw);
}

/** Lo que se firma de una nota: el texto y las listas de cada sección, y el resumen. */
export function privacyMarkersInNote(
  note: ReadonlyArray<{ texto?: string | null; items?: ReadonlyArray<string> | null }> | null | undefined,
  resumen?: string | null,
): string[] {
  const textos: string[] = [];
  for (const seccion of Array.isArray(note) ? note : []) {
    if (typeof seccion?.texto === "string") textos.push(seccion.texto);
    for (const item of seccion?.items ?? []) {
      if (typeof item === "string") textos.push(item);
    }
  }
  if (typeof resumen === "string") textos.push(resumen);
  return textos.flatMap((texto) => findPrivacyMarkers(texto));
}
