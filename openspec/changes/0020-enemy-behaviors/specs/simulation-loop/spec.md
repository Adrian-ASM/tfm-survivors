# Spec delta · simulation-loop

<!-- Change 0020-enemy-behaviors. Nuevo paso de peligros en el tick, estado de comportamiento por enemigo y peligros
     (dinamitas, avisos, explosiones) en el snapshot, determinismo y coste. -->

## ADDED Requirements

<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Determinismo
El sistema SHALL producir exactamente el mismo `RunSnapshot`, enemigos (estado de comportamiento incluido), vida,
invulnerabilidad, estado de la partida, resultado, bajas, proyectiles, pulsos, dinamitas, avisos, explosiones,
indicación de daño, gemas, XP, nivel, ofertas y mejoras adquiridas incluidos, y el mismo mapa, a partir del mismo
estado inicial, la misma semilla, la misma secuencia de inputs por tick y la misma secuencia de elecciones de mejora
(índice elegido en cada oferta). En particular, el resultado de la partida, el tick en que termina, las bajas y la
posición de cada enemigo en cada tick MUST ser los mismos. El núcleo MUST NOT depender de reloj del sistema,
aleatoriedad global ni APIs del navegador: toda la aleatoriedad MUST venir de instancias del puerto `RandomGenerator`
inicializadas a partir de la semilla de la partida: una para generar el mapa y otra para el resto de la partida (ver
"Azar del mapa independiente del de la partida" en `procedural-map`). Las armas (selección de objetivo, disparo,
proyectiles y pulsos), las bajas y su contador, las gemas (suelta, recolocación, imán y recogida), la colisión del
jugador con el mapa, la persecución de los enemigos (línea libre, campo de distancias y navegación), los estados de
comportamiento y sus transiciones, los lanzamientos, las dinamitas, los avisos y las explosiones, la recolocación de
las apariciones, la XP y la comprobación de victoria y derrota MUST NOT consumir azar; la apertura de ofertas de
mejora sí lo consume, y cada intento de posición de aparición consume exactamente 1 valor (ver `enemy-spawning`). Los
comportamientos y los peligros MUST NOT cambiar el mapa generado por ninguna semilla.

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
- **WHEN** ambas ejecutan 4.800 ticks y en ese tiempo el jugador recibe ≥ 1 golpe
- **THEN** sus snapshots son iguales campo a campo en cada tick, incluidos la vida, la invulnerabilidad, el
  estado, el resultado y, si la hay, el tick en que la partida termina

#### Scenario: Partida con armas reproducible
- **GIVEN** dos partidas con el contenido por defecto y la semilla 7, con input (0, 0) en todos los ticks y la
  política de elección fija
- **WHEN** ambas ejecutan 4.800 ticks y en ese tiempo ≥ 1 enemigo queda dado de baja por armas y se emite ≥ 1
  pulso
- **THEN** sus snapshots son iguales campo a campo en cada tick, incluidos proyectiles, pulsos, vida de los enemigos,
  indicación de daño reciente y bajas

#### Scenario: Partida con progresión reproducible
- **GIVEN** dos partidas con el contenido por defecto (mundo de 3.840 × 2.160) y la semilla 7, con input (0, 0) y la
  política de elección fija
- **WHEN** ambas ejecutan 4.800 ticks y en ese tiempo se recoge ≥ 1 gema y se abre ≥ 1 oferta (mismo plazo que
  "Primera subida en el núcleo")
- **THEN** sus snapshots son iguales campo a campo en cada tick, incluidas gemas, XP, nivel, ofertas y mejoras
  adquiridas

#### Scenario: Partida con peligros reproducible
- **GIVEN** dos partidas con el contenido por defecto, una semilla de 1..50 con su mapa generado, un input
  aleatorio generado por una seed fija y la política de elección fija, y una vida máxima del jugador suficiente para
  no llegar a 0 en 14.400 ticks
- **WHEN** ambas ejecutan 14.400 ticks y en ese tiempo ≥ 1 barril explota y ≥ 1 `goblin-tnt` lanza una dinamita
- **THEN** sus snapshots son iguales campo a campo en cada tick, incluidos los estados de comportamiento, las
  dinamitas, los avisos, las explosiones, las bajas y las gemas

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

#### Scenario: Los comportamientos no consumen azar
- **GIVEN** dos partidas con la semilla 7 y el mismo estado salvo que en una 10 enemigos cambian de estado en el tick
  n (entran en mecha, en carga o vuelven a persecución) y en la otra siguen en persecución
- **WHEN** ambas ejecutan el tick n sin oferta de mejora ni aparición
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick

#### Scenario: Mapa intacto
- **GIVEN** el contenido por defecto tras el change
- **WHEN** se generan los mapas de las semillas de la firma dorada de `tests/support/mapGolden.ts`
- **THEN** su firma es igual a la firma dorada de antes del change

#### Scenario: Posiciones de enemigos reproducibles con el mapa generado
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42 con su mapa generado, la misma secuencia de
  3.600 inputs generada por una seed fija y la política de elección fija
- **WHEN** ambas ejecutan 3.600 ticks
- **THEN** en cada tick la lista de enemigos (identificador, tipo, posición, vida y estado de comportamiento) es igual
  en las dos, sin tolerancia

#### Scenario: Snapshot no mutable desde fuera
- **GIVEN** una partida en el tick 10 con ≥ 1 enemigo vivo, ≥ 1 proyectil vivo y ≥ 1 gema, otra con ≥ 1 dinamita,
  ≥ 1 aviso y ≥ 1 explosión, otra con una oferta abierta y otra terminada
- **WHEN** el adaptador modifica el objeto `RunSnapshot` que ha recibido, incluidas la posición de un enemigo, su
  estado de comportamiento, la lista de enemigos, la vida del jugador, su invulnerabilidad, el estado de la partida,
  el resultado, las bajas, la duración objetivo, la posición de un proyectil, la lista de proyectiles, la posición de
  una gema, la lista de gemas, la posición y el objetivo de una dinamita, el centro y el radio de un aviso, la lista
  de explosiones, la XP, el nivel y las opciones de la oferta
- **THEN** el siguiente tick (o la siguiente elección, o el siguiente snapshot leído) parte del estado interno, no
  del objeto modificado

### Requirement: Snapshot para el motor
El sistema SHALL exponer tras cada frame un `RunSnapshot` con lo único que el adaptador de render necesita para
pintar:
- el número de tick;
- la duración objetivo de la partida, de forma que la vista pueda calcular el tiempo restante sin leer el contenido
  (ver `run-outcome` y `hud`);
- la posición y el radio del jugador;
- la vida actual y la vida máxima (efectiva) del jugador;
- si el jugador está invulnerable (ver `player-health`);
- el estado de la partida: en curso, eligiendo mejora o terminada (ver `run-state`);
- el resultado de la partida: vacío, victoria o derrota (ver `run-outcome`);
- las bajas de la partida (ver `run-outcome`);
- la lista de enemigos vivos;
- la lista de proyectiles vivos (ver `auto-weapons`);
- la lista de pulsos visibles (ver `auto-weapons`);
- la lista de dinamitas en vuelo, la de avisos y la de explosiones visibles (ver `enemy-hazards`);
- la lista de armas equipadas, en el orden de `content/weapons.json`, con su identificador y si está cargada;
- la lista de gemas en el suelo (ver `xp-gems`);
- el nivel, la XP actual y la XP para el siguiente nivel (ver `leveling`);
- la oferta de mejoras abierta, si la hay, con sus opciones en orden: id, nombre, descripción, nivel actual y nivel
  siguiente (ver `upgrades`);
- los niveles de las mejoras adquiridas (nivel ≥ 1), en el orden del catálogo, con su id.

Cada enemigo del snapshot MUST incluir:
- un identificador único dentro de la partida, que no cambia mientras vive y no se reutiliza tras su baja;
- su tipo;
- su posición;
- su radio;
- su vida actual (> 0, ya que solo se listan enemigos vivos);
- si ha recibido daño recientemente (ver `auto-weapons`);
- su estado de comportamiento: el nombre del estado y su clase (persecución, mecha, carga o espera; ver
  `enemy-behavior`).

Cada proyectil del snapshot MUST incluir un identificador único dentro de la partida que no se reutiliza, su
posición y su radio. Cada pulso visible MUST incluir el identificador del arma que lo disparó, el tick en que se
disparó, su centro y su radio. Cada gema MUST incluir un identificador único dentro de la partida que no se
reutiliza, su posición y su radio. Cada dinamita MUST incluir su identificador, su posición, su objetivo, su radio
visual y el tick en que explotará; cada aviso, su centro, su radio, su origen (mecha o dinamita) y el tick en que
explotará; cada explosión, su identificador, su centro, su radio y el tick en que ocurrió (ver `enemy-hazards`).

La lista de enemigos contiene solo enemigos vivos y va ordenada por orden de aparición. Una baja MUST quitar al
enemigo de la lista sin cambiar el orden relativo de los demás. La lista de proyectiles va ordenada por orden de
creación y una desaparición no cambia el orden relativo de los demás. La lista de gemas va ordenada por orden de
creación y una recogida no cambia el orden relativo de las demás. Las listas de dinamitas y de explosiones van
ordenadas por orden de creación y la de avisos con el orden de "Aviso en el suelo" (`enemy-hazards`).

#### Scenario: Contador de ticks
- **GIVEN** una partida recién creada
- **WHEN** se ejecutan 90 ticks
- **THEN** `snapshot.tick` vale 90

#### Scenario: Partida recién creada
- **GIVEN** una partida recién creada con vida máxima 100
- **WHEN** se lee el snapshot antes del primer tick
- **THEN** las listas de enemigos, proyectiles, pulsos, dinamitas, avisos, explosiones, gemas y mejoras adquiridas
  están vacías y no hay oferta
- **AND** la vida actual y la máxima valen 100, el jugador no está invulnerable y el estado es en curso
- **AND** el resultado está vacío y las bajas valen 0
- **AND** el nivel vale 1, la XP actual 0 y la XP para el siguiente nivel 5
- **AND** con el contenido por defecto, la lista de armas es `linter` y `tests`, en ese orden, ambas cargadas, y la
  duración objetivo equivale a 36.000 ticks

#### Scenario: Duración objetivo constante
- **GIVEN** una partida con `durationSeconds` 90
- **WHEN** se leen los snapshots de los ticks 0, 1 y 2.000 y el de una oferta abierta
- **THEN** en todos ellos la duración objetivo equivale a 5.400 ticks

#### Scenario: Carga de las armas en el snapshot
- **GIVEN** una partida con el contenido por defecto en la que hay un enemigo vivo a 50 px del jugador en el tick 1
  y ningún enemigo vivo en los ticks 2 a 100, y en la que no se abre ninguna oferta
- **WHEN** se ejecutan 100 ticks
- **THEN** en los snapshots de los ticks 1 a 30 `linter` figura como no cargada, y de 31 a 100 como cargada
- **AND** en los snapshots de los ticks 1 a 90 `tests` figura como no cargada, y de 91 a 100 como cargada

#### Scenario: Pulso identificado en el snapshot
- **GIVEN** un pulso de `tests` disparado en el tick 40 con el jugador en (480, 270)
- **WHEN** se lee el snapshot del tick 43
- **THEN** el pulso figura con arma `tests`, tick de disparo 40, centro (480, 270) y radio 90

#### Scenario: Enemigos en el snapshot
- **GIVEN** un único tramo con `budgetPerSecond` 1 y `types: ["goblin-torch"]`, `goblin-torch` con coste 1 y radio 10, en
  una partida sin armas equipadas
- **WHEN** se ejecutan 615 ticks
- **THEN** el snapshot lista 10 enemigos de tipo `goblin-torch` con radio 10 e identificadores distintos
- **AND** cada uno tiene una vida actual igual al `health` de `goblin-torch`, no indica daño reciente y está en su
  estado de persecución
- **AND** el orden de la lista coincide con el orden de aparición

#### Scenario: Estado de comportamiento en el snapshot
- **GIVEN** un `goblin-barrel` en mecha y un `goblin-tnt` en espera
- **WHEN** se lee el snapshot
- **THEN** el barril figura con el nombre de su estado de mecha y la clase mecha, y el TNT con el nombre de su estado
  de espera y la clase espera

#### Scenario: Peligros en el snapshot
- **GIVEN** una dinamita d1 lanzada en el tick 154 con origen (1.199,5; 1.000), objetivo (1.000, 1.000), vuelo de 40
  ticks y radio de explosión 48, y un barril en mecha que explotará en el tick 160 en (500, 500) con radio 56
- **WHEN** se lee el snapshot del tick 155
- **THEN** hay 1 dinamita con identificador d1, objetivo (1.000, 1.000) y tick de explosión 194
- **AND** hay 2 avisos en este orden: el de mecha centrado en (500, 500), radio 56, tick 160, y el de dinamita
  centrado en (1.000, 1.000), radio 48, tick 194
- **AND** la lista de explosiones está vacía

#### Scenario: Identificador estable
- **GIVEN** un enemigo vivo con identificador X en el snapshot del tick n
- **WHEN** se ejecuta 1 tick más sin que X se dé de baja
- **THEN** el snapshot del tick n + 1 contiene un enemigo con identificador X, del mismo tipo y radio

#### Scenario: Bajas sin reordenar
- **GIVEN** un snapshot con 10 enemigos vivos cuyos identificadores, en orden de aparición, son a1 … a10
- **WHEN** a3 y a7 quedan dados de baja y se ejecuta 1 tick sin nuevos spawns
- **THEN** la lista del snapshot es exactamente a1, a2, a4, a5, a6, a8, a9, a10, en ese orden
- **AND** las bajas del snapshot han subido en 2

#### Scenario: Reposición al final de la lista
- **GIVEN** la partida del escenario anterior
- **WHEN** aparecen 2 enemigos nuevos b1 y b2, en ese orden
- **THEN** la lista del snapshot es a1, a2, a4, a5, a6, a8, a9, a10, b1, b2

#### Scenario: Baja del primero y del último
- **GIVEN** un snapshot con 200 enemigos vivos a1 … a200
- **WHEN** a1 y a200 quedan dados de baja y se ejecuta 1 tick sin nuevos spawns
- **THEN** la lista del snapshot es a2 … a199, en ese orden

#### Scenario: Proyectiles en el snapshot
- **GIVEN** tres proyectiles p1, p2 y p3 creados en ese orden y vivos
- **WHEN** p2 desaparece por impacto y se crea p4
- **THEN** la lista de proyectiles del snapshot es p1, p3, p4, cada uno con su posición y radio 4

#### Scenario: Gemas en el snapshot
- **GIVEN** tres gemas g1, g2 y g3 creadas en ese orden en el suelo
- **WHEN** g2 se recoge y se crea g4
- **THEN** la lista de gemas del snapshot es g1, g3, g4, cada una con su posición y radio 5

#### Scenario: Oferta en el snapshot
- **GIVEN** una partida en la que `guardrail` está en nivel 2 y se abre una oferta que la incluye
- **WHEN** se lee el snapshot
- **THEN** la opción de `guardrail` tiene su nombre y descripción del contenido, nivel actual 2 y siguiente 3
- **AND** la lista de mejoras adquiridas incluye `guardrail` con nivel 2

### Requirement: Rendimiento con el tope de enemigos
El sistema SHALL ejecutar un tick de simulación con **300** enemigos vivos (el `maxAlive` por defecto), la persecución
por el mapa generado activa (línea libre y campo de distancias), los comportamientos por tipo activos, la detección de
contacto activa, las armas activas, los peligros activos y las gemas activas en ≤ 2 ms de media, medido con un
benchmark de Vitest sobre el núcleo, sin motor ni render. El cálculo completo del campo de distancias de una celda con
el mapa por defecto MUST tardar ≤ 0,1 ms de media en el mismo benchmark. Ambas medidas son informativas (dependen de
la máquina): no bloquean `verify` ni CI. Además, el verify-report de este change MUST anotar la media del peor caso
con proyectiles y la del caso con peligros, con el objetivo (informativo) de ≤ 0,25 ms por tick en ambos (+20 % sobre
los 0,206 ms medidos antes del change en la misma máquina). La partida medida MUST estar en curso en todos los ticks
medidos, de modo que se midan los pasos completos del tick: si se abre una oferta, el benchmark elige la opción 0
antes del siguiente tick y esa elección cuenta en el tiempo medido. El camino caliente del tick MUST NOT crear objetos
nuevos por tick para gemas (reserva de `maxGems`). Los escenarios que piden enemigos "en contacto" MUST colocarlos
respecto a la posición del jugador, de modo que el contacto se mantenga sea cual sea el tamaño del mundo.

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
- **AND** la media medida se anota en el verify-report frente al objetivo de ≤ 0,25 ms

#### Scenario: Peor caso con peligros
- **GIVEN** una partida con el contenido por defecto, semilla fija con su mapa generado, 300 enemigos vivos de los
  que ≥ 100 son `goblin-barrel` y ≥ 100 `goblin-tnt`, el tope de dinamitas en vuelo en todos los ticks medidos, ≥ 1
  explosión con ≥ 50 enemigos dentro de su radio en ≥ 1 de cada 10 ticks medidos, y una vida del jugador suficiente
  para no llegar a 0 en 600 ticks (los enemigos abatidos se reponen para mantener 300 vivos)
- **WHEN** el benchmark mide 600 ticks consecutivos
- **THEN** la media es ≤ 2 ms por tick y la partida sigue en curso al terminar la medición
- **AND** la media medida se anota en el verify-report frente al objetivo de ≤ 0,25 ms

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
2. comportamiento de los enemigos vivos, en el orden de la lista de enemigos (ver "Estado de comportamiento de cada
   enemigo" en `enemy-behavior`): primero, las esperas que terminan en este tick pasan a su estado de destino; después,
   los enemigos en persecución persiguen la nueva posición del jugador, con el campo de distancias de la celda que
   ocupa el centro del jugador tras el paso 1 (ver "Navegación por el campo de flujo"); por último, los que quedan a
   distancia ≤ su distancia de salida entran en su estado de destino (mecha o carga). Los enemigos en mecha, carga o
   espera no se mueven;
3. armas (ver `auto-weapons`), en este orden:
   1. movimiento, impacto y caducidad de los proyectiles existentes, en orden de creación;
   2. cada arma, en el orden de `content/weapons.json`, elige objetivo con las posiciones de ese momento y, si está
      cargada y lo tiene, dispara (crea su proyectil o aplica su pulso);
   3. los enemigos cuya vida ha llegado a 0 en este tick quedan dados de baja, suman cada uno 1 al contador de bajas
      y sueltan su gema, en el orden de la lista de enemigos (ver `xp-gems` y `run-outcome`);
4. peligros (ver `enemy-hazards`), en este orden:
   1. explosiones del tick: las de los barriles vivos cuya mecha termina en este tick, en el orden de la lista de
      enemigos, y después las de las dinamitas cuyo vuelo termina en este tick, en orden de creación; cada una daña a
      los enemigos vivos de su radio (fuego amigo) y queda registrada como golpe candidato si alcanza al jugador;
   2. los barriles que han explotado y los enemigos cuya vida ha llegado a 0 en este paso quedan dados de baja, suman
      cada uno 1 al contador de bajas y sueltan su gema, en el orden de la lista de enemigos;
   3. lanzamientos: cada enemigo vivo cuya carga termina en este tick o que sigue en carga esperando sitio, en el
      orden de la lista de enemigos, lanza una dinamita hacia la posición del jugador tras el paso 1 si hay sitio bajo
      el tope de dinamitas, y entra en espera;
5. golpe al jugador (ver `player-health`): con los contactos de los enemigos vivos con daño por contacto y las
   explosiones del paso 4.1 que le alcanzan, un solo golpe del mayor daño si no está invulnerable; si la vida llega a
   0, la partida termina con derrota y el tick acaba aquí;
6. si el número de este tick es igual a la duración objetivo en ticks, la partida termina con victoria y el tick
   acaba aquí (ver `run-outcome`);
7. gemas, en orden de creación: atracción, movimiento del imán y recogida; la XP recogida se suma y se registran
   las subidas de nivel (ver `xp-gems` y `leveling`);
8. director de oleadas (spawns, con la recolocación de las apariciones en celdas caminables, ver `enemy-spawning`);
9. si hay ≥ 1 subida pendiente y ≥ 1 mejora disponible, se abre la oferta (consume azar) y la partida pasa a
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

#### Scenario: Las armas actúan antes que la mecha
- **GIVEN** un `goblin-barrel` con vida 4 cuya mecha termina en el tick n y que recibe un impacto mortal del Linter en
  el tick n, con el jugador dentro del radio de su explosión
- **WHEN** se ejecuta el tick n
- **THEN** no hay explosión, el jugador no pierde vida y las bajas suben exactamente en 1

#### Scenario: La explosión de la victoria
- **GIVEN** una partida con duración objetivo de 120 ticks, el jugador a vida 100, no invulnerable, y una dinamita de
  daño 20 que le alcanza en el tick 120
- **WHEN** se ejecuta el tick 120
- **THEN** la vida vale 80 y la partida está terminada con victoria

#### Scenario: La explosión libera hueco para el director
- **GIVEN** `maxAlive` 1, un único `goblin-barrel` cuya mecha termina en el tick n y un director con presupuesto para 1
  `goblin-torch`
- **WHEN** se ejecuta el tick n
- **THEN** el snapshot del tick n tiene exactamente 1 enemigo vivo, un `goblin-torch`

#### Scenario: Lanzamiento con la posición del jugador ya movido
- **GIVEN** un jugador en (1.000, 1.000) con velocidad 210 e input (0, 1) y un `goblin-tnt` cuya carga termina en el
  tick n
- **WHEN** se ejecuta el tick n
- **THEN** la dinamita nueva tiene objetivo (1.000, 1.003,5) (error ≤ 0,001)

#### Scenario: Un enemigo muerto por explosión no golpea en ese tick
- **GIVEN** un jugador con vida 100, no invulnerable, en contacto con un `goblin-torch` de vida 10 y damage 5, y una
  explosión de daño 25 en el tick n que alcanza al `goblin-torch` pero no al jugador
- **WHEN** se ejecuta el tick n
- **THEN** el `goblin-torch` queda dado de baja y la vida del jugador sigue en 100

#### Scenario: La espera termina antes de moverse
- **GIVEN** un `goblin-tnt` de velocidad 45 cuya espera termina en el tick n, a 300 px del jugador quieto y con
  distancia de lanzamiento 200
- **WHEN** se ejecuta el tick n
- **THEN** en el snapshot del tick n el `goblin-tnt` está en persecución y se ha acercado 0,75 px (error ≤ 0,001)

## REMOVED Requirements

<!-- Ninguno. -->
