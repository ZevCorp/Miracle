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
