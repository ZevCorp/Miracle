-- ============================================================================
-- RPC de métricas agregadas para la consola de super-admin.
-- Evita cargar tablas enteras al cliente solo para contar: hace los conteos en
-- la base y devuelve un jsonb. SECURITY DEFINER + guard is_superadmin().
-- ============================================================================

-- SECURITY INVOKER: el superadmin ya ve todo por sus políticas RLS aditivas, así
-- que los conteos son correctos sin elevar privilegios; un no-superadmin queda
-- bloqueado por el guard de abajo.
create or replace function public.superadmin_overview()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not (select private.is_superadmin()) then
    raise exception 'No autorizado';
  end if;

  select jsonb_build_object(
    'totals', jsonb_build_object(
      'organizations', (select count(*) from public.organizations),
      'users',         (select count(*) from public.profiles),
      'consultations', (select count(*) from public.consultations),
      'patients',      (select count(*) from public.patients)
    ),
    'by_role', coalesce((
      select jsonb_object_agg(role, n)
      from (select role, count(*) as n from public.profiles group by role) r
    ), '{}'::jsonb),
    'organizations', coalesce((
      select jsonb_agg(o order by (o->>'name'))
      from (
        select jsonb_build_object(
          'id', org.id,
          'name', org.name,
          'kind', org.kind,
          'nit', org.nit,
          'members', (select count(*) from public.profiles p where p.organization_id = org.id),
          'consultations', (select count(*) from public.consultations c where c.organization_id = org.id)
        ) as o
        from public.organizations org
      ) orgs
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.superadmin_overview() from public, anon;
grant execute on function public.superadmin_overview() to authenticated;
