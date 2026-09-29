"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Loader2,
  Plus,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { useStore } from "@/app/app/providers";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Avatar } from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/client";
import {
  TIPOS_DOCUMENTO,
  LIMITES,
  documentoKey,
  draftFromPatient,
  emptyPatientDraft,
  findDuplicates,
  formatDocumento,
  payloadFromDraft,
  validatePatientDraft,
  type DuplicateMatch,
  type PatientDraft,
} from "@/lib/clinical/patient-form";
import type { Patient } from "@/lib/mock/types";

/**
 * EL FORMULARIO DE PACIENTE, uno solo para toda la app.
 *
 * Antes crear un paciente era una casilla escondida dentro del diálogo de
 * asociación de la consulta en vivo —cuatro campos, sin validación, sin aviso
 * de duplicados— y el directorio de /app/pacientes no tenía forma de crear uno.
 * Se llegaba a la lista de pacientes solo de rebote, asociándolos a consultas.
 *
 * Ahora es una pieza compartida: el directorio, el paso previo a grabar, la
 * consulta en vivo y la ficha abren ESTE diálogo. Con `patient` edita; sin él,
 * crea.
 *
 * Lo que lo distingue de un formulario cualquiera:
 *
 *  - AVISA DE DUPLICADOS antes de guardar. Un mismo documento en dos fichas
 *    parte la historia de un paciente en dos, y eso no se nota hasta que
 *    alguien busca sus consultas anteriores y no están.
 *  - LAS ALERGIAS VAN PRIMERO en la historia clínica: es el dato que se mira
 *    antes de formular.
 *  - No inventa datos. Un campo vacío se guarda como ausente, no como cero ni
 *    como "Por registrar".
 */
export function PatientFormDialog({
  patient,
  initialNombre,
  initialDocumento,
  onClose,
  onSaved,
  onUseExisting,
}: {
  /** Presente = editar esa ficha. Ausente = crear una nueva. */
  patient?: Patient;
  /** Lo que el médico ya había tecleado en el buscador que no encontró nada. */
  initialNombre?: string;
  initialDocumento?: string;
  onClose: () => void;
  onSaved: (patient: Patient) => void;
  /** Si se ofrece, el aviso de duplicado puede resolverse eligiendo la ficha
   *  que ya existe en vez de crear otra. Los flujos que solo listan (el
   *  directorio) no lo pasan. */
  onUseExisting?: (patient: Patient) => void;
}) {
  const { patients, addPatientAsync, updatePatient, showToast } = useStore();
  const editando = Boolean(patient);

  const [draft, setDraft] = useState<PatientDraft>(() =>
    patient
      ? draftFromPatient(patient)
      : emptyPatientDraft({
          nombre: initialNombre?.trim(),
          documentoNumero: initialDocumento?.trim(),
        }),
  );
  const [historiaAbierta, setHistoriaAbierta] = useState(
    // Editando se abre si ya hay algo escrito: esconder datos existentes detrás
    // de un acordeón cerrado hace creer que se perdieron.
    Boolean(
      patient?.alergias.length ||
        patient?.antecedentes.length ||
        patient?.medicamentos.length,
    ),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** El número para el que el médico ya dijo "crear otra ficha igualmente".
   *  Se guarda el NÚMERO y no un booleano: cambiar el documento tiene que
   *  volver a armar el freno, porque el permiso era para otra persona. */
  const [forzadoPara, setForzadoPara] = useState<string | null>(null);
  /** Coincidencias traídas de la base, con el número al que corresponden: sin
   *  esa etiqueta, al cambiar de documento se seguirían mostrando las del
   *  anterior hasta que llegara la respuesta nueva. */
  const [remotos, setRemotos] = useState<{ clave: string; lista: Patient[] }>({
    clave: "",
    lista: [],
  });

  const set = <K extends keyof PatientDraft>(campo: K, valor: PatientDraft[K]) =>
    setDraft((previo) => ({ ...previo, [campo]: valor }));

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  /**
   * Duplicados MÁS ALLÁ del caché. El store carga los 500 pacientes más
   * recientes; en una institución con más, el que se está por duplicar puede
   * estar fuera. Se pregunta a la base por el número, sin separadores, en
   * cuanto hay algo que preguntar.
   */
  const numeroCanonico = documentoKey(
    formatDocumento(draft.documentoTipo, draft.documentoNumero),
  );
  useEffect(() => {
    // Menos de cuatro cifras no es una búsqueda, es el principio de un número.
    if (!numeroCanonico || numeroCanonico.length < 4) return;
    let vigente = true;
    const t = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("patients")
        .select("id, nombre, documento, edad, sexo, eps, telefono")
        // El número ya viene sin puntos ni guiones y solo alfanumérico, así que
        // no puede romper la sintaxis del filtro.
        .ilike("documento", `%${numeroCanonico}%`)
        .limit(5);
      if (!vigente) return;
      setRemotos({
        clave: numeroCanonico,
        lista: (data ?? []).map((r) => ({
          id: r.id as string,
          nombre: (r.nombre as string) ?? "",
          documento: (r.documento as string) ?? "",
          edad: (r.edad as number) ?? 0,
          sexo: (r.sexo as Patient["sexo"]) ?? null,
          eps: (r.eps as string) ?? "",
          telefono: (r.telefono as string) ?? "",
          antecedentes: [],
          alergias: [],
          medicamentos: [],
        })),
      });
    }, 350);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [numeroCanonico]);

  const duplicados = useMemo<DuplicateMatch[]>(() => {
    // Los del caché primero; los remotos rellenan lo que el caché no alcanzó, y
    // solo si son los de ESTE número.
    const vistos = new Set(patients.map((p) => p.id));
    const frescos =
      remotos.clave === numeroCanonico
        ? remotos.lista.filter((r) => !vistos.has(r.id))
        : [];
    return findDuplicates([...patients, ...frescos], draft, patient?.id);
  }, [patients, remotos, numeroCanonico, draft, patient?.id]);

  const duplicadoDuro = duplicados.find((d) => d.reason === "documento");
  const bloqueado =
    Boolean(duplicadoDuro) && forzadoPara !== numeroCanonico && !editando;

  async function guardar() {
    if (saving) return;
    const invalido = validatePatientDraft(draft);
    if (invalido) {
      setError(invalido);
      return;
    }
    if (bloqueado) {
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    const payload = payloadFromDraft(draft);

    const resultado = patient
      ? await updatePatient(patient.id, payload)
      : await addPatientAsync(payload);

    if (!resultado.ok) {
      setError(
        resultado.error ??
          "No se pudo guardar el paciente. Revisa tu conexión e intenta de nuevo.",
      );
      setSaving(false);
      return;
    }
    const guardado =
      resultado.patient ?? ({ ...(patient as Patient), ...payload } as Patient);
    showToast(
      editando ? "Ficha actualizada." : `${guardado.nombre} quedó registrado.`,
      "success",
    );
    onSaved(guardado);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-overlay p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar"
        onClick={() => !saving && onClose()}
        className="absolute inset-0 cursor-default"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-form-title"
        className="mobile-bottom-sheet relative flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-3xl border border-b-0 border-line bg-surface shadow-[var(--shadow-xl)] sm:rounded-[24px] sm:border-b"
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              {editando ? <UserRound size={18} /> : <UserPlus size={18} />}
            </span>
            <div className="min-w-0">
              <h2
                id="patient-form-title"
                className="font-display text-lg font-semibold text-deep"
              >
                {editando ? "Editar ficha" : "Nuevo paciente"}
              </h2>
              <p className="mt-0.5 truncate text-sm text-muted">
                {editando
                  ? patient?.nombre
                  : "Solo el nombre es obligatorio. Lo demás se completa cuando lo sepas."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-ice-soft hover:text-deep"
          >
            <X size={18} />
          </button>
        </div>

        {/* Campos */}
        <form
          id="patient-form"
          onSubmit={(event) => {
            event.preventDefault();
            void guardar();
          }}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6"
        >
          <Campo label="Nombre completo" requerido>
            <input
              value={draft.nombre}
              onChange={(event) => set("nombre", event.target.value)}
              maxLength={LIMITES.nombre}
              placeholder="Ej. María Fernanda Restrepo"
              autoFocus
              autoComplete="off"
              className="clinical-control w-full px-3"
            />
          </Campo>

          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
            <Campo label="Tipo de documento">
              <div className="clinical-control relative flex items-center">
                <select
                  value={draft.documentoTipo}
                  onChange={(event) => set("documentoTipo", event.target.value)}
                  className="w-full appearance-none bg-transparent px-3 py-2.5 text-sm outline-none"
                >
                  <option value="">Sin especificar</option>
                  {TIPOS_DOCUMENTO.map((tipo) => (
                    <option key={tipo.sigla} value={tipo.sigla}>
                      {tipo.sigla} · {tipo.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={15}
                  aria-hidden
                  className="pointer-events-none absolute right-3 text-muted"
                />
              </div>
            </Campo>
            <Campo
              label="Número"
              ayuda="Sin puntos ni guiones: así se compara con la nota."
            >
              <input
                value={draft.documentoNumero}
                onChange={(event) => set("documentoNumero", event.target.value)}
                inputMode="text"
                autoComplete="off"
                placeholder="1023456789"
                className="data clinical-control w-full px-3 tracking-[0.02em]"
              />
            </Campo>
          </div>

          {/* El aviso va JUNTO al documento, no al pie: es ahí donde se decide
              si esta persona ya estaba registrada. */}
          {duplicados.length ? (
            <AvisoDuplicados
              duplicados={duplicados}
              editando={editando}
              onUseExisting={onUseExisting}
              onBeforeNavigate={onClose}
            />
          ) : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Campo label="Edad">
              <input
                value={draft.edad}
                onChange={(event) =>
                  set("edad", event.target.value.replace(/[^0-9]/g, "").slice(0, 3))
                }
                inputMode="numeric"
                placeholder="—"
                className="data clinical-control w-full px-3"
              />
            </Campo>
            <Campo label="Sexo">
              <div className="seg grid grid-cols-3">
                {(
                  [
                    ["", "Sin registrar"],
                    ["F", "Femenino"],
                    ["M", "Masculino"],
                  ] as const
                ).map(([valor, etiqueta]) => (
                  <button
                    key={etiqueta}
                    type="button"
                    onClick={() => set("sexo", valor)}
                    aria-pressed={draft.sexo === valor}
                    className="seg-item min-w-0"
                  >
                    <span className="truncate">{etiqueta}</span>
                  </button>
                ))}
              </div>
            </Campo>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Campo label="EPS o asegurador">
              <input
                value={draft.eps}
                onChange={(event) => set("eps", event.target.value)}
                maxLength={LIMITES.eps}
                placeholder="—"
                autoComplete="off"
                className="clinical-control w-full px-3"
              />
            </Campo>
            <Campo label="Teléfono">
              <input
                value={draft.telefono}
                onChange={(event) => set("telefono", event.target.value)}
                maxLength={LIMITES.telefono}
                inputMode="tel"
                placeholder="—"
                autoComplete="off"
                className="data clinical-control w-full px-3"
              />
            </Campo>
          </div>

          {/* Historia clínica: plegada por defecto en el alta. Pedir doce campos
              para registrar a alguien que está entrando al consultorio es la
              forma más segura de que nadie registre a nadie. */}
          <button
            type="button"
            onClick={() => setHistoriaAbierta((abierto) => !abierto)}
            aria-expanded={historiaAbierta}
            className="mt-5 flex w-full items-center gap-2 border-t border-line pt-4 text-left"
          >
            <ChevronDown
              size={15}
              aria-hidden
              className={`shrink-0 text-muted transition-transform ${
                historiaAbierta ? "" : "-rotate-90"
              }`}
            />
            <span className="doc-label">Historia clínica</span>
            <span aria-hidden className="h-px min-w-4 flex-1 bg-line" />
            <span className="text-[12px] text-muted">
              {historiaAbierta ? "Ocultar" : "Opcional"}
            </span>
          </button>

          {historiaAbierta ? (
            <div className="mt-4 space-y-4">
              <ListaField
                label="Alergias"
                ayuda="Lo primero que se mira antes de formular."
                destacado
                valores={draft.alergias}
                onChange={(v) => set("alergias", v)}
                placeholder="Penicilina"
              />
              <ListaField
                label="Antecedentes"
                valores={draft.antecedentes}
                onChange={(v) => set("antecedentes", v)}
                placeholder="Hipertensión arterial"
              />
              <ListaField
                label="Medicamentos"
                valores={draft.medicamentos}
                onChange={(v) => set("medicamentos", v)}
                placeholder="Losartán 50 mg"
              />
            </div>
          ) : null}

          {error ? (
            <AlertBanner tone="danger" className="mt-5">
              {error}
            </AlertBanner>
          ) : null}
        </form>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="clinical-tertiary px-4"
          >
            Cancelar
          </button>
          {bloqueado ? (
            <button
              type="button"
              onClick={() => setForzadoPara(numeroCanonico)}
              className="clinical-secondary px-4"
            >
              Crear otra ficha igualmente
            </button>
          ) : (
            <button
              type="submit"
              form="patient-form"
              disabled={saving || !draft.nombre.trim()}
              className="clinical-primary px-5"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : editando ? (
                <Check size={16} />
              ) : (
                <UserPlus size={16} />
              )}
              {editando ? "Guardar cambios" : "Crear paciente"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Piezas internas                                                     */
/* ------------------------------------------------------------------ */

function Campo({
  label,
  ayuda,
  requerido,
  children,
}: {
  label: string;
  ayuda?: string;
  requerido?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline gap-1.5">
        <span className="text-sm font-semibold text-deep">{label}</span>
        {requerido ? (
          <span className="text-[11px] font-medium text-muted">obligatorio</span>
        ) : null}
      </span>
      <span className="mt-1.5 block">{children}</span>
      {ayuda ? <span className="mt-1 block text-[12px] text-muted">{ayuda}</span> : null}
    </label>
  );
}

/**
 * Aviso de que esta persona quizá ya está registrada.
 *
 * Por documento es identidad —dos fichas con la misma cédula son un error— y se
 * dice en tono de fallo. Por nombre es indicio: hay dos Juan Carlos Gómez, y
 * tratarlo como error impediría registrar al segundo.
 */
function AvisoDuplicados({
  duplicados,
  editando,
  onUseExisting,
  onBeforeNavigate,
}: {
  duplicados: DuplicateMatch[];
  editando: boolean;
  onUseExisting?: (patient: Patient) => void;
  onBeforeNavigate: () => void;
}) {
  const duro = duplicados.some((d) => d.reason === "documento");
  return (
    <AlertBanner
      tone={duro ? "warning" : "info"}
      title={
        duro
          ? "Ese documento ya está en una ficha"
          : "Hay alguien registrado con ese mismo nombre"
      }
      className="mt-4"
    >
      <p>
        {duro
          ? editando
            ? "Otra ficha usa este número. Revisa cuál es la correcta antes de guardar."
            : "Crear otra ficha partiría su historia en dos."
          : "Puede ser otra persona: confirma el documento antes de seguir."}
      </p>
      <ul className="mt-2 space-y-1.5">
        {duplicados.map(({ patient, reason }) => (
          <li
            key={patient.id}
            className="flex flex-wrap items-center gap-2 rounded-[10px] bg-surface/70 px-2.5 py-2"
          >
            <Avatar name={patient.nombre} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-deep">
                {patient.nombre}
              </span>
              <span className="data block truncate text-[12px] text-muted">
                {patient.documento || "Documento pendiente"}
                <span className="font-sans">
                  {reason === "nombre" ? " · coincide el nombre" : ""}
                </span>
              </span>
            </span>
            {onUseExisting ? (
              <button
                type="button"
                onClick={() => onUseExisting(patient)}
                className="clinical-secondary min-h-9 px-3 text-[13px]"
              >
                Usar esta ficha
              </button>
            ) : (
              <Link
                href={`/app/pacientes/${patient.id}`}
                onClick={onBeforeNavigate}
                className="clinical-secondary min-h-9 px-3 text-[13px]"
              >
                Abrir <ArrowUpRight size={13} />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </AlertBanner>
  );
}

/**
 * Lista de términos (alergias, antecedentes, medicamentos) como fichas.
 *
 * Enter o coma añaden; retroceso con el campo vacío borra la última. Se guarda
 * como text[] —que es como la base los tiene— y no como un párrafo, porque
 * "penicilina" tiene que poder buscarse y resaltarse por separado.
 */
function ListaField({
  label,
  ayuda,
  valores,
  onChange,
  placeholder,
  destacado = false,
}: {
  label: string;
  ayuda?: string;
  valores: string[];
  onChange: (siguiente: string[]) => void;
  placeholder: string;
  /** Las alergias se pintan en rojo: no son un dato más. */
  destacado?: boolean;
}) {
  const [texto, setTexto] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function anadir(bruto: string) {
    const nuevos = bruto
      .split(",")
      .map((v) => v.trim().slice(0, LIMITES.item))
      .filter(Boolean)
      .filter((v) => !valores.some((y) => y.toLowerCase() === v.toLowerCase()));
    if (nuevos.length) onChange([...valores, ...nuevos].slice(0, LIMITES.items));
    setTexto("");
  }

  return (
    <div>
      <span className="flex items-baseline gap-2">
        <span
          className={`text-sm font-semibold ${destacado ? "text-danger" : "text-deep"}`}
        >
          {label}
        </span>
        {ayuda ? <span className="text-[12px] text-muted">{ayuda}</span> : null}
      </span>
      <div
        onClick={() => inputRef.current?.focus()}
        className="clinical-control mt-1.5 flex flex-wrap items-center gap-1.5 px-2 py-1.5"
      >
        {valores.map((valor) => (
          <span
            key={valor}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium ${
              destacado
                ? "bg-danger-soft text-danger-ink"
                : "bg-ice text-accent-ink"
            }`}
          >
            {valor}
            <button
              type="button"
              onClick={() => onChange(valores.filter((v) => v !== valor))}
              aria-label={`Quitar ${valor}`}
              className="rounded-full p-0.5 opacity-70 transition-opacity hover:opacity-100"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={texto}
          onChange={(event) => {
            // La coma cierra la ficha en el momento: es como se dicta una lista.
            if (event.target.value.includes(",")) anadir(event.target.value);
            else setTexto(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              // Sin esto, Enter enviaría el formulario y crearía el paciente a
              // medio escribir.
              event.preventDefault();
              anadir(texto);
            } else if (event.key === "Backspace" && !texto && valores.length) {
              onChange(valores.slice(0, -1));
            }
          }}
          onBlur={() => anadir(texto)}
          placeholder={valores.length ? "" : placeholder}
          aria-label={label}
          className="min-w-[8rem] flex-1 bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted"
        />
        {texto.trim() ? (
          <button
            type="button"
            onClick={() => anadir(texto)}
            aria-label={`Añadir ${texto.trim()}`}
            className="rounded-full p-1 text-accent transition-colors hover:bg-accent-soft"
          >
            <Plus size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
