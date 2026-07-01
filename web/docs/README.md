# Documentación — Miracle (web)

Índice de la documentación del proyecto. El punto de entrada para entender todo de una
es **[`../CONTEXTO.md`](../CONTEXTO.md)** (visión + estado + diagrama).

## Documentos al día (junio 2026)

| Documento | De qué trata |
|---|---|
| [`../CONTEXTO.md`](../CONTEXTO.md) | **Resumen maestro**: visión, negocio, estado, repos, diagrama. Empieza aquí. |
| [`arquitectura.md`](./arquitectura.md) | Cómo está construido por dentro: datos multi-tenant, tablas, RLS, el store, IA, auth. |
| [`decisiones.md`](./decisiones.md) | Registro de **decisiones clave** y el porqué de cada una. |
| [`roadmap.md`](./roadmap.md) | Qué falta, en orden, con detalle de cada pendiente. |
| [`diagnostico.md`](./diagnostico.md) | **Auditoría verificada** del codebase: problemas y mejoras por categoría (A–H) y severidad. |
| [`legal-colombia.md`](./legal-colombia.md) | Cumplimiento legal en Colombia (Habeas Data, historia clínica). |

## Documentos previos (estrategia / producto)

| Documento | De qué trata |
|---|---|
| [`strategy-miracle.md`](./strategy-miracle.md) | Estrategia y benchmark (Telepatía, etc.). Dirección de producto/landing. |
| [`prd-miracle-v0.md`](./prd-miracle-v0.md) | PRD inicial (v0). |
| [`supabase-auth-setup.md`](./supabase-auth-setup.md) | Notas de auth con Supabase *(parcialmente desactualizado: ver `arquitectura.md` para el modelo actual con organizaciones)*. |

---

> Para retomar el desarrollo: lee `CONTEXTO.md` + `arquitectura.md`. El archivo más
> importante del código es `app/app/providers.tsx` (el store, puente a Supabase).
