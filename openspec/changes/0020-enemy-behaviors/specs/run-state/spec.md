# Spec delta · run-state

<!-- Change 0020-enemy-behaviors. Los estados de comportamiento, las dinamitas, los avisos y las explosiones también
     se congelan con la partida terminada o eligiendo mejora. -->

## ADDED Requirements

<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Simulación detenida tras terminar
El sistema SHALL ignorar los ticks pedidos sobre una partida terminada, sea cual sea su resultado (victoria o
derrota): MUST NOT cambiar la posición ni la vida del jugador, la posición, la vida, la indicación de daño reciente,
el estado de comportamiento ni el tiempo que lleva en él, ni el número de enemigos, el presupuesto ni el tipo
pendiente del director, la carga ni la cadencia de las armas, la posición ni el número de proyectiles, los pulsos
visibles, las dinamitas, los avisos ni las explosiones visibles, las gemas, la XP, el nivel, los niveles de las
mejoras, las bajas, el resultado, el estado del `RandomGenerator` ni el contador de ticks, sea cual sea el input.
Ninguna mecha, carga, espera ni dinamita avanza ni explota. Sobre una partida terminada no hay oferta abierta y elegir
mejora devuelve un error (ver `upgrades`). Pedir ticks sobre una partida terminada no produce errores.

#### Scenario: 600 ticks después de terminar
- **GIVEN** una partida que termina con derrota en el tick n con ≥ 1 enemigo vivo
- **WHEN** se ejecutan 600 ticks más con input (1, 1)
- **THEN** el snapshot es igual campo a campo al del tick n, incluidos `tick` = n, las bajas y el resultado
- **AND** no se ha producido ningún error

#### Scenario: 600 ticks después de ganar
- **GIVEN** una partida que termina con victoria en el tick 36.000 con ≥ 1 enemigo vivo, ≥ 1 proyectil vivo y ≥ 1
  gema en el suelo
- **WHEN** se ejecutan 600 ticks más con input (1, 1)
- **THEN** el snapshot es igual campo a campo al del tick 36.000, incluidos `tick` = 36.000, las bajas y el
  resultado victoria
- **AND** no se ha producido ningún error

#### Scenario: Armas congeladas al terminar
- **GIVEN** una partida que termina en el tick n con ≥ 1 proyectil vivo, 1 pulso visible, ≥ 1 enemigo con daño
  reciente y un enemigo vivo a 50 px del jugador
- **WHEN** se ejecutan 600 ticks más
- **THEN** el snapshot es igual campo a campo al del tick n: mismos proyectiles en las mismas posiciones, el mismo
  pulso, la misma indicación de daño, ninguna vida de enemigo cambiada y las mismas bajas

#### Scenario: Gemas congeladas al terminar
- **GIVEN** una partida que termina en el tick n con ≥ 1 gema atraída a 30 px del jugador
- **WHEN** se ejecutan 600 ticks más
- **THEN** la gema sigue en la misma posición, la XP y el nivel no cambian y no hay oferta

#### Scenario: Peligros congelados al terminar
- **GIVEN** una partida que termina con derrota en el tick n por una explosión, con ≥ 1 dinamita en vuelo que
  explotaría en n + 5, ≥ 1 barril en mecha que explotaría en n + 3, ≥ 1 `goblin-tnt` en carga y la explosión visible
- **WHEN** se ejecutan 600 ticks más
- **THEN** el snapshot es igual campo a campo al del tick n: mismas dinamitas en las mismas posiciones, mismos
  avisos, la misma explosión visible, los mismos estados de los enemigos y ninguna explosión nueva

#### Scenario: La terminación no consume azar
- **GIVEN** dos partidas idénticas con la misma semilla que terminan en el mismo tick n, una vez con derrota y otra
  vez (en otro par de partidas) con victoria
- **WHEN** a una partida de cada par se le piden 600 ticks más y a la otra ninguno
- **THEN** en cada par sus snapshots son iguales campo a campo

#### Scenario: Una partida terminada no vuelve a en curso
- **GIVEN** una partida terminada con derrota y otra terminada con victoria
- **WHEN** se ejecutan 36.000 ticks más en cada una
- **THEN** ambas siguen terminadas, con su mismo resultado; la de derrota sigue con vida 0

### Requirement: Simulación congelada mientras se elige mejora
El sistema SHALL ignorar los ticks pedidos sobre una partida que está eligiendo mejora: MUST NOT cambiar la
posición, la vida, la vida máxima ni la invulnerabilidad del jugador, la posición, la vida, la indicación de daño
reciente, el estado de comportamiento ni el tiempo que lleva en él, ni el número de enemigos, el presupuesto ni el
tipo pendiente del director, la carga ni la cadencia de las armas, los proyectiles, los pulsos visibles, las
dinamitas, los avisos ni las explosiones visibles, las gemas ni su atracción, la XP, el nivel, las subidas
pendientes, la oferta abierta, el estado del `RandomGenerator` ni el contador de ticks, sea cual sea el input. Pedir
ticks en este estado no produce errores. Solo una elección válida (ver `upgrades`) saca a la partida de este estado;
tras ella, el siguiente tick ejecutado continúa exactamente donde se quedó la partida.

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

#### Scenario: Peligros en pausa durante la oferta
- **GIVEN** una partida que abre una oferta en el tick n con una dinamita que explotará en n + 10 y un barril en
  mecha que explotará en n + 4
- **WHEN** se piden 600 ticks durante la oferta, se elige y se ejecutan 10 ticks
- **THEN** durante la oferta la dinamita, su aviso, el barril y su aviso no cambian
- **AND** tras elegir, el barril explota en el 4.º tick ejecutado (tick n + 4) y la dinamita en el 10.º (tick n + 10)

## REMOVED Requirements

<!-- Ninguno. -->
