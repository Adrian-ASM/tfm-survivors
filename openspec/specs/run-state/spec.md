# Run state · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
El estado de la partida (en curso o terminada) y la detención de la simulación al terminar.

## Requirements

### Requirement: Estado de la partida
El sistema SHALL mantener un estado de partida con tres valores, en curso, eligiendo mejora y terminada, y exponerlo
en el snapshot. Toda partida recién creada MUST estar en curso. Las transiciones posibles son: de en curso a
eligiendo mejora (al abrirse una oferta, ver `upgrades`), de eligiendo mejora a en curso (al elegir sin más subidas
pendientes con mejoras disponibles) y de en curso a terminada. Una partida que está eligiendo mejora no puede pasar
directamente a terminada. El paso a terminada es irreversible.

#### Scenario: Partida recién creada
- **GIVEN** una partida recién creada con el contenido por defecto
- **WHEN** se lee el snapshot antes del primer tick
- **THEN** el estado es en curso

#### Scenario: Partida con vida restante
- **GIVEN** un jugador con vida 100 golpeado 9 veces por un enemigo con damage 10
- **WHEN** se lee el snapshot tras el noveno golpe
- **THEN** la vida vale 10 y el estado sigue en curso

#### Scenario: Eligiendo mejora y vuelta a en curso
- **GIVEN** una partida en curso en nivel 1 con XP 4 que recoge una gema de valor 1 en el tick n
- **WHEN** se lee el snapshot del tick n y, tras elegir una opción, se vuelve a leer
- **THEN** el estado es eligiendo mejora en el primero y en curso en el segundo

#### Scenario: Sin pasar por eligiendo si no hay mejoras disponibles
- **GIVEN** una partida con todas las mejoras en su nivel máximo que sube de nivel en el tick n
- **WHEN** se lee el snapshot del tick n
- **THEN** el estado es en curso

### Requirement: Fin de partida al llegar a vida 0
El sistema SHALL pasar la partida a terminada en el mismo tick en que la vida del jugador llega a 0. Ese tick
cuenta: el contador de ticks del snapshot lo incluye. En ese tick MUST NOT aparecer ningún enemigo nuevo, recogerse
ninguna gema ni abrirse ninguna oferta de mejoras: ni el paso de gemas ni el director ni la apertura de ofertas
actúan en el tick en que la partida termina. Las gemas soltadas por las bajas de ese tick sí quedan en el suelo.

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

#### Scenario: Muerte y subida de nivel en el mismo tick
- **GIVEN** un jugador en nivel 1 con XP 4 y vida 10, no invulnerable, una gema de valor 1 que se recogería en el
  tick n y un enemigo con damage 10 en contacto en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el estado es terminada, la vida vale 0 y no hay oferta abierta
- **AND** el nivel sigue en 1 con XP 4 y la gema sigue en el snapshot

#### Scenario: Una baja en el tick de la muerte deja su gema
- **GIVEN** un jugador con vida 10, no invulnerable, un enemigo con damage 10 en contacto en el tick n y un bug con
  vida 4 a 300 px que muere por el Linter en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el estado es terminada y el snapshot del tick n contiene la gema de ese bug

### Requirement: Simulación detenida tras terminar
El sistema SHALL ignorar los ticks pedidos sobre una partida terminada: MUST NOT cambiar la posición ni la vida
del jugador, la posición, la vida, la indicación de daño reciente ni el número de enemigos, el presupuesto ni el
tipo pendiente del director, la carga ni la cadencia de las armas, la posición ni el número de proyectiles, los
pulsos visibles, las gemas, la XP, el nivel, los niveles de las mejoras, el estado del `RandomGenerator` ni el
contador de ticks, sea cual sea el input. Sobre una partida terminada no hay oferta abierta y elegir mejora devuelve
un error (ver `upgrades`). Pedir ticks sobre una partida terminada no produce errores.

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

#### Scenario: Gemas congeladas al terminar
- **GIVEN** una partida que termina en el tick n con ≥ 1 gema atraída a 30 px del jugador
- **WHEN** se ejecutan 600 ticks más
- **THEN** la gema sigue en la misma posición, la XP y el nivel no cambian y no hay oferta

#### Scenario: La terminación no consume azar
- **GIVEN** dos partidas idénticas con la misma semilla que terminan en el mismo tick n
- **WHEN** a una se le piden 600 ticks más y a la otra ninguno
- **THEN** sus snapshots son iguales campo a campo

#### Scenario: Una partida terminada no vuelve a en curso
- **GIVEN** una partida terminada
- **WHEN** se ejecutan 36.000 ticks más
- **THEN** el estado sigue siendo terminada y la vida sigue en 0

### Requirement: Simulación congelada mientras se elige mejora
El sistema SHALL ignorar los ticks pedidos sobre una partida que está eligiendo mejora: MUST NOT cambiar la
posición, la vida, la vida máxima ni la invulnerabilidad del jugador, la posición, la vida, la indicación de daño
reciente ni el número de enemigos, el presupuesto ni el tipo pendiente del director, la carga ni la cadencia de las
armas, los proyectiles, los pulsos visibles, las gemas ni su atracción, la XP, el nivel, las subidas pendientes, la
oferta abierta, el estado del `RandomGenerator` ni el contador de ticks, sea cual sea el input. Pedir ticks en este
estado no produce errores. Solo una elección válida (ver `upgrades`) saca a la partida de este estado; tras ella, el
siguiente tick ejecutado continúa exactamente donde se quedó la partida.

#### Scenario: 600 ticks con una oferta abierta
- **GIVEN** una partida que abre una oferta en el tick n con ≥ 1 enemigo vivo, ≥ 1 proyectil vivo, ≥ 1 gema
  atraída, 1 pulso visible y el jugador invulnerable
- **WHEN** se piden 600 ticks más con input (1, 1)
- **THEN** el snapshot es igual campo a campo al del tick n, incluidos `tick` = n y la oferta
- **AND** no se ha producido ningún error

#### Scenario: La pausa no consume azar
- **GIVEN** dos partidas idénticas con la misma semilla que abren la misma oferta en el tick n
- **WHEN** a una se le piden 600 ticks durante la oferta y a la otra ninguno, y ambas eligen el mismo índice
- **THEN** sus snapshots son iguales campo a campo en cada uno de los 600 ticks siguientes ejecutados

#### Scenario: La invulnerabilidad no corre durante la pausa
- **GIVEN** un jugador golpeado en el tick 10 con invulnerabilidad de 30 ticks y una oferta abierta en el tick 20
- **WHEN** se piden 600 ticks durante la oferta, se elige y un enemigo sigue en contacto desde el tick 21
- **THEN** el jugador no recibe daño en los ticks 21 a 40 y sí en el tick 41

#### Scenario: Continuación tras elegir
- **GIVEN** una partida que abre una oferta en el tick n y en la que se elige sin pedir ticks durante la oferta
- **WHEN** se ejecuta 1 tick
- **THEN** el snapshot tiene `tick` n + 1 y la partida está en curso

<!-- historial: 0003-collisions-and-damage (2026-11-19) -->
<!-- historial: 0004-auto-weapons (2026-11-19) -->
<!-- historial: 0005-xp-and-level-up (2026-11-19) -->
