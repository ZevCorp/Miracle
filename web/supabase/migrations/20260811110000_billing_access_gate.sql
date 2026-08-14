-- ============================================================================
-- El corte comercial vive en la base (decisión D14).
--
-- POR QUÉ EN RLS
-- El store del navegador (app/app/providers.tsx) escribe DIRECTO a PostgREST
-- con el JWT del usuario (decisión D5). Esconder botones u ocultar rutas en
-- Next no corta nada: la única barrera que no se puede evadir es la base.
--
-- CÓMO
-- Políticas RESTRICTIVE: se evalúan con AND encima de las permisivas
-- existentes, así que NINGUNA política actual cambia. FOR ALL: USING gobierna
-- SELECT/UPDATE/DELETE y WITH CHECK los INSERT/UPDATE.
--
-- QUÉ SE CORTA
-- Por decisión de producto el bloqueo es TOTAL (lectura incluida): un moroso
-- solo ve la página de suscripción. Los datos quedan intactos y reaparecen al
-- reactivar; la retención legal (Res. 1995/1999) se cumple del lado de Miracle
-- porque la historia nunca se borra y el superadmin —a quien org_has_access()
-- cortocircuita— puede leerla y exportarla si la ley lo exige.
--
-- QUÉ NO SE GATEA (deliberado)
-- profiles y organizations (hay que poder autenticarse y llegar al paywall),
-- billing_accounts (hay que poder ver qué se debe y pagar), clinical_templates
-- (catálogo por owner, inofensivo y necesario para pintar poco más que texto).
-- Las orgs `institution` pasan siempre (su corte sigue siendo archived_at) y
-- las cuentas demo viven en una institution, así que la demo no se toca.
--
-- El subselect `(select ...)` importa: fuerza un InitPlan que se evalúa UNA vez
-- por sentencia, no por fila — el mismo patrón de las políticas existentes.
-- ============================================================================

create policy "billing access gate" on public.consultations
  as restrictive for all to authenticated
  using ((select private.org_has_access()))
  with check ((select private.org_has_access()));

create policy "billing access gate" on public.patients
  as restrictive for all to authenticated
  using ((select private.org_has_access()))
  with check ((select private.org_has_access()));

create policy "billing access gate" on public.appointments
  as restrictive for all to authenticated
  using ((select private.org_has_access()))
  with check ((select private.org_has_access()));

create policy "billing access gate" on public.consultation_addenda
  as restrictive for all to authenticated
  using ((select private.org_has_access()))
  with check ((select private.org_has_access()));

create policy "billing access gate" on public.audit_events
  as restrictive for all to authenticated
  using ((select private.org_has_access()))
  with check ((select private.org_has_access()));

notify pgrst, 'reload schema';
