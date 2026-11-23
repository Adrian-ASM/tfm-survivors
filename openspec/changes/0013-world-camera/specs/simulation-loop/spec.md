# Spec delta · simulation-loop

<!-- Ruta: openspec/changes/0013-world-camera/specs/simulation-loop/spec.md
     Solo cambia el escenario "200 enemigos encima del jugador": con un mundo mayor que la vista, colocar los enemigos
     en un punto fijo deja de garantizar el contacto. El umbral de 2 ms no cambia.
     Además, en "Determinismo" solo cambia el plazo de "Partida con progresión reproducible": 3.600 → 4.800 ticks,
     el mismo que "Primera subida en el núcleo" (`upgrades`). Decisión del usuario en apply (2026-11-23), sin tocar el
     contenido: en el mundo de 1.920 × 1.080 los enemigos nacen más lejos y sin recorte contra paredes; primera
     oferta medida con la semilla 7 en el tick 4.346. -->

## MODIFIED Requirements

### Requirement: Rendimiento con el tope de enemigos
El sistema SHALL ejecutar un tick de simulación con 200 enemigos vivos, la detección de contacto activa, las armas
activas y las gemas activas en ≤ 2 ms de media, medido con un benchmark de Vitest sobre el núcleo, sin motor ni
render. La partida medida MUST estar en curso en todos los ticks medidos, de modo que se midan los pasos completos
del tick: si se abre una oferta, el benchmark elige la opción 0 antes del siguiente tick y esa elección cuenta en
el tiempo medido. El camino caliente del tick MUST NOT crear objetos nuevos por tick para gemas (reserva de
`maxGems`). Los escenarios que piden enemigos "en contacto" MUST colocarlos respecto a la posición del jugador, de
modo que el contacto se mantenga sea cual sea el tamaño del mundo.

#### Scenario: Tope de vivos alcanzado
- **GIVEN** una partida con el contenido por defecto, semilla fija, exactamente 200 enemigos vivos y una
  vida del jugador suficiente para no llegar a 0 en 600 ticks
- **WHEN** el benchmark mide 600 ticks consecutivos con input (1, 0)
- **THEN** la media es ≤ 2 ms por tick

#### Scenario: 200 enemigos encima del jugador
- **GIVEN** una partida con semilla fija, 200 enemigos vivos en contacto con el jugador y una vida del jugador
  suficiente para no llegar a 0 en 600 ticks
- **WHEN** el benchmark mide 600 ticks consecutivos
- **THEN** la media es ≤ 2 ms por tick y la partida sigue en curso al terminar la medición
- **AND** en cada tick medido hay ≥ 1 enemigo en contacto con el jugador

#### Scenario: Contacto con cualquier tamaño de mundo
- **GIVEN** la preparación del escenario "200 enemigos encima del jugador", una vez con el mundo por defecto
  (1.920 × 1.080) y otra con una arena explícita de 4.000 × 4.000
- **WHEN** se ejecutan 600 ticks en cada una
- **THEN** en ambas, en cada tick, hay ≥ 1 enemigo en contacto con el jugador

#### Scenario: Peor caso con proyectiles
- **GIVEN** una partida con semilla fija, 200 enemigos vivos, `maxProjectiles` (32) proyectiles vivos en todos los
  ticks medidos y una vida del jugador suficiente para no llegar a 0 en 600 ticks
- **WHEN** el benchmark mide 600 ticks consecutivos
- **THEN** la media es ≤ 2 ms por tick

#### Scenario: Peor caso con gemas
- **GIVEN** una partida con semilla fija, 200 enemigos vivos, `maxProjectiles` (32) proyectiles vivos y `maxGems`
  (300) gemas atraídas, todas a ≥ 400 px del jugador para que ninguna se recoja durante la medición, y una vida del
  jugador suficiente para no llegar a 0
- **WHEN** el benchmark mide 60 ticks consecutivos (60 × 6 px = 360 px < 400)
- **THEN** la media es ≤ 2 ms por tick

### Requirement: Determinismo
El sistema SHALL producir exactamente el mismo `RunSnapshot`, enemigos, vida, invulnerabilidad, estado de la
partida, resultado, bajas, proyectiles, pulsos, indicación de daño, gemas, XP, nivel, ofertas y mejoras adquiridas
incluidos, a partir del mismo estado inicial, la misma semilla, la misma secuencia de inputs por tick y la misma
secuencia de elecciones de mejora (índice elegido en cada oferta). En particular, el resultado de la partida, el tick
en que termina y las bajas MUST ser los mismos. El núcleo MUST NOT depender de reloj del sistema, aleatoriedad
global ni APIs del navegador: toda la aleatoriedad MUST venir del puerto `RandomGenerator` inicializado con la
semilla de la partida. Las armas (selección de objetivo, disparo, proyectiles y pulsos), las bajas y su contador, las
gemas (suelta, imán y recogida), la XP y la comprobación de victoria y derrota MUST NOT consumir azar; la apertura de
ofertas de mejora sí lo consume.

#### Scenario: Dos partidas idénticas
- **GIVEN** dos partidas creadas con el mismo contenido y la semilla 42
- **WHEN** ambas reciben la misma secuencia de 600 inputs (10 s) generada por una seed fija, con la política de
  elección fija
- **THEN** sus snapshots son iguales campo a campo en cada tick, enemigos, vida, invulnerabilidad, estado,
  resultado, bajas, proyectiles, pulsos, gemas, XP, nivel y ofertas incluidos (comparación estricta, sin tolerancia)

#### Scenario: Semillas distintas
- **GIVEN** dos partidas creadas con el mismo contenido y las semillas 1 y 2
- **WHEN** ambas reciben la misma secuencia de 600 inputs
- **THEN** la posición de aparición de al menos 1 enemigo difiere entre las dos partidas

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
- **WHEN** ambas ejecutan 3.600 ticks y en ese tiempo ≥ 1 enemigo queda dado de baja por armas
- **THEN** sus snapshots son iguales campo a campo en cada tick, incluidos proyectiles, pulsos, vida de los enemigos,
  indicación de daño reciente y bajas

#### Scenario: Partida con progresión reproducible
- **GIVEN** dos partidas con el contenido por defecto (mundo de 1.920 × 1.080) y la semilla 7, con input (0, 0) y la
  política de elección fija
- **WHEN** ambas ejecutan 4.800 ticks y en ese tiempo se recoge ≥ 1 gema y se abre ≥ 1 oferta (mismo plazo que
  "Primera subida en el núcleo"; medido en apply de 0013: primera oferta en el tick 4.346)
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

#### Scenario: Snapshot no mutable desde fuera
- **GIVEN** una partida en el tick 10 con ≥ 1 enemigo vivo, ≥ 1 proyectil vivo y ≥ 1 gema, otra con una oferta
  abierta y otra terminada
- **WHEN** el adaptador modifica el objeto `RunSnapshot` que ha recibido, incluidas la posición de un enemigo,
  la lista de enemigos, la vida del jugador, su invulnerabilidad, el estado de la partida, el resultado, las bajas,
  la duración objetivo, la posición de un proyectil, la lista de proyectiles, la posición de una gema, la lista de
  gemas, la XP, el nivel y las opciones de la oferta
- **THEN** el siguiente tick (o la siguiente elección, o el siguiente snapshot leído) parte del estado interno, no
  del objeto modificado
