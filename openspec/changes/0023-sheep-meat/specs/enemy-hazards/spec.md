# Spec delta · enemy-hazards

<!-- Change 0023-sheep-meat: las explosiones de barriles y dinamitas también dañan a las ovejas (ver `sheep`). La oveja
     de prueba es la de `sheep` (radio 20, vida 12). -->

## MODIFIED Requirements

### Requirement: Explosión de área
El sistema SHALL resolver cada explosión del tick, en el paso de peligros, con su centro C, su radio R y su daño D:
- **Jugador**: la explosión le alcanza si la distancia entre C y el centro del jugador (tras su movimiento en ese
  tick) es **estrictamente menor** que R + el radio del jugador. A distancia igual (tangencia) o mayor, no le alcanza.
  El daño al jugador sigue "Daño discreto por contacto y explosiones" en `player-health` (un solo golpe por tick,
  invulnerabilidad).
- **Enemigos (fuego amigo)**: a cada enemigo vivo cuya distancia de su centro a C es estrictamente menor que R + su
  radio le resta D de vida, sin bajar de 0, sea cual sea su tipo (guardias incluidos) o su estado. El barril que
  explota no recibe daño de su propia explosión.
- **Ovejas**: a cada oveja viva (ver `sheep`) cuya distancia de su centro a C es estrictamente menor que R + su radio
  le resta D de vida, sin bajar de 0, sea cual sea su estado. Alcanzar a una oveja no cambia su estado ni la hace huir.
- **Estructuras**: ninguna explosión daña a una casa ni a una torre, viva o destruida, sea cual sea la distancia (ver
  "Vida, destrucción y ruina" en `goblin-structures`).

Las explosiones de un tick son las de los barriles vivos al empezar el paso de peligros cuya mecha termina en ese
tick y las de las dinamitas cuyo vuelo termina en ese tick. Todas ellas explotan, aunque otra explosión del mismo tick
deje a 0 la vida de uno de esos barriles. El daño de varias explosiones a un mismo enemigo o a una misma oveja se
acumula. Los enemigos que quedan a vida 0 por explosiones quedan dados de baja en ese paso (ver `enemy-spawning`):
suman 1 cada uno a las bajas y sueltan su gema, igual que una baja por armas. Las ovejas que quedan a vida 0 por
explosiones mueren en ese paso, después de las bajas de los enemigos: no suman bajas ni sueltan gema, y sueltan su carne
(ver "Carne de las ovejas abatidas" en `resources`). Una explosión figura en el snapshot (identificador único que no se
reutiliza, centro, radio y tick en que ocurrió) desde su tick durante la duración visible de explosión; solo hace daño
en su tick. La lista de explosiones va ordenada por orden de creación.

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

#### Scenario: Oveja alcanzada que sobrevive
- **GIVEN** la oveja de prueba con vida 30 (valor de escenario) en pasto a 60 px del centro de una dinamita de radio 48
  y daño 20 que explota en el tick n (60 < 48 + 20), con el jugador a más de 200 px
- **WHEN** se ejecuta el tick n
- **THEN** la oveja tiene vida 10, sigue en pasto en la misma posición y no hay ningún recogible nuevo

#### Scenario: Barril que explota junto a una oveja y un goblin
- **GIVEN** el barril de "Mecha y explosión con el jugador quieto" (`enemy-behavior`), una partida con 0 bajas, un
  `goblin-torch` de vida 10 y la oveja de prueba (vida 12) con sus centros a 30 px del centro del barril en el tick 82
- **WHEN** se ejecuta el tick 82
- **THEN** las bajas valen 2 (barril y `goblin-torch`), la oveja no figura en el snapshot del tick 82 y se crean en este
  orden: la gema del barril, la del `goblin-torch` y el `meat` de la oveja
