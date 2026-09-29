-- Bloques de examen normal para los médicos de urgencias del piloto.
--
-- POR QUÉ ES ADITIVA Y NO UN REEMPLAZO. La decisión de producto fue
-- "reemplazar su biblioteca por el catálogo nuevo". Al construir el
-- catálogo resultó que el paquete de urgencias es un SUPERCONJUNTO exacto
-- de lo que ya tienen: los 76 títulos siguen ahí y 75 con el contenido
-- byte a byte idéntico. Borrar 380 filas de cinco médicos reales para
-- reinsertar las mismas 380 no cambiaría nada salvo el riesgo, así que
-- se hace lo que de verdad falta: añadir los 11 que no tienen y corregir
-- el único cuyo texto cambió. El estado final es el mismo.
--
-- No se acota por correo sino por "médico de urgencias de este hospital",
-- igual que el seed original: si mañana dan de alta a un sexto, volver a
-- correr esto se lo deja listo. Es idempotente por título.

insert into public.user_snippets (user_id, title, content, category)
select p.id, v.title, v.content, v.category
from public.profiles p
cross join (values
  ('Estado general normal',
   E'Paciente en buen estado general, consciente, alerta, orientado en las tres esferas, hidratado y afebril al examen. Colabora con el interrogatorio y con el examen físico. Piel y mucosas de coloración normal, sin palidez, ictericia ni cianosis. Llenado capilar menor de dos segundos.',
   'Examen físico'),

  ('Cardiovascular normal',
   E'Ruidos cardíacos rítmicos, de buena intensidad, sin soplos, frotes ni ritmo de galope. Sin ingurgitación yugular ni reflujo hepatoyugular. Pulsos periféricos presentes, simétricos y de amplitud conservada en las cuatro extremidades. Llenado capilar menor de dos segundos. Sin edema en miembros inferiores.',
   'Examen físico'),

  ('Respiratorio normal',
   E'Paciente sin signos de dificultad respiratoria, con adecuada entrada de aire bilateral. Tórax simétrico, con expansibilidad conservada y sin uso de músculos accesorios. Murmullo vesicular conservado en ambos campos pulmonares, sin ruidos sobreagregados: sin sibilancias, roncus ni crépitos. Habla en frases completas, sin fatiga.',
   'Examen físico'),

  ('Abdomen normal',
   E'Abdomen blando, depresible, no doloroso a la palpación superficial ni profunda. Sin masas ni visceromegalias palpables. Ruidos intestinales presentes y de características normales. Sin signos de irritación peritoneal: sin defensa, sin rebote y con Blumberg negativo. Puñopercusión lumbar negativa bilateral. Sin hernias evidentes.',
   'Examen físico'),

  ('Neurológico básico normal',
   E'Paciente consciente, alerta y orientado en persona, tiempo y espacio. Lenguaje fluido y coherente, sin disartria ni afasia. Pupilas isocóricas y reactivas a la luz, con movimientos oculares conservados. Pares craneales sin alteraciones evidentes. Fuerza muscular conservada y simétrica en las cuatro extremidades, con sensibilidad superficial conservada. Reflejos osteotendinosos presentes y simétricos. Sin signos meníngeos. Marcha y coordinación sin alteraciones.',
   'Examen físico'),

  ('Extremidades normales',
   E'Extremidades simétricas, sin edema, deformidades ni signos inflamatorios. Pulsos periféricos presentes y simétricos, con llenado capilar menor de dos segundos. Movilidad activa y pasiva conservada, sin limitación ni dolor a la movilización. Sin signos de trombosis venosa profunda: sin aumento del diámetro, sin dolor a la palpación de las pantorrillas y sin cordones venosos palpables.',
   'Examen físico'),

  ('Cabeza y cuello normal',
   E'Cabeza normocéfala, sin lesiones ni hundimientos a la palpación. Conjuntivas de coloración normal, escleras anictéricas, pupilas isocóricas y reactivas a la luz. Otoscopia con conductos auditivos externos permeables y membranas timpánicas íntegras, sin abombamiento ni eritema. Fosas nasales permeables. Orofaringe de aspecto normal, sin eritema, exudados ni aumento del tamaño amigdalino. Cuello móvil, sin rigidez, sin adenopatías ni masas palpables. Tiroides de tamaño y consistencia normales.',
   'Examen físico'),

  ('Piel normal',
   E'Piel de coloración y turgencia normales, hidratada, sin palidez, ictericia ni cianosis. Sin exantemas, petequias, equimosis ni lesiones descamativas. Sin úlceras ni soluciones de continuidad. Faneras de aspecto normal. Sin edema ni signos de infección de tejidos blandos.',
   'Examen físico'),

  ('Signos vitales',
   E'TA [tensión] mmHg · FC [fc] lpm · FR [fr] rpm · T [temperatura] °C · SatO2 [sat] % al ambiente · Peso [peso] kg',
   'Examen físico'),

  ('Examen de urgencias · estado general a definir',
   E'Paciente en [buen / regular] estado general, consciente, orientado, hidratado, sin dificultad respiratoria y afebril al examen.\n\nCardiopulmonar: ruidos cardíacos rítmicos, sin soplos. Murmullo vesicular conservado en ambos campos, sin agregados.\nAbdomen: blando, depresible, no doloroso, sin signos de irritación peritoneal.\nExtremidades: sin edema, pulsos simétricos, llenado capilar conservado.\nNeurológico: sin déficit focal.',
   'Examen físico'),

  ('Reevaluación sin cambios',
   E'Se reevalúa al paciente. Continúa hemodinámicamente estable, consciente, orientado y sin signos de dificultad respiratoria. El examen físico no muestra cambios respecto a la valoración inicial. Tolera la vía oral y refiere mejoría de los síntomas por los que consultó. Se mantiene la conducta definida y se explican de nuevo los signos de alarma.',
   'Análisis')
) as v(title, content, category)
where p.organization_id = '808ac950-4bdf-4772-b666-dfa4776bf48f'
  and p.specialty_code = 'urgencias'
  and p.disabled_at is null
  and not exists (
    select 1 from public.user_snippets s
    where s.user_id = p.id and s.title = v.title
  );

-- El título afirmaba "sin hallazgos" y el texto abría pidiendo
-- [buen / regular] estado general. Se cierra la prosa; la variante con
-- hueco entra arriba con su propio título.
--
-- La condición sobre el contenido NO es decorativa: si algún médico ya
-- editó ese atajo, esto no lo toca. Un atajo instalado es suyo.
update public.user_snippets s
set content = E'Paciente en buen estado general, consciente, orientado, hidratado, sin dificultad respiratoria y afebril al examen.\n\nCardiopulmonar: ruidos cardíacos rítmicos, sin soplos. Murmullo vesicular conservado en ambos campos, sin agregados.\nAbdomen: blando, depresible, no doloroso, sin signos de irritación peritoneal.\nExtremidades: sin edema, pulsos simétricos, llenado capilar conservado.\nNeurológico: sin déficit focal.'
from public.profiles p
where p.id = s.user_id
  -- Acotado al piloto: sin esto, el update alcanzaría a cualquier cuenta que
  -- tuviera un atajo con ese mismo título.
  and p.organization_id = '808ac950-4bdf-4772-b666-dfa4776bf48f'
  and p.specialty_code = 'urgencias'
  and s.title = 'Examen de urgencias sin hallazgos'
  and s.content = E'Paciente en [buen / regular] estado general, consciente, orientado, hidratado, sin dificultad respiratoria y afebril al examen.\n\nCardiopulmonar: ruidos cardíacos rítmicos, sin soplos. Murmullo vesicular conservado en ambos campos, sin agregados.\nAbdomen: blando, depresible, no doloroso, sin signos de irritación peritoneal.\nExtremidades: sin edema, pulsos simétricos, llenado capilar conservado.\nNeurológico: sin déficit focal.';

notify pgrst, 'reload schema';
