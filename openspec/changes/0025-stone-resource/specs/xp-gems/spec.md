# Spec delta · xp-gems

<!-- Al archivar: en el Purpose, "Los recogibles con tipo (XP, oro, madera, carne y piedra) que sueltan las bajas, las
     estructuras destruidas, las ovejas y el mapa, el imán que los atrae y su recogida". -->

## MODIFIED Requirements

### Requirement: Contenido de gemas validado
El sistema SHALL leer de `content/*.json`, validados con zod antes de llegar al dominio, el radio de recogida base
del jugador (`pickupRadius`, en `content/player.json`) y, en el fichero de progresión, el radio de los recogibles
(`gemRadius`, el mismo para los cinco tipos), la velocidad del imán en px/s (`magnetSpeed`), el tope de gemas (`xp`) en
el suelo (`maxGems`), el tope de recogibles de oro, el de madera, el de carne y el de **piedra** (`maxStone`) en el
suelo. Las reglas son: `pickupRadius`, `gemRadius` y `magnetSpeed` > 0; `maxGems` y los topes de oro, de madera, de
carne y de piedra, enteros ≥ 1; el tope de madera MUST ser ≥ el número de montones de madera por mapa (ver
`resources`), para que ningún montón se funda con otro al crear la partida. Un campo ausente, fuera de rango o
desconocido MUST impedir que la partida arranque con un error que nombre el campo.

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** `pickupRadius` vale 128, `gemRadius` 5, `magnetSpeed` 360 y `maxGems` 300 (provisional, a medir en apply)
- **AND** los topes de oro, de madera, de carne y de piedra son enteros ≥ 1 y el de madera es ≥ el número de montones
  por mapa

#### Scenario: Valores no positivos
- **GIVEN** un contenido con, en un caso cada vez, `pickupRadius` 0, `gemRadius` 0, `magnetSpeed` 0,
  `magnetSpeed` −1, `maxGems` 0, el tope de oro 0, el tope de madera 0, el tope de carne 0, `maxStone` 0 o `maxStone`
  −1
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo
- **AND** no se crea ninguna partida

#### Scenario: Tope de gemas no entero
- **GIVEN** un contenido con `maxGems` 12,5, en otro caso el tope de oro 2,5, en otro el tope de carne 1,5 y en otro
  `maxStone` 2,5
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `maxGems`, el tope de oro, el tope de carne y `maxStone`
  respectivamente

#### Scenario: Campo desconocido o ausente
- **GIVEN** un fichero de progresión con un campo extra `gemLifetime: 600`, en otro caso sin `magnetSpeed`, en otro
  sin el tope de madera, en otro sin el tope de carne y en otro sin `maxStone`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error explícito que nombra el campo

#### Scenario: Tope mínimo válido
- **GIVEN** el contenido por defecto con `maxGems` 1, el tope de oro 1, el tope de carne 1 y `maxStone` 1
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

<!-- Escenario vivo sin cambios: "Tope de madera menor que los montones". -->

### Requirement: Recogida de gemas
El sistema SHALL recoger en el paso de recogibles, tras el movimiento del imán, todo recogible cuyo círculo solape el
del jugador (distancia < radio del jugador + `gemRadius`, 21 con los valores por defecto), atraído o no, sea cual sea
su tipo. Un recogible recogido desaparece de forma irreversible en ese mismo tick y su valor se aplica según su tipo: el
de `xp`, a la XP del jugador (ver `leveling`); el de `gold`, al oro; el de `wood`, a la madera (ver "Contadores de oro y
madera de la partida" en `resources`); el de `meat`, como curación del jugador (ver "Curación por carne" en
`player-health`); el de `stone`, a la piedra (ver "Contador de piedra de la partida" en `resources`). Varios recogibles
recogidos en el mismo tick aplican todos su valor en ese tick. Un recogible `meat` se recoge aunque el jugador tenga la
vida al máximo (su valor se pierde).

<!-- Escenarios vivos sin cambios: todos los de este requisito. -->

#### Scenario: Piedra recogida al pasar
- **GIVEN** `pickupRadius` 64, un jugador quieto en (480, 270) con piedra 0 y un recogible `stone` de valor 2 en
  (544, 270)
- **WHEN** se ejecutan 8 ticks
- **THEN** el recogible está en (538, 270) tras el tick 1, en (502, 270) tras el tick 7 y se recoge en el tick 8
- **AND** la piedra vale 2 desde el tick 8 y la XP, el oro y la madera no cambian

#### Scenario: Piedra fuera del radio
- **GIVEN** `pickupRadius` 128, un jugador quieto en (480, 270) y un recogible `stone` en (609, 270) (distancia 129)
- **WHEN** se ejecutan 36.000 ticks sin enemigos
- **THEN** el recogible sigue en (609, 270) y la piedra sigue en 0

#### Scenario: Piedra de una baja recogida en su tick
- **GIVEN** un jugador quieto en (480, 270) con piedra 0, probabilidad de piedra de `goblin-torch` 100 y un
  `goblin-torch` con vida 4 que muere por armas en el tick n en (490, 270)
- **WHEN** se ejecuta el tick n
- **THEN** su gema y su piedra se crean y se recogen en el tick n: la XP incluye 1 y la piedra vale 1

### Requirement: Tope de gemas en el suelo
El sistema SHALL impedir, **por tipo**, que haya en el suelo más recogibles de ese tipo que su tope: `maxGems` para
`xp`, el tope de oro para `gold`, el de madera para `wood`, el de carne para `meat` y `maxStone` para `stone`. Si al
crearse un recogible ya hay en el suelo tantos de su tipo como su tope, no se crea uno nuevo: su valor MUST sumarse al
del recogible **más antiguo de su mismo tipo** que siga en el suelo (el de creación más temprana), sin que se pierda
valor. Al sumar a una piedra, esta conserva su origen (`source`). Los recogibles de un tipo nunca reciben el valor de otro tipo, y los
de otros tipos no ocupan plaza en el tope de un tipo. Los recogidos en un tick liberan su plaza para los ticks
siguientes (las bajas, las muertes de ovejas y las destrucciones de un tick ocurren antes del paso de recogibles de ese
tick). Los montones de madera ocupan plaza de madera desde el tick 0.

<!-- Escenarios vivos sin cambios: todos los de este requisito (con probabilidad de piedra 0). -->

#### Scenario: Tope de piedra lleno
- **GIVEN** `maxStone` 2, probabilidad de piedra 100 en `goblin-torch`, 2 recogibles `stone` s1 (más antiguo, origen
  `goblin-tnt-guard`) y s2 de valor 1 en el suelo lejos del jugador, y dos `goblin-torch` que mueren por armas lejos del
  jugador en el mismo tick
- **WHEN** se ejecuta ese tick
- **THEN** hay exactamente 2 recogibles `stone`, s1 con valor 3 y origen `goblin-tnt-guard` y s2 con valor 1, con los
  mismos identificadores, y 2 gemas nuevas

#### Scenario: Plaza de piedra liberada por una recogida
- **GIVEN** `maxStone` 1, una única piedra s1 que se recoge en el tick n y probabilidad de piedra 100 en `goblin-torch`
- **WHEN** en el tick n + 1 muere un `goblin-torch` por armas lejos del jugador
- **THEN** el snapshot del tick n + 1 contiene exactamente 1 recogible `stone`, nuevo y distinto de s1, de valor 1

#### Scenario: Tope de piedra lleno sin tocar los otros tipos
- **GIVEN** `maxStone` 1, 1 recogible `stone` de valor 1, 10 `wood`, 4 `gold`, 2 `meat` y 5 gemas, todos lejos del
  jugador, con todos los topes de los otros tipos sin llenar, y un `goblin-torch` con probabilidad de piedra 100 que
  muere por armas
- **WHEN** se ejecuta ese tick
- **THEN** hay 1 recogible `stone` de valor 2, 6 gemas, y los 10 `wood`, los 4 `gold` y los 2 `meat` siguen con sus
  valores e identificadores

### Requirement: Pintado de las gemas
El adaptador de render SHALL mostrar en cada frame exactamente un sprite visible por cada recogible del último
snapshot, en su posición (error ≤ 0,001) y con el aspecto de su tipo (en la piedra, el de la roca de su origen; ver
"Aspectos de los recogibles y de las vetas" en `sprite-rendering`), asociado por identificador, sin crear sprites durante
la partida más allá de una reserva igual a la suma de los topes de los cinco tipos. El tamaño en pantalla lo fija el
aspecto de su tipo, no `gemRadius`. MUST NOT quedar visible ningún sprite de un recogible recogido, y un sprite
reutilizado MUST tomar el aspecto del tipo (y, en la piedra, de la roca) del recogible que pinta en ese frame.

<!-- Escenarios vivos sin cambios: "Recogidas y nuevas", "Tope de gemas pintado", "Todas recogidas", "Sprite
     reutilizado con otro tipo" y "Sprite reutilizado para la carne". El escenario vivo "Topes de los cuatro tipos
     pintados" se sustituye por "Topes de los cinco tipos pintados". -->

#### Scenario: Topes de los cinco tipos pintados
- **GIVEN** un snapshot con `maxGems` gemas, tantos recogibles `gold` como el tope de oro, tantos `wood` como el de
  madera, tantos `meat` como el de carne y `maxStone` recogibles `stone` con orígenes de las tres rocas
- **WHEN** se pinta
- **THEN** hay exactamente un sprite visible por recogible, cada uno con el aspecto de su tipo (y cada piedra con el de
  la roca de su origen), y ninguno de reserva

#### Scenario: Sprite reutilizado para la piedra
- **GIVEN** los datos de aspecto con roca `large` en `goblin-tnt-guard` y `small` en `goblin-torch`, y un snapshot
  pintado con 1 recogible `stone` de origen `goblin-tnt-guard` y 0 de otro tipo
- **WHEN** se pinta un snapshot en el que esa piedra se ha recogido y hay 1 recogible `stone` nuevo de origen
  `goblin-torch`
- **THEN** hay exactamente 1 sprite de recogible visible, con el aspecto de la roca `small`, en la posición de la piedra
  nueva

### Requirement: Recogibles con tipo
El sistema SHALL representar todo lo que el jugador recoge del suelo como **recogibles**, cada uno con un tipo de la
unión cerrada `xp | gold | wood | meat | stone`, un valor entero ≥ 1, una posición, el radio `gemRadius` (común a los
cinco tipos) y un identificador único en la partida que no se reutiliza, tomado de **una sola secuencia** para los cinco
tipos. Un recogible `stone` creado por una baja lleva además su **origen** (`source`): el tipo de enemigo que la soltó,
que no cambia mientras está en el suelo y solo decide su aspecto; ningún otro tipo tiene origen. Los recogibles se crean
por:
- `xp`: la baja de un enemigo (ver "Suelta de gema por baja");
- `wood`: la baja de un `goblin-barrel` que no ha explotado (ver "Madera del barril abatido" en `enemy-hazards`) y los
  montones del mapa generado (ver "Montones de madera recogibles desde el inicio" en `resources`);
- `gold`: la destrucción de una casa o una torre (ver "Vida, destrucción y ruina" en `goblin-structures`) y la baja de un
  enemigo abatido cuyo tipo tiene oro por baja (ver "Oro por enemigo abatido" en `resources`);
- `meat`: la muerte de una oveja, y nada más (ver "Carne de las ovejas abatidas" en `resources`);
- `stone`: la baja de un enemigo abatido cuya tirada de piedra la suelta, y nada más (ver "Piedra por enemigo abatido"
  en `resources`).

Los cinco tipos comparten las reglas de suelo, imán, recogida, recolocación y pintado de esta spec; solo difieren en el
efecto de la recogida (ver "Recogida de gemas") y en su tope (ver "Tope de gemas en el suelo"). Ningún tipo caduca.
Crear, mover o recoger un recogible MUST NOT consumir azar; la única tirada es la de "Piedra por enemigo abatido" (1 valor
por baja), que consume solo el azar de la piedra.

<!-- Escenario vivo sin cambios: "Ningún enemigo ni estructura suelta carne". Los
     escenarios vivos "Una secuencia de identificadores" y "Tipos del snapshot" se sustituyen por los de abajo. -->

#### Scenario: Una secuencia de identificadores
- **GIVEN** el mapa vacío sin montones, probabilidad de piedra 100 en `goblin-barrel` y 0 en el resto, oro por baja 0
  y, en el tick n, un `goblin-torch` (antes en la lista) y un `goblin-barrel` que mueren por armas, una torre que queda
  destruida y una oveja que muere, todo en el mismo paso de armas
- **WHEN** se ejecuta el tick n
- **THEN** hay 6 recogibles nuevos con identificadores distintos creados en este orden: `xp` del `goblin-torch`, `xp`
  del barril, `wood` del barril, `stone` del barril, `gold` de la torre y `meat` de la oveja

#### Scenario: Tipos del snapshot
- **GIVEN** una partida con 1 recogible de cada tipo en el suelo, el `stone` soltado por un `goblin-tnt`
- **WHEN** se lee el snapshot
- **THEN** cada recogible figura con su tipo (`xp`, `gold`, `wood`, `meat` o `stone`), su valor, su posición, radio 5 y
  su identificador, el `stone` además con `source` `goblin-tnt`, y ninguno de los otros cuatro tiene `source`
