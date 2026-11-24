# XP gems · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
Los recogibles con tipo (XP, oro y madera) que sueltan las bajas, las estructuras destruidas y el mapa, el imán que los atrae y su recogida.

## Requirements

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

### Requirement: Suelta de gema por baja
El sistema SHALL crear, por cada enemigo dado de baja en un tick, por armas o por explosión (la del propio barril que
explota o una ajena, ver `enemy-hazards`), exactamente una gema en la posición que tenía el enemigo en el paso en que
queda dado de baja (paso de armas o paso de peligros, ver "Orden de los pasos del tick" en `simulation-loop`), o en
la que fije "Recolocación de gemas en celdas no caminables" si esa posición está en una celda no caminable, con un
valor de XP igual al `xp` de su tipo (ver `enemy-spawning`) y el radio `gemRadius`. Los recogibles de las bajas de un
mismo paso se crean en el orden de la lista de enemigos y, para cada baja, primero su gema y después su madera si la
suelta (ver "Madera del barril abatido" en `enemy-hazards`); los del paso de armas, antes que los del paso de
peligros; en el paso de armas, el oro de las estructuras destruidas se crea después de los recogibles de todas las
bajas de ese paso (ver `goblin-structures`). Cada recogible tiene un identificador único en la partida que no se
reutiliza (ver "Recogibles con tipo"). Crear recogibles MUST NOT consumir azar. Un recogible creado en un tick participa
en el paso de recogibles de ese mismo tick (ver `simulation-loop`). Una baja suelta una sola gema (y como mucho un
recogible de madera) aunque reciba daño de armas y de explosiones en el mismo tick.

#### Scenario: Un goblin-torch abatido suelta una gema
- **GIVEN** un jugador quieto en (480, 270) y un `goblin-torch` con vida 4 en (780, 270) que permanece ahí
- **WHEN** en el tick n el `goblin-torch` muere por un impacto del Linter en (780, 270)
- **THEN** el snapshot del tick n contiene exactamente 1 gema nueva, en (780, 270), con radio 5
- **AND** al recogerla el jugador suma 1 de XP

#### Scenario: Valor según el tipo
- **GIVEN** el contenido por defecto
- **WHEN** muere por armas un enemigo de cada tipo, lejos del jugador
- **THEN** al recoger sus gemas la XP sumada es 1 por la de `goblin-torch`, 2 por la de `goblin-barrel` y 4 por
  la de `goblin-tnt`

#### Scenario: Varias bajas en el mismo tick
- **GIVEN** tres `goblin-torch` a1, a2, a3 (en ese orden de aparición) con vida 4 que mueren en el mismo pulso de Tests
- **WHEN** se ejecuta ese tick
- **THEN** el snapshot contiene 3 gemas nuevas, cada una en la posición de uno de ellos, con identificadores
  distintos creados en el orden a1, a2, a3

#### Scenario: Varias bajas en el mismo tick, una sobre agua
- **GIVEN** un mapa de hierba con la celda (5, 5) de `water` y tres `goblin-torch` a1, a2, a3 (en ese orden de
  aparición) con vida 4, a2 en (330, 330) dentro de esa celda, que mueren en el mismo pulso de Tests
- **WHEN** se ejecuta ese tick
- **THEN** el snapshot contiene 3 gemas nuevas con identificadores creados en el orden a1, a2, a3, y la de a2 está en
  (330, 270), centro de la celda (5, 4) (las cuatro vecinas empatan a 60 px y gana la de fila menor)

#### Scenario: Sin baja no hay gema
- **GIVEN** un `goblin-torch` con vida 10 que recibe 1 impacto del Linter y queda con vida 4
- **WHEN** se lee el snapshot de ese tick
- **THEN** no hay ninguna gema nueva

#### Scenario: Las gemas no consumen azar
- **GIVEN** dos partidas con la misma semilla y el mismo estado salvo que en una hay 10 gemas, 5 recogibles `gold` y
  5 `wood` en el suelo más
- **WHEN** ambas ejecutan el mismo tick sin oferta de mejora
- **THEN** el estado del `RandomGenerator` es el mismo en las dos tras el tick

#### Scenario: El barril que explota suelta su gema
- **GIVEN** el contenido por defecto, el jugador lejos y un `goblin-barrel` que explota en el tick n en la posición P
  (celda caminable)
- **WHEN** se ejecuta el tick n
- **THEN** el snapshot del tick n contiene exactamente 1 gema nueva de ese barril, en P, que da 2 de XP

#### Scenario: Bajas por armas y por explosión en el mismo tick
- **GIVEN** un `goblin-torch` A (antes en la lista) que muere por el Linter en el tick n y un `goblin-torch` B que
  muere por una explosión en el mismo tick
- **WHEN** se ejecuta el tick n
- **THEN** hay 2 gemas nuevas y la de A tiene un identificador creado antes que la de B
- **AND** si en otra partida A muere por la explosión y B por el Linter, la de B se crea antes que la de A

#### Scenario: Gema y madera intercaladas por baja
- **GIVEN** un `goblin-barrel` B1, un `goblin-torch` T y un `goblin-barrel` B2, en ese orden de la lista, que mueren
  en el mismo pulso de Tests
- **WHEN** se ejecuta ese tick
- **THEN** los 5 recogibles nuevos se crean en este orden: `xp` de B1, `wood` de B1, `xp` de T, `xp` de B2 y `wood` de
  B2

### Requirement: Gemas en el suelo
El sistema SHALL mantener cada recogible no atraído, de cualquier tipo, quieto en su posición, sin caducidad, mientras
su distancia al jugador sea mayor que el radio de recogida efectivo (ver `upgrades`). Los recogibles no colisionan con
enemigos, proyectiles, vetas, estructuras ni entre sí, y no impiden el movimiento de nada.

#### Scenario: Gema fuera del radio
- **GIVEN** un jugador quieto en (480, 270) y una gema en (545, 270) (distancia 65 > 64)
- **WHEN** se ejecutan 36.000 ticks
- **THEN** la gema sigue en (545, 270) y el jugador no ha sumado XP por ella

#### Scenario: Enemigos encima de una gema
- **GIVEN** una gema en el suelo y un enemigo vivo que pasa por su posición
- **WHEN** se ejecutan los ticks en que se solapan
- **THEN** la gema no se mueve ni desaparece y el enemigo sigue su persecución sin cambios

#### Scenario: Montón fuera del radio
- **GIVEN** `pickupRadius` 64, un jugador quieto en (480, 270) y un recogible `wood` en (545, 270) y otro `gold` en
  (480, 335) (ambos a distancia 65)
- **WHEN** se ejecutan 36.000 ticks
- **THEN** ambos siguen en su posición y el oro y la madera siguen en 0

### Requirement: Imán de gemas
El sistema SHALL marcar como atraído, en el paso de recogibles, todo recogible de cualquier tipo cuya distancia al
jugador (ya movido en ese tick) sea ≤ el radio de recogida efectivo. Un recogible atraído lo sigue siendo hasta que se
recoge, aunque el jugador se aleje. En cada tick, empezando por el tick en que pasa a atraído, un recogible atraído
avanza hacia la posición actual del jugador una distancia de `magnetSpeed / 60` (6 px con el valor por defecto) o la
distancia que lo separa del jugador si es menor. Los recogibles se procesan en orden de creación, sin distinguir tipo.
El imán MUST NOT consumir azar.

#### Scenario: Límite exacto del radio
- **GIVEN** un jugador quieto en (480, 270) y una gema en (544, 270) (distancia 64)
- **WHEN** se ejecuta 1 tick
- **THEN** la gema está en (538, 270): ha pasado a atraída y ha avanzado 6 px

#### Scenario: Recorrido hasta la recogida
- **GIVEN** la partida del escenario anterior antes de su primer tick
- **WHEN** se ejecutan 8 ticks
- **THEN** la gema sigue en el snapshot de los ticks 1 a 7 (en el 7, en (502, 270), distancia 22)
- **AND** no está en el snapshot del tick 8 (distancia 16 < 21) y el jugador ha sumado su XP en el tick 8

#### Scenario: Una gema atraída no se suelta
- **GIVEN** una gema ya atraída a 62 px del jugador y un jugador con velocidad 200 px/s (3,333 px/tick) que se
  aleja de ella por la recta que los une, con input constante y sin tocar los bordes de la arena
- **WHEN** se ejecuta 1 tick (tras moverse el jugador la distancia es 65,333 > 64)
- **THEN** la gema avanza igualmente 6 px y queda a 59,333 px del jugador (error ≤ 0,001)
- **AND** en cada tick siguiente la distancia baja 2,667 px hasta que la gema se recoge

#### Scenario: No sobrepasa al jugador
- **GIVEN** un jugador quieto en (480, 270) y una gema en (483, 270) (distancia 3 < 6)
- **WHEN** se ejecuta 1 tick
- **THEN** la gema se recoge en ese tick

#### Scenario: Mismo imán para los tres tipos
- **GIVEN** `pickupRadius` 64, un jugador quieto en (480, 270) y, en tres partidas, un recogible `xp`, `gold` o `wood`
  en (544, 270)
- **WHEN** se ejecutan 8 ticks
- **THEN** en las tres el recogible está en (538, 270) tras el tick 1, en (502, 270) tras el tick 7 y se recoge en el
  tick 8

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

### Requirement: Recolocación de gemas en celdas no caminables
El sistema SHALL, cuando un recogible de cualquier tipo se crea en un punto cuya celda (ver "Rejilla de celdas tipadas"
en `procedural-map`) es no caminable (`trunk`, `water` o `castle`), crearlo en el centro de la celda caminable más
cercana en vez de en ese punto. La más cercana es la de menor distancia euclídea entre el punto de creación y el centro
de la celda (en una celda recortada del borde, el centro de su rectángulo recortado); a igual distancia gana la de
fila menor y, a igual fila, la de columna menor. Un recogible creado en una celda caminable conserva exactamente su
punto. Recolocar MUST NOT consumir azar y no cambia el tipo, el valor, el radio, el identificador ni el orden de
creación del recogible; el recogible recolocado participa en el paso de recogibles de ese mismo tick como cualquier
otro. La gema y la madera de una misma baja se recolocan a la misma celda.

Un recogible no atraído MUST NOT estar en ningún tick en una celda no caminable. Un recogible atraído sigue la regla de
"Imán de gemas" en línea recta hacia el jugador y puede cruzar celdas no caminables, también las del castillo. Si el
valor se suma al recogible más antiguo de su tipo por el tope (ver "Tope de gemas en el suelo"), no se crea ni se
recoloca ningún recogible. Con el mapa generado los enemigos vivos mantienen el centro en celdas caminables (ver
"Enemigos fuera de celdas no caminables en el mapa generado" en `enemy-behavior`), así que sus bajas no caen en celdas
no caminables; aun así, un enemigo colocado directamente por un escenario o que persigue en línea recta como reserva
(celda sin distancia en el campo) puede morir en una celda no caminable, también dentro de una celda `castle`, y sus
recogibles se recolocan con esta misma regla. El oro de una estructura se crea en su posición (centro de su huella),
que con el mapa generado está en `grass`; en un mapa explícito se recoloca con esta regla si cae en una celda no
caminable.

#### Scenario: Baja sobre un tronco
- **GIVEN** un mapa de hierba con un tronco en (10, 4) (x en [600, 660], y en [240, 300]), un jugador quieto en
  (960, 540) y un `goblin-torch` con vida 4 que muere por armas en (650, 270)
- **WHEN** se ejecuta ese tick
- **THEN** el snapshot contiene 1 gema nueva en (690, 270), centro de la celda (11, 4) (a 40 px del punto de la baja)

#### Scenario: Empate entre celdas
- **GIVEN** el mapa del escenario anterior y un `goblin-torch` con vida 4 que muere por armas en (610, 250), lejos del
  jugador
- **WHEN** se ejecuta ese tick
- **THEN** la gema nueva está en (630, 210), centro de la celda (10, 3): empata a 44,721 px con el de la (9, 4),
  (570, 270), y gana por tener la fila menor

#### Scenario: Baja en un río ancho
- **GIVEN** un mapa de hierba con las filas 8, 9 y 10 (y en [480, 660]) enteras de `water` y un `goblin-torch` con vida
  4 que muere por armas en (300, 560), lejos del jugador
- **WHEN** se ejecuta ese tick
- **THEN** la gema nueva está en (270, 450), centro de la celda (4, 7) (a 114,018 px, la más cercana con la fila
  menor)

#### Scenario: Baja dentro del castillo
- **GIVEN** un mapa de hierba con las celdas de columnas 14–18 y filas 6–9 `castle` (x en [840, 1.140], y en
  [360, 600]), un jugador quieto en (300, 900) y un `goblin-torch` con vida 4 que muere por armas en (990, 480), en la
  celda (16, 8)
- **WHEN** se ejecuta ese tick
- **THEN** la gema nueva está en (990, 330), centro de la celda (16, 5): empata a 150 px con el de la (16, 10),
  (990, 630), y gana por tener la fila menor

#### Scenario: Baja en hierba junto a un tronco
- **GIVEN** un mapa de hierba con un tronco en (10, 4) y un `goblin-torch` con vida 4 que muere por armas en
  (590, 270), en la celda caminable (9, 4)
- **WHEN** se ejecuta ese tick
- **THEN** la gema nueva está exactamente en (590, 270)

#### Scenario: Recolocar no consume azar
- **GIVEN** dos partidas con la misma semilla y el mismo estado salvo que en una el enemigo que muere en el tick n
  está sobre un tronco y en la otra sobre hierba
- **WHEN** ambas ejecutan el tick n sin oferta de mejora
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick

#### Scenario: Gema recolocada recogida en el mismo tick
- **GIVEN** un mapa de hierba con un tronco en (10, 4), un jugador quieto en (690, 285) y un `goblin-torch` con vida 4
  que muere por armas en (650, 270)
- **WHEN** se ejecuta ese tick
- **THEN** la gema se crea en (690, 270) (distancia 15 < 21), se recoge en ese tick y la XP ya incluye su valor

#### Scenario: Barril abatido sobre un tronco
- **GIVEN** el mapa de hierba con el tronco en (10, 4), un jugador quieto en (1.500, 1.000) y un `goblin-barrel` con
  vida 4 que muere por armas en (650, 270)
- **WHEN** se ejecuta ese tick
- **THEN** su gema y su madera están ambas en (690, 270), con la gema creada antes

#### Scenario: Ninguna gema en reposo en celda no caminable
- **GIVEN** el contenido por defecto salvo una vida máxima suficiente para no llegar a 0 en 36.000 ticks, semilla 7,
  el mapa generado para esa semilla (castillo, estructuras, montones y vetas incluidos) y un input aleatorio generado
  por una semilla fija
- **WHEN** se ejecutan 36.000 ticks
- **THEN** en ningún snapshot hay un recogible no atraído, de ningún tipo, cuya celda sea `trunk`, `water` o `castle`

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

<!-- historial: 0005-xp-and-level-up (2026-11-19) -->
<!-- historial: 0012-sprite-rendering (2026-11-22) -->
<!-- historial: 0015-procedural-map (2026-11-23) -->
<!-- historial: 0016-map-art (2026-11-23) -->
<!-- historial: 0019-flow-field (2026-11-24) -->
<!-- historial: 0020-enemy-behaviors (2026-11-24) -->
<!-- historial: 0022-resources-sheep (2026-11-24) -->
<!-- historial: 0023-sheep-meat (2026-11-24) -->
