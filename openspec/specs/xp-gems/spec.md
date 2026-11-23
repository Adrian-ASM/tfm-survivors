# XP gems · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
Las gemas de XP que sueltan las bajas, el imán que las atrae y su recogida.

## Requirements

### Requirement: Contenido de gemas validado
El sistema SHALL leer de `content/*.json`, validados con zod antes de llegar al dominio, el radio de recogida base
del jugador (`pickupRadius`, en `content/player.json`) y, en el fichero de progresión, el radio de las gemas
(`gemRadius`), la velocidad del imán en px/s (`magnetSpeed`) y el tope de gemas en el suelo (`maxGems`). Las reglas
son: `pickupRadius`, `gemRadius` y `magnetSpeed` > 0; `maxGems` entero ≥ 1. Un campo ausente, fuera de rango o
desconocido MUST impedir que la partida arranque con un error que nombre el campo.

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** `pickupRadius` vale 128, `gemRadius` 5, `magnetSpeed` 360 y `maxGems` 300 (provisional, a medir en apply)

#### Scenario: Valores no positivos
- **GIVEN** un contenido con, en un caso cada vez, `pickupRadius` 0, `gemRadius` 0, `magnetSpeed` 0,
  `magnetSpeed` −1 o `maxGems` 0
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo
- **AND** no se crea ninguna partida

#### Scenario: Tope de gemas no entero
- **GIVEN** un contenido con `maxGems` 12,5
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `maxGems`

#### Scenario: Campo desconocido o ausente
- **GIVEN** un fichero de progresión con un campo extra `gemLifetime: 600`, y en otro caso sin `magnetSpeed`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error explícito que nombra el campo

#### Scenario: Tope mínimo válido
- **GIVEN** el contenido por defecto con `maxGems` 1
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

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

### Requirement: Gemas en el suelo
El sistema SHALL mantener cada gema no atraída quieta en su posición, sin caducidad, mientras su distancia al
jugador sea mayor que el radio de recogida efectivo (ver `upgrades`). Las gemas no colisionan con enemigos,
proyectiles ni entre sí, y no impiden el movimiento de nada.

#### Scenario: Gema fuera del radio
- **GIVEN** un jugador quieto en (480, 270) y una gema en (545, 270) (distancia 65 > 64)
- **WHEN** se ejecutan 36.000 ticks
- **THEN** la gema sigue en (545, 270) y el jugador no ha sumado XP por ella

#### Scenario: Enemigos encima de una gema
- **GIVEN** una gema en el suelo y un enemigo vivo que pasa por su posición
- **WHEN** se ejecutan los ticks en que se solapan
- **THEN** la gema no se mueve ni desaparece y el enemigo sigue su persecución sin cambios

### Requirement: Imán de gemas
El sistema SHALL marcar como atraída, en el paso de gemas, toda gema cuya distancia al jugador (ya movido en ese
tick) sea ≤ el radio de recogida efectivo. Una gema atraída lo sigue siendo hasta que se recoge, aunque el jugador se
aleje. En cada tick, empezando por el tick en que pasa a atraída, una gema atraída avanza hacia la posición actual
del jugador una distancia de `magnetSpeed / 60` (6 px con el valor por defecto) o la distancia que la separa del
jugador si es menor. Las gemas se procesan en orden de creación. El imán MUST NOT consumir azar.

#### Scenario: Límite exacto del radio
- **GIVEN** un jugador quieto en (480, 270) y una gema en (544, 270) (distancia 64)
- **WHEN** se ejecuta 1 tick
- **THEN** la gema está en (538, 270): ha pasado a atraída y ha avanzado 6 px

#### Scenario: Recorrido hasta la recogida
- **GIVEN** la partida del escenario anterior antes de su primer tick
- **WHEN** se ejecutan 8 ticks
- **THEN** la gema sigue en el snapshot de los ticks 1 a 7 (en el 7, en (502, 270), distancia 22)
- **AND** no está en el snapshot del tick 8 (distancia 16 < 21) y el jugador ha sumado su XP en el tick 8

#### Scenario: Una gema atraída no se suelta
- **GIVEN** una gema ya atraída a 62 px del jugador y un jugador con velocidad 200 px/s (3,333 px/tick) que se
  aleja de ella por la recta que los une, con input constante y sin tocar los bordes de la arena
- **WHEN** se ejecuta 1 tick (tras moverse el jugador la distancia es 65,333 > 64)
- **THEN** la gema avanza igualmente 6 px y queda a 59,333 px del jugador (error ≤ 0,001)
- **AND** en cada tick siguiente la distancia baja 2,667 px hasta que la gema se recoge

#### Scenario: No sobrepasa al jugador
- **GIVEN** un jugador quieto en (480, 270) y una gema en (483, 270) (distancia 3 < 6)
- **WHEN** se ejecuta 1 tick
- **THEN** la gema se recoge en ese tick

### Requirement: Recogida de gemas
El sistema SHALL recoger en el paso de gemas, tras el movimiento del imán, toda gema cuyo círculo solape el del
jugador (distancia < radio del jugador + `gemRadius`, 21 con los valores por defecto), atraída o no. Una gema
recogida desaparece de forma irreversible y su XP se suma al jugador en ese mismo tick (ver `leveling`). Varias
gemas recogidas en el mismo tick suman todas su XP en ese tick.

#### Scenario: Recogida de una gema
- **GIVEN** un jugador quieto en (480, 270) con 0 XP en nivel 1 y una gema de valor 1 en (500, 270)
- **WHEN** se ejecuta 1 tick
- **THEN** la gema no está en el snapshot y la XP actual vale 1

#### Scenario: Tangencia tras el imán no es recogida
- **GIVEN** un jugador quieto en (480, 270) y una gema atraída en (507, 270) (distancia 27)
- **WHEN** se ejecuta 1 tick (la gema queda a distancia 21 = 16 + 5)
- **THEN** la gema sigue en el snapshot, en (501, 270)
- **AND** se recoge en el tick siguiente

#### Scenario: Gema de una baja junto al jugador
- **GIVEN** un jugador quieto en (480, 270) y un `goblin-torch` con vida 4 que muere en el paso de armas del tick n en
  (490, 270)
- **WHEN** se ejecuta el tick n
- **THEN** la gema de ese `goblin-torch` se crea, pasa a atraída, avanza hasta (484, 270) y se recoge en el mismo tick n
- **AND** el snapshot del tick n no la contiene y la XP ya incluye su valor

#### Scenario: Varias gemas en el mismo tick
- **GIVEN** un jugador quieto en (480, 270) con 0 XP en nivel 1 y 4 gemas de valor 1 en su misma posición
- **WHEN** se ejecuta 1 tick
- **THEN** desaparecen las 4 y la XP actual vale 4

### Requirement: Tope de gemas en el suelo
El sistema SHALL impedir que haya más de `maxGems` gemas en el suelo. Si al soltarse una gema ya hay `maxGems` en
el suelo, no se crea una nueva: su valor de XP MUST sumarse al de la gema más antigua que siga en el suelo (la de
creación más temprana), sin que se pierda XP. Las gemas recogidas en un tick liberan su plaza para las bajas de los
ticks siguientes (las bajas de un tick ocurren antes del paso de gemas de ese tick).

#### Scenario: Tope lleno
- **GIVEN** `maxGems` 300, 300 gemas de valor 1 en el suelo lejos del jugador y un `goblin-torch` con vida 4
- **WHEN** el `goblin-torch` muere por armas
- **THEN** el snapshot sigue teniendo 300 gemas con los mismos identificadores
- **AND** al recoger después la gema más antigua el jugador suma 2 de XP

#### Scenario: Varias bajas con el tope lleno
- **GIVEN** `maxGems` 1, una gema g1 de valor 1 en el suelo lejos del jugador y tres enemigos, un `goblin-torch`, un
  `goblin-barrel` y un `goblin-tnt` (1 + 2 + 4 de XP), que mueren por armas en el mismo tick
- **WHEN** se ejecuta ese tick
- **THEN** sigue habiendo exactamente 1 gema, g1, y al recogerla el jugador suma 8 de XP

#### Scenario: Plaza liberada por una recogida
- **GIVEN** `maxGems` 1 y una única gema g1 que se recoge en el tick n
- **WHEN** en el tick n + 1 muere un `goblin-torch` por armas lejos del jugador
- **THEN** el snapshot del tick n + 1 contiene exactamente 1 gema, nueva y distinta de g1

### Requirement: Pintado de las gemas
El adaptador de render SHALL mostrar en cada frame exactamente un sprite visible por cada gema del último snapshot,
en su posición (error ≤ 0,001) y con el aspecto de la gema (ver `sprite-rendering`), asociado por identificador, sin
crear sprites durante la partida más allá de una reserva de `maxGems`. El tamaño en pantalla lo fija el aspecto, no
`gemRadius`. MUST NOT quedar visible ningún sprite de una gema recogida.

#### Scenario: Recogidas y nuevas
- **GIVEN** un snapshot con 10 gemas ya pintado
- **WHEN** se pinta un snapshot en el que 3 se han recogido y han aparecido 2 nuevas
- **THEN** hay exactamente 9 sprites de gema visibles, cada uno en la posición de una gema distinta del snapshot

#### Scenario: Tope de gemas pintado
- **GIVEN** un snapshot con 300 gemas
- **WHEN** se pinta
- **THEN** hay exactamente 300 sprites de gema visibles, todos con el aspecto de la gema

#### Scenario: Todas recogidas
- **GIVEN** un snapshot con 300 gemas ya pintado
- **WHEN** se pinta un snapshot sin gemas
- **THEN** no hay ningún sprite de gema visible

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

<!-- historial: 0005-xp-and-level-up (2026-11-19) -->
<!-- historial: 0012-sprite-rendering (2026-11-22) -->
<!-- historial: 0015-procedural-map (2026-11-23) -->
