/**
 * Imprimir los papeles de una consulta YA guardada (detalle y panel rápido).
 *
 * Las secciones salen del espejo `consultations` —es lo que el médico corrigió
 * en el detalle web—, pero el plan y el egreso no viven ahí: se piden al
 * backend clínico al imprimir. Sin ellos la nota sale igual (sin plan) y la
 * fórmula y las indicaciones dicen que no pudieron leerse, en vez de salir
 * vacías como si la consulta no tuviera plan.
 */

import { getClinicalEncounter, type ClinicalDischarge } from "@/lib/api/clinical";
import { responsableLabelDe, type OrgSettings } from "@/lib/hospital/org";
import type { Consultation, Patient } from "@/lib/mock";
import { construirDocumento, type TipoDeDocumento } from "./patient-documents";
import { abrirVentanaDeImpresion, horaLocal, imprimirEn } from "./patient-documents-html";

export interface DatosParaImprimir {
  consultation: Consultation;
  patient?: Patient;
  identidad: { nombre?: string | null; documento?: string | null };
  medicoNombre?: string | null;
  medicoIdentidad?: {
    identificationNumber: string | null;
    professionalRegistration: string | null;
    honorific?: string | null;
    responsableLabel?: string | null;
  } | null;
  org: OrgSettings;
  demo: boolean;
  addenda?: readonly { autor: string; fecha: string; contenido: string }[];
}

export async function imprimirDeLaConsulta(
  tipo: TipoDeDocumento,
  datos: DatosParaImprimir,
  avisar: (mensaje: string) => void,
): Promise<void> {
  const w = abrirVentanaDeImpresion();
  if (!w) {
    avisar("Permita las ventanas emergentes para generar el PDF.");
    return;
  }
  const c = datos.consultation;
  let discharge: ClinicalDischarge | null = null;
  try {
    discharge = (await getClinicalEncounter(c.id)).note_json?.discharge ?? null;
  } catch {
    discharge = null;
  }
  if (!discharge && tipo !== "nota") {
    w.close();
    avisar("No se pudo leer el plan de esta consulta. Revisa la conexión e inténtalo de nuevo.");
    return;
  }
  const doc = construirDocumento({
    tipo,
    fecha: horaLocal(c.fecha),
    org: datos.org,
    medico: {
      nombre: datos.medicoNombre,
      documento: datos.medicoIdentidad?.identificationNumber,
      registro: datos.medicoIdentidad?.professionalRegistration,
      especialidad: c.especialidad,
      honorifico: datos.medicoIdentidad?.honorific,
      responsable: responsableLabelDe(datos.org, datos.medicoIdentidad?.responsableLabel),
    },
    paciente: {
      nombre: datos.identidad.nombre,
      documento: datos.identidad.documento,
      edad: datos.patient?.edad,
      sexo: datos.patient?.sexo,
      eps: datos.patient?.eps,
    },
    nota: {
      summary: c.resumen,
      sections: c.note.map((s) => ({
        label: s.titulo,
        content: s.kind === "lista" && s.items?.length ? s.items.map((i) => `• ${i}`).join("\n") : s.texto,
      })),
      discharge,
    },
    codigos: c.codigos.filter((k) => k.estado === "aceptado"),
    adendas: datos.addenda,
    demo: datos.demo,
  });
  imprimirEn(w, doc);
}
