"use client";

import { useState } from "react";
import { Check, Link2, Lock } from "lucide-react";
import { useStore } from "@/app/app/providers";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent";

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
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

export default function ConfiguracionPage() {
  const { showToast } = useStore();
  const [requireConsent, setRequireConsent] = useState(true);
  const [useHospitalTemplates, setUseHospitalTemplates] = useState(true);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-deep">
        Configuración institucional
      </h1>
      <p className="text-sm text-muted">
        Ajustes de la institución, consentimiento, formatos e integraciones.
      </p>

      <div className="mt-6 space-y-5">
        <Card>
          <h2 className="font-display text-base font-semibold text-deep">
            Institución
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-deep">
                Nombre
              </label>
              <input className={inputClass} defaultValue="Hospital de ejemplo" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-deep">
                NIT
              </label>
              <input className={inputClass} defaultValue="900.xxx.xxx-x" />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-base font-semibold text-deep">
            Consentimiento y plantillas
          </h2>
          <div className="mt-4 space-y-4">
            <SettingRow
              title="Requerir consentimiento del paciente"
              desc="Solicitar confirmación antes de iniciar la captura."
            >
              <Toggle checked={requireConsent} onChange={setRequireConsent} />
            </SettingRow>
            <SettingRow
              title="Usar formatos internos del hospital"
              desc="Priorizar las plantillas propias de la institución."
            >
              <Toggle
                checked={useHospitalTemplates}
                onChange={setUseHospitalTemplates}
              />
            </SettingRow>
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-base font-semibold text-deep">
            Integraciones
          </h2>
          <div className="mt-4 space-y-3">
            <IntegrationRow
              name="Sistema de historia clínica (HIS/HCE)"
              status="no"
              onConnect={() =>
                showToast("La conexión con el HIS se habilita durante el piloto.", "info")
              }
            />
            <IntegrationRow name="Exportación a PDF" status="ok" />
            <IntegrationRow name="Copiar al portapapeles" status="ok" />
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-base font-semibold text-deep">
            Seguridad
          </h2>
          <div className="mt-4 space-y-4">
            <SettingRow
              title="No entrenar modelos con datos de la institución"
              desc="Principio de diseño del producto."
            >
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                <Lock size={14} /> Activado
              </span>
            </SettingRow>
            <SettingRow
              title="Revisión humana obligatoria"
              desc="Toda nota requiere aprobación médica."
            >
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                <Lock size={14} /> Activado
              </span>
            </SettingRow>
          </div>
        </Card>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => showToast("Configuración guardada.", "success")}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            <Check size={16} /> Guardar cambios
          </button>
        </div>
      </div>
    </div>
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
    <div className="flex items-center justify-between gap-4">
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
  status,
  onConnect,
}: {
  name: string;
  status: "ok" | "no";
  onConnect?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-line px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-ice text-accent">
          <Link2 size={16} />
        </span>
        <span className="text-sm font-medium text-deep">{name}</span>
      </div>
      {status === "ok" ? (
        <Badge tone="success">Activo</Badge>
      ) : (
        <button
          type="button"
          onClick={onConnect}
          className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-deep hover:border-mist"
        >
          Conectar
        </button>
      )}
    </div>
  );
}
