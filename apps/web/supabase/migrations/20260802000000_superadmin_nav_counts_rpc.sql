-- Conteos para los badges del menú de la consola de super-admin.
--
-- Es deliberadamente mínima: la llama el layout en CADA navegación, así que
-- son cuatro counts y nada más. La analítica pesada vive en
-- superadmin_dashboard, que solo llaman las páginas que la necesitan.
--
-- SECURITY DEFINER porque alertas_salud lee clinical_encounters, que no tiene
-- política RLS de superadmin (el taller es del backend). El guard
-- is_superadmin() es la barrera, como en superadmin_activity.
create or replace function public.superadmin_nav_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not (select private.is_superadmin()) then
    raise exception 'No autorizado';
  end if;

  select jsonb_build_object(
    'organizaciones', (select count(*) from public.organizations),
    'usuarios', (select count(*) from public.profiles),
    'consultas', (select count(*) from public.consultations where deleted_at is null),
    'alertas_salud', (
      (select count(*) from public.clinical_encounters where status = 'failed')
      + (select count(*) from public.clinical_encounters
          where status in ('created', 'recording', 'transcript_ready', 'note_generating')
            and created_at < now() - interval '1 day')
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.superadmin_nav_counts() from public, anon;
grant execute on function public.superadmin_nav_counts() to authenticated;
