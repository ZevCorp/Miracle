# Las skills del monorepo

Llegan a cualquier carpeta del repo (las de la raíz se cargan desde todas). Se invocan con
`/<nombre>` o solas, cuando la petición encaja con su descripción. Las que traen `scripts/` hacen
el trabajo mecánico con un programa probado; el resto son el «cómo» de este repo escrito una vez.

## El método (la promesa antes que el código)

| Etapa | Skill | Qué hace |
|---|---|---|
| 1 | `/especifica` | la spec con promesas numeradas |
| 2 | `/fases` | las fases, una promesa por fase |
| — | `/numera` | **el siguiente número libre** de spec y de promesas, mirando todas las ramas (script) |
| 3 | `/promesas` | las promesas en el contrato, vistas en rojo |
| 4 | `/implementa` | una fase hasta verde |
| 5 | `/sabotea` | **romper a propósito** y ver cada promesa roja, con la tabla «Los sabotajes» (script) |
| 6 | `/verifica` | la tabla de evidencia |
| — | `/prueba-de-verdad` | el nivel 4: el PC, el teléfono, la app instalada, el servidor en marcha |
| — | `/antes-del-push` | **ensayo del portero** y lo que el portero no mira, secretos incluidos (script) |
| 7 | `/a-main` | el PR y el merge |

## Cuando algo falla

| Skill | Para |
|---|---|
| `/lee-el-log` | leer los logs de Ü (Windows por instancia, logcat, Mac, Graph) y sacar la línea de tiempo y el Diagnóstico (script) |
| `/clase-de-error` | arreglar la clase y no el caso: contar los sitios, guardián en rojo, todos corregidos |
| `/juez-rojo` | qué significa cada rojo y cada 99 de los cinco jueces |
| `/ci-rojo` | la compuerta del PR en rojo: qué trabajo, reproducirlo, diferencias de máquina |

## Calidad del día a día

| Skill | Para |
|---|---|
| `/revisa` | revisar la rama contra las formas de fallo que el repo ya pagó (script `higiene.py`) |
| `/commit` | el mensaje en la voz del repo, con la medida y las promesas que el diff añade (script) |
| `/tablero` | en qué va cada spec, y lo raro: repetidas, viejas, terminadas sin cerrar (script) |

## Por proyecto

| Skill | Proyecto | Para |
|---|---|---|
| `/graph-ruta` | Graph | un endpoint de punta a punta, con su juez sin red |
| `/contrato-cliente` | Graph + los 3 clientes | la forma de `agent/turn`, campo por campo (script) |
| `/frontera-ia` | Graph + portal | todo texto clínico por el escudo; excepciones declaradas |
| `/migracion` | Graph + portal | migraciones de Supabase sin choques de versión y con RLS (script) |
| `/pantalla-web` | portal | una pantalla con sus tres puertas de permisos y sus tests guardianes |
| `/verifica-web` | portal | el CI local y las capturas en móvil y escritorio, claro y oscuro (scripts) |
| `/publica-windows` | Windows | una release con ensayo, banco, comprobación y a quién le llegó |

## Cómo se probaron (2026-10-01)

Cada script se corrió contra el repo real y contra un sabotaje que tenía que detectar (una rama con
ocho defectos sembrados, una promesa saboteada, un log con dos instancias, un campo nuevo en el
turno). Y cinco tareas reales se hicieron dos veces, con la skill y sin ella: con la skill pasaron
el 100 % de las comprobaciones frente al 91 %, en ~117 s y ~36 k tokens menos por tarea. Esas
corridas destaparon seis fallos de los scripts, ya corregidos.

Para añadir una: una carpeta con su `SKILL.md` (nombre, y una descripción que diga cuándo usarla),
y sus `scripts/` si el trabajo es mecánico. Que el script diga de dónde sale cada regla.
