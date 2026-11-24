# Run state · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
El estado de la partida (en curso, eligiendo mejora o terminada, con su resultado) y la detención de la simulación al terminar.

## Requirements

### Requirement: Estado de la partida
El sistema SHALL mantener un estado de partida con tres valores, en curso, eligiendo mejora y terminada, y exponerlo
en el snapshot junto con el resultado de la partida: vacío, victoria o derrota (ver `run-outcome`). El resultado
MUST estar definido si y solo si el estado es terminada. Toda partida recién creada MUST estar en curso y sin
resultado. Las transiciones posibles son: de en curso a eligiendo mejora (al abrirse una oferta, ver `upgrades`), de
eligiendo mejora a en curso (al elegir sin más subidas pendientes con mejoras disponibles) y de en curso a terminada,
con derrota (la vida del jugador llega a 0) o con victoria (se completa el tick de la duración objetivo, ver
`run-outcome`). Si ambas condiciones se dan en el mismo tick, el resultado es derrota. Una partida que está eligiendo
mejora no puede pasar directamente a terminada. El paso a terminada y su resultado son irreversibles; una partida
nueva solo se obtiene reiniciando (ver `run-results`).

#### Scenario: Partida recién creada
- **GIVEN** una partida recién creada con el contenido por defecto
- **WHEN** se lee el snapshot antes del primer tick
- **THEN** el estado es en curso y no hay resultado

#### Scenario: Partida con vida restante
- **GIVEN** un jugador con vida 100 golpeado 9 veces por un enemigo con damage 10
- **WHEN** se lee el snapshot tras el noveno golpe
- **THEN** la vida vale 10, el estado sigue en curso y no hay resultado

#### Scenario: Eligiendo mejora y vuelta a en curso
- **GIVEN** una partida en curso en nivel 1 con XP 4 que recoge una gema de valor 1 en el tick n
- **WHEN** se lee el snapshot del tick n y, tras elegir una opción, se vuelve a leer
- **THEN** el estado es eligiendo mejora en el primero y en curso en el segundo, sin resultado en ambos

#### Scenario: Sin pasar por eligiendo si no hay mejoras disponibles
- **GIVEN** una partida con todas las mejoras en su nivel máximo que sube de nivel en el tick n
- **WHEN** se lee el snapshot del tick n
- **THEN** el estado es en curso

#### Scenario: Terminada por victoria
- **GIVEN** una partida con duración objetivo de 120 ticks y el jugador vivo en el tick 119
- **WHEN** se ejecuta el tick 120
- **THEN** el estado es terminada y el resultado es victoria

#### Scenario: Terminada por derrota
- **GIVEN** una partida con duración objetivo de 36.000 ticks y un golpe letal en el tick 100
- **WHEN** se ejecuta el tick 100
- **THEN** el estado es terminada y el resultado es derrota

#### Scenario: Oferta abierta justo antes del tick de la victoria
- **GIVEN** una partida con duración objetivo de 120 ticks que abre una oferta en el tick 119
- **WHEN** se piden 600 ticks con la oferta abierta, se elige la opción 0 y se ejecuta 1 tick
- **THEN** durante la oferta el estado es eligiendo mejora con `snapshot.tick` 119 y sin resultado
- **AND** tras el tick ejecutado el estado es terminada, con victoria y `snapshot.tick` 120

### Requirement: Fin de partida al llegar a vida 0
El sistema SHALL pasar la partida a terminada con resultado derrota en el mismo tick en que la vida del jugador
llega a 0, también si ese tick es el de la duración objetivo (la derrota gana a la victoria, ver `run-outcome`).
Ese tick cuenta: el contador de ticks del snapshot lo incluye. En ese tick MUST NOT aparecer ningún enemigo nuevo,
recogerse ninguna gema ni abrirse ninguna oferta de mejoras: ni el paso de gemas ni el director ni la apertura de
ofertas actúan en el tick en que la partida termina. Las gemas soltadas por las bajas de ese tick sí quedan en el
suelo y esas bajas cuentan en el contador de bajas.

#### Scenario: Golpe que deja la vida en 0
- **GIVEN** una partida en el tick 99 con el jugador a vida 10, no invulnerable, y un enemigo con damage 10 que
  estará en contacto en el tick 100
- **WHEN** se ejecuta 1 tick
- **THEN** el snapshot tiene tick 100, vida 0, estado terminada y resultado derrota

#### Scenario: Varios contactos en el tick de la muerte
- **GIVEN** un jugador con vida 10, no invulnerable, y dos enemigos con damage 10 y 25 en contacto en el mismo
  tick
- **WHEN** se ejecuta 1 tick
- **THEN** la vida vale 0 (no negativa), el estado es terminada y el resultado es derrota

#### Scenario: Sin spawns en el tick de la muerte
- **GIVEN** una partida con el jugador a vida 10 y un enemigo con damage 10 que estará en contacto en el tick n,
  y un director cuyo presupuesto alcanza el coste del tipo pendiente en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el número de enemigos vivos del snapshot del tick n es igual al del tick n − 1

#### Scenario: Muerte y subida de nivel en el mismo tick
- **GIVEN** un jugador en nivel 1 con XP 4 y vida 10, no invulnerable, una gema de valor 1 que se recogería en el
  tick n y un enemigo con damage 10 en contacto en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el estado es terminada con resultado derrota, la vida vale 0 y no hay oferta abierta
- **AND** el nivel sigue en 1 con XP 4 y la gema sigue en el snapshot

#### Scenario: Una baja en el tick de la muerte deja su gema
- **GIVEN** un jugador con vida 10, no invulnerable, un enemigo con damage 10 en contacto en el tick n y un
  `goblin-torch` con vida 4 a 300 px que muere por el Linter en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el estado es terminada y el snapshot del tick n contiene la gema de ese `goblin-torch` y cuenta su baja

#### Scenario: Muerte en el tick de la duración objetivo
- **GIVEN** una partida con duración objetivo de 36.000 ticks, el jugador a vida 10, no invulnerable, y un enemigo
  con damage 10 en contacto en el tick 36.000
- **WHEN** se ejecuta el tick 36.000
- **THEN** el estado es terminada, el resultado es derrota y la vida vale 0

### Requirement: Simulación detenida tras terminar
El sistema SHALL ignorar los ticks pedidos sobre una partida terminada, sea cual sea su resultado (victoria o
derrota): MUST NOT cambiar la posición ni la vida del jugador, la posición, la vida, la indicación de daño reciente,
el estado de comportamiento ni el tiempo que lleva en él, ni el número de enemigos, el presupuesto ni el tipo
pendiente del director, la carga ni la cadencia de las armas, la posición ni el número de proyectiles, los pulsos
visibles, las dinamitas, los avisos ni las explosiones visibles, las gemas, la XP, el nivel, los niveles de las
mejoras, las bajas, la vida ni la destrucción de las estructuras, el tiempo transcurrido desde el último nacimiento
de cada casa, el resultado, el estado del `RandomGenerator` ni el contador de ticks, sea cual sea el input. Ninguna
mecha, carga, espera ni dinamita avanza ni explota, y ninguna casa hace nacer guardias. Sobre una partida terminada no
hay oferta abierta y elegir mejora devuelve un error (ver `upgrades`). Pedir ticks sobre una partida terminada no
produce errores.

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

#### Scenario: Estructuras congeladas al terminar
- **GIVEN** una partida que termina en el tick n con una casa viva con 0 guardias cuyo próximo nacimiento tocaría en
  n + 10, una casa destruida, un proyectil del Linter que la alcanzaría en n + 2 y un guardia en patrulla
- **WHEN** se ejecutan 600 ticks más
- **THEN** el snapshot es igual campo a campo al del tick n: misma lista de estructuras con las mismas vidas, ningún
  guardia nuevo y el guardia en la misma posición y estado

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
pendientes, la oferta abierta, la vida ni la destrucción de las estructuras, el tiempo transcurrido desde el último
nacimiento de cada casa, el estado del `RandomGenerator` ni el contador de ticks, sea cual sea el input. Pedir
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

#### Scenario: Nacimiento en pausa durante la oferta
- **GIVEN** una partida que abre una oferta en el tick n con una casa viva, sin guardias vivos, cuyo próximo
  nacimiento toca en el tick n + 5
- **WHEN** se piden 600 ticks durante la oferta, se elige y se ejecutan 5 ticks
- **THEN** durante la oferta no nace ningún guardia
- **AND** tras elegir, el guardia nace en el 5.º tick ejecutado (tick n + 5), no antes

<!-- historial: 0003-collisions-and-damage (2026-11-19) -->
<!-- historial: 0004-auto-weapons (2026-11-19) -->
<!-- historial: 0005-xp-and-level-up (2026-11-19) -->
<!-- historial: 0006-run-lifecycle-hud (2026-11-20) -->
<!-- historial: 0012-sprite-rendering (2026-11-22) -->
<!-- historial: 0020-enemy-behaviors (2026-11-24) -->
<!-- historial: 0021-goblin-camps (2026-11-24) -->
