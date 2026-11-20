# Simulation loop · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
La simulación avanza en ticks fijos de 1/60 s, independiente del refresco de pantalla y determinista, y expone un snapshot de solo lectura al motor.

**Convención para todas las specs: política de elección fija** (desde 0005). En un escenario que "ejecuta N
ticks" sobre una partida que puede subir de nivel y no dice nada de elecciones, cada vez que se abre una oferta se
elige la opción de índice 0 antes de pedir el siguiente tick, y "N ticks" son N ticks ejecutados (`snapshot.tick`
avanza N). Las elecciones de mejora son input del determinismo, igual que el movimiento.

## Requirements

### Requirement: Paso fijo de simulación
El sistema SHALL avanzar la simulación en ticks de exactamente 1/60 s, independientemente de la tasa de refresco
del monitor, acumulando el tiempo real sobrante para el siguiente frame.

#### Scenario: Un frame de 1/60 s
- **GIVEN** un bucle recién creado con acumulador a 0
- **WHEN** el motor informa de 16,667 ms transcurridos
- **THEN** se ejecuta exactamente 1 tick

#### Scenario: Monitor de 120 Hz
- **GIVEN** un bucle recién creado
- **WHEN** el motor informa dos veces de 8,334 ms
- **THEN** tras el primer frame se han ejecutado 0 ticks y tras el segundo, 1 tick

#### Scenario: Monitor de 30 Hz
- **GIVEN** un bucle recién creado
- **WHEN** el motor informa de 33,334 ms
- **THEN** se ejecutan exactamente 2 ticks

#### Scenario: Tiempo independiente del refresco
- **GIVEN** dos bucles con el mismo estado inicial e input (1, 0) constante
- **WHEN** uno recibe 60 frames de 16,667 ms y el otro 165 frames de 6,061 ms (≈ 1 s en ambos)
- **THEN** ambos han ejecutado 60 ticks (±1) y la posición del jugador difiere ≤ 3,4 px (un tick)

### Requirement: Protección contra la espiral de la muerte
El sistema SHALL limitar el tiempo acumulable por frame a 250 ms, de modo que un frame no ejecute más de 15 ticks
aunque la pestaña haya estado congelada.

#### Scenario: Pestaña en segundo plano
- **GIVEN** un bucle recién creado
- **WHEN** el motor informa de 5.000 ms transcurridos en un solo frame
- **THEN** se ejecutan exactamente 15 ticks

#### Scenario: Tiempo negativo o no numérico
- **GIVEN** un bucle recién creado
- **WHEN** el motor informa de −10 ms o de `NaN`
- **THEN** se ejecutan 0 ticks y el acumulador no cambia

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
- **GIVEN** dos partidas con el contenido por defecto y la semilla 7, con input (0, 0) y la política de elección fija
- **WHEN** ambas ejecutan 3.600 ticks y en ese tiempo se recoge ≥ 1 gema y se abre ≥ 1 oferta (plazo provisional,
  a medir en apply)
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
- si ha recibido daño recientemente (ver `auto-weapons`).

Cada proyectil del snapshot MUST incluir un identificador único dentro de la partida que no se reutiliza, su
posición y su radio. Cada pulso visible MUST incluir el identificador del arma que lo disparó, el tick en que se
disparó, su centro y su radio. Cada gema MUST incluir un identificador único dentro de la partida que no se
reutiliza, su posición y su radio.

La lista de enemigos contiene solo enemigos vivos y va ordenada por orden de aparición. Una baja MUST quitar al
enemigo de la lista sin cambiar el orden relativo de los demás. La lista de proyectiles va ordenada por orden de
creación y una desaparición no cambia el orden relativo de los demás. La lista de gemas va ordenada por orden de
creación y una recogida no cambia el orden relativo de las demás.

#### Scenario: Contador de ticks
- **GIVEN** una partida recién creada
- **WHEN** se ejecutan 90 ticks
- **THEN** `snapshot.tick` vale 90

#### Scenario: Partida recién creada
- **GIVEN** una partida recién creada con vida máxima 100
- **WHEN** se lee el snapshot antes del primer tick
- **THEN** las listas de enemigos, proyectiles, pulsos, gemas y mejoras adquiridas están vacías y no hay oferta
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
- **GIVEN** un único tramo con `budgetPerSecond` 1 y `types: ["bug"]`, `bug` con coste 1 y radio 10, en una partida
  sin armas equipadas
- **WHEN** se ejecutan 615 ticks
- **THEN** el snapshot lista 10 enemigos de tipo `bug` con radio 10 e identificadores distintos
- **AND** cada uno tiene una vida actual igual al `health` de `bug` y no indica daño reciente
- **AND** el orden de la lista coincide con el orden de aparición

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
### Requirement: Semilla de la partida
El sistema SHALL arrancar cada partida con una semilla que sea un entero sin signo de 32 bits
(de 0 a 4.294.967.295). La URL se lee una sola vez por carga. La **primera partida de la carga** es la que empieza al
pulsar `Jugar` por primera vez en el menú de inicio o, si la URL incluye `?e2e`, la que empieza directamente al
cargar (ver `main-menu`). Para la primera partida de la carga, cuando la URL incluye `?seed=<valor>`, el valor MUST
validarse con zod antes de usarse:
- Si es un entero en ese rango, la partida usa esa semilla.
- Si falta, la partida usa una semilla aleatoria del mismo rango, sin avisos.
- Si está presente pero no es válido, se ignora, la partida usa una semilla aleatoria del mismo rango y se emite
  exactamente 1 aviso por consola que menciona `seed` en toda la carga, como muy tarde cuando empieza la primera
  partida.

Cada partida posterior de la misma carga, tanto la obtenida al reiniciar con R (ver `run-results`) como la que
empieza al pulsar `Jugar` tras `Volver al menú` (ver `main-menu`), MUST usar una semilla aleatoria nueva del mismo
rango, obtenida en el momento en que empieza, aunque la URL incluya `?seed=`; no vuelve a leer la URL ni emite
avisos. Una partida abandonada con `Volver al menú` cuenta como partida de la carga: el siguiente `Jugar` no
reutiliza la semilla de la URL. La elección de la semilla corresponde a la composición: el núcleo MUST recibir la
semilla ya resuelta y no conocer su origen.

#### Scenario: Semilla válida por URL
- **GIVEN** la URL `?seed=42`
- **WHEN** se pulsa `Jugar` en el menú de inicio
- **THEN** la partida usa la semilla 42 y no se emite ningún aviso

#### Scenario: Semilla válida por URL en modo E2E
- **GIVEN** la URL `?e2e&seed=42`
- **WHEN** arranca la partida al cargar
- **THEN** la partida usa la semilla 42 y no se emite ningún aviso

#### Scenario: Límites del rango
- **GIVEN** la URL `?seed=0` y, en otra carga, `?seed=4294967295`
- **WHEN** arranca la primera partida de la carga
- **THEN** la partida usa la semilla 0 y 4.294.967.295 respectivamente, sin avisos

#### Scenario: Semilla inválida
- **GIVEN** la URL `?seed=-1`, `?seed=4294967296`, `?seed=1.5`, `?seed=abc` o `?seed=`
- **WHEN** arranca la primera partida de la carga
- **THEN** la partida arranca con una semilla entera en [0, 4.294.967.295]
- **AND** se ha emitido exactamente 1 aviso por consola que menciona `seed`

#### Scenario: Sin semilla en la URL
- **GIVEN** una URL sin el parámetro `seed`
- **WHEN** arranca la primera partida de la carga
- **THEN** la partida arranca con una semilla entera en [0, 4.294.967.295] y no se emite ningún aviso

#### Scenario: Semilla nueva al reiniciar
- **GIVEN** la URL `?seed=42`, una primera partida terminada y una fuente aleatoria de la composición que en el
  siguiente sorteo da la semilla 123
- **WHEN** se pulsa R
- **THEN** la partida nueva usa la semilla 123, no la 42

#### Scenario: Semilla nueva tras volver al menú
- **GIVEN** la URL `?seed=42`, una primera partida (semilla 42) abandonada con `Volver al menú` y una fuente
  aleatoria de la composición que en el siguiente sorteo da la semilla 123
- **WHEN** se pulsa `Jugar`
- **THEN** la partida nueva usa la semilla 123, no la 42, y no se emite ningún aviso

#### Scenario: Reinicio tras una semilla inválida
- **GIVEN** la URL `?seed=abc`, que emitió 1 aviso al arrancar la primera partida, y esa partida terminada
- **WHEN** se pulsa R 3 veces, terminando cada partida antes del siguiente reinicio
- **THEN** cada partida nueva arranca con una semilla entera en [0, 4.294.967.295] y el total de avisos que mencionan
  `seed` sigue siendo 1

#### Scenario: Varios Jugar tras una semilla inválida
- **GIVEN** la URL `?seed=abc` y una carga en la que se repite 3 veces: `Jugar`, Esc, `Volver al menú`
- **WHEN** se pulsa `Jugar` una cuarta vez
- **THEN** cada una de las 4 partidas arranca con una semilla entera en [0, 4.294.967.295] y el total de avisos que
  mencionan `seed` en la carga es 1

#### Scenario: Semilla inválida antes y después de Jugar
- **GIVEN** la URL `?seed=abc` sin `?e2e`
- **WHEN** termina la carga, se pintan 300 frames en el menú sin pulsar `Jugar` y después se pulsa `Jugar`
- **THEN** durante los 300 frames no existe ninguna partida y se han emitido como mucho 1 aviso que mencione `seed`
- **AND** tras pulsar `Jugar` el total de avisos que mencionan `seed` es exactamente 1

### Requirement: Rendimiento con el tope de enemigos
El sistema SHALL ejecutar un tick de simulación con 200 enemigos vivos, la detección de contacto activa, las armas
activas y las gemas activas en ≤ 2 ms de media, medido con un benchmark de Vitest sobre el núcleo, sin motor ni
render. La partida medida MUST estar en curso en todos los ticks medidos, de modo que se midan los pasos completos
del tick: si se abre una oferta, el benchmark elige la opción 0 antes del siguiente tick y esa elección cuenta en
el tiempo medido. El camino caliente del tick MUST NOT crear objetos nuevos por tick para gemas (reserva de
`maxGems`).

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

### Requirement: Orden de los pasos del tick
El sistema SHALL ejecutar cada tick de una partida en curso en este orden:
1. movimiento del jugador según el input (velocidad efectiva, ver `upgrades`);
2. persecución de los enemigos vivos hacia la nueva posición del jugador;
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
7. director de oleadas (spawns);
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
- **GIVEN** un jugador quieto en (480, 270), Tests cargado y un bug de radio 10 y velocidad 90 que, al empezar el
  tick, está a distancia 101 (tras la persecución, a 99,5)
- **WHEN** se ejecuta 1 tick
- **THEN** Tests dispara un pulso en ese tick y el bug queda con vida 6

#### Scenario: Una baja libera el hueco antes del director
- **GIVEN** `maxAlive` 1, un único bug vivo con vida 4 y un director con presupuesto para 1 bug y `bug` como tipo
  pendiente
- **WHEN** en el tick n el bug muere por un impacto del Linter
- **THEN** el snapshot del tick n tiene exactamente 1 enemigo vivo, distinto del muerto

#### Scenario: El imán usa la posición del jugador ya movido
- **GIVEN** un jugador en (480, 270) con velocidad 200 e input (1, 0) y una gema en (546, 270) (distancia 66 > 64
  antes de moverse)
- **WHEN** se ejecuta 1 tick (jugador en 483,333; distancia 62,667 ≤ 64)
- **THEN** la gema está atraída y a 56,667 px del jugador (error ≤ 0,001)

#### Scenario: El director actúa antes de abrir la oferta
- **GIVEN** una partida en nivel 1 con XP 4, una gema de valor 1 que se recoge en el tick n y un director con
  presupuesto para 1 bug en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el snapshot del tick n contiene el bug nuevo y la oferta abierta, con la partida eligiendo mejora

#### Scenario: El tick de la victoria acaba tras el contacto
- **GIVEN** una partida con duración objetivo de 120 ticks, el jugador vivo y no invulnerable, un enemigo con damage
  10 en contacto en el tick 120, una gema que se recogería en el tick 120 y un director con presupuesto para 1 bug
  en el tick 120
- **WHEN** se ejecuta el tick 120
- **THEN** la vida del jugador ha bajado 10 y sigue > 0, y la partida está terminada con victoria
- **AND** la gema sigue en el snapshot, la XP no cambia y no aparece ningún enemigo nuevo en el tick 120

#### Scenario: Las armas actúan en el tick de la victoria
- **GIVEN** una partida con duración objetivo de 120 ticks y Tests cargado con un bug de vida 4 en su radio en el
  tick 120
- **WHEN** se ejecuta el tick 120
- **THEN** el bug queda dado de baja, su gema está en el snapshot del tick 120 y las bajas suben en 1
### Requirement: Pintado de los enemigos vivos
El adaptador de render SHALL mostrar en cada frame exactamente un sprite visible por cada enemigo del último
snapshot, en su posición y con la apariencia y el tamaño de su tipo, también después de bajas. MUST NOT quedar
visible ningún sprite de un enemigo dado de baja.

#### Scenario: Bajas en medio de la lista
- **GIVEN** un snapshot con 10 enemigos de identificadores 1 a 10 y tipos mezclados ya pintado
- **WHEN** se pinta un snapshot en el que los enemigos 3 y 7 se han dado de baja y el resto no se ha movido
- **THEN** hay exactamente 8 sprites de enemigo visibles
- **AND** para cada enemigo del snapshot hay un sprite visible en su posición (error ≤ 0,001) con la apariencia
  y el tamaño de su tipo

#### Scenario: Todos dados de baja
- **GIVEN** un snapshot con 200 enemigos ya pintado
- **WHEN** se pinta un snapshot sin enemigos
- **THEN** no hay ningún sprite de enemigo visible

#### Scenario: Reposición tras bajas
- **GIVEN** un snapshot con 200 enemigos ya pintado
- **WHEN** se pinta un snapshot con 150 de esos enemigos y 50 enemigos nuevos de otro tipo
- **THEN** hay exactamente 200 sprites visibles, cada uno con la posición, apariencia y tamaño de un enemigo
  distinto del snapshot

### Requirement: Sin tiempo acumulado durante la elección
El sistema SHALL no ejecutar ticks ni acumular tiempo real mientras la partida está eligiendo mejora: los frames que
el motor informe en ese estado MUST ejecutar 0 ticks y dejar el acumulador a 0. Si una oferta se abre en un tick de
un frame que tenía más ticks por ejecutar, los ticks restantes de ese frame se descartan y el acumulador queda a 0.
Tras la elección, el bucle sigue con las reglas de "Paso fijo de simulación", sin ráfaga de ticks de recuperación
por el tiempo pasado en la elección.

#### Scenario: Frames durante la elección
- **GIVEN** una partida con una oferta abierta en el tick n
- **WHEN** el motor informa de 600 frames de 16,667 ms (≈ 10 s)
- **THEN** se ejecutan 0 ticks y el snapshot sigue en el tick n

#### Scenario: Primer frame tras elegir
- **GIVEN** la partida del escenario anterior tras sus 600 frames
- **WHEN** se elige una opción y el motor informa de 16,667 ms
- **THEN** se ejecuta exactamente 1 tick y el snapshot tiene tick n + 1

#### Scenario: Oferta a mitad de frame
- **GIVEN** un bucle con acumulador a 0 y una partida que abrirá una oferta en el primer tick que ejecute
- **WHEN** el motor informa de 50 ms (3 ticks)
- **THEN** se ejecuta exactamente 1 tick y el acumulador queda a 0
- **AND** tras elegir, un frame de 8,334 ms ejecuta 0 ticks

### Requirement: Sin tiempo acumulado con la partida terminada
El sistema SHALL no ejecutar ticks ni acumular tiempo real mientras la partida está terminada: los frames que el
motor informe en ese estado MUST ejecutar 0 ticks y dejar el acumulador a 0. Si la partida termina en un tick de un
frame que tenía más ticks por ejecutar, los ticks restantes de ese frame se descartan y el acumulador queda a 0. La
partida nueva obtenida al reiniciar (ver `run-results`) empieza con el acumulador a 0, sin ráfaga de ticks por el
tiempo pasado en la pantalla de resultados.

#### Scenario: Frames con la partida terminada
- **GIVEN** una partida terminada en el tick n
- **WHEN** el motor informa de 600 frames de 16,667 ms (≈ 10 s)
- **THEN** se ejecutan 0 ticks y el snapshot sigue en el tick n

#### Scenario: Fin de partida a mitad de frame
- **GIVEN** un bucle con acumulador a 0 y una partida que terminará en el primer tick que ejecute
- **WHEN** el motor informa de 50 ms (3 ticks)
- **THEN** se ejecuta exactamente 1 tick y el acumulador queda a 0

#### Scenario: Primer frame de la partida nueva
- **GIVEN** una partida terminada sobre la que el motor ha informado de 600 frames de 16,667 ms
- **WHEN** se pulsa R y el motor informa de 16,667 ms
- **THEN** la partida nueva ejecuta exactamente 1 tick y su snapshot tiene tick 1
- **AND** si en su lugar el motor informa de 8,334 ms, la partida nueva ejecuta 0 ticks

### Requirement: Velocidad de simulación en modo E2E
El sistema SHALL resolver, una sola vez por carga de la página, una velocidad de simulación N entera en `1..15`
a partir de la URL:
- Si la URL **no** incluye `?e2e`, N vale 1 y el parámetro `speed` se ignora por completo, sin avisos, aunque esté
  presente y sea válido.
- Si la URL incluye `?e2e` y no incluye `speed`, N vale 1, sin avisos.
- Si la URL incluye `?e2e` y `speed=<valor>`, el valor MUST validarse con zod antes de usarse: si es un entero en
  `[1, 15]`, N vale ese entero; si no, se ignora, N vale 1 y se emite exactamente 1 aviso por consola que menciona
  `speed`.

La velocidad resuelta MUST aplicarse a la primera partida de la carga y a cada partida nueva obtenida al reiniciar
(ver `run-results`); el reinicio no vuelve a leer la URL ni emite avisos. La resolución de la velocidad corresponde a
la composición y su efecto al adaptador del motor: el núcleo (`src/domain`, `src/application`) MUST NOT recibir ni
conocer la velocidad, y la semilla, el contenido y las reglas del tick no cambian con ella.

#### Scenario: Velocidad válida en modo E2E
- **GIVEN** la URL `?e2e&speed=8`
- **WHEN** arranca la partida
- **THEN** la velocidad resuelta vale 8 y no se emite ningún aviso que mencione `speed`

#### Scenario: Límites del rango
- **GIVEN** la URL `?e2e&speed=1` y, en otra carga, `?e2e&speed=15`
- **WHEN** arranca la partida
- **THEN** la velocidad resuelta vale 1 y 15 respectivamente, sin avisos que mencionen `speed`

#### Scenario: Velocidad inválida en modo E2E
- **GIVEN** la URL `?e2e&speed=0`, `?e2e&speed=16`, `?e2e&speed=-1`, `?e2e&speed=2.5`, `?e2e&speed=abc` o
  `?e2e&speed=`
- **WHEN** arranca la partida
- **THEN** la velocidad resuelta vale 1
- **AND** se emite exactamente 1 aviso por consola que menciona `speed`

#### Scenario: Sin velocidad en modo E2E
- **GIVEN** la URL `?e2e&seed=42`
- **WHEN** arranca la partida
- **THEN** la velocidad resuelta vale 1 y no se emite ningún aviso que mencione `speed`

#### Scenario: Velocidad ignorada fuera de E2E
- **GIVEN** la URL `?speed=8` y, en otra carga, `?seed=42&speed=8`
- **WHEN** arranca la partida y el motor informa de 1 frame de 16,667 ms con la partida en curso
- **THEN** se ejecuta exactamente 1 tick
- **AND** no se emite ningún aviso que mencione `speed`

#### Scenario: Velocidad inválida ignorada fuera de E2E
- **GIVEN** la URL `?speed=abc` y, en otra carga, `?speed=16`
- **WHEN** arranca la partida
- **THEN** la velocidad resuelta vale 1 y no se emite ningún aviso que mencione `speed`

#### Scenario: Avisos independientes de seed y speed
- **GIVEN** la URL `?e2e&seed=abc&speed=abc`
- **WHEN** arranca la partida
- **THEN** se emite exactamente 1 aviso que menciona `seed` y exactamente 1 aviso que menciona `speed`

#### Scenario: La velocidad se mantiene al reiniciar
- **GIVEN** la URL `?e2e&speed=8` y una primera partida terminada
- **WHEN** se pulsa R y el motor informa de 1 frame de 16,667 ms
- **THEN** la partida nueva ejecuta exactamente 8 ticks y su snapshot tiene tick 8

#### Scenario: Reinicio tras una velocidad inválida
- **GIVEN** la URL `?e2e&speed=abc`, que emitió 1 aviso al arrancar la primera partida, y esa partida terminada
- **WHEN** se pulsa R 3 veces, terminando cada partida antes del siguiente reinicio
- **THEN** cada partida nueva ejecuta 1 tick por frame de 16,667 ms y el total de avisos que mencionan `speed`
  sigue siendo 1

### Requirement: Avance acelerado por frame
Con velocidad N, el sistema SHALL procesar cada frame que el motor informe con d ms como N avances consecutivos del
bucle de paso fijo, cada uno con d ms y con las reglas de velocidad 1 (incluido el tope de 250 ms por avance), de
modo que un frame de velocidad N ejecute los mismos ticks que N frames consecutivos de d ms a velocidad 1. El input
del jugador MUST leerse una vez por frame y aplicarse a todos los ticks de ese frame. En cuanto la partida deja de
estar en curso (se abre una oferta de mejora o la partida termina con victoria o derrota), los avances y ticks
restantes del frame MUST descartarse y el acumulador MUST quedar a 0. Mientras la partida está eligiendo mejora o
terminada, los frames MUST ejecutar 0 ticks y dejar el acumulador a 0 con cualquier N. Con N = 1 el comportamiento
MUST ser idéntico al actual.

#### Scenario: Un frame de 1/60 s a velocidad 8
- **GIVEN** un bucle recién creado con acumulador a 0, velocidad 8 y una partida en curso que no abre ofertas ni
  termina en los próximos 8 ticks
- **WHEN** el motor informa de 16,667 ms
- **THEN** se ejecutan exactamente 8 ticks y el snapshot tiene tick 8

#### Scenario: Monitor de 120 Hz a velocidad 8
- **GIVEN** un bucle recién creado, velocidad 8 y una partida en curso que no abre ofertas ni termina en los
  próximos 8 ticks
- **WHEN** el motor informa de 1 frame de 8,334 ms
- **THEN** se ejecutan exactamente 4 ticks (igual que 8 frames de 8,334 ms a velocidad 1)

#### Scenario: Velocidad máxima con frame congelado
- **GIVEN** un bucle recién creado, velocidad 15 y una partida en curso que no abre ofertas ni termina en los
  próximos 225 ticks
- **WHEN** el motor informa de 5.000 ms en un solo frame
- **THEN** se ejecutan exactamente 225 ticks (15 avances × 15 ticks)

#### Scenario: Tiempo negativo o no numérico a velocidad 8
- **GIVEN** un bucle recién creado y velocidad 8
- **WHEN** el motor informa de −10 ms o de `NaN`
- **THEN** se ejecutan 0 ticks y el acumulador no cambia

#### Scenario: Velocidad 1 sin cambios
- **GIVEN** dos bucles recién creados con el mismo estado inicial, uno sin velocidad configurada y otro con
  velocidad 1, e input (1, 0) constante
- **WHEN** ambos reciben la misma secuencia de 600 frames de 16,667 ms
- **THEN** ambos ejecutan 600 ticks y sus snapshots son iguales campo a campo tras cada frame

#### Scenario: Oferta a mitad de frame acelerado
- **GIVEN** un bucle con acumulador a 0, velocidad 8 y una partida que abrirá una oferta en el 3.er tick que ejecute
- **WHEN** el motor informa de 16,667 ms
- **THEN** se ejecutan exactamente 3 ticks, la partida está eligiendo mejora y el acumulador queda a 0
- **AND** tras elegir, un frame de 8,334 ms ejecuta 4 ticks (no hay ráfaga de los 5 ticks descartados)

#### Scenario: Fin de partida a mitad de frame acelerado
- **GIVEN** un bucle con acumulador a 0, velocidad 15 y una partida que terminará en el 1.er tick que ejecute
- **WHEN** el motor informa de 50 ms
- **THEN** se ejecuta exactamente 1 tick, la partida está terminada y el acumulador queda a 0

#### Scenario: Frames durante la elección a velocidad 15
- **GIVEN** velocidad 15 y una partida con una oferta abierta en el tick n
- **WHEN** el motor informa de 600 frames de 16,667 ms
- **THEN** se ejecutan 0 ticks y el snapshot sigue en el tick n

#### Scenario: Frames con la partida terminada a velocidad 15
- **GIVEN** velocidad 15 y una partida terminada en el tick n
- **WHEN** el motor informa de 600 frames de 16,667 ms
- **THEN** se ejecutan 0 ticks y el snapshot sigue en el tick n

#### Scenario: Input único por frame
- **GIVEN** velocidad 8, una partida en curso que no abre ofertas ni termina en los próximos 8 ticks, el jugador en
  (480, 270) con velocidad 200 y un input (1, 0) leído al empezar el frame que deja de estar activo antes de que el
  frame termine
- **WHEN** el motor informa de 16,667 ms
- **THEN** los 8 ticks del frame usan el input (1, 0) y el jugador queda en x = 480 + 8 × 3,333 (error ≤ 0,01),
  si no lo limita el borde del mundo

### Requirement: Mismo resultado con cualquier velocidad
El sistema SHALL producir el mismo desenlace de partida con cualquier velocidad N en `1..15` para la misma semilla,
el mismo contenido, input constante y la política de elección fija: resultado (victoria o derrota), tick en que
termina, nivel, bajas y lista de mejoras adquiridas con sus niveles MUST ser idénticos a los de velocidad 1. La
velocidad solo cambia cuántos ticks se ejecutan por frame, no cuáles ni en qué orden.

#### Scenario: Derrota equivalente con la semilla 42
- **GIVEN** cuatro partidas con el contenido por defecto, la semilla 42, input (0, 0) constante y la política de
  elección fija, a velocidades 1, 4, 8 y 15
- **WHEN** el motor informa de frames de 16,667 ms hasta que cada partida termina o hasta 36.000 ticks
- **THEN** las cuatro terminan con el mismo resultado, en el mismo tick, con el mismo nivel, las mismas bajas y la
  misma lista de mejoras adquiridas con sus niveles

#### Scenario: Derrota equivalente con la semilla 90
- **GIVEN** dos partidas con el contenido por defecto, la semilla 90, input (0, 0) constante y la política de
  elección fija, a velocidades 1 y 8
- **WHEN** el motor informa de frames de 16,667 ms hasta que cada partida termina o hasta 36.000 ticks
- **THEN** ambas terminan con el mismo resultado, en el mismo tick, con el mismo nivel, las mismas bajas y la misma
  lista de mejoras adquiridas con sus niveles

#### Scenario: Equivalencia con frames irregulares
- **GIVEN** dos partidas con el contenido por defecto, la semilla 7, input (1, 0) constante y la política de
  elección fija, una a velocidad 1 y otra a velocidad 8
- **WHEN** ambas reciben frames con duraciones que alternan 8,334 ms, 16,667 ms y 33,334 ms hasta que terminan o
  hasta 36.000 ticks
- **THEN** ambas terminan con el mismo resultado, en el mismo tick, con el mismo nivel, las mismas bajas y la misma
  lista de mejoras adquiridas con sus niveles

#### Scenario: Snapshots iguales tick a tick
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42, input (0, 0) constante y la política de
  elección fija, a velocidades 1 y 8
- **WHEN** ambas avanzan hasta el tick 1.200
- **THEN** el snapshot de la partida a velocidad 8 en el tick 1.200 es igual campo a campo al de la partida a
  velocidad 1 en el tick 1.200

### Requirement: Sin tiempo acumulado durante la pausa ni antes de jugar
El sistema SHALL no ejecutar ticks ni acumular tiempo real mientras la partida está en pausa (ver `main-menu`): los
frames que el motor informe con la partida en pausa MUST ejecutar 0 ticks, sea cual sea su duración (incluidos
frames largos por una pestaña oculta), y el acumulador MUST quedar a 0 desde el momento de pausar, descartando el
tiempo sobrante que tuviera. Al reanudar no se pierde ni se gana tiempo simulado: el snapshot es el mismo que al
pausar y el bucle sigue con las reglas de "Paso fijo de simulación" y "Avance acelerado por frame", sin ráfaga de
ticks de recuperación por el tiempo pasado en pausa. Del mismo modo, la partida que empieza al pulsar `Jugar` MUST
empezar con el acumulador a 0, sin ráfaga por el tiempo pasado en el menú. Esto vale con cualquier velocidad N en
`1..15`.

#### Scenario: Frames durante la pausa
- **GIVEN** una partida en curso en el tick n
- **WHEN** se pulsa Esc y el motor informa de 300 frames de 16,667 ms
- **THEN** se ejecutan 0 ticks y el snapshot sigue igual campo a campo al del tick n

#### Scenario: Primer frame tras reanudar
- **GIVEN** la partida del escenario anterior tras sus 300 frames en pausa
- **WHEN** se pulsa Esc de nuevo y el motor informa de 16,667 ms
- **THEN** se ejecuta exactamente 1 tick y el snapshot tiene tick n + 1

#### Scenario: Frame largo durante la pausa
- **GIVEN** una partida en pausa en el tick n
- **WHEN** el motor informa de 1 frame de 5.000 ms, se reanuda y el motor informa de 16,667 ms
- **THEN** el frame de 5.000 ms ejecuta 0 ticks y el primer frame tras reanudar ejecuta exactamente 1 tick (tick
  n + 1)

#### Scenario: Sobrante descartado al pausar
- **GIVEN** un bucle con una partida en curso que, tras un frame de 25 ms, ha ejecutado 1 tick y tiene 8,333 ms
  sobrantes
- **WHEN** se pulsa Esc, se reanuda sin que el motor informe de ningún frame y el motor informa de 8,334 ms
- **THEN** ese frame ejecuta 0 ticks
- **AND** un segundo frame de 8,334 ms ejecuta exactamente 1 tick

#### Scenario: Reanudar a velocidad 8
- **GIVEN** la URL `?e2e&speed=8` y una partida en pausa en el tick n que no abre ofertas ni termina en los próximos
  16 ticks
- **WHEN** el motor informa de 300 frames de 16,667 ms, se reanuda y el motor informa de 2 frames de 16,667 ms
- **THEN** durante la pausa se ejecutan 0 ticks y tras reanudar el snapshot tiene tick n + 8 después del primer
  frame y n + 16 después del segundo

#### Scenario: Pausa a velocidad 15 con frame largo
- **GIVEN** la URL `?e2e&speed=15` y una partida en pausa en el tick n
- **WHEN** el motor informa de 1 frame de 5.000 ms
- **THEN** se ejecutan 0 ticks y el snapshot sigue en el tick n

#### Scenario: Primer frame tras Jugar
- **GIVEN** el modo menú sobre el que el motor ha informado de 600 frames de 16,667 ms y, después, de 1 frame de
  5.000 ms
- **WHEN** se pulsa `Jugar` y el motor informa de 16,667 ms
- **THEN** la partida ejecuta exactamente 1 tick y su snapshot tiene tick 1
- **AND** si en su lugar el motor informa de 8,334 ms, la partida ejecuta 0 ticks

### Requirement: Velocidad en todas las partidas de la carga
El sistema SHALL aplicar la velocidad de simulación resuelta para la carga (ver "Velocidad de simulación en modo
E2E", change 0008) a todas las partidas de esa carga: la primera, las obtenidas al reiniciar con R y las que empiezan
al pulsar `Jugar` tras `Volver al menú`. Ninguna de ellas vuelve a leer la URL ni emite avisos que mencionen `speed`.

#### Scenario: Velocidad tras volver al menú
- **GIVEN** la URL `?e2e&speed=8`, la primera partida abandonada con `Volver al menú`
- **WHEN** se pulsa `Jugar` y el motor informa de 1 frame de 16,667 ms
- **THEN** la partida nueva ejecuta exactamente 8 ticks y su snapshot tiene tick 8

#### Scenario: Velocidad inválida y varios Jugar
- **GIVEN** la URL `?e2e&speed=abc`, que emitió 1 aviso al cargar
- **WHEN** se abandona la partida con `Volver al menú` y se pulsa `Jugar`, 3 veces seguidas
- **THEN** cada partida nueva ejecuta 1 tick por frame de 16,667 ms y el total de avisos que mencionan `speed` sigue
  siendo 1

<!-- historial: 0001-walking-skeleton (2026-11-19) -->
<!-- historial: 0002-enemy-spawning (2026-11-19) -->
<!-- historial: 0003-collisions-and-damage (2026-11-19) -->
<!-- historial: 0004-auto-weapons (2026-11-19) -->
<!-- historial: 0005-xp-and-level-up (2026-11-19) -->
<!-- historial: 0006-run-lifecycle-hud (2026-11-20) -->
<!-- historial: 0008-e2e-fast-sim (2026-11-20) -->
<!-- historial: 0009-main-menu (2026-11-20) -->
