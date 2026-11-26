# Spec delta · sprite-rendering

<!-- Change 0034-upgrade-icons. Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Decisiones de design pendientes (no las fija esta spec): nombre de la sección de iconos en `appearance.json` y de
     sus campos, carpeta exacta de los iconos, si la curación usa la reserva de arma o una propia, nombre y forma de la
     sonda y nombre del tercer estado ("sin icono"). Donde un escenario dice "la reserva de la curación" vale la que
     fije el design. -->

## ADDED Requirements

### Requirement: Datos de los iconos de mejora
El sistema SHALL definir los iconos de las mejoras y de la curación solo en datos, en una sección de
`content/appearance.json` validada con zod en el arranque (antes de crear el menú o la partida, sin números mágicos en
el código de render), con:
- un **mapa por id**: cada clave es el id de una mejora de `content/upgrades.json` (de cualquiera de los dos
  catálogos) o el id del producto de curación de `content/shop.json` (`heal`), y cada valor la ruta de su imagen;
- los **iconos de reserva por categoría**: uno de personaje y uno de arma (y uno de la curación si el design le da
  reserva propia), todos obligatorios.

Cada ruta MUST cumplir las reglas de ruta de "Datos de aspecto validados" (relativa, `.png`, sin `..`, sin `/`
inicial ni esquema) y figurar en la lista de imágenes con IA de la nota de procedencia (ver "Procedencia de las imágenes
generadas con IA" en `asset-provenance`); una ruta de la lista de arte de Tiny Swords o de `fonts` no vale como icono.
Al arrancar, la composición MUST cruzar las claves del mapa con los ids de `upgrades.json` y el de la curación: una
clave que no es ninguno de ellos MUST hacer fallar el arranque con el error de contenido de siempre
(`showContentError`), que nombra esa clave; no se muestra el menú ni empieza ninguna partida. Una mejora o la curación
**sin** entrada en el mapa es válida y usa la reserva de su categoría (ver "Resolución del icono"). Un campo ausente o
desconocido, una reserva que falta o una ruta inválida MUST hacer fallar el arranque con un error que nombra el id o
la reserva y el campo. Los datos de iconos MUST NOT cambiar la simulación ni el plan del mapa: no los lee ningún flujo
de azar ni ninguna colocación por semilla (ovejas → solares → decoración se condicionan entre sí, pero ninguna de las
tres lee esta sección), de modo que con cualquier sección de iconos válida, vacía incluida, los objetos del mapa siguen
en 820 y 904 en las semillas 42 y 123.

#### Scenario: Iconos del repositorio
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** el mapa de iconos tiene exactamente 16 claves: `guardrail`, `shortcuts`, `context-window`,
  `regeneration`, `armor`, `steady-nerves`, `scholar`, `prospector`, `hunter`, `strict-rules`, `fast-ci`,
  `wide-analysis`, `hard-asserts`, `watch-mode`, `coverage` y `heal`
- **AND** hay icono de reserva de personaje y de arma, y cada ruta del mapa y de las reservas figura en la lista de
  imágenes con IA de la nota
- **AND** los ids de `upgrades.json` son iguales, uno a uno y en orden, a los de antes del change

#### Scenario: Id desconocido
- **GIVEN** el contenido por defecto con una clave extra `dragon-slayer` en el mapa de iconos, con una ruta válida
- **WHEN** se ejecuta el arranque del juego, con y sin `?e2e`
- **THEN** en ambos casos el arranque muestra el error de contenido, que nombra `dragon-slayer`, no se crea el menú y
  no existe ninguna partida

#### Scenario: Mejora sin entrada
- **GIVEN** el contenido por defecto sin la entrada de `armor` y, en otro caso, sin la de `coverage` y sin la de
  `heal`
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito, y `armor` se resuelve a la reserva de personaje, `coverage` a la de arma y `heal` a
  la reserva de la curación

#### Scenario: Datos de iconos inválidos
- **GIVEN** los datos del repositorio con, en un caso cada vez: sin la reserva de arma; un campo extra `size` en la
  sección; la ruta de `armor` igual a `""`, `"../armor.png"`, `"/armor.png"`, `"https://ejemplo.com/armor.png"`,
  `"data:image/png;base64,AAAA"`, `"armor.gif"`, una ruta `.png` que no figura en la nota o la ruta de la hoja de
  `Arrow.png` (lista de arte); o la ruta de la reserva de personaje igual a la de la fuente
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra la reserva de arma, `size`, `armor` (en sus ocho casos) y la
  reserva de personaje respectivamente
- **AND** no se muestra el menú ni empieza ninguna partida

#### Scenario: Los iconos no cambian la simulación ni el mapa
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick y
  la política de elección fija, una con la sección de iconos del repositorio y otra con el mapa de iconos vacío
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick
- **AND** con el contenido por defecto los objetos del mapa son 820 y 904 en las semillas 42 y 123, `BALANCE_BASELINE`
  y `BUILDER_REFERENCE` siguen idénticos semilla a semilla (1..50) con 0 quietos y las seis firmas doradas no cambian

### Requirement: Imágenes con IA solo en los iconos
El sistema SHALL usar las imágenes de la lista de imágenes con IA solo como iconos de mejora, de curación y sus
reservas. La hoja de cualquier aspecto (jugador, enemigos, cadáver, proyectil, recogibles y sus apariciones, ovejas,
dinamita, explosión, fondo, mapa, estructuras, solares, decoración) y la de cualquier pieza de la interfaz MUST figurar
en la lista de arte de Tiny Swords; una que apunte a una imagen de la lista de imágenes con IA MUST hacer fallar el
arranque con un error que nombra el aspecto o la pieza. Así se mantiene el Won't del GDD "enemigos dibujados con IA".

#### Scenario: Aspecto con una imagen con IA
- **GIVEN** los datos del repositorio con, en un caso cada vez, la hoja de `goblin-torch`, la de la oveja en pasto o
  la de la pieza `panel` igual a la ruta del icono de `armor`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra la hoja de `goblin-torch`, la de la oveja y la de `panel`
  respectivamente
- **AND** no se muestra el menú ni empieza ninguna partida

### Requirement: Resolución del icono
El sistema SHALL resolver el icono que se muestra para una mejora o para la curación, con una regla pura que depende
solo del id, de su categoría (personaje, arma o curación), de los datos de iconos y del conjunto de imágenes cargadas:
1. si el id tiene entrada y su imagen está cargada, su icono (estado `painted`);
2. si no, si la reserva de su categoría está cargada, la reserva (estado `fallback`);
3. si no, ningún icono (estado sin icono; nombre: decisión de design): el hueco del icono queda vacío y el resto de la
   carta o de la fila no cambia.

La resolución MUST NOT depender del snapshot, del tick ni del reloj de render, y MUST NOT producir errores no
capturados. Un icono que no carga MUST NOT impedir elegir una mejora ni comprar un producto.

#### Scenario: Tabla de resolución
- **GIVEN** los datos de iconos del repositorio
- **WHEN** se resuelve, en un caso cada vez: `armor` con todo cargado; `armor` con su imagen sin cargar; `armor` con su
  imagen y la reserva de personaje sin cargar; `coverage` con su imagen sin cargar; `heal` con su imagen sin cargar
- **THEN** se obtienen respectivamente el icono de `armor` (`painted`), la reserva de personaje (`fallback`), ningún
  icono (sin icono), la reserva de arma (`fallback`) y la reserva de la curación (`fallback`)

#### Scenario: Reserva de otra categoría sin efecto
- **GIVEN** los datos de iconos del repositorio con la reserva de arma sin cargar y el icono de `armor` sin cargar
- **WHEN** se resuelve `armor`
- **THEN** se obtiene la reserva de personaje (`fallback`)

### Requirement: Carga y escalado de los iconos
El sistema SHALL cargar las imágenes de los iconos y de sus reservas en el arranque, con el resto del arte, antes de
crear el menú (o la partida con `?e2e`), desde el mismo origen y bajo la base `/tfm-survivors/`, con las reglas de
"Carga del arte compatible con la CSP" (sin `blob:`, sin URL remota, sin cambiar la CSP). El fallo de una imagen de
icono se anota como no cargada y MUST NOT romper el arranque ni la partida. Los iconos MUST escalarse sin suavizado en
cualquier tamaño: en Phaser, cada textura de icono y de reserva con el filtro de vecino más cercano (`NEAREST`); en el
DOM, con `image-rendering: pixelated`. Los iconos no son sprites del mundo: MUST NOT contar en los recuentos de aspecto
de reserva de la sonda de render, y su fallo no cambia el aspecto de ningún sprite ni de ninguna pieza de UI.

#### Scenario: URLs de los iconos bajo la base
- **GIVEN** los datos de iconos del repositorio y la base `/tfm-survivors/`
- **WHEN** se calculan las URL de cada icono y de cada reserva
- **THEN** cada URL empieza por `/tfm-survivors/assets/` y ninguna empieza por `http:`, `https:`, `//`, `data:` ni
  `blob:`, y cada fichero referido existe en `dist/` tras `build`

#### Scenario: Filtro sin suavizado
- **GIVEN** el arranque con dobles de Phaser y todas las imágenes de iconos cargadas
- **WHEN** termina el arranque
- **THEN** cada textura de icono y de reserva (16 + las reservas) tiene el filtro `NEAREST`

#### Scenario: Partida entera con todos los iconos sin cargar
- **GIVEN** todas las imágenes de iconos y de reserva sin cargar, la semilla 42 y el bot de referencia
- **WHEN** se ejecutan 3.600 ticks pintando cada snapshot con dobles de Phaser, eligiendo la opción 0 en cada oferta
- **THEN** no hay errores no capturados y los snapshots son iguales campo a campo, en cada tick, a los de la misma
  partida con todos los iconos cargados
- **AND** la sonda de render informa de 0 sprites con aspecto de reserva en ambos casos

### Requirement: Iconos observables en el navegador
La sonda E2E (`window.__sprint`, solo con `?e2e`) SHALL exponer, en el último frame pintado, el estado del icono
(`painted`, `fallback` o sin icono, ver "Resolución del icono") de cada carta de la oferta abierta, con el id de su
opción, y de cada fila de la tienda abierta, con el id de su producto (nombre y forma de la sonda: decisión de design).
Sin oferta, la lista de cartas está vacía; con la tienda cerrada, la de filas. Leer la sonda MUST NOT cambiar la
simulación ni lo que se pinta.

#### Scenario: Estados en la sonda
- **GIVEN** una oferta de 3 opciones `guardrail`, `shortcuts` y `hunter` con la imagen de `shortcuts` sin cargar, y
  una tienda abierta con la imagen de `heal` y la reserva de la curación sin cargar, pintadas con dobles
- **WHEN** se lee la sonda tras cada pintado
- **THEN** las cartas informan `painted`, `fallback` y `painted` en ese orden, con sus ids, y la fila `heal` informa
  sin icono mientras las otras 6 informan `painted`
- **AND** con la oferta cerrada la lista de cartas está vacía y con la tienda cerrada la de filas también

#### Scenario: Iconos en la oferta y en la tienda [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` (el reloj de render solo avanza `n × TICK_MS` con cada
  `step(n)`, 0014) y una prueba que escucha `securitypolicyviolation`, ampliando un test existente de la suite de humo
  (cuál: decisión de design)
- **WHEN** se avanza con `step(n)` hasta la primera oferta de mejora y, en su caso, hasta que la partida está en tienda
- **THEN** la sonda informa de `painted` en cada carta de la oferta y en cada una de las 7 filas de la tienda
- **AND** se registran 0 eventos `securitypolicyviolation` y 0 errores no capturados

## MODIFIED Requirements

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
  `Deco/18.png` (espantapájaros), una hoja por aspecto de decoración;
- cada pieza de la interfaz (ver "Datos de aspecto de la interfaz"), con una hoja de `UI/Banners`, `UI/Buttons` o
  `UI/Ribbons` del pack; ninguna de `UI/Icons` ni de `UI/Pointers`.

La **única excepción** al arte de Update 010 son los iconos de las mejoras, de la curación y sus reservas (ver "Datos de
los iconos de mejora"): son imágenes generadas con IA de la lista de imágenes con IA de la nota (ver `asset-provenance`)
y no son la hoja de ningún aspecto ni de ninguna pieza (ver "Imágenes con IA solo en los iconos").

Los avisos no usan hoja. La unidad o el elemento de cada hoja se comprueba con la ruta de origen que registra la nota
de procedencia (ver `asset-provenance`). Del pack solo se versionan las hojas que usan los datos de aspecto, como hoja
de un aspecto, de una animación de aparición o de una pieza de la interfaz (ningún otro color de castillo ni de torre,
ni `Rocks`, ni `Fire.png`, ni `Wood_Tower_InConstruction`, ni `GoldMine_Destroyed.png`, ni variantes `_(NoShadow)`, ni
`HappySheep_All`, ni `Deco/12`–`Deco/15`, ni piezas de UI que no use ningún rol); de la lista de imágenes con IA, solo
las que usan los datos de iconos. Las rocas `Deco/04`–`06` son solo de la piedra recogible: ningún aspecto de
decoración las usa. Cambiar el arte de un elemento, de una pieza o de un icono MUST requerir solo cambios de datos y de
assets, no de código.

#### Scenario: Hoja de cada elemento
- **GIVEN** los datos de aspecto del repositorio y la nota de procedencia
- **WHEN** se busca en la nota la ruta de origen de la hoja de cada aspecto, de cada animación de aparición y de cada
  pieza de la interfaz
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
- **AND** la de cada pieza de la interfaz empieza por `Tiny Swords (Update 010)/UI/Banners/`,
  `Tiny Swords (Update 010)/UI/Buttons/` o `Tiny Swords (Update 010)/UI/Ribbons/`
- **AND** todas las rutas de origen de la lista de arte pertenecen a Tiny Swords Update 010, y ninguna hoja de aspecto,
  de aparición ni de pieza está en la lista de imágenes con IA

#### Scenario: Solo las hojas usadas
- **GIVEN** la lista de ficheros versionados y los datos de aspecto del repositorio
- **WHEN** se compara cada asset gráfico de la nota de procedencia con las hojas de los datos de aspecto y con las
  imágenes de los datos de iconos
- **THEN** cada asset de la lista de arte es la hoja de ≥ 1 aspecto, de ≥ 1 animación de aparición o de ≥ 1 pieza de
  la interfaz, cada asset de la lista de imágenes con IA es la imagen de ≥ 1 id o de ≥ 1 reserva de los datos de iconos,
  y ningún fichero versionado contiene `Castle_Red`, `Castle_Yellow`, `Castle_Purple`, `Castle_Black`, `Rocks`,
  `Fire`, `Wood_Tower_InConstruction`, `GoldMine_Destroyed`, `NoShadow` ni `HappySheep_All`
- **AND** los assets gráficos versionados que contienen `_Spawn` son exactamente `G_Spawn.png`, `W_Spawn.png` y
  `M_Spawn.png`, cada uno 1 vez
- **AND** de `Wood_Tower_Red`, `Wood_Tower_Blue`, `Wood_Tower_Purple` y `Wood_Tower_Yellow` hay exactamente 1 fichero
  versionado, el de la hoja de la torre
- **AND** los ficheros versionados de la carpeta `Deco/` de los assets son exactamente `01`–`11` y `16`–`18` (`.png`),
  cada uno 1 vez, y ninguno de `12`–`15`
- **AND** ningún fichero versionado procede de `UI/Icons` ni de `UI/Pointers`

#### Scenario: Partida con arte
- **GIVEN** la build de producción servida con `?e2e&seed=42`
- **WHEN** termina la carga y se pintan 600 frames
- **THEN** en cada frame la sonda informa de 1 sprite de fondo, de 0 sprites con aspecto de reserva y de un sprite
  de jugador visible salvo en los frames en que el parpadeo lo oculta (ver `player-health`)
- **AND** en algún frame hay ≥ 1 enemigo, ≥ 1 proyectil y ≥ 1 gema visibles, todos con su aspecto

#### Scenario: Pieza de UI de más
- **GIVEN** una lista simulada igual a la real más `UI/Buttons/Button_Red_3Slides.png` con su entrada en la nota, sin
  que ningún rol la use
- **WHEN** se ejecuta el test de "Solo las hojas usadas"
- **THEN** falla y nombra `Button_Red_3Slides.png`

### Requirement: Carga del arte compatible con la CSP
El sistema SHALL cargar todas las hojas (también las de las piezas de la interfaz, tanto las que pinta Phaser como las
que usa la hoja de estilos), las imágenes de los iconos de mejora y de sus reservas (en las cartas de Phaser y en las
filas DOM de la tienda) y el fichero de la fuente pixel sin ninguna violación de la Content Security Policy y sin
cambiar sus directivas (`img-src 'self' data:`, `default-src 'self'`, sin `font-src`, y las demás, ver "Política de
seguridad de contenido" en `progress-persistence`), tanto al arrancar desde el menú como con `?e2e`, en `vite preview` y
en la URL pública, bajo la base `/tfm-survivors/`. La carga MUST terminar antes del primer frame que pinta un elemento de
la partida: ningún elemento se pinta con una hoja sin cargar (las piezas sin cargar usan su reserva, ver "Reserva de las
piezas de UI y de la fuente"; los iconos sin cargar, la suya, ver "Resolución del icono"). Con `?e2e`, la carga del arte
MUST conservar el comportamiento de "Carga en modo E2E" (`main-menu`).

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
- **THEN** sus directivas son iguales, una a una, a las de antes del change, `img-src` es `'self' data:` y no hay
  `font-src`

#### Scenario: Arte en la URL pública
- **GIVEN** la URL pública y el smoke remoto a demanda (ver `public-deploy`)
- **WHEN** carga la página sin parámetros y pulsa `Jugar`
- **THEN** cada hoja de los datos de aspecto, incluidas las de las piezas de la interfaz, y cada imagen de los datos de
  iconos se pide bajo `/tfm-survivors/` y responde 200 con tipo `image/png`, y la fuente responde 200
- **AND** se registran 0 eventos `securitypolicyviolation` y 0 errores no capturados

#### Scenario: URLs de las piezas y de la fuente bajo la base
- **GIVEN** los datos de `ui` del repositorio y la base `/tfm-survivors/`
- **WHEN** se calculan las URL de las 8 piezas que se publican para el DOM y la URL de la fuente, y se lee la hoja de
  estilos del repositorio
- **THEN** cada URL de pieza empieza por `/tfm-survivors/assets/tiny-swords/UI/` y la de la fuente es
  `/tfm-survivors/assets/fonts/DepartureMono-Regular.woff2`; ninguna empieza por `http:`, `https:`, `//` ni `data:`
- **AND** la hoja de estilos no contiene ningún `url(` literal y cada fichero referido existe en `dist/` tras `build`

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
la hoja del fondo, salvo la orilla si su hoja es la del fondo. Las piezas de la interfaz tienen también su propia
reserva (ver "Reserva de las piezas de UI y de la fuente"): no cuentan como sprites con aspecto de reserva y su fallo no
cambia el aspecto de ningún sprite. Los iconos de mejora y de curación tienen su propia reserva por categoría (ver
"Resolución del icono"): no son sprites, no cuentan como sprites con aspecto de reserva y su fallo no cambia el aspecto
de ningún sprite ni de ninguna pieza.

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

#### Scenario: Pieza de UI que falla sin reserva de sprites
- **GIVEN** la textura de `button` sin cargar y el resto de hojas cargadas, con una oferta abierta de 3 opciones
- **WHEN** se pinta el snapshot
- **THEN** la sonda cuenta 0 sprites con aspecto de reserva y los enemigos, proyectiles y recogibles se pintan con su
  arte

#### Scenario: Icono que falla sin reserva de sprites
- **GIVEN** las imágenes de los iconos de las 3 opciones de una oferta abierta y la reserva de personaje sin cargar, y
  el resto de hojas cargadas
- **WHEN** se pinta el snapshot
- **THEN** la sonda cuenta 0 sprites con aspecto de reserva y los enemigos, proyectiles, recogibles y la pieza de cada
  carta se pintan con su arte

### Requirement: Piezas de UI en los paneles DOM
El sistema SHALL vestir con piezas los 7 paneles DOM de la interfaz, identificados por sus clases actuales:
`.menu-panel` (menú de inicio), `.pause-panel` (pausa), `.confirm-dialog` (diálogo de `Borrar datos`), `.guide-modal`
(guía), `.results-panel` (resultados), `.shop-panel` (tienda) y `.build-panel` (obra). Cada panel MUST usar la pieza de
`panel` como marco, y cada `button` dentro de ellos la de `button`; con el puntero encima o con foco visible, la de
`buttonHover` (el foco de teclado conserva además un contorno visible de 2 px); mientras se pulsa, la de
`buttonPressed`; desactivado (`disabled`) o marcado como no disponible (filas no comprables de la tienda y no asequibles
de la obra), la de `buttonDisabled`; el botón `Confirmar` del diálogo de borrado, la de `buttonDanger` (y
`buttonDangerPressed` al pulsarlo). Los títulos de panel (`h1` del menú; `h2` de la pausa, la guía, la tienda y la obra;
título de resultados) usan la de `header`, con alto (alto declarado × k) px; el diálogo no tiene título. Con escala de UI
k, cada esquina en pantalla de cada pieza MUST medir exactamente (margen × k) px en cada eje, y el contenido (textos,
iconos y botones interiores) MUST quedar dentro del área útil de su panel o de su botón; cada botón mide al menos
(t + b)·k px de alto. Los textos sobre una pieza usan sus tintas: `text` para el texto normal, `muted` para el
secundario (descripciones), `accent` para los mensajes y el indicador de página y `danger` para avisos y cifras que
faltan. Las URL de las piezas salen de los datos de `ui` con la base `/tfm-survivors/`; la hoja de estilos no escribe
ninguna URL. Vestir los paneles MUST NOT cambiar el DOM: las clases, los roles ARIA, los textos visibles, el orden de
los botones, el foco y el atributo `hidden` son los de antes de 0032, ningún elemento de los paneles tiene atributo
`style`, y los selectores de `smoke`, `progress` y `gameplay`.spec y de `tests/support/probe.ts` no cambian. La única
diferencia en el DOM desde 0034 es el icono de cada fila de producto de la tienda (ver "Icono en las filas de la
tienda" en `castle-shop`): un elemento de imagen más por fila, sin atributo `style`, que no cambia las clases, los
roles, los textos visibles, el orden de los botones ni el foco. El centrado, el ajuste a la ventana y la reubicación al
redimensionar de cada panel siguen las reglas de su capacidad (`main-menu`, `menu-guide`, `run-results`,
`castle-shop`, `build-sites`).

#### Scenario: Esquinas a ×1 y a ×2
- **GIVEN** una pieza de prueba de `panel` con márgenes (24, 20, 24, 28)
- **WHEN** se calculan las esquinas en pantalla de un panel con k = 1 y con k = 2
- **THEN** con k = 1 miden 24 × 20, 24 × 20, 24 × 28 y 24 × 28 px, y con k = 2 miden 48 × 40, 48 × 40, 48 × 56 y
  48 × 56 px, sin escalado fraccionario

#### Scenario: Los siete paneles con la pieza de panel
- **GIVEN** la hoja de estilos del repositorio y los datos de `ui`
- **WHEN** se leen las reglas de las 7 clases de panel y de sus botones
- **THEN** las 7 usan la pieza de `panel` y sus botones la de `button`, `:hover` y `:focus-visible` la de
  `buttonHover`, `:active` la de `buttonPressed`, `:disabled` y las filas no disponibles la de `buttonDisabled`, y
  `Confirmar` del diálogo la de `buttonDanger` (`buttonDangerPressed` en `:active`)
- **AND** el relleno interior de cada panel y de cada botón es ≥ su margen × k en cada lado y la hoja de estilos no
  contiene ningún `url(` literal

#### Scenario: Variables solo de las piezas cargadas
- **GIVEN** los datos de `ui` del repositorio y la base `/tfm-survivors/`, con las 8 piezas cargadas y, en otro caso,
  todas menos `panel`
- **WHEN** se calculan las propiedades de las piezas que se publican para el DOM
- **THEN** en el primer caso se publican las 8 con su URL bajo `/tfm-survivors/assets/tiny-swords/UI/`, sus márgenes y
  sus tintas; en el segundo, todas salvo la imagen y los márgenes de `panel`
- **AND** en ambos casos la familia se publica como `"Departure Mono", monospace`

#### Scenario: DOM sin cambios
- **GIVEN** el menú, la pausa, el diálogo, la guía, los resultados, la tienda y la obra montados en un DOM de prueba
  antes y después de este change, con los mismos estados
- **WHEN** se comparan sus elementos
- **THEN** las clases, los roles, los textos visibles, el orden de los botones y el elemento con el foco son iguales, y
  ningún elemento tiene atributo `style`
- **AND** la única diferencia es 1 elemento de imagen más dentro de cada una de las 7 filas de producto de la tienda;
  el menú, la pausa, el diálogo, la guía, los resultados y la obra son idénticos

## REMOVED Requirements
<!-- Ninguno. -->
