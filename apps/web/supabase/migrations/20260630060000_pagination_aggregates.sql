-- ============================================================================
-- Agregados en la base para las páginas de lista paginadas (RSC), reemplazando
-- los escaneos en el cliente (N+1 de conteo de consultas por paciente, etc.).
-- SECURITY INVOKER: corren bajo el RLS del que llama, así que respetan el
-- aislamiento por organización/rol automáticamente.
-- ============================================================================

-- Conteo de consultas por paciente (reemplaza el countFor N+1 de /app/pacientes).
create or replace function public.patient_consultation_counts()
returns table(patient_id uuid, n bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select patient_id, count(*) as n
  from public.consultations
  where patient_id is not null
  group by patient_id
$$;
revoke all on function public.patient_consultation_counts() from public, anon;
grant execute on function public.patient_consultation_counts() to authenticated;
