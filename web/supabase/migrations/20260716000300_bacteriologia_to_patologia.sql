-- Corrección de área: bacteriología → PATOLOGÍA.
--
-- El área real de este flujo (muestras quirúrgicas/biopsias analizadas al microscopio, con
-- macroscópico/microscópico/diagnóstico) es patología, no bacteriología. "Patología" ya existe
-- como especialidad en el catálogo, así que se reutiliza. La división de cuenta pasa de
-- 'bacteriologo' a 'patologo'. Migración hacia adelante (no reescribe las migraciones previas).

-- 1) Soltar el CHECK viejo PRIMERO: aún no permite 'patologo', así que hay que quitarlo antes
--    de reetiquetar las cuentas (si no, el UPDATE viola el constraint vigente).
alter table public.profiles drop constraint if exists profiles_professional_type_check;

-- 2) Cuentas existentes: bacteriologo → patologo, bacteriologia → patologia.
update public.profiles set professional_type = 'patologo'
where professional_type = 'bacteriologo';

update public.profiles
set specialty_code = 'patologia', specialty_name = 'Patología'
where specialty_code = 'bacteriologia';

-- 3) CHECK nuevo (ya sin filas 'bacteriologo').
alter table public.profiles
  add constraint profiles_professional_type_check
  check (
    professional_type is null
    or professional_type in ('medico_general', 'medico_especialista', 'patologo')
  );

-- 3) Onboarding clínico: aceptar 'patologo' en vez de 'bacteriologo'.
create or replace function public.complete_clinical_onboarding(
  p_professional_type text,
  p_specialty_code text,
  p_specialty_name text,
  p_practice_country text default null,
  p_practice_city text default null
)
returns void
language plpgsql
set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if p_professional_type not in ('medico_general', 'medico_especialista', 'patologo') then
    raise exception 'Invalid professional type';
  end if;

  if coalesce(trim(p_specialty_code), '') = '' or coalesce(trim(p_specialty_name), '') = '' then
    raise exception 'A specialty is required';
  end if;

  update public.profiles
  set professional_type = p_professional_type,
      specialty_code = trim(p_specialty_code),
      specialty_name = trim(p_specialty_name),
      professional_registration = null,
      practice_country = nullif(trim(p_practice_country), ''),
      practice_city = nullif(trim(p_practice_city), ''),
      onboarding_completed_at = now()
  where id = auth.uid()
    and role = 'medico';

  if not found then
    raise exception 'Only clinician profiles can complete this onboarding';
  end if;
end;
$function$;

-- 4) Plantillas de bacteriología que NO son de patología → archivar (desaparecen del picker,
--    sin destruirlas): microbiología, baciloscopia, uroanálisis, coprológico.
update public.clinical_templates set status = 'archived'
where id in (
  'b1000000-0000-4000-8000-000000000002',
  'b1000000-0000-4000-8000-000000000003',
  'b1000000-0000-4000-8000-000000000004',
  'b1000000-0000-4000-8000-000000000005'
);

-- Las de histopatología (incluida la HGM predeterminada) se re-scopean a patología.
update public.clinical_templates
set specialty_code = 'patologia', specialty_name = 'Patología'
where id in (
  'b1000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000010'
);

-- 5) Nuevas plantillas propias de patología: citología (Bethesda), inmunohistoquímica y
--    estudio intraoperatorio por congelación. Idempotentes.
insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  (
    'b1000000-0000-4000-8000-000000000011', null,
    'Citología cervicovaginal (Bethesda)',
    'Citología cervicovaginal reportada con el sistema Bethesda.',
    'patologia', 'Patología', 'institutional', false, 'active',
    '[
      {"key":"datos_muestra","label":"Datos de la muestra","order":1,"required":true,"instruction":"Transcribe rótulo, tipo de citología, método de toma y fecha si aparecen."},
      {"key":"calidad_muestra","label":"Calidad de la muestra","order":2,"required":false,"instruction":"Transcribe si la muestra es satisfactoria o no para evaluación y la presencia de células de la zona de transformación."},
      {"key":"interpretacion","label":"Interpretación / resultado","order":3,"required":true,"instruction":"Transcribe la categoría Bethesda tal como está escrita (NILM, ASC-US, ASC-H, LSIL, HSIL, AGC, carcinoma, etc.). No la reinterpretes."},
      {"key":"microorganismos","label":"Microorganismos / flora","order":4,"required":false,"instruction":"Transcribe microorganismos o cambios reactivos si aparecen (Trichomonas, Candida, vaginosis, etc.)."},
      {"key":"recomendacion","label":"Recomendación y control","order":5,"required":false,"instruction":"Transcribe la recomendación de seguimiento o control."}
    ]'::jsonb
  ),
  (
    'b1000000-0000-4000-8000-000000000012', null,
    'Inmunohistoquímica (IHQ)',
    'Panel de inmunohistoquímica con marcadores, interpretación y diagnóstico.',
    'patologia', 'Patología', 'institutional', false, 'active',
    '[
      {"key":"datos_muestra","label":"Datos de la muestra","order":1,"required":true,"instruction":"Transcribe rótulo, tipo de muestra y bloque estudiado si aparecen."},
      {"key":"antecedente","label":"Antecedente y diagnóstico morfológico","order":2,"required":false,"instruction":"Transcribe el diagnóstico morfológico previo o la sospecha que motiva el panel."},
      {"key":"panel","label":"Panel de marcadores y resultados","order":3,"required":true,"instruction":"Transcribe cada anticuerpo con su resultado (positivo/negativo, patrón, intensidad, % de células). Una línea por marcador, tal como está en la hoja."},
      {"key":"interpretacion","label":"Interpretación","order":4,"required":false,"instruction":"Transcribe la interpretación del perfil inmunohistoquímico."},
      {"key":"diagnostico","label":"Diagnóstico / conclusión","order":5,"required":true,"instruction":"Transcribe el diagnóstico o conclusión tal como está escrito."}
    ]'::jsonb
  ),
  (
    'b1000000-0000-4000-8000-000000000013', null,
    'Estudio intraoperatorio (congelación)',
    'Diagnóstico rápido por congelación durante la cirugía, con correlación diferida.',
    'patologia', 'Patología', 'institutional', false, 'active',
    '[
      {"key":"datos_muestra","label":"Datos de la muestra","order":1,"required":true,"instruction":"Transcribe sitio anatómico, procedimiento y hora de recepción si aparecen."},
      {"key":"diagnostico_congelacion","label":"Diagnóstico por congelación","order":2,"required":true,"instruction":"Transcribe el diagnóstico intraoperatorio por congelación tal como está escrito."},
      {"key":"correlacion","label":"Correlación con parafina","order":3,"required":false,"instruction":"Transcribe la correlación o el diagnóstico diferido en parafina si aparece."},
      {"key":"observaciones","label":"Observaciones","order":4,"required":false,"instruction":"Transcribe observaciones, límites del método o notas."}
    ]'::jsonb
  )
on conflict (id) do update
  set name = excluded.name,
      description = excluded.description,
      specialty_code = excluded.specialty_code,
      specialty_name = excluded.specialty_name,
      scope = excluded.scope,
      status = excluded.status,
      sections = excluded.sections,
      updated_at = now();
