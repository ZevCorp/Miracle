---
name: revisa
description: Revisa el diff de la rama contra las formas de fallo que este repo ya pagó — catch mudos, matar U.exe por nombre, voz fuera de ConversacionEnVivo, Process.Start sin carpeta, promesas que no pueden fallar, migraciones sin RLS o editadas, logs con texto clínico, IA fuera del escudo, cambios que rompen a los clientes — primero con un script que las cuenta y después leyendo. Úsala antes de /verifica o de un PR, cuando el usuario diga "revisa", "revísame esto", "mira el diff", "¿qué se me pasó?", "code review", y también para contar en cuántos sitios vive una clase de error.
---

# Revisar con lo que ya se pagó

El repo tiene diecinueve patrones de desarrollo y aprendizajes con fecha
(`apps/windows/.claude/rules/patrones-de-desarrollo.md` y `apps/windows/CLAUDE.md`), y Graph, el
portal y Android tienen sus propias clases de error repetidas en el historial. Una revisión que no
las mira es una revisión genérica.

## 1. Lo mecánico: el script

```bash
python3 .claude/skills/revisa/scripts/higiene.py                # lo que tu rama AÑADIÓ (contra origin/main)
python3 .claude/skills/revisa/scripts/higiene.py apps/windows   # solo esa carpeta
```

Mira solo las líneas añadidas y los archivos nuevos: lo heredado no es tuyo. ✘ = se pagó caro y casi
nunca tiene excusa; ⚠ = léelo, puede estar bien. Cada clase dice de dónde sale (patrón nº, spec,
commit) para discutir la regla y no el aviso.

| Clase | Dónde |
|---|---|
| `catch-mudo`, `ruta-anclada-al-repo` | todo el código |
| `matar-u-por-nombre`, `voz-paralela`, `process-start-sin-carpeta`, `sap-enlace-temprano`, `findbyid-sin-normalizar`, `vacio-no-es-ausente`, `ps1-sin-bom` | Windows |
| `no-pude-sin-fallo`, `debe-con-dos-afirmaciones`, `ignore-en-contrato` | los contratos |
| `log-con-datos-clinicos`, `fetch-sin-plazo`, `host-de-ia-directo`, `protegido-sin-certificar` | Graph, portal, Android |
| `tabla-sin-rls`, `definer-sin-search-path`, `migracion-vieja-editada`, `migracion-version-repetida` | `supabase/migrations/` |

## 2. Lo que un grep no ve: leer el diff

`git diff origin/main...HEAD`, archivo por archivo, con estas preguntas. Son las que más han costado:

1. **¿Un mensaje concluye?** Si el texto de un error o de un log puede salir por dos causas
   distintas, está mal escrito (patrón nº2). Debe describir el paso que falló.
2. **¿Algo dice que hizo lo que no comprobó?** Devolver `true` no es haber hecho el trabajo;
   seleccionar no es abrir (aprendizaje nº19). Actuar primero, verificar después.
3. **¿Un dato estimado se presenta como leído?** (patrón nº8). Y en el portal: ¿la UI afirma algo
   que el servidor no certificó? (D21).
4. **¿Se comparan identidades de forma distinta?** Un id de SAP crudo contra uno normalizado es
   falso siempre, y en silencio (aprendizaje nº16). Normalizar en un solo sitio.
5. **¿Un paso que se salta deja rastro?** El denominador es el plan, no lo ejecutado (patrón nº10).
6. **¿Cambia la forma de una respuesta que leen otros?** `POST /api/v1/agent/turn` lo leen
   Windows, Android y Mac: si el diff toca `AgentTurnService` o `conscious-brain/`, corre
   `/contrato-cliente`.
7. **¿Sale texto clínico hacia un proveedor nuevo?** Es `/frontera-ia`.
8. **¿El portal trata la «foto» del store como verdad?** Un «no encontrado» sin `ensureX` de
   rescate ya rompió dos veces.
9. **¿Se arregló la clase o el caso?** Si el diff corrige un error, ¿cuántos sitios más lo tienen?
   (siguiente sección).
10. **¿Hay promesa para el comportamiento nuevo?** Código sin promesa no pasa el portero.

## 3. Contar los sitios de una clase

Cuando arreglas un error, el número de sitios va al commit (patrón nº5):

```bash
python3 .claude/skills/revisa/scripts/higiene.py --todo apps/windows --clase process-start-sin-carpeta --sitios
```

En modo `--todo` los números son un inventario de lo heredado, no una lista de deberes: hoy hay
centenares de `catch { }` en las sondas COM de Windows. Lo que cuenta es no añadir uno más sin su
porqué. Para una clase que el script no conoce, búscala tú con `rg` y cuéntala igual: es
`/clase-de-error`.

## 4. El informe

Al usuario, ordenado por gravedad, máximo una línea por hallazgo:

```
✘ apps/windows/.../AgentLoop.cs:323 — catch { } se traga el fallo de Hablar(): reporta el motivo (patrón nº3)
⚠ services/graph/web/api/x.js:40 — fetch sin plazo a OpenAI, y fuera de LLMProvider (/frontera-ia)
✔ Sin cambios de forma en agent/turn. Migraciones: ninguna.
```

Si el usuario pide arreglarlos, arregla los ✘ primero, y vuelve a correr el script: el recuento de ✘
tiene que llegar a 0. Los ⚠ que se quedan, con su motivo en una línea.
