"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { PatientFormDialog } from "@/components/app/PatientFormDialog";
import type { Patient } from "@/lib/mock/types";

/**
 * "Nuevo paciente": el disparador del alta, allí donde tenga sentido pedirla.
 *
 * Existe como pieza aparte del diálogo porque el directorio de pacientes es un
 * componente de SERVIDOR —la lista se pagina en la base— y necesita una isla de
 * cliente mínima para abrirlo, tanto en la cabecera como dentro del vacío.
 *
 * Al guardar se abre la ficha del recién creado. Quedarse en el directorio
 * obligaba a buscarlo para comprobar que sí quedó, y la ficha es justo donde
 * sigue el trabajo: completar antecedentes o iniciar su consulta. El
 * `router.refresh()` previo es para la vuelta: la lista la arma una consulta
 * paginada en el servidor, que no sabe nada del store.
 */
export function NewPatientButton({
  label = "Nuevo paciente",
  variant = "clinical-primary",
  className = "",
  /** Texto ya tecleado en el buscador, para no hacerlo escribir dos veces. */
  initialNombre,
  autoOpen = false,
  onCreated,
}: {
  label?: string;
  variant?: "clinical-primary" | "clinical-secondary" | "clinical-tertiary";
  className?: string;
  initialNombre?: string;
  /** Abre el formulario ya de entrada: es lo que hace `/app/pacientes?nuevo=1`,
   *  la URL con la que la paleta de comandos registra a alguien desde cualquier
   *  pantalla. */
  autoOpen?: boolean;
  onCreated?: (patient: Patient) => void;
}) {
  const router = useRouter();
  // Estado inicial, no un efecto: abrirlo después del primer render haría
  // parpadear la lista antes del diálogo.
  const [abierto, setAbierto] = useState(autoOpen);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={`${variant} ${className}`}
      >
        <UserPlus size={16} /> {label}
      </button>

      {abierto ? (
        <PatientFormDialog
          initialNombre={initialNombre}
          onClose={() => {
            setAbierto(false);
            // Se quita `?nuevo=1` al cerrar: si no, recargar o volver atrás
            // reabriría el formulario sin que nadie lo pidiera.
            if (autoOpen) router.replace("/app/pacientes");
          }}
          onSaved={(patient) => {
            setAbierto(false);
            if (onCreated) {
              onCreated(patient);
              return;
            }
            router.refresh();
            router.push(`/app/pacientes/${patient.id}`);
          }}
        />
      ) : null}
    </>
  );
}
