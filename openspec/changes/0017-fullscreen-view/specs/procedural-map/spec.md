# Spec delta · procedural-map

<!-- Change 0017-fullscreen-view. Mundo por defecto de 3.840 × 2.160: rejilla de 64 × 36 = 2.304 celdas de 60 px.
     Centro del mundo (1.920, 1.080) en la celda (32, 18); castillo de 5 × 4 en columnas 30–34 y filas 15–18
     (x en [1.800, 2.100], y en [900, 1.140]); puerta en la celda (32, 19), salida (1.950, 1.170).
     `rivers` se mantiene en 1 (decisión del gate humano). -->

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
- el punto de salida del mapa (ver "Castillo en el mapa generado" y "Mapa explícito y mapa vacío").

Todo lo que dependa de "no caminable" (colisión del jugador, recolocación de gemas, conectividad, bot de referencia)
MUST tratar una celda `castle` igual que una `trunk` o una `water`.

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
oleadas y ofertas: generar el mapa MUST NOT cambiar la secuencia de valores que recibe el resto de la partida. Con la
misma semilla y el mismo punto de salida, una partida con el mapa generado y otra con un mapa todo `grass` consumen el
azar de la partida igual. Para comparar con el mapa generado se usa el **mapa vacío con salida** (1.950, 1.170): todo
`grass`, con ese punto de salida declarado (ver "Mapa explícito y mapa vacío").

#### Scenario: Mismos spawns con y sin mapa
- **GIVEN** dos partidas con el contenido por defecto, la semilla 7, input (0, 0) y la política de elección fija, una
  con el mapa generado y otra con el mapa vacío con salida (1.950, 1.170)
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
  por defecto, de 231 a 322 de 2.304; tolerancia provisional, a confirmar en apply) y cada componente 4-conexa de
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
- **THEN** sus 2.304 celdas son `grass`, ninguna es `castle` y la salida es (1.920, 1.080)

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
salida, la huella del castillo (primera y última columna y fila; `null` con el mapa vacío o explícito) y si el mapa
vacío está forzado. En modo menú el mapa de la sonda MUST valer `null`. Sin `?e2e` MUST NOT existir. Leer la sonda
MUST NOT cambiar la simulación ni lo que se pinta.

#### Scenario: Sonda coherente con el núcleo
- **GIVEN** la URL `?e2e&manual&seed=42`
- **WHEN** arranca la partida al cargar y se lee la sonda del mapa
- **THEN** informa de 64 columnas, 36 filas, `cellSize` 60, 2.304 tipos iguales uno a uno a los del mapa que genera el
  núcleo para la semilla 42, recuentos por tipo que suman 2.304 y coinciden con la lista, y zona de inicio de centro
  (1.950, 1.170) y radio 180

#### Scenario: Sonda con castillo y salida [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` (mapa real)
- **WHEN** arranca la partida, se pinta 1 frame y se leen la sonda del mapa y el snapshot
- **THEN** la sonda informa de 20 celdas `castle`, huella de columnas 30–34 y filas 15–18 y salida (1.950, 1.170)
- **AND** el jugador del snapshot está en (1.950, 1.170)

#### Scenario: Sonda con el mapa vacío
- **GIVEN** la URL `?e2e&map=empty&seed=42`
- **WHEN** arranca la partida al cargar y se lee la sonda del mapa
- **THEN** informa de 2.304 celdas `grass`, 0 `castle`, huella `null`, salida (1.920, 1.080) y zona de inicio de
  centro (1.920, 1.080)

#### Scenario: Sonda en el menú
- **GIVEN** `?e2e&seed=42` y el menú tras `Volver al menú`
- **WHEN** se pinta 1 frame y se lee la sonda
- **THEN** el mapa de la sonda vale `null`
- **AND** tras pulsar `Jugar` vuelve a informar del mapa de la partida nueva

#### Scenario: Sin sonda fuera de E2E
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga y se pulsa `Jugar`
- **THEN** `window.__sprint` es `undefined`

<!-- historial: 0017-fullscreen-view (pendiente de archivar) -->
