# Spec delta · procedural-map

## MODIFIED Requirements

### Requirement: Rejilla de celdas tipadas
El sistema SHALL representar el mapa de cada partida como una rejilla de ⌈ancho / `cellSize`⌉ columnas por
⌈alto / `cellSize`⌉ filas que cubre el mundo entero; las celdas de la última columna y la última fila se recortan al
borde del mundo si el tamaño no es múltiplo de `cellSize`. Cada celda tiene exactamente un tipo: `grass` (hierba),
`trunk` (tronco), `water` (agua), `bridge` (puente) o `castle` (castillo). Son caminables `grass` y `bridge`; no
caminables `trunk`, `water` y `castle`. Además, una **celda de obra** (de la huella de un solar `free` desde el tick 0, o
de la huella del edificio de un solar construido; ver "Solar libre que bloquea el paso" y "Edificios que bloquean el
paso" en `build-sites`) es **no caminable** sea cual sea su tipo, que no cambia. El núcleo MUST ofrecer, sin consumir
azar ni depender del jugador:
- el tipo de una celda (c, r) y si es caminable (con las celdas de obra de ese momento); una celda fuera de la rejilla
  MUST considerarse no caminable;
- la celda que contiene un punto (x, y) del mundo: (⌊x / `cellSize`⌋, ⌊y / `cellSize`⌋), con x = ancho y y = alto
  asignados a la última columna y la última fila;
- el punto de salida del mapa (ver "Castillo en el mapa generado" y "Mapa explícito y mapa vacío");
- el campo de distancias hacia una celda (ver "Campo de distancias hacia una celda").

Todo lo que dependa de "no caminable" (colisión del jugador, recolocación de gemas y de apariciones, línea libre y
navegación de los enemigos, campo de distancias, conectividad, bot de referencia) MUST tratar una celda `castle` y una
celda de obra igual que una `trunk` o una `water`. Donde otra spec enumera las celdas no caminables (`trunk`, `water`,
`castle` o las construidas), la enumeración incluye todas las celdas de obra, también las de los solares libres.

<!-- Escenarios vivos sin cambios: "Rejilla por defecto", "Mundo no múltiplo de la celda", "Celda de un punto" y
     "Caminabilidad por tipo y fuera de la rejilla". "Caminabilidad de una celda construida" se sustituye por el de
     abajo. -->

#### Scenario: Caminabilidad de las celdas de obra
- **GIVEN** el mapa vacío con el solar de prueba (`build-sites`) en `free`, y aparte el mapa vacío sin solar
- **WHEN** se consulta la caminabilidad y el tipo de cada celda de la huella del solar en el tick 0 y después de
  construir la casa
- **THEN** en el tick 0 y tras construir son no caminables y `grass`
- **AND** sin solar, esas celdas son caminables y `grass`

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
solapar celdas no caminables, las de los solares declarados incluidas); si no, la partida no se crea y el error
menciona la oveja. Las ovejas declaradas reaparecen con "Reaparición de ovejas" (`sheep`). Tampoco tiene **solares**
salvo los que declare (la celda de referencia de cada uno, de la que se derivan su huella de casa y su huella de torre
con las reglas del design, en el orden de la lista de solares), sin reglas de colocación ni de ruta: la huella del solar
MUST caber en la rejilla y MUST NOT solapar el círculo del jugador en su posición inicial; si no, la partida no se crea
y el error menciona el solar. Un solar declarado no tiene acceso. El mapa vacío no tiene estructuras, vetas, montones,
ovejas ni solares.

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

<!-- Escenarios vivos sin cambios: todos los de este requisito salvo los dos de solares, que se sustituyen por los de
     abajo. -->

#### Scenario: Mapa explícito con solares declarados
- **GIVEN** el contenido por defecto y el mapa vacío con dos solares declarados s1 y s2, en ese orden, con sus huellas
  dentro de la rejilla y lejos de la salida
- **WHEN** se crea la partida
- **THEN** la lista de solares del tick 0 tiene exactamente s1 y s2, en ese orden, en `free` y armados, sin acceso
- **AND** las 2.304 celdas siguen siendo `grass`; las 8 de las dos huellas son no caminables y las 2.296 restantes
  caminables

#### Scenario: Solar declarado fuera de la rejilla
- **GIVEN** el contenido por defecto y el mapa vacío con un solar declarado cuya huella sale por la columna 64, y en otro
  caso uno cuya huella sale por la fila 36
- **WHEN** se intenta crear la partida
- **THEN** no se crea y el error menciona el solar

#### Scenario: Solar declarado sobre la posición inicial
- **GIVEN** el contenido por defecto y el mapa vacío (salida (1.920, 1.080)) con un solar declarado de huella en las
  columnas 31–32 y filas 17–18
- **WHEN** se intenta crear la partida
- **THEN** no se crea y el error menciona el solar

### Requirement: Campo de distancias hacia una celda
El sistema SHALL ofrecer en el núcleo, para el mapa de una partida y una celda objetivo T, el **campo de distancias**:
para cada celda, el menor número de pasos entre celdas caminables vecinas por un lado (arriba, abajo, izquierda o
derecha; sin diagonales) necesarios para ir de ella a T. T tiene distancia 0. Una celda no caminable (las de obra
incluidas, también las de los solares libres), o caminable pero sin camino 4-vecino hasta T, no tiene distancia; si T no
es caminable, ninguna celda la tiene. El campo:
- MUST depender solo del mapa, de las celdas de obra y de T: el mismo mapa, las mismas celdas de obra y la misma T dan
  el mismo campo celda a celda, sea cual sea el momento, la historia de la partida, la posición del jugador dentro de T
  o la ventana;
- MUST NOT consumir azar ni modificar el mapa (es una consulta de solo lectura, ver "Mapa de la partida de solo
  lectura");
- MUST tener en cuenta las huellas de los solares libres desde el tick 0 y recalcularse cuando una construcción cambia
  la caminabilidad de alguna celda, y solo entonces cambia por el mapa; también los campos hacia los puntos fijos de los
  guardias (ver "Navegación hacia un punto fijo" en `enemy-behavior`).

<!-- Escenarios vivos sin cambios: todos salvo "Campo con un edificio", que se sustituye por "Campo con un solar".
     "Toda celda caminable con distancia en el mapa generado" se lee con las huellas de los solares libres como no
     caminables (sin distancia). -->

#### Scenario: Campo con un solar
- **GIVEN** el mapa vacío de 64 × 36 y una celda objetivo T fuera de las columnas 20–21 y filas 10–11, y aparte el mismo
  mapa con el solar de prueba
- **WHEN** se calcula el campo hacia T sin solar, con el solar de prueba en `free` en el tick 0 y tras construir la casa
- **THEN** sin solar todas las celdas tienen distancia |c − cT| + |r − rT|
- **AND** con el solar libre ninguna celda de la huella tiene distancia y ≥ 1 celda al otro lado de la huella respecto a
  T tiene una distancia mayor que sin solar
- **AND** tras construir la casa el campo es igual celda a celda al del solar libre

#### Scenario: Toda celda caminable con distancia con los solares libres
- **GIVEN** el contenido por defecto y, para cada semilla de 1 a 50, su mapa generado con sus 6 solares en `free` y como
  objetivo la celda de su salida, (32, 19)
- **WHEN** se calcula el campo en el tick 0
- **THEN** todas las celdas caminables tienen distancia y ninguna celda `trunk`, `water`, `castle` ni de la huella de un
  solar la tiene

### Requirement: Solares en el mapa generado
El sistema SHALL colocar, en cada mapa generado, solares hasta el número por mapa del contenido (6 con el contenido por
defecto), en un **orden fijo** (el de la lista de solares de la partida, ver `build-sites`), después de las
estructuras, los recursos y las ovejas, con las mismas reglas y el mismo resultado que antes de este change:
- toda celda de la huella del solar (la unión de sus huellas de casa y de torre, con las dimensiones que fija el design)
  es `grass`, y la **celda de ruta** del solar (una celda fija respecto a la huella y fuera de ella, la misma que la
  celda del antiguo acceso, que fija el design) es `grass`;
- la distancia en celdas (medida igual que en "Estructuras en el mapa generado" de `goblin-structures`) de la huella
  del solar y de su celda de ruta a las celdas de la zona de inicio, a la huella del castillo y a las celdas `water`
  y `bridge` es ≥ el parámetro respectivo de colocación de solares;
- la huella del solar y su celda de ruta no contienen ninguna celda de la huella ni de la puerta de una estructura,
  ni la celda de una veta, de un montón de madera o de la posición inicial de una oveja, y su distancia en celdas a la
  huella de cada estructura es ≥ el parámetro respectivo;
- la distancia en celdas entre las huellas de dos solares es ≥ la separación mínima entre solares;
- la **distancia de ruta** del solar, que es la distancia de su celda de ruta en el campo de distancias hacia la celda
  del punto de salida (ver "Campo de distancias hacia una celda"), calculado sin celdas de obra, está en el rango de
  ruta del contenido, ambos extremos incluidos: **18 a 35 celdas** con el contenido por defecto.

La celda de ruta solo sirve para colocar: no dispara la oferta ni figura en el snapshot. Si con un contenido dado no
caben todos, el sistema coloca los que quepan, sin error y sin incumplir ninguna regla. Con el contenido por defecto
MUST colocarse exactamente 6 solares con toda semilla de 1 a 50. Colocar solares MUST NOT cambiar el tipo de ninguna
celda.

#### Scenario: Reglas de colocación con las semillas del conjunto
- **GIVEN** el contenido por defecto
- **WHEN** se genera el mapa de cada semilla de 1 a 50 y se colocan sus estructuras, recursos, ovejas y solares
- **THEN** cada mapa tiene exactamente 6 solares
- **AND** cada huella de solar y cada celda de ruta es `grass`, no contiene huellas ni puertas de estructuras ni
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
- **WHEN** se leen las celdas de cada huella y de cada celda de ruta
- **THEN** todas son `grass` y el mapa es igual celda a celda al generado sin solares

### Requirement: Colocación de solares determinista con azar propio
El sistema SHALL colocar los solares a partir de la semilla con un **séptimo flujo de azar propio** derivado de ella
(`SITE_STREAM` 7), distinto del de las celdas del mapa, la decoración, las estructuras, los recursos, las ovejas, la
piedra y la partida. La misma semilla y el mismo contenido MUST dar los mismos solares (huellas y orden) en dos
generaciones y en dos partidas, sea cual sea lo que ocurra después en la partida. Colocar solares MUST NOT cambiar
ninguna celda, estructura, recurso u oveja ni la secuencia de valores que recibe ningún otro flujo. Las firmas
`MAP_GOLDEN`, `STRUCTURE_GOLDEN`, `RESOURCE_GOLDEN`, `SHEEP_GOLDEN` y `SITE_GOLDEN` MUST NOT cambiar en este change.
`STONE_GOLDEN` (ver "Azar de la piedra" en `simulation-loop`) es la única firma que se regenera en este change, porque
las huellas bloqueantes cambian qué bajas ocurren y en qué orden; MUST corresponder al contenido por defecto final.

#### Scenario: Misma semilla, mismos solares
- **GIVEN** el contenido por defecto y la semilla 42
- **WHEN** se crean dos partidas y en una se ejecutan 3.600 ticks con un input aleatorio
- **THEN** sus listas de solares del tick 0 son iguales: mismo orden y huellas

#### Scenario: Semillas distintas, solares distintos
- **GIVEN** el contenido por defecto
- **WHEN** se colocan los solares de las semillas 1 a 50
- **THEN** no hay dos semillas con la misma lista de huellas de solares

#### Scenario: Los solares no cambian nada más
- **GIVEN** el contenido por defecto y, en otra configuración, el mismo contenido con 0 solares por mapa
- **WHEN** se genera el mapa y se colocan las estructuras, los recursos y las ovejas de cada semilla de 1 a 50 con
  ambas configuraciones
- **THEN** cada semilla da las mismas celdas, estructuras, recursos y ovejas con las dos
- **AND** las firmas `MAP_GOLDEN`, `STRUCTURE_GOLDEN`, `RESOURCE_GOLDEN` y `SHEEP_GOLDEN` son las de antes del change

#### Scenario: Firma de referencia de los solares
- **GIVEN** el contenido por defecto y la firma `SITE_GOLDEN` versionada en los tests antes de este change
- **WHEN** se colocan los solares de las semillas de la firma (42 y 123 incluidas) y se calcula su firma
- **THEN** coincide con la versionada, sin regenerarla

#### Scenario: Firma de la piedra regenerada
- **GIVEN** el contenido por defecto final y `STONE_GOLDEN` regenerada en este change
- **WHEN** se ejecuta la partida de la firma y se calcula
- **THEN** coincide con la versionada, con ≥ 1 piedra soltada

#### Scenario: Colocar solares no consume el azar de la partida
- **GIVEN** dos partidas con la semilla 7, una con el contenido por defecto y otra con 0 solares por mapa
- **WHEN** se compara el estado del `RandomGenerator` de la partida, el del azar de las ovejas y el de la piedra al
  crearlas
- **THEN** son los mismos en las dos

### Requirement: Conectividad con los edificios construidos
El sistema SHALL mantener "Conectividad" con las celdas de obra: con el contenido por defecto y cada semilla de 1 a 50,
con los 6 solares en `free` (tick 0), con los 6 construidos como casa y con los 6 construidos como torre, toda celda
caminable MUST ser alcanzable desde el punto de salida, con la definición de alcanzable de "Conectividad"; en
particular, toda celda caminable vecina por un lado de la huella de cada solar y la puerta de la tienda. Ningún solar
MUST encerrar la salida.

#### Scenario: Sin zonas aisladas con los solares
- **GIVEN** el contenido por defecto, radio del jugador 16 y el mapa de cada semilla de 1 a 50 con sus 6 solares en
  `free` y, aparte, construidos como casa y como torre
- **WHEN** se evalúa la conectividad desde (1.950, 1.170)
- **THEN** en cada mapa el 100 % de las celdas caminables es alcanzable (0 zonas aisladas)
- **AND** cada solar tiene ≥ 1 celda caminable vecina por un lado de su huella alcanzable desde la salida
