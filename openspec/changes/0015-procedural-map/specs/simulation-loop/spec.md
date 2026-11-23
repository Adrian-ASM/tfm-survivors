# Spec delta · simulation-loop

<!-- Ruta: openspec/changes/0015-procedural-map/specs/simulation-loop/spec.md
     El mapa forma parte del estado inicial que fija la semilla (ver `procedural-map`). Los escenarios vivos de
     "Determinismo" con el contenido por defecto y una semilla juegan ahora con el mapa generado de esa semilla. -->

## MODIFIED Requirements

### Requirement: Determinismo
El sistema SHALL producir exactamente el mismo `RunSnapshot`, enemigos, vida, invulnerabilidad, estado de la
partida, resultado, bajas, proyectiles, pulsos, indicación de daño, gemas, XP, nivel, ofertas y mejoras adquiridas
incluidos, y el mismo mapa, a partir del mismo estado inicial, la misma semilla, la misma secuencia de inputs por tick
y la misma secuencia de elecciones de mejora (índice elegido en cada oferta). En particular, el resultado de la
partida, el tick en que termina y las bajas MUST ser los mismos. El núcleo MUST NOT depender de reloj del sistema,
aleatoriedad global ni APIs del navegador: toda la aleatoriedad MUST venir de instancias del puerto
`RandomGenerator` inicializadas a partir de la semilla de la partida: una para generar el mapa y otra para el resto
de la partida (ver "Azar del mapa independiente del de la partida" en `procedural-map`). Las armas (selección de
objetivo, disparo, proyectiles y pulsos), las bajas y su contador, las gemas (suelta, recolocación, imán y recogida),
la colisión del jugador con el mapa, la XP y la comprobación de victoria y derrota MUST NOT consumir azar; la
apertura de ofertas de mejora sí lo consume.

#### Scenario: Dos partidas idénticas
- **GIVEN** dos partidas creadas con el mismo contenido y la semilla 42
- **WHEN** ambas reciben la misma secuencia de 600 inputs (10 s) generada por una seed fija, con la política de
  elección fija
- **THEN** sus snapshots son iguales campo a campo en cada tick, enemigos, vida, invulnerabilidad, estado,
  resultado, bajas, proyectiles, pulsos, gemas, XP, nivel y ofertas incluidos (comparación estricta, sin tolerancia)
- **AND** sus mapas son iguales celda a celda

#### Scenario: Semillas distintas
- **GIVEN** dos partidas creadas con el mismo contenido y las semillas 1 y 2
- **WHEN** ambas reciben la misma secuencia de 600 inputs
- **THEN** la posición de aparición de al menos 1 enemigo difiere entre las dos partidas
- **AND** sus mapas difieren en el tipo de al menos 1 celda

#### Scenario: Partida con contactos reproducible
- **GIVEN** dos partidas con el contenido por defecto y la semilla 42, con input (0, 0) en todos los ticks y la
  política de elección fija
- **WHEN** ambas ejecutan 4.800 ticks y en ese tiempo el jugador recibe ≥ 1 golpe (plazo provisional, a revalidar
  en apply)
- **THEN** sus snapshots son iguales campo a campo en cada tick, incluidos la vida, la invulnerabilidad, el
  estado, el resultado y, si la hay, el tick en que la partida termina

#### Scenario: Partida con armas reproducible
- **GIVEN** dos partidas con el contenido por defecto y la semilla 7, con input (0, 0) en todos los ticks y la
  política de elección fija
- **WHEN** ambas ejecutan 4.800 ticks y en ese tiempo ≥ 1 enemigo queda dado de baja por armas y se emite ≥ 1
  pulso (0013: en el mundo 2x el primer pulso llega en el tick 4.161, medido; antes 3.600; a revalidar con el mapa
  en apply de 0015)
- **THEN** sus snapshots son iguales campo a campo en cada tick, incluidos proyectiles, pulsos, vida de los enemigos,
  indicación de daño reciente y bajas

#### Scenario: Partida con progresión reproducible
- **GIVEN** dos partidas con el contenido por defecto (mundo de 1.920 × 1.080) y la semilla 7, con input (0, 0) y la
  política de elección fija
- **WHEN** ambas ejecutan 4.800 ticks y en ese tiempo se recoge ≥ 1 gema y se abre ≥ 1 oferta (mismo plazo que
  "Primera subida en el núcleo"; medido en apply de 0013: primera oferta en el tick 4.346; a revalidar con el mapa en
  apply de 0015)
- **THEN** sus snapshots son iguales campo a campo en cada tick, incluidas gemas, XP, nivel, ofertas y mejoras
  adquiridas

#### Scenario: Elecciones distintas divergen
- **GIVEN** dos partidas con la misma semilla y los mismos inputs que abren la misma primera oferta de 3 opciones
- **WHEN** en una se elige el índice 0 y en la otra el 1
- **THEN** sus listas de mejoras adquiridas difieren desde ese momento

#### Scenario: Partida larga reproducible
- **GIVEN** dos partidas con el contenido por defecto y la semilla 7
- **WHEN** ambas reciben la misma secuencia de 36.000 inputs (10 min), con la política de elección fija
- **THEN** sus snapshots finales son iguales campo a campo, incluidos el estado, el resultado, el tick en que
  terminan y las bajas

#### Scenario: Resultado reproducible
- **GIVEN** dos partidas con el contenido por defecto y la semilla 42, input (0, 0) y la política de elección fija
- **WHEN** ambas ejecutan ticks hasta que terminan o hasta el tick 36.000
- **THEN** ambas terminan con el mismo resultado, en el mismo tick y con las mismas bajas

#### Scenario: Victoria reproducible
- **GIVEN** dos partidas con el contenido por defecto salvo una vida máxima del jugador suficiente para no llegar a
  0 en 36.000 ticks, semilla 7, la misma secuencia de inputs y la política de elección fija
- **WHEN** ambas ejecutan 36.000 ticks
- **THEN** ambas terminan con victoria en el tick 36.000 con el mismo número de bajas y snapshots finales iguales
  campo a campo

#### Scenario: La colisión no consume azar
- **GIVEN** dos partidas con la semilla 7 y el mismo estado salvo que en una el jugador está tangente a un tronco y
  recibe un input que lo empuja contra él, y en la otra está en hierba libre con el mismo input
- **WHEN** ambas ejecutan el mismo tick sin oferta de mejora
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick

#### Scenario: Snapshot no mutable desde fuera
- **GIVEN** una partida en el tick 10 con ≥ 1 enemigo vivo, ≥ 1 proyectil vivo y ≥ 1 gema, otra con una oferta
  abierta y otra terminada
- **WHEN** el adaptador modifica el objeto `RunSnapshot` que ha recibido, incluidas la posición de un enemigo,
  la lista de enemigos, la vida del jugador, su invulnerabilidad, el estado de la partida, el resultado, las bajas,
  la duración objetivo, la posición de un proyectil, la lista de proyectiles, la posición de una gema, la lista de
  gemas, la XP, el nivel y las opciones de la oferta
- **THEN** el siguiente tick (o la siguiente elección, o el siguiente snapshot leído) parte del estado interno, no
  del objeto modificado
