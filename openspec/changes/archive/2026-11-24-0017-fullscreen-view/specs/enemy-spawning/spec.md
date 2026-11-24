# Spec delta · enemy-spawning

<!-- Change 0017-fullscreen-view. El radio del anillo deja de depender de la vista: pasa a ser contenido
     (`spawn.ringRadius`). "Tope de vista" como en el delta de `world-camera` (2.560 × 1.440 por defecto, media
     diagonal √(2.560² + 1.440²) / 2 ≈ 1.468,605). -->

## MODIFIED Requirements

### Requirement: Contenido de enemigos y oleadas validado
El sistema SHALL validar con zod los tipos de enemigo, la tabla de oleadas y los parámetros de spawn antes de que
lleguen al dominio. Un contenido inválido MUST impedir que la partida arranque, con un error que nombre el campo
inválido. Las reglas son las siguientes:
- `speed`, `radius`, `cost`, `health` y `damage` son > 0.
- `xp` es un entero ≥ 1.
- El diámetro de cada tipo cabe en la arena: 2 × `radius` ≤ min(ancho, alto).
- Los `id` de los tipos no se repiten.
- La tabla de oleadas tiene ≥ 1 tramo, el primero tiene `fromSecond` = 0 y los `fromSecond` son estrictamente
  crecientes.
- `budgetPerSecond` es ≥ 0.
- Cada tramo tiene ≥ 1 tipo en `types` y cada tipo citado existe en el catálogo.
- `maxAlive` y `maxAttempts` son enteros ≥ 1.
- `maxBudget` es > 0 y ≥ el mayor `cost` del catálogo.
- `minDistance` es ≥ 0.
- `ringRadius` (radio del anillo de aparición) es > la media diagonal del tope de vista del contenido
  (√(`maxView.width`² + `maxView.height`²) / 2), de modo que ningún punto del anillo sin recorte cae dentro de una
  vista centrada en el jugador, sea cual sea la ventana.
- Los parámetros de spawn MUST NOT incluir `margin` ni ningún tamaño de vista: un campo `margin` o desconocido hace
  fallar la carga con un error que lo nombra.

El contenido por defecto MUST fijar `ringRadius` 1.500.

#### Scenario: Radio del anillo por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** el dominio recibe `ringRadius` 1.500 y ningún tamaño de vista ni de ventana

#### Scenario: Radio del anillo fuera de rango
- **GIVEN** el contenido por defecto (tope 2.560 × 1.440) con, en un caso cada vez, `ringRadius` 0, −1, 1.468 o
  1.468,6, o sin `ringRadius`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `ringRadius`
- **AND** no se crea ninguna partida

#### Scenario: Radio del anillo en el límite
- **GIVEN** el contenido por defecto con `ringRadius` 1.468,61
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Margen heredado
- **GIVEN** el contenido por defecto con `"margin": 32` en los parámetros de spawn
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `margin`

#### Scenario: Oleada con un tipo inexistente
- **GIVEN** un tramo con `"types": ["goblin-torch", "segfault"]` y un catálogo sin `segfault`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `segfault`
- **AND** no se crea ninguna partida

#### Scenario: Oleada con un id antiguo
- **GIVEN** el contenido por defecto con un tramo cuyo `types` es `["bug"]`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `bug`

#### Scenario: Velocidad cero
- **GIVEN** un tipo `goblin-torch` con `"speed": 0`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `speed`

#### Scenario: Vida cero o negativa
- **GIVEN** un tipo `goblin-torch` con `"health": 0` o con `"health": -5`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `health`

#### Scenario: Daño cero o ausente
- **GIVEN** un tipo `goblin-torch` con `"damage": 0` o sin el campo `damage`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `damage`

#### Scenario: XP inválida o ausente
- **GIVEN** un tipo `goblin-torch` con `"xp": 0`, con `"xp": -1`, con `"xp": 1.5` o sin el campo `xp`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `xp`
- **AND** no se crea ninguna partida

#### Scenario: XP mínima válida
- **GIVEN** el contenido por defecto con `"xp": 1` en los 3 tipos
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Radio que no cabe en la arena
- **GIVEN** un tipo con `"radius": 1081` y la arena por defecto de 3.840 × 2.160
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `radius`

#### Scenario: Radio en el límite exacto
- **GIVEN** un tipo con `"radius": 1080` y la arena por defecto de 3.840 × 2.160
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Identificador duplicado
- **GIVEN** un catálogo con dos tipos cuyo `id` es `goblin-torch`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `id`

#### Scenario: Primer tramo que no empieza en 0
- **GIVEN** una tabla de oleadas cuyo primer tramo tiene `"fromSecond": 5`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `fromSecond`

#### Scenario: Tramos desordenados o repetidos
- **GIVEN** tramos con `fromSecond` 0, 60 y 60
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `fromSecond`

#### Scenario: Tope de vivos no entero
- **GIVEN** `"maxAlive": 0` o `"maxAlive": 12.5`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `maxAlive`

#### Scenario: Máximo de presupuesto no positivo
- **GIVEN** `"maxBudget": 0` o `"maxBudget": -1`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `maxBudget`

#### Scenario: Máximo de presupuesto menor que el coste más caro
- **GIVEN** un catálogo cuyo tipo más caro tiene coste 3 y `"maxBudget": 2.5`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `maxBudget`

#### Scenario: Máximo de presupuesto igual al coste más caro
- **GIVEN** un catálogo cuyo tipo más caro es `goblin-tnt` con coste 3, `"maxBudget": 3` y un único tramo con
  `types: ["goblin-tnt"]` y `budgetPerSecond` 1
- **WHEN** se carga el contenido y se ejecutan 185 ticks
- **THEN** la carga tiene éxito y hay exactamente 1 enemigo `goblin-tnt` vivo

### Requirement: Posición de aparición fuera de la vista
El sistema SHALL colocar cada enemigo nuevo así:
1. Toma un punto a una distancia del jugador igual a `ringRadius` (1.500 con el contenido por defecto), en un ángulo
   elegido con el `RandomGenerator`. El radio es un valor de contenido: no depende de la vista, de la ventana ni del
   tamaño del mundo.
2. Recorta ese punto a la arena (el mundo) con la misma regla que al jugador, de modo que el centro quede en
   [radio, ancho − radio] × [radio, alto − radio] usando el radio del enemigo.
3. Acepta la posición solo si, tras el recorte, su distancia al jugador es ≥ `minDistance`.

Si la posición no se acepta, se repite el proceso hasta un total de `maxAttempts` intentos por enemigo. Si ningún
intento es válido, ese enemigo no aparece en este tick, el presupuesto no se gasta y el tipo pendiente se
mantiene. El sistema MUST NOT colocar nunca un enemigo a menos de `minDistance` del jugador ni fuera del mundo. La
posición de aparición no tiene en cuenta el mapa: un enemigo puede aparecer sobre cualquier tipo de celda, también
`castle`. La posición de aparición MUST ser la misma con cualquier tamaño de ventana y con cualquier secuencia de
redimensionados (ver "La cámara no cambia la simulación" en `world-camera`).

Un punto del anillo que no necesita recorte queda siempre fuera de cualquier rectángulo del tamaño del tope de vista
centrado en el jugador (y por tanto de cualquier vista centrada en él). Cuando el recorte actúa (jugador a menos de
`ringRadius` de algún borde del mundo) o la cámara está recortada al mundo, el enemigo puede aparecer dentro del
rectángulo visible de la cámara; esto se acepta y solo se garantizan el mundo y `minDistance`.

#### Scenario: Arena mayor que el anillo
- **GIVEN** una arena explícita de 4.000 × 4.000, el jugador en (2.000, 2.000) y `ringRadius` 1.500
- **WHEN** aparecen 100 enemigos
- **THEN** cada uno está a 1.500 ± 0,001 unidades del jugador
- **AND** ninguno está dentro del rectángulo del tope de vista centrado en el jugador, (720, 1.280)–(3.280, 2.720)

#### Scenario: Jugador en el centro del mundo por defecto
- **GIVEN** el contenido por defecto (mundo de 3.840 × 2.160, `ringRadius` 1.500) y el jugador en (1.920, 1.080)
- **WHEN** aparecen 200 enemigos
- **THEN** el centro de cada uno queda en [radio, 3.840 − radio] × [radio, 2.160 − radio]
- **AND** ninguno tiene el centro dentro del rectángulo del tope de vista centrado en el jugador,
  (640, 360)–(3.200, 1.800)
- **AND** los que no tocan el borde superior ni el inferior del mundo están a 1.500 ± 0,001 unidades del jugador

#### Scenario: Jugador ante la puerta del castillo
- **GIVEN** el contenido por defecto, la semilla 42 y el jugador quieto en su salida (1.950, 1.170)
- **WHEN** aparecen 200 enemigos
- **THEN** el centro de cada uno queda en [radio, 3.840 − radio] × [radio, 2.160 − radio], a ≥ 200 unidades del
  jugador y fuera de (670, 450)–(3.230, 1.890), el rectángulo visible con una ventana igual o mayor que el tope
- **AND** por tanto fuera del rectángulo visible con una ventana de 1.280 × 720, (1.310, 810)–(2.590, 1.530), y con
  una de 960 × 540, (1.470, 900)–(2.430, 1.440)

#### Scenario: Arena menor que el anillo
- **GIVEN** una arena explícita de 960 × 540 en el núcleo (no la del contenido por defecto), el jugador en (480, 270)
  y el resto del contenido de spawn por defecto
- **WHEN** aparecen 200 enemigos
- **THEN** el centro de cada uno queda en [radio, 960 − radio] × [radio, 540 − radio]
- **AND** cada uno está a ≥ 200 unidades del jugador
- **AND** cada uno toca un borde de la arena: x = radio, x = 960 − radio, y = radio o y = 540 − radio

#### Scenario: Jugador en una esquina
- **GIVEN** el mundo de 3.840 × 2.160, el jugador quieto en (16, 16) con una vida máxima suficiente para no llegar a
  0 en 3.600 ticks, y el contenido de spawn por defecto
- **WHEN** se ejecutan 3.600 ticks con un tramo de `budgetPerSecond` 5
- **THEN** cada enemigo aparecido está dentro del mundo y a ≥ 200 unidades del jugador en el tick de su
  aparición

#### Scenario: Jugador en la esquina opuesta
- **GIVEN** el mundo de 3.840 × 2.160, el jugador quieto en (3.824, 2.144) con una vida máxima suficiente para no
  llegar a 0 en 3.600 ticks, y el contenido de spawn por defecto
- **WHEN** se ejecutan 3.600 ticks con un tramo de `budgetPerSecond` 5
- **THEN** cada enemigo aparecido está dentro del mundo y a ≥ 200 unidades del jugador en el tick de su
  aparición

#### Scenario: Ninguna posición válida
- **GIVEN** el mundo de 3.840 × 2.160, `minDistance` 4.500 (mayor que su diagonal, ≈ 4.405,8) y `maxAttempts` 8
- **WHEN** se ejecutan 600 ticks con un tramo de `budgetPerSecond` 5
- **THEN** no hay ningún enemigo vivo y la partida sigue avanzando sin error
- **AND** en cada tick se hacen como mucho 8 intentos de posición

#### Scenario: El presupuesto no se pierde al aplazar
- **GIVEN** un tramo con `budgetPerSecond` 1 y coste 1, `maxBudget` ≥ 2, y un generador aleatorio de prueba con
  el que todos los intentos son inválidos en los ticks 1 a 120 y todos son válidos a partir del tick 121
- **WHEN** se ejecuta el tick 121
- **THEN** aparecen 2 enemigos en ese tick

#### Scenario: Partida larga sin spawns ilegales
- **GIVEN** el contenido por defecto salvo una vida máxima del jugador suficiente para no llegar a 0 en
  36.000 ticks, semilla 7 y un input aleatorio generado por una semilla fija
- **WHEN** se ejecutan 36.000 ticks (10 min)
- **THEN** ningún enemigo aparece fuera de [radio, 3.840 − radio] × [radio, 2.160 − radio] ni a menos de 200
  unidades del jugador

#### Scenario: Mismas apariciones con cualquier ventana
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42, input (0, 0) y la política de elección fija,
  una pintada con una ventana de 960 × 540 y otra con una de 2.560 × 1.440 que pasa a 1.280 × 720 en el tick 600
- **WHEN** ambas ejecutan 1.200 ticks
- **THEN** en cada tick aparecen los mismos enemigos en ambas: mismo identificador, tipo y posición de aparición

<!-- historial: 0017-fullscreen-view (pendiente de archivar) -->
