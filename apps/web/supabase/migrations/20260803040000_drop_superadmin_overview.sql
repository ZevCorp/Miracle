-- ============================================================================
-- Retira public.superadmin_overview().
--
-- Ninguna página la llama (se comprobó con una búsqueda en todo el repositorio:
-- solo aparece en su propia migración y en comentarios de otras dos). La
-- sustituyeron superadmin_dashboard() y superadmin_activity().
--
-- El motivo de fondo para quitarla y no dejarla ahí: cuenta las consultas SIN
-- filtrar `deleted_at`, así que devolvía totales distintos a las otras dos RPC
-- sobre los mismos datos. Una función viva que contradice a la que sí se usa es
-- una trampa esperando a que alguien la llame "porque ya existe".
--
-- Su definición sigue en 20260630040000_superadmin_overview_rpc.sql por si
-- hiciera falta recuperarla.
-- ============================================================================

drop function if exists public.superadmin_overview();
