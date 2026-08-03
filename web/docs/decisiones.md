# Decisiones clave — Miracle (web)

Registro de las decisiones importantes y **por qué** se tomaron. Útil para no re-discutir
lo ya decidido.

## D1 · Multi-tenant: "todos pertenecen a una organización"
**Decisión:** cada usuario pertenece a UNA organización. B2C = organización personal de una
persona; B2B = hospital con varios. Todo lo clínico cuelga de la organización.
**Por qué:** un solo modelo sirve para B2C y B2B (no hay dos caminos en el código); aislar por
organización es limpio en RLS; la mensualidad futura se cobra por organización; subir de B2C a
B2B es solo cambiar de org.

## D2 · Roles: médico / supervisor / admin (visibilidad)
**Decisión:** el **médico ve solo lo suyo**; **supervisor y admin ven todo lo de su org**.
Pacientes **privados del médico** (no compartidos en el hospital), por ahora.
**Por qué:** lo pidió el usuario; refleja la jerarquía real de un hospital sin sobre-exponer.
**Nota:** NO existe super-admin de plataforma ni flujo de "invitar miembros" (huecos del B2B).

## D3 · Nota/códigos/transcripción como JSONB (no tablas separadas)
**Decisión:** guardar `note`, `codigos`, `transcript` como columnas JSONB en `consultations`.
**Por qué:** mismo shape que ya tenía el store → refactor suave; se editan junto con la consulta.
**Contra:** menos "consultable" por SQL. Si más adelante RIPS lo exige, se normaliza a tablas.

## D4 · Auditoría en tabla aparte (append-only)
**Decisión:** `audit_events` como tabla separada, no como JSONB en la consulta.
**Por qué:** trazabilidad clínica/legal: el registro debe ser inmutable e independiente de la
edición de la nota.

## D5 · El store como único puente a Supabase
**Decisión:** toda la lectura/escritura a Supabase vive en `app/app/providers.tsx`; las ~15
pantallas siguen usando `useStore` sin cambios.
**Por qué:** localiza el cambio (de localStorage a Supabase) a un archivo; bajo riesgo de
regresiones en las pantallas.

## D6 · IA agnóstica del modelo, vía rutas server con fallback
**Decisión:** la IA (chatbot, generación de nota, futuro recomendador) se llama por **rutas
server** (`/api/*`) que hacen `fetch` a la API, con **fallback** si no hay API key.
**Por qué:** la key nunca toca el navegador; se puede cambiar de proveedor/modelo por
funcionalidad sin reescribir; la app no se rompe sin key (degrada con gracia).

## D7 · El HIS lo maneja Milagro, no la web
**Decisión:** la web solo deja la nota **lista para copiar** (PDF/copiar). Integrarse con cada
HIS es trabajo de **Milagro** (la extensión que controla el PC).
**Por qué:** cada hospital usa un HIS distinto; integrarse uno por uno es inviable. Milagro,
como *clawbot* que lee la UI, copia a cualquier sistema. Para B2C, el médico copia a mano.

## D8 · Modo oscuro scopeado a la app
**Decisión:** el modo oscuro aplica solo dentro de `.app-shell` (la plataforma), no en
marketing/login. Script anti-flash en `app/layout.tsx`.
**Por qué:** el sitio público está diseñado en claro; meterlo en oscuro lo rompería.

## D9 · Nada de datos clínicos en el navegador
**Decisión:** pacientes/consultas/notas viven en Supabase, no en localStorage.
**Por qué:** se comparten, no se pierden al limpiar caché, son auditables y cifrados, y la ley
de historia clínica **obliga a conservarlos** (mín. 15 años). (El tema oscuro sí va en
localStorage, porque ahí sí es apropiado.)

## D10 · La web debe funcionar sola (independiente de Milagro)
**Decisión:** primero dejar la web **100% funcional sola** (B2C); Milagro es un añadido (B2B).
**Por qué:** son dos productos y dos mercados; la web se vende sola por suscripción.

## D11 · Dar de baja no es borrar (organizaciones y cuentas)
**Decisión:** la vía normal para retirar una organización es **archivarla**
(`organizations.archived_at`) y para una persona es **darla de baja**
(`profiles.disabled_at`). El borrado físico solo se permite cuando no queda nada
que perder, y lo comprueba la base, no la UI.
**Por qué:** se verificaron las claves foráneas una a una contra la base viva.
`consultations`, `patients`, `audit_events`, `appointments`, `agent_links` y
`consultation_addenda` apuntan a `organizations` **en CASCADE**: un solo borrado
confirmado destruye físicamente la historia clínica de ese hospital *y* el rastro
de auditoría que la respalda, derrotando por completo el borrado suave con
retención que sostiene el resto de la app (ver D9 y la Res. 1995/1999). Del lado
de las personas, las seis claves foráneas hacia `auth.users` son NO ACTION, así
que **la base ya impedía** borrar a un médico con historia: la RPC solo traduce
ese error a una frase que dice cuánta historia hay y remite a dar de baja.
**Consecuencia:** archivar bloquea a los miembros vía `lib/auth/server.ts`, no
borrando filas. El super-admin queda exento de ese bloqueo, porque es quien tiene
que poder restaurar.

## D12 · La contraseña se verifica en la base, no abriendo una sesión
**Decisión:** toda acción destructiva pide la contraseña del super-admin y la
comprueba `private.verify_own_password` con pgcrypto, dentro de la misma
transacción que el cambio.
**Por qué:** la alternativa —abrir un cliente desechable y llamar a
`signInWithPassword`— se descartó por dos motivos comprobados en el código de
`auth-js`: `signOut()` sin argumento revoca **todas** las sesiones del usuario,
incluida la que está usando en ese momento; y el diseño dependería de que "sesión
única por usuario" siga desactivado en la configuración de Auth, un acoplamiento
invisible que rompería la consola sin que nada en el código lo insinúe. Verificar
en la base además elimina la ventana entre "comprobé" y "borré".
**Consecuencia:** vive en el esquema `private`, que PostgREST no expone, así que
nunca es un endpoint contra el que probar contraseñas. Las cuentas que entran con
Google (sin `encrypted_password`) reciben un mensaje propio.

## D13 · Las horas se muestran siempre en hora de Bogotá
**Decisión:** `lib/dates.ts` fija `America/Bogota` en vez de usar la zona del
entorno de ejecución.
**Por qué:** esos helpers los llaman sobre todo *server components*, y en Vercel
"local" es UTC: toda la consola mostraba las horas cinco adelantadas, mientras el
SQL sí agrupaba por día de Bogotá — así que la gráfica y la tabla de al lado
nunca cuadraban, y el indicador de "visto hoy" se apagaba a las 19:00. Con la
zona fija, servidor y navegador imprimen lo mismo, lo que además elimina un
desajuste de hidratación en los componentes cliente que usan estos helpers.
**Consecuencia:** si algún día hay operación fuera de Colombia, esto pasa a ser
una preferencia por organización. Hasta entonces, una constante es más honesta
que `undefined`.
