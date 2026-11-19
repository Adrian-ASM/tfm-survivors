# Run state · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
El estado de la partida (en curso o terminada) y la detención de la simulación al terminar.

## Requirements

### Requirement: Estado de la partida
El sistema SHALL mantener un estado de partida con dos valores, en curso y terminada, y exponerlo en el snapshot.
Toda partida recién creada MUST estar en curso. El paso de en curso a terminada es irreversible.

#### Scenario: Partida recién creada
- **GIVEN** una partida recién creada con el contenido por defecto
- **WHEN** se lee el snapshot antes del primer tick
- **THEN** el estado es en curso

#### Scenario: Partida con vida restante
- **GIVEN** un jugador con vida 100 golpeado 9 veces por un enemigo con damage 10
- **WHEN** se lee el snapshot tras el noveno golpe
- **THEN** la vida vale 10 y el estado sigue en curso

### Requirement: Fin de partida al llegar a vida 0
El sistema SHALL pasar la partida a terminada en el mismo tick en que la vida del jugador llega a 0. Ese tick
cuenta: el contador de ticks del snapshot lo incluye. En ese tick MUST NOT aparecer ningún enemigo nuevo: el
director no actúa en el tick en que la partida termina.

#### Scenario: Golpe que deja la vida en 0
- **GIVEN** una partida en el tick 99 con el jugador a vida 10, no invulnerable, y un enemigo con damage 10 que
  estará en contacto en el tick 100
- **WHEN** se ejecuta 1 tick
- **THEN** el snapshot tiene tick 100, vida 0 y estado terminada

#### Scenario: Varios contactos en el tick de la muerte
- **GIVEN** un jugador con vida 10, no invulnerable, y dos enemigos con damage 10 y 25 en contacto en el mismo
  tick
- **WHEN** se ejecuta 1 tick
- **THEN** la vida vale 0 (no negativa) y el estado es terminada

#### Scenario: Sin spawns en el tick de la muerte
- **GIVEN** una partida con el jugador a vida 10 y un enemigo con damage 10 que estará en contacto en el tick n,
  y un director cuyo presupuesto alcanza el coste del tipo pendiente en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el número de enemigos vivos del snapshot del tick n es igual al del tick n − 1

### Requirement: Simulación detenida tras terminar
El sistema SHALL ignorar los ticks pedidos sobre una partida terminada: MUST NOT cambiar la posición ni la vida
del jugador, la posición, la vida, la indicación de daño reciente ni el número de enemigos, el presupuesto ni el
tipo pendiente del director, la carga ni la cadencia de las armas, la posición ni el número de proyectiles, los
pulsos visibles, el estado del `RandomGenerator` ni el contador de ticks, sea cual sea el input. Pedir ticks sobre
una partida terminada no produce errores.

#### Scenario: 600 ticks después de terminar
- **GIVEN** una partida que termina en el tick n con ≥ 1 enemigo vivo
- **WHEN** se ejecutan 600 ticks más con input (1, 1)
- **THEN** el snapshot es igual campo a campo al del tick n, incluido `tick` = n
- **AND** no se ha producido ningún error

#### Scenario: Armas congeladas al terminar
- **GIVEN** una partida que termina en el tick n con ≥ 1 proyectil vivo, 1 pulso visible, ≥ 1 enemigo con daño
  reciente y un enemigo vivo a 50 px del jugador
- **WHEN** se ejecutan 600 ticks más
- **THEN** el snapshot es igual campo a campo al del tick n: mismos proyectiles en las mismas posiciones, el mismo
  pulso, la misma indicación de daño y ninguna vida de enemigo cambiada

#### Scenario: La terminación no consume azar
- **GIVEN** dos partidas idénticas con la misma semilla que terminan en el mismo tick n
- **WHEN** a una se le piden 600 ticks más y a la otra ninguno
- **THEN** sus snapshots son iguales campo a campo

#### Scenario: Una partida terminada no vuelve a en curso
- **GIVEN** una partida terminada
- **WHEN** se ejecutan 36.000 ticks más
- **THEN** el estado sigue siendo terminada y la vida sigue en 0

<!-- historial: 0003-collisions-and-damage (2026-11-19) -->
<!-- historial: 0004-auto-weapons (2026-11-19) -->
