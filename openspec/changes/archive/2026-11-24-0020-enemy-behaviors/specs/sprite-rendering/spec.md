# Spec delta · sprite-rendering

<!-- Change 0020-enemy-behaviors. Animaciones de mecha (`Barrel_Red`, fila 5, frames 30–32) y de lanzamiento
     (`TNT_Red`, fila 2, frames 14–20), ya versionadas; hojas nuevas `Dynamite.png` (6 frames de 64 × 64) y
     `Explosions.png` (9 frames de 192 × 192); aviso en el suelo sin hoja (forma de color). Recuentos nuevos en la
     sonda. E2E: como mucho 1–2 nuevos o ampliados, en modo manual. -->

## ADDED Requirements

### Requirement: Pintado de los peligros
El sistema SHALL pintar, en cada frame de una partida, exactamente:
- un **aviso** por cada aviso del snapshot: una forma circular rellena centrada en su centro y de radio igual a su
  radio (error ≤ 0,001), sin hoja, con el color de los datos de aspecto, cuya opacidad está en (0, 1) para que se vean
  las entidades y el suelo que cubre; los avisos de mecha y de dinamita pueden tener colores distintos;
- un sprite de **dinamita** por cada dinamita del snapshot, en su posición (error ≤ 0,001), con el aspecto de la
  dinamita en `idle`;
- un sprite de **explosión** por cada explosión del snapshot, en su centro (error ≤ 0,001), con el aspecto de la
  explosión: reproduce una vez `explode` desde el primer frame en que se pinta esa explosión y, si la animación acaba
  antes de que la explosión deje el snapshot, se queda en su último frame.

Todos se pintan en coordenadas de mundo como el resto de elementos de la partida (ver `world-camera`) y en la capa
de peligros de "Capas del mapa y de las entidades". Un aviso, una dinamita o una explosión que deja de figurar en el
snapshot deja de verse en ese frame, sin animación de salida. Con el mundo detenido las animaciones de dinamita y
explosión no avanzan. Pintar los peligros MUST NOT cambiar la simulación.

#### Scenario: Peligros del snapshot
- **GIVEN** un snapshot con 2 avisos (uno de mecha de radio 56 en (1.039,333; 1.000) y uno de dinamita de radio 48 en
  (1.000, 1.000)), 1 dinamita en (1.099,75; 1.000) y 1 explosión de radio 56 en (500, 500)
- **WHEN** se pinta el snapshot
- **THEN** hay 2 formas de aviso con esos centros y radios, 1 sprite de dinamita en su posición y 1 sprite de
  explosión en (500, 500), y ninguno usa aspecto de reserva

#### Scenario: El aviso deja ver lo que cubre
- **GIVEN** los datos de aspecto del repositorio
- **WHEN** se leen los colores de los avisos
- **THEN** la opacidad de cada uno es > 0 y < 1

#### Scenario: Fin de un aviso
- **GIVEN** un aviso de dinamita pintado en el frame del tick 193 y su explosión en el tick 194
- **WHEN** se pinta el snapshot del tick 194
- **THEN** no se pinta ningún aviso y hay 1 sprite de explosión

#### Scenario: Explosión más larga que su animación
- **GIVEN** un aspecto de explosión con `explode` de 9 frames a 18 fps (500 ms) y una explosión visible 60 ticks
- **WHEN** se pintan los 60 frames de 16,667 ms en que figura y el siguiente
- **THEN** desde el frame en que la animación acaba hasta el 60.º el sprite muestra el último frame de `explode`
- **AND** en el frame 61 no hay sprite de explosión

#### Scenario: Peligros con el mundo detenido
- **GIVEN** una dinamita y una explosión pintadas y la partida en pausa
- **WHEN** se pintan 300 frames en pausa
- **THEN** en los 300 se ven la dinamita, su aviso y la explosión, cada sprite con el mismo frame de hoja que en el
  primer frame de la pausa

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

Animaciones obligatorias: `idle` y `walk` en el jugador y en cada tipo de enemigo; además, `fuse` en cada tipo de
enemigo cuyo comportamiento tiene un estado de mecha y `throw` en cada tipo cuyo comportamiento tiene un estado de
carga (ver `enemy-behavior`); `death` sin bucle en el cadáver; `idle` en el proyectil, la gema, la dinamita y el
fondo; `explode` sin bucle en la explosión. Los datos incluyen además el tope de cadáveres visibles a la vez (entero
≥ 1) y el color de los avisos de mecha y de dinamita (cada uno con su opacidad en (0, 1)). Los tipos con aspecto MUST
ser exactamente los `id` de `content/enemies.json`.

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
  proyectil, la gema, el cadáver, el fondo, la dinamita, la explosión y exactamente los tipos `goblin-torch`,
  `goblin-tnt` y `goblin-barrel`
- **AND** `goblin-barrel` tiene `fuse` con los frames `[30, 31, 32]` en bucle y `goblin-tnt` tiene `throw` con los
  frames `[14, 15, 16, 17, 18, 19, 20]`; la dinamita tiene `idle` de 6 frames en bucle y la explosión `explode` de 9
  frames sin bucle
- **AND** hay color de aviso de mecha y de dinamita, cada uno con opacidad > 0 y < 1
- **AND** hay aspecto de agua, de orilla con los 15 casos, de espuma con `idle` de 8 frames en bucle, de árbol con
  ≥ 2 modelos, de puente con sus 2 recortes y de castillo

#### Scenario: Valores fuera de rango
- **GIVEN** los datos del repositorio con, en un caso cada vez en el aspecto de `goblin-torch`: ancho de frame 0,
  alto de frame 1,5, escala 0, escala −1, origen `x` 1,1, origen `y` −0,1, fps de `walk` 0, frames de `walk` `[]`,
  `[-1]` o `[1.5]`; en otro caso el tope de cadáveres 0 o 2,5; y en otro la opacidad del aviso de dinamita 0, 1 o 1,2
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
  `"torch.gif"` o una ruta `.png` que no figura en la nota de procedencia; y en otro caso la hoja del castillo, y en
  otro la de la explosión, igual a una ruta `.png` que no figura en la nota
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra la hoja de `goblin-torch`, la del castillo y la de la explosión
  respectivamente

#### Scenario: Animaciones obligatorias y campos desconocidos
- **GIVEN** los datos del repositorio con, en un caso cada vez: el jugador sin `walk`, `goblin-tnt` sin `idle`, el
  cadáver sin `death`, `death` del cadáver en bucle, un campo extra `rotation: 90` en el aspecto de la gema,
  `goblin-barrel` sin `fuse`, `goblin-tnt` sin `throw`, la dinamita sin `idle`, la explosión sin `explode` o con
  `explode` en bucle
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo (y el tipo, en los de enemigo)

#### Scenario: Animación de comportamiento no exigida
- **GIVEN** los datos del repositorio sin `fuse` ni `throw` en `goblin-torch` (su comportamiento no tiene mecha ni
  carga)
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

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
  aspectos de entidades multiplicadas por 2 y los colores del mapa y de los avisos cambiados
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick

### Requirement: Arte de Tiny Swords Update 010 por elemento
El sistema SHALL pintar, con los datos de aspecto del repositorio, cada elemento con su hoja de Update 010:
- el jugador, con una hoja de la unidad Arquero (`Archer`);
- cada tipo de enemigo, con la hoja de su unidad goblin: `goblin-torch` con `Torch`, `goblin-tnt` con `TNT` y
  `goblin-barrel` con `Barrel`, tres hojas distintas; la mecha y el lanzamiento usan la misma hoja que su tipo;
- el cadáver, con `Dead.png`;
- el proyectil, con `Arrow.png`;
- la gema, con una hoja del pack;
- la dinamita, con `Dynamite.png` (de la carpeta de la unidad `TNT`); la explosión, con `Explosions.png`;
- el fondo, con un suelo de hierba del pack;
- el agua, con `Water.png`; la espuma, con `Foam.png`; los árboles, con `Tree.png`; los puentes, con
  `Bridge_All.png`; el castillo, con `Castle_Blue.png` (castillo azul, como el arquero); la orilla, con una hoja de
  terreno del pack.

Los avisos no usan hoja. La unidad o el elemento de cada hoja se comprueba con la ruta de origen que registra la nota
de procedencia (ver `asset-provenance`). Del pack solo se versionan las hojas que usan los datos de aspecto (ningún
otro color de castillo, ni `Rocks`, ni `Fire.png`, ni hojas de casas o torres). Cambiar el arte de un elemento MUST
requerir solo cambios de datos y de assets, no de código.

#### Scenario: Hoja de cada elemento
- **GIVEN** los datos de aspecto del repositorio y la nota de procedencia
- **WHEN** se busca en la nota la ruta de origen de la hoja de cada aspecto
- **THEN** la del jugador contiene `Archer`; las de `goblin-torch`, `goblin-tnt` y `goblin-barrel` contienen
  `Torch`, `TNT` y `Barrel` respectivamente y son tres ficheros distintos; la del cadáver termina en `Dead.png` y la
  del proyectil en `Arrow.png`
- **AND** la de la dinamita contiene `TNT` y termina en `Dynamite.png`, y la de la explosión termina en
  `Explosions.png`
- **AND** las del agua, la espuma, el árbol, el puente y el castillo terminan en `Water.png`, `Foam.png`, `Tree.png`,
  `Bridge_All.png` y `Castle_Blue.png` respectivamente
- **AND** todas las rutas de origen pertenecen a Tiny Swords Update 010

#### Scenario: Solo las hojas usadas
- **GIVEN** la lista de ficheros versionados y los datos de aspecto del repositorio
- **WHEN** se compara cada asset gráfico de la nota de procedencia con las hojas de los datos de aspecto
- **THEN** cada asset de la nota es la hoja de ≥ 1 aspecto y ningún fichero versionado contiene `Castle_Red`,
  `Castle_Yellow`, `Castle_Purple`, `Castle_Black`, `Rocks`, `Fire`, `Goblin_House` ni `Wood_Tower`

#### Scenario: Partida con arte
- **GIVEN** la build de producción servida con `?e2e&seed=42`
- **WHEN** termina la carga y se pintan 600 frames
- **THEN** en cada frame la sonda informa de 1 sprite de fondo, de 0 sprites con aspecto de reserva y de un sprite
  de jugador visible salvo en los frames en que el parpadeo lo oculta (ver `player-health`)
- **AND** en algún frame hay ≥ 1 enemigo, ≥ 1 proyectil y ≥ 1 gema visibles, todos con su hoja

### Requirement: Aspecto de reserva ante un fallo de carga
El sistema SHALL, si la hoja de un aspecto falla al cargar o no contiene algún frame referenciado por sus animaciones,
pintar los elementos de ese aspecto con su aspecto de reserva: una forma rellena centrada en la posición del elemento
y de diámetro 2 × el radio del elemento en el snapshot (en la dinamita, su radio visual; en la explosión, su radio),
sin volteo ni rotación (en el fondo, un relleno liso del mundo entero, (0, 0)–(ancho, alto) en coordenadas de
mundo). El fallo MUST NOT romper la partida ni producir errores no capturados, y los aspectos cuya hoja carga bien
siguen con su arte. El aspecto de reserva conserva el resto del comportamiento de esta spec (duración del cadáver,
parpadeo, indicación de daño y presencia de dinamitas y explosiones mientras figuran en el snapshot) y MUST NOT
depender de ficheros ni de recursos `blob:`. Una animación de comportamiento (`fuse`, `throw`) usa la hoja de su tipo:
si esa hoja falla, todo el tipo se pinta con reserva. Los avisos no tienen hoja y nunca cuentan como reserva. Los
elementos del mapa tienen su propia reserva por colores (ver "Pintado del mapa"): no cuentan como sprites con aspecto
de reserva y no dependen de la hoja del fondo, salvo la orilla si su hoja es la del fondo.

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

#### Scenario: Frame de mecha fuera de la hoja
- **GIVEN** un aspecto de `goblin-barrel` cuya hoja tiene los frames 0 a 29 y `fuse` con frames `[30, 31, 32]`
- **WHEN** se pinta un `goblin-barrel` en persecución y otro en mecha
- **THEN** ambos se pintan con su aspecto de reserva y no hay errores no capturados

#### Scenario: Tamaño del aspecto de reserva
- **GIVEN** la hoja de `goblin-torch` sin cargar y un `goblin-torch` de radio 10 en (300, 200)
- **WHEN** se pinta el snapshot
- **THEN** su sprite es una forma de 20 px de diámetro centrada en (300, 200) (error ≤ 0,001)

#### Scenario: Reserva de la dinamita y la explosión
- **GIVEN** las hojas de la dinamita y de la explosión sin cargar, una dinamita de radio visual 8 en (700, 400) y una
  explosión de radio 56 en (500, 500)
- **WHEN** se pinta el snapshot
- **THEN** la dinamita es una forma de 16 px de diámetro centrada en (700, 400) y la explosión una de 112 px centrada
  en (500, 500) (error ≤ 0,001), y la sonda las cuenta con aspecto de reserva
- **AND** los avisos se pintan igual que con las hojas cargadas y no cuentan como reserva

#### Scenario: Fondo de reserva en el mundo entero
- **GIVEN** la build de producción con `?e2e&manual&map=empty&seed=7` en una ventana de 1.280 × 720, una prueba que
  hace fallar la petición de la hoja del fondo y un input que lleva al jugador a las cuatro esquinas del mundo
- **WHEN** se avanza con `step(n)` hasta que el jugador ha tocado las cuatro esquinas, leyendo la sonda tras cada
  llamada
- **THEN** la sonda informa de que el fondo usa aspecto de reserva y en cada lectura el rectángulo visible de la
  cámara está entero dentro del rectángulo de mundo que cubre ese relleno, (0, 0)–(3.840, 2.160)
- **AND** no hay errores no capturados

### Requirement: Animación por estado del jugador y de los enemigos
El sistema SHALL animar el sprite del jugador y el de cada enemigo vivo según su estado:
- un enemigo cuyo estado de comportamiento en el snapshot pintado es de clase mecha reproduce `fuse`, y uno de clase
  carga reproduce `throw`, sin importar si se mueve; al entrar en uno de esos estados la animación empieza en su
  primer frame;
- en el resto de casos (jugador, y enemigos en persecución o en espera), el estado se deduce al comparar el snapshot
  pintado con el último snapshot pintado de un tick distinto de la misma partida: se mueve si su posición ha cambiado
  más de 0,001 px y reproduce `walk`; si no, reproduce `idle`;
- cada animación avanza a sus fps en tiempo de render y, en bucle, vuelve al primer frame al acabar; sin bucle, se
  queda en su último frame.

Un frame que repite el tick del anterior MUST conservar el estado y la orientación de cada sprite. Un enemigo en su
primer frame pintado (recién aparecido o en un hueco reutilizado) y el jugador en el primer frame de una partida
nueva MUST NOT heredar estado ni orientación de otro elemento o de una partida anterior: se pintan en `idle` y sin
voltear (o en `fuse` o `throw` si su estado de comportamiento lo pide). Con el mundo detenido ninguna animación
avanza. Con la partida terminada, el jugador se pinta en `idle` (el jugador no tiene animación de muerte). La
animación no cambia la simulación.

#### Scenario: Quieto y andando
- **GIVEN** un aspecto del jugador con `idle` (frames `[0, 1]`, 2 fps, bucle) y `walk` (frames `[6, 7, 8, 9]`,
  10 fps, bucle)
- **WHEN** se pintan 30 frames con el jugador quieto en (480, 270) y después 30 frames con input (1, 0)
- **THEN** en los 30 primeros reproduce `idle` y en los 30 siguientes, desde el primero en que su posición cambia,
  reproduce `walk`

#### Scenario: Avance de la animación
- **GIVEN** la animación `walk` del escenario anterior en curso desde el frame f
- **WHEN** se pintan 30 frames de 16,667 ms
- **THEN** el frame de hoja mostrado en el frame f + k es el de índice ⌊k × 16,667 / 100⌋ mod 4 de `[6, 7, 8, 9]`,
  con un margen de ±1 frame de render en cada cambio

#### Scenario: Frames sin tick
- **GIVEN** un jugador con input (1, 0) y un motor que informa de frames de 8,333 ms (120 Hz), de modo que los
  frames alternan uno con tick nuevo y otro que repite el tick anterior
- **WHEN** se pintan 120 frames
- **THEN** el jugador reproduce `walk` sin voltear en los 120
- **AND** con input (0, 0) en otros 120 frames iguales reproduce `idle` en todos

#### Scenario: Umbral de movimiento
- **GIVEN** un enemigo en persecución que reproduce `walk`
- **WHEN** se pinta el snapshot del tick siguiente, con su posición cambiada 0,0005 px
- **THEN** pasa a reproducir `idle`

#### Scenario: Mecha y lanzamiento
- **GIVEN** un `goblin-barrel` que reproduce `walk` y entra en mecha en el tick n, y un `goblin-tnt` que entra en
  carga en el tick n y en espera en el tick n + A
- **WHEN** se pintan los snapshots de n a n + A
- **THEN** el barril reproduce `fuse` desde su primer frame en el frame del tick n y en todos los siguientes
- **AND** el TNT reproduce `throw` desde su primer frame en el frame del tick n y `idle` en el del tick n + A

#### Scenario: Hueco reutilizado
- **GIVEN** un `goblin-torch` de id 7 pintado en (100, 100) andando hacia la izquierda, que muere, y un `goblin-torch` de
  id 9 que en el frame siguiente se pinta en (800, 100) con el sprite que usaba el id 7
- **WHEN** se pinta ese frame
- **THEN** el de id 9 reproduce `idle` y no está volteado

#### Scenario: Mundo detenido
- **GIVEN** un jugador y 3 enemigos que reproducen `walk`, 1 `goblin-barrel` que reproduce `fuse` y la partida en
  pausa en el tick 500
- **WHEN** se pintan 300 frames en pausa
- **THEN** en los 300 cada sprite muestra el mismo frame de hoja que en el primer frame de la pausa
- **AND** lo mismo ocurre durante 300 frames con la partida eligiendo mejora y durante 300 con la partida terminada

#### Scenario: Partida terminada
- **GIVEN** un jugador que reproduce `walk` y una partida que termina con derrota en el tick n
- **WHEN** se pinta el snapshot terminado del tick n
- **THEN** el jugador se pinta en `idle` y es visible (ver `player-health`)

#### Scenario: Parpadeo con sprite animado
- **GIVEN** una vista con periodo de parpadeo 4 y el jugador andando e invulnerable desde el tick 1 durante 30 ticks
- **WHEN** se pintan los snapshots de los ticks 1 a 30
- **THEN** la visibilidad del sprite del jugador sigue "Parpadeo durante la invulnerabilidad" (`player-health`) y,
  en los ticks en que es visible, reproduce `walk`

### Requirement: Capas del mapa y de las entidades
El sistema SHALL pintar, de abajo arriba: (1) el fondo; (2) el agua; (3) las orillas y la espuma; (4) los puentes;
(5) el tronco de cada árbol y la fachada del castillo; (6) cadáveres, gemas, pulsos, jugador, enemigos y proyectiles,
con su orden relativo de antes de este change; (7) las copas de los árboles y el tejado del castillo; (8) la **capa de
peligros**: avisos, dinamitas y explosiones, en ese orden; (9) el HUD y los overlays, fijos en pantalla (ver
`world-camera`). La **copa** es la parte del dibujo del árbol situada por encima del borde superior de su celda y el
**tronco**, el resto. El **tejado** es la parte del dibujo del castillo situada por encima del borde superior de la
fila inferior de la huella y la **fachada**, el resto. Las partes se separan con un error ≤ 1 px. Así, una entidad al
sur de un árbol o ante la puerta se ve delante, y una que pasa detrás de una copa o sobre el tejado queda tapada; un
aviso, una dinamita o una explosión se ven siempre sobre el mapa y las entidades y bajo el HUD. El orden de capas MUST
mantenerse tras cualquier redimensionado de la ventana.

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

#### Scenario: Peligros sobre las copas y bajo el HUD
- **GIVEN** un mapa de hierba con un tronco en (10, 4) y la celda (11, 4) de `water`, y un snapshot con un aviso
  centrado en (660, 240), una dinamita en (630, 220), una explosión en (690, 270) y un enemigo en (630, 230)
- **WHEN** se pinta el snapshot con el overlay de pausa abierto
- **THEN** el aviso, la dinamita y la explosión están por encima del agua, de la copa del árbol y del sprite del
  enemigo, el aviso por debajo de la dinamita y esta por debajo de la explosión
- **AND** el HUD y el overlay de pausa están por encima de los tres

#### Scenario: Capas tras redimensionar
- **GIVEN** el escenario "Jugador ante la puerta" pintado con una ventana de 1.280 × 720, un aviso sobre el tejado y
  el overlay de pausa abierto
- **WHEN** la ventana pasa a 960 × 540 y se pinta 1 frame
- **THEN** la fachada sigue por debajo del jugador, el tejado por encima, el aviso por encima del tejado, y el HUD y
  el overlay de pausa por encima del aviso

### Requirement: Limpieza de la vista al cambiar de partida
El sistema SHALL, en el primer frame de una partida nueva tras R (ver `run-results`) y en el primer frame del menú
tras `Volver al menú` (ver `main-menu`), no dejar visible ningún cadáver ni ningún sprite de jugador, enemigo,
proyectil, pulso, gema, dinamita o explosión, ni ningún aviso, que no corresponda al snapshot pintado (en el menú,
ninguno). Los cadáveres y las explosiones en curso se descartan sin terminar su animación y no reaparecen después.
Cerrar la escena de la partida a mitad de una animación MUST NOT dejar animaciones en curso ni errores no capturados.

#### Scenario: R con cadáveres en curso
- **GIVEN** una partida terminada ya pintada con 10 cadáveres en curso, 15 enemigos, 40 gemas, 2 dinamitas, 3 avisos
  y 1 explosión
- **WHEN** se pulsa R y se pintan el tick 0 de la partida nueva y los 60 frames siguientes
- **THEN** hay 0 cadáveres visibles en todos esos frames y, en el primero, 1 sprite de jugador y 0 de enemigo,
  proyectil, pulso, gema, dinamita, aviso y explosión

#### Scenario: Volver al menú con cadáveres en curso
- **GIVEN** `?e2e&seed=7` y una partida que se pausa en el primer frame en que la sonda informa de ≥ 1 cadáver
- **WHEN** se pulsa `Volver al menú`, se pintan 60 frames en el menú y después se pulsa `Jugar`
- **THEN** en los 60 frames del menú la sonda informa de 0 sprites de jugador, enemigo, cadáver, proyectil, pulso,
  gema, dinamita, aviso y explosión
- **AND** en el primer frame de la partida nueva hay 0 cadáveres y no hay errores no capturados

### Requirement: Sonda de render para E2E
El sistema SHALL exponer, solo con `?e2e` y como parte de la sonda `window.__sprint`, en el último frame pintado:
- el recuento de sprites visibles por tipo: fondo, jugador, enemigo vivo, cadáver, proyectil, pulso, gema, dinamita,
  aviso y explosión; y por tipo y por aspecto de enemigo, de dinamita y de explosión, cuántos usan aspecto de reserva
  (los avisos nunca);
- por clase de estado de comportamiento (persecución, mecha, carga y espera), cuántos sprites de enemigo vivo hay;
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
Los peligros no forman parte del plan del mapa ni de sus objetos.

Un sprite oculto por el parpadeo cuenta como no visible. En modo menú los recuentos de jugador, enemigo, cadáver,
proyectil, pulso, gema, dinamita, aviso, explosión, celdas del mapa, elementos del mapa, objetos del mapa y `drawn`
valen 0. Sin `?e2e` MUST NOT existir. Leer la sonda MUST NOT cambiar la simulación ni lo que se pinta.

#### Scenario: Recuento coherente con el snapshot
- **GIVEN** `?e2e&seed=42` y una partida en curso
- **WHEN** se pintan 600 frames y en cada uno se leen la sonda de render y el snapshot pintado
- **THEN** en cada frame los sprites visibles de enemigo, proyectil, pulso, gema, dinamita, aviso y explosión son
  iguales en número a los enemigos, proyectiles, pulsos, gemas, dinamitas, avisos y explosiones del snapshot, y el de
  jugador vale 1 salvo en los frames en que el parpadeo lo oculta, que vale 0
- **AND** los sprites de enemigo por clase de estado coinciden con los enemigos del snapshot en cada clase
- **AND** el recuento de cadáveres es ≤ 64 en todos
- **AND** las celdas del mapa pintadas por tipo son las mismas en los 600 frames e iguales a los recuentos del mapa
  de la sonda

#### Scenario: Barril en mecha y su explosión en el navegador [E2E]
- **GIVEN** la build de producción servida con `?e2e&manual&map=empty&seed=s`, con s una semilla de 1..50, sin input
  de movimiento y con la política de elección fija
- **WHEN** se avanza con `step(n)` y se lee la sonda tras cada llamada, hasta que la partida termina (antes del tick
  10.800, ver "Jugador quieto pierde también con el mapa vacío" en `run-outcome`)
- **THEN** en ≥ 1 lectura la sonda informa de ≥ 1 aviso y ≥ 1 sprite de enemigo en mecha, y en ≥ 1 lectura posterior
  de ≥ 1 explosión, todos sin aspecto de reserva
- **AND** en cada lectura los recuentos de aviso, dinamita y explosión de la sonda son iguales a los del snapshot y no
  hay errores no capturados

#### Scenario: Totales del mapa sin cambios
- **GIVEN** el contenido por defecto y las semillas 42 y 123
- **WHEN** se calcula el plan del mapa y los recuentos de la sonda, con una ventana de 960 × 540, de 1.280 × 720 y
  de 3.840 × 2.160, y con el jugador en el centro del mundo y en (16, 16)
- **THEN** en todos los casos las celdas pintadas por tipo, los elementos pintados y con reserva y los objetos del
  mapa son iguales entre sí y a los de antes de este change (667 y 750 objetos del mapa respectivamente)

#### Scenario: Objetos dibujados con la cámara [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=7` (mapa real), una ventana de 1.280 × 720 y la flecha
  derecha mantenida
- **WHEN** arranca la partida y se lee la sonda, y después se llama a `step(60)` 20 veces, eligiendo la opción 0 si se
  abre una oferta, y se lee la sonda tras cada llamada
- **THEN** en cada lectura 0 < `drawn` < objetos del mapa, y los objetos del mapa valen lo mismo en todas las
  lecturas
- **AND** en ≥ 1 lectura `drawn` es distinto del de la primera

#### Scenario: `drawn` igual al recorte
- **GIVEN** una partida con el mapa real de la semilla 42 y una ventana de 1.280 × 720
- **WHEN** se pinta un frame con el jugador en (1.920, 1.080) y otro con el jugador en (16, 16)
- **THEN** en cada frame `drawn` es igual al número de objetos del plan que da "Recorte del arte del mapa por cámara"
  con el rectángulo visible de ese frame

#### Scenario: Sonda en el menú
- **GIVEN** `?e2e&seed=42` y el menú tras `Volver al menú`
- **WHEN** se pinta 1 frame y se lee la sonda de render
- **THEN** los recuentos de jugador, enemigo, cadáver, proyectil, pulso, gema, dinamita, aviso, explosión, celdas del
  mapa, elementos del mapa, objetos del mapa y `drawn` valen 0

#### Scenario: Sin sonda fuera de E2E
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga y se pulsa `Jugar`
- **THEN** `window.__sprint` es `undefined`

## REMOVED Requirements

<!-- Ninguno. -->
