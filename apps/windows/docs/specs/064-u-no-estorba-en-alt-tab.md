# Plan de implementación: Ü no estorba en Alt+Tab

Estado: **implementado** (2026-09-30) · Nace del diagnóstico del 2026-09-30 · Rama: `jose/u-no-estorba-en-alt-tab`

## Diagnóstico: qué se midió

El dueño, con dos fotos de su Alt+Tab (2026-09-30): «no quiero que se abran 2 ventanas de Ü […] me
está afectando la navegación de alt+tab que aparezcan ahí esas ventanas […] daña mucho la experiencia
de usuario y es una fricción muy grande». En las fotos hay dos entradas «Ü»: una con la carita y otra
con la pestaña del muelle.

| Qué | Medida | Fuente |
|---|---|---|
| Ventanas de Ü (clases que heredan de `Window`) | 16 | `grep` de `: Window` en `windows-client/src` |
| De ellas, piezas flotantes (sin barra de tareas, siempre encima) | 9 | sus constructores |
| Flotantes que se sacan de Alt+Tab (`WS_EX_TOOLWINDOW`) | **5 de 9**: notch, aura, resaltado, inspector, insignia | `grep` de `WS_EX_TOOLWINDOW` |
| Flotantes que NO | **4**: carita (`FaceWindow`), muelle, carrusel de apps, tarjetas de recuerdo | lo mismo |
| Las dos que se ven siempre | carita y muelle — viven en pantalla todo el rato | fotos del dueño |

`ShowInTaskbar = false` las quita de la barra de tareas, **no** de Alt+Tab: Windows lista ahí toda
ventana visible que no sea de herramienta. Cada flotante lo arreglaba por su cuenta con su propio
`SetWindowLong`, y cuatro no lo hicieron: la clase de error es «cada ventana se acuerda, o no».

## Por qué esto va dirigido por especificación

Arreglar las cuatro a mano deja la clase de error intacta: la ventana flotante número diez volverá a
salir en Alt+Tab y nadie se enterará hasta que alguien lo sufra. Es el mismo caso que los 44
tachones de tooltips que cerró la promesa 164: se apaga en un solo sitio, y el contrato exige que
toda ventana diga de qué clase es.

**La regla del flujo, y no tiene excepciones:** ninguna línea de producción entra antes que la
promesa que la juzga. Cada fase empieza con el contrato ROTO y termina con el contrato INTACTO.

## La especificación

| # | Promesa | Fase que la pone verde |
|---|---|---|
| 531 | las piezas flotantes de Ü —la carita, el muelle, el notch, el carrusel, las tarjetas y las superposiciones— no salen en Alt+Tab: su estilo lleva TOOLWINDOW y nunca APPWINDOW sin perder lo que ya tenía; las ventanas de trabajo siguen saliendo; y toda ventana de Ü está declarada flotante o de trabajo, así que una nueva no se cuela sin decirlo | 1 |

(La 530 la usa la rama `jose/el-notch-se-hace-esperar`, aún sin mergear: no se recicla.)

### Con qué se juzga

Sin pantalla: `FueraDelAltTab.Estilo(exstyle)` es aritmética de bits, y la declaración se juzga
recorriendo por reflexión todas las clases del cliente que heredan de `Window`. Que el estilo llegue
de verdad a la ventana viva solo lo dice el PC: se mide leyendo el estilo de cada ventana del proceso.

## Fases

| Fase | Pone verde | Toca |
|---|---|---|
| 1 | 531 | `FueraDelAltTab.cs` (nuevo) y una línea en `App.OnStartup` |

## Lo que NO entra

- Juntar la carita y el muelle en una sola ventana. Son dos por diseño (spec 010: el muelle se queda
  clavado al borde y la carita viaja); lo que estorbaba no es que sean dos, sino que se vean en Alt+Tab.
- Quitar los `SetWindowLong` propios de las cinco que ya lo hacían: ponen además otros bits
  (transparente al ratón, sin activar) y no estorban.
- Los dos `new Window` sueltos (`Aviso` y el panel de desarrollo de `FaceWindow`): no son subclases,
  no los ve la declaración, y se quedan como ventanas de trabajo.

## Evidencia (2026-09-30)

**Contrato:** rojo antes del código (`⧗ PENDIENTE: «FueraDelAltTab» todavía no existe`), INTACTO
después: 365 en verde, 0 rotas — y con eso, las 16 clases de ventana declaradas sin que falte ni
sobre ninguna. **Sabotaje, comprobado que se aplicó:** sin `FaceWindow` en la lista → `CONTRATO ROTO`
por «faltan: FaceWindow»; sin quitar APPWINDOW → `CONTRATO ROTO` por «si traía APPWINDOW se le quita».

**Sobre el PC real** (el estilo leído con `GetWindowLong` de cada ventana visible del proceso;
1 pantalla, 1536×960 al 125 %):

| Ventana | Antes (medido) | Ahora (medido) |
|---|---|---|
| carita (`FaceWindow`) | `0x80008` — sale en Alt+Tab | `0x80088` — fuera |
| muelle | `0x80008` — sale en Alt+Tab | `0x80088` — fuera |

Y el log de Ü lo dice por su cuenta: `alt-tab: «FaceWindow» fuera de Alt+Tab · exstyle 0x80008 → 0x80088`,
y lo mismo para «Muelle».

**Lo que NO se midió sobre el PC:** el carrusel y las tarjetas de recuerdo, que no estaban abiertos
—van por la misma puerta, pero nadie los vio—; y el Alt+Tab mismo: se midió el estilo que Windows
consulta para armarlo, no la lista en pantalla. Esa mirada es del dueño.
