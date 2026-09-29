// Leer los archivos de texto que el médico ya tiene en su computador.
//
// TODO PASA EN EL NAVEGADOR. El archivo no se sube a ningún servidor ni se
// guarda en Miracle: se extrae el texto en la pestaña y solo se persiste lo que
// el médico revisa y decide guardar. Es la misma promesa que ya hacen la agenda
// desde foto y la nota desde foto, y aquí vale igual: son documentos suyos.
//
// EL RESULTADO ES TEXTO PLANO. La nota clínica es texto plano de punta a punta
// (editor, note_json, PDF), así que no hay dónde renderizar negrilla ni tablas.
// Se conserva lo que sí sobrevive: párrafos, saltos de línea y viñetas escritas
// como "- ".

export const MAX_SNIPPET_FILE_BYTES = 2 * 1024 * 1024;
/** Tope de archivos por importación. Ver SnippetImportDialog. */
export const MAX_IMPORT_FILES = 200;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const ACCEPTED_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  DOCX_MIME,
]);

const ACCEPTED_EXTENSIONS = /\.(txt|md|markdown|docx)$/i;

/** Para el atributo accept del input file. */
export const SNIPPET_FILE_ACCEPT = ".txt,.md,.markdown,.docx";

/** Mensaje en español, o null si el archivo se puede leer. */
export function validateSnippetFile(
  file: Pick<File, "name" | "size" | "type">,
): string | null {
  if (!file.size) return "El archivo está vacío.";
  if (file.size > MAX_SNIPPET_FILE_BYTES) {
    return "El archivo supera 2 MB. Los atajos son textos cortos.";
  }
  // Antes del rechazo genérico: al médico con un .doc de hace quince años hay
  // que decirle qué hacer, no solo que no sirve.
  if (/\.doc$/i.test(file.name) || file.type === "application/msword") {
    return "Los .doc antiguos no se pueden leer. Ábrelo en Word y guárdalo como .docx.";
  }
  // El tipo MIME llega vacío en muchos sistemas; la extensión decide entonces.
  if (
    !ACCEPTED_TYPES.has(file.type.toLowerCase()) &&
    !ACCEPTED_EXTENSIONS.test(file.name)
  ) {
    return "Formato no compatible. Usa un archivo .txt, .md o .docx de Word.";
  }
  return null;
}

function isDocx(file: Pick<File, "name" | "type">): boolean {
  return file.type.toLowerCase() === DOCX_MIME || /\.docx$/i.test(file.name);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith("#")) {
      const number = code[1] === "x" || code[1] === "X"
        ? Number.parseInt(code.slice(2), 16)
        : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Limpieza final común a todas las fuentes. */
function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * HTML de mammoth → texto plano con la estructura que sí cabe en la nota.
 *
 * Se usa convertToHtml y no extractRawText a propósito: el raw devuelve los
 * puntos de una lista como líneas sueltas, sin marcador, y una lista de
 * indicaciones deja de leerse como lista. Aquí cada <li> se convierte en "- ".
 * Las celdas de tabla quedan separadas por tabulación: se pierde la rejilla,
 * pero no el dato.
 */
export function htmlToSnippetText(html: string): string {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/(?:p|div|h[1-6]|tr|ul|ol|table)>/gi, "\n\n")
    .replace(/<\/t[dh]>/gi, "\t")
    .replace(/<[^>]*>/g, "");
  return tidy(decodeEntities(text)).replace(/\t\n/g, "\n");
}

/**
 * Título de partida a partir del nombre del archivo. El médico lo revisa
 * siempre antes de guardar; esto solo evita empezar con el campo vacío.
 */
export function filenameToTitle(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return "Texto importado";
  return base.charAt(0).toLocaleUpperCase("es") + base.slice(1);
}

type MammothLike = {
  convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
};

/**
 * Texto de un archivo del computador del médico.
 *
 * mammoth solo se carga si de verdad hay un .docx: pesa bastante y no tiene por
 * qué entrar en el bundle de quien nunca abre un Word.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const invalid = validateSnippetFile(file);
  if (invalid) throw new Error(invalid);

  if (!isDocx(file)) return tidy(await file.text());

  const loaded = (await import("mammoth")) as unknown as MammothLike & {
    default?: MammothLike;
  };
  const mammoth = loaded.default ?? loaded;
  const { value } = await mammoth.convertToHtml({
    arrayBuffer: await file.arrayBuffer(),
  });
  return htmlToSnippetText(value);
}
