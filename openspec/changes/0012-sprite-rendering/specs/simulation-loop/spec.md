# Spec delta · simulation-loop

<!-- Ruta: openspec/changes/0012-sprite-rendering/specs/simulation-loop/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test. -->

> Cambios:
> - Renombrado de ids de enemigo, sin cambio de comportamiento: `goblin-torch` hereda los stats de `bug`. El `RunSnapshot` no cambia (no se añade `weapon` al proyectil).
> - "Pintado de los enemigos vivos": la apariencia y el tamaño son los del aspecto de su tipo (ver
>   `sprite-rendering`), no el radio; los cadáveres no cuentan como sprites de enemigo.

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

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
- **GIVEN** un único tramo con `budgetPerSecond` 1 y `types: ["goblin-torch"]`, `goblin-torch` con coste 1 y radio 10, en
  una partida sin armas equipadas
- **WHEN** se ejecutan 615 ticks
- **THEN** el snapshot lista 10 enemigos de tipo `goblin-torch` con radio 10 e identificadores distintos
- **AND** cada uno tiene una vida actual igual al `health` de `goblin-torch` y no indica daño reciente
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

### Requirement: Pintado de los enemigos vivos
El adaptador de render SHALL mostrar en cada frame exactamente un sprite de enemigo visible por cada enemigo del
último snapshot, en su posición y con el aspecto de su tipo (hoja, escala y origen, ver `sprite-rendering`), también
después de bajas. El tamaño en pantalla lo fija el aspecto de su tipo, no su radio. MUST NOT quedar visible ningún
sprite de enemigo de un enemigo dado de baja; su cadáver, si lo hay, no cuenta como sprite de enemigo (ver
"Animación de muerte de los enemigos" en `sprite-rendering`).

#### Scenario: Bajas en medio de la lista
- **GIVEN** un snapshot con 10 enemigos de identificadores 1 a 10 y tipos mezclados ya pintado
- **WHEN** se pinta un snapshot en el que los enemigos 3 y 7 se han dado de baja y el resto no se ha movido
- **THEN** hay exactamente 8 sprites de enemigo visibles
- **AND** para cada enemigo del snapshot hay un sprite de enemigo visible en su posición (error ≤ 0,001) con el
  aspecto de su tipo

#### Scenario: Todos dados de baja
- **GIVEN** un snapshot con 200 enemigos ya pintado
- **WHEN** se pinta un snapshot sin enemigos
- **THEN** no hay ningún sprite de enemigo visible (los cadáveres se cuentan aparte)

#### Scenario: Reposición tras bajas
- **GIVEN** un snapshot con 200 enemigos ya pintado
- **WHEN** se pinta un snapshot con 150 de esos enemigos y 50 enemigos nuevos de otro tipo
- **THEN** hay exactamente 200 sprites de enemigo visibles, cada uno con la posición y el aspecto de un enemigo
  distinto del snapshot

#### Scenario: Aspecto por tipo
- **GIVEN** un snapshot con 1 `goblin-torch`, 1 `goblin-tnt` y 1 `goblin-barrel`
- **WHEN** se pinta el snapshot
- **THEN** cada sprite de enemigo usa la hoja del aspecto de su tipo y las tres hojas son distintas

## REMOVED Requirements
<!-- Ninguno. -->
