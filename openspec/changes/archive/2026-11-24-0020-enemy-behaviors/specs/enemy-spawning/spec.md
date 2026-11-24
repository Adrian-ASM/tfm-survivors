# Spec delta · enemy-spawning

<!-- Change 0020-enemy-behaviors. Cambios: cada tipo declara su comportamiento (ver `enemy-behavior`), el daño por
     contacto pasa a ser opcional (el `goblin-barrel` no lo tiene, D3) y las explosiones también dan de baja (D1). -->

## ADDED Requirements

<!-- Ninguno. -->

## MODIFIED Requirements

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
