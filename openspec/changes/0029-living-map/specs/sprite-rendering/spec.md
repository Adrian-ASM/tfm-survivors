# Spec delta · sprite-rendering

> Change 0029 `living-map`. Solo render y datos de aspecto: decoración no bloqueante en el mapa generado, árboles
> que se balancean con fase propia y torres goblin intactas con banderas animadas. Nada de esto cambia la
> simulación, el mapa, las firmas doradas ni el balance.
>
> Términos de este delta:
> - **Celda válida para decoración**: celda del mapa generado cuyo terreno es `grass` y que no está en ninguna de las
>   **zonas excluidas**: (a) la zona de inicio (ver `procedural-map`); (b) la huella del castillo ampliada 1 celda por
>   cada lado (con el contenido por defecto, columnas 29–35 × filas 14–19); (c) la huella de un solar (ver
>   `build-sites`); (d) la huella de una estructura goblin, casa o torre (ver `goblin-structures`); (e) una celda de
>   orilla (ver "Orillas por autotile de 4 vecinos"); (f) una **celda de recurso**: la que contiene la posición de un
>   montón de madera o de una veta de oro (ver `resources`). Una celda `grass` vecina de un tronco no está excluida
>   por serlo.
> - **Decoración**: pieza visual del plan del arte del mapa con una celda (su **celda de anclaje**), una hoja de las
>   admitidas y una posición de mundo de su origen. Es **baja** o **alta** según los datos de aspecto; con los datos
>   del repositorio las altas son exactamente `Deco/16`, `Deco/17` y `Deco/18`. Una baja usa 1 objeto de escena del
>   mapa; una alta, 2 (su **base**, la parte del dibujo por debajo del borde superior de su celda de anclaje, y su
>   **parte alta**, el resto, separadas con error ≤ 1 px, como el tronco y la copa del árbol).
> - **Reloj de render**: el tiempo de render acumulado de la partida, en ms, con el que ya se anima la espuma (un
>   solo reloj para todo el arte del mapa). Solo avanza en los frames pintados con la partida en curso y sin pausa:
>   se congela en pausa, con una oferta de mejora abierta, en la tienda, en la obra y con la partida terminada, y
>   sigue desde el mismo valor al reanudar. Fuera del modo manual no depende de los ticks simulados ni de `speed`; en
>   modo manual (`?e2e&manual`, change 0014) avanza `n × TICK_MS` con cada `step(n)` que ejecuta n ticks en curso.

## ADDED Requirements

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
  repositorio, los frames `[0, 1, 2, 3, 4, 5]` de `Tree.png` a 6 fps; el tocón, frame 8, nunca se muestra), con su
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

Espuma, árboles y torres usan el mismo reloj de render: con la partida en pausa, con una oferta de mejora abierta, en
la tienda, en la obra y con la partida terminada el reloj se congela y todos muestran el mismo frame de hoja en cada
frame pintado de ese estado; al volver a la partida en curso sin pausa siguen desde ese frame, sin saltos. Con una
`idle` de 1 frame el elemento queda estático. Animar el arte del mapa MUST
NOT cambiar la simulación, el plan (elementos, cajas, capas, orden), los recuentos de la sonda ni `drawn`.

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
- **THEN** las tres listas de fases son iguales celda a celda y estructura a estructura, y cada fase está en [0, 5]
  (árbol) o en [0, 3] (torre)

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
  árbol que no contiene el frame 5 o la hoja de la torre intacta sin cargar
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
  `idle` `[0, 1, 2, 3, 4, 5]` a 6 fps en bucle, de puente con sus 2 recortes y de castillo
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
- la gema (recogible `xp`), con una hoja del pack distinta de `G_Idle.png` y de `W_Idle.png`, o sin hoja (ver
  "Aspectos de los recogibles y de las vetas");
- el recogible `gold`, con `G_Idle.png` (bolsa de oro); el recogible `wood`, con `W_Idle.png`; el `meat`, con
  `M_Idle.png`; el `stone`, con las rocas `Deco/04.png`, `Deco/05.png` y `Deco/06.png`;
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
de procedencia (ver `asset-provenance`). Del pack solo se versionan las hojas que usan los datos de aspecto (ningún
otro color de castillo ni de torre, ni `Rocks`, ni `Fire.png`, ni `Wood_Tower_InConstruction`, ni
`GoldMine_Destroyed.png`, ni `M_Spawn`, ni `HappySheep_All`, ni `Deco/12`–`Deco/15`). Las rocas `Deco/04`–`06` son
solo de la piedra recogible: ningún aspecto de decoración las usa. Cambiar el arte de un elemento MUST requerir solo
cambios de datos y de assets, no de código.

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
- **AND** las de los 11 aspectos de decoración terminan en `Deco/01.png`, `Deco/02.png`, `Deco/03.png`, `Deco/07.png`,
  `Deco/08.png`, `Deco/09.png`, `Deco/10.png`, `Deco/11.png`, `Deco/16.png`, `Deco/17.png` y `Deco/18.png`, una cada
  una, y ninguna es la hoja de una roca de la piedra
- **AND** todas las rutas de origen pertenecen a Tiny Swords Update 010

#### Scenario: Solo las hojas usadas
- **GIVEN** la lista de ficheros versionados y los datos de aspecto del repositorio
- **WHEN** se compara cada asset gráfico de la nota de procedencia con las hojas de los datos de aspecto
- **THEN** cada asset de la nota es la hoja de ≥ 1 aspecto y ningún fichero versionado contiene `Castle_Red`,
  `Castle_Yellow`, `Castle_Purple`, `Castle_Black`, `Rocks`, `Fire`, `Wood_Tower_InConstruction`,
  `GoldMine_Destroyed`, `M_Spawn` ni `HappySheep_All`
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
recorte ni del reloj de render. Los de celdas, de elementos del mapa, de estructuras y de vetas conservan el
significado y el valor que tenían antes de este change para la misma semilla y el mismo contenido; los objetos del
mapa valen los de antes de este change más los objetos de escena de la decoración pintada. Solo `drawn` depende del
recorte. Los peligros, los recogibles (montones, carne y piedras incluidos) y las ovejas no forman parte del plan del
mapa ni de sus objetos.

Un sprite oculto por el parpadeo cuenta como no visible. En modo menú los recuentos de jugador, enemigo, cadáver, oveja,
proyectil, pulso, recogibles de cada tipo, dinamita, aviso, explosión, celdas del mapa, elementos del mapa,
decoración, estructuras, vetas, objetos del mapa y `drawn` valen 0. Sin `?e2e` MUST NOT existir. Leer la sonda MUST NOT
cambiar la simulación ni lo que se pinta.

#### Scenario: Recuento coherente con el snapshot
- **GIVEN** `?e2e&seed=42` y una partida en curso
- **WHEN** se pintan 600 frames y en cada uno se leen la sonda de render y el snapshot pintado
- **THEN** en cada frame los sprites visibles de enemigo, oveja, proyectil, pulso, dinamita, aviso y explosión son
  iguales en número a los enemigos, ovejas, proyectiles, pulsos, dinamitas, avisos y explosiones del snapshot, los de
  gema, `gold`, `wood`, `meat` y `stone` a los recogibles de cada tipo del snapshot, y el de jugador vale 1 salvo en los
  frames en que el parpadeo lo oculta, que vale 0
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
- **AND** en ambas lecturas los sprites `wood` y las vetas pintadas activas son iguales a los montones y las vetas
  activas del snapshot, sin reserva
- **AND** en ambas lecturas los sprites de oveja son iguales en número y por estado a las ovejas del snapshot (en la
  primera, tantas como el tope de ovejas vivas del contenido), y los de `meat` a los recogibles `meat` del snapshot,
  ninguno con reserva

#### Scenario: Totales del mapa con estructuras y vetas
- **GIVEN** el contenido por defecto y las semillas 42 y 123
- **WHEN** se calcula el plan del mapa y los recuentos de la sonda, con una ventana de 960 × 540, de 1.280 × 720 y
  de 3.840 × 2.160, con el jugador en el centro del mundo y en (16, 16), y con el reloj de render en 0 y en 10.000 ms
- **THEN** en todos los casos las celdas pintadas por tipo, los elementos del mapa pintados y con reserva, la
  decoración, las estructuras pintadas, las vetas pintadas y los objetos del mapa son iguales entre sí
- **AND** las celdas pintadas por tipo, los elementos del mapa, las estructuras y las vetas son iguales a los de antes
  de este change; los objetos del mapa son los de antes (737 y 820 respectivamente) más los de la decoración de cada
  semilla, ≤ 950, y ninguno es una piedra

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

### Requirement: Variedad de árboles por semilla
El sistema SHALL dar a cada celda `trunk` un volteo (si el aspecto del árbol lo admite) y una fase de su animación
`idle` (ver "Animación del arte del mapa"), elegidos por una función determinista de la semilla de la partida y de la
celda. Los árboles ya no tienen modelos fijos: todos reproducen la misma animación y la variedad dentro de un mapa la
dan la fase y el volteo. Elegirlos MUST NOT consumir el azar de la partida ni el del mapa ni ningún otro
`RandomGenerator`, MUST NOT usar un flujo de azar nuevo, MUST NOT cambiar el snapshot ni el mapa y no depende del
tick, del número de frames pintados ni de las partidas anteriores de la carga: la misma semilla y el mismo mapa dan
siempre las mismas fases y volteos.

#### Scenario: Mismas fases con la misma semilla
- **GIVEN** el contenido por defecto, la semilla 42 y su mapa generado
- **WHEN** se calculan la fase y el volteo de sus celdas `trunk` dos veces, y una tercera tras pintar 600 frames y
  pulsar R con la misma semilla
- **THEN** las tres listas de fases y volteos son iguales celda a celda

#### Scenario: Variedad dentro de un mapa
- **GIVEN** los datos de aspecto del repositorio (`idle` del árbol de 6 frames) y el contenido por defecto
- **WHEN** se calculan las fases de las celdas `trunk` del mapa de cada semilla de 1 a 50
- **THEN** en cada mapa hay ≥ 2 fases distintas

#### Scenario: Otra semilla, otras fases
- **GIVEN** un mapa explícito de hierba con troncos en las 20 celdas de columnas 2–6 y filas 2–5
- **WHEN** se calculan sus fases con la semilla 42 y con la semilla 43
- **THEN** las dos listas difieren en ≥ 1 celda

#### Scenario: La variedad no toca la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick
  y la política de elección fija, una con los datos de aspecto del repositorio y otra con la `idle` del árbol de un
  único frame y sin volteo
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots y sus mapas son iguales campo a campo en cada tick

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

#### Scenario: Decoración baja y alta
- **GIVEN** un plan de arte del mapa preparado para el test con una decoración baja D de `Deco/08` en la celda c1 y una
  alta E de `Deco/18` en la celda c2 (y del borde superior de c2 = Y), y un snapshot con un enemigo y una gema sobre
  el origen de D, y otro enemigo en (x del origen de E, Y − 10)
- **WHEN** se pinta el snapshot
- **THEN** D está por debajo de la gema y del enemigo que la pisan
- **AND** la base de E (y ≥ Y) está por debajo del segundo enemigo y su parte alta (y < Y) por encima de él y por
  debajo de los avisos y del HUD

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

#### Scenario: Tope de objetos sin navegador
- **GIVEN** el contenido y los datos de aspecto del repositorio y las semillas 42 y 123
- **WHEN** un test de `verify` calcula el plan del arte del mapa de cada una
- **THEN** tiene ≤ 950 objetos, decoración incluida, y el número exacto de objetos de cada semilla se anota en el
  verify-report

#### Scenario: Fps con el mapa real [realtime]
- **GIVEN** `CI_LIKE=1` y la medición de fps del proyecto `realtime` con las semillas 42 y 123 y el mapa real
- **WHEN** se ejecutan 3 pasadas y se toma la mediana
- **THEN** se informa del fps de cada semilla, de su porcentaje sobre 21,6 y 21,9 fps y de su diferencia con 14,1 y
  12,9 fps respectivamente

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

#### Scenario: Caja de los objetos animados
- **GIVEN** el contenido por defecto, la semilla 42 y los datos de aspecto del repositorio
- **WHEN** se compara la caja del plan de cada tronco, copa y parte de torre goblin intacta con el rectángulo que
  ocupa su dibujo con cada frame de su `idle` (6 del árbol, 4 de la torre)
- **THEN** cada uno de esos rectángulos está dentro de la caja (error ≤ 1 px), y la caja es la misma con el reloj de
  render en 0 y en 10.000 ms

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

#### Scenario: Torre intacta animada
- **GIVEN** una torre explícita sin destruir con huella en columnas 40–41 y filas 5–6, todas las hojas cargadas y su
  fase ψ
- **WHEN** se pintan 60 frames de 16,667 ms
- **THEN** su dibujo tiene su origen en (2.460, 420) (error ≤ 1 px), usa la hoja `Wood_Tower_<color>`, muestra en cada
  frame el frame de hoja que dan ψ y el reloj de render, y pasa por los 4 frames de su `idle`
- **AND** en cada frame su parte baja es la del dibujo con y ≥ 360 y su parte alta la de y < 360, con el mismo frame
  de hoja

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

## REMOVED Requirements
(ninguno)
