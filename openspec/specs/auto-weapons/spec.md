# Auto Weapons · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
Armas automáticas del jugador: cada arma tiene su criterio de objetivo, su tipo de ataque, su cadencia y su
daño base, definidos en `content/weapons.json`. Las armas dañan a los enemigos, que mueren al llegar a vida 0.

<!-- Salvo que se diga otra cosa, los escenarios usan los valores por defecto:
     Linter (nearest-in-range + projectile): range 400, cooldownTicks 30, damage 6, speed 480 (8 px/tick),
     radius 4, lifetimeTicks 60. Tests (any-in-radius + pulse): radius 90, cooldownTicks 90, damage 4,
     visualTicks 8. maxProjectiles 32, hitFlashTicks 4. "Distancia" es entre centros. Un escenario que dice que
     un enemigo "permanece" en una posición describe la situación que el test prepara, no una regla de
     movimiento. -->

## Requirements

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
de enemigos (orden de aparición). Solo si no hay ningún enemigo vivo a ≤ `range` efectivo, el objetivo es la
estructura **no destruida** (ver `goblin-structures`) cuyo centro está a distancia mínima del jugador entre las que
están a ≤ `range` efectivo; a igual distancia, la primera en el orden de la lista de estructuras. Una ruina nunca es
objetivo. Solo si tampoco hay ninguna estructura no destruida a ≤ `range` efectivo, el objetivo es la **oveja viva**
(ver `sheep`) cuyo centro está a distancia mínima del jugador entre las que están a ≤ `range` efectivo; a igual
distancia, la primera en el orden de la lista de ovejas. Una estructura gana a una oveja aunque esté más lejos, y un
enemigo gana a ambas. Sin enemigos vivos, estructuras no destruidas ni ovejas vivas a ≤ `range` efectivo no hay
objetivo. La selección usa las posiciones de las ovejas tras su movimiento de ese tick y MUST NOT consumir azar.

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
- **GIVEN** la casa de prueba destruida, un jugador en (1.260, 1.000) y ningún enemigo vivo ni oveja durante 120 ticks
- **WHEN** se ejecutan 120 ticks
- **THEN** el Linter no crea ningún proyectil y sigue cargado

#### Scenario: Oveja sin enemigos ni estructuras en alcance
- **GIVEN** la oveja de prueba en (1.000, 1.000), un jugador quieto en (1.300, 1.000) (distancia 300), ningún enemigo
  vivo ni estructura
- **WHEN** el Linter cargado actúa en el tick T
- **THEN** el objetivo es la oveja y se crea 1 proyectil con dirección (−1, 0)

#### Scenario: La estructura gana a la oveja aunque esté más lejos
- **GIVEN** la casa de prueba, la oveja quieta de prueba en (1.260, 1.200), un jugador en (1.260, 1.000) (casa a 310,
  oveja a 200) y ningún enemigo vivo
- **WHEN** el Linter cargado actúa
- **THEN** el objetivo es la casa y el proyectil tiene dirección (0, −1)
- **AND** con la casa destruida, el objetivo es la oveja y el proyectil tiene dirección (0, 1)

#### Scenario: El enemigo gana a la oveja
- **GIVEN** la oveja quieta de prueba en (1.000, 1.050), un jugador en (1.000, 1.000) (oveja a 50) y un único enemigo
  vivo en (1.000, 650) (distancia 350)
- **WHEN** el Linter cargado actúa
- **THEN** el objetivo es el enemigo y el proyectil tiene dirección (0, −1)

#### Scenario: Límite del alcance con una oveja
- **GIVEN** la oveja de prueba en (1.000, 1.000), ningún enemigo vivo ni estructura y el jugador quieto en
  (1.400, 1.000) (distancia 400), y en otro caso en (1.401, 1.000) (distancia 401)
- **WHEN** el Linter cargado actúa
- **THEN** en el primer caso el objetivo es la oveja; en el segundo no hay objetivo y el Linter sigue cargado

#### Scenario: Empate entre ovejas
- **GIVEN** ningún enemigo vivo ni estructura, un jugador en (1.000, 1.000) y dos ovejas de prueba o1 (antes en la
  lista) en (1.000, 700) y o2 en (1.000, 1.300), en pasto
- **WHEN** el Linter cargado actúa
- **THEN** el objetivo es o1

### Requirement: Proyectiles
El sistema SHALL, cuando un arma con ataque `projectile` dispara en el tick T, crear un proyectil en la posición
del jugador en ese paso, con el `radius` del arma, el `damage` efectivo del arma en el tick T y una dirección
unitaria fija hacia la posición que tenía el objetivo en ese momento (si la distancia es 0, la dirección es (1, 0)).
El proyectil conserva ese daño aunque después se elija una mejora de daño. El proyectil no persigue al objetivo. El
proyectil recuerda si su objetivo al dispararse era un enemigo, una estructura o una oveja. En el tick de creación no
se mueve ni colisiona. En cada tick T + k (k ≥ 1):
1. avanza `speed / 60` en su dirección;
2. si su círculo solapa (distancia < suma de radios) el de algún enemigo vivo, daña al primero de ellos en el orden
   de la lista de enemigos con el daño del proyectil y desaparece;
3. si no ha impactado en un enemigo y su objetivo era una estructura, y su círculo solapa el círculo de impacto de
   alguna estructura no destruida, daña a la primera de ellas en el orden de la lista de estructuras con el daño del
   proyectil y desaparece;
4. si no ha impactado en un enemigo y su objetivo era una oveja, y su círculo solapa el de alguna oveja viva, daña a
   la primera de ellas en el orden de la lista de ovejas con el daño del proyectil y desaparece;
5. si no ha impactado y k = `lifetimeTicks`, desaparece.

Un proyectil cuyo objetivo era un enemigo MUST NOT colisionar con estructuras ni con ovejas, uno cuyo objetivo era una
estructura MUST NOT colisionar con ovejas y uno cuyo objetivo era una oveja MUST NOT colisionar con estructuras: los
atraviesan. Los proyectiles se procesan en orden de creación; un enemigo, una estructura o una oveja cuya vida llega a
0 por un proyectil deja de ser alcanzable por los siguientes en ese mismo tick. Los proyectiles no están limitados por
la arena. Cada proyectil tiene un identificador único en la partida que no se reutiliza. Los ticks pedidos mientras se
elige mejora no cuentan para k (ver `run-state`).

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

#### Scenario: Impacto en una oveja
- **GIVEN** la oveja de prueba en pasto en (1.000, 1.000), un jugador quieto en (1.300, 1.000), ningún enemigo vivo
  ni estructura y un proyectil del Linter creado en el tick T hacia la oveja
- **WHEN** se ejecutan los ticks T + 1 a T + 35
- **THEN** en el snapshot de T + 34 el proyectil está en (1.028, 1.000) y la oveja tiene vida 12
- **AND** en el snapshot de T + 35 el proyectil ya no está y la oveja tiene vida 6

#### Scenario: Un proyectil dirigido a un enemigo atraviesa una oveja
- **GIVEN** la oveja de prueba en pasto en (1.000, 1.000), un jugador quieto en (1.300, 1.000) y un único enemigo vivo
  de radio 10 y vida 10 que permanece en (900, 1.000) (distancia 400), objetivo de un proyectil del Linter creado en el
  tick T
- **WHEN** se ejecutan los ticks T + 1 a T + 49
- **THEN** la oveja conserva vida 12 en todos ellos y el enemigo recibe el impacto en T + 49 (vida 4)

#### Scenario: Un proyectil dirigido a una oveja da antes a un enemigo
- **GIVEN** la oveja de prueba en pasto en (1.000, 1.000), un jugador quieto en (1.300, 1.000), un proyectil del
  Linter creado en el tick T hacia la oveja sin ningún enemigo ni estructura en alcance, y un enemigo de radio 10 y
  vida 10 que el escenario coloca en (1.150, 1.000) en el tick T + 1 y que permanece allí
- **WHEN** se ejecutan los ticks T + 1 a T + 35
- **THEN** el enemigo recibe el impacto en T + 18 (vida 4), el proyectil desaparece y la oveja conserva vida 12

#### Scenario: Proyectiles entre estructuras y ovejas
- **GIVEN** la casa de prueba y la oveja quieta de prueba en (1.260, 690), en el centro de la casa, sin enemigos, y en
  dos partidas un proyectil del Linter creado en el tick T desde (1.260, 1.000) hacia la casa, y otro creado en el tick
  T desde (1.260, 1.000) hacia la oveja con la casa destruida antes del tick T
- **WHEN** cada proyectil llega al centro de la casa
- **THEN** el dirigido a la casa resta 6 a la casa y la oveja conserva vida 12, y el dirigido a la oveja resta 6 a la
  oveja y la ruina sigue con vida 0

### Requirement: Tope de proyectiles
El sistema SHALL impedir que haya más de `maxProjectiles` proyectiles vivos. Un arma de proyectiles cargada, con
objetivo y con el tope lleno MUST NOT disparar y MUST conservar la carga. Los proyectiles que desaparecen en un tick
liberan su plaza para los disparos de ese mismo tick.

#### Scenario: Tope lleno
- **GIVEN** `maxProjectiles` 2, un Linter con `cooldownTicks` 1 y `lifetimeTicks` 60, y un objetivo en alcance
  durante todos los ticks que ningún proyectil alcanza
- **WHEN** se ejecutan 61 ticks
- **THEN** se crean proyectiles exactamente en los ticks 1, 2 y 61
- **AND** en ningún snapshot hay más de 2 proyectiles

### Requirement: Pulso de área
El sistema SHALL, para un arma con criterio `any-in-radius`, considerar que hay objetivo cuando al menos un enemigo
vivo tiene su círculo solapando (distancia < `radius` efectivo + radio del enemigo) el círculo de radio `radius`
efectivo centrado en el jugador (ver `upgrades`), o, aunque no haya ninguno, cuando al menos una estructura no
destruida tiene su círculo de impacto solapándolo (distancia < `radius` efectivo + radio de impacto), o, aunque no haya
enemigos ni estructuras, cuando al menos una oveja viva tiene su círculo solapándolo (distancia < `radius` efectivo +
radio de la oveja). Cuando un arma con ataque `pulse` dispara, MUST restar el `damage` efectivo del arma, en ese mismo
paso, a todos los enemigos vivos, a todas las estructuras no destruidas y a todas las ovejas vivas que cumplen esa
condición, y a ningún otro, sea cual sea el que ha hecho disparar el pulso. El pulso no crea entidades que dañen
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
- **GIVEN** Tests cargado, ningún enemigo vivo a distancia < 100 (radio 90 + radio 10 del `goblin-torch`), ninguna
  estructura y ninguna oveja
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
- **GIVEN** la casa de prueba destruida, Tests cargado, ningún enemigo vivo ni oveja y el jugador en (1.260, 690)
- **WHEN** se ejecutan 300 ticks
- **THEN** no se dispara ningún pulso y la casa sigue con vida 0

#### Scenario: Pulso sobre una oveja sola
- **GIVEN** la oveja quieta de prueba en (1.000, 1.000), Tests cargado, ningún enemigo vivo ni estructura y el jugador
  quieto en (1.109, 1.000) (distancia 109 < 90 + 20), y en otro caso en (1.110, 1.000) (distancia 110)
- **WHEN** Tests actúa
- **THEN** en el primer caso dispara y la oveja queda con vida 8; en el segundo no hay pulso y Tests sigue cargado

#### Scenario: Pulso disparado por un enemigo que alcanza a una oveja
- **GIVEN** Tests cargado, el jugador en (1.000, 1.000), un `goblin-torch` de radio 10 y vida 10 a 50 px y la oveja
  quieta de prueba a 100 px del jugador
- **WHEN** Tests dispara
- **THEN** el `goblin-torch` queda con vida 6 y la oveja con vida 8

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

### Requirement: Armas observables en el juego
El sistema SHALL hacer que, con el contenido por defecto, las armas maten enemigos en una partida real sin que el
jugador pulse nada más que las elecciones de mejora.

#### Scenario: Jugador quieto con el contenido por defecto
- **GIVEN** el contenido por defecto (mundo de 3.840 × 2.160, anillo de aparición 1.500), semilla 7, input (0, 0) en
  todos los ticks y la política de elección fija
- **WHEN** se ejecutan 900 ticks (15 s)
- **THEN** se ha creado ≥ 1 proyectil y ≥ 1 enemigo ha quedado dado de baja por armas (medido en apply de 0017:
  primer proyectil en el tick 590 y primera baja en el 656)
- **AND** al seguir hasta el tick 4.800 (80 s), se ha disparado ≥ 1 pulso de Tests en algún tick ≤ 4.800 (medido en
  apply de 0017: tick 1.434)

#### Scenario: Comprobación en el navegador
- **GIVEN** la build de producción servida con `?seed=7` y sin input de movimiento del jugador
- **WHEN** pasan 15 s de juego, pulsando la tecla 1 cada vez que aparece el overlay de elección
- **THEN** una prueba E2E o de snapshot observa ≥ 1 proyectil pintado y ≥ 1 enemigo dado de baja
- **AND** no se exige ningún pulso en esos 15 s (el pulso se comprueba en el núcleo, en ≤ 4.800 ticks)

<!-- historial: 0004-auto-weapons (2026-11-19) -->
<!-- historial: 0005-xp-and-level-up (2026-11-19) -->
<!-- historial: 0006-run-lifecycle-hud (2026-11-20) -->
<!-- historial: 0012-sprite-rendering (2026-11-22) -->
<!-- historial: 0013-world-camera (2026-11-23) -->
<!-- historial: 0017-fullscreen-view (2026-11-24) -->
<!-- historial: 0021-goblin-camps (2026-11-24) -->
<!-- historial: 0023-sheep-meat (2026-11-24) -->
