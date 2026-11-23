# Procedural map · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
Mapa de rejilla generado por semilla (hierba, troncos, agua y puentes), puro y determinista, con su propio
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
- `bridges`: `{ min, max }`, enteros con 1 ≤ `min` ≤ `max` ≤ 6, puentes por río.

El design puede añadir campos de ajuste de la generación; cada uno MUST validarse con las mismas reglas de campo
ausente, desconocido o fuera de rango. Un contenido inválido MUST impedir que se muestre el menú o empiece una
partida, con un error que nombre el campo. El contenido por defecto MUST fijar `cellSize` 60, `startRadius` 180,
`trunkDensity` 0,12, `trunkPatch` 3..8, `rivers` 1 y `bridges` 2..3.

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** el dominio recibe `cellSize` 60, `startRadius` 180, `trunkDensity` 0,12, `trunkPatch` { 3, 8 },
  `rivers` 1 y `bridges` { 2, 3 }

#### Scenario: Celda en el límite del radio del jugador
- **GIVEN** el contenido por defecto (radio del jugador 16) con `cellSize` 32, y en otro caso con `cellSize` 31
- **WHEN** se carga el contenido
- **THEN** con 32 la carga tiene éxito y con 31 falla con un error que menciona `cellSize`

#### Scenario: Valores fuera de rango
- **GIVEN** el contenido por defecto con, en un caso cada vez: `cellSize` 0, `cellSize` 60,5, `startRadius` 0,
  `startRadius` 541 (mundo de 1.920 × 1.080), `trunkDensity` −0,01, `trunkDensity` 0,31, `trunkPatch` { 4, 3 },
  `trunkPatch` { 0, 3 }, `rivers` 3, `rivers` 1,5, `bridges` { 0, 2 } o `bridges` { 3, 2 }
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo
- **AND** no se muestra el menú ni se crea ninguna partida

#### Scenario: Límites válidos
- **GIVEN** el contenido por defecto con, en un caso cada vez: `startRadius` 540, `trunkDensity` 0, `trunkDensity`
  0,3, `rivers` 0, `rivers` 2 o `trunkPatch` { 1, 1 }
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Campo ausente o desconocido
- **GIVEN** el contenido del mapa sin `trunkDensity`, y en otro caso con un campo extra `lakes: 2`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `trunkDensity` y `lakes` respectivamente

### Requirement: Rejilla de celdas tipadas
El sistema SHALL representar el mapa de cada partida como una rejilla de ⌈ancho / `cellSize`⌉ columnas por
⌈alto / `cellSize`⌉ filas que cubre el mundo entero; las celdas de la última columna y la última fila se recortan al
borde del mundo si el tamaño no es múltiplo de `cellSize`. Cada celda tiene exactamente un tipo: `grass` (hierba),
`trunk` (tronco), `water` (agua) o `bridge` (puente). Son caminables `grass` y `bridge`; no caminables `trunk` y
`water`. El núcleo MUST ofrecer, sin consumir azar ni depender del jugador:
- el tipo de una celda (c, r) y si es caminable; una celda fuera de la rejilla MUST considerarse no caminable;
- la celda que contiene un punto (x, y) del mundo: (⌊x / `cellSize`⌋, ⌊y / `cellSize`⌋), con x = ancho y y = alto
  asignados a la última columna y la última fila.

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
- **GIVEN** un mapa explícito de 32 × 18 con la celda (3, 3) `trunk`, la (4, 3) `water`, la (5, 3) `bridge` y el
  resto `grass`
- **WHEN** se consulta la caminabilidad de (3, 3), (4, 3), (5, 3), (6, 3), (−1, 0), (32, 0) y (0, 18)
- **THEN** son no caminable, no caminable, caminable, caminable, no caminable, no caminable y no caminable

### Requirement: Generación determinista por semilla
El sistema SHALL generar el mapa de cada partida a partir de su semilla y del contenido, sin reloj ni APIs del
navegador: la misma semilla y el mismo contenido MUST dar el mismo mapa celda a celda, en dos generaciones y en dos
partidas. Toda semilla de 0 a 4.294.967.295 MUST dar un mapa que cumpla "Composición del mapa", "Zona de inicio" y
"Conectividad". La generación de un mapa con el contenido por defecto MUST tardar < 20 ms de media, medido con
`npm run bench` (informativo: no bloquea `verify` ni CI).

#### Scenario: Misma semilla, mismo mapa
- **GIVEN** el contenido por defecto y la semilla 42
- **WHEN** se crean dos partidas y se compara su mapa
- **THEN** las 576 celdas tienen el mismo tipo en ambas

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

### Requirement: Azar del mapa independiente del de la partida
El sistema SHALL generar el mapa con un flujo de azar propio derivado de la semilla, distinto del que consumen
oleadas y ofertas: generar el mapa MUST NOT cambiar la secuencia de valores que recibe el resto de la partida. Con la
misma semilla, una partida con el mapa generado y otra con el mapa vacío consumen el azar de la partida igual.

#### Scenario: Mismos spawns con y sin mapa
- **GIVEN** dos partidas con el contenido por defecto, la semilla 7, input (0, 0) y la política de elección fija, una
  con el mapa generado y otra con el mapa vacío
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
  hay celdas `water` ni `bridge`.
- **Troncos**: la fracción de celdas `trunk` está en [`trunkDensity` − 0,02, `trunkDensity` + 0,02] (con el contenido
  por defecto, de 58 a 80 de 576; tolerancia provisional, a confirmar en apply) y cada componente 4-conexa de celdas
  `trunk` tiene entre `trunkPatch.min` y `trunkPatch.max` celdas.
- **Caminable**: al menos el 70 % de las celdas son caminables.

Con `rivers` 0 y `trunkDensity` 0 el mapa MUST ser todo `grass`.

#### Scenario: Composición con las semillas del conjunto
- **GIVEN** el contenido por defecto
- **WHEN** se genera el mapa de cada semilla de 1 a 50
- **THEN** cada mapa tiene 1 río de 1 celda de ancho que toca dos bordes opuestos, con 2 o 3 puentes
- **AND** entre 58 y 80 celdas `trunk`, en manchas 4-conexas de 3 a 8 celdas, y ≥ 404 celdas caminables (70 % de 576)

#### Scenario: Sin río ni troncos
- **GIVEN** el contenido por defecto con `rivers` 0 y `trunkDensity` 0
- **WHEN** se genera el mapa de la semilla 7
- **THEN** las 576 celdas son `grass`

### Requirement: Zona de inicio
El sistema SHALL reservar la zona de inicio: el disco de centro (ancho / 2, alto / 2) y radio `startRadius`. Toda
celda cuyo rectángulo tenga algún punto a distancia < `startRadius` del centro MUST ser `grass`. El jugador aparece
en el centro (ver `player-movement`) sin solapar ninguna celda no caminable. En este change la zona solo se reserva:
no hay castillo ni ningún obstáculo en ella.

#### Scenario: Celdas dentro y fuera de la zona
- **GIVEN** el contenido por defecto (centro (960, 540), `startRadius` 180)
- **WHEN** se clasifican las celdas (18, 9) (punto más cercano a 120 px) y (19, 9) (punto más cercano a 180 px)
- **THEN** la (18, 9) pertenece a la zona de inicio y la (19, 9) no

#### Scenario: Zona libre con todas las semillas
- **GIVEN** el contenido por defecto
- **WHEN** se genera el mapa de cada semilla de 1 a 1.000, de la 0 y de la 4.294.967.295
- **THEN** en cada uno todas las celdas de la zona de inicio son `grass`

### Requirement: Conectividad
El sistema SHALL garantizar que toda celda caminable es alcanzable desde la posición inicial del jugador. Una
posición es legal si el círculo del jugador (radio de contenido) cabe en el mundo y no solapa ninguna celda no
caminable (ver "Colisión con el mapa" en `player-movement`). Una celda caminable es alcanzable si contiene en su
rectángulo el centro de alguna posición legal unida a (ancho / 2, alto / 2) por un camino continuo de posiciones
legales. Así se cubren las "zonas clave" del GDD: hoy, toda celda caminable.

#### Scenario: Todas las celdas caminables alcanzables
- **GIVEN** el contenido por defecto y radio del jugador 16
- **WHEN** se genera el mapa de cada semilla de 1 a 50, de 1 a 1.000, de la 0 y de la 4.294.967.295
- **THEN** en cada mapa el 100 % de las celdas caminables es alcanzable

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
"Composición del mapa", "Zona de inicio" ni "Conectividad" (lo usan los tests para fijar casos). Con el mapa vacío la partida se comporta como
antes de este change en movimiento, gemas y spawns.

Convención para todas las specs: un escenario que coloca elementos en posiciones explícitas y no declara mapa se
entiende con el mapa vacío; un escenario que usa "el contenido por defecto" y una semilla sin posiciones explícitas
juega con el mapa generado para esa semilla, salvo que diga otra cosa.

#### Scenario: Partida con mapa vacío
- **GIVEN** el contenido por defecto, la semilla 7 y el mapa vacío
- **WHEN** se crea la partida
- **THEN** sus 576 celdas son `grass`

#### Scenario: Mapa de dimensiones incorrectas
- **GIVEN** el contenido por defecto y un mapa dado de 30 × 17 celdas
- **WHEN** se intenta crear la partida
- **THEN** no se crea y el error menciona las dimensiones del mapa

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
- **THEN** la sonda informa de mapa vacío forzado y de 576 celdas `grass`, sin avisos que mencionen `map`

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
luego la fila 1…), el recuento de celdas por tipo, la zona de inicio (centro y radio) y si el mapa vacío está forzado.
En modo menú el mapa de la sonda MUST valer `null`. Sin `?e2e` MUST NOT existir. Leer la sonda MUST NOT cambiar la
simulación ni lo que se pinta.

#### Scenario: Sonda coherente con el núcleo
- **GIVEN** la URL `?e2e&manual&seed=42`
- **WHEN** arranca la partida al cargar y se lee la sonda del mapa
- **THEN** informa de 32 columnas, 18 filas, `cellSize` 60, 576 tipos iguales uno a uno a los del mapa que genera el
  núcleo para la semilla 42, recuentos por tipo que suman 576 y coinciden con la lista, y zona de inicio de centro
  (960, 540) y radio 180

#### Scenario: Sonda en el menú
- **GIVEN** `?e2e&seed=42` y el menú tras `Volver al menú`
- **WHEN** se pinta 1 frame y se lee la sonda
- **THEN** el mapa de la sonda vale `null`
- **AND** tras pulsar `Jugar` vuelve a informar del mapa de la partida nueva

#### Scenario: Sin sonda fuera de E2E
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga y se pulsa `Jugar`
- **THEN** `window.__sprint` es `undefined`

<!-- historial: 0015-procedural-map (2026-11-23) -->
