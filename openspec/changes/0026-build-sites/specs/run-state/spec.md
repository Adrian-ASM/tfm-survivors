# Spec delta · run-state

<!-- Purpose (al archivar): el estado de la partida (en curso, eligiendo mejora, en tienda, en obra o terminada, con su
     resultado) y la detención de la simulación al terminar, al elegir, en la tienda y en la obra. -->

## ADDED Requirements

### Requirement: Simulación congelada en obra
El sistema SHALL ignorar los ticks pedidos sobre una partida que está **en obra**, con las mismas garantías que
"Simulación congelada mientras se elige mejora": MUST NOT cambiar nada de lo que ese requisito enumera (jugador,
enemigos, director, armas, proyectiles, pulsos, peligros, recogibles, XP, nivel, subidas pendientes, estructuras,
nacimientos, ovejas y sus reapariciones, el estado de ningún `RandomGenerator` ni el contador de ticks), ni las flechas
de las torres, su carga, ni el tiempo que falta para el siguiente pago de cada casa, sea cual sea el input. Solo la
construcción (ver "Construcción en el solar" en `build-sites`) cambia la madera, la piedra, el estado de un solar, la
caminabilidad y las posiciones despejadas mientras la partida está en obra, y solo la construcción o la salida sin
construir la devuelven a en curso; tras ellas, el siguiente tick ejecutado continúa exactamente donde se quedó la
partida. Pedir ticks en este estado no produce errores.

#### Scenario: 600 ticks en obra
- **GIVEN** una partida que abre la oferta de un solar en el tick n con ≥ 1 enemigo vivo, ≥ 1 proyectil vivo, ≥ 1
  flecha de torre en vuelo, ≥ 1 gema atraída, el jugador invulnerable y una oveja huyendo
- **WHEN** se piden 600 ticks más con input (1, 1)
- **THEN** el snapshot es igual campo a campo al del tick n, incluidos `tick` = n y la fase en obra
- **AND** no se ha producido ningún error

#### Scenario: La obra no consume azar
- **GIVEN** dos partidas idénticas con la misma semilla que abren la oferta del mismo solar en el tick n
- **WHEN** a una se le piden 600 ticks en obra y a la otra ninguno, y ambas salen sin construir
- **THEN** sus snapshots son iguales campo a campo en cada uno de los 600 ticks siguientes ejecutados

#### Scenario: Peligros, invulnerabilidad y pagos en pausa durante la obra
- **GIVEN** una partida que abre la oferta de un solar en el tick n con el jugador golpeado en n − 10
  (invulnerabilidad de 30 ticks), un barril en mecha que explotará en n + 4 y una casa que pagará en n + 6
- **WHEN** se piden 600 ticks en obra, se sale y se ejecutan 25 ticks
- **THEN** el barril explota en el tick n + 4, la casa paga en el tick n + 6 y el jugador no recibe daño de contacto
  hasta el tick n + 21

#### Scenario: Obra abierta justo antes del tick de la victoria
- **GIVEN** una partida con duración objetivo de 120 ticks que abre la oferta de un solar en el tick 119
- **WHEN** se piden 600 ticks en obra, se construye una casa y se ejecuta 1 tick
- **THEN** durante la obra el estado es en obra con `snapshot.tick` 119 y sin resultado
- **AND** tras el tick ejecutado el estado es terminada, con victoria y `snapshot.tick` 120

## MODIFIED Requirements

### Requirement: Estado de la partida
El sistema SHALL mantener un estado de partida con cinco valores, en curso, eligiendo mejora, en tienda, **en obra** y
terminada, y exponerlo en el snapshot junto con el resultado de la partida: vacío, victoria o derrota (ver
`run-outcome`). El resultado MUST estar definido si y solo si el estado es terminada. Toda partida recién creada MUST
estar en curso y sin resultado. Las transiciones posibles son: de en curso a eligiendo mejora (al abrirse una oferta,
ver `upgrades`), de eligiendo mejora a en curso (al elegir sin más subidas pendientes con mejoras disponibles), de en
curso a en tienda (al abrirse la tienda, ver "Apertura por la puerta con re-armado" en `castle-shop`), de en tienda a
en curso (al salir de la tienda), de en curso a en obra (al abrirse la oferta de un solar, ver "Apertura del solar con
re-armado" en `build-sites`), de en obra a en curso (al construir o al salir sin construir) y de en curso a terminada,
con derrota (la vida del jugador llega a 0) o con victoria (se completa el tick de la duración objetivo, ver
`run-outcome`). Si ambas condiciones se dan en el mismo tick, el resultado es derrota. Una partida que está eligiendo
mejora, en tienda o en obra no puede pasar directamente a terminada, ni de una de esas fases a otra sin pasar por en
curso. El paso a terminada y su resultado son irreversibles; una partida nueva solo se obtiene reiniciando (ver
`run-results`).

<!-- Escenarios vivos sin cambios: todos los de este requisito. -->

#### Scenario: En obra y vuelta a en curso
- **GIVEN** una partida en curso que abre la oferta de un solar en el tick n, una vez, y otra vez el mismo estado
- **WHEN** se lee el snapshot del tick n y, tras construir una casa en la primera y salir sin construir en la segunda,
  se vuelve a leer
- **THEN** el estado es en obra en el primero y en curso en el segundo en ambas, sin resultado
