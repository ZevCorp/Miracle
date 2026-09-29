-- create_org_member: rellenar las columnas de token de GoTrue.
--
-- EL BUG: la función insertaba en auth.users sin tocar confirmation_token,
-- recovery_token, email_change, email_change_token_new ni
-- email_change_token_current. Esas cinco columnas NO tienen default en la base
-- (verificado en information_schema), así que quedaban en NULL. GoTrue las lee
-- como texto, revienta, y el login responde "credenciales inválidas".
--
-- CONSECUENCIA: todo médico creado desde /app/usuarios (admin) o
-- /superadmin/usuarios (superadmin) quedaba sin poder entrar. Las cuentas que
-- hoy funcionan se arreglaron a mano una por una.
--
-- LA REGLA: en auth.users esas columnas van en CADENA VACÍA, nunca en NULL. El
-- patrón correcto ya estaba en supabase/seed/demo-account.sql; aquí se trae a
-- la función para que el alta desde la consola quede arreglada de raíz.
--
-- Lo demás de la función queda idéntico: misma firma, mismos permisos, mismas
-- validaciones. No hay que tocar los callers (app/superadmin/actions.ts y
-- app/app/usuarios/actions.ts).

create or replace function public.create_org_member(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_organization_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  caller      uuid := (select auth.uid());
  caller_role text;
  caller_org  uuid;
  target_org  uuid;
  target_role text;
  new_uid     uuid := gen_random_uuid();
  clean_email text := lower(trim(p_email));
begin
  if caller is null then
    raise exception 'Autenticación requerida';
  end if;

  select role, organization_id into caller_role, caller_org
  from public.profiles where id = caller;

  if caller_role = 'superadmin' then
    target_org := p_organization_id;
  elsif caller_role = 'admin' then
    target_org := caller_org;
  else
    raise exception 'No autorizado';
  end if;

  target_role := coalesce(nullif(p_role, ''), 'medico');
  if target_role not in ('medico', 'supervisor', 'admin') then
    target_role := 'medico';
  end if;

  if clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Correo inválido';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'El nombre es obligatorio';
  end if;
  if target_org is null
     or not exists (select 1 from public.organizations where id = target_org) then
    raise exception 'Organización inválida';
  end if;
  if exists (select 1 from auth.users where email = clean_email) then
    raise exception 'Ya existe una cuenta con ese correo';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    -- Las cinco de abajo son la corrección de esta migración: sin default en la
    -- base y leídas como texto por GoTrue. En NULL, el login falla.
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current
  ) values (
    '00000000-0000-0000-0000-000000000000', new_uid, 'authenticated', 'authenticated',
    clean_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'organization_id', target_org::text,
      'role', target_role
    ),
    jsonb_build_object('full_name', trim(p_full_name)),
    '', '', '', '', ''
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    new_uid::text, new_uid,
    jsonb_build_object('sub', new_uid::text, 'email', clean_email),
    'email', now(), now(), now()
  );

  update public.profiles
  set organization_id = target_org, role = target_role, full_name = trim(p_full_name)
  where id = new_uid;

  return new_uid;
end;
$function$;

revoke all on function public.create_org_member(text, text, text, text, uuid) from public, anon;
grant execute on function public.create_org_member(text, text, text, text, uuid) to authenticated;

-- Normaliza cualquier cuenta que ya haya quedado con los tokens en NULL por el
-- bug anterior. Idempotente: si ya están en cadena vacía, no cambia nada.
update auth.users
set confirmation_token         = coalesce(confirmation_token, ''),
    recovery_token             = coalesce(recovery_token, ''),
    email_change               = coalesce(email_change, ''),
    email_change_token_new     = coalesce(email_change_token_new, ''),
    email_change_token_current = coalesce(email_change_token_current, '')
where confirmation_token is null
   or recovery_token is null
   or email_change is null
   or email_change_token_new is null
   or email_change_token_current is null;
