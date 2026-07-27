-- Emparejamiento con el agente de escritorio (Ü / SAP).
--
-- EL PROBLEMA: mientras el médico dicta, el portal produce conceptos clínicos
-- (talla, peso, TA…). Un agente que corre en el PC del hospital debe poder leerlos
-- para irlos escribiendo en los campos de SAP. Pero ese agente no tiene sesión de
-- Supabase, y meterle el JWT del médico en una aplicación de escritorio sería dejar
-- una credencial real suelta en una máquina compartida.
--
-- LA SALIDA: un código corto atado a UNA consulta. El agente lo pega una vez; la
-- función se lo canjea por los conceptos y por nada más. Quien tenga el código
-- obtiene nueve números — nunca la nota, el paciente ni el historial. Y el código es
-- la referencia a la consulta, así que también resuelve de qué consulta hablamos sin
-- inventar otro identificador.
--
-- POR QUÉ LOS VALORES VIVEN AQUÍ Y NO SE LEEN DE `consultations`: esa fila NO EXISTE
-- durante el dictado. Se escribe cuando el médico guarda la nota (upsertConsultation
-- en la página en vivo); mientras habla, la nota vive en el encounter del backend
-- clínico. Leer de `consultations` habría devuelto vacío exactamente durante los
-- veinte minutos en que hace falta.
--
-- Empujar los conceptos aquí tiene además una ventaja que no es accidental: el puente
-- NUNCA toca la historia clínica. Esta tabla guarda nueve números y su evidencia; si
-- algo sale mal, lo que se expone es eso y no un expediente.
--
-- `consultation_id` va SIN clave foránea a propósito: durante el dictado es el id del
-- encounter y todavía puede no tener fila espejo. Es trazabilidad, no integridad
-- referencial — el dueño real del enlace es `created_by`.
--
-- CADUCIDAD DOBLE: 8 horas (un turno) Y morir al revocarse. Lo primero que ocurra.

create table public.agent_links (
  code text primary key,
  consultation_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '8 hours',
  revoked_at timestamptz,

  -- Los conceptos que el portal va extrayendo, y su huella. El agente compara `rev`
  -- para no reescribir lo mismo cuarenta veces por minuto.
  values jsonb not null default '{}'::jsonb,
  rev text not null default '0',
  values_updated_at timestamptz,

  -- Para auditar el PRIMER uso sin escribir una fila por cada sondeo: el agente
  -- pregunta cada 1,5 s, y auditar eso ahogaría audit_events hasta volverlo inútil.
  first_used_at timestamptz,
  last_used_at timestamptz
);

alter table public.agent_links enable row level security;
create index on public.agent_links (consultation_id);
create index on public.agent_links (created_by);

-- Sin policies y sin grants: igual que rate_limits, nadie toca la tabla directo.
-- Todo pasa por las tres funciones de abajo, que son la superficie auditada.
revoke all on table public.agent_links from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Crear el código. Lo llama el médico con su sesión.
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
  v_org := (select private.current_org());
  if v_org is null or auth.uid() is null then
    raise exception 'sin sesión' using errcode = '42501';
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
  values (v_org, null, 'agent_link_creado',
          'Se generó un código de emparejamiento para el agente de escritorio.');

  return v_code;
end;
$$;

revoke all on function public.create_agent_link(uuid) from public, anon;
grant execute on function public.create_agent_link(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Empujar los conceptos. Lo llama la página en vivo mientras el médico dicta.
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
begin
  -- Solo quien creó el enlace puede alimentarlo. Sin esto, cualquier usuario con
  -- sesión podría inyectar valores en la consulta de otro — y esos valores acaban
  -- escritos en un sistema clínico.
  update public.agent_links
  set values = coalesce(p_values, '{}'::jsonb),
      rev = coalesce(p_rev, '0'),
      values_updated_at = now()
  where consultation_id = p_consultation_id
    and created_by = auth.uid()
    and revoked_at is null
    and expires_at > now();
end;
$$;

revoke all on function public.push_agent_values(uuid, jsonb, text) from public, anon;
grant execute on function public.push_agent_values(uuid, jsonb, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Canjear el código. La llama /api/agent/values con la clave anónima.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.agent_values_for_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.agent_links%rowtype;
  v_first boolean;
begin
  select * into v_link from public.agent_links where code = upper(trim(p_code));

  if v_link.code is null
     or v_link.revoked_at is not null
     or v_link.expires_at < now() then
    -- Un solo motivo para «no existe», «revocado» y «caducado»: distinguirlos le
    -- diría a quien prueba códigos al azar cuáles existieron alguna vez.
    return jsonb_build_object('ok', false, 'reason', 'invalid');
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
    values (v_link.organization_id, null, 'agent_link_usado',
            'El agente de escritorio empezó a leer los conceptos de esta consulta.');
  end if;

  return jsonb_build_object('ok', true, 'rev', v_link.rev, 'values', v_link.values);
end;
$$;

revoke all on function public.agent_values_for_code(text) from public;
grant execute on function public.agent_values_for_code(text) to anon, authenticated;

comment on table public.agent_links is
  'Emparejamiento portal ↔ agente de escritorio. Guarda SOLO conceptos clínicos (talla, peso, TA…), nunca la nota ni el paciente.';
