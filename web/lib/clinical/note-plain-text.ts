// La nota como texto plano: lo que copia «Copiar nota» y descarga el .txt.
//
// Vivía dentro de la pantalla en vivo (app/app/consultas/en-vivo/page.tsx) y por
// eso no se podía probar ni compartir. Sale aquí, pura, por la misma razón que
// note-review.ts: el cliente de Windows copia la nota con EXACTAMENTE este
// formato, y la única forma de que los dos no se separen es que haya un sitio
// del que sacar los casos de prueba (spec 055 del repo U-Windows-App).

import { ensureClinicalDischarge, type ClinicalNoteJson } from "@/lib/api/clinical";

/**
 * Secciones de la nota en el mismo orden y contenido que ven el "PDF
 * clínico" y el texto plano: una sola fuente de verdad para que copiar y
 * descargar coincidan siempre. Devolver {título, contenido} ya separados
 * (en vez de un texto plano que luego se re-parte por líneas en blanco)
 * evita que un salto de línea DENTRO de una sección (p. ej. una
 * descripción con varios párrafos) se confunda con el inicio de una
 * sección nueva y aparezca como un encabezado en negrilla espurio.
 */
export function noteSections(noteJson: ClinicalNoteJson): { title: string; content: string }[] {
  const discharge = ensureClinicalDischarge(noteJson.discharge);
  const plan = [
    ...discharge.plan.medications.map((item) =>
      [item.name, item.dose, item.route, item.frequency, item.duration, item.instructions]
        .filter(Boolean)
        .join(" · "),
    ),
    ...discharge.plan.non_pharmacological.map((item) => item.text),
    ...discharge.plan.follow_up.map((item) => item.text),
  ].filter(Boolean);
  return [
    { title: "Resumen", content: noteJson.summary.trim() || "Sin información documentada." },
    ...noteJson.sections.map((section) => ({
      title: section.label,
      content: section.content.trim() || "Sin información documentada.",
    })),
    { title: "Plan terapéutico", content: plan.join("\n") || "Sin información documentada." },
    {
      title: "Recomendaciones",
      content:
        discharge.recommendations.map((item) => item.text).join("\n") ||
        "Sin información documentada.",
    },
    {
      title: "Signos de alarma",
      content:
        discharge.alarm_signs.map((item) => item.text).join("\n") ||
        "Sin información documentada.",
    },
  ];
}

export function noteAsPlainText(noteJson: ClinicalNoteJson): string {
  return noteSections(noteJson)
    .map((section) => `${section.title}\n${section.content}`)
    .join("\n\n");
}
