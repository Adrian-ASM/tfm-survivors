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
- **árbol**: tamaño de frame, si admite volteo y la animación `idle` en bucle (ver "Animación del arte del mapa");
- **puente**: un recorte por orientación (norte-sur y este-oeste), cada uno con `x` e `y` enteros ≥ 0 y ancho y alto
  enteros ≥ 1 en píxeles de la hoja (la hoja no es regular);
- **castillo**: tamaño de frame y el índice de su frame;
- **decoración**: la lista de aspectos de decoración, el tope y la densidad de "Decoración del mapa generado".

Y los aspectos de las estructuras: por cada tipo de estructura de su contenido (ver `goblin-structures`), un aspecto
intacto y uno de ruina, con las reglas de los aspectos de entidades, y los colores de reserva de "Pintado de las
estructuras". Los tipos de estructura con aspecto MUST ser exactamente los del contenido de estructuras. La `idle` de
un aspecto intacto puede tener varios frames (la torre se anima, ver "Animación del arte del mapa").

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
  `idle` `[0, 1, 2, 3]` a 4 fps en bucle, de puente con sus 2 recortes y de castillo
- **AND** hay aspecto intacto y de ruina para exactamente `goblin-house` y `goblin-tower`, la `idle` intacta de
  `goblin-tower` tiene los frames `[0, 1, 2, 3]` a 5 fps en bucle, y hay colores de reserva de `goblin-house`,
  `goblin-tower` y ruina
- **AND** hay exactamente 11 aspectos de decoración, uno por hoja `Deco/01`, `02`, `03`, `07`, `08`, `09`, `10`, `11`,
  `16`, `17` y `18`, cada uno con 1 índice de frame que cabe en su hoja; son altos exactamente los de `16`, `17` y `18`;
  el tope de decoración vale 120 y la densidad 25

#### Scenario: Valores fuera de rango
- **GIVEN** los datos del repositorio con, en un caso cada vez en el aspecto de `goblin-torch`: ancho de frame 0,
  alto de frame 1,5, escala 0, escala −1, origen `x` 1,1, origen `y` −0,1, fps de `walk` 0, frames de `walk` `[]`,
  `[-1]` o `[1.5]`; en otro caso el tope de cadáveres 0 o 2,5; en otro la opacidad del aviso de dinamita 0, 1 o 1,2; y
  en otro la escala de la ruina de `goblin-house` 0
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo

#### Scenario: Datos del mapa inválidos
- **GIVEN** los datos del repositorio con, en un caso cada vez: la orilla sin el caso { norte }; el árbol sin `idle`,
  con `idle` sin bucle o con frames de `idle` `[]`; un campo extra `models` en el árbol; el recorte norte-sur del puente
  con ancho 0, con `x` −1 o con `y` 2,5; la espuma sin `idle` o con `idle` sin bucle; el castillo sin hoja; o un campo
  extra `rocks` en los aspectos del mapa
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra el caso { norte }, la `idle` del árbol (en los tres casos),
  `models`, el ancho, `x`, `y`, `idle`, `idle`, la hoja del castillo y `rocks` respectivamente
- **AND** no se muestra el menú ni empieza ninguna partida

#### Scenario: Rutas de hoja no admitidas
- **GIVEN** los datos del repositorio con la hoja de `goblin-torch` igual, en un caso cada vez, a `""`,
  `"../secreto.png"`, `"/torch.png"`, `"https://ejemplo.com/torch.png"`, `"data:image/png;base64,AAAA"`,
  `"torch.gif"` o una ruta `.png` que no figura en la nota de procedencia; y en otro caso la hoja del castillo, en
  otro la de la explosión, en otro la de la torre intacta y en otro la del aspecto de decoración de `Deco/09`, igual a
  una ruta `.png` que no figura en la nota
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra la hoja de `goblin-torch`, la del castillo, la de la explosión, la
  de `goblin-tower` y la de la decoración respectivamente

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
  aspectos de entidades y de estructuras multiplicadas por 2, los colores del mapa, de las estructuras y de los
  avisos cambiados y el tope de decoración 0
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
- la gema (recogible `xp`), con una hoja del pack distinta de `G_Idle.png`, `W_Idle.png` y de las hojas de aparición,
  o sin hoja (ver "Aspectos de los recogibles y de las vetas");
- el recogible `gold`, con `G_Idle.png` (bolsa de oro) y su aparición con `G_Spawn.png`; el recogible `wood`, con
  `W_Idle.png` y su aparición con `W_Spawn.png`; el `meat`, con `M_Idle.png` y su aparición con `M_Spawn.png`; el
  `stone`, con las rocas `Deco/04.png`, `Deco/05.png` y `Deco/06.png`, sin aparición;
- la oveja, con `HappySheep_Idle.png` y `HappySheep_Bouncing.png` (ver "Pintado de las ovejas");
- la veta activa, con `GoldMine_Active.png`, y la agotada, con `GoldMine_Inactive.png`;
- la dinamita, con `Dynamite.png` (de la carpeta de la unidad `TNT`); la explosión, con `Explosions.png`;
- el fondo, con un suelo de hierba del pack;
- el agua, con `Water.png`; la espuma, con `Foam.png`; los árboles, con `Tree.png`; los puentes, con
  `Bridge_All.png`; el castillo, con `Castle_Blue.png` (castillo azul, como el arquero); la orilla, con una hoja de
  terreno del pack;
- la casa, con `Goblin_House.png`, y su ruina, con `Goblin_House_Destroyed.png`; la torre, con un único
  `Wood_Tower_<color>.png`, y su ruina, con `Wood_Tower_Destroyed.png`;
- el solar libre, con `House_Construction.png`; la casa construida, con `House_Blue.png`, y la torre construida, con
  `Tower_Blue.png` (ver "Pintado de los solares y de los edificios");
- la decoración, con las hojas `Deco/01.png`, `Deco/02.png`, `Deco/03.png` (setas), `Deco/07.png`, `Deco/08.png`,
  `Deco/09.png` (arbustos), `Deco/10.png`, `Deco/11.png` (matas), `Deco/16.png` (cartel), `Deco/17.png` (poste) y
  `Deco/18.png` (espantapájaros), una hoja por aspecto de decoración.

Los avisos no usan hoja. La unidad o el elemento de cada hoja se comprueba con la ruta de origen que registra la nota
de procedencia (ver `asset-provenance`). Del pack solo se versionan las hojas que usan los datos de aspecto, como hoja
de un aspecto o de una animación de aparición (ningún otro color de castillo ni de torre, ni `Rocks`, ni `Fire.png`, ni
`Wood_Tower_InConstruction`, ni `GoldMine_Destroyed.png`, ni variantes `_(NoShadow)`, ni `HappySheep_All`, ni
`Deco/12`–`Deco/15`). Las rocas `Deco/04`–`06` son solo de la piedra recogible: ningún aspecto de decoración las usa.
Cambiar el arte de un elemento MUST requerir solo cambios de datos y de assets, no de código.

#### Scenario: Hoja de cada elemento
- **GIVEN** los datos de aspecto del repositorio y la nota de procedencia
- **WHEN** se busca en la nota la ruta de origen de la hoja de cada aspecto y de cada animación de aparición
- **THEN** la del jugador contiene `Archer`; las de `goblin-torch`, `goblin-tnt` y `goblin-barrel` contienen
  `Torch`, `TNT` y `Barrel` respectivamente y son tres ficheros distintos; la de `goblin-tnt-guard` es el mismo
  fichero que la de `goblin-tnt`; la del cadáver termina en `Dead.png` y la del proyectil en `Arrow.png`
- **AND** la de `gold` termina en `G_Idle.png`, la de `wood` en `W_Idle.png`, la de `xp`, si la tiene, en otro fichero
  distinto de ambos y de las hojas de aparición, y las de la veta activa y agotada en `GoldMine_Active.png` y
  `GoldMine_Inactive.png`
- **AND** las de aparición de `gold`, `wood` y `meat` terminan en `G_Spawn.png`, `W_Spawn.png` y `M_Spawn.png`
  respectivamente, y ni `stone` ni `xp` tienen hoja de aparición
- **AND** la de la dinamita contiene `TNT` y termina en `Dynamite.png`, y la de la explosión termina en
  `Explosions.png`
- **AND** las del agua, la espuma, el árbol, el puente y el castillo terminan en `Water.png`, `Foam.png`, `Tree.png`,
  `Bridge_All.png` y `Castle_Blue.png` respectivamente
- **AND** las de la casa y su ruina terminan en `Goblin_House.png` y `Goblin_House_Destroyed.png`, y las de la torre y
  su ruina en `Wood_Tower_<color>.png` y `Wood_Tower_Destroyed.png`
- **AND** las de los 11 aspectos de decoración terminan en `Deco/01.png`, `Deco/02.png`, `Deco/03.png`, `Deco/07.png`,
  `Deco/08.png`, `Deco/09.png`, `Deco/10.png`, `Deco/11.png`, `Deco/16.png`, `Deco/17.png` y `Deco/18.png`, una cada
  una, y ninguna es la hoja de una roca de la piedra
- **AND** todas las rutas de origen pertenecen a Tiny Swords Update 010

#### Scenario: Solo las hojas usadas
- **GIVEN** la lista de ficheros versionados y los datos de aspecto del repositorio
- **WHEN** se compara cada asset gráfico de la nota de procedencia con las hojas de los datos de aspecto
- **THEN** cada asset de la nota es la hoja de ≥ 1 aspecto o de ≥ 1 animación de aparición, y ningún fichero
  versionado contiene `Castle_Red`, `Castle_Yellow`, `Castle_Purple`, `Castle_Black`, `Rocks`, `Fire`,
  `Wood_Tower_InConstruction`, `GoldMine_Destroyed`, `NoShadow` ni `HappySheep_All`
- **AND** los assets gráficos versionados que contienen `_Spawn` son exactamente `G_Spawn.png`, `W_Spawn.png` y
  `M_Spawn.png`, cada uno 1 vez
- **AND** de `Wood_Tower_Red`, `Wood_Tower_Blue`, `Wood_Tower_Purple` y `Wood_Tower_Yellow` hay exactamente 1 fichero
  versionado, el de la hoja de la torre
- **AND** los ficheros versionados de la carpeta `Deco/` de los assets son exactamente `01`–`11` y `16`–`18` (`.png`),
  cada uno 1 vez, y ninguno de `12`–`15`

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
si esa hoja falla, todo el tipo se pinta con reserva. La **excepción** es la animación de aparición de un recogible
(`spawn`, con hoja propia): si su hoja falla o no contiene un frame de `spawn`, sus recogibles se pintan con su `idle`
sin aparición y no cuentan como reserva (ver "Aparición de oro, madera y carne"). Un recogible con aspecto de reserva
no flota ni reproduce aparición. Los avisos no tienen hoja y nunca cuentan como reserva. Los elementos del mapa tienen
su propia reserva por colores (ver "Pintado del mapa"): no cuentan como sprites con aspecto de reserva y no dependen de
la hoja del fondo, salvo la orilla si su hoja es la del fondo.

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

#### Scenario: Hoja de aparición que falla sin reserva
- **GIVEN** las hojas `G_Spawn`, `W_Spawn` y `M_Spawn` sin cargar y un snapshot con 1 recogible nuevo de cada uno de
  los tipos `gold`, `wood` y `meat`
- **WHEN** se pinta el snapshot
- **THEN** los 3 se pintan con su `idle` (`G_Idle`, `W_Idle`, `M_Idle`) y la sonda cuenta 0 recogibles con reserva
  de cada tipo, sin errores no capturados

### Requirement: Escala y origen
El sistema SHALL pintar cada sprite con arte con un tamaño en pantalla de ancho de frame × escala por alto de frame
× escala, con su origen en la posición del elemento en el snapshot, sea cual sea su radio; en un recogible que flota,
en su posición pintada (la del snapshot más su desplazamiento de flote, ver "Flote de los recogibles"). La aparición de
un recogible usa la escala y el origen del aspecto de su tipo. La gema sin hoja (forma de color) mide en pantalla el
diámetro de su aspecto, no 2 × `gemRadius`. La hitbox del snapshot no cambia por el tamaño visual.

#### Scenario: Escala independiente de la hitbox
- **GIVEN** un aspecto de `goblin-tnt` con frame de 192 × 192 px, escala 0,5 y origen (0,5; 0,75), y un
  `goblin-tnt` de radio 22 en (400, 300)
- **WHEN** se pinta el snapshot
- **THEN** el sprite mide 96 × 96 px y el punto del sprite en (0,5; 0,75) de su tamaño está en (400, 300)
  (error ≤ 0,001)
- **AND** con el mismo aspecto, un `goblin-tnt` de radio 30 también mide 96 × 96 px

#### Scenario: Tamaños de los recogibles del repositorio
- **GIVEN** los datos de aspecto del repositorio, todas las hojas cargadas, `gemRadius` 5 y `pickupRadius` 128, y un
  snapshot con 1 recogible de cada tipo, con piedras de las tres rocas
- **WHEN** se pinta el snapshot con los recogibles `gold`, `wood` y `meat` en su aparición y, en otro frame, en `idle`
- **THEN** los sprites de `gold`, `wood` y `meat` miden 64 × 64 px (128 × 0,5) en ambos frames, cada piedra mide
  0,75 × el tamaño de frame de su roca y la gema es una forma de 20 px de diámetro (error ≤ 0,001)
- **AND** `gemRadius` sigue en 5 y `pickupRadius` en 128

#### Scenario: Diámetro de la gema independiente de gemRadius
- **GIVEN** una gema sin hoja con diámetro de aspecto 20 y, en otro caso, un contenido de progresión con `gemRadius` 9
- **WHEN** se pinta una gema en (300, 200) con d = 0
- **THEN** en ambos casos es una forma de 20 px de diámetro centrada en (300, 200) (error ≤ 0,001)

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
animación del jugador ni de los enemigos avanza, y tampoco la de la espuma, los árboles ni las torres goblin
intactas (ver "Animación del arte del mapa"). Con la partida terminada, el jugador se pinta en `idle` (el jugador no
tiene animación de muerte). La animación no cambia la simulación.

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
- **THEN** en los 300 cada uno de esos sprites muestra el mismo frame de hoja que en el primer frame de la pausa
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
snapshot pintado (en el menú, ninguno). Los cadáveres, las explosiones y las apariciones de recogibles en curso (también
las que están en su retardo) se descartan sin terminar su animación y no reaparecen después. En la partida nueva cada
recogible empieza su aparición desde cero, con las reglas de "Aparición de oro, madera y carne" y de "Aparición
escalonada de los recogibles del inicio", aunque su id coincida con el de un recogible de la partida anterior. Cerrar la
escena de la partida a mitad de una animación MUST NOT dejar animaciones en curso ni errores no capturados.

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

#### Scenario: R con apariciones en curso
- **GIVEN** una partida con el mapa real de la semilla 42 cuyos 8 montones ya están en `idle` y 1 recogible `gold`
  mostrando el frame 3 de `spawn`, que termina
- **WHEN** se pulsa R con la misma semilla y se pinta el primer frame de la partida nueva con el reloj en R0
- **THEN** el montón de id 0 muestra el frame 0 de `spawn` y los de ids 1 a 7 no se ven (su retardo), ninguno en
  `idle`, y no hay ningún sprite `gold` visible

### Requirement: Proyectiles, gemas, pulso y fondo
El sistema SHALL pintar un sprite de flecha por cada proyectil del snapshot, en su posición (error ≤ 0,001) y en
`idle`, y un sprite de recogible por cada recogible, de los cinco tipos (`xp`, `gold`, `wood`, `meat` y `stone`), con el
aspecto de su tipo del repositorio (ver "Aspectos de los recogibles y de las vetas"), visible salvo durante su retardo
de aparición (ver "Aparición escalonada de los recogibles del inicio"): durante su aparición, en su posición del
snapshot y con su `spawn` (ver "Aparición de oro, madera y carne"); fuera de ella, en `idle` (la gema
sin hoja, como su forma de color) y en su posición del snapshot más su desplazamiento de flote (ver "Flote de los
recogibles"), en ambos casos con error ≤ 0,001; con aspecto de reserva, centrado en su posición del snapshot. Los
recogibles de los cinco tipos van en la capa (6) de "Capas del mapa y de las entidades", donde iban las gemas. El pulso
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
- **THEN** hay 3 sprites de proyectil con el aspecto del proyectil, cada uno en la posición de un proyectil distinto,
  y 4 de gema con el aspecto de la gema, cada uno en la x de una gema distinta y en su y más el desplazamiento de flote
  de su id (error ≤ 0,001)

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

#### Scenario: Recogibles de los cinco tipos
- **GIVEN** un snapshot con 4 gemas, 2 recogibles `gold`, 3 `wood`, 1 `meat` y 2 `stone`, todos en `idle`
- **WHEN** se pinta el snapshot
- **THEN** hay 4 sprites con el aspecto `xp`, 2 con el aspecto `gold` (`G_Idle`), 3 con el aspecto `wood` (`W_Idle`),
  1 con el aspecto `meat` (`M_Idle`) y 2 con el de la roca de su origen, cada uno en la x de un recogible distinto de su
  tipo y en su y más su desplazamiento de flote (ver "Flote de los recogibles", error ≤ 0,001)
- **AND** ningún sprite de gema usa la hoja `G_Idle` ni una hoja de aparición

### Requirement: Sonda de render para E2E
El sistema SHALL exponer, solo con `?e2e` y como parte de la sonda `window.__sprint`, en el último frame pintado:
- el recuento de sprites visibles por tipo: fondo, jugador, enemigo vivo, cadáver, oveja, proyectil, pulso, gema
  (recogible `xp`), recogible `gold`, recogible `wood`, recogible `meat`, recogible `stone` (`sprites.pickups.stone`,
  con `visible` y `placeholder`), dinamita, aviso y
  explosión; y por tipo y por aspecto de enemigo, de oveja, de recogible (en `stone`, sumando sus tres rocas), de
  dinamita y de explosión, cuántos usan aspecto de reserva (los avisos nunca, ni la gema sin hoja);
- por clase de estado de comportamiento (persecución, mecha, carga, espera, patrulla, alerta y vuelta), cuántos
  sprites de enemigo vivo hay, y por estado de oveja (`graze`, `wander` y `flee`), cuántos sprites de oveja hay;
- el número de celdas del mapa pintadas por tipo (`trunk`, `water`, `bridge`, `castle`), con arte o con reserva;
- por elemento del mapa, cuántos se pintan y cuántos de ellos con reserva: agua (celdas `water`), orilla (celdas de
  orilla con su pieza), espuma (celdas de orilla con espuma), árbol (celdas `trunk`), copa (árboles con copa), puente
  (celdas `bridge`) y castillo (0 o 1);
- de la decoración, `sprites.mapArt.decor` con `planned` (decoraciones del plan), `painted` (pintadas con su arte) y
  `unpainted` (no pintadas por fallo de su hoja), con `painted` + `unpainted` = `planned`;
- por tipo de estructura, cuántas se pintan intactas, cuántas como ruina y cuántas de ellas con reserva;
- cuántas vetas se pintan activas, cuántas agotadas y cuántas de ellas con reserva;
- el número de objetos de escena usados para pintar el mapa, estructuras, vetas, solares y decoración incluidos;
- el número de esos objetos **dibujados** en el último frame (`drawn`, ver "Recorte del arte del mapa por cámara"),
  con 0 ≤ `drawn` ≤ objetos del mapa.

Los recuentos de celdas pintadas, de elementos del mapa, de decoración, de estructuras y de vetas (pintados y con
reserva) y de objetos del mapa son del plan entero de la partida: MUST NOT depender de la cámara, de la ventana, del
recorte ni del reloj de render. Con el contenido por defecto, los objetos del mapa valen 820 y 904 con las semillas 42 y
123 (737 y 820 con el tope de decoración 0). Solo `drawn` depende del recorte. Los peligros, los recogibles (montones,
carne y piedras incluidos) y las ovejas no forman parte del plan del mapa ni de sus objetos.

Los recuentos `sprites.pickups.<tipo>` (`visible` y `placeholder`) conservan su significado: un recogible en su
aparición o flotando cuenta como visible; uno en su **retardo** de aparición (ver "Aparición escalonada de los
recogibles del inicio") no se ve y no cuenta como visible. Solo cuenta como reserva el que se pinta con su aspecto de
reserva (el fallo de una hoja de aparición no cuenta). Así, por tipo, `visible` = recogibles del snapshot − recogibles
en retardo; fuera del retardo de los recogibles del inicio (con R ≥ R0 + id máximo × e), `visible` es igual a los
recogibles del snapshot y, para un mismo snapshot, no depende del reloj de render, de la aparición ni del flote. Si la
sonda tiene el recuento de recogibles en aparición (`pickupSpawns`, según el design), cuenta por tipo los recogibles en
aparición **o en su retardo** y no cambia ningún otro recuento.

Un sprite oculto por el parpadeo cuenta como no visible. En modo menú los recuentos de jugador, enemigo, cadáver, oveja,
proyectil, pulso, recogibles de cada tipo, dinamita, aviso, explosión, celdas del mapa, elementos del mapa,
decoración, estructuras, vetas, objetos del mapa y `drawn` valen 0. Sin `?e2e` MUST NOT existir. Leer la sonda MUST NOT
cambiar la simulación ni lo que se pinta.

#### Scenario: Recuento coherente con el snapshot
- **GIVEN** `?e2e&seed=42` y una partida en curso
- **WHEN** se pintan 600 frames y en cada uno se leen la sonda de render y el snapshot pintado
- **THEN** en cada frame los sprites visibles de enemigo, oveja, proyectil, pulso, dinamita, aviso y explosión son
  iguales en número a los enemigos, ovejas, proyectiles, pulsos, dinamitas, avisos y explosiones del snapshot, los de
  gema, `gold`, `wood`, `meat` y `stone` a los recogibles de cada tipo del snapshot menos los que están en su retardo
  de aparición (iguales a los del snapshot desde el primer frame sin recogibles en retardo), y el de jugador vale 1
  salvo en los frames en que el parpadeo lo oculta, que vale 0
- **AND** los sprites de enemigo por clase de estado coinciden con los enemigos del snapshot en cada clase, y los de
  oveja por estado con las ovejas del snapshot en cada estado
- **AND** las vetas pintadas activas y agotadas coinciden con las del snapshot en cada estado
- **AND** el recuento de cadáveres es ≤ 64 en todos
- **AND** las celdas del mapa pintadas por tipo y los recuentos de decoración son los mismos en los 600 frames, y las
  celdas, iguales a los recuentos del mapa de la sonda

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
- **AND** en ambas lecturas las vetas pintadas activas son iguales a las vetas activas del snapshot, sin reserva
- **AND** en la primera lectura los sprites `wood` visibles son los montones del snapshot menos los que están en su
  retardo (≥ 1: el de id 0 ya está en su aparición), y en la segunda, iguales a los montones del snapshot, ya en
  `idle`; ninguno con reserva
- **AND** en ambas lecturas los sprites de oveja son iguales en número y por estado a las ovejas del snapshot (en la
  primera, tantas como el tope de ovejas vivas del contenido), y los de `meat` a los recogibles `meat` del snapshot,
  ninguno con reserva
- **AND** se registran 0 eventos `securitypolicyviolation`; si la sonda tiene el recuento en aparición, en la primera
  lectura el de `wood` es igual al número de montones del snapshot

#### Scenario: Totales del mapa con estructuras y vetas
- **GIVEN** el contenido por defecto y las semillas 42 y 123
- **WHEN** se calcula el plan del mapa y los recuentos de la sonda, con una ventana de 960 × 540, de 1.280 × 720 y
  de 3.840 × 2.160, con el jugador en el centro del mundo y en (16, 16), y con el reloj de render en 0 y en 10.000 ms
- **THEN** en todos los casos las celdas pintadas por tipo, los elementos del mapa pintados y con reserva, la
  decoración, las estructuras pintadas, las vetas pintadas y los objetos del mapa son iguales entre sí
- **AND** los objetos del mapa valen 820 y 904 respectivamente, los mismos que antes de este change, y ninguno es un
  recogible (piedra, montón, carne, oro o gema)

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
- **THEN** en cada frame `drawn` es igual al número de objetos del plan, estructuras, vetas, solares y decoración
  incluidos, que da "Recorte del arte del mapa por cámara" con el rectángulo visible de ese frame

#### Scenario: Sonda en el menú
- **GIVEN** `?e2e&seed=42` y el menú tras `Volver al menú`
- **WHEN** se pinta 1 frame y se lee la sonda de render
- **THEN** los recuentos de jugador, enemigo, cadáver, oveja, proyectil, pulso, gema, `gold`, `wood`, `meat`, `stone`,
  dinamita, aviso, explosión, celdas del mapa, elementos del mapa, decoración, estructuras, vetas, objetos del mapa y
  `drawn` valen 0

#### Scenario: Sin sonda fuera de E2E
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga y se pulsa `Jugar`
- **THEN** `window.__sprint` es `undefined`

#### Scenario: Recuento de piedras por roca agregado
- **GIVEN** `rock` `small` en `goblin-torch`, `medium` en `goblin-tnt` y `large` en `goblin-tnt-guard`, un snapshot con
  2 recogibles `stone` de origen `goblin-torch`, 1 de `goblin-tnt` y 3 de `goblin-tnt-guard`, y la hoja `Deco/06.png`
  sin cargar
- **WHEN** se pinta y se lee la sonda
- **THEN** `sprites.pickups.stone` informa de 6 visibles y 3 con reserva (`placeholder`)

#### Scenario: Recuento de la decoración sin una hoja
- **GIVEN** el contenido por defecto, la semilla 42 y la hoja `Deco/18.png` sin cargar
- **WHEN** se pinta el snapshot del tick 0 y se lee la sonda
- **THEN** la decoración del plan es la misma que con todas las hojas, las no pintadas son exactamente las del aspecto
  de `Deco/18.png`, pintadas + no pintadas = las del plan, y los objetos del mapa son los de todas las hojas menos 2
  por cada espantapájaros no pintado

#### Scenario: Recuentos de recogibles sin depender de la aparición ni del flote
- **GIVEN** los datos de "Montones escalonados" (e 100, `spawn` de 7 frames a 10 fps), todas las hojas cargadas, un
  primer snapshot pintado con el reloj en R0 con 8 `wood` (los montones del inicio, ids 0 a 7), 3 gemas (ids 20 a 22) y
  2 `stone` (ids 23 y 24), y un snapshot pintado con R0 + 50 que añade, sin retardo por llegar después del primer
  pintado, 2 `gold` (ids 30 y 31) y 1 `meat` (id 32)
- **WHEN** se pinta ese segundo snapshot, sin cambiarlo, y se lee la sonda con el reloj en R0 + 350, en R0 + 1.000 y en
  R0 + 10.000 (todos en `idle` y flotando)
- **THEN** con R0 + 350 `sprites.pickups` informa de 3, 2, 4, 1 y 2 visibles para `xp`, `gold`, `wood`, `meat` y
  `stone` (los `wood` de ids 4 a 7 en su retardo; los 2 `gold` y el `meat`, en su aparición), y con R0 + 1.000 y
  R0 + 10.000 de 3, 2, 8, 1 y 2
- **AND** en las tres lecturas hay 0 con reserva en cada tipo; si la sonda tiene `pickupSpawns`, con R0 + 350 el de
  `gold` vale 2

#### Scenario: Recuento en aparición
- **GIVEN** el escenario "Montones escalonados" y una sonda con el recuento de recogibles en aparición
  (`pickupSpawns`)
- **WHEN** se lee la sonda con R = R0 + 350 y con R = R0 + 1.400
- **THEN** el recuento en aparición de `wood` vale 8 (4 en aparición y 4 en retardo) y 0 respectivamente, los visibles
  de `wood` valen 4 y 8, y el resto de recuentos de la sonda son iguales en las dos lecturas

### Requirement: Pintado del mapa
El sistema SHALL pintar, mientras existe una partida, los elementos de su mapa (ver `procedural-map`) con el arte de
los datos de aspecto, fijos en el mundo como el fondo y en las capas de "Capas del mapa y de las entidades":
- **agua**: cubre el rectángulo de mundo de cada celda `water` y de cada celda `bridge` (error ≤ 1 px); puede
  extenderse bajo las celdas de orilla, tapada por su pieza, pero no bajo una celda de tierra que no sea de orilla;
- **orilla y espuma**: cada celda de orilla (ver "Orillas por autotile de 4 vecinos") muestra, sobre su celda de
  tierra, la pieza de orilla de su caso, y la espuma en su borde con el río, bajo la pieza, que reproduce en bucle su
  animación `idle` en tiempo de render;
- **árbol**: cada celda `trunk` muestra un árbol, con el volteo y la fase de su celda (ver "Variedad de árboles por
  semilla"), que reproduce su animación `idle` (ver "Animación del arte del mapa"), con su origen en el punto medio
  del borde inferior de la celda (error ≤ 1 px);
- **puente**: cada celda `bridge` muestra el recorte de su orientación (ver "Orientación de los puentes") centrado en
  la celda (error ≤ 1 px);
- **castillo**: la huella muestra un castillo con su origen en el punto medio del borde inferior de la huella
  (error ≤ 1 px). Un mapa explícito no tiene huella: sus celdas `castle`, si las hay, se pintan siempre como
  rectángulos del color `castle` que cubren cada celda;
- **decoración**: en un mapa generado, las decoraciones de su plan (ver "Decoración del mapa generado" y "Pintado de
  la decoración").

**Pintar y dibujar**: que un elemento se *pinta* significa que forma parte del mapa pintado de la partida (es lo que
cuentan los recuentos del mapa de la sonda y lo que fija esta spec: sitio, volteo, fase, capa y aspecto). Si en un
frame concreto se *dibuja* o no lo decide "Recorte del arte del mapa por cámara": un elemento pintado fuera del
rectángulo de recorte no se dibuja, pero sigue pintado. Los escenarios de este requisito describen el mapa pintado y lo
que se ve cuando el elemento cae dentro del rectángulo visible.

**Reserva por elemento**: si la hoja de un elemento del mapa falla al cargar o no contiene su frame o su recorte (en el
árbol, alguno de los frames de su `idle`), ese elemento, y solo ese, se pinta así, sin errores no capturados: agua,
árbol y puente, como un rectángulo relleno que cubre exactamente cada celda `water`, `trunk` o `bridge` (error ≤ 1 px)
con el color de su tipo, y el árbol sin copa; castillo, como un rectángulo relleno del color `castle` que cubre
exactamente la huella; orilla y espuma no se pintan; la decoración no se pinta (ver "Pintado de la decoración"). Los
colores viven en los datos de aspecto, uno por tipo (`trunk`, `water`, `bridge`, `castle`), en formato `#RRGGBB`, y son
distintos dos a dos; se validan con zod en el arranque como el resto de datos de aspecto: un color ausente, con otro
formato, repetido o de un tipo desconocido MUST hacer fallar el arranque con un error que nombre el campo. El pintado
del mapa no cuenta como sprite de fondo ni como aspecto de reserva de sprites y MUST NOT cambiar la simulación; ningún
requisito depende del frame concreto que muestran la espuma, un árbol o una torre goblin en un frame de render salvo lo
que fijan "Animación del arte del mapa" y "El recorte no cambia lo que se ve". Redimensionar la ventana MUST NOT
cambiar qué elemento corresponde a cada celda, su volteo, su fase, la decoración ni su posición de mundo.

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
- **AND** el plan no tiene decoración (es un mapa explícito)

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
- **THEN** cada elemento del mapa de las celdas visibles en ambos frames tiene el mismo volteo, la misma fase y la
  misma posición de mundo que antes del cambio (error ≤ 1 px), la decoración del plan es la misma, y el número de
  objetos de escena del mapa sigue ≤ 1.000

#### Scenario: Recuentos del mapa pintado [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` (mapa real)
- **WHEN** arranca la partida, se pinta 1 frame y se leen la sonda de render y la del mapa
- **THEN** las celdas pintadas de `trunk`, `water`, `bridge` y `castle` son iguales a los recuentos de esos tipos en
  el mapa de la sonda (`castle` 20)
- **AND** el agua y el puente pintados son iguales a los recuentos de `water` y `bridge`; árbol y copa, al de `trunk`;
  orilla y espuma, al número de celdas `grass`, `trunk` o `castle` del mapa de la sonda con ≥ 1 vecina 4-conexa
  `water` o `bridge` dentro de la rejilla; castillo, 1
- **AND** la decoración del plan es ≥ 1, toda pintada, 0 sin pintar
- **AND** ningún elemento del mapa usa reserva

#### Scenario: Hojas del mapa bloqueadas [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` y una prueba que hace fallar las peticiones de
  `Water.png`, `Foam.png`, `Tree.png`, `Bridge_All.png`, `Castle_Blue.png` y `Deco/18.png`
- **WHEN** arranca la partida, se llama a `step(60)` y se leen la sonda de render y la del mapa
- **THEN** agua, árbol y puente se pintan todos con reserva, en número igual a los recuentos de `water`, `trunk` y
  `bridge` del mapa; el castillo, 1 con reserva; espuma y copa, 0
- **AND** las decoraciones sin pintar son exactamente las del aspecto de `Deco/18.png` (0 si el plan no tiene
  ninguna) y las demás decoraciones se pintan con su arte
- **AND** la partida está en el tick 60, los sprites de entidades cuya hoja no se bloquea no usan aspecto de reserva
  y no hay errores no capturados

#### Scenario: Mapa vacío
- **GIVEN** la build de producción con `?e2e&map=empty&seed=42`
- **WHEN** se pinta 1 frame de la partida
- **THEN** la sonda informa de 0 celdas pintadas de cada tipo, 0 elementos del mapa, 0 decoraciones, `drawn` 0 y 1
  sprite de fondo

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
El sistema SHALL dar a cada celda `trunk` un volteo (si el aspecto del árbol lo admite) y una fase de su animación
`idle` (ver "Animación del arte del mapa"), elegidos por una función determinista de la semilla de la partida y de la
celda. Los árboles ya no tienen modelos fijos: todos reproducen la misma animación y la variedad dentro de un mapa la
dan la fase y el volteo. Elegirlos MUST NOT consumir el azar de la partida ni el del mapa ni ningún otro
`RandomGenerator`, MUST NOT usar un flujo de azar nuevo, MUST NOT cambiar el snapshot ni el mapa y no depende del
tick, del número de frames pintados ni de las partidas anteriores de la carga: la misma semilla y el mismo mapa dan
siempre las mismas fases y volteos.

#### Scenario: Variedad dentro de un mapa
- **GIVEN** los datos de aspecto del repositorio (`idle` del árbol de 4 frames) y el contenido por defecto
- **WHEN** se calculan las fases de las celdas `trunk` del mapa de cada semilla de 1 a 50
- **THEN** en cada mapa hay ≥ 2 fases distintas

#### Scenario: La variedad no toca la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick
  y la política de elección fija, una con los datos de aspecto del repositorio y otra con la `idle` del árbol de un
  único frame y sin volteo
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots y sus mapas son iguales campo a campo en cada tick

#### Scenario: Mismas fases con la misma semilla
- **GIVEN** el contenido por defecto, la semilla 42 y su mapa generado
- **WHEN** se calculan la fase y el volteo de sus celdas `trunk` dos veces, y una tercera tras pintar 600 frames y
  pulsar R con la misma semilla
- **THEN** las tres listas de fases y volteos son iguales celda a celda

#### Scenario: Otra semilla, otras fases
- **GIVEN** un mapa explícito de hierba con troncos en las 20 celdas de columnas 2–6 y filas 2–5
- **WHEN** se calculan sus fases con la semilla 42 y con la semilla 43
- **THEN** las dos listas difieren en ≥ 1 celda

### Requirement: Capas del mapa y de las entidades
El sistema SHALL pintar, de abajo arriba: (1) el fondo; (2) el agua; (3) las orillas y la espuma; (4) los puentes;
(5) el tronco de cada árbol, la fachada del castillo, la parte baja de cada estructura (o su rectángulo de reserva) y
la decoración baja y la base de cada decoración alta; (6) cadáveres, gemas, pulsos, jugador, enemigos y proyectiles,
con su orden relativo de antes de este change; (7) las copas de los árboles, el tejado del castillo, la parte alta de
cada estructura y la parte alta de cada decoración alta; (8) la **capa de peligros**: avisos, dinamitas y
explosiones, en ese orden; (9) el HUD y los overlays, fijos en pantalla (ver `world-camera`). La **copa** es la parte
del dibujo del árbol situada por encima del borde superior de su celda y el **tronco**, el resto. El **tejado** es la
parte del dibujo del castillo situada por encima del borde superior de la fila inferior de la huella y la
**fachada**, el resto. Las partes baja y alta de una estructura son las de "Pintado de las estructuras"; la base y la
parte alta de una decoración alta, las de "Decoración del mapa generado". Las partes se separan con un error ≤ 1 px.
Así, una entidad al sur de un árbol, ante la puerta del castillo, ante una casa o ante un espantapájaros se ve
delante, y una que pasa detrás de una copa, sobre el tejado, detrás de una casa o detrás de la parte alta de una
decoración alta queda tapada; una decoración baja nunca tapa a una entidad ni a un recogible; un aviso, una dinamita o
una explosión se ven siempre sobre el mapa, las estructuras, la decoración y las entidades y bajo el HUD. El orden de
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

#### Scenario: Decoración baja y alta
- **GIVEN** un plan de arte del mapa preparado para el test con una decoración baja D de `Deco/08` en la celda c1 y una
  alta E de `Deco/18` en la celda c2 (y del borde superior de c2 = Y), y un snapshot con un enemigo y una gema sobre
  el origen de D, y otro enemigo en (x del origen de E, Y − 10)
- **WHEN** se pinta el snapshot
- **THEN** D está por debajo de la gema y del enemigo que la pisan
- **AND** la base de E (y ≥ Y) está por debajo del segundo enemigo y su parte alta (y < Y) por encima de él y por
  debajo de los avisos y del HUD

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
El sistema SHALL pintar el mapa de las semillas 42 y 123 con ≤ 950 objetos de escena del mapa cada una, decoración
incluida (sin contar fondo, entidades, HUD ni overlays), según informe la sonda de render; el límite duro sigue
siendo 1.000 objetos. Con `CI_LIKE=1` (sin GPU, frenado 25, 1 worker, mediana de 3 pasadas de la medición de fps del
proyecto `realtime`, ventana de 1.280 × 720), se informa, con el mapa real de las semillas 42 y 123, de los fps, de su
porcentaje sobre la base de rectángulos de 0015 (21,6 y 21,9 fps), de su comparación con la línea base de 0017 (14,1 y
12,9 fps) y de la última medición anterior a este change si la hay, y de los objetos del mapa y los dibujados
(`drawn`) al empezar la partida. El objetivo orientativo SHOULD ser superar la línea base de 0017 y acercarse a ≥ 85 %
de la base de rectángulos (≥ 18,4 y ≥ 18,6), también con árboles y torres animados; no se exige volver a las cifras de
0016. La medición de fps es a demanda e informativa: no bloquea `verify`, `test:e2e` ni CI; si no se cumple, se anota
en el verify-report.

#### Scenario: Objetos del mapa [realtime]
- **GIVEN** la build de producción con `?e2e&manual&seed=42`, y en otra carga `seed=123`, con una ventana de
  1.280 × 720
- **WHEN** arranca la partida, se pinta 1 frame y se lee la sonda de render
- **THEN** el número de objetos de escena del mapa es ≤ 950 en ambas y se informa de él y de `drawn`, con
  0 < `drawn` < objetos del mapa
- **AND** el mismo tope lo comprueba además un test sin navegador del plan de pintado con el contenido por defecto y
  las semillas 42 y 123, que entra en `verify`; este escenario `[realtime]` solo lo confirma con la sonda

#### Scenario: Fps con el mapa real [realtime]
- **GIVEN** `CI_LIKE=1` y la medición de fps del proyecto `realtime` con las semillas 42 y 123 y el mapa real
- **WHEN** se ejecutan 3 pasadas y se toma la mediana
- **THEN** se informa del fps de cada semilla, de su porcentaje sobre 21,6 y 21,9 fps y de su diferencia con 14,1 y
  12,9 fps respectivamente

#### Scenario: Tope de objetos sin navegador
- **GIVEN** el contenido y los datos de aspecto del repositorio y las semillas 42 y 123
- **WHEN** un test de `verify` calcula el plan del arte del mapa de cada una
- **THEN** tiene ≤ 950 objetos, decoración incluida, y el número exacto de objetos de cada semilla se anota en el
  verify-report

### Requirement: Recorte del arte del mapa por cámara
Mientras existe una partida, el sistema SHALL **dibujar** en cada frame solo los objetos de escena del mapa (los que
cuenta la sonda como objetos del mapa, de las dos capas: agua, orillas, espuma, troncos, copas, puentes, fachada y
tejado del castillo, partes de estructuras, vetas, solares y edificios, decoración baja y base y parte alta de la
decoración alta, y los rectángulos de reserva de cualquiera de ellos) cuya **caja** intersecta el **rectángulo de
recorte** de ese frame, y MUST NOT dibujar ninguno más. Definiciones:
- **caja** de un objeto: el rectángulo de mundo que ocupa su dibujo (posición, origen, escala y recorte incluidos),
  con error ≤ 1 px; no cambia mientras dura la partida. En un objeto animado (tronco, copa y partes de una torre
  goblin intacta) la caja cubre su dibujo con cualquiera de los frames de su animación;
- **rectángulo de recorte**: el rectángulo visible de la cámara de **ese mismo frame** (ver "Cámara que sigue al
  jugador dentro del mundo" en `world-camera`, ya recortado al mundo y con el tamaño de ventana de ese frame) ampliado
  M px por cada lado. El margen M es ≥ 0, es el mismo para todos los objetos y no depende del snapshot; puede depender
  del tamaño de la vista (su valor lo fija el diseño);
- **intersecta**: la caja y el rectángulo de recorte comparten al menos un punto, bordes incluidos (una caja que solo
  toca el borde se dibuja).

Recortar MUST NOT cambiar la simulación, el plan del mapa (qué elemento, volteo, fase, posición, capa y orden
corresponde a cada celda, y qué decoración tiene) ni los recuentos totales de la sonda (ver "Sonda de render para
E2E").

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
- **THEN** para cada semilla y ventana, la unión de los objetos dibujados es el plan entero, decoración incluida
  (ningún objeto queda sin dibujarse en todas las posiciones) y cada caja intersecta el mundo

#### Scenario: Vista que cubre el mundo entero
- **GIVEN** un mundo de 2.560 × 1.440 con un mapa de ≥ 1 objeto, una ventana de 2.560 × 1.440 y el jugador en
  (16, 16)
- **WHEN** se aplica la regla de recorte
- **THEN** se dibujan todos los objetos del plan

#### Scenario: Caja de los objetos animados
- **GIVEN** el contenido por defecto, la semilla 42 y los datos de aspecto del repositorio
- **WHEN** se compara la caja del plan de cada tronco, copa y parte de torre goblin intacta con el rectángulo que
  ocupa su dibujo con cada frame de su `idle` (4 del árbol, 4 de la torre)
- **THEN** cada uno de esos rectángulos está dentro de la caja (error ≤ 1 px), y la caja es la misma con el reloj de
  render en 0 y en 10.000 ms

### Requirement: El recorte no cambia lo que se ve
El sistema SHALL mostrar dentro del rectángulo visible de cada frame exactamente el mismo arte del mapa que sin
recorte: todo objeto cuya caja intersecta el rectángulo visible (sin margen) MUST dibujarse en ese mismo frame, con la
capa, el orden dentro de la capa, la posición, el recorte, el volteo, el frame de hoja y el aspecto (arte o reserva)
que le dan el plan y "Animación del arte del mapa" (ver también "Pintado del mapa" y "Capas del mapa y de las
entidades"). En particular MUST NOT verse en ningún frame un hueco en el borde de la vista mientras la cámara se mueve,
ni un objeto que aparece un frame tarde. Una espuma que vuelve a dibujarse MUST mostrar, desde su primer frame
dibujado, el mismo frame de la animación `idle` que las espumas que siguieron dibujadas (todas las espumas van
sincronizadas). Un árbol o una torre goblin intacta que vuelve a dibujarse MUST mostrar, desde su primer frame
dibujado, el frame que le dan su fase y el reloj de render de ese frame, no el que tenía al dejar de dibujarse.

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

#### Scenario: Árbol y torre al reaparecer
- **GIVEN** un árbol de fase φ y una torre goblin intacta de fase ψ dibujados en el frame f, que dejan de dibujarse en
  el f + 1 porque la cámara se aleja y vuelven a dibujarse en el frame f + 37 (frames de 16,667 ms)
- **WHEN** se pinta el frame f + 37
- **THEN** el tronco y la copa del árbol muestran el frame de hoja que dan φ y el reloj de render de f + 37, y las
  partes de la torre el que dan ψ y ese mismo reloj, con un margen de ±1 frame de render en cada cambio

#### Scenario: Pausa, oferta, tienda, obra y partida terminada
- **GIVEN** una partida con el mapa real en pausa en el tick 500, después con una oferta abierta, después en la
  tienda, después en la obra y después terminada
- **WHEN** se pintan 300 frames en cada estado
- **THEN** en cada estado el conjunto de objetos dibujados es el mismo en los 300 frames (la cámara no se mueve)

### Requirement: Recorte al cambiar de partida, de ventana y de modo
El sistema SHALL recalcular qué objetos del mapa se dibujan en el **primer** frame de cada uno de estos casos, sin
heredar nada del frame anterior: al empezar la primera partida, tras R, tras `Volver al menú` + `Jugar` y tras cada
redimensionado de la ventana. En ese primer frame el conjunto dibujado MUST ser el que da "Recorte del arte del mapa
por cámara" con el plan del mapa de la partida en curso y el rectángulo visible de ese frame, y MUST NOT dibujarse
ningún objeto de un mapa anterior, decoración incluida. En modo menú MUST NOT dibujarse ningún objeto del mapa. Con el
mapa vacío no se dibuja ninguno.

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
  hoja del agua, la del árbol, la del puente, la del castillo o la `Deco/18.png`, y en otro caso sin cargar ninguna de
  las hojas del mapa (`Water.png`, `Foam.png`, `Tree.png`, `Bridge_All.png`, `Castle_Blue.png` ni las 11 de
  decoración)
- **WHEN** se pinta el primer frame y, después, el de una posición del jugador a ≥ 1.280 px en x de la inicial
- **THEN** los rectángulos de reserva se recortan con la misma regla que el arte: en cada frame se dibujan
  exactamente los objetos del plan (arte y reserva) que da la regla con el rectángulo visible de ese frame, y ninguna
  decoración sin pintar se dibuja
- **AND** los recuentos de reserva de la sonda son los del plan entero, iguales a los de antes de este change, y las
  decoraciones sin pintar son las de las hojas no cargadas

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
  la torre); la casa intacta es estática y la torre intacta reproduce su `idle` con su fase (ver "Animación del arte
  del mapa");
- una estructura destruida, con el aspecto de ruina de su tipo (`Goblin_House_Destroyed`, `Wood_Tower_Destroyed`),
  estático, desde el primer frame que pinta un snapshot en el que figura destruida y hasta el final de la partida, sin
  dejar visible su aspecto intacto.

La **parte baja** del dibujo es la situada por debajo del borde superior de la fila inferior de la huella y la **parte
alta**, el resto; se separan con un error ≤ 1 px, con cualquier frame de la animación, y van en las capas de "Capas
del mapa y de las entidades".

**Reserva**: si la hoja de un aspecto de estructura falla al cargar o no contiene su frame (en la torre intacta,
alguno de los frames de su `idle`), las estructuras con ese aspecto, y solo ellas, se pintan como un rectángulo
relleno que cubre exactamente su huella (error ≤ 1 px), sin parte alta y sin animación, con el color de su tipo si no
está destruida o con el color de ruina si lo está, sin errores no capturados. Los datos de aspecto tienen un color
`#RRGGBB` para `goblin-house`, otro para `goblin-tower` y otro para la ruina, distintos dos a dos y distintos de los
colores del mapa (`trunk`, `water`, `bridge`, `castle`); un color ausente, con otro formato o repetido MUST hacer
fallar el arranque con un error que nombre el campo.

Los objetos de escena de las estructuras cuentan como objetos del mapa en la sonda (ver "Sonda de render para E2E") y
se recortan con la regla de "Recorte del arte del mapa por cámara". Con el contenido por defecto y las semillas 42 y
123, el total de objetos del mapa, estructuras y decoración incluidas, MUST ser ≤ 950 (comprobado por un test sin
navegador del plan de pintado; límite duro 1.000). Con el mapa vacío no se pinta ninguna estructura; en modo menú no
se ve ninguna; al empezar una partida nueva no queda visible ninguna estructura de la anterior. Pintar las
estructuras MUST NOT cambiar la simulación.

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
- **THEN** en ambas el número de objetos del mapa, estructuras y decoración incluidas, es ≤ 950
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

#### Scenario: Torre intacta animada
- **GIVEN** una torre explícita sin destruir con huella en columnas 40–41 y filas 5–6, todas las hojas cargadas y su
  fase ψ
- **WHEN** se pintan 60 frames de 16,667 ms
- **THEN** su dibujo tiene su origen en (2.460, 420) (error ≤ 1 px), usa la hoja `Wood_Tower_<color>`, muestra en cada
  frame el frame de hoja que dan ψ y el reloj de render, y pasa por los 4 frames de su `idle`
- **AND** en cada frame su parte baja es la del dibujo con y ≥ 360 y su parte alta la de y < 360, con el mismo frame
  de hoja

### Requirement: Aspectos de los recogibles y de las vetas
El sistema SHALL definir en los datos de aspecto, validados con zod en el arranque con las reglas de "Datos de aspecto
validados":
- un aspecto por tipo de recogible: `xp` (la gema), `gold`, `wood`, `meat` y `stone`; los tipos con aspecto MUST ser
  exactamente los de la unión de tipos de recogible (ver "Recogibles con tipo" en `xp-gems`);
- para `stone`, un aspecto por **roca**: exactamente `small`, `medium` y `large`, con las hojas `Deco/04.png`,
  `Deco/05.png` y `Deco/06.png` de Update 010 respectivamente, tres ficheros distintos, cada uno con su tamaño de frame
  real (no tiene por qué ser el de las demás hojas de recogible) y animación `idle`;
- en el aspecto de **cada tipo de enemigo**, su **roca** (`rock`): `small`, `medium` o `large`, obligatoria (la
  completitud por tipo es la de "Datos de aspecto validados": exactamente los tipos de `content/enemies.json`);
- en `gold`, `wood` y `meat`, opcionalmente, una **animación de aparición** `spawn` con su propia hoja (con las reglas
  de ruta y de procedencia de "Datos de aspecto validados"), su tamaño de frame (enteros ≥ 1), una lista de ≥ 1 índices
  de frame enteros ≥ 0, unos fps > 0 y **sin bucle**; `xp`, `stone` y sus rocas MUST NOT declararla;
- en el aspecto `xp` sin hoja, su **diámetro** en px (número > 0), obligatorio;
- los parámetros comunes del **flote** (ver "Flote de los recogibles"): amplitud A en px (número ≥ 0), periodo T en ms
  (número > 0) y paso de fase s en ms (número ≥ 0), y el **desfase de aparición** e en ms (número ≥ 0, ver "Aparición
  escalonada de los recogibles del inicio");
- un aspecto de veta activa y uno de veta agotada;
- un color de reserva `#RRGGBB` por tipo de recogible (uno solo para `stone`, común a sus tres rocas) y uno para la
  veta, distintos dos a dos, distintos de los colores del mapa (`trunk`, `water`, `bridge`, `castle`), de los de las
  estructuras y del de la oveja.

Los aspectos `gold`, `wood` y `meat`, los tres de `stone` y los dos de veta tienen hoja y animación `idle`; la hoja de
`meat` es `M_Idle.png`. El aspecto `xp` tiene una hoja del pack distinta de las de `gold`, `wood`, `meat` y `stone` (y
de las hojas de aparición) con animación `idle`, o bien se declara **sin hoja**, como forma de color con su color de
reserva y su diámetro; un aspecto `xp` sin hoja no cuenta nunca como reserva en la sonda (como los avisos) y no exige
`idle`. En pantalla, XP, oro, madera, carne y piedra MUST ser distinguibles: hojas distintas o, si `xp` no tiene hoja,
forma de color frente a sprite. Cada recogible `stone` se pinta con el aspecto de la roca que declara el aspecto del
tipo de enemigo de su origen (`source`, ver "Recogibles con tipo" en `xp-gems`); una piedra sin origen o con un origen
sin aspecto se pinta con la roca `medium`. El icono de piedra del HUD usa siempre la roca `medium`. La roca la decide
solo el render: no forma parte de la simulación ni cambia el valor ni el radio de la piedra. Un tipo sin aspecto, un
aspecto de un tipo inexistente (por ejemplo `potion`), una roca de `stone` ausente o desconocida, un tipo de enemigo sin
`rock` o con un valor distinto de las tres, un color ausente, con otro formato o repetido, un `spawn` en `xp` o en
`stone`, un `spawn` en bucle o con un campo fuera de rango, un diámetro de `xp` ausente o ≤ 0, o un parámetro del flote
o del desfase ausente o fuera de rango MUST hacer fallar el arranque con un error que nombre el tipo, la roca o el
campo. Los datos de aspecto de los recogibles (escalas, diámetro, aparición, flote y desfase) MUST NOT cambiar la
simulación ni el radio de recogida (`pickupRadius`, `gemRadius`).

**Reserva**: si la hoja `idle` de un aspecto de recogible falla al cargar o no contiene su frame, los recogibles de ese
tipo (en la piedra, los de esa roca), y solo ellos, se pintan con la forma rellena de "Aspecto de reserva ante un fallo
de carga" con el color de su tipo (diámetro 2 × `gemRadius`, sin flote ni aparición); el fallo de una hoja de aparición
sigue "Aparición de oro, madera y carne". Si falla una hoja de veta, las vetas en ese estado se pintan como un círculo
relleno del color de la veta, de radio su radio de contacto, centrado en su posición. Ningún fallo rompe la partida ni
produce errores no capturados.

#### Scenario: Datos del repositorio
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** hay aspecto para exactamente `xp`, `gold`, `wood`, `meat` y `stone`, aspecto de veta activa y de veta agotada,
  y colores de reserva para los cinco tipos y para la veta, distintos dos a dos
- **AND** la hoja de `gold` es `G_Idle.png`, la de `wood` `W_Idle.png`, la de `meat` `M_Idle.png`, y la de `xp`, si la
  tiene, es otra distinta de esas, de las de aparición y de las de `stone`
- **AND** `stone` tiene exactamente las rocas `small`, `medium` y `large`, con las hojas `Deco/04.png`, `Deco/05.png` y
  `Deco/06.png`, cuyo tamaño de frame cabe en la hoja versionada
- **AND** el aspecto de cada tipo de enemigo (`goblin-torch`, `goblin-tnt`, `goblin-barrel` y `goblin-tnt-guard`) tiene
  `rock` en `small`, `medium` o `large`
- **AND** `gold`, `wood` y `meat` tienen escala 0,5; las tres rocas, escala 0,75; y `xp` no tiene hoja y su diámetro
  vale 20
- **AND** `gold`, `wood` y `meat` tienen `spawn` con las hojas `G_Spawn.png`, `W_Spawn.png` y `M_Spawn.png`, frame de
  128 × 128 px, frames `[0, 1, 2, 3, 4, 5, 6]` y sin bucle, cuyos frames caben en la hoja versionada; `xp` y `stone` no
  tienen `spawn`
- **AND** el flote tiene A 4 y T 1.600, y los 8 valores (id × s) mod T de los ids 0 a 7 son distintos dos a dos

#### Scenario: Datos inválidos
- **GIVEN** los datos del repositorio con, en un caso cada vez: sin aspecto `wood`; sin aspecto `meat`; sin aspecto
  `stone`; con un aspecto extra `potion`; sin aspecto de veta agotada; la escala de `gold` 0; el color de reserva de
  `wood` igual al de `gold`; el color de reserva de `meat` igual al de la veta; el color de la veta `"amarillo"`; `stone`
  sin la roca `medium`; `stone` con una roca extra `huge`; la escala de la roca `large` 0; el color de `stone` igual al
  de la oveja; el aspecto de `goblin-tnt` sin `rock`; o el de `goblin-torch` con `rock` `huge`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `wood`, `meat`, `stone`, `potion`, la veta agotada, la escala de
  `gold`, el color de `wood`, el color de `meat`, el color de la veta, `medium`, `huge`, la escala de `large`, el color
  de `stone`, `goblin-tnt` y `goblin-torch` respectivamente
- **AND** no se muestra el menú ni empieza ninguna partida

#### Scenario: Reserva de un tipo de recogible
- **GIVEN** un snapshot con 2 recogibles `xp`, 2 `gold`, 2 `wood` y 2 `meat` y la hoja de `wood` sin cargar
- **WHEN** se pinta el snapshot
- **THEN** los 2 `wood` son formas del color de `wood` de 10 px de diámetro (2 × `gemRadius`) centradas en su posición
  (error ≤ 0,001), y los `gold`, los `meat` y los `xp` se pintan con su aspecto del repositorio
- **AND** la sonda cuenta 2 recogibles `wood` con reserva y 0 de los otros tres tipos

#### Scenario: Reserva de la carne
- **GIVEN** un snapshot con 1 recogible `meat` en (700, 400) y 1 `gold`, la hoja `M_Idle` sin cargar y la hoja
  `M_Spawn` cargada
- **WHEN** se pinta el snapshot
- **THEN** el `meat` es una forma del color de `meat` de 10 px de diámetro centrada en (700, 400) y el `gold` se pinta
  con su aspecto del repositorio (`G_Spawn` en su aparición o `G_Idle` fuera de ella)
- **AND** la sonda cuenta 1 recogible `meat` con reserva y no hay errores no capturados

#### Scenario: Cada piedra con la roca de su origen
- **GIVEN** los datos de aspecto con `rock` `small` en `goblin-torch`, `medium` en `goblin-tnt` y `large` en
  `goblin-tnt-guard`, todas las hojas cargadas, la amplitud del flote 0 y un snapshot con 3 recogibles `stone` de esos
  tres orígenes y 1 sin origen
- **WHEN** se pinta el snapshot
- **THEN** la de `goblin-torch` usa la hoja `Deco/04.png`, la de `goblin-tnt` `Deco/05.png`, la de `goblin-tnt-guard`
  `Deco/06.png` y la sin origen `Deco/05.png`, cada una con el origen de su aspecto en la posición de su recogible
  (error ≤ 0,001)

#### Scenario: Cambiar la roca es solo de datos
- **GIVEN** los datos de aspecto del repositorio con la `rock` de `goblin-torch` cambiada a `large`
- **WHEN** se pinta un snapshot con 1 recogible `stone` de origen `goblin-torch`
- **THEN** se pinta con `Deco/06.png`, sin cambios de código ni de contenido de recursos

#### Scenario: Reserva de una roca
- **GIVEN** `rock` `small` en `goblin-torch` y `large` en `goblin-tnt-guard`, un snapshot con 1 recogible `stone` de
  origen `goblin-torch` en (700, 400), 1 de origen `goblin-tnt-guard` y 1 `gold`, y la hoja `Deco/04.png` sin cargar
- **WHEN** se pinta el snapshot
- **THEN** la piedra de `goblin-torch` es una forma del color de `stone` de 10 px de diámetro centrada en (700, 400), la
  de `goblin-tnt-guard` se pinta con `Deco/06.png` y el `gold` con su aspecto del repositorio
- **AND** la sonda cuenta 1 en `sprites.pickups.stone.placeholder` y no hay errores no capturados

#### Scenario: Pintar la piedra no cambia la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick y
  la política de elección fija, una con los datos de aspecto del repositorio y otra con las tres hojas de la piedra sin
  cargar, las escalas de sus rocas multiplicadas por 2 y la `rock` de todos los tipos de enemigo cambiada
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick

#### Scenario: Aparición, diámetro y flote inválidos
- **GIVEN** los datos del repositorio con, en un caso cada vez: `spawn` en `stone`; `spawn` en `xp`; el `spawn` de
  `gold` en bucle; los frames del `spawn` de `wood` `[]`; los fps del `spawn` de `meat` 0; la hoja del `spawn` de `wood`
  igual a una ruta `.png` que no figura en la nota de procedencia; el diámetro de `xp` 0; el aspecto `xp` sin hoja y sin
  diámetro; la amplitud del flote −1; el periodo del flote 0; el paso de fase −1; el desfase de aparición −1; o sin
  parámetros de flote
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `spawn` y `stone`, `spawn` y `xp`, el bucle del `spawn` de `gold`, los
  frames del `spawn` de `wood`, los fps del `spawn` de `meat`, la hoja del `spawn` de `wood`, el diámetro de `xp` (en
  los dos casos), la amplitud, el periodo, el paso de fase, el desfase y el flote respectivamente
- **AND** no se muestra el menú ni empieza ninguna partida

#### Scenario: Aparición opcional
- **GIVEN** los datos del repositorio sin `spawn` en `gold`, `wood` ni `meat`, y en otro caso con A 0, s 0 y e 0
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito en ambos casos

#### Scenario: Escalas de los recogibles sin efecto en la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick y
  la política de elección fija, una con los datos de aspecto del repositorio y otra con las escalas de `gold`, `wood` y
  `meat` en 0,3, las de las rocas en 0,5 y el diámetro de `xp` en 10 (los valores de antes de este change)
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick, con las mismas recogidas en los mismos ticks

### Requirement: Pintado de las vetas
El sistema SHALL pintar, mientras existe una partida, cada veta del snapshot fija en el mundo, con el origen de su
aspecto en la posición de la veta (error ≤ 1 px), en la capa (5) de "Capas del mapa y de las entidades" (bajo las
entidades), estática:
- una veta activa, con el aspecto de veta activa (`GoldMine_Active`);
- una veta agotada, con el aspecto de veta agotada (`GoldMine_Inactive`), desde el primer frame que pinta un snapshot
  en el que figura agotada y hasta el final de la partida, sin dejar visible su aspecto activo.

Los objetos de escena de las vetas cuentan como objetos del mapa en la sonda (ver "Sonda de render para E2E") y se
recortan con la regla de "Recorte del arte del mapa por cámara" (también al cambiar de partida, de ventana y de modo).
Con el contenido por defecto y las semillas 42 y 123, el total de objetos del mapa, estructuras, vetas y decoración
incluidas, MUST ser ≤ 950 (comprobado por un test sin navegador del plan de pintado; límite duro 1.000). Con el mapa
vacío no se pinta ninguna veta; en modo menú no se ve ninguna; al empezar una partida nueva no queda visible ninguna
veta de la anterior. Pintar las vetas MUST NOT cambiar la simulación.

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
  número de objetos del plan, estructuras, vetas, solares y decoración incluidos, que da la regla

#### Scenario: Tope de objetos con las vetas
- **GIVEN** el contenido por defecto y las semillas 42 y 123
- **WHEN** se calcula el plan del mapa sin navegador
- **THEN** cada veta de cada semilla tiene en el plan sus objetos, ninguna celda de veta tiene decoración, y el total
  de objetos del mapa es ≤ 950 en ambas

### Requirement: Pintado de las ovejas
El sistema SHALL pintar en cada frame exactamente un sprite visible por cada oveja del último snapshot (ver `sheep`),
en su posición (error ≤ 0,001), asociado por identificador, con el aspecto de oveja de los datos de aspecto (hoja,
escala y origen, ver "Escala y origen"), en la capa (6) de "Capas del mapa y de las entidades", por encima de los
recogibles y por debajo del jugador y de los enemigos:
- una oveja en `graze` reproduce la animación `idle` (hoja `HappySheep_Idle`, 8 fotogramas);
- una oveja en `wander` o en `flee` reproduce la animación `bounce` (hoja `HappySheep_Bouncing`, 6 fotogramas);
- la oveja mira hacia donde se mueve en x: se voltea horizontalmente cuando su x baja respecto al frame anterior y deja
  de estarlo cuando sube; sin movimiento horizontal conserva su orientación;
- una oveja que indica daño reciente muestra la misma indicación de daño que los enemigos (ver "Indicación visual de
  daño, proyectiles y pulsos" en `auto-weapons`), sin detener su animación ni cambiar su tamaño o posición; no hay
  barra de vida ni números de daño.

Una oveja muerta MUST NOT quedar visible desde el primer frame que pinta un snapshot sin ella; no deja cadáver. Los
datos de aspecto tienen un aspecto de oveja con las animaciones `idle` y `bounce` y un color de reserva `#RRGGBB`,
distinto de los de los recogibles, la veta, las estructuras y el mapa; un aspecto o una animación ausentes, o un color
ausente, con otro formato o repetido MUST hacer fallar el arranque con un error que nombre el campo.

**Reserva**: si una hoja de la oveja falla al cargar o no contiene un frame de sus animaciones, todas las ovejas se
pintan con la forma rellena de "Aspecto de reserva ante un fallo de carga" (diámetro 2 × su radio) con el color de la
oveja, sin errores no capturados. Con el mapa vacío sin ovejas declaradas no se pinta ninguna; en modo menú no se ve
ninguna; al empezar una partida nueva no queda visible ninguna oveja de la anterior. Las ovejas no forman parte del plan
del mapa ni de sus objetos (`drawn` y los objetos del mapa no cambian por ellas), y la decoración no cambia porque se
muevan durante la partida. Pintar las ovejas MUST NOT cambiar la simulación.

#### Scenario: Oveja en pasto y en huida
- **GIVEN** la oveja de prueba en (1.000, 1.000), los datos de aspecto del repositorio con todas las hojas cargadas y
  el jugador quieto en (1.150, 1.000)
- **WHEN** se pintan los snapshots de los ticks 0 y 1
- **THEN** en el del tick 0 hay 1 sprite de oveja en (1.000, 1.000) con la animación `idle` de `HappySheep_Idle`
- **AND** en el del tick 1 el mismo sprite está en (997, 1.000), con la animación `bounce` de `HappySheep_Bouncing`,
  volteado horizontalmente

#### Scenario: Muertes y reapariciones
- **GIVEN** un snapshot con 5 ovejas ya pintado
- **WHEN** se pinta un snapshot en el que 2 han muerto y 1 ha reaparecido
- **THEN** hay exactamente 4 sprites de oveja visibles, cada uno en la posición de una oveja distinta del snapshot

#### Scenario: Reserva de la oveja
- **GIVEN** la hoja `HappySheep_Bouncing` sin cargar y un snapshot con 2 ovejas de radio 20, una en `graze` en
  (1.000, 1.000) y otra en `flee`
- **WHEN** se pinta el snapshot
- **THEN** las 2 ovejas son formas del color de la oveja de 40 px de diámetro centradas en su posición (error ≤ 0,001)
- **AND** la sonda cuenta 2 ovejas con reserva y no hay errores no capturados

#### Scenario: Indicación de daño en una oveja
- **GIVEN** una oveja que indica daño reciente en los snapshots de T a T + 3
- **WHEN** se pintan los snapshots de T a T + 4
- **THEN** su sprite muestra la indicación de daño de T a T + 3 y no en T + 4, con el mismo tamaño y posición que sin
  ella

#### Scenario: Datos de la oveja inválidos
- **GIVEN** los datos de aspecto del repositorio con, en un caso cada vez: sin aspecto de oveja; el aspecto de oveja
  sin la animación `bounce`; el color de la oveja igual al de `wood`; o el color de la oveja `"blanco"`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra el aspecto de oveja, `bounce` y el color de la oveja en los dos
  últimos casos
- **AND** no se muestra el menú ni empieza ninguna partida

#### Scenario: Pintar las ovejas no cambia la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick y
  la política de elección fija, una con los datos de aspecto del repositorio y otra con las hojas de la oveja y de la
  carne sin cargar
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick

#### Scenario: Ovejas fuera del plan del mapa
- **GIVEN** el contenido por defecto y las semillas 42 y 123
- **WHEN** se calcula el plan del mapa sin navegador con el tope de decoración 0, y en otro caso con los datos de
  aspecto del repositorio al crear la partida y tras 1.200 ticks en los que las ovejas se mueven
- **THEN** con tope de decoración 0 los objetos del mapa son los de antes de este change (737 y 820 respectivamente)
  y ningún objeto es de una oveja
- **AND** con los datos del repositorio la decoración del plan es la misma, celda a celda, al crear la partida y tras
  los 1.200 ticks

### Requirement: Pintado de los solares y de los edificios
El sistema SHALL pintar, mientras existe una partida, cada solar de su snapshot (ver `build-sites`) fijo en el mundo,
con el origen y la escala que fije el design respecto a la huella (error ≤ 1 px):
- un solar `free`, con el aspecto **en obra** común a todos los solares libres, `House_Construction`;
- un solar `house`, con `House_Blue` sobre la huella de la casa, y un solar `tower`, con `Tower_Blue` sobre la huella de
  la torre, desde el primer frame que pinta un snapshot en el que figura construido y hasta el final de la partida, sin
  dejar visible su aspecto en obra.

Los dibujos se separan en parte baja y parte alta con la regla de "Pintado de las estructuras" y van en las capas de
"Capas del mapa y de las entidades". **Reserva**: si la hoja de un aspecto de solar falla al cargar o no contiene su
frame, los solares con ese aspecto, y solo ellos, se pintan como un rectángulo relleno sobre la huella que corresponda,
sin parte alta, con un color de los datos de aspecto para el solar en obra, otro para la casa y otro para la torre,
`#RRGGBB`, distintos entre sí y de los colores del mapa y de las estructuras; un color ausente, con otro formato o
repetido MUST hacer fallar el arranque con un error que nombre el campo. Los objetos de escena de los solares cuentan
como objetos del mapa en la sonda y se recortan con "Recorte del arte del mapa por cámara". Con el contenido por defecto
y las semillas 42 y 123, el total de objetos del mapa, solares incluidos, MUST ser ≤ 1.000 (test sin navegador del
plan de pintado). Con el mapa vacío no se pinta ningún solar; en modo menú no se ve ninguno; al empezar una partida
nueva no queda visible ninguno de la anterior. Pintar los solares MUST NOT cambiar la simulación.

La sonda de render (ver "Sonda de render para E2E") SHALL exponer `sprites.sites`: cuántos solares se pintan en obra,
como casa y como torre, y cuántos de ellos con reserva; 0 en modo menú. Los recuentos de celdas, de elementos del mapa,
de estructuras y de vetas no cambian por los solares.

#### Scenario: Solar en obra y casa construida
- **GIVEN** la semilla 42 con su mapa real y todas las hojas cargadas
- **WHEN** se pinta el frame del tick 0, se construye una casa en el primer solar y se pinta el frame siguiente
- **THEN** en el primero `sprites.sites` informa de 6 en obra, 0 casas y 0 torres, sin reserva
- **AND** en el segundo de 5 en obra y 1 casa, y el primer solar se pinta con `House_Blue` y no con su aspecto en obra

#### Scenario: Reserva de los edificios
- **GIVEN** un solar con una torre construida y la hoja `Tower_Blue` sin cargar
- **WHEN** se pinta el snapshot
- **THEN** la torre es 1 rectángulo del color de la torre sobre su huella (error ≤ 1 px), sin parte alta, la sonda
  cuenta 1 torre con reserva y no hay errores no capturados

#### Scenario: Colores de los solares inválidos
- **GIVEN** los datos de aspecto del repositorio con, en un caso cada vez: el color de la torre igual a `"#12345"`; sin
  el color del solar en obra; o el color de la casa igual al de `goblin-house`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo
- **AND** no se muestra el menú ni empieza ninguna partida

#### Scenario: Presupuesto de objetos con solares
- **GIVEN** el contenido por defecto y las semillas 42 y 123
- **WHEN** se calcula el plan de pintado del mapa sin navegador
- **THEN** en ambas el número de objetos del mapa, solares incluidos, es ≤ 1.000, y se anota en el verify-report

#### Scenario: Pintar los solares no cambia la simulación
- **GIVEN** dos partidas con la semilla 42, la misma secuencia de 1.200 inputs y las mismas construcciones, una con las
  hojas de los solares cargadas y otra sin cargar
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick

### Requirement: Pintado de las flechas de torre
El sistema SHALL pintar cada flecha de torre del snapshot con la hoja de la flecha del arquero (la misma que los
proyectiles del jugador), orientada según su dirección, y con su aspecto de reserva si la hoja no carga. La sonda de
render SHALL contarlas aparte (`sprites.towerArrows`, visibles y con reserva), sin sumarlas al recuento de proyectiles;
0 en modo menú.


#### Scenario: Flechas coherentes con el snapshot
- **GIVEN** una serie de 60 snapshots con ≥ 1 torre construida disparando y el Linter disparando
- **WHEN** se pintan en orden y tras cada uno se lee la sonda de render
- **THEN** en cada frame `sprites.towerArrows` es igual al número de flechas de torre del snapshot y el recuento de
  proyectiles al de proyectiles del jugador

### Requirement: Decoración del mapa generado
El sistema SHALL añadir al plan del arte de cada mapa generado un conjunto de decoraciones elegido por una función
determinista de la semilla de la partida y de cada celda, sin colisión ni efecto sobre la simulación:
- cada decoración tiene su celda de anclaje en una celda válida para decoración, y el punto de origen de su dibujo
  dentro del rectángulo de mundo de esa celda (error ≤ 1 px);
- la **huella de la base** de una decoración es su celda de anclaje (1 celda) salvo en el espantapájaros
  (`Deco/18`), cuya base ocupa 3 × 1 celdas: la de anclaje y sus vecinas oeste y este; toda celda de la huella de la
  base es una celda válida para decoración;
- las huellas de las bases de dos decoraciones distintas no comparten ninguna celda;
- su hoja es una de las hojas de decoración de los datos de aspecto (con los del repositorio, las 11 de
  `asset-provenance`: `Deco/01`–`03`, `07`–`11` y `16`–`18`), nunca una hoja de roca de la piedra recogible;
- el número de objetos de escena de la decoración de un mapa (baja 1, alta 2) MUST ser ≤ el **tope de decoración**
  de los datos de aspecto (120 con los del repositorio); una pieza alta que no cabe en lo que queda del tope no se
  coloca;
- la **densidad** de los datos de aspecto fija el número esperado de celdas válidas por decoración (25 con los del
  repositorio); el número exacto por mapa lo da la función de elección, siempre dentro del tope.

Elegir la decoración MUST NOT consumir ningún valor de ningún `RandomGenerator` (ni de la partida ni de los flujos del
mapa, estructuras, recursos, ovejas, piedra o solares) ni usar un flujo de azar nuevo, MUST NOT cambiar el snapshot,
el mapa, las celdas, la caminabilidad ni ninguna firma dorada, y MUST NOT depender del tick, del número de frames
pintados, de la ventana, de la cámara ni de las partidas anteriores de la carga. Ni el jugador, ni los enemigos, ni
las ovejas, ni los proyectiles, ni el campo de flujo la tienen en cuenta. Un mapa explícito (`open`/`cells`) y el mapa
vacío MUST NOT tener decoración.

Los datos de aspecto tienen, validados con zod en el arranque con las reglas de "Datos de aspecto validados": la
lista de aspectos de decoración (≥ 1; cada uno con una sola hoja, tamaño de frame, índice de su frame, escala, origen
y `tall`, si es alta; sin pesos, sin volteo y sin `id`: la hoja identifica la decoración), el tope de decoración
(entero ≥ 0) y `density` (número > 0). Una lista vacía, un tope negativo o no entero,
una densidad ≤ 0, dos aspectos de decoración con la misma hoja o un aspecto de decoración con la hoja de una roca de
la piedra MUST hacer fallar el arranque con un error que nombre el campo o la hoja.

#### Scenario: Decoración de los mapas generados
- **GIVEN** el contenido y los datos de aspecto del repositorio
- **WHEN** se calcula el plan del arte del mapa de cada semilla de 1 a 50
- **THEN** en cada mapa la decoración usa entre 1 y 120 objetos de escena, contando 2 por cada pieza alta
- **AND** cada decoración usa una de las 11 hojas admitidas, tiene su celda de anclaje en una celda válida para
  decoración y su origen dentro de esa celda (error ≤ 1 px), y ninguna celda de anclaje se repite

#### Scenario: Zonas excluidas
- **GIVEN** el contenido por defecto y los mapas de las semillas 1 a 50 con sus estructuras, recursos y solares
- **WHEN** se comprueba cada decoración de su plan
- **THEN** ninguna celda de la huella de su base (1 celda, o 3 × 1 en `Deco/18`) es de la zona de inicio, de la
  huella del castillo ampliada 1 celda, de la huella de un solar o de una estructura goblin, de orilla, de recurso ni
  de terreno distinto de `grass`
- **AND** las huellas de las bases de dos decoraciones del mismo mapa no comparten ninguna celda

#### Scenario: Junto a los troncos
- **GIVEN** el contenido por defecto y los mapas de las semillas 1 a 50
- **WHEN** se comprueban las celdas de anclaje de su decoración
- **THEN** en el conjunto de los 50 mapas hay ≥ 1 decoración cuya celda de anclaje tiene una vecina 4-conexa `trunk`

#### Scenario: Misma semilla, misma decoración
- **GIVEN** el contenido por defecto y la semilla 42
- **WHEN** se calcula la decoración de su plan dos veces, y una tercera tras pintar 600 frames y pulsar R con la
  misma semilla
- **THEN** las tres listas son iguales decoración a decoración (celda de anclaje, hoja y posición del origen)

#### Scenario: Otra semilla, otra decoración
- **GIVEN** el contenido por defecto
- **WHEN** se calcula la decoración de las semillas 42 y 43
- **THEN** las dos listas difieren en ≥ 1 decoración (celda, hoja o posición)

#### Scenario: Sin decoración en los mapas explícitos ni en el vacío
- **GIVEN** el mapa vacío, y en otros casos un mapa `open` y un mapa `cells` de hierba de 64 × 36 sin troncos
- **WHEN** se calcula el plan del arte del mapa con la semilla 42
- **THEN** en los tres casos el plan tiene 0 decoraciones y 0 objetos de decoración

#### Scenario: Tope de decoración
- **GIVEN** el contenido por defecto, la semilla 42 y los datos de aspecto del repositorio con el tope de decoración
  igual, en un caso cada vez, a 0, a 1 y a 3
- **WHEN** se calcula el plan del arte del mapa
- **THEN** con tope 0 no hay decoración y el plan es igual objeto a objeto al de los datos con tope 120 sin sus
  objetos de decoración
- **AND** con tope 1 hay como máximo 1 decoración y ninguna es alta; con tope 3, la decoración usa ≤ 3 objetos

#### Scenario: Elegir la decoración no consume azar
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick y
  la política de elección fija, una con el tope de decoración 120 y otra con tope 0
- **WHEN** se crean y se ejecutan 1.200 ticks
- **THEN** al crearse el estado de cada `RandomGenerator` de la partida es el mismo en las dos, y sus snapshots y
  mapas son iguales campo a campo en cada tick

#### Scenario: Datos de la decoración inválidos
- **GIVEN** los datos de aspecto del repositorio con, en un caso cada vez: la lista de aspectos de decoración `[]`; el
  tope −1 o 2,5; la densidad 0; dos aspectos de decoración con la hoja `Deco/07.png`; un aspecto de decoración con la
  hoja `Deco/05.png` (roca `medium`); o un aspecto de decoración con la hoja `Deco/12.png` (no figura en la nota de
  procedencia)
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra la lista de decoración, el tope, la densidad, `Deco/07.png`,
  `Deco/05.png` y `Deco/12.png` respectivamente
- **AND** no se muestra el menú ni empieza ninguna partida

### Requirement: Pintado de la decoración
El sistema SHALL pintar, mientras existe una partida con mapa generado, cada decoración de su plan fija en el mundo,
con el frame de su aspecto (estático: no cambia en toda la partida) y su origen en la posición del plan
(error ≤ 1 px): una decoración baja, entera en la capa de la decoración baja de "Capas del mapa y de las entidades";
una alta, con su base en esa capa y su parte alta en la de las partes altas.

**Reserva**: si la hoja de un aspecto de decoración falla al cargar o no contiene su frame, las decoraciones con ese
aspecto, y solo ellas, MUST NOT pintarse: sin rectángulo ni forma de color, sin objetos de escena (no cuentan como
objetos del mapa ni en `drawn`) y sin errores no capturados; el resto del arte del mapa, la decoración de otras hojas
incluida, se pinta con su arte. Una decoración sin pintar no cuenta como sprite con aspecto de reserva.

En modo menú no se ve ninguna decoración; al empezar una partida nueva no queda visible ninguna de la anterior. Pintar
la decoración MUST NOT cambiar la simulación.

#### Scenario: Decoración en su sitio
- **GIVEN** el contenido por defecto, la semilla 42, los datos de aspecto del repositorio y todas las hojas cargadas
- **WHEN** se pinta el snapshot del tick 0
- **THEN** cada decoración del plan se pinta con la hoja y el frame de su aspecto, con su origen en la posición del
  plan (error ≤ 1 px)
- **AND** cada decoración baja usa 1 objeto de escena en la capa baja y cada alta 2, su base en la capa baja y su
  parte alta en la alta, separadas en el borde superior de su celda de anclaje (error ≤ 1 px)

#### Scenario: Hoja de una decoración que no carga
- **GIVEN** el contenido por defecto, la semilla 42 y, en un caso, la hoja `Deco/18.png` sin cargar y, en otro, el
  aspecto de `Deco/08.png` con un índice de frame que la hoja no contiene
- **WHEN** se pinta el snapshot del tick 0
- **THEN** en cada caso las decoraciones de ese aspecto no tienen ningún objeto de escena ni ningún rectángulo de
  color, las demás decoraciones y el resto del mapa se pintan con su arte, y no hay errores no capturados
- **AND** los objetos del mapa son los del plan con todas las hojas menos los de las decoraciones no pintadas

#### Scenario: Partida nueva y menú
- **GIVEN** una partida con el mapa real de la semilla 42 con su decoración pintada
- **WHEN** se pulsa R y se pinta el primer frame de una partida con la semilla 43, y en otro caso se pulsa
  `Volver al menú` y se pinta 1 frame
- **THEN** con la semilla 43 se pintan exactamente las decoraciones de su plan, ninguna de la anterior, y en el menú
  ninguna

#### Scenario: Pintar la decoración no cambia la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick y
  la política de elección fija, una con todas las hojas cargadas y otra con las 11 hojas de decoración sin cargar
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick

### Requirement: Animación del arte del mapa
El sistema SHALL animar en el arte del mapa solo la espuma (como antes), los árboles y las torres goblin intactas, con
el reloj de render R (en ms):
- **árbol**: cada árbol pintado con arte reproduce en bucle la animación `idle` de su aspecto (con los datos del
  repositorio, los frames `[0, 1, 2, 3]` de `Tree.png` a 4 fps, como en las slides; los frames 4 y 5 y el
  tocón, frame 8, nunca se muestran), con su
  **fase** φ, un entero en [0, n − 1] (n = número de frames de `idle`): en un frame de render de reloj R muestra el
  frame de posición (⌊R × fps / 1.000⌋ + φ) mod n de `idle`. El tronco y la copa del mismo árbol muestran siempre el
  mismo frame de hoja en el mismo frame de render;
- **torre goblin intacta**: cada torre no destruida pintada con arte reproduce en bucle la animación `idle` de su
  aspecto intacto (con los datos del repositorio, los 4 frames `[0, 1, 2, 3]` de `Wood_Tower_<color>.png` a 5 fps)
  con su fase ψ en [0, n − 1], con la misma regla; sus partes baja y alta muestran el mismo frame de hoja;
- la fase de cada árbol es una función determinista de la semilla de la partida y de su celda; la de cada torre, de
  la semilla y de la estructura. Calcular las fases MUST NOT consumir ningún `RandomGenerator` ni usar un flujo de
  azar nuevo, y no depende del tick, del número de frames pintados, de la ventana ni de partidas anteriores;
- todo lo demás del arte del mapa es **estático** (muestra el mismo frame de hoja en todos los frames de la partida):
  la torre goblin en ruina, el castillo, la casa goblin intacta y en ruina, la veta activa y la agotada, el solar en
  obra (`House_Construction`), la casa y la torre de caballeros construidas (`House_Blue`, `Tower_Blue`), los
  puentes, el agua, las orillas y toda la decoración. Los rectángulos de reserva tampoco cambian.

Espuma, árboles y torres usan el mismo reloj de render que la aparición y el flote de los recogibles (ver "Flote de los
recogibles" y "Aparición de oro, madera y carne"): con la partida en pausa, con una oferta de mejora abierta, en la
tienda, en la obra y con la partida terminada el reloj se congela y todos muestran el mismo frame de hoja en cada
frame pintado de ese estado; al volver a la partida en curso sin pausa siguen desde ese frame, sin saltos. El reloj no
depende de los ticks salvo en modo manual (`?e2e&manual`, change 0014), donde avanza n × TICK_MS con cada `step(n)`.
Con una `idle` de 1 frame el elemento queda estático. Animar el arte del mapa MUST NOT cambiar la simulación, el plan
(elementos, cajas, capas, orden), los recuentos de la sonda ni `drawn`.

#### Scenario: Frame de un árbol según su fase
- **GIVEN** un árbol de fase 2 con `idle` `[0, 1, 2, 3, 4, 5]` a 6 fps
- **WHEN** se pinta con el reloj de render R = 0, R = 700 y R = 1.000
- **THEN** su tronco y su copa muestran el frame de hoja 2, 0 y 2 respectivamente (posiciones 2, (4 + 2) mod 6 y
  (6 + 2) mod 6), con un margen de ±1 frame de render en cada cambio
- **AND** en ningún frame de render muestra el frame de hoja 8

#### Scenario: Frame de una torre según su fase
- **GIVEN** una torre goblin intacta de fase 1 con `idle` `[0, 1, 2, 3]` a 5 fps
- **WHEN** se pinta con el reloj de render R = 0, R = 650 y R = 800
- **THEN** sus partes baja y alta muestran el frame de hoja 1, 0 y 1 respectivamente, con un margen de ±1 frame de
  render en cada cambio

#### Scenario: Fases deterministas
- **GIVEN** el contenido por defecto y la semilla 42
- **WHEN** se calculan las fases de sus árboles y de sus torres goblin dos veces, y una tercera tras pintar 600 frames
  y pulsar R con la misma semilla
- **THEN** las tres listas de fases son iguales celda a celda y estructura a estructura, y cada fase está en [0, 3],
  tanto en los árboles como en las torres (n = 4 frames de `idle` en ambos con los datos del repositorio)

#### Scenario: Árboles y torres congelados en pausa, oferta, tienda, obra y fin
- **GIVEN** una partida con el mapa real de la semilla 42 y la cámara sobre ≥ 1 árbol, ≥ 1 torre goblin intacta y
  ≥ 1 espuma, con el reloj de render en R0 al entrar en pausa en el tick 500; después con una oferta de mejora
  abierta; después en la tienda; después en la obra; y después terminada
- **WHEN** en cada estado se pintan 60 frames de 16,667 ms
- **THEN** en cada estado el reloj de render no cambia, y cada árbol, cada torre intacta y cada espuma dibujados
  muestran en los 60 frames el mismo frame de hoja, el que dan su fase y el reloj al entrar en ese estado
- **AND** al reanudar la pausa y pintar 1 frame de 16,667 ms el reloj vale R0 + 16,667 (error ≤ 0,001) y cada árbol
  y torre muestra el frame que dan su fase y ese reloj

#### Scenario: Elementos estáticos
- **GIVEN** una partida con el mapa real de la semilla 42 en la que, por escenario, una casa goblin y una torre goblin
  quedan en ruina, una veta se agota y se construyen una casa y una torre en dos solares
- **WHEN** se pintan 600 frames de 16,667 ms tras esos cambios
- **THEN** el castillo, la casa goblin intacta y en ruina, la torre goblin en ruina, la veta activa y la agotada, el
  solar en obra, `House_Blue`, `Tower_Blue` y cada decoración muestran el mismo frame de hoja en los 600

#### Scenario: Torre que cae en ruina
- **GIVEN** una torre goblin intacta animada en el frame del tick n − 1 y destruida en el snapshot del tick n
- **WHEN** se pintan los snapshots de n a n + 60
- **THEN** desde el frame del tick n la torre se pinta con su aspecto de ruina, con el mismo frame de hoja en todos, y
  en ninguno se ve un frame de su aspecto intacto

#### Scenario: Reserva de árbol y torre
- **GIVEN** el contenido por defecto, la semilla 42 y, en un caso cada vez, la hoja `Tree.png` sin cargar, una hoja del
  árbol que no contiene el frame 3 o la hoja de la torre intacta sin cargar
- **WHEN** se pintan 120 frames de 16,667 ms
- **THEN** en los dos primeros casos todos los árboles se pintan con el rectángulo del color `trunk`, sin copa, y en el
  tercero toda torre intacta con su rectángulo de reserva, iguales en los 120 frames y sin errores no capturados

#### Scenario: Animar no cambia la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick y
  la política de elección fija, una con los datos de aspecto del repositorio y otra con la `idle` del árbol y la de la
  torre intacta de 1 solo frame
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick, y sus planes del arte del mapa tienen los mismos
  objetos con las mismas cajas, capas y orden

### Requirement: Flote de los recogibles
El sistema SHALL pintar cada recogible de los cinco tipos (`xp`, `gold`, `wood`, `meat` y `stone`) que **flota** en su
x del snapshot y en su y del snapshot más un desplazamiento vertical

d(id, R) = A × sen(2π × (R + id × s) / T) px,

con R el reloj de render del frame (en ms; se congela en pausa, con una oferta de mejora abierta, en la tienda, en la
obra y con la partida terminada, y no depende de los ticks salvo en modo manual, `?e2e&manual` de 0014, donde avanza
n × TICK_MS con cada `step(n)`), `id` el identificador del recogible y A (amplitud, px), T (periodo, ms) y s (paso de
fase, ms) los parámetros del flote de los datos de aspecto (ver "Aspectos de los recogibles y de las vetas"). Flotan
con esa fórmula, **con fase por id**, desde su primer frame pintado, los recogibles **sin aparición**: `stone`, `xp`
(también la gema sin hoja, como forma de color) y los `gold`, `wood` y `meat` sin `spawn` o cuya hoja de aparición
falla (ver "Aparición de oro, madera y carne").

Los `gold`, `wood` y `meat` **con aparición** tienen d = 0 durante su retardo y su aparición y, al terminarla, flotan
**sin salto**: con R_f el reloj del primer frame pintado en que ya no están en aparición (k ≥ n),

d(R) = A × sen(2π × (R − R_f) / T) px para R ≥ R_f,

de modo que en ese primer frame tras la aparición d = 0 (error ≤ 0,001) y, entre frames consecutivos, d cambia como un
seno continuo, sin discontinuidad en R_f. No llevan fase por id: los desfasa su propio R_f (aparición escalonada y
distintos instantes de aparición).

El desplazamiento depende solo del id (o de R_f) y de R: MUST NOT depender del tick, del hueco del pool que pinta al
recogible, del número de frames pintados (salvo para fijar R_f), de la ventana, de la cámara ni de partidas
anteriores, y calcularlo MUST NOT consumir ningún
`RandomGenerator` ni usar un flujo de azar nuevo. El flote no cambia la escala, el frame de hoja, el volteo, la
rotación ni la capa del sprite. Un recogible con **aspecto de reserva** (ver "Aspecto de reserva ante un fallo de
carga") no flota: su forma sigue centrada en su posición del snapshot. Pintar el flote MUST NOT cambiar la simulación.

#### Scenario: Desplazamiento según el reloj
- **GIVEN** unos datos de aspecto de prueba con A 4, T 1.600 y s 200, todas las hojas cargadas y un snapshot con 1 gema
  de id 0 en (300, 200), 1 gema de id 1 en (500, 200) y 1 recogible `stone` de id 2 en (700, 200)
- **WHEN** se pinta el snapshot con el reloj de render R = 0, R = 400 y R = 1.200
- **THEN** con R = 0 las y pintadas son 200, 202,828 y 204; con R = 400, 204, 202,828 y 200; con R = 1.200, 196,
  197,172 y 200 (error ≤ 0,001)
- **AND** en los tres casos las x pintadas son 300, 500 y 700 (error ≤ 0,001)

#### Scenario: Fases distintas con el mismo reloj
- **GIVEN** los datos de aspecto de "Desplazamiento según el reloj" y 2 gemas de ids 0 y 4 en (300, 200) y (500, 200)
- **WHEN** se pinta con R = 400
- **THEN** la de id 0 se pinta en y 204 y la de id 4 en y 196 (error ≤ 0,001)

#### Scenario: Recogible atraído
- **GIVEN** los datos de aspecto de "Desplazamiento según el reloj" y 1 gema de id 0 atraída por el imán, en (300, 200)
  en el snapshot del tick n y en (306, 200) en el del tick n + 1
- **WHEN** se pintan esos dos snapshots con R = 400 y R = 416,667
- **THEN** se pinta en (300, 204) y en (306, 200 + 4 × sen(2π × 416,667 / 1.600)) (error ≤ 0,001)

#### Scenario: Hueco reutilizado
- **GIVEN** los datos de aspecto de "Desplazamiento según el reloj", un snapshot pintado con 1 gema de id 7 y el
  siguiente con esa gema recogida y 1 gema nueva de id 9 en (400, 300), pintada con el sprite que usaba la de id 7
- **WHEN** se pinta el segundo snapshot con R = 0
- **THEN** la gema de id 9 se pinta en y = 300 + 4 × sen(2π × 1.800 / 1.600) = 302,828 (error ≤ 0,001)

#### Scenario: Flote congelado en pausa, oferta, tienda, obra y fin
- **GIVEN** una partida con ≥ 1 gema, ≥ 1 piedra y ≥ 1 recogible `wood` en idle en el suelo, con el reloj de render en
  R0 al entrar en pausa; después con una oferta de mejora abierta; después en la tienda; después en la obra; y después
  terminada
- **WHEN** en cada estado se pintan 60 frames de 16,667 ms
- **THEN** en cada estado la y pintada de cada recogible es la misma en los 60 frames (error ≤ 0,001), la que dan su id
  y el reloj al entrar en ese estado
- **AND** al reanudar la pausa y pintar 1 frame de 16,667 ms, cada recogible se pinta con d(id, R0 + 16,667)

#### Scenario: Flote en modo manual
- **GIVEN** los datos de aspecto de "Desplazamiento según el reloj", el modo manual (`?e2e&manual`) y una gema de id 0
  quieta en el suelo pintada con el reloj en R0 = 0
- **WHEN** se llama a `step(24)` y se pinta el frame
- **THEN** el reloj de render vale 24 × TICK_MS = 400 (error ≤ 0,001) y la gema se pinta con d = 4 (error ≤ 0,001)
- **AND** sin llamar a `step` durante 60 frames de render, la y pintada no cambia

#### Scenario: Flote sin salto al terminar la aparición
- **GIVEN** los datos de aspecto de "Desplazamiento según el reloj" (A 4, T 1.600, s 200), `spawn` de `gold` de 7
  frames a 10 fps y un recogible `gold` de id 5 en (300, 200) cuya aparición empieza en R_a = 1.000
- **WHEN** se pintan frames con R = 1.650, 1.700, 1.716,667, 2.100 y 2.500
- **THEN** con R = 1.650 muestra el frame 6 de `spawn` en y 200; con R = 1.700 (R_f) reproduce `idle` en y 200
  (d = 0, error ≤ 0,001); con R = 1.716,667, en y 200 + 4 × sen(2π × 16,667 / 1.600) = 200,262; con R = 2.100, en y
  204; y con R = 2.500, en y 200 (error ≤ 0,001)
- **AND** con el mismo recogible de id 6 y el mismo R_a, las y pintadas son las mismas (sin fase por id)

#### Scenario: Aparición fallida con fase por id
- **GIVEN** los datos de "Flote sin salto al terminar la aparición" con la hoja `G_Spawn` sin cargar y un recogible
  `gold` de id 1 en (300, 200) pintado por primera vez con R = 0
- **WHEN** se pinta con R = 0 y R = 400
- **THEN** reproduce `idle` en y 202,828 en ambos frames (d(1, R) con fase por id, error ≤ 0,001)

#### Scenario: La reserva no flota
- **GIVEN** los datos de aspecto de "Desplazamiento según el reloj", la hoja `W_Idle` sin cargar y 1 recogible `wood` de
  id 3 en (700, 400) fuera de su aparición
- **WHEN** se pinta con R = 0, R = 400 y R = 1.200
- **THEN** en los tres casos es una forma del color de `wood` de 10 px de diámetro centrada en (700, 400)
  (error ≤ 0,001)

#### Scenario: Flotar no cambia la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick y
  la política de elección fija, una con los datos de aspecto del repositorio y otra con A 0 y sin animaciones de
  aparición
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick

### Requirement: Aparición de oro, madera y carne
El sistema SHALL, para cada recogible `gold`, `wood` o `meat` cuyo aspecto declara una animación de aparición
(`spawn`, con su propia hoja; ver "Aspectos de los recogibles y de las vetas"), reproducir `spawn` **una sola vez** al
aparecer y después pasar a su `idle` y flotar (ver "Flote de los recogibles"). El **inicio** de la aparición es
R_a = R_1 + retardo, con R_1 el reloj de render del primer frame pintado de la partida en cuyo snapshot figura su id, y
el retardo 0 salvo en los recogibles del primer snapshot pintado (ver "Aparición escalonada de los recogibles del
inicio"). En un frame de reloj R, con n el número de frames de `spawn` y k = ⌊(R − R_a) × fps / 1.000⌋:
- si k < 0 (retardo en curso), no se ve: su sprite no es visible;
- si 0 ≤ k < n, muestra el frame de posición k de `spawn` (la aparición completa, del frame 0, el destello inicial, al
  último);
- si k ≥ n, reproduce `idle` y flota.

La aparición se pinta en la posición del snapshot (sin flote), con la escala y el origen del aspecto de su tipo, en la
capa de los recogibles, y avanza con el reloj de render (se congela en pausa, con una oferta de mejora abierta, en la
tienda, en la obra y con la partida terminada; no depende de los ticks salvo en modo manual, `?e2e&manual` de 0014,
donde avanza n × TICK_MS con cada `step(n)`). Es **una vez por id y partida**: MUST NOT repetirse ni reiniciarse al
reutilizar un sprite de otro recogible, al moverse el recogible por el imán, al sumarle valor por el tope de su tipo
(ver "Tope de gemas en el suelo" en `xp-gems`; no se crea un id nuevo) ni con el reloj congelado. Un recogible
recogido durante su aparición MUST NOT quedar visible desde el primer frame que pinta un snapshot sin él. Los
recogibles fuera del rectángulo visible también avanzan su aparición (los recogibles no se recortan por cámara).
`stone` y `xp` MUST NOT reproducir ninguna aparición ni usar ninguna hoja de aparición.

**Reserva**: si la hoja de aparición de un tipo falla al cargar o no contiene algún frame de su `spawn`, sus
recogibles se pintan desde su primer frame con su `idle` y flotan, como si no tuvieran aparición, y eso MUST NOT contar
como aspecto de reserva en la sonda. Si falla la hoja `idle` de un tipo, sus recogibles se pintan con su aspecto de
reserva (sin aparición ni flote) aunque su hoja de aparición cargue. Ningún fallo rompe la partida ni produce errores
no capturados. Calcular la aparición MUST NOT consumir ningún `RandomGenerator` ni cambiar la simulación.

#### Scenario: Aparición y paso a idle
- **GIVEN** unos datos de aspecto de prueba con `spawn` de `gold` de 7 frames `[0, 1, 2, 3, 4, 5, 6]` a 10 fps sin
  bucle, el flote de "Desplazamiento según el reloj" (A 4, T 1.600, s 200), todas las hojas cargadas y un recogible
  `gold` de id 5 en (300, 200) que no estaba en el snapshot pintado anterior
- **WHEN** se pinta su primer frame con R = 1.000 y después frames con R = 1.150, 1.650 y 1.700
- **THEN** muestra el frame de hoja 0, 1 y 6 de `spawn` en (300, 200) (error ≤ 0,001) en los tres primeros, con un
  margen de ±1 frame de render en cada cambio
- **AND** con R = 1.700 reproduce `idle` en (300, 200) (error ≤ 0,001): primer frame tras la aparición, d = 0

#### Scenario: Una sola vez por id
- **GIVEN** el recogible `gold` de id 5 de "Aparición y paso a idle" ya en `idle`
- **WHEN** se pintan 600 frames más de 16,667 ms con ese recogible en el suelo y, en otro caso, atraído por el imán
- **THEN** en ninguno de los 600 muestra un frame de `spawn`

#### Scenario: Sprite reutilizado por un id nuevo
- **GIVEN** el recogible `gold` de id 5 de "Aparición y paso a idle" en `idle`, recogido en el snapshot del tick n, y un
  recogible `wood` nuevo de id 12 que en ese mismo frame se pinta con el sprite que usaba el id 5, con `spawn` de `wood`
  igual al de `gold`
- **WHEN** se pinta el snapshot del tick n con R = 3.000
- **THEN** el sprite muestra el frame 0 del `spawn` de `wood` en la posición del id 12, sin flote

#### Scenario: Valor sumado por el tope
- **GIVEN** el tope de oro lleno, todos los recogibles `gold` en `idle`, y una casa goblin que queda en ruina en el tick
  n con el oro sumado al recogible `gold` más antiguo (ver "Tope de gemas en el suelo" en `xp-gems`)
- **WHEN** se pinta el snapshot del tick n y los 30 frames siguientes
- **THEN** ningún recogible `gold` muestra un frame de `spawn` y el número de sprites `gold` visibles es el mismo que
  antes del tick n

#### Scenario: Recogido durante la aparición
- **GIVEN** el recogible `gold` de id 5 de "Aparición y paso a idle" mostrando el frame 3 de `spawn`
- **WHEN** se pinta un snapshot en el que se ha recogido
- **THEN** no queda visible ningún sprite de recogible para él desde ese frame

#### Scenario: Aparición congelada en pausa, oferta, tienda, obra y fin
- **GIVEN** el recogible `gold` de id 5 de "Aparición y paso a idle" mostrando el frame 2 de `spawn` con R = R_a + 250
  al entrar en pausa; en otros casos, al abrirse una oferta de mejora, al entrar en la tienda, al entrar en la obra y
  al terminar la partida
- **WHEN** en cada caso se pintan 60 frames de 16,667 ms
- **THEN** en los 60 frames muestra el frame 2 de `spawn`
- **AND** al reanudar la pausa sigue en el frame 2 hasta que R − R_a llega a 300 y pasa entonces al frame 3, sin saltar
  ninguno

#### Scenario: Aparición en modo manual
- **GIVEN** el modo manual (`?e2e&manual`), los datos de aspecto de "Aparición y paso a idle" y un recogible `gold` que
  figura por primera vez en el snapshot pintado tras una llamada a `step`, con el reloj en R_a
- **WHEN** se llama a `step(9)` y después a `step(42)`, pintando un frame tras cada llamada
- **THEN** tras `step(9)` el reloj vale R_a + 150 (error ≤ 0,001) y muestra el frame 1 de `spawn`
- **AND** tras `step(42)` el reloj vale R_a + 850 (error ≤ 0,001) y reproduce `idle`

#### Scenario: Piedra y gema sin aparición
- **GIVEN** los datos de aspecto del repositorio, todas las hojas cargadas y un snapshot con 1 recogible `stone` y 1
  gema que no estaban en el snapshot pintado anterior
- **WHEN** se pinta su primer frame y los 60 siguientes
- **THEN** en todos la piedra se pinta con la hoja de su roca y la gema con su forma de color, ambas flotando, y ningún
  sprite usa `G_Spawn`, `W_Spawn` ni `M_Spawn`

#### Scenario: Hoja de aparición que no carga
- **GIVEN** los datos de aspecto del repositorio, la hoja `W_Spawn` sin cargar y un snapshot con 1 recogible `wood` y 1
  `gold` nuevos
- **WHEN** se pinta su primer frame y los 60 siguientes
- **THEN** el `wood` se pinta con `W_Idle` y flota desde el primer frame, y el `gold` reproduce su `spawn` con
  `G_Spawn`
- **AND** la sonda cuenta 0 recogibles `wood` y 0 `gold` con reserva y no hay errores no capturados

#### Scenario: Frame de aparición fuera de la hoja
- **GIVEN** un `spawn` de `meat` con frames `[0, 1, 2, 3, 4, 5, 6, 7]` sobre una hoja de 7 frames (0 a 6) y 1 recogible
  `meat` nuevo
- **WHEN** se pinta su primer frame
- **THEN** reproduce `idle` con `M_Idle`, no cuenta como reserva y no hay errores no capturados

#### Scenario: Hoja idle que no carga con la aparición cargada
- **GIVEN** la hoja `M_Idle` sin cargar, la hoja `M_Spawn` cargada y 1 recogible `meat` nuevo en (700, 400)
- **WHEN** se pinta su primer frame y los 60 siguientes
- **THEN** en todos es una forma del color de `meat` de 10 px de diámetro centrada en (700, 400) (error ≤ 0,001) y en
  ninguno muestra un frame de `M_Spawn`
- **AND** la sonda cuenta 1 recogible `meat` con reserva

#### Scenario: Aparecer no cambia la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick y
  la política de elección fija, una con los datos de aspecto del repositorio y otra sin `spawn` en ningún tipo
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick

### Requirement: Aparición escalonada de los recogibles del inicio
El sistema SHALL dar a cada recogible `gold`, `wood` o `meat` que figura en el **primer snapshot pintado de una
partida** un retardo de aparición de id × e ms, con e el desfase de aparición de los datos de aspecto (ver "Aspectos de
los recogibles y de las vetas"), contado en el reloj de render desde ese primer frame. Con el contenido por defecto y el
mapa generado son los montones de madera del tick 0 (ids 0 a N − 1, N = `woodPiles.count`, 8; ver `resources`). Los
recogibles que figuran por primera vez en un snapshot posterior tienen retardo 0. Durante su retardo el recogible **no
se ve** (sigue en el snapshot y se puede recoger) y no cuenta como visible en la sonda (ver "Sonda de render para
E2E"); al acabar el retardo empieza su aparición por el frame 0 de `spawn`. El retardo es solo de render: no cambia
el tick 0, los ids, las posiciones ni ninguna firma dorada (`RESOURCE_GOLDEN` incluida). Con e 0 todos empiezan a la
vez.

#### Scenario: Montones escalonados
- **GIVEN** unos datos de aspecto de prueba con e 100 y `spawn` de `wood` de 7 frames a 10 fps sin bucle, y una partida
  cuyo primer snapshot pintado tiene 8 recogibles `wood` de ids 0 a 7, pintado con el reloj en R0
- **WHEN** se pinta con R = R0 + 50, R0 + 350, R0 + 1.350 y R0 + 1.400
- **THEN** con R0 + 50 el id 0 muestra el frame 0 de `spawn` y los ids 1 a 7 no se ven (retardo): 1 sprite `wood`
  visible
- **AND** con R0 + 350 el id 0 muestra el frame 3, el id 3 el frame 0 y los ids 4 a 7 no se ven: 4 sprites `wood`
  visibles
- **AND** con R0 + 1.350 el id 7 muestra el frame 6 de `spawn` y los ids 0 a 6 reproducen `idle`
- **AND** con R0 + 1.400 los 8 reproducen `idle` y flotan; con R0 + 1.350 y R0 + 1.400 hay 8 sprites `wood` visibles
- **AND** en ningún frame se ve un montón con su aparición sin empezar ni un frame de `spawn` antes de su inicio

#### Scenario: Recoger un montón en su retardo
- **GIVEN** la partida de "Montones escalonados" y el jugador que recoge el montón de id 7 en un tick cuyo snapshot se
  pinta con R = R0 + 300 (en su retardo)
- **WHEN** se pintan ese frame y los siguientes hasta R0 + 1.400
- **THEN** el id 7 no se ve en ninguno de ellos y la madera recogida es la misma que con cualquier otro montón

#### Scenario: Recogible posterior sin retardo
- **GIVEN** la partida de "Montones escalonados" y un barril abatido que suelta un recogible `wood` de id 20, que figura
  por primera vez en un snapshot pintado con el reloj en R1
- **WHEN** se pinta ese frame
- **THEN** el id 20 muestra el frame 0 de `spawn` (retardo 0, no 20 × 100)

#### Scenario: Montones del repositorio
- **GIVEN** el contenido por defecto, la semilla 42 (mapa generado) y los datos de aspecto del repositorio
- **WHEN** se pinta el primer frame de la partida con el reloj en R0
- **THEN** los 8 montones de madera (ids 0 a 7) tienen inicios de aparición distintos dos a dos
- **AND** el último termina su aparición (k ≥ n) con R ≤ R0 + 3.000

#### Scenario: Desfase 0
- **GIVEN** los datos de "Montones escalonados" con e 0
- **WHEN** se pinta con R = R0 + 350
- **THEN** los 8 montones muestran el frame 3 de `spawn`

### Requirement: Iconos de recurso sin aparición ni flote
El sistema SHALL mantener los iconos de recurso del HUD (ver "Oro y madera en el HUD" en `hud`), del panel de obra
(ver `build-sites`) y de la guía (ver `menu-guide`) como antes de este change: usan el primer frame de la hoja `idle`
de su recogible (`G_Idle`, `W_Idle`, `M_Idle` y la roca `medium`, `Deco/05`; la gema, su forma de color), MUST NOT
usar ninguna hoja de aparición, no flotan y su tamaño en pantalla no depende de la escala ni del diámetro de los
aspectos de los recogibles.

#### Scenario: Iconos del HUD con otra escala de recogible
- **GIVEN** el HUD con una ventana de 1.280 × 720, una vez con las escalas de los recogibles del repositorio y otra con
  todas ellas y el diámetro de la gema multiplicados por 2
- **WHEN** se pintan 60 frames de 16,667 ms con la partida en curso
- **THEN** en ambos casos y en los 60 frames los iconos de oro, madera y piedra tienen la misma posición y el mismo
  tamaño en pantalla (error ≤ 0,001) y usan `G_Idle`, `W_Idle` y `Deco/05`

#### Scenario: Iconos de la guía y de la obra
- **GIVEN** el contenido por defecto
- **WHEN** se componen los iconos de recurso de la guía y del panel de obra
- **THEN** los de oro, madera, carne y piedra apuntan a `G_Idle`, `W_Idle`, `M_Idle` y `Deco/05`, ninguno a una hoja
  `*_Spawn`, y el de las gemas es una forma con el color de la gema

<!-- historial: 0012-sprite-rendering (2026-11-22) -->
<!-- historial: 0013-world-camera (2026-11-23) -->
<!-- historial: 0015-procedural-map (2026-11-23) -->
<!-- historial: 0016-map-art (2026-11-23) -->
<!-- historial: 0017-fullscreen-view (2026-11-24) -->
<!-- historial: 0018-map-culling (2026-11-24) -->
<!-- historial: 0020-enemy-behaviors (2026-11-24) -->
<!-- historial: 0021-goblin-camps (2026-11-24) -->
<!-- historial: 0022-resources-sheep (2026-11-24) -->
<!-- historial: 0023-sheep-meat (2026-11-24) -->
<!-- historial: 0025-stone-resource (2026-11-25) -->
<!-- historial: 0026-build-sites (2026-11-25) -->
<!-- historial: 0029-living-map (2026-11-26) -->
<!-- historial: 0030-pickup-visibility (2026-11-26) -->
