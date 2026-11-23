# Spec delta · player-movement

<!-- Ruta: openspec/changes/0015-procedural-map/specs/player-movement/spec.md
     Convención de `procedural-map` ("Mapa explícito y mapa vacío"): los escenarios con posiciones explícitas que no
     declaran mapa usan el mapa vacío, así que los escenarios vivos de esta spec no cambian. Los mapas explícitos de
     este delta usan la rejilla por defecto (32 × 18 celdas de 60 px): la celda (c, r) ocupa
     [60c, 60c + 60] × [60r, 60r + 60]. Jugador de radio 16 y velocidad 200 px/s salvo que se diga otra cosa. -->

## ADDED Requirements

### Requirement: Colisión con el mapa
El sistema SHALL impedir que el círculo del jugador solape una celda no caminable (`trunk` o `water`, ver
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
arena"), y MUST NOT consumir azar.

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

#### Scenario: Partida larga sin solapes
- **GIVEN** el contenido por defecto salvo una vida máxima suficiente para no llegar a 0 en 36.000 ticks, semilla 7,
  el mapa generado para esa semilla y un input aleatorio generado por una semilla fija
- **WHEN** se ejecutan 36.000 ticks
- **THEN** en ningún tick el círculo del jugador solapa una celda no caminable de su mapa
- **AND** en ningún tick su centro queda fuera de [16, 1.904] × [16, 1.064]

#### Scenario: Sin solapes en la build con el mapa real
- **GIVEN** la build de producción con `?e2e&manual&seed=42` (mapa real) y la política de elección fija
- **WHEN** se mantiene la flecha derecha durante 10 llamadas a `step(60)`, después la flecha abajo durante otras 10, y
  tras cada llamada se leen el snapshot y el mapa de la sonda
- **THEN** en ninguna lectura el círculo del jugador solapa una celda `trunk` o `water` del mapa de la sonda

## MODIFIED Requirements

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
