-- ============================================================================
-- Medición de impacto — capa de ADMINISTRACIÓN (roster, fases, códigos, config).
--
-- Vive en el portal porque es lo que gestiona el superadmin y lo que se lee junto
-- a organizations/profiles/consultations. Las tablas de INGESTA (metrics_devices,
-- metrics_shifts, metrics_samples…) las crea Graph en su propia migración
-- (20260901000000_metrics_terreno.sql); las dos migraciones aplican al MISMO
-- Postgres compartido (proyecto miracle-app). Esta migración asume que aquella ya
-- corrió (usa metrics_devices y metrics_org_secrets en sus RPCs).
--
-- Modelo de escritura: tablas sin política para anon/authenticated + RPCs
-- SECURITY DEFINER con barrera private.is_superadmin(). Es el mismo patrón que la
-- consola ya usa (superadmin_*), y NO usa service-role — postura de seguridad del
-- repo (AGENTS.md, aprendizaje nº15 del cliente Windows).
-- ============================================================================

-- ── Roster: los médicos del estudio, por organización ───────────────────────
-- Tabla PROPIA, no profiles: el baseline arranca con médicos que aún no tienen
-- cuenta del portal (baseline = SIN Miracle). profile_id se llena al empezar la
-- fase Notes, y es el puente para poner la telemetría de Notes al lado.
create table if not exists public.metrics_roster (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  display_name text not null,
  sap_users text[] not null default '{}',
  active boolean not null default true,
  sort_order int not null default 0,
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, display_name)
);
alter table public.metrics_roster enable row level security;
create index if not exists metrics_roster_org_idx on public.metrics_roster (organization_id, sort_order);

-- ── Calendario de fases del estudio ─────────────────────────────────────────
-- La fase de un turno SIEMPRE es derivable de aquí por fecha; el snapshot en el
-- turno es cache. Cambiar el calendario re-etiqueta el pasado sin tocar datos.
create table if not exists public.metrics_study_phases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phase text not null check (phase in ('baseline','notes','notes_ops')),
  starts_on date not null,
  ends_on date,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.metrics_study_phases enable row level security;
create index if not exists metrics_phases_org_idx on public.metrics_study_phases (organization_id, starts_on);

-- La fase vigente de una org en una fecha (el último tramo que empezó en o antes).
create or replace function public.metrics_phase_at(p_org uuid, p_fecha date)
returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select ph.phase from public.metrics_study_phases ph
      where ph.organization_id = p_org
        and ph.starts_on <= p_fecha
        and (ph.ends_on is null or ph.ends_on >= p_fecha)
      order by ph.starts_on desc limit 1),
    'baseline');
$$;

-- ── Códigos de enrolamiento ─────────────────────────────────────────────────
-- Alfabeto sin ambiguos (0/O, 1/I/L): se teclea a mano una vez por PC. El
-- superadmin lo genera; Graph lo canjea.
create table if not exists public.metrics_enrollment_codes (
  code text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  max_uses int not null default 20,
  uses int not null default 0,
  expires_at timestamptz not null default (now() + interval '72 hours'),
  created_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.metrics_enrollment_codes enable row level security;

-- ── Config remota por org (versionada) ──────────────────────────────────────
-- reglas de extracción del ID, allowlists de apps/dominios, cadencias, umbrales.
-- Cambiar una regla para todo un hospital es un UPDATE aquí, sin tocar binarios.
create table if not exists public.metrics_org_config (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  version int not null default 1,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.metrics_org_config enable row level security;

-- ============================================================================
-- RPCs de provisión que canjea Graph (service-role). Tocan tablas de los dos
-- lados (códigos/config aquí, devices/secretos en Graph) — pueden porque es el
-- mismo Postgres. SECURITY DEFINER; sin barrera de rol porque las llama el
-- backend con service-role, no un usuario.
-- ============================================================================

-- Canjea un código: valida vigencia+usos, crea el dispositivo, asegura el secreto
-- v1 de la org, y devuelve identidad + config + roster + fases. Todo en una
-- transacción: dos PCs con el mismo código a la vez no descuadran los usos.
create or replace function public.metrics_enroll_device(
  p_code text, p_machine text, p_os text, p_app_version text)
returns table(
  device_id uuid, organization_id uuid, org_name text,
  hmac_version int, secret text, config_version int, config jsonb,
  roster jsonb, phases jsonb)
language plpgsql security definer set search_path = public as $$
declare
  v_code record;
  v_device uuid;
  v_secret text;
  v_config record;
begin
  select * into v_code from public.metrics_enrollment_codes
   where code = upper(p_code)
   for update;

  if not found or v_code.revoked_at is not null
     or v_code.expires_at < now() or v_code.uses >= v_code.max_uses then
    return; -- Graph traduce el conjunto vacío a 410
  end if;

  update public.metrics_enrollment_codes set uses = uses + 1 where code = v_code.code;

  insert into public.metrics_devices(organization_id, machine_name, os_version, app_version, enrolled_with_code)
  values (v_code.organization_id, coalesce(p_machine,''), coalesce(p_os,''), coalesce(p_app_version,''), v_code.code)
  returning id into v_device;

  -- El secreto HMAC (tabla de Graph, sin políticas): asegurar v1 y traerlo.
  select s.secret into v_secret
  from public.metrics_ensure_org_secret(v_code.organization_id, encode(gen_random_bytes(32), 'base64')) s(k, secret)
  limit 1;

  select c.version, c.config into v_config
  from public.metrics_org_config c where c.organization_id = v_code.organization_id;

  update public.metrics_devices
     set hmac_version = 1, config_version = coalesce(v_config.version, 0)
   where id = v_device;

  return query
  select
    v_device,
    v_code.organization_id,
    (select o.name from public.organizations o where o.id = v_code.organization_id),
    1,
    v_secret,
    coalesce(v_config.version, 0),
    coalesce(v_config.config, '{}'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'display_name', r.display_name) order by r.sort_order)
              from public.metrics_roster r
              where r.organization_id = v_code.organization_id and r.active), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('phase', ph.phase, 'starts_on', ph.starts_on, 'ends_on', ph.ends_on) order by ph.starts_on)
              from public.metrics_study_phases ph
              where ph.organization_id = v_code.organization_id), '[]'::jsonb);
end;
$$;

-- Config/heartbeat: refresca last_seen y devuelve lo nuevo (o {unchanged:true}).
-- Si el device quedó viejo de hmac, incluye el secreto nuevo. Un device pausado
-- o retirado devuelve su status para que el cliente se detenga.
create or replace function public.metrics_device_config(
  p_device uuid, p_config_version int, p_hmac_version int)
returns table(status text, payload jsonb)
language plpgsql security definer set search_path = public as $$
declare
  v_dev record;
  v_config record;
begin
  select * into v_dev from public.metrics_devices where id = p_device;
  if not found then return; end if;

  update public.metrics_devices set last_seen_at = now() where id = p_device;

  if v_dev.status <> 'active' then
    return query select v_dev.status, '{}'::jsonb;
    return;
  end if;

  select c.version, c.config into v_config
  from public.metrics_org_config c where c.organization_id = v_dev.organization_id;

  if coalesce(v_config.version, 0) = p_config_version and v_dev.hmac_version = p_hmac_version then
    return query select 'active'::text, jsonb_build_object('unchanged', true);
    return;
  end if;

  return query select 'active'::text, jsonb_build_object(
    'config_version', coalesce(v_config.version, 0),
    'config', coalesce(v_config.config, '{}'::jsonb),
    'roster', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'display_name', r.display_name) order by r.sort_order)
                        from public.metrics_roster r
                        where r.organization_id = v_dev.organization_id and r.active), '[]'::jsonb),
    'phases', coalesce((select jsonb_agg(jsonb_build_object('phase', ph.phase, 'starts_on', ph.starts_on, 'ends_on', ph.ends_on) order by ph.starts_on)
                        from public.metrics_study_phases ph
                        where ph.organization_id = v_dev.organization_id), '[]'::jsonb));
end;
$$;

-- ============================================================================
-- RPCs de administración para la consola (superadmin). Con barrera de rol.
-- ============================================================================

create or replace function public.superadmin_metrics_generar_codigo(p_org uuid, p_max_uses int default 20)
returns text
language plpgsql security definer set search_path = public as $$
declare v_code text; v_alfabeto text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; i int;
begin
  if not private.is_superadmin() then raise exception 'solo superadmin'; end if;
  v_code := '';
  for i in 1..8 loop
    v_code := v_code || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
  end loop;
  insert into public.metrics_enrollment_codes(code, organization_id, max_uses, created_by)
  values (v_code, p_org, greatest(1, coalesce(p_max_uses, 20)), auth.uid());
  return v_code;
end;
$$;

create or replace function public.superadmin_metrics_guardar_roster(p_org uuid, p_medicos jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare m jsonb;
begin
  if not private.is_superadmin() then raise exception 'solo superadmin'; end if;
  -- upsert por (org, display_name); no borra: desactivar es active=false, para no
  -- perder la referencia de turnos ya medidos con ese médico.
  for m in select * from jsonb_array_elements(p_medicos) loop
    insert into public.metrics_roster(organization_id, display_name, sap_users, active, sort_order, profile_id)
    values (p_org, m->>'display_name',
            coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(m->'sap_users','[]'::jsonb)) x), '{}'),
            coalesce((m->>'active')::boolean, true),
            coalesce((m->>'sort_order')::int, 0),
            nullif(m->>'profile_id','')::uuid)
    on conflict (organization_id, display_name) do update set
      sap_users = excluded.sap_users, active = excluded.active,
      sort_order = excluded.sort_order, profile_id = coalesce(excluded.profile_id, public.metrics_roster.profile_id);
  end loop;
end;
$$;

create or replace function public.superadmin_metrics_guardar_config(p_org uuid, p_config jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare v_version int;
begin
  if not private.is_superadmin() then raise exception 'solo superadmin'; end if;
  insert into public.metrics_org_config(organization_id, version, config, updated_by)
  values (p_org, 1, p_config, auth.uid())
  on conflict (organization_id) do update set
    version = public.metrics_org_config.version + 1,
    config = excluded.config, updated_at = now(), updated_by = auth.uid()
  returning version into v_version;
  return v_version;
end;
$$;

create or replace function public.superadmin_metrics_fijar_fase(p_org uuid, p_phase text, p_starts date, p_ends date default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_superadmin() then raise exception 'solo superadmin'; end if;
  insert into public.metrics_study_phases(organization_id, phase, starts_on, ends_on)
  values (p_org, p_phase, p_starts, p_ends);
end;
$$;

grant execute on function public.superadmin_metrics_generar_codigo(uuid, int) to authenticated;
grant execute on function public.superadmin_metrics_guardar_roster(uuid, jsonb) to authenticated;
grant execute on function public.superadmin_metrics_guardar_config(uuid, jsonb) to authenticated;
grant execute on function public.superadmin_metrics_fijar_fase(uuid, text, date, date) to authenticated;

comment on table public.metrics_roster is
  'Médicos del estudio por org. Tabla propia (no profiles) porque el baseline arranca sin cuentas. profile_id es el puente a la telemetría de Notes.';

-- ============================================================================
-- Seeds del Hospital General de Medellín (HGM), idempotentes y GUARDADOS: si la
-- org no existe todavía en este entorno, no fallan — dejan un aviso. NO se
-- siembran nombres de médicos: eso es dato sensible y se carga desde la consola
-- (superadmin_metrics_guardar_roster), no desde una migración del repo. Aquí solo
-- va config no sensible (reglas de extracción, allowlists) y la fase baseline.
-- ============================================================================
do $$
declare v_org uuid;
begin
  select id into v_org from public.organizations
   where kind = 'institution' and (name ilike '%medell%' or name ilike '%HGM%')
   order by created_at limit 1;

  if v_org is null then
    raise notice 'medición: no encuentro la org del HGM; los seeds de config/fase se cargan desde la consola.';
    return;
  end if;

  -- Config de medición v1: reglas de identidad (título SAP en NV2000/NWP1),
  -- allowlist de apps y dominios, cadencias. El título NUNCA se guarda: entra a
  -- la regex y sale solo el grupo capturado (el PATNR) → HMAC.
  insert into public.metrics_org_config(organization_id, version, config)
  values (v_org, 1, jsonb_build_object(
    'config_version', 1,
    'apps_por_proceso', jsonb_build_object(
      'saplogon.exe','sap','saplgpad.exe','sap','sapgui.exe','sap',
      'chrome.exe','chrome','msedge.exe','edge','firefox.exe','firefox',
      'winword.exe','office','excel.exe','office','u.exe','uexe'),
    'dominios_permitidos', jsonb_build_array(),
    'dominios_miracle', jsonb_build_array('itsmiracleai.com.co','www.itsmiracleai.com.co','miracle-web-umber.vercel.app'),
    'reglas_identidad', jsonb_build_array(
      jsonb_build_object('id','titulo-patnr','tcode','*','fuente','titulo_sap',
        'patron','(?:PATNR|[Pp]aciente|[Nn]HC)\\D*0*([0-9]{5,10})','normalizar','digitos_sin_ceros')),
    'foreground_ms', 800, 'sap_identity_ms', 1500, 'solo_foreground', false))
  on conflict (organization_id) do nothing;

  -- Fase baseline desde hoy (se mide ANTES de instalar Miracle la próxima semana).
  insert into public.metrics_study_phases(organization_id, phase, starts_on, notes)
  select v_org, 'baseline', current_date, 'baseline del piloto de urgencias'
  where not exists (
    select 1 from public.metrics_study_phases where organization_id = v_org);

  raise notice 'medición: seeds del HGM aplicados (org %).', v_org;
end $$;
