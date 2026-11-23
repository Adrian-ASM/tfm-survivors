# Spec delta · xp-gems

<!-- Ruta: openspec/changes/0016-map-art/specs/xp-gems/spec.md
     Cobertura (e2e-lite): todos los escenarios se cubren con tests unitarios o de aplicación. Ningún E2E nuevo. -->

## MODIFIED Requirements

### Requirement: Recolocación de gemas en celdas no caminables
El sistema SHALL, cuando una gema se crea en un punto cuya celda (ver "Rejilla de celdas tipadas" en
`procedural-map`) es no caminable (`trunk`, `water` o `castle`), crearla en el centro de la celda caminable más
cercana en vez de en ese punto. La más cercana es la de menor distancia euclídea entre el punto de la baja y el centro
de la celda (en una celda recortada del borde, el centro de su rectángulo recortado); a igual distancia gana la de
fila menor y, a igual fila, la de columna menor. Una gema creada en una celda caminable conserva exactamente su punto.
Recolocar MUST NOT consumir azar y no cambia el valor, el radio, el identificador ni el orden de creación de la gema;
la gema recolocada participa en el paso de gemas de ese mismo tick como cualquier otra.

Una gema no atraída MUST NOT estar en ningún tick en una celda no caminable. Una gema atraída sigue la regla de "Imán
de gemas" en línea recta hacia el jugador y puede cruzar celdas no caminables, también las del castillo. Si la XP de
la baja se suma a la gema más antigua por el tope (ver "Tope de gemas en el suelo"), no se crea ni se recoloca
ninguna gema. Como los enemigos atraviesan el castillo (ver `enemy-behavior`), una baja puede producirse dentro de su
huella; su gema se recoloca con esta misma regla.

#### Scenario: Baja sobre un tronco
- **GIVEN** un mapa de hierba con un tronco en (10, 4) (x en [600, 660], y en [240, 300]), un jugador quieto en
  (960, 540) y un `goblin-torch` con vida 4 que muere por armas en (650, 270)
- **WHEN** se ejecuta ese tick
- **THEN** el snapshot contiene 1 gema nueva en (690, 270), centro de la celda (11, 4) (a 40 px del punto de la baja)

#### Scenario: Empate entre celdas
- **GIVEN** el mapa del escenario anterior y un `goblin-torch` con vida 4 que muere por armas en (610, 250), lejos del
  jugador
- **WHEN** se ejecuta ese tick
- **THEN** la gema nueva está en (630, 210), centro de la celda (10, 3): empata a 44,721 px con el de la (9, 4),
  (570, 270), y gana por tener la fila menor

#### Scenario: Baja en un río ancho
- **GIVEN** un mapa de hierba con las filas 8, 9 y 10 (y en [480, 660]) enteras de `water` y un `goblin-torch` con vida
  4 que muere por armas en (300, 560), lejos del jugador
- **WHEN** se ejecuta ese tick
- **THEN** la gema nueva está en (270, 450), centro de la celda (4, 7) (a 114,018 px, la más cercana con la fila
  menor)

#### Scenario: Baja dentro del castillo
- **GIVEN** un mapa de hierba con las celdas de columnas 14–18 y filas 6–9 `castle` (x en [840, 1.140], y en
  [360, 600]), un jugador quieto en (300, 900) y un `goblin-torch` con vida 4 que muere por armas en (990, 480), en la
  celda (16, 8)
- **WHEN** se ejecuta ese tick
- **THEN** la gema nueva está en (990, 330), centro de la celda (16, 5): empata a 150 px con el de la (16, 10),
  (990, 630), y gana por tener la fila menor

#### Scenario: Baja en hierba junto a un tronco
- **GIVEN** un mapa de hierba con un tronco en (10, 4) y un `goblin-torch` con vida 4 que muere por armas en
  (590, 270), en la celda caminable (9, 4)
- **WHEN** se ejecuta ese tick
- **THEN** la gema nueva está exactamente en (590, 270)

#### Scenario: Recolocar no consume azar
- **GIVEN** dos partidas con la misma semilla y el mismo estado salvo que en una el enemigo que muere en el tick n
  está sobre un tronco y en la otra sobre hierba
- **WHEN** ambas ejecutan el tick n sin oferta de mejora
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick

#### Scenario: Gema recolocada recogida en el mismo tick
- **GIVEN** un mapa de hierba con un tronco en (10, 4), un jugador quieto en (690, 285) y un `goblin-torch` con vida 4
  que muere por armas en (650, 270)
- **WHEN** se ejecuta ese tick
- **THEN** la gema se crea en (690, 270) (distancia 15 < 21), se recoge en ese tick y la XP ya incluye su valor

#### Scenario: Ninguna gema en reposo en celda no caminable
- **GIVEN** el contenido por defecto salvo una vida máxima suficiente para no llegar a 0 en 36.000 ticks, semilla 7,
  el mapa generado para esa semilla (castillo incluido) y un input aleatorio generado por una semilla fija
- **WHEN** se ejecutan 36.000 ticks
- **THEN** en ningún snapshot hay una gema no atraída cuya celda sea `trunk`, `water` o `castle`
