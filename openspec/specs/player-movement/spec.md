# Player movement · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
El jugador se mueve por la arena según el input, a velocidad constante, sin salir de sus límites y con su contenido validado.

## Requirements

### Requirement: Movimiento del jugador por input
El sistema SHALL desplazar al jugador en cada tick ejecutado una distancia igual a `velocidad efectiva × dt` en la
dirección del `PlayerInput`, sin inercia, salvo lo que impidan los límites de la arena (ver "Límites de la arena") y
la colisión con el mapa (ver "Colisión con el mapa"): con input nulo el jugador no se mueve. La velocidad efectiva
es la `speed` de contenido más las mejoras de velocidad adquiridas (ver `upgrades`). Mientras la partida está
eligiendo mejora el jugador no se mueve, sea cual sea el input.

#### Scenario: Movimiento horizontal durante un segundo
- **GIVEN** un jugador en (480, 270) con velocidad 200 px/s
- **WHEN** se ejecutan 60 ticks de 1/60 s con input (1, 0)
- **THEN** el jugador está en (680, 270) con un error ≤ 0,001 px

#### Scenario: Sin input no hay movimiento
- **GIVEN** un jugador en (480, 270)
- **WHEN** se ejecutan 60 ticks con input (0, 0)
- **THEN** el jugador sigue exactamente en (480, 270)

#### Scenario: Movimiento vertical hacia arriba
- **GIVEN** un jugador en (480, 270) con velocidad 200 px/s
- **WHEN** se ejecutan 30 ticks con input (0, -1)
- **THEN** el jugador está en (480, 170) con un error ≤ 0,001 px

#### Scenario: Velocidad mejorada
- **GIVEN** un jugador en (480, 270) con velocidad base 200 px/s y `shortcuts` en nivel 1
- **WHEN** se ejecutan 60 ticks con input (1, 0)
- **THEN** el jugador está en (700, 270) con un error ≤ 0,001 px

#### Scenario: Velocidad en el nivel máximo
- **GIVEN** un jugador en (100, 270) con velocidad base 200 px/s y `shortcuts` en nivel 5
- **WHEN** se ejecutan 60 ticks con input (1, 0)
- **THEN** el jugador está en (400, 270) con un error ≤ 0,001 px

#### Scenario: Input ignorado mientras se elige
- **GIVEN** un jugador en (480, 270) en una partida con una oferta abierta
- **WHEN** se piden 60 ticks con input (1, 0)
- **THEN** el jugador sigue exactamente en (480, 270)

#### Scenario: Sin movimiento contra un obstáculo
- **GIVEN** un mapa de hierba con un tronco en (10, 4) y el jugador en (584, 270), tangente a su cara izquierda
- **WHEN** se ejecutan 60 ticks con input (1, 0)
- **THEN** el jugador sigue exactamente en (584, 270)

### Requirement: Normalización diagonal
El sistema SHALL normalizar el `PlayerInput` cuando su módulo sea mayor que 1, de modo que moverse en diagonal no
sea más rápido que moverse en un eje. Cada componente del input MUST limitarse primero al rango [-1, 1].

#### Scenario: Diagonal a la misma velocidad que un eje
- **GIVEN** un jugador en (480, 270) con velocidad 200 px/s
- **WHEN** se ejecutan 60 ticks con input (1, 1)
- **THEN** el jugador ha recorrido 200 px en total (error ≤ 0,001 px)
- **AND** está en (480 + 141,421, 270 + 141,421) con un error ≤ 0,001 px

#### Scenario: Input fuera de rango
- **GIVEN** un jugador en (480, 270) con velocidad 200 px/s
- **WHEN** se ejecutan 60 ticks con input (5, 0)
- **THEN** el jugador está en (680, 270), igual que con input (1, 0)

#### Scenario: Input analógico menor que 1 no se amplifica
- **GIVEN** un jugador en (480, 270) con velocidad 200 px/s
- **WHEN** se ejecutan 60 ticks con input (0,5, 0)
- **THEN** el jugador está en (580, 270) con un error ≤ 0,001 px

### Requirement: Límites de la arena
El sistema SHALL mantener el círculo del jugador entero dentro de la arena (el mundo, ver `world-camera`): su centro
MUST quedar en [radio, ancho − radio] × [radio, alto − radio]. Con el contenido por defecto (mundo de 3.840 × 2.160 y
radio 16) ese rango es [16, 3.824] × [16, 2.144]. Ni el tamaño de la vista ni el de la ventana MUST limitar el
movimiento.

#### Scenario: Choque con el borde derecho
- **GIVEN** un jugador en (3.820, 1.080) con radio 16 en una arena de 3.840 × 2.160
- **WHEN** se ejecutan 60 ticks con input (1, 0)
- **THEN** el jugador está en (3.824, 1.080)

#### Scenario: Choque con el borde inferior
- **GIVEN** un jugador en (1.920, 2.140) con radio 16 en una arena de 3.840 × 2.160
- **WHEN** se ejecutan 60 ticks con input (0, 1)
- **THEN** el jugador está en (1.920, 2.144)

#### Scenario: Esquina superior izquierda
- **GIVEN** un jugador en (20, 20) con radio 16
- **WHEN** se ejecutan 60 ticks con input (-1, -1)
- **THEN** el jugador está en (16, 16)

#### Scenario: Esquina inferior derecha
- **GIVEN** un jugador en (3.820, 2.140) con radio 16 en una arena de 3.840 × 2.160
- **WHEN** se ejecutan 60 ticks con input (1, 1)
- **THEN** el jugador está en (3.824, 2.144)

#### Scenario: Deslizar por la pared
- **GIVEN** un jugador en (3.824, 1.080) con radio 16 pegado al borde derecho de una arena de 3.840 × 2.160
- **WHEN** se ejecutan 30 ticks con input (1, 1)
- **THEN** x sigue en 3.824 y y ha aumentado 70,711 px (error ≤ 0,001 px)

#### Scenario: El borde de la vista no es una pared
- **GIVEN** el mundo por defecto, velocidad 200 px/s, radio 16 y un jugador en (1.270, 270) (junto al borde derecho
  de una vista de 1.280 × 720 anclada en (0, 0))
- **WHEN** se ejecutan 60 ticks con input (1, 0)
- **THEN** el jugador está en (1.470, 270) con un error ≤ 0,001 px

#### Scenario: Partida larga dentro del mundo
- **GIVEN** el contenido por defecto salvo una vida máxima suficiente para no llegar a 0 en 36.000 ticks, semilla 7 y
  un input aleatorio generado por una semilla fija
- **WHEN** se ejecutan 36.000 ticks
- **THEN** en ningún tick el centro del jugador queda fuera de [16, 3.824] × [16, 2.144]

### Requirement: Contenido del jugador validado
El sistema SHALL leer velocidad, radio, vida máxima y radio de recogida (`pickupRadius`) del jugador y el tamaño de
la arena desde `content/*.json`, validados con zod antes de llegar al dominio. La vida máxima y el radio de recogida
MUST ser > 0. Un contenido inválido MUST impedir que la partida arranque con un error que nombre el campo inválido.

#### Scenario: Contenido válido
- **GIVEN** `content/player.json` con `{ "speed": 200, "radius": 16, "maxHealth": 100, "pickupRadius": 64 }`
- **WHEN** se carga el contenido
- **THEN** el dominio recibe velocidad 200, radio 16, vida máxima 100 y radio de recogida 64

#### Scenario: Velocidad negativa
- **GIVEN** `content/player.json` con `{ "speed": -5, "radius": 16, "maxHealth": 100, "pickupRadius": 64 }`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `speed`
- **AND** no se crea ninguna partida

#### Scenario: Radio que no cabe en la arena
- **GIVEN** radio 1.081 y la arena por defecto de 3.840 × 2.160
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `radius`

#### Scenario: Vida máxima cero o negativa
- **GIVEN** `content/player.json` con `"maxHealth": 0` o con `"maxHealth": -10`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `maxHealth`
- **AND** no se crea ninguna partida

#### Scenario: Vida máxima ausente
- **GIVEN** `content/player.json` con `{ "speed": 200, "radius": 16, "pickupRadius": 64 }`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `maxHealth`

#### Scenario: Vida máxima mínima válida
- **GIVEN** `content/player.json` con `{ "speed": 200, "radius": 16, "maxHealth": 1, "pickupRadius": 64 }`
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito y la partida empieza con vida 1

#### Scenario: Radio de recogida inválido o ausente
- **GIVEN** `content/player.json` con `"pickupRadius": 0`, con `"pickupRadius": -1` o sin `pickupRadius`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `pickupRadius`
- **AND** no se crea ninguna partida

#### Scenario: Radio de recogida por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** el radio de recogida base vale 128 (con el mundo de 3.840 × 2.160 de 0017, la primera oferta del jugador
  quieto llega en un tick ≤ 4.800; medido en apply: tick 1.527 con la semilla 7)

### Requirement: Posición inicial en el punto de salida del mapa
El sistema SHALL crear cada partida nueva con el jugador en el punto de salida de su mapa (ver `procedural-map`),
también tras R y tras `Volver al menú` + `Jugar`:
- con el mapa generado, la salida ante la puerta del castillo ((1.950, 1.170) con el contenido por defecto);
- con el mapa vacío y con un mapa explícito sin salida declarada, el centro del mundo (ancho / 2, alto / 2)
  ((1.920, 1.080) con el contenido por defecto);
- con un mapa explícito con salida declarada, esa salida.

La posición inicial MUST NOT depender del tamaño de la ventana.

#### Scenario: Partida nueva con el mapa generado
- **GIVEN** el contenido por defecto
- **WHEN** se crea una partida con cada semilla de 1 a 50 y se lee el snapshot del tick 0
- **THEN** en las 50 el jugador está exactamente en (1.950, 1.170)

#### Scenario: Partida nueva con el mapa vacío
- **GIVEN** el contenido por defecto, la semilla 42 y el mapa vacío
- **WHEN** se crea la partida y se lee el snapshot del tick 0
- **THEN** el jugador está exactamente en (1.920, 1.080)

#### Scenario: Mapa explícito con y sin salida declarada
- **GIVEN** el contenido por defecto y un mapa de hierba con un tronco en (3, 3), primero sin salida declarada y
  después con la salida (300, 900)
- **WHEN** se crea cada partida y se lee el snapshot del tick 0
- **THEN** el jugador está en (1.920, 1.080) en la primera y en (300, 900) en la segunda

#### Scenario: Partida nueva tras acabar en una esquina
- **GIVEN** el contenido por defecto, la semilla 42 y una partida terminada con el jugador en (16, 16)
- **WHEN** se pulsa R con la semilla 123 y se lee el snapshot del tick 0 de la partida nueva
- **THEN** el jugador está exactamente en (1.950, 1.170)

### Requirement: Colisión con el mapa
El sistema SHALL impedir que el círculo del jugador solape una celda no caminable (`trunk`, `water` o `castle`, ver
`procedural-map`). Solapar es que la distancia del centro del jugador al punto más cercano del rectángulo cerrado de
la celda sea menor que su radio; la tangencia (distancia igual al radio) no es solape. En cada tick:
- si la posición a la que llevaría el movimiento sin obstáculos es legal (dentro de los límites del mundo y sin
  solape), el jugador llega exactamente a ella;
- si no, el jugador avanza lo máximo posible sin solapar: contra una cara de celda, la componente del movimiento
  perpendicular a la cara se anula y queda tangente, y la componente paralela se conserva entera (deslizamiento);
- el jugador MUST NOT rebotar: cada componente del desplazamiento del tick tiene el signo de la del movimiento sin
  obstáculos o vale 0, y su módulo no es mayor;
- el jugador MUST NOT atravesar una celda no caminable ni pasar entre dos celdas no caminables que solo se tocan por
  una esquina.

La colisión se aplica en el paso de movimiento del jugador, junto con los límites del mundo (ver "Límites de la
arena"), y MUST NOT consumir azar. El castillo bloquea al jugador como un tronco; los enemigos lo siguen ignorando
(ver `enemy-behavior`).

#### Scenario: Choque frontal con un tronco
- **GIVEN** un mapa de hierba con un tronco en (10, 4) (x en [600, 660], y en [240, 300]) y el jugador en (560, 270)
- **WHEN** se ejecutan 60 ticks con input (1, 0)
- **THEN** el jugador está en (584, 270) (error ≤ 0,001), tangente a la cara izquierda del tronco

#### Scenario: Choque a velocidad máxima
- **GIVEN** el mapa del escenario anterior, el jugador en (500, 270) y `shortcuts` en nivel 5 (300 px/s, 5 px/tick)
- **WHEN** se ejecutan 60 ticks con input (1, 0)
- **THEN** el jugador está en (584, 270) (error ≤ 0,001) y en ningún tick solapa el tronco

#### Scenario: Deslizar a lo largo de una fila de troncos
- **GIVEN** un mapa de hierba con troncos en (10, 2), (10, 3), (10, 4), (10, 5) y (10, 6) (x en [600, 660], y en
  [120, 420]) y el jugador en (584, 270)
- **WHEN** se ejecutan 30 ticks con input (1, 1)
- **THEN** x sigue en 584 y y ha aumentado 70,711 px (error ≤ 0,001)

#### Scenario: Rodear la esquina de un tronco
- **GIVEN** un mapa de hierba con un tronco en (10, 4) y el jugador en (630, 224), tangente a su cara superior
- **WHEN** se ejecutan 60 ticks con input (1, 1)
- **THEN** x vale 771,421 (error ≤ 0,001): la componente x no se frena en ningún tick
- **AND** y es > 224 en el tick 60 y en ningún tick el jugador solapa el tronco

#### Scenario: Sin paso entre dos troncos en diagonal
- **GIVEN** un mapa de hierba con troncos en (10, 4) y (11, 5), que solo se tocan en la esquina (660, 300), y el
  jugador en (700, 260)
- **WHEN** se ejecutan 120 ticks con input (−1, 1)
- **THEN** el jugador está en (676, 284) (error ≤ 0,001), tangente a los dos troncos
- **AND** en ningún tick su centro está en la celda (10, 5)

#### Scenario: Cruzar un río por el puente
- **GIVEN** un mapa de hierba con la fila 9 (y en [540, 600]) toda `water` salvo la celda (16, 9) `bridge`
  (x en [960, 1.020]) y el jugador en (990, 500)
- **WHEN** se ejecutan 60 ticks con input (0, 1)
- **THEN** el jugador está en (990, 700) (error ≤ 0,001): ha cruzado el río

#### Scenario: El agua frena fuera del puente
- **GIVEN** el mapa del escenario anterior y el jugador en (950, 500)
- **WHEN** se ejecutan 60 ticks con input (0, 1)
- **THEN** el jugador está en (950, 524) (error ≤ 0,001), tangente a la celda de agua (15, 9)

#### Scenario: Choque con la fachada del castillo
- **GIVEN** el contenido por defecto y la semilla 42 (huella en x [1.800, 2.100], y [900, 1.140]; jugador en la salida
  (1.950, 1.170))
- **WHEN** se ejecutan 60 ticks con input (0, −1)
- **THEN** el jugador está en (1.950, 1.156) (error ≤ 0,001), tangente a la cara inferior del castillo, y en ningún
  tick lo solapa

#### Scenario: Deslizar por la fachada del castillo
- **GIVEN** un mapa de hierba con las celdas de columnas 30–34 y filas 15–18 `castle`, velocidad 200 px/s y el
  jugador en (1.950, 1.156)
- **WHEN** se ejecutan 30 ticks con input (1, −1)
- **THEN** y sigue en 1.156 y x ha aumentado 70,711 px (error ≤ 0,001)

#### Scenario: Partida larga sin solapes
- **GIVEN** el contenido por defecto salvo una vida máxima suficiente para no llegar a 0 en 36.000 ticks, semilla 7,
  el mapa generado para esa semilla y un input aleatorio generado por una semilla fija
- **WHEN** se ejecutan 36.000 ticks
- **THEN** en ningún tick el círculo del jugador solapa una celda no caminable de su mapa, incluidas las `castle`
- **AND** en ningún tick su centro queda fuera de [16, 3.824] × [16, 2.144]

#### Scenario: Sin solapes en la build con el mapa real
- **GIVEN** la build de producción con `?e2e&manual&seed=42` (mapa real) y la política de elección fija
- **WHEN** se mantiene la flecha derecha durante 10 llamadas a `step(60)`, después la flecha abajo durante otras 10, y
  tras cada llamada se leen el snapshot y el mapa de la sonda
- **THEN** en ninguna lectura el círculo del jugador solapa una celda `trunk`, `water` o `castle` del mapa de la sonda

<!-- historial: 0001-walking-skeleton (2026-11-19) -->
<!-- historial: 0003-collisions-and-damage (2026-11-19) -->
<!-- historial: 0005-xp-and-level-up (2026-11-19) -->
<!-- historial: 0013-world-camera (2026-11-23) -->
<!-- historial: 0015-procedural-map (2026-11-23) -->
<!-- historial: 0016-map-art (2026-11-23) -->
<!-- historial: 0017-fullscreen-view (2026-11-24) -->
