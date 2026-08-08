-- ============================================================================
-- Cuenta demo: flag `profiles.is_demo`.
--
-- Para qué: una sola cuenta comercial que recorre TODO el producto en una
-- presentación, sin cambiar de usuario a mitad de la demo.
--
-- Cómo funciona (y por qué es seguro):
--   · La cuenta demo tiene rol `admin`, que por RLS ya lee toda SU organización.
--     No se toca ninguna política de RLS en esta migración.
--   · `is_demo` ACOTA la INTERFAZ a la superficie de un médico: inicio,
--     consultas (incluidas /nueva y /en-vivo), pacientes, notas y plantillas.
--     Ver DEMO_SECTIONS en lib/auth/roles.ts. La demo se enseña a médicos, así
--     que no muestra auditoría, reportes, usuarios ni configuración
--     institucional, aunque su rol admin las alcanzaría.
--     (Hasta 2026-08-08 el flag hacía lo contrario: destapaba secciones.)
--   · NO otorga acceso a datos: la RLS sigue siendo la autoridad y sigue
--     acotando todo a la organización del usuario. Una cuenta demo jamás ve
--     datos de otra organización, tenga el flag o no.
--   · NO abre /superadmin: la consola de plataforma sigue siendo exclusiva del
--     rol superadmin (se decide por rol, nunca por este flag).
--
-- Marcarla es exclusivo del superadmin (trigger abajo), igual que el rol de
-- plataforma: así una cuenta normal no puede auto-asignarse el flag para
-- destapar secciones de interfaz que su rol no debería ver.
-- ============================================================================

alter table public.profiles
  add column if not exists is_demo boolean not null default false;

comment on column public.profiles.is_demo is
  'Cuenta de demostración comercial: acota la INTERFAZ a la superficie de un médico (inicio, consultas, pacientes, notas, plantillas), aunque el rol alcance más. No otorga acceso a datos (la RLS sigue acotando por organización). Solo un superadmin puede asignarlo.';

-- Solo un superadmin puede activar o desactivar el flag ------------------------
-- `auth.uid() is null` = la sentencia no viene de una sesión de usuario, sino de
-- una conexión administrativa (SQL Editor, migraciones, service-role). Ahí se
-- permite: es como se siembra la cuenta demo, y esas conexiones ya pueden
-- escribir cualquier cosa en la base — la guarda que importa es la del API.
create or replace function private.prevent_demo_flag_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.is_demo is distinct from old.is_demo
     and auth.uid() is not null
     and not private.is_superadmin() then
    raise exception 'Solo un superadmin puede marcar una cuenta como demo.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_demo_flag_escalation() from public;

drop trigger if exists prevent_demo_flag_escalation on public.profiles;
create trigger prevent_demo_flag_escalation
  before update on public.profiles
  for each row execute function private.prevent_demo_flag_escalation();

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN contra la base viva (SQL Editor de Supabase):
--
--   -- (a) Como un admin normal, esto debe fallar con 42501:
--   --     update public.profiles set is_demo = true where id = auth.uid();
--
--   -- (b) Confirmar que la columna existe y quién la tiene activa:
--   select id, email, role, is_demo from public.profiles where is_demo;
-- -----------------------------------------------------------------------------
