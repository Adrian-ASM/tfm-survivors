# Spec delta · xp-gems

<!-- Ruta: openspec/changes/0012-sprite-rendering/specs/xp-gems/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test. -->

> Cambios:
> - Renombrado de ids de enemigo, sin cambio de comportamiento: `goblin-torch`, `goblin-tnt` y
>   `goblin-barrel` heredan, en ese orden, los stats de `bug`, `memory-leak` y `merge-conflict`.
> - "Pintado de las gemas": el sprite usa el aspecto de la gema (ver `sprite-rendering`); su tamaño en pantalla lo
>   fija ese aspecto, no `gemRadius`.

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Suelta de gema por baja
El sistema SHALL crear, por cada enemigo dado de baja por armas en un tick, exactamente una gema en la posición que
tenía el enemigo en el paso de armas de ese tick, con un valor de XP igual al `xp` de su tipo (ver
`enemy-spawning`) y el radio `gemRadius`. Las gemas de las bajas de un mismo tick se crean en el orden de la lista de
enemigos. Cada gema tiene un identificador único en la partida que no se reutiliza. Crear gemas MUST NOT consumir
azar. Una gema creada en un tick participa en el paso de gemas de ese mismo tick (ver `simulation-loop`).

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

#### Scenario: Sin baja no hay gema
- **GIVEN** un `goblin-torch` con vida 10 que recibe 1 impacto del Linter y queda con vida 4
- **WHEN** se lee el snapshot de ese tick
- **THEN** no hay ninguna gema nueva

#### Scenario: Las gemas no consumen azar
- **GIVEN** dos partidas con la misma semilla y el mismo estado salvo que en una hay 10 gemas en el suelo más
- **WHEN** ambas ejecutan el mismo tick sin oferta de mejora
- **THEN** el estado del `RandomGenerator` es el mismo en las dos tras el tick

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

## REMOVED Requirements
<!-- Ninguno. -->
