# Billing — B2C (pasarela por decidir) y B2B (institucional)

Cómo funciona la capa comercial. Decisiones D14–D17 en
[`decisiones.md`](./decisiones.md); cuentas y roles en [`cuentas.md`](./cuentas.md).

> ## ⚠️ La pasarela de pagos está SIN DECIDIR (2026-08-14)
>
> **Stripe quedó descartado**: no admite empresas constituidas en Colombia (de
> los países hispanohablantes solo opera con España y México). Usarlo exigiría
> constituir una entidad en EE.UU., camino que por ahora no se toma.
>
> **Candidato principal: Mercado Pago** (cobro en pesos con medios locales).
> Pendiente de decisión final.
>
> La implementación de Stripe que hay en el repo **queda como referencia
> funcional, inactiva sin claves**. Lo importante: el corte de acceso NO depende
> de la pasarela. Siguen vivos y funcionando la prueba de 14 días, las
> cortesías, el modo institucional y el bloqueo en RLS. Cambiar de proveedor
> toca solo la capa de sincronización:
>
> | Se conserva tal cual | Se reescribe al elegir pasarela |
> |---|---|
> | `billing_accounts`, `private.org_has_access()` | `lib/billing/stripe.ts`, `sync.ts` |
> | Políticas `"billing access gate"` | `app/api/billing/webhook/route.ts` |
> | `lib/billing/entitlements.ts` + sus tests | acciones de checkout y portal en `app/suscripcion/actions.ts` |
> | Paywall, trial, `/registro`, `/precios` | columnas `stripe_*` (renombrar o generalizar) |
>
> Al elegir proveedor, conviene generalizar las columnas `stripe_*` a nombres
> neutros (`provider`, `provider_customer_id`, `provider_status`…) y mapear los
> estados del proveedor a los mismos que ya entiende `org_has_access()`.

## La idea en una frase

El estado comercial vive **por organización** en `billing_accounts`; el acceso
se **deriva** (nunca se guarda) con `private.org_has_access()` — espejo TS en
`lib/billing/entitlements.ts` — y se impone en la base con las políticas
RESTRICTIVE `"billing access gate"`. Stripe solo se sincroniza: **no decide**.

## Modos de cuenta

| `mode` | Quién | Cómo paga | Qué corta el acceso |
|---|---|---|---|
| `self_serve` | Médico independiente (org `personal`) | Stripe: trial 14 días sin tarjeta → suscripción mensual | Trial vencido, pago fallido, cancelación |
| `institutional` | Hospital/clínica/IPS (org `institution`) | Acuerdo con Miracle, fuera de Stripe | Solo `organizations.archived_at` (como siempre) |
| `comped` | Cortesías y pilotos | Nadie | `comped_until` si se fija; vencida cae a `self_serve` |

## Ciclo de vida B2C

```
/registro → confirma correo → onboarding clínico → 14 días de trial (completo)
   → Suscribirse (Stripe Checkout hosted) → activa
   → pago fallido (past_due) ─ gracia 0 días → BLOQUEADA + "arreglar pago" (portal)
   → cancelar (portal) ─ activa hasta fin de período → BLOQUEADA + "reactivar"
   → reactivar / pagar → activa otra vez, con TODO intacto
```

**Bloqueo total por decisión de producto**: sin acceso comercial no se lee ni
se escribe nada clínico; el usuario autentica y aterriza en `/suscripcion`
(letrero + botón de pago). Los datos **nunca se borran**: reaparecen al
reactivar. La retención legal se cumple porque nada se destruye y el
superadmin puede exportar historia si la ley lo exige.

Dónde se impone, de la autoridad hacia arriba:
1. **RLS** — políticas RESTRICTIVE en `consultations`, `patients`,
   `appointments`, `consultation_addenda`, `audit_events` (inevadible, incluso
   por PostgREST directo).
2. **Servidor** — `getCurrentProfile()` trae `billing` derivado;
   `app/app/layout.tsx` redirige a `/suscripcion` si `blocked`.
3. **APIs de IA** — `requireEntitledApiUser()` (402) en `/api/stt/session`,
   `/api/parse-schedule`, `/api/clinical/note-from-photo`.
4. **UX** — banner de trial/pago en el AppShell; ítem "Suscripción" solo en
   orgs personales.

Parámetros de negocio (una línea de SQL cada uno):
`private.billing_trial_days()` = 14 · `private.billing_grace_days()` = 0.
El espejo TS (`GRACE_DAYS`, `TRIAL_DIAS`) debe cambiar con ellos.

## Flujo Stripe

- **Checkout y portal HOSTED**: cero JS de Stripe en el navegador; ninguna
  tarjeta toca Miracle.
- `createCheckoutSession` (en `app/suscripcion/actions.ts`) asegura un
  Customer por organización (`metadata.organization_id`) y redirige.
- **Retorno**: `/suscripcion?checkout=success&session_id=...` sincroniza
  server-side ANTES de renderizar — no se espera al webhook.
- **Webhook** `POST /api/billing/webhook`: verifica firma ANTES de leer nada;
  dedup por `billing_events.stripe_event_id`; **nunca confía en el payload**
  (re-consulta la suscripción fresca); 500 ⇒ Stripe reintenta.
- Eventos manejados: `checkout.session.completed`,
  `customer.subscription.created|updated|deleted`, `invoice.paid`,
  `invoice.payment_failed`.

## Puesta en marcha paso a paso (SOLO si se elige Stripe con entidad no colombiana)

> Guardado por si algún día se constituye una entidad en EE.UU./España/México.
> Con una empresa colombiana **estos pasos no se pueden completar**: Stripe no
> ofrece Colombia en el registro. Ver el aviso del encabezado.

Cuatro bloques: Stripe → Supabase → local → producción. Hazlos en orden; nada
de esto toca la base de datos ni el código (solo variables de entorno), así que
es reversible.

### Bloque 1 · En Stripe (navegador, ~10 min)

1. Entra a [dashboard.stripe.com](https://dashboard.stripe.com) y crea la
   cuenta de la empresa (o entra a la que ya exista).
2. Activa el **modo de prueba** con el interruptor "Test mode" arriba a la
   derecha. **Todo el bloque 1 y 3 se hace en modo prueba.**
3. **Crea el producto**: *Product catalog → Add product*.
   - Nombre: `Miracle Notes`.
   - Precio: **Recurring / mensual**, moneda **COP**, y el monto que decidas.
     Tiene que ser *recurrente*: el código usa suscripciones, un pago único no
     sirve.
   - Guarda y copia el **ID del precio** (empieza por `price_...`), no el del
     producto.
4. **Copia la clave secreta**: *Developers → API keys → Secret key*
   (empieza por `sk_test_...` en modo prueba).
5. **Activa el portal de cliente**: *Settings → Billing → Customer portal* →
   actívalo y permite "Cancel subscription" y "Update payment method". Sin esto
   el botón "Gestionar suscripción" falla.

### Bloque 2 · En Supabase (2 min)

6. En [supabase.com/dashboard](https://supabase.com/dashboard) → proyecto
   `miracle-app` → *Project Settings → API keys* → copia la **secret key**
   (`sb_secret_...`). Es la que usa el webhook para escribir la suscripción.

### Bloque 3 · En tu computador, para probar (~15 min)

7. Abre `.env.local` (en la raíz del proyecto) y añade:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PRICE_ID_PRO=price_...
   SUPABASE_SECRET_KEY=sb_secret_...
   STRIPE_WEBHOOK_SECRET=      # lo llenas en el paso 9
   ```
8. Instala el CLI de Stripe (Windows): `winget install Stripe.StripeCLI`, y
   luego `stripe login` (abre el navegador para autorizar).
9. En una terminal aparte, deja corriendo:
   ```
   stripe listen --forward-to localhost:3100/api/billing/webhook
   ```
   Imprime un `whsec_...`: pégalo en `STRIPE_WEBHOOK_SECRET` y **reinicia el
   servidor de desarrollo** (las variables se leen al arrancar).
10. Pon el precio en el sitio: en `lib/billing/plans.ts`, cambia
    `precioMensualCop: null` por el monto (ej. `149900`). Es solo el texto que
    se muestra; el cobro real siempre lo manda el Price de Stripe.
11. Prueba el ciclo completo con una cuenta nueva creada en `/registro`:
    - Tarjeta `4242 4242 4242 4242` (cualquier fecha futura y CVC) → al volver
      del checkout la cuenta queda **activa**.
    - En Stripe, cancela la suscripción → la cuenta queda **bloqueada** al
      terminar el período y aparece el letrero de pago.
    - Vuelve a suscribirte → **todo reaparece**.
    - `stripe trigger invoice.payment_failed` simula un cobro fallido.

### Bloque 4 · En producción (Vercel)

12. Mergea la rama `feat/arquitectura-comercial-b2c` a `main`.
13. En Stripe (todavía en **modo prueba** si quieres una pasada segura, o ya en
    modo real): *Developers → Webhooks → Add endpoint*.
    - URL: `https://itsmiracleai.com.co/api/billing/webhook`
    - Eventos: `checkout.session.completed`,
      `customer.subscription.created`, `customer.subscription.updated`,
      `customer.subscription.deleted`, `invoice.paid`,
      `invoice.payment_failed`.
    - Copia el **Signing secret** (`whsec_...`) que genera: es **distinto** al
      del CLI.
14. En Vercel → proyecto `miracle-web` → *Settings → Environment Variables*,
    entorno **Production**, añade las cuatro: `STRIPE_SECRET_KEY`,
    `STRIPE_PRICE_ID_PRO`, `STRIPE_WEBHOOK_SECRET` (el del paso 13) y
    `SUPABASE_SECRET_KEY`.
15. Despliega (`vercel --prod` o push a `main`) y repite la prueba del paso 11
    contra el sitio real.

### Para cobrar de verdad

Cuando Stripe apruebe la activación de la cuenta (te pide datos de la empresa y
una cuenta bancaria), repite en **modo real** los pasos 3, 4 y 13 — producto,
precio, clave `sk_live_...` y webhook con su propio `whsec_...` — y sustituye
esas tres variables en Vercel. Nada del código cambia.

## Runbook

**Dar cortesía (piloto/lanzamiento) a una organización:**
```sql
update billing_accounts set mode = 'comped', comped_until = null  -- o una fecha
 where organization_id = '<org>';
```

**Volverla self_serve (le corre el trial normal o su suscripción):**
```sql
update billing_accounts set mode = 'self_serve' where organization_id = '<org>';
```

**Reconciliar una cuenta que se ve rara:** botón "Actualizar estado" en
`/suscripcion` (pull on-demand a Stripe), o revisar `billing_events` por
`organization_id` para ver qué llegó y cuándo.

**Simular estados sin Stripe (pruebas):**
```sql
-- Trial vencido (bloquea):
update billing_accounts set trial_ends_at = now() - interval '1 day' where organization_id = '<org>';
-- Restaurar trial:
update billing_accounts set trial_ends_at = now() + interval '14 days' where organization_id = '<org>';
```

## Variables de entorno

Ver `.env.example`: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_PRO`,
`STRIPE_WEBHOOK_SECRET`, `SUPABASE_SECRET_KEY` (esta última SOLO la usa
`lib/billing/admin.ts` — decisión D15). Sin ellas la app degrada con gracia:
trial y cortesías siguen gobernando el acceso.

## El precio

La autoridad del monto es el **Price de Stripe** (`STRIPE_PRICE_ID_PRO`, en
COP). `lib/billing/plans.ts` solo tiene el texto de display
(`precioMensualCop`, hoy `null` = "por confirmar"): al definir el precio
comercial, actualiza ambos.

## Trampa que ya nos mordió una vez

`private.org_has_access()` **debe** tener `grant execute ... to authenticated`.
Una política RLS se evalúa con los permisos de quien consulta: al revocarle el
EXECUTE (por prudencia mal entendida), toda consulta a las tablas con el gate
murió con `permission denied for function org_has_access` en vez de filtrar
filas. Los otros helpers de políticas (`current_org`, `current_app_role`,
`is_admin`, `is_superadmin`) tienen ese mismo grant; los de TRIGGER no lo
necesitan (corren en el contexto del trigger). Si algún día añades otro helper
a una política, sigue el patrón de los primeros, no el de los triggers.

## Qué se verificó contra la base viva (2026-08-11)

Con una organización de prueba y un usuario sintético, impersonando por
`request.jwt.claims`:

| Escenario | Resultado |
|---|---|
| Org nueva | nace `self_serve` con 14 días de trial (trigger) |
| Trial vigente / suscripción `active` | ve y escribe |
| Trial vencido | `org_has_access` = false |
| Suscripción `canceled` | 0 pacientes y 0 consultas visibles; **sí** ve su perfil y su fila de billing (puede entrar y pagar) |
| INSERT estando bloqueado | rechazado por la política `"billing access gate"` |
| Reactivar | los datos reaparecen completos y la escritura vuelve |
| Médico real de Hospital General de Medellín | 153 consultas y 1091 eventos de auditoría: sin cambios |
| Cuenta demo comercial | 6 pacientes, 8 consultas, 6 citas: sin cambios |

## Pendientes conocidos

- **Elegir pasarela** (Mercado Pago es el candidato) y escribir su adaptador.
  Ver el aviso del encabezado para saber qué se conserva y qué se reescribe.
- **La base va por delante del código desplegado**: las migraciones de billing
  están aplicadas en producción, pero el paywall vive en la rama
  `feat/arquitectura-comercial-b2c`, sin mergear. Hoy no rompe nada (las tres
  instituciones son `institutional` y la org personal del superadmin es
  `comped`), pero si alguien se registra por su cuenta y se le vence la prueba
  de 14 días, con el código viejo vería pantallas vacías en vez del letrero de
  pago. Mergear la rama cierra ese hueco.
- Switcher de contexto multi-org: la RPC `switch_active_organization` está
  lista y dormida; falta interfaz cuando alguien tenga dos membresías.
- Emails de cobro: los manda la pasarela (recibos, reintentos). Miracle no
  envía correos propios de billing todavía.
- El flujo de Stripe está escrito y tipado pero **nunca ejercitado con claves
  reales**, y probablemente no llegue a estarlo.
