# Billing — B2C (Stripe) y B2B (institucional)

Cómo funciona la capa comercial. Decisiones D14–D17 en
[`decisiones.md`](./decisiones.md); cuentas y roles en [`cuentas.md`](./cuentas.md).

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

### Probar en local (modo test)

```bash
stripe listen --forward-to localhost:3100/api/billing/webhook
```

1. Pega el `whsec_...` que imprime en `.env.local` → `STRIPE_WEBHOOK_SECRET`.
2. Tarjeta `4242 4242 4242 4242` → activa al volver del checkout.
3. Tarjeta `4000 0000 0000 0341` (falla el cobro recurrente) → `past_due` →
   bloqueada al vencer el período.
4. Cancela desde el portal → bloqueada al fin de período; reactiva → todo vuelve.
5. `stripe trigger customer.subscription.updated` para simular eventos sueltos.

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

## Pendientes conocidos

- **Migraciones M2 y M3 por aplicar** (el archivo ya está en
  `supabase/migrations/`): `20260811110000_billing_access_gate.sql` (el corte
  en RLS — hasta aplicarla el bloqueo solo existe en servidor/UX) y
  `20260811120000_personal_org_medico.sql` (rol `medico` al alta B2C — hasta
  aplicarla, quien se registre queda `admin` y no puede crear consultas).
- Switcher de contexto multi-org: la RPC `switch_active_organization` está
  lista y dormida; falta interfaz cuando alguien tenga dos membresías.
- Emails de cobro: los manda Stripe (recibos, dunning). Miracle no envía
  correos propios de billing todavía.
