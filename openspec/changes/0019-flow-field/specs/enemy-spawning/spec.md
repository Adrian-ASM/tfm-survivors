# Spec delta · enemy-spawning

<!-- Change 0019-flow-field. La aparición se recoloca en la celda caminable más cercana si cae en una no caminable
     (mismo criterio que las gemas) y el tope de vivos por defecto pasa de 200 a 300 (GDD). El presupuesto de oleadas
     (tramos, `budgetPerSecond`, `maxBudget`) no cambia (decisión del gate, 2026-11-24). -->

## MODIFIED Requirements

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

<!-- historial: 0019-flow-field (pendiente de archivar) -->
