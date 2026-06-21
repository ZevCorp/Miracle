// Modelo de datos de la plataforma Miracle (demo con datos ficticios).

import { APP_ROLE_LABEL, type AppRole } from "@/lib/auth/roles";

export type Role = AppRole;

export type ConsultationStatus =
  | "en_curso"
  | "borrador"
  | "revisada"
  | "aprobada"
  | "exportada";

export type ConsultationType = "presencial" | "telemedicina" | "audio";

export interface Patient {
  id: string;
  nombre: string;
  documento: string; // "CC 1.0xx.xxx.xxx"
  edad: number;
  sexo: "F" | "M";
  eps: string;
  telefono: string;
  antecedentes: string[];
  alergias: string[];
  medicamentos: string[];
}

export interface Doctor {
  id: string;
  nombre: string;
  especialidad: string;
  rol: Role;
  iniciales: string;
}

export type SectionKind = "texto" | "lista";

export interface NoteSection {
  id: string;
  titulo: string;
  kind: SectionKind;
  texto?: string;
  items?: string[];
  /** Secciones colapsadas por defecto cuando son secundarias. */
  colapsadaPorDefecto?: boolean;
}

export interface SpeakerTurn {
  t: string; // "00:42"
  hablante: "Médico" | "Paciente";
  texto: string;
}

export type CodeSystem = "CIE-10" | "CUPS";
export type CodeStatus = "sugerido" | "aceptado" | "descartado";

export interface ClinicalCode {
  id: string;
  sistema: CodeSystem;
  codigo: string;
  descripcion: string;
  confianza: number; // 0-100
  estado: CodeStatus;
}

export interface AuditEvent {
  id: string;
  fecha: string; // ISO
  actor: string;
  accion: string;
  detalle?: string;
}

export interface Consultation {
  id: string;
  pacienteId: string;
  medicoId: string;
  servicio: string;
  especialidad: string;
  tipo: ConsultationType;
  estado: ConsultationStatus;
  fecha: string; // ISO
  duracionMin: number;
  plantilla: string;
  motivo: string;
  note: NoteSection[];
  transcript: SpeakerTurn[];
  resumen: string;
  codigos: ClinicalCode[];
  auditoria: AuditEvent[];
}

export interface Template {
  id: string;
  nombre: string;
  especialidad: string;
  creadaPor: string;
  predeterminada?: boolean;
  secciones: string[];
  actualizada: string;
}

export const STATUS_LABEL: Record<ConsultationStatus, string> = {
  en_curso: "En curso",
  borrador: "Borrador",
  revisada: "Revisada",
  aprobada: "Aprobada",
  exportada: "Exportada",
};

export const TYPE_LABEL: Record<ConsultationType, string> = {
  presencial: "Presencial",
  telemedicina: "Telemedicina",
  audio: "Audio cargado",
};

export const ROLE_LABEL: Record<Role, string> = APP_ROLE_LABEL;
