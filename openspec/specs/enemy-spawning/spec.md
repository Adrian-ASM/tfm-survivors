# Enemy spawning · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
Los enemigos aparecen en oleadas que crecen con el tiempo: un director gasta un presupuesto por tramos y los coloca fuera de la vista del jugador, dentro de la arena y con un tope de vivos.

## Requirements

### Requirement: Catálogo de tipos de enemigo
El sistema SHALL definir los tipos de enemigo exclusivamente desde contenido. Cada tipo tiene un identificador
único, una velocidad, un radio, un coste, una vida (`health`), un daño por contacto (`damage`) y la XP que suelta
al morir (`xp`). El contenido por defecto MUST incluir exactamente los 3 tipos del GDD: `bug`, `memory-leak` y
`merge-conflict`. Los tipos solo se diferencian en esos valores.

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** el catálogo tiene 3 tipos con identificadores `bug`, `memory-leak` y `merge-conflict`
- **AND** cada uno tiene una velocidad > 0, un radio > 0, un coste > 0, una vida > 0, un daño > 0 y una XP ≥ 1

#### Scenario: XP por defecto de cada tipo
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** `bug` tiene `xp` 1, `merge-conflict` 2 y `memory-leak` 4 (provisional, a medir en apply)

#### Scenario: Valores de cada tipo llegan al dominio
- **GIVEN** un tipo `bug` con `{ "speed": 90, "radius": 10, "cost": 1, "health": 5, "damage": 10, "xp": 3 }`
- **WHEN** se carga el contenido y aparece un enemigo `bug`
- **THEN** ese enemigo tiene radio 10, vida 5 y se mueve a 90 unidades/s
- **AND** un golpe suyo resta 10 de vida al jugador
- **AND** al morir por armas suelta una gema que da 3 de XP

### Requirement: Contenido de enemigos y oleadas validado
El sistema SHALL validar con zod los tipos de enemigo, la tabla de oleadas, la vista y los parámetros de spawn
antes de que lleguen al dominio. Un contenido inválido MUST impedir que la partida arranque, con un error que
nombre el campo inválido. Las reglas son las siguientes:
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
- `margin` y `minDistance` son ≥ 0.
- `width` y `height` de la vista son > 0.

#### Scenario: Oleada con un tipo inexistente
- **GIVEN** un tramo con `"types": ["bug", "segfault"]` y un catálogo sin `segfault`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `segfault`
- **AND** no se crea ninguna partida

#### Scenario: Velocidad cero
- **GIVEN** un tipo `bug` con `"speed": 0`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `speed`

#### Scenario: Vida cero o negativa
- **GIVEN** un tipo `bug` con `"health": 0` o con `"health": -5`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `health`

#### Scenario: Daño cero o ausente
- **GIVEN** un tipo `bug` con `"damage": 0` o sin el campo `damage`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `damage`

#### Scenario: XP inválida o ausente
- **GIVEN** un tipo `bug` con `"xp": 0`, con `"xp": -1`, con `"xp": 1.5` o sin el campo `xp`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `xp`
- **AND** no se crea ninguna partida

#### Scenario: XP mínima válida
- **GIVEN** el contenido por defecto con `"xp": 1` en los 3 tipos
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Radio que no cabe en la arena
- **GIVEN** un tipo con `"radius": 300` y una arena de 960 × 540
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `radius`

#### Scenario: Radio en el límite exacto
- **GIVEN** un tipo con `"radius": 270` y una arena de 960 × 540
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Identificador duplicado
- **GIVEN** un catálogo con dos tipos cuyo `id` es `bug`
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
- **GIVEN** un catálogo cuyo tipo más caro es `memory-leak` con coste 3, `"maxBudget": 3` y un único tramo con
  `types: ["memory-leak"]` y `budgetPerSecond` 1
- **WHEN** se carga el contenido y se ejecutan 185 ticks
- **THEN** la carga tiene éxito y hay exactamente 1 enemigo `memory-leak` vivo

### Requirement: Oleadas por tramos de tiempo
El sistema SHALL elegir en cada tick el tramo activo de la tabla de oleadas: el último cuyo `fromSecond` sea
≤ al tiempo de partida. El último tramo sigue activo hasta el final de la partida. Solo MUST aparecer enemigos de
los tipos permitidos en el tramo activo.

#### Scenario: Cambio de tramo
- **GIVEN** un tramo 0 con `types: ["bug"]` y un tramo 1 con `fromSecond` 30 y `types: ["memory-leak"]`, ambos
  con `budgetPerSecond` 1, un tope de 200 y un jugador con una vida máxima suficiente para no llegar a 0 en
  3.600 ticks
- **WHEN** se ejecutan 3.600 ticks (60 s)
- **THEN** todos los enemigos aparecidos antes del tick 1.790 son `bug`
- **AND** todos los aparecidos después del tick 1.810 son `memory-leak`

#### Scenario: Un solo tramo
- **GIVEN** una tabla con un único tramo, `fromSecond` 0 y `types: ["bug"]`, y un jugador con una vida máxima
  suficiente para no llegar a 0 en 36.000 ticks
- **WHEN** se ejecutan 36.000 ticks (10 min)
- **THEN** todos los enemigos aparecidos son `bug`

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
- **GIVEN** un único tramo con `budgetPerSecond` 1 y `types: ["bug"]`, `bug` con coste 1, `maxBudget` 3 y un
  tope de 200
- **WHEN** se ejecutan 615 ticks (10,25 s)
- **THEN** hay exactamente 10 enemigos vivos

#### Scenario: El coste retrasa la aparición
- **GIVEN** un único tramo con `budgetPerSecond` 1 y `types: ["memory-leak"]`, `memory-leak` con coste 3 y
  `maxBudget` 3
- **WHEN** se ejecutan 175 ticks y después 10 ticks más
- **THEN** tras 175 ticks hay 0 enemigos y tras 185 ticks hay exactamente 1

#### Scenario: Varios spawns en un tick
- **GIVEN** un único tramo con `budgetPerSecond` 630 y `types: ["bug"]`, `bug` con coste 1, `maxBudget` 20 y un
  tope de 200
- **WHEN** se ejecuta 1 tick
- **THEN** hay exactamente 10 enemigos vivos

#### Scenario: El máximo acota los spawns de un tick
- **GIVEN** un único tramo con `budgetPerSecond` 630 y `types: ["bug"]`, `bug` con coste 1, `maxBudget` 5 y un
  tope de 200
- **WHEN** se ejecuta 1 tick
- **THEN** hay exactamente 5 enemigos vivos

#### Scenario: Mezcla de tipos
- **GIVEN** un único tramo con `types: ["bug", "memory-leak", "merge-conflict"]`, `budgetPerSecond` 2,
  semilla 1, un tope de 200 y un jugador con una vida máxima suficiente para no llegar a 0 en 36.000 ticks
- **WHEN** se ejecutan 36.000 ticks
- **THEN** aparece ≥ 1 enemigo de cada uno de los 3 tipos

#### Scenario: Oleadas que crecen con el contenido por defecto
- **GIVEN** la tabla de oleadas por defecto
- **WHEN** se recorren sus tramos en orden
- **THEN** el `budgetPerSecond` de cada tramo es ≥ el del tramo anterior

### Requirement: Tope de enemigos vivos
El sistema SHALL impedir que el número de enemigos vivos supere `maxAlive` (200 por defecto). Mientras haya
`maxAlive` enemigos vivos, no MUST aparecer ninguno más, pero el presupuesto sigue acumulándose hasta `maxBudget`.
Los enemigos dados de baja no cuentan como vivos. Cuando el número de vivos baja del tope, el director gasta el
presupuesto acumulado con las reglas de siempre, sin superar nunca `maxAlive`, aunque el presupuesto guardado
alcance para más enemigos.

#### Scenario: Se alcanza el tope
- **GIVEN** un único tramo con `budgetPerSecond` 1.000 y `types: ["bug"]`, `bug` con coste 1, `maxBudget` 20 y
  `maxAlive` 200
- **WHEN** se ejecutan 13 ticks
- **THEN** hay exactamente 200 enemigos vivos

#### Scenario: El tope se mantiene
- **GIVEN** la partida del escenario anterior tras 13 ticks
- **WHEN** se ejecutan 600 ticks más
- **THEN** siguen vivos exactamente 200 enemigos

#### Scenario: Tope mínimo
- **GIVEN** `maxAlive` 1 y un único tramo con `budgetPerSecond` 10
- **WHEN** se ejecutan 600 ticks
- **THEN** hay exactamente 1 enemigo vivo

#### Scenario: Reposición de una baja sin superar el tope
- **GIVEN** la partida de "El tope se mantiene" tras sus 600 ticks, con el presupuesto guardado en `maxBudget` 20
- **WHEN** 1 enemigo queda dado de baja y se ejecuta 1 tick
- **THEN** hay exactamente 200 enemigos vivos (aparece 1, no 20)

#### Scenario: Presupuesto en el máximo al abrirse varios huecos
- **GIVEN** `maxAlive` 5, `maxBudget` 3, un único tramo con `budgetPerSecond` 60 y `types: ["bug"]`, `bug` con
  coste 1, y una partida con 5 enemigos vivos que lleva 600 ticks en el tope
- **WHEN** los 5 enemigos quedan dados de baja y se ejecuta 1 tick, y después 1 tick más
- **THEN** tras el primer tick hay exactamente 3 enemigos vivos (presupuesto guardado 3, no 600 ni 1)
- **AND** tras el segundo tick hay exactamente 4

#### Scenario: Huecos sin presupuesto suficiente
- **GIVEN** `maxAlive` 5, `maxBudget` 3, un único tramo con `budgetPerSecond` 0, presupuesto acumulado 0 y 5
  enemigos vivos
- **WHEN** 2 enemigos quedan dados de baja y se ejecutan 600 ticks
- **THEN** hay exactamente 3 enemigos vivos

### Requirement: Posición de aparición fuera de la vista
El sistema SHALL colocar cada enemigo nuevo así:
1. Toma un punto a una distancia del jugador igual al radio del anillo, en un ángulo elegido con el
   `RandomGenerator`. El radio del anillo es la mitad de la diagonal de la vista más `margin`:
   √(960² + 540²) / 2 + 32 ≈ 582,727 con los valores por defecto.
2. Recorta ese punto a la arena con la misma regla que al jugador, de modo que el centro quede en
   [radio, ancho − radio] × [radio, alto − radio] usando el radio del enemigo.
3. Acepta la posición solo si, tras el recorte, su distancia al jugador es ≥ `minDistance`.

Si la posición no se acepta, se repite el proceso hasta un total de `maxAttempts` intentos por enemigo. Si ningún
intento es válido, ese enemigo no aparece en este tick, el presupuesto no se gasta y el tipo pendiente se
mantiene. El sistema MUST NOT colocar nunca un enemigo a menos de `minDistance` del jugador.

#### Scenario: Arena mayor que la vista
- **GIVEN** una arena de 4.000 × 4.000, el jugador en (2.000, 2.000), una vista de 960 × 540 y `margin` 32
- **WHEN** aparecen 100 enemigos
- **THEN** cada uno está a 582,727 ± 0,001 unidades del jugador
- **AND** ninguno está dentro del rectángulo de la vista centrado en el jugador

#### Scenario: Arena igual a la vista
- **GIVEN** la arena de 960 × 540, el jugador en (480, 270) y el contenido de spawn por defecto
- **WHEN** aparecen 200 enemigos
- **THEN** el centro de cada uno queda en [radio, 960 − radio] × [radio, 540 − radio]
- **AND** cada uno está a ≥ 200 unidades del jugador
- **AND** cada uno toca un borde de la arena: x = radio, x = 960 − radio, y = radio o y = 540 − radio

#### Scenario: Jugador en una esquina
- **GIVEN** la arena de 960 × 540, el jugador quieto en (16, 16) con una vida máxima suficiente para no llegar a
  0 en 3.600 ticks, y el contenido de spawn por defecto
- **WHEN** se ejecutan 3.600 ticks con un tramo de `budgetPerSecond` 5
- **THEN** cada enemigo aparecido está dentro de la arena y a ≥ 200 unidades del jugador en el tick de su
  aparición

#### Scenario: Ninguna posición válida
- **GIVEN** la arena de 960 × 540, `minDistance` 2.000 (mayor que la diagonal de la arena) y `maxAttempts` 8
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
- **THEN** ningún enemigo aparece fuera de la arena ni a menos de 200 unidades del jugador

### Requirement: Vida y baja de enemigos
El sistema SHALL dar a cada enemigo, al aparecer, una vida igual al `health` de su tipo. Aplicar a un enemigo
vivo un daño d > 0 MUST reducir su vida en d, sin bajar de 0. Cuando su vida llega a 0, el enemigo queda dado de
baja: deja de estar vivo de forma irreversible, suelta exactamente una gema con el `xp` de su tipo en su posición
(ver `xp-gems`) y desde ese momento:
- no aparece en ningún snapshot;
- no se mueve ni hace contacto con el jugador;
- no es objetivo ni recibe daño de ningún arma;
- no cuenta para `maxAlive`;
- su identificador no se reutiliza para ningún otro enemigo de la partida.

Aplicar daño a un enemigo ya dado de baja no tiene efecto ni suelta otra gema. En juego, el único mecanismo que daña
a los enemigos son las armas (ver `auto-weapons`): cada impacto resta el `damage` efectivo del arma que golpea (base
de contenido más mejoras, ver `upgrades`). El contacto con el jugador no les quita vida.

#### Scenario: Vida inicial del tipo
- **GIVEN** un tipo `bug` con `health` 5
- **WHEN** aparece un enemigo `bug`
- **THEN** su vida vale 5

#### Scenario: Vida por defecto de cada tipo
- **GIVEN** el contenido por defecto
- **WHEN** aparece un enemigo de cada tipo
- **THEN** `bug` tiene vida 10, `merge-conflict` 20 y `memory-leak` 45

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
- **GIVEN** `maxAlive` 1, un único tramo con `budgetPerSecond` 60, `bug` con coste 1 y un enemigo vivo con
  identificador X
- **WHEN** X queda dado de baja y se ejecutan 60 ticks
- **THEN** hay exactamente 1 enemigo vivo y su identificador es distinto de X

#### Scenario: Golpear al jugador no quita vida al enemigo
- **GIVEN** una partida sin armas equipadas y un enemigo con vida inicial 5 en contacto continuo con el jugador
- **WHEN** se ejecutan 600 ticks con la partida en curso
- **THEN** el enemigo sigue vivo con vida 5 y no hay ninguna gema

#### Scenario: Daño efectivo con mejoras
- **GIVEN** un bug con vida 10 y la mejora `strict-rules` en nivel 1 (Linter con `damage` 9)
- **WHEN** recibe 1 impacto de un proyectil del Linter creado tras la elección
- **THEN** sigue vivo con vida 1

<!-- historial: 0002-enemy-spawning (2026-11-19) -->
<!-- historial: 0003-collisions-and-damage (2026-11-19) -->
<!-- historial: 0004-auto-weapons (2026-11-19) -->
<!-- historial: 0005-xp-and-level-up (2026-11-19) -->
