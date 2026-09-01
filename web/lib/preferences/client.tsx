"use client";

// Un solo lugar en el cliente que sabe las preferencias del médico.
//
// Va en un Context sembrado desde el servidor (app/app/layout.tsx) y no en un
// fetch por pantalla porque lo consultan sitios muy repartidos —el chat del
// asistente, el panel de dictado, /consultas/nueva y el lanzador rápido— y
// porque un fetch en cada uno significaría que la primera pintada usa valores
// por defecto y luego salta al valor real: el médico vería su plantilla
// cambiar sola bajo el cursor.
//
// `update()` es optimista: la pantalla de Configuración ya reflejó el cambio
// cuando la escritura sale, y si Supabase la rechaza se revierte y se avisa.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  PREFERENCIAS_POR_DEFECTO,
  nombreDePila,
  type UserPreferences,
} from "./types";

export interface PreferencesValue {
  preferences: UserPreferences;
  /** Nombre de pila del médico, o null si no hay nombre cargado. */
  firstName: string | null;
  /**
   * Especialidad del perfil. No es una preferencia, pero viaja aquí porque es
   * la otra mitad del contexto que recibe el asistente y el chat se monta en
   * dos sitios distintos (el shell y la consulta en vivo). Repartirla por props
   * significaría pasarla por toda la cadena hasta el segundo punto de montaje.
   */
  specialtyCode: string | null;
  /** true mientras hay una escritura en vuelo. */
  saving: boolean;
  /**
   * Guarda un cambio parcial. Resuelve `true` si quedó persistido.
   * Ante error revierte el estado local: la pantalla nunca debe mostrar como
   * guardado algo que la base rechazó.
   */
  update: (patch: Partial<UserPreferences>) => Promise<boolean>;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

/** Preferencias -> columnas. Solo se envía lo que cambió. */
function patchToRow(patch: Partial<UserPreferences>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.templateStartMode !== undefined) row.template_start_mode = patch.templateStartMode;
  if (patch.defaultServicio !== undefined) row.default_servicio = patch.defaultServicio;
  if (patch.assistantAddress !== undefined) row.assistant_address = patch.assistantAddress;
  if (patch.assistantDetail !== undefined) row.assistant_detail = patch.assistantDetail;
  if (patch.assistantUseName !== undefined) row.assistant_use_name = patch.assistantUseName;
  if (patch.noteDetail !== undefined) row.note_detail = patch.noteDetail;
  return row;
}

export function PreferencesProvider({
  children,
  initial,
  fullName,
  specialtyCode = null,
}: {
  children: ReactNode;
  initial: UserPreferences;
  fullName?: string | null;
  specialtyCode?: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [preferences, setPreferences] = useState<UserPreferences>(initial);
  // Un contador y no un booleano: con dos escrituras en vuelo, la primera en
  // terminar apagaba el indicador y la pantalla decía "guardado" mientras la
  // otra seguía viajando.
  const [escrituras, setEscrituras] = useState(0);
  // Espejo sincrono del estado, para poder leer el valor previo sin depender
  // del calendario de renders de React.
  const vigenteRef = useRef<UserPreferences>(initial);

  const firstName = useMemo(() => nombreDePila(fullName), [fullName]);

  const update = useCallback(
    async (patch: Partial<UserPreferences>): Promise<boolean> => {
      // Forma funcional y NO una copia de `preferences` del closure. Dos
      // escrituras seguidas —cambiar el trato y acto seguido el detalle— son
      // normales en esta pantalla, y con el closure la segunda partía del
      // estado viejo y borraba la primera.
      //
      // Del rollback se guardan SOLO las claves de este patch: revertir el
      // objeto entero hacía que, si una escritura fallaba mientras otra había
      // ido bien, la fallida deshiciera en pantalla un cambio que sí estaba
      // guardado en la base. La pantalla acababa mintiendo sobre lo guardado.
      //
      // El valor previo se lee del espejo (`vigenteRef`) y no dentro del
      // updater: ahí dependería de cuándo React decida ejecutarlo, y si aún no
      // hubiera corrido al fallar la escritura, el rollback quedaría vacío y la
      // pantalla se quedaría enseñando como guardado algo que la base rechazó.
      const anterior: Partial<UserPreferences> = {};
      for (const clave of Object.keys(patch) as (keyof UserPreferences)[]) {
        Object.assign(anterior, { [clave]: vigenteRef.current[clave] });
      }
      setPreferences((actual) => {
        const siguiente = { ...actual, ...patch };
        vigenteRef.current = siguiente;
        return siguiente;
      });
      setEscrituras((n) => n + 1);
      try {
        // upsert y no update: la fila no existe hasta que el médico toca su
        // primera preferencia. `user_id` lo pone el DEFAULT auth.uid() de la
        // tabla, así que no hace falta pedirle la sesión al cliente.
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) throw new Error("Sesión no disponible");

        const { error } = await supabase
          .from("user_preferences")
          .upsert(
            { user_id: userId, ...patchToRow(patch), updated_at: new Date().toISOString() },
            { onConflict: "user_id" },
          );
        if (error) throw error;
        return true;
      } catch (e) {
        console.error("[preferences] no se pudo guardar", e);
        setPreferences((actual) => {
          const revertido = { ...actual, ...anterior };
          vigenteRef.current = revertido;
          return revertido;
        });
        return false;
      } finally {
        setEscrituras((n) => n - 1);
      }
    },
    [supabase],
  );

  const value = useMemo<PreferencesValue>(
    () => ({ preferences, firstName, specialtyCode, saving: escrituras > 0, update }),
    [preferences, firstName, specialtyCode, escrituras, update],
  );

  return (
    <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
  );
}

/**
 * Preferencias del médico. Fuera del provider devuelve los valores por defecto
 * en vez de lanzar: hay componentes (el chat, el panel de dictado) que también
 * se montan en pantallas fuera de /app, y una preferencia ausente debe degradar
 * al comportamiento de siempre, no tumbar la pantalla.
 */
export function useUserPreferences(): PreferencesValue {
  const ctx = useContext(PreferencesContext);
  return (
    ctx ?? {
      preferences: PREFERENCIAS_POR_DEFECTO,
      firstName: null,
      specialtyCode: null,
      saving: false,
      update: async () => false,
    }
  );
}
