# Cumplimiento legal — Colombia

> ⚠️ **No es asesoría legal.** Es un mapa general para saber qué revisar. Antes de manejar
> pacientes reales, validar con un **abogado de protección de datos / derecho de la salud en
> Colombia**. (Conocimiento a junio 2026; las normas pueden cambiar.)

Manejar datos de un paciente toca **dos cuerpos de ley**: protección de datos e historia clínica.

## 1. Protección de datos personales (Habeas Data)
- **Ley 1581 de 2012** + **Decreto 1377 de 2013** (base).
- Los **datos de salud son "datos sensibles"** → protección reforzada.
- Requiere **autorización previa, expresa e informada** del paciente para tratar sus datos.
- Derechos del titular: conocer, actualizar, rectificar, **suprimir**, revocar autorización.
- **Medidas de seguridad obligatorias:** cifrado, control de acceso, trazabilidad.
- **Responsable vs Encargado:** el hospital/médico es el **Responsable**; Miracle, que procesa
  por ellos, es el **Encargado** → debe haber **contrato de transmisión de datos**.
- Puede requerir registrar las bases ante la **SIC** (Registro Nacional de Bases de Datos, RNBD).
  La SIC vigila y **multa**.

## 2. Historia clínica (salud)
- **Resolución 1995 de 1999** y **Resolución 839 de 2017**: la historia clínica es **reservada/
  confidencial** y se **conserva mínimo 15 años**.
  - 👉 Por esto guardar en el navegador es **inviable**: la ley obliga a conservar; si se borra
    al limpiar caché, se incumple.
- **Ley 2015 de 2020**: historia clínica electrónica **interoperable** nacional (conecta con la
  visión de Milagro copiando al HIS).

## 3. Dos consentimientos distintos
- El **del acto médico** (la atención).
- El **de tratamiento de datos** Y el **de grabar el audio** de la consulta (Miracle escucha →
  grabar requiere permiso del paciente). *Hoy el checkbox de consentimiento se quitó; al volver
  al audio real hay que reincorporar su registro.*

## 4. Transferencia internacional
Supabase (`miracle-app`) está en **us-east-1 (EE. UU.)**. Mover datos de salud de colombianos
al exterior es **transferencia internacional**, regulada por la Ley 1581 (el país destino debe
tener nivel adecuado de protección, o se requieren salvaguardas/autorización). **Revisar con
abogado** si conviene una región distinta o salvaguardas contractuales.

## 5. Cómo el diseño actual ya ayuda

| Exige la ley | Lo que ya tenemos |
|---|---|
| Seguridad / control de acceso | RLS por organización + roles |
| Trazabilidad (quién hizo qué) | tabla `audit_events` |
| Conservación / no perder datos | base de datos real (no navegador) |
| Cifrado en reposo | Supabase lo trae |
| Revisión humana | "la nota requiere aprobación médica" |

## 6. Lo que falta (pre-producción)
- Registro del **consentimiento** (datos + grabación) por paciente.
- **Contrato Responsable/Encargado** con cada hospital.
- Política de **retención y borrado** (regla de 15 años).
- Revisar **transferencia internacional** (región de Supabase) y posible **RNBD** ante la SIC.
- Un **abogado** que valide todo antes del primer paciente real.

> Nota positiva: esto es justo lo que los hospitales preguntan al comprar; tenerlo claro es
> ventaja comercial.
