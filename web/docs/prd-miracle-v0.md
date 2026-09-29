# PRD — Miracle v0

> Documento de producto inicial. Acompaña a [strategy-miracle.md](./strategy-miracle.md).
> Fecha base: junio 2026.

## Qué es Miracle

Miracle es una **plataforma de inteligencia clínica-operativa** para hospitales, clínicas e IPS en Colombia. Escucha o recibe el dictado de la consulta y la convierte en una **nota clínica estructurada, codificada (CIE-10/CUPS) y auditable**, lista para que el médico la revise y la exporte a la historia clínica. Funciona **sobre el sistema que la institución ya usa** y entrega a la gerencia **métricas** de adopción, tiempo y calidad documental.

Principio rector: **la IA asiste; el médico decide.** Toda nota requiere revisión y aprobación humana.

## Para quién existe (roles y dolores)

| Rol | Dolor principal | Qué le da Miracle |
| --- | --- | --- |
| **Médico** | Carga documental, tiempo frente al PC, desgaste | Nota casi lista para revisar; menos escritura; flujo natural |
| **Auditor / Calidad** | Campos incompletos, codificación inconsistente, trazabilidad débil | Revisión de completitud, validación CIE-10/CUPS, estados y trazabilidad |
| **Administrador / Gerencia** | Glosas, falta de visibilidad, calidad despareja | Métricas de adopción, tiempo y calidad; piloto medible |
| **Sistemas / TI** | Migraciones costosas, integraciones frágiles | "No cambie su sistema": export + integración progresiva |
| **Superadmin Miracle** | Operar múltiples instituciones | Gestión de instituciones, usuarios, plantillas y configuración |

## Módulos (visión de producto)

1. **Dashboard** — consultas del día, notas pendientes, tiempo ahorrado, alertas.
2. **Nueva consulta** — paciente, especialidad, tipo, consentimiento, inicio de grabación/dictado.
3. **Consulta en vivo** — grabador visible, estado de escucha, pausar/reanudar, marcar momentos.
4. **Transcripción** — texto crudo, hablantes, marcas de tiempo, edición rápida.
5. **Nota clínica** — SOAP/evolución, campos editables, trazables al audio.
6. **Pacientes** — directorio y línea de tiempo (encuentros → notas → documentos).
7. **Codificación CIE-10 / CUPS** — sugerencias con nivel de confianza y revisión.
8. **Preparación para RIPS** — insumos y validaciones.
9. **Auditoría** — completitud, validación de codificación, estados, registro de cambios.
10. **Reportes gerenciales** — adopción, tiempo, calidad, impacto por servicio.
11. **Plantillas** — por especialidad y formatos internos del hospital.
12. **Configuración institucional** — consentimiento, privacidad, formatos, integraciones.
13. **Seguridad / consentimiento** — roles y permisos, trazabilidad, principios de datos.

## MVP (este Prompt 1 + base para Prompt 2)

Entregado en el Prompt 1:

- **Landing pública** completa (home + subpáginas).
- **Base visual / design system** (tokens + componentes reutilizables).
- **Demo visual del producto** (mockup de la pantalla clínica).
- **Estructura de la app futura** (`/app/*` con shell y placeholders).
- **Mensaje comercial** claro y seguro.

Siguiente (Prompt 2): consulta en vivo real, nota editable, codificación asistida, auditoría y reportes con datos reales.

## Fuera del MVP por ahora

- Diagnóstico autónomo / apoyo clínico avanzado.
- Chat con la historia clínica.
- Integraciones profundas multi-HIS.
- BI clínico complejo.
- App móvil nativa.
- Multi-país.

## Arquitectura de información

### Sitio público
`/` · `/demo` · `/como-funciona` · `/seguridad` · `/casos-de-uso` · `/piloto` · `/recursos` · `/contacto` · `/login`

### App privada (futura)
`/app/dashboard` · `/app/consultas` · `/app/consultas/nueva` · `/app/consultas/[id]` · `/app/pacientes` · `/app/notas` · `/app/auditoria` · `/app/reportes` · `/app/plantillas` · `/app/configuracion` · `/app/usuarios`

> En el Prompt 1 las rutas `/app/*` existen como **placeholders** dentro del `AppShell` (sidebar + topbar) para fijar la arquitectura sin construir aún la lógica.

## Reglas de claims (importante)

Permitido: "diseñado para…", "preparado para…", "puede ayudar a…", "en piloto se medirá…".
Prohibido: porcentajes garantizados, "elimina errores", "diagnostica automáticamente", afirmar certificaciones (ISO/HIPAA/SOC2) no obtenidas, "reduce glosas garantizado".
Siempre presente: **revisión médica + control humano + trazabilidad**.

## Stack (decisión)

Next.js (App Router) + TypeScript + Tailwind CSS v4 + `next/font` (Geist + Inter) + lucide-react. Deploy objetivo: Vercel. Sin backend/IA/auth real en el Prompt 1.
