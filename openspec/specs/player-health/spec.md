# Player health · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
La vida del jugador, el contacto con enemigos, el daño discreto con invulnerabilidad temporal, la curación por carne y la vida
mínima 0.

## Requirements

### Requirement: Vida inicial del jugador
El sistema SHALL arrancar cada partida con la vida actual del jugador igual a su vida máxima, leída del contenido
del jugador. El snapshot MUST exponer la vida actual y la vida máxima del jugador.

#### Scenario: Partida recién creada
- **GIVEN** un contenido del jugador con vida máxima 100
- **WHEN** se lee el snapshot antes del primer tick
- **THEN** la vida actual vale 100 y la vida máxima vale 100
- **AND** el jugador no está invulnerable

#### Scenario: Sin contacto no hay daño
- **GIVEN** un jugador con vida máxima 100 y ningún enemigo vivo
- **WHEN** se ejecutan 600 ticks
- **THEN** la vida actual sigue valiendo 100

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

### Requirement: Indicación visual de invulnerabilidad
La vista SHALL hacer parpadear al jugador mientras el snapshot lo marca invulnerable, alternando su visibilidad
con un periodo fijo de P ticks del snapshot (P lo fija el design, en contenido o como constante de vista): al
pintar el snapshot del tick k con el jugador invulnerable, el jugador es visible si y solo si ⌊k / P⌋ es par.
Cuando el snapshot no lo marca invulnerable, el jugador MUST verse siempre. Con la partida terminada, el jugador
MUST verse fijo (visible, sin parpadeo), aunque el snapshot lo marque invulnerable. La indicación solo depende del
snapshot: no cambia la simulación.

#### Scenario: Sin invulnerabilidad el jugador se ve siempre
- **GIVEN** una vista con periodo de parpadeo 4 y una partida en curso en la que el jugador no recibe golpes
- **WHEN** se pintan los snapshots de los ticks 1 a 600
- **THEN** el jugador es visible en los 600

#### Scenario: Parpadeo durante la invulnerabilidad
- **GIVEN** una vista con periodo de parpadeo 4, invulnerabilidad de 30 ticks y un golpe en el tick 1
- **WHEN** se pintan los snapshots de los ticks 1 a 30
- **THEN** el jugador es visible en los ticks 1–3, 8–11, 16–19 y 24–27
- **AND** está oculto en los ticks 4–7, 12–15, 20–23 y 28–30

#### Scenario: Primer tick de invulnerabilidad
- **GIVEN** una vista con periodo de parpadeo 4 y un golpe en el tick 12 (⌊12 / 4⌋ = 3, impar)
- **WHEN** se pinta el snapshot del tick 12
- **THEN** el jugador está oculto: el parpadeo empieza en el mismo tick del golpe

#### Scenario: Último tick de invulnerabilidad y fin del parpadeo
- **GIVEN** la partida de "Parpadeo durante la invulnerabilidad", sin más contactos
- **WHEN** se pintan los snapshots de los ticks 30 y 31
- **THEN** en el tick 30 (último invulnerable, ⌊30 / 4⌋ = 7) el jugador está oculto
- **AND** en el tick 31 (ya no invulnerable, ⌊31 / 4⌋ = 7) el jugador es visible

#### Scenario: Partida terminada estando invulnerable
- **GIVEN** una vista con periodo de parpadeo 4 y una partida que termina en el tick 13 con un snapshot que marca
  al jugador invulnerable (⌊13 / 4⌋ = 3, impar)
- **WHEN** se pintan el snapshot del tick 13 y 60 frames más con la partida terminada
- **THEN** el jugador es visible en todos ellos

#### Scenario: El parpadeo no altera la simulación
- **GIVEN** dos partidas idénticas con la misma semilla e inputs, una pintada por la vista y otra sin pintar
- **WHEN** ambas ejecutan 600 ticks con ≥ 1 golpe
- **THEN** sus snapshots son iguales campo a campo en cada tick

### Requirement: Vida mínima 0
El sistema SHALL impedir que la vida del jugador baje de 0: si el daño de un golpe es mayor o igual que la vida
restante, la vida queda exactamente en 0. Llegar a 0 termina la partida con resultado derrota según `run-state`,
también si ocurre en el tick de la duración objetivo (la derrota gana a la victoria, ver `run-outcome`).

#### Scenario: Daño exactamente igual a la vida restante
- **GIVEN** un jugador con vida 10, no invulnerable, y un enemigo con damage 10 en contacto
- **WHEN** se ejecuta 1 tick
- **THEN** la vida vale exactamente 0 y la partida está terminada con resultado derrota

#### Scenario: Daño mayor que la vida restante
- **GIVEN** un jugador con vida 10, no invulnerable, y un enemigo con damage 25 en contacto
- **WHEN** se ejecuta 1 tick
- **THEN** la vida vale exactamente 0, no −15, y el resultado es derrota

#### Scenario: Vida que no llega a 0
- **GIVEN** un jugador con vida 11, no invulnerable, y un enemigo con damage 10 en contacto
- **WHEN** se ejecuta 1 tick
- **THEN** la vida vale 1, la partida sigue en curso y no hay resultado

#### Scenario: Vida 1 en el tick de la victoria
- **GIVEN** una partida con duración objetivo de 120 ticks y un jugador con vida 11, no invulnerable, con un enemigo
  de damage 10 en contacto en el tick 120
- **WHEN** se ejecuta el tick 120
- **THEN** la vida vale 1 y la partida está terminada con resultado victoria
### Requirement: Duración de invulnerabilidad validada
El sistema SHALL leer la duración de la invulnerabilidad desde `content/*.json`, validada con zod antes de llegar
al dominio. Una duración ≤ 0 o ausente MUST impedir que la partida arranque, con un error que nombre el campo de
la duración de invulnerabilidad.

#### Scenario: Duración cero
- **GIVEN** un contenido con duración de invulnerabilidad 0
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona el campo de la duración de invulnerabilidad
- **AND** no se crea ninguna partida

#### Scenario: Duración negativa
- **GIVEN** un contenido con duración de invulnerabilidad −1
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona el campo de la duración de invulnerabilidad

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito y la duración de invulnerabilidad equivale a N ≥ 1 ticks

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

### Requirement: Vida máxima mejorable
El sistema SHALL, al elegir una mejora de `maxHealth` (ver `upgrades`), sumar su incremento por nivel a la vida
máxima efectiva del jugador y la misma cantidad a su vida actual. La mejora no cura más allá de esa cantidad, no
cambia la invulnerabilidad y la vida actual nunca supera la vida máxima. El snapshot MUST exponer la vida máxima
efectiva.

#### Scenario: Con la vida llena
- **GIVEN** un jugador con vida 100 de 100
- **WHEN** se elige `guardrail` (+20)
- **THEN** el snapshot muestra vida 120 y vida máxima 120

#### Scenario: Con la vida a medias
- **GIVEN** un jugador con vida 55 de 100
- **WHEN** se elige `guardrail` (+20)
- **THEN** el snapshot muestra vida 75 y vida máxima 120

#### Scenario: Nivel máximo
- **GIVEN** un jugador con vida 100 de 100
- **WHEN** se elige `guardrail` 5 veces sin recibir golpes
- **THEN** la vida y la vida máxima valen 200

#### Scenario: La mejora no altera la invulnerabilidad
- **GIVEN** un jugador golpeado en el tick 10 con invulnerabilidad de 30 ticks y vida 90 de 100, y `guardrail`
  elegido en una oferta abierta en el tick 20
- **WHEN** un enemigo con damage 10 sigue en contacto desde el tick 21
- **THEN** la vida vale 110 de 120 hasta el tick 40 y 100 tras el tick 41

#### Scenario: Golpe letal tras la mejora
- **GIVEN** un jugador con vida 10 de 100 que elige `guardrail` (vida 30 de 120)
- **WHEN** recibe un golpe de damage 25 y, tras la invulnerabilidad, otro de damage 5
- **THEN** la vida vale 5 tras el primero y 0 tras el segundo, y la partida termina

### Requirement: Curación por carne
El sistema SHALL curar al jugador, en el paso de recogibles del tick (ver "Orden de los pasos del tick" en
`simulation-loop`), por cada recogible `meat` que recoge (ver "Recogida de gemas" en `xp-gems`), en orden de creación:
la vida actual sube en valor de la pieza × max(1, ⌊curación de la carne × vida máxima efectiva / 100⌋) (ver
"Contenido de recursos validado" en `resources`), con la vida máxima efectiva de ese momento, y queda como mucho en la
vida máxima efectiva. La vida es siempre un entero. Curar:
- no cambia la vida máxima ni la invulnerabilidad (ni la inicia, ni la alarga, ni la acorta);
- no tiene efecto si la vida ya está al máximo (el valor sobrante se pierde);
- no ocurre en un tick que acaba antes del paso de recogibles: si el golpe del tick deja la vida en 0, la partida
  termina con derrota y la carne de ese tick no se recoge (la carne no resucita); en el tick de la victoria tampoco se
  recoge;
- MUST NOT consumir azar.

Ninguna otra cosa sube la vida actual salvo la mejora de `maxHealth` (ver "Vida máxima mejorable"): no hay curación por
tiempo, por el castillo ni por otras fuentes.

#### Scenario: Curación del 20 %
- **GIVEN** un jugador con vida 50 de 100, curación de la carne 20 y un recogible `meat` de valor 1 que se recoge en el
  tick n
- **WHEN** se ejecuta el tick n
- **THEN** la vida vale 70 y la vida máxima 100 en el snapshot del tick n

#### Scenario: Tope en la vida máxima
- **GIVEN** un jugador con vida 90 de 100, curación de la carne 20 y un recogible `meat` de valor 1 que se recoge en el
  tick n
- **WHEN** se ejecuta el tick n
- **THEN** la vida vale 100, no 110

#### Scenario: Relativa a la vida máxima efectiva
- **GIVEN** un jugador con vida 100 de 140 (`guardrail` en nivel 2), curación de la carne 20 y un recogible `meat` de
  valor 1 que se recoge en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la vida vale 128 (cura 28)

#### Scenario: Redondeo hacia abajo y mínimo 1
- **GIVEN** curación de la carne 15, un jugador con vida 50 de 110, y en otra partida curación 1 con vida 10 de 60
- **WHEN** se recoge en el tick n un recogible `meat` de valor 1
- **THEN** en la primera la vida vale 66 (⌊16,5⌋ = 16) y en la segunda 11 (⌊0,6⌋ = 0, mínimo 1)

#### Scenario: Pieza acumulada por el tope
- **GIVEN** un jugador con vida 20 de 100, curación de la carne 20 y un recogible `meat` de valor 3 (acumulado por el
  tope de carne) que se recoge en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la vida vale 80
- **AND** con vida 50 de 100, la vida vale 100 (cura 60, acotada a 50)

#### Scenario: Dos piezas en el mismo tick
- **GIVEN** un jugador con vida 30 de 100, curación de la carne 20 y dos recogibles `meat` de valor 1 que se recogen en
  el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la vida vale 70

#### Scenario: Golpe y curación en el mismo tick
- **GIVEN** un jugador con vida 30 de 100, no invulnerable, en contacto con un enemigo de damage 10 en el tick n y un
  recogible `meat` de valor 1 que se recoge en ese tick, con curación de la carne 20
- **WHEN** se ejecuta el tick n
- **THEN** la vida vale 40 (30 − 10 + 20) y el jugador está invulnerable en el snapshot del tick n

#### Scenario: La carne no resucita
- **GIVEN** un jugador con vida 10 de 100, no invulnerable, en contacto con un enemigo de damage 10 en el tick n y un
  recogible `meat` en su posición en ese tick
- **WHEN** se ejecuta el tick n
- **THEN** la vida vale 0, la partida está terminada con derrota y el recogible `meat` sigue en el snapshot

#### Scenario: Sin curación en el tick de la victoria
- **GIVEN** una partida con duración objetivo 120 ticks, un jugador con vida 50 de 100 y un recogible `meat` que se
  recogería en el tick 120
- **WHEN** se ejecuta el tick 120
- **THEN** la partida termina con victoria, la vida sigue en 50 y el recogible sigue en el snapshot

#### Scenario: La curación no cambia la invulnerabilidad
- **GIVEN** un jugador que queda con vida 60 de 100 tras un golpe en el tick 10, con invulnerabilidad de 30 ticks,
  curación de la carne 20, un recogible `meat` de valor 1 que se recoge en el tick 20 y un enemigo de damage 10 en
  contacto desde el tick 21
- **WHEN** se ejecuta hasta el tick 41
- **THEN** la vida vale 80 tras el tick 20 y hasta el 40, y 70 tras el tick 41
- **AND** los snapshots de los ticks 10 a 41 marcan invulnerable exactamente los mismos ticks que en una partida igual
  sin la carne (10 a 40 y 41)

<!-- historial: 0003-collisions-and-damage (2026-11-19) -->
<!-- historial: 0004-auto-weapons (2026-11-19) -->
<!-- historial: 0005-xp-and-level-up (2026-11-19) -->
<!-- historial: 0006-run-lifecycle-hud (2026-11-20) -->
<!-- historial: 0020-enemy-behaviors (2026-11-24) -->
<!-- historial: 0023-sheep-meat (2026-11-24) -->
