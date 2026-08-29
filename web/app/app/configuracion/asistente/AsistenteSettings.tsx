"use client";

import Link from "next/link";
import { useStore } from "@/app/app/providers";
import { useUserPreferences } from "@/lib/preferences/client";
import type { AssistantAddress, AssistantDetail } from "@/lib/preferences/types";
import { ChoiceGroup, SettingCard, SettingRow, Toggle, type Opcion } from "../ui";

const TRATOS: readonly Opcion<AssistantAddress>[] = [
  { value: "usted", label: "De usted" },
  { value: "tu", label: "De tú" },
];

const DETALLES: readonly Opcion<AssistantDetail>[] = [
  {
    value: "breve",
    label: "Al grano",
    desc: "La respuesta más corta que resuelva la pregunta.",
  },
  {
    value: "equilibrado",
    label: "Equilibrado",
    desc: "Responde directo y se extiende solo cuando el caso lo pide.",
  },
  {
    value: "detallado",
    label: "Detallado",
    desc: "Siempre desglosa qué se sabe, qué falta confirmar y el siguiente paso.",
  },
];

export function AsistenteSettings() {
  const { preferences, firstName, update } = useUserPreferences();
  const { showToast } = useStore();

  async function guardar(patch: Parameters<typeof update>[0]) {
    const ok = await update(patch);
    if (!ok) showToast("No se pudo guardar la preferencia.", "warning");
  }

  return (
    <>
      <SettingCard
        title="Cómo te habla"
        description="Se aplica al asistente clínico y a las explicaciones que te da al ajustar una nota."
      >
        <ChoiceGroup
          label="Tratamiento"
          value={preferences.assistantAddress}
          options={TRATOS}
          onChange={(v) => void guardar({ assistantAddress: v })}
          columns={3}
        />

        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-deep">Nivel de detalle</p>
          <ChoiceGroup
            label="Nivel de detalle de las respuestas"
            value={preferences.assistantDetail}
            options={DETALLES}
            onChange={(v) => void guardar({ assistantDetail: v })}
          />
        </div>
      </SettingCard>

      <SettingCard title="Tu nombre">
        <SettingRow
          first
          title="Que me llame por mi nombre"
          desc={
            firstName ? (
              <>
                De vez en cuando, cuando venga a cuento: «{firstName}, la
                enfermedad actual ya quedó actualizada». Nunca en cada respuesta.
              </>
            ) : (
              <>
                Primero necesitas cargar tu nombre en{" "}
                <Link
                  href="/app/configuracion/cuenta"
                  className="font-semibold text-accent hover:underline"
                >
                  Cuenta
                </Link>
                .
              </>
            )
          }
        >
          <Toggle
            checked={preferences.assistantUseName && !!firstName}
            disabled={!firstName}
            onChange={(v) => void guardar({ assistantUseName: v })}
            ariaLabel="Que el asistente me llame por mi nombre"
          />
        </SettingRow>
      </SettingCard>

      {/* Lo que el asistente sabe de ti, dicho sin rodeos. No es un ajuste: es
          la respuesta a "¿qué le están contando de mí?", que es justo lo que uno
          se pregunta al ver estas casillas. */}
      <SettingCard
        title="Qué sabe el asistente de ti"
        description="Además de tu pregunta y de la consulta abierta, esto es todo lo que recibe."
      >
        <ul className="space-y-2 text-sm text-ink-soft">
          <li className="flex items-start gap-2">
            <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mist" />
            Tu especialidad, para razonar desde ella.
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mist" />
            {preferences.assistantUseName && firstName
              ? `Tu nombre de pila (${firstName}).`
              : "Tu nombre, solo si activas la casilla de arriba."}
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mist" />
            Las dos preferencias de esta pantalla.
          </li>
        </ul>
      </SettingCard>
    </>
  );
}
