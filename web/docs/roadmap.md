# Roadmap — Miracle (web)

Qué falta, en orden sugerido. Estado a junio 2026.

## ✅ Hecho
- Sitio público + auth real (roles, gating, onboarding).
- **Datos en Supabase, multi-tenant por organización** (pacientes, consultas, nota/códigos
  JSONB, auditoría) con RLS. El store ya escribe/lee de Supabase. **Verificado.**
- Núcleo clínico (web): nota editable + autoguardado, códigos CIE-10/CUPS con autocompletar,
  firma electrónica, exportar PDF, "regrabar".
- UX: modo oscuro, buscador Cmd+K, notificaciones, dictado por voz, error boundary.
- Reportes con datos reales. Deploy en Vercel.
- IA **lista** (rutas con fallback), falta la key.

## 🔜 Pendientes (orden recomendado)

### 1. Asegurar las rutas `/api/*`  ·  rápido · antes de la key
Hoy `/api/chat` y `/api/generate-note` **no están autenticadas** (el middleware solo cubre
`/app` y `/onboarding`). Con la key puesta, cualquiera podría llamarlas y quemar la cuenta.
→ Verificar sesión de Supabase dentro de cada route handler + límite de tamaño de payload +
rate-limit básico.

### 2. Encender la IA  ·  necesita `ANTHROPIC_API_KEY`
- Pegar la key en `.env.local` (local) y en variables de entorno de Vercel (prod).
- Verificar chatbot y generación de nota con respuestas reales.
- **Construir el recomendador de diagnósticos**: sugiere diagnósticos **mientras habla el
  médico** (analizando contexto, no instantáneo), en la pestaña Codificación, como apoyo a la
  decisión (el médico siempre decide).

### 3. Audio real  ·  medio-alto
- Grabar con `MediaRecorder` (micrófono del navegador) + "Subir audio" que abra selector.
- Transcribir con un proveedor (a decidir: **Deepgram** o **Whisper**; español médico).
- Hoy la captura es **simulada** (guion fijo).

### 4. B2B real  ·  cuando empieces a vender a hospitales
- **Invitar miembros** a una organización (que un admin agregue médicos a su hospital en vez
  de que cada quien cree su propia org).
- **Super-admin de plataforma** (consola para que Miracle gestione todos los hospitales).

### 5. Cobros B2C  ·  después
- Suscripción mensual (Stripe u otro), atada a la organización.

### 6. Cumplimiento legal Colombia  ·  antes de pacientes reales
Ver [`legal-colombia.md`](./legal-colombia.md). Consentimiento (datos + grabación), retención,
contrato Responsable/Encargado, transferencia internacional, posible RNBD. **Requiere abogado.**

### 7. Pulido / operación
- Configuración institucional real (hoy es maqueta, no guarda) → conectar a la org.
- Observabilidad (Sentry) + backups de Supabase + tests automatizados + CI (lint+build+test).
- Resolver nombres de médicos en más vistas si hace falta.
