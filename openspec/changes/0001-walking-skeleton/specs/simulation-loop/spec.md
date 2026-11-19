# Spec delta · simulation-loop

<!-- Change 0001-walking-skeleton. El bucle es del núcleo (application), no del motor: el motor solo le pasa el
     tiempo real transcurrido y el input, y pinta el snapshot resultante (ADR-0002). -->

## ADDED Requirements

### Requirement: Paso fijo de simulación
El sistema SHALL avanzar la simulación en ticks de exactamente 1/60 s, independientemente de la tasa de refresco
del monitor, acumulando el tiempo real sobrante para el siguiente frame.

#### Scenario: Un frame de 1/60 s
- **GIVEN** un bucle recién creado con acumulador a 0
- **WHEN** el motor informa de 16,667 ms transcurridos
- **THEN** se ejecuta exactamente 1 tick

#### Scenario: Monitor de 120 Hz
- **GIVEN** un bucle recién creado
- **WHEN** el motor informa dos veces de 8,334 ms
- **THEN** tras el primer frame se han ejecutado 0 ticks y tras el segundo, 1 tick

#### Scenario: Monitor de 30 Hz
- **GIVEN** un bucle recién creado
- **WHEN** el motor informa de 33,334 ms
- **THEN** se ejecutan exactamente 2 ticks

#### Scenario: Tiempo independiente del refresco
- **GIVEN** dos bucles con el mismo estado inicial e input (1, 0) constante
- **WHEN** uno recibe 60 frames de 16,667 ms y el otro 165 frames de 6,061 ms (≈ 1 s en ambos)
- **THEN** ambos han ejecutado 60 ticks (±1) y la posición del jugador difiere ≤ 3,4 px (un tick)

### Requirement: Protección contra la espiral de la muerte
El sistema SHALL limitar el tiempo acumulable por frame a 250 ms, de modo que un frame no ejecute más de 15 ticks
aunque la pestaña haya estado congelada.

#### Scenario: Pestaña en segundo plano
- **GIVEN** un bucle recién creado
- **WHEN** el motor informa de 5.000 ms transcurridos en un solo frame
- **THEN** se ejecutan exactamente 15 ticks

#### Scenario: Tiempo negativo o no numérico
- **GIVEN** un bucle recién creado
- **WHEN** el motor informa de −10 ms o de `NaN`
- **THEN** se ejecutan 0 ticks y el acumulador no cambia

### Requirement: Determinismo
El sistema SHALL producir exactamente el mismo `RunSnapshot` a partir del mismo estado inicial y la misma secuencia
de inputs por tick. El núcleo MUST NOT depender de reloj del sistema, aleatoriedad global ni APIs del navegador.

#### Scenario: Dos partidas idénticas
- **GIVEN** dos partidas creadas con el mismo contenido
- **WHEN** ambas reciben la misma secuencia de 600 inputs (10 s) generada por una seed fija
- **THEN** sus snapshots son iguales campo a campo (comparación estricta, sin tolerancia)

#### Scenario: Snapshot no mutable desde fuera
- **GIVEN** una partida en el tick 10
- **WHEN** el adaptador modifica el objeto `RunSnapshot` que ha recibido
- **THEN** el siguiente tick parte del estado interno, no del objeto modificado

### Requirement: Snapshot para el motor
El sistema SHALL exponer tras cada frame un `RunSnapshot` con el número de tick y la posición y el radio del
jugador, que es lo único que el adaptador de render necesita para pintar.

#### Scenario: Contador de ticks
- **GIVEN** una partida recién creada
- **WHEN** se ejecutan 90 ticks
- **THEN** `snapshot.tick` vale 90
