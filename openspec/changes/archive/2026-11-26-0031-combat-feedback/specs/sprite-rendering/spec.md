# Spec delta · sprite-rendering

<!-- Change 0031-combat-feedback. Los escenarios usan los datos de aspecto del combate del repositorio: duración del
     número L = 800 ms, ascenso H = 32 px, elevación inicial E = 20 px, tamaño de letra 16 px, pool P = 48, barra de
     48 × 6 px a 8 px sobre la huella. TICK_MS = 1.000 / 60 ms. Los golpes son los de "Golpes de combate en el
     snapshot" (`simulation-loop`). El reloj de render R (ms) es el de "Animación del arte del mapa": se congela en
     pausa, oferta, tienda, obra y fin, y no depende de los ticks salvo en modo manual (`?e2e&manual`, change 0014),
     donde avanza n × TICK_MS con cada `step(n)`; los E2E de este change cuentan con eso. -->

## ADDED Requirements

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
los números ni las barras usan assets, así que la nota de procedencia (`content/asset-provenance.json`) MUST NOT
cambiar en este change. Un campo ausente, un campo desconocido, un valor fuera de rango, un color con otro formato, dos
colores de clase iguales, un color de `player` que no sea rojo o relleno y fondo iguales MUST hacer fallar el arranque
con un error que nombre el campo o la clase: no se muestra el menú ni empieza ninguna partida. Estos datos MUST NOT
cambiar la simulación.

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

#### Scenario: Sin assets nuevos
- **GIVEN** el repositorio con este change
- **WHEN** se ejecuta `npm run guard:all`
- **THEN** pasa y la nota de procedencia tiene las mismas entradas que antes del change

### Requirement: Números de daño
El sistema SHALL pintar, mientras existe una partida, un **número de daño** por cada golpe del snapshot pintado (ver
"Golpes de combate en el snapshot" en `simulation-loop`) que no haya creado ya un número en esa partida:
- se crea en el primer frame que pinta un snapshot con ese golpe; cada golpe crea **como mucho un** número en la
  partida, aunque siga en los snapshots de los frames siguientes o se vuelva a pintar el mismo snapshot (pausa, oferta,
  tienda, obra, fin), y aunque su número ya haya desaparecido;
- su texto es el daño del golpe en cifras decimales, sin signo, sin decimales y sin separador de miles (daño 12 →
  `12`), con el tamaño de letra de los datos y el color de la clase del golpe; se fija al crearlo y no cambia;
- con R_b el reloj de render del frame en que se crea y a = R − R_b su edad, se ve si y solo si 0 ≤ a < L; mientras se
  ve, su centro está en (x, y − E − H × a / L) y su opacidad es 1 − a / L (error ≤ 1 px y ≤ 0,01), siendo (x, y) la
  posición del golpe: nace donde estaba el objetivo al recibirlo y no lo sigue;
- va en coordenadas de mundo (se desplaza con la cámara, no fijo a pantalla; ver "Elementos de la partida en
  coordenadas de mundo" en `world-camera`), en la capa (9) de "Capas del mapa y de las entidades", y no se recorta por
  cámara.

Hay como mucho P números vivos a la vez (pool fijo). Si se crea un número con P vivos, desaparece en ese frame el vivo
de menor identificador de golpe; si un frame trae más de P golpes nuevos, quedan los P de identificador más alto. Con el
reloj de render congelado (pausa, oferta, tienda, obra y partida terminada) los números vivos quedan quietos con su
posición y opacidad, y al volver a la partida en curso siguen desde ahí, sin saltos. Un golpe que no llega a ningún
snapshot pintado (un frame que ejecuta más ticks que la ventana, ver `simulation-loop`) no crea número; se acepta. En el
menú no se ve ninguno. Los números no forman parte del plan del mapa: los objetos del mapa (820 y 904 en las semillas
42 y 123) y `drawn` MUST NOT cambiar por ellos. Pintar los números MUST NOT cambiar la simulación ni depender de la
carga de ninguna hoja.

#### Scenario: Número de un golpe a un enemigo
- **GIVEN** un snapshot con un único golpe nuevo de clase `enemy`, daño 6, en (1.000, 1.000), pintado con R = 5.000
- **WHEN** se pintan frames con R = 5.000, 5.400 y 5.800
- **THEN** en el primero hay 1 número `6` del color de `enemy` centrado en (1.000, 980) con opacidad 1
- **AND** en el segundo está en (1.000, 964) con opacidad 0,5 y en el tercero ya no se ve

#### Scenario: Color por clase
- **GIVEN** un snapshot con 4 golpes nuevos, uno de cada clase, de daños 6, 4, 12 y 25
- **WHEN** se pinta
- **THEN** hay 4 números, `6`, `4`, `12` y `25`, cada uno del color de su clase, y el de `player` es rojo

#### Scenario: Golpe letal visible
- **GIVEN** un `goblin-torch` con vida 4 abatido por el Linter en el tick n, que no figura en la lista de enemigos del
  snapshot del tick n
- **WHEN** se pinta ese snapshot
- **THEN** hay 1 número `4` de clase `enemy` en la posición que tenía el enemigo

#### Scenario: Sin número con el jugador invulnerable
- **GIVEN** un jugador invulnerable con un enemigo en contacto en los ticks t + 1 a t + 30, sin otros golpes
- **WHEN** se pintan los snapshots de esos ticks
- **THEN** no se crea ningún número de clase `player`

#### Scenario: Mismo snapshot pintado varias veces
- **GIVEN** un snapshot con 3 golpes nuevos y la partida en pausa, y en otro caso en la tienda
- **WHEN** se pinta ese snapshot 60 veces con el reloj congelado
- **THEN** se crean exactamente 3 números, los 3 se ven en los 60 frames con la misma posición y opacidad
- **AND** al reanudar, la sonda sigue contando 3 números creados hasta que llega un golpe nuevo

#### Scenario: Un golpe en varios snapshots
- **GIVEN** un golpe g del tick 100 con la ventana 15 y la partida en curso con 1 tick por frame
- **WHEN** se pintan los snapshots de los ticks 100 a 114 (g figura en todos)
- **THEN** g crea su número en el frame del tick 100 y en ningún otro

#### Scenario: Pool lleno
- **GIVEN** 48 números vivos de los golpes 0 a 47
- **WHEN** se pinta un snapshot con el golpe nuevo 48
- **THEN** hay 48 números vivos, de los golpes 1 a 48, y el del golpe 0 ya no se ve

#### Scenario: Más golpes nuevos que el pool en un frame
- **GIVEN** ningún número vivo y un snapshot con 60 golpes nuevos, de identificadores 0 a 59
- **WHEN** se pinta
- **THEN** hay 48 números vivos, los de los golpes 12 a 59

#### Scenario: Números congelados en pausa
- **GIVEN** un número creado con R = 1.000, la partida en curso y la pausa abierta cuando R = 1.200
- **WHEN** se pintan 60 frames de 16,667 ms en pausa y después se reanuda y se pinta 1 frame de 16,667 ms
- **THEN** en los 60 frames de pausa el número está en (x, y − 28) con opacidad 0,75
- **AND** tras reanudar, su edad es 216,667 ms (error ≤ 0,001)

#### Scenario: Números con avance manual
- **GIVEN** `?e2e&manual` y un número creado en el frame de un `step(1)` con R = R0
- **WHEN** se llama a `step(30)` y se pinta, y después a `step(18)` y se pinta
- **THEN** tras `step(30)` el reloj vale R0 + 500 (error ≤ 0,001) y el número se ve con opacidad 0,375
- **AND** tras `step(18)` el reloj vale R0 + 800 y el número ya no se ve

#### Scenario: Los números siguen a la cámara, no al objetivo
- **GIVEN** un golpe a un enemigo en (2.160, 1.140) con el jugador en (1.920, 1.080), una ventana de 1.280 × 720 y el
  enemigo que se mueve 30 px a la derecha en los frames siguientes
- **WHEN** se pinta el frame del golpe con R = R_b
- **THEN** el número se ve en la posición de pantalla (880, 400) y en los frames siguientes no se desplaza en x aunque
  el enemigo sí

#### Scenario: Pintar números no cambia la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs y la
  política de elección fija, una con los datos de aspecto del combate del repositorio y otra con P 1 y L 1
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick
- **AND** con el contenido por defecto, los objetos del mapa siguen en 820 y 904 en las semillas 42 y 123

### Requirement: Barras de vida de las estructuras
El sistema SHALL pintar, mientras existe una partida, una **barra de vida** sobre cada estructura no destruida del
snapshot pintado (ver "Estructuras en el snapshot" en `goblin-structures`), y ninguna sobre una destruida:
- un rectángulo de fondo del ancho y el alto de los datos, centrado en x en la posición de la estructura, con su borde
  inferior a la separación de los datos por encima del borde superior de su huella (error ≤ 1 px);
- encima, un rectángulo de relleno alineado a la izquierda del fondo, del mismo alto y de ancho = ancho × vida / vida
  máxima (error ≤ 0,5 px), con los colores de los datos;
- se actualiza en cada frame con el snapshot pintado; con vida igual a la vida máxima el relleno cubre todo el fondo;
- desde el primer frame que pinta un snapshot en el que la estructura figura destruida, su barra no se ve, hasta el
  final de la partida;
- va en coordenadas de mundo, en la capa (9) de "Capas del mapa y de las entidades", por debajo de los números de daño,
  y no se recorta por cámara.

Solo las casas y torres goblin tienen barra: ni los enemigos, ni las ovejas, ni el jugador en el mundo (su vida sigue
solo en el HUD, ver `hud`), ni los solares o edificios propios. Con el mapa vacío sin estructuras declaradas y en el
menú no se ve ninguna. Las barras no forman parte del plan del mapa: los objetos del mapa y `drawn` MUST NOT cambiar por
ellas. Una estructura pintada con aspecto de reserva tiene su barra igual. Pintar las barras MUST NOT cambiar la
simulación.

#### Scenario: Barra al 50 %
- **GIVEN** la casa de prueba (huella en x [1.200, 1.320], y [600, 780]) con vida 30 y vida máxima 60, sin destruir
- **WHEN** se pinta el snapshot
- **THEN** hay 1 barra con el fondo en (1.236, 586)–(1.284, 592) y el relleno en (1.236, 586)–(1.260, 592)

#### Scenario: Barra llena al empezar
- **GIVEN** el contenido por defecto y la semilla 42
- **WHEN** se pinta el primer frame de la partida
- **THEN** hay exactamente una barra por estructura colocada, cada una con el relleno de 48 px

#### Scenario: Golpe que deja la estructura en ruina
- **GIVEN** la casa de prueba con vida 4 pintada en el frame del tick n − 1 y destruida por un impacto del Linter en el
  tick n
- **WHEN** se pintan los snapshots de n a n + 60
- **THEN** en el frame del tick n hay 1 número `4` del color de `structure` en (1.260, 670) y la casa no tiene barra
- **AND** en ninguno de los frames de n a n + 60 se ve la barra de la casa

#### Scenario: Torre dañada y sin barras en otros objetivos
- **GIVEN** una torre explícita con vida 63 y vida máxima 90, un enemigo, una oveja y un solar con una casa construida
- **WHEN** se pinta el snapshot
- **THEN** hay exactamente 1 barra, la de la torre, con relleno de 33,6 px

#### Scenario: Barras con reserva y fuera del plan del mapa
- **GIVEN** las semillas 42 y 123 con el contenido por defecto y, en otro caso, la hoja `Goblin_House` sin cargar
- **WHEN** se calcula el plan del mapa sin navegador y se pinta el primer frame
- **THEN** los objetos del mapa siguen siendo 820 y 904 y cada casa con reserva tiene su barra igual que con su hoja

### Requirement: Sonda de los números de daño y de las barras
El sistema SHALL exponer, solo con `?e2e` y como parte de la sonda de render `window.__sprint.sprites`, en el último
frame pintado:
- `damageNumbers`: por clase (`enemy`, `structure`, `sheep` y `player`), cuántos números de daño se ven (0 ≤ a < L,
  dentro o fuera del rectángulo de la cámara), y `created`, cuántos números se han creado en la partida;
- `healthBars`: cuántas barras de vida de estructura se ven.

Con el mismo snapshot pintado varias veces, `created` no cambia. En el menú todos valen 0 y en una partida nueva
empiezan en 0. Sin `?e2e` MUST NOT existir. Leer la sonda MUST NOT cambiar la simulación ni lo que se pinta.

#### Scenario: Recuentos coherentes con el snapshot
- **GIVEN** `?e2e&seed=42` y una partida en curso
- **WHEN** se pintan 600 frames y en cada uno se leen la sonda y el snapshot pintado
- **THEN** en cada frame `healthBars` es igual al número de estructuras no destruidas del snapshot
- **AND** en cada frame la suma de `damageNumbers` por clase es ≤ 48 y `created` no baja

#### Scenario: Números de daño en el navegador [E2E]
- **GIVEN** la build de producción servida con `?e2e&manual&map=empty&seed=7`, sin input de movimiento y con la
  política de elección fija
- **WHEN** se avanza con `step(1)` hasta el primer frame cuyo snapshot tiene ≥ 1 golpe de clase `enemy`, se pulsa Esc
  y se pintan 30 frames en pausa, y después se cierra la pausa y se llama a `step(60)`
- **THEN** en el primer frame `damageNumbers.enemy` y `created` son iguales al número de golpes de ese snapshot
- **AND** en los 30 frames de pausa `created` y `damageNumbers.enemy` no cambian
- **AND** tras `step(60)` (el reloj avanza 60 × TICK_MS = 1.000 ms > L) no se ve ninguno de los números creados en el
  primer frame, y `created` ha subido exactamente en el número de golpes nuevos de los snapshots pintados entre medias
- **AND** al pulsar `Volver al menú`, la sonda informa de 0 números y 0 barras, sin errores no capturados

## MODIFIED Requirements

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
- **GIVEN** la casa de prueba sin destruir, un enemigo detrás de ella en (1.260, 700) con un golpe nuevo en ese tick,
  una explosión centrada en (1.260, 690) y el overlay de pausa abierto
- **WHEN** se pinta el snapshot
- **THEN** la barra de la casa y el número del enemigo están por encima de la parte alta de la casa y de la explosión,
  y el número por encima de la barra
- **AND** el HUD y el overlay de pausa están por encima de ambos, también tras pasar la ventana a 960 × 540

### Requirement: Limpieza de la vista al cambiar de partida
El sistema SHALL, en el primer frame de una partida nueva tras R (ver `run-results`) y en el primer frame del menú
tras `Volver al menú` (ver `main-menu`), no dejar visible ningún cadáver ni ningún sprite de jugador, enemigo,
proyectil, pulso, recogible de cualquier tipo, veta, dinamita o explosión, ni ningún aviso, número de daño ni barra de
vida, que no corresponda al snapshot pintado (en el menú, ninguno). Los cadáveres, las explosiones, los números de daño
y las apariciones de recogibles en curso (también las que están en su retardo) se descartan sin terminar su animación y
no reaparecen después. En la partida nueva cada recogible empieza su aparición desde cero, con las reglas de "Aparición
de oro, madera y carne" y de "Aparición escalonada de los recogibles del inicio", aunque su id coincida con el de un
recogible de la partida anterior; del mismo modo, cada golpe de la partida nueva crea su número aunque su
identificador coincida con el de un golpe de la anterior (ver "Números de daño"). Cerrar la escena de la partida a
mitad de una animación MUST NOT dejar animaciones en curso ni errores no capturados.

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
  el resto de estructuras con barra
- **WHEN** se pulsa R con la semilla 43 y se pinta su primer frame, y en otro caso se pulsa `Volver al menú` y se
  pintan 60 frames
- **THEN** en la partida nueva hay 0 números de daño, `created` vale 0 y hay exactamente una barra por estructura de la
  semilla 43, todas con el relleno completo
- **AND** en el menú la sonda informa de 0 números y 0 barras en los 60 frames
- **AND** el primer golpe de la partida nueva, de identificador 0, crea su número

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
  barra de vida, y el daño que recibe se muestra con los números de clase `sheep` de "Números de daño".

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

#### Scenario: Número de daño en una oveja
- **GIVEN** la oveja de prueba con vida 12 en (1.000, 1.000) que recibe un impacto del Linter en el tick T, y en otra
  partida la hoja `HappySheep_Idle` sin cargar
- **WHEN** se pinta el snapshot del tick T
- **THEN** en ambas hay 1 número `6` del color de `sheep` y ninguna barra de vida sobre la oveja

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

## REMOVED Requirements
(ninguno)
