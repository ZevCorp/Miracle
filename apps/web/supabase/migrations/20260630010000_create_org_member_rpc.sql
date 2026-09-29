-- ============================================================================
-- RPC para crear cuentas SIN service-role key.
--
-- create_org_member(): función SECURITY DEFINER que crea la cuenta de auth
-- (usuario + identidad de email con contraseña bcrypt) y deja el perfil en la
-- organización correcta. La llama la app con la sesión normal del usuario
-- (cliente con RLS), así que NO hace falta SUPABASE_SERVICE_ROLE_KEY.
--
-- Autorización DENTRO de la función (RLS no aplica a definer):
--   · superadmin → crea en cualquier organización.
--   · admin      → crea SOLO en su propia organización.
--   · cualquier otro → error.
-- Nunca asigna 'superadmin' por esta vía.
-- ============================================================================

create or replace function public.create_org_member(
  p_email           text,
  p_password        text,
  p_full_name       text,
  p_role            text,
  p_organization_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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

  -- Autorización + organización destino.
  if caller_role = 'superadmin' then
    target_org := p_organization_id;
  elsif caller_role = 'admin' then
    target_org := caller_org;            -- el admin no puede crear fuera de su org
  else
    raise exception 'No autorizado';
  end if;

  -- Rol a asignar: nunca 'superadmin' por esta vía.
  target_role := coalesce(nullif(p_role, ''), 'medico');
  if target_role not in ('medico', 'supervisor', 'admin') then
    target_role := 'medico';
  end if;

  -- Validaciones.
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

  -- Crear el usuario de auth (contraseña bcrypt) + identidad de email.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
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
    jsonb_build_object('full_name', trim(p_full_name))
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    new_uid::text, new_uid,
    jsonb_build_object('sub', new_uid::text, 'email', clean_email),
    'email', now(), now(), now()
  );

  -- handle_new_user ya creó el perfil desde app_metadata; lo confirmamos.
  update public.profiles
  set organization_id = target_org, role = target_role, full_name = trim(p_full_name)
  where id = new_uid;

  return new_uid;
end;
$$;

revoke all on function public.create_org_member(text, text, text, text, uuid) from public, anon;
grant execute on function public.create_org_member(text, text, text, text, uuid) to authenticated;
