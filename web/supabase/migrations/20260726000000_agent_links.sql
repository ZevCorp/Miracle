-- Emparejamiento con el agente de escritorio (Ü / SAP).
--
-- EL PROBLEMA: mientras el médico dicta, el portal produce conceptos clínicos
-- (talla, peso, TA…). Un agente que corre en el PC del hospital debe poder leerlos
-- para irlos escribiendo en los campos de SAP. Pero ese agente no tiene sesión de
-- Supabase, y meterle el JWT del médico en una aplicación de escritorio sería dejar
-- una credencial real suelta en una máquina compartida.
--
-- LA SALIDA: un código corto, de un solo uso lógico, atado a UNA consulta. El agente
-- lo pega una vez; la función se lo canjea por los conceptos y por nada más. Quien
-- tenga el código obtiene nueve números — nunca la nota, el paciente ni el historial.
-- Y el código es la referencia a la consulta, así que también resuelve de qué
-- consulta hablamos sin inventar otro identificador.
--
-- CADUCIDAD DOBLE, a propósito: 8 horas (un turno) Y muere al firmar la consulta.
-- Lo primero que ocurra. Solo tiempo dejaría vivo un código sobre una consulta ya
-- cerrada; solo estado dejaría vivo para siempre uno de un borrador olvidado.

create table public.agent_links (
  code text primary key,
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '8 hours',
  revoked_at timestamptz,
  -- Para auditar el PRIMER uso sin escribir una fila por cada sondeo: el agente
  -- pregunta cada 1,5 s, y auditar eso ahogaría audit_events hasta volverlo inútil.
  first_used_at timestamptz,
  last_used_at timestamptz
);

alter table public.agent_links enable row level security;
create index on public.agent_links (consultation_id);

-- Sin policies y sin grants: igual que rate_limits, nadie toca la tabla directo.
-- Todo pasa por las dos funciones de abajo, que son la superficie auditada.
revoke all on table public.agent_links from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Crear el código. La llama el médico dueño de la consulta, con su sesión.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.create_agent_link(p_consultation_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_code text;
begin
  -- Solo el médico DUEÑO. No se acepta admin ni supervisor: emparejar un agente
  -- externo con una consulta es un acto del que la atiende, no de quien la supervisa.
  select c.organization_id into v_org
  from public.consultations c
  where c.id = p_consultation_id
    and c.medico_id = auth.uid()
    and c.organization_id = (select private.current_org());

  if v_org is null then
    raise exception 'consulta no encontrada o no es tuya' using errcode = '42501';
  end if;

  -- Un código vivo por consulta: pedirlo otra vez revoca el anterior. Si un médico
  -- vuelve a generarlo es porque el de antes se le perdió, y un código perdido que
  -- sigue funcionando es justo lo que no queremos.
  update public.agent_links
  set revoked_at = now()
  where consultation_id = p_consultation_id and revoked_at is null;

  -- 8 caracteres de un alfabeto sin ambigüedades visuales (sin 0/O, 1/I/L): se dicta
  -- y se teclea a mano, así que confundir un carácter no puede costar un intento.
  v_code := (
    select string_agg(
      substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), ''
    )
    from generate_series(1, 8)
  );

  insert into public.agent_links (code, consultation_id, organization_id, created_by)
  values (v_code, p_consultation_id, v_org, auth.uid());

  insert into public.audit_events (organization_id, consultation_id, accion, detalle)
  values (v_org, p_consultation_id, 'agent_link_creado',
          'Se generó un código de emparejamiento para el agente de escritorio.');

  return v_code;
end;
$$;

revoke all on function public.create_agent_link(uuid) from public, anon;
grant execute on function public.create_agent_link(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Canjear el código por los conceptos. La llama la ruta /api/agent/values, que va
-- con la clave anónima: la función es la ÚNICA que ve la consulta.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.agent_note_for_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.agent_links%rowtype;
  v_note jsonb;
  v_estado text;
  v_first boolean;
begin
  select * into v_link from public.agent_links where code = upper(trim(p_code));

  if v_link.code is null
     or v_link.revoked_at is not null
     or v_link.expires_at < now() then
    -- Un solo mensaje para «no existe», «revocado» y «caducado»: distinguirlos le
    -- diría a quien prueba códigos al azar cuáles existieron alguna vez.
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select c.note, c.estado into v_note, v_estado
  from public.consultations c
  where c.id = v_link.consultation_id;

  -- Consulta firmada: el código muere aquí mismo, no cuando venza el reloj.
  if v_estado is distinct from 'borrador' then
    update public.agent_links set revoked_at = now() where code = v_link.code;
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;

  v_first := v_link.first_used_at is null;
  update public.agent_links
  set first_used_at = coalesce(first_used_at, now()), last_used_at = now()
  where code = v_link.code;

  -- Auditoría SOLO del primer uso. El sondeo son ~40 lecturas por minuto; una fila
  -- por lectura convertiría la bitácora en ruido y escondería lo que sí importa:
  -- que un agente externo empezó a leer esta consulta, y cuándo.
  if v_first then
    insert into public.audit_events (organization_id, consultation_id, accion, detalle)
    values (v_link.organization_id, v_link.consultation_id, 'agent_link_usado',
            'El agente de escritorio empezó a leer los conceptos de esta consulta.');
  end if;

  -- Devuelve la NOTA, no los conceptos: extraerlos en plpgsql duplicaría en SQL una
  -- lógica que ya vive —probada— en lib/clinical/vital-concepts.ts. La ruta la
  -- convierte y solo entonces sale del servidor; el agente nunca ve esta nota.
  return jsonb_build_object('ok', true, 'note', coalesce(v_note, '[]'::jsonb));
end;
$$;

revoke all on function public.agent_note_for_code(text) from public;
grant execute on function public.agent_note_for_code(text) to anon, authenticated;

comment on function public.agent_note_for_code(text) is
  'Canjea un código de emparejamiento por la nota de su consulta. La ruta /api/agent/values la convierte a conceptos; la nota nunca sale del servidor.';
