"use client";

import { useState } from "react";
import { Check, FileText, Lock, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SERVICIOS } from "@/lib/mock";
import { letterheadLines, type OrgSettings } from "@/lib/hospital/org";
import { updateOrgSettings } from "./actions";

const inputClass =
  "w-full rounded-md border border-line bg-field px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent";

/**
 * Configuración institucional.
 *
 * Criterio de lo que se puede ajustar aquí: cosas que le AHORRAN trabajo al
 * médico (que su nota salga con el membrete correcto sin que él escriba nada) o
 * que la institución necesita por norma. Nada que limite su juicio clínico —
 * ni plantillas obligatorias, ni visto bueno para firmar, ni cuotas.
 *
 * Los campos del encabezado se editan con vista previa en vivo: es el documento
 * que termina en la historia clínica del paciente, y escribir a ciegas un dato
 * que se imprime en un papel legal es pedir un error.
 */
export function ConfiguracionForm({ initial }: { initial: OrgSettings }) {
  const [useHospitalTemplates, setUseHospitalTemplates] = useState(
    initial.useHospitalTemplates,
  );

  // Estado local solo de lo que alimenta la vista previa del membrete.
  const [name, setName] = useState(initial.name);
  const [nit, setNit] = useState(initial.nit ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [city, setCity] = useState(initial.city ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");

  const preview = letterheadLines({
    ...initial,
    name,
    nit: nit.trim() || null,
    address: address.trim() || null,
    city: city.trim() || null,
    phone: phone.trim() || null,
  });

  return (
    <form action={updateOrgSettings} className="space-y-5">
      {/* Los toggles se envían como campos ocultos sincronizados con el estado. */}
      <input
        type="hidden"
        name="use_hospital_templates"
        value={String(useHospitalTemplates)}
      />

      <Card>
        <h2 className="font-display text-base font-semibold text-deep">
          Identidad de la institución
        </h2>
        <p className="mt-1 text-sm text-muted">
          Estos datos encabezan la nota clínica y el informe de patología que
          imprimen tus médicos.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo label="Nombre" hint="Como debe aparecer en el documento">
            <input
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </Campo>
          <Campo label="NIT">
            <input
              name="nit"
              value={nit}
              onChange={(e) => setNit(e.target.value)}
              placeholder="890900000-1"
              className={inputClass}
            />
          </Campo>
          <Campo label="Dirección">
            <input
              name="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Calle 10 #40-20"
              className={inputClass}
            />
          </Campo>
          <Campo label="Ciudad">
            <input
              name="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Medellín"
              className={inputClass}
            />
          </Campo>
          <Campo label="Teléfono">
            <input
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="604 000 0000"
              className={inputClass}
            />
          </Campo>
        </div>

        {/* Vista previa: exactamente las líneas que imprime letterheadLines(). */}
        <div className="mt-5 rounded-md border border-line bg-pearl p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <FileText size={13} /> Así encabeza el documento
          </p>
          <p className="text-[13px] font-bold uppercase tracking-wide text-deep">
            {name.trim() || "Nombre de la institución"}
          </p>
          {preview.length ? (
            <p className="mt-0.5 text-xs text-muted">{preview.join(" · ")}</p>
          ) : (
            <p className="mt-0.5 text-xs text-muted">
              Completa NIT, dirección o teléfono para que aparezcan aquí.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-base font-semibold text-deep">
          Valores por defecto
        </h2>
        <p className="mt-1 text-sm text-muted">
          Lo que la institución rellena por el médico para que él no tenga que
          hacerlo en cada consulta.
        </p>

        <div className="mt-4 space-y-4">
          <Campo
            label="Servicios de la institución"
            hint="Separados por coma. El primero es el que traen las consultas nuevas. Vacío = usar la lista estándar."
          >
            <input
              name="servicios"
              defaultValue={(initial.servicios ?? []).join(", ")}
              placeholder={SERVICIOS.join(", ")}
              className={inputClass}
            />
          </Campo>

          <Campo
            label="Etiqueta de responsable"
            hint="Aparece en el bloque de firma de la nota impresa. Si un profesional tiene su propio cargo cargado, manda el suyo."
          >
            <input
              name="default_responsable_label"
              defaultValue={initial.defaultResponsableLabel ?? ""}
              placeholder="Médico tratante"
              className={inputClass}
            />
          </Campo>

          <SettingRow
            title="Usar formatos internos del hospital"
            desc="Prioriza las plantillas propias de la institución sobre las de Miracle."
          >
            <Toggle
              checked={useHospitalTemplates}
              onChange={setUseHospitalTemplates}
              ariaLabel="Usar formatos internos del hospital"
            />
          </SettingRow>
        </div>
      </Card>

      {/* Esto NO son ajustes: son propiedades del producto que el admin no puede
          cambiar. Van aparte y sin controles, para que la pantalla no aparente
          ofrecer una decisión que no existe. Antes vivían en una tarjeta
          "Seguridad" junto a los toggles reales, con un candado por control. */}
      <Card>
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-deep">
          <ShieldCheck size={17} className="text-success" /> Garantías del producto
        </h2>
        <p className="mt-1 text-sm text-muted">
          No se configuran: aplican siempre, en todas las instituciones.
        </p>
        <ul className="mt-4 space-y-2.5">
          <Garantia texto="Los datos de la institución no se usan para entrenar modelos." />
          <Garantia texto="Toda nota requiere revisión y aprobación de un profesional antes de firmarse." />
          <Garantia texto="Cada acción sobre una nota queda registrada en la auditoría." />
        </ul>
      </Card>

      <Card>
        <h2 className="font-display text-base font-semibold text-deep">Integraciones</h2>
        <div className="mt-4 space-y-3">
          <IntegrationRow name="Exportación a PDF" estado="activa" />
          <IntegrationRow name="Copiar nota al portapapeles" estado="activa" />
          {/* Antes esta fila tenía un botón "Conectar" que solo mostraba un
              toast diciendo que se habilita en el piloto. Un botón que no
              conecta nada no debería existir. */}
          <IntegrationRow
            name="Sistema de historia clínica (HIS/HCE)"
            estado="piloto"
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          <Check size={16} /> Guardar cambios
        </button>
      </div>
    </form>
  );
}

function Campo({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-deep">{label}</label>
      {children}
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function Garantia({ texto }: { texto: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-ink-soft">
      <Lock size={14} className="mt-0.5 shrink-0 text-success" />
      <span>{texto}</span>
    </li>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "bg-accent" : "bg-mist"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function SettingRow({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
      <div>
        <div className="text-sm font-medium text-deep">{title}</div>
        <div className="text-xs text-muted">{desc}</div>
      </div>
      {children}
    </div>
  );
}

function IntegrationRow({
  name,
  estado,
}: {
  name: string;
  estado: "activa" | "piloto";
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-line px-4 py-3">
      <span className="text-sm font-medium text-deep">{name}</span>
      {estado === "activa" ? (
        <Badge tone="success">Activa</Badge>
      ) : (
        <span className="text-xs text-muted">Se habilita durante el piloto</span>
      )}
    </div>
  );
}
