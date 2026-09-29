import Image from "next/image";

type FigureProps = {
  src: string;
  alt: string;
  /** Relación de aspecto CSS, p. ej. "3 / 2" o "4 / 3". */
  aspect?: string;
  /** Pie de foto opcional (se muestra debajo, discreto). */
  caption?: string;
  className?: string;
  /** Prioriza la carga (solo para imágenes visibles al cargar la página). */
  priority?: boolean;
};

/**
 * Imagen editorial con marco premium (radios generosos + sombra), optimizada
 * con next/image. Pensada para fotos locales en /public/images.
 * Reemplace el archivo con el mismo nombre para cambiar la imagen sin tocar código.
 */
export function Figure({
  src,
  alt,
  aspect = "3 / 2",
  caption,
  className = "",
  priority = false,
}: FigureProps) {
  return (
    <figure className={className}>
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-line/60 shadow-[var(--shadow-lg)]"
        style={{ aspectRatio: aspect }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
          priority={priority}
        />
      </div>
      {caption ? (
        <figcaption className="mt-3 text-center text-xs text-muted">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
