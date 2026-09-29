-- Borrado de consultas, exclusivo de superadmin — pedido explícito del usuario
-- (2026-07-22): "quiero que desde la cuenta de superadministrador de miracle
-- se pueda borrar consultas".
--
-- Por qué es un borrado SUAVE (deleted_at) y no un DELETE físico: la historia
-- clínica en Colombia tiene retención legal (Resolución 1995/1999, Ley
-- 23/1981) y un DELETE real es irreversible ante un solo clic equivocado. Con
-- deleted_at, una consulta "eliminada" desaparece de TODA la app -para
-- cualquier rol, incluido el propio superadmin- pero el registro sigue
-- existiendo en la base por si algún día hace falta auditar o recuperar.
-- Decisión tomada por Claude al implementar este pedido; si se necesita un
-- DELETE físico de verdad, es un cambio aparte y explícito.
--
-- El trigger consultations_immutability (enforce_consultation_immutability)
-- revisa una lista explícita de columnas para notas firmadas (note, resumen,
-- codigos, transcript, firma, patient_id, medico_id, organization_id, fecha,
-- motivo, servicio, especialidad, tipo, plantilla, duracion_min); deleted_at
-- no está en esa lista, así que este UPDATE no choca con la inmutabilidad.

alter table public.consultations
  add column if not exists deleted_at timestamptz;

-- Las políticas de lectura ya existentes se amplían con "y no está borrada"
-- (mismo qual + una condición), sin tocar el resto de su lógica.
alter policy "read consultations" on public.consultations
  using (deleted_at is null
    and organization_id = (select private.current_org())
    and ((select private.current_app_role()) in ('admin', 'supervisor') or medico_id = (select auth.uid())));

alter policy "superadmin reads consultations" on public.consultations
  using (deleted_at is null and (select private.is_superadmin()));

-- Borrado suave vía RPC (no se toca la política UPDATE general): así el
-- permiso de "borrar" queda solo en manos de quien puede llamar esta función
-- con éxito -superadmin-, sin depender de gating en el cliente.
create or replace function public.superadmin_delete_consultation(p_consultation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_superadmin()) then
    raise exception 'No autorizado';
  end if;

  update public.consultations
  set deleted_at = now()
  where id = p_consultation_id and deleted_at is null;

  if not found then
    raise exception 'Consulta no encontrada o ya eliminada';
  end if;
end;
$$;

revoke all on function public.superadmin_delete_consultation(uuid) from public, anon;
grant execute on function public.superadmin_delete_consultation(uuid) to authenticated;
