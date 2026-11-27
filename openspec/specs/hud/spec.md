# HUD · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
El HUD de la partida: vida, tiempo restante, nivel/XP, bajas, oro, madera y piedra, derivados del último snapshot sin alterar la simulación.

## Requirements

### Requirement: Contenido y visibilidad del HUD
La vista SHALL mostrar un HUD con siete elementos: la vida del jugador (barra y número), el tiempo restante de la
partida, el nivel y la XP (la barra de XP de `leveling`), las bajas de la partida (ver `run-outcome`), el oro, la
madera (ver "Oro y madera en el HUD") y la piedra (ver "Piedra en el HUD"). El HUD MUST verse si y solo si existe una
partida: en todos sus estados (en curso, eligiendo mejora, en tienda y terminada) y también con la partida en pausa. En
el menú de inicio (ver `main-menu`), donde no existe partida, el HUD MUST NOT verse. El HUD muestra siempre los valores
del último snapshot pintado: mientras la partida está en pausa, eligiendo mejora o terminada, sus valores no cambian; en
la tienda solo cambian el oro y la vida, por las compras (la piedra no). No hay ningún botón ni indicador de tienda en el
HUD. El HUD solo depende del snapshot: no cambia la simulación.

#### Scenario: HUD al empezar
- **GIVEN** el snapshot de una partida recién creada con el contenido por defecto
- **WHEN** se pinta
- **THEN** el HUD es visible y muestra vida `100/100` con la barra de vida llena (relleno 1), tiempo `10:00`, nivel
  1 con la barra de XP vacía, 0 bajas, oro 0, madera 0 y piedra 0

#### Scenario: HUD con la partida terminada
- **GIVEN** una partida terminada con derrota en el tick 1.259 con nivel 3, 41 bajas, oro 25 y madera 4
- **WHEN** se pinta su snapshot y 60 frames más
- **THEN** el HUD sigue visible en todos ellos con vida `0/100`, tiempo `09:40`, nivel 3, 41 bajas, oro 25 y madera 4

#### Scenario: HUD en pausa
- **GIVEN** una partida con duración objetivo 36.000 ticks, en curso en el tick 600 con vida 75 de 100, nivel 2,
  9 bajas, oro 15 y madera 3
- **WHEN** se pausa y el motor informa de 600 frames de 16,667 ms
- **THEN** el HUD es visible en todos esos frames con vida `75/100`, tiempo `09:50`, nivel 2, 9 bajas, oro 15 y
  madera 3

#### Scenario: Sin HUD en el menú
- **GIVEN** el menú de inicio al cargar sin `?e2e`
- **WHEN** se pintan 60 frames
- **THEN** el HUD no es visible en ningún frame, tampoco los contadores de oro, madera y piedra

#### Scenario: HUD tras volver al menú y jugar
- **GIVEN** una partida en pausa en el tick 3.000 con nivel 5, 200 bajas, oro 60 y madera 9
- **WHEN** se pulsa `Volver al menú`, se pinta 1 frame, se pulsa `Jugar` y se pinta el snapshot del tick 0
- **THEN** el HUD no es visible en el frame del menú
- **AND** en el frame de la partida nueva es visible con vida `100/100`, tiempo `10:00`, nivel 1, 0 bajas, oro 0 y
  madera 0

#### Scenario: El HUD no altera la simulación
- **GIVEN** dos partidas idénticas con la misma semilla, inputs y elecciones, una pintada con HUD y otra sin pintar
- **WHEN** ambas ejecutan 600 ticks con ≥ 1 golpe, ≥ 1 baja y ≥ 1 recogida de oro o de madera
- **THEN** sus snapshots son iguales campo a campo en cada tick

#### Scenario: Contadores en el navegador [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` (mapa real) y un input que lleva al jugador hasta el
  montón de madera más cercano a la salida
- **WHEN** se avanza con `step(n)` hasta que la madera del snapshot es > 0, leyendo el HUD y el snapshot tras cada
  llamada
- **THEN** en cada lectura los números de oro y madera del HUD son iguales a los del snapshot pintado
- **AND** en la última lectura la madera mostrada es > 0 y no hay errores no capturados

#### Scenario: HUD en la tienda
- **GIVEN** una partida con duración objetivo 36.000 ticks que abre la tienda en el tick 600 con vida 40 de 100 y oro
  30
- **WHEN** el motor informa de 600 frames de 16,667 ms, se compra una curación de porción 25 y precio 10 y se pinta 1
  frame
- **THEN** durante los 600 frames el HUD es visible con tiempo `09:50`, vida `40/100` y oro 30
- **AND** tras la compra muestra vida `65/100`, oro 20 y tiempo `09:50`

#### Scenario: Piedra congelada en pausa y en la tienda
- **GIVEN** una partida en curso con piedra 6 y oro 30 que se pausa y, en otro caso, abre la tienda y compra un producto
  de precio 10
- **WHEN** el motor informa de 600 frames de 16,667 ms y se pinta 1 frame más
- **THEN** en todos esos frames el HUD muestra piedra 6

### Requirement: Vida en el HUD
La vista SHALL mostrar la vida como una barra cuyo relleno es vida actual / vida máxima efectiva del último
snapshot, acotado a [0, 1], y como el texto `actual/máxima`. Ambos números se muestran como enteros redondeados
hacia arriba, de modo que un jugador con vida > 0 nunca muestra 0.

#### Scenario: Vida llena
- **GIVEN** un snapshot con vida 100 y vida máxima 100
- **WHEN** se pinta
- **THEN** la barra de vida tiene relleno 1 y el texto es `100/100`

#### Scenario: Vida parcial con la vida máxima mejorada
- **GIVEN** un snapshot con vida 75 y vida máxima 120
- **WHEN** se pinta
- **THEN** la barra de vida tiene relleno 0,625 (error ≤ 0,001) y el texto es `75/120`

#### Scenario: Vida 0
- **GIVEN** un snapshot con vida 0 y vida máxima 100
- **WHEN** se pinta
- **THEN** la barra de vida tiene relleno 0 y el texto es `0/100`

#### Scenario: Vida fraccionaria
- **GIVEN** un snapshot con vida 0,5 y vida máxima 100
- **WHEN** se pinta
- **THEN** el texto es `1/100` y la barra tiene relleno 0,005 (error ≤ 0,001)

#### Scenario: Golpe entre dos snapshots
- **GIVEN** un snapshot pintado con vida 100 de 100 y el siguiente con vida 90 de 100
- **WHEN** se pinta el segundo
- **THEN** la barra de vida tiene relleno 0,9 (error ≤ 0,001) y el texto es `90/100`

### Requirement: Tiempo restante en el HUD
La vista SHALL mostrar el tiempo restante de la partida en formato `mm:ss`, calculado como los segundos restantes
redondeados hacia arriba: ⌈(duración objetivo en ticks − `snapshot.tick`) / 60⌉, nunca menor que 0. `ss` siempre
tiene 2 dígitos (00–59); `mm` tiene al menos 2 dígitos y no se acota a 59 (duraciones de 100 min o más muestran 3
dígitos). Con la duración objetivo por defecto, el HUD muestra `00:00` solo en el snapshot del tick 36.000.

#### Scenario: Valores en torno al inicio
- **GIVEN** una partida con duración objetivo 36.000 ticks
- **WHEN** se pintan los snapshots de los ticks 0, 1, 59, 60 y 61
- **THEN** el tiempo mostrado es `10:00`, `10:00`, `10:00`, `09:59` y `09:59` respectivamente

#### Scenario: Valores en torno al final
- **GIVEN** una partida con duración objetivo 36.000 ticks
- **WHEN** se pintan los snapshots de los ticks 35.940, 35.941, 35.999 y 36.000
- **THEN** el tiempo mostrado es `00:01`, `00:01`, `00:01` y `00:00` respectivamente

#### Scenario: Valor intermedio
- **GIVEN** una partida con duración objetivo 36.000 ticks
- **WHEN** se pinta el snapshot del tick 3.570 (540,5 s restantes)
- **THEN** el tiempo mostrado es `09:01`

#### Scenario: Otras duraciones
- **GIVEN** partidas con `durationSeconds` 90, 3.600 y 6.000
- **WHEN** se pinta el snapshot del tick 0 de cada una
- **THEN** el tiempo mostrado es `01:30`, `60:00` y `100:00` respectivamente

#### Scenario: El tiempo no corre mientras se elige mejora
- **GIVEN** una partida con duración objetivo 36.000 ticks que abre una oferta en el tick 600
- **WHEN** el motor informa de 600 frames de 16,667 ms con la oferta abierta
- **THEN** el tiempo mostrado es `09:50` en todos esos frames

### Requirement: Nivel y XP en el HUD
La vista SHALL incluir en el HUD la barra de XP y el número del nivel definidos en `leveling` ("Barra de XP y nivel
en la vista"), con el mismo comportamiento.

#### Scenario: Barra de XP dentro del HUD
- **GIVEN** un snapshot con nivel 2, XP 3 y XP para el siguiente nivel 10
- **WHEN** se pinta
- **THEN** el HUD muestra nivel 2 y la barra de XP tiene relleno 0,3 (error ≤ 0,001)

### Requirement: Bajas en el HUD
La vista SHALL mostrar el número de bajas del último snapshot como un entero completo, sin abreviar ni truncar, sin
separador de miles y sin ninguna etiqueta de texto (el HUD MUST NOT mostrar la palabra `Bajas`), junto a un **icono de
calavera**: un frame de la hoja del cadáver (`corpse`, `Factions/Knights/Troops/Dead/Dead.png`, ya en la nota de
procedencia) de `content/appearance.json`, cuyo índice declaran los datos de aspecto (ver "Datos de aspecto del icono de
bajas" en `sprite-rendering`). El icono y el número de bajas forman un solo elemento del HUD, con las reglas de
"Iconos de los contadores del HUD". Si la hoja no carga, el icono se pinta con el color de reserva del cadáver y el
número se sigue mostrando, sin errores no capturados. El icono no se anima ni cambia con el snapshot. La pantalla de
resultados conserva su texto `Bajas: N` (ver `run-results`).

#### Scenario: Sin bajas
- **GIVEN** un snapshot con 0 bajas
- **WHEN** se pinta
- **THEN** el HUD muestra el icono de calavera con el número `0`, y ningún texto del HUD contiene `Bajas`

#### Scenario: Bajas que cambian entre snapshots
- **GIVEN** un snapshot pintado con 9 bajas y el siguiente con 12
- **WHEN** se pinta el segundo
- **THEN** el HUD muestra `12` junto a la calavera, que conserva la misma textura, el mismo frame y la misma posición

#### Scenario: Muchas bajas
- **GIVEN** un snapshot con 12.345 bajas
- **WHEN** se pinta
- **THEN** el texto de las bajas del HUD es exactamente `12345`

#### Scenario: Calavera de la hoja del cadáver
- **GIVEN** el contenido por defecto y el snapshot de una partida recién creada, con dobles de Phaser
- **WHEN** se crea el HUD
- **THEN** el icono de bajas usa la textura de `Dead.png` en el frame declarado para el icono de bajas en los datos de
  aspecto, no flota ni reproduce ninguna animación

#### Scenario: Calavera que no carga
- **GIVEN** el snapshot de una partida recién creada y la hoja `Dead.png` sin cargar (las de oro, madera y piedra
  cargadas)
- **WHEN** se pinta el HUD
- **THEN** el contador de bajas es visible con un icono del color de reserva del cadáver (`#b0b4ba` con los datos del
  repositorio) y el número `0`, los de oro, madera y piedra con su icono de arte, y no hay errores no capturados

#### Scenario: Resultados sin cambios
- **GIVEN** una partida terminada con 41 bajas
- **WHEN** se muestra la pantalla de resultados
- **THEN** su línea de bajas es `Bajas: 41`, como antes del change

### Requirement: HUD anclado a la ventana
La vista SHALL anclar cada elemento del HUD (barra y número de vida, tiempo restante, barra de XP y nivel, bajas, oro,
madera y piedra) a un borde, una esquina o el centro de un borde de la ventana. Para un mismo factor de escala del HUD
(ver "Escala del HUD por escalones"), la distancia en pantalla de cada elemento a su anclaje MUST ser la misma sea cual
sea el tamaño de la ventana (error ≤ 1 px). Con una ventana ≥ 960 × 540 en ambos ejes, cada elemento MUST quedar entero
dentro de la ventana y ningún par de elementos del HUD MUST solaparse. Si la ventana supera el tope de vista, el HUD se
ancla a la ventana o a la vista según fije el design, con las mismas garantías. Al redimensionar, el HUD MUST
reubicarse desde el primer frame pintado tras el cambio (ver "Redimensionado de la ventana" en `world-camera`). El
icono y el número de cada contador de bajas, de oro, de madera y de piedra forman un solo elemento, con los iconos de
"Iconos de los contadores del HUD".

#### Scenario: Mismo anclaje con dos ventanas
- **GIVEN** el snapshot de una partida recién creada pintado con una ventana de 960 × 540 y otro igual pintado con una
  de 1.280 × 720 (ambas con el mismo factor de escala)
- **WHEN** se mide, para cada elemento del HUD, su distancia al borde o esquina de su anclaje
- **THEN** las distancias y los tamaños de cada elemento son iguales en ambas ventanas (error ≤ 1 px)

#### Scenario: Esquina opuesta que sigue a la ventana
- **GIVEN** un elemento del HUD anclado al borde derecho y una partida pintada con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 1.000 × 600 y se pinta el siguiente frame
- **THEN** su borde derecho está a la misma distancia del borde derecho de la ventana que antes (error ≤ 1 px), es
  decir, se ha desplazado 280 px a la izquierda

#### Scenario: HUD entero y sin solapes
- **GIVEN** un snapshot con vida `120/120`, tiempo `10:00`, nivel 99, 12.345 bajas, oro 123.456, madera 12.345 y
  piedra 12.345
- **WHEN** se pinta con ventanas de 960 × 540, 1.280 × 720, 1.920 × 1.080, 2.560 × 1.440 y 3.840 × 2.160
- **THEN** en cada una los ocho elementos del HUD (vida, tiempo, barra de XP, nivel, bajas con su calavera, oro,
  madera y piedra, cada contador con su icono de lado s·k) están enteros dentro de la ventana y no se solapan entre sí

#### Scenario: Ventana menor que 960 × 540
- **GIVEN** una partida en curso pintada con una ventana de 640 × 360
- **WHEN** se pinta un frame
- **THEN** el HUD es visible con el factor de escala mínimo (× 1), cada elemento a la misma distancia de su anclaje que
  con 960 × 540, y no hay errores no capturados

#### Scenario: Contadores reubicados al redimensionar
- **GIVEN** una partida en pausa con 7 bajas, oro 15, madera 3 y piedra 4 pintada con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 960 × 540 y se pinta el siguiente frame, y después a 2.560 × 1.440
- **THEN** en cada frame los contadores de bajas, oro, madera y piedra están a la distancia de su anclaje que
  corresponde a su factor de escala (error ≤ 1 px), enteros dentro de la ventana, sin solapar otro elemento y con los
  mismos números

### Requirement: Escala del HUD por escalones
**Sin modo móvil** (ver "Activación del modo móvil" en `mobile-display`), la vista SHALL pintar el HUD con un factor de
escala k entero ≥ 1 que depende solo del tamaño de la ventana (nunca del snapshot): no hay escalado continuo. k MUST
NOT disminuir cuando la ventana crece en un eje sin decrecer en el otro. k MUST valer 1 con cualquier ventana de hasta
1.280 × 720 en ambos ejes (incluidas las menores que 960 × 540) y MUST ser ≥ 2 con cualquier ventana de al menos
2.560 × 1.440 en ambos ejes. **En modo móvil**, k es el factor fraccionario de "Escala de la UI del lienzo en modo
móvil" (`mobile-display`), que también depende solo del tamaño de la ventana y del contenido. En ambos modos, con
factor k, cada elemento del HUD MUST medir k veces lo que mide con factor 1, y su distancia al anclaje MUST ser k veces
la de factor 1 (error ≤ 1 px, o ≤ 1 unidad del lienzo en modo móvil). El cambio de factor al redimensionar MUST verse
desde el primer frame pintado tras el cambio. La escala MUST NOT cambiar la simulación ni los valores mostrados. Los
escenarios de este requisito que no mencionan el modo móvil se ejecutan sin él.

#### Scenario: Escala mínima
- **GIVEN** ventanas de 320 × 180, 960 × 540 y 1.280 × 720
- **WHEN** se pinta el HUD en cada una
- **THEN** el factor de escala es 1 en las tres

#### Scenario: Escala en pantallas grandes
- **GIVEN** ventanas de 2.560 × 1.440 y 3.840 × 2.160
- **WHEN** se pinta el HUD en cada una
- **THEN** el factor de escala es un entero ≥ 2 en ambas y el de 3.840 × 2.160 no es menor que el de 2.560 × 1.440

#### Scenario: Tamaños proporcionales al factor
- **GIVEN** el mismo snapshot pintado con una ventana de factor 1 y otra de factor k ≥ 2
- **WHEN** se miden la barra de vida, la barra de XP y la altura del texto del tiempo restante
- **THEN** cada medida con factor k es k veces la de factor 1 (error ≤ 1 px)

#### Scenario: Monotonía
- **GIVEN** la secuencia de ventanas 960 × 540, 1.280 × 720, 1.600 × 900, 1.920 × 1.080, 2.560 × 1.440 y
  3.840 × 2.160
- **WHEN** se calcula el factor de escala de cada una
- **THEN** cada factor es un entero ≥ 1 y ninguno es menor que el anterior

#### Scenario: Cambio de escalón al redimensionar
- **GIVEN** una partida en pausa pintada con una ventana de 1.280 × 720 (factor 1)
- **WHEN** la ventana pasa a 2.560 × 1.440 y se pinta el siguiente frame
- **THEN** el HUD se pinta con un factor ≥ 2, muestra los mismos valores que antes y el snapshot no ha cambiado

#### Scenario: Factor fraccionario en modo móvil
- **GIVEN** el modo móvil, un contenido con texto mínimo 12 px CSS, una ventana de 844 × 390 y el mismo snapshot
  pintado sin modo móvil con una ventana de 1.280 × 720 (factor 1)
- **WHEN** se miden la barra de vida, la barra de XP y la altura del texto del tiempo restante en ambos
- **THEN** el factor en modo móvil vale 1,4066 (error ≤ 0,001) y cada medida, en unidades del lienzo, es 1,4066 veces
  la de factor 1 (error ≤ 1 unidad)
- **AND** el texto del tiempo restante mide ≥ 12 px CSS en pantalla (error ≤ 0,1 px)

#### Scenario: El mismo tamaño de ventana con y sin modo móvil
- **GIVEN** una ventana de 1.280 × 720 con `?mobile=0` y, en otra carga, con `?mobile=1`, y un contenido con texto
  mínimo 12 px CSS
- **WHEN** se pinta el HUD
- **THEN** el factor vale 1 en ambas (en la segunda, k_min ≈ 0,762 < 1 con el lienzo de 1.137,78 × 640)
- **AND** el texto base mide 14 px CSS en la primera y 15,75 px CSS en la segunda (error ≤ 0,1 px), y ninguna cambia
  el snapshot

### Requirement: Oro y madera en el HUD
La vista SHALL mostrar en el HUD dos contadores, el de oro y el de madera, cada uno con un **icono** y el número del
último snapshot como un entero completo, sin abreviar, sin separador de miles ni truncar. El icono del oro usa el
aspecto del recogible `gold` (bolsa de oro, `G_Idle`) y el de la madera el del recogible `wood` (`W_Idle`) (ver
"Aspectos de los recogibles y de las vetas" en `sprite-rendering`). Si la hoja de un icono no carga, el icono se
pinta con el color de reserva de su tipo y el número se sigue mostrando, sin errores no capturados. Los contadores
cambian solo cuando cambia el snapshot pintado.

#### Scenario: Contadores al empezar
- **GIVEN** el snapshot de una partida recién creada
- **WHEN** se pinta
- **THEN** el HUD muestra el icono del oro con el número 0 y el icono de la madera con el número 0

#### Scenario: Contadores que cambian entre snapshots
- **GIVEN** un snapshot pintado con oro 10 y madera 2 y el siguiente con oro 35 y madera 5
- **WHEN** se pinta el segundo
- **THEN** el HUD muestra oro 35 y madera 5

#### Scenario: Números grandes
- **GIVEN** un snapshot con oro 123.456 y madera 12.345
- **WHEN** se pinta
- **THEN** el HUD muestra los números 123456 y 12345 completos

#### Scenario: Icono que no carga
- **GIVEN** el snapshot de una partida recién creada y la hoja del oro sin cargar (la de la madera, cargada)
- **WHEN** se pinta el HUD
- **THEN** el contador de oro es visible con su icono de reserva y el número 0, el de madera con su icono de arte, y no
  hay errores no capturados

### Requirement: Piedra en el HUD
La vista SHALL mostrar en el HUD un tercer contador de recursos, el de **piedra**, junto a los de oro y madera, con un
**icono** y el número de piedra del último snapshot (`resources.stone`) como un entero completo, sin abreviar, sin
separador de miles ni truncar. El icono usa siempre el aspecto de la roca `medium` del recogible `stone` (ver "Aspectos
de los recogibles y de las vetas" en `sprite-rendering`). Con `?e2e`, la sonda del HUD (`window.__sprint.hud`) expone
además `stone` con el número mostrado, como ya hace con el oro y la madera. Si su hoja no carga, el icono se pinta con el color de reserva de
`stone` y el número se sigue mostrando, sin errores no capturados. El contador cambia solo cuando cambia el snapshot
pintado, sigue las reglas de anclaje y de escala del resto del HUD (factor ×1 y ×2 incluidos) y su icono y su número
forman un solo elemento. Los contadores de oro y madera conservan su contenido y su comportamiento.

#### Scenario: Piedra al empezar
- **GIVEN** el snapshot de una partida recién creada
- **WHEN** se pinta
- **THEN** el HUD muestra el icono de la piedra con el número 0, junto a los contadores de oro 0 y madera 0

#### Scenario: Piedra que cambia entre snapshots
- **GIVEN** un snapshot pintado con piedra 2 y el siguiente con piedra 9
- **WHEN** se pinta el segundo
- **THEN** el HUD muestra piedra 9 y los contadores de oro y madera no cambian

#### Scenario: Número grande
- **GIVEN** un snapshot con piedra 12.345
- **WHEN** se pinta
- **THEN** el HUD muestra el número 12345 completo

#### Scenario: Icono de la piedra que no carga
- **GIVEN** el snapshot de una partida recién creada y la hoja `Deco/05.png` (roca `medium`) sin cargar (las del oro y
  la madera, cargadas)
- **WHEN** se pinta el HUD
- **THEN** el contador de piedra es visible con su icono de reserva y el número 0, los de oro y madera con su icono de
  arte, y no hay errores no capturados

#### Scenario: Piedra en el navegador [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` y el mismo recorrido que "Contadores en el navegador"
- **WHEN** se avanza con `step(n)` leyendo el HUD y el snapshot tras cada llamada
- **THEN** en cada lectura `hud.stone` es igual a `resources.stone` del snapshot pintado y
  `sprites.pickups.stone.visible` es igual al número de recogibles `stone` del snapshot, sin errores no capturados

### Requirement: Paneles del HUD con piezas de UI
La vista SHALL pintar detrás de los elementos del HUD, cuando existe la textura de `panel` y el renderizador es WebGL,
**exactamente tres** piezas nine-slice de `panel`: la izquierda, que contiene la barra y el número de vida y la barra de
XP y el nivel; la central, que contiene el tiempo restante; y la derecha, que contiene los cuatro contadores con icono
(bajas, oro, madera y piedra). Cada panel MUST contener entero cada elemento que le toca (en la derecha, cada icono y
cada número) con un margen ≥ (margen de la pieza × k) px por cada lado, con esquinas en pantalla de (margen × k) px
exactos; los tres paneles MUST quedar enteros dentro de la ventana con una ventana ≥ 960 × 540 y no solaparse entre sí.
El tamaño de cada panel depende solo de la ventana y de k, nunca del snapshot: se calcula para el número de caracteres
de reserva de cada texto (de modo que vida `120/120`, nivel 99, las bajas `12345` sin etiqueta, oro 123.456, madera
12.345 y piedra 12.345 caben) y no cambia entre frames. Los textos del HUD (vida, tiempo, nivel, el número de bajas y los
números de oro, madera y piedra) MUST usar la fuente pixel y, con paneles, la tinta `text` de `panel`. Al actualizar el
HUD cada frame y al redimensionar, los paneles existentes MUST recolocarse sin crear otros: el número de objetos del HUD
no crece con los frames ni con los RESIZE. Sin la textura de `panel` o sin WebGL, el HUD se pinta sin paneles y con su
texto `#ffffff` (ver "Reserva de las piezas de UI y de la fuente" en `sprite-rendering`), con el mismo layout.

#### Scenario: Tres paneles con su contenido
- **GIVEN** la textura de `panel` cargada, un renderizador WebGL y el snapshot de una partida recién creada, pintado con
  ventanas de 960 × 540 (k = 1) y de 2.560 × 1.440 (k = 2)
- **WHEN** se pinta el HUD con dobles de Phaser
- **THEN** hay exactamente 3 piezas nine-slice de `panel`; la izquierda contiene las barras de vida y de XP con sus
  textos, la central el tiempo y la derecha los 4 contadores con su icono, cada elemento a ≥ margen × k px de cada
  borde de su panel
- **AND** los 3 paneles están enteros en la ventana y no se solapan entre sí

#### Scenario: Paneles independientes del snapshot
- **GIVEN** el HUD con paneles pintado con una ventana de 1.280 × 720 para el snapshot de una partida recién creada y
  para otro con vida `120/120`, nivel 99, 12.345 bajas, oro 123.456, madera 12.345 y piedra 12.345
- **WHEN** se miden los 3 paneles en ambos frames
- **THEN** tienen la misma posición y el mismo tamaño (error ≤ 1 px) y en el segundo cada elemento sigue entero dentro
  de su panel

#### Scenario: Seiscientos frames sin crear objetos
- **GIVEN** una partida en curso con el HUD pintado con dobles de Phaser
- **WHEN** se pintan 600 frames con vida, XP, tiempo, bajas y recursos que cambian, y la ventana pasa de 1.280 × 720 a
  2.560 × 1.440 y a 960 × 540 en los frames 200 y 400
- **THEN** el número de objetos creados por el HUD tras el primer frame es el mismo que en el frame 600, con las 3
  piezas de `panel` del primer frame y los 4 iconos de contador del primer frame
- **AND** en el frame 600 cada panel está en su rectángulo para 960 × 540 y k = 1

#### Scenario: Fuente pixel en los textos del HUD
- **GIVEN** el contenido por defecto
- **WHEN** se crea el HUD con dobles de Phaser
- **THEN** cada texto del HUD se crea con la familia `"Departure Mono", monospace`

### Requirement: Iconos de los contadores del HUD
La vista SHALL pintar, en la columna derecha del HUD y de arriba abajo, cuatro contadores con icono y número: bajas,
oro, madera y piedra. Con factor de escala k (ver "Escala del HUD por escalones"):
- los cuatro iconos MUST ser cuadrados del mismo lado s·k en pantalla, con s (lado a ×1) un valor de aspecto que fija
  el design y **s > 16** (el lado de antes de este change);
- los cuatro iconos MUST tener el mismo centro x (error ≤ 1 px) y su número MUST ir junto a su icono, en el mismo
  lado para los cuatro, con su centro vertical a ≤ 1 px del centro vertical de su icono;
- el paso vertical p·k entre los centros de dos filas consecutivas MUST ser el mismo para los cuatro contadores
  (error ≤ 1 px), con p (paso a ×1) un valor de aspecto que fija el design y **p > 18** (el paso de antes) y p ≥ s;
- las cajas de dos filas cualesquiera (icono y número de cada una, con los números de reserva de "Paneles del HUD con
  piezas de UI") MUST NOT solaparse.

El icono de cada contador puede mostrar un recorte del frame de su hoja (por ejemplo, la zona con dibujo) si el design
lo declara en los datos de aspecto; su lado en pantalla sigue siendo s·k. El tamaño de los iconos MUST NOT depender del
snapshot ni de la escala de los recogibles del mundo (ver "Iconos de recurso sin aparición ni flote" en
`sprite-rendering`), y cambiarlo MUST NOT cambiar la simulación.

#### Scenario: Iconos mayores a ×1 y a ×2
- **GIVEN** el snapshot de una partida recién creada pintado con ventanas de 1.280 × 720 (k = 1) y de 2.560 × 1.440
  (k = 2), con dobles de Phaser
- **WHEN** se miden los iconos de bajas, oro, madera y piedra
- **THEN** con k = 1 los cuatro miden s × s px con s > 16, y con k = 2 miden 2s × 2s px (error ≤ 1 px)
- **AND** en ambos los cuatro tienen el mismo centro x (error ≤ 1 px) y están en el orden bajas, oro, madera, piedra
  de arriba abajo

#### Scenario: Filas más separadas y sin solapes
- **GIVEN** un snapshot con 12.345 bajas, oro 123.456, madera 12.345 y piedra 12.345 pintado con una ventana de
  960 × 540 (k = 1)
- **WHEN** se miden las cajas de icono y número de los cuatro contadores
- **THEN** el paso entre los centros de filas consecutivas es el mismo en las tres parejas, es > 18 px y ≥ el lado del
  icono (error ≤ 1 px)
- **AND** ninguna caja de una fila se solapa con una caja de otra fila, y el centro vertical de cada número está a
  ≤ 1 px del de su icono

#### Scenario: Iconos del HUD en modo móvil
- **GIVEN** el modo móvil, un contenido con texto mínimo 12 px CSS, una ventana de 844 × 390 y el snapshot de "HUD
  entero y sin solapes"
- **WHEN** se pinta el HUD
- **THEN** cada icono mide s·k unidades del lienzo con el k de "Escala de la UI del lienzo en modo móvil"
  (`mobile-display`, error ≤ 1 unidad), los ocho elementos del HUD están enteros dentro del lienzo sin solaparse y el
  texto base mide ≥ 12 px CSS (error ≤ 0,1 px)

<!-- historial: 0006-run-lifecycle-hud (2026-11-20) -->
<!-- historial: 0009-main-menu (2026-11-20) -->
<!-- historial: 0017-fullscreen-view (2026-11-24) -->
<!-- historial: 0022-resources-sheep (2026-11-24) -->
<!-- historial: 0024-split-progression-castle (2026-11-25) -->
<!-- historial: 0025-stone-resource (2026-11-25) -->
<!-- historial: 0032-ui-kit (2026-11-26) -->
<!-- historial: 0033-mobile-web (2026-11-26) -->
<!-- historial: 0036-ui-polish (2026-11-27) -->
