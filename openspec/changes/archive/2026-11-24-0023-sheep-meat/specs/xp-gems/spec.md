# Spec delta · xp-gems

<!-- Change 0023-sheep-meat: cuarto tipo de recogible `meat` (carne), con su tope, su efecto (curar, ver
     `player-health`) y su sitio en el pool de pintado. Las reglas de suelo, imán, recolocación y orden ya se
     escriben "para cualquier tipo" y valen para la carne sin cambios. La oveja de prueba es la de `sheep`. -->

## ADDED Requirements

### Requirement: Carne como recogible
El sistema SHALL tratar la carne como un recogible más: un recogible `meat` está quieto en el suelo sin caducidad
mientras no está atraído, el imán lo atrae y lo mueve con la regla de "Imán de gemas", se recoge por solape con la regla
de "Recogida de gemas", se recoloca con "Recolocación de gemas en celdas no caminables" y ocupa su sitio en el orden de
creación de la lista de recogibles, sin agrupar por tipo. Crear, mover o recoger carne MUST NOT consumir azar.

#### Scenario: Mismo imán para la carne
- **GIVEN** `pickupRadius` 64, un jugador quieto en (480, 270) y un recogible `meat` en (544, 270)
- **WHEN** se ejecutan 8 ticks
- **THEN** el recogible está en (538, 270) tras el tick 1, en (502, 270) tras el tick 7 y se recoge en el tick 8

#### Scenario: Carne fuera del radio
- **GIVEN** `pickupRadius` 128, un jugador quieto en (480, 270) con vida 50 de 100 y un recogible `meat` en (609, 270)
  (distancia 129)
- **WHEN** se ejecutan 36.000 ticks sin enemigos
- **THEN** el recogible sigue en (609, 270) y la vida sigue en 50

#### Scenario: La carne no consume azar
- **GIVEN** dos partidas con la semilla 7 y el mismo estado salvo que en una hay 4 recogibles `meat` más en el suelo y
  se recoge 1 en el tick n
- **WHEN** ambas ejecutan el tick n sin oferta de mejora ni aparición
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick

## MODIFIED Requirements

### Requirement: Contenido de gemas validado
El sistema SHALL leer de `content/*.json`, validados con zod antes de llegar al dominio, el radio de recogida base
del jugador (`pickupRadius`, en `content/player.json`) y, en el fichero de progresión, el radio de los recogibles
(`gemRadius`, el mismo para los cuatro tipos), la velocidad del imán en px/s (`magnetSpeed`), el tope de gemas (`xp`) en
el suelo (`maxGems`), el tope de recogibles de oro, el de madera y el de carne en el suelo. Las reglas son:
`pickupRadius`, `gemRadius` y `magnetSpeed` > 0; `maxGems` y los topes de oro, de madera y de carne, enteros ≥ 1; el
tope de madera MUST ser ≥ el número de montones de madera por mapa (ver `resources`), para que ningún montón se funda
con otro al crear la partida. Un campo ausente, fuera de rango o desconocido MUST impedir que la partida arranque con un
error que nombre el campo.

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** `pickupRadius` vale 128, `gemRadius` 5, `magnetSpeed` 360 y `maxGems` 300 (provisional, a medir en apply)
- **AND** los topes de oro, de madera y de carne son enteros ≥ 1 y el de madera es ≥ el número de montones por mapa

#### Scenario: Valores no positivos
- **GIVEN** un contenido con, en un caso cada vez, `pickupRadius` 0, `gemRadius` 0, `magnetSpeed` 0,
  `magnetSpeed` −1, `maxGems` 0, el tope de oro 0, el tope de madera 0 o el tope de carne 0
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo
- **AND** no se crea ninguna partida

#### Scenario: Tope de gemas no entero
- **GIVEN** un contenido con `maxGems` 12,5, en otro caso el tope de oro 2,5 y en otro el tope de carne 1,5
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `maxGems`, el tope de oro y el tope de carne respectivamente

#### Scenario: Campo desconocido o ausente
- **GIVEN** un fichero de progresión con un campo extra `gemLifetime: 600`, en otro caso sin `magnetSpeed`, en otro
  sin el tope de madera y en otro sin el tope de carne
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error explícito que nombra el campo

#### Scenario: Tope mínimo válido
- **GIVEN** el contenido por defecto con `maxGems` 1, el tope de oro 1 y el tope de carne 1
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Tope de madera menor que los montones
- **GIVEN** el contenido por defecto con 6 montones por mapa y el tope de madera 5, y en otro caso 6
- **WHEN** se carga el contenido
- **THEN** con 5 la carga falla con un error que nombra el tope de madera, y con 6 tiene éxito

### Requirement: Recogida de gemas
El sistema SHALL recoger en el paso de recogibles, tras el movimiento del imán, todo recogible cuyo círculo solape el
del jugador (distancia < radio del jugador + `gemRadius`, 21 con los valores por defecto), atraído o no, sea cual sea
su tipo. Un recogible recogido desaparece de forma irreversible en ese mismo tick y su valor se aplica según su tipo: el
de `xp`, a la XP del jugador (ver `leveling`); el de `gold`, al oro; el de `wood`, a la madera (ver "Contadores de oro y
madera de la partida" en `resources`); el de `meat`, como curación del jugador (ver "Curación por carne" en
`player-health`). Varios recogibles recogidos en el mismo tick aplican todos su valor en ese tick. Un recogible `meat`
se recoge aunque el jugador tenga la vida al máximo (su valor se pierde).

#### Scenario: Recogida de una gema
- **GIVEN** un jugador quieto en (480, 270) con 0 XP en nivel 1 y una gema de valor 1 en (500, 270)
- **WHEN** se ejecuta 1 tick
- **THEN** la gema no está en el snapshot y la XP actual vale 1

#### Scenario: Tangencia tras el imán no es recogida
- **GIVEN** un jugador quieto en (480, 270) y una gema atraída en (507, 270) (distancia 27)
- **WHEN** se ejecuta 1 tick (la gema queda a distancia 21 = 16 + 5)
- **THEN** la gema sigue en el snapshot, en (501, 270)
- **AND** se recoge en el tick siguiente

#### Scenario: Gema de una baja junto al jugador
- **GIVEN** un jugador quieto en (480, 270) y un `goblin-torch` con vida 4 que muere en el paso de armas del tick n en
  (490, 270)
- **WHEN** se ejecuta el tick n
- **THEN** la gema de ese `goblin-torch` se crea, pasa a atraída, avanza hasta (484, 270) y se recoge en el mismo tick n
- **AND** el snapshot del tick n no la contiene y la XP ya incluye su valor

#### Scenario: Varias gemas en el mismo tick
- **GIVEN** un jugador quieto en (480, 270) con 0 XP en nivel 1 y 4 gemas de valor 1 en su misma posición
- **WHEN** se ejecuta 1 tick
- **THEN** desaparecen las 4 y la XP actual vale 4

#### Scenario: Efecto según el tipo
- **GIVEN** un jugador quieto en (480, 270) con XP 0, oro 0, madera 0 y vida 50 de 100, y en (500, 270) un recogible
  `gold` de valor 12, uno `wood` de valor 3 y uno `meat` de valor 1, con curación del 20 %
- **WHEN** se ejecuta 1 tick
- **THEN** desaparecen los tres, el oro vale 12, la madera 3, la vida 70 y la XP sigue en 0 sin ninguna subida de nivel

#### Scenario: Madera del barril recogida en su tick
- **GIVEN** un jugador quieto en (480, 270) con madera 0 y un `goblin-barrel` con vida 4 que muere por armas en el tick
  n en (490, 270), con madera por barril 2
- **WHEN** se ejecuta el tick n
- **THEN** su gema y su madera se recogen en el tick n: la XP incluye 2 y la madera vale 2

#### Scenario: Carne con la vida llena
- **GIVEN** un jugador quieto en (480, 270) con vida 100 de 100 y un recogible `meat` de valor 1 en (490, 270)
- **WHEN** se ejecuta 1 tick
- **THEN** el recogible desaparece y la vida sigue en 100

### Requirement: Tope de gemas en el suelo
El sistema SHALL impedir, **por tipo**, que haya en el suelo más recogibles de ese tipo que su tope: `maxGems` para
`xp`, el tope de oro para `gold`, el de madera para `wood` y el de carne para `meat`. Si al crearse un recogible ya hay
en el suelo tantos de su tipo como su tope, no se crea uno nuevo: su valor MUST sumarse al del recogible **más antiguo
de su mismo tipo** que siga en el suelo (el de creación más temprana), sin que se pierda valor. Los recogibles de un tipo
nunca reciben el valor de otro tipo, y los de otros tipos no ocupan plaza en el tope de un tipo. Los recogidos en un
tick liberan su plaza para los ticks siguientes (las bajas, las muertes de ovejas y las destrucciones de un tick ocurren
antes del paso de recogibles de ese tick). Los montones de madera ocupan plaza de madera desde el tick 0.

#### Scenario: Tope lleno
- **GIVEN** `maxGems` 300, 300 gemas de valor 1 en el suelo lejos del jugador y un `goblin-torch` con vida 4
- **WHEN** el `goblin-torch` muere por armas
- **THEN** el snapshot sigue teniendo 300 gemas con los mismos identificadores
- **AND** al recoger después la gema más antigua el jugador suma 2 de XP

#### Scenario: Varias bajas con el tope lleno
- **GIVEN** `maxGems` 1, una gema g1 de valor 1 en el suelo lejos del jugador y tres enemigos, un `goblin-torch`, un
  `goblin-barrel` y un `goblin-tnt` (1 + 2 + 4 de XP), que mueren por armas en el mismo tick
- **WHEN** se ejecuta ese tick
- **THEN** sigue habiendo exactamente 1 gema, g1, y al recogerla el jugador suma 8 de XP

#### Scenario: Plaza liberada por una recogida
- **GIVEN** `maxGems` 1 y una única gema g1 que se recoge en el tick n
- **WHEN** en el tick n + 1 muere un `goblin-torch` por armas lejos del jugador
- **THEN** el snapshot del tick n + 1 contiene exactamente 1 gema, nueva y distinta de g1

#### Scenario: Tope de XP lleno con otros tipos en el suelo
- **GIVEN** `maxGems` 300, 300 gemas de valor 1, 10 recogibles `wood`, 4 `gold` y 2 `meat`, todos lejos del jugador, y
  un `goblin-torch` con vida 4 que muere por armas
- **WHEN** se ejecuta ese tick
- **THEN** hay 300 gemas con los mismos identificadores, la más antigua vale 2, y los 10 `wood`, los 4 `gold` y los 2
  `meat` siguen con sus valores

#### Scenario: Tope de madera lleno
- **GIVEN** el tope de madera 2, 2 recogibles `wood` w1 (más antiguo) y w2 de valor 4 en el suelo lejos del jugador,
  0 gemas y un `goblin-barrel` con vida 4 que muere por armas lejos del jugador, con madera por barril 3
- **WHEN** se ejecuta ese tick
- **THEN** hay exactamente 2 recogibles `wood`, w1 con valor 7 y w2 con valor 4, y 1 gema nueva del barril

#### Scenario: Tope de oro lleno
- **GIVEN** el tope de oro 1, un recogible `gold` de valor 10 en el suelo lejos del jugador y una casa con oro 25 que
  queda destruida en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** sigue habiendo exactamente 1 recogible `gold`, con valor 35

#### Scenario: Recoger otro tipo no libera plaza de XP
- **GIVEN** `maxGems` 1, una gema g1 lejos del jugador y un recogible `wood` que se recoge en el tick n
- **WHEN** en el tick n + 1 muere un `goblin-torch` por armas lejos del jugador
- **THEN** sigue habiendo exactamente 1 gema, g1, con su valor más 1

#### Scenario: Tope de carne lleno
- **GIVEN** el tope de carne 2, carne por oveja 1, 2 recogibles `meat` m1 (más antiguo) y m2 de valor 1 en el suelo
  lejos del jugador y una oveja que muere por armas lejos del jugador en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** hay exactamente 2 recogibles `meat`, m1 con valor 2 y m2 con valor 1, con los mismos identificadores

### Requirement: Pintado de las gemas
El adaptador de render SHALL mostrar en cada frame exactamente un sprite visible por cada recogible del último
snapshot, en su posición (error ≤ 0,001) y con el aspecto de su tipo (ver "Aspectos de los recogibles y de las
vetas" en `sprite-rendering`), asociado por identificador, sin crear sprites durante la partida más allá de una
reserva igual a la suma de los topes de los cuatro tipos. El tamaño en pantalla lo fija el aspecto de su tipo, no
`gemRadius`. MUST NOT quedar visible ningún sprite de un recogible recogido, y un sprite reutilizado MUST tomar el
aspecto del tipo del recogible que pinta en ese frame.

#### Scenario: Recogidas y nuevas
- **GIVEN** un snapshot con 10 gemas ya pintado
- **WHEN** se pinta un snapshot en el que 3 se han recogido y han aparecido 2 nuevas
- **THEN** hay exactamente 9 sprites de gema visibles, cada uno en la posición de una gema distinta del snapshot

#### Scenario: Tope de gemas pintado
- **GIVEN** un snapshot con 300 gemas
- **WHEN** se pinta
- **THEN** hay exactamente 300 sprites de gema visibles, todos con el aspecto de la gema

#### Scenario: Todas recogidas
- **GIVEN** un snapshot con 300 gemas ya pintado
- **WHEN** se pinta un snapshot sin gemas
- **THEN** no hay ningún sprite de gema visible

#### Scenario: Topes de los cuatro tipos pintados
- **GIVEN** un snapshot con `maxGems` gemas, tantos recogibles `gold` como el tope de oro, tantos `wood` como el de
  madera y tantos `meat` como el de carne
- **WHEN** se pinta
- **THEN** hay exactamente un sprite visible por recogible, cada uno con el aspecto de su tipo, y ninguno de reserva

#### Scenario: Sprite reutilizado con otro tipo
- **GIVEN** un snapshot pintado con 1 gema y 0 recogibles de otro tipo
- **WHEN** se pinta un snapshot en el que la gema se ha recogido y hay 1 recogible `gold` nuevo
- **THEN** hay exactamente 1 sprite de recogible visible, con el aspecto del oro, en la posición del recogible `gold`

#### Scenario: Sprite reutilizado para la carne
- **GIVEN** un snapshot pintado con 1 recogible `wood` y 0 de otro tipo
- **WHEN** se pinta un snapshot en el que el `wood` se ha recogido y hay 1 recogible `meat` nuevo
- **THEN** hay exactamente 1 sprite de recogible visible, con el aspecto de la carne, en la posición del `meat`

### Requirement: Recogibles con tipo
El sistema SHALL representar todo lo que el jugador recoge del suelo como **recogibles**, cada uno con un tipo de la
unión cerrada `xp | gold | wood | meat`, un valor entero ≥ 1, una posición, el radio `gemRadius` (común a los cuatro
tipos) y un identificador único en la partida que no se reutiliza, tomado de **una sola secuencia** para los cuatro
tipos. Los recogibles se crean por:
- `xp`: la baja de un enemigo (ver "Suelta de gema por baja");
- `wood`: la baja de un `goblin-barrel` que no ha explotado (ver "Madera del barril abatido" en `enemy-hazards`) y los
  montones del mapa generado (ver "Montones de madera recogibles desde el inicio" en `resources`);
- `gold`: la destrucción de una casa o una torre (ver "Vida, destrucción y ruina" en `goblin-structures`);
- `meat`: la muerte de una oveja, y nada más (ver "Carne de las ovejas abatidas" en `resources`).

Los cuatro tipos comparten las reglas de suelo, imán, recogida, recolocación y pintado de esta spec; solo difieren en el
efecto de la recogida (ver "Recogida de gemas") y en su tope (ver "Tope de gemas en el suelo"). Ningún tipo caduca.
Crear, mover o recoger un recogible MUST NOT consumir azar.

#### Scenario: Una secuencia de identificadores
- **GIVEN** el mapa vacío sin montones y, en el tick n, un `goblin-torch` (antes en la lista) y un `goblin-barrel` que
  mueren por armas, una torre que queda destruida y una oveja que muere, todo en el mismo paso de armas
- **WHEN** se ejecuta el tick n
- **THEN** hay 5 recogibles nuevos con identificadores distintos creados en este orden: `xp` del `goblin-torch`, `xp`
  del barril, `wood` del barril, `gold` de la torre y `meat` de la oveja

#### Scenario: Tipos del snapshot
- **GIVEN** una partida con 1 recogible de cada tipo en el suelo
- **WHEN** se lee el snapshot
- **THEN** cada recogible figura con su tipo (`xp`, `gold`, `wood` o `meat`), su valor, su posición, radio 5 y su
  identificador

#### Scenario: Ningún enemigo ni estructura suelta carne
- **GIVEN** el contenido por defecto salvo una vida máxima suficiente para no llegar a 0 en 36.000 ticks, la semilla 7
  con su mapa generado y el tope de ovejas 0, un input aleatorio generado por una seed fija y la política de elección
  fija
- **WHEN** se ejecutan 36.000 ticks
- **THEN** en ningún snapshot hay un recogible `meat`
