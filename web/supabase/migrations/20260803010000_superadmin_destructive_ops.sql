-- ============================================================================
-- Acciones de gestión y de baja para la consola de super-admin.
--
-- Hasta ahora la consola solo sabía crear y leer: no existía NINGUNA política
-- DELETE en ninguna tabla, y lo único destructivo era el borrado suave de
-- consultas. Esto añade dar de baja personas y organizaciones, con freno.
--
-- POR QUÉ DAR DE BAJA NO ES BORRAR
-- Las claves foráneas mandan, y se comprobaron una a una contra la base viva:
--
--   · organizations ← consultations, patients, audit_events, appointments,
--     agent_links, consultation_addenda  →  TODAS EN CASCADE.
--     Borrar una organización DESTRUYE FÍSICAMENTE su historia clínica y el
--     rastro de auditoría que la respalda. Por eso la vía normal es ARCHIVAR, y
--     el borrado real solo se permite cuando la organización está vacía del
--     todo (una creada por error de dedo).
--
--   · auth.users ← consultations.medico_id, patients.created_by,
--     appointments.medico_id, consultation_addenda.author_id,
--     agent_links.created_by, graph_interactions.user_id  →  TODAS NO ACTION.
--     La base YA impide borrar un médico con historia. La función no inventa
--     esa regla: solo convierte el error crudo de clave foránea en una frase en
--     español que señala la alternativa que sí funciona (desactivar).
--
-- VERIFICACIÓN: contraseña propia, comprobada DENTRO de la transacción.
-- Ver private.verify_own_password más abajo.
--
-- Todo lo destructivo pasa por estas funciones SECURITY DEFINER. NO se añade
-- ninguna política DELETE: ese es el invariante sobre el que se apoya el modelo
-- de seguridad, y conviene que siga siendo cierto.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Columnas de estado
-- ---------------------------------------------------------------------------

-- Baja de una persona: reversible, conserva su historia y sus firmas.
alter table public.profiles
  add column if not exists disabled_at     timestamptz,
  add column if not exists disabled_reason text;

-- Baja de una organización: sale de todas las listas, no se pierde nada.
alter table public.organizations
  add column if not exists archived_at timestamptz;

comment on column public.profiles.disabled_at is
  'Cuenta dada de baja por el super-admin. Bloquea el acceso; la historia clínica se conserva.';
comment on column public.organizations.archived_at is
  'Organización archivada. Desaparece de la consola y sus miembros no pueden entrar. Reversible.';

-- Índices parciales: las consultas normales piden "las que NO están de baja",
-- así que solo se indexan las pocas filas que sí lo están.
create index if not exists profiles_disabled_idx
  on public.profiles (disabled_at) where disabled_at is not null;
create index if not exists organizations_archived_idx
  on public.organizations (archived_at) where archived_at is not null;

-- ---------------------------------------------------------------------------
-- 2. Verificación de contraseña
-- ---------------------------------------------------------------------------

-- Comprueba la contraseña del propio usuario contra el hash bcrypt de
-- auth.users, con pgcrypto (ya instalado en el esquema `extensions`).
--
-- POR QUÉ AQUÍ Y NO EN LA APP
-- La alternativa era abrir un cliente desechable y llamar a signInWithPassword.
-- Se descartó por dos motivos comprobados:
--   1. `signOut()` sin argumento revoca TODAS las sesiones del usuario,
--      incluida la que el super-admin está usando. Un despiste ahí lo saca de
--      su propia consola a mitad de la operación.
--   2. Dependería de que "sesión única por usuario" siga desactivado en la
--      configuración de Auth: un acoplamiento invisible que rompería esto sin
--      que nada en el código lo insinúe.
-- Además, así la comprobación ocurre en la MISMA transacción que el borrado:
-- no hay ventana entre "verifiqué" y "borré".
--
-- Vive en `private`, que PostgREST no expone: solo es alcanzable desde dentro
-- de las funciones de abajo. Nunca es un endpoint para probar contraseñas.
create or replace function private.verify_own_password(p_password text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select u.encrypted_password is not null
       and u.encrypted_password = extensions.crypt(p_password, u.encrypted_password)
    from auth.users u
    where u.id = (select auth.uid())
  ), false)
$$;

revoke all on function private.verify_own_password(text) from public, anon, authenticated;

-- Guarda común: rol, límite de intentos y contraseña, en ese orden.
-- El límite va ANTES de la contraseña para que los intentos fallidos también
-- cuenten; si no, se podría probar sin coste.
create or replace function private.assert_superadmin_password(p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_superadmin()) then
    raise exception 'No autorizado';
  end if;

  if not (select public.check_rate_limit('sa_destructive:' || (select auth.uid())::text, 10, 3600)) then
    raise exception 'Demasiados intentos. Espera una hora antes de volver a intentarlo.';
  end if;

  -- Mensaje aparte para las cuentas que entran con Google: sin contraseña
  -- local, "contraseña incorrecta" mandaría a alguien a probar una y otra vez
  -- algo que nunca va a funcionar.
  if not exists (
    select 1 from auth.users
    where id = (select auth.uid()) and encrypted_password is not null
  ) then
    raise exception 'Tu cuenta entra con Google y no tiene contraseña local. Usa una cuenta con contraseña para esta operación.';
  end if;

  if not (select private.verify_own_password(p_password)) then
    raise exception 'Contraseña incorrecta.';
  end if;
end;
$$;

revoke all on function private.assert_superadmin_password(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Personas
-- ---------------------------------------------------------------------------

-- Dar de baja: bloquea el acceso, conserva todo.
create or replace function public.superadmin_deactivate_user(
  p_user_id  uuid,
  p_password text,
  p_reason   text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_role  text;
begin
  perform private.assert_superadmin_password(p_password);

  select email, role::text into v_email, v_role
  from public.profiles where id = p_user_id;

  if v_email is null then
    raise exception 'La cuenta no existe.';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'No puedes dar de baja tu propia cuenta.';
  end if;
  if v_role = 'superadmin' then
    raise exception 'Las cuentas de plataforma no se dan de baja desde aquí.';
  end if;

  -- La auditoría se escribe ANTES: si algo falla después, queda el intento.
  insert into public.audit_events (organization_id, actor_id, actor_name, accion, detalle)
  values (
    private.current_org(), (select auth.uid()),
    (select coalesce(full_name, email) from public.profiles where id = (select auth.uid())),
    'Cuenta dada de baja',
    format('%s (%s)%s', v_email, p_user_id,
           case when coalesce(trim(p_reason), '') = '' then '' else ' · ' || trim(p_reason) end)
  );

  update public.profiles
  set disabled_at = now(), disabled_reason = nullif(trim(p_reason), '')
  where id = p_user_id;

  -- Refuerzo en el esquema auth: corta las sesiones vivas e impide emitir
  -- tokens nuevos. Escribir en `auth` no está soportado oficialmente, así que
  -- va en su propio bloque: si Supabase cambia el esquema, la baja sigue
  -- funcionando por la vía de la app (lib/auth/server.ts), que es la
  -- autoritativa. Sin esto habría hasta una hora de margen con el token vigente.
  begin
    delete from auth.sessions where user_id = p_user_id;
    update auth.users set banned_until = now() + interval '100 years' where id = p_user_id;
  exception when others then
    null;
  end;
end;
$$;

create or replace function public.superadmin_reactivate_user(
  p_user_id  uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  perform private.assert_superadmin_password(p_password);

  select email into v_email from public.profiles where id = p_user_id;
  if v_email is null then
    raise exception 'La cuenta no existe.';
  end if;

  insert into public.audit_events (organization_id, actor_id, actor_name, accion, detalle)
  values (
    private.current_org(), (select auth.uid()),
    (select coalesce(full_name, email) from public.profiles where id = (select auth.uid())),
    'Cuenta reactivada', format('%s (%s)', v_email, p_user_id)
  );

  update public.profiles
  set disabled_at = null, disabled_reason = null
  where id = p_user_id;

  begin
    update auth.users set banned_until = null where id = p_user_id;
  exception when others then
    null;
  end;
end;
$$;

-- Borrado definitivo. Solo para cuentas SIN historia: la base ya lo impone con
-- seis claves foráneas NO ACTION, y aquí se cuenta antes para dar un mensaje
-- útil en vez de un "violates foreign key constraint".
create or replace function public.superadmin_delete_user(
  p_user_id  uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email      text;
  v_role       text;
  n_consultas  bigint;
  n_pacientes  bigint;
  n_citas      bigint;
  n_adendas    bigint;
  n_links      bigint;
  n_graph      bigint;
begin
  perform private.assert_superadmin_password(p_password);

  select email, role::text into v_email, v_role
  from public.profiles where id = p_user_id;

  if v_email is null then
    raise exception 'La cuenta no existe.';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'No puedes eliminar tu propia cuenta.';
  end if;
  if v_role = 'superadmin' then
    raise exception 'Las cuentas de plataforma no se eliminan desde aquí.';
  end if;

  -- Se cuentan las consultas INCLUIDAS las borradas en suave: siguen siendo
  -- historia clínica retenida y siguen apuntando a este médico.
  select count(*) into n_consultas from public.consultations where medico_id = p_user_id;
  select count(*) into n_pacientes from public.patients      where created_by = p_user_id;
  select count(*) into n_citas     from public.appointments  where medico_id = p_user_id;
  select count(*) into n_adendas   from public.consultation_addenda where author_id = p_user_id;
  select count(*) into n_links     from public.agent_links   where created_by = p_user_id;
  select count(*) into n_graph     from public.graph_interactions where user_id = p_user_id;

  if (n_consultas + n_pacientes + n_citas + n_adendas + n_links + n_graph) > 0 then
    raise exception
      'No se puede eliminar: la cuenta tiene % consultas, % pacientes, % citas y % registros más. Su historia clínica debe conservarse: usa Dar de baja.',
      n_consultas, n_pacientes, n_citas, (n_adendas + n_links + n_graph);
  end if;

  -- La auditoría sobrevive: audit_events.actor_id no tiene clave foránea.
  insert into public.audit_events (organization_id, actor_id, actor_name, accion, detalle)
  values (
    private.current_org(), (select auth.uid()),
    (select coalesce(full_name, email) from public.profiles where id = (select auth.uid())),
    'Cuenta eliminada definitivamente',
    format('%s (%s) · sin historia clínica asociada', v_email, p_user_id)
  );

  -- profiles, identities, sessions y graph_memory caen por cascada.
  delete from auth.users where id = p_user_id;
end;
$$;

-- Mover de organización. Ya se podía con un UPDATE directo desde la app, pero
-- sin dejar rastro y con el organization_id del actor, no el de destino.
create or replace function public.superadmin_move_user(
  p_user_id uuid,
  p_org_id  uuid,
  p_role    text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email    text;
  v_rol_ini  text;
  v_org_ini  uuid;
  v_rol_fin  text;
  v_org_nom  text;
begin
  if not (select private.is_superadmin()) then
    raise exception 'No autorizado';
  end if;

  select email, role::text, organization_id into v_email, v_rol_ini, v_org_ini
  from public.profiles where id = p_user_id;

  if v_email is null then raise exception 'La cuenta no existe.'; end if;
  if v_rol_ini = 'superadmin' then
    raise exception 'Las cuentas de plataforma no se reasignan desde aquí.';
  end if;

  select name into v_org_nom from public.organizations where id = p_org_id;
  if v_org_nom is null then raise exception 'La organización no existe.'; end if;

  -- Sin p_role se CONSERVA el rol actual. Esto arregla un fallo real de la
  -- pantalla de usuarios: al mover una secretaria, el desplegable de rol no
  -- tenía su opción, el navegador seleccionaba la primera (médico) y guardar
  -- solo la organización le quitaba el rol en silencio.
  v_rol_fin := coalesce(nullif(p_role, ''), v_rol_ini);
  if v_rol_fin not in ('medico', 'supervisor', 'admin', 'secretaria') then
    raise exception 'Rol no asignable desde la consola.';
  end if;

  insert into public.audit_events (organization_id, actor_id, actor_name, accion, detalle)
  values (
    private.current_org(), (select auth.uid()),
    (select coalesce(full_name, email) from public.profiles where id = (select auth.uid())),
    'Usuario reasignado',
    format('%s · %s → %s%s', v_email, coalesce(v_org_ini::text, '—'), v_org_nom,
           case when v_rol_fin = v_rol_ini then '' else format(' · rol %s → %s', v_rol_ini, v_rol_fin) end)
  );

  update public.profiles
  set organization_id = p_org_id, role = v_rol_fin
  where id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Organizaciones
-- ---------------------------------------------------------------------------

-- Archivar / restaurar. ESTA es la vía normal para dar de baja un hospital.
create or replace function public.superadmin_archive_organization(
  p_org_id   uuid,
  p_password text,
  p_archived boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  perform private.assert_superadmin_password(p_password);

  select name into v_name from public.organizations where id = p_org_id;
  if v_name is null then raise exception 'La organización no existe.'; end if;

  if p_archived and p_org_id = private.current_org() then
    raise exception 'No puedes archivar tu propia organización.';
  end if;

  insert into public.audit_events (organization_id, actor_id, actor_name, accion, detalle)
  values (
    private.current_org(), (select auth.uid()),
    (select coalesce(full_name, email) from public.profiles where id = (select auth.uid())),
    case when p_archived then 'Organización archivada' else 'Organización restaurada' end,
    format('%s (%s)', v_name, p_org_id)
  );

  update public.organizations
  set archived_at = case when p_archived then now() else null end
  where id = p_org_id;
end;
$$;

-- Borrado definitivo de una organización. Solo si está COMPLETAMENTE vacía.
--
-- Sin estas guardas, un solo clic confirmado destruye por cascada las
-- consultas, los pacientes, la auditoría, las citas, los vínculos de agente y
-- las adendas de esa organización. Es decir: derrotaría por completo el diseño
-- de borrado suave con retención que sostiene el resto de la app.
create or replace function public.superadmin_delete_organization(
  p_org_id   uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name      text;
  n_miembros  bigint;
  n_consultas bigint;
  n_pacientes bigint;
begin
  perform private.assert_superadmin_password(p_password);

  select name into v_name from public.organizations where id = p_org_id;
  if v_name is null then raise exception 'La organización no existe.'; end if;
  if p_org_id = private.current_org() then
    raise exception 'No puedes eliminar tu propia organización.';
  end if;

  select count(*) into n_miembros  from public.profiles      where organization_id = p_org_id;
  select count(*) into n_consultas from public.consultations where organization_id = p_org_id;
  select count(*) into n_pacientes from public.patients      where organization_id = p_org_id;

  if (n_miembros + n_consultas + n_pacientes) > 0 then
    raise exception
      'No se puede eliminar: «%» tiene % miembros, % consultas y % pacientes, y borrarla destruiría esa historia clínica. Archívala, o mueve a sus miembros primero.',
      v_name, n_miembros, n_consultas, n_pacientes;
  end if;

  -- La auditoría se escribe con la organización DEL ACTOR, no con p_org_id:
  -- audit_events.organization_id cascadea, así que una fila apuntando a la
  -- organización que se borra desaparecería junto con ella.
  insert into public.audit_events (organization_id, actor_id, actor_name, accion, detalle)
  values (
    private.current_org(), (select auth.uid()),
    (select coalesce(full_name, email) from public.profiles where id = (select auth.uid())),
    'Organización eliminada definitivamente',
    format('«%s» (%s) · estaba vacía: sin miembros, consultas ni pacientes', v_name, p_org_id)
  );

  delete from public.organizations where id = p_org_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Permisos
-- ---------------------------------------------------------------------------

revoke all on function public.superadmin_deactivate_user(uuid, text, text) from public, anon;
revoke all on function public.superadmin_reactivate_user(uuid, text) from public, anon;
revoke all on function public.superadmin_delete_user(uuid, text) from public, anon;
revoke all on function public.superadmin_move_user(uuid, uuid, text) from public, anon;
revoke all on function public.superadmin_archive_organization(uuid, text, boolean) from public, anon;
revoke all on function public.superadmin_delete_organization(uuid, text) from public, anon;

grant execute on function public.superadmin_deactivate_user(uuid, text, text) to authenticated;
grant execute on function public.superadmin_reactivate_user(uuid, text) to authenticated;
grant execute on function public.superadmin_delete_user(uuid, text) to authenticated;
grant execute on function public.superadmin_move_user(uuid, uuid, text) to authenticated;
grant execute on function public.superadmin_archive_organization(uuid, text, boolean) to authenticated;
grant execute on function public.superadmin_delete_organization(uuid, text) to authenticated;
