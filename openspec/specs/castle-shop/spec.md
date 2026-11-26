# Castle shop · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
El castillo-tienda: apertura por la puerta con re-armado, productos (mejoras de arma y curación),
compra con oro, salida y pausa total mientras está abierta.


## Requirements

### Requirement: Contenido de la tienda validado
El sistema SHALL leer de `content/*.json`, validados con zod antes de llegar al dominio:
- el **radio de interacción** de la puerta: número > 0;
- la **distancia de re-armado**: número estrictamente mayor que el radio de interacción;
- para cada mejora de arma (ver "Dos catálogos de mejoras" en `upgrades`), un **precio por nivel**, del nivel 1 al
  `maxLevel`: exactamente `maxLevel` precios, enteros ≥ 1, cada uno ≥ el del nivel anterior;
- la **curación de pago**: su precio (entero ≥ 1) y su porción de vida (entero ≥ 1).

Un valor fuera de rango, un campo ausente o desconocido, una lista de precios de longitud distinta de `maxLevel`, un
precio menor que el del nivel anterior o una mejora de arma sin precios MUST impedir que se muestre el menú o empiece
una partida, con un error que nombre el campo o la mejora.

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito, el radio de interacción es > 0 y la distancia de re-armado es mayor que él
- **AND** cada una de las 6 mejoras de arma tiene exactamente `maxLevel` precios enteros ≥ 1 no decrecientes
- **AND** el precio y la porción de la curación son enteros ≥ 1

#### Scenario: Valores inválidos
- **GIVEN** el contenido por defecto con, en un caso cada vez: radio de interacción 0 o −5; distancia de re-armado
  igual al radio; precio de curación 0 o 2,5; porción de curación 0; un precio 0; los precios de `fast-ci` 10, 8, 12,
  14, 16 (el segundo baja); 4 precios para una mejora de `maxLevel` 5; o un campo extra `discount`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo o esa mejora
- **AND** no se muestra el menú ni se crea ninguna partida

#### Scenario: Límites válidos
- **GIVEN** el contenido por defecto con, en un caso cada vez: distancia de re-armado = radio + 0,001; todos los
  precios de una mejora iguales (5, 5, 5, 5, 5); precio y porción de curación 1
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

### Requirement: Apertura por la puerta con re-armado
El sistema SHALL abrir la tienda según estas reglas, evaluadas en el paso de la tienda del tick (ver "Orden de los
pasos del tick" en `simulation-loop`) con la posición del jugador ya movido y la distancia d entre el centro del
jugador y la puerta:
- toda partida empieza con la tienda **desarmada** (el jugador nace en la salida, que en el mapa generado es la
  puerta);
- si la tienda está desarmada y d ≥ distancia de re-armado, queda **armada**;
- si la tienda está armada, d es **estrictamente menor** que el radio de interacción y la partida sigue en curso al
  llegar a ese paso (no se ha abierto una oferta en este tick), la tienda se abre, queda desarmada y la partida pasa a
  **en tienda** (ver `run-state`); el tick cuenta igualmente;
- si en ese tick se ha abierto una oferta, la tienda no se abre y sigue armada: se abrirá en el primer tick posterior
  que llegue a ese paso en curso con d < radio;
- en el tick en que la partida termina (victoria o derrota) el paso no se ejecuta.

Salir de la tienda no la arma: para volver a abrirla el jugador MUST alejarse al menos la distancia de re-armado y
volver. En un mapa sin puerta la tienda no se abre nunca. Evaluar la puerta MUST NOT consumir azar.

#### Scenario: No se abre al nacer
- **GIVEN** el contenido por defecto, la semilla 42 con su mapa generado y el jugador quieto en la puerta
  (1.950, 1.170)
- **WHEN** se ejecutan ticks hasta que la partida termina o hasta el tick 36.000
- **THEN** la partida no pasa por en tienda en ningún tick

#### Scenario: Volver sin alejarse lo suficiente
- **GIVEN** el mapa vacío con puerta declarada en (1.000, 1.000), radio de interacción 40 y distancia de re-armado
  300 (valores de escenario), y el jugador en la puerta
- **WHEN** el jugador se aleja hasta d = 299, vuelve a d = 0 y se ejecutan 60 ticks más
- **THEN** la tienda no se ha abierto en ningún tick

#### Scenario: Volver tras alejarse
- **GIVEN** la puerta del escenario anterior y el jugador que se aleja hasta d = 300 en el tick a
- **WHEN** vuelve hacia la puerta y en el tick b es la primera vez tras a con d < 40
- **THEN** la partida está en tienda en el snapshot del tick b, no antes
- **AND** el snapshot del tick a marca la tienda armada

#### Scenario: Tangencia con el radio no abre
- **GIVEN** la puerta y los valores de "Volver sin alejarse lo suficiente" con la tienda armada
- **WHEN** el jugador queda quieto exactamente a d = 40 durante 600 ticks
- **THEN** la tienda no se abre; al pasar a d = 39,9 se abre en ese tick

#### Scenario: Salir no reabre
- **GIVEN** la tienda abierta en el tick n con el jugador a d = 10
- **WHEN** se sale de la tienda y se ejecutan 600 ticks con el jugador quieto a d = 10
- **THEN** la partida sigue en curso en los 600 ticks y la tienda está desarmada

#### Scenario: Segunda visita
- **GIVEN** la partida del escenario anterior tras sus 600 ticks
- **WHEN** el jugador se aleja hasta d ≥ 300 y vuelve hasta d < 40
- **THEN** la tienda se abre por segunda vez

#### Scenario: Oferta y tienda en el mismo tick
- **GIVEN** la tienda armada, el jugador que entra a d < 40 en el tick n y una gema que le hace subir de nivel en el
  tick n
- **WHEN** se ejecuta el tick n, se elige la opción 0 y se ejecuta 1 tick con el jugador quieto
- **THEN** en el snapshot del tick n la partida está eligiendo mejora y la tienda sigue armada
- **AND** en el del tick n + 1 la partida está en tienda

#### Scenario: Sin tienda en el tick de la victoria
- **GIVEN** una partida con duración objetivo 120 ticks, la tienda armada y el jugador que entra a d < 40 en el tick
  120
- **WHEN** se ejecuta el tick 120
- **THEN** la partida está terminada con victoria y no ha pasado por en tienda

#### Scenario: Mapa sin puerta
- **GIVEN** el contenido por defecto, la semilla 7, el mapa vacío y un input que lleva al jugador a 400 px del centro
  del mundo y lo devuelve a él
- **WHEN** se ejecutan 1.200 ticks
- **THEN** la partida no pasa por en tienda en ningún tick

### Requirement: Productos de la tienda
El sistema SHALL ofrecer en la tienda, en este orden, un producto por cada mejora de arma, en el orden de su
catálogo, y después la curación de pago. Cada producto de mejora tiene su id, nombre, descripción, nivel actual,
`maxLevel` y el **precio del siguiente nivel** (el precio del nivel actual + 1 del contenido) o ningún precio si está
en su `maxLevel`. La curación tiene un id propio, su nombre, su precio y su porción. El snapshot MUST exponer en todos
los estados de la partida la lista de productos con esos campos, si la tienda está armada y, si la partida está en
tienda, que lo está (ver "Snapshot para el motor" en `simulation-loop`). Las mejoras de arma solo se obtienen
comprándolas (ver "Dos catálogos de mejoras" en `upgrades`).

#### Scenario: Productos al empezar
- **GIVEN** una partida recién creada con el contenido por defecto
- **WHEN** se lee el snapshot del tick 0
- **THEN** hay 7 productos: `strict-rules`, `fast-ci`, `wide-analysis`, `hard-asserts`, `watch-mode`, `coverage` y la
  curación, en ese orden
- **AND** cada mejora tiene nivel 0 y como precio el de su nivel 1 en el contenido

#### Scenario: Producto en su nivel máximo
- **GIVEN** una partida con `coverage` comprada hasta su `maxLevel`
- **WHEN** se lee el snapshot
- **THEN** el producto `coverage` tiene nivel igual a su `maxLevel` y ningún precio

### Requirement: Compra en la tienda
El sistema SHALL ofrecer un caso de uso para comprar un producto por su id mientras la partida está en tienda. Una
compra válida resta su precio al oro, y:
- si es una mejora de arma, sube su nivel en 1 y aplica su efecto (ver "Efectos de las mejoras" en `upgrades`);
- si es la curación, sube la vida actual en su porción, con tope en la vida máxima efectiva (ver "Curación de pago" en
  `player-health`).

Se pueden hacer varias compras en una misma visita; cada una ve el oro, los niveles y la vida que dejó la anterior.
Comprar MUST devolver un error tipado (`Result`), sin cambiar el snapshot ni el estado de ningún `RandomGenerator`,
cuando la partida no está en tienda (en curso, eligiendo mejora o terminada), cuando el id no es de un producto, cuando
la mejora está en su `maxLevel`, cuando el oro es menor que el precio y, para la curación, cuando la vida ya está en
la vida máxima efectiva. Comprar no ejecuta ticks ni saca a la partida de la tienda y MUST NOT consumir azar.

#### Scenario: Compra de una mejora de arma
- **GIVEN** una partida en tienda con oro 30 y `strict-rules` en nivel 0 con precios 10, 15, 20, 25, 30
- **WHEN** se compra `strict-rules`
- **THEN** el oro vale 20, `strict-rules` está en nivel 1, su producto tiene precio 15 y la partida sigue en tienda
- **AND** el Linter hace daño 9 desde el siguiente tick ejecutado

#### Scenario: Varias compras en una visita
- **GIVEN** la partida del escenario anterior tras la compra (oro 20)
- **WHEN** se compra `strict-rules` otra vez y después `fast-ci` con precio de nivel 1 de 10
- **THEN** la segunda compra deja el oro en 5 y `strict-rules` en nivel 2, y la tercera devuelve un error de oro
  insuficiente sin cambiar el snapshot

#### Scenario: Oro exacto
- **GIVEN** una partida en tienda con oro 10 y `coverage` con precio de nivel 1 de 10
- **WHEN** se compra `coverage`
- **THEN** el oro vale 0 y `coverage` está en nivel 1

#### Scenario: Compras rechazadas
- **GIVEN** una partida en tienda con oro 1.000, `fast-ci` en su `maxLevel` y la vida al máximo
- **WHEN** se compra `fast-ci`, después `refactor` (no es un producto) y después la curación
- **THEN** cada compra devuelve un error tipado distinto (nivel máximo, producto desconocido, vida llena) y el snapshot
  y el estado del azar no cambian

#### Scenario: Compra fuera de la tienda
- **GIVEN** una partida en curso con oro 1.000, otra eligiendo mejora y otra terminada
- **WHEN** en cada una se compra `strict-rules`
- **THEN** cada compra devuelve un error tipado y el snapshot no cambia

#### Scenario: Comprar no consume azar
- **GIVEN** dos partidas idénticas con la semilla 7 que abren la tienda en el mismo tick con oro 50
- **WHEN** en una se compran 2 productos y en la otra ninguno, y ambas salen de la tienda
- **THEN** el estado del `RandomGenerator` de la partida y el del azar de las ovejas es el mismo en las dos

### Requirement: Salida de la tienda
El sistema SHALL ofrecer un caso de uso para salir de la tienda: con la partida en tienda la devuelve a en curso sin
ejecutar ningún tick; el siguiente tick ejecutado continúa exactamente donde se quedó la partida. Salir con la partida
en otro estado MUST devolver un error tipado sin cambiar el snapshot. Una visita sin compras MUST dejar la partida
igual que si la tienda no se hubiera abierto, salvo la tienda desarmada.

#### Scenario: Salir y seguir
- **GIVEN** una partida que abre la tienda en el tick n
- **WHEN** se sale sin comprar y se ejecuta 1 tick
- **THEN** tras salir el estado es en curso con `snapshot.tick` n, y tras el tick `snapshot.tick` vale n + 1

#### Scenario: Salir fuera de la tienda
- **GIVEN** una partida en curso, otra eligiendo mejora y otra terminada
- **WHEN** en cada una se pide salir de la tienda
- **THEN** cada petición devuelve un error tipado y el snapshot no cambia

#### Scenario: Visita sin compras
- **GIVEN** dos partidas con la semilla 7 y los mismos inputs, en las que la tienda se abre en el tick n
- **WHEN** en una se sale enseguida y en la otra se piden 600 ticks durante la tienda y después se sale, y ambas
  ejecutan 600 ticks más
- **THEN** sus snapshots son iguales campo a campo en cada uno de esos 600 ticks

### Requirement: Overlay de la tienda
La vista SHALL mostrar, si y solo si el snapshot está en tienda, un overlay centrado en la ventana con el oro
disponible, una fila por producto en el orden de la tienda (icono, ver "Icono en las filas de la tienda"; nombre,
descripción, nivel actual / máximo y precio, o "máximo" sin precio) y un botón `Salir`. Un producto cuyo precio supera
el oro, o la curación con la vida llena, MUST mostrarse como no comprable, con el aviso `Oro insuficiente` (o de vida
llena) visible en esa fila. Hacer clic en un producto (también sobre su icono) MUST intentar comprarlo con el caso de
uso de compra: si la compra falla, no cambia nada. Pulsar Esc o el botón `Salir` MUST salir de la tienda con el caso de
uso de salida, sin abrir la pausa (ver "Pausa con Esc" en `main-menu`). Mientras el overlay se ve, el input de
movimiento no llega a la simulación y las teclas 1, 2, 3 y R no tienen efecto. Tras cada compra, el overlay y el HUD
muestran el oro, los niveles y la vida del snapshot nuevo desde el siguiente frame pintado.

#### Scenario: Overlay con oro justo
- **GIVEN** un snapshot en tienda con oro 12, `strict-rules` a precio 10 y `fast-ci` a precio 15
- **WHEN** se pinta
- **THEN** el overlay es visible con oro 12, 7 filas en el orden de la tienda, cada una con 1 icono, y el botón `Salir`
- **AND** la fila de `strict-rules` es comprable y la de `fast-ci` muestra `Oro insuficiente`

#### Scenario: Clic en un producto
- **GIVEN** el overlay del escenario anterior
- **WHEN** se hace clic en la fila de `strict-rules` y se pinta el frame siguiente
- **THEN** el overlay muestra oro 2 y `strict-rules` en nivel 1, y la fila de `strict-rules` muestra `Oro insuficiente`

#### Scenario: Clic sin oro
- **GIVEN** el overlay del escenario "Overlay con oro justo"
- **WHEN** se hace clic en la fila de `fast-ci`
- **THEN** el snapshot no cambia y el overlay sigue visible

#### Scenario: Salir con Esc o con el botón
- **GIVEN** el overlay visible en el tick n, una vez, y otra vez el mismo estado
- **WHEN** en la primera se pulsa Esc y en la segunda se pulsa `Salir`, y en ambas se pinta 1 frame de 16,667 ms
- **THEN** en ambas el overlay no es visible, el overlay de pausa no se ha visto y `snapshot.tick` vale n + 1

#### Scenario: Sin overlay fuera de la tienda
- **GIVEN** snapshots en curso, eligiendo mejora, en pausa y terminado
- **WHEN** se pintan
- **THEN** el overlay de la tienda no es visible en ninguno

### Requirement: Tienda observable en el navegador
La sonda E2E (`window.__sprint`) SHALL exponer si el overlay de la tienda es visible y, por producto, su id, su nivel,
su precio (o ninguno) y si se muestra como no comprable. El recorrido completo MUST poder hacerse en el juego real en
modo manual.

#### Scenario: Abrir, intentar comprar y salir [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` y `map: 'real'`, y un input que aleja al jugador de la
  puerta más allá de la distancia de re-armado y lo devuelve a ella
- **WHEN** se avanza con `step(n)` hasta que la partida está en tienda, se hace clic en el producto más barato, se
  pulsa Esc y se llama a `step(1)`
- **THEN** con la tienda abierta la sonda informa del overlay visible, con el oro y los productos del snapshot
- **AND** tras el clic, si el oro alcanzaba el precio, el nivel de ese producto ha subido en 1 y el oro ha bajado en
  su precio; si no, la sonda lo marca no comprable y el oro no cambia
- **AND** tras Esc el overlay no es visible, no se ha visto la pausa y `step(1)` devuelve 1, sin errores no capturados

### Requirement: Balance con la tienda y el bot v4
El sistema SHALL cumplir, con el contenido por defecto final de este change (ovejas incluidas) y el bot de referencia
**v4** (ver "Bot de referencia para el balance" en `run-outcome`), la dificultad de "Partida ganable y perdible con el
contenido por defecto" (`run-outcome`): entre **25 y 35** victorias sobre las semillas 1..50 y 0 jugadores quietos
supervivientes con el mapa generado y con el mapa vacío. La línea base de `tests/support/balanceBaseline.ts` (27/50
con el bot v3, tope de ovejas 0 y la huella del contenido de `upgrades`) se **reemplaza** a propósito por la medida con
el bot v4 y el contenido final: por semilla, el resultado, el tick final y las bajas, más la huella del contenido de
combate y de la tienda; queda congelada y un test MUST fallar si cualquiera de ellos cambia. El verify-report MUST
anotar: las victorias, el oro medio ganado y gastado por partida, las visitas y compras medias por partida, la media de
mechas de `goblin-barrel` (que sigue en "Barril que cumple su papel") y el tiempo del lote del bot en local y ×2,8
como equivalente de CI (solo anotado). El lote MUST caber en el tiempo máximo del lote en los tests (180 s), que no
se sube; si el CI real lo desmiente, se optimiza en otro change.

#### Scenario: Victorias del bot v4
- **GIVEN** el contenido por defecto final, cada semilla de 1 a 50 con su mapa generado y el bot de referencia v4
- **WHEN** se juega cada partida hasta que termina o hasta el tick 36.000
- **THEN** el número de victorias en el tick 36.000 es ≥ 25 y ≤ 35
- **AND** el bot ha hecho ≥ 1 compra en ≥ 1 de las 50 partidas

#### Scenario: Línea base nueva congelada
- **GIVEN** la línea base nueva de `tests/support/balanceBaseline.ts` y el contenido por defecto final
- **WHEN** se juega cada semilla de 1 a 50 con el bot v4
- **THEN** cada semilla termina con el resultado, el tick y las bajas de la línea base
- **AND** con un precio cualquiera de la tienda cambiado en 1, el test de la huella falla

#### Scenario: Quieto pierde con la tienda
- **GIVEN** el contenido por defecto final, input (0, 0), la política de elección fija y la política de tienda fija
- **WHEN** se juega cada semilla de 1 a 50 con su mapa generado y, aparte, con el mapa vacío, hasta que termina o hasta
  el tick 10.800
- **THEN** las 100 partidas terminan con derrota en un tick < 10.800 y ninguna pasa por en tienda

### Requirement: Aspecto del overlay de la tienda con piezas de UI
La vista SHALL pintar el overlay de la tienda (`.shop-panel`) con las piezas de "Piezas de UI en los paneles DOM"
(`sprite-rendering`): marco de `panel`; el título (`h2`) con la cabecera `header`; cada fila de producto comprable con la
pieza de `button` (y `buttonHover` / `buttonPressed` según su estado); cada fila no comprable (`Oro insuficiente` o vida
llena) con la de `buttonDisabled`, sin dejar de responder al clic igual que antes (el clic intenta la compra, que falla
sin cambiar nada); `Salir` con la de `button`; y la fuente pixel. Sobre cada pieza, el nombre, el nivel y el precio usan
su tinta `text`, la descripción su tinta `muted` y el aviso `Oro insuficiente` (o el de vida llena) su tinta `danger`;
el oro disponible, la tinta `text` de `panel`. Con una ventana ≥ 960 × 540 y cualquier k, el overlay MUST quedar entero
dentro de la ventana; el oro, el título y `Salir` MUST verse siempre enteros dentro del área útil del marco, y la lista
de productos MUST quedar dentro del área útil, entera o alcanzable desplazándola dentro del panel (desplazamiento
interno de la lista, como el texto de la guía), sin solaparse con el oro ni con `Salir`. Desplazar la lista MUST NOT
cambiar el snapshot ni cerrar la tienda, y cada fila MUST responder al clic en su posición desplazada. Si una pieza o la
fuente no carga, el overlay se pinta con su reserva (borde de 1 px `#f5c542`) y la compra y la salida funcionan igual.

#### Scenario: Filas comprables y no comprables
- **GIVEN** un snapshot en tienda con oro 12, `strict-rules` a precio 10 y `fast-ci` a precio 15
- **WHEN** se pinta el overlay
- **THEN** la fila de `strict-rules` usa la pieza de `button` y la de `fast-ci` la de `buttonDisabled`, con
  `Oro insuficiente` en la tinta `danger` de `buttonDisabled`
- **AND** un clic en la fila de `fast-ci` no cambia el snapshot y el overlay sigue visible

#### Scenario: Tienda con desplazamiento interno a ×1 en 1.280 × 720
- **GIVEN** un snapshot en tienda con las 7 filas, cada una con nombre, descripción, nivel y precio o aviso, pintado con
  una ventana de 1.280 × 720 (k = 1) y con las piezas de `panel` y `button` del repositorio
- **WHEN** se leen las reglas de `.shop-panel` y de su lista de productos
- **THEN** el alto máximo del overlay es menor que el alto de la ventana, su relleno interior es ≥ (l, t, r, b) px de
  `panel`, y la lista tiene desplazamiento vertical interno con alto mínimo 0, de modo que el oro, el título y `Salir`
  quedan fuera de la zona que se desplaza
- **AND** con el contenido del escenario, si las 7 filas no caben a la vez, la última fila se alcanza desplazando la
  lista y un clic en ella intenta su compra

#### Scenario: Tienda entera a ×2
- **GIVEN** un snapshot en tienda con las 7 filas, pintado con una ventana de 2.560 × 1.440 (k = 2), con la pieza de
  `panel` del repositorio
- **WHEN** se leen las reglas del overlay
- **THEN** su relleno interior es ≥ (l·2, t·2, r·2, b·2) px y su alto máximo es menor que el de la ventana

#### Scenario: Compra con las piezas en reserva
- **GIVEN** el overlay con oro 12, `strict-rules` a precio 10 y las piezas de `panel` y `button` sin cargar
- **WHEN** se hace clic en la fila de `strict-rules` y se pinta el frame siguiente
- **THEN** el overlay muestra oro 2 y `strict-rules` en nivel 1, igual que con las piezas cargadas, sin errores no
  capturados

### Requirement: Icono en las filas de la tienda
La vista SHALL mostrar en cada fila de producto del overlay de la tienda (las 6 mejoras de arma y la curación)
exactamente un icono, resuelto con "Resolución del icono" (`sprite-rendering`): el del id del producto, la reserva de
su categoría (arma para las mejoras; la de la curación para `heal`) o ninguno. El icono es un elemento de imagen del
DOM que:
- usa una URL del mismo origen bajo `/tfm-survivors/assets/`, nunca `http:`, `https:`, `//`, `data:` ni `blob:`
  (la CSP `img-src 'self' data:` no cambia);
- es decorativo: texto alternativo vacío, de modo que el nombre accesible de la fila sigue siendo el de antes del
  change;
- no tiene atributo `style`, se escala sin suavizado (`image-rendering: pixelated`) y mide lo mismo en ancho y en alto,
  proporcional a la escala de UI DOM (`--ui-scale`; 1 en modo móvil);
- queda dentro del área útil de la pieza de su fila y no cambia el texto, el orden ni las tintas del nombre, la
  descripción, el nivel, el precio ni el aviso.

Si la imagen del icono de una fila no está disponible, la fila MUST mostrar la reserva; si tampoco lo está, la fila
MUST ocultar el icono sin cambiar nada más. Un clic sobre el icono MUST comportarse como un clic en su fila (intenta la
compra). Mostrar o cambiar un icono MUST NOT cambiar el snapshot. En modo móvil cada fila sigue midiendo ≥ 44 × 44 px
CSS (ver "Paneles DOM en modo móvil" en `mobile-display`).

#### Scenario: Siete filas con su icono
- **GIVEN** un snapshot en tienda con el contenido por defecto, todas las imágenes de iconos disponibles y la base
  `/tfm-survivors/`, montado en un DOM de prueba
- **WHEN** se pinta el overlay
- **THEN** cada una de las 7 filas (`strict-rules`, `fast-ci`, `wide-analysis`, `hard-asserts`, `watch-mode`,
  `coverage` y `heal`, en ese orden) tiene exactamente 1 elemento de imagen, con la URL del icono de su id bajo
  `/tfm-survivors/assets/`, texto alternativo vacío y sin atributo `style`
- **AND** el nombre, la descripción, el nivel y el precio de cada fila son los mismos textos que antes del change

#### Scenario: Producto sin icono propio
- **GIVEN** el contenido por defecto sin la entrada de `watch-mode` y, en otro caso, sin la de `heal` en el mapa de
  iconos, con un snapshot en tienda
- **WHEN** se pinta el overlay
- **THEN** la fila de `watch-mode` usa la URL de la reserva de arma, y en el otro caso la de `heal` usa la de la
  reserva de arma (la de la curación)

#### Scenario: Imagen que no carga
- **GIVEN** un snapshot en tienda con oro 12 y `strict-rules` a precio 10, con la imagen de `strict-rules` no
  disponible y, en otro caso, tampoco la reserva de arma
- **WHEN** se pinta el overlay, se hace clic en la fila de `strict-rules` y se pinta el frame siguiente
- **THEN** en el primer caso la fila muestra la reserva de arma y en el segundo no muestra ningún icono, con sus textos
  iguales
- **AND** en ambos casos el overlay muestra oro 2 y `strict-rules` en nivel 1, sin errores no capturados

#### Scenario: Reglas del icono de fila
- **GIVEN** la hoja de estilos del repositorio
- **WHEN** se leen las reglas del icono de las filas de la tienda, también bajo `.is-mobile`
- **THEN** declaran `image-rendering: pixelated`, el mismo ancho que alto, proporcional a `--ui-scale`, y no contienen
  ningún `url(` literal
- **AND** en modo móvil el alto del icono es ≤ el alto mínimo de la fila (44 px CSS), de modo que la fila sigue
  midiendo ≥ 44 × 44 px CSS

#### Scenario: Clic sobre el icono
- **GIVEN** el overlay con oro 12 y `strict-rules` a precio 10
- **WHEN** se hace clic en el icono de la fila de `strict-rules` y se pinta el frame siguiente
- **THEN** el overlay muestra oro 2 y `strict-rules` en nivel 1

<!-- historial: 0024-split-progression-castle (2026-11-25) -->
<!-- historial: 0032-ui-kit (2026-11-26) -->
<!-- historial: 0034-upgrade-icons (2026-11-26) -->
