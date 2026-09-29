import Image from "next/image";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";

type Impact = {
  /** Ruta de la foto (retrato). Reemplace el archivo con el mismo nombre. */
  img: string;
  /** Texto alternativo de la foto. */
  alt: string;
  title: string;
  text: string;
};

/**
 * Tarjetas de impacto con foto de médico arriba + titular y descripción.
 * Copy verdadero de Miracle (editable). Las fotos son locales en /public/images;
 * reemplácelas con el mismo nombre para no tocar código.
 */
const items: Impact[] = [
  {
    img: "/images/impacto-1.jpg",
    alt: "Dos médicos revisando un caso frente a una pantalla en el hospital.",
    title: "Menos carga administrativa.",
    text: "Hasta 2 horas menos de documentación al día, por médico.",
  },
  {
    img: "/images/impacto-2.jpg",
    alt: "Médico revisando la nota clínica en su portátil.",
    title: "Codificación asistida.",
    text: "CIE-10 y CUPS sugeridos en cada consulta, siempre con revisión médica.",
  },
  {
    img: "/images/impacto-3.jpg",
    alt: "Profesional de salud pensando junto a su portátil.",
    title: "Sin cambiar de sistema.",
    text: "Funciona sobre el sistema que su institución ya usa, sin migraciones.",
  },
  {
    img: "/images/impacto-4.jpg",
    alt: "Directivo clínico recorriendo el hospital con su portátil.",
    title: "Visibilidad de datos.",
    text: "Mejores decisiones con datos clínicos y operativos de cada nota.",
  },
];

export function ImpactStats() {
  return (
    <div>
      <div className="mx-auto max-w-2xl text-center">
        <span className="eyebrow">Resultados</span>
        <h2 className="mt-4 text-3xl font-semibold text-deep md:text-[2.6rem]">
          Impacto medible y comprobado
        </h2>
      </div>

      <RevealGroup className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <RevealItem key={it.title}>
            <article className="h-full overflow-hidden rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-md)]">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-ice">
                <Image
                  src={it.img}
                  alt={it.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover"
                />
              </div>
              <div className="px-2 py-5">
                <h3 className="text-lg font-semibold text-deep">{it.title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">
                  {it.text}
                </p>
              </div>
            </article>
          </RevealItem>
        ))}
      </RevealGroup>
    </div>
  );
}
