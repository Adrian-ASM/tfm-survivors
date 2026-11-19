# Spec delta · player-health

<!-- Change 0003-collisions-and-damage. Capacidad nueva: vida del jugador, contacto con enemigos, daño discreto con
     invulnerabilidad temporal (i-frames) y vida mínima 0. Lo que pasa al llegar a 0 está en `run-state`.
     Los valores de los escenarios (vida 100, damage 10, invulnerabilidad de 30 ticks…) son de ejemplo: el
     contenido real lo fija el design. Los nombres de campo de contenido (`maxHealth`, `damage`, duración de
     invulnerabilidad) son orientativos; los definitivos los fija el design y los escenarios se leen con ellos. -->

## ADDED Requirements

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
dados de baja no hacen contacto.

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

### Requirement: Daño discreto por contacto
El sistema SHALL restar a la vida del jugador, en un tick en que haya ≥ 1 enemigo en contacto y el jugador no esté
invulnerable, el `damage` del tipo de ese enemigo. Varios contactos en el mismo tick MUST contar como un solo
golpe, cuyo daño es el mayor `damage` entre los enemigos en contacto en ese tick (el resultado no depende del
orden de los enemigos). Golpear no da de baja al enemigo ni cambia su vida, su posición ni su persecución.

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

### Requirement: Invulnerabilidad temporal tras un golpe
El sistema SHALL hacer al jugador invulnerable durante una duración de contenido equivalente a N ticks (N ≥ 1)
después de cada golpe. Si el golpe ocurre en el tick t, los contactos de los ticks t + 1 a t + N inclusive MUST NOT
hacer daño, sea cual sea el número de enemigos o su daño; un contacto en el tick t + N + 1 sí hace daño. El
snapshot del tick k MUST indicar que el jugador está invulnerable si y solo si un contacto en el tick k + 1 no le
haría daño.

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
restante, la vida queda exactamente en 0. Llegar a 0 termina la partida según `run-state`.

#### Scenario: Daño exactamente igual a la vida restante
- **GIVEN** un jugador con vida 10, no invulnerable, y un enemigo con damage 10 en contacto
- **WHEN** se ejecuta 1 tick
- **THEN** la vida vale exactamente 0

#### Scenario: Daño mayor que la vida restante
- **GIVEN** un jugador con vida 10, no invulnerable, y un enemigo con damage 25 en contacto
- **WHEN** se ejecuta 1 tick
- **THEN** la vida vale exactamente 0, no −15

#### Scenario: Vida que no llega a 0
- **GIVEN** un jugador con vida 11, no invulnerable, y un enemigo con damage 10 en contacto
- **WHEN** se ejecuta 1 tick
- **THEN** la vida vale 1

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
