-- Un empujon VACIO no es una nota: es "nada que informar".
--
-- Al generar el codigo, el panel del portal empuja de inmediato lo que tenga en memoria, y si
-- la nota aun no trae signos vitales eso es {}. Verificado el 2026-07-28: el codigo XAN444DJ
-- nacio a las 20:30:15.459 y quedo con values_updated_at 20:30:15.635 y cero valores — 176 ms
-- despues de nacer. Como la lectura toma "la mas reciente", ese enlace vacio tapaba la nota
-- buena de las 20:26 y el agente veia cero datos con un codigo perfectamente valido.
--
-- Se corrige por los dos lados:
--   1. push no sella values_updated_at cuando el payload viene vacio.
--   2. la lectura ignora los enlaces sin valores, que ademas repara los ya sellados.
--
-- Efecto colateral consciente: si el medico guarda una nota SIN signos vitales, el agente
-- sigue viendo los de la nota anterior en vez de quedarse a cero. Para una demo es lo que se
-- quiere; en produccion habria que distinguir "no dijo nada" de "dijo que no hay".

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
  v_values jsonb := coalesce(p_values, '{}'::jsonb);
begin
  if auth.uid() is null then
    raise exception 'sin sesion' using errcode = '42501';
  end if;

  -- Nada que guardar: no se toca el enlace. Sellarlo lo convertiria en "la nota mas
  -- reciente" y taparia a la que si tiene datos.
  if v_values = '{}'::jsonb then
    return;
  end if;

  update public.agent_links
  set values = v_values,
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

  v_code := (
    select string_agg(
      substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), ''
    )
    from generate_series(1, 8)
  );

  insert into public.agent_links
    (code, consultation_id, organization_id, created_by, values, rev, values_updated_at)
  values
    (v_code, p_consultation_id, v_org, auth.uid(), v_values, coalesce(p_rev, '0'), now());
end;
$$;

revoke all on function public.push_agent_values(uuid, jsonb, text) from public, anon;
grant execute on function public.push_agent_values(uuid, jsonb, text) to authenticated;

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

  if v_link.code is null or v_link.revoked_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  v_first := v_link.first_used_at is null;
  update public.agent_links
  set first_used_at = coalesce(first_used_at, now()), last_used_at = now()
  where code = v_link.code;

  if v_first then
    insert into public.audit_events (organization_id, consultation_id, accion, detalle)
    values (v_link.organization_id, null, 'agent_link_usado',
            'El agente de escritorio empezo a leer los conceptos clinicos de este medico.');
  end if;

  -- La ultima nota CON DATOS de este medico. El "<> {}" no es paranoia: repara los enlaces
  -- que ya quedaron sellados vacios antes de este arreglo.
  select al.values, al.rev into v_values, v_rev
  from public.agent_links al
  where al.created_by = v_link.created_by
    and al.organization_id = v_link.organization_id
    and al.revoked_at is null
    and al.values_updated_at is not null
    and al.values is not null
    and al.values <> '{}'::jsonb
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
