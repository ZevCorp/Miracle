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

## D14 · El estado comercial vive por organización y el corte, en RLS
**Decisión:** `billing_accounts` (1:1 con `organizations`) guarda los campos
crudos de Stripe más los propios (`mode`, `trial_ends_at`, `comped_until`); el
acceso se **deriva siempre** con `private.org_has_access()` (espejo TS en
`lib/billing/entitlements.ts`) y se impone con políticas **RESTRICTIVE**
(`"billing access gate"`) sobre las tablas clínicas.
**Por qué:** D1 ya había elegido la organización como unidad de cobro. El store
escribe directo a PostgREST (D5), así que esconder botones no corta nada: la
única barrera inevadible es la base. Las políticas restrictivas se suman con
AND a las permisivas existentes — ninguna política vigente cambió. El bloqueo
por impago es **total** (lectura incluida) por decisión de producto: los datos
quedan intactos y reaparecen al reactivar; la retención de historia clínica se
cumple porque nada se borra y el superadmin (a quien `org_has_access()`
cortocircuita) puede leer y exportar si la ley lo exige.
**Consecuencia:** una org SIN fila de billing tiene acceso (fail-open
deliberado: un bug de billing jamás debe tumbar documentación clínica). Stripe
nunca decide el acceso: solo se sincroniza; quien decide es la base.

## D15 · Una credencial privilegiada, confinada al billing
**Decisión:** el webhook de Stripe escribe con `SUPABASE_SECRET_KEY` desde
`lib/billing/admin.ts` (server-only), que no exporta el cliente y solo toca
tablas `billing_*`.
**Por qué:** el webhook llega sin sesión de usuario y `billing_accounts` no
tiene grants para `authenticated`. La alternativa —una RPC SECURITY DEFINER con
secreto compartido y grant a `anon`— sería una service key artesanal expuesta
como endpoint público. La invariante del repo pasa de "sin credencial
privilegiada" a "sin credencial privilegiada **en el camino de los datos
clínicos**", que es lo que siempre protegió.

## D16 · La organización personal nace con rol `medico`
**Decisión:** `handle_new_user` asigna `medico` (antes `admin`) al alta B2C.
**Por qué:** el producto que compra un médico independiente exige rol `medico`:
`/app/consultas/nueva`, `/en-vivo` y el onboarding clínico (RPC y política RLS)
son de ese rol. Un "admin personal" ni siquiera podía completar onboarding — y
de paso podía invitar N médicos vía `create_org_member` pagando una sola
suscripción; un `medico` no puede invitar a nadie.
**Consecuencia:** las orgs personales quedan con `owner_id` NULL (la protección
del fundador existe contra sus PARES, y ahí no hay pares). Los triggers
protectores ganaron el carve-out `auth.uid() is null` (conexión administrativa,
mismo patrón que `prevent_demo_flag_escalation`).

## D17 · Membresías: una persona, varios mundos; una org activa
**Decisión:** `org_memberships` registra a qué organizaciones pertenece cada
persona; `profiles.organization_id` sigue siendo la organización **ACTIVA** y
toda la RLS queda intacta. Un trigger sincroniza las membresías desde
`profiles` (las vías de alta/movida existentes no cambiaron) y la RPC
`switch_active_organization` cambia de contexto validando la membresía.
**Por qué:** el requisito comercial es que un médico pueda pagar su Miracle
personal Y trabajar bajo el contrato de un hospital con la misma identidad.
Reescribir la RLS a membresías era una cirugía enorme; la org activa la deja
intacta.
**Consecuencia:** el trigger `prevent_foreign_org_change` cierra una
vulnerabilidad real detectada en esta fase: la política de onboarding permitía
a un médico auto-cambiarse `organization_id` vía PostgREST y leer otro tenant.
El switcher de interfaz queda para cuando alguien tenga dos membresías.

## D18 · La identificación del paciente es una sección de la plantilla
**Decisión:** toda plantilla lleva garantizada una sección canónica
`identificacion_del_paciente`, cuya instrucción pide dos líneas fijas
(`Nombre:` / `Documento:`), distinguir al paciente del médico y una frase
prudente cuando el dato no se dijo. La garantía vive en un trigger sobre
`clinical_templates` (institucionales, personales, presentes y futuras) y se
refuerza en el constructor del editor. De ahí, el trigger de `consultations`
promueve el dato a `paciente_nombre` / `paciente_documento`, que son la ÚNICA
fuente de la que leen listas, detalle, buscador y PDF.
**Por qué:** el arreglo de 2026-08-20 extraía la identidad de la nota YA escrita
y eso tapaba el síntoma, no la causa. La renovación del catálogo (2026-08-11)
dejó 195 de 204 plantillas activas sin ninguna casilla donde escribirla, y el
generador llena exactamente las secciones del `template_snapshot` y ni una más:
sin casilla no hay dato que extraer. Se ve en los números: patología, que sí
tiene el nombre como campo (`nombre_paciente` + `cedula`), iba 599/601; la
plantilla renovada de medicina general, 0/18. La plantilla es el único contrato
entre esta app y el motor de notas, así que es ahí donde se pide el dato.
**Consecuencia:** las consultas ya guardadas no cambian —`template_snapshot` se
congela al crear el encounter, así que el versionado queda intacto—; solo las
nuevas nacen con la casilla. Patología se deja como está (pedir dos veces el
mismo dato es peor que no pedirlo). La casilla NO es obligatoria: en urgencias
hay pacientes que no pueden identificarse, y marcarla obligatoria llenaría de
avisos falsos las notas correctas. La consola de superadmin sigue mostrando solo
el nombre del paciente registrado: no se le amplía la exposición a PHI por esto.

## D19 · El documento del paciente tiene una sola forma canónica
**Decisión:** el número de documento se guarda y se escribe sin separadores
(`canonicalizeDocumento` en lib/clinical/patient-identity.ts, con espejo en el
trigger de `consultations`). La canonización se aplica en `lib/api/clinical.ts`,
el borde por el que pasan generación, regeneración, ajuste del asistente y
guardado, así que la nota, el backend y el espejo dicen todos lo mismo.
**Por qué:** al dictar, el número llegaba partido ("23-45-67-75-43"). No lo
parte el modelo ni la app: lo parte el PROVEEDOR DE TRANSCRIPCIÓN (Deepgram
`smart_format` / Soniox aplican normalización inversa y escriben una corrida
larga de cifras como si fuera un teléfono). Se comprobó en los datos: las 3
notas con guiones los traen idénticos en su transcripción, y otras 21
transcripciones los traen también. El cliente de dictado solo concatena tokens
del proveedor y el generador los copia por su regla de fidelidad. El interruptor
que los produce vive en el runtime de voz, fuera de este repo y del backend
clínico; por eso la corrección se hace en el CAMPO, que tiene formato declarado.
**Consecuencia:** se canoniza UNA línea —la etiquetada como documento dentro de
la casilla de identificación— y solo cuando resuelve a un documento válido; si
el modelo escribió prosa, no se toca. **La transcripción nunca se modifica**: es
la evidencia de lo que se dijo. **El rótulo tampoco**: el número de caso de
patología ("26-2931") vive en su propia sección, con su propia columna y su
propio trigger, sus guiones sí significan algo (año y consecutivo), y las
plantillas que lo llevan ni siquiera tienen la casilla de identificación. De
paso se corrigió una corrupción silenciosa: arrasar con los no-dígitos convertía
el pasaporte "AY123456" en "123456", así que ahora se distingue el documento
numérico (cédula, TI, RC, CE, NUIP) del alfanumérico (pasaporte, PPT).
