-- ============================================================================
-- Índices que la consola de super-admin da por hechos y no existían.
--
-- Las tres consultas que vienen (explorador de auditoría paginado, dashboard
-- con rango de fechas ajustable y las alertas de borradores estancados) ordenan
-- y filtran por `fecha`, y hoy cada página hace un sort completo de la tabla.
-- Con 638 eventos no se nota; el explorador con paginación de 50 y el rango de
-- 365 días sí lo notarían.
--
-- Sin `concurrently`: las migraciones de Supabase corren dentro de una
-- transacción (que lo prohíbe) y a este volumen el lock es imperceptible.
-- ============================================================================

-- Explorador de actividad: `order by fecha desc` + `.range()` en cada página.
create index if not exists audit_events_fecha_idx
  on public.audit_events (fecha desc);

-- Dashboard por rango y "borradores estancados". Parcial por `deleted_at is
-- null` porque TODA consulta de la consola arrastra ese filtro: el índice queda
-- más pequeño y no indexa filas que nadie va a leer.
create index if not exists consultations_fecha_idx
  on public.consultations (fecha desc)
  where deleted_at is null;

-- Salud: fallidas y atascadas se buscan siempre por estado + ventana temporal.
create index if not exists clinical_encounters_status_updated_idx
  on public.clinical_encounters (status, updated_at desc);
