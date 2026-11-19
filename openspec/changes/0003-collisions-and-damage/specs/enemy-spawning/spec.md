# Spec delta · enemy-spawning

<!-- Change 0003-collisions-and-damage. Los tipos ganan vida (`health`) y daño (`damage`); aparece la baja de
     enemigos (en juego nadie la provoca hasta 0004: la ejercitan los tests) y se cierra la política de
     presupuesto al bajar del tope: el presupuesto se acumula siempre, recortado a un máximo guardado de
     contenido (`maxBudget`, nombre orientativo: el definitivo lo fija el design). Los valores de los escenarios
     son de ejemplo. -->

## ADDED Requirements

### Requirement: Vida y baja de enemigos
El sistema SHALL dar a cada enemigo, al aparecer, una vida igual al `health` de su tipo. Aplicar a un enemigo
vivo un daño d > 0 MUST reducir su vida en d. Cuando su vida llega a ≤ 0, el enemigo queda dado de baja: deja de
estar vivo de forma irreversible y desde ese momento:
- no aparece en ningún snapshot;
- no se mueve ni hace contacto con el jugador;
- no cuenta para `maxAlive`;
- su identificador no se reutiliza para ningún otro enemigo de la partida.

Aplicar daño a un enemigo ya dado de baja no tiene efecto. En este change ningún mecanismo del juego daña a los
enemigos: el contacto con el jugador no les quita vida.

#### Scenario: Vida inicial del tipo
- **GIVEN** un tipo `bug` con `health` 5
- **WHEN** aparece un enemigo `bug`
- **THEN** su vida vale 5

#### Scenario: Daño que no mata
- **GIVEN** un enemigo vivo con vida 5
- **WHEN** recibe un daño de 3 y se ejecuta 1 tick
- **THEN** sigue vivo, con vida 2, y sigue en el snapshot

#### Scenario: Daño exactamente igual a la vida
- **GIVEN** un enemigo vivo con identificador X y vida 5 en el snapshot del tick n
- **WHEN** recibe un daño de 5 y se ejecuta 1 tick
- **THEN** el snapshot del tick n + 1 no contiene ningún enemigo con identificador X

#### Scenario: Daño mayor que la vida
- **GIVEN** un enemigo vivo con vida 5
- **WHEN** recibe un daño de 7
- **THEN** queda dado de baja igual que con un daño de 5

#### Scenario: Daño a un enemigo ya dado de baja
- **GIVEN** un enemigo dado de baja
- **WHEN** recibe un daño de 5
- **THEN** no se produce ningún error y el número de enemigos vivos no cambia

#### Scenario: Identificador no reutilizado
- **GIVEN** `maxAlive` 1, un único tramo con `budgetPerSecond` 60, `bug` con coste 1 y un enemigo vivo con
  identificador X
- **WHEN** X queda dado de baja y se ejecutan 60 ticks
- **THEN** hay exactamente 1 enemigo vivo y su identificador es distinto de X

#### Scenario: Golpear al jugador no quita vida al enemigo
- **GIVEN** un enemigo con vida 5 en contacto continuo con el jugador
- **WHEN** se ejecutan 600 ticks con la partida en curso
- **THEN** el enemigo sigue vivo con vida 5

## MODIFIED Requirements

### Requirement: Catálogo de tipos de enemigo
El sistema SHALL definir los tipos de enemigo exclusivamente desde contenido. Cada tipo tiene un identificador
único, una velocidad, un radio, un coste, una vida (`health`) y un daño por contacto (`damage`). El contenido por
defecto MUST incluir exactamente los 3 tipos del GDD: `bug`, `memory-leak` y `merge-conflict`. Los tipos solo se
diferencian en esos valores.

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** el catálogo tiene 3 tipos con identificadores `bug`, `memory-leak` y `merge-conflict`
- **AND** cada uno tiene una velocidad > 0, un radio > 0, un coste > 0, una vida > 0 y un daño > 0

#### Scenario: Valores de cada tipo llegan al dominio
- **GIVEN** un tipo `bug` con `{ "speed": 90, "radius": 10, "cost": 1, "health": 5, "damage": 10 }`
- **WHEN** se carga el contenido y aparece un enemigo `bug`
- **THEN** ese enemigo tiene radio 10, vida 5 y se mueve a 90 unidades/s
- **AND** un golpe suyo resta 10 de vida al jugador

### Requirement: Contenido de enemigos y oleadas validado
El sistema SHALL validar con zod los tipos de enemigo, la tabla de oleadas, la vista y los parámetros de spawn
antes de que lleguen al dominio. Un contenido inválido MUST impedir que la partida arranque, con un error que
nombre el campo inválido. Las reglas son las siguientes:
- `speed`, `radius`, `cost`, `health` y `damage` son > 0.
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
  semilla 1 y un tope de 200
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
