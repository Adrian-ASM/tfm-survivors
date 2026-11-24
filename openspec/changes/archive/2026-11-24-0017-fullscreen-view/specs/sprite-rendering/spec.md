# Spec delta · sprite-rendering

<!-- Change 0017-fullscreen-view. Mundo por defecto de 3.840 × 2.160; huella del castillo en x [1.800, 2.100],
     y [900, 1.140] (fila inferior en y [1.080, 1.140]); salida (1.950, 1.170). Tope de objetos del mapa 1.000
     (decisión del gate humano; medidos 667 y 750 en las semillas 42 y 123). -->

## MODIFIED Requirements

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
- **GIVEN** la build de producción con `?e2e&manual&map=empty&seed=7` en una ventana de 1.280 × 720, una prueba que
  hace fallar la petición de la hoja del fondo y un input que lleva al jugador a las cuatro esquinas del mundo
- **WHEN** se avanza con `step(n)` hasta que el jugador ha tocado las cuatro esquinas, leyendo la sonda tras cada
  llamada
- **THEN** la sonda informa de que el fondo usa aspecto de reserva y en cada lectura el rectángulo visible de la
  cámara está entero dentro del rectángulo de mundo que cubre ese relleno, (0, 0)–(3.840, 2.160)
- **AND** no hay errores no capturados

### Requirement: Proyectiles, gemas, pulso y fondo
El sistema SHALL pintar un sprite de flecha por cada proyectil del snapshot y un sprite de gema por cada gema, en su
posición (error ≤ 0,001) y con el aspecto del repositorio, ambos en `idle`. El pulso de Tests no usa datos de
aspecto: conserva su anillo (ver `auto-weapons`). Mientras existe una partida, el fondo de hierba MUST cubrir el mundo
entero, (0, 0)–(ancho, alto) en coordenadas de mundo ((0, 0)–(3.840, 2.160) con el contenido por defecto), quedar por
debajo de todos los demás elementos, incluidas las celdas pintadas del mapa, y estar fijo en el mundo: su posición de
mundo no cambia entre snapshots ni al redimensionar la ventana y su posición en pantalla solo cambia con el
rectángulo visible de la cámara (ver `world-camera`). En ningún frame de una partida, con ninguna ventana, MUST verse
dentro del rectángulo visible una zona sin fondo. Esta spec no fija si el fondo se ve en modo menú.

#### Scenario: Flechas y gemas
- **GIVEN** un snapshot con 3 proyectiles y 4 gemas
- **WHEN** se pinta el snapshot
- **THEN** hay 3 sprites de proyectil con el aspecto del proyectil y 4 de gema con el aspecto de la gema, cada uno
  en la posición de un elemento distinto del snapshot

#### Scenario: Pulso sin sprite
- **GIVEN** un snapshot con 1 pulso de radio 90 en (480, 270)
- **WHEN** se pinta el snapshot
- **THEN** hay 1 anillo de radio 90 centrado en (480, 270) y ningún sprite de hoja para el pulso

#### Scenario: Fondo de hierba en el mundo entero
- **GIVEN** el mundo por defecto y una partida en curso con el jugador en (1.920, 1.080) y, después, en (100, 100)
- **WHEN** se pinta cada snapshot
- **THEN** en ambos el fondo cubre el rectángulo de mundo (0, 0)–(3.840, 2.160), está por debajo de las celdas
  pintadas del mapa, el jugador, los enemigos, los cadáveres, los proyectiles, los pulsos y las gemas, y su posición
  de mundo es la misma

#### Scenario: Fondo con la ventana en el tope
- **GIVEN** el mundo por defecto, una ventana de 3.840 × 2.160 (vista 2.560 × 1.440) y el jugador en (16, 16) y
  después en (3.824, 2.144)
- **WHEN** se pinta cada snapshot
- **THEN** en ambos el rectángulo visible está entero dentro del rectángulo que cubre el fondo y no se ve ninguna zona
  sin fondo dentro de la vista

#### Scenario: Fondo en las cuatro esquinas
- **GIVEN** la build de producción con `?e2e&manual&map=empty&seed=7` en una ventana de 1.280 × 720 y un input que
  lleva al jugador a las cuatro esquinas del mundo
- **WHEN** se avanza con `step(n)` hasta que el jugador ha tocado las cuatro esquinas, leyendo la sonda tras cada
  llamada
- **THEN** en cada lectura el rectángulo visible de la cámara está entero dentro del rectángulo que cubre el fondo y
  la sonda informa de fondo visible

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
simulación; ningún requisito depende del frame de la espuma. Redimensionar la ventana MUST NOT cambiar qué elemento
corresponde a cada celda, su modelo ni su posición de mundo.

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
- **THEN** el dibujo del castillo tiene su origen en (1.950, 1.140) y cubre (1.800, 900)–(2.100, 1.140) (error
  ≤ 1 px)
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
- **THEN** el castillo es 1 rectángulo del color `castle` que cubre (1.800, 900)–(2.100, 1.140) (error ≤ 1 px), sin
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

#### Scenario: Mapa intacto al redimensionar
- **GIVEN** una partida con el contenido por defecto y la semilla 42 pintada con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 2.560 × 1.440 y se pinta 1 frame
- **THEN** cada elemento del mapa de las celdas visibles en ambos frames tiene el mismo modelo y la misma posición de
  mundo que antes del cambio (error ≤ 1 px), y el número de objetos de escena del mapa sigue ≤ 1.000

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

### Requirement: Capas del mapa y de las entidades
El sistema SHALL pintar, de abajo arriba: (1) el fondo; (2) el agua; (3) las orillas y la espuma; (4) los puentes;
(5) el tronco de cada árbol y la fachada del castillo; (6) cadáveres, gemas, pulsos, jugador, enemigos y proyectiles,
con su orden relativo de antes de este change; (7) las copas de los árboles y el tejado del castillo; (8) el HUD y los
overlays, fijos en pantalla (ver `world-camera`). La **copa** es la parte del dibujo del árbol situada por encima del
borde superior de su celda y el **tronco**, el resto. El **tejado** es la parte del dibujo del castillo situada por
encima del borde superior de la fila inferior de la huella y la **fachada**, el resto. Las partes se separan con un
error ≤ 1 px. Así, una entidad al sur de un árbol o ante la puerta se ve delante, y una que pasa detrás de una copa o
sobre el tejado queda tapada. El orden de capas MUST mantenerse tras cualquier redimensionado de la ventana.

#### Scenario: Tronco y copa
- **GIVEN** un mapa de hierba con un tronco en (10, 4) (y en [240, 300]) y un snapshot con un enemigo en (630, 230)
- **WHEN** se pinta el snapshot
- **THEN** el tronco ocupa solo la parte del dibujo del árbol con y ≥ 240 y está por debajo del sprite del enemigo
- **AND** la copa ocupa solo la parte con y < 240 y está por encima del sprite del enemigo y por debajo del HUD

#### Scenario: Jugador ante la puerta
- **GIVEN** el contenido por defecto, la semilla 42 (huella en y [900, 1.140], fila inferior en y [1.080, 1.140]) y el
  jugador en (1.950, 1.156)
- **WHEN** se pinta el snapshot
- **THEN** la fachada (parte del dibujo con y ≥ 1.080) está por debajo del sprite del jugador y el tejado
  (y < 1.080) por encima
- **AND** el HUD y el overlay de pausa, si está abierto, están por encima del tejado

#### Scenario: Proyectiles y gemas bajo las copas
- **GIVEN** un mapa de hierba con un tronco en (10, 4) y un snapshot con 1 proyectil y 1 gema en (630, 220)
- **WHEN** se pinta el snapshot
- **THEN** la copa del árbol está por encima del sprite del proyectil y del de la gema, y el agua y los puentes por
  debajo de ambos

#### Scenario: Capas tras redimensionar
- **GIVEN** el escenario "Jugador ante la puerta" pintado con una ventana de 1.280 × 720 y el overlay de pausa abierto
- **WHEN** la ventana pasa a 960 × 540 y se pinta 1 frame
- **THEN** la fachada sigue por debajo del jugador, el tejado por encima, y el HUD y el overlay de pausa por encima
  del tejado

### Requirement: Coste de render del mapa (a demanda)
El sistema SHALL pintar el mapa de las semillas 42 y 123 con ≤ 1.000 objetos de escena del mapa cada una (sin contar
fondo, entidades, HUD ni overlays), según informe la sonda de render. Con `CI_LIKE=1` (sin GPU, frenado 25, 1 worker,
mediana de 3 pasadas de la medición de fps del proyecto `realtime`, ventana de 1.280 × 720), se informa de los fps con
el mapa real de las semillas 42 y 123 y de su porcentaje sobre la base de rectángulos de 0015 (21,6 y 21,9 fps); el
objetivo orientativo SHOULD ser ≥ 85 % (≥ 18,4 y ≥ 18,6). Este requisito se mide a demanda y es informativo: no
bloquea `verify`, `test:e2e` ni CI; si no se cumple, se anota en el verify-report.

#### Scenario: Objetos del mapa [realtime]
- **GIVEN** la build de producción con `?e2e&manual&seed=42`, y en otra carga `seed=123`
- **WHEN** arranca la partida, se pinta 1 frame y se lee la sonda de render
- **THEN** el número de objetos de escena del mapa es ≤ 1.000 en ambas
- **AND** el mismo tope lo comprueba además un test sin navegador del plan de pintado con el contenido por defecto y
  las semillas 42 y 123, que entra en `verify`; este escenario `[realtime]` solo lo confirma con la sonda

#### Scenario: Fps con el mapa real [realtime]
- **GIVEN** `CI_LIKE=1` y la medición de fps del proyecto `realtime` con las semillas 42 y 123 y el mapa real
- **WHEN** se ejecutan 3 pasadas y se toma la mediana
- **THEN** se informa del fps de cada semilla y de su porcentaje sobre 21,6 y 21,9 fps respectivamente

<!-- historial: 0017-fullscreen-view (pendiente de archivar) -->
