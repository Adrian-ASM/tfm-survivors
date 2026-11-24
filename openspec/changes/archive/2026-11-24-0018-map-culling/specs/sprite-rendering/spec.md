# Spec delta · sprite-rendering

<!-- Ruta: openspec/changes/0018-map-culling/specs/sprite-rendering/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Cada escenario lleva su cobertura según la regla e2e-lite (AGENTS.md §2): unitario por defecto; como máximo se
     amplía el E2E existente "Cámara" de tests/e2e/gameplay.spec.ts (0 E2E nuevos). Sin umbrales de fps ni de tiempo.
     world-camera y procedural-map no cambian: este delta solo usa su "rectángulo visible" y su mapa. -->

## ADDED Requirements

### Requirement: Recorte del arte del mapa por cámara
Mientras existe una partida, el sistema SHALL **dibujar** en cada frame solo los objetos de escena del mapa (los que
cuenta la sonda como objetos del mapa, de las dos capas: agua, orillas, espuma, troncos, copas, puentes, fachada y
tejado del castillo, y los rectángulos de reserva de cualquiera de ellos) cuya **caja** intersecta el **rectángulo de
recorte** de ese frame, y MUST NOT dibujar ninguno más. Definiciones:
- **caja** de un objeto: el rectángulo de mundo que ocupa su dibujo (posición, origen, escala y recorte incluidos),
  con error ≤ 1 px; no cambia mientras dura la partida;
- **rectángulo de recorte**: el rectángulo visible de la cámara de **ese mismo frame** (ver "Cámara que sigue al
  jugador dentro del mundo" en `world-camera`, ya recortado al mundo y con el tamaño de ventana de ese frame) ampliado
  M px por cada lado. El margen M es ≥ 0, es el mismo para todos los objetos y no depende del snapshot; puede depender
  del tamaño de la vista (su valor lo fija el diseño);
- **intersecta**: la caja y el rectángulo de recorte comparten al menos un punto, bordes incluidos (una caja que solo
  toca el borde se dibuja).

Recortar MUST NOT cambiar la simulación, el plan del mapa (qué elemento, modelo, posición, capa y orden corresponde a
cada celda) ni los recuentos totales de la sonda (ver "Sonda de render para E2E").

#### Scenario: Objeto dentro, fuera y en parte
- **GIVEN** el mundo por defecto, una ventana de 1.280 × 720, el jugador en (1.920, 1.080) (rectángulo visible
  (1.280, 720)–(2.560, 1.440)), M = 60 y tres objetos con cajas A (1.500, 900)–(1.560, 960),
  B (100, 100)–(160, 160) y C (0, 1.000)–(3.840, 1.060) (un tramo de agua de punta a punta)
- **WHEN** se aplica la regla de recorte
- **THEN** se dibujan A y C y no se dibuja B
- **Cobertura**: unitario (regla pura).

#### Scenario: Caja que toca el borde
- **GIVEN** el rectángulo visible (1.280, 720)–(2.560, 1.440) y, en un caso cada vez, M = 0 con cajas
  D (2.560, 800)–(2.620, 860) y E (2.561, 800)–(2.621, 860), y M = 60 con cajas F (2.620, 800)–(2.680, 860) y
  G (2.621, 800)–(2.681, 860)
- **WHEN** se aplica la regla de recorte
- **THEN** se dibujan D y F y no se dibujan E ni G
- **AND** lo mismo ocurre, con las cajas reflejadas, en los bordes izquierdo, superior e inferior
- **Cobertura**: unitario (regla pura).

#### Scenario: Vista que crece con la ventana
- **GIVEN** el mundo por defecto, el jugador en (1.920, 1.080), M = 60 y una caja H (2.700, 800)–(2.760, 860)
- **WHEN** se aplica la regla con una ventana de 1.280 × 720 (rectángulo visible (1.280, 720)–(2.560, 1.440)) y
  después con una de 3.840 × 2.160 (vista 2.560 × 1.440, rectángulo visible (640, 360)–(3.200, 1.800))
- **THEN** H no se dibuja con la primera y sí con la segunda
- **AND** con una ventana de 960 × 540 (rectángulo visible (1.440, 810)–(2.400, 1.350)) H no se dibuja y la caja
  A (1.500, 900)–(1.560, 960) sí
- **Cobertura**: unitario (regla pura con los rectángulos de `world-camera`).

#### Scenario: Vista recortada al mundo en una esquina
- **GIVEN** el mundo por defecto, una ventana de 1.280 × 720, el jugador en (16, 16) (rectángulo visible
  (0, 0)–(1.280, 720), no (−624, −344)–(656, 376)), M = 60 y las cajas I (1.300, 100)–(1.360, 160) y
  J (1.341, 100)–(1.400, 160)
- **WHEN** se aplica la regla de recorte
- **THEN** se dibuja I y no se dibuja J
- **AND** con el jugador en (3.824, 2.144) (rectángulo visible (2.560, 1.440)–(3.840, 2.160)) se dibuja la caja
  (2.440, 1.320)–(2.500, 1.380) (toca la esquina del rectángulo de recorte) y no la (2.439, 1.319)–(2.499, 1.379)
- **Cobertura**: unitario (regla pura).

#### Scenario: Partes del castillo por separado
- **GIVEN** el contenido por defecto, la semilla 42 (dibujo del castillo (1.800, 900)–(2.100, 1.140): tejado
  (1.800, 900)–(2.100, 1.080) y fachada (1.800, 1.080)–(2.100, 1.140)), M el del juego y un rectángulo visible de
  1.280 × 720 con x en [1.280, 2.560] cuyo borde inferior está en y = 1.080 − M − 1, y en otro caso en y = 900 − M
  (si M > 179 el caso se construye con la misma regla y un rectángulo de recorte equivalente, sin cámara)
- **WHEN** se aplica la regla de recorte al plan del mapa
- **THEN** en el primer caso se dibuja el tejado y no la fachada; en el segundo se dibuja el tejado (toca el borde) y
  no la fachada
- **AND** con el borde inferior en y = 900 − M − 1 no se dibuja ninguna de las dos partes
- **Cobertura**: unitario (plan del mapa sin motor + regla).

#### Scenario: Todo el plan se puede ver
- **GIVEN** el contenido por defecto, las semillas 42 y 123, M el del juego y las ventanas de 960 × 540, 1.280 × 720
  y 3.840 × 2.160
- **WHEN** se aplica la regla con el rectángulo visible de cada posición del jugador de una rejilla de paso 60 px que
  cubre el mundo, (0, 0)–(3.840, 2.160) con ambos extremos incluidos
- **THEN** para cada semilla y ventana, la unión de los objetos dibujados es el plan entero (ningún objeto queda sin
  dibujarse en todas las posiciones) y cada caja intersecta el mundo
- **Cobertura**: unitario (plan del mapa sin motor + regla).

#### Scenario: Vista que cubre el mundo entero
- **GIVEN** un mundo de 2.560 × 1.440 con un mapa de ≥ 1 objeto, una ventana de 2.560 × 1.440 y el jugador en
  (16, 16)
- **WHEN** se aplica la regla de recorte
- **THEN** se dibujan todos los objetos del plan
- **Cobertura**: unitario (regla pura).

### Requirement: El recorte no cambia lo que se ve
El sistema SHALL mostrar dentro del rectángulo visible de cada frame exactamente el mismo arte del mapa que sin
recorte: todo objeto cuya caja intersecta el rectángulo visible (sin margen) MUST dibujarse en ese mismo frame, con la
capa, el orden dentro de la capa, la posición, el recorte, el modelo y el aspecto (arte o reserva) que le da el plan
(ver "Pintado del mapa" y "Capas del mapa y de las entidades"). En particular MUST NOT verse en ningún frame un hueco
en el borde de la vista mientras la cámara se mueve, ni un objeto que aparece un frame tarde. Una espuma que vuelve a
dibujarse MUST mostrar, desde su primer frame dibujado, el mismo frame de la animación `idle` que las espumas que
siguieron dibujadas (todas las espumas van sincronizadas).

#### Scenario: Movimiento continuo sin huecos
- **GIVEN** el contenido por defecto, la semilla 42, una ventana de 1.280 × 720 y una secuencia de 600 snapshots en
  que el jugador se mueve a 215 px/s hacia la derecha y después hacia abajo, a 1 tick por frame
- **WHEN** se pinta cada snapshot
- **THEN** en cada frame todo objeto del plan cuya caja intersecta el rectángulo visible de ese frame está dibujado
- **AND** los objetos dibujados conservan la capa y el orden relativo del plan
- **Cobertura**: unitario (vista del mapa con lienzo falso, sin motor).

#### Scenario: Salto de varios ticks en un frame
- **GIVEN** el escenario anterior a 15 ticks por frame (`speed` máxima)
- **WHEN** se pinta cada snapshot
- **THEN** en cada frame todo objeto del plan cuya caja intersecta el rectángulo visible de ese frame está dibujado
- **Cobertura**: unitario (vista del mapa con lienzo falso).

#### Scenario: Espuma al reaparecer
- **GIVEN** una espuma S dibujada en el frame f, que deja de dibujarse en el f + 1 porque la cámara se aleja, mientras
  las demás espumas dibujadas avanzan su animación, y que vuelve a dibujarse en el frame f + 40
- **WHEN** se pinta el frame f + 40
- **THEN** S muestra el mismo frame de `idle` que las espumas que siguieron dibujadas en f + 40
- **Cobertura**: unitario (vista del mapa con lienzo falso).

#### Scenario: Pausa, oferta y partida terminada
- **GIVEN** una partida con el mapa real en pausa en el tick 500, después con una oferta abierta y después terminada
- **WHEN** se pintan 300 frames en cada estado
- **THEN** en cada estado el conjunto de objetos dibujados es el mismo en los 300 frames (la cámara no se mueve)
- **Cobertura**: unitario (vista del mapa con lienzo falso).

### Requirement: Recorte al cambiar de partida, de ventana y de modo
El sistema SHALL recalcular qué objetos del mapa se dibujan en el **primer** frame de cada uno de estos casos, sin
heredar nada del frame anterior: al empezar la primera partida, tras R, tras `Volver al menú` + `Jugar` y tras cada
redimensionado de la ventana. En ese primer frame el conjunto dibujado MUST ser el que da "Recorte del arte del mapa
por cámara" con el plan del mapa de la partida en curso y el rectángulo visible de ese frame, y MUST NOT dibujarse
ningún objeto de un mapa anterior. En modo menú MUST NOT dibujarse ningún objeto del mapa. Con el mapa vacío no se
dibuja ninguno.

#### Scenario: R tras acabar en una esquina
- **GIVEN** una partida con el mapa real de la semilla 42 terminada con el jugador en (3.824, 2.144) y una ventana de
  1.280 × 720
- **WHEN** se pulsa R (partida nueva con la semilla 43) y se pinta su primer frame
- **THEN** los objetos dibujados son exactamente los del plan de la semilla 43 que da la regla con el rectángulo
  visible de ese frame, y ninguno de los dibujados en el último frame de la partida anterior queda dibujado si no lo
  está en el nuevo conjunto
- **Cobertura**: unitario (vista del mapa con lienzo falso; reutilización de objetos entre partidas).

#### Scenario: Redimensionado
- **GIVEN** una partida con el mapa real de la semilla 42, el jugador en (1.920, 1.080) y una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 3.840 × 2.160 y se pinta 1 frame, y después vuelve a 960 × 540 y se pinta 1 frame
- **THEN** en cada uno de esos frames los objetos dibujados son los que da la regla con el rectángulo visible de ese
  frame ((640, 360)–(3.200, 1.800) y (1.440, 810)–(2.400, 1.350) respectivamente)
- **AND** el número de objetos dibujados en el primero es ≥ el del frame anterior al cambio y en el segundo, ≤
- **Cobertura**: unitario (vista del mapa con lienzo falso + rectángulos de `world-camera`).

#### Scenario: Volver al menú y jugar
- **GIVEN** una partida con el mapa real de la semilla 42 en pausa con el jugador lejos del centro
- **WHEN** se pulsa `Volver al menú`, se pintan 60 frames en el menú, se pulsa `Jugar` y se pinta el primer frame
- **THEN** en los 60 frames del menú no se dibuja ningún objeto del mapa
- **AND** en el primer frame de la partida nueva los objetos dibujados son los que da la regla con su plan y su
  rectángulo visible
- **Cobertura**: unitario (vista del mapa con lienzo falso); el 0 del menú lo confirma además la sonda (ver "Sonda en
  el menú").

#### Scenario: Mapa vacío
- **GIVEN** una partida con el mapa vacío
- **WHEN** se pinta cualquier frame
- **THEN** se dibujan 0 objetos del mapa
- **Cobertura**: unitario.

#### Scenario: Recorte con aspecto de reserva
- **GIVEN** el contenido por defecto, la semilla 42, una ventana de 1.280 × 720 y, en un caso cada vez, sin cargar la
  hoja del agua, la del árbol, la del puente o la del castillo, y en otro caso sin cargar ninguna de las cinco hojas
  del mapa
- **WHEN** se pinta el primer frame y, después, el de una posición del jugador a ≥ 1.280 px en x de la inicial
- **THEN** los rectángulos de reserva se recortan con la misma regla que el arte: en cada frame se dibujan
  exactamente los objetos del plan (arte y reserva) que da la regla con el rectángulo visible de ese frame
- **AND** los recuentos de reserva de la sonda son los del plan entero, iguales a los de antes de este change
- **Cobertura**: unitario (plan con reserva sin motor + vista del mapa con lienzo falso).

## MODIFIED Requirements

### Requirement: Sonda de render para E2E
El sistema SHALL exponer, solo con `?e2e` y como parte de la sonda `window.__sprint`, en el último frame pintado:
- el recuento de sprites visibles por tipo: fondo, jugador, enemigo vivo, cadáver, proyectil, pulso y gema; y por
  tipo y por aspecto de enemigo, cuántos usan aspecto de reserva;
- el número de celdas del mapa pintadas por tipo (`trunk`, `water`, `bridge`, `castle`), con arte o con reserva;
- por elemento del mapa, cuántos se pintan y cuántos de ellos con reserva: agua (celdas `water`), orilla (celdas de
  orilla con su pieza), espuma (celdas de orilla con espuma), árbol (celdas `trunk`), copa (árboles con copa), puente
  (celdas `bridge`) y castillo (0 o 1);
- el número de objetos de escena usados para pintar el mapa;
- el número de esos objetos **dibujados** en el último frame (`drawn`, ver "Recorte del arte del mapa por cámara"),
  con 0 ≤ `drawn` ≤ objetos del mapa.

Los recuentos de celdas pintadas, de elementos del mapa (pintados y con reserva) y de objetos del mapa son del plan
entero de la partida: MUST NOT depender de la cámara, de la ventana ni del recorte, y conservan el significado y el
valor que tenían antes de este change para la misma semilla y el mismo contenido. Solo `drawn` depende del recorte.

Un sprite oculto por el parpadeo cuenta como no visible. En modo menú los recuentos de jugador, enemigo, cadáver,
proyectil, pulso, gema, celdas del mapa, elementos del mapa, objetos del mapa y `drawn` valen 0. Sin `?e2e` MUST NOT
existir. Leer la sonda MUST NOT cambiar la simulación ni lo que se pinta.

#### Scenario: Recuento coherente con el snapshot
- **GIVEN** `?e2e&seed=42` y una partida en curso
- **WHEN** se pintan 600 frames y en cada uno se leen la sonda de render y el snapshot pintado
- **THEN** en cada frame los sprites visibles de enemigo, proyectil, pulso y gema son iguales en número a los
  enemigos, proyectiles, pulsos y gemas del snapshot, y el de jugador vale 1 salvo en los frames en que el parpadeo
  lo oculta, que vale 0
- **AND** el recuento de cadáveres es ≤ 64 en todos
- **AND** las celdas del mapa pintadas por tipo son las mismas en los 600 frames e iguales a los recuentos del mapa
  de la sonda
- **Cobertura**: sin cambios (E2E existente "Sprites").

#### Scenario: Totales del mapa sin cambios
- **GIVEN** el contenido por defecto y las semillas 42 y 123
- **WHEN** se calcula el plan del mapa y los recuentos de la sonda, con una ventana de 960 × 540, de 1.280 × 720 y
  de 3.840 × 2.160, y con el jugador en el centro del mundo y en (16, 16)
- **THEN** en todos los casos las celdas pintadas por tipo, los elementos pintados y con reserva y los objetos del
  mapa son iguales entre sí y a los de antes de este change (667 y 750 objetos del mapa respectivamente)
- **Cobertura**: unitario (plan del mapa sin motor + recuentos de la vista con lienzo falso).

#### Scenario: Objetos dibujados con la cámara [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=7` (mapa real), una ventana de 1.280 × 720 y la flecha
  derecha mantenida
- **WHEN** arranca la partida y se lee la sonda, y después se llama a `step(60)` 20 veces, eligiendo la opción 0 si se
  abre una oferta, y se lee la sonda tras cada llamada
- **THEN** en cada lectura 0 < `drawn` < objetos del mapa, y los objetos del mapa valen lo mismo en todas las
  lecturas
- **AND** en ≥ 1 lectura `drawn` es distinto del de la primera
- **Cobertura**: ampliación del E2E existente "Cámara" de `tests/e2e/gameplay.spec.ts` (0 E2E nuevos; sin esperas de
  reloj ni umbrales de tiempo).

#### Scenario: `drawn` igual al recorte
- **GIVEN** una partida con el mapa real de la semilla 42 y una ventana de 1.280 × 720
- **WHEN** se pinta un frame con el jugador en (1.920, 1.080) y otro con el jugador en (16, 16)
- **THEN** en cada frame `drawn` es igual al número de objetos del plan que da "Recorte del arte del mapa por cámara"
  con el rectángulo visible de ese frame
- **Cobertura**: unitario (vista del mapa con lienzo falso).

#### Scenario: Sonda en el menú
- **GIVEN** `?e2e&seed=42` y el menú tras `Volver al menú`
- **WHEN** se pinta 1 frame y se lee la sonda de render
- **THEN** los recuentos de jugador, enemigo, cadáver, proyectil, pulso, gema, celdas del mapa, elementos del mapa,
  objetos del mapa y `drawn` valen 0
- **Cobertura**: la comprobación de menú existente de `tests/e2e/probe.ts` se amplía a `drawn` (sin E2E nuevo) y un
  unitario de la vista cubre el 0 tras limpiar.

#### Scenario: Sin sonda fuera de E2E
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga y se pulsa `Jugar`
- **THEN** `window.__sprint` es `undefined`
- **Cobertura**: sin cambios.

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

**Pintar y dibujar**: que un elemento se *pinta* significa que forma parte del mapa pintado de la partida (es lo que
cuentan los recuentos del mapa de la sonda y lo que fija esta spec: sitio, modelo, capa y aspecto). Si en un frame
concreto se *dibuja* o no lo decide "Recorte del arte del mapa por cámara": un elemento pintado fuera del rectángulo
de recorte no se dibuja, pero sigue pintado. Los escenarios de este requisito describen el mapa pintado y lo que se ve
cuando el elemento cae dentro del rectángulo visible.

**Reserva por elemento**: si la hoja de un elemento del mapa falla al cargar o no contiene su frame o su recorte,
ese elemento, y solo ese, se pinta así, sin errores no capturados: agua, árbol y puente, como un rectángulo relleno
que cubre exactamente cada celda `water`, `trunk` o `bridge` (error ≤ 1 px) con el color de su tipo, y el árbol sin
copa; castillo, como un rectángulo relleno del color `castle` que cubre exactamente la huella; orilla y espuma no se
pintan. Los colores viven en los datos de aspecto, uno por tipo (`trunk`, `water`, `bridge`, `castle`), en formato
`#RRGGBB`, y son distintos dos a dos; se validan con zod en el arranque como el resto de datos de aspecto: un color
ausente, con otro formato, repetido o de un tipo desconocido MUST hacer fallar el arranque con un error que nombre el
campo. El pintado del mapa no cuenta como sprite de fondo ni como aspecto de reserva de sprites y MUST NOT cambiar la
simulación; ningún requisito depende del frame concreto de la espuma, salvo que todas las espumas dibujadas muestran
el mismo (ver "El recorte no cambia lo que se ve"). Redimensionar la ventana MUST NOT cambiar qué elemento
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
- **Cobertura**: sin cambios (E2E existente "Mapa real"); con el recorte los recuentos siguen siendo del plan entero.

#### Scenario: Hojas del mapa bloqueadas [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` y una prueba que hace fallar las peticiones de
  `Water.png`, `Foam.png`, `Tree.png`, `Bridge_All.png` y `Castle_Blue.png`
- **WHEN** arranca la partida, se llama a `step(60)` y se leen la sonda de render y la del mapa
- **THEN** agua, árbol y puente se pintan todos con reserva, en número igual a los recuentos de `water`, `trunk` y
  `bridge` del mapa; el castillo, 1 con reserva; espuma y copa, 0
- **AND** la partida está en el tick 60, los sprites de entidades cuya hoja no se bloquea no usan aspecto de reserva
  y no hay errores no capturados
- **Cobertura**: sin cambios (E2E existente "Sprites").

#### Scenario: Mapa vacío
- **GIVEN** la build de producción con `?e2e&map=empty&seed=42`
- **WHEN** se pinta 1 frame de la partida
- **THEN** la sonda informa de 0 celdas pintadas de cada tipo, 0 elementos del mapa, `drawn` 0 y 1 sprite de fondo
- **Cobertura**: unitario para `drawn` 0 (ver "Mapa vacío" de "Recorte al cambiar de partida, de ventana y de
  modo"); el resto, sin cambios.

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

### Requirement: Coste de render del mapa (a demanda)
El sistema SHALL pintar el mapa de las semillas 42 y 123 con ≤ 1.000 objetos de escena del mapa cada una (sin contar
fondo, entidades, HUD ni overlays), según informe la sonda de render. Con `CI_LIKE=1` (sin GPU, frenado 25, 1 worker,
mediana de 3 pasadas de la medición de fps del proyecto `realtime`, ventana de 1.280 × 720), se informa, con el mapa
real de las semillas 42 y 123, de los fps, de su porcentaje sobre la base de rectángulos de 0015 (21,6 y 21,9 fps),
de su comparación con la línea base de 0017 (14,1 y 12,9 fps) y de los objetos del mapa y los dibujados (`drawn`) al
empezar la partida. El objetivo orientativo SHOULD ser superar la línea base de 0017 y acercarse a ≥ 85 % de la base
de rectángulos (≥ 18,4 y ≥ 18,6); no se exige volver a las cifras de 0016. Este requisito se mide a demanda y es
informativo: no bloquea `verify`, `test:e2e` ni CI; si no se cumple, se anota en el verify-report.

#### Scenario: Objetos del mapa [realtime]
- **GIVEN** la build de producción con `?e2e&manual&seed=42`, y en otra carga `seed=123`, con una ventana de
  1.280 × 720
- **WHEN** arranca la partida, se pinta 1 frame y se lee la sonda de render
- **THEN** el número de objetos de escena del mapa es ≤ 1.000 en ambas y se informa de él y de `drawn`, con
  0 < `drawn` < objetos del mapa
- **AND** el mismo tope lo comprueba además un test sin navegador del plan de pintado con el contenido por defecto y
  las semillas 42 y 123, que entra en `verify`; este escenario `[realtime]` solo lo confirma con la sonda
- **Cobertura**: proyecto `realtime` (a demanda, fuera del CI) + unitario existente del tope de 1.000.

#### Scenario: Fps con el mapa real [realtime]
- **GIVEN** `CI_LIKE=1` y la medición de fps del proyecto `realtime` con las semillas 42 y 123 y el mapa real
- **WHEN** se ejecutan 3 pasadas y se toma la mediana
- **THEN** se informa del fps de cada semilla, de su porcentaje sobre 21,6 y 21,9 fps y de su diferencia con 14,1 y
  12,9 fps respectivamente
- **Cobertura**: proyecto `realtime` (a demanda, informativo; sin umbral en el gate).

## REMOVED Requirements

(ninguno)
