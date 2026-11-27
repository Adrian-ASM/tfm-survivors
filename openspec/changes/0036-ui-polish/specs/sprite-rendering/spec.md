# Spec delta · sprite-rendering

<!-- Change 0036-ui-polish. Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Motivo:
     - Las barras de vida de las estructuras solo se ven desde el primer daño (decisión del autor; sustituye a "Barra
       llena al empezar"). La sonda `healthBars` pasa a contar las estructuras dañadas y no destruidas (7 → 0 en el
       primer frame de la semilla 42).
     - Regla común de la × de cierre de la tienda, la obra, la guía y el panel `Sonido`, y del centrado del texto de
       los botones DOM de una sola etiqueta.
     - Datos de aspecto del icono de bajas (frame de la hoja del cadáver) y de las medidas de los contadores del HUD.
     - El DOM de los paneles cambia (× y filas de la obra): se actualiza la regla "DOM sin cambios".
     Sin cambios: el plan del mapa (820 / 904 objetos en las semillas 42 y 123): ni la ×, ni los iconos, ni las barras
     forman parte de él ni los lee ninguna colocación por semilla; los datos nuevos de aspecto no los lee ningún flujo de
     azar. Las cartas de mejora de Phaser no cambian de requisito (se revisan con captura; solo se tocan si muestran
     un descentrado, sin cambio de contrato). -->

## ADDED Requirements

### Requirement: Botón × de cierre de los modales
La vista SHALL dar a la tienda (`.shop-panel`), al panel de obra (`.build-panel`), a la guía (`.guide-modal`) y al
panel `Sonido` exactamente un botón de cierre, la **×**: un elemento `button` cuyo texto visible es `×` (U+00D7) y cuyo
nombre accesible es `Salir` en la tienda y en la obra y `Cerrar` en la guía y en `Sonido` (puesto con `aria-label`,
como los botones de la barra táctil; ver `touch-controls`). Su efecto es el de Esc en ese modal (ver "Overlay de la
tienda" en `castle-shop`, "Panel de obra" en `build-sites`, "Cerrar la guía" en `menu-guide` y "Panel Sonido" en
`audio`). El menú de inicio, la pausa, el diálogo de `Borrar datos` y los resultados MUST NOT tener ×. En cada uno de
los cuatro modales, con escala de UI DOM k:
- la × MUST estar entera dentro del recuadro del modal, en su esquina superior derecha: la distancia de su borde
  superior al borde superior del recuadro y la de su borde derecho al borde derecho del recuadro MUST ser cada una
  ≤ el margen correspondiente (t y r) de la pieza de `panel` × k, y las mismas en los cuatro modales para el mismo k
  (error ≤ 1 px);
- MUST NOT solaparse con el título del modal, con ningún otro control ni con ningún texto, y MUST quedar fuera de
  cualquier zona que se desplace dentro del modal (lista de la tienda, cuerpo de la guía);
- usa las piezas de botón de "Piezas de UI en los paneles DOM" (`button`, `buttonHover` con el puntero o con foco
  visible y un contorno de 2 px, `buttonPressed` al pulsarla) y su glifo cumple "Texto centrado en los botones DOM";
- se alcanza con el tabulador y se activa con Intro o Espacio, como cualquier `button`;
- tras activarla con el ratón, ningún elemento del modal cerrado conserva el foco (en la guía y en `Sonido` el foco va
  al botón que los abrió, como con Esc);
- en modo móvil mide ≥ 44 × 44 px CSS ("Paneles DOM en modo móvil" en `mobile-display`); la zona pulsable puede ser
  mayor que el glifo.

La × no tiene atributo `style` ni provoca violaciones de la CSP. Si la pieza de `button` no carga, se pinta con la
reserva de los botones y funciona igual. Mostrar o pulsar la × MUST NOT cambiar la simulación salvo por el caso de uso
de salida de la tienda o de la obra.

#### Scenario: Cuatro modales con una ×
- **GIVEN** la tienda, el panel de obra, la guía y el panel `Sonido` abiertos, uno cada vez, montados en un DOM de
  prueba
- **WHEN** se buscan sus botones
- **THEN** cada uno tiene exactamente 1 botón con texto visible `×`, con nombre accesible `Salir` en la tienda y en la
  obra y `Cerrar` en la guía y en `Sonido`, sin atributo `style`
- **AND** el menú, la pausa, el diálogo de `Borrar datos` y los resultados no tienen ningún botón con texto `×`

#### Scenario: × en la esquina en el navegador [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` a 1.280 × 720 (k = 1), en el test de la tienda y en el de
  la obra de `gameplay.spec` (ampliados, sin test nuevo)
- **WHEN** se abre la tienda (y, en el otro test, la obra) y se miden las cajas de la ×, del recuadro y del título
- **THEN** la × está entera dentro del recuadro, con su borde superior y su borde derecho a ≤ el margen t y r de
  `panel` (16 px con los datos del repositorio) de los del recuadro, y no se solapa con el título
- **AND** la distancia de la × a la esquina superior derecha del recuadro es la misma en la tienda y en la obra
  (error ≤ 1 px)
- **AND** tras hacer clic en la × la partida está en curso, la pausa no se ha visto, `step(1)` devuelve 1 y el elemento
  con el foco no está dentro del panel cerrado

#### Scenario: × en móvil
- **GIVEN** el modo móvil y una ventana de 844 × 390
- **WHEN** se abren la tienda, el panel de obra, la guía y el panel `Sonido`, uno cada vez
- **THEN** la × de cada uno mide ≥ 44 × 44 px CSS y, desplazando el panel si hace falta, se ve entera dentro de la
  ventana

#### Scenario: × con la pieza en reserva
- **GIVEN** la guía abierta con la pieza de `button` sin cargar
- **WHEN** se hace clic en la ×
- **THEN** la guía no es visible y el foco está en `Cómo jugar`, sin errores no capturados

### Requirement: Texto centrado en los botones DOM
La vista SHALL centrar en horizontal y en vertical el texto de cada **botón de una sola etiqueta** de los paneles DOM
(menú de inicio, pausa, diálogo de `Borrar datos`, guía, resultados, tienda, obra y panel `Sonido`): todo `button` cuyo
contenido es un único texto, es decir, los del menú, la pausa, el diálogo y los resultados, `Anterior` y `Siguiente`
de la guía y las cuatro ×. Las filas de producto de la tienda y las filas de edificio de la obra no son botones de una
sola etiqueta y conservan su disposición interna. La **cara visible** de un botón es su caja menos los márgenes de su
pieza (l·k, t·k, r·k, b·k), con k la escala de UI DOM; con la pieza en reserva, su caja interior sin el borde. En los
estados normal, con el puntero encima y con foco, el centro de la caja del texto (la del nodo de texto, no la del
botón) MUST estar a ≤ 1 px del centro de la cara visible en x y en y. Centrar MUST NOT cambiar los textos, el orden ni
los tamaños mínimos de los botones de "Piezas de UI en los paneles DOM".

#### Scenario: Reglas de centrado
- **GIVEN** la hoja de estilos del repositorio
- **WHEN** se leen las reglas que se aplican a cada botón de una sola etiqueta de los 8 paneles (las × de la tienda y de
  la obra incluidas)
- **THEN** ninguna los alinea a la izquierda ni reparte su contenido a los extremos (`text-align: left`,
  `justify-content: space-between` o `flex-start`), y su relleno interior es el margen de su pieza × k en cada lado

#### Scenario: Centrado medido en el navegador [E2E]
- **GIVEN** la build de producción sin `?e2e` con una ventana de 1.280 × 720 (k = 1), en el test de humo del menú
  (ampliado, sin test nuevo), y la build con `?e2e&manual&seed=42` en los tests de la tienda y de la obra de
  `gameplay.spec` (ampliados)
- **WHEN** se miden la caja del nodo de texto y la del botón de los 6 botones del menú, de `Siguiente` y la × de la
  guía, de la × de la tienda y de la × de la obra
- **THEN** en cada uno el centro del texto está a ≤ 1 px del centro de la cara visible (caja del botón menos 20, 20, 28
  y 20 px arriba, derecha, abajo e izquierda con los datos del repositorio) en x y en y

### Requirement: Datos de aspecto de los contadores del HUD
El sistema SHALL definir en los datos de aspecto (`content/appearance.json`), validados con zod en el arranque con las
reglas de "Datos de aspecto validados":
- el **icono de bajas**: el índice del frame de la hoja del cadáver (`corpse`) que se usa como calavera (entero ≥ 0) y,
  si el design lo usa, su recorte; la hoja es la del cadáver, sin ruta propia, de modo que la nota de procedencia no
  gana ninguna entrada;
- las **medidas de los contadores del HUD** a ×1: el lado s de los iconos y el paso p entre filas (enteros ≥ 1, con
  p ≥ s), y los recortes de los iconos si el design los declara (enteros ≥ 0, dentro del frame).

Con los datos del repositorio, s > 16 y p > 18, y el frame de la calavera cabe en la hoja `Dead.png` (896 × 256, 14
frames de 128 × 128) y no está vacío (tiene ≥ 1 píxel con alfa > 0); lo comprueba un test sobre el PNG del repositorio,
no el arranque. Un campo ausente o desconocido, un índice negativo o no entero, p < s o un valor no entero MUST hacer
fallar el arranque con un error que nombre el campo, por la vía de siempre: no se muestra el menú ni empieza ninguna
partida. Estos datos MUST NOT cambiar la simulación ni el plan del mapa.

#### Scenario: Datos de los contadores del repositorio
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido y se lee el PNG de `Dead.png`
- **THEN** los datos son válidos, s > 16, p > 18 y p ≥ s, y el frame de la calavera es un índice de 0 a 13 con ≥ 1
  píxel con alfa > 0
- **AND** la nota de procedencia tiene las mismas entradas que antes del change

#### Scenario: Datos de los contadores inválidos
- **GIVEN** los datos de aspecto del repositorio con, en un caso cada vez: el frame de la calavera −1; el frame 2,5;
  s 0; p menor que s; sin p; o un campo extra `glow` en el icono de bajas
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra respectivamente el frame (dos veces), s, p (dos veces) y `glow`
- **AND** no se muestra el menú ni empieza ninguna partida

#### Scenario: Los datos del HUD no cambian la simulación ni el mapa
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs y la política
  de elección fija, una con los datos de los contadores del repositorio y otra con s 40, p 48 y otro frame de calavera
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick
- **AND** con el contenido por defecto los objetos del mapa son 820 y 904 en las semillas 42 y 123

## MODIFIED Requirements

### Requirement: Barras de vida de las estructuras
El sistema SHALL pintar, mientras existe una partida, una **barra de vida** sobre cada estructura **dañada** y no
destruida del snapshot pintado (ver "Estructuras en el snapshot" en `goblin-structures`), y ninguna sobre una no dañada
ni sobre una destruida. Una estructura (identificada por su identificador del snapshot) es **dañada** desde el primer
frame de la partida que pinta un snapshot en el que su vida es menor que su vida máxima, y sigue siéndolo en todos los
frames siguientes de esa partida, aunque su vida volviera a valer la máxima; el estado de dañada se olvida al empezar
una partida nueva (R, ↻ o `Volver al menú` → `Jugar`). La barra:
- es un rectángulo de fondo del ancho y el alto de los datos, centrado en x en la posición de la estructura, con su
  borde inferior a la separación de los datos por encima del borde superior de su huella (error ≤ 1 px);
- encima, un rectángulo de relleno alineado a la izquierda del fondo, del mismo alto y de ancho = ancho × vida / vida
  máxima (error ≤ 0,5 px), con los colores de los datos;
- se actualiza en cada frame con el snapshot pintado; con vida igual a la vida máxima el relleno cubre todo el fondo;
- desde el primer frame que pinta un snapshot en el que la estructura figura destruida, no se ve, hasta el final de la
  partida (también si la estructura se daña y se destruye entre dos frames pintados: no llega a verse);
- va en coordenadas de mundo, en la capa (9) de "Capas del mapa y de las entidades", por debajo de los números de daño,
  y no se recorta por cámara.

Solo las casas y torres goblin tienen barra: ni los enemigos, ni las ovejas, ni el jugador en el mundo (su vida sigue
solo en el HUD, ver `hud`), ni los solares o edificios propios. Con el mapa vacío sin estructuras declaradas y en el
menú no se ve ninguna. Las barras no forman parte del plan del mapa: los objetos del mapa y `drawn` MUST NOT cambiar por
ellas. Una estructura dañada pintada con aspecto de reserva tiene su barra igual. Decidir y pintar las barras se hace en
la vista, sin tocar el núcleo, y MUST NOT cambiar la simulación.

#### Scenario: Barra al 50 %
- **GIVEN** la casa de prueba (huella en x [1.200, 1.320], y [600, 780]) con vida 30 y vida máxima 60, sin destruir
- **WHEN** se pinta el snapshot
- **THEN** hay 1 barra con el fondo en (1.236, 586)–(1.284, 592) y el relleno en (1.236, 586)–(1.260, 592)

#### Scenario: Sin barras al empezar
- **GIVEN** el contenido por defecto y la semilla 42 (4 casas y 3 torres goblin, todas con su vida máxima)
- **WHEN** se pinta el primer frame de la partida y 600 frames más sin que ninguna estructura reciba daño
- **THEN** no hay ninguna barra de vida en ninguno de esos frames

#### Scenario: La barra aparece con el primer daño
- **GIVEN** la casa de prueba con vida 60 de 60 pintada en los frames de los ticks n − 2 y n − 1, que recibe 4 de daño
  en el tick n
- **WHEN** se pintan los snapshots de n a n + 60 sin más daño
- **THEN** en los frames de n − 2 y n − 1 no hay barra, y en cada frame de n a n + 60 hay 1 barra con el relleno de
  44,8 px (48 × 56 / 60, error ≤ 0,5 px)

#### Scenario: La barra se conserva hasta la ruina
- **GIVEN** la torre de prueba con vida máxima 90 dañada a 63 en el tick n y destruida en el tick m > n
- **WHEN** se pintan los snapshots de n a m + 60
- **THEN** hay barra en cada frame de n a m − 1 y en ninguno de m a m + 60

#### Scenario: Dañada aunque vuelva a la vida máxima
- **GIVEN** un snapshot de escenario con la casa de prueba en vida 50 de 60 y el siguiente con la misma casa en vida 60
  de 60
- **WHEN** se pintan los dos
- **THEN** en ambos hay 1 barra sobre la casa, en el segundo con el relleno de 48 px

#### Scenario: Golpe que deja la estructura en ruina
- **GIVEN** la casa de prueba con vida 4 pintada en el frame del tick n − 1 y destruida por un impacto del Linter en el
  tick n
- **WHEN** se pintan los snapshots de n a n + 60
- **THEN** en el frame del tick n hay 1 número `4` del color de `structure` en (1.260, 670) y la casa no tiene barra
- **AND** en el frame del tick n − 1 la casa (ya dañada: vida 4 de 60) tiene su barra, y en ninguno de los frames de
  n a n + 60 se ve

#### Scenario: Torre dañada y sin barras en otros objetivos
- **GIVEN** una torre explícita con vida 63 y vida máxima 90, una casa explícita con vida 60 y vida máxima 60, un
  enemigo, una oveja y un solar con una casa construida
- **WHEN** se pinta el snapshot
- **THEN** hay exactamente 1 barra, la de la torre, con relleno de 33,6 px

#### Scenario: Partida nueva sin barras
- **GIVEN** una partida con el mapa real de la semilla 42 con 2 estructuras dañadas y no destruidas, con su barra
- **WHEN** se pulsa R con la misma semilla y se pinta el primer frame de la partida nueva, y en otro caso se pulsa
  `Volver al menú`, después `Jugar`, y se pinta el primer frame
- **THEN** en ambos casos no hay ninguna barra en el primer frame de la partida nueva, aunque sus estructuras tengan los
  mismos identificadores que las dañadas de la anterior

#### Scenario: Barras con reserva y fuera del plan del mapa
- **GIVEN** las semillas 42 y 123 con el contenido por defecto y, en otro caso, la hoja `Goblin_House` sin cargar
- **WHEN** se calcula el plan del mapa sin navegador, se pinta el primer frame y después un snapshot con la primera casa
  en vida 30 de 60
- **THEN** los objetos del mapa siguen siendo 820 y 904, en el primer frame no hay barras y la casa dañada con reserva
  tiene su barra igual que con su hoja

### Requirement: Sonda de los números de daño y de las barras
El sistema SHALL exponer, solo con `?e2e` y como parte de la sonda de render `window.__sprint.sprites`, en el último
frame pintado:
- `damageNumbers`: por clase (`enemy`, `structure`, `sheep` y `player`), cuántos números de daño se ven (0 ≤ a < L,
  dentro o fuera del rectángulo de la cámara), y `created`, cuántos números se han creado en la partida;
- `healthBars`: cuántas barras de vida de estructura se ven, es decir, cuántas estructuras dañadas y no destruidas
  tiene el snapshot pintado (ver "Barras de vida de las estructuras").

Con el mismo snapshot pintado varias veces, `created` no cambia. En el menú todos valen 0 y en una partida nueva
empiezan en 0. Sin `?e2e` MUST NOT existir. Leer la sonda MUST NOT cambiar la simulación ni lo que se pinta.

#### Scenario: Recuentos coherentes con el snapshot
- **GIVEN** `?e2e&seed=42` y una partida en curso
- **WHEN** se pintan 600 frames y en cada uno se leen la sonda y el snapshot pintado
- **THEN** en el primer frame `healthBars` vale 0, y en cada frame es igual al número de estructuras no destruidas del
  snapshot cuya vida ha sido menor que su vida máxima en algún snapshot pintado desde el primer frame de la partida
- **AND** en cada frame la suma de `damageNumbers` por clase es ≤ 48 y `created` no baja

#### Scenario: Números de daño en el navegador [E2E]
- **GIVEN** la build de producción servida con `?e2e&manual&map=empty&seed=7`, sin input de movimiento y con la
  política de elección fija
- **WHEN** se avanza con `step(1)` hasta el primer frame cuyo snapshot tiene ≥ 1 golpe de clase `enemy`, se pulsa Esc
  y se pintan 30 frames en pausa, y después se cierra la pausa y se llama a `step(60)`
- **THEN** en el primer frame `damageNumbers.enemy` y `created` son iguales al número de golpes de ese snapshot
- **AND** en los 30 frames de pausa `created` y `damageNumbers.enemy` no cambian
- **AND** tras `step(60)` (en modo manual, 0014, el reloj de render avanza 60 × TICK_MS = 1.000 ms > L con ese
  `step`) no se ve ninguno de los números creados en el primer frame, y `created` ha subido exactamente en el número
  de golpes nuevos de los snapshots pintados entre medias
- **AND** al pulsar `Volver al menú`, la sonda informa de 0 números y 0 barras, sin errores no capturados

#### Scenario: Barras a 0 al empezar en el navegador [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` y `map: 'real'`, en un test del mapa real de la suite de
  humo (ampliado, sin test nuevo)
- **WHEN** termina la carga y se lee la sonda en el primer frame de la partida
- **THEN** `sprites.healthBars` vale 0 y la partida tiene 7 estructuras no destruidas

### Requirement: Limpieza de la vista al cambiar de partida
El sistema SHALL, en el primer frame de una partida nueva tras R (ver `run-results`) y en el primer frame del menú
tras `Volver al menú` (ver `main-menu`), no dejar visible ningún cadáver ni ningún sprite de jugador, enemigo,
proyectil, pulso, recogible de cualquier tipo, veta, dinamita o explosión, ni ningún aviso, número de daño ni barra de
vida, que no corresponda al snapshot pintado (en el menú, ninguno). Los cadáveres, las explosiones, los números de daño
y las apariciones de recogibles en curso (también las que están en su retardo) se descartan sin terminar su animación y
no reaparecen después. En la partida nueva cada recogible empieza su aparición desde cero, con las reglas de "Aparición
de oro, madera y carne" y de "Aparición escalonada de los recogibles del inicio", aunque su id coincida con el de un
recogible de la partida anterior; del mismo modo, cada golpe de la partida nueva crea su número aunque su
identificador coincida con el de un golpe de la anterior (ver "Números de daño"), y ninguna estructura de la partida
nueva se considera dañada por haberlo estado una de la anterior con su mismo identificador (ver "Barras de vida de las
estructuras"). Cerrar la escena de la partida a mitad de una animación MUST NOT dejar animaciones en curso ni errores no
capturados.

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

#### Scenario: R y menú con números de daño y barras
- **GIVEN** una partida terminada con el mapa real de la semilla 42, con 5 números de daño vivos, 1 casa destruida y
  otras 2 estructuras dañadas con barra
- **WHEN** se pulsa R con la semilla 43 y se pinta su primer frame, y en otro caso se pulsa `Volver al menú` y se
  pintan 60 frames
- **THEN** en la partida nueva hay 0 números de daño, `created` vale 0 y hay 0 barras
- **AND** en el menú la sonda informa de 0 números y 0 barras en los 60 frames
- **AND** el primer golpe de la partida nueva, de identificador 0, crea su número

### Requirement: Capas del mapa y de las entidades
El sistema SHALL pintar, de abajo arriba: (1) el fondo; (2) el agua; (3) las orillas y la espuma; (4) los puentes;
(5) el tronco de cada árbol, la fachada del castillo, la parte baja de cada estructura (o su rectángulo de reserva) y
la decoración baja y la base de cada decoración alta; (6) cadáveres, gemas, pulsos, jugador, enemigos y proyectiles,
con su orden relativo de antes de este change; (7) las copas de los árboles, el tejado del castillo, la parte alta de
cada estructura y la parte alta de cada decoración alta; (8) la **capa de peligros**: avisos, dinamitas y
explosiones, en ese orden; (9) la **capa de combate**: las barras de vida de las estructuras y, encima, los números de
daño (ver "Barras de vida de las estructuras" y "Números de daño"); (10) el HUD y los overlays, fijos en pantalla (ver
`world-camera`). La **copa** es la parte del dibujo del árbol situada por encima del borde superior de su celda y el
**tronco**, el resto. El **tejado** es la parte del dibujo del castillo situada por encima del borde superior de la
fila inferior de la huella y la **fachada**, el resto. Las partes baja y alta de una estructura son las de "Pintado de
las estructuras"; la base y la parte alta de una decoración alta, las de "Decoración del mapa generado". Las partes se
separan con un error ≤ 1 px. Así, una entidad al sur de un árbol, ante la puerta del castillo, ante una casa o ante un
espantapájaros se ve delante, y una que pasa detrás de una copa, sobre el tejado, detrás de una casa o detrás de la
parte alta de una decoración alta queda tapada; una decoración baja nunca tapa a una entidad ni a un recogible; un
aviso, una dinamita o una explosión se ven siempre sobre el mapa, las estructuras, la decoración y las entidades y bajo
el HUD; una barra de vida o un número de daño se ven siempre sobre todo lo anterior, peligros incluidos, y bajo el HUD y
los overlays. El orden de capas MUST mantenerse tras cualquier redimensionado de la ventana.

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

#### Scenario: Barras y números sobre la parte alta y los peligros
- **GIVEN** la casa de prueba dañada y sin destruir (vida 30 de 60), un enemigo detrás de ella en (1.260, 700) con un
  golpe nuevo en ese tick, una explosión centrada en (1.260, 690) y el overlay de pausa abierto
- **WHEN** se pinta el snapshot
- **THEN** la barra de la casa y el número del enemigo están por encima de la parte alta de la casa y de la explosión,
  y el número por encima de la barra
- **AND** el HUD y el overlay de pausa están por encima de ambos, también tras pasar la ventana a 960 × 540

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
iconos y botones interiores) MUST quedar dentro del área útil de su panel o de su botón, salvo la × de cierre, que
sigue "Botón × de cierre de los modales"; cada botón mide al menos (t + b)·k px de alto. Los textos sobre una pieza usan
sus tintas: `text` para el texto normal, `muted` para el secundario (descripciones de la tienda y explicaciones de la
obra), `accent` para los mensajes y el indicador de página y `danger` para avisos y cifras que faltan. Las URL de las
piezas salen de los datos de `ui` con la base `/tfm-survivors/`; la hoja de estilos no escribe ninguna URL. Vestir los
paneles MUST NOT cambiar el DOM: las clases, los roles ARIA, los textos visibles, el orden de los botones, el foco y el
atributo `hidden` son los de antes de 0032, ningún elemento de los paneles tiene atributo `style`, y los selectores de
`smoke`, `progress` y `gameplay`.spec y de `tests/support/probe.ts` no cambian, salvo estas diferencias, que son las
únicas del DOM desde 0032:
- (0034) el icono de cada fila de producto de la tienda (ver "Icono en las filas de la tienda" en `castle-shop`): un
  elemento de imagen más por fila, sin atributo `style`, que no cambia las clases, los roles, los textos visibles, el
  orden de los botones ni el foco;
- (0036) en la tienda y en la obra, el botón de salida de abajo (texto `Salir`) se sustituye por la × (texto `×`,
  `aria-label` `Salir`), y en la guía el botón `Cerrar` por la × (texto `×`, `aria-label` `Cerrar`); la × puede ocupar
  otro lugar en el orden del DOM y llevar otra clase. El atributo `aria-label` de la × es el único atributo nuevo;
- (0036) en la obra, cada fila de edificio gana 1 imagen de edificio (texto alternativo vacío) y 1 elemento de texto
  con su explicación (ver "Explicación de los edificios en el panel de obra" en `build-sites`).

El centrado, el ajuste a la ventana y la reubicación al redimensionar de cada panel siguen las reglas de su capacidad
(`main-menu`, `menu-guide`, `run-results`, `castle-shop`, `build-sites`), y el texto de sus botones de una sola
etiqueta, "Texto centrado en los botones DOM".

#### Scenario: Esquinas a ×1 y a ×2
- **GIVEN** una pieza de prueba de `panel` con márgenes (24, 20, 24, 28)
- **WHEN** se calculan las esquinas en pantalla de un panel con k = 1 y con k = 2
- **THEN** con k = 1 miden 24 × 20, 24 × 20, 24 × 28 y 24 × 28 px, y con k = 2 miden 48 × 40, 48 × 40, 48 × 56 y
  48 × 56 px, sin escalado fraccionario

#### Scenario: Los siete paneles con la pieza de panel
- **GIVEN** la hoja de estilos del repositorio y los datos de `ui`
- **WHEN** se leen las reglas de las 7 clases de panel y de sus botones
- **THEN** las 7 usan la pieza de `panel` y sus botones (las × incluidas) la de `button`, `:hover` y `:focus-visible`
  la de `buttonHover`, `:active` la de `buttonPressed`, `:disabled` y las filas no disponibles la de
  `buttonDisabled`, y `Confirmar` del diálogo la de `buttonDanger` (`buttonDangerPressed` en `:active`)
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
- **THEN** el menú, la pausa, el diálogo y los resultados son idénticos: clases, roles, textos visibles, orden de los
  botones y elemento con el foco, y ningún elemento tiene atributo `style`
- **AND** en la tienda la única diferencia es que no hay ningún botón con texto `Salir` y hay 1 botón con texto `×` y
  `aria-label` `Salir`; en la guía, que no hay ningún botón con texto `Cerrar` y hay 1 con texto `×` y `aria-label`
  `Cerrar`; en la obra, lo mismo que en la tienda más 1 imagen de edificio y 1 elemento de explicación en cada una de
  sus 2 filas; los demás elementos, sus clases, sus roles y sus textos visibles son iguales

## REMOVED Requirements
<!-- Ninguno. "Barra llena al empezar" no es un requisito: es un escenario de "Barras de vida de las estructuras",
     sustituido por "Sin barras al empezar" en su MODIFIED. -->
