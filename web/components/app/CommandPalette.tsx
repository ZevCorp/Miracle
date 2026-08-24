"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, FileText, Plus, Search, User, type LucideIcon } from "lucide-react";
import { useStore } from "@/app/app/providers";
import { useNavigationGuard } from "@/components/app/UnsavedChangesProvider";
import { NAV_ICONS, NAV_ICON_FALLBACK } from "@/components/app/nav-icons";
import { STATUS_BAR } from "@/components/app/StatusBadge";
import { extractPatientIdentity } from "@/lib/clinical/patient-identity";
import { matchesQuery } from "@/lib/clinical/search";
import { formatFechaRelativa } from "@/lib/dates";
import { STATUS_LABEL, type ConsultationStatus } from "@/lib/mock";
import { visibleAppNav } from "@/lib/site";

type Item = {
  id: string;
  label: string;
  hint?: string;
  /** Texto corto alineado a la derecha (fecha de la consulta). */
  meta?: string;
  /** Punto del color del estado, solo en consultas. */
  estado?: ConsultationStatus;
  href: string;
  icon: LucideIcon;
};

type Grupo = { titulo: string; items: Item[] };

/** Cuántos resultados por grupo. Más que esto y la lista deja de ser un atajo. */
const TOPE_POR_GRUPO = 5;

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const { patients, consultations, getPatient, role, isDemo, orgKind, professionalType } =
    useStore();
  const { guardedNavigate } = useNavigationGuard();
  const [query, setQuery] = useState("");
  const [activoPedido, setActivo] = useState(0);
  const listaRef = useRef<HTMLDivElement>(null);

  const closePalette = useCallback(() => {
    setQuery("");
    setActivo(0);
    onOpenChange(false);
  }, [onOpenChange]);

  // Atajo global Cmd/Ctrl+K y cierre con Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) closePalette();
        else onOpenChange(true);
      } else if (e.key === "Escape" && open) {
        closePalette();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closePalette, open, onOpenChange]);

  /**
   * Identidad de cada consulta, calculada UNA vez por apertura (o cuando cambian
   * los datos), no en cada tecla.
   *
   * `extractPatientIdentity` recorre las secciones de la nota, y el store guarda
   * hasta 300 consultas: hacerlo dentro del memo de la búsqueda significaba 300
   * recorridos por pulsación, justo en la pantalla que debe sentirse instantánea.
   */
  const indiceConsultas = useMemo(
    () =>
      open
        ? consultations.map((c) => {
            // El nombre casi nunca está en `patients`: la consulta no obliga a
            // asociar un paciente registrado. Se cae a lo que diga la nota,
            // igual que hacen las tarjetas de la lista.
            const identidad = extractPatientIdentity(c.note);
            return {
              c,
              nombre: getPatient(c.pacienteId)?.nombre ?? identidad.nombre,
              documento: identidad.documento ?? "",
              rotulo:
                c.note.find((s) => s.id === "rotulo" || s.titulo === "Rótulo")?.texto ?? "",
            };
          })
        : [],
    [open, consultations, getPatient],
  );

  const grupos = useMemo<Grupo[]>(() => {
    const q = query.trim();

    // Ir a: las mismas secciones del menú lateral, filtradas por rol con la
    // función que ya aplica el proxy. Sin escribir nada no se muestran: quien
    // abre el buscador casi siempre viene a buscar un paciente, no a navegar.
    const navegacion: Item[] = q
      ? visibleAppNav(role, professionalType, isDemo, orgKind)
          .filter((item) => matchesQuery(item.label, q))
          .slice(0, TOPE_POR_GRUPO)
          .map((item) => ({
            id: `nav-${item.href}`,
            label: item.label,
            hint: "Ir a la sección",
            href: item.href,
            icon: NAV_ICONS[item.icon] ?? NAV_ICON_FALLBACK,
          }))
      : [];

    // "Nueva consulta" es exclusiva del médico: la secretaría (y cualquier rol
    // de solo lectura) no debe verla ni activarla desde acá.
    const acciones: Item[] =
      role === "medico" && (!q || matchesQuery("Nueva consulta", q))
        ? [
            {
              id: "nueva",
              label: "Nueva consulta",
              hint: "Iniciar captura",
              href: "/app/consultas/nueva",
              icon: Plus,
            },
          ]
        : [];

    const pac: Item[] = patients
      .filter((p) => !q || matchesQuery(`${p.nombre} ${p.documento}`, q))
      .slice(0, TOPE_POR_GRUPO)
      .map((p) => ({
        id: `pac-${p.id}`,
        label: p.nombre,
        // El documento es como se busca a una persona en Colombia: si existe,
        // se muestra aunque no haya edad registrada.
        hint: [p.edad > 0 ? `${p.edad} años` : null, p.documento || null]
          .filter(Boolean)
          .join(" · "),
        href: `/app/pacientes/${p.id}`,
        icon: User,
      }));

    const cons: Item[] = indiceConsultas
      .filter(
        ({ c, nombre, documento, rotulo }) =>
          !q || matchesQuery(`${nombre ?? ""} ${documento} ${c.motivo} ${rotulo}`, q),
      )
      .slice(0, TOPE_POR_GRUPO)
      .map(({ c, nombre, rotulo }) => ({
        id: `con-${c.id}`,
        label: nombre ?? "Paciente sin identificar",
        hint: [rotulo, c.motivo].filter(Boolean).join(" · "),
        meta: formatFechaRelativa(c.fecha),
        estado: c.estado,
        href: `/app/consultas/${c.id}`,
        icon: FileText,
      }));

    return [
      { titulo: "Acciones", items: acciones },
      { titulo: "Ir a", items: navegacion },
      { titulo: "Pacientes", items: pac },
      { titulo: "Consultas", items: cons },
    ].filter((g) => g.items.length > 0);
  }, [query, patients, indiceConsultas, role, isDemo, orgKind, professionalType]);

  // Lista plana: es sobre la que se mueven las flechas, atravesando los grupos.
  const planos = useMemo(() => grupos.flatMap((g) => g.items), [grupos]);

  // El resaltado se ACOTA al vuelo en vez de guardarse ya acotado: la lista se
  // encoge al teclear, y un índice guardado fuera de rango dejaría el Enter
  // apuntando a un resultado que ya no está en pantalla.
  const activo = planos.length ? Math.min(activoPedido, planos.length - 1) : 0;

  useEffect(() => {
    if (!open) return;
    listaRef.current
      ?.querySelector('[data-activo="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activo, open]);

  const go = useCallback(
    (href: string) => {
      guardedNavigate(() => {
        closePalette();
        router.push(href);
      });
    },
    [closePalette, guardedNavigate, router],
  );

  if (!open) return null;

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    // Se cuenta desde `activo` (el acotado), no desde el guardado: si la lista
    // se encogio al teclear, el guardado apunta fuera y la flecha saltaria a un
    // sitio que no es el que esta resaltado en pantalla.
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo(planos.length ? (activo + 1) % planos.length : 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo(planos.length ? (activo - 1 + planos.length) % planos.length : 0);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActivo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActivo(Math.max(0, planos.length - 1));
    } else if (e.key === "Enter") {
      const destino = planos[activo];
      if (destino) go(destino.href);
    }
  }

  let indice = -1;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-0 sm:p-4 sm:pt-[12vh]">
      <div
        className="absolute inset-0 bg-overlay backdrop-blur-sm"
        onClick={closePalette}
      />
      <div className="relative flex h-dvh w-full max-w-xl flex-col overflow-hidden bg-surface shadow-[var(--shadow-xl)] sm:h-auto sm:rounded-2xl sm:border sm:border-line">
        <div className="app-mobile-header flex items-center gap-2 border-b border-line px-4 sm:h-auto">
          <Search size={18} className="text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // Vuelve arriba: dejar el resaltado donde estaba lo pondría sobre
              // un resultado distinto del que el médico está viendo.
              setActivo(0);
            }}
            onKeyDown={alTeclear}
            role="combobox"
            aria-expanded
            aria-controls="paleta-resultados"
            aria-activedescendant={planos[activo]?.id}
            placeholder="Buscar paciente, cédula, consulta o sección…"
            className="w-full bg-transparent py-3.5 text-base outline-none placeholder:text-muted sm:text-sm"
          />
          <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-xs font-medium text-muted sm:block">
            ESC
          </kbd>
        </div>

        <div
          ref={listaRef}
          id="paleta-resultados"
          role="listbox"
          className="min-h-0 flex-1 overflow-y-auto p-2 sm:max-h-96"
        >
          {planos.length ? (
            grupos.map((grupo) => (
              <div key={grupo.titulo} className="mb-1 last:mb-0">
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {grupo.titulo}
                </p>
                {grupo.items.map((it) => {
                  const Icon = it.icon;
                  indice += 1;
                  const esActivo = indice === activo;
                  const posicion = indice;
                  return (
                    <button
                      key={it.id}
                      id={it.id}
                      type="button"
                      role="option"
                      aria-selected={esActivo}
                      data-activo={esActivo}
                      onMouseMove={() => setActivo(posicion)}
                      onClick={() => go(it.href)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        esActivo ? "bg-ice-soft" : ""
                      }`}
                    >
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ice text-accent">
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-deep">
                          {it.label}
                        </span>
                        {it.hint ? (
                          <span className="block truncate text-xs text-muted">
                            {it.hint}
                          </span>
                        ) : null}
                      </span>
                      {it.meta ? (
                        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                          {it.estado ? (
                            <span
                              title={STATUS_LABEL[it.estado]}
                              className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_BAR[it.estado]}`}
                            />
                          ) : null}
                          {it.meta}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          ) : (
            <p className="px-3 py-6 text-center text-sm text-muted">
              {query.trim()
                ? `Sin resultados para «${query.trim()}».`
                : "Escribe para buscar un paciente, una cédula o una consulta."}
            </p>
          )}
        </div>

        {/* Las teclas a la vista: es como se aprende que la lista se maneja sin
            soltar el teclado. */}
        <div className="hidden items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-muted sm:flex">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-line px-1 py-px font-semibold">↑</kbd>
            <kbd className="rounded border border-line px-1 py-px font-semibold">↓</kbd>
            moverse
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-line px-1 py-px font-semibold">
              <CornerDownLeft size={10} />
            </kbd>
            abrir
          </span>
          <span className="ml-auto">
            {planos.length} {planos.length === 1 ? "resultado" : "resultados"}
          </span>
        </div>
      </div>
    </div>
  );
}
