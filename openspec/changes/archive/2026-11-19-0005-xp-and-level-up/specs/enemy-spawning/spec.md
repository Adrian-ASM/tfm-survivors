# Spec delta · enemy-spawning

<!-- Change 0005-xp-and-level-up. Cada tipo de enemigo gana un campo `xp` (entero ≥ 1) en `content/enemies.json`:
     la XP de la gema que suelta al morir por armas (ver `xp-gems`). Valores por defecto PROVISIONALES, A MEDIR EN
     APPLY: bug 1, merge-conflict 2, memory-leak 4. El daño que reciben los enemigos pasa a ser el daño efectivo del
     arma (base + mejoras, ver `upgrades`). Los escenarios de partidas largas de esta spec siguen la política de
     elección fija definida en `simulation-loop`. -->

## MODIFIED Requirements

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
