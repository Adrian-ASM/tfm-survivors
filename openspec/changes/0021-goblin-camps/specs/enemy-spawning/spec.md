# Spec delta · enemy-spawning

<!-- Change 0021-goblin-camps. Catálogo de 4 tipos (D3: `goblin-tnt-guard`, tipo nuevo que solo nace de casas),
     nacimiento de guardias con tope e intervalo y vida nueva del barril (A3). La vida 25 del barril es la candidata
     aprobada; si apply la recalibra dentro de la banda de balance, los escenarios que la citan MUST actualizarse en
     este delta antes de verify. Los escenarios con estructuras explícitas usan el mapa vacío salvo que digan otra
     cosa. -->

## ADDED Requirements

### Requirement: Nacimiento de guardias en casas
El sistema SHALL hacer nacer guardias en cada casa viva (ver `goblin-structures`), sin el director de oleadas y sin
gastar su presupuesto. En el paso de nacimientos de cada tick (ver "Orden de los pasos del tick" en `simulation-loop`,
justo después del director), cada casa, en el orden de la lista de estructuras, hace nacer exactamente 1 guardia de su
tipo de guardia si se cumplen a la vez:
- la casa no está destruida;
- el número de guardias vivos nacidos de esa casa es < su tope de guardias;
- han pasado ≥ su intervalo de nacimiento ticks desde su último nacimiento o, si no ha hecho nacer ninguno, desde el
  tick 0 de la partida;
- el número total de enemigos vivos (de oleada y guardias) es < `maxAlive`.

Si alguna no se cumple, la casa no hace nacer en ese tick y lo vuelve a comprobar en el siguiente; los ticks de
espera no se acumulan (nunca nacen 2 guardias de la misma casa en un tick). El guardia nace con el centro exactamente
en la puerta de su casa, que es también su **puesto** (ver "Guardia del Goblin TNT" en `enemy-behavior`), en el
estado inicial de su tipo, con la vida de su tipo y un identificador nuevo de la misma secuencia que los enemigos de
oleada; va al final de la lista de enemigos. Un guardia es un enemigo a todos los efectos: cuenta para `maxAlive`, su
baja suma al contador de bajas y suelta su gema, y no se mueve en su tick de nacimiento. Nacer MUST NOT consumir azar
ni depender de la vista o de la ventana. No nacen guardias en el tick en que la partida termina ni con la partida
eligiendo mejora o terminada. Los guardias que siguen vivos tras destruirse su casa no cuentan para ninguna otra casa.

#### Scenario: Nacimientos hasta el tope
- **GIVEN** el mapa vacío sin oleadas (`budgetPerSecond` 0), una casa explícita con tope 2, intervalo 120 ticks y
  puerta (1.290, 810), un guardia de prueba que no se mueve y un jugador lejos de ella con vida suficiente
- **WHEN** se ejecutan 600 ticks
- **THEN** nace 1 guardia en el tick 120 y otro en el 240, ambos con el centro en (1.290, 810) en el snapshot de su
  tick de nacimiento, y no nace ninguno más
- **AND** el primero va en la lista de enemigos antes que el segundo y sus identificadores son distintos

#### Scenario: Reposición tras una baja
- **GIVEN** la partida del escenario anterior en la que el guardia nacido en el tick 120 queda dado de baja en el
  tick 300
- **WHEN** se ejecuta hasta el tick 600
- **THEN** no nace ninguno entre los ticks 300 y 359, nace 1 en el tick 360 y ninguno más hasta el 600

#### Scenario: Intervalo mínimo
- **GIVEN** una casa explícita con tope 3 e intervalo 1 tick, sin oleadas
- **WHEN** se ejecutan 5 ticks
- **THEN** nace 1 guardia en cada uno de los ticks 1, 2 y 3, y ninguno en el 4 ni en el 5

#### Scenario: El tope de vivos frena el nacimiento
- **GIVEN** `maxAlive` 1, un `goblin-torch` de oleada vivo y una casa explícita con tope 2 e intervalo 60 ticks, sin
  presupuesto de oleadas
- **WHEN** se ejecutan 200 ticks y el `goblin-torch` queda dado de baja en el tick 150
- **THEN** no nace ningún guardia en los ticks 1 a 149 y nace 1 en el tick 150
- **AND** en ningún tick hay más de 1 enemigo vivo

#### Scenario: El director va antes que las casas
- **GIVEN** `maxAlive` 1, 0 enemigos vivos, un director con presupuesto para 1 `goblin-torch` en el tick n y una casa
  explícita que cumple las demás condiciones de nacimiento en ese tick
- **WHEN** se ejecuta el tick n
- **THEN** el único enemigo vivo es el `goblin-torch` y no nace ningún guardia

#### Scenario: Casa destruida
- **GIVEN** una casa explícita con tope 2, intervalo 120 ticks y 1 guardia vivo nacido en el tick 120, que queda
  destruida en el tick 200
- **WHEN** se ejecuta hasta el tick 1.200
- **THEN** no nace ningún guardia más y el guardia nacido en el tick 120 sigue vivo mientras nada lo dañe

#### Scenario: Nacer no consume azar
- **GIVEN** dos partidas con la semilla 7 y el mismo estado salvo que en una hay una casa que hace nacer un guardia en
  el tick n
- **WHEN** ambas ejecutan el tick n sin oferta de mejora ni aparición del director
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick

#### Scenario: Sin nacimientos en el tick final
- **GIVEN** una partida con duración objetivo de 120 ticks y una casa cuyo primer nacimiento tocaría en el tick 120
- **WHEN** se ejecuta el tick 120
- **THEN** la partida termina con victoria y ningún enemigo del snapshot del tick 120 tiene un identificador que no
  estuviera en el del tick 119

#### Scenario: Guardias en el mapa generado
- **GIVEN** el contenido por defecto, la semilla 42 con su mapa generado, input (0, 0), una vida suficiente para no
  llegar a 0 y la política de elección fija
- **WHEN** se ejecutan ticks hasta superar el intervalo de nacimiento de `goblin-house` en 1 tick
- **THEN** cada casa del mapa ha hecho nacer exactamente 1 `goblin-tnt-guard`, con el centro en su puerta y en una
  celda caminable en el snapshot de su nacimiento

### Requirement: Guardias fuera de las oleadas
El sistema SHALL reservar a las casas los tipos de guardia: un tipo de enemigo cuyo estado inicial es de clase
patrulla MUST NOT figurar en el `types` de ningún tramo de oleadas, y el director nunca lo hace aparecer. Un tramo que
cite un tipo así MUST hacer fallar la carga con un error que nombre el tipo. Con el contenido por defecto,
`content/waves.json` no cita `goblin-tnt-guard`.

#### Scenario: Guardia citado en una oleada
- **GIVEN** el contenido por defecto con un tramo cuyo `types` es `["goblin-torch", "goblin-tnt-guard"]`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `goblin-tnt-guard`
- **AND** no se crea ninguna partida

#### Scenario: Oleadas por defecto sin guardias
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** ningún tramo de `content/waves.json` cita `goblin-tnt-guard`

## MODIFIED Requirements

### Requirement: Catálogo de tipos de enemigo
El sistema SHALL definir los tipos de enemigo exclusivamente desde contenido. Cada tipo tiene un identificador
único, una velocidad, un radio, un coste, una vida (`health`), la XP que suelta al morir (`xp`), un comportamiento
(ver "Comportamiento por tipo en contenido" en `enemy-behavior`) y, opcionalmente, un daño por contacto (`damage`): un
tipo sin `damage` nunca hace daño por contacto (ver `player-health`). El contenido por defecto MUST incluir
exactamente 4 tipos: uno por unidad goblin del pack, `goblin-torch`, `goblin-tnt` y `goblin-barrel`, y el guardia de
las casas, `goblin-tnt-guard`, con la misma unidad que `goblin-tnt`, los mismos stats (velocidad, radio, coste, vida,
daño por contacto y XP) y un comportamiento de guardia (ver "Guardia del Goblin TNT" en `enemy-behavior`). El
`goblin-tnt` de oleada conserva su comportamiento de artillero. Ningún id de enemigo del contenido es `bug`,
`memory-leak` ni `merge-conflict`.

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** el catálogo tiene 4 tipos con identificadores `goblin-torch`, `goblin-tnt`, `goblin-barrel` y
  `goblin-tnt-guard`
- **AND** cada uno tiene una velocidad > 0, un radio > 0, un coste > 0, una vida > 0, una XP ≥ 1 y un comportamiento
- **AND** `goblin-torch`, `goblin-tnt` y `goblin-tnt-guard` tienen un daño por contacto > 0 y `goblin-barrel` no tiene
  daño por contacto

#### Scenario: Stats por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** `goblin-torch` tiene `speed` 90, `radius` 10, `cost` 1, `damage` 5, `health` 10 y `xp` 1
- **AND** `goblin-tnt` tiene `speed` 45, `radius` 22, `cost` 3, `damage` 15, `health` 45 y `xp` 4
- **AND** `goblin-barrel` tiene `speed` 70, `radius` 16, `cost` 2, `health` 25, `xp` 2 y ningún `damage`
- **AND** `goblin-tnt-guard` tiene `speed` 45, `radius` 22, `cost` 3, `damage` 15, `health` 45 y `xp` 4
- **AND** `content/waves.json` cita en cada tramo los mismos tipos que antes del change

#### Scenario: XP por defecto de cada tipo
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** `goblin-torch` tiene `xp` 1, `goblin-barrel` 2, `goblin-tnt` 4 y `goblin-tnt-guard` 4

#### Scenario: Valores de cada tipo llegan al dominio
- **GIVEN** un tipo `goblin-torch` con `{ "speed": 90, "radius": 10, "cost": 1, "health": 5, "damage": 10, "xp": 3 }`
  y su comportamiento de persecución
- **WHEN** se carga el contenido y aparece un enemigo `goblin-torch`
- **THEN** ese enemigo tiene radio 10, vida 5 y se mueve a 90 unidades/s
- **AND** un golpe suyo resta 10 de vida al jugador
- **AND** al morir por armas suelta una gema que da 3 de XP

### Requirement: Oleadas por tramos de tiempo
El sistema SHALL elegir en cada tick el tramo activo de la tabla de oleadas: el último cuyo `fromSecond` sea
≤ al tiempo de partida. El último tramo sigue activo hasta el final de la partida. El director MUST hacer aparecer
solo enemigos de los tipos permitidos en el tramo activo. Los guardias que nacen de las casas (ver "Nacimiento de
guardias en casas") no los hace aparecer el director y no cuentan para esta regla.

#### Scenario: Cambio de tramo
- **GIVEN** un tramo 0 con `types: ["goblin-torch"]` y un tramo 1 con `fromSecond` 30 y `types: ["goblin-tnt"]`,
  ambos con `budgetPerSecond` 1, un tope de 200 y un jugador con una vida máxima suficiente para no llegar a 0 en
  3.600 ticks
- **WHEN** se ejecutan 3.600 ticks (60 s)
- **THEN** todos los enemigos aparecidos por el director antes del tick 1.790 son `goblin-torch`
- **AND** todos los aparecidos por el director después del tick 1.810 son `goblin-tnt`

#### Scenario: Un solo tramo
- **GIVEN** una tabla con un único tramo, `fromSecond` 0 y `types: ["goblin-torch"]`, y un jugador con una vida máxima
  suficiente para no llegar a 0 en 36.000 ticks
- **WHEN** se ejecutan 36.000 ticks (10 min)
- **THEN** todos los enemigos aparecidos por el director son `goblin-torch`
- **AND** con el mapa vacío (sin casas) todos los enemigos aparecidos son `goblin-torch`

#### Scenario: Tramo sin presupuesto
- **GIVEN** un único tramo con `budgetPerSecond` 0 y el mapa vacío
- **WHEN** se ejecutan 600 ticks
- **THEN** no hay ningún enemigo vivo

#### Scenario: Guardias junto a la oleada
- **GIVEN** el contenido por defecto, la semilla 7 con su mapa generado, input (0, 0), una vida suficiente para no
  llegar a 0 en 3.600 ticks y la política de elección fija
- **WHEN** se ejecutan 3.600 ticks
- **THEN** todo enemigo aparecido es de un tipo del tramo activo en su tick de aparición o es un `goblin-tnt-guard`
  nacido en la puerta de una casa

### Requirement: Vida y baja de enemigos
El sistema SHALL dar a cada enemigo, al aparecer, una vida igual al `health` de su tipo. Aplicar a un enemigo
vivo un daño d > 0 MUST reducir su vida en d, sin bajar de 0. Un enemigo queda dado de baja cuando su vida llega a 0
o cuando explota al terminar su mecha (ver "Kamikaze del Goblin Barril" en `enemy-behavior`): deja de estar vivo de
forma irreversible, suelta exactamente una gema con el `xp` de su tipo en su posición (ver `xp-gems`) y desde ese
momento:
- no aparece en ningún snapshot;
- no se mueve, no cambia de estado, no lanza ni explota, ni hace contacto con el jugador;
- no es objetivo ni recibe daño de ningún arma ni de ninguna explosión;
- no cuenta para `maxAlive` ni, si es un guardia, para el tope de guardias de su casa;
- su identificador no se reutiliza para ningún otro enemigo de la partida.

Aplicar daño a un enemigo ya dado de baja no tiene efecto ni suelta otra gema. En juego, los mecanismos que dañan a
los enemigos son las armas (ver `auto-weapons`), cuyos impactos restan el `damage` efectivo del arma que golpea (base
de contenido más mejoras, ver `upgrades`), y las explosiones (ver "Explosión de área" en `enemy-hazards`), que restan
su daño de explosión. Una baja por explosión, sea la del barril que explota o la de un enemigo alcanzado, cuenta y
suelta gema igual que una baja por armas. Un enemigo que llega a vida 0 por armas y por una explosión en el mismo tick
queda dado de baja una sola vez, en el paso de armas (ver "Orden de los pasos del tick" en `simulation-loop`). El
contacto con el jugador no les quita vida. Las estructuras no son enemigos: su destrucción sigue "Vida, destrucción y
ruina" en `goblin-structures`.

#### Scenario: Vida inicial del tipo
- **GIVEN** un tipo `goblin-torch` con `health` 5
- **WHEN** aparece un enemigo `goblin-torch`
- **THEN** su vida vale 5

#### Scenario: Vida por defecto de cada tipo
- **GIVEN** el contenido por defecto
- **WHEN** aparece un enemigo de cada tipo
- **THEN** `goblin-torch` tiene vida 10, `goblin-barrel` 25, `goblin-tnt` 45 y `goblin-tnt-guard` 45

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

#### Scenario: Baja de un guardia
- **GIVEN** una partida con 4 bajas y un `goblin-tnt-guard` vivo con vida 6 que recibe en el tick n un impacto del
  Linter de daño 6
- **WHEN** se ejecuta el tick n
- **THEN** el guardia no figura en el snapshot del tick n, las bajas valen 5 y hay 1 gema nueva de valor 4 en la
  posición que tenía

## REMOVED Requirements
<!-- Ninguno. -->
