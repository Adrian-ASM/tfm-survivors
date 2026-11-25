# Spec delta · procedural-map

## ADDED Requirements

### Requirement: Solares en el mapa generado
El sistema SHALL colocar, en cada mapa generado, solares hasta el número por mapa del contenido (6 con el contenido por
defecto), en un **orden fijo** (el de la lista de solares de la partida, ver `build-sites`), después de las
estructuras, los recursos y las ovejas, con estas reglas:
- toda celda de la huella del solar (la unión de sus huellas de casa y de torre, con las dimensiones y el acceso que
  fija el design) es `grass`, y la celda del acceso es `grass` y no pertenece a la huella;
- la distancia en celdas (medida igual que en "Estructuras en el mapa generado" de `goblin-structures`) de la huella
  del solar y de la celda del acceso a las celdas de la zona de inicio, a la huella del castillo y a las celdas `water`
  y `bridge` es ≥ el parámetro respectivo de colocación de solares;
- la huella del solar y la celda del acceso no contienen ninguna celda de la huella ni de la puerta de una estructura,
  ni la celda de una veta, de un montón de madera o de la posición inicial de una oveja, y su distancia en celdas a la
  huella de cada estructura es ≥ el parámetro respectivo;
- la distancia en celdas entre las huellas de dos solares es ≥ la separación mínima entre solares;
- la **distancia de ruta** del solar, que es la distancia de la celda de su acceso en el campo de distancias hacia la
  celda del punto de salida (ver "Campo de distancias hacia una celda"), calculado sin edificios, está en el rango de
  ruta del contenido, ambos extremos incluidos: **18 a 35 celdas** con el contenido por defecto.

Si con un contenido dado no caben todos, el sistema coloca los que quepan, sin error y sin incumplir ninguna regla. Con
el contenido por defecto MUST colocarse exactamente 6 solares con toda semilla de 1 a 50. Colocar solares MUST NOT
cambiar el tipo de ninguna celda.

#### Scenario: Reglas de colocación con las semillas del conjunto
- **GIVEN** el contenido por defecto
- **WHEN** se genera el mapa de cada semilla de 1 a 50 y se colocan sus estructuras, recursos, ovejas y solares
- **THEN** cada mapa tiene exactamente 6 solares
- **AND** cada huella de solar y cada celda de acceso es `grass`, no contiene huellas ni puertas de estructuras ni
  celdas de vetas, montones u ovejas iniciales, y se cumplen las distancias a la zona de inicio, al castillo, al río y a
  las estructuras y la separación entre solares
- **AND** la distancia de ruta de cada solar está entre 18 y 35 celdas, ambas incluidas

#### Scenario: Contenido sin hueco suficiente
- **GIVEN** el contenido por defecto con 500 solares por mapa
- **WHEN** se genera el mapa de la semilla 7 y se crea la partida
- **THEN** la partida se crea sin error, con < 500 solares, y todos cumplen las reglas de colocación

#### Scenario: Sin solares
- **GIVEN** el contenido por defecto con 0 solares por mapa
- **WHEN** se crea una partida con la semilla 42 y se ejecutan 3.600 ticks
- **THEN** la lista de solares está vacía en todos los snapshots

#### Scenario: Celdas intactas con solares
- **GIVEN** el mapa de la semilla 42 con sus solares colocados
- **WHEN** se leen las celdas de cada huella y de cada acceso
- **THEN** todas son `grass` y el mapa es igual celda a celda al generado sin solares

### Requirement: Colocación de solares determinista con azar propio
El sistema SHALL colocar los solares a partir de la semilla con un **séptimo flujo de azar propio** derivado de ella
(`SITE_STREAM` 7), distinto del de las celdas del mapa, la decoración, las estructuras, los recursos, las ovejas, la
piedra y la partida. La misma semilla y el mismo contenido MUST dar los mismos solares (acceso, huellas y orden) en dos
generaciones y en dos partidas, sea cual sea lo que ocurra después en la partida. Colocar solares MUST NOT cambiar
ninguna celda, estructura, recurso u oveja ni la secuencia de valores que recibe ningún otro flujo. Las firmas
`MAP_GOLDEN`, `STRUCTURE_GOLDEN`, `RESOURCE_GOLDEN`, `SHEEP_GOLDEN` y `STONE_GOLDEN` MUST NOT cambiar en este change;
los tests MUST versionar una firma nueva `SITE_GOLDEN` de los solares de un conjunto de semillas que incluye la 42 y la
123, que corresponde al contenido por defecto vigente.

#### Scenario: Misma semilla, mismos solares
- **GIVEN** el contenido por defecto y la semilla 42
- **WHEN** se crean dos partidas y en una se ejecutan 3.600 ticks con un input aleatorio
- **THEN** sus listas de solares del tick 0 son iguales: mismo orden, accesos y huellas

#### Scenario: Semillas distintas, solares distintos
- **GIVEN** el contenido por defecto
- **WHEN** se colocan los solares de las semillas 1 a 50
- **THEN** no hay dos semillas con la misma lista de accesos de solares

#### Scenario: Los solares no cambian nada más
- **GIVEN** el contenido por defecto y, en otra configuración, el mismo contenido con 0 solares por mapa
- **WHEN** se genera el mapa y se colocan las estructuras, los recursos y las ovejas de cada semilla de 1 a 50 con
  ambas configuraciones
- **THEN** cada semilla da las mismas celdas, estructuras, recursos y ovejas con las dos
- **AND** las firmas `MAP_GOLDEN`, `STRUCTURE_GOLDEN`, `RESOURCE_GOLDEN`, `SHEEP_GOLDEN` y `STONE_GOLDEN` son las de
  antes del change

#### Scenario: Firma de referencia de los solares
- **GIVEN** el contenido por defecto y la firma `SITE_GOLDEN` versionada en los tests
- **WHEN** se colocan los solares de las semillas de la firma (42 y 123 incluidas) y se calcula su firma
- **THEN** coincide con la versionada

#### Scenario: Colocar solares no consume el azar de la partida
- **GIVEN** dos partidas con la semilla 7, una con el contenido por defecto y otra con 0 solares por mapa
- **WHEN** se compara el estado del `RandomGenerator` de la partida, el del azar de las ovejas y el de la piedra al
  crearlas
- **THEN** son los mismos en las dos

### Requirement: Conectividad con los edificios construidos
El sistema SHALL mantener "Conectividad" con los edificios construidos: con el contenido por defecto y cada semilla de
1 a 50, tanto con los 6 solares construidos como casa como con los 6 construidos como torre, toda celda caminable
(las construidas ya no lo son) MUST ser alcanzable desde el punto de salida, con la definición de alcanzable de
"Conectividad"; en particular, el acceso de cada solar y la puerta de la tienda.

#### Scenario: Todo construido sin zonas aisladas
- **GIVEN** el contenido por defecto, radio del jugador 16 y el mapa de cada semilla de 1 a 50 con sus 6 solares
  construidos como casa y, aparte, como torre
- **WHEN** se evalúa la conectividad desde (1.950, 1.170)
- **THEN** en cada mapa el 100 % de las celdas caminables es alcanzable (0 zonas aisladas)

## MODIFIED Requirements

### Requirement: Rejilla de celdas tipadas
El sistema SHALL representar el mapa de cada partida como una rejilla de ⌈ancho / `cellSize`⌉ columnas por
⌈alto / `cellSize`⌉ filas que cubre el mundo entero; las celdas de la última columna y la última fila se recortan al
borde del mundo si el tamaño no es múltiplo de `cellSize`. Cada celda tiene exactamente un tipo: `grass` (hierba),
`trunk` (tronco), `water` (agua), `bridge` (puente) o `castle` (castillo). Son caminables `grass` y `bridge`; no
caminables `trunk`, `water` y `castle`. Además, una celda de la huella de un **edificio construido** (ver "Edificios que
bloquean el paso" en `build-sites`) es **no caminable** sea cual sea su tipo, que no cambia. El núcleo MUST ofrecer, sin
consumir azar ni depender del jugador:
- el tipo de una celda (c, r) y si es caminable (con los edificios construidos hasta ese momento); una celda fuera de la
  rejilla MUST considerarse no caminable;
- la celda que contiene un punto (x, y) del mundo: (⌊x / `cellSize`⌋, ⌊y / `cellSize`⌋), con x = ancho y y = alto
  asignados a la última columna y la última fila;
- el punto de salida del mapa (ver "Castillo en el mapa generado" y "Mapa explícito y mapa vacío");
- el campo de distancias hacia una celda (ver "Campo de distancias hacia una celda").

Todo lo que dependa de "no caminable" (colisión del jugador, recolocación de gemas y de apariciones, línea libre y
navegación de los enemigos, campo de distancias, conectividad, bot de referencia) MUST tratar una celda `castle` y una
celda construida igual que una `trunk` o una `water`. Donde otra spec enumera las celdas no caminables (`trunk`,
`water` o `castle`), la enumeración incluye las celdas construidas.

<!-- Escenarios vivos sin cambios: todos los de este requisito. -->

#### Scenario: Caminabilidad de una celda construida
- **GIVEN** el mapa vacío con el solar de prueba (`build-sites`) en `free`
- **WHEN** se consulta la caminabilidad y el tipo de cada celda de la huella de la casa antes y después de construir
  la casa
- **THEN** antes son caminables y `grass`; después son no caminables y siguen siendo `grass`

### Requirement: Mapa de la partida de solo lectura
El sistema SHALL permitir al adaptador leer el mapa de la partida (columnas, filas, `cellSize` y tipo de cada celda)
desde que la partida se crea. El tipo de las celdas MUST NOT cambiar durante la partida, tampoco al elegir mejora,
pausar, terminar o construir: lo único que cambia durante la partida es la caminabilidad de las celdas de los
edificios construidos, que se lee en la lista de solares (ver `build-sites`). Modificar desde fuera lo leído MUST NOT
cambiar el mapa ni la simulación.

<!-- Escenarios vivos sin cambios: todos los de este requisito. -->

#### Scenario: Tipos constantes con edificios
- **GIVEN** una partida con el contenido por defecto y la semilla 42 en la que se construye una casa en el tick n
- **WHEN** se lee el mapa en el tick 0, en el tick n tras construir y con la partida terminada
- **THEN** las tres lecturas son iguales celda a celda

### Requirement: Campo de distancias hacia una celda
El sistema SHALL ofrecer en el núcleo, para el mapa de una partida y una celda objetivo T, el **campo de distancias**:
para cada celda, el menor número de pasos entre celdas caminables vecinas por un lado (arriba, abajo, izquierda o
derecha; sin diagonales) necesarios para ir de ella a T. T tiene distancia 0. Una celda no caminable (las construidas
incluidas), o caminable pero sin camino 4-vecino hasta T, no tiene distancia; si T no es caminable, ninguna celda la
tiene. El campo:
- MUST depender solo del mapa, de los edificios construidos y de T: el mismo mapa, los mismos edificios y la misma T dan
  el mismo campo celda a celda, sea cual sea el momento, la historia de la partida, la posición del jugador dentro de T
  o la ventana;
- MUST NOT consumir azar ni modificar el mapa (es una consulta de solo lectura, ver "Mapa de la partida de solo
  lectura");
- MUST recalcularse cuando se construye un edificio, y solo entonces cambia por el mapa; también los campos hacia los
  puntos fijos de los guardias (ver "Navegación hacia un punto fijo" en `enemy-behavior`).

<!-- Escenarios vivos sin cambios: todos los de este requisito. -->

#### Scenario: Campo con un edificio
- **GIVEN** el mapa vacío de 64 × 36, el solar de prueba y una celda objetivo T fuera de su huella
- **WHEN** se calcula el campo hacia T antes y después de construir la casa
- **THEN** antes todas las celdas tienen distancia |c − cT| + |r − rT|; después ninguna celda de la huella tiene
  distancia y ≥ 1 celda al otro lado de la huella respecto a T tiene una distancia mayor que antes

#### Scenario: Mismo campo con los mismos edificios
- **GIVEN** dos partidas con el contenido por defecto y la semilla 42 que construyen la misma casa en el mismo solar,
  una en el tick 1.000 y otra en el tick 3.000
- **WHEN** se calcula en ambas el campo hacia la celda (40, 10) en el tick 3.600
- **THEN** los dos campos son iguales celda a celda

### Requirement: Mapa explícito y mapa vacío
El sistema SHALL permitir crear una partida con un mapa dado en lugar del generado, en particular el **mapa vacío**
(todas las celdas `grass`, del tamaño de rejilla que dicte el contenido). Un mapa dado MUST tener las dimensiones de
rejilla del contenido; si no, la partida no se crea y el error lo dice. Un mapa dado no tiene que cumplir
"Composición del mapa", "Zona de inicio" ni "Conectividad" (lo usan los tests para fijar casos) y puede contener
celdas de cualquier tipo, también `castle`; al mapa dado no se le añade ningún castillo y no tiene huella (sus celdas
`castle` son celdas sueltas no caminables).

Un mapa dado no tiene estructuras salvo las que declare (tipo y huella de cada una, ver `goblin-structures`), sin
reglas de colocación: cada huella declarada MUST caber en la rejilla y, si es una casa, también la celda de su
puerta; si no, la partida no se crea y el error menciona la estructura. Del mismo modo, un mapa dado no tiene vetas ni
montones de madera salvo los que declare (posición de cada uno; el valor es el del contenido), sin reglas de
colocación: cada posición declarada MUST estar dentro del mundo; si no, la partida no se crea y el error menciona la
veta o el montón. Tampoco tiene ovejas salvo las que declare (posición de cada una, en el orden de la lista de ovejas;
la vida y el resto de parámetros son los del contenido, salvo los que fije el escenario), sin reglas de colocación ni
tope: cada posición declarada MUST ser una posición legal de una oveja (su círculo dentro de los límites del mundo y sin
solapar celdas no caminables); si no, la partida no se crea y el error menciona la oveja. Las ovejas declaradas
reaparecen con "Reaparición de ovejas" (`sheep`). Tampoco tiene **solares** salvo los que declare (la celda de
referencia de cada uno, de la que se derivan su huella de casa, su huella de torre y su acceso con las reglas del
design, en el orden de la lista de solares), sin reglas de colocación ni de ruta: la huella del solar y su acceso MUST
caber en la rejilla y en el mundo; si no, la partida no se crea y el error menciona el solar. El mapa vacío no tiene
estructuras, vetas, montones, ovejas ni solares.

Un mapa dado puede declarar su punto de salida. Si no lo declara, la salida es el centro del mundo (ancho / 2,
alto / 2), sin comprobar si es legal. Si lo declara, la salida MUST ser una posición legal del jugador en ese mapa
(dentro de los límites de la arena y sin solapar celdas no caminables); si no, la partida no se crea y el error
menciona el punto de salida. El mapa vacío no declara salida: con él la partida se comporta como antes del change
0015 en movimiento, gemas, spawns y posición inicial.

Convención para todas las specs: un escenario que coloca elementos en posiciones explícitas y no declara mapa se
entiende con el mapa vacío; un escenario que usa "el contenido por defecto" y una semilla sin posiciones explícitas
juega con el mapa generado para esa semilla (con castillo, salida ante la puerta, casas, torres, guardias, vetas,
montones, ovejas y solares), salvo que diga otra cosa. Un escenario que coloca una oveja de prueba o un solar de prueba
en el mapa vacío lo declara como oveja o solar del mapa.

<!-- Escenarios vivos sin cambios: todos los de este requisito; "Partida con mapa vacío" añade "ni solares" a la lista
     de lo que no hay. -->

#### Scenario: Mapa explícito con solares declarados
- **GIVEN** el contenido por defecto y el mapa vacío con dos solares declarados s1 y s2, en ese orden, con sus huellas y
  accesos dentro de la rejilla
- **WHEN** se crea la partida
- **THEN** la lista de solares del tick 0 tiene exactamente s1 y s2, en ese orden, en `free` y armados, y las 2.304
  celdas siguen siendo `grass` y caminables

#### Scenario: Solar declarado fuera de la rejilla
- **GIVEN** el contenido por defecto y el mapa vacío con un solar declarado cuya huella sale por la columna 64, y en otro
  caso uno cuyo acceso cae fuera del mundo
- **WHEN** se intenta crear la partida
- **THEN** no se crea y el error menciona el solar
