# Spec delta · player-health

<!-- Change 0020-enemy-behaviors. El jugador recibe daño por contacto y por explosiones (ver `enemy-hazards`), con
     un solo golpe por tick (el de mayor daño) y la misma invulnerabilidad (D4). Los tipos sin daño por contacto (el
     `goblin-barrel`, D3) no golpean al tocar. Se conservan los nombres de los requisitos. -->

## ADDED Requirements

<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Contacto jugador-enemigo
El sistema SHALL considerar que un enemigo vivo está en contacto con el jugador en un tick cuando sus círculos se
solapan: la distancia entre sus centros es **estrictamente menor** que la suma de sus radios. Si la distancia es
igual a la suma de radios (tangencia), no hay contacto. El contacto MUST evaluarse con las posiciones del jugador
y de los enemigos después de aplicar el movimiento del jugador y la persecución de ese mismo tick. Los enemigos
dados de baja no hacen contacto. Un enemigo de un tipo sin daño por contacto (ver `enemy-spawning`) puede solapar al
jugador, pero su contacto MUST NOT hacer daño ni iniciar la invulnerabilidad.

#### Scenario: Tangencia exacta no es contacto
- **GIVEN** un jugador quieto en (480, 270) con radio 16 y vida 100, y un enemigo con radio 10, velocidad 60 y
  damage 10 en (507, 270)
- **WHEN** se ejecuta 1 tick (el enemigo queda en (506, 270), a distancia 26 = 16 + 10)
- **THEN** la vida del jugador sigue valiendo 100

#### Scenario: Solapamiento tras la persecución
- **GIVEN** la partida del escenario anterior tras 1 tick
- **WHEN** se ejecuta 1 tick más (el enemigo queda en (505, 270), a distancia 25)
- **THEN** la vida del jugador vale 90

#### Scenario: Un enemigo dado de baja no hace contacto
- **GIVEN** un jugador quieto en (480, 270) con vida 100 y un enemigo con damage 10 en (480, 270) cuya vida
  se ha llevado a 0 antes del tick
- **WHEN** se ejecutan 60 ticks
- **THEN** la vida del jugador sigue valiendo 100

#### Scenario: Un tipo sin daño por contacto no golpea
- **GIVEN** un jugador quieto en (480, 270) con vida 100 y un enemigo de un tipo sin daño por contacto, con un único
  estado de persecución, en (480, 270)
- **WHEN** se ejecutan 600 ticks
- **THEN** la vida del jugador sigue valiendo 100 y no está invulnerable en ningún snapshot

### Requirement: Daño discreto por contacto
El sistema SHALL restar a la vida del jugador, en un tick en que el jugador no esté invulnerable y haya ≥ 1 **golpe
candidato**, un único golpe cuyo daño es el mayor entre los candidatos de ese tick (el resultado no depende del orden
de los enemigos ni de las explosiones). Son golpes candidatos de un tick:
- el contacto de cada enemigo vivo con daño por contacto que está en contacto con el jugador, con el `damage` de su
  tipo;
- cada explosión de ese tick que alcanza al jugador (ver "Explosión de área" en `enemy-hazards`), con su daño de
  explosión.

Varios contactos y explosiones en el mismo tick MUST contar como un solo golpe. Golpear por contacto no da de baja al
enemigo ni cambia su vida, su posición, su estado ni su persecución.

#### Scenario: Un golpe de un enemigo
- **GIVEN** un jugador quieto en (480, 270) con vida 100 y un enemigo con damage 10 en (480, 270)
- **WHEN** se ejecuta 1 tick
- **THEN** la vida del jugador vale 90
- **AND** el enemigo sigue vivo en (480, 270) con su vida intacta

#### Scenario: Varios contactos en el mismo tick
- **GIVEN** un jugador quieto en (480, 270) con vida 100 y 3 enemigos con damage 10 en (480, 270)
- **WHEN** se ejecuta 1 tick
- **THEN** la vida del jugador vale 90 (un solo golpe, no 70)

#### Scenario: Contactos simultáneos de daño distinto
- **GIVEN** un jugador quieto en (480, 270) con vida 100, un enemigo con damage 10 y otro con damage 25, ambos
  en (480, 270), en cualquiera de los dos órdenes de aparición
- **WHEN** se ejecuta 1 tick
- **THEN** la vida del jugador vale 75 en ambos casos

#### Scenario: Contacto y explosión en el mismo tick
- **GIVEN** un jugador quieto en (1.000, 1.000) con vida 100, no invulnerable, un enemigo con damage 15 en contacto y
  una explosión de daño 25 que le alcanza, ambos en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la vida del jugador vale 75 (un solo golpe, el de 25; no 60)
- **AND** con una explosión de daño 10 en lugar de 25, la vida vale 85 (gana el contacto de 15)

#### Scenario: Dos explosiones en el mismo tick
- **GIVEN** un jugador con vida 100, no invulnerable, alcanzado en el tick n por dos explosiones de daño 20 y 25
- **WHEN** se ejecuta el tick n
- **THEN** la vida del jugador vale 75

#### Scenario: Explosión que no alcanza no es candidata
- **GIVEN** un jugador con vida 100, no invulnerable, sin contactos, y una explosión de radio 48 cuyo centro está a
  64 px del suyo (tangencia con radio 16) en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la vida sigue en 100 y el jugador no está invulnerable

### Requirement: Invulnerabilidad temporal tras un golpe
El sistema SHALL hacer al jugador invulnerable durante una duración de contenido equivalente a N ticks (N ≥ 1)
después de cada golpe, sea de contacto o de explosión. Si el golpe ocurre en el tick t, los contactos y las
explosiones de los ticks t + 1 a t + N inclusive MUST NOT hacerle daño, sea cual sea su número o su daño; un contacto
o una explosión en el tick t + N + 1 sí hace daño. El snapshot del tick k MUST indicar que el jugador está
invulnerable si y solo si un contacto o una explosión en el tick k + 1 no le harían daño. Una explosión que no hace
daño por la invulnerabilidad no la prolonga.

#### Scenario: Contacto continuo con un enemigo
- **GIVEN** un jugador quieto en (480, 270) con vida 100, invulnerabilidad de 30 ticks y un enemigo con damage 10
  en (480, 270) desde el tick 1
- **WHEN** se ejecutan 31 ticks y después 1 tick más
- **THEN** tras el tick 1 la vida vale 90 y tras el tick 31 sigue valiendo 90
- **AND** tras el tick 32 la vida vale 80

#### Scenario: Fin de la invulnerabilidad justo en el tick N
- **GIVEN** la partida del escenario anterior
- **WHEN** se leen los snapshots de los ticks 1 a 32
- **THEN** el jugador está invulnerable en los snapshots de los ticks 1 a 30
- **AND** no está invulnerable en el snapshot del tick 31
- **AND** vuelve a estar invulnerable en el snapshot del tick 32

#### Scenario: Contacto nuevo que llega justo al expirar
- **GIVEN** un jugador con vida 100 e invulnerabilidad de 30 ticks golpeado en el tick 10, y un segundo enemigo
  con damage 10 que entra en contacto por primera vez en el tick 40 y sigue en contacto en el tick 41
- **WHEN** se ejecuta hasta el tick 41
- **THEN** la vida vale 90 tras el tick 40 y 80 tras el tick 41

#### Scenario: Un enemigo más fuerte no rompe la invulnerabilidad
- **GIVEN** un jugador con vida 100 e invulnerabilidad de 30 ticks golpeado en el tick 1 por un enemigo con
  damage 10, y un enemigo con damage 50 que entra en contacto en el tick 5
- **WHEN** se ejecuta hasta el tick 31
- **THEN** la vida vale 90

#### Scenario: 200 enemigos encima del jugador
- **GIVEN** un jugador quieto con vida 1.000, invulnerabilidad de 30 ticks y 200 enemigos con damage 10 en su
  centro desde el tick 1
- **WHEN** se ejecutan 61 ticks
- **THEN** la vida vale 980 (golpes en los ticks 1 y 32)
- **AND** en ningún tick la vida baja más de 10

#### Scenario: Explosión durante la invulnerabilidad
- **GIVEN** un jugador con vida 100 e invulnerabilidad de 30 ticks golpeado por contacto (damage 10) en el tick 70,
  sin más contactos, y una explosión de daño 25 que le alcanza en el tick 82
- **WHEN** se ejecuta hasta el tick 101
- **THEN** la vida vale 90 tras el tick 82 y tras el tick 101
- **AND** el jugador no está invulnerable en el snapshot del tick 100

#### Scenario: Explosión justo al expirar
- **GIVEN** un jugador con vida 100 e invulnerabilidad de 30 ticks golpeado por contacto (damage 10) en el tick 10,
  sin más contactos, y una explosión de daño 25 que le alcanza en el tick 41
- **WHEN** se ejecuta el tick 41
- **THEN** la vida vale 65 y el jugador está invulnerable en el snapshot del tick 41

#### Scenario: La explosión inicia la invulnerabilidad
- **GIVEN** un jugador con vida 100, invulnerabilidad de 30 ticks, alcanzado por una explosión de daño 20 en el tick
  n y en contacto con un enemigo de damage 10 desde el tick n + 1
- **WHEN** se ejecuta hasta el tick n + 31
- **THEN** la vida vale 80 tras el tick n + 30 y 70 tras el tick n + 31

### Requirement: Contacto observable con las armas activas
El sistema SHALL hacer que, con el contenido por defecto (armas, mejoras y comportamientos incluidos), un jugador que
no se mueve reciba al menos un golpe (de contacto o de explosión) en un plazo acotado, de modo que el daño al jugador
siga siendo observable en el juego real, y que la partida siga en curso tras ese primer golpe.

#### Scenario: Primer golpe en el núcleo con armas activas
- **GIVEN** el contenido por defecto, semilla 42, input (0, 0) en todos los ticks y la política de elección fija
  (ver `simulation-loop`)
- **WHEN** se ejecutan 4.800 ticks (80 s)
- **THEN** en algún tick ≤ 4.800 la vida del jugador es menor que su vida máxima
- **AND** en el tick del primer golpe la partida sigue en curso, con la vida del tick anterior menos el daño de ese
  golpe (el mayor de sus candidatos)

#### Scenario: Primer golpe en el navegador
- **GIVEN** la build de producción servida con `?seed=42` y sin input de movimiento del jugador
- **WHEN** pasan como mucho 80 s de juego, pulsando la tecla 1 cada vez que aparece el overlay de elección
- **THEN** una prueba E2E observa una vida del jugador menor que la máxima, mayor que 0 y la partida en curso

## REMOVED Requirements

<!-- Ninguno. -->
