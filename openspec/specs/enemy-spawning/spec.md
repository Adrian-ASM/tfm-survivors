# Enemy spawning · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
Los enemigos aparecen en oleadas que crecen con el tiempo: un director gasta un presupuesto por tramos y los coloca fuera de la vista del jugador, dentro de la arena y con un tope de vivos.

## Requirements

### Requirement: Catálogo de tipos de enemigo
El sistema SHALL definir los tipos de enemigo exclusivamente desde contenido. Cada tipo tiene un identificador
único, una velocidad, un radio, un coste, una vida (`health`), la XP que suelta al morir (`xp`), un comportamiento
(ver "Comportamiento por tipo en contenido" en `enemy-behavior`) y, opcionalmente, un daño por contacto (`damage`): un
tipo sin `damage` nunca hace daño por contacto (ver `player-health`). El contenido por defecto MUST incluir
exactamente 3 tipos, uno por unidad goblin del pack: `goblin-torch`, `goblin-tnt` y `goblin-barrel`. Ningún id de
enemigo del contenido es `bug`, `memory-leak` ni `merge-conflict`.

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** el catálogo tiene 3 tipos con identificadores `goblin-torch`, `goblin-tnt` y `goblin-barrel`
- **AND** cada uno tiene una velocidad > 0, un radio > 0, un coste > 0, una vida > 0, una XP ≥ 1 y un comportamiento
- **AND** `goblin-torch` y `goblin-tnt` tienen un daño por contacto > 0 y `goblin-barrel` no tiene daño por contacto

#### Scenario: Stats por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** `goblin-torch` tiene `speed` 90, `radius` 10, `cost` 1, `damage` 5, `health` 10 y `xp` 1
- **AND** `goblin-tnt` tiene `speed` 45, `radius` 22, `cost` 3, `damage` 15, `health` 45 y `xp` 4
- **AND** `goblin-barrel` tiene `speed` 70, `radius` 16, `cost` 2, `health` 20, `xp` 2 y ningún `damage`
- **AND** `content/waves.json` cita en cada tramo los mismos tipos que antes del change

#### Scenario: XP por defecto de cada tipo
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** `goblin-torch` tiene `xp` 1, `goblin-barrel` 2 y `goblin-tnt` 4

#### Scenario: Valores de cada tipo llegan al dominio
- **GIVEN** un tipo `goblin-torch` con `{ "speed": 90, "radius": 10, "cost": 1, "health": 5, "damage": 10, "xp": 3 }`
  y su comportamiento de persecución
- **WHEN** se carga el contenido y aparece un enemigo `goblin-torch`
- **THEN** ese enemigo tiene radio 10, vida 5 y se mueve a 90 unidades/s
- **AND** un golpe suyo resta 10 de vida al jugador
- **AND** al morir por armas suelta una gema que da 3 de XP

### Requirement: Contenido de enemigos y oleadas validado
El sistema SHALL validar con zod los tipos de enemigo (comportamiento incluido, ver "Comportamiento por tipo en
contenido" en `enemy-behavior`), la tabla de oleadas y los parámetros de spawn antes de que lleguen al dominio. Un
contenido inválido MUST impedir que la partida arranque, con un error que nombre el campo inválido. Las reglas son las
siguientes:
- `speed`, `radius`, `cost` y `health` son > 0.
- `damage`, si está presente, es > 0; si falta, el tipo no hace daño por contacto.
- `xp` es un entero ≥ 1.
- Cada tipo tiene un comportamiento válido; un tipo sin comportamiento hace fallar la carga con un error que nombra
  el tipo.
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

#### Scenario: Daño cero o negativo
- **GIVEN** un tipo `goblin-torch` con `"damage": 0` o con `"damage": -3`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `damage`

#### Scenario: Daño ausente
- **GIVEN** el contenido por defecto con `goblin-torch` sin el campo `damage`
- **WHEN** se carga el contenido y un `goblin-torch` queda en contacto con el jugador durante 60 ticks
- **THEN** la carga tiene éxito y la vida del jugador no baja por ese contacto

#### Scenario: Tipo sin comportamiento
- **GIVEN** el contenido por defecto con `goblin-torch` sin comportamiento
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `goblin-torch` y el comportamiento

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

### Requirement: Oleadas por tramos de tiempo
El sistema SHALL elegir en cada tick el tramo activo de la tabla de oleadas: el último cuyo `fromSecond` sea
≤ al tiempo de partida. El último tramo sigue activo hasta el final de la partida. Solo MUST aparecer enemigos de
los tipos permitidos en el tramo activo.

#### Scenario: Cambio de tramo
- **GIVEN** un tramo 0 con `types: ["goblin-torch"]` y un tramo 1 con `fromSecond` 30 y `types: ["goblin-tnt"]`,
  ambos con `budgetPerSecond` 1, un tope de 200 y un jugador con una vida máxima suficiente para no llegar a 0 en
  3.600 ticks
- **WHEN** se ejecutan 3.600 ticks (60 s)
- **THEN** todos los enemigos aparecidos antes del tick 1.790 son `goblin-torch`
- **AND** todos los aparecidos después del tick 1.810 son `goblin-tnt`

#### Scenario: Un solo tramo
- **GIVEN** una tabla con un único tramo, `fromSecond` 0 y `types: ["goblin-torch"]`, y un jugador con una vida máxima
  suficiente para no llegar a 0 en 36.000 ticks
- **WHEN** se ejecutan 36.000 ticks (10 min)
- **THEN** todos los enemigos aparecidos son `goblin-torch`

#### Scenario: Tramo sin presupuesto
- **GIVEN** un único tramo con `budgetPerSecond` 0
- **WHEN** se ejecutan 600 ticks
- **THEN** no hay ningún enemigo vivo

### Requirement: Director por presupuesto
El sistema SHALL acumular en cada tick un presupuesto de `budgetPerSecond × 1/60` del tramo activo, también
mientras haya `maxAlive` enemigos vivos. Tras sumarlo, el presupuesto acumulado MUST recortarse a `maxBudget`
antes de gastarse: nunca vale más que `maxBudget`. Funciona así:
- Mientras haya un tipo pendiente, se espera a que el presupuesto alcance su coste.
- El tipo pendiente MUST elegirse con el `RandomGenerator` entre los tipos permitidos del tramo activo.
- Cuando el presupuesto acumulado alcanza el coste del tipo pendiente y hay menos de `maxAlive` enemigos vivos,
  aparece un enemigo de ese tipo, se resta su coste y se elige un nuevo tipo pendiente.
- En un mismo tick pueden aparecer varios enemigos si el presupuesto y el tope lo permiten.
- Al cambiar de tramo, el presupuesto acumulado se conserva y el tipo pendiente se vuelve a elegir entre los
  tipos del nuevo tramo.
- Un enemigo no se mueve en el tick en que aparece.
- El director no actúa en el tick en que la partida termina ni en los siguientes (ver `run-state`).

#### Scenario: Ritmo constante con coste 1
- **GIVEN** un único tramo con `budgetPerSecond` 1 y `types: ["goblin-torch"]`, `goblin-torch` con coste 1, `maxBudget` 3
  y un tope de 200
- **WHEN** se ejecutan 615 ticks (10,25 s)
- **THEN** hay exactamente 10 enemigos vivos

#### Scenario: El coste retrasa la aparición
- **GIVEN** un único tramo con `budgetPerSecond` 1 y `types: ["goblin-tnt"]`, `goblin-tnt` con coste 3
  y `maxBudget` 3
- **WHEN** se ejecutan 175 ticks y después 10 ticks más
- **THEN** tras 175 ticks hay 0 enemigos y tras 185 ticks hay exactamente 1

#### Scenario: Varios spawns en un tick
- **GIVEN** un único tramo con `budgetPerSecond` 630 y `types: ["goblin-torch"]`, `goblin-torch` con coste 1,
  `maxBudget` 20 y un tope de 200
- **WHEN** se ejecuta 1 tick
- **THEN** hay exactamente 10 enemigos vivos

#### Scenario: El máximo acota los spawns de un tick
- **GIVEN** un único tramo con `budgetPerSecond` 630 y `types: ["goblin-torch"]`, `goblin-torch` con coste 1,
  `maxBudget` 5 y un tope de 200
- **WHEN** se ejecuta 1 tick
- **THEN** hay exactamente 5 enemigos vivos

#### Scenario: Mezcla de tipos
- **GIVEN** un único tramo con `types: ["goblin-torch", "goblin-tnt", "goblin-barrel"]`, `budgetPerSecond` 2,
  semilla 1, un tope de 200 y un jugador con una vida máxima suficiente para no llegar a 0 en 36.000 ticks
- **WHEN** se ejecutan 36.000 ticks
- **THEN** aparece ≥ 1 enemigo de cada uno de los 3 tipos

#### Scenario: Oleadas que crecen con el contenido por defecto
- **GIVEN** la tabla de oleadas por defecto
- **WHEN** se recorren sus tramos en orden
- **THEN** el `budgetPerSecond` de cada tramo es ≥ el del tramo anterior

### Requirement: Tope de enemigos vivos
El sistema SHALL impedir que el número de enemigos vivos supere `maxAlive` (**300** por defecto). Mientras haya
`maxAlive` enemigos vivos, no MUST aparecer ninguno más, pero el presupuesto sigue acumulándose hasta `maxBudget`.
Los enemigos dados de baja no cuentan como vivos. Cuando el número de vivos baja del tope, el director gasta el
presupuesto acumulado con las reglas de siempre, sin superar nunca `maxAlive`, aunque el presupuesto guardado
alcance para más enemigos.

#### Scenario: Tope por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** el dominio recibe `maxAlive` 300
- **AND** los tramos, el `budgetPerSecond` de cada uno y `maxBudget` son los mismos que antes del change

#### Scenario: Se alcanza el tope
- **GIVEN** un único tramo con `budgetPerSecond` 1.000 y `types: ["goblin-torch"]`, `goblin-torch` con coste 1,
  `maxBudget` 20 y `maxAlive` 200
- **WHEN** se ejecutan 13 ticks
- **THEN** hay exactamente 200 enemigos vivos

#### Scenario: El tope se mantiene
- **GIVEN** la partida del escenario anterior tras 13 ticks
- **WHEN** se ejecutan 600 ticks más
- **THEN** siguen vivos exactamente 200 enemigos

#### Scenario: Se alcanza el tope por defecto
- **GIVEN** un único tramo con `budgetPerSecond` 1.000 y `types: ["goblin-torch"]`, `goblin-torch` con coste 1,
  `maxBudget` 20, `maxAlive` 300 y un jugador con una vida suficiente para no llegar a 0 en 619 ticks
- **WHEN** se ejecutan 19 ticks y después 600 ticks más
- **THEN** tras 19 ticks hay exactamente 300 enemigos vivos
- **AND** tras los 600 ticks siguientes siguen vivos exactamente 300

#### Scenario: Tope mínimo
- **GIVEN** `maxAlive` 1 y un único tramo con `budgetPerSecond` 10
- **WHEN** se ejecutan 600 ticks
- **THEN** hay exactamente 1 enemigo vivo

#### Scenario: Reposición de una baja sin superar el tope
- **GIVEN** la partida de "El tope se mantiene" tras sus 600 ticks, con el presupuesto guardado en `maxBudget` 20
- **WHEN** 1 enemigo queda dado de baja y se ejecuta 1 tick
- **THEN** hay exactamente 200 enemigos vivos (aparece 1, no 20)

#### Scenario: Presupuesto en el máximo al abrirse varios huecos
- **GIVEN** `maxAlive` 5, `maxBudget` 3, un único tramo con `budgetPerSecond` 60 y `types: ["goblin-torch"]`,
  `goblin-torch` con coste 1, y una partida con 5 enemigos vivos que lleva 600 ticks en el tope
- **WHEN** los 5 enemigos quedan dados de baja y se ejecuta 1 tick, y después 1 tick más
- **THEN** tras el primer tick hay exactamente 3 enemigos vivos (presupuesto guardado 3, no 600 ni 1)
- **AND** tras el segundo tick hay exactamente 4

#### Scenario: Huecos sin presupuesto suficiente
- **GIVEN** `maxAlive` 5, `maxBudget` 3, un único tramo con `budgetPerSecond` 0, presupuesto acumulado 0 y 5
  enemigos vivos
- **WHEN** 2 enemigos quedan dados de baja y se ejecutan 600 ticks
- **THEN** hay exactamente 3 enemigos vivos

### Requirement: Posición de aparición fuera de la vista
El sistema SHALL colocar cada enemigo nuevo así, en cada intento:
1. Toma un punto a una distancia del jugador igual a `ringRadius` (1.500 con el contenido por defecto), en un ángulo
   elegido con el `RandomGenerator`. El radio es un valor de contenido: no depende de la vista, de la ventana ni del
   tamaño del mundo.
2. Recorta ese punto a la arena (el mundo) con la misma regla que al jugador, de modo que el centro quede en
   [radio, ancho − radio] × [radio, alto − radio] usando el radio del enemigo.
3. Si el punto recortado está en una celda no caminable del mapa de la partida (`trunk`, `water` o `castle`), lo
   **recoloca** en el centro de la celda caminable más cercana, con el criterio de "Recolocación de gemas en celdas no
   caminables" de `xp-gems`: menor distancia euclídea entre el punto y el centro de la celda (el del rectángulo
   recortado en una celda del borde); a igual distancia, fila menor y, a igual fila, columna menor. Un punto en una
   celda caminable conserva exactamente su posición. El resultado MUST seguir dentro del mundo con la regla del paso 2.
4. Acepta la posición final (tras recortar y, si procede, recolocar) solo si su distancia al jugador es
   ≥ `minDistance`.

Cada intento MUST consumir exactamente 1 valor del `RandomGenerator` (el del ángulo), se recoloque o no: recolocar no
consume azar. Si la posición no se acepta, se repite el proceso hasta un total de `maxAttempts` intentos por enemigo.
Si ningún intento es válido, ese enemigo no aparece en este tick, el presupuesto no se gasta y el tipo pendiente se
mantiene. El sistema MUST NOT colocar nunca un enemigo a menos de `minDistance` del jugador ni fuera del mundo, ni,
con un mapa que tenga ≥ 1 celda caminable, con el centro en una celda no caminable. Si el mapa no tiene ninguna celda
caminable, el intento no es válido. La posición de aparición MUST ser la misma con cualquier tamaño de ventana y con
cualquier secuencia de redimensionados (ver "La cámara no cambia la simulación" en `world-camera`). Con el mapa vacío
la colocación es exactamente la de antes del change. Los enemigos que un escenario de test coloca directamente (sin
director) no se recolocan.

Un punto del anillo que no necesita recorte ni recolocación queda siempre fuera de cualquier rectángulo del tamaño del
tope de vista centrado en el jugador (y por tanto de cualquier vista centrada en él). Cuando el recorte actúa (jugador
a menos de `ringRadius` de algún borde del mundo), la recolocación actúa o la cámara está recortada al mundo, el
enemigo puede aparecer dentro del rectángulo visible de la cámara; esto se acepta y solo se garantizan el mundo,
`minDistance` y la celda caminable.

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
- **GIVEN** el contenido por defecto, la semilla 42 con su mapa generado y el jugador quieto en su salida
  (1.950, 1.170)
- **WHEN** aparecen 200 enemigos
- **THEN** el centro de cada uno queda en [radio, 3.840 − radio] × [radio, 2.160 − radio], en una celda caminable y a
  ≥ 200 unidades del jugador
- **AND** los no recolocados quedan fuera de (670, 450)–(3.230, 1.890), el rectángulo visible con una ventana igual o
  mayor que el tope
- **AND** todos, recolocados o no, quedan fuera del rectángulo visible con una ventana de 1.280 × 720,
  (1.310, 810)–(2.590, 1.530), y con una de 960 × 540, (1.470, 900)–(2.430, 1.440)

#### Scenario: Aparición sobre agua recolocada
- **GIVEN** un mapa de hierba de 64 × 36 con la celda (5, 4) de `water` (x en [300, 360], y en [240, 300]), y un
  intento cuyo punto recortado es (310, 250), dentro de esa celda, a ≥ `minDistance` del jugador
- **WHEN** se coloca el enemigo
- **THEN** aparece exactamente en (330, 210), centro de la celda (5, 3): está a 44,72 px, empatada con el centro de la
  (4, 4), (270, 270), y gana por fila menor
- **AND** en ese intento se ha consumido exactamente 1 valor del `RandomGenerator`

#### Scenario: Recolocación con castillo y río
- **GIVEN** el contenido por defecto y, para cada semilla de 1 a 50, su mapa generado, el jugador quieto en su salida
  con una vida suficiente para no llegar a 0 en 3.600 ticks y la política de elección fija
- **WHEN** se ejecutan 3.600 ticks con cada semilla
- **THEN** ningún enemigo aparece con el centro en una celda `trunk`, `water` o `castle`
- **AND** ninguno aparece fuera del mundo ni a menos de 200 unidades del jugador

#### Scenario: 1 valor de azar por intento con y sin recolocación
- **GIVEN** dos partidas con la misma semilla y el mismo estado salvo el mapa: en una el punto del intento cae en una
  celda `trunk` y se recoloca, y en la otra (mapa vacío) cae en hierba
- **WHEN** ambas colocan 1 enemigo con 1 intento válido
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras la colocación

#### Scenario: Recolocación que queda demasiado cerca
- **GIVEN** una arena explícita de 960 × 540 (rejilla de 16 × 9), un mapa todo `trunk` salvo las celdas de columnas
  6–9 y filas 3–5 (x en [360, 600], y en [180, 360]), el jugador quieto en (480, 270), `minDistance` 200,
  `maxAttempts` 8 y un tramo con `budgetPerSecond` 5 (todo punto recolocado cae a ≤ 128 px del jugador)
- **WHEN** se ejecutan 600 ticks
- **THEN** no hay ningún enemigo vivo y la partida sigue avanzando sin error
- **AND** en cada tick se hacen como mucho 8 intentos y cada uno consume exactamente 1 valor del `RandomGenerator`

#### Scenario: Mapa sin celdas caminables
- **GIVEN** un mapa explícito de 64 × 36 todo `trunk`, sin salida declarada, `maxAttempts` 8 y un tramo con
  `budgetPerSecond` 5
- **WHEN** se ejecutan 600 ticks
- **THEN** no hay ningún enemigo vivo y la partida sigue avanzando sin error
- **AND** en cada tick se hacen como mucho 8 intentos de posición

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
  36.000 ticks, semilla 7 con su mapa generado y un input aleatorio generado por una semilla fija
- **WHEN** se ejecutan 36.000 ticks (10 min)
- **THEN** ningún enemigo aparece fuera de [radio, 3.840 − radio] × [radio, 2.160 − radio], a menos de 200
  unidades del jugador ni con el centro en una celda no caminable

#### Scenario: Mismas apariciones con cualquier ventana
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42, input (0, 0) y la política de elección fija,
  una pintada con una ventana de 960 × 540 y otra con una de 2.560 × 1.440 que pasa a 1.280 × 720 en el tick 600
- **WHEN** ambas ejecutan 1.200 ticks
- **THEN** en cada tick aparecen los mismos enemigos en ambas: mismo identificador, tipo y posición de aparición

### Requirement: Vida y baja de enemigos
El sistema SHALL dar a cada enemigo, al aparecer, una vida igual al `health` de su tipo. Aplicar a un enemigo
vivo un daño d > 0 MUST reducir su vida en d, sin bajar de 0. Un enemigo queda dado de baja cuando su vida llega a 0
o cuando explota al terminar su mecha (ver "Kamikaze del Goblin Barril" en `enemy-behavior`): deja de estar vivo de
forma irreversible, suelta exactamente una gema con el `xp` de su tipo en su posición (ver `xp-gems`) y desde ese
momento:
- no aparece en ningún snapshot;
- no se mueve, no cambia de estado, no lanza ni explota, ni hace contacto con el jugador;
- no es objetivo ni recibe daño de ningún arma ni de ninguna explosión;
- no cuenta para `maxAlive`;
- su identificador no se reutiliza para ningún otro enemigo de la partida.

Aplicar daño a un enemigo ya dado de baja no tiene efecto ni suelta otra gema. En juego, los mecanismos que dañan a
los enemigos son las armas (ver `auto-weapons`), cuyos impactos restan el `damage` efectivo del arma que golpea (base
de contenido más mejoras, ver `upgrades`), y las explosiones (ver "Explosión de área" en `enemy-hazards`), que restan
su daño de explosión. Una baja por explosión, sea la del barril que explota o la de un enemigo alcanzado, cuenta y
suelta gema igual que una baja por armas. Un enemigo que llega a vida 0 por armas y por una explosión en el mismo tick
queda dado de baja una sola vez, en el paso de armas (ver "Orden de los pasos del tick" en `simulation-loop`). El
contacto con el jugador no les quita vida.

#### Scenario: Vida inicial del tipo
- **GIVEN** un tipo `goblin-torch` con `health` 5
- **WHEN** aparece un enemigo `goblin-torch`
- **THEN** su vida vale 5

#### Scenario: Vida por defecto de cada tipo
- **GIVEN** el contenido por defecto
- **WHEN** aparece un enemigo de cada tipo
- **THEN** `goblin-torch` tiene vida 10, `goblin-barrel` 20 y `goblin-tnt` 45

#### Scenario: Daño que no mata
- **GIVEN** un enemigo vivo con vida inicial 5 y un arma con `damage` 3
- **WHEN** el arma le golpea una vez en el tick n
- **THEN** sigue vivo, con vida 2, y sigue en el snapshot del tick n
- **AND** no se suelta ninguna gema

#### Scenario: Daño exactamente igual a la vida
- **GIVEN** un enemigo vivo con identificador X y vida 5 en el snapshot del tick n − 1, y un arma con `damage` 5
- **WHEN** el arma le golpea una vez en el tick n
- **THEN** el snapshot del tick n no contiene ningún enemigo con identificador X
- **AND** contiene una gema nueva en la posición que tenía X

#### Scenario: Daño mayor que la vida
- **GIVEN** un enemigo vivo con vida 5 y un arma con `damage` 7
- **WHEN** el arma le golpea una vez
- **THEN** queda dado de baja igual que con un daño de 5 y suelta una sola gema

#### Scenario: Daño a un enemigo ya dado de baja
- **GIVEN** un enemigo dado de baja y un proyectil en vuelo cuya trayectoria pasa por la última posición que tuvo
- **WHEN** el proyectil llega a esa posición
- **THEN** no se produce ningún error, el número de enemigos vivos no cambia, no se suelta otra gema y el proyectil
  sigue en vuelo

#### Scenario: Identificador no reutilizado
- **GIVEN** `maxAlive` 1, un único tramo con `budgetPerSecond` 60, `goblin-torch` con coste 1 y un enemigo vivo con
  identificador X
- **WHEN** X queda dado de baja y se ejecutan 60 ticks
- **THEN** hay exactamente 1 enemigo vivo y su identificador es distinto de X

#### Scenario: Golpear al jugador no quita vida al enemigo
- **GIVEN** una partida sin armas equipadas y un enemigo con vida inicial 5 en contacto continuo con el jugador
- **WHEN** se ejecutan 600 ticks con la partida en curso
- **THEN** el enemigo sigue vivo con vida 5 y no hay ninguna gema

#### Scenario: Daño efectivo con mejoras
- **GIVEN** un `goblin-torch` con vida 10 y la mejora `strict-rules` en nivel 1 (Linter con `damage` 9)
- **WHEN** recibe 1 impacto de un proyectil del Linter creado tras la elección
- **THEN** sigue vivo con vida 1

#### Scenario: Baja por explosión ajena
- **GIVEN** un `goblin-torch` con identificador X y vida 10 dentro del radio de una explosión de daño 25 en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el snapshot del tick n no contiene a X, contiene una gema nueva de valor 1 en la posición que tenía X y las
  bajas han subido en 1

#### Scenario: Armas y explosión en el mismo tick
- **GIVEN** un `goblin-torch` con vida 4 que recibe en el tick n un impacto mortal del Linter y está dentro del radio
  de una explosión de ese mismo tick
- **WHEN** se ejecuta el tick n
- **THEN** las bajas suben exactamente en 1 y hay exactamente 1 gema nueva de ese `goblin-torch`

#### Scenario: El hueco del barril que explota se repone en el mismo tick
- **GIVEN** `maxAlive` 1, un único `goblin-barrel` vivo cuya mecha termina en el tick n y un director con presupuesto
  para 1 `goblin-torch` y `goblin-torch` como tipo pendiente
- **WHEN** se ejecuta el tick n
- **THEN** el snapshot del tick n tiene exactamente 1 enemigo vivo, un `goblin-torch` distinto del barril

<!-- historial: 0002-enemy-spawning (2026-11-19) -->
<!-- historial: 0003-collisions-and-damage (2026-11-19) -->
<!-- historial: 0004-auto-weapons (2026-11-19) -->
<!-- historial: 0005-xp-and-level-up (2026-11-19) -->
<!-- historial: 0012-sprite-rendering (2026-11-22) -->
<!-- historial: 0013-world-camera (2026-11-23) -->
<!-- historial: 0016-map-art (2026-11-23) -->
<!-- historial: 0017-fullscreen-view (2026-11-24) -->
<!-- historial: 0019-flow-field (2026-11-24) -->
<!-- historial: 0020-enemy-behaviors (2026-11-24) -->
