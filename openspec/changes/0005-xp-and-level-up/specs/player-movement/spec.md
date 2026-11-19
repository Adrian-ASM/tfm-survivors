# Spec delta · player-movement

<!-- Change 0005-xp-and-level-up. La velocidad del jugador pasa a ser efectiva (base + mejora `shortcuts`, +20 px/s
     por nivel, PROVISIONAL, A MEDIR EN APPLY) y `content/player.json` gana el radio de recogida base `pickupRadius`
     (64, PROVISIONAL, A MEDIR EN APPLY; su uso está en `xp-gems`). Mientras se elige mejora el input de movimiento
     se ignora (ver `run-state`). Los escenarios de contenido citan los campos relevantes; los demás campos
     obligatorios de `content/player.json` se suponen válidos. -->

## MODIFIED Requirements

### Requirement: Movimiento del jugador por input
El sistema SHALL desplazar al jugador en cada tick ejecutado una distancia igual a `velocidad efectiva × dt` en la
dirección del `PlayerInput`, sin inercia: con input nulo el jugador no se mueve. La velocidad efectiva es la
`speed` de contenido más las mejoras de velocidad adquiridas (ver `upgrades`). Mientras la partida está eligiendo
mejora el jugador no se mueve, sea cual sea el input.

#### Scenario: Movimiento horizontal durante un segundo
- **GIVEN** un jugador en (480, 270) con velocidad 200 px/s
- **WHEN** se ejecutan 60 ticks de 1/60 s con input (1, 0)
- **THEN** el jugador está en (680, 270) con un error ≤ 0,001 px

#### Scenario: Sin input no hay movimiento
- **GIVEN** un jugador en (480, 270)
- **WHEN** se ejecutan 60 ticks con input (0, 0)
- **THEN** el jugador sigue exactamente en (480, 270)

#### Scenario: Movimiento vertical hacia arriba
- **GIVEN** un jugador en (480, 270) con velocidad 200 px/s
- **WHEN** se ejecutan 30 ticks con input (0, -1)
- **THEN** el jugador está en (480, 170) con un error ≤ 0,001 px

#### Scenario: Velocidad mejorada
- **GIVEN** un jugador en (480, 270) con velocidad base 200 px/s y `shortcuts` en nivel 1
- **WHEN** se ejecutan 60 ticks con input (1, 0)
- **THEN** el jugador está en (700, 270) con un error ≤ 0,001 px

#### Scenario: Velocidad en el nivel máximo
- **GIVEN** un jugador en (100, 270) con velocidad base 200 px/s y `shortcuts` en nivel 5
- **WHEN** se ejecutan 60 ticks con input (1, 0)
- **THEN** el jugador está en (400, 270) con un error ≤ 0,001 px

#### Scenario: Input ignorado mientras se elige
- **GIVEN** un jugador en (480, 270) en una partida con una oferta abierta
- **WHEN** se piden 60 ticks con input (1, 0)
- **THEN** el jugador sigue exactamente en (480, 270)

### Requirement: Contenido del jugador validado
El sistema SHALL leer velocidad, radio, vida máxima y radio de recogida (`pickupRadius`) del jugador y el tamaño de
la arena desde `content/*.json`, validados con zod antes de llegar al dominio. La vida máxima y el radio de recogida
MUST ser > 0. Un contenido inválido MUST impedir que la partida arranque con un error que nombre el campo inválido.

#### Scenario: Contenido válido
- **GIVEN** `content/player.json` con `{ "speed": 200, "radius": 16, "maxHealth": 100, "pickupRadius": 64 }`
- **WHEN** se carga el contenido
- **THEN** el dominio recibe velocidad 200, radio 16, vida máxima 100 y radio de recogida 64

#### Scenario: Velocidad negativa
- **GIVEN** `content/player.json` con `{ "speed": -5, "radius": 16, "maxHealth": 100, "pickupRadius": 64 }`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `speed`
- **AND** no se crea ninguna partida

#### Scenario: Radio que no cabe en la arena
- **GIVEN** radio 300 y arena de 960 × 540
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `radius`

#### Scenario: Vida máxima cero o negativa
- **GIVEN** `content/player.json` con `"maxHealth": 0` o con `"maxHealth": -10`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `maxHealth`
- **AND** no se crea ninguna partida

#### Scenario: Vida máxima ausente
- **GIVEN** `content/player.json` con `{ "speed": 200, "radius": 16, "pickupRadius": 64 }`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `maxHealth`

#### Scenario: Vida máxima mínima válida
- **GIVEN** `content/player.json` con `{ "speed": 200, "radius": 16, "maxHealth": 1, "pickupRadius": 64 }`
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito y la partida empieza con vida 1

#### Scenario: Radio de recogida inválido o ausente
- **GIVEN** `content/player.json` con `"pickupRadius": 0`, con `"pickupRadius": -1` o sin `pickupRadius`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `pickupRadius`
- **AND** no se crea ninguna partida

#### Scenario: Radio de recogida por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** el radio de recogida base vale 64 (provisional, a medir en apply)
