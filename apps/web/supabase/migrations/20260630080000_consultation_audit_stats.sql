-- ============================================================================
-- Métricas de auditoría/calidad calculadas en la base (reemplaza los reduce/filter
-- sobre todo el arreglo en el cliente). Replica la fórmula de `completitud`:
-- 5 ítems (identificación + finalidad siempre; dx CIE-10 aceptado; proc CUPS
-- aceptado; nota aprobada/exportada). SECURITY INVOKER → respeta el RLS del que
-- llama. Guardas jsonb_typeof por si `codigos` no fuera un arreglo.
-- ============================================================================

create or replace function public.consultation_audit_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with c as (
    select
      estado,
      (select count(*) from jsonb_array_elements(
         case when jsonb_typeof(codigos) = 'array' then codigos else '[]'::jsonb end) e
         where e->>'sistema' = 'CIE-10' and e->>'estado' = 'aceptado') > 0 as has_dx,
      (select count(*) from jsonb_array_elements(
         case when jsonb_typeof(codigos) = 'array' then codigos else '[]'::jsonb end) e
         where e->>'sistema' = 'CUPS' and e->>'estado' = 'aceptado') > 0 as has_proc
    from public.consultations
  )
  select jsonb_build_object(
    'total', count(*),
    'por_revisar', count(*) filter (where estado in ('borrador', 'revisada')),
    'con_dx', count(*) filter (where has_dx),
    'promedio_completitud', coalesce(round(avg(
      (2
       + (case when has_dx then 1 else 0 end)
       + (case when has_proc then 1 else 0 end)
       + (case when estado in ('aprobada', 'exportada') then 1 else 0 end)
      ) * 100.0 / 5
    )), 0)
  )
  from c
$$;
revoke all on function public.consultation_audit_stats() from public, anon;
grant execute on function public.consultation_audit_stats() to authenticated;
