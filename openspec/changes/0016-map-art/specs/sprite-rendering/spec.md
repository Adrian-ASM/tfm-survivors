# Spec delta · sprite-rendering

<!-- Ruta: openspec/changes/0016-map-art/specs/sprite-rendering/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Cobertura (e2e-lite): todo se cubre con tests unitarios o de aplicación (funciones puras del adaptador, validación
     de datos, disposición de objetos con dobles del motor) salvo los marcados:
     - [E2E] nuevos, como máximo 2, en modo manual (`?e2e&manual` + `step(n)`), preferiblemente ampliando el test del
       mapa de la suite de humo: "Recuentos del mapa pintado" (incluye "Sonda con castillo y salida" de
       procedural-map) y "Hojas del mapa bloqueadas".
     - [realtime]: proyecto `realtime`, a demanda, fuera de `test:e2e` y del CI; informativo, no es gate.
     Los escenarios E2E que ya existían (Partida con arte, Mapa vacío, Partida nueva con otro mapa, Mapa sobre el fondo
     de reserva) conservan su cobertura actual; si se retiraron en e2e-lite, se aceptan sin test nuevo.
     Ningún escenario depende del frame de animación de la espuma (en modo manual el reloj de render no la avanza). -->

## ADDED Requirements

### Requirement: Orillas por autotile de 4 vecinos
El sistema SHALL elegir la orilla de cada celda de **tierra** con una función pura del mapa de la partida, sin azar,
a partir de sus 4 vecinas (norte, este, sur y oeste). Una celda es **tierra** si es `grass`, `trunk` o `castle`, y
**río** si es `water` o `bridge` (bajo el puente también hay agua). Una posición fuera de la rejilla no es río: el
borde del mundo no hace orilla (si contara como río, toda la hierba del borde del mundo mostraría una orilla falsa).
El caso de una celda de tierra es el conjunto de lados que dan a río: hay 16 casos posibles. Una celda de tierra con
≥ 1 lado de río es una **celda de orilla**: muestra la pieza de orilla de su caso (hierba con borde en esos lados) y
espuma en su borde con el río (ver "Pintado del mapa"); el árbol o el castillo de la celda, si lo hay, se pinta
encima (ver "Capas del mapa y de las entidades"). Una celda de tierra sin lados de río no tiene orilla. Las celdas
`water` y `bridge` nunca son celdas de orilla: el agua de un río de 1 celda de ancho queda entera a la vista. No hay
piezas de esquina cóncava: una celda de tierra con río solo en diagonal no es celda de orilla y se acepta la muesca
resultante.

#### Scenario: Río recto horizontal
- **GIVEN** un mapa de hierba con la fila 9 entera de `water`
- **WHEN** se calcula el caso de las celdas (0, 8), (5, 8), (31, 8), (5, 10) y (5, 9)
- **THEN** la (0, 8), la (5, 8) y la (31, 8) tienen el caso { sur } (el oeste de la (0, 8) y el este de la (31, 8)
  están fuera de la rejilla y no cuentan como río) y la (5, 10) { norte }
- **AND** la (5, 9) no es celda de orilla y el mapa tiene 64 celdas de orilla (filas 8 y 10 enteras)

#### Scenario: Tierra junto a un puente
- **GIVEN** un mapa de hierba con la fila 9 entera de `water` salvo la celda (16, 9) `bridge`
- **WHEN** se calcula el caso de las celdas (16, 8) y (16, 10)
- **THEN** la (16, 8) tiene el caso { sur } y la (16, 10) { norte }, y la (16, 9) no es celda de orilla

#### Scenario: Meandro
- **GIVEN** un mapa de hierba con las celdas (5, 9), (6, 9) y (6, 10) de `water`
- **WHEN** se calcula el caso de las celdas (5, 10), (7, 10) y (5, 11)
- **THEN** la (5, 10) tiene { norte, este } y la (7, 10) { oeste }; la (5, 11) solo toca río en diagonal y no es
  celda de orilla
- **AND** el mapa tiene exactamente 7 celdas de orilla: (5, 8), (4, 9), (5, 10), (6, 8), (7, 9), (7, 10) y (6, 11)

#### Scenario: Tronco y castillo cuentan como tierra
- **GIVEN** un mapa de hierba con la celda (4, 3) `water`, la (5, 3) `trunk` y la (4, 2) `castle`
- **WHEN** se calcula el caso de la (5, 3), de la (4, 2) y de la (4, 3)
- **THEN** la (5, 3) tiene { oeste } y la (4, 2) { sur }, y las dos son celdas de orilla; la (4, 3) no lo es

#### Scenario: Bloque de agua y borde del mundo
- **GIVEN** un mapa de hierba con un bloque de 3 × 3 celdas `water` de columnas 4–6 y filas 4–6
- **WHEN** se calculan las celdas de orilla
- **THEN** son exactamente 12: (4..6, 3) con { sur }, (4..6, 7) con { norte }, (3, 4..6) con { este } y
  (7, 4..6) con { oeste }; ni las esquinas (3, 3), (7, 3), (3, 7) y (7, 7) ni las celdas del bloque lo son
- **AND** en un mapa entero de hierba no hay ninguna celda de orilla, tampoco en el borde del mundo

### Requirement: Orientación de los puentes
El sistema SHALL orientar cada puente con una función pura del mapa de la partida, sin azar: el puente es
**norte-sur** si sus vecinas norte y sur son tierra (en el sentido de "Orillas por autotile de 4 vecinos"); si no, es
**este-oeste** si sus vecinas este y oeste son tierra; en cualquier otro caso es norte-sur. Cada orientación se pinta
con su propio marco de los datos de aspecto.

#### Scenario: Puente en un río horizontal
- **GIVEN** un mapa de hierba con la fila 9 entera de `water` salvo la (16, 9) `bridge`
- **WHEN** se calcula la orientación del puente
- **THEN** es norte-sur

#### Scenario: Puente en un río vertical
- **GIVEN** un mapa de hierba con la columna 16 entera de `water` salvo la (16, 9) `bridge`
- **WHEN** se calcula la orientación del puente
- **THEN** es este-oeste

#### Scenario: Puente en un recodo
- **GIVEN** un mapa de hierba con la (16, 9) `bridge`, la (15, 9) y la (16, 10) `water` y el resto `grass`
- **WHEN** se calcula la orientación del puente
- **THEN** es norte-sur (ni norte y sur ni este y oeste son tierra a la vez)

#### Scenario: Puentes del mapa generado
- **GIVEN** el contenido por defecto
- **WHEN** se calcula la orientación de cada puente de los mapas de las semillas 1 a 50
- **THEN** cada puente tiene tierra en los dos lados de su orientación

### Requirement: Variedad de árboles por semilla
El sistema SHALL pintar cada celda `trunk` con uno de los modelos de árbol de los datos de aspecto, elegido por una
función determinista de la semilla de la partida y de la celda. Elegir los modelos MUST NOT consumir el azar de la
partida ni el del mapa, MUST NOT cambiar el snapshot ni el mapa y no depende del tick, del número de frames pintados
ni de las partidas anteriores de la carga: la misma semilla y el mismo mapa dan siempre los mismos modelos.

#### Scenario: Mismos modelos con la misma semilla
- **GIVEN** el contenido por defecto, la semilla 42 y su mapa generado
- **WHEN** se calculan los modelos de sus celdas `trunk` dos veces, y una tercera tras pintar 600 frames y pulsar R
  con la misma semilla
- **THEN** las tres listas de modelos son iguales celda a celda

#### Scenario: Variedad dentro de un mapa
- **GIVEN** los datos de aspecto del repositorio (≥ 2 modelos de árbol) y el contenido por defecto
- **WHEN** se calculan los modelos de las celdas `trunk` del mapa de cada semilla de 1 a 50
- **THEN** en cada mapa se usan ≥ 2 modelos distintos

#### Scenario: Otra semilla, otros modelos
- **GIVEN** un mapa explícito de hierba con troncos en las 20 celdas de columnas 2–6 y filas 2–5
- **WHEN** se calculan sus modelos con la semilla 42 y con la semilla 43
- **THEN** las dos listas difieren en ≥ 1 celda

#### Scenario: La variedad no toca la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick
  y la política de elección fija, una con los datos de aspecto del repositorio y otra con un único modelo de árbol
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots y sus mapas son iguales campo a campo en cada tick

### Requirement: Capas del mapa y de las entidades
El sistema SHALL pintar, de abajo arriba: (1) el fondo; (2) el agua; (3) las orillas y la espuma; (4) los puentes;
(5) el tronco de cada árbol y la fachada del castillo; (6) cadáveres, gemas, pulsos, jugador, enemigos y proyectiles,
con su orden relativo de antes de este change; (7) las copas de los árboles y el tejado del castillo; (8) el HUD y los
overlays, fijos en pantalla (ver `world-camera`). La **copa** es la parte del dibujo del árbol situada por encima del
borde superior de su celda y el **tronco**, el resto. El **tejado** es la parte del dibujo del castillo situada por
encima del borde superior de la fila inferior de la huella y la **fachada**, el resto. Las partes se separan con un
error ≤ 1 px. Así, una entidad al sur de un árbol o ante la puerta se ve delante, y una que pasa detrás de una copa o
sobre el tejado queda tapada.

#### Scenario: Tronco y copa
- **GIVEN** un mapa de hierba con un tronco en (10, 4) (y en [240, 300]) y un snapshot con un enemigo en (630, 230)
- **WHEN** se pinta el snapshot
- **THEN** el tronco ocupa solo la parte del dibujo del árbol con y ≥ 240 y está por debajo del sprite del enemigo
- **AND** la copa ocupa solo la parte con y < 240 y está por encima del sprite del enemigo y por debajo del HUD

#### Scenario: Jugador ante la puerta
- **GIVEN** el contenido por defecto, la semilla 42 (huella en y [360, 600], fila inferior en y [540, 600]) y el
  jugador en (990, 616)
- **WHEN** se pinta el snapshot
- **THEN** la fachada (parte del dibujo con y ≥ 540) está por debajo del sprite del jugador y el tejado (y < 540) por
  encima
- **AND** el HUD y el overlay de pausa, si está abierto, están por encima del tejado

#### Scenario: Proyectiles y gemas bajo las copas
- **GIVEN** un mapa de hierba con un tronco en (10, 4) y un snapshot con 1 proyectil y 1 gema en (630, 220)
- **WHEN** se pinta el snapshot
- **THEN** la copa del árbol está por encima del sprite del proyectil y del de la gema, y el agua y los puentes por
  debajo de ambos

### Requirement: Baldosas del mapa a la escala de la celda
El sistema SHALL pintar las baldosas del fondo de hierba, del agua y de las orillas con un tamaño en pantalla igual a
`cellSize`: ancho de baldosa × escala = alto de baldosa × escala = `cellSize`, con error ≤ 0,001. Con las baldosas de
64 px del pack y `cellSize` 60 la escala es 0,9375. Unos datos de aspecto que no lo cumplan MUST hacer fallar el
arranque con un error que nombre la escala del aspecto, como el resto de datos inválidos. El dibujo del castillo con
los datos del repositorio MUST medir exactamente su huella: `castle.cols` × `cellSize` por `castle.rows` × `cellSize`
(300 × 240 px con el contenido por defecto), con error ≤ 1 px.

#### Scenario: Escala del repositorio
- **GIVEN** los datos de aspecto y el contenido del repositorio
- **WHEN** se carga el contenido
- **THEN** las baldosas del fondo, del agua y de las orillas miden 60 × 60 px en pantalla (64 × 0,9375)
- **AND** el dibujo del castillo mide 300 × 240 px

#### Scenario: Escala que no casa con la celda
- **GIVEN** los datos de aspecto del repositorio con la escala del fondo igual a 1, y en otro caso la del agua igual
  a 0,94
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra la escala del fondo y la del agua respectivamente
- **AND** no se muestra el menú ni empieza ninguna partida

### Requirement: Coste de render del mapa (a demanda)
El sistema SHALL pintar el mapa de las semillas 42 y 123 con ≤ 300 objetos de escena del mapa cada una (sin contar
fondo, entidades, HUD ni overlays), según informe la sonda de render. Con `CI_LIKE=1` (sin GPU, frenado 25, 1 worker,
mediana de 3 pasadas de la medición de fps del proyecto `realtime`), los fps con el mapa real de las semillas 42 y 123
SHOULD ser ≥ 85 % de la base de rectángulos de 0015 (21,6 y 21,9 fps: ≥ 18,4 y ≥ 18,6). Este requisito se mide a
demanda y es informativo: no bloquea `verify`, `test:e2e` ni CI; si no se cumple, se anota en el verify-report.

#### Scenario: Objetos del mapa [realtime]
- **GIVEN** la build de producción con `?e2e&manual&seed=42`, y en otra carga `seed=123`
- **WHEN** arranca la partida, se pinta 1 frame y se lee la sonda de render
- **THEN** el número de objetos de escena del mapa es ≤ 300 en ambas
- **AND** el mismo tope lo comprueba además un test sin navegador del plan de pintado con el contenido por defecto y
  las semillas 42 y 123, que entra en `verify`; este escenario `[realtime]` solo lo confirma con la sonda

#### Scenario: Fps con el mapa real [realtime]
- **GIVEN** `CI_LIKE=1` y la medición de fps del proyecto `realtime` con las semillas 42 y 123 y el mapa real
- **WHEN** se ejecutan 3 pasadas y se toma la mediana
- **THEN** se informa del fps de cada semilla y de su porcentaje sobre 21,6 y 21,9 fps respectivamente

## MODIFIED Requirements

### Requirement: Datos de aspecto validados
El sistema SHALL definir el aspecto de cada elemento pintado solo en datos, validados con zod en el arranque antes
de crear el menú o la partida, sin números mágicos en el código de render. Cada aspecto tiene:
- la hoja: ruta relativa dentro de la carpeta de assets versionada, no vacía, terminada en `.png`, sin segmentos
  `..`, sin `/` inicial y sin esquema (`http:`, `data:`, `blob:`…), que figura en la nota de procedencia (ver
  `asset-provenance`);
- el ancho y el alto del frame: enteros ≥ 1;
- la escala: número > 0, independiente del radio del elemento en el snapshot;
- el origen: `x` e `y` en [0, 1];
- la orientación del dibujo sin voltear: derecha o izquierda;
- las animaciones: cada una con una lista de ≥ 1 índices de frame enteros ≥ 0, unos fps > 0 y si va en bucle.

Animaciones obligatorias: `idle` y `walk` en el jugador y en cada tipo de enemigo; `death` sin bucle en el cadáver;
`idle` en el proyectil, la gema y el fondo. Los datos incluyen además el tope de cadáveres visibles a la vez (entero
≥ 1). Los tipos con aspecto MUST ser exactamente los `id` de `content/enemies.json`.

Los datos incluyen también los aspectos del mapa, cada uno con hoja, escala y origen con las reglas anteriores y,
según el elemento:
- **agua**: tamaño de baldosa y el índice de su frame;
- **orilla**: tamaño de baldosa y un índice de frame por cada uno de los 15 casos con ≥ 1 lado de río (ver
  "Orillas por autotile de 4 vecinos");
- **espuma**: tamaño de frame y la animación `idle` en bucle;
- **árbol**: tamaño de frame y una lista de ≥ 1 modelos, cada uno con su índice de frame;
- **puente**: un recorte por orientación (norte-sur y este-oeste), cada uno con `x` e `y` enteros ≥ 0 y ancho y alto
  enteros ≥ 1 en píxeles de la hoja (la hoja no es regular);
- **castillo**: tamaño de frame y el índice de su frame.

Un campo desconocido, un campo obligatorio ausente, un valor fuera de rango, un caso de orilla ausente o repetido, un
tipo de enemigo sin aspecto o un aspecto de un tipo inexistente MUST hacer fallar el arranque con un error que nombre
el campo, el caso o el id, igual que el resto del contenido inválido: no se muestra el menú ni empieza ninguna
partida. Los datos de aspecto MUST NOT cambiar la simulación.

#### Scenario: Datos del repositorio
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** los datos de aspecto son válidos, el tope de cadáveres vale 64 y hay aspecto para el jugador, el
  proyectil, la gema, el cadáver, el fondo y exactamente los tipos `goblin-torch`, `goblin-tnt` y `goblin-barrel`
- **AND** hay aspecto de agua, de orilla con los 15 casos, de espuma con `idle` de 8 frames en bucle, de árbol con
  ≥ 2 modelos, de puente con sus 2 recortes y de castillo

#### Scenario: Valores fuera de rango
- **GIVEN** los datos del repositorio con, en un caso cada vez en el aspecto de `goblin-torch`: ancho de frame 0,
  alto de frame 1,5, escala 0, escala −1, origen `x` 1,1, origen `y` −0,1, fps de `walk` 0, frames de `walk` `[]`,
  `[-1]` o `[1.5]`; y en otro caso el tope de cadáveres 0 o 2,5
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo

#### Scenario: Datos del mapa inválidos
- **GIVEN** los datos del repositorio con, en un caso cada vez: la orilla sin el caso { norte }; el árbol con la lista
  de modelos `[]`; el recorte norte-sur del puente con ancho 0, con `x` −1 o con `y` 2,5; la espuma sin `idle` o con
  `idle` sin bucle; el castillo sin hoja; o un campo extra `rocks` en los aspectos del mapa
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra el caso { norte }, la lista de modelos, el ancho, `x`, `y`, `idle`,
  `idle`, la hoja del castillo y `rocks` respectivamente
- **AND** no se muestra el menú ni empieza ninguna partida

#### Scenario: Rutas de hoja no admitidas
- **GIVEN** los datos del repositorio con la hoja de `goblin-torch` igual, en un caso cada vez, a `""`,
  `"../secreto.png"`, `"/torch.png"`, `"https://ejemplo.com/torch.png"`, `"data:image/png;base64,AAAA"`,
  `"torch.gif"` o una ruta `.png` que no figura en la nota de procedencia; y en otro caso la hoja del castillo igual a
  una ruta `.png` que no figura en la nota
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra la hoja de `goblin-torch`, y la del castillo respectivamente

#### Scenario: Animaciones obligatorias y campos desconocidos
- **GIVEN** los datos del repositorio con, en un caso cada vez: el jugador sin `walk`, `goblin-tnt` sin `idle`, el
  cadáver sin `death`, `death` del cadáver en bucle o un campo extra `rotation: 90` en el aspecto de la gema
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo

#### Scenario: Tipos de enemigo y aspectos desalineados
- **GIVEN** los datos del repositorio sin el aspecto de `goblin-barrel`, y en otro caso con un aspecto extra para
  `goblin-dragon`, con el contenido de enemigos por defecto
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `goblin-barrel`, y `goblin-dragon` respectivamente

#### Scenario: Datos inválidos en el arranque
- **GIVEN** unos datos de aspecto sin el aspecto del jugador, y en otro caso sin el aspecto del agua
- **WHEN** se ejecuta el arranque del juego, con y sin `?e2e`
- **THEN** en todos los casos no se crea el menú ni ninguna partida y la consola informa de un error que nombra el
  aspecto del jugador o el del agua (verificable sin navegador)

#### Scenario: Los aspectos no cambian la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick
  y la política de elección fija, una con los datos de aspecto del repositorio y otra con todas las escalas de los
  aspectos de entidades multiplicadas por 2 y los colores del mapa cambiados
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick

### Requirement: Arte de Tiny Swords Update 010 por elemento
El sistema SHALL pintar, con los datos de aspecto del repositorio, cada elemento con su hoja de Update 010:
- el jugador, con una hoja de la unidad Arquero (`Archer`);
- cada tipo de enemigo, con la hoja de su unidad goblin: `goblin-torch` con `Torch`, `goblin-tnt` con `TNT` y
  `goblin-barrel` con `Barrel`, tres hojas distintas;
- el cadáver, con `Dead.png`;
- el proyectil, con `Arrow.png`;
- la gema, con una hoja del pack;
- el fondo, con un suelo de hierba del pack;
- el agua, con `Water.png`; la espuma, con `Foam.png`; los árboles, con `Tree.png`; los puentes, con
  `Bridge_All.png`; el castillo, con `Castle_Blue.png` (castillo azul, como el arquero); la orilla, con una hoja de
  terreno del pack.

La unidad o el elemento de cada hoja se comprueba con la ruta de origen que registra la nota de procedencia (ver
`asset-provenance`). Del pack solo se versionan las hojas que usan los datos de aspecto (ningún otro color de castillo
ni `Rocks`). Cambiar el arte de un elemento MUST requerir solo cambios de datos y de assets, no de código.

#### Scenario: Hoja de cada elemento
- **GIVEN** los datos de aspecto del repositorio y la nota de procedencia
- **WHEN** se busca en la nota la ruta de origen de la hoja de cada aspecto
- **THEN** la del jugador contiene `Archer`; las de `goblin-torch`, `goblin-tnt` y `goblin-barrel` contienen
  `Torch`, `TNT` y `Barrel` respectivamente y son tres ficheros distintos; la del cadáver termina en `Dead.png` y la
  del proyectil en `Arrow.png`
- **AND** las del agua, la espuma, el árbol, el puente y el castillo terminan en `Water.png`, `Foam.png`, `Tree.png`,
  `Bridge_All.png` y `Castle_Blue.png` respectivamente
- **AND** todas las rutas de origen pertenecen a Tiny Swords Update 010

#### Scenario: Solo las hojas usadas
- **GIVEN** la lista de ficheros versionados y los datos de aspecto del repositorio
- **WHEN** se compara cada asset gráfico de la nota de procedencia con las hojas de los datos de aspecto
- **THEN** cada asset de la nota es la hoja de ≥ 1 aspecto y ningún fichero versionado contiene `Castle_Red`,
  `Castle_Yellow`, `Castle_Purple`, `Castle_Black` ni `Rocks`

#### Scenario: Partida con arte
- **GIVEN** la build de producción servida con `?e2e&seed=42`
- **WHEN** termina la carga y se pintan 600 frames
- **THEN** en cada frame la sonda informa de 1 sprite de fondo, de 0 sprites con aspecto de reserva y de un sprite
  de jugador visible salvo en los frames en que el parpadeo lo oculta (ver `player-health`)
- **AND** en algún frame hay ≥ 1 enemigo, ≥ 1 proyectil y ≥ 1 gema visibles, todos con su hoja

### Requirement: Aspecto de reserva ante un fallo de carga
El sistema SHALL, si la hoja de un aspecto falla al cargar o no contiene algún frame referenciado por sus animaciones,
pintar los elementos de ese aspecto con su aspecto de reserva: una forma rellena centrada en la posición del elemento
y de diámetro 2 × el radio del elemento en el snapshot, sin volteo ni rotación (en el fondo, un relleno liso del mundo
entero, (0, 0)–(ancho, alto) en coordenadas de mundo). El fallo MUST NOT romper la partida ni producir errores no
capturados, y los aspectos cuya hoja carga bien siguen con su arte. El aspecto de reserva conserva el resto del
comportamiento de esta spec (duración del cadáver, parpadeo e indicación de daño) y MUST NOT depender de ficheros ni
de recursos `blob:`. Los elementos del mapa tienen su propia reserva por colores (ver "Pintado del mapa"): no cuentan
como sprites con aspecto de reserva y no dependen de la hoja del fondo, salvo la orilla si su hoja es la del fondo.

#### Scenario: Hoja que no carga
- **GIVEN** la build de producción con `?e2e&seed=42` y una prueba que hace fallar la petición de la hoja de
  `goblin-torch`
- **WHEN** termina la carga y se pintan 600 frames
- **THEN** la sonda informa de que todos los sprites de `goblin-torch` usan aspecto de reserva y ningún sprite de
  otro aspecto lo usa
- **AND** la partida sigue avanzando (tick 600) y no hay errores no capturados

#### Scenario: Frame fuera de la hoja
- **GIVEN** un aspecto de `goblin-tnt` con frame de 32 × 32 px, una hoja de 128 × 32 px (frames 0 a 3) y `walk` con
  frames `[0, 1, 2, 7]`
- **WHEN** se pinta un `goblin-tnt`
- **THEN** se pinta con su aspecto de reserva y no hay errores no capturados

#### Scenario: Tamaño del aspecto de reserva
- **GIVEN** la hoja de `goblin-torch` sin cargar y un `goblin-torch` de radio 10 en (300, 200)
- **WHEN** se pinta el snapshot
- **THEN** su sprite es una forma de 20 px de diámetro centrada en (300, 200) (error ≤ 0,001)

#### Scenario: Fondo de reserva en el mundo entero
- **GIVEN** la build de producción con `?e2e&map=empty&seed=7`, una prueba que hace fallar la petición de la hoja del
  fondo y un input que lleva al jugador a las cuatro esquinas del mundo
- **WHEN** se pintan los frames hasta que el jugador ha tocado las cuatro esquinas
- **THEN** la sonda informa de que el fondo usa aspecto de reserva y en cada frame el rectángulo visible de la cámara
  está entero dentro del rectángulo de mundo que cubre ese relleno, (0, 0)–(1.920, 1.080)
- **AND** no hay errores no capturados

### Requirement: Sonda de render para E2E
El sistema SHALL exponer, solo con `?e2e` y como parte de la sonda `window.__sprint`, en el último frame pintado:
- el recuento de sprites visibles por tipo: fondo, jugador, enemigo vivo, cadáver, proyectil, pulso y gema; y por
  tipo y por aspecto de enemigo, cuántos usan aspecto de reserva;
- el número de celdas del mapa pintadas por tipo (`trunk`, `water`, `bridge`, `castle`), con arte o con reserva;
- por elemento del mapa, cuántos se pintan y cuántos de ellos con reserva: agua (celdas `water`), orilla (celdas de
  orilla con su pieza), espuma (celdas de orilla con espuma), árbol (celdas `trunk`), copa (árboles con copa), puente
  (celdas `bridge`) y castillo (0 o 1);
- el número de objetos de escena usados para pintar el mapa.

Un sprite oculto por el parpadeo cuenta como no visible. En modo menú los recuentos de jugador, enemigo, cadáver,
proyectil, pulso, gema, celdas del mapa, elementos del mapa y objetos del mapa valen 0. Sin `?e2e` MUST NOT existir.
Leer la sonda MUST NOT cambiar la simulación ni lo que se pinta.

#### Scenario: Recuento coherente con el snapshot
- **GIVEN** `?e2e&seed=42` y una partida en curso
- **WHEN** se pintan 600 frames y en cada uno se leen la sonda de render y el snapshot pintado
- **THEN** en cada frame los sprites visibles de enemigo, proyectil, pulso y gema son iguales en número a los
  enemigos, proyectiles, pulsos y gemas del snapshot, y el de jugador vale 1 salvo en los frames en que el parpadeo
  lo oculta, que vale 0
- **AND** el recuento de cadáveres es ≤ 64 en todos
- **AND** las celdas del mapa pintadas por tipo son las mismas en los 600 frames e iguales a los recuentos del mapa
  de la sonda

#### Scenario: Sonda en el menú
- **GIVEN** `?e2e&seed=42` y el menú tras `Volver al menú`
- **WHEN** se pinta 1 frame y se lee la sonda de render
- **THEN** los recuentos de jugador, enemigo, cadáver, proyectil, pulso, gema, celdas del mapa, elementos del mapa y
  objetos del mapa valen 0

#### Scenario: Sin sonda fuera de E2E
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga y se pulsa `Jugar`
- **THEN** `window.__sprint` es `undefined`

### Requirement: Pintado del mapa
El sistema SHALL pintar, mientras existe una partida, los elementos de su mapa (ver `procedural-map`) con el arte de
los datos de aspecto, fijos en el mundo como el fondo y en las capas de "Capas del mapa y de las entidades":
- **agua**: cubre el rectángulo de mundo de cada celda `water` y de cada celda `bridge` (error ≤ 1 px); puede
  extenderse bajo las celdas de orilla, tapada por su pieza, pero no bajo una celda de tierra que no sea de orilla;
- **orilla y espuma**: cada celda de orilla (ver "Orillas por autotile de 4 vecinos") muestra, sobre su celda de
  tierra, la pieza de orilla de su caso, y la espuma en su borde con el río, bajo la pieza, que reproduce en bucle su
  animación `idle` en tiempo de render;
- **árbol**: cada celda `trunk` muestra un árbol del modelo de su celda (ver "Variedad de árboles por semilla") con
  su origen en el punto medio del borde inferior de la celda (error ≤ 1 px);
- **puente**: cada celda `bridge` muestra el recorte de su orientación (ver "Orientación de los puentes") centrado en
  la celda (error ≤ 1 px);
- **castillo**: la huella muestra un castillo con su origen en el punto medio del borde inferior de la huella
  (error ≤ 1 px). Un mapa explícito no tiene huella: sus celdas `castle`, si las hay, se pintan siempre como
  rectángulos del color `castle` que cubren cada celda.

**Reserva por elemento**: si la hoja de un elemento del mapa falla al cargar o no contiene su frame o su recorte,
ese elemento, y solo ese, se pinta así, sin errores no capturados: agua, árbol y puente, como un rectángulo relleno
que cubre exactamente cada celda `water`, `trunk` o `bridge` (error ≤ 1 px) con el color de su tipo, y el árbol sin
copa; castillo, como un rectángulo relleno del color `castle` que cubre exactamente la huella; orilla y espuma no se
pintan. Los colores viven en los datos de aspecto, uno por tipo (`trunk`, `water`, `bridge`, `castle`), en formato
`#RRGGBB`, y son distintos dos a dos; se validan con zod en el arranque como el resto de datos de aspecto: un color
ausente, con otro formato, repetido o de un tipo desconocido MUST hacer fallar el arranque con un error que nombre el
campo. El pintado del mapa no cuenta como sprite de fondo ni como aspecto de reserva de sprites y MUST NOT cambiar la
simulación; ningún requisito depende del frame de la espuma.

Al empezar una partida nueva (R o `Volver al menú` + `Jugar`) se pinta su mapa y no queda visible ningún elemento del
mapa anterior. En modo menú no se ve ningún elemento del mapa. Con el mapa vacío no se pinta ningún elemento del mapa.

#### Scenario: Colores del repositorio
- **GIVEN** los datos de aspecto del repositorio
- **WHEN** se carga el contenido
- **THEN** hay un color `#RRGGBB` para `trunk`, `water`, `bridge` y `castle`, y los cuatro son distintos

#### Scenario: Colores inválidos
- **GIVEN** los datos de aspecto del repositorio con, en un caso cada vez: el color de `water` igual a `"#12345"`,
  `"blue"` o `"#GGGGGG"`; sin el color de `bridge`; sin el color de `castle`; el color de `bridge` igual al de
  `trunk`; o un color extra para `lava`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `water`, `bridge`, `castle`, `bridge` y `lava` respectivamente
- **AND** no se muestra el menú ni empieza ninguna partida

#### Scenario: Elementos en su sitio
- **GIVEN** un mapa de hierba con un tronco en (10, 4), la celda (4, 3) `water` y la (16, 9) `bridge` con agua en
  (15, 9) y (17, 9), con la rejilla por defecto y todas las hojas cargadas
- **WHEN** se pinta el snapshot
- **THEN** el origen del árbol está en (630, 300), el agua cubre (240, 180)–(300, 240), (900, 540)–(960, 600),
  (960, 540)–(1.020, 600) y (1.020, 540)–(1.080, 600), y el puente está centrado en (990, 570) (error ≤ 1 px)

#### Scenario: Castillo sobre su huella
- **GIVEN** el contenido por defecto, la semilla 42 y los datos de aspecto del repositorio
- **WHEN** se pinta el snapshot del tick 0
- **THEN** el dibujo del castillo tiene su origen en (990, 600) y cubre (840, 360)–(1.140, 600) (error ≤ 1 px)
- **AND** con el mapa vacío no hay castillo pintado

#### Scenario: Reserva de cada elemento
- **GIVEN** el mapa del escenario "Elementos en su sitio" y, en un caso cada vez, sin cargar la hoja del agua, la del
  árbol, la del puente, la de la espuma o la de la orilla
- **WHEN** se pinta el snapshot
- **THEN** respectivamente: el agua son 3 rectángulos del color `water` sobre (240, 180)–(300, 240),
  (900, 540)–(960, 600) y (1.020, 540)–(1.080, 600); el árbol es 1 rectángulo del color `trunk` sobre
  (600, 240)–(660, 300) y no hay copa; el puente es 1 rectángulo del color `bridge` sobre (960, 540)–(1.020, 600); no
  hay espuma; no hay orillas
- **AND** en cada caso los demás elementos se pintan con su arte y no hay errores no capturados

#### Scenario: Reserva del castillo
- **GIVEN** el contenido por defecto, la semilla 42 y la hoja del castillo sin cargar
- **WHEN** se pinta el snapshot del tick 0
- **THEN** el castillo es 1 rectángulo del color `castle` que cubre (840, 360)–(1.140, 600) (error ≤ 1 px), sin
  tejado, y los demás elementos del mapa se pintan con su arte

#### Scenario: Celdas de castillo de un mapa explícito
- **GIVEN** un mapa explícito de hierba con la celda (3, 3) `castle` (sin huella: ver `procedural-map`)
- **WHEN** se pinta el snapshot
- **THEN** hay 1 rectángulo del color `castle` sobre (180, 180)–(240, 240), ningún dibujo de castillo y la sonda
  informa de 1 celda `castle` pintada y castillo 0

#### Scenario: Recorte del puente fuera de la hoja
- **GIVEN** un recorte norte-sur del puente con `x` 400 y ancho 64 sobre una hoja de 384 px de ancho
- **WHEN** se pinta un mapa con un puente norte-sur
- **THEN** ese puente se pinta con el rectángulo del color `bridge` y no hay errores no capturados

#### Scenario: Recuentos del mapa pintado [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` (mapa real)
- **WHEN** arranca la partida, se pinta 1 frame y se leen la sonda de render y la del mapa
- **THEN** las celdas pintadas de `trunk`, `water`, `bridge` y `castle` son iguales a los recuentos de esos tipos en
  el mapa de la sonda (`castle` 20)
- **AND** el agua y el puente pintados son iguales a los recuentos de `water` y `bridge`; árbol y copa, al de `trunk`;
  orilla y espuma, al número de celdas `grass`, `trunk` o `castle` del mapa de la sonda con ≥ 1 vecina 4-conexa
  `water` o `bridge` dentro de la rejilla; castillo, 1
- **AND** ningún elemento del mapa usa reserva

#### Scenario: Hojas del mapa bloqueadas [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` y una prueba que hace fallar las peticiones de
  `Water.png`, `Foam.png`, `Tree.png`, `Bridge_All.png` y `Castle_Blue.png`
- **WHEN** arranca la partida, se llama a `step(60)` y se leen la sonda de render y la del mapa
- **THEN** agua, árbol y puente se pintan todos con reserva, en número igual a los recuentos de `water`, `trunk` y
  `bridge` del mapa; el castillo, 1 con reserva; espuma y copa, 0
- **AND** la partida está en el tick 60, los sprites de entidades cuya hoja no se bloquea no usan aspecto de reserva
  y no hay errores no capturados

#### Scenario: Mapa vacío
- **GIVEN** la build de producción con `?e2e&map=empty&seed=42`
- **WHEN** se pinta 1 frame de la partida
- **THEN** la sonda informa de 0 celdas pintadas de cada tipo, 0 elementos del mapa y 1 sprite de fondo

#### Scenario: Partida nueva con otro mapa
- **GIVEN** la build de producción con `?e2e&manual&seed=42` y la partida terminada
- **WHEN** se pulsa R y se pinta el primer frame de la partida nueva
- **THEN** las celdas pintadas por tipo coinciden con los recuentos del mapa de la partida nueva en la sonda

#### Scenario: Mapa sobre el fondo de reserva
- **GIVEN** la build de producción con `?e2e&manual&seed=42` y una prueba que hace fallar la petición de la hoja del
  fondo
- **WHEN** arranca la partida y se pinta 1 frame
- **THEN** el fondo usa aspecto de reserva, las celdas pintadas por tipo coinciden con el mapa de la sonda y no hay
  errores no capturados
