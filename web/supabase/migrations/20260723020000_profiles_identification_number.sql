-- La cédula del profesional no tenía dónde vivir en profiles (solo existía
-- professional_registration, el número de registro médico — un dato
-- distinto, aunque en Colombia suelen coincidir en el mismo número). Falta
-- para poder mostrar "Identificación: CC..." junto al nombre del médico en
-- el PDF y en "Copiar nota", tal como lo pide el sistema del hospital al
-- que la secretaria sube cada nota.
alter table public.profiles
  add column if not exists identification_number text;
