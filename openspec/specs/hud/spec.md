# HUD · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
El HUD de la partida: vida, tiempo restante, nivel/XP y bajas, derivados del último snapshot sin alterar la simulación.

## Requirements

### Requirement: Contenido y visibilidad del HUD
La vista SHALL mostrar un HUD con cuatro elementos: la vida del jugador (barra y número), el tiempo restante de la
partida, el nivel y la XP (la barra de XP de `leveling`) y las bajas de la partida (ver `run-outcome`). El HUD MUST
verse en todos los estados de la partida (en curso, eligiendo mejora y terminada) y mostrar siempre los valores del
último snapshot pintado: mientras la partida está eligiendo mejora o terminada, sus valores no cambian. El HUD solo
depende del snapshot: no cambia la simulación.

#### Scenario: HUD al empezar
- **GIVEN** el snapshot de una partida recién creada con el contenido por defecto
- **WHEN** se pinta
- **THEN** el HUD es visible y muestra vida `100/100` con la barra de vida llena (relleno 1), tiempo `10:00`, nivel
  1 con la barra de XP vacía y 0 bajas

#### Scenario: HUD con la partida terminada
- **GIVEN** una partida terminada con derrota en el tick 1.259 con nivel 3 y 41 bajas
- **WHEN** se pinta su snapshot y 60 frames más
- **THEN** el HUD sigue visible en todos ellos con vida `0/100`, tiempo `09:40`, nivel 3 y 41 bajas

#### Scenario: El HUD no altera la simulación
- **GIVEN** dos partidas idénticas con la misma semilla, inputs y elecciones, una pintada con HUD y otra sin pintar
- **WHEN** ambas ejecutan 600 ticks con ≥ 1 golpe y ≥ 1 baja
- **THEN** sus snapshots son iguales campo a campo en cada tick

### Requirement: Vida en el HUD
La vista SHALL mostrar la vida como una barra cuyo relleno es vida actual / vida máxima efectiva del último
snapshot, acotado a [0, 1], y como el texto `actual/máxima`. Ambos números se muestran como enteros redondeados
hacia arriba, de modo que un jugador con vida > 0 nunca muestra 0.

#### Scenario: Vida llena
- **GIVEN** un snapshot con vida 100 y vida máxima 100
- **WHEN** se pinta
- **THEN** la barra de vida tiene relleno 1 y el texto es `100/100`

#### Scenario: Vida parcial con la vida máxima mejorada
- **GIVEN** un snapshot con vida 75 y vida máxima 120
- **WHEN** se pinta
- **THEN** la barra de vida tiene relleno 0,625 (error ≤ 0,001) y el texto es `75/120`

#### Scenario: Vida 0
- **GIVEN** un snapshot con vida 0 y vida máxima 100
- **WHEN** se pinta
- **THEN** la barra de vida tiene relleno 0 y el texto es `0/100`

#### Scenario: Vida fraccionaria
- **GIVEN** un snapshot con vida 0,5 y vida máxima 100
- **WHEN** se pinta
- **THEN** el texto es `1/100` y la barra tiene relleno 0,005 (error ≤ 0,001)

#### Scenario: Golpe entre dos snapshots
- **GIVEN** un snapshot pintado con vida 100 de 100 y el siguiente con vida 90 de 100
- **WHEN** se pinta el segundo
- **THEN** la barra de vida tiene relleno 0,9 (error ≤ 0,001) y el texto es `90/100`

### Requirement: Tiempo restante en el HUD
La vista SHALL mostrar el tiempo restante de la partida en formato `mm:ss`, calculado como los segundos restantes
redondeados hacia arriba: ⌈(duración objetivo en ticks − `snapshot.tick`) / 60⌉, nunca menor que 0. `ss` siempre
tiene 2 dígitos (00–59); `mm` tiene al menos 2 dígitos y no se acota a 59 (duraciones de 100 min o más muestran 3
dígitos). Con la duración objetivo por defecto, el HUD muestra `00:00` solo en el snapshot del tick 36.000.

#### Scenario: Valores en torno al inicio
- **GIVEN** una partida con duración objetivo 36.000 ticks
- **WHEN** se pintan los snapshots de los ticks 0, 1, 59, 60 y 61
- **THEN** el tiempo mostrado es `10:00`, `10:00`, `10:00`, `09:59` y `09:59` respectivamente

#### Scenario: Valores en torno al final
- **GIVEN** una partida con duración objetivo 36.000 ticks
- **WHEN** se pintan los snapshots de los ticks 35.940, 35.941, 35.999 y 36.000
- **THEN** el tiempo mostrado es `00:01`, `00:01`, `00:01` y `00:00` respectivamente

#### Scenario: Valor intermedio
- **GIVEN** una partida con duración objetivo 36.000 ticks
- **WHEN** se pinta el snapshot del tick 3.570 (540,5 s restantes)
- **THEN** el tiempo mostrado es `09:01`

#### Scenario: Otras duraciones
- **GIVEN** partidas con `durationSeconds` 90, 3.600 y 6.000
- **WHEN** se pinta el snapshot del tick 0 de cada una
- **THEN** el tiempo mostrado es `01:30`, `60:00` y `100:00` respectivamente

#### Scenario: El tiempo no corre mientras se elige mejora
- **GIVEN** una partida con duración objetivo 36.000 ticks que abre una oferta en el tick 600
- **WHEN** el motor informa de 600 frames de 16,667 ms con la oferta abierta
- **THEN** el tiempo mostrado es `09:50` en todos esos frames

### Requirement: Nivel y XP en el HUD
La vista SHALL incluir en el HUD la barra de XP y el número del nivel definidos en `leveling` ("Barra de XP y nivel
en la vista"), con el mismo comportamiento.

#### Scenario: Barra de XP dentro del HUD
- **GIVEN** un snapshot con nivel 2, XP 3 y XP para el siguiente nivel 10
- **WHEN** se pinta
- **THEN** el HUD muestra nivel 2 y la barra de XP tiene relleno 0,3 (error ≤ 0,001)

### Requirement: Bajas en el HUD
La vista SHALL mostrar el número de bajas del último snapshot como un entero completo, sin abreviar ni truncar.

#### Scenario: Sin bajas
- **GIVEN** un snapshot con 0 bajas
- **WHEN** se pinta
- **THEN** el HUD muestra 0 bajas

#### Scenario: Bajas que cambian entre snapshots
- **GIVEN** un snapshot pintado con 9 bajas y el siguiente con 12
- **WHEN** se pinta el segundo
- **THEN** el HUD muestra 12 bajas

#### Scenario: Muchas bajas
- **GIVEN** un snapshot con 12.345 bajas
- **WHEN** se pinta
- **THEN** el HUD muestra el número 12345 completo

<!-- historial: 0006-run-lifecycle-hud (2026-11-20) -->
