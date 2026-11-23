# Spec delta · xp-gems

<!-- Ruta: openspec/changes/0015-procedural-map/specs/xp-gems/spec.md
     Convención de `procedural-map`: los escenarios vivos con posiciones explícitas usan el mapa vacío y no cambian.
     Los mapas explícitos de este delta usan la rejilla por defecto (celdas de 60 px; la celda (c, r) ocupa
     [60c, 60c + 60] × [60r, 60r + 60] y su centro es (60c + 30, 60r + 30)). -->

## ADDED Requirements

### Requirement: Recolocación de gemas en celdas no caminables
El sistema SHALL, cuando una gema se crea en un punto cuya celda (ver "Rejilla de celdas tipadas" en
`procedural-map`) es no caminable, crearla en el centro de la celda caminable más cercana en vez de en ese punto. La
más cercana es la de menor distancia euclídea entre el punto de la baja y el centro de la celda (en una celda recortada
del borde, el centro de su rectángulo recortado); a igual distancia gana la de fila menor y, a igual fila, la de
columna menor. Una gema creada en una celda caminable conserva exactamente su punto. Recolocar MUST NOT consumir azar
y no cambia el valor, el radio, el identificador ni el orden de creación de la gema; la gema recolocada participa en
el paso de gemas de ese mismo tick como cualquier otra.

Una gema no atraída MUST NOT estar en ningún tick en una celda no caminable. Una gema atraída sigue la regla de "Imán
de gemas" en línea recta hacia el jugador y puede cruzar celdas no caminables. Si la XP de la baja se suma a la gema
más antigua por el tope (ver "Tope de gemas en el suelo"), no se crea ni se recoloca ninguna gema.

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
  el mapa generado para esa semilla y un input aleatorio generado por una semilla fija
- **WHEN** se ejecutan 36.000 ticks
- **THEN** en ningún snapshot hay una gema no atraída cuya celda sea `trunk` o `water`

## MODIFIED Requirements

### Requirement: Suelta de gema por baja
El sistema SHALL crear, por cada enemigo dado de baja por armas en un tick, exactamente una gema en la posición que
tenía el enemigo en el paso de armas de ese tick, o en la que fije "Recolocación de gemas en celdas no caminables" si
esa posición está en una celda no caminable, con un valor de XP igual al `xp` de su tipo (ver `enemy-spawning`) y el
radio `gemRadius`. Las gemas de las bajas de un mismo tick se crean en el orden de la lista de enemigos. Cada gema
tiene un identificador único en la partida que no se reutiliza. Crear gemas MUST NOT consumir azar. Una gema creada
en un tick participa en el paso de gemas de ese mismo tick (ver `simulation-loop`).

#### Scenario: Un goblin-torch abatido suelta una gema
- **GIVEN** un jugador quieto en (480, 270) y un `goblin-torch` con vida 4 en (780, 270) que permanece ahí
- **WHEN** en el tick n el `goblin-torch` muere por un impacto del Linter en (780, 270)
- **THEN** el snapshot del tick n contiene exactamente 1 gema nueva, en (780, 270), con radio 5
- **AND** al recogerla el jugador suma 1 de XP

#### Scenario: Valor según el tipo
- **GIVEN** el contenido por defecto
- **WHEN** muere por armas un enemigo de cada tipo, lejos del jugador
- **THEN** al recoger sus gemas la XP sumada es 1 por la de `goblin-torch`, 2 por la de `goblin-barrel` y 4 por
  la de `goblin-tnt`

#### Scenario: Varias bajas en el mismo tick
- **GIVEN** tres `goblin-torch` a1, a2, a3 (en ese orden de aparición) con vida 4 que mueren en el mismo pulso de Tests
- **WHEN** se ejecuta ese tick
- **THEN** el snapshot contiene 3 gemas nuevas, cada una en la posición de uno de ellos, con identificadores
  distintos creados en el orden a1, a2, a3

#### Scenario: Varias bajas en el mismo tick, una sobre agua
- **GIVEN** un mapa de hierba con la celda (5, 5) de `water` y tres `goblin-torch` a1, a2, a3 (en ese orden de
  aparición) con vida 4, a2 en (330, 330) dentro de esa celda, que mueren en el mismo pulso de Tests
- **WHEN** se ejecuta ese tick
- **THEN** el snapshot contiene 3 gemas nuevas con identificadores creados en el orden a1, a2, a3, y la de a2 está en
  (330, 270), centro de la celda (5, 4) (las cuatro vecinas empatan a 60 px y gana la de fila menor)

#### Scenario: Sin baja no hay gema
- **GIVEN** un `goblin-torch` con vida 10 que recibe 1 impacto del Linter y queda con vida 4
- **WHEN** se lee el snapshot de ese tick
- **THEN** no hay ninguna gema nueva

#### Scenario: Las gemas no consumen azar
- **GIVEN** dos partidas con la misma semilla y el mismo estado salvo que en una hay 10 gemas en el suelo más
- **WHEN** ambas ejecutan el mismo tick sin oferta de mejora
- **THEN** el estado del `RandomGenerator` es el mismo en las dos tras el tick
