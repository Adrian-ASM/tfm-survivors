# Sprite Rendering · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
El arte de Tiny Swords Update 010 (CC0) que pinta al jugador, a los goblins, sus cadáveres, las flechas, las gemas, el suelo y el mapa (agua, orillas, árboles, puentes y castillo), cargado de forma compatible con la CSP y con aspecto de reserva si falla una hoja.

## Requirements

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
carga (ver `enemy-behavior`); `death` sin bucle en el cadáver; `idle` en el proyectil, la gema, la dinamita, el
fondo y en cada aspecto de estructura; `explode` sin bucle en la explosión. Los datos incluyen además el tope de
cadáveres visibles a la vez (entero ≥ 1) y el color de los avisos de mecha y de dinamita (cada uno con su opacidad en
(0, 1)). Los tipos con aspecto MUST ser exactamente los `id` de `content/enemies.json`. Dos tipos de enemigo pueden
compartir hoja.

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

Y los aspectos de las estructuras: por cada tipo de estructura de su contenido (ver `goblin-structures`), un aspecto
intacto y uno de ruina, con las reglas de los aspectos de entidades, y los colores de reserva de "Pintado de las
estructuras". Los tipos de estructura con aspecto MUST ser exactamente los del contenido de estructuras.

Un campo desconocido, un campo obligatorio ausente, un valor fuera de rango, un caso de orilla ausente o repetido, un
tipo de enemigo o de estructura sin aspecto o un aspecto de un tipo inexistente MUST hacer fallar el arranque con un
error que nombre el campo, el caso o el id, igual que el resto del contenido inválido: no se muestra el menú ni
empieza ninguna partida. Los datos de aspecto MUST NOT cambiar la simulación.

#### Scenario: Datos del repositorio
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** los datos de aspecto son válidos, el tope de cadáveres vale 64 y hay aspecto para el jugador, el
  proyectil, la gema, el cadáver, el fondo, la dinamita, la explosión y exactamente los tipos `goblin-torch`,
  `goblin-tnt`, `goblin-barrel` y `goblin-tnt-guard`
- **AND** `goblin-barrel` tiene `fuse` con los frames `[30, 31, 32]` en bucle, y `goblin-tnt` y `goblin-tnt-guard`
  tienen `throw` con los frames `[14, 15, 16, 17, 18, 19, 20]` y la misma hoja; la dinamita tiene `idle` de 6 frames
  en bucle y la explosión `explode` de 9 frames sin bucle
- **AND** hay color de aviso de mecha y de dinamita, cada uno con opacidad > 0 y < 1
- **AND** hay aspecto de agua, de orilla con los 15 casos, de espuma con `idle` de 8 frames en bucle, de árbol con
  ≥ 2 modelos, de puente con sus 2 recortes y de castillo
- **AND** hay aspecto intacto y de ruina para exactamente `goblin-house` y `goblin-tower`, y colores de reserva de
  `goblin-house`, `goblin-tower` y ruina

#### Scenario: Valores fuera de rango
- **GIVEN** los datos del repositorio con, en un caso cada vez en el aspecto de `goblin-torch`: ancho de frame 0,
  alto de frame 1,5, escala 0, escala −1, origen `x` 1,1, origen `y` −0,1, fps de `walk` 0, frames de `walk` `[]`,
  `[-1]` o `[1.5]`; en otro caso el tope de cadáveres 0 o 2,5; en otro la opacidad del aviso de dinamita 0, 1 o 1,2; y
  en otro la escala de la ruina de `goblin-house` 0
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
  `"torch.gif"` o una ruta `.png` que no figura en la nota de procedencia; y en otro caso la hoja del castillo, en
  otro la de la explosión y en otro la de la torre intacta, igual a una ruta `.png` que no figura en la nota
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra la hoja de `goblin-torch`, la del castillo, la de la explosión y la
  de `goblin-tower` respectivamente

#### Scenario: Animaciones obligatorias y campos desconocidos
- **GIVEN** los datos del repositorio con, en un caso cada vez: el jugador sin `walk`, `goblin-tnt` sin `idle`, el
  cadáver sin `death`, `death` del cadáver en bucle, un campo extra `rotation: 90` en el aspecto de la gema,
  `goblin-barrel` sin `fuse`, `goblin-tnt` sin `throw`, `goblin-tnt-guard` sin `throw`, la dinamita sin `idle`, la
  explosión sin `explode` o con `explode` en bucle, o la ruina de `goblin-tower` sin `idle`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo (y el tipo, en los de enemigo y de estructura)

#### Scenario: Animación de comportamiento no exigida
- **GIVEN** los datos del repositorio sin `fuse` ni `throw` en `goblin-torch` (su comportamiento no tiene mecha ni
  carga)
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Tipos de enemigo y aspectos desalineados
- **GIVEN** los datos del repositorio sin el aspecto de `goblin-barrel`, en otro caso sin el de `goblin-tnt-guard`, y
  en otro con un aspecto extra para `goblin-dragon`, con el contenido de enemigos por defecto
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `goblin-barrel`, `goblin-tnt-guard` y `goblin-dragon`
  respectivamente

#### Scenario: Tipos de estructura y aspectos desalineados
- **GIVEN** los datos del repositorio sin el aspecto de ruina de `goblin-tower`, y en otro caso con un aspecto extra
  para `goblin-mine`, con el contenido de estructuras por defecto
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `goblin-tower` y `goblin-mine` respectivamente

#### Scenario: Datos inválidos en el arranque
- **GIVEN** unos datos de aspecto sin el aspecto del jugador, y en otro caso sin el aspecto del agua
- **WHEN** se ejecuta el arranque del juego, con y sin `?e2e`
- **THEN** en todos los casos no se crea el menú ni ninguna partida y la consola informa de un error que nombra el
  aspecto del jugador o el del agua (verificable sin navegador)

#### Scenario: Los aspectos no cambian la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick
  y la política de elección fija, una con los datos de aspecto del repositorio y otra con todas las escalas de los
  aspectos de entidades y de estructuras multiplicadas por 2 y los colores del mapa, de las estructuras y de los
  avisos cambiados
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick

### Requirement: Arte de Tiny Swords Update 010 por elemento
El sistema SHALL pintar, con los datos de aspecto del repositorio, cada elemento con su hoja de Update 010:
- el jugador, con una hoja de la unidad Arquero (`Archer`);
- cada tipo de enemigo, con la hoja de su unidad goblin: `goblin-torch` con `Torch`, `goblin-tnt` con `TNT` y
  `goblin-barrel` con `Barrel`, tres hojas distintas; `goblin-tnt-guard` con la misma hoja que `goblin-tnt`; la mecha y
  el lanzamiento usan la misma hoja que su tipo;
- el cadáver, con `Dead.png`;
- el proyectil, con `Arrow.png`;
- la gema (recogible `xp`), con una hoja del pack distinta de `G_Idle.png` y de `W_Idle.png`, o sin hoja (ver
  "Aspectos de los recogibles y de las vetas");
- el recogible `gold`, con `G_Idle.png` (bolsa de oro); el recogible `wood`, con `W_Idle.png`;
- la veta activa, con `GoldMine_Active.png`, y la agotada, con `GoldMine_Inactive.png`;
- la dinamita, con `Dynamite.png` (de la carpeta de la unidad `TNT`); la explosión, con `Explosions.png`;
- el fondo, con un suelo de hierba del pack;
- el agua, con `Water.png`; la espuma, con `Foam.png`; los árboles, con `Tree.png`; los puentes, con
  `Bridge_All.png`; el castillo, con `Castle_Blue.png` (castillo azul, como el arquero); la orilla, con una hoja de
  terreno del pack;
- la casa, con `Goblin_House.png`, y su ruina, con `Goblin_House_Destroyed.png`; la torre, con un único
  `Wood_Tower_<color>.png`, y su ruina, con `Wood_Tower_Destroyed.png`.

Los avisos no usan hoja. La unidad o el elemento de cada hoja se comprueba con la ruta de origen que registra la nota
de procedencia (ver `asset-provenance`). Del pack solo se versionan las hojas que usan los datos de aspecto (ningún
otro color de castillo ni de torre, ni `Rocks`, ni `Fire.png`, ni `Wood_Tower_InConstruction`, ni
`GoldMine_Destroyed.png`, ni las hojas de carne `M_*`, ni las de ovejas). Cambiar el arte de un elemento MUST requerir
solo cambios de datos y de assets, no de código.

#### Scenario: Hoja de cada elemento
- **GIVEN** los datos de aspecto del repositorio y la nota de procedencia
- **WHEN** se busca en la nota la ruta de origen de la hoja de cada aspecto
- **THEN** la del jugador contiene `Archer`; las de `goblin-torch`, `goblin-tnt` y `goblin-barrel` contienen
  `Torch`, `TNT` y `Barrel` respectivamente y son tres ficheros distintos; la de `goblin-tnt-guard` es el mismo
  fichero que la de `goblin-tnt`; la del cadáver termina en `Dead.png` y la del proyectil en `Arrow.png`
- **AND** la de `gold` termina en `G_Idle.png`, la de `wood` en `W_Idle.png`, la de `xp`, si la tiene, en otro fichero
  distinto de ambos, y las de la veta activa y agotada en `GoldMine_Active.png` y `GoldMine_Inactive.png`
- **AND** la de la dinamita contiene `TNT` y termina en `Dynamite.png`, y la de la explosión termina en
  `Explosions.png`
- **AND** las del agua, la espuma, el árbol, el puente y el castillo terminan en `Water.png`, `Foam.png`, `Tree.png`,
  `Bridge_All.png` y `Castle_Blue.png` respectivamente
- **AND** las de la casa y su ruina terminan en `Goblin_House.png` y `Goblin_House_Destroyed.png`, y las de la torre y
  su ruina en `Wood_Tower_<color>.png` y `Wood_Tower_Destroyed.png`
- **AND** todas las rutas de origen pertenecen a Tiny Swords Update 010

#### Scenario: Solo las hojas usadas
- **GIVEN** la lista de ficheros versionados y los datos de aspecto del repositorio
- **WHEN** se compara cada asset gráfico de la nota de procedencia con las hojas de los datos de aspecto
- **THEN** cada asset de la nota es la hoja de ≥ 1 aspecto y ningún fichero versionado contiene `Castle_Red`,
  `Castle_Yellow`, `Castle_Purple`, `Castle_Black`, `Rocks`, `Fire`, `Wood_Tower_InConstruction`,
  `GoldMine_Destroyed`, `M_Idle`, `M_Spawn` ni `HappySheep`
- **AND** de `Wood_Tower_Red`, `Wood_Tower_Blue`, `Wood_Tower_Purple` y `Wood_Tower_Yellow` hay exactamente 1 fichero
  versionado, el de la hoja de la torre

#### Scenario: Partida con arte
- **GIVEN** la build de producción servida con `?e2e&seed=42`
- **WHEN** termina la carga y se pintan 600 frames
- **THEN** en cada frame la sonda informa de 1 sprite de fondo, de 0 sprites con aspecto de reserva y de un sprite
  de jugador visible salvo en los frames en que el parpadeo lo oculta (ver `player-health`)
- **AND** en algún frame hay ≥ 1 enemigo, ≥ 1 proyectil y ≥ 1 gema visibles, todos con su aspecto

### Requirement: Carga del arte compatible con la CSP
El sistema SHALL cargar todas las hojas sin ninguna violación de la Content Security Policy y sin cambiar sus
directivas (`img-src 'self' data:` y las demás, ver "Política de seguridad de contenido" en `progress-persistence`),
tanto al arrancar desde el menú como con `?e2e`, en `vite preview` y en la URL pública, bajo la base `/tfm-survivors/`.
La carga MUST terminar antes del primer frame que pinta un elemento de la partida: ningún elemento se pinta con una
hoja sin cargar. Con `?e2e`, la carga del arte MUST conservar el comportamiento de "Carga en modo E2E" (`main-menu`).

#### Scenario: Desde el menú
- **GIVEN** la build de producción servida sin parámetros y una prueba que escucha `securitypolicyviolation`
- **WHEN** se pulsa `Jugar` y se pintan 300 frames
- **THEN** se registran 0 eventos `securitypolicyviolation`, 0 mensajes de consola de violación de CSP y 0 errores
  no capturados

#### Scenario: Con e2e
- **GIVEN** la build de producción servida con `?e2e&seed=42` y la misma escucha
- **WHEN** termina la carga y el motor informa de 15 frames de 16,667 ms
- **THEN** la sonda informa de semilla 42, estado en curso, tick 15 y 0 sprites con aspecto de reserva
- **AND** se registran 0 eventos `securitypolicyviolation` y el menú de inicio no se ha visto

#### Scenario: Directivas sin cambios
- **GIVEN** el `index.html` fuente del repositorio tras este change
- **WHEN** un test de `npm run verify` lee su meta CSP
- **THEN** sus directivas son iguales, una a una, a las de antes del change y `img-src` es `'self' data:`

#### Scenario: Arte en la URL pública
- **GIVEN** la URL pública y el smoke remoto a demanda (ver `public-deploy`)
- **WHEN** carga la página sin parámetros y pulsa `Jugar`
- **THEN** cada hoja de los datos de aspecto se pide bajo `/tfm-survivors/` y responde 200 con tipo `image/png`
- **AND** se registran 0 eventos `securitypolicyviolation` y 0 errores no capturados

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

### Requirement: Escala y origen
El sistema SHALL pintar cada sprite con arte con un tamaño en pantalla de ancho de frame × escala por alto de frame
× escala, con su origen en la posición del elemento en el snapshot, sea cual sea su radio. La hitbox del snapshot
no cambia por el tamaño visual.

#### Scenario: Escala independiente de la hitbox
- **GIVEN** un aspecto de `goblin-tnt` con frame de 192 × 192 px, escala 0,5 y origen (0,5; 0,75), y un
  `goblin-tnt` de radio 22 en (400, 300)
- **WHEN** se pinta el snapshot
- **THEN** el sprite mide 96 × 96 px y el punto del sprite en (0,5; 0,75) de su tamaño está en (400, 300)
  (error ≤ 0,001)
- **AND** con el mismo aspecto, un `goblin-tnt` de radio 30 también mide 96 × 96 px

### Requirement: Animación por estado del jugador y de los enemigos
El sistema SHALL animar el sprite del jugador y el de cada enemigo vivo según su estado:
- un enemigo cuyo estado de comportamiento en el snapshot pintado es de clase mecha reproduce `fuse`, y uno de clase
  carga reproduce `throw`, sin importar si se mueve; al entrar en uno de esos estados la animación empieza en su
  primer frame;
- en el resto de casos (jugador, y enemigos en persecución, espera, patrulla, alerta o vuelta), el estado se deduce
  al comparar el snapshot pintado con el último snapshot pintado de un tick distinto de la misma partida: se mueve si
  su posición ha cambiado más de 0,001 px y reproduce `walk`; si no, reproduce `idle`;
- cada animación avanza a sus fps en tiempo de render y, en bucle, vuelve al primer frame al acabar; sin bucle, se
  queda en su último frame.

Un frame que repite el tick del anterior MUST conservar el estado y la orientación de cada sprite. Un enemigo en su
primer frame pintado (recién aparecido, recién nacido o en un hueco reutilizado) y el jugador en el primer frame de
una partida nueva MUST NOT heredar estado ni orientación de otro elemento o de una partida anterior: se pintan en
`idle` y sin voltear (o en `fuse` o `throw` si su estado de comportamiento lo pide). Con el mundo detenido ninguna
animación avanza. Con la partida terminada, el jugador se pinta en `idle` (el jugador no tiene animación de muerte).
La animación no cambia la simulación.

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

#### Scenario: Guardia que patrulla y lanza
- **GIVEN** un `goblin-tnt-guard` que se mueve en patrulla en los ticks n − 10 a n − 1, en alerta en los ticks n a
  n + 4 y entra en carga en el tick n + 5
- **WHEN** se pintan los snapshots de n − 10 a n + 5
- **THEN** reproduce `walk` en los frames de los ticks n − 9 a n + 4 y `throw` desde su primer frame en el del tick
  n + 5

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

### Requirement: Orientación
El sistema SHALL orientar los sprites según el desplazamiento (Δx, Δy) entre el snapshot pintado y el último
snapshot pintado de un tick distinto:
- jugador y enemigos: con Δx < −0,001 miran a la izquierda, con Δx > 0,001 a la derecha y, si no, conservan la
  orientación anterior. Mirar a un lado es voltear horizontalmente el dibujo si su orientación sin voltear es la
  contraria, y no voltearlo si coincide. El volteo no cambia la posición ni el tamaño del sprite;
- proyectiles: el sprite rota al ángulo atan2(Δy, Δx) (más π si el dibujo mira a la izquierda), con error
  ≤ 0,01 rad. En su primer frame, sin desplazamiento previo, la rotación es 0 (π si el dibujo mira a la izquierda);
- gemas y fondo: sin volteo ni rotación.

#### Scenario: Jugador que gira
- **GIVEN** un aspecto del jugador cuyo dibujo mira a la derecha
- **WHEN** se pintan 10 frames con input (−1, 0), después 10 con input (0, 1) y después 10 con input (1, 0)
- **THEN** está volteado desde el primer frame en que se mueve a la izquierda hasta el último con input (0, 1), y
  sin voltear desde el primer frame en que se mueve a la derecha

#### Scenario: Dibujo que mira a la izquierda
- **GIVEN** un aspecto de `goblin-barrel` cuyo dibujo mira a la izquierda y un `goblin-barrel` que se
  mueve con Δx = −1,5 por frame
- **WHEN** se pintan 10 frames
- **THEN** el sprite no está volteado en ninguno
- **AND** si se mueve con Δx = +1,5, está volteado desde el segundo frame

#### Scenario: Primer frame de una partida nueva
- **GIVEN** una partida terminada cuyo jugador miraba a la izquierda, con un dibujo que mira a la derecha
- **WHEN** se pulsa R y se pinta el tick 0 de la partida nueva
- **THEN** el jugador no está volteado

#### Scenario: Rotación de la flecha
- **GIVEN** un proyectil del Linter, con un dibujo que mira a la derecha, creado con dirección (0, 1) y pintado en
  5 frames consecutivos con un tick cada uno
- **WHEN** se lee su rotación en cada frame
- **THEN** vale 0 en el primero y π/2 (error ≤ 0,01 rad) del segundo al quinto
- **AND** con dirección (−0,6; 0,8) vale atan2(0,8; −0,6) del segundo al quinto

### Requirement: Animación de muerte de los enemigos
El sistema SHALL, cuando un enemigo pintado en el último frame queda dado de baja (su baja cuenta en las bajas, ver
`run-outcome`) y deja de figurar en el snapshot pintado, mostrar un cadáver con el aspecto de cadáver: reproduce una
vez `death` en la última posición pintada del enemigo, sin moverse, y deja de verse cuando el tiempo de render
acumulado desde su aparición alcanza nº de frames de `death` / fps segundos. Con el mundo detenido ese tiempo no
avanza. Dentro de una partida, un enemigo solo deja de figurar en el snapshot al ser dado de baja (los enemigos vivos
siguen en el snapshot terminado). MUST NOT producir cadáver:
- un elemento que deja de pintarse porque se cambia de partida (R o `Volver al menú`);
- un enemigo dado de baja que nunca llegó a pintarse (apareció y murió entre dos frames).

MUST NOT haber nunca más cadáveres visibles que el tope de cadáveres. Una baja con el tope lleno no produce cadáver
y los cadáveres en curso siguen hasta terminar. Varias bajas en el mismo frame se atienden en el orden de la lista
de enemigos del snapshot anterior hasta llenar el tope. Al terminar su animación el cadáver no deja ningún sprite
visible.

#### Scenario: Muerte y desaparición
- **GIVEN** un aspecto de cadáver con `death` de 6 frames a 15 fps (400 ms) y un `goblin-torch` pintado en (300, 200)
  que muere en el tick T
- **WHEN** se pinta el snapshot del tick T (frame 1) y los 30 frames siguientes
- **THEN** el snapshot del tick T no contiene al `goblin-torch` y no hay sprite de enemigo para él
- **AND** hay 1 cadáver visible en (300, 200) (error ≤ 0,001) al menos en los frames 1 a 23 y ninguno desde el
  frame 26

#### Scenario: Pulso que mata a varios en el mismo tick
- **GIVEN** un tope de cadáveres 64, 0 cadáveres en curso y un pulso de Tests que da de baja a 5 enemigos en el
  tick T
- **WHEN** se pinta el snapshot del tick T
- **THEN** hay 5 cadáveres visibles, cada uno en la última posición pintada de uno de los 5 enemigos

#### Scenario: Tope de cadáveres
- **GIVEN** un tope de cadáveres 64, 60 cadáveres en curso y 7 bajas en el frame siguiente, de los enemigos e1 a
  e7 en el orden de la lista
- **WHEN** se pinta ese frame
- **THEN** hay exactamente 64 cadáveres visibles: los 60 anteriores y los de e1 a e4
- **AND** e5, e6 y e7 no muestran cadáver ni sprite de enemigo, y no hay errores no capturados

#### Scenario: Tope de un cadáver
- **GIVEN** un tope de cadáveres 1, 1 cadáver en curso al que le quedan 100 ms y una baja en el frame siguiente
- **WHEN** se pinta ese frame y los 30 siguientes
- **THEN** hay 1 cadáver visible hasta que termina el primero y la segunda baja no muestra cadáver en ningún frame

#### Scenario: Fin de la partida
- **GIVEN** una partida que termina en el tick n con 8 enemigos en el snapshot pintado del tick n − 1, de los que
  2 quedan dados de baja en el tick n (las bajas suben en 2)
- **WHEN** se pinta el snapshot terminado del tick n y los 60 frames siguientes
- **THEN** en el frame del tick n aparecen exactamente 2 cadáveres y hay 6 sprites de enemigo, uno por cada enemigo
  del snapshot terminado
- **AND** en los 60 frames siguientes siguen visibles esos 6 sprites y no aparece ningún cadáver nuevo

#### Scenario: Salidas iguales a bajas
- **GIVEN** el contenido por defecto, la semilla 42 y 1.200 ticks agrupados en frames de 1 tick y, en otra
  ejecución, de 8 ticks
- **WHEN** se compara cada par de snapshots pintados consecutivos
- **THEN** en todos los pares el número de ids de enemigo que dejan de figurar es igual al aumento de las bajas

#### Scenario: Muerte a velocidad acelerada
- **GIVEN** `?e2e&speed=8` y un `goblin-torch` pintado en (300, 200) en el frame f que muere en el segundo de los 8
  ticks del frame f + 1
- **WHEN** se pinta el frame f + 1
- **THEN** hay 1 cadáver en (300, 200)

#### Scenario: Cadáver con el mundo detenido
- **GIVEN** el cadáver de "Muerte y desaparición" con 200 ms transcurridos y la partida en pausa
- **WHEN** se pintan 300 frames en pausa, se reanuda y se pintan 30 frames más
- **THEN** el cadáver es visible en los 300 frames de pausa y, tras reanudar, deja de verse entre los frames 11 y 14

#### Scenario: Muerte con aspecto de reserva
- **GIVEN** la hoja del cadáver sin cargar y su `death` de 6 frames a 15 fps
- **WHEN** muere un enemigo y se pintan 30 frames
- **THEN** su cadáver se ve con el aspecto de reserva al menos en los frames 1 a 23 y no desde el frame 26

### Requirement: Limpieza de la vista al cambiar de partida
El sistema SHALL, en el primer frame de una partida nueva tras R (ver `run-results`) y en el primer frame del menú
tras `Volver al menú` (ver `main-menu`), no dejar visible ningún cadáver ni ningún sprite de jugador, enemigo,
proyectil, pulso, recogible de cualquier tipo, veta, dinamita o explosión, ni ningún aviso, que no corresponda al
snapshot pintado (en el menú, ninguno). Los cadáveres y las explosiones en curso se descartan sin terminar su animación
y no reaparecen después. Cerrar la escena de la partida a mitad de una animación MUST NOT dejar animaciones en curso ni
errores no capturados.

#### Scenario: R con cadáveres en curso
- **GIVEN** una partida terminada ya pintada con 10 cadáveres en curso, 15 enemigos, 40 gemas, 5 recogibles `gold`,
  6 `wood`, 2 dinamitas, 3 avisos y 1 explosión, con el mapa vacío
- **WHEN** se pulsa R y se pintan el tick 0 de la partida nueva y los 60 frames siguientes
- **THEN** hay 0 cadáveres visibles en todos esos frames y, en el primero, 1 sprite de jugador y 0 de enemigo,
  proyectil, pulso, recogible, veta, dinamita, aviso y explosión

#### Scenario: R con el mapa real
- **GIVEN** una partida terminada con el mapa real de la semilla 42, con vetas agotadas y recogibles `gold` en el suelo
- **WHEN** se pulsa R (partida nueva con la semilla 43) y se pinta su primer frame
- **THEN** los sprites de recogible visibles son exactamente los montones de la semilla 43, todas las vetas pintadas
  son las de la semilla 43 y están activas, y no queda visible ninguna de la partida anterior

#### Scenario: Volver al menú con cadáveres en curso
- **GIVEN** `?e2e&seed=7` y una partida que se pausa en el primer frame en que la sonda informa de ≥ 1 cadáver
- **WHEN** se pulsa `Volver al menú`, se pintan 60 frames en el menú y después se pulsa `Jugar`
- **THEN** en los 60 frames del menú la sonda informa de 0 sprites de jugador, enemigo, cadáver, proyectil, pulso,
  recogible de cada tipo, veta, dinamita, aviso y explosión
- **AND** en el primer frame de la partida nueva hay 0 cadáveres y no hay errores no capturados

### Requirement: Proyectiles, gemas, pulso y fondo
El sistema SHALL pintar un sprite de flecha por cada proyectil del snapshot y un sprite de recogible por cada
recogible, de los tres tipos, en su posición (error ≤ 0,001) y con el aspecto de su tipo del repositorio (ver
"Aspectos de los recogibles y de las vetas"), ambos en `idle` (la gema sin hoja, como su forma de color). Los
recogibles de los tres tipos van en la capa (6) de "Capas del mapa y de las entidades", donde iban las gemas. El pulso
de Tests no usa datos de aspecto: conserva su anillo (ver `auto-weapons`). Mientras existe una partida, el fondo de
hierba MUST cubrir el mundo entero, (0, 0)–(ancho, alto) en coordenadas de mundo ((0, 0)–(3.840, 2.160) con el
contenido por defecto), quedar por debajo de todos los demás elementos, incluidas las celdas pintadas del mapa, y estar
fijo en el mundo: su posición de mundo no cambia entre snapshots ni al redimensionar la ventana y su posición en
pantalla solo cambia con el rectángulo visible de la cámara (ver `world-camera`). En ningún frame de una partida, con
ninguna ventana, MUST verse dentro del rectángulo visible una zona sin fondo. Esta spec no fija si el fondo se ve en
modo menú.

#### Scenario: Flechas y gemas
- **GIVEN** un snapshot con 3 proyectiles y 4 gemas
- **WHEN** se pinta el snapshot
- **THEN** hay 3 sprites de proyectil con el aspecto del proyectil y 4 de gema con el aspecto de la gema, cada uno
  en la posición de un elemento distinto del snapshot

#### Scenario: Recogibles de los tres tipos
- **GIVEN** un snapshot con 4 gemas, 2 recogibles `gold` y 3 `wood`
- **WHEN** se pinta el snapshot
- **THEN** hay 4 sprites con el aspecto `xp`, 2 con el aspecto `gold` (`G_Idle`) y 3 con el aspecto `wood` (`W_Idle`),
  cada uno en la posición de un recogible distinto de su tipo
- **AND** ningún sprite de gema usa la hoja `G_Idle`

#### Scenario: Pulso sin sprite
- **GIVEN** un snapshot con 1 pulso de radio 90 en (480, 270)
- **WHEN** se pinta el snapshot
- **THEN** hay 1 anillo de radio 90 centrado en (480, 270) y ningún sprite de hoja para el pulso

#### Scenario: Fondo de hierba en el mundo entero
- **GIVEN** el mundo por defecto y una partida en curso con el jugador en (1.920, 1.080) y, después, en (100, 100)
- **WHEN** se pinta cada snapshot
- **THEN** en ambos el fondo cubre el rectángulo de mundo (0, 0)–(3.840, 2.160), está por debajo de las celdas
  pintadas del mapa, el jugador, los enemigos, los cadáveres, los proyectiles, los pulsos y los recogibles, y su
  posición de mundo es la misma

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

### Requirement: Sonda de render para E2E
El sistema SHALL exponer, solo con `?e2e` y como parte de la sonda `window.__sprint`, en el último frame pintado:
- el recuento de sprites visibles por tipo: fondo, jugador, enemigo vivo, cadáver, proyectil, pulso, gema (recogible
  `xp`), recogible `gold`, recogible `wood`, dinamita, aviso y explosión; y por tipo y por aspecto de enemigo, de
  recogible, de dinamita y de explosión, cuántos usan aspecto de reserva (los avisos nunca, ni la gema sin hoja);
- por clase de estado de comportamiento (persecución, mecha, carga, espera, patrulla, alerta y vuelta), cuántos
  sprites de enemigo vivo hay;
- el número de celdas del mapa pintadas por tipo (`trunk`, `water`, `bridge`, `castle`), con arte o con reserva;
- por elemento del mapa, cuántos se pintan y cuántos de ellos con reserva: agua (celdas `water`), orilla (celdas de
  orilla con su pieza), espuma (celdas de orilla con espuma), árbol (celdas `trunk`), copa (árboles con copa), puente
  (celdas `bridge`) y castillo (0 o 1);
- por tipo de estructura, cuántas se pintan intactas, cuántas como ruina y cuántas de ellas con reserva;
- cuántas vetas se pintan activas, cuántas agotadas y cuántas de ellas con reserva;
- el número de objetos de escena usados para pintar el mapa, estructuras y vetas incluidas;
- el número de esos objetos **dibujados** en el último frame (`drawn`, ver "Recorte del arte del mapa por cámara"),
  con 0 ≤ `drawn` ≤ objetos del mapa.

Los recuentos de celdas pintadas, de elementos del mapa, de estructuras y de vetas (pintados y con reserva) y de
objetos del mapa son del plan entero de la partida: MUST NOT depender de la cámara, de la ventana ni del recorte. Los de
celdas, de elementos del mapa y de estructuras conservan el significado y el valor que tenían antes de este change para
la misma semilla y el mismo contenido; el de objetos del mapa es el de antes más los objetos de las vetas. Solo `drawn`
depende del recorte. Los peligros y los recogibles (montones incluidos) no forman parte del plan del mapa ni de sus
objetos.

Un sprite oculto por el parpadeo cuenta como no visible. En modo menú los recuentos de jugador, enemigo, cadáver,
proyectil, pulso, recogibles de cada tipo, dinamita, aviso, explosión, celdas del mapa, elementos del mapa,
estructuras, vetas, objetos del mapa y `drawn` valen 0. Sin `?e2e` MUST NOT existir. Leer la sonda MUST NOT cambiar la
simulación ni lo que se pinta.

#### Scenario: Recuento coherente con el snapshot
- **GIVEN** `?e2e&seed=42` y una partida en curso
- **WHEN** se pintan 600 frames y en cada uno se leen la sonda de render y el snapshot pintado
- **THEN** en cada frame los sprites visibles de enemigo, proyectil, pulso, dinamita, aviso y explosión son iguales en
  número a los enemigos, proyectiles, pulsos, dinamitas, avisos y explosiones del snapshot, los de gema, `gold` y
  `wood` a los recogibles de cada tipo del snapshot, y el de jugador vale 1 salvo en los frames en que el parpadeo lo
  oculta, que vale 0
- **AND** los sprites de enemigo por clase de estado coinciden con los enemigos del snapshot en cada clase
- **AND** las vetas pintadas activas y agotadas coinciden con las del snapshot en cada estado
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

#### Scenario: Estructuras y guardias en el navegador [E2E]
- **GIVEN** la build de producción servida con `?e2e&manual&seed=42` (mapa real), sin input de movimiento y con la
  política de elección fija
- **WHEN** arranca la partida, se lee la sonda, y después se avanza con `step(n)` hasta superar en 1 tick el
  intervalo de nacimiento de `goblin-house` y se lee la sonda de nuevo
- **THEN** en ambas lecturas las estructuras pintadas intactas y como ruina, por tipo, son iguales a las no
  destruidas y destruidas del snapshot, y ninguna usa reserva
- **AND** en la segunda lectura hay ≥ 1 sprite de enemigo en patrulla, sin aspecto de reserva, y no hay errores no
  capturados
- **AND** en ambas lecturas los sprites `wood` y las vetas pintadas activas son iguales a los montones y las vetas
  activas del snapshot, sin reserva

#### Scenario: Totales del mapa con estructuras y vetas
- **GIVEN** el contenido por defecto y las semillas 42 y 123
- **WHEN** se calcula el plan del mapa y los recuentos de la sonda, con una ventana de 960 × 540, de 1.280 × 720 y
  de 3.840 × 2.160, y con el jugador en el centro del mundo y en (16, 16)
- **THEN** en todos los casos las celdas pintadas por tipo, los elementos del mapa pintados y con reserva, las
  estructuras pintadas, las vetas pintadas y los objetos del mapa son iguales entre sí
- **AND** las celdas pintadas por tipo, los elementos del mapa y las estructuras son iguales a los de antes de este
  change, y los objetos del mapa son los de antes (695 y 778 respectivamente) más los de las vetas de cada semilla,
  ≤ 1.000

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
- **THEN** en cada frame `drawn` es igual al número de objetos del plan, estructuras y vetas incluidas, que da
  "Recorte del arte del mapa por cámara" con el rectángulo visible de ese frame

#### Scenario: Sonda en el menú
- **GIVEN** `?e2e&seed=42` y el menú tras `Volver al menú`
- **WHEN** se pinta 1 frame y se lee la sonda de render
- **THEN** los recuentos de jugador, enemigo, cadáver, proyectil, pulso, gema, `gold`, `wood`, dinamita, aviso,
  explosión, celdas del mapa, elementos del mapa, estructuras, vetas, objetos del mapa y `drawn` valen 0

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
- **THEN** la sonda informa de 0 celdas pintadas de cada tipo, 0 elementos del mapa, `drawn` 0 y 1 sprite de fondo

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
(5) el tronco de cada árbol, la fachada del castillo y la parte baja de cada estructura (o su rectángulo de reserva);
(6) cadáveres, gemas, pulsos, jugador, enemigos y proyectiles, con su orden relativo de antes de este change; (7) las
copas de los árboles, el tejado del castillo y la parte alta de cada estructura; (8) la **capa de peligros**: avisos,
dinamitas y explosiones, en ese orden; (9) el HUD y los overlays, fijos en pantalla (ver `world-camera`). La **copa**
es la parte del dibujo del árbol situada por encima del borde superior de su celda y el **tronco**, el resto. El
**tejado** es la parte del dibujo del castillo situada por encima del borde superior de la fila inferior de la huella
y la **fachada**, el resto. Las partes baja y alta de una estructura son las de "Pintado de las estructuras". Las
partes se separan con un error ≤ 1 px. Así, una entidad al sur de un árbol, ante la puerta del castillo o ante una
casa se ve delante, y una que pasa detrás de una copa, sobre el tejado o detrás de una casa queda tapada; un aviso,
una dinamita o una explosión se ven siempre sobre el mapa, las estructuras y las entidades y bajo el HUD. El orden de
capas MUST mantenerse tras cualquier redimensionado de la ventana.

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

#### Scenario: Guardia ante la casa
- **GIVEN** la casa de prueba (fila inferior en y [720, 780]), un guardia en su puerta (1.290, 810) y el jugador en
  (1.260, 700), detrás de la casa
- **WHEN** se pinta el snapshot
- **THEN** la parte baja de la casa (y ≥ 720) está por debajo de los sprites del guardia y del jugador, y la parte
  alta (y < 720) por encima de ambos y por debajo del HUD
- **AND** con la casa destruida se cumple lo mismo con las partes de su ruina

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

#### Scenario: Fps con el mapa real [realtime]
- **GIVEN** `CI_LIKE=1` y la medición de fps del proyecto `realtime` con las semillas 42 y 123 y el mapa real
- **WHEN** se ejecutan 3 pasadas y se toma la mediana
- **THEN** se informa del fps de cada semilla, de su porcentaje sobre 21,6 y 21,9 fps y de su diferencia con 14,1 y
  12,9 fps respectivamente

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

#### Scenario: Caja que toca el borde
- **GIVEN** el rectángulo visible (1.280, 720)–(2.560, 1.440) y, en un caso cada vez, M = 0 con cajas
  D (2.560, 800)–(2.620, 860) y E (2.561, 800)–(2.621, 860), y M = 60 con cajas F (2.620, 800)–(2.680, 860) y
  G (2.621, 800)–(2.681, 860)
- **WHEN** se aplica la regla de recorte
- **THEN** se dibujan D y F y no se dibujan E ni G
- **AND** lo mismo ocurre, con las cajas reflejadas, en los bordes izquierdo, superior e inferior

#### Scenario: Vista que crece con la ventana
- **GIVEN** el mundo por defecto, el jugador en (1.920, 1.080), M = 60 y una caja H (2.700, 800)–(2.760, 860)
- **WHEN** se aplica la regla con una ventana de 1.280 × 720 (rectángulo visible (1.280, 720)–(2.560, 1.440)) y
  después con una de 3.840 × 2.160 (vista 2.560 × 1.440, rectángulo visible (640, 360)–(3.200, 1.800))
- **THEN** H no se dibuja con la primera y sí con la segunda
- **AND** con una ventana de 960 × 540 (rectángulo visible (1.440, 810)–(2.400, 1.350)) H no se dibuja y la caja
  A (1.500, 900)–(1.560, 960) sí

#### Scenario: Vista recortada al mundo en una esquina
- **GIVEN** el mundo por defecto, una ventana de 1.280 × 720, el jugador en (16, 16) (rectángulo visible
  (0, 0)–(1.280, 720), no (−624, −344)–(656, 376)), M = 60 y las cajas I (1.300, 100)–(1.360, 160) y
  J (1.341, 100)–(1.400, 160)
- **WHEN** se aplica la regla de recorte
- **THEN** se dibuja I y no se dibuja J
- **AND** con el jugador en (3.824, 2.144) (rectángulo visible (2.560, 1.440)–(3.840, 2.160)) se dibuja la caja
  (2.440, 1.320)–(2.500, 1.380) (toca la esquina del rectángulo de recorte) y no la (2.439, 1.319)–(2.499, 1.379)

#### Scenario: Partes del castillo por separado
- **GIVEN** el contenido por defecto, la semilla 42 (dibujo del castillo (1.800, 900)–(2.100, 1.140): tejado
  (1.800, 900)–(2.100, 1.080) y fachada (1.800, 1.080)–(2.100, 1.140)), M el del juego y un rectángulo visible de
  1.280 × 720 con x en [1.280, 2.560] cuyo borde inferior está en y = 1.080 − M − 1, y en otro caso en y = 900 − M
  (si M > 179 el caso se construye con la misma regla y un rectángulo de recorte equivalente, sin cámara)
- **WHEN** se aplica la regla de recorte al plan del mapa
- **THEN** en el primer caso se dibuja el tejado y no la fachada; en el segundo se dibuja el tejado (toca el borde) y
  no la fachada
- **AND** con el borde inferior en y = 900 − M − 1 no se dibuja ninguna de las dos partes

#### Scenario: Todo el plan se puede ver
- **GIVEN** el contenido por defecto, las semillas 42 y 123, M el del juego y las ventanas de 960 × 540, 1.280 × 720
  y 3.840 × 2.160
- **WHEN** se aplica la regla con el rectángulo visible de cada posición del jugador de una rejilla de paso 60 px que
  cubre el mundo, (0, 0)–(3.840, 2.160) con ambos extremos incluidos
- **THEN** para cada semilla y ventana, la unión de los objetos dibujados es el plan entero (ningún objeto queda sin
  dibujarse en todas las posiciones) y cada caja intersecta el mundo

#### Scenario: Vista que cubre el mundo entero
- **GIVEN** un mundo de 2.560 × 1.440 con un mapa de ≥ 1 objeto, una ventana de 2.560 × 1.440 y el jugador en
  (16, 16)
- **WHEN** se aplica la regla de recorte
- **THEN** se dibujan todos los objetos del plan

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

#### Scenario: Salto de varios ticks en un frame
- **GIVEN** el escenario anterior a 15 ticks por frame (`speed` máxima)
- **WHEN** se pinta cada snapshot
- **THEN** en cada frame todo objeto del plan cuya caja intersecta el rectángulo visible de ese frame está dibujado

#### Scenario: Espuma al reaparecer
- **GIVEN** una espuma S dibujada en el frame f, que deja de dibujarse en el f + 1 porque la cámara se aleja, mientras
  las demás espumas dibujadas avanzan su animación, y que vuelve a dibujarse en el frame f + 40
- **WHEN** se pinta el frame f + 40
- **THEN** S muestra el mismo frame de `idle` que las espumas que siguieron dibujadas en f + 40

#### Scenario: Pausa, oferta y partida terminada
- **GIVEN** una partida con el mapa real en pausa en el tick 500, después con una oferta abierta y después terminada
- **WHEN** se pintan 300 frames en cada estado
- **THEN** en cada estado el conjunto de objetos dibujados es el mismo en los 300 frames (la cámara no se mueve)

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

#### Scenario: Redimensionado
- **GIVEN** una partida con el mapa real de la semilla 42, el jugador en (1.920, 1.080) y una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 3.840 × 2.160 y se pinta 1 frame, y después vuelve a 960 × 540 y se pinta 1 frame
- **THEN** en cada uno de esos frames los objetos dibujados son los que da la regla con el rectángulo visible de ese
  frame ((640, 360)–(3.200, 1.800) y (1.440, 810)–(2.400, 1.350) respectivamente)
- **AND** el número de objetos dibujados en el primero es ≥ el del frame anterior al cambio y en el segundo, ≤

#### Scenario: Volver al menú y jugar
- **GIVEN** una partida con el mapa real de la semilla 42 en pausa con el jugador lejos del centro
- **WHEN** se pulsa `Volver al menú`, se pintan 60 frames en el menú, se pulsa `Jugar` y se pinta el primer frame
- **THEN** en los 60 frames del menú no se dibuja ningún objeto del mapa
- **AND** en el primer frame de la partida nueva los objetos dibujados son los que da la regla con su plan y su
  rectángulo visible

#### Scenario: Mapa vacío
- **GIVEN** una partida con el mapa vacío
- **WHEN** se pinta cualquier frame
- **THEN** se dibujan 0 objetos del mapa

#### Scenario: Recorte con aspecto de reserva
- **GIVEN** el contenido por defecto, la semilla 42, una ventana de 1.280 × 720 y, en un caso cada vez, sin cargar la
  hoja del agua, la del árbol, la del puente o la del castillo, y en otro caso sin cargar ninguna de las cinco hojas
  del mapa
- **WHEN** se pinta el primer frame y, después, el de una posición del jugador a ≥ 1.280 px en x de la inicial
- **THEN** los rectángulos de reserva se recortan con la misma regla que el arte: en cada frame se dibujan
  exactamente los objetos del plan (arte y reserva) que da la regla con el rectángulo visible de ese frame
- **AND** los recuentos de reserva de la sonda son los del plan entero, iguales a los de antes de este change

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

### Requirement: Pintado de las estructuras
El sistema SHALL pintar, mientras existe una partida, cada estructura de su snapshot (ver `goblin-structures`) fija en
el mundo, con su origen en el punto medio del borde inferior de su huella (error ≤ 1 px):
- una estructura no destruida, con el aspecto intacto de su tipo (`Goblin_House` en la casa, `Wood_Tower_<color>` en
  la torre);
- una estructura destruida, con el aspecto de ruina de su tipo (`Goblin_House_Destroyed`, `Wood_Tower_Destroyed`),
  desde el primer frame que pinta un snapshot en el que figura destruida y hasta el final de la partida, sin dejar
  visible su aspecto intacto.

La **parte baja** del dibujo es la situada por debajo del borde superior de la fila inferior de la huella y la **parte
alta**, el resto; se separan con un error ≤ 1 px y van en las capas de "Capas del mapa y de las entidades".

**Reserva**: si la hoja de un aspecto de estructura falla al cargar o no contiene su frame, las estructuras con ese
aspecto, y solo ellas, se pintan como un rectángulo relleno que cubre exactamente su huella (error ≤ 1 px), sin parte
alta, con el color de su tipo si no está destruida o con el color de ruina si lo está, sin errores no capturados. Los
datos de aspecto tienen un color `#RRGGBB` para `goblin-house`, otro para `goblin-tower` y otro para la ruina, distintos
dos a dos y distintos de los colores del mapa (`trunk`, `water`, `bridge`, `castle`); un color ausente, con otro
formato o repetido MUST hacer fallar el arranque con un error que nombre el campo.

Los objetos de escena de las estructuras cuentan como objetos del mapa en la sonda (ver "Sonda de render para E2E") y
se recortan con la regla de "Recorte del arte del mapa por cámara". Con el contenido por defecto y las semillas 42 y
123, el total de objetos del mapa, estructuras incluidas, MUST ser ≤ 1.000 (comprobado por un test sin navegador del
plan de pintado). Con el mapa vacío no se pinta ninguna estructura; en modo menú no se ve ninguna; al empezar una
partida nueva no queda visible ninguna estructura de la anterior. Pintar las estructuras MUST NOT cambiar la
simulación.

#### Scenario: Casa en su sitio
- **GIVEN** la casa de prueba sin destruir y los datos de aspecto del repositorio con todas las hojas cargadas
- **WHEN** se pinta el snapshot
- **THEN** el dibujo de la casa tiene su origen en (1.260, 780) (error ≤ 1 px) y usa la hoja `Goblin_House`
- **AND** su parte baja es la parte del dibujo con y ≥ 720 y su parte alta la de y < 720

#### Scenario: Ruina tras la destrucción
- **GIVEN** la casa de prueba pintada sin destruir en el frame del tick n − 1 y destruida en el snapshot del tick n
- **WHEN** se pintan los snapshots de n a n + 60
- **THEN** desde el frame del tick n la casa se pinta con la hoja `Goblin_House_Destroyed`, con el mismo origen, y en
  ninguno de esos frames se ve la hoja `Goblin_House`

#### Scenario: Reserva de las estructuras
- **GIVEN** la casa de prueba sin destruir, una torre explícita destruida con huella en columnas 40–41 y filas 5–6, y,
  en un caso cada vez, sin cargar la hoja `Goblin_House` o la hoja `Wood_Tower_Destroyed`
- **WHEN** se pinta el snapshot
- **THEN** respectivamente: la casa es 1 rectángulo del color de `goblin-house` sobre (1.200, 600)–(1.320, 780) y la
  torre se pinta con su hoja de ruina; o la torre es 1 rectángulo del color de ruina sobre (2.400, 300)–(2.520, 420) y
  la casa se pinta con su hoja intacta
- **AND** en cada caso no hay parte alta en la estructura de reserva y no hay errores no capturados

#### Scenario: Colores de estructuras inválidos
- **GIVEN** los datos de aspecto del repositorio con, en un caso cada vez: el color de `goblin-tower` igual a
  `"#12345"`; sin el color de ruina; el color de `goblin-house` igual al de ruina; o el color de `goblin-house` igual
  al de `trunk`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `goblin-tower`, la ruina, `goblin-house` y `goblin-house`
  respectivamente
- **AND** no se muestra el menú ni empieza ninguna partida

#### Scenario: Presupuesto de objetos con estructuras
- **GIVEN** el contenido por defecto y las semillas 42 y 123
- **WHEN** se calcula el plan de pintado del mapa sin navegador
- **THEN** en ambas el número de objetos del mapa, estructuras incluidas, es ≤ 1.000
- **AND** cada estructura colocada por el núcleo tiene en el plan sus objetos, con el origen en el punto medio del
  borde inferior de su huella

#### Scenario: Sin estructuras en el mapa vacío ni tras R
- **GIVEN** una partida con el mapa real de la semilla 42 con ≥ 1 estructura pintada
- **WHEN** se pulsa R y se pinta el primer frame de una partida con el mapa vacío, y en otro caso con la semilla 43
- **THEN** con el mapa vacío no se pinta ninguna estructura y con la semilla 43 se pintan exactamente las del
  snapshot de la partida nueva, ninguna de la anterior

#### Scenario: Pintar no cambia la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick y
  la política de elección fija, una con los datos de aspecto del repositorio y otra con las hojas de las estructuras
  sin cargar
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick

### Requirement: Aspectos de los recogibles y de las vetas
El sistema SHALL definir en los datos de aspecto, validados con zod en el arranque con las reglas de "Datos de aspecto
validados":
- un aspecto por tipo de recogible: `xp` (la gema), `gold` y `wood`; los tipos con aspecto MUST ser exactamente los
  de la unión de tipos de recogible (ver "Recogibles con tipo" en `xp-gems`);
- un aspecto de veta activa y uno de veta agotada;
- un color de reserva `#RRGGBB` por tipo de recogible y uno para la veta, distintos dos a dos, distintos de los colores
  del mapa (`trunk`, `water`, `bridge`, `castle`) y de los de las estructuras.

Los aspectos `gold` y `wood` y los dos de veta tienen hoja y animación `idle`. El aspecto `xp` tiene una hoja del pack
distinta de las de `gold` y `wood` con animación `idle`, o bien se declara **sin hoja**, como forma de color con su
color de reserva; un aspecto `xp` sin hoja no cuenta nunca como reserva en la sonda (como los avisos) y no exige
`idle`. En pantalla, XP, oro y madera MUST ser distinguibles: hojas distintas o, si `xp` no tiene hoja, forma de color
frente a sprite. Un tipo sin aspecto, un aspecto de un tipo inexistente (por ejemplo `meat`), un color ausente, con
otro formato o repetido MUST hacer fallar el arranque con un error que nombre el tipo o el campo.

**Reserva**: si la hoja de un aspecto de recogible falla al cargar o no contiene su frame, los recogibles de ese tipo,
y solo ellos, se pintan con la forma rellena de "Aspecto de reserva ante un fallo de carga" con el color de su tipo;
si falla una hoja de veta, las vetas en ese estado se pintan como un círculo relleno del color de la veta, de radio su
radio de contacto, centrado en su posición. Ningún fallo rompe la partida ni produce errores no capturados.

#### Scenario: Datos del repositorio
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** hay aspecto para exactamente `xp`, `gold` y `wood`, aspecto de veta activa y de veta agotada, y colores de
  reserva para los tres tipos y para la veta, distintos dos a dos
- **AND** la hoja de `gold` es `G_Idle.png`, la de `wood` `W_Idle.png`, y la de `xp`, si la tiene, es otra distinta de
  ambas

#### Scenario: Datos inválidos
- **GIVEN** los datos del repositorio con, en un caso cada vez: sin aspecto `wood`; con un aspecto extra `meat`; sin
  aspecto de veta agotada; la escala de `gold` 0; el color de reserva de `wood` igual al de `gold`; o el color de la
  veta `"amarillo"`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `wood`, `meat`, la veta agotada, la escala de `gold`, el color de
  `wood` y el color de la veta respectivamente
- **AND** no se muestra el menú ni empieza ninguna partida

#### Scenario: Reserva de un tipo de recogible
- **GIVEN** un snapshot con 2 recogibles `xp`, 2 `gold` y 2 `wood` y la hoja de `wood` sin cargar
- **WHEN** se pinta el snapshot
- **THEN** los 2 `wood` son formas del color de `wood` de 10 px de diámetro (2 × `gemRadius`) centradas en su posición
  (error ≤ 0,001), y los `gold` y los `xp` se pintan con su aspecto del repositorio
- **AND** la sonda cuenta 2 recogibles `wood` con reserva y 0 de los otros dos tipos

### Requirement: Pintado de las vetas
El sistema SHALL pintar, mientras existe una partida, cada veta del snapshot fija en el mundo, con el origen de su
aspecto en la posición de la veta (error ≤ 1 px), en la capa (5) de "Capas del mapa y de las entidades" (bajo las
entidades):
- una veta activa, con el aspecto de veta activa (`GoldMine_Active`);
- una veta agotada, con el aspecto de veta agotada (`GoldMine_Inactive`), desde el primer frame que pinta un snapshot
  en el que figura agotada y hasta el final de la partida, sin dejar visible su aspecto activo.

Los objetos de escena de las vetas cuentan como objetos del mapa en la sonda (ver "Sonda de render para E2E") y se
recortan con la regla de "Recorte del arte del mapa por cámara" (también al cambiar de partida, de ventana y de modo).
Con el contenido por defecto y las semillas 42 y 123, el total de objetos del mapa, estructuras y vetas incluidas, MUST
ser ≤ 1.000 (comprobado por un test sin navegador del plan de pintado). Con el mapa vacío no se pinta ninguna veta; en
modo menú no se ve ninguna; al empezar una partida nueva no queda visible ninguna veta de la anterior. Pintar las vetas
MUST NOT cambiar la simulación.

#### Scenario: Veta activa en su sitio
- **GIVEN** el mapa vacío con una veta declarada activa en (1.000, 1.000) y todas las hojas cargadas
- **WHEN** se pinta el snapshot
- **THEN** el dibujo de la veta tiene su origen en (1.000, 1.000) (error ≤ 1 px), usa la hoja `GoldMine_Active` y está
  por debajo del sprite del jugador cuando este está encima

#### Scenario: Veta agotada
- **GIVEN** la veta del escenario anterior pintada activa en el frame del tick n − 1 y agotada en el snapshot del
  tick n
- **WHEN** se pintan los snapshots de n a n + 60
- **THEN** desde el frame del tick n la veta se pinta con la hoja `GoldMine_Inactive`, con el mismo origen, y en
  ninguno de esos frames se ve la hoja `GoldMine_Active`

#### Scenario: Vetas recortadas por cámara
- **GIVEN** el contenido por defecto, la semilla 42, una ventana de 1.280 × 720 y el jugador en (16, 16)
- **WHEN** se pinta un frame
- **THEN** cada veta cuya caja intersecta el rectángulo de recorte está dibujada y ninguna otra, y `drawn` es igual al
  número de objetos del plan, estructuras y vetas incluidas, que da la regla

#### Scenario: Tope de objetos con las vetas
- **GIVEN** el contenido por defecto y las semillas 42 y 123
- **WHEN** se calcula el plan del mapa sin navegador
- **THEN** los objetos del mapa son los de antes de este change (695 y 778 respectivamente) más los de las vetas de cada
  semilla, y el total es ≤ 1.000 en ambas

<!-- historial: 0012-sprite-rendering (2026-11-22) -->
<!-- historial: 0013-world-camera (2026-11-23) -->
<!-- historial: 0015-procedural-map (2026-11-23) -->
<!-- historial: 0016-map-art (2026-11-23) -->
<!-- historial: 0017-fullscreen-view (2026-11-24) -->
<!-- historial: 0018-map-culling (2026-11-24) -->
<!-- historial: 0020-enemy-behaviors (2026-11-24) -->
<!-- historial: 0021-goblin-camps (2026-11-24) -->
<!-- historial: 0022-resources-sheep (2026-11-24) -->
