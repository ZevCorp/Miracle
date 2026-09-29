-- Supervisor y admin pueden leer los perfiles de su organización (para mostrar
-- qué médico atendió cada consulta). El médico sigue viendo solo el suyo.
drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self" on public.profiles
  for select to authenticated
  using (
    (id = (select auth.uid()))
    or ((select private.current_app_role()) in ('admin', 'supervisor')
        and organization_id = (select private.current_org()))
  );
