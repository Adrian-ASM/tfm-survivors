# Spec delta · sprite-rendering

> Change 0032-ui-kit. Convenciones de este delta (válidas también en los deltas de `main-menu`, `menu-guide`,
> `run-results`, `upgrades`, `hud`, `castle-shop`, `build-sites` y `asset-provenance` de este change):
> - "Pieza" es una imagen de `Tiny Swords (Update 010)/UI/` estirada con nine-slice (sus 4 esquinas se pintan sin
>   deformar, los 4 bordes se estiran en un solo eje y el centro en los dos) o, la cabecera, con 3-slice (alto fijo;
>   las 2 colas laterales sin deformar y el centro estirado en horizontal).
> - "Rol" es el nombre de una pieza en `ui`. El catálogo es cerrado y tiene exactamente 8 roles: `panel` (marco de los
>   paneles DOM y de los 3 paneles del HUD), `button` (botón normal y marco de las cartas de mejora), `buttonHover`
>   (puntero encima o foco visible), `buttonPressed` (pulsado), `buttonDisabled` (desactivado o fila no disponible),
>   `buttonDanger` y `buttonDangerPressed` (botón de confirmar el borrado, normal y pulsado) y `header` (cabecera
>   3-slice de los títulos de panel).
> - "Márgenes" de una pieza (su `slice`): (l, t, r, b) = izquierdo, superior, derecho e inferior, en píxeles de la hoja;
>   en `header`, solo l y r (t = b = 0).
> - "Tintas" de una pieza: los colores de texto que van sobre ella, `text`, `muted`, `accent` y `danger`; "relleno"
>   (`fill`): el color de su centro.
> - "k" es la escala de UI de la ventana: el escalón entero ≥ 1 de "Escala del HUD por escalones" (`hud`), el mismo
>   que el DOM recibe como `--ui-scale`.
> - "Esquina en pantalla" de una pieza: el rectángulo de la esquina tal y como se pinta; con márgenes (l, t, r, b) y
>   escala k mide l·k × t·k (superior izquierda), r·k × t·k, l·k × b·k y r·k × b·k.
> - "Área útil" de una superficie vestida con una pieza: su rectángulo exterior menos l·k a la izquierda, t·k arriba,
>   r·k a la derecha y b·k abajo.
> - "Contraste" entre dos colores: la razón de luminancia relativa de WCAG 2.x, (L1 + 0,05) / (L2 + 0,05) con L1 ≥ L2.
> - "Aspecto actual" (el de antes del change): botones DOM con fondo `#23233a`, borde de 1 px `#7ce2fe` y texto blanco;
>   paneles DOM con borde de 1 px `#7ce2fe` (`#f5c542` en la tienda) y fuente `monospace`; cartas de mejora con un
>   rectángulo de relleno `#23233a`, trazo `#7ce2fe` y texto `#ffffff`; HUD sin marcos, con texto `#ffffff` y barras
>   con fondo `#2a2a3a`; textos de Phaser en `monospace`.
> - "Reserva de un panel DOM" (decisión del autor): borde de 1 px del aspecto actual, fondo = relleno de `panel` y
>   textos con las tintas de `panel`. Del resto de superficies, la reserva es su aspecto actual.
> - Los escenarios sin `[E2E]` se verifican sin navegador (tests unitarios, de infraestructura con dobles de Phaser, de
>   lectura de la hoja de estilos o de composición). El único `[E2E]` del change amplía un test de humo existente
>   (`main-menu`, "Menú con piezas en el navegador"); no hay E2E nuevos.

## ADDED Requirements

### Requirement: Datos de aspecto de la interfaz
El sistema SHALL definir el aspecto de la interfaz de pantalla solo en datos, en una sección `ui` de
`content/appearance.json` validada con zod en el arranque con las reglas de "Datos de aspecto validados" (antes de crear
el menú o la partida, sin números mágicos en el código de render). La sección tiene:
- las piezas: exactamente una por cada uno de los 8 roles; un rol que falta o sobra es error;
- en cada pieza: la hoja, con las reglas de ruta de "Datos de aspecto validados" y presente en la nota de procedencia;
  los márgenes (enteros ≥ 0; en `header`, solo l y r, y además su alto, entero ≥ 1); el relleno y las 4 tintas
  (`#RRGGBB`);
- la fuente: la familia (letras, cifras y espacios, no vacía) y el fichero (`.woff2`, formato `woff2`), que figura en el
  registro de fuentes de la nota de procedencia (ver "Procedencia y licencia de la fuente" en `asset-provenance`).

El contraste entre las tintas `text`, `muted` y `accent` de cada pieza y su relleno MUST ser ≥ 4,5. La tinta `danger`
solo se exige (por decisión del autor) en las piezas donde se pinta texto de peligro, `panel` (avisos) y
`buttonDisabled` («faltan N», `Oro insuficiente`): en ellas MUST ser roja (componente roja ≥ 96 y ≥ 2 veces la verde y
≥ 2 veces la azul) y tener contraste ≥ 4,5 con su relleno; en el resto de piezas (los botones rojos incluidos) no se
pinta texto con ella y no se comprueba. Un campo ausente o desconocido, un margen negativo o no
entero, una cabecera sin alto, un color con otro formato, un contraste insuficiente, una hoja que no figura en la nota o
un fichero de fuente sin registro MUST hacer fallar el arranque con un error que nombre la pieza (o la fuente) y el
campo, por la vía de siempre del contenido inválido: no se muestra el menú ni empieza ninguna partida. Con los datos del
repositorio, además, cada hoja versionada MUST medir lo que esperan sus márgenes (l + r < ancho y t + b < alto; en
`header`, alto del PNG = alto declarado) y el relleno de cada pieza MUST coincidir con el color medio del centro de su
hoja (error ≤ 16 por canal); lo comprueba un test sobre los PNG del repositorio, no el arranque. Los datos de
interfaz MUST NOT cambiar la simulación ni el plan del mapa: no los lee ningún flujo de azar ni ninguna colocación por
semilla (ovejas, solares, decoración), de modo que con cualquier sección `ui` válida los objetos del mapa siguen en 820 y
904 en las semillas 42 y 123.

#### Scenario: Datos de interfaz del repositorio
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** la sección `ui` es válida, con exactamente los 8 roles, y la familia de la fuente es `Departure Mono` con el
  fichero `DepartureMono-Regular.woff2`
- **AND** la hoja de cada pieza figura en la nota de procedencia con ruta de origen bajo `Tiny Swords (Update 010)/UI/`
- **AND** las tintas `text`, `muted` y `accent` de cada pieza tienen contraste ≥ 4,5 con su relleno, y la tinta
  `danger` de `panel` y de `buttonDisabled` es roja y tiene contraste ≥ 4,5 con su relleno

#### Scenario: Tinta de peligro no exigida en los botones rojos
- **GIVEN** los datos del repositorio con la tinta `danger` de `buttonDangerPressed` igual a su relleno (`#996878`)
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Hojas de las piezas medidas
- **GIVEN** los PNG versionados de las 8 piezas y los datos de `ui` del repositorio
- **WHEN** se leen su ancho, su alto y el color medio de su centro
- **THEN** en cada pieza 9-slice l + r < ancho y t + b < alto; en `header`, l + r < ancho y el alto del PNG es el
  declarado; y el relleno de cada pieza coincide con el color medio de su centro (error ≤ 16 por canal)

#### Scenario: Datos de interfaz inválidos
- **GIVEN** los datos de aspecto del repositorio con, en un caso cada vez: sin la pieza `buttonDanger`; una pieza extra
  `tooltip`; el margen `left` de `panel` −1; el margen `top` de `button` 2,5; `header` sin alto; la tinta `text` de
  `panel` `white`; la tinta `text` de `panel` igual a su relleno; la tinta `danger` de `buttonDisabled` `#3080FF`; un campo
  extra `shadow` en `button`; la hoja de `panel` con una ruta `.png` que no figura en la nota; la familia de la fuente
  `Departure, Mono`; el fichero de la fuente `DepartureMono-Regular.ttf`; o un fichero `.woff2` sin registro en la nota
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra respectivamente `buttonDanger`, `tooltip`, `panel` y `left`, `button`
  y `top`, `header` y su alto, `panel` y `text` (dos veces), `buttonDisabled` y `danger`, `shadow`, la hoja de `panel`, la
  familia, el fichero y el fichero de la fuente
- **AND** no se muestra el menú ni empieza ninguna partida

#### Scenario: La interfaz no cambia la simulación ni el mapa
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick y
  la política de elección fija, una con la sección `ui` del repositorio y otra con todos los márgenes a 0, otros
  colores válidos y otra familia de fuente
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick
- **AND** con el contenido por defecto los objetos del mapa son 820 y 904 en las semillas 42 y 123, `BALANCE_BASELINE` y
  `BUILDER_REFERENCE` siguen idénticos semilla a semilla (1..50) con 0 quietos y las seis firmas doradas no cambian

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
los botones, el foco y el atributo `hidden` son los de antes del change, ningún elemento de los paneles tiene atributo
`style`, y los selectores de `smoke`, `progress` y `gameplay`.spec y de `tests/support/probe.ts` no cambian. El
centrado, el ajuste a la ventana y la reubicación al redimensionar de cada panel siguen las reglas de su capacidad
(`main-menu`, `menu-guide`, `run-results`, `castle-shop`, `build-sites`).

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
  antes y después del change, con los mismos estados
- **WHEN** se comparan sus elementos
- **THEN** las clases, los roles, los textos visibles, el orden de los botones y el elemento con el foco son iguales, y
  ningún elemento tiene atributo `style`

### Requirement: Fuente pixel local
El sistema SHALL pintar los textos de los paneles DOM (menú, pausa, diálogo de `Borrar datos`, guía, resultados, tienda y
obra) y los textos de Phaser de las cartas de mejora y del HUD con la familia de `ui` (Departure Mono), seguida de
`monospace` como caída. El fichero de la fuente (`DepartureMono-Regular.woff2`) MUST servirse desde el mismo origen, en
`/tfm-survivors/assets/fonts/`, con licencia OFL 1.1 registrada (ver "Procedencia y licencia de la fuente" en `asset-provenance`), sin URL remota ni `data:`. Los textos de
Phaser de las cartas y del HUD MUST crearse con la fuente ya disponible si llega a cargar; la espera de la fuente MUST
NOT retrasar la aparición del menú (o de la partida con `?e2e`) más de 3.000 ms, y si no carga o no llega a tiempo se
usa `monospace` sin errores no capturados. Una fuente cuya carga falla sin error del cargador MUST detectarse igual
(la familia no figura como disponible al terminar la carga) y tratarse como no cargada. Los números de daño y las barras de vida del mundo (ver "Números de daño" y
"Barras de vida de las estructuras") no cambian de fuente. La fuente MUST NOT cambiar la simulación.

#### Scenario: Familia con caída en el DOM y en Phaser
- **GIVEN** el contenido por defecto con la familia de `ui` F
- **WHEN** se crean el menú, las cartas de una oferta de 3 opciones y el HUD con dobles de Phaser
- **THEN** la familia declarada para los 7 paneles DOM es F seguida de `monospace`, y cada texto de las 3 cartas y del
  HUD se crea con la familia F seguida de `monospace`

#### Scenario: Fuente que no carga
- **GIVEN** el arranque con la carga de la fuente que falla
- **WHEN** termina el arranque
- **THEN** se crea el menú, no hay errores no capturados y una partida empezada con `Jugar` avanza 600 ticks con su HUD

#### Scenario: Fuente que no responde
- **GIVEN** el arranque con un reloj de prueba y la carga de la fuente que no termina nunca
- **WHEN** el reloj avanza 3.000 ms
- **THEN** el menú se ha creado como muy tarde en ese instante y los textos de Phaser creados después usan la caída
  `monospace`

#### Scenario: Los números de daño conservan su fuente
- **GIVEN** un snapshot con 1 golpe nuevo de clase `enemy`
- **WHEN** se pinta con dobles de Phaser
- **THEN** el número de daño se crea con el mismo estilo de texto que antes del change

### Requirement: Reserva de las piezas de UI y de la fuente
El sistema SHALL, si la hoja de una pieza no carga, pintar las superficies que la usan con su reserva y, si la fuente
no carga, con `monospace`. En el DOM, un panel sin su pieza de `panel` MUST pintarse con la reserva de panel (borde de
1 px del aspecto actual, fondo = relleno de `panel` y textos con las tintas de `panel`, de modo que el texto conserva
contraste ≥ 4,5), y un botón sin su pieza, con el aspecto actual (fondo `#23233a`, borde de 1 px `#7ce2fe` y texto
blanco). En Phaser, si la textura de la pieza no existe o el renderizador no es WebGL, una carta MUST pintarse con el
rectángulo del aspecto actual (relleno `#23233a`, trazo `#7ce2fe`, texto `#ffffff`), del mismo tamaño y con la misma
zona de clic, y el HUD sin paneles, con su texto `#ffffff` y sus barras de siempre. Las piezas de UI no son sprites: una pieza en reserva MUST NOT contar en los recuentos de aspecto de reserva de la sonda de render (ver "Sonda de
render para E2E"). Con cualquier combinación de piezas o fuente sin cargar, la partida MUST poder jugarse hasta el final
(elegir mejora, comprar, construir, pausar, terminar y reiniciar) sin errores no capturados; las clases, roles, textos,
foco y sondas no cambian.

#### Scenario: Reglas de reserva declaradas en el DOM
- **GIVEN** la hoja de estilos del repositorio
- **WHEN** se leen las reglas de `.menu-panel`, `.pause-panel`, `.confirm-dialog`, `.guide-modal`, `.results-panel`,
  `.shop-panel` y `.build-panel` y las de sus botones
- **THEN** cada panel declara un borde de 1 px `#7ce2fe` (`#f5c542` en `.shop-panel`) y cada botón un borde de 1 px
  `#7ce2fe` y el fondo `#23233a`, además de la pieza de su rol
- **AND** la familia de cada panel termina en `monospace`

#### Scenario: Reserva del panel con el relleno de la pieza
- **GIVEN** los datos de `ui` del repositorio con la pieza de `panel` sin cargar
- **WHEN** se calculan el fondo y los colores de texto de reserva de los 7 paneles
- **THEN** el fondo es el relleno de `panel` y el texto normal su tinta `text`, con contraste ≥ 4,5, y el borde sigue
  siendo el de 1 px del aspecto actual

#### Scenario: Carta sin textura
- **GIVEN** la textura de `button` ausente (y, en otro caso, un renderizador Canvas) y un snapshot con una oferta de 3
  opciones
- **WHEN** se pinta el overlay de elección con dobles de Phaser
- **THEN** hay 3 rectángulos con relleno `#23233a`, trazo `#7ce2fe` y texto `#ffffff`, 0 piezas nine-slice, y cada
  rectángulo ocupa el rectángulo de su carta del layout
- **AND** pulsar la tecla 2 elige la opción de índice 1

#### Scenario: HUD sin textura
- **GIVEN** la textura de `panel` ausente y el snapshot de una partida recién creada
- **WHEN** se pinta el HUD con dobles de Phaser
- **THEN** hay 0 piezas nine-slice, los textos son `#ffffff`, las barras de vida y de XP tienen fondo `#2a2a3a` y la de
  vida tiene relleno 1

#### Scenario: Partida entera con todas las piezas en reserva
- **GIVEN** las 8 texturas de las piezas y la fuente sin cargar, la semilla 42 y el bot de referencia
- **WHEN** se ejecutan 3.600 ticks pintando cada snapshot con dobles de Phaser, eligiendo la opción 0 en cada oferta
- **THEN** no hay errores no capturados y los snapshots son iguales campo a campo, en cada tick, a los de la misma
  partida con todas las piezas cargadas
- **AND** la sonda de render informa de 0 sprites con aspecto de reserva en ambos casos

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

Los avisos no usan hoja. La unidad o el elemento de cada hoja se comprueba con la ruta de origen que registra la nota
de procedencia (ver `asset-provenance`). Del pack solo se versionan las hojas que usan los datos de aspecto, como hoja
de un aspecto, de una animación de aparición o de una pieza de la interfaz (ningún otro color de castillo ni de torre,
ni `Rocks`, ni `Fire.png`, ni `Wood_Tower_InConstruction`, ni `GoldMine_Destroyed.png`, ni variantes `_(NoShadow)`, ni
`HappySheep_All`, ni `Deco/12`–`Deco/15`, ni piezas de UI que no use ningún rol). Las rocas `Deco/04`–`06` son solo de la
piedra recogible: ningún aspecto de decoración las usa. Cambiar el arte de un elemento o de una pieza MUST requerir solo
cambios de datos y de assets, no de código.

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
- **AND** todas las rutas de origen pertenecen a Tiny Swords Update 010

#### Scenario: Solo las hojas usadas
- **GIVEN** la lista de ficheros versionados y los datos de aspecto del repositorio
- **WHEN** se compara cada asset gráfico de la nota de procedencia con las hojas de los datos de aspecto
- **THEN** cada asset de la nota es la hoja de ≥ 1 aspecto, de ≥ 1 animación de aparición o de ≥ 1 pieza de la
  interfaz, y ningún fichero versionado contiene `Castle_Red`, `Castle_Yellow`, `Castle_Purple`, `Castle_Black`,
  `Rocks`, `Fire`, `Wood_Tower_InConstruction`, `GoldMine_Destroyed`, `NoShadow` ni `HappySheep_All`
- **AND** los assets gráficos versionados que contienen `_Spawn` son exactamente `G_Spawn.png`, `W_Spawn.png` y
  `M_Spawn.png`, cada uno 1 vez
- **AND** de `Wood_Tower_Red`, `Wood_Tower_Blue`, `Wood_Tower_Purple` y `Wood_Tower_Yellow` hay exactamente 1 fichero
  versionado, el de la hoja de la torre
- **AND** los ficheros versionados de la carpeta `Deco/` de los assets son exactamente `01`–`11` y `16`–`18` (`.png`),
  cada uno 1 vez, y ninguno de `12`–`15`
- **AND** ningún fichero versionado procede de `UI/Icons` ni de `UI/Pointers`

#### Scenario: Pieza de UI de más
- **GIVEN** una lista simulada igual a la real más `UI/Buttons/Button_Red_3Slides.png` con su entrada en la nota, sin
  que ningún rol la use
- **WHEN** se ejecuta el test de "Solo las hojas usadas"
- **THEN** falla y nombra `Button_Red_3Slides.png`

#### Scenario: Partida con arte
- **GIVEN** la build de producción servida con `?e2e&seed=42`
- **WHEN** termina la carga y se pintan 600 frames
- **THEN** en cada frame la sonda informa de 1 sprite de fondo, de 0 sprites con aspecto de reserva y de un sprite
  de jugador visible salvo en los frames en que el parpadeo lo oculta (ver `player-health`)
- **AND** en algún frame hay ≥ 1 enemigo, ≥ 1 proyectil y ≥ 1 gema visibles, todos con su aspecto

### Requirement: Carga del arte compatible con la CSP
El sistema SHALL cargar todas las hojas (también las de las piezas de la interfaz, tanto las que pinta Phaser como las
que usa la hoja de estilos) y el fichero de la fuente pixel sin ninguna violación de la Content Security Policy y sin
cambiar sus directivas (`img-src 'self' data:`, `default-src 'self'`, sin `font-src`, y las demás, ver "Política de
seguridad de contenido" en `progress-persistence`), tanto al arrancar desde el menú como con `?e2e`, en `vite preview` y
en la URL pública, bajo la base `/tfm-survivors/`. La carga MUST terminar antes del primer frame que pinta un elemento de
la partida: ningún elemento se pinta con una hoja sin cargar (las piezas sin cargar usan su reserva, ver "Reserva de las
piezas de UI y de la fuente"). Con `?e2e`, la carga del arte MUST conservar el comportamiento de "Carga en modo E2E"
(`main-menu`).

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

#### Scenario: URLs de las piezas y de la fuente bajo la base
- **GIVEN** los datos de `ui` del repositorio y la base `/tfm-survivors/`
- **WHEN** se calculan las URL de las 8 piezas que se publican para el DOM y la URL de la fuente, y se lee la hoja de
  estilos del repositorio
- **THEN** cada URL de pieza empieza por `/tfm-survivors/assets/tiny-swords/UI/` y la de la fuente es
  `/tfm-survivors/assets/fonts/DepartureMono-Regular.woff2`; ninguna empieza por `http:`, `https:`, `//` ni `data:`
- **AND** la hoja de estilos no contiene ningún `url(` literal y cada fichero referido existe en `dist/` tras `build`

#### Scenario: Arte en la URL pública
- **GIVEN** la URL pública y el smoke remoto a demanda (ver `public-deploy`)
- **WHEN** carga la página sin parámetros y pulsa `Jugar`
- **THEN** cada hoja de los datos de aspecto, incluidas las de las piezas de la interfaz, se pide bajo
  `/tfm-survivors/` y responde 200 con tipo `image/png`, y la fuente responde 200
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
la hoja del fondo, salvo la orilla si su hoja es la del fondo. Las piezas de la interfaz tienen también su propia
reserva (ver "Reserva de las piezas de UI y de la fuente"): no cuentan como sprites con aspecto de reserva y su fallo no
cambia el aspecto de ningún sprite.

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

### Requirement: Datos de aspecto del combate
El sistema SHALL definir en los datos de aspecto (`content/appearance.json`), validados con zod en el arranque con las
reglas de "Datos de aspecto validados", un bloque de aspecto del combate con:
- un color `#RRGGBB` por clase de golpe, `enemy`, `structure`, `sheep` y `player`, distintos dos a dos; el de `player`
  es rojo (componente roja ≥ 192 y verde y azul ≤ 80 cada una);
- del número de daño: la duración L (entero ≥ 1, en ms), el ascenso H (≥ 0, en px), la elevación inicial E (≥ 0, en px),
  el tamaño de letra (entero ≥ 8, en px) y el tamaño del pool P (entero ≥ 1);
- de la barra de vida: el ancho (entero ≥ 1, en px), el alto (entero ≥ 1, en px), la separación sobre la huella (≥ 0,
  en px), el color del relleno y el color del fondo (`#RRGGBB`, distintos entre sí).

Con los datos del repositorio: L 800, H 32, E 20, letra 16, P 48 y barra de 48 × 6 a 8 px. El bloque no tiene hojas: ni
los números ni las barras usan assets, así que ninguna entrada de la nota de procedencia (`content/asset-provenance.json`)
corresponde a este bloque (las entradas nuevas de 0032 son solo las de las piezas de la interfaz). Un campo ausente, un
campo desconocido, un valor fuera de rango, un color con otro formato, dos colores de clase iguales, un color de `player`
que no sea rojo o relleno y fondo iguales MUST hacer fallar el arranque con un error que nombre el campo o la clase: no
se muestra el menú ni empieza ninguna partida. Estos datos MUST NOT cambiar la simulación.

#### Scenario: Datos de combate del repositorio
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** el bloque de aspecto del combate es válido, con 4 colores de clase distintos y el de `player` rojo
- **AND** L vale 800, H 32, E 20, la letra 16, P 48 y la barra mide 48 × 6 px con separación 8

#### Scenario: Datos de combate inválidos
- **GIVEN** los datos de aspecto del repositorio con, en un caso cada vez: sin color de `sheep`; el color de
  `structure` igual al de `enemy`; el color de `player` `#3080FF`; L 0; L 2,5; P 0; el tamaño de letra 4; el ancho de
  la barra 0; el relleno igual al fondo; o un campo extra `font`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra respectivamente `sheep`, `structure`, `player`, la duración (dos
  veces), el pool, el tamaño de letra, el ancho de la barra, el relleno y `font`
- **AND** no se muestra el menú ni empieza ninguna partida

#### Scenario: Bloque de combate sin hojas
- **GIVEN** el repositorio con este change
- **WHEN** se ejecuta `npm run guard:all` y se lee el bloque de aspecto del combate
- **THEN** el guardarraíl pasa, el bloque no contiene ninguna ruta `.png` ni campo de hoja, y las entradas de la nota
  de arte (`files`) son las de antes de 0032 más exactamente las 8 de las piezas de la interfaz; la fuente va aparte
  (`fonts`, ver "Procedencia y licencia de la fuente" en `asset-provenance`)
