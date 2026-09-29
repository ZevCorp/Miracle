-- ============================================================================
-- Ajustes por organización para la página de Configuración institucional.
-- El nombre y el NIT ya son columnas de public.organizations; aquí se añaden los
-- toggles que la maqueta no persistía. La política RLS "admin updates own org"
-- (migración 20260628000000) ya permite que el admin los actualice.
-- Idempotente.
-- ============================================================================

alter table public.organizations
  add column if not exists require_consent        boolean not null default true,
  add column if not exists use_hospital_templates boolean not null default true;
