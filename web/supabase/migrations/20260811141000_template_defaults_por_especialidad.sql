-- Por qué: hasta hoy solo 3 de las 49 especialidades tenían plantilla "Sugerida"
-- (is_default), así que el 94 % de los médicos arrancaba la consulta con la
-- primera plantilla que apareciera. Esta migración deja EXACTAMENTE 1 default
-- por especialidad, con esta regla:
--   - Por regla general, la "Consulta inicial" renovada de la especialidad.
--   - medicina_interna y pediatria → su nueva plantilla de chequeo de rutina
--     (la mayoría de sus citas son controles de paciente sano, no enfermedad).
--   - patologia → conserva "Histopatología · Macro / Micro / Diagnóstico"
--     (b1…0010, la default real del flujo de laboratorio).
--   - radiologia → "Informe de ecografía diagnóstica" (los radiólogos dictan
--     informes, no consultas; mismo criterio que patología).
--   - medicina_general → conserva su default actual (su Consulta inicial).
-- No se usa índice único parcial para forzar la invariante porque el backend
-- Graph también escribe is_default; la invariante se protege con la query de
-- verificación post-aplicación (1 default por especialidad).
-- Idempotente: re-ejecutar deja el mismo estado.

-- 1) Apagar cualquier default institucional que no esté en la lista final.
update public.clinical_templates
set is_default = false, updated_at = now()
where owner_id is null
  and is_default = true
  and id not in (
    '1244d47f-e098-531b-8cfb-8a3b61c810bd', -- medicina_general · Consulta inicial (se conserva)
    'a8fe32cb-fc32-5344-bbdd-2445c5a97aeb', -- medicina_familiar · Consulta inicial
    'c1000000-0000-4000-8000-000000000003', -- medicina_interna · Chequeo de rutina del adulto (nueva)
    'a297917d-cd61-5a47-b8b4-a1c6b39945e7', -- geriatria · Consulta inicial
    '47b32491-7693-5375-8cf1-11dfcc04aa7a', -- cardiologia · Consulta inicial
    'd0e165ae-8446-59c2-8091-9d3568e5c225', -- dermatologia · Consulta inicial
    '0225b072-88d8-5ca4-a8a6-32a17de3dc86', -- endocrinologia · Consulta inicial
    '70d97323-42a7-5373-92c1-a9833760d14e', -- gastroenterologia · Consulta inicial
    'f82feb7d-b70c-5915-b25d-0e26199dfcd6', -- hematologia · Consulta inicial
    '4c2e7f2d-e7a4-5a89-90bb-24804bbadeda', -- infectologia · Consulta inicial
    'c5bf805a-8999-545c-b688-c07d2fb84d6a', -- nefrologia · Consulta inicial
    'b0a0ce7d-262d-53ee-a712-978d547bcb2f', -- neumologia · Consulta inicial
    'bf081b39-3243-52f3-a1ab-42cea72e6723', -- neurologia · Consulta inicial
    '8b066117-ed2d-5edd-80a5-ba6ec8a20c5b', -- oncologia · Consulta inicial
    'e1b3edec-0a09-5c12-95d0-6ffe9a818d57', -- reumatologia · Consulta inicial
    '6ffb3e24-d730-5bf6-bf20-f66e87f5e826', -- alergologia · Consulta inicial
    'c2000000-0000-4000-8000-000000000001', -- pediatria · Control de niño sano (nueva)
    'c541ff75-7cf2-5cec-8438-ba509fd0f82d', -- neonatologia · Consulta inicial
    '50deb254-2444-5388-8d9e-1f812a86380e', -- ginecologia_obstetricia · Consulta inicial
    'a20d8531-ebf9-5402-928d-210ef1857264', -- cirugia_pediatrica · Consulta inicial
    '09f54dd3-eaf6-50c2-af9e-e8473f45cc3a', -- urgencias · Consulta inicial
    '6fcc37b6-feab-5b49-95e8-1214cb8810eb', -- anestesiologia · Consulta inicial
    'e24483e9-7377-59d1-86fd-c18ce6ed3a0a', -- cirugia_general · Consulta inicial
    '697b28c6-f91d-58da-a92a-97d2c44a9ec1', -- cirugia_cardiovascular · Consulta inicial
    '570acda8-d9ae-5fbe-9d1d-43f543d04b23', -- cirugia_torax · Consulta inicial
    '9bcad863-4072-5722-b21f-92a45bfcd15d', -- cirugia_vascular · Consulta inicial
    '816f5cbf-a135-5fdb-8190-2a4d04736660', -- neurocirugia · Consulta inicial
    '06c030d7-11a9-51dc-818b-be9f0971c130', -- cirugia_plastica · Consulta inicial
    'ff031514-b83d-5475-bc96-01b721496870', -- coloproctologia · Consulta inicial
    '8bf98df9-8a7b-52f4-b420-85768a7affa8', -- ortopedia · Consulta inicial
    '62b8356f-2a07-5032-8ff6-3070e612c7f6', -- oftalmologia · Consulta inicial
    '113755f7-5901-5bc1-8fb4-7ed29a830197', -- otorrinolaringologia · Consulta inicial
    'd52ad5c3-27ae-5334-8d16-ad34189ab0f8', -- urologia · Consulta inicial
    'ddd07f69-2e93-5cba-aced-909abe929a79', -- cirugia_maxilofacial · Consulta inicial
    '63a961ff-aad8-5422-b1a8-406b18d00793', -- psiquiatria · Consulta inicial
    '2037baa1-d738-5bdc-a378-114dc1991d95', -- psicologia · Consulta inicial
    'c6000000-0000-4000-8000-000000000001', -- radiologia · Informe de ecografía diagnóstica (nueva)
    'b1000000-0000-4000-8000-000000000010', -- patologia · Histopatología HGM (se conserva)
    '13820da3-dcf5-543d-8415-a79fb06177cf', -- medicina_nuclear · Consulta inicial
    '64630657-f299-5c74-a970-534f08d4ec61', -- genetica · Consulta inicial
    '22d41178-6556-5838-92cb-bbb5396f046e', -- rehabilitacion · Consulta inicial
    '8dda35a4-8256-53ef-9216-ee9b198488ec', -- dolor_paliativos · Consulta inicial
    'fca06d0b-b3c7-5f81-aea5-956c18626f1b', -- odontologia_general · Consulta inicial
    '21b79587-1b2e-56ff-92af-01e6c2564c10', -- endodoncia · Consulta inicial
    'fc9ead78-007c-5c46-9d68-1961b2c7b0be', -- periodoncia · Consulta inicial
    'cd4aedad-f35d-5be1-856a-8d40428cd94f', -- ortodoncia · Consulta inicial
    'e60e4f84-af79-5414-9859-4e3a6710d80a', -- rehabilitacion_oral · Consulta inicial
    '11c95e6f-69c8-5cf5-bbc8-003933b9e41d', -- medicina_laboral · Consulta inicial
    'a53b2002-8afe-58bc-ab1c-9eacb672ed87'  -- medicina_legal · Consulta inicial
  );

-- 2) Encender los 49 elegidos (solo cambia los que estén apagados).
update public.clinical_templates
set is_default = true, updated_at = now()
where owner_id is null
  and is_default = false
  and id in (
    '1244d47f-e098-531b-8cfb-8a3b61c810bd',
    'a8fe32cb-fc32-5344-bbdd-2445c5a97aeb',
    'c1000000-0000-4000-8000-000000000003',
    'a297917d-cd61-5a47-b8b4-a1c6b39945e7',
    '47b32491-7693-5375-8cf1-11dfcc04aa7a',
    'd0e165ae-8446-59c2-8091-9d3568e5c225',
    '0225b072-88d8-5ca4-a8a6-32a17de3dc86',
    '70d97323-42a7-5373-92c1-a9833760d14e',
    'f82feb7d-b70c-5915-b25d-0e26199dfcd6',
    '4c2e7f2d-e7a4-5a89-90bb-24804bbadeda',
    'c5bf805a-8999-545c-b688-c07d2fb84d6a',
    'b0a0ce7d-262d-53ee-a712-978d547bcb2f',
    'bf081b39-3243-52f3-a1ab-42cea72e6723',
    '8b066117-ed2d-5edd-80a5-ba6ec8a20c5b',
    'e1b3edec-0a09-5c12-95d0-6ffe9a818d57',
    '6ffb3e24-d730-5bf6-bf20-f66e87f5e826',
    'c2000000-0000-4000-8000-000000000001',
    'c541ff75-7cf2-5cec-8438-ba509fd0f82d',
    '50deb254-2444-5388-8d9e-1f812a86380e',
    'a20d8531-ebf9-5402-928d-210ef1857264',
    '09f54dd3-eaf6-50c2-af9e-e8473f45cc3a',
    '6fcc37b6-feab-5b49-95e8-1214cb8810eb',
    'e24483e9-7377-59d1-86fd-c18ce6ed3a0a',
    '697b28c6-f91d-58da-a92a-97d2c44a9ec1',
    '570acda8-d9ae-5fbe-9d1d-43f543d04b23',
    '9bcad863-4072-5722-b21f-92a45bfcd15d',
    '816f5cbf-a135-5fdb-8190-2a4d04736660',
    '06c030d7-11a9-51dc-818b-be9f0971c130',
    'ff031514-b83d-5475-bc96-01b721496870',
    '8bf98df9-8a7b-52f4-b420-85768a7affa8',
    '62b8356f-2a07-5032-8ff6-3070e612c7f6',
    '113755f7-5901-5bc1-8fb4-7ed29a830197',
    'd52ad5c3-27ae-5334-8d16-ad34189ab0f8',
    'ddd07f69-2e93-5cba-aced-909abe929a79',
    '63a961ff-aad8-5422-b1a8-406b18d00793',
    '2037baa1-d738-5bdc-a378-114dc1991d95',
    'c6000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000010',
    '13820da3-dcf5-543d-8415-a79fb06177cf',
    '64630657-f299-5c74-a970-534f08d4ec61',
    '22d41178-6556-5838-92cb-bbb5396f046e',
    '8dda35a4-8256-53ef-9216-ee9b198488ec',
    'fca06d0b-b3c7-5f81-aea5-956c18626f1b',
    '21b79587-1b2e-56ff-92af-01e6c2564c10',
    'fc9ead78-007c-5c46-9d68-1961b2c7b0be',
    'cd4aedad-f35d-5be1-856a-8d40428cd94f',
    'e60e4f84-af79-5414-9859-4e3a6710d80a',
    '11c95e6f-69c8-5cf5-bbc8-003933b9e41d',
    'a53b2002-8afe-58bc-ab1c-9eacb672ed87'
  );
