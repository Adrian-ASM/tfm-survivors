# Player movement · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
El jugador se mueve por la arena según el input, a velocidad constante, sin salir de sus límites y con su contenido validado.

## Requirements

### Requirement: Movimiento del jugador por input
El sistema SHALL desplazar al jugador en cada tick una distancia igual a `velocidad × dt` en la dirección del
`PlayerInput`, sin inercia: con input nulo el jugador no se mueve.

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

### Requirement: Normalización diagonal
El sistema SHALL normalizar el `PlayerInput` cuando su módulo sea mayor que 1, de modo que moverse en diagonal no
sea más rápido que moverse en un eje. Cada componente del input MUST limitarse primero al rango [-1, 1].

#### Scenario: Diagonal a la misma velocidad que un eje
- **GIVEN** un jugador en (480, 270) con velocidad 200 px/s
- **WHEN** se ejecutan 60 ticks con input (1, 1)
- **THEN** el jugador ha recorrido 200 px en total (error ≤ 0,001 px)
- **AND** está en (480 + 141,421, 270 + 141,421) con un error ≤ 0,001 px

#### Scenario: Input fuera de rango
- **GIVEN** un jugador en (480, 270) con velocidad 200 px/s
- **WHEN** se ejecutan 60 ticks con input (5, 0)
- **THEN** el jugador está en (680, 270), igual que con input (1, 0)

#### Scenario: Input analógico menor que 1 no se amplifica
- **GIVEN** un jugador en (480, 270) con velocidad 200 px/s
- **WHEN** se ejecutan 60 ticks con input (0,5, 0)
- **THEN** el jugador está en (580, 270) con un error ≤ 0,001 px

### Requirement: Límites de la arena
El sistema SHALL mantener el círculo del jugador entero dentro de la arena: su centro MUST quedar en
[radio, ancho − radio] × [radio, alto − radio].

#### Scenario: Choque con el borde derecho
- **GIVEN** un jugador en (940, 270) con radio 16 en una arena de 960 × 540
- **WHEN** se ejecutan 60 ticks con input (1, 0)
- **THEN** el jugador está en (944, 270)

#### Scenario: Esquina superior izquierda
- **GIVEN** un jugador en (20, 20) con radio 16
- **WHEN** se ejecutan 60 ticks con input (-1, -1)
- **THEN** el jugador está en (16, 16)

#### Scenario: Deslizar por la pared
- **GIVEN** un jugador en (944, 270) pegado al borde derecho
- **WHEN** se ejecutan 30 ticks con input (1, 1)
- **THEN** x sigue en 944 y y ha aumentado 70,711 px (error ≤ 0,001 px)

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

<!-- historial: 0001-walking-skeleton (2026-11-19) -->
<!-- historial: 0003-collisions-and-damage (2026-11-19) -->
