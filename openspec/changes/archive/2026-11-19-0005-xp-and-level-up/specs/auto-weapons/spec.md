# Spec delta · auto-weapons

<!-- Change 0005-xp-and-level-up. Daño, cadencia, alcance y radio del pulso pasan a ser estadísticas efectivas:
     valor base de `content/weapons.json` más las mejoras adquiridas (ver `upgrades`). El contenido base no cambia.
     Un proyectil conserva el daño con que se creó y un pulso visible el radio con que se disparó. Salvo que se diga
     otra cosa, los escenarios usan los valores por defecto SIN MEJORAS ADQUIRIDAS (efectivo = base) y, en partidas
     largas, la política de elección fija de `simulation-loop`. -->

## MODIFIED Requirements

### Requirement: Cadencia y retención de carga
El sistema SHALL medir la cadencia de cada arma en ticks enteros, con su `cooldownTicks` efectivo (ver `upgrades`).
Un arma cargada dispara en el primer tick en que su criterio de objetivo encuentra objetivo; al disparar en el tick
T queda descargada y vuelve a estar cargada en el tick T + `cooldownTicks` efectivo en el momento del disparo. Si un
arma está cargada y no hay objetivo, MUST NOT disparar y MUST conservar la carga sin límite de tiempo. Una mejora de
cadencia elegida mientras el arma está descargada no cambia el tick en que vuelve a estar cargada; rige desde su
siguiente disparo. La cadencia MUST NOT depender del reloj del sistema ni de la duración de los frames, y los ticks
pedidos mientras se elige mejora no cuentan (ver `run-state`).

#### Scenario: Cadencia con objetivo permanente
- **GIVEN** una partida en la que, en todos los ticks, hay un enemigo vivo de radio 10 a 50 px del jugador cuya
  vida basta para no morir en 181 ticks
- **WHEN** se ejecutan 181 ticks
- **THEN** el Linter ha creado proyectiles exactamente en los ticks 1, 31, 61, 91, 121, 151 y 181
- **AND** Tests ha disparado pulsos exactamente en los ticks 1, 91 y 181

#### Scenario: Retención sin objetivo en alcance
- **GIVEN** una partida en la que, en los ticks 1 a 120, ningún enemigo vivo está a ≤ 400 px del jugador, y en el
  tick 121 uno está a 390 px
- **WHEN** se ejecutan 121 ticks
- **THEN** el Linter no crea ningún proyectil en los ticks 1 a 120
- **AND** crea exactamente 1 proyectil en el tick 121

#### Scenario: La retención reinicia la cadencia
- **GIVEN** un Linter que dispara en el tick 1 y no tiene objetivo en los ticks 31 a 40, y sí desde el tick 41
- **WHEN** se ejecutan 101 ticks
- **THEN** el Linter dispara exactamente en los ticks 1, 41, 71 y 101

#### Scenario: Sin enemigos, sin disparos
- **GIVEN** una partida sin enemigos vivos durante 600 ticks
- **WHEN** se ejecutan 600 ticks
- **THEN** no se crea ningún proyectil ni se dispara ningún pulso, y ambas armas siguen cargadas

#### Scenario: Mejora de cadencia a mitad de recarga
- **GIVEN** un objetivo permanente a 50 px que no muere, un Linter que dispara en el tick 1 y la mejora `fast-ci`
  (−4) elegida en una oferta abierta en el tick 10
- **WHEN** se ejecutan ticks hasta el 90
- **THEN** el Linter dispara exactamente en los ticks 1, 31, 57 y 83

#### Scenario: La pausa no adelanta la recarga
- **GIVEN** un Linter que dispara en el tick 1 y una oferta abierta en el tick 5 durante la que se piden 600 ticks
- **WHEN** se elige y se ejecutan ticks hasta el 31 con un objetivo permanente
- **THEN** el Linter no dispara entre los ticks 2 y 30 y dispara en el tick 31

### Requirement: Objetivo del más cercano dentro de alcance
El sistema SHALL, para un arma con criterio `nearest-in-range`, elegir como objetivo el enemigo vivo cuya distancia
al jugador sea mínima entre los que están a distancia ≤ `range` efectivo (ver `upgrades`), usando las posiciones del
paso de armas del tick. Si hay varios a la misma distancia mínima, MUST elegirse el primero en el orden de la lista
de enemigos (orden de aparición). Sin enemigos vivos a ≤ `range` efectivo no hay objetivo. La selección MUST NOT
consumir azar.

#### Scenario: Elige el más cercano
- **GIVEN** un jugador en (480, 270) y enemigos vivos en (780, 270), (480, 120) y (380, 270)
- **WHEN** el Linter cargado actúa
- **THEN** el objetivo es el enemigo de (380, 270) (distancia 100)

#### Scenario: Ignora los que están fuera de alcance
- **GIVEN** un jugador en (480, 270) y un único enemigo vivo a 401 px
- **WHEN** el Linter cargado actúa
- **THEN** no hay objetivo y no se crea ningún proyectil

#### Scenario: Límite exacto del alcance
- **GIVEN** un jugador en (480, 270) y un único enemigo vivo en (880, 270) (distancia 400)
- **WHEN** el Linter cargado actúa
- **THEN** el objetivo es ese enemigo

#### Scenario: Empate por orden de aparición
- **GIVEN** un jugador en (480, 270) y dos enemigos vivos a, que apareció antes, en (380, 270) y b en (580, 270)
- **WHEN** el Linter cargado actúa
- **THEN** el objetivo es a

#### Scenario: Alcance mejorado
- **GIVEN** `wide-analysis` en nivel 1 (`range` efectivo 460), un jugador en (100, 270) y un único enemigo vivo en
  (560, 270) (distancia 460)
- **WHEN** el Linter cargado actúa
- **THEN** el objetivo es ese enemigo
- **AND** con un enemigo a 461 px no hay objetivo

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
- **GIVEN** un proyectil del Linter creado en el tick T en (480, 270) hacia un bug de radio 10 y vida 10 que
  permanece en (580, 270)
- **WHEN** se ejecutan los ticks T + 1 a T + 11
- **THEN** en el snapshot de T + 10 el proyectil está en (560, 270) y el bug tiene vida 10
- **AND** en el snapshot de T + 11 el proyectil ya no está y el bug sigue vivo con vida 4

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

#### Scenario: Varios proyectiles sobre el mismo bug en un tick
- **GIVEN** un bug con vida 10 y tres proyectiles del Linter que lo solapan en el mismo tick
- **WHEN** se ejecuta ese tick
- **THEN** el bug queda dado de baja (6 + 6 ≥ 10) y desaparecen los dos primeros proyectiles
- **AND** el tercero sigue en vuelo

#### Scenario: El objetivo muere antes del impacto
- **GIVEN** un proyectil en vuelo hacia un enemigo que queda dado de baja por otra causa antes del impacto
- **WHEN** se ejecutan más ticks
- **THEN** el proyectil sigue en línea recta y desaparece al impactar a otro enemigo o al agotar su vida

#### Scenario: Proyectil en vuelo durante una mejora de daño
- **GIVEN** un proyectil del Linter creado en el tick T hacia un bug de vida 10 que permanece a 100 px, y
  `strict-rules` elegido en una oferta abierta en el tick T + 2
- **WHEN** el proyectil impacta en T + 11
- **THEN** el bug queda con vida 4 (daño 6 de su creación)
- **AND** el siguiente proyectil del Linter que lo impacta le resta 9

### Requirement: Pulso de área
El sistema SHALL, para un arma con criterio `any-in-radius`, considerar que hay objetivo cuando al menos un enemigo
vivo tiene su círculo solapando (distancia < `radius` efectivo + radio del enemigo) el círculo de radio `radius`
efectivo centrado en el jugador (ver `upgrades`). Cuando un arma con ataque `pulse` dispara, MUST restar el `damage`
efectivo del arma, en ese mismo paso, a todos los enemigos vivos que cumplen esa condición, y a ningún otro. El pulso
no crea entidades que dañen después.

#### Scenario: Tres dentro y uno fuera
- **GIVEN** un jugador en (480, 270), Tests cargado y cuatro bugs de radio 10 y vida 10 a distancias 50, 80, 99 y
  101 en el paso de armas
- **WHEN** Tests dispara
- **THEN** los tres primeros quedan con vida 6 y el cuarto con vida 10

#### Scenario: Límite exacto del pulso
- **GIVEN** un jugador en (480, 270), Tests cargado y un único bug de radio 10 a distancia 100
- **WHEN** Tests actúa
- **THEN** no hay pulso y el bug conserva su vida

#### Scenario: Sin enemigos en el radio, sin pulso
- **GIVEN** Tests cargado y ningún enemigo vivo a distancia < 100 (radio 90 + radio 10 del bug)
- **WHEN** se ejecutan 300 ticks en esas condiciones
- **THEN** no se dispara ningún pulso y Tests sigue cargado

#### Scenario: Pulso mejorado
- **GIVEN** `coverage` y `hard-asserts` en nivel 1 (`radius` efectivo 105, `damage` efectivo 6), Tests cargado y
  dos bugs de radio 10 y vida 10 a distancias 114 y 115
- **WHEN** Tests actúa
- **THEN** el primero queda con vida 4 y el segundo con vida 10

### Requirement: Daño acumulado y bajas por armas
El sistema SHALL restar a la vida de un enemigo, en cada impacto de proyectil, el daño del proyectil (ver
"Proyectiles") y, en cada pulso, el `damage` efectivo del arma en ese tick. Los impactos se acumulan, también dentro
de un mismo tick; la vida no baja de 0. Un enemigo muere solo cuando su vida llega a 0 y, desde ese tick, queda dado
de baja y suelta su gema (ver `enemy-spawning` y `xp-gems`): no aparece en el snapshot de ese tick, no hace contacto
con el jugador en ese tick ni después, y su hueco puede reponerlo el director en ese mismo tick. Un enemigo dañado
con vida > 0 sigue vivo y persiguiendo con normalidad. Con el daño base, ningún arma mata a un bug de un impacto;
con mejoras de daño sí puede.

#### Scenario: Ningún arma mata a un bug de un impacto sin mejoras
- **GIVEN** un bug con vida 10 y ninguna mejora adquirida
- **WHEN** recibe 1 impacto del Linter, y en otra partida 1 pulso de Tests
- **THEN** queda vivo con vida 4, y con vida 6 respectivamente

#### Scenario: Linter mata a un bug en 2 impactos
- **GIVEN** un bug con vida 10 que ha recibido 1 impacto del Linter (vida 4)
- **WHEN** recibe un segundo impacto del Linter en el tick n
- **THEN** no aparece en el snapshot del tick n

#### Scenario: Tests mata a un bug en 3 pulsos
- **GIVEN** un bug con vida 10
- **WHEN** recibe 2 pulsos de Tests
- **THEN** sigue vivo con vida 2
- **AND** tras un tercer pulso queda dado de baja

#### Scenario: Combinación de armas
- **GIVEN** un bug con vida 10
- **WHEN** recibe 1 impacto del Linter y 1 pulso de Tests, en el mismo tick o en ticks distintos
- **THEN** su vida llega exactamente a 0 y queda dado de baja

#### Scenario: Enemigos más resistentes
- **GIVEN** un merge-conflict con vida 20 y un memory-leak con vida 45
- **WHEN** reciben solo impactos del Linter
- **THEN** el merge-conflict sigue vivo con vida 2 tras 3 impactos y muere en el 4.º
- **AND** el memory-leak sigue vivo con vida 3 tras 7 impactos y muere en el 8.º

#### Scenario: La baja impide el contacto en ese tick
- **GIVEN** un jugador con vida 100, no invulnerable, y un bug con vida 4 y damage 5 que lo solapa en el tick n
- **WHEN** en el paso de armas del tick n el bug recibe un impacto del Linter
- **THEN** el bug no está en el snapshot del tick n y la vida del jugador sigue en 100

#### Scenario: Reposición en el mismo tick
- **GIVEN** `maxAlive` 1, un único bug vivo con vida 4 y un director con presupuesto guardado ≥ coste de `bug` y
  `bug` como tipo pendiente
- **WHEN** en el tick n el bug muere por un impacto del Linter
- **THEN** el snapshot del tick n tiene exactamente 1 enemigo vivo, con un identificador distinto del muerto

#### Scenario: Un pulso mejorado mata a un bug de un golpe
- **GIVEN** `hard-asserts` en nivel 3 (Tests con `damage` efectivo 10) y un bug con vida 10 en el radio
- **WHEN** Tests dispara
- **THEN** el bug queda dado de baja en ese tick

### Requirement: Indicación visual de daño, proyectiles y pulsos
El sistema SHALL exponer lo necesario para que el jugador vea que las armas actúan:
- cada enemigo del snapshot indica si ha recibido daño en los últimos `hitFlashTicks` ticks ejecutados: dañado en
  el tick T, lo indica en los snapshots de T a T + `hitFlashTicks` − 1;
- un pulso disparado en el tick T aparece en los snapshots de T a T + `visualTicks` − 1, con el arma que lo
  disparó, el tick T, el centro (posición del jugador en T, fija aunque el jugador se mueva) y el radio efectivo del
  criterio en T (fijo aunque después se elija una mejora de radio);
- cada arma equipada indica si está cargada.

El adaptador de render MUST pintar, en cada frame, un destello en cada enemigo que lo indique, un anillo por cada
pulso del snapshot y un sprite por cada proyectil del snapshot en su posición, sin dejar visible ningún sprite de un
proyectil desaparecido. No hay barras de vida, números de daño ni contador de bajas.

#### Scenario: Duración del destello
- **GIVEN** un enemigo que recibe daño en el tick T y no vuelve a recibirlo
- **WHEN** se leen los snapshots de T a T + 4
- **THEN** indica daño reciente en T, T + 1, T + 2 y T + 3, y no en T + 4

#### Scenario: Destello renovado
- **GIVEN** un enemigo que recibe daño en los ticks T y T + 2
- **WHEN** se leen los snapshots de T a T + 6
- **THEN** indica daño reciente de T a T + 5, y no en T + 6

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
- **THEN** hay exactamente 3 sprites de proyectil visibles, cada uno en la posición de un proyectil distinto del
  snapshot (error ≤ 0,001)

### Requirement: Armas observables en el juego
El sistema SHALL hacer que, con el contenido por defecto, las armas maten enemigos en una partida real sin que el
jugador pulse nada más que las elecciones de mejora.

#### Scenario: Jugador quieto con el contenido por defecto
- **GIVEN** el contenido por defecto, semilla 7, input (0, 0) en todos los ticks y la política de elección fija
- **WHEN** se ejecutan 600 ticks (10 s)
- **THEN** se ha creado ≥ 1 proyectil y ≥ 1 enemigo ha quedado dado de baja por armas
- **AND** al seguir hasta el tick 1.800 (30 s), se ha disparado ≥ 1 pulso de Tests en algún tick ≤ 1.800 (plazo
  provisional, a revalidar en apply)

#### Scenario: Comprobación en el navegador
- **GIVEN** la build de producción servida con `?seed=7` y sin input de movimiento del jugador
- **WHEN** pasan 15 s de juego, pulsando la tecla 1 cada vez que aparece el overlay de elección
- **THEN** una prueba E2E o de snapshot observa ≥ 1 proyectil pintado y ≥ 1 enemigo dado de baja
- **AND** no se exige ningún pulso en esos 15 s (el pulso se comprueba en el núcleo, en ≤ 1.800 ticks)
