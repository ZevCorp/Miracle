-- ============================================================================
-- Custom Access Token Hook: inyecta app_role + organization_id en los claims del
-- JWT desde public.profiles, para que el proxy no tenga que leer profiles en cada
-- request. La función es INERTE hasta que se HABILITA el hook en el panel de
-- Supabase (Authentication → Hooks → "Customize Access Token (JWT) Claims"), lo
-- cual NO se puede hacer por SQL. El proxy lleva fallback a BD, así que la app
-- funciona con el hook activado o no.
--
-- El hook lo invoca GoTrue como el rol `supabase_auth_admin`; por eso ese rol
-- necesita EXECUTE sobre la función y SELECT sobre profiles (grant + política).
-- Se usa la clave `app_role` (no `role`, que es reservada en el JWT).
-- ============================================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  claims jsonb := event->'claims';
  v_role text;
  v_org  uuid;
begin
  select role::text, organization_id
    into v_role, v_org
    from public.profiles
   where id = (event->>'user_id')::uuid;

  if v_role is not null then
    claims := jsonb_set(claims, '{app_role}', to_jsonb(v_role));
  end if;
  if v_org is not null then
    claims := jsonb_set(claims, '{organization_id}', to_jsonb(v_org::text));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Permisos para que GoTrue (supabase_auth_admin) pueda ejecutar el hook y leer
-- profiles; se le niega la ejecución a los roles de la app.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant select on table public.profiles to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

drop policy if exists "auth admin reads profiles for token hook" on public.profiles;
create policy "auth admin reads profiles for token hook" on public.profiles
  for select to supabase_auth_admin using (true);
