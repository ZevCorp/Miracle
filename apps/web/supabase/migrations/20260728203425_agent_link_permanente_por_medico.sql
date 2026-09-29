-- El codigo del agente pasa de atarse a UNA consulta a atarse al MEDICO.
--
-- POR QUE: el codigo se creaba con create_agent_link(consulta) y push_agent_values solo
-- escribia en la fila de ESA consulta. Al guardar la nota siguiente, el update no encontraba
-- fila, no actualizaba nada y NO DABA ERROR: el agente se quedaba diciendo "esperando a que
-- guardes la nota" mientras el medico ya la habia guardado. Verificado el 2026-07-28 con el
-- codigo XAN444DJ: valido, sin revocar, y devolviendo rev=0 y cero valores para siempre.
--
-- Dos cambios y ninguno inventa conceptos nuevos:
--   1. push crea el enlace si no existe, asi los valores de cada nota guardada siempre quedan.
--   2. la lectura devuelve los valores MAS RECIENTES del dueno del codigo, no los de la
--      consulta donde el codigo nacio.
--
-- Y el codigo deja de caducar. Es una decision deliberada para un entorno de demostracion:
-- se cambia comodidad por alcance. Quien tenga un codigo ve los signos vitales de la ultima
-- nota de ese medico, de forma continuada, en vez de los de una consulta durante ocho horas.
-- Sigue sin dar acceso a la nota, al paciente ni al historial, y revoked_at lo mata al
-- instante. Antes de que esto atienda pacientes de verdad hay que atarlo a la INSTALACION y
-- devolverle una caducidad.

alter table public.agent_links alter column expires_at set default (now() + interval '10 years');
update public.agent_links set expires_at = now() + interval '10 years' where revoked_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- push: si no hay enlace para esta consulta, se crea. Antes se perdia en silencio.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.push_agent_values(
  p_consultation_id uuid,
  p_values jsonb,
  p_rev text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'sin sesion' using errcode = '42501';
  end if;

  -- Solo quien creo el enlace puede alimentarlo: sin esto, cualquier usuario con sesion
  -- inyectaria valores en la consulta de otro, y esos valores acaban escritos en SAP.
  update public.agent_links
  set values = coalesce(p_values, '{}'::jsonb),
      rev = coalesce(p_rev, '0'),
      values_updated_at = now()
  where consultation_id = p_consultation_id
    and created_by = auth.uid()
    and revoked_at is null;

  if found then return; end if;

  v_org := (select private.current_org());
  if v_org is null then
    raise exception 'sin organizacion' using errcode = '42501';
  end if;

  -- Enlace de almacenamiento: nace sin que nadie pulse "generar codigo". El codigo existe
  -- porque es la clave primaria, no porque haya que enseñarselo a nadie.
  v_code := (
    select string_agg(
      substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), ''
    )
    from generate_series(1, 8)
  );

  insert into public.agent_links
    (code, consultation_id, organization_id, created_by, values, rev, values_updated_at)
  values
    (v_code, p_consultation_id, v_org, auth.uid(),
     coalesce(p_values, '{}'::jsonb), coalesce(p_rev, '0'), now());
end;
$$;

revoke all on function public.push_agent_values(uuid, jsonb, text) from public, anon;
grant execute on function public.push_agent_values(uuid, jsonb, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- lectura: la ultima nota guardada por el dueno del codigo, no la consulta de origen.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.agent_values_for_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.agent_links%rowtype;
  v_values jsonb;
  v_rev text;
  v_first boolean;
begin
  select * into v_link from public.agent_links where code = upper(trim(p_code));

  -- Un solo motivo para "no existe" y "revocado": distinguirlos le diria a quien prueba
  -- codigos al azar cuales existieron alguna vez.
  if v_link.code is null or v_link.revoked_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  v_first := v_link.first_used_at is null;
  update public.agent_links
  set first_used_at = coalesce(first_used_at, now()), last_used_at = now()
  where code = v_link.code;

  -- Auditoria SOLO del primer uso: el sondeo son ~40 lecturas por minuto y una fila por
  -- lectura convertiria la bitacora en ruido.
  if v_first then
    insert into public.audit_events (organization_id, consultation_id, accion, detalle)
    values (v_link.organization_id, null, 'agent_link_usado',
            'El agente de escritorio empezo a leer los conceptos clinicos de este medico.');
  end if;

  select al.values, al.rev into v_values, v_rev
  from public.agent_links al
  where al.created_by = v_link.created_by
    and al.organization_id = v_link.organization_id
    and al.revoked_at is null
    and al.values_updated_at is not null
  order by al.values_updated_at desc
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'rev', coalesce(v_rev, '0'),
    'values', coalesce(v_values, '{}'::jsonb));
end;
$$;

revoke all on function public.agent_values_for_code(text) from public;
grant execute on function public.agent_values_for_code(text) to anon, authenticated;

comment on table public.agent_links is
  'Emparejamiento portal <-> agente de escritorio. Guarda SOLO conceptos clinicos (talla, peso, TA...), nunca la nota ni el paciente. El codigo identifica al MEDICO: la lectura devuelve su nota guardada mas reciente.';
