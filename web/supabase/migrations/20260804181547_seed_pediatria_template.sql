-- Plantilla institucional de pediatría (la primera de verdad pediátrica).
--
-- Por qué: las 3 plantillas de 'pediatria' que había salían de la fábrica genérica del
-- catálogo (mismas secciones que las otras 49 especialidades, con dos frases cambiadas).
-- No pedían lo que define una consulta pediátrica: edad exacta, quién informa, perinatales,
-- alimentación, crecimiento con percentiles, hitos del desarrollo, vacunación PAI y dosis
-- por peso.
--
-- Queda scope='institutional' + is_default=true para 'pediatria', así la ve cualquier médico
-- en la biblioteca y le llega preseleccionada al pediatra. Idempotente: id fijo +
-- ON CONFLICT DO NOTHING.
--
-- El campo `instruction` de cada sección guía al generador de notas: documentar solo lo
-- dicho en la consulta, sin inventar cifras (las dosis y los percentiles son justo donde
-- una alucinación haría daño).

insert into public.clinical_templates
  (id, owner_id, name, description, specialty_code, specialty_name, scope, is_default, status, sections)
values
  (
    'b2000000-0000-4000-8000-000000000001', null,
    'Consulta pediátrica integral · crecimiento, desarrollo y vacunas',
    'Consulta de niño sano o enfermedad aguda: perinatales, alimentación, curvas de crecimiento, hitos del desarrollo, esquema PAI, dosis por peso y signos de alarma para el cuidador.',
    'pediatria', 'Pediatría', 'institutional', true, 'active',
    '[
      {"key":"identificacion_y_acompanante","label":"Identificación y acompañante","order":1,"required":true,"instruction":"Registra la edad exacta (años y meses; en lactantes, meses y días), quién acompaña al paciente y quién da la información. No infieras la edad si no se dijo."},
      {"key":"motivo_de_consulta","label":"Motivo de consulta","order":2,"required":true,"instruction":"Documenta el motivo en las palabras del cuidador o del propio niño cuando pueda expresarlo. No lo traduzcas a un diagnóstico."},
      {"key":"enfermedad_actual","label":"Enfermedad actual","order":3,"required":true,"instruction":"Cronología del cuadro: inicio, evolución, fiebre (cifras y duración si se mencionaron), síntomas asociados, apetito, hidratación, diuresis, deposiciones, sueño, tratamientos ya recibidos y respuesta. Solo lo mencionado."},
      {"key":"antecedentes_perinatales","label":"Antecedentes perinatales","order":4,"required":false,"instruction":"Embarazo y controles prenatales, edad gestacional, vía del parto, peso y talla al nacer, adaptación neonatal, hospitalizaciones neonatales y tamizajes (auditivo, metabólico, cardiopatías). Si no se habló del tema, indícalo."},
      {"key":"alimentacion_y_nutricion","label":"Alimentación y nutrición","order":5,"required":false,"instruction":"Lactancia materna (exclusiva o mixta y hasta cuándo), fórmula, inicio y tolerancia de la alimentación complementaria, dieta actual, apetito y suplementos (hierro, vitamina D). Solo lo dicho."},
      {"key":"crecimiento_y_desarrollo","label":"Crecimiento y desarrollo","order":6,"required":true,"instruction":"Peso, talla, perímetro cefálico e IMC con los percentiles o puntuaciones Z que el médico haya mencionado; nunca los calcules ni los estimes tú. Añade la tendencia de la curva y los hitos del desarrollo alcanzados o rezagados para la edad, tal como se comentaron."},
      {"key":"esquema_de_vacunacion","label":"Esquema de vacunación","order":7,"required":false,"instruction":"Estado del esquema PAI para la edad: al día o incompleto, vacunas pendientes, refuerzos aplicados hoy y reacciones previas. Si no se revisó el carné, escríbelo así."},
      {"key":"antecedentes_personales_y_familiares","label":"Antecedentes personales y familiares","order":8,"required":false,"instruction":"Patológicos, quirúrgicos, hospitalizaciones, alergias (medicamentos y alimentos), medicación crónica, antecedentes familiares relevantes y contexto del hogar (cuidadores, jardín o colegio, exposición a humo, convivientes enfermos)."},
      {"key":"examen_fisico_pediatrico","label":"Examen físico pediátrico","order":9,"required":true,"instruction":"Estado general y de conciencia, signos vitales con los valores dichos, estado de hidratación, piel, ORL, cuello, cardiopulmonar, abdomen, genital, neurológico y osteomuscular. Incluye signos de dificultad respiratoria o de alarma si se describieron. No completes lo no examinado."},
      {"key":"analisis_e_impresion_diagnostica","label":"Análisis e impresión diagnóstica","order":10,"required":true,"instruction":"Razonamiento clínico y diagnósticos con la precisión con que el médico los formuló (incluye clasificación de severidad o estado nutricional solo si él la enunció). Deja explícitos los diagnósticos diferenciales que consideró."},
      {"key":"plan_dosis_por_peso_y_educacion","label":"Plan, dosis por peso y educación al cuidador","order":11,"required":true,"instruction":"Medicamentos con la dosis tal como fue indicada (mg/kg/dosis, mL, frecuencia y duración): transcríbela literal, sin recalcular ni completar la que falte. Añade hidratación, medidas en casa, paraclínicos, remisiones, incapacidad o excusa escolar y las explicaciones dadas al cuidador."},
      {"key":"proximo_control_y_signos_de_alarma","label":"Próximo control y signos de alarma","order":12,"required":false,"instruction":"Cuándo volver a control y los signos de alarma para consultar de urgencia que se explicaron al cuidador (dificultad para respirar, rechazo de la vía oral, somnolencia, fiebre persistente, convulsión, deshidratación, empeoramiento)."}
    ]'::jsonb
  )
on conflict (id) do nothing;
