-- ============================================================================
-- Conteo de consultas por estado (para los chips de filtro de /app/notas y
-- /app/consultas). SECURITY INVOKER: respeta el RLS del que llama.
-- ============================================================================

create or replace function public.consultation_status_counts()
returns table(estado text, n bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select estado, count(*) as n
  from public.consultations
  group by estado
$$;
revoke all on function public.consultation_status_counts() from public, anon;
grant execute on function public.consultation_status_counts() to authenticated;
