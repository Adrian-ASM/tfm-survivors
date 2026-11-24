# Enemy hazards · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
Los goblins crean peligros de área con aviso previo: el barril explota al terminar su mecha y el TNT lanza dinamita
que explota en el punto avisado. Las explosiones dañan al jugador y a cualquier goblin de su radio, y se pueden
esquivar saliendo del aviso a tiempo.

## Requirements

### Requirement: Contenido de peligros validado
El sistema SHALL leer de `content/*.json`, validados con zod antes de llegar al dominio, los parámetros globales de
los peligros: el **tope de dinamitas** simultáneas (entero ≥ 1), el **radio visual de la dinamita** (> 0; no
colisiona con nada) y la **duración visible de una explosión** (N ≥ 1 ticks). Los radios, daños y tiempos de cada
explosión son los del comportamiento del tipo que la crea (ver "Comportamiento por tipo en contenido" en
`enemy-behavior`). Un valor fuera de rango, ausente o un campo desconocido MUST impedir que la partida arranque, con
un error que nombre el campo.

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito con un tope de dinamitas entero ≥ 1, un radio de dinamita > 0 y una duración visible
  de explosión ≥ 1 tick

#### Scenario: Tope inválido
- **GIVEN** el contenido por defecto con el tope de dinamitas 0, −1, 2,5 o ausente
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra el tope de dinamitas
- **AND** no se crea ninguna partida

#### Scenario: Tope mínimo
- **GIVEN** el contenido por defecto con el tope de dinamitas 1
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Otros parámetros inválidos
- **GIVEN** el contenido por defecto con, en un caso cada vez, el radio de la dinamita 0, la duración visible de la
  explosión 0 o equivalente a 1,5 ticks, o un campo extra `chainReaction`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo

### Requirement: Dinamita en vuelo
El sistema SHALL crear, por cada lanzamiento de un enemigo en carga (ver "Artillero del Goblin TNT" en
`enemy-behavior`) en el tick t, una dinamita con un identificador único en la partida que no se reutiliza, su
**origen** (la posición del lanzador en t), su **objetivo** (la posición del jugador en t, tras su movimiento), el
tiempo de vuelo W, el radio y el daño de explosión del comportamiento del lanzador. En el snapshot del tick t + k,
para k de 0 a W − 1, la dinamita figura en la posición origen + (objetivo − origen) × k / W, con su objetivo y el
tick en que explotará (t + W). En el paso de peligros del tick t + W explota con centro en su objetivo (ver
"Explosión de área") y deja de figurar en el snapshot de ese tick. El objetivo MUST NOT cambiar tras el lanzamiento.
Una dinamita no colisiona con nada durante el vuelo y sigue su vuelo aunque su lanzador muera. La lista de dinamitas
del snapshot va ordenada por orden de creación.

#### Scenario: Posiciones del vuelo
- **GIVEN** una dinamita lanzada en el tick 154 con origen (1.199,5; 1.000), objetivo (1.000, 1.000) y vuelo de 40
  ticks
- **WHEN** se leen los snapshots de los ticks 154, 174, 193 y 194
- **THEN** la dinamita está en (1.199,5; 1.000), (1.099,75; 1.000) y (1.004,9875; 1.000) en los tres primeros
  (error ≤ 0,001), con objetivo (1.000, 1.000) y tick de explosión 194
- **AND** en el snapshot del tick 194 no figura y hay 1 explosión centrada en (1.000, 1.000)

#### Scenario: Vuelo de 1 tick
- **GIVEN** un lanzador con vuelo de 1 tick que lanza en el tick t
- **WHEN** se leen los snapshots de t y t + 1
- **THEN** en el de t la dinamita está en su origen y en el de t + 1 ha explotado en su objetivo

#### Scenario: La dinamita sigue tras morir su lanzador
- **GIVEN** una dinamita lanzada en el tick t con vuelo de 40 ticks y su lanzador dado de baja en el tick t + 5
- **WHEN** se ejecuta hasta el tick t + 40
- **THEN** la dinamita figura en los snapshots de t + 5 a t + 39 y explota en t + 40

### Requirement: Aviso en el suelo
El sistema SHALL exponer en el snapshot un **aviso** por cada explosión pendiente, con su centro, su radio (igual al
radio de la explosión que anuncia), su origen (mecha de barril o dinamita) y el tick en que explotará:
- por cada dinamita en vuelo, centrado en su objetivo, en los snapshots de los ticks t a t + W − 1;
- por cada enemigo vivo en mecha, centrado en su posición, en los snapshots de los ticks de su mecha (ver "Kamikaze
  del Goblin Barril" en `enemy-behavior`).

Un aviso ocupa exactamente el área en la que la explosión hará daño (ver "Explosión de área"). Un aviso desaparece en
el snapshot del tick en que su explosión ocurre o en el que su barril queda dado de baja sin explotar. La lista de
avisos va ordenada por tick de explosión y, a igual tick, primero los de mecha en el orden de la lista de enemigos y
después los de dinamita en orden de creación.

#### Scenario: Aviso de dinamita
- **GIVEN** la dinamita de "Posiciones del vuelo"
- **WHEN** se leen los snapshots de los ticks 154 a 194
- **THEN** de 154 a 193 hay 1 aviso de dinamita centrado en (1.000, 1.000), de radio 48 y tick de explosión 194
- **AND** en el de 194 no hay ningún aviso

#### Scenario: Aviso de mecha
- **GIVEN** el barril de "Mecha y explosión con el jugador quieto" (`enemy-behavior`)
- **WHEN** se leen los snapshots de los ticks 51 a 82
- **THEN** en 51 y en 82 no hay avisos y de 52 a 81 hay 1 aviso de mecha centrado en (1.039,333; 1.000) (error
  ≤ 0,001), de radio 56 y tick de explosión 82

### Requirement: Explosión de área
El sistema SHALL resolver cada explosión del tick, en el paso de peligros, con su centro C, su radio R y su daño D:
- **Jugador**: la explosión le alcanza si la distancia entre C y el centro del jugador (tras su movimiento en ese
  tick) es **estrictamente menor** que R + el radio del jugador. A distancia igual (tangencia) o mayor, no le alcanza.
  El daño al jugador sigue "Daño discreto por contacto y explosiones" en `player-health` (un solo golpe por tick,
  invulnerabilidad).
- **Enemigos (fuego amigo)**: a cada enemigo vivo cuya distancia de su centro a C es estrictamente menor que R + su
  radio le resta D de vida, sin bajar de 0, sea cual sea su tipo (guardias incluidos) o su estado. El barril que
  explota no recibe daño de su propia explosión.
- **Estructuras**: ninguna explosión daña a una casa ni a una torre, viva o destruida, sea cual sea la distancia (ver
  "Vida, destrucción y ruina" en `goblin-structures`).

Las explosiones de un tick son las de los barriles vivos al empezar el paso de peligros cuya mecha termina en ese
tick y las de las dinamitas cuyo vuelo termina en ese tick. Todas ellas explotan, aunque otra explosión del mismo tick
deje a 0 la vida de uno de esos barriles. El daño de varias explosiones a un mismo enemigo se acumula. Los enemigos
que quedan a vida 0 por explosiones quedan dados de baja en ese paso (ver `enemy-spawning`): suman 1 cada uno a las
bajas y sueltan su gema, igual que una baja por armas. Una explosión figura en el snapshot (identificador único que
no se reutiliza, centro, radio y tick en que ocurrió) desde su tick durante la duración visible de explosión; solo
hace daño en su tick. La lista de explosiones va ordenada por orden de creación.

#### Scenario: Jugador dentro del radio
- **GIVEN** un jugador quieto en (1.000, 1.000), no invulnerable, con vida 100, y una dinamita con objetivo
  (1.000, 1.000), radio 48 y daño 20 que explota en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la vida del jugador vale 80 y está invulnerable en el snapshot del tick n

#### Scenario: Tangencia y justo dentro
- **GIVEN** la dinamita del escenario anterior y, en dos partidas, el jugador quieto en (1.064, 1.000) (distancia
  64 = 48 + 16) y en (1.063,9; 1.000)
- **WHEN** se ejecuta el tick n
- **THEN** en la primera la vida sigue en 100 y en la segunda vale 80

#### Scenario: Esquiva de la dinamita
- **GIVEN** la dinamita de "Posiciones del vuelo" (radio 48, daño 20, explota en el tick 194) y un jugador con
  velocidad 210 en (1.000, 1.000) en el tick 154, que desde el tick 155 se mueve con input (0, 1)
- **WHEN** se ejecuta hasta el tick 194
- **THEN** en el tick 194 el jugador está en (1.000, 1.140) (error ≤ 0,001), a 140 px del centro, y su vida no ha
  bajado
- **AND** con input (0, 0) desde el tick 155 su vida baja exactamente 20 en el tick 194

#### Scenario: Fuego amigo que no mata
- **GIVEN** un enemigo de prueba sin daño por contacto, con radio 10 y vida 50, quieto en el centro del jugador
  (1.000, 1.000), y una dinamita con objetivo (1.020, 1.000), radio 48 y daño 20 que explota en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el enemigo sigue vivo con vida 30, las bajas no cambian y no hay gema nueva

#### Scenario: Fuego amigo que mata
- **GIVEN** el escenario anterior con el enemigo a vida 20 y una partida con 5 bajas
- **WHEN** se ejecuta el tick n
- **THEN** el enemigo no figura en el snapshot del tick n, las bajas valen 6 y hay exactamente 1 gema nueva, con el
  `xp` de su tipo, en la posición que tenía

#### Scenario: Goblin fuera del radio
- **GIVEN** la dinamita del escenario anterior y un enemigo de radio 10 y vida 20 en (1.078, 1.000) (distancia
  58 = 48 + 10)
- **WHEN** se ejecuta el tick n
- **THEN** su vida sigue en 20

#### Scenario: Barril que explota con otro goblin dentro
- **GIVEN** el barril de "Mecha y explosión con el jugador quieto" (`enemy-behavior`), una partida con 0 bajas y un
  `goblin-torch` de vida 10 cuyo centro está a 30 px del centro del barril en el tick 82
- **WHEN** se ejecuta el tick 82
- **THEN** el `goblin-torch` queda dado de baja, las bajas valen 2 (barril y `goblin-torch`) y hay 2 gemas nuevas,
  de valor 2 y 1, creadas en el orden de la lista de enemigos

#### Scenario: Dos explosiones sobre el mismo goblin
- **GIVEN** un enemigo de vida 50 dentro del radio de dos dinamitas de daño 20 que explotan en el mismo tick n
- **WHEN** se ejecuta el tick n
- **THEN** su vida vale 10

#### Scenario: Dos barriles que explotan a la vez
- **GIVEN** dos barriles de vida 20 en mecha cuya mecha termina en el tick n, cada uno dentro del radio de explosión
  del otro, con daño de explosión 25
- **WHEN** se ejecuta el tick n
- **THEN** hay 2 explosiones en el snapshot del tick n, las bajas suben exactamente en 2 y hay exactamente 2 gemas
  nuevas

#### Scenario: Explosión visible varios ticks
- **GIVEN** una duración visible de explosión de 12 ticks y una explosión en el tick n
- **WHEN** se leen los snapshots de n a n + 12
- **THEN** la explosión figura de n a n + 11, con tick n, y no en n + 12
- **AND** solo hace daño en el tick n: un enemigo que entra en su radio en el tick n + 1 no pierde vida

#### Scenario: Explosión sobre una casa y una torre
- **GIVEN** una casa explícita con vida 30 y una torre explícita con vida 10, ambas con su centro a 0 px del centro de
  una dinamita de radio 48 y daño 20 que explota en el tick n, y un barril de radio de explosión 80 y daño 25 cuya
  mecha termina en el tick n a 10 px de ambos centros
- **WHEN** se ejecuta el tick n
- **THEN** la casa sigue con vida 30 y la torre con vida 10, ninguna figura destruida y hay 2 explosiones en el
  snapshot del tick n

#### Scenario: Guardia alcanzado por una explosión
- **GIVEN** un `goblin-tnt-guard` de radio 22 y vida 45 a 30 px del centro de una dinamita de radio 48 y daño 20 que
  explota en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** su vida vale 25 y su estado de comportamiento no cambia

### Requirement: Sin reacciones en cadena
El sistema SHALL hacer que una explosión solo quite vida: MUST NOT detonar, adelantar ni retrasar ninguna dinamita en
vuelo ni ninguna mecha en curso. Un barril en mecha que sobrevive a una explosión sigue en mecha y explota en su tick;
uno que queda dado de baja por ella no explota (ver "Kamikaze del Goblin Barril" en `enemy-behavior`). Las dinamitas
no reciben daño.

#### Scenario: Explosión sobre una dinamita en vuelo
- **GIVEN** una dinamita en vuelo que explotará en el tick n + 20 y una explosión en el tick n cuyo radio contiene la
  posición y el objetivo de esa dinamita
- **WHEN** se ejecuta hasta el tick n + 20
- **THEN** la dinamita sigue en vuelo en los snapshots de n a n + 19, con el mismo objetivo, y explota en n + 20

#### Scenario: Explosión sobre un barril en mecha que sobrevive
- **GIVEN** un barril de vida 50 en mecha que explotará en el tick n + 10, dentro del radio de una explosión de daño
  25 en el tick n
- **WHEN** se ejecuta hasta el tick n + 10
- **THEN** en el tick n tiene vida 25 y sigue en mecha, y explota en el tick n + 10 (no antes)

#### Scenario: Explosión que abate a un barril en mecha
- **GIVEN** un barril de vida 20 en mecha que explotaría en el tick n + 10, dentro del radio de una explosión de daño
  25 en el tick n
- **WHEN** se ejecuta hasta el tick n + 10
- **THEN** queda dado de baja en el tick n con su gema y su baja, y no hay ninguna explosión en los ticks n + 1 a
  n + 10

### Requirement: Tope de dinamitas simultáneas
El sistema SHALL impedir que haya más dinamitas en vuelo que el tope de dinamitas. Un lanzador cuya carga termina sin
sitio sigue en carga y lanza en el primer tick con sitio (ver "Artillero del Goblin TNT" en `enemy-behavior`). En el
paso de peligros, las explosiones del tick se resuelven antes de los lanzamientos, de modo que una dinamita que
explota deja su sitio libre para un lanzamiento de ese mismo tick. Varios lanzamientos en el mismo tick se atienden en
el orden de la lista de enemigos hasta llenar el tope. Las mechas y las explosiones no cuentan para el tope.

#### Scenario: Dos lanzadores con tope 1
- **GIVEN** un tope de dinamitas 1 y dos TNT A y B (A antes en la lista) cuya carga termina en el tick n, con vuelo de
  40 ticks
- **WHEN** se ejecuta hasta el tick n + 40
- **THEN** en el tick n solo A lanza y B sigue en carga, quieto, en los ticks n a n + 39
- **AND** en el tick n + 40 explota la dinamita de A y B lanza en ese mismo tick, con la posición del jugador de ese
  tick como objetivo

#### Scenario: Tope por defecto alcanzado
- **GIVEN** el contenido por defecto y más lanzadores con la carga terminada que el tope de dinamitas
- **WHEN** se ejecutan 600 ticks
- **THEN** en ningún snapshot hay más dinamitas que el tope

### Requirement: Peligros deterministas
El sistema SHALL resolver dinamitas, avisos y explosiones sin consumir azar, sin depender del reloj, de la vista, de
la ventana ni de la velocidad de simulación, y sin cambiar el mapa de la partida.

#### Scenario: Los peligros no consumen azar
- **GIVEN** dos partidas con la semilla 7 y el mismo estado salvo que en una hay 3 dinamitas en vuelo y 2 barriles en
  mecha que explotan en el tick n
- **WHEN** ambas ejecutan el tick n sin oferta de mejora ni aparición
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick

#### Scenario: Mismos peligros con cualquier ventana
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42, input (0, 0) y la política de elección fija,
  una pintada con una ventana de 960 × 540 y otra con una de 2.560 × 1.440
- **WHEN** ambas ejecutan ticks hasta que terminan o hasta el tick 10.800
- **THEN** en cada tick sus listas de dinamitas, avisos y explosiones son iguales campo a campo

<!-- historial: 0020-enemy-behaviors (2026-11-24) -->
<!-- historial: 0021-goblin-camps (2026-11-24) -->
