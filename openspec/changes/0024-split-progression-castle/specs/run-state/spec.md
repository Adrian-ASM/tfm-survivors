# Spec delta · run-state

<!-- Purpose nuevo propuesto al archivar: "El estado de la partida (en curso, eligiendo mejora, en tienda o terminada,
     con su resultado) y la detención de la simulación al terminar, al elegir y en la tienda." -->

## ADDED Requirements

### Requirement: Simulación congelada en la tienda
El sistema SHALL ignorar los ticks pedidos sobre una partida que está en tienda, con las mismas garantías que
"Simulación congelada mientras se elige mejora": MUST NOT cambiar nada de lo que ese requisito enumera (jugador,
enemigos, director, armas, proyectiles, pulsos, peligros, recogibles, XP, nivel, subidas pendientes, estructuras,
nacimientos, ovejas y sus reapariciones, el estado de ningún `RandomGenerator` ni el contador de ticks), sea cual sea
el input. Solo las compras (ver "Compra en la tienda" en `castle-shop`) cambian el oro, los niveles de las mejoras de
arma y la vida mientras la partida está en tienda, y solo la salida la devuelve a en curso; tras ella, el siguiente tick
ejecutado continúa exactamente donde se quedó la partida. Pedir ticks en este estado no produce errores.

#### Scenario: 600 ticks en la tienda
- **GIVEN** una partida que abre la tienda en el tick n con ≥ 1 enemigo vivo, ≥ 1 proyectil vivo, ≥ 1 gema atraída, el
  jugador invulnerable y una oveja huyendo
- **WHEN** se piden 600 ticks más con input (1, 1)
- **THEN** el snapshot es igual campo a campo al del tick n, incluidos `tick` = n y la fase en tienda
- **AND** no se ha producido ningún error

#### Scenario: La tienda no consume azar
- **GIVEN** dos partidas idénticas con la misma semilla que abren la tienda en el tick n
- **WHEN** a una se le piden 600 ticks en la tienda y a la otra ninguno, y ambas salen sin comprar
- **THEN** sus snapshots son iguales campo a campo en cada uno de los 600 ticks siguientes ejecutados

#### Scenario: Peligros e invulnerabilidad en pausa durante la tienda
- **GIVEN** una partida que abre la tienda en el tick n con el jugador golpeado en n − 10 (invulnerabilidad de 30
  ticks), un barril en mecha que explotará en n + 4 y un enemigo que seguirá en contacto
- **WHEN** se piden 600 ticks en la tienda, se sale y se ejecutan 25 ticks
- **THEN** el barril explota en el 4.º tick ejecutado (tick n + 4) y el jugador no recibe daño de contacto hasta el
  tick n + 21

## MODIFIED Requirements

### Requirement: Estado de la partida
El sistema SHALL mantener un estado de partida con cuatro valores, en curso, eligiendo mejora, **en tienda** y
terminada, y exponerlo en el snapshot junto con el resultado de la partida: vacío, victoria o derrota (ver
`run-outcome`). El resultado MUST estar definido si y solo si el estado es terminada. Toda partida recién creada MUST
estar en curso y sin resultado. Las transiciones posibles son: de en curso a eligiendo mejora (al abrirse una oferta,
ver `upgrades`), de eligiendo mejora a en curso (al elegir sin más subidas pendientes con mejoras disponibles), de en
curso a en tienda (al abrirse la tienda, ver "Apertura por la puerta con re-armado" en `castle-shop`), de en tienda a
en curso (al salir de la tienda) y de en curso a terminada, con derrota (la vida del jugador llega a 0) o con victoria
(se completa el tick de la duración objetivo, ver `run-outcome`). Si ambas condiciones se dan en el mismo tick, el
resultado es derrota. Una partida que está eligiendo mejora o en tienda no puede pasar directamente a terminada, ni de
una a otra sin pasar por en curso. El paso a terminada y su resultado son irreversibles; una partida nueva solo se
obtiene reiniciando (ver `run-results`).

<!-- Escenarios vivos sin cambios: "Partida recién creada", "Partida con vida restante", "Eligiendo mejora y vuelta a
     en curso", "Sin pasar por eligiendo si no hay mejoras disponibles", "Terminada por victoria", "Terminada por
     derrota" y "Oferta abierta justo antes del tick de la victoria". -->

#### Scenario: En tienda y vuelta a en curso
- **GIVEN** una partida en curso que abre la tienda en el tick n
- **WHEN** se lee el snapshot del tick n y, tras salir de la tienda, se vuelve a leer
- **THEN** el estado es en tienda en el primero y en curso en el segundo, sin resultado en ambos

#### Scenario: Tienda abierta justo antes del tick de la victoria
- **GIVEN** una partida con duración objetivo de 120 ticks que abre la tienda en el tick 119
- **WHEN** se piden 600 ticks con la tienda abierta, se sale y se ejecuta 1 tick
- **THEN** durante la tienda el estado es en tienda con `snapshot.tick` 119 y sin resultado
- **AND** tras el tick ejecutado el estado es terminada, con victoria y `snapshot.tick` 120
