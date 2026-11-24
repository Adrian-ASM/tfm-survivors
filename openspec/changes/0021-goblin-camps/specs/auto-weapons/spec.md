# Spec delta · auto-weapons

<!-- Change 0021-goblin-camps. Las estructuras vivas son objetivo de las armas con prioridad menor que los enemigos y
     el pulso las daña (D5). Valores por defecto de las armas como en la spec viva (Linter: range 400, damage 6,
     speed 480 = 8 px/tick, radius 4, lifetimeTicks 60; Tests: radius 90, damage 4). "Casa de prueba": una casa
     explícita en el mapa vacío con centro (1.260, 690), radio de impacto 40 y vida 30, sin guardias. "Distancia" es
     entre centros. Un escenario que dice que un enemigo "permanece" en una posición describe la situación que el test
     prepara, no una regla de movimiento. -->

## MODIFIED Requirements

### Requirement: Objetivo del más cercano dentro de alcance
El sistema SHALL, para un arma con criterio `nearest-in-range`, elegir como objetivo el enemigo vivo cuya distancia
al jugador sea mínima entre los que están a distancia ≤ `range` efectivo (ver `upgrades`), usando las posiciones del
paso de armas del tick. Si hay varios a la misma distancia mínima, MUST elegirse el primero en el orden de la lista
de enemigos (orden de aparición). Solo si no hay ningún enemigo vivo a ≤ `range` efectivo, el objetivo es la
estructura **no destruida** (ver `goblin-structures`) cuyo centro está a distancia mínima del jugador entre las que
están a ≤ `range` efectivo; a igual distancia, la primera en el orden de la lista de estructuras. Una ruina nunca es
objetivo. Sin enemigos vivos ni estructuras no destruidas a ≤ `range` efectivo no hay objetivo. La selección MUST NOT
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

#### Scenario: Estructura sin enemigos en alcance
- **GIVEN** la casa de prueba, un jugador en (1.260, 1.000) (distancia 310) y ningún enemigo vivo
- **WHEN** el Linter cargado actúa en el tick T
- **THEN** el objetivo es la casa y se crea 1 proyectil con dirección (0, −1)

#### Scenario: El enemigo gana aunque esté más lejos
- **GIVEN** la casa de prueba, un jugador en (1.260, 1.000) y un único enemigo vivo en (1.260, 1.390) (distancia 390,
  más que los 310 de la casa)
- **WHEN** el Linter cargado actúa
- **THEN** el objetivo es el enemigo y el proyectil tiene dirección (0, 1)

#### Scenario: Límite del alcance con una estructura
- **GIVEN** la casa de prueba, ningún enemigo vivo y el jugador en (1.260, 1.090) (distancia 400), y en otro caso en
  (1.260, 1.091) (distancia 401)
- **WHEN** el Linter cargado actúa
- **THEN** en el primer caso el objetivo es la casa; en el segundo no hay objetivo y el Linter sigue cargado

#### Scenario: Empate entre estructuras
- **GIVEN** ningún enemigo vivo, un jugador en (1.000, 1.000) y dos estructuras no destruidas s1 (antes en la lista)
  con centro en (1.000, 700) y s2 con centro en (1.000, 1.300)
- **WHEN** el Linter cargado actúa
- **THEN** el objetivo es s1

#### Scenario: Una ruina no es objetivo
- **GIVEN** la casa de prueba destruida, un jugador en (1.260, 1.000) y ningún enemigo vivo durante 120 ticks
- **WHEN** se ejecutan 120 ticks
- **THEN** el Linter no crea ningún proyectil y sigue cargado

### Requirement: Proyectiles
El sistema SHALL, cuando un arma con ataque `projectile` dispara en el tick T, crear un proyectil en la posición
del jugador en ese paso, con el `radius` del arma, el `damage` efectivo del arma en el tick T y una dirección
unitaria fija hacia la posición que tenía el objetivo en ese momento (si la distancia es 0, la dirección es (1, 0)).
El proyectil conserva ese daño aunque después se elija una mejora de daño. El proyectil no persigue al objetivo. El
proyectil recuerda si su objetivo al dispararse era un enemigo o una estructura. En el tick de creación no se mueve ni
colisiona. En cada tick T + k (k ≥ 1):
1. avanza `speed / 60` en su dirección;
2. si su círculo solapa (distancia < suma de radios) el de algún enemigo vivo, daña al primero de ellos en el orden
   de la lista de enemigos con el daño del proyectil y desaparece;
3. si no ha impactado en un enemigo y su objetivo era una estructura, y su círculo solapa el círculo de impacto de
   alguna estructura no destruida, daña a la primera de ellas en el orden de la lista de estructuras con el daño del
   proyectil y desaparece. Un proyectil cuyo objetivo era un enemigo MUST NOT colisionar con estructuras: las
   atraviesa;
4. si no ha impactado y k = `lifetimeTicks`, desaparece.

Los proyectiles se procesan en orden de creación; un enemigo cuya vida llega a 0 por un proyectil deja de ser
alcanzable por los siguientes en ese mismo tick, y una estructura cuya vida llega a 0 por un proyectil también. Los
proyectiles no están limitados por la arena. Cada proyectil tiene un identificador único en la partida que no se
reutiliza. Los ticks pedidos mientras se elige mejora no cuentan para k (ver `run-state`).

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

#### Scenario: Impacto en una casa
- **GIVEN** la casa de prueba, un jugador quieto en (1.260, 1.000), ningún enemigo vivo y un proyectil del Linter
  creado en el tick T hacia la casa
- **WHEN** se ejecutan los ticks T + 1 a T + 34
- **THEN** en el snapshot de T + 33 el proyectil está en (1.260, 736) y la casa tiene vida 30
- **AND** en el snapshot de T + 34 el proyectil ya no está y la casa tiene vida 24

#### Scenario: Un proyectil dirigido a un enemigo atraviesa la casa
- **GIVEN** la casa de prueba, un jugador quieto en (1.260, 1.000) y un único enemigo vivo de radio 10 y vida 10 que
  permanece en (1.260, 640) (distancia 360), objetivo de un proyectil del Linter creado en el tick T
- **WHEN** se ejecutan los ticks T + 1 a T + 44
- **THEN** la casa conserva vida 30 en todos ellos y el enemigo recibe el impacto en T + 44 (vida 4)

#### Scenario: Un proyectil dirigido a la casa da antes a un enemigo
- **GIVEN** la casa de prueba, un jugador quieto en (1.260, 1.000), un proyectil del Linter creado en el tick T hacia
  la casa sin ningún enemigo en alcance, y un enemigo de radio 10 y vida 10 que el escenario coloca en (1.260, 800) en
  el tick T + 1 y que permanece allí
- **WHEN** se ejecutan los ticks T + 1 a T + 34
- **THEN** el enemigo recibe el impacto en T + 24 (vida 4), el proyectil desaparece y la casa conserva vida 30

### Requirement: Pulso de área
El sistema SHALL, para un arma con criterio `any-in-radius`, considerar que hay objetivo cuando al menos un enemigo
vivo tiene su círculo solapando (distancia < `radius` efectivo + radio del enemigo) el círculo de radio `radius`
efectivo centrado en el jugador (ver `upgrades`), o, aunque no haya ninguno, cuando al menos una estructura no
destruida tiene su círculo de impacto solapándolo (distancia < `radius` efectivo + radio de impacto). Cuando un arma
con ataque `pulse` dispara, MUST restar el `damage` efectivo del arma, en ese mismo paso, a todos los enemigos vivos y
a todas las estructuras no destruidas que cumplen esa condición, y a ningún otro. El pulso no crea entidades que dañen
después.

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
- **GIVEN** Tests cargado, ningún enemigo vivo a distancia < 100 (radio 90 + radio 10 del `goblin-torch`) y ninguna
  estructura
- **WHEN** se ejecutan 300 ticks en esas condiciones
- **THEN** no se dispara ningún pulso y Tests sigue cargado

#### Scenario: Pulso mejorado
- **GIVEN** `coverage` y `hard-asserts` en nivel 1 (`radius` efectivo 105, `damage` efectivo 6), Tests cargado y
  dos `goblin-torch` de radio 10 y vida 10 a distancias 114 y 115
- **WHEN** Tests actúa
- **THEN** el primero queda con vida 4 y el segundo con vida 10

#### Scenario: Pulso sobre una casa
- **GIVEN** la casa de prueba, Tests cargado, ningún enemigo vivo y el jugador en (1.260, 819) (distancia 129 < 90 +
  40), y en otro caso en (1.260, 820) (distancia 130)
- **WHEN** Tests actúa
- **THEN** en el primer caso dispara y la casa queda con vida 26; en el segundo no hay pulso y Tests sigue cargado

#### Scenario: Pulso sobre un enemigo y una casa
- **GIVEN** la casa de prueba, Tests cargado, el jugador en (1.260, 800) y un `goblin-torch` de radio 10 y vida 10 a
  50 px del jugador
- **WHEN** Tests dispara
- **THEN** el `goblin-torch` queda con vida 6 y la casa con vida 26

#### Scenario: Pulso sobre una ruina
- **GIVEN** la casa de prueba destruida, Tests cargado, ningún enemigo vivo y el jugador en (1.260, 690)
- **WHEN** se ejecutan 300 ticks
- **THEN** no se dispara ningún pulso y la casa sigue con vida 0
