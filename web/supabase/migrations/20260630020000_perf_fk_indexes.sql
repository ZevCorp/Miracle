-- ============================================================================
-- Índices para foreign keys sin cubrir (rendimiento). Los advisors de Supabase
-- marcaban estas 4 FK sin índice; sin ellos, los filtros/joins por estas columnas
-- hacen scans a medida que crecen los datos.
-- Idempotente (create index if not exists).
-- ============================================================================

create index if not exists idx_audit_events_organization_id on public.audit_events (organization_id);
create index if not exists idx_consultations_medico_id       on public.consultations (medico_id);
create index if not exists idx_patients_created_by           on public.patients (created_by);
create index if not exists idx_profiles_organization_id      on public.profiles (organization_id);
