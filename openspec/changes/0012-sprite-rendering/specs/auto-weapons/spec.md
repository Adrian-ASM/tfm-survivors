# Spec delta · auto-weapons

<!-- Ruta: openspec/changes/0012-sprite-rendering/specs/auto-weapons/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test. -->

> Cambios:
> - El destello de daño deja de ser un cambio de color de relleno y pasa a ser cualquier indicación visual fiel a
>   `damaged` sobre el sprite animado del enemigo; los proyectiles se pintan como flechas (ver `sprite-rendering`).
> - Renombrado de ids de enemigo, sin cambio de comportamiento: `goblin-torch`, `goblin-tnt` y
>   `goblin-barrel` heredan, en ese orden, los stats de `bug`, `memory-leak` y `merge-conflict`. Donde la spec viva usaba "bug" como nombre común ("un bug de radio 10"), aquí se dice "un
>   `goblin-torch`".
> - Se descarta el campo `weapon` de `ProjectileSnapshot` de la planificación aparcada: el snapshot no cambia.
> - Valores por defecto como en la spec viva.

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Contenido de armas validado
El sistema SHALL definir las armas exclusivamente en `content/weapons.json`, validado con zod antes de llegar al
dominio. El contenido tiene:
- `maxProjectiles`: entero ≥ 1, tope de proyectiles vivos en la partida;
- `hitFlashTicks`: entero ≥ 1, duración de la indicación de enemigo dañado;
- `weapons`: lista con ≥ 1 arma e identificadores únicos. Cada arma tiene `id` (texto no vacío), `cooldownTicks`
  (entero ≥ 1), `damage` (entero ≥ 1), un criterio de objetivo `targeting` y un tipo de ataque `attack`.

Criterios de objetivo admitidos:
- `{ "mode": "nearest-in-range", "range": > 0 }`;
- `{ "mode": "any-in-radius", "radius": > 0 }`.

Tipos de ataque admitidos:
- `{ "type": "projectile", "speed": > 0, "radius": > 0, "lifetimeTicks": entero ≥ 1 }`;
- `{ "type": "pulse", "visualTicks": entero ≥ 1 }`.

Un ataque `projectile` MUST ir con `nearest-in-range` y un ataque `pulse` MUST ir con `any-in-radius`. Cualquier
campo desconocido, valor fuera de rango, `mode` o `type` no admitido o combinación incompatible MUST rechazarse con
un error explícito que nombre el campo o la regla incumplida. Un `damage` mayor o igual que la vida de algún tipo de
enemigo es contenido válido.

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** hay exactamente 2 armas, en este orden: `linter` y `tests`
- **AND** `linter` tiene `cooldownTicks` 30, `damage` 6, `targeting` `nearest-in-range` con `range` 400 y `attack`
  `projectile` con `speed` 480, `radius` 4 y `lifetimeTicks` 60
- **AND** `tests` tiene `cooldownTicks` 90, `damage` 4, `targeting` `any-in-radius` con `radius` 90 y `attack`
  `pulse` con `visualTicks` 8
- **AND** `maxProjectiles` vale 32 y `hitFlashTicks` vale 4

#### Scenario: Daños base distintos y menores que la vida del goblin-torch
- **GIVEN** el contenido por defecto
- **WHEN** se carga el contenido
- **THEN** el `damage` de `linter` es distinto del de `tests`
- **AND** ambos son menores que el `health` de `goblin-torch` (10)

#### Scenario: Valores no positivos
- **GIVEN** un contenido de armas con, en un caso cada vez, `cooldownTicks` 0, `damage` 0, `damage` −1, `range` 0,
  `radius` del criterio 0, `speed` 0, `radius` del proyectil 0, `lifetimeTicks` 0, `visualTicks` 0,
  `maxProjectiles` 0 o `hitFlashTicks` 0
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo

#### Scenario: Valores no enteros
- **GIVEN** un contenido de armas con, en un caso cada vez, `cooldownTicks` 1,5, `damage` 2,5,
  `lifetimeTicks` 10,5 o `maxProjectiles` 3,2
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo

#### Scenario: Identificadores duplicados o lista vacía
- **GIVEN** un contenido con dos armas de `id` `linter`, y en otro caso una lista `weapons` vacía
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error explícito

#### Scenario: Combinación incompatible
- **GIVEN** un arma con `attack` `pulse` y `targeting` `nearest-in-range`, y en otro caso un arma con `attack`
  `projectile` y `targeting` `any-in-radius`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error explícito

#### Scenario: Campos o variantes desconocidos
- **GIVEN** un arma con un campo extra `pierce: 2`, y en otros casos `mode: "random"` o `type: "laser"`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error explícito

#### Scenario: Daño mayor que la vida de un enemigo
- **GIVEN** el contenido por defecto con el `damage` de `linter` cambiado a 50
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

### Requirement: Armas equipadas al inicio
El sistema SHALL equipar al jugador, al crear la partida, todas las armas de `content/weapons.json` en el orden de
la lista. Cada arma empieza cargada. En cada tick las armas actúan en el orden de la lista. El jugador no controla
las armas: disparan solas según su criterio de objetivo y su cadencia, sea cual sea el input. El fichero de
contenido exige ≥ 1 arma, pero una partida configurada sin armas es válida: no dispara nunca y sus enemigos solo
pierden vida si algo los daña (en juego, nada). Los escenarios pueden fijar la vida inicial de un enemigo concreto
("un `goblin-torch` con vida 4") al preparar la partida.

#### Scenario: Armas equipadas en una partida nueva
- **GIVEN** una partida recién creada con el contenido por defecto
- **WHEN** se lee el snapshot antes del primer tick
- **THEN** no hay proyectiles ni pulsos, y la partida tiene equipadas `linter` y `tests`, ambas cargadas

#### Scenario: Disparo en el tick 1
- **GIVEN** una partida recién creada en la que, en el paso de armas del tick 1, hay un `goblin-torch` vivo (radio 10)
  a 50 px del jugador
- **WHEN** se ejecuta 1 tick
- **THEN** el snapshot del tick 1 contiene exactamente 1 proyectil y exactamente 1 pulso

### Requirement: Proyectiles
El sistema SHALL, cuando un arma con ataque `projectile` dispara en el tick T, crear un proyectil en la posición
del jugador en ese paso, con el `radius` del arma, el `damage` efectivo del arma en el tick T y una dirección
unitaria fija hacia la posición que tenía el objetivo en ese momento (si la distancia es 0, la dirección es (1, 0)).
El proyectil conserva ese daño aunque después se elija una mejora de daño. El proyectil no persigue al objetivo. En
el tick de creación no se mueve ni colisiona. En cada tick T + k (k ≥ 1):
1. avanza `speed / 60` en su dirección;
2. si su círculo solapa (distancia < suma de radios) el de algún enemigo vivo, daña al primero de ellos en el orden
   de la lista de enemigos con el daño del proyectil y desaparece;
3. si no ha impactado y k = `lifetimeTicks`, desaparece.

Los proyectiles se procesan en orden de creación; un enemigo cuya vida llega a 0 por un proyectil deja de ser
alcanzable por los siguientes en ese mismo tick. Los proyectiles no están limitados por la arena. Cada proyectil
tiene un identificador único en la partida que no se reutiliza. Los ticks pedidos mientras se elige mejora no
cuentan para k (ver `run-state`).

#### Scenario: Impacto en vuelo
- **GIVEN** un proyectil del Linter creado en el tick T en (480, 270) hacia un `goblin-torch` de radio 10 y vida 10 que
  permanece en (580, 270)
- **WHEN** se ejecutan los ticks T + 1 a T + 11
- **THEN** en el snapshot de T + 10 el proyectil está en (560, 270) y el `goblin-torch` tiene vida 10
- **AND** en el snapshot de T + 11 el proyectil ya no está y el `goblin-torch` sigue vivo con vida 4

#### Scenario: Agota su vida sin impactar
- **GIVEN** un proyectil del Linter creado en el tick T en (480, 270) con dirección (1, 0) y ningún enemigo en su
  trayectoria
- **WHEN** se ejecutan 60 ticks
- **THEN** aparece en los snapshots de T a T + 59, en T + 59 en (952, 270)
- **AND** no aparece en el snapshot de T + 60

#### Scenario: Solo daña a un enemigo
- **GIVEN** un proyectil que en el tick T + k solapa a la vez a dos enemigos vivos a (anterior en la lista) y b
- **WHEN** se ejecuta el tick T + k
- **THEN** a pierde 6 de vida, b no pierde vida y el proyectil desaparece

#### Scenario: Varios proyectiles sobre el mismo goblin-torch en un tick
- **GIVEN** un `goblin-torch` con vida 10 y tres proyectiles del Linter que lo solapan en el mismo tick
- **WHEN** se ejecuta ese tick
- **THEN** el `goblin-torch` queda dado de baja (6 + 6 ≥ 10) y desaparecen los dos primeros proyectiles
- **AND** el tercero sigue en vuelo

#### Scenario: El objetivo muere antes del impacto
- **GIVEN** un proyectil en vuelo hacia un enemigo que queda dado de baja por otra causa antes del impacto
- **WHEN** se ejecutan más ticks
- **THEN** el proyectil sigue en línea recta y desaparece al impactar a otro enemigo o al agotar su vida

#### Scenario: Proyectil en vuelo durante una mejora de daño
- **GIVEN** un proyectil del Linter creado en el tick T hacia un `goblin-torch` de vida 10 que permanece a 100 px, y
  `strict-rules` elegido en una oferta abierta en el tick T + 2
- **WHEN** el proyectil impacta en T + 11
- **THEN** el `goblin-torch` queda con vida 4 (daño 6 de su creación)
- **AND** el siguiente proyectil del Linter que lo impacta le resta 9

### Requirement: Pulso de área
El sistema SHALL, para un arma con criterio `any-in-radius`, considerar que hay objetivo cuando al menos un enemigo
vivo tiene su círculo solapando (distancia < `radius` efectivo + radio del enemigo) el círculo de radio `radius`
efectivo centrado en el jugador (ver `upgrades`). Cuando un arma con ataque `pulse` dispara, MUST restar el `damage`
efectivo del arma, en ese mismo paso, a todos los enemigos vivos que cumplen esa condición, y a ningún otro. El pulso
no crea entidades que dañen después.

#### Scenario: Tres dentro y uno fuera
- **GIVEN** un jugador en (480, 270), Tests cargado y cuatro `goblin-torch` de radio 10 y vida 10 a distancias 50, 80,
  99 y 101 en el paso de armas
- **WHEN** Tests dispara
- **THEN** los tres primeros quedan con vida 6 y el cuarto con vida 10

#### Scenario: Límite exacto del pulso
- **GIVEN** un jugador en (480, 270), Tests cargado y un único `goblin-torch` de radio 10 a distancia 100
- **WHEN** Tests actúa
- **THEN** no hay pulso y el `goblin-torch` conserva su vida

#### Scenario: Sin enemigos en el radio, sin pulso
- **GIVEN** Tests cargado y ningún enemigo vivo a distancia < 100 (radio 90 + radio 10 del `goblin-torch`)
- **WHEN** se ejecutan 300 ticks en esas condiciones
- **THEN** no se dispara ningún pulso y Tests sigue cargado

#### Scenario: Pulso mejorado
- **GIVEN** `coverage` y `hard-asserts` en nivel 1 (`radius` efectivo 105, `damage` efectivo 6), Tests cargado y
  dos `goblin-torch` de radio 10 y vida 10 a distancias 114 y 115
- **WHEN** Tests actúa
- **THEN** el primero queda con vida 4 y el segundo con vida 10

### Requirement: Daño acumulado y bajas por armas
El sistema SHALL restar a la vida de un enemigo, en cada impacto de proyectil, el daño del proyectil (ver
"Proyectiles") y, en cada pulso, el `damage` efectivo del arma en ese tick. Los impactos se acumulan, también dentro
de un mismo tick; la vida no baja de 0. Un enemigo muere solo cuando su vida llega a 0 y, desde ese tick, queda dado
de baja y suelta su gema (ver `enemy-spawning` y `xp-gems`): no aparece en el snapshot de ese tick, no hace contacto
con el jugador en ese tick ni después, y su hueco puede reponerlo el director en ese mismo tick. Un enemigo dañado
con vida > 0 sigue vivo y persiguiendo con normalidad. Con el daño base, ningún arma mata a un `goblin-torch` de un
impacto; con mejoras de daño sí puede.

#### Scenario: Ningún arma mata a un goblin-torch de un impacto sin mejoras
- **GIVEN** un `goblin-torch` con vida 10 y ninguna mejora adquirida
- **WHEN** recibe 1 impacto del Linter, y en otra partida 1 pulso de Tests
- **THEN** queda vivo con vida 4, y con vida 6 respectivamente

#### Scenario: Linter mata a un goblin-torch en 2 impactos
- **GIVEN** un `goblin-torch` con vida 10 que ha recibido 1 impacto del Linter (vida 4)
- **WHEN** recibe un segundo impacto del Linter en el tick n
- **THEN** no aparece en el snapshot del tick n

#### Scenario: Tests mata a un goblin-torch en 3 pulsos
- **GIVEN** un `goblin-torch` con vida 10
- **WHEN** recibe 2 pulsos de Tests
- **THEN** sigue vivo con vida 2
- **AND** tras un tercer pulso queda dado de baja

#### Scenario: Combinación de armas
- **GIVEN** un `goblin-torch` con vida 10
- **WHEN** recibe 1 impacto del Linter y 1 pulso de Tests, en el mismo tick o en ticks distintos
- **THEN** su vida llega exactamente a 0 y queda dado de baja

#### Scenario: Enemigos más resistentes
- **GIVEN** un `goblin-barrel` con vida 20 y un `goblin-tnt` con vida 45
- **WHEN** reciben solo impactos del Linter
- **THEN** el `goblin-barrel` sigue vivo con vida 2 tras 3 impactos y muere en el 4.º
- **AND** el `goblin-tnt` sigue vivo con vida 3 tras 7 impactos y muere en el 8.º

#### Scenario: La baja impide el contacto en ese tick
- **GIVEN** un jugador con vida 100, no invulnerable, y un `goblin-torch` con vida 4 y damage 5 que lo solapa en el
  tick n
- **WHEN** en el paso de armas del tick n el `goblin-torch` recibe un impacto del Linter
- **THEN** el `goblin-torch` no está en el snapshot del tick n y la vida del jugador sigue en 100

#### Scenario: Reposición en el mismo tick
- **GIVEN** `maxAlive` 1, un único `goblin-torch` vivo con vida 4 y un director con presupuesto guardado ≥ coste de
  `goblin-torch` y `goblin-torch` como tipo pendiente
- **WHEN** en el tick n el `goblin-torch` muere por un impacto del Linter
- **THEN** el snapshot del tick n tiene exactamente 1 enemigo vivo, con un identificador distinto del muerto

#### Scenario: Un pulso mejorado mata a un goblin-torch de un golpe
- **GIVEN** `hard-asserts` en nivel 3 (Tests con `damage` efectivo 10) y un `goblin-torch` con vida 10 en el radio
- **WHEN** Tests dispara
- **THEN** el `goblin-torch` queda dado de baja en ese tick

### Requirement: Indicación visual de daño, proyectiles y pulsos
El sistema SHALL exponer lo necesario para que el jugador vea que las armas actúan:
- cada enemigo del snapshot indica si ha recibido daño en los últimos `hitFlashTicks` ticks ejecutados: dañado en
  el tick T, lo indica en los snapshots de T a T + `hitFlashTicks` − 1;
- un pulso disparado en el tick T aparece en los snapshots de T a T + `visualTicks` − 1, con el arma que lo
  disparó, el tick T, el centro (posición del jugador en T, fija aunque el jugador se mueva) y el radio efectivo del
  criterio en T (fijo aunque después se elija una mejora de radio);
- cada arma equipada indica si está cargada.

El adaptador de render MUST pintar, en cada frame, una indicación visual de daño en cada enemigo que lo indique y
solo en ellos (por ejemplo, un tinte o destello sobre su sprite animado, sin detener su animación ni cambiar su
tamaño o posición), un anillo por cada pulso del snapshot y un sprite de flecha por cada proyectil del snapshot en
su posición (ver `sprite-rendering`), sin dejar visible ningún sprite de un proyectil desaparecido. En el frame en
que un enemigo deja de indicar daño, su sprite vuelve a su aspecto normal. La indicación de daño se aplica igual a
un enemigo pintado con aspecto de reserva. Sobre los enemigos no hay barras de vida ni números de daño; el contador
de bajas se muestra en el HUD (ver `hud`).

#### Scenario: Duración del destello
- **GIVEN** un enemigo que recibe daño en el tick T y no vuelve a recibirlo
- **WHEN** se leen los snapshots de T a T + 4
- **THEN** indica daño reciente en T, T + 1, T + 2 y T + 3, y no en T + 4

#### Scenario: Destello renovado
- **GIVEN** un enemigo que recibe daño en los ticks T y T + 2
- **WHEN** se leen los snapshots de T a T + 6
- **THEN** indica daño reciente de T a T + 5, y no en T + 6

#### Scenario: Indicación de daño fiel al snapshot
- **GIVEN** 3 `goblin-torch` que se mueven, de los que solo el segundo indica daño en los snapshots de T a T + 3
- **WHEN** se pintan los snapshots de T a T + 4
- **THEN** de T a T + 3 el segundo sprite muestra la indicación de daño y el primero y el tercero no
- **AND** en T + 4 ninguno la muestra y los 3 se pintan con su aspecto normal
- **AND** la animación `walk` del segundo sigue avanzando de T a T + 4 y su tamaño y posición son los mismos que
  sin indicación

#### Scenario: Indicación de daño con aspecto de reserva
- **GIVEN** la hoja de `goblin-tnt` sin cargar y un `goblin-tnt` que indica daño en los snapshots de T a T + 3
- **WHEN** se pintan los snapshots de T a T + 4
- **THEN** su aspecto de reserva muestra la indicación de daño de T a T + 3 y no en T + 4

#### Scenario: Duración del pulso
- **GIVEN** un pulso de Tests disparado en el tick T con el jugador en (480, 270), que luego se mueve
- **WHEN** se leen los snapshots de T a T + 8
- **THEN** el pulso aparece de T a T + 7 con centro (480, 270) y radio 90, y no en T + 8

#### Scenario: Pulso visible durante una mejora de radio
- **GIVEN** un pulso de Tests disparado en el tick T con radio 90 y `coverage` elegido en una oferta abierta en T
- **WHEN** se leen los snapshots de T a T + 7
- **THEN** el pulso figura con radio 90 en todos ellos
- **AND** el siguiente pulso de Tests figura con radio 105

#### Scenario: Sprites de proyectiles
- **GIVEN** un snapshot con 3 proyectiles ya pintado
- **WHEN** se pinta un snapshot en el que 1 de ellos ha desaparecido y se ha creado otro
- **THEN** hay exactamente 3 sprites de flecha visibles, cada uno en la posición de un proyectil distinto del
  snapshot (error ≤ 0,001)

## REMOVED Requirements
<!-- Ninguno. -->
