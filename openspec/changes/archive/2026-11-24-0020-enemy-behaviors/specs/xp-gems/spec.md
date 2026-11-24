# Spec delta · xp-gems

<!-- Change 0020-enemy-behaviors. Las bajas por explosión (barril que explota y goblins alcanzados, D1) también
     sueltan gema. -->

## ADDED Requirements

<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Suelta de gema por baja
El sistema SHALL crear, por cada enemigo dado de baja en un tick, por armas o por explosión (la del propio barril que
explota o una ajena, ver `enemy-hazards`), exactamente una gema en la posición que tenía el enemigo en el paso en que
queda dado de baja (paso de armas o paso de peligros, ver "Orden de los pasos del tick" en `simulation-loop`), o en
la que fije "Recolocación de gemas en celdas no caminables" si esa posición está en una celda no caminable, con un
valor de XP igual al `xp` de su tipo (ver `enemy-spawning`) y el radio `gemRadius`. Las gemas de las bajas de un mismo
paso se crean en el orden de la lista de enemigos; las del paso de armas, antes que las del paso de peligros. Cada
gema tiene un identificador único en la partida que no se reutiliza. Crear gemas MUST NOT consumir azar. Una gema
creada en un tick participa en el paso de gemas de ese mismo tick (ver `simulation-loop`). Una baja suelta una sola
gema aunque reciba daño de armas y de explosiones en el mismo tick.

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

#### Scenario: El barril que explota suelta su gema
- **GIVEN** el contenido por defecto, el jugador lejos y un `goblin-barrel` que explota en el tick n en la posición P
  (celda caminable)
- **WHEN** se ejecuta el tick n
- **THEN** el snapshot del tick n contiene exactamente 1 gema nueva de ese barril, en P, que da 2 de XP

#### Scenario: Bajas por armas y por explosión en el mismo tick
- **GIVEN** un `goblin-torch` A (antes en la lista) que muere por el Linter en el tick n y un `goblin-torch` B que
  muere por una explosión en el mismo tick
- **WHEN** se ejecuta el tick n
- **THEN** hay 2 gemas nuevas y la de A tiene un identificador creado antes que la de B
- **AND** si en otra partida A muere por la explosión y B por el Linter, la de B se crea antes que la de A

## REMOVED Requirements

<!-- Ninguno. -->
