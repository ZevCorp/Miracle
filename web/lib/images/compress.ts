// Reducir una foto en el NAVEGADOR antes de mandarla a un modelo de visión.
//
// Vive aquí y no dentro de una pantalla porque ya son dos las que fotografían
// papel: el informe de patología desde la hoja de trabajo y la plantilla que el
// médico ya usa. Las dos tienen el mismo problema —una foto de teléfono pesa
// más que el body que acepta la plataforma— y la misma solución.
//
// Recomprime por PESO, no solo por dimensión: baja la calidad y, si aún no
// alcanza, reescala. El presupuesto se pasa en CARACTERES del data URL, que es
// la magnitud que de verdad limita el body (el alfabeto base64 no necesita
// escape JSON, así que un carácter es un byte de petición).

/** Rechazo temprano del archivo fuente, antes de recomprimir. Una foto de más
 *  de 15 MB casi nunca es legible y no vale la pena procesarla. */
export const MAX_SOURCE_IMAGE_BYTES = 15 * 1024 * 1024;

/** Formatos que aceptan los modelos de visión que usamos. GIF animado no. */
export const IMAGE_MIME_OK: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** ~4.2 MB de caracteres ≈ 3.15 MB binarios: el presupuesto de una sola foto. */
export const DEFAULT_MAX_DATAURL_CHARS = 4_200_000;

/** Lado mayor tras el primer reescalado, si no se pide otro. */
export const DEFAULT_MAX_EDGE = 2200;

export interface CompressImageOptions {
  /** Tope del data URL resultante, EN CARACTERES (= bytes de body). */
  maxChars?: number;
  /** Lado mayor tras el primer reescalado. */
  maxEdge?: number;
}

/**
 * Reduce la foto a un JPEG que quepa bajo `maxChars`, recomprimiendo por PESO:
 * baja la calidad y, si aún no alcanza, reescala hasta lograrlo. Lanza si no se
 * puede.
 */
export function fileToDataUrl(
  file: File,
  options: CompressImageOptions = {},
): Promise<string> {
  const maxChars = options.maxChars ?? DEFAULT_MAX_DATAURL_CHARS;
  const maxEdge = options.maxEdge ?? DEFAULT_MAX_EDGE;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.onload = () => {
      const original = String(reader.result ?? "");
      const img = new Image();
      img.onload = () => {
        try {
          // Si el original ya cabe y es un formato liviano, no lo re-procesa.
          if (original.length <= maxChars && file.type === "image/jpeg") {
            resolve(original);
            return;
          }
          let width = img.width;
          let height = img.height;
          const firstScale = Math.min(1, maxEdge / Math.max(width, height));
          width = Math.round(width * firstScale);
          height = Math.round(height * firstScale);

          const encode = (w: number, h: number, quality: number): string | null => {
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) return null;
            ctx.drawImage(img, 0, 0, w, h);
            return canvas.toDataURL("image/jpeg", quality);
          };

          const qualities = [0.85, 0.7, 0.55];
          for (let iteration = 0; iteration < 6; iteration += 1) {
            for (const quality of qualities) {
              const out = encode(width, height, quality);
              if (out && out.length <= maxChars) {
                resolve(out);
                return;
              }
            }
            // Ninguna calidad bastó a este tamaño: reduce dimensiones y repite.
            width = Math.round(width * 0.8);
            height = Math.round(height * 0.8);
            if (width < 400 || height < 400) break;
          }
          reject(
            new Error(
              "La imagen no se pudo reducir lo suficiente. Toma la foto con menos resolución.",
            ),
          );
        } catch {
          reject(new Error("No se pudo procesar la imagen."));
        }
      };
      img.onerror = () => reject(new Error("No se pudo abrir la imagen."));
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
}
