# Spec delta · simulation-loop

<!-- Change 0019-flow-field. La persecución usa el campo de distancias de la celda del jugador tras moverse; la
     navegación y la recolocación de apariciones no consumen azar; el presupuesto de rendimiento pasa a 300 enemigos
     vivos (tope por defecto) y mide también el cálculo del campo. -->

## MODIFIED Requirements

### Requirement: Determinismo
El sistema SHALL producir exactamente el mismo `RunSnapshot`, enemigos, vida, invulnerabilidad, estado de la
partida, resultado, bajas, proyectiles, pulsos, indicación de daño, gemas, XP, nivel, ofertas y mejoras adquiridas
incluidos, y el mismo mapa, a partir del mismo estado inicial, la misma semilla, la misma secuencia de inputs por tick
y la misma secuencia de elecciones de mejora (índice elegido en cada oferta). En particular, el resultado de la
partida, el tick en que termina, las bajas y la posición de cada enemigo en cada tick MUST ser los mismos. El núcleo
MUST NOT depender de reloj del sistema, aleatoriedad global ni APIs del navegador: toda la aleatoriedad MUST venir de
instancias del puerto `RandomGenerator` inicializadas a partir de la semilla de la partida: una para generar el mapa y
otra para el resto de la partida (ver "Azar del mapa independiente del de la partida" en `procedural-map`). Las armas
(selección de objetivo, disparo, proyectiles y pulsos), las bajas y su contador, las gemas (suelta, recolocación, imán
y recogida), la colisión del jugador con el mapa, la persecución de los enemigos (línea libre, campo de distancias y
navegación), la recolocación de las apariciones, la XP y la comprobación de victoria y derrota MUST NOT consumir azar;
la apertura de ofertas de mejora sí lo consume, y cada intento de posición de aparición consume exactamente 1 valor
(ver `enemy-spawning`).

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
- **WHEN** ambas ejecutan 4.800 ticks y en ese tiempo el jugador recibe ≥ 1 golpe (plazo a revalidar en apply de
  0019)
- **THEN** sus snapshots son iguales campo a campo en cada tick, incluidos la vida, la invulnerabilidad, el
  estado, el resultado y, si la hay, el tick en que la partida termina

#### Scenario: Partida con armas reproducible
- **GIVEN** dos partidas con el contenido por defecto y la semilla 7, con input (0, 0) en todos los ticks y la
  política de elección fija
- **WHEN** ambas ejecutan 4.800 ticks y en ese tiempo ≥ 1 enemigo queda dado de baja por armas y se emite ≥ 1
  pulso (plazo a revalidar en apply de 0019)
- **THEN** sus snapshots son iguales campo a campo en cada tick, incluidos proyectiles, pulsos, vida de los enemigos,
  indicación de daño reciente y bajas

#### Scenario: Partida con progresión reproducible
- **GIVEN** dos partidas con el contenido por defecto (mundo de 3.840 × 2.160) y la semilla 7, con input (0, 0) y la
  política de elección fija
- **WHEN** ambas ejecutan 4.800 ticks y en ese tiempo se recoge ≥ 1 gema y se abre ≥ 1 oferta (mismo plazo que
  "Primera subida en el núcleo"; a revalidar en apply de 0019)
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

#### Scenario: La persecución por el mapa no consume azar
- **GIVEN** dos partidas con la semilla 7, el mismo estado y el mismo director, una con 300 enemigos vivos navegando
  por el campo de un mapa con río y troncos y otra con los mismos 300 enemigos en el mapa vacío
- **WHEN** ambas ejecutan el mismo tick sin oferta de mejora ni aparición
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick

#### Scenario: Posiciones de enemigos reproducibles con el mapa generado
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42 con su mapa generado, la misma secuencia de
  3.600 inputs generada por una seed fija y la política de elección fija
- **WHEN** ambas ejecutan 3.600 ticks
- **THEN** en cada tick la lista de enemigos (identificador, tipo, posición y vida) es igual en las dos, sin
  tolerancia

#### Scenario: Snapshot no mutable desde fuera
- **GIVEN** una partida en el tick 10 con ≥ 1 enemigo vivo, ≥ 1 proyectil vivo y ≥ 1 gema, otra con una oferta
  abierta y otra terminada
- **WHEN** el adaptador modifica el objeto `RunSnapshot` que ha recibido, incluidas la posición de un enemigo,
  la lista de enemigos, la vida del jugador, su invulnerabilidad, el estado de la partida, el resultado, las bajas,
  la duración objetivo, la posición de un proyectil, la lista de proyectiles, la posición de una gema, la lista de
  gemas, la XP, el nivel y las opciones de la oferta
- **THEN** el siguiente tick (o la siguiente elección, o el siguiente snapshot leído) parte del estado interno, no
  del objeto modificado

### Requirement: Rendimiento con el tope de enemigos
El sistema SHALL ejecutar un tick de simulación con **300** enemigos vivos (el `maxAlive` por defecto), la persecución
por el mapa generado activa (línea libre y campo de distancias), la detección de contacto activa, las armas activas y
las gemas activas en ≤ 2 ms de media, medido con un benchmark de Vitest sobre el núcleo, sin motor ni render. El
cálculo completo del campo de distancias de una celda con el mapa por defecto MUST tardar ≤ 0,1 ms de media en el mismo
benchmark. Ambas medidas son informativas (dependen de la máquina): no bloquean `verify` ni CI. La partida medida MUST
estar en curso en todos los ticks medidos, de modo que se midan los pasos completos del tick: si se abre una oferta, el
benchmark elige la opción 0 antes del siguiente tick y esa elección cuenta en el tiempo medido. El camino caliente del
tick MUST NOT crear objetos nuevos por tick para gemas (reserva de `maxGems`). Los escenarios que piden enemigos "en
contacto" MUST colocarlos respecto a la posición del jugador, de modo que el contacto se mantenga sea cual sea el
tamaño del mundo.

#### Scenario: Tope de vivos alcanzado
- **GIVEN** una partida con el contenido por defecto, semilla fija con su mapa generado, exactamente 300 enemigos vivos
  y una vida del jugador suficiente para no llegar a 0 en 600 ticks
- **WHEN** el benchmark mide 600 ticks consecutivos con input (1, 0)
- **THEN** la media es ≤ 2 ms por tick

#### Scenario: 300 enemigos encima del jugador
- **GIVEN** una partida con semilla fija, 300 enemigos vivos en contacto con el jugador y una vida del jugador
  suficiente para no llegar a 0 en 600 ticks
- **WHEN** el benchmark mide 600 ticks consecutivos
- **THEN** la media es ≤ 2 ms por tick y la partida sigue en curso al terminar la medición
- **AND** en cada tick medido hay ≥ 1 enemigo en contacto con el jugador

#### Scenario: Contacto con cualquier tamaño de mundo
- **GIVEN** la preparación del escenario "300 enemigos encima del jugador", una vez con el mundo por defecto
  (3.840 × 2.160) y otra con una arena explícita de 4.000 × 4.000
- **WHEN** se ejecutan 600 ticks en cada una
- **THEN** en ambas, en cada tick, hay ≥ 1 enemigo en contacto con el jugador

#### Scenario: Peor caso con proyectiles
- **GIVEN** una partida con semilla fija, 300 enemigos vivos, `maxProjectiles` (32) proyectiles vivos en todos los
  ticks medidos y una vida del jugador suficiente para no llegar a 0 en 600 ticks
- **WHEN** el benchmark mide 600 ticks consecutivos
- **THEN** la media es ≤ 2 ms por tick

#### Scenario: Peor caso con gemas
- **GIVEN** una partida con semilla fija, 300 enemigos vivos, `maxProjectiles` (32) proyectiles vivos y `maxGems`
  (300) gemas atraídas, todas a ≥ 400 px del jugador para que ninguna se recoja durante la medición, y una vida del
  jugador suficiente para no llegar a 0
- **WHEN** el benchmark mide 60 ticks consecutivos (60 × 6 px = 360 px < 400)
- **THEN** la media es ≤ 2 ms por tick

#### Scenario: 300 enemigos sin línea libre
- **GIVEN** una partida con el contenido por defecto y un mapa generado, el jugador quieto al otro lado del río
  respecto a 300 enemigos vivos repartidos por el mundo, de modo que ≥ 150 de ellos no tienen línea libre en cada
  tick medido, y una vida del jugador suficiente para no llegar a 0 en 600 ticks
- **WHEN** el benchmark mide 600 ticks consecutivos
- **THEN** la media es ≤ 2 ms por tick

#### Scenario: Cálculo del campo
- **GIVEN** el contenido por defecto y los mapas generados de las semillas 1 a 50
- **WHEN** el benchmark calcula en cada mapa el campo de distancias hacia la celda de la salida y hacia la celda (0, 0)
- **THEN** la media es ≤ 0,1 ms por cálculo

#### Scenario: Jugador que cambia de celda en cada tick
- **GIVEN** una partida con el contenido por defecto, semilla fija con su mapa generado, 300 enemigos vivos y un
  jugador cuyo centro cambia de celda en cada tick medido (colocado por el escenario, no por el input)
- **WHEN** el benchmark mide 600 ticks consecutivos
- **THEN** la media es ≤ 2 ms por tick

### Requirement: Orden de los pasos del tick
El sistema SHALL ejecutar cada tick de una partida en curso en este orden:
1. movimiento del jugador según el input (velocidad efectiva, ver `upgrades`);
2. persecución de los enemigos vivos hacia la nueva posición del jugador, con el campo de distancias de la celda que
   ocupa el centro del jugador tras el paso 1 (ver "Navegación por el campo de flujo" en `enemy-behavior`);
3. armas (ver `auto-weapons`), en este orden:
   1. movimiento, impacto y caducidad de los proyectiles existentes, en orden de creación;
   2. cada arma, en el orden de `content/weapons.json`, elige objetivo con las posiciones de ese momento y, si está
      cargada y lo tiene, dispara (crea su proyectil o aplica su pulso);
   3. los enemigos cuya vida ha llegado a 0 en este tick quedan dados de baja, suman cada uno 1 al contador de bajas
      y sueltan su gema, en el orden de la lista de enemigos (ver `xp-gems` y `run-outcome`);
4. contacto y daño al jugador (ver `player-health`), solo con enemigos vivos; si la vida llega a 0, la partida
   termina con derrota y el tick acaba aquí;
5. si el número de este tick es igual a la duración objetivo en ticks, la partida termina con victoria y el tick
   acaba aquí (ver `run-outcome`);
6. gemas, en orden de creación: atracción, movimiento del imán y recogida; la XP recogida se suma y se registran
   las subidas de nivel (ver `xp-gems` y `leveling`);
7. director de oleadas (spawns, con la recolocación de las apariciones en celdas caminables, ver `enemy-spawning`);
8. si hay ≥ 1 subida pendiente y ≥ 1 mejora disponible, se abre la oferta (consume azar) y la partida pasa a
   eligiendo mejora (ver `upgrades` y `run-state`); el tick cuenta igualmente.

En una partida terminada o que está eligiendo mejora no se ejecuta ningún paso (ver `run-state`).

#### Scenario: El contacto usa las posiciones tras moverse ambos
- **GIVEN** un jugador en (480, 270) con radio 16, velocidad 200, vida 100 e input (1, 0), y un enemigo con
  radio 10, velocidad 60, vida suficiente para no morir en este tick y damage 10 en (510, 270) (distancia inicial
  30 > 26)
- **WHEN** se ejecuta 1 tick (jugador en 483,333; enemigo en 509; distancia 25,667 < 26)
- **THEN** la vida del jugador vale 90

#### Scenario: Solo el movimiento del jugador no basta
- **GIVEN** un jugador en (480, 270) con radio 16, velocidad 200, vida 100 e input (1, 0), y un enemigo con
  radio 10, velocidad 60, vida suficiente para no morir en este tick y damage 10 en (512, 270)
- **WHEN** se ejecuta 1 tick (jugador en 483,333; enemigo en 511; distancia 27,667 > 26)
- **THEN** la vida del jugador sigue valiendo 100

#### Scenario: La persecución usa la celda del jugador ya movido
- **GIVEN** un mapa de hierba con troncos en las celdas (10, 2) a (10, 6), un jugador en (958, 270) (celda (15, 4)) con
  velocidad 200 e input (1, 0), que tras moverse queda en (961,333; 270) (celda (16, 4)), y un enemigo con velocidad 60
  en (330, 270) sin línea libre
- **WHEN** se ejecuta 1 tick
- **THEN** el enemigo queda exactamente en la misma posición que en una partida igual con el jugador quieto en
  (961,333; 270) desde el principio e input (0, 0)

#### Scenario: Un enemigo recién aparecido no golpea en su tick de aparición
- **GIVEN** el contenido de spawn por defecto (`minDistance` 200) y un jugador quieto
- **WHEN** aparece un enemigo en el tick n
- **THEN** la vida del jugador tras el tick n es la misma que tras el tick n − 1, si ningún otro enemigo le toca

#### Scenario: Un enemigo recién aparecido no es objetivo en su tick de aparición
- **GIVEN** una partida sin enemigos vivos y armas cargadas, en la que el director hace aparecer un enemigo en el
  tick n
- **WHEN** se ejecuta el tick n
- **THEN** el snapshot del tick n no tiene proyectiles ni pulsos nuevos y el enemigo tiene su vida inicial

#### Scenario: Las armas apuntan tras la persecución
- **GIVEN** un jugador quieto en (480, 270), Tests cargado y un `goblin-torch` de radio 10 y velocidad 90 que, al
  empezar el tick, está a distancia 101 (tras la persecución, a 99,5)
- **WHEN** se ejecuta 1 tick
- **THEN** Tests dispara un pulso en ese tick y el `goblin-torch` queda con vida 6

#### Scenario: Una baja libera el hueco antes del director
- **GIVEN** `maxAlive` 1, un único `goblin-torch` vivo con vida 4 y un director con presupuesto para 1 `goblin-torch` y
  `goblin-torch` como tipo pendiente
- **WHEN** en el tick n el `goblin-torch` muere por un impacto del Linter
- **THEN** el snapshot del tick n tiene exactamente 1 enemigo vivo, distinto del muerto

#### Scenario: El imán usa la posición del jugador ya movido
- **GIVEN** un jugador en (480, 270) con velocidad 200 e input (1, 0) y una gema en (546, 270) (distancia 66 > 64
  antes de moverse)
- **WHEN** se ejecuta 1 tick (jugador en 483,333; distancia 62,667 ≤ 64)
- **THEN** la gema está atraída y a 56,667 px del jugador (error ≤ 0,001)

#### Scenario: El director actúa antes de abrir la oferta
- **GIVEN** una partida en nivel 1 con XP 4, una gema de valor 1 que se recoge en el tick n y un director con
  presupuesto para 1 `goblin-torch` en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el snapshot del tick n contiene el `goblin-torch` nuevo y la oferta abierta, con la partida eligiendo mejora

#### Scenario: El tick de la victoria acaba tras el contacto
- **GIVEN** una partida con duración objetivo de 120 ticks, el jugador vivo y no invulnerable, un enemigo con damage
  10 en contacto en el tick 120, una gema que se recogería en el tick 120 y un director con presupuesto para 1
  `goblin-torch` en el tick 120
- **WHEN** se ejecuta el tick 120
- **THEN** la vida del jugador ha bajado 10 y sigue > 0, y la partida está terminada con victoria
- **AND** la gema sigue en el snapshot, la XP no cambia y no aparece ningún enemigo nuevo en el tick 120

#### Scenario: Las armas actúan en el tick de la victoria
- **GIVEN** una partida con duración objetivo de 120 ticks y Tests cargado con un `goblin-torch` de vida 4 en su radio
  en el tick 120
- **WHEN** se ejecuta el tick 120
- **THEN** el `goblin-torch` queda dado de baja, su gema está en el snapshot del tick 120 y las bajas suben en 1

<!-- historial: 0019-flow-field (pendiente de archivar) -->
