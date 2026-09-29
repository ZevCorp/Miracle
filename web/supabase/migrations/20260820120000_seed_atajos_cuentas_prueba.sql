-- Atajos de demostración para las cuentas de prueba.
--
-- POR QUÉ: la pestaña de Atajos aparecía vacía en las cuentas con las que se
-- enseña el producto, y un insertador de frases sin frases no demuestra nada.
-- Con una biblioteca cargada se ve de inmediato para qué sirve: texto que el
-- médico repite en cada consulta y que aquí se inserta de una.
--
-- SOLO CUENTAS DE PRUEBA. Se buscan por correo, nunca por id fijo, y ninguna
-- pertenece al Hospital General de Medellín, que tiene pacientes reales.
--
-- LA CATEGORÍA ES EL NOMBRE DE LA SECCIÓN DE LA NOTA, no la especialidad: es lo
-- que usa categoryMatchesSection (lib/clinical/search.ts) para subir los atajos
-- de esa sección al principio de la lista. Poner aquí "Pediatría" no ordenaría
-- nada; la especialidad va en el título, como ya hacen los atajos existentes.
--
-- NINGÚN ATAJO TRAE DOSIS NI CIFRAS. Son textos de demostración y podrían
-- terminar pegados en una nota real: se habla del "esquema indicado" y del
-- "manejo formulado", que es también como están escritos los que ya existen.

-- Medicina general — medico@miracle.app (Dra. Daniela Rincón)
insert into public.user_snippets (user_id, title, content, category)
select p.id, v.title, v.content, v.category
from public.profiles p
cross join (values
  ('Examen físico general normal',
   E'Paciente en buen estado general, consciente, orientado, hidratado y afebril.\n\nCuello sin adenopatías ni masas. Ruidos cardíacos rítmicos, sin soplos. Murmullo vesicular conservado en ambos campos, sin agregados. Abdomen blando, depresible, no doloroso, sin masas ni visceromegalias. Extremidades sin edema, con pulsos simétricos. Sin déficit neurológico focal.',
   'Examen físico'),
  ('Signos de alarma generales',
   E'Consultar de inmediato al servicio de urgencias si presenta:\n\n- Fiebre que no cede con el manejo indicado o que dura más de tres días.\n- Dificultad para respirar o dolor en el pecho.\n- Vómito persistente o incapacidad para tolerar líquidos.\n- Somnolencia, confusión o desmayo.\n\nEl paciente comprende las indicaciones y acepta el plan.',
   'Recomendaciones'),
  ('Manejo en casa',
   E'Reposo relativo según tolerancia, hidratación abundante por vía oral y alimentación fraccionada.\n\nCompletar el tratamiento formulado en los horarios indicados, aunque los síntomas mejoren antes de terminarlo.\n\nControl en la fecha señalada, o antes si aparecen signos de alarma.',
   'Recomendaciones'),
  ('Consejería en riesgo cardiovascular',
   E'Se explica al paciente la relación entre sus factores de riesgo y el desenlace cardiovascular a largo plazo.\n\nSe insiste en actividad física aeróbica regular, dieta baja en sal y en grasas saturadas, control del peso y suspensión del cigarrillo y del alcohol. Se resuelven dudas sobre la adherencia al tratamiento.',
   'Recomendaciones'),
  ('Laboratorios de control',
   E'Se solicitan exámenes de control y se explica la preparación requerida, incluido el ayuno cuando aplique.\n\nTraer los resultados a la próxima cita: el tratamiento no se ajusta hasta poder interpretarlos.',
   'Plan'),
  ('Incapacidad y próximo control',
   E'Se expide incapacidad por el período indicado: el cuadro actual limita el desempeño de las funciones habituales del paciente.\n\nSe explica que el reposo durante ese lapso hace parte del tratamiento. Se deja programado el control para revaloración.',
   'Plan')
) as v(title, content, category)
where p.email = 'medico@miracle.app'
  and not exists (
    select 1 from public.user_snippets s where s.user_id = p.id and s.title = v.title
  );

-- Patología — bacteriologo@miracle.app (Dr. Patólogo Prueba)
insert into public.user_snippets (user_id, title, content, category)
select p.id, v.title, v.content, v.category
from public.profiles p
cross join (values
  ('Sin evidencia de malignidad',
   E'No se observa evidencia de malignidad en el material examinado.\n\nSe recomienda correlación con los hallazgos clínicos y con el seguimiento de la lesión; de persistir la sospecha clínica, considerar nueva toma de muestra.',
   'Diagnóstico'),
  ('Material insuficiente',
   E'El material remitido es insuficiente para emitir un diagnóstico concluyente.\n\nSe sugiere nueva toma de muestra representativa de la lesión, con adecuada fijación, para poder completar el estudio.',
   'Diagnóstico'),
  ('Se sugiere inmunohistoquímica',
   E'Los hallazgos morfológicos no permiten precisar el origen de la lesión.\n\nSe sugiere ampliar el estudio con inmunohistoquímica para caracterizarla; el resultado se reportará en informe complementario.',
   'Diagnóstico'),
  ('Correlación clínico-patológica',
   E'El diagnóstico debe interpretarse junto con la información clínica, el estudio de imágenes y los antecedentes del paciente.\n\nSe queda atento a la correlación con el grupo tratante.',
   'Diagnóstico'),
  ('Macroscópica de rutina',
   E'Se recibe muestra en formol tamponado, debidamente rotulada y con la orden correspondiente.\n\nSe describe fragmento de tejido de superficie regular y consistencia elástica. Se realizan cortes seriados representativos y se incluye la totalidad del material.',
   'Descripción macroscópica'),
  ('Microscópica sin atipia',
   E'Los cortes histológicos muestran arquitectura conservada, sin atipia citológica, sin aumento de la actividad mitótica y sin necrosis.\n\nNo se identifica infiltrado inflamatorio significativo ni compromiso de los bordes.',
   'Descripción microscópica')
) as v(title, content, category)
where p.email = 'bacteriologo@miracle.app'
  and not exists (
    select 1 from public.user_snippets s where s.user_id = p.id and s.title = v.title
  );

-- Ginecología y medicina interna — demo@miracle.app
-- (esta cuenta ya traía medicina general y pediatría; se completan las áreas)
insert into public.user_snippets (user_id, title, content, category)
select p.id, v.title, v.content, v.category
from public.profiles p
cross join (values
  ('Ginecología · Control prenatal normal',
   E'Gestante en buen estado general, afebril, con cifras tensionales dentro de lo esperado para la edad gestacional.\n\nAltura uterina acorde. Fetocardia presente y rítmica. Movimientos fetales percibidos por la madre. Sin actividad uterina, sin sangrado ni salida de líquido.',
   'Examen físico'),
  ('Ginecología · Signos de alarma del embarazo',
   E'Consultar de inmediato al servicio de urgencias si presenta:\n\n- Sangrado genital o salida de líquido por vagina.\n- Dolor de cabeza intenso, visión borrosa o zumbido en los oídos.\n- Disminución o ausencia de movimientos fetales.\n- Contracciones regulares antes de la fecha esperada.\n- Fiebre o ardor al orinar.',
   'Recomendaciones'),
  ('Ginecología · Recomendaciones del control prenatal',
   E'Continuar los suplementos y el esquema de vacunación indicados en el programa.\n\nAsistir a los controles y a los cursos de preparación para la maternidad. Mantener alimentación variada, hidratación y actividad física suave según tolerancia.\n\nSe explica el plan de parto y cuándo debe consultar.',
   'Recomendaciones'),
  ('Medicina interna · Paciente con varias enfermedades crónicas',
   E'Paciente con enfermedad crónica múltiple en seguimiento, sin descompensación aguda en la evaluación de hoy.\n\nSe revisa el conjunto del tratamiento buscando interacciones y duplicidades. Se mantiene el esquema actual y se refuerza la adherencia.',
   'Análisis'),
  ('Medicina interna · Educación en diabetes',
   E'Se educa al paciente sobre automonitoreo, reconocimiento de hipoglucemia y qué hacer ante ella.\n\nSe insiste en el cuidado diario de los pies, la revisión oftalmológica anual y la importancia de no suspender el tratamiento por cuenta propia. Se resuelven dudas sobre alimentación.',
   'Recomendaciones'),
  ('Medicina interna · Ajuste de tratamiento',
   E'Se ajusta el esquema terapéutico según la evolución y los resultados disponibles, manteniendo el resto del tratamiento sin cambios.\n\nSe explica al paciente qué se modificó y por qué, y se programa control para evaluar la respuesta.',
   'Plan')
) as v(title, content, category)
where p.email = 'demo@miracle.app'
  and not exists (
    select 1 from public.user_snippets s where s.user_id = p.id and s.title = v.title
  );
