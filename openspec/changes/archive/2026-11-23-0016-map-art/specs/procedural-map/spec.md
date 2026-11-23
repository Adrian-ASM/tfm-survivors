# Spec delta · procedural-map

<!-- Ruta: openspec/changes/0016-map-art/specs/procedural-map/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Cobertura (e2e-lite): todos los escenarios de este delta se cubren con tests unitarios o de aplicación salvo los
     marcados [E2E]. El único [E2E] nuevo de este fichero ("Sonda con castillo y salida") se cubre en el mismo test que
     "Recuentos del mapa pintado" de sprite-rendering. -->

## ADDED Requirements

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

Con el contenido por defecto (rejilla de 32 × 18, (cc, rc) = (16, 9), castillo de 5 × 4) la huella es columnas
14–18 y filas 6–9 (x en [840, 1.140], y en [360, 600]), 20 celdas, y la salida es (990, 630). Si el apply cambia la
huella por balance, este requisito y sus escenarios MUST actualizarse antes de verify con los valores definitivos.

#### Scenario: Huella y salida por defecto
- **GIVEN** el contenido por defecto y la semilla 42
- **WHEN** se genera el mapa
- **THEN** las celdas `castle` son exactamente las de columnas 14 a 18 y filas 6 a 9 (20 celdas)
- **AND** el punto de salida del mapa es (990, 630)

#### Scenario: Misma huella con todas las semillas
- **GIVEN** el contenido por defecto
- **WHEN** se genera el mapa de cada semilla de 1 a 1.000, de la 0 y de la 4.294.967.295
- **THEN** cada mapa tiene exactamente 20 celdas `castle`, las de columnas 14–18 y filas 6–9, y salida (990, 630)

#### Scenario: Huella en un mundo mayor
- **GIVEN** el contenido por defecto salvo una arena explícita de 4.000 × 4.000 (67 × 67 celdas, (cc, rc) = (33, 33))
- **WHEN** se genera el mapa de la semilla 7
- **THEN** las celdas `castle` son las de columnas 31 a 35 y filas 30 a 33, y la salida es (2.010, 2.070)

## MODIFIED Requirements

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
  (16 y 9 con el mundo por defecto), huella del castillo (ver "Castillo en el mapa generado"). La huella y la celda de
  la puerta MUST caber en la rejilla; si no, la carga falla con un error que nombra `castle`.

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
  `startRadius` 541 (mundo de 1.920 × 1.080), `trunkDensity` −0,01, `trunkDensity` 0,31, `trunkPatch` { 4, 3 },
  `trunkPatch` { 0, 3 }, `rivers` 3, `rivers` 1,5, `bridges` { 0, 2 }, `bridges` { 3, 2 }, `castle` { 0, 4 },
  `castle` { 5, 0 }, `castle` { 5,5; 4 }, `castle` { 17, 4 } o `castle` { 5, 10 }
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo
- **AND** no se muestra el menú ni se crea ninguna partida

#### Scenario: Límites válidos
- **GIVEN** el contenido por defecto con, en un caso cada vez: `startRadius` 540, `trunkDensity` 0, `trunkDensity`
  0,3, `rivers` 0, `rivers` 2, `trunkPatch` { 1, 1 }, `castle` { 1, 1 } o `castle` { 16, 9 }
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
- el punto de salida del mapa (ver "Castillo en el mapa generado" y "Mapa explícito y mapa vacío").

Todo lo que dependa de "no caminable" (colisión del jugador, recolocación de gemas, conectividad, bot de referencia)
MUST tratar una celda `castle` igual que una `trunk` o una `water`.

#### Scenario: Rejilla por defecto
- **GIVEN** el contenido por defecto
- **WHEN** se crea una partida
- **THEN** su mapa tiene 32 columnas, 18 filas y 576 celdas, todas de 60 × 60 px

#### Scenario: Mundo no múltiplo de la celda
- **GIVEN** el contenido por defecto salvo una arena explícita de 4.000 × 4.000
- **WHEN** se crea una partida
- **THEN** su mapa tiene 67 × 67 celdas y las de la columna 66 ocupan x en [3.960, 4.000] (40 px de ancho)

#### Scenario: Celda de un punto
- **GIVEN** el contenido por defecto
- **WHEN** se pide la celda de (959,9; 539,9), de (960, 540), de (0, 0) y de (1.920, 1.080)
- **THEN** son (15, 8), (16, 9), (0, 0) y (31, 17) respectivamente

#### Scenario: Caminabilidad por tipo y fuera de la rejilla
- **GIVEN** un mapa explícito de 32 × 18 con la celda (3, 3) `trunk`, la (4, 3) `water`, la (5, 3) `bridge`, la
  (6, 3) `castle` y el resto `grass`
- **WHEN** se consulta la caminabilidad de (3, 3), (4, 3), (5, 3), (6, 3), (7, 3), (−1, 0), (32, 0) y (0, 18)
- **THEN** son no caminable, no caminable, caminable, no caminable, caminable, no caminable, no caminable y no
  caminable

### Requirement: Azar del mapa independiente del de la partida
El sistema SHALL generar el mapa con un flujo de azar propio derivado de la semilla, distinto del que consumen
oleadas y ofertas: generar el mapa MUST NOT cambiar la secuencia de valores que recibe el resto de la partida. Con la
misma semilla y el mismo punto de salida, una partida con el mapa generado y otra con un mapa todo `grass` consumen el
azar de la partida igual. Para comparar con el mapa generado se usa el **mapa vacío con salida** (990, 630): todo
`grass`, con ese punto de salida declarado (ver "Mapa explícito y mapa vacío").

#### Scenario: Mismos spawns con y sin mapa
- **GIVEN** dos partidas con el contenido por defecto, la semilla 7, input (0, 0) y la política de elección fija, una
  con el mapa generado y otra con el mapa vacío con salida (990, 630)
- **WHEN** ambas ejecutan 1.200 ticks
- **THEN** en cada tick aparecen los mismos enemigos en ambas: mismo identificador, tipo y posición de aparición

#### Scenario: Primera oferta igual con y sin mapa
- **GIVEN** las dos partidas del escenario anterior con un jugador quieto que abre su primera oferta en el mismo tick
  en ambas
- **WHEN** se lee esa oferta
- **THEN** sus opciones son las mismas y en el mismo orden

### Requirement: Composición del mapa
El sistema SHALL generar, con el contenido por defecto y con cada semilla de 1 a 50, un mapa que cumpla:
- **Río**: exactamente `rivers` ríos. Un río es un conjunto 4-conexo de celdas `water` y `bridge` que toca dos bordes
  opuestos del mundo (izquierdo y derecho, o superior e inferior) y tiene 1 celda de ancho: ningún bloque de 2 × 2
  celdas es todo del río. Cada río tiene entre `bridges.min` y `bridges.max` celdas `bridge`. Fuera de los ríos no
  hay celdas `water` ni `bridge`. Ninguna celda del río está en la zona de inicio ni en la huella del castillo.
- **Troncos**: la fracción de celdas `trunk` está en [`trunkDensity` − 0,02, `trunkDensity` + 0,02] (con el contenido
  por defecto, de 58 a 80 de 576; tolerancia provisional, a confirmar en apply) y cada componente 4-conexa de celdas
  `trunk` tiene entre `trunkPatch.min` y `trunkPatch.max` celdas.
- **Castillo**: exactamente las celdas de la huella son `castle` (ver "Castillo en el mapa generado").
- **Caminable**: al menos el 70 % de las celdas son caminables.

Con `rivers` 0 y `trunkDensity` 0 el mapa MUST ser todo `grass` salvo la huella del castillo.

#### Scenario: Composición con las semillas del conjunto
- **GIVEN** el contenido por defecto
- **WHEN** se genera el mapa de cada semilla de 1 a 50
- **THEN** cada mapa tiene 1 río de 1 celda de ancho que toca dos bordes opuestos, con 2 o 3 puentes, y ninguna de
  sus celdas en la zona de inicio ni en la huella
- **AND** entre 58 y 80 celdas `trunk`, en manchas 4-conexas de 3 a 8 celdas, exactamente 20 celdas `castle` y
  ≥ 404 celdas caminables (70 % de 576)

#### Scenario: Sin río ni troncos
- **GIVEN** el contenido por defecto con `rivers` 0 y `trunkDensity` 0
- **WHEN** se genera el mapa de la semilla 7
- **THEN** las 20 celdas de columnas 14–18 y filas 6–9 son `castle` y las 556 restantes son `grass`

### Requirement: Zona de inicio
El sistema SHALL reservar la zona de inicio: el disco de centro el punto de salida del mapa y radio `startRadius`.
Toda celda cuyo rectángulo tenga algún punto a distancia < `startRadius` del centro MUST ser `grass` o, si pertenece
a la huella del castillo, `castle`. El jugador aparece en la salida (ver `player-movement`) sin solapar ninguna celda
no caminable. Con el contenido por defecto el centro es (990, 630); en el mapa vacío y en un mapa explícito sin salida
declarada, el centro del mundo.

#### Scenario: Celdas dentro y fuera de la zona
- **GIVEN** el contenido por defecto (salida (990, 630), `startRadius` 180)
- **WHEN** se clasifican las celdas (19, 10) (punto más cercano a 150 px), (20, 10) (a 210 px), (16, 13) (a 150 px)
  y (16, 14) (a 210 px)
- **THEN** la (19, 10) y la (16, 13) pertenecen a la zona de inicio y la (20, 10) y la (16, 14) no

#### Scenario: Zona libre con todas las semillas
- **GIVEN** el contenido por defecto
- **WHEN** se genera el mapa de cada semilla de 1 a 1.000, de la 0 y de la 4.294.967.295
- **THEN** en cada uno toda celda de la zona de inicio es `grass` o es una celda de la huella, que es `castle`
- **AND** un círculo de radio 16 centrado en (990, 630) no solapa ninguna celda no caminable (la más cercana, la
  `castle` (16, 9), está a 30 px)

### Requirement: Conectividad
El sistema SHALL garantizar que toda celda caminable es alcanzable desde el punto de salida del mapa. Una posición es
legal si el círculo del jugador (radio de contenido) cabe en el mundo y no solapa ninguna celda no caminable (ver
"Colisión con el mapa" en `player-movement`). Una celda caminable es alcanzable si contiene en su rectángulo el centro
de alguna posición legal unida al punto de salida por un camino continuo de posiciones legales. Así se cubren las
"zonas clave" del GDD: hoy, toda celda caminable.

#### Scenario: Todas las celdas caminables alcanzables
- **GIVEN** el contenido por defecto y radio del jugador 16
- **WHEN** se genera el mapa de cada semilla de 1 a 50, de 1 a 1.000, de la 0 y de la 4.294.967.295
- **THEN** en cada mapa el 100 % de las celdas caminables es alcanzable desde (990, 630)

#### Scenario: Celdas tras el castillo alcanzables
- **GIVEN** el contenido por defecto con `rivers` 0 y `trunkDensity` 0 (solo el castillo) y radio del jugador 16
- **WHEN** se evalúa la conectividad desde (990, 630)
- **THEN** las 556 celdas `grass` son alcanzables, entre ellas la (16, 5), justo encima del castillo

#### Scenario: Celda encerrada no es alcanzable
- **GIVEN** un mapa explícito de hierba con troncos en (10, 4), (11, 5), (9, 5) y (10, 6), que encierran la celda
  caminable (10, 5) por sus cuatro lados
- **WHEN** se evalúa la conectividad con radio 16
- **THEN** la celda (10, 5) no es alcanzable y el mapa no cumple "Conectividad"

### Requirement: Mapa explícito y mapa vacío
El sistema SHALL permitir crear una partida con un mapa dado en lugar del generado, en particular el **mapa vacío**
(todas las celdas `grass`, del tamaño de rejilla que dicte el contenido). Un mapa dado MUST tener las dimensiones de
rejilla del contenido; si no, la partida no se crea y el error lo dice. Un mapa dado no tiene que cumplir
"Composición del mapa", "Zona de inicio" ni "Conectividad" (lo usan los tests para fijar casos) y puede contener
celdas de cualquier tipo, también `castle`; al mapa dado no se le añade ningún castillo y no tiene huella (sus celdas
`castle` son celdas sueltas no caminables).

Un mapa dado puede declarar su punto de salida. Si no lo declara, la salida es el centro del mundo (ancho / 2,
alto / 2), sin comprobar si es legal. Si lo declara, la salida MUST ser una posición legal del jugador en ese mapa
(dentro de los límites de la arena y sin solapar celdas no caminables); si no, la partida no se crea y el error
menciona el punto de salida. El mapa vacío no declara salida: con él la partida se comporta como antes del change
0015 en movimiento, gemas, spawns y posición inicial.

Convención para todas las specs: un escenario que coloca elementos en posiciones explícitas y no declara mapa se
entiende con el mapa vacío; un escenario que usa "el contenido por defecto" y una semilla sin posiciones explícitas
juega con el mapa generado para esa semilla (con castillo y salida ante la puerta), salvo que diga otra cosa.

#### Scenario: Partida con mapa vacío
- **GIVEN** el contenido por defecto, la semilla 7 y el mapa vacío
- **WHEN** se crea la partida
- **THEN** sus 576 celdas son `grass`, ninguna es `castle` y la salida es (960, 540)

#### Scenario: Mapa de dimensiones incorrectas
- **GIVEN** el contenido por defecto y un mapa dado de 30 × 17 celdas
- **WHEN** se intenta crear la partida
- **THEN** no se crea y el error menciona las dimensiones del mapa

#### Scenario: Mapa explícito con salida declarada
- **GIVEN** el contenido por defecto, la semilla 7 y el mapa vacío con salida (990, 630)
- **WHEN** se crea la partida
- **THEN** sus 576 celdas son `grass` y la salida es (990, 630)

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
- **THEN** la (3, 3) es la única celda `castle` y la salida es (960, 540)

### Requirement: Sonda del mapa para E2E
El sistema SHALL exponer, solo con `?e2e` y como parte de la sonda `window.__sprint`, el mapa de la partida en curso:
columnas, filas, `cellSize`, la lista completa de tipos de celda en orden de filas (fila 0 de izquierda a derecha,
luego la fila 1…), el recuento de celdas por tipo (incluido `castle`), la zona de inicio (centro y radio), el punto de
salida, la huella del castillo (primera y última columna y fila; `null` con el mapa vacío o explícito) y si el mapa
vacío está forzado. En modo menú el mapa de la sonda MUST valer `null`. Sin `?e2e` MUST NOT existir. Leer la sonda
MUST NOT cambiar la simulación ni lo que se pinta.

#### Scenario: Sonda coherente con el núcleo
- **GIVEN** la URL `?e2e&manual&seed=42`
- **WHEN** arranca la partida al cargar y se lee la sonda del mapa
- **THEN** informa de 32 columnas, 18 filas, `cellSize` 60, 576 tipos iguales uno a uno a los del mapa que genera el
  núcleo para la semilla 42, recuentos por tipo que suman 576 y coinciden con la lista, y zona de inicio de centro
  (990, 630) y radio 180

#### Scenario: Sonda con castillo y salida [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` (mapa real)
- **WHEN** arranca la partida, se pinta 1 frame y se leen la sonda del mapa y el snapshot
- **THEN** la sonda informa de 20 celdas `castle`, huella de columnas 14–18 y filas 6–9 y salida (990, 630)
- **AND** el jugador del snapshot está en (990, 630)

#### Scenario: Sonda con el mapa vacío
- **GIVEN** la URL `?e2e&map=empty&seed=42`
- **WHEN** arranca la partida al cargar y se lee la sonda del mapa
- **THEN** informa de 576 celdas `grass`, 0 `castle`, huella `null`, salida (960, 540) y zona de inicio de centro
  (960, 540)

#### Scenario: Sonda en el menú
- **GIVEN** `?e2e&seed=42` y el menú tras `Volver al menú`
- **WHEN** se pinta 1 frame y se lee la sonda
- **THEN** el mapa de la sonda vale `null`
- **AND** tras pulsar `Jugar` vuelve a informar del mapa de la partida nueva

#### Scenario: Sin sonda fuera de E2E
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga y se pulsa `Jugar`
- **THEN** `window.__sprint` es `undefined`

## REMOVED Requirements
<!-- Ninguno. -->
