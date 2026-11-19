# Spec delta · player-movement

<!-- Change 0003-collisions-and-damage. El contenido del jugador gana la vida máxima (`maxHealth`, nombre
     orientativo: el definitivo lo fija el design), validada con zod. Que el jugador no se mueva con la partida
     terminada lo cubre `run-state`. Los valores de los escenarios son de ejemplo. -->

## MODIFIED Requirements

### Requirement: Contenido del jugador validado
El sistema SHALL leer velocidad, radio y vida máxima del jugador y el tamaño de la arena desde `content/*.json`,
validados con zod antes de llegar al dominio. La vida máxima MUST ser > 0. Un contenido inválido MUST impedir que
la partida arranque con un error que nombre el campo inválido.

#### Scenario: Contenido válido
- **GIVEN** `content/player.json` con `{ "speed": 200, "radius": 16, "maxHealth": 100 }`
- **WHEN** se carga el contenido
- **THEN** el dominio recibe velocidad 200, radio 16 y vida máxima 100

#### Scenario: Velocidad negativa
- **GIVEN** `content/player.json` con `{ "speed": -5, "radius": 16, "maxHealth": 100 }`
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
- **GIVEN** `content/player.json` con `{ "speed": 200, "radius": 16 }`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `maxHealth`

#### Scenario: Vida máxima mínima válida
- **GIVEN** `content/player.json` con `{ "speed": 200, "radius": 16, "maxHealth": 1 }`
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito y la partida empieza con vida 1
