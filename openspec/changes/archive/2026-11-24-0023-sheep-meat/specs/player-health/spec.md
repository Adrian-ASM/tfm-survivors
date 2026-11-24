# Spec delta · player-health

<!-- Change 0023-sheep-meat: primera curación del juego (carne de oveja). El Purpose pasa a "La vida del jugador, el
     contacto con enemigos, el daño discreto con invulnerabilidad temporal, la curación por carne y la vida mínima 0"
     al archivar. -->

## ADDED Requirements

### Requirement: Curación por carne
El sistema SHALL curar al jugador, en el paso de recogibles del tick (ver "Orden de los pasos del tick" en
`simulation-loop`), por cada recogible `meat` que recoge (ver "Recogida de gemas" en `xp-gems`), en orden de creación:
la vida actual sube en valor de la pieza × max(1, ⌊curación de la carne × vida máxima efectiva / 100⌋) (ver
"Contenido de recursos validado" en `resources`), con la vida máxima efectiva de ese momento, y queda como mucho en la
vida máxima efectiva. La vida es siempre un entero. Curar:
- no cambia la vida máxima ni la invulnerabilidad (ni la inicia, ni la alarga, ni la acorta);
- no tiene efecto si la vida ya está al máximo (el valor sobrante se pierde);
- no ocurre en un tick que acaba antes del paso de recogibles: si el golpe del tick deja la vida en 0, la partida
  termina con derrota y la carne de ese tick no se recoge (la carne no resucita); en el tick de la victoria tampoco se
  recoge;
- MUST NOT consumir azar.

Ninguna otra cosa sube la vida actual salvo la mejora de `maxHealth` (ver "Vida máxima mejorable"): no hay curación por
tiempo, por el castillo ni por otras fuentes.

#### Scenario: Curación del 20 %
- **GIVEN** un jugador con vida 50 de 100, curación de la carne 20 y un recogible `meat` de valor 1 que se recoge en el
  tick n
- **WHEN** se ejecuta el tick n
- **THEN** la vida vale 70 y la vida máxima 100 en el snapshot del tick n

#### Scenario: Tope en la vida máxima
- **GIVEN** un jugador con vida 90 de 100, curación de la carne 20 y un recogible `meat` de valor 1 que se recoge en el
  tick n
- **WHEN** se ejecuta el tick n
- **THEN** la vida vale 100, no 110

#### Scenario: Relativa a la vida máxima efectiva
- **GIVEN** un jugador con vida 100 de 140 (`guardrail` en nivel 2), curación de la carne 20 y un recogible `meat` de
  valor 1 que se recoge en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la vida vale 128 (cura 28)

#### Scenario: Redondeo hacia abajo y mínimo 1
- **GIVEN** curación de la carne 15, un jugador con vida 50 de 110, y en otra partida curación 1 con vida 10 de 60
- **WHEN** se recoge en el tick n un recogible `meat` de valor 1
- **THEN** en la primera la vida vale 66 (⌊16,5⌋ = 16) y en la segunda 11 (⌊0,6⌋ = 0, mínimo 1)

#### Scenario: Pieza acumulada por el tope
- **GIVEN** un jugador con vida 20 de 100, curación de la carne 20 y un recogible `meat` de valor 3 (acumulado por el
  tope de carne) que se recoge en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la vida vale 80
- **AND** con vida 50 de 100, la vida vale 100 (cura 60, acotada a 50)

#### Scenario: Dos piezas en el mismo tick
- **GIVEN** un jugador con vida 30 de 100, curación de la carne 20 y dos recogibles `meat` de valor 1 que se recogen en
  el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la vida vale 70

#### Scenario: Golpe y curación en el mismo tick
- **GIVEN** un jugador con vida 30 de 100, no invulnerable, en contacto con un enemigo de damage 10 en el tick n y un
  recogible `meat` de valor 1 que se recoge en ese tick, con curación de la carne 20
- **WHEN** se ejecuta el tick n
- **THEN** la vida vale 40 (30 − 10 + 20) y el jugador está invulnerable en el snapshot del tick n

#### Scenario: La carne no resucita
- **GIVEN** un jugador con vida 10 de 100, no invulnerable, en contacto con un enemigo de damage 10 en el tick n y un
  recogible `meat` en su posición en ese tick
- **WHEN** se ejecuta el tick n
- **THEN** la vida vale 0, la partida está terminada con derrota y el recogible `meat` sigue en el snapshot

#### Scenario: Sin curación en el tick de la victoria
- **GIVEN** una partida con duración objetivo 120 ticks, un jugador con vida 50 de 100 y un recogible `meat` que se
  recogería en el tick 120
- **WHEN** se ejecuta el tick 120
- **THEN** la partida termina con victoria, la vida sigue en 50 y el recogible sigue en el snapshot

#### Scenario: La curación no cambia la invulnerabilidad
- **GIVEN** un jugador que queda con vida 60 de 100 tras un golpe en el tick 10, con invulnerabilidad de 30 ticks,
  curación de la carne 20, un recogible `meat` de valor 1 que se recoge en el tick 20 y un enemigo de damage 10 en
  contacto desde el tick 21
- **WHEN** se ejecuta hasta el tick 41
- **THEN** la vida vale 80 tras el tick 20 y hasta el 40, y 70 tras el tick 41
- **AND** los snapshots de los ticks 10 a 41 marcan invulnerable exactamente los mismos ticks que en una partida igual
  sin la carne (10 a 40 y 41)
