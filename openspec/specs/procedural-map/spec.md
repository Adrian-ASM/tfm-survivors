# Procedural map · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
Mapa de rejilla generado por semilla (hierba, troncos, agua, puentes y castillo), puro y determinista, con su propio
flujo de azar, zona de inicio libre y conectividad garantizada. Es la base de la colisión del jugador y del
futuro campo de flujo.

## Requirements

### Requirement: Contenido del mapa validado
El sistema SHALL leer los parámetros del mapa de `content/*.json`, validados con zod antes de llegar al dominio:
- `cellSize`: entero ≥ 2 × el radio del jugador (32 con el contenido por defecto), para que el jugador quepa por un
  pasillo o un puente de 1 celda;
- `startRadius`: número > 0 y ≤ la mitad del lado menor del mundo;
- `trunkDensity`: número en [0, 0,3], fracción objetivo de celdas de tronco;
- `trunkPatch`: `{ min, max }`, enteros con 1 ≤ `min` ≤ `max` ≤ 16, tamaño en celdas de cada mancha de troncos;
- `rivers`: entero en [0, 2];
- `bridges`: `{ min, max }`, enteros con 1 ≤ `min` ≤ `max` ≤ 6, puentes por río;
- `castle`: `{ cols, rows }`, enteros con 1 ≤ `cols` ≤ ⌊columnas / 2⌋ y 1 ≤ `rows` ≤ ⌊filas / 2⌋ de la rejilla
  (32 y 18 con el mundo por defecto), huella del castillo (ver "Castillo en el mapa generado"). La huella y la celda
  de la puerta MUST caber en la rejilla; si no, la carga falla con un error que nombra `castle`.

El design puede añadir campos de ajuste de la generación; cada uno MUST validarse con las mismas reglas de campo
ausente, desconocido o fuera de rango. Un contenido inválido MUST impedir que se muestre el menú o empiece una
partida, con un error que nombre el campo. El contenido por defecto MUST fijar `cellSize` 60, `startRadius` 180,
`trunkDensity` 0,12, `trunkPatch` 3..8, `rivers` 1, `bridges` 2..3 y `castle` 5 × 4.

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** el dominio recibe `cellSize` 60, `startRadius` 180, `trunkDensity` 0,12, `trunkPatch` { 3, 8 },
  `rivers` 1, `bridges` { 2, 3 } y `castle` { cols 5, rows 4 }

#### Scenario: Celda en el límite del radio del jugador
- **GIVEN** el contenido por defecto (radio del jugador 16) con `cellSize` 32, y en otro caso con `cellSize` 31
- **WHEN** se carga el contenido
- **THEN** con 32 la carga tiene éxito y con 31 falla con un error que menciona `cellSize`

#### Scenario: Valores fuera de rango
- **GIVEN** el contenido por defecto con, en un caso cada vez: `cellSize` 0, `cellSize` 60,5, `startRadius` 0,
  `startRadius` 1.081 (mundo de 3.840 × 2.160), `trunkDensity` −0,01, `trunkDensity` 0,31, `trunkPatch` { 4, 3 },
  `trunkPatch` { 0, 3 }, `rivers` 3, `rivers` 1,5, `bridges` { 0, 2 }, `bridges` { 3, 2 }, `castle` { 0, 4 },
  `castle` { 5, 0 }, `castle` { 5,5; 4 }, `castle` { 33, 4 } o `castle` { 5, 19 }
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo
- **AND** no se muestra el menú ni se crea ninguna partida

#### Scenario: Límites válidos
- **GIVEN** el contenido por defecto con, en un caso cada vez: `startRadius` 1.080, `trunkDensity` 0, `trunkDensity`
  0,3, `rivers` 0, `rivers` 2, `trunkPatch` { 1, 1 }, `castle` { 1, 1 } o `castle` { 32, 18 }
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Campo ausente o desconocido
- **GIVEN** el contenido del mapa sin `trunkDensity`, en otro caso sin `castle`, y en otro con un campo extra
  `lakes: 2`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `trunkDensity`, `castle` y `lakes` respectivamente

### Requirement: Rejilla de celdas tipadas
El sistema SHALL representar el mapa de cada partida como una rejilla de ⌈ancho / `cellSize`⌉ columnas por
⌈alto / `cellSize`⌉ filas que cubre el mundo entero; las celdas de la última columna y la última fila se recortan al
borde del mundo si el tamaño no es múltiplo de `cellSize`. Cada celda tiene exactamente un tipo: `grass` (hierba),
`trunk` (tronco), `water` (agua), `bridge` (puente) o `castle` (castillo). Son caminables `grass` y `bridge`; no
caminables `trunk`, `water` y `castle`. El núcleo MUST ofrecer, sin consumir azar ni depender del jugador:
- el tipo de una celda (c, r) y si es caminable; una celda fuera de la rejilla MUST considerarse no caminable;
- la celda que contiene un punto (x, y) del mundo: (⌊x / `cellSize`⌋, ⌊y / `cellSize`⌋), con x = ancho y y = alto
  asignados a la última columna y la última fila;
- el punto de salida del mapa (ver "Castillo en el mapa generado" y "Mapa explícito y mapa vacío");
- el campo de distancias hacia una celda (ver "Campo de distancias hacia una celda").

Todo lo que dependa de "no caminable" (colisión del jugador, recolocación de gemas y de apariciones, línea libre y
navegación de los enemigos, campo de distancias, conectividad, bot de referencia) MUST tratar una celda `castle` igual
que una `trunk` o una `water`.

#### Scenario: Rejilla por defecto
- **GIVEN** el contenido por defecto
- **WHEN** se crea una partida
- **THEN** su mapa tiene 64 columnas, 36 filas y 2.304 celdas, todas de 60 × 60 px

#### Scenario: Mundo no múltiplo de la celda
- **GIVEN** el contenido por defecto salvo una arena explícita de 4.000 × 4.000
- **WHEN** se crea una partida
- **THEN** su mapa tiene 67 × 67 celdas y las de la columna 66 ocupan x en [3.960, 4.000] (40 px de ancho)

#### Scenario: Celda de un punto
- **GIVEN** el contenido por defecto
- **WHEN** se pide la celda de (1.919,9; 1.079,9), de (1.920, 1.080), de (0, 0) y de (3.840, 2.160)
- **THEN** son (31, 17), (32, 18), (0, 0) y (63, 35) respectivamente

#### Scenario: Caminabilidad por tipo y fuera de la rejilla
- **GIVEN** un mapa explícito de 64 × 36 con la celda (3, 3) `trunk`, la (4, 3) `water`, la (5, 3) `bridge`, la
  (6, 3) `castle` y el resto `grass`
- **WHEN** se consulta la caminabilidad de (3, 3), (4, 3), (5, 3), (6, 3), (7, 3), (−1, 0), (64, 0) y (0, 36)
- **THEN** son no caminable, no caminable, caminable, no caminable, caminable, no caminable, no caminable y no
  caminable

### Requirement: Generación determinista por semilla
El sistema SHALL generar el mapa de cada partida a partir de su semilla y del contenido, sin reloj ni APIs del
navegador: la misma semilla y el mismo contenido MUST dar el mismo mapa celda a celda, en dos generaciones y en dos
partidas. Toda semilla de 0 a 4.294.967.295 MUST dar un mapa que cumpla "Composición del mapa", "Zona de inicio" y
"Conectividad". La generación de un mapa con el contenido por defecto MUST tardar < 20 ms de media, medido con
`npm run bench` (informativo: no bloquea `verify` ni CI). La firma de referencia de los mapas generados que versionan
los tests MUST corresponder al contenido por defecto vigente: cambiar el mundo o los parámetros del mapa exige
regenerarla en el mismo change.

#### Scenario: Misma semilla, mismo mapa
- **GIVEN** el contenido por defecto y la semilla 42
- **WHEN** se crean dos partidas y se compara su mapa
- **THEN** las 2.304 celdas tienen el mismo tipo en ambas

#### Scenario: Mapa distinto en cada semilla del conjunto
- **GIVEN** el contenido por defecto
- **WHEN** se genera el mapa de cada semilla de 1 a 50
- **THEN** los 50 mapas son distintos dos a dos (cada par difiere en el tipo de ≥ 1 celda)

#### Scenario: Semillas extremas
- **GIVEN** el contenido por defecto
- **WHEN** se generan los mapas de las semillas 0 y 4.294.967.295
- **THEN** ambos se generan sin error y cumplen composición, zona de inicio y conectividad

#### Scenario: Reinicio con otra semilla
- **GIVEN** una partida terminada con la semilla 42 y una partida nueva tras R con la semilla 123
- **WHEN** se compara el mapa de la partida nueva con el que genera el núcleo para la semilla 123
- **THEN** son iguales celda a celda

#### Scenario: Firma de referencia del mundo nuevo
- **GIVEN** el contenido por defecto y la firma de referencia versionada en los tests
- **WHEN** se generan los mapas de las semillas de la firma y se calcula su firma
- **THEN** coincide con la versionada y corresponde a rejillas de 64 × 36

### Requirement: Azar del mapa independiente del de la partida
El sistema SHALL generar el mapa con un flujo de azar propio derivado de la semilla, distinto del que consumen
oleadas y ofertas, colocar las estructuras con otro flujo propio (ver "Colocación determinista con azar propio" en
`goblin-structures`) y colocar las vetas y los montones con otro (ver "Colocación de recursos determinista con azar
propio"): generar el mapa, colocar las estructuras o colocar los recursos MUST NOT cambiar la secuencia de valores que
recibe el resto de la partida. Con la misma semilla y el mismo punto de salida, una partida con el mapa generado y otra
con un mapa todo `grass` consumen el azar de la partida igual mientras sigan el mismo curso: recolocar una aparición,
calcular el campo de distancias, navegar por él, hacer nacer, patrullar, alertar o volver a un guardia, o crear, atraer
o recoger recogibles y agotar vetas no consume azar (cada intento de aparición gasta 1 valor en ambos mapas; ver
`enemy-spawning`). Para comparar con el mapa generado se usa el **mapa vacío con salida** (1.950, 1.170): todo `grass`,
con ese punto de salida declarado y sin estructuras ni recursos (ver "Mapa explícito y mapa vacío").

Como los enemigos navegan por el mapa (ver `enemy-behavior`) y solo el mapa generado tiene casas que hacen nacer
guardias, las dos partidas pueden divergir en contactos, bajas, gemas, ofertas y, por tanto, en el azar consumido
después; la igualdad solo se exige mientras no haya divergido nada que consuma azar. Los guardias toman identificadores
de la misma secuencia que las apariciones del director, así que la comparación de apariciones del director no exige
el mismo identificador.

#### Scenario: Mismos spawns con y sin mapa
- **GIVEN** dos partidas con el contenido por defecto, la semilla 7, input (0, 0) y la política de elección fija, una
  con el mapa generado y otra con el mapa vacío con salida (1.950, 1.170)
- **WHEN** ambas ejecutan ticks hasta que una de las dos abre su primera oferta de mejoras o termina, o hasta el tick
  1.200, lo que ocurra antes
- **THEN** las apariciones del director (sin contar los `goblin-tnt-guard` nacidos en casas) son las mismas en ambas,
  en el mismo orden: mismo tipo y mismo tick de aparición
- **AND** la posición de aparición es la misma en las dos, salvo en las apariciones del mapa generado cuyo punto cae en
  una celda no caminable, que están en la recolocación de la posición del mapa vacío (ver "Posición de aparición fuera
  de la vista" en `enemy-spawning`)
- **AND** en la partida con el mapa vacío no nace ningún `goblin-tnt-guard`

#### Scenario: Primera oferta en plazo con y sin mapa
<!-- Reformulado en apply de 0017 (decisión del usuario): con el mundo nuevo el jugador quieto ya no abre la primera
     oferta en el mismo tick con ambos mapas (semilla 7: tick 1.527 con el generado, 1.846 con el vacío con salida),
     porque el mapa cambia qué gemas alcanza. Se exige el plazo de primera subida, no la igualdad de tick ni de
     opciones. En 0019 los ticks medidos se vuelven a anotar en apply; en 0021, también (casas y guardias). En 0022
     los recursos no cambian el tick: se anota igualmente. -->
- **GIVEN** las dos partidas del escenario anterior (semilla 7, input (0, 0), política de elección fija; una con el
  mapa generado y otra con el mapa vacío con salida (1.950, 1.170))
- **WHEN** cada una se ejecuta hasta abrir su primera oferta de mejoras o hasta el tick 4.800
- **THEN** ambas abren su primera oferta en un tick ≤ 4.800 (plazo de primera subida)
- **AND** no se exige que lo hagan en el mismo tick ni con las mismas opciones

### Requirement: Composición del mapa
El sistema SHALL generar, con el contenido por defecto y con cada semilla de 1 a 50, un mapa que cumpla:
- **Río**: exactamente `rivers` ríos. Un río es un conjunto 4-conexo de celdas `water` y `bridge` que toca dos bordes
  opuestos del mundo (izquierdo y derecho, o superior e inferior) y tiene 1 celda de ancho: ningún bloque de 2 × 2
  celdas es todo del río. Cada río tiene entre `bridges.min` y `bridges.max` celdas `bridge`. Fuera de los ríos no
  hay celdas `water` ni `bridge`. Ninguna celda del río está en la zona de inicio ni en la huella del castillo.
- **Troncos**: la fracción de celdas `trunk` está en [`trunkDensity` − 0,02, `trunkDensity` + 0,02] (con el contenido
  por defecto, de 231 a 322 de 2.304; confirmada en apply: 276 a 283 en las semillas 1..1.000) y cada componente 4-conexa de
  celdas `trunk` tiene entre `trunkPatch.min` y `trunkPatch.max` celdas.
- **Castillo**: exactamente las celdas de la huella son `castle` (ver "Castillo en el mapa generado").
- **Caminable**: al menos el 70 % de las celdas son caminables.

Con `rivers` 0 y `trunkDensity` 0 el mapa MUST ser todo `grass` salvo la huella del castillo.

#### Scenario: Composición con las semillas del conjunto
- **GIVEN** el contenido por defecto
- **WHEN** se genera el mapa de cada semilla de 1 a 50
- **THEN** cada mapa tiene 1 río de 1 celda de ancho que toca dos bordes opuestos, con 2 o 3 puentes, y ninguna de
  sus celdas en la zona de inicio ni en la huella
- **AND** entre 231 y 322 celdas `trunk`, en manchas 4-conexas de 3 a 8 celdas, exactamente 20 celdas `castle` y
  ≥ 1.613 celdas caminables (70 % de 2.304)

#### Scenario: Sin río ni troncos
- **GIVEN** el contenido por defecto con `rivers` 0 y `trunkDensity` 0
- **WHEN** se genera el mapa de la semilla 7
- **THEN** las 20 celdas de columnas 30–34 y filas 15–18 son `castle` y las 2.284 restantes son `grass`

### Requirement: Castillo en el mapa generado
El sistema SHALL colocar en cada mapa generado exactamente un castillo: un rectángulo de `castle.cols` × `castle.rows`
celdas de tipo `castle`, sin consumir azar y con la misma huella para cualquier semilla. Siendo (cc, rc) la celda que
contiene el centro del mundo (ancho / 2, alto / 2), la huella ocupa las columnas cc − ⌊`castle.cols` / 2⌋ a
cc − ⌊`castle.cols` / 2⌋ + `castle.cols` − 1 y las filas rc − `castle.rows` + 1 a rc: el castillo queda centrado en
horizontal sobre la columna del centro y su fila inferior es la del centro. La **puerta** es el centro de la celda
(cc, rc + 1), justo debajo de la fila inferior de la huella, y es el **punto de salida** del mapa generado (ver
"Posición inicial en el punto de salida del mapa" en `player-movement`). Fuera de la huella no hay ninguna celda
`castle`. El castillo solo existe en el mapa generado: el mapa vacío no lo tiene y un mapa explícito solo tiene las
celdas `castle` que declare (ver "Mapa explícito y mapa vacío").

Con el contenido por defecto (rejilla de 64 × 36, (cc, rc) = (32, 18), castillo de 5 × 4) la huella es columnas
30–34 y filas 15–18 (x en [1.800, 2.100], y en [900, 1.140]), 20 celdas, y la salida es (1.950, 1.170). Si el apply
cambia la huella por balance, este requisito y sus escenarios MUST actualizarse antes de verify con los valores
definitivos.

#### Scenario: Huella y salida por defecto
- **GIVEN** el contenido por defecto y la semilla 42
- **WHEN** se genera el mapa
- **THEN** las celdas `castle` son exactamente las de columnas 30 a 34 y filas 15 a 18 (20 celdas)
- **AND** el punto de salida del mapa es (1.950, 1.170)

#### Scenario: Misma huella con todas las semillas
- **GIVEN** el contenido por defecto
- **WHEN** se genera el mapa de cada semilla de 1 a 1.000, de la 0 y de la 4.294.967.295
- **THEN** cada mapa tiene exactamente 20 celdas `castle`, las de columnas 30–34 y filas 15–18, y salida
  (1.950, 1.170)

#### Scenario: Huella en un mundo mayor
- **GIVEN** el contenido por defecto salvo una arena explícita de 4.000 × 4.000 (67 × 67 celdas, (cc, rc) = (33, 33))
- **WHEN** se genera el mapa de la semilla 7
- **THEN** las celdas `castle` son las de columnas 31 a 35 y filas 30 a 33, y la salida es (2.010, 2.070)

### Requirement: Zona de inicio
El sistema SHALL reservar la zona de inicio: el disco de centro el punto de salida del mapa y radio `startRadius`.
Toda celda cuyo rectángulo tenga algún punto a distancia < `startRadius` del centro MUST ser `grass` o, si pertenece
a la huella del castillo, `castle`. El jugador aparece en la salida (ver `player-movement`) sin solapar ninguna celda
no caminable. Con el contenido por defecto el centro es (1.950, 1.170); en el mapa vacío y en un mapa explícito sin
salida declarada, el centro del mundo.

#### Scenario: Celdas dentro y fuera de la zona
- **GIVEN** el contenido por defecto (salida (1.950, 1.170), `startRadius` 180)
- **WHEN** se clasifican las celdas (35, 19) (punto más cercano a 150 px), (36, 19) (a 210 px), (32, 22) (a 150 px)
  y (32, 23) (a 210 px)
- **THEN** la (35, 19) y la (32, 22) pertenecen a la zona de inicio y la (36, 19) y la (32, 23) no

#### Scenario: Zona libre con todas las semillas
- **GIVEN** el contenido por defecto
- **WHEN** se genera el mapa de cada semilla de 1 a 1.000, de la 0 y de la 4.294.967.295
- **THEN** en cada uno toda celda de la zona de inicio es `grass` o es una celda de la huella, que es `castle`
- **AND** un círculo de radio 16 centrado en (1.950, 1.170) no solapa ninguna celda no caminable (la más cercana, la
  `castle` (32, 18), está a 30 px)

### Requirement: Conectividad
El sistema SHALL garantizar que toda celda caminable es alcanzable desde el punto de salida del mapa. Una posición es
legal si el círculo del jugador (radio de contenido) cabe en el mundo y no solapa ninguna celda no caminable (ver
"Colisión con el mapa" en `player-movement`). Una celda caminable es alcanzable si contiene en su rectángulo el centro
de alguna posición legal unida al punto de salida por un camino continuo de posiciones legales. Así se cubren las
"zonas clave" del GDD: hoy, toda celda caminable.

#### Scenario: Todas las celdas caminables alcanzables
- **GIVEN** el contenido por defecto y radio del jugador 16
- **WHEN** se genera el mapa de cada semilla de 1 a 50, de 1 a 1.000, de la 0 y de la 4.294.967.295
- **THEN** en cada mapa el 100 % de las celdas caminables es alcanzable desde (1.950, 1.170)

#### Scenario: Celdas tras el castillo alcanzables
- **GIVEN** el contenido por defecto con `rivers` 0 y `trunkDensity` 0 (solo el castillo) y radio del jugador 16
- **WHEN** se evalúa la conectividad desde (1.950, 1.170)
- **THEN** las 2.284 celdas `grass` son alcanzables, entre ellas la (32, 14), justo encima del castillo

#### Scenario: Celda encerrada no es alcanzable
- **GIVEN** un mapa explícito de hierba con troncos en (10, 4), (11, 5), (9, 5) y (10, 6), que encierran la celda
  caminable (10, 5) por sus cuatro lados
- **WHEN** se evalúa la conectividad con radio 16
- **THEN** la celda (10, 5) no es alcanzable y el mapa no cumple "Conectividad"

### Requirement: Mapa de la partida de solo lectura
El sistema SHALL permitir al adaptador leer el mapa de la partida (columnas, filas, `cellSize` y tipo de cada celda)
desde que la partida se crea. El mapa MUST NOT cambiar durante la partida, tampoco al elegir mejora, pausar o
terminar. Modificar desde fuera lo leído MUST NOT cambiar el mapa ni la simulación.

#### Scenario: Mapa constante
- **GIVEN** una partida con el contenido por defecto y la semilla 42
- **WHEN** se lee el mapa en el tick 0, en el tick 3.600 y con la partida terminada
- **THEN** las tres lecturas son iguales celda a celda

#### Scenario: Lectura no mutable
- **GIVEN** una partida en el tick 10 cuya celda (0, 0) es `grass`
- **WHEN** el adaptador cambia a `trunk` la celda (0, 0) del mapa que ha leído y se ejecuta 1 tick
- **THEN** el núcleo sigue considerando caminable la celda (0, 0)

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
reaparecen con "Reaparición de ovejas" (`sheep`). El mapa vacío no tiene estructuras, vetas, montones ni ovejas.

Un mapa dado puede declarar su punto de salida. Si no lo declara, la salida es el centro del mundo (ancho / 2,
alto / 2), sin comprobar si es legal. Si lo declara, la salida MUST ser una posición legal del jugador en ese mapa
(dentro de los límites de la arena y sin solapar celdas no caminables); si no, la partida no se crea y el error
menciona el punto de salida. El mapa vacío no declara salida: con él la partida se comporta como antes del change
0015 en movimiento, gemas, spawns y posición inicial.

Convención para todas las specs: un escenario que coloca elementos en posiciones explícitas y no declara mapa se
entiende con el mapa vacío; un escenario que usa "el contenido por defecto" y una semilla sin posiciones explícitas
juega con el mapa generado para esa semilla (con castillo, salida ante la puerta, casas, torres, guardias, vetas,
montones y ovejas), salvo que diga otra cosa. Un escenario que coloca una oveja de prueba en el mapa vacío la declara
como oveja del mapa.

#### Scenario: Partida con mapa vacío
- **GIVEN** el contenido por defecto, la semilla 7 y el mapa vacío
- **WHEN** se crea la partida
- **THEN** sus 2.304 celdas son `grass`, ninguna es `castle`, la salida es (1.920, 1.080), no hay estructuras, vetas ni
  ovejas y la lista de recogibles está vacía

#### Scenario: Mapa de dimensiones incorrectas
- **GIVEN** el contenido por defecto y un mapa dado de 32 × 18 celdas (la rejilla anterior a este change)
- **WHEN** se intenta crear la partida
- **THEN** no se crea y el error menciona las dimensiones del mapa

#### Scenario: Mapa explícito con salida declarada
- **GIVEN** el contenido por defecto, la semilla 7 y el mapa vacío con salida (1.950, 1.170)
- **WHEN** se crea la partida
- **THEN** sus 2.304 celdas son `grass` y la salida es (1.950, 1.170)

#### Scenario: Salida declarada ilegal
- **GIVEN** el contenido por defecto y un mapa de hierba con un tronco en (10, 4) (x en [600, 660], y en [240, 300])
  que declara, en un caso cada vez, la salida (630, 270) (dentro del tronco), (590, 270) (a 10 px del tronco) o
  (10, 540) (a menos del radio del borde izquierdo)
- **WHEN** se intenta crear la partida
- **THEN** no se crea y el error menciona el punto de salida
- **AND** con la salida (584, 270), tangente al tronco, la partida se crea

#### Scenario: Mapa explícito con celdas de castillo
- **GIVEN** el contenido por defecto y un mapa de hierba con la celda (3, 3) `castle`, sin salida declarada
- **WHEN** se crea la partida
- **THEN** la (3, 3) es la única celda `castle` y la salida es (1.920, 1.080)

#### Scenario: Mapa explícito con estructuras declaradas
- **GIVEN** el contenido por defecto y el mapa vacío con una casa declarada en columnas 20–21 y filas 10–12 y una
  torre declarada en columnas 40–41 y filas 5–6
- **WHEN** se crea la partida
- **THEN** la lista de estructuras tiene exactamente esas 2, en ese orden, y las 2.304 celdas siguen siendo `grass`

#### Scenario: Estructura declarada fuera de la rejilla
- **GIVEN** el contenido por defecto y el mapa vacío con una casa declarada en columnas 63–64 y filas 10–12, y en
  otro caso en columnas 20–21 y filas 33–35 (su puerta caería en la fila 36)
- **WHEN** se intenta crear la partida
- **THEN** no se crea y el error menciona la estructura

#### Scenario: Mapa explícito con vetas y montones declarados
- **GIVEN** el contenido por defecto y el mapa vacío con una veta declarada en (1.000, 1.000) y dos montones en
  (600, 600) y (700, 600), en ese orden
- **WHEN** se crea la partida
- **THEN** la lista de vetas tiene exactamente esa veta, activa, con el oro por veta del contenido, y la de recogibles
  del tick 0 tiene exactamente 2 `wood`, en esas posiciones y en ese orden, con la madera por montón del contenido

#### Scenario: Recurso declarado fuera del mundo
- **GIVEN** el contenido por defecto y el mapa vacío con una veta declarada en (4.000, 1.000), y en otro caso un montón
  en (100, −5)
- **WHEN** se intenta crear la partida
- **THEN** no se crea y el error menciona la veta o el montón respectivamente

#### Scenario: Mapa explícito con ovejas declaradas
- **GIVEN** el contenido por defecto y el mapa vacío con ovejas declaradas en (1.000, 1.000) y (1.500, 600), en ese
  orden, y en otro caso 7 ovejas declaradas (más que el tope por defecto)
- **WHEN** se crea la partida
- **THEN** la lista de ovejas del tick 0 tiene exactamente las declaradas, en ese orden, cada una con la vida del
  contenido, en estado `graze` y con su punto de origen en su posición, y las 2.304 celdas siguen siendo `grass`

#### Scenario: Oveja declarada ilegal
- **GIVEN** el contenido por defecto, un radio de oveja 20 y un mapa de hierba con un tronco en (10, 4) que declara, en
  un caso cada vez, una oveja en (630, 270) (dentro del tronco), (590, 270) (a 10 px del tronco) o (10, 540) (a menos de
  su radio del borde izquierdo)
- **WHEN** se intenta crear la partida
- **THEN** no se crea y el error menciona la oveja
- **AND** con la oveja en (580, 270), tangente al tronco, la partida se crea

### Requirement: Mapa vacío en modo E2E
El sistema SHALL resolver, una sola vez por carga y junto con la semilla, la velocidad y el modo manual, si se fuerza
el mapa vacío, a partir de la URL:
- Sin `?e2e`, el parámetro `map` se ignora por completo, sin avisos, tenga el valor que tenga.
- Con `?e2e` y sin `map`, cada partida usa el mapa generado por su semilla, sin avisos.
- Con `?e2e&map=empty`, cada partida usa el mapa vacío, sin avisos.
- Con `?e2e` y `map` con cualquier otro valor (`map`, `map=`, `map=real`, `map=1`…), se ignora, cada partida usa el
  mapa generado y se emite exactamente 1 aviso por consola que menciona `map` en toda la carga.

Lo resuelto vale para todas las partidas de la carga (la primera, tras R y tras `Volver al menú` + `Jugar`) sin
volver a leer la URL. La resolución corresponde a la composición y su efecto al adaptador: el núcleo MUST NOT conocer
el parámetro ni la URL. Los E2E existentes antes de este change que asumen posiciones libres (todos los del proyecto
`logic` y los de `realtime` que recorren posiciones fijas, como las cuatro esquinas) MUST cargar con `map=empty`; los
E2E nuevos del mapa MUST usar el mapa real.

#### Scenario: Mapa vacío forzado
- **GIVEN** la URL `?e2e&map=empty&seed=42`
- **WHEN** arranca la partida al cargar
- **THEN** la sonda informa de mapa vacío forzado y de 2.304 celdas `grass`, sin avisos que mencionen `map`

#### Scenario: Mapa real por defecto en E2E
- **GIVEN** la URL `?e2e&seed=42`
- **WHEN** arranca la partida al cargar
- **THEN** la sonda informa de mapa no forzado y su mapa es igual celda a celda al que genera el núcleo para la
  semilla 42, sin avisos que mencionen `map`

#### Scenario: Valor inválido
- **GIVEN** la URL `?e2e&map&seed=42`, y en otras cargas `?e2e&map=&seed=42` y `?e2e&map=real&seed=42`
- **WHEN** arranca la partida al cargar
- **THEN** la partida usa el mapa generado para la semilla 42 y se emite exactamente 1 aviso que menciona `map`

#### Scenario: Ignorado fuera de E2E
- **GIVEN** la URL `?map=empty&seed=42`
- **WHEN** se pulsa `Jugar`
- **THEN** la partida usa el mapa generado para la semilla 42, `window.__sprint` no existe y no hay avisos que
  mencionen `map`

#### Scenario: Se mantiene en todas las partidas de la carga
- **GIVEN** la URL `?e2e&map=empty&manual`
- **WHEN** se termina la primera partida y se pulsa R, y después se pulsa Esc, `Volver al menú` y `Jugar`
- **THEN** las tres partidas usan el mapa vacío y no se emite ningún aviso que mencione `map`

### Requirement: Sonda del mapa para E2E
El sistema SHALL exponer, solo con `?e2e` y como parte de la sonda `window.__sprint`, el mapa de la partida en curso:
columnas, filas, `cellSize`, la lista completa de tipos de celda en orden de filas (fila 0 de izquierda a derecha,
luego la fila 1…), el recuento de celdas por tipo (incluido `castle`), la zona de inicio (centro y radio), el punto de
salida, la huella del castillo (primera y última columna y fila; `null` con el mapa vacío o explícito), si el mapa
vacío está forzado, la lista de estructuras de la partida (tipo, huella y, si es una casa, puerta), en el orden del
snapshot, y las posiciones de las vetas y de los montones iniciales, en el orden de colocación. En modo menú el mapa de
la sonda MUST valer `null`. Sin `?e2e` MUST NOT existir. Leer la sonda MUST NOT cambiar la simulación ni lo que se
pinta.

#### Scenario: Sonda coherente con el núcleo
- **GIVEN** la URL `?e2e&manual&seed=42`
- **WHEN** arranca la partida al cargar y se lee la sonda del mapa
- **THEN** informa de 64 columnas, 36 filas, `cellSize` 60, 2.304 tipos iguales uno a uno a los del mapa que genera el
  núcleo para la semilla 42, recuentos por tipo que suman 2.304 y coinciden con la lista, y zona de inicio de centro
  (1.950, 1.170) y radio 180
- **AND** su lista de estructuras es igual, una a una, a la que coloca el núcleo para la semilla 42
- **AND** sus posiciones de vetas y de montones son iguales, una a una, a las que coloca el núcleo para la semilla 42

#### Scenario: Sonda con castillo y salida [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` (mapa real)
- **WHEN** arranca la partida, se pinta 1 frame y se leen la sonda del mapa y el snapshot
- **THEN** la sonda informa de 20 celdas `castle`, huella de columnas 30–34 y filas 15–18 y salida (1.950, 1.170)
- **AND** el jugador del snapshot está en (1.950, 1.170)

#### Scenario: Sonda con el mapa vacío
- **GIVEN** la URL `?e2e&map=empty&seed=42`
- **WHEN** arranca la partida al cargar y se lee la sonda del mapa
- **THEN** informa de 2.304 celdas `grass`, 0 `castle`, huella `null`, salida (1.920, 1.080), zona de inicio de
  centro (1.920, 1.080) y listas de estructuras, vetas y montones vacías

#### Scenario: Sonda en el menú
- **GIVEN** `?e2e&seed=42` y el menú tras `Volver al menú`
- **WHEN** se pinta 1 frame y se lee la sonda
- **THEN** el mapa de la sonda vale `null`
- **AND** tras pulsar `Jugar` vuelve a informar del mapa de la partida nueva

#### Scenario: Sin sonda fuera de E2E
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga y se pulsa `Jugar`
- **THEN** `window.__sprint` es `undefined`

### Requirement: Campo de distancias hacia una celda
El sistema SHALL ofrecer en el núcleo, para el mapa de una partida y una celda objetivo T, el **campo de distancias**:
para cada celda, el menor número de pasos entre celdas caminables vecinas por un lado (arriba, abajo, izquierda o
derecha; sin diagonales) necesarios para ir de ella a T. T tiene distancia 0. Una celda no caminable, o caminable pero
sin camino 4-vecino hasta T, no tiene distancia; si T no es caminable, ninguna celda la tiene. El campo:
- MUST depender solo del mapa y de T: el mismo mapa y la misma T dan el mismo campo celda a celda, sea cual sea el
  momento, la historia de la partida, la posición del jugador dentro de T o la ventana;
- MUST NOT consumir azar ni modificar el mapa (es una consulta de solo lectura, ver "Mapa de la partida de solo
  lectura");
- MUST NOT recalcularse por cambios del mapa durante la partida, porque el mapa no cambia.

#### Scenario: Mapa vacío
- **GIVEN** el mapa vacío de 64 × 36 y la celda objetivo (32, 18)
- **WHEN** se calcula el campo
- **THEN** cada celda (c, r) tiene distancia |c − 32| + |r − 18|; la (0, 0) tiene 50 y la (63, 35) tiene 48

#### Scenario: Río con un único puente
- **GIVEN** un mapa de hierba con toda la columna 10 de `water` salvo la celda (10, 20), que es `bridge`, y la celda
  objetivo (15, 4)
- **WHEN** se calcula el campo
- **THEN** la (10, 20) tiene distancia 21, la (9, 20) 22 y la (5, 4) 42
- **AND** ninguna celda `water` tiene distancia

#### Scenario: Celda encerrada
- **GIVEN** un mapa de hierba con troncos en (10, 4), (9, 5), (11, 5) y (10, 6) y la celda objetivo (20, 5)
- **WHEN** se calcula el campo
- **THEN** la celda caminable (10, 5) no tiene distancia y los cuatro troncos tampoco

#### Scenario: Objetivo no caminable
- **GIVEN** un mapa de hierba con un tronco en (10, 4) y la celda objetivo (10, 4)
- **WHEN** se calcula el campo
- **THEN** ninguna celda tiene distancia

#### Scenario: Toda celda caminable con distancia en el mapa generado
- **GIVEN** el contenido por defecto y, para cada semilla de 1 a 50, su mapa generado y como objetivo la celda de su
  salida, (32, 19)
- **WHEN** se calcula el campo
- **THEN** todas las celdas caminables tienen distancia y ninguna celda `trunk`, `water` o `castle` la tiene

#### Scenario: Mismo campo, misma celda
- **GIVEN** una partida con el contenido por defecto y la semilla 42
- **WHEN** se calcula el campo hacia la celda (40, 10) en el tick 0, después de 3.600 ticks y en otra partida nueva con
  la misma semilla
- **THEN** los tres campos son iguales celda a celda y el estado del `RandomGenerator` de la partida no ha cambiado
  por calcularlos

### Requirement: Recursos en el mapa generado
El sistema SHALL colocar, en cada mapa generado, vetas de oro y montones de madera hasta el número por mapa de cada uno
del contenido (ver "Contenido de recursos validado" en `resources`), en un **orden fijo** (el de la lista de vetas y el
de los montones iniciales de la partida), con estas reglas:
- cada veta y cada montón ocupa una celda, y su posición es el centro de esa celda;
- la celda es `grass`, no pertenece a la huella de ninguna estructura ni es la puerta de una casa (ver "Estructuras en
  el mapa generado" en `goblin-structures`);
- la distancia en celdas de la celda a las celdas de la zona de inicio y a la huella del castillo es ≥ el parámetro
  respectivo de colocación de recursos, medida igual que en la colocación de estructuras;
- dos recursos (vetas o montones) no comparten celda y la distancia en celdas entre ellos es ≥ la separación mínima de
  recursos;
- con el contenido por defecto, el centro de cada veta y de cada montón está a > 308 px del punto de salida
  (`startRadius` 180 + `pickupRadius` 128): un jugador quieto en la salida nunca atrae un montón ni toca una veta.

Si con un contenido dado no caben todos, el sistema coloca los que quepan, sin error y sin incumplir ninguna regla. Con
el contenido por defecto MUST colocarse exactamente el número de vetas y de montones con toda semilla de 1 a 1.000, la
0 y la 4.294.967.295. Las vetas y los montones no bloquean a nadie ni cambian el tipo de ninguna celda.

#### Scenario: Reglas de colocación con las semillas del conjunto
- **GIVEN** el contenido por defecto
- **WHEN** se genera el mapa de cada semilla de 1 a 1.000, de la 0 y de la 4.294.967.295 y se colocan sus recursos
- **THEN** cada mapa tiene exactamente el número de vetas y de montones del contenido
- **AND** cada uno está en el centro de una celda `grass` fuera de toda huella y puerta, sin compartir celda, y se
  cumplen las distancias a la zona de inicio y al castillo y la separación mínima
- **AND** cada centro está a > 308 px de (1.950, 1.170)

#### Scenario: Contenido sin hueco suficiente
- **GIVEN** el contenido por defecto con 2.000 vetas por mapa
- **WHEN** se genera el mapa de la semilla 7 y se crea la partida
- **THEN** la partida se crea sin error, con < 2.000 vetas, y todas cumplen las reglas de colocación

#### Scenario: Sin recursos
- **GIVEN** el contenido por defecto con 0 vetas y 0 montones por mapa
- **WHEN** se crea una partida con la semilla 42
- **THEN** la lista de vetas y la de recogibles del tick 0 están vacías

#### Scenario: Celdas intactas con recursos
- **GIVEN** el mapa de la semilla 42 con sus recursos colocados
- **WHEN** se leen las celdas de cada veta y de cada montón
- **THEN** todas son `grass` y el mapa es igual celda a celda al generado sin recursos

### Requirement: Colocación de recursos determinista con azar propio
El sistema SHALL colocar las vetas y los montones a partir de la semilla con un flujo de azar propio derivado de ella,
distinto del de las celdas del mapa, del de la decoración, del de las estructuras y del de la partida. La misma semilla
y el mismo contenido MUST dar los mismos recursos (tipo, posición y orden) en dos generaciones y en dos partidas.
Colocar recursos MUST NOT cambiar ninguna celda del mapa, ninguna estructura ni la secuencia de valores que recibe el
resto de la partida. Las firmas de referencia de celdas (`tests/support/mapGolden.ts`) y de estructuras que versionan
los tests MUST NOT cambiar en este change; los tests MUST versionar además una firma de referencia de los recursos de un
conjunto de semillas, que corresponde al contenido por defecto vigente.

#### Scenario: Misma semilla, mismos recursos
- **GIVEN** el contenido por defecto y la semilla 42
- **WHEN** se crean dos partidas
- **THEN** sus listas de vetas y de montones iniciales son iguales: mismo orden, posiciones y valores

#### Scenario: Semillas distintas, recursos distintos
- **GIVEN** el contenido por defecto
- **WHEN** se colocan los recursos de las semillas 1 a 50
- **THEN** no hay dos semillas con la misma lista de posiciones de vetas y montones

#### Scenario: Los recursos no cambian celdas ni estructuras
- **GIVEN** el contenido por defecto y, en otra configuración, el mismo contenido con el doble de vetas y 0 montones
- **WHEN** se genera el mapa y se colocan las estructuras de cada semilla de 1 a 50 con ambas configuraciones
- **THEN** cada semilla da las mismas celdas y las mismas estructuras (tipo, huella y orden) con las dos
- **AND** la firma de celdas de `tests/support/mapGolden.ts` y la de estructuras son las de antes del change

#### Scenario: Firma de referencia de los recursos
- **GIVEN** el contenido por defecto y la firma de recursos versionada en los tests
- **WHEN** se colocan los recursos de las semillas de la firma y se calcula su firma
- **THEN** coincide con la versionada

#### Scenario: Colocar recursos no consume el azar de la partida
- **GIVEN** dos partidas con la semilla 7, input (0, 0) y la política de elección fija, una con el contenido por
  defecto y otra con 0 vetas y 0 montones
- **WHEN** se compara el estado del `RandomGenerator` de la partida al crearlas
- **THEN** es el mismo en las dos

### Requirement: Ovejas en el mapa generado
El sistema SHALL colocar, en cada mapa generado, ovejas hasta el tope de ovejas vivas del contenido (ver "Contenido de
las ovejas validado" en `sheep`), en un **orden fijo** (el de la lista de ovejas del tick 0), con estas reglas:
- cada oveja ocupa una celda y su posición inicial (y su punto de origen) es el centro de esa celda;
- la celda es `grass`, no pertenece a la huella de ninguna estructura ni es la puerta de una casa (ver "Estructuras en
  el mapa generado" en `goblin-structures`);
- la distancia en celdas de la celda a las celdas de la zona de inicio y a la huella del castillo es ≥ el parámetro
  respectivo de colocación de las ovejas, medida igual que en la colocación de estructuras;
- dos ovejas no comparten celda y la distancia en celdas entre ellas es ≥ la separación mínima entre ovejas;
- con el contenido por defecto, el centro de cada oveja está a más de radio de huida + radio de pasto + velocidad de
  paseo × duración de paseo / 60 del punto de salida: un jugador quieto en la salida nunca hace huir a una oveja que no
  ha huido.

La colocación no tiene en cuenta las vetas ni los montones (una oveja puede empezar en la celda de un recurso; no la
bloquea). Si con un contenido dado no caben todas, el sistema coloca las que quepan, sin error y sin incumplir ninguna
regla. Con el contenido por defecto MUST colocarse exactamente el tope con toda semilla de 1 a 1.000, la 0 y la
4.294.967.295. Las ovejas no cambian el tipo de ninguna celda.

#### Scenario: Reglas de colocación con las semillas del conjunto
- **GIVEN** el contenido por defecto
- **WHEN** se genera el mapa de cada semilla de 1 a 1.000, de la 0 y de la 4.294.967.295 y se colocan sus ovejas
- **THEN** cada mapa tiene exactamente el tope de ovejas vivas del contenido
- **AND** cada una está en el centro de una celda `grass` fuera de toda huella y puerta, sin compartir celda, y se
  cumplen las distancias a la zona de inicio y al castillo, la separación mínima y la distancia a la salida

#### Scenario: Contenido sin hueco suficiente
- **GIVEN** el contenido por defecto con tope de ovejas 2.000
- **WHEN** se genera el mapa de la semilla 7 y se crea la partida
- **THEN** la partida se crea sin error, con < 2.000 ovejas, y todas cumplen las reglas de colocación

#### Scenario: Sin ovejas
- **GIVEN** el contenido por defecto con tope de ovejas 0
- **WHEN** se crea una partida con la semilla 42 y se ejecutan 3.600 ticks
- **THEN** la lista de ovejas está vacía en todos los snapshots y no hay ningún recogible `meat`

#### Scenario: Celdas intactas con ovejas
- **GIVEN** el mapa de la semilla 42 con sus ovejas colocadas
- **WHEN** se leen las celdas de cada oveja
- **THEN** todas son `grass` y el mapa es igual celda a celda al generado sin ovejas

### Requirement: Colocación de ovejas determinista con azar propio
El sistema SHALL colocar las ovejas a partir de la semilla con un flujo de azar propio derivado de ella (parte del azar
de las ovejas, ver "Ovejas deterministas" en `sheep`), distinto del de las celdas del mapa, del de la decoración, del
de las estructuras, del de los recursos y del de la partida. La misma semilla y el mismo contenido MUST dar las mismas
ovejas iniciales (posición y orden) en dos generaciones y en dos partidas, sea cual sea lo que ocurra después en la
partida. Colocar ovejas MUST NOT cambiar ninguna celda del mapa, ninguna estructura, ningún recurso ni la secuencia de
valores que recibe el resto de la partida. Las firmas de referencia de celdas (`tests/support/mapGolden.ts`), de
estructuras y de recursos que versionan los tests MUST NOT cambiar en este change; los tests MUST versionar además una
firma de referencia de las ovejas iniciales de un conjunto de semillas que incluye la 42 y la 123, que corresponde al
contenido por defecto vigente.

#### Scenario: Misma semilla, mismas ovejas
- **GIVEN** el contenido por defecto y la semilla 42
- **WHEN** se crean dos partidas y en una se ejecutan 3.600 ticks con un input aleatorio
- **THEN** sus listas de ovejas del tick 0 son iguales: mismo orden y posiciones
- **AND** una tercera partida creada después con la semilla 42 tiene la misma lista en el tick 0

#### Scenario: Semillas distintas, ovejas distintas
- **GIVEN** el contenido por defecto
- **WHEN** se colocan las ovejas de las semillas 1 a 50
- **THEN** no hay dos semillas con la misma lista de posiciones iniciales de ovejas

#### Scenario: Las ovejas no cambian celdas, estructuras ni recursos
- **GIVEN** el contenido por defecto y, en otra configuración, el mismo contenido con tope de ovejas 0
- **WHEN** se genera el mapa y se colocan las estructuras y los recursos de cada semilla de 1 a 50 con ambas
  configuraciones
- **THEN** cada semilla da las mismas celdas, las mismas estructuras y los mismos recursos con las dos
- **AND** la firma de celdas de `tests/support/mapGolden.ts`, la de estructuras y la de recursos son las de antes del
  change

#### Scenario: Firma de referencia de las ovejas
- **GIVEN** el contenido por defecto y la firma de ovejas versionada en los tests
- **WHEN** se colocan las ovejas de las semillas de la firma (42 y 123 incluidas) y se calcula su firma
- **THEN** coincide con la versionada

#### Scenario: Colocar ovejas no consume el azar de la partida
- **GIVEN** dos partidas con la semilla 7, input (0, 0) y la política de elección fija, una con el contenido por
  defecto y otra con tope de ovejas 0
- **WHEN** se compara el estado del `RandomGenerator` de la partida al crearlas
- **THEN** es el mismo en las dos

### Requirement: Puerta de la tienda en cada mapa
El sistema SHALL dar a cada mapa como mucho una **puerta de la tienda** (ver `castle-shop`):
- el mapa generado tiene siempre la puerta en la puerta del castillo, que es su punto de salida (ver "Castillo en el
  mapa generado"): (1.950, 1.170) con el contenido por defecto, para cualquier semilla;
- el mapa vacío no tiene puerta, tampoco el mapa vacío con salida declarada;
- un mapa explícito solo tiene la puerta que declare (una posición dentro del mundo; si no, la partida no se crea y el
  error menciona la puerta de la tienda), sin exigir celdas `castle`.

La puerta no es una celda: no cambia ninguna celda, el campo de distancias, la línea libre, la colisión ni la colocación
de estructuras, recursos u ovejas, y MUST NOT consumir azar. Las firmas doradas de mapa, estructuras, recursos y ovejas
no cambian.

#### Scenario: Puerta en el mapa generado
- **GIVEN** el contenido por defecto
- **WHEN** se crea la partida de cada semilla de 1 a 50, de la 0 y de la 4.294.967.295 con su mapa generado
- **THEN** cada una tiene la puerta de la tienda en (1.950, 1.170), igual a su punto de salida

#### Scenario: Sin puerta en el mapa vacío
- **GIVEN** el contenido por defecto, la semilla 7 y el mapa vacío, y en otro caso el mapa vacío con salida
  (1.950, 1.170)
- **WHEN** se crea la partida
- **THEN** ninguna de las dos tiene puerta de la tienda

#### Scenario: Puerta declarada en un mapa explícito
- **GIVEN** el mapa vacío con puerta declarada en (1.000, 1.000), y en otro caso en (−10, 1.000)
- **WHEN** se crea la partida
- **THEN** la primera se crea con la puerta en (1.000, 1.000) y la segunda no se crea, con un error que menciona la
  puerta de la tienda

<!-- historial: 0015-procedural-map (2026-11-23) -->
<!-- historial: 0016-map-art (2026-11-23) -->
<!-- historial: 0017-fullscreen-view (2026-11-24) -->
<!-- historial: 0019-flow-field (2026-11-24) -->
<!-- historial: 0021-goblin-camps (2026-11-24) -->
<!-- historial: 0022-resources-sheep (2026-11-24) -->
<!-- historial: 0023-sheep-meat (2026-11-24) -->
<!-- historial: 0024-split-progression-castle (2026-11-25) -->
