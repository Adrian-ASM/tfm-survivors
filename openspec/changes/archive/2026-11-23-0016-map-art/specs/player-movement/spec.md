# Spec delta · player-movement

<!-- Ruta: openspec/changes/0016-map-art/specs/player-movement/spec.md
     Cobertura (e2e-lite): todos los escenarios nuevos se cubren con tests unitarios o de aplicación. "Sin solapes en
     la build con el mapa real" es un E2E existente de 0015 que solo amplía su comprobación a `castle`. -->

## ADDED Requirements

### Requirement: Posición inicial en el punto de salida del mapa
El sistema SHALL crear cada partida nueva con el jugador en el punto de salida de su mapa (ver `procedural-map`),
también tras R y tras `Volver al menú` + `Jugar`:
- con el mapa generado, la salida ante la puerta del castillo ((990, 630) con el contenido por defecto);
- con el mapa vacío y con un mapa explícito sin salida declarada, el centro del mundo (ancho / 2, alto / 2), como
  antes de este change;
- con un mapa explícito con salida declarada, esa salida.

#### Scenario: Partida nueva con el mapa generado
- **GIVEN** el contenido por defecto
- **WHEN** se crea una partida con cada semilla de 1 a 50 y se lee el snapshot del tick 0
- **THEN** en las 50 el jugador está exactamente en (990, 630)

#### Scenario: Partida nueva con el mapa vacío
- **GIVEN** el contenido por defecto, la semilla 42 y el mapa vacío
- **WHEN** se crea la partida y se lee el snapshot del tick 0
- **THEN** el jugador está exactamente en (960, 540)

#### Scenario: Mapa explícito con y sin salida declarada
- **GIVEN** el contenido por defecto y un mapa de hierba con un tronco en (3, 3), primero sin salida declarada y
  después con la salida (300, 900)
- **WHEN** se crea cada partida y se lee el snapshot del tick 0
- **THEN** el jugador está en (960, 540) en la primera y en (300, 900) en la segunda

#### Scenario: Partida nueva tras acabar en una esquina
- **GIVEN** el contenido por defecto, la semilla 42 y una partida terminada con el jugador en (16, 16)
- **WHEN** se pulsa R con la semilla 123 y se lee el snapshot del tick 0 de la partida nueva
- **THEN** el jugador está exactamente en (990, 630)

## MODIFIED Requirements

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
- **GIVEN** el contenido por defecto y la semilla 42 (huella en x [840, 1.140], y [360, 600]; jugador en la salida
  (990, 630))
- **WHEN** se ejecutan 60 ticks con input (0, −1)
- **THEN** el jugador está en (990, 616) (error ≤ 0,001), tangente a la cara inferior del castillo, y en ningún tick
  lo solapa

#### Scenario: Deslizar por la fachada del castillo
- **GIVEN** un mapa de hierba con las celdas de columnas 14–18 y filas 6–9 `castle`, velocidad 200 px/s y el jugador en
  (990, 616)
- **WHEN** se ejecutan 30 ticks con input (1, −1)
- **THEN** y sigue en 616 y x ha aumentado 70,711 px (error ≤ 0,001)

#### Scenario: Partida larga sin solapes
- **GIVEN** el contenido por defecto salvo una vida máxima suficiente para no llegar a 0 en 36.000 ticks, semilla 7,
  el mapa generado para esa semilla y un input aleatorio generado por una semilla fija
- **WHEN** se ejecutan 36.000 ticks
- **THEN** en ningún tick el círculo del jugador solapa una celda no caminable de su mapa, incluidas las `castle`
- **AND** en ningún tick su centro queda fuera de [16, 1.904] × [16, 1.064]

#### Scenario: Sin solapes en la build con el mapa real
- **GIVEN** la build de producción con `?e2e&manual&seed=42` (mapa real) y la política de elección fija
- **WHEN** se mantiene la flecha derecha durante 10 llamadas a `step(60)`, después la flecha abajo durante otras 10, y
  tras cada llamada se leen el snapshot y el mapa de la sonda
- **THEN** en ninguna lectura el círculo del jugador solapa una celda `trunk`, `water` o `castle` del mapa de la sonda

## REMOVED Requirements

### Requirement: Posición inicial en el centro del mundo
Motivo: con el castillo sólido el centro del mundo queda junto a la huella; el jugador aparece en el punto de salida
del mapa (ver "Posición inicial en el punto de salida del mapa"), que sigue siendo el centro con el mapa vacío.
