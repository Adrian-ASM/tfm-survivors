# Spec delta · goblin-structures

<!-- Las casas y las torres sueltan oro al quedar en ruina. Las cantidades viven en el contenido de recursos (ver
     "Contenido de recursos validado" en `resources`); el design fija en qué fichero. Colocación, firma dorada de
     estructuras (`STRUCTURE_GOLDEN`), guardias y snapshot de estructuras: sin cambios. -->

## MODIFIED Requirements

### Requirement: Vida, destrucción y ruina
El sistema SHALL dar a cada estructura, al crear la partida, la vida de su tipo. Solo las armas del jugador le quitan
vida (ver "Objetivo del más cercano dentro de alcance", "Proyectiles" y "Pulso de área" en `auto-weapons`); las
explosiones de barriles y dinamitas MUST NOT dañarla (ver "Explosión de área" en `enemy-hazards`) y el contacto de
los enemigos tampoco. La vida no baja de 0. Una estructura cuya vida llega a 0 queda **destruida** en el paso de armas
de ese tick, de forma irreversible, y desde ese momento es una **ruina**:
- sigue en la lista de estructuras del snapshot hasta el final de la partida, con vida 0 y marcada como destruida;
- no es objetivo de ningún arma ni recibe daño; aplicarle daño no tiene efecto;
- una casa destruida no hace nacer más guardias (los que ya viven siguen vivos con su puesto).

Al quedar destruida, una estructura suelta **exactamente un** recogible `gold` (ver "Recogibles con tipo" en
`xp-gems`) en su posición (centro de su huella), con el oro de su tipo del contenido (oro por casa u oro por torre,
ver `resources`). Los recogibles de oro de las estructuras destruidas en un mismo tick se crean en el orden de la lista
de estructuras y después de los recogibles de las bajas del paso de armas de ese tick; participan en el paso de
recogibles de ese mismo tick. Una ruina no vuelve a soltar oro. Destruir una estructura MUST NOT soltar gema, sumar XP
ni sumar al contador de bajas, que sigue contando solo enemigos (decisión D6), y MUST NOT consumir azar. Ninguna
estructura se crea ni se repara durante la partida.

#### Scenario: Daño que no destruye
- **GIVEN** una casa explícita con vida 30 y radio de impacto 40 en (1.260, 690) y un proyectil del Linter de daño 6
  que la solapa en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la casa sigue sin destruir con vida 24, el proyectil desaparece y no hay ningún recogible `gold` nuevo

#### Scenario: Destrucción sin XP ni baja
- **GIVEN** una partida con 5 bajas, XP 3 y 2 gemas en el suelo, y una casa explícita con vida 6 que recibe en el
  tick n un impacto del Linter de daño 6
- **WHEN** se ejecuta el tick n
- **THEN** en el snapshot del tick n la casa figura destruida con vida 0, en la misma posición de la lista
- **AND** las bajas siguen en 5, la XP en 3 y hay 2 gemas

#### Scenario: Oro de una casa destruida
- **GIVEN** oro por casa 25, el jugador quieto en (300, 900) con oro 0 y una casa explícita en columnas 20–21 y filas
  10–12 (posición (1.260, 690)) con vida 6 que recibe en el tick n un impacto del Linter de daño 6
- **WHEN** se ejecuta el tick n
- **THEN** el snapshot del tick n tiene exactamente 1 recogible `gold` nuevo, de valor 25, en (1.260, 690), y el oro
  sigue en 0 hasta que el jugador lo recoja

#### Scenario: Oro de una torre recogido
- **GIVEN** oro por torre 15, una torre explícita destruida en el tick n con su recogible `gold` en el suelo y el
  jugador que llega a solaparlo en el tick m > n con oro 0
- **WHEN** se ejecuta el tick m
- **THEN** el recogible desaparece y el oro vale 15

#### Scenario: Dos estructuras destruidas en el mismo tick
- **GIVEN** una casa h (antes en la lista) y una torre t, ambas con vida 4, un `goblin-torch` de vida 4 y un pulso de
  Tests en el tick n que deja a vida 0 a los tres
- **WHEN** se ejecuta el tick n
- **THEN** se crean en este orden la gema del `goblin-torch`, el `gold` de h con el oro por casa y el `gold` de t con
  el oro por torre
- **AND** las bajas suben exactamente en 1

#### Scenario: Una ruina no suelta más oro
- **GIVEN** una casa destruida en el tick n, cuyo recogible `gold` se ha recogido, y proyectiles que pasan por su
  posición en los ticks n + 1 a n + 600
- **WHEN** se ejecutan esos 600 ticks
- **THEN** no se crea ningún recogible `gold` nuevo y la casa sigue destruida con vida 0

#### Scenario: Daño mayor que la vida
- **GIVEN** una torre explícita con vida 4 y un impacto del Linter de daño 6 en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la torre figura destruida con vida 0 y suelta exactamente 1 recogible `gold`

#### Scenario: Ruina hasta el final
- **GIVEN** una casa destruida en el tick n de una partida que dura hasta el tick n + 3.600 con vida suficiente
- **WHEN** se leen los snapshots de n a n + 3.600
- **THEN** la casa figura destruida con vida 0 en todos ellos

#### Scenario: Las explosiones no dañan estructuras
- **GIVEN** una casa explícita con vida 30 y radio de impacto 40 en (1.260, 690) y una dinamita de radio 48 y daño 20
  con objetivo (1.260, 690) que explota en el tick n, y en otra partida un barril que explota en ese centro
- **WHEN** se ejecuta el tick n
- **THEN** en ambas la casa sigue con vida 30 y no hay ningún recogible `gold` nuevo

#### Scenario: El oro de las estructuras no consume azar
- **GIVEN** dos partidas con la semilla 7 y el mismo estado salvo que en una el Linter destruye una casa en el tick n y
  en la otra la casa sigue en pie
- **WHEN** ambas ejecutan el tick n sin oferta de mejora ni aparición
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick
