# Plan de implementación: el notch se hace esperar, y las pestañas del navegador vuelven a ser tuyas

Estado: **implementado** (2026-09-30) · Nace del diagnóstico del 2026-09-30 · Rama: `jose/el-notch-se-hace-esperar`

## Diagnóstico: qué se midió

El dueño, mirando la pantalla con Chrome maximizado (2026-09-30): «que el notch solo aparezca al
mantener el mouse allá arriba por 0,5 segs o algo así […] no quiero que cuando las personas suban
el mouse no puedan seleccionar la parte de las pestañas del navegador, que actualmente uno lo sube
e instantáneamente se abre eso y estorba al seleccionar pestañas».

| Qué | Medida | Fuente |
|---|---|---|
| Franja que asoma el notch | 6 px de alto × 620 de ancho (340 de pieza + 140 por lado), centrada arriba | `ReglaDeLaBandeja.ZonaDeAsomo` |
| Lo que tarda en asomar | **0 ms de espera**: el primer sondeo que ve el cursor dentro lo trae (cada 150 ms) | `PanelDeAcciones.RevisarAsomo` |
| Lo que hay debajo de esa franja | la tira de pestañas de un navegador maximizado, que es clicable desde y = 0 | captura del dueño |
| Lo que tapa al asomar | 340 × 62 en el centro de arriba, encima de esas pestañas | `MedidaDelNotch` |

La causa no es la franja —tocar el borde es el gesto, y la 260 la congela así— sino que **pasar por
ella ya es pedirlo**. Subir a una pestaña con un movimiento rápido tropieza con el borde (es el sitio
donde el cursor menos control fino tiene), y el notch cae encima de lo que se iba a pulsar.

## Por qué esto va dirigido por especificación

El asomo se juzga hoy solo por geometría (260, 335): ninguna promesa dice CUÁNDO, y por eso un
asomo instantáneo pasaba el contrato con nota. Sin una promesa del tiempo, esto vuelve a ser
instantáneo en cuanto alguien «afine» el sondeo.

**La regla del flujo, y no tiene excepciones:** ninguna línea de producción entra antes que la
promesa que la juzga. Cada fase empieza con el contrato ROTO y termina con el contrato INTACTO.

## La especificación

| # | Promesa | Fase que la pone verde |
|---|---|---|
| 530 | el notch se hace esperar: medio segundo con el cursor quieto en la franja de arriba lo asoma, y una sola vez por visita; pasar por ella, recorrerla de lado como quien busca una pestaña o hacer clic dentro no lo asoman, y tras un clic no vuelve hasta salir de la franja | 1 |

### Con qué se juzga

Pura y sin pantalla, como el resto del notch: `EsperaDelAsomo.Dispara(enLaFranja, cursor,
botonApretado, ahora)` recibe las muestras que hoy toma el sondeo y contesta si toca asomar. El
contrato le da relojes y posiciones inventados; nada de hooks ni de escritorio.

Lo que cierra el asunto es el **clic**: con solo la espera, quien se queda medio segundo eligiendo
pestaña a ras del borde lo seguiría llamando. Un clic dentro de la franja dice «estoy usando lo de
debajo», y la franja queda muda hasta que el cursor se va.

## Fases

| Fase | Pone verde | Toca |
|---|---|---|
| 1 | 530 | `EsperaDelAsomo.cs` (nuevo) y `PanelDeAcciones.RevisarAsomo` |

## Lo que NO entra

- Cambiar la franja (alto, ancho): la 260 la congela, y no es lo que estorba.
- Que el notch deje pasar los clics mientras está asomado: una vez llamado a propósito, lo de
  debajo está tapado igual que lo tapa cualquier ventana que uno abre.

## Evidencia (2026-09-30)

**Contrato:** rojo antes del código (`⧗ PENDIENTE: «EsperaDelAsomo» todavía no existe`), INTACTO
después: 365 en verde, 0 rotas. **Sabotaje, comprobado que se aplicó:** sin la regla del clic →
`CONTRATO ROTO` por «tras un clic dentro de la franja no asoma…»; sin el reinicio por movimiento →
`CONTRATO ROTO` por «recorrer el borde de lado dos segundos… no lo asoma».

**Sobre el PC real** (cursor movido por `SetCursorPos`, el notch mirado con `IsWindowVisible` sobre
la ventana «Ü Acciones» del proceso; 1 pantalla, 1536×960 al 125 %):

| Gesto | Antes (leído del código, no medido) | Ahora (medido) |
|---|---|---|
| rozar el borde 300 ms y bajar | asomaba en ≤150 ms | no asoma |
| recorrer el borde de lado 1,5 s | asomaba | no asoma |
| quedarse quieto arriba | asomaba en ≤150 ms | asoma a los 578 ms |
| bajar el cursor después | se retira | se retira |

**Lo que NO se midió sobre el PC:** el clic. No se pulsó nada de verdad para no tocar lo que el
dueño tenía abierto; esa rama la juzga solo el contrato, y la prueba a mano queda para él.
La primera medida no valió y se dice: el instrumento no encontraba la ventana (la buscaba por
título) y contestaba «no asoma» a todo — un juez que no puede mirar no dice «no sé».
